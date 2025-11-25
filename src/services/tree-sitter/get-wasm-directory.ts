import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs"
import { logger } from "../shared/logger"

let wasmDirectoryCache: string | null = null

/**
 * Get the directory containing tree-sitter WASM files
 * @returns Absolute path to the WASM directory
 */
export function getWasmDirectory(): string {
	// Log immediately to confirm function is being called
	console.log("[getWasmDirectory] FUNCTION CALLED")
	logger.info("[getWasmDirectory] FUNCTION CALLED - checking for WASM directory", "WasmDirectory")

	if (wasmDirectoryCache) {
		logger.debug(`[getWasmDirectory] Using cached WASM directory: ${wasmDirectoryCache}`, "WasmDirectory")
		console.log(`[getWasmDirectory] Using cached: ${wasmDirectoryCache}`)
		return wasmDirectoryCache
	}

	console.log("[getWasmDirectory] No cache, attempting to locate...")
	logger.debug("[getWasmDirectory] Attempting to locate WASM directory...", "WasmDirectory")

	// Find the extension - works for both roo-cline and forks
	// Try common extension IDs (note: getExtension() is case-sensitive)
	const possibleExtensionIds = [
		"rooveterinaryinc.roo-cline", // Lowercase variant (used by installed VSIX)
		"RooVeterinaryInc.roo-cline", // PascalCase variant
		"RooCodeInc.roo-code",
		"saoudrizwan.claude-dev", // Original Cline
	]

	logger.debug(
		`[getWasmDirectory] Checking ${possibleExtensionIds.length} possible extension IDs: ${possibleExtensionIds.join(", ")}`,
		"WasmDirectory",
	)

	let extensionPath: string | undefined
	let foundExtensionId: string | undefined

	for (const extensionId of possibleExtensionIds) {
		logger.debug(`[getWasmDirectory] Checking for extension: ${extensionId}`, "WasmDirectory")
		const ext = vscode.extensions.getExtension(extensionId)
		if (ext) {
			extensionPath = ext.extensionPath
			foundExtensionId = extensionId
			logger.info(`[getWasmDirectory] Found extension: ${extensionId} at path: ${extensionPath}`, "WasmDirectory")
			break
		} else {
			logger.debug(`[getWasmDirectory] Extension not found: ${extensionId}`, "WasmDirectory")
		}
	}

	// Fallback for development/test environment where vscode.extensions might not be fully populated
	// or we are running in a context where the extension isn't "installed" in the standard way
	if (!extensionPath) {
		logger.warn("[getWasmDirectory] Could not determine extension path via vscode.extensions", "WasmDirectory")

		// In dev/test, we might be able to infer the path from the current working directory or __dirname
		// This is a heuristic fallback
		try {
			// Check if we are in the extension source tree
			const currentDir = __dirname
			logger.debug(`[getWasmDirectory] Current __dirname: ${currentDir}`, "WasmDirectory")

			// If we are in src/services/tree-sitter, we can try to go up
			if (currentDir.includes("services/tree-sitter")) {
				// Try to find the root of the extension
				// This is highly dependent on the build structure
				// Assuming standard structure: .../dist/services/tree-sitter or .../src/services/tree-sitter

				// Try to find 'dist' or 'src'
				const distIndex = currentDir.lastIndexOf("dist")
				if (distIndex !== -1) {
					extensionPath = currentDir.substring(0, distIndex) // Parent of dist
					logger.info(
						`[getWasmDirectory] Inferred extension path from __dirname (dist): ${extensionPath}`,
						"WasmDirectory",
					)
				} else {
					const srcIndex = currentDir.lastIndexOf("src")
					if (srcIndex !== -1) {
						extensionPath = currentDir.substring(0, srcIndex) // Parent of src
						logger.info(
							`[getWasmDirectory] Inferred extension path from __dirname (src): ${extensionPath}`,
							"WasmDirectory",
						)
					}
				}
			}
		} catch (e) {
			logger.warn(`[getWasmDirectory] Error trying to infer path from __dirname: ${e}`, "WasmDirectory")
		}
	}

	if (!extensionPath) {
		const errorMessage = `Could not determine extension path for WASM files. Tried extension IDs: ${possibleExtensionIds.join(", ")}`
		logger.error(`[getWasmDirectory] ${errorMessage}`, "WasmDirectory")

		// Log all available extensions for debugging
		const allExtensions = vscode.extensions.all.map((ext) => ext.id)
		logger.error(
			`[getWasmDirectory] Available extensions (${allExtensions.length}): ${allExtensions.slice(0, 10).join(", ")}${allExtensions.length > 10 ? "..." : ""}`,
			"WasmDirectory",
		)

		throw new Error(errorMessage)
	}

	// WASM files are located in dist/services/tree-sitter/
	// In development (monorepo), they might be in src/dist/services/tree-sitter/

	// Strategy 1: Standard production path
	const standardPath = path.join(extensionPath, "dist", "services", "tree-sitter")

	// Strategy 2: Development/Monorepo path (src/dist/...)
	const devPath = path.join(extensionPath, "src", "dist", "services", "tree-sitter")

	// Strategy 3: Direct source path (src/services/tree-sitter - unlikely for WASM but possible for some setups)
	const sourcePath = path.join(extensionPath, "src", "services", "tree-sitter")

	logger.debug(`[getWasmDirectory] Checking candidate paths:`, "WasmDirectory")
	logger.debug(`  1. Standard: ${standardPath}`, "WasmDirectory")
	logger.debug(`  2. Dev/Monorepo: ${devPath}`, "WasmDirectory")
	logger.debug(`  3. Source: ${sourcePath}`, "WasmDirectory")

	// Check which path exists and contains tree-sitter.wasm
	if (fs.existsSync(path.join(standardPath, "tree-sitter.wasm"))) {
		wasmDirectoryCache = standardPath
		logger.info(`[getWasmDirectory] Found WASM files at standard path: ${standardPath}`, "WasmDirectory")
	} else if (fs.existsSync(path.join(devPath, "tree-sitter.wasm"))) {
		wasmDirectoryCache = devPath
		logger.info(`[getWasmDirectory] Found WASM files at dev path: ${devPath}`, "WasmDirectory")
	} else if (fs.existsSync(path.join(sourcePath, "tree-sitter.wasm"))) {
		wasmDirectoryCache = sourcePath
		logger.info(`[getWasmDirectory] Found WASM files at source path: ${sourcePath}`, "WasmDirectory")
	} else {
		// Fallback to standard path but log warning
		logger.warn(
			`[getWasmDirectory] Could not find tree-sitter.wasm in any candidate path. Defaulting to standard path: ${standardPath}`,
			"WasmDirectory",
		)
		wasmDirectoryCache = standardPath
	}

	logger.info(
		`[getWasmDirectory] WASM directory resolved: ${wasmDirectoryCache} (from extension: ${foundExtensionId || "inferred"})`,
		"WasmDirectory",
	)

	return wasmDirectoryCache
}

/**
 * Reset the cached WASM directory (mainly for testing)
 */
export function resetWasmDirectoryCache(): void {
	wasmDirectoryCache = null
}
