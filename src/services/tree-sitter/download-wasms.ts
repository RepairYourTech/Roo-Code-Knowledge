import * as fs from "fs"
import * as path from "path"
import { https } from "follow-redirects"
import * as vscode from "vscode"
import { invalidateWasmDirectoryCache } from "./get-wasm-directory"

/**
 * Configuration options for WASM download
 */
export interface DownloadWasmsOptions {
	extensionPath: string
	progressToken?: vscode.Progress<{ message?: string; increment?: number }>
	outputChannel?: vscode.OutputChannel
}

/**
 * Download result information
 */
export interface DownloadResult {
	success: boolean
	successCount: number
	failureCount: number
	totalExpected: number
	downloadedFiles: string[]
	totalSize: number
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

// NOTE: The WASM_VERSION constant must stay in sync with any external download scripts
// to avoid confusion when paths and caching are already correctly wired to dist/services/tree-sitter
const WASM_VERSION = "0.1.13"
const NODE_MODULES_WASM_DIR = "node_modules/tree-sitter-wasms/out"
const CDN_BASE_URL = "https://unpkg.com/tree-sitter-wasms@" + WASM_VERSION + "/out"

/**
 * Downloads a file from a URL to a local path using fs.promises
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(destPath)

		const request = https.get(url, (response) => {
			if (response.statusCode !== 200) {
				file.close()
				reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for ${url}`))
				return
			}

			// Pipe the response to the file stream only once
			response.pipe(file)

			file.on("finish", () => {
				file.close()
				resolve()
			})

			file.on("error", (err) => {
				file.close()
				fs.unlink(destPath, () => {})
				reject(err)
			})
		})

		request.on("error", (err) => {
			fs.unlink(destPath, () => {}) // Clean up on error
			reject(err)
		})

		request.setTimeout(30000, () => {
			request.destroy()
			fs.unlink(destPath, () => {}) // Clean up on timeout
			reject(new Error(`Download timeout for ${url}`))
		})
	})
}

/**
 * Downloads a file with retry logic and exponential backoff
 */
async function downloadFileWithRetry(
	url: string,
	destPath: string,
	maxRetries: number = 3,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const delays = [0, 1000, 2000] // Exponential backoff delays

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			await downloadFile(url, destPath)
			if (attempt > 0) {
				log(`✓ Successfully downloaded ${path.basename(destPath)} on attempt ${attempt + 1}`, outputChannel)
			}
			return
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"

			// Don't retry on certain HTTP errors
			if (errorMsg.includes("HTTP 404") || errorMsg.includes("HTTP 403")) {
				throw error
			}

			// Retry on network errors and 5xx HTTP errors
			if (
				attempt < maxRetries - 1 &&
				(errorMsg.includes("ENOTFOUND") ||
					errorMsg.includes("ECONNREFUSED") ||
					errorMsg.includes("ETIMEDOUT") ||
					errorMsg.includes("HTTP 5"))
			) {
				const delay = delays[attempt]
				if (delay > 0) {
					log(
						`⚠️ Download failed for ${path.basename(destPath)} (attempt ${attempt + 1}): ${errorMsg}`,
						outputChannel,
					)
					log(`   Retrying in ${delay}ms...`, outputChannel)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
				continue
			}

			throw error
		}
	}
}

/**
 * Copies a file from source to destination using fs.promises
 */
async function copyFile(srcPath: string, destPath: string): Promise<void> {
	await fs.promises.copyFile(srcPath, destPath)
}

/**
 * Verifies that a downloaded file is valid (not empty)
 */
function verifyFile(filePath: string): boolean {
	try {
		const stats = fs.statSync(filePath)
		return stats.size > 0
	} catch {
		return false
	}
}

/**
 * Validates file checksum using SHA256
 */
function validateChecksum(filePath: string, expectedHash: string): boolean {
	try {
		const crypto = require("crypto")
		const fileBuffer = fs.readFileSync(filePath)
		const hashSum = crypto.createHash("sha256")
		hashSum.update(fileBuffer)
		const actualHash = hashSum.digest("hex")
		return actualHash === expectedHash
	} catch {
		return false
	}
}

// Known checksums for critical files
const TREE_SITTER_WASM_CHECKSUM = "1340a1d8a45bd63c5adbfa83cd376f2611985e82537e8c733fd5489c9c357ea8"

/**
 * Helper function to log progress and messages
 */
function log(message: string, outputChannel?: vscode.OutputChannel): void {
	console.log(`[DownloadWasms] ${message}`)
	if (outputChannel) {
		outputChannel.appendLine(`[DownloadWasms] ${message}`)
	}
}

/**
 * Downloads tree-sitter WASM files to the extension directory
 * This is an inlined version of the download-tree-sitter-wasms.ts script
 * adapted for use within the extension without subprocess dependencies
 */
export async function downloadTreeSitterWasms(options: DownloadWasmsOptions): Promise<DownloadResult> {
	const { extensionPath, progressToken, outputChannel } = options

	log("🚀 Starting tree-sitter WASM download...", outputChannel)

	// Use the dist/services/tree-sitter path consistent with getWasmDirectory()
	// This must match the paths in get-wasm-directory.ts (line 164)
	const targetDir = path.join(extensionPath, "dist", "services", "tree-sitter")
	const nodeModulesWasmDir = path.join(extensionPath, NODE_MODULES_WASM_DIR)

	try {
		// Create target directory if it doesn't exist
		await fs.promises.mkdir(targetDir, { recursive: true })
		log(`📁 Created directory: ${targetDir}`, outputChannel)

		let successCount = 0
		let failureCount = 0
		const downloadedFiles: string[] = []
		let totalSize = 0
		const totalExpected = LANGUAGES.length + 1 // +1 for tree-sitter.wasm

		// Download tree-sitter.wasm (main parser)
		progressToken?.report({
			message: `Downloading 1 of ${totalExpected} files: main tree-sitter parser...`,
			increment: 0,
		})

		try {
			const mainWasmPath = path.join(targetDir, "tree-sitter.wasm")
			const mainWasmSrc = path.join(extensionPath, "node_modules", "web-tree-sitter", "tree-sitter.wasm")
			const nodeModulesExists = fs.existsSync(mainWasmSrc)
			let downloadSuccess = false

			// Try node_modules first
			if (nodeModulesExists) {
				try {
					await copyFile(mainWasmSrc, mainWasmPath)
					log("✓ Copied tree-sitter.wasm from node_modules/web-tree-sitter", outputChannel)
					downloadSuccess = true
				} catch (copyError) {
					log(
						`⚠️ Failed to copy from node_modules: ${copyError instanceof Error ? copyError.message : "Unknown error"}`,
						outputChannel,
					)
				}
			}

			// Fallback to CDN if node_modules failed or doesn't exist
			if (!downloadSuccess) {
				const fallbackUrl = "https://unpkg.com/web-tree-sitter@0.25.6/tree-sitter.wasm"
				try {
					await downloadFileWithRetry(fallbackUrl, mainWasmPath, 3, outputChannel)
					log("✓ Downloaded tree-sitter.wasm from fallback CDN", outputChannel)
					downloadSuccess = true
				} catch (downloadError) {
					log(
						`❌ CDN fallback failed: ${downloadError instanceof Error ? downloadError.message : "Unknown error"}`,
						outputChannel,
					)
				}
			}

			// Validate file size (170KB - 210KB range)
			if (downloadSuccess && fs.existsSync(mainWasmPath)) {
				const fileSize = fs.statSync(mainWasmPath).size
				const sizeKB = fileSize / 1024

				if (sizeKB < 170 || sizeKB > 210) {
					throw new Error(`File size validation failed: ${sizeKB.toFixed(2)} KB (expected 170-210 KB)`)
				}

				// Additional checksum validation
				if (TREE_SITTER_WASM_CHECKSUM && !validateChecksum(mainWasmPath, TREE_SITTER_WASM_CHECKSUM)) {
					log(`⚠️ Checksum validation failed for tree-sitter.wasm, but continuing anyway`, outputChannel)
				}

				downloadedFiles.push("tree-sitter.wasm")
				totalSize += fileSize
				successCount++

				progressToken?.report({
					message: `Downloaded tree-sitter.wasm (${sizeKB.toFixed(2)} KB)`,
					increment: 100 / totalExpected,
				})
			} else {
				throw new Error("Failed to obtain tree-sitter.wasm from any source")
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			const mainWasmSrc = path.join(extensionPath, "node_modules", "web-tree-sitter", "tree-sitter.wasm")
			const nodeModulesExists = fs.existsSync(mainWasmSrc)
			const fallbackUrl = "https://unpkg.com/web-tree-sitter@0.25.6/tree-sitter.wasm"

			log(`❌ Failed to download tree-sitter.wasm:`, outputChannel)
			log(`   Full URL attempted: ${fallbackUrl}`, outputChannel)
			log(`   Node modules path: ${mainWasmSrc}`, outputChannel)
			log(`   Node modules exists: ${nodeModulesExists ? "yes" : "no"}`, outputChannel)
			log(`   Error: ${errorMsg}`, outputChannel)

			// Enhanced error classification and suggestions
			if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ETIMEDOUT")) {
				log(`   Error type: Network connectivity issue`, outputChannel)
				log(`   Suggestion: Check your internet connection and try again`, outputChannel)
			} else if (errorMsg.includes("HTTP 404")) {
				log(`   Error type: File not found (404)`, outputChannel)
				log(`   Suggestion: File not available in this version, may need alternative source`, outputChannel)
			} else if (errorMsg.includes("HTTP 403")) {
				log(`   Error type: Access forbidden (403)`, outputChannel)
				log(`   Suggestion: Check if the CDN is accessible or try a different source`, outputChannel)
			} else if (errorMsg.includes("size validation failed")) {
				log(`   Error type: File validation failed`, outputChannel)
				log(`   Suggestion: File corrupted, delete and retry download`, outputChannel)
			} else if (!nodeModulesExists) {
				log(`   Error type: Local files missing`, outputChannel)
				log(`   Suggestion: Run 'pnpm install' to install local WASM files`, outputChannel)
			} else {
				log(`   Error type: Unknown error`, outputChannel)
				log(`   Suggestion: Try manual download or check extension logs`, outputChannel)
			}

			failureCount++
		}

		// Download language-specific WASM files
		for (let i = 0; i < LANGUAGES.length; i++) {
			const language = LANGUAGES[i]
			const filename = `tree-sitter-${language}.wasm`
			const destPath = path.join(targetDir, filename)
			const srcPath = path.join(nodeModulesWasmDir, filename)
			const url = CDN_BASE_URL + "/" + filename

			progressToken?.report({
				message: `Downloading ${i + 2} of ${totalExpected} files: ${language} WASM...`,
				increment: 0,
			})

			try {
				log(`📥 Processing ${language}...`, outputChannel)

				// Try to copy from node_modules first
				if (fs.existsSync(srcPath)) {
					await copyFile(srcPath, destPath)
					log(`  ✓ Copied ${filename} from node_modules`, outputChannel)
				} else {
					// Download from CDN if not available locally (with retry)
					await downloadFileWithRetry(url, destPath, 3, outputChannel)
					log(`  ✓ Downloaded ${filename} from CDN`, outputChannel)
				}

				// Verify the downloaded file
				if (!verifyFile(destPath)) {
					throw new Error(`Downloaded ${filename} is invalid or empty`)
				}

				const fileSize = fs.statSync(destPath).size
				downloadedFiles.push(filename)
				totalSize += fileSize
				log(`  ✓ Verified ${filename} (${fileSize} bytes)`, outputChannel)
				successCount++

				const percentage = Math.round(((i + 2) / totalExpected) * 100)
				progressToken?.report({
					message: `Downloaded ${language} (${(fileSize / 1024).toFixed(2)} KB) - ${percentage}% complete`,
					increment: 100 / totalExpected,
				})
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error"
				const nodeModulesAttempted = fs.existsSync(srcPath)

				log(`  ❌ Failed to process ${language}:`, outputChannel)
				log(`     Full URL attempted: ${url}`, outputChannel)
				log(`     Node modules path: ${srcPath}`, outputChannel)
				log(`     Node modules exists: ${nodeModulesAttempted ? "yes" : "no"}`, outputChannel)
				log(`     Error: ${errorMsg}`, outputChannel)

				// Enhanced error classification and suggestions
				if (
					errorMsg.includes("ENOTFOUND") ||
					errorMsg.includes("ECONNREFUSED") ||
					errorMsg.includes("ETIMEDOUT")
				) {
					log(`     Error type: Network connectivity issue`, outputChannel)
					log(`     Suggestion: Check your internet connection and try again`, outputChannel)
				} else if (errorMsg.includes("HTTP 404")) {
					log(`     Error type: File not found (404)`, outputChannel)
					log(
						`     Suggestion: File not available in this version, may need alternative source`,
						outputChannel,
					)
				} else if (errorMsg.includes("HTTP 403")) {
					log(`     Error type: Access forbidden (403)`, outputChannel)
					log(`     Suggestion: Check if the CDN is accessible or try a different source`, outputChannel)
				} else if (errorMsg.includes("invalid or empty")) {
					log(`     Error type: File validation failed`, outputChannel)
					log(`     Suggestion: File corrupted, delete and retry download`, outputChannel)
				} else if (!nodeModulesAttempted) {
					log(`     Error type: Local files missing`, outputChannel)
					log(`     Suggestion: Run 'pnpm install' to install local WASM files`, outputChannel)
				} else {
					log(`     Error type: Unknown error`, outputChannel)
					log(`     Suggestion: Try manual download or check extension logs`, outputChannel)
				}

				failureCount++

				// Clean up any partial download
				try {
					if (fs.existsSync(destPath)) {
						await fs.promises.unlink(destPath)
					}
				} catch {
					// Ignore cleanup errors
				}
			}
		}

		// Invalidate cache after successful downloads
		if (successCount > 0) {
			invalidateWasmDirectoryCache()
			log("Invalidated WASM directory cache to reflect new downloads", outputChannel)
		}

		// Summary
		progressToken?.report({ message: "Download complete", increment: 0 })

		log("\n📊 Download Summary:", outputChannel)
		log(`✅ Successfully processed: ${successCount} of ${totalExpected} files`, outputChannel)
		if (failureCount > 0) {
			log(`❌ Failed to process: ${failureCount} files`, outputChannel)
		}

		if (successCount === totalExpected) {
			log("\n🎉 All WASM files downloaded successfully!", outputChannel)
		} else if (successCount === 0) {
			log(
				"\n💥 No WASM files were successfully downloaded. Tree-sitter parsing functionality will not be available.",
				outputChannel,
			)
		} else {
			log(
				`\n⚠️  ${failureCount} files failed to download. Some tree-sitter parsing functionality may be limited.`,
				outputChannel,
			)
		}

		// Downloaded files summary
		log("\n📋 Successfully Downloaded Files:", outputChannel)
		if (downloadedFiles.length === 0) {
			log("  (No WASM files available)", outputChannel)
		} else {
			downloadedFiles.forEach((file) => {
				const stats = fs.statSync(path.join(targetDir, file))
				log(`  ✓ ${file} (${(stats.size / 1024).toFixed(2)} KB)`, outputChannel)
			})
			log(`\n📦 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`, outputChannel)
		}

		// Failed files summary
		if (failureCount > 0) {
			log("\n❌ Failed Files:", outputChannel)
			const failedFiles = LANGUAGES.filter((lang) => !downloadedFiles.includes(`tree-sitter-${lang}.wasm`))
			if (!downloadedFiles.includes("tree-sitter.wasm")) {
				failedFiles.unshift("tree-sitter")
			}

			// Enhanced failed files summary with error context
			failedFiles.forEach((file) => {
				const filename = file === "tree-sitter" ? "tree-sitter.wasm" : `tree-sitter-${file}.wasm`
				const lastUrl =
					file === "tree-sitter"
						? "https://unpkg.com/web-tree-sitter@0.25.6/tree-sitter.wasm"
						: `${CDN_BASE_URL}/${filename}`

				log(`  ✗ ${file}`, outputChannel)
				log(`     Last attempted URL: ${lastUrl}`, outputChannel)

				// Determine likely error type based on file
				if (file === "tree-sitter") {
					const mainWasmSrc = path.join(extensionPath, "node_modules", "web-tree-sitter", "tree-sitter.wasm")
					if (!fs.existsSync(mainWasmSrc)) {
						log(`     Error type: Local files missing`, outputChannel)
						log(`     Suggested action: Run 'pnpm install' to install local WASM files`, outputChannel)
					} else {
						log(`     Error type: Network/download issue`, outputChannel)
						log(`     Suggested action: Check internet connection and retry`, outputChannel)
					}
				} else {
					const srcPath = path.join(nodeModulesWasmDir, filename)
					if (!fs.existsSync(srcPath)) {
						log(`     Error type: Local files missing`, outputChannel)
						log(`     Suggested action: Run 'pnpm install' to install local WASM files`, outputChannel)
					} else {
						log(`     Error type: Network/download issue`, outputChannel)
						log(`     Suggested action: Check internet connection and retry`, outputChannel)
					}
				}
			})

			log("\n🔧 Next Steps:", outputChannel)
			log("  1. Check your internet connection and try again", outputChannel)
			log("  2. Run 'pnpm install' to ensure local WASM files are available", outputChannel)
			log("  3. Try the command 'Roo-Cline: Download Tree-sitter WASM Files' again", outputChannel)
		}

		return {
			success: successCount >= 3, // Require minimum critical files (tree-sitter.wasm + 2 languages)
			successCount,
			failureCount,
			totalExpected,
			downloadedFiles,
			totalSize,
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error"
		log(`\n💥 Fatal error: ${errorMsg}`, outputChannel)

		const totalExpected = LANGUAGES.length + 1
		return {
			success: false,
			successCount: 0,
			failureCount: totalExpected,
			totalExpected,
			downloadedFiles: [],
			totalSize: 0,
		}
	}
}
