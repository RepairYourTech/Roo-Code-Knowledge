import * as fs from "fs"
import * as path from "path"
import * as https from "https"
import * as vscode from "vscode"

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

const WASM_VERSION = "0.1.12"
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

			response.pipe(file)

			file.on("finish", () => {
				file.close()
				resolve()
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

	// Use the services/tree-sitter path consistent with getWasmDirectory()
	const targetDir = path.join(extensionPath, "services", "tree-sitter")
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
		progressToken?.report({ message: "Downloading main tree-sitter parser...", increment: 0 })

		try {
			const mainWasmPath = path.join(targetDir, "tree-sitter.wasm")
			const mainWasmSrc = path.join(nodeModulesWasmDir, "tree-sitter.wasm")

			if (fs.existsSync(mainWasmSrc)) {
				await copyFile(mainWasmSrc, mainWasmPath)
				log("✓ Copied tree-sitter.wasm from node_modules", outputChannel)
			} else {
				await downloadFile(CDN_BASE_URL + "/tree-sitter.wasm", mainWasmPath)
				log("✓ Downloaded tree-sitter.wasm from CDN", outputChannel)
			}

			if (!verifyFile(mainWasmPath)) {
				throw new Error("Downloaded tree-sitter.wasm is invalid")
			}

			const fileSize = fs.statSync(mainWasmPath).size
			downloadedFiles.push("tree-sitter.wasm")
			totalSize += fileSize
			successCount++

			progressToken?.report({
				message: `Downloaded tree-sitter.wasm (${(fileSize / 1024).toFixed(2)} KB)`,
				increment: 100 / totalExpected,
			})
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error"
			log(`❌ Failed to download tree-sitter.wasm: ${errorMsg}`, outputChannel)
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
				message: `Downloading ${language} WASM...`,
				increment: 0,
			})

			try {
				log(`📥 Processing ${language}...`, outputChannel)

				// Try to copy from node_modules first
				if (fs.existsSync(srcPath)) {
					await copyFile(srcPath, destPath)
					log(`  ✓ Copied ${filename} from node_modules`, outputChannel)
				} else {
					// Download from CDN if not available locally
					await downloadFile(url, destPath)
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

				progressToken?.report({
					message: `Downloaded ${language} (${(fileSize / 1024).toFixed(2)} KB)`,
					increment: 100 / totalExpected,
				})
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error"
				log(`  ❌ Failed to process ${language}: ${errorMsg}`, outputChannel)
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

		// Summary
		progressToken?.report({ message: "Download complete", increment: 0 })

		log("\n📊 Download Summary:", outputChannel)
		log(`✅ Successfully processed: ${successCount} files`, outputChannel)
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
		log("\n📋 Downloaded Files:", outputChannel)
		if (downloadedFiles.length === 0) {
			log("  (No WASM files available)", outputChannel)
		} else {
			downloadedFiles.forEach((file) => {
				const stats = fs.statSync(path.join(targetDir, file))
				log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`, outputChannel)
			})
			log(`\n📦 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`, outputChannel)
		}

		return {
			success: successCount > 0,
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
