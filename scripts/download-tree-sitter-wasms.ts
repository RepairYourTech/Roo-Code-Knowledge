#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import * as https from "https"

/**
 * CLI interface for download options
 */
interface DownloadOptions {
	strictMode: boolean
}

/**
 * Parse command line arguments
 */
function parseArgs(): DownloadOptions {
	const args = process.argv.slice(2)
	const strictMode = args.includes("--strict") || args.includes("-s")

	return { strictMode }
}

/**
 * Show usage information
 */
function showUsage(): void {
	console.log(`
Usage: download-tree-sitter-wasms.ts [options]

Options:
  --strict, -s    Exit with non-zero code if any downloads fail (strict mode)
  --help, -h      Show this help message

Description:
  Downloads tree-sitter WASM files for code parsing. In default mode, the script
  will exit with code 0 even if some downloads fail, as long as at least one
  WASM file is successfully downloaded. In strict mode, any download failure
  will result in a non-zero exit code.
`)
}

// List of required languages matching those in languageParser.ts
const LANGUAGES = [
	"javascript",
	"typescript",
	"tsx",
	"python",
	"rust",
	"go",
	"cpp",
	"c",
	"c_sharp", // Note: c-sharp in queries, but c_sharp in file naming
	"ruby",
	"java",
	"php",
	"html",
	"swift",
	"kotlin",
	"css",
	"ocaml",
	"scala",
	"solidity",
	"toml",
	"xml",
	"yaml",
	"vue",
	"lua",
	"systemrdl",
	"tlaplus",
	"zig",
	"embedded_template",
	"elisp",
	"elixir",
]

const TARGET_DIR = path.join(process.cwd(), "src", "services", "tree-sitter")
const WASM_VERSION = "0.1.12"
const NODE_MODULES_WASM_DIR = path.join("node_modules", "tree-sitter-wasms", "out")
const CDN_BASE_URL = "https://unpkg.com/tree-sitter-wasms@" + WASM_VERSION + "/out"

/**
 * Downloads a file from a URL to a local path with redirect handling and proper cleanup
 */
async function downloadFile(url: string, destPath: string, maxRedirects: number = 5): Promise<void> {
	return new Promise((resolve, reject) => {
		let redirectCount = 0
		let currentUrl = url

		const attemptDownload = (targetUrl: string) => {
			const file = fs.createWriteStream(destPath)
			let cleanupPerformed = false

			const cleanup = () => {
				if (!cleanupPerformed) {
					cleanupPerformed = true
					file.close()
					fs.unlink(destPath, () => {}) // Clean up file on error
				}
			}

			const request = https.get(targetUrl, (response) => {
				// Handle redirects
				if (
					response.statusCode &&
					response.statusCode >= 300 &&
					response.statusCode < 400 &&
					response.headers.location
				) {
					cleanup()
					redirectCount++
					if (redirectCount > maxRedirects) {
						reject(new Error(`Too many redirects (${redirectCount}) for ${url}`))
						return
					}
					// Recursively follow redirect
					attemptDownload(new URL(response.headers.location, targetUrl).href)
					return
				}

				if (response.statusCode !== 200) {
					cleanup()
					reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for ${targetUrl}`))
					return
				}

				response.pipe(file)

				file.on("finish", () => {
					file.close()
					resolve()
				})

				file.on("error", (err) => {
					cleanup()
					reject(err)
				})
			})

			request.on("error", (err) => {
				cleanup()
				reject(err)
			})

			request.setTimeout(30000, () => {
				request.destroy()
				cleanup()
				reject(new Error(`Download timeout for ${targetUrl}`))
			})
		}

		attemptDownload(currentUrl)
	})
}

/**
 * Copies a file from source to destination
 */
function copyFile(srcPath: string, destPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const readStream = fs.createReadStream(srcPath)
		const writeStream = fs.createWriteStream(destPath)

		readStream.on("error", reject)
		writeStream.on("error", reject)
		writeStream.on("finish", resolve)

		readStream.pipe(writeStream)
	})
}

/**
 * Verifies that a file exists and has non-zero size
 */
function verifyFile(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath)
		return stats.isFile() && stats.size > 0
	} catch {
		return false
	}
}

/**
 * Logs progress with timestamp
 */
function log(message: string): void {
	console.log(`[${new Date().toISOString()}] ${message}`)
}

/**
 * Main download function
 */
async function main(options: DownloadOptions = { strictMode: false }): Promise<void> {
	log("🚀 Starting tree-sitter WASM download...")

	try {
		// Create target directory if it doesn't exist
		if (!fs.existsSync(TARGET_DIR)) {
			fs.mkdirSync(TARGET_DIR, { recursive: true })
			log(`📁 Created directory: ${TARGET_DIR}`)
		}

		let successCount = 0
		let failureCount = 0

		// Download tree-sitter.wasm (main parser)
		try {
			const mainWasmPath = path.join(TARGET_DIR, "tree-sitter.wasm")
			const mainWasmSrc = path.join(NODE_MODULES_WASM_DIR, "tree-sitter.wasm")

			if (fs.existsSync(mainWasmSrc)) {
				await copyFile(mainWasmSrc, mainWasmPath)
				log("✓ Copied tree-sitter.wasm from node_modules")
			} else {
				await downloadFile(CDN_BASE_URL + "/tree-sitter.wasm", mainWasmPath)
				log("✓ Downloaded tree-sitter.wasm from CDN")
			}

			if (!verifyFile(mainWasmPath)) {
				throw new Error("Downloaded tree-sitter.wasm is invalid")
			}
			successCount++
		} catch (error) {
			log(`❌ Failed to download tree-sitter.wasm: ${error instanceof Error ? error.message : "Unknown error"}`)
			failureCount++
		}

		// Download language-specific WASM files
		for (const language of LANGUAGES) {
			const filename = `tree-sitter-${language}.wasm`
			const destPath = path.join(TARGET_DIR, filename)
			const srcPath = path.join(NODE_MODULES_WASM_DIR, filename)
			const url = CDN_BASE_URL + "/" + filename

			try {
				log(`📥 Processing ${language}...`)

				// Try to copy from node_modules first
				if (fs.existsSync(srcPath)) {
					await copyFile(srcPath, destPath)
					log(`  ✓ Copied ${filename} from node_modules`)
				} else {
					// Download from CDN if not available locally
					await downloadFile(url, destPath)
					log(`  ✓ Downloaded ${filename} from CDN`)
				}

				// Verify the downloaded file
				if (!verifyFile(destPath)) {
					throw new Error(`Downloaded ${filename} is invalid or empty`)
				}

				const fileSize = fs.statSync(destPath).size
				log(`  ✓ Verified ${filename} (${fileSize} bytes)`)
				successCount++
			} catch (error) {
				log(`  ❌ Failed to process ${language}: ${error instanceof Error ? error.message : "Unknown error"}`)
				failureCount++

				// Clean up any partial download
				try {
					if (fs.existsSync(destPath)) {
						fs.unlinkSync(destPath)
					}
				} catch {
					// Ignore cleanup errors
				}
			}
		}

		// Summary
		log("\n📊 Download Summary:")
		log(`✅ Successfully processed: ${successCount} files`)
		if (failureCount > 0) {
			log(`❌ Failed to process: ${failureCount} files`)
		}

		const totalExpected = LANGUAGES.length + 1 // +1 for tree-sitter.wasm

		if (successCount === totalExpected) {
			log("\n🎉 All WASM files downloaded successfully!")
		} else if (successCount === 0) {
			log(
				"\n💥 No WASM files were successfully downloaded. Tree-sitter parsing functionality will not be available.",
			)
		} else {
			if (options.strictMode) {
				log(`\n❌ ${failureCount} files failed to download. In strict mode, this is considered a failure.`)
			} else {
				log(
					`\n⚠️  ${failureCount} files failed to download. Some tree-sitter parsing functionality may be limited.`,
				)
				log(`💡 Use --strict flag to enforce strict mode and fail on any download errors.`)
			}
		}

		// Downloaded files summary
		log("\n📋 Downloaded Files:")
		const files = fs.readdirSync(TARGET_DIR).filter((f) => f.endsWith(".wasm"))
		if (files.length === 0) {
			log("  (No WASM files available)")
		} else {
			files.forEach((file) => {
				const stats = fs.statSync(path.join(TARGET_DIR, file))
				log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`)
			})
			const totalSize = files.reduce((sum, file) => {
				return sum + fs.statSync(path.join(TARGET_DIR, file)).size
			}, 0)
			log(`\n📦 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
		}

		// Determine exit code based on mode and results
		if (options.strictMode) {
			// In strict mode, any failure is unacceptable
			process.exit(failureCount > 0 ? 1 : 0)
		} else {
			// In non-strict mode, only fail if no files were downloaded at all
			process.exit(successCount === 0 ? 1 : 0)
		}
	} catch (error) {
		log(`\n💥 Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`)
		process.exit(1)
	}
}

// Handle uncaught promise rejections
process.on("unhandledRejection", (reason, promise) => {
	log(`💥 Unhandled Promise Rejection: ${reason}`)
	process.exit(1)
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	log(`💥 Uncaught Exception: ${error.message}`)
	process.exit(1)
})

// Run the main function
if (require.main === module) {
	const args = process.argv.slice(2)

	// Check for help flag first
	if (args.includes("--help") || args.includes("-h")) {
		showUsage()
		process.exit(0)
	}

	main(parseArgs())
}
