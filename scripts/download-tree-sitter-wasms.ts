#!/usr/bin/env node

/**
 * Tree-sitter WASM Download Script
 *
 * Purpose: Regenerate static WASM files bundled in src/wasms/tree-sitter/
 *
 * Usage:
 *   1. Run: pnpm regenerate-wasms (or tsx scripts/download-tree-sitter-wasms.ts)
 *   2. Copy: cp dist/services/tree-sitter/*.wasm src/wasms/tree-sitter/
 *   3. Commit: git add src/wasms/tree-sitter/*.wasm && git commit -m "chore: update tree-sitter WASMs"
 *
 * Note: This script is NOT run during normal builds. The build process uses
 * pre-downloaded WASM files from src/wasms/tree-sitter/ for zero network dependency.
 */

import * as fs from "fs"
import * as path from "path"
import * as https from "https"
import * as crypto from "crypto"

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
  Downloads tree-sitter WASM files for code parsing. This script is used to
  regenerate the static WASM files bundled in the repository (src/wasms/tree-sitter/).
  
  After running this script, copy the downloaded files to the static directory:
    cp dist/services/tree-sitter/*.wasm ../src/wasms/tree-sitter/
    git add ../src/wasms/tree-sitter/*.wasm
  
  In default mode, the script will exit with code 0 even if some downloads fail,
  as long as at least one WASM file is successfully downloaded. In strict mode,
  any download failure will result in a non-zero exit code.
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
	// Note: xml requires separate package @tree-sitter-grammars/tree-sitter-xml
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

const TARGET_DIR = path.join(process.cwd(), "dist", "services", "tree-sitter")
const WASM_VERSION = "0.1.13"
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

				response.on("error", (err) => {
					cleanup()
					reject(err)
				})

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
 * Downloads a file with retry logic and exponential backoff
 */
async function downloadFileWithRetry(url: string, destPath: string, maxRetries: number = 3): Promise<void> {
	const delays = [0, 1000, 2000] // Exponential backoff delays in ms

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			await downloadFile(url, destPath)
			return // Success, exit the function
		} catch (error) {
			const err = error as Error
			const isNetworkError =
				err.message.includes("ENOTFOUND") ||
				err.message.includes("ECONNREFUSED") ||
				err.message.includes("ETIMEDOUT")
			const isHttpError = err.message.includes("HTTP 5")
			const isClientError = err.message.includes("HTTP 4") // Don't retry on 4xx errors

			if (attempt === maxRetries - 1 || (isClientError && !isHttpError)) {
				// Last attempt or non-retryable error
				throw error
			}

			if (isNetworkError || isHttpError) {
				const delay = delays[attempt] || 2000
				log(`  ⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms delay for ${url}`)
				await new Promise((resolve) => setTimeout(resolve, delay))
			} else {
				// Non-retryable error
				throw error
			}
		}
	}
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
 * Validates file checksum using SHA256
 */
function validateChecksum(filePath: string, expectedHash: string): boolean {
	try {
		const fileBuffer = fs.readFileSync(filePath)
		const hashSum = crypto.createHash("sha256")
		hashSum.update(fileBuffer)
		const calculatedHash = hashSum.digest("hex")
		return calculatedHash === expectedHash
	} catch {
		return false
	}
}

// Known checksums for critical files
const TREE_SITTER_WASM_CHECKSUM = "1340a1d8a45bd63c5adbfa83cd376f2611985e82537e8c733fd5489c9c357ea8"

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

		// Download tree-sitter.wasm (main parser) with special handling
		try {
			const mainWasmPath = path.join(TARGET_DIR, "tree-sitter.wasm")
			let downloadSuccess = false
			let sourceUsed = ""

			// First try: Copy from node_modules/web-tree-sitter/tree-sitter.wasm
			const webTreeSitterPath = path.join("node_modules", "web-tree-sitter", "tree-sitter.wasm")
			if (fs.existsSync(webTreeSitterPath)) {
				try {
					await copyFile(webTreeSitterPath, mainWasmPath)
					const stats = fs.statSync(mainWasmPath)
					const sizeKB = stats.size / 1024

					// Validate size is between 170KB and 210KB
					if (stats.size >= 170 * 1024 && stats.size <= 210 * 1024) {
						downloadSuccess = true
						sourceUsed = `node_modules/web-tree-sitter (${sizeKB.toFixed(1)}KB)`
						log(`✓ Copied tree-sitter.wasm from ${sourceUsed}`)
					} else {
						log(
							`  ⚠️  Invalid size for tree-sitter.wasm from node_modules/web-tree-sitter: ${sizeKB.toFixed(1)}KB (expected 170-210KB)`,
						)
						fs.unlinkSync(mainWasmPath) // Remove invalid file
					}
				} catch (copyError) {
					log(
						`  ⚠️  Failed to copy tree-sitter.wasm from node_modules/web-tree-sitter: ${copyError instanceof Error ? copyError.message : "Unknown error"}`,
					)
				}
			}

			// Second try: Download from unpkg.com if first attempt failed
			if (!downloadSuccess) {
				try {
					const fallbackUrl = "https://unpkg.com/web-tree-sitter@0.25.6/tree-sitter.wasm"
					await downloadFileWithRetry(fallbackUrl, mainWasmPath)
					const stats = fs.statSync(mainWasmPath)
					const sizeKB = stats.size / 1024

					// Validate size is between 170KB and 210KB
					if (stats.size >= 170 * 1024 && stats.size <= 210 * 1024) {
						downloadSuccess = true
						sourceUsed = `unpkg.com/web-tree-sitter@0.25.6 (${sizeKB.toFixed(1)}KB)`
						log(`✓ Downloaded tree-sitter.wasm from ${sourceUsed}`)
					} else {
						log(
							`  ⚠️  Invalid size for downloaded tree-sitter.wasm: ${sizeKB.toFixed(1)}KB (expected 170-210KB)`,
						)
						fs.unlinkSync(mainWasmPath) // Remove invalid file
					}
				} catch (downloadError) {
					log(
						`  ❌ Failed to download tree-sitter.wasm from fallback URL: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
					)
				}
			}

			// Final validation
			if (!downloadSuccess || !verifyFile(mainWasmPath)) {
				const nodeModulesStatus = fs.existsSync(webTreeSitterPath) ? "exists" : "missing"
				throw new Error(
					`Failed to obtain valid tree-sitter.wasm. node_modules/web-tree-sitter/tree-sitter.wasm: ${nodeModulesStatus}, attempted URLs: https://unpkg.com/web-tree-sitter@0.25.6/tree-sitter.wasm. Try: npm install or check network connectivity.`,
				)
			}

			// Optional checksum validation
			if (validateChecksum(mainWasmPath, TREE_SITTER_WASM_CHECKSUM)) {
				log(`  ✓ Validated tree-sitter.wasm checksum`)
			} else {
				log(`  ⚠️  Warning: tree-sitter.wasm checksum validation failed (may be different version)`)
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
					await downloadFileWithRetry(url, destPath)
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
				const nodeModulesStatus = fs.existsSync(srcPath) ? "exists" : "missing"
				log(`  ❌ Failed to process ${language}: ${error instanceof Error ? error.message : "Unknown error"}`)
				log(`     Attempted URL: ${url}, node_modules status: ${nodeModulesStatus}`)
				log(
					`     Suggestions: Check network connectivity, verify file exists in package, or try running 'npm install'`,
				)
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
			// In non-strict mode, exit with code 0 if at least 3 critical files are present
			// (tree-sitter.wasm + 2 language WASMs)
			const criticalFiles = fs.readdirSync(TARGET_DIR).filter((f) => f.endsWith(".wasm"))
			const hasTreeSitterWasm = criticalFiles.includes("tree-sitter.wasm")
			const languageWasmCount = criticalFiles.filter((f) => f !== "tree-sitter.wasm").length

			if (hasTreeSitterWasm && languageWasmCount >= 2) {
				process.exit(0)
			} else {
				process.exit(1)
			}
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
