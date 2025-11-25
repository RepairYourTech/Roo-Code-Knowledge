import * as path from "path"
import * as vscode from "vscode"
import { logger } from "../shared/logger"

let wasmDirectoryCache: string | null = null

/**
 * Get the directory containing tree-sitter WASM files
 * @returns Absolute path to the WASM directory
 */
export function getWasmDirectory(): string {
	if (wasmDirectoryCache) {
		logger.debug(`[getWasmDirectory] Using cached WASM directory: ${wasmDirectoryCache}`, "WasmDirectory")
		return wasmDirectoryCache
	}

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
	wasmDirectoryCache = path.join(extensionPath, "dist", "services", "tree-sitter")

	logger.info(
		`[getWasmDirectory] WASM directory resolved: ${wasmDirectoryCache} (from extension: ${foundExtensionId})`,
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
