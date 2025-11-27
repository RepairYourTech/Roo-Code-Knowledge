#!/usr/bin/env node

/**
 * Tiktoken WASM Download Script
 *
 * Purpose: Regenerate static WASM file bundled in src/wasms/tiktoken/
 *
 * Usage:
 *   1. Run: pnpm regenerate-wasms (or tsx scripts/download-tiktoken-wasms.ts)
 *   2. Commit: git add src/wasms/tiktoken/tiktoken_bg.wasm && git commit -m "chore: update tiktoken WASM"
 *
 * Note: This script downloads directly to src/wasms/tiktoken/ as the canonical location.
 * After successful download, it also copies to node_modules/tiktoken for compatibility.
 * The build process uses the static WASM file from src/wasms/tiktoken/ for zero network dependency.
 */

import * as fs from "fs"
import * as path from "path"
import * as https from "https"
import * as crypto from "crypto"

/**
 * CLI interface for tiktoken WASM download options
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
Usage: download-tiktoken-wasms.ts [options]

Options:
  --strict, -s    Exit with non-zero code if any downloads fail (strict mode)
  --help, -h      Show this help message

Description:
  Downloads tiktoken WASM files for tokenization. This script is used to
  regenerate the static WASM file bundled in the repository (src/wasms/tiktoken/).
  
  The script downloads directly to src/wasms/tiktoken/ as the canonical location,
  then copies to node_modules/tiktoken for compatibility.
  
  After running this script, commit the downloaded file:
    git add src/wasms/tiktoken/tiktoken_bg.wasm
    git commit -m "chore: update tiktoken WASM"
  
  In default mode, the script will exit with code 0 if tiktoken_bg.wasm is
  successfully downloaded. In strict mode, any download failure will result
  in a non-zero exit code.
`)
}

// Tiktoken WASM configuration
// Note: We now download directly to the static directory as the primary location.
// The static directory is the canonical location for committed WASM files.
const TARGET_DIR = path.join(__dirname, "..", "src", "wasms", "tiktoken")
const NODE_MODULES_TIKTOKEN_DIR = path.join("node_modules", "tiktoken")
const TIKTOKEN_VERSION = "1.0.21"
const CDN_BASE_URL = `https://unpkg.com/tiktoken@${TIKTOKEN_VERSION}`

// Expected file size and checksum for tiktoken_bg.wasm
const EXPECTED_FILE_SIZE_MIN = 1000000 // 1MB
const EXPECTED_FILE_SIZE_MAX = 2000000 // 2MB
const EXPECTED_FILE_SIZE_DESC = "~1.06 MB"
const TIKTOKEN_WASM_SHA256 = "cb83e20f68c15afe0e7c865542e03f85d57332b5b0d63a69e041d84174560fa0"

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
	const delays = [1000, 2000, 4000] // Exponential backoff delays in ms

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			await downloadFile(url, destPath)
			return // Success, exit the retry loop
		} catch (error) {
			const isLastAttempt = attempt === maxRetries - 1
			const err = error as Error

			// Don't retry on client errors (4xx) except for 429 (Too Many Requests)
			if (err.message.includes("HTTP 4") && !err.message.includes("HTTP 429")) {
				throw err // Re-throw immediately for 4xx errors
			}

			if (isLastAttempt) {
				throw err // Re-throw the last error
			}

			// Log retry attempt
			log(`  ⚠️  Download attempt ${attempt + 1} failed: ${err.message}`)
			const delayIndex = Math.min(attempt, delays.length - 1)
			log(`  🔄 Retrying in ${delays[delayIndex]}ms...`)
			await new Promise((resolve) => setTimeout(resolve, delays[delayIndex]))
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
 * Verifies that a file exists and has expected size range
 */
function verifyFile(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath)
		return stats.isFile() && stats.size > EXPECTED_FILE_SIZE_MIN && stats.size < EXPECTED_FILE_SIZE_MAX
	} catch {
		return false
	}
}

/**
 * Validates file checksum against expected SHA256 hash
 */
function validateChecksum(filePath: string, expectedHash: string): boolean {
	try {
		const fileBuffer = fs.readFileSync(filePath)
		const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex")
		return hash === expectedHash
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
 * Main download function for tiktoken WASM files
 */
async function main(options: DownloadOptions = { strictMode: false }): Promise<void> {
	log("🚀 Starting tiktoken WASM download...")

	try {
		// Create target directory if it doesn't exist
		if (!fs.existsSync(TARGET_DIR)) {
			fs.mkdirSync(TARGET_DIR, { recursive: true })
			log(`📁 Created directory: ${TARGET_DIR}`)
		}

		let successCount = 0
		let failureCount = 0

		// Expected tiktoken WASM files (these are the files that tiktoken typically provides)
		const expectedFiles = ["tiktoken_bg.wasm"]

		// Download tiktoken WASM files
		for (const filename of expectedFiles) {
			const destPath = path.join(TARGET_DIR, filename)
			const srcPath = path.join(NODE_MODULES_TIKTOKEN_DIR, filename)
			const url = CDN_BASE_URL + "/" + filename

			try {
				log(`📥 Processing ${filename}...`)

				let downloadSuccess = false
				let downloadMethod = ""

				// Try to download from CDN first (primary method)
				try {
					await downloadFileWithRetry(url, destPath)
					downloadSuccess = true
					downloadMethod = "CDN"
					log(`  ✓ Downloaded ${filename} from CDN`)
				} catch (cdnError) {
					log(`  ⚠️  CDN download failed: ${cdnError instanceof Error ? cdnError.message : "Unknown error"}`)

					// Fallback to node_modules if CDN fails
					if (fs.existsSync(srcPath)) {
						await copyFile(srcPath, destPath)
						downloadSuccess = true
						downloadMethod = "node_modules"
						log(`  ✓ Copied ${filename} from node_modules (fallback)`)
					} else {
						throw new Error(
							`Both CDN and node_modules fallback failed. CDN error: ${cdnError instanceof Error ? cdnError.message : "Unknown error"}. node_modules file does not exist at ${srcPath}`,
						)
					}
				}

				// Verify the downloaded file
				if (!verifyFile(destPath)) {
					const stats = fs.statSync(destPath)
					throw new Error(
						`Downloaded ${filename} validation failed. File size: ${stats.size} bytes (expected: ${EXPECTED_FILE_SIZE_DESC}). File may be corrupted.`,
					)
				}

				// Validate checksum
				if (!validateChecksum(destPath, TIKTOKEN_WASM_SHA256)) {
					log(`  ⚠️  Warning: ${filename} checksum validation failed. File may be corrupted or modified.`)
				}

				const fileSize = fs.statSync(destPath).size
				log(
					`  ✓ Verified ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB, expected: ${EXPECTED_FILE_SIZE_DESC})`,
				)

				// Copy to node_modules for compatibility after successful download to static directory
				const nodeModulesPath = path.join(process.cwd(), NODE_MODULES_TIKTOKEN_DIR, filename)
				const nodeModulesDir = path.dirname(nodeModulesPath)

				try {
					// Ensure node_modules/tiktoken directory exists
					if (!fs.existsSync(nodeModulesDir)) {
						fs.mkdirSync(nodeModulesDir, { recursive: true })
						log(`  📁 Created node_modules directory: ${nodeModulesDir}`)
					}

					// Copy from static directory to node_modules
					await copyFile(destPath, nodeModulesPath)
					log(`  ✓ Copied ${filename} to node_modules for compatibility`)
				} catch (copyError) {
					log(
						`  ⚠️  Warning: Failed to copy ${filename} to node_modules: ${copyError instanceof Error ? copyError.message : "Unknown error"}`,
					)
					log(`     Note: The file is still available in the static directory at ${destPath}`)
				}

				successCount++
			} catch (error) {
				const err = error as Error
				const nodeModulesExists = fs.existsSync(srcPath)

				// Enhanced error messages
				if (err.message.includes("ENOTFOUND") || err.message.includes("ECONNREFUSED")) {
					log(`  ❌ Network error downloading ${filename}: ${err.message}`)
					log(`     💡 Suggestion: Check your internet connection`)
				} else if (err.message.includes("HTTP 404")) {
					log(`  ❌ Version not found for ${filename}: ${err.message}`)
					log(`     💡 Suggestion: Version ${TIKTOKEN_VERSION} may not exist, check tiktoken package version`)
				} else if (err.message.includes("validation failed")) {
					log(`  ❌ File validation failed for ${filename}: ${err.message}`)
					log(`     💡 Suggestion: File size incorrect, may be corrupted. Try re-downloading`)
				} else if (!nodeModulesExists) {
					log(`  ❌ Failed to process ${filename}: ${err.message}`)
					log(`     💡 Suggestion: Run 'pnpm install' to install tiktoken package`)
				} else {
					log(`  ❌ Failed to process ${filename}: ${err.message}`)
					log(`     💡 CDN URL attempted: ${url}`)
					log(`     💡 node_modules path: ${srcPath} (exists: ${nodeModulesExists})`)
				}

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
		log("\n📊 Tiktoken Download Summary:")
		log(`✅ Successfully processed: ${successCount} files`)
		if (failureCount > 0) {
			log(`❌ Failed to process: ${failureCount} files`)
		}

		const totalExpected = expectedFiles.length

		if (successCount === totalExpected) {
			log("\n🎉 All tiktoken WASM files downloaded successfully!")
			log(`📁 Files are located in the static directory: ${TARGET_DIR}`)
			log("💡 Don't forget to commit the updated WASM files:")
			log("   git add src/wasms/tiktoken/tiktoken_bg.wasm")
			log('   git commit -m "chore: update tiktoken WASM"')
		} else if (successCount === 0) {
			log(
				"\n💥 No tiktoken WASM files were successfully downloaded. Tokenization functionality will not be available.",
			)
		} else {
			if (options.strictMode) {
				log(`\n❌ ${failureCount} files failed to download. In strict mode, this is considered a failure.`)
			} else {
				log(`\n⚠️  ${failureCount} files failed to download. Some tokenization functionality may be limited.`)
				log(`💡 Use --strict flag to enforce strict mode and fail on any download errors.`)
			}
		}

		// Downloaded files summary
		log("\n📋 Downloaded Tiktoken Files:")
		const files = fs.readdirSync(TARGET_DIR).filter((f) => f.includes("tiktoken"))
		if (files.length === 0) {
			log("  (No tiktoken WASM files available)")
		} else {
			files.forEach((file) => {
				const stats = fs.statSync(path.join(TARGET_DIR, file))
				const actualSize = (stats.size / 1024 / 1024).toFixed(2)
				const expectedSize = file === "tiktoken_bg.wasm" ? ` (expected: ${EXPECTED_FILE_SIZE_DESC})` : ""
				log(`  - ${file} (actual: ${actualSize} MB${expectedSize})`)
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
			// In non-strict mode, require tiktoken_bg.wasm to be present and valid
			const tiktokenWasmExists = fs.existsSync(path.join(TARGET_DIR, "tiktoken_bg.wasm"))
			const tiktokenWasmValid = tiktokenWasmExists && verifyFile(path.join(TARGET_DIR, "tiktoken_bg.wasm"))

			if (!tiktokenWasmValid) {
				log(
					"\n❌ Critical file tiktoken_bg.wasm is missing or invalid. Tokenization functionality will not be available.",
				)
				process.exit(1)
			} else {
				process.exit(0)
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
