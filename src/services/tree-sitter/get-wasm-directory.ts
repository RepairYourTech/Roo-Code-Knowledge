import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs"
import { logger } from "../shared/logger"
import { validateWasmDirectory, ValidationResult, diagnoseWasmSetup, formatDiagnosticReport } from "./wasm-diagnostics"

const TROUBLESHOOTING_URL = "https://github.com/RooCline/Roo-Cline/blob/main/docs/TROUBLESHOOTING.md#wasm-files"

// Cache structure with timestamp and validation result
interface WasmDirectoryCache {
	path: string
	timestamp: number
	validationResult: ValidationResult
}

let wasmDirectoryCache: WasmDirectoryCache | null = null
const CACHE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get the directory containing tree-sitter WASM files
 * @param forceRevalidate If true, clear cache before resolution
 * @returns Absolute path to the WASM directory
 */
export function getWasmDirectory(forceRevalidate: boolean = false): string {
	logger.info("[getWasmDirectory] FUNCTION CALLED - checking for WASM directory", "WasmDirectory")

	// Check if we should force revalidation
	if (forceRevalidate && wasmDirectoryCache) {
		logger.info("[getWasmDirectory] Force revalidation requested, clearing cache", "WasmDirectory")
		wasmDirectoryCache = null
	}

	// Check cache validity
	const isCacheDisabled = process.env.ROO_CODE_DISABLE_WASM_CACHE === "true"
	if (wasmDirectoryCache && !isCacheDisabled) {
		const cacheAge = Date.now() - wasmDirectoryCache.timestamp
		if (cacheAge < CACHE_EXPIRY_MS) {
			logger.debug(
				`[getWasmDirectory] Using cached WASM directory: ${wasmDirectoryCache.path} (age: ${Math.round(cacheAge / 1000)}s)`,
				"WasmDirectory",
			)
			return wasmDirectoryCache.path
		} else {
			logger.debug(
				`[getWasmDirectory] Cache expired (${Math.round(cacheAge / 1000)}s old), revalidating`,
				"WasmDirectory",
			)
			wasmDirectoryCache = null
		}
	}

	if (isCacheDisabled) {
		logger.debug("[getWasmDirectory] WASM cache disabled via environment variable", "WasmDirectory")
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
	let inferenceMethod: string | undefined

	for (const extensionId of possibleExtensionIds) {
		logger.debug(`[getWasmDirectory] Checking for extension: ${extensionId}`, "WasmDirectory")
		const ext = vscode.extensions.getExtension(extensionId)
		if (ext) {
			extensionPath = ext.extensionPath
			foundExtensionId = extensionId
			inferenceMethod = "found via vscode.extensions"
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
			if (currentDir.includes(`services${path.sep}tree-sitter`) || currentDir.includes("services/tree-sitter")) {
				// Try to find the root of the extension
				// This is highly dependent on the build structure
				// Assuming standard structure: .../dist/services/tree-sitter or .../src/services/tree-sitter

				// Try to find 'dist' or 'src'
				const distIndex = currentDir.lastIndexOf("dist")
				if (distIndex !== -1) {
					extensionPath = currentDir.substring(0, distIndex) // Parent of dist
					inferenceMethod = "inferred from __dirname (dist)"
					logger.info(
						`[getWasmDirectory] Inferred extension path from __dirname (dist): ${extensionPath}`,
						"WasmDirectory",
					)
				} else {
					const srcIndex = currentDir.lastIndexOf("src")
					if (srcIndex !== -1) {
						extensionPath = currentDir.substring(0, srcIndex) // Parent of src
						inferenceMethod = "inferred from __dirname (src)"
						logger.info(
							`[getWasmDirectory] Inferred extension path from __dirname (src): ${extensionPath}`,
							"WasmDirectory",
						)
					}
				}

				// Validate the inferred path by checking if package.json exists
				if (extensionPath) {
					const packageJsonPath = path.join(extensionPath, "package.json")
					if (fs.existsSync(packageJsonPath)) {
						try {
							const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
							const expectedNames = ["roo-cline", "roo-code", "claude-dev"]
							if (expectedNames.some((name) => packageJson.name?.includes(name))) {
								logger.info(
									`[getWasmDirectory] Validated extension path via package.json: ${packageJson.name}`,
									"WasmDirectory",
								)
							} else {
								logger.warn(
									`[getWasmDirectory] Unexpected extension name in package.json: ${packageJson.name}`,
									"WasmDirectory",
								)
							}
						} catch (e) {
							logger.warn(`[getWasmDirectory] Error reading package.json: ${e}`, "WasmDirectory")
						}
					} else {
						logger.warn(
							`[getWasmDirectory] No package.json found at inferred path: ${packageJsonPath}`,
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

		logger.error(
			"[getWasmDirectory] Suggestion: Check if VS Code extension is properly installed and activated",
			"WasmDirectory",
		)

		throw new Error(`${errorMessage}. See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
	}

	// Define candidate paths in order of preference
	// Resolution order:
	// 1. Production builds (dist/services/tree-sitter) - highest priority for packaged extension
	// 2. Static bundled source (src/wasms/tree-sitter) - for direct source access
	// 3. Monorepo development builds (src/dist/services/tree-sitter)
	// 4. Alternative build outputs (out/services/tree-sitter)
	// 5. Direct path (services/tree-sitter)
	// 6. Source path for development (src/services/tree-sitter) - fallback for dev environments
	const candidatePaths = [
		path.join(extensionPath, "dist", "services", "tree-sitter"), // Production (highest priority)
		path.join(extensionPath, "src", "wasms", "tree-sitter"), // Static bundled source (NEW - for direct source access)
		path.join(extensionPath, "src", "dist", "services", "tree-sitter"), // Monorepo dev
		path.join(extensionPath, "out", "services", "tree-sitter"), // Alternative build output
		path.join(extensionPath, "services", "tree-sitter"), // Direct path
		path.join(extensionPath, "src", "services", "tree-sitter"), // Development fallback
	]

	logger.debug(`[getWasmDirectory] Checking candidate paths:`, "WasmDirectory")
	candidatePaths.forEach((candidatePath, index) => {
		logger.debug(`  ${index + 1}. ${candidatePath}`, "WasmDirectory")
	})

	let selectedPath: string | null = null
	let selectedValidationResult: ValidationResult | null = null

	// Check each candidate path with comprehensive validation
	for (const candidatePath of candidatePaths) {
		logger.debug(`[getWasmDirectory] Validating candidate path: ${candidatePath}`, "WasmDirectory")
		const validationResult = validateWasmDirectory(candidatePath)

		if (validationResult.isValid) {
			selectedPath = candidatePath
			selectedValidationResult = validationResult
			logger.info(`[getWasmDirectory] Found valid WASM directory at: ${candidatePath}`, "WasmDirectory")
			logger.debug(`[getWasmDirectory] Found files: ${validationResult.foundFiles.join(", ")}`, "WasmDirectory")
			break
		} else {
			logger.debug(`[getWasmDirectory] Path validation failed: ${candidatePath}`, "WasmDirectory")
			logger.debug(
				`[getWasmDirectory] Missing critical files: ${validationResult.missingCriticalFiles.join(", ")}`,
				"WasmDirectory",
			)
			if (validationResult.foundFiles.length > 0) {
				logger.debug(
					`[getWasmDirectory] Found files: ${validationResult.foundFiles.join(", ")}`,
					"WasmDirectory",
				)
			}
		}
	}

	// If no path passed validation, fall back to the first existing directory
	if (!selectedPath) {
		logger.warn(
			"[getWasmDirectory] No candidate path passed validation, falling back to first existing directory",
			"WasmDirectory",
		)

		for (const candidatePath of candidatePaths) {
			if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
				selectedPath = candidatePath
				selectedValidationResult = validateWasmDirectory(candidatePath)
				logger.warn(
					`[getWasmDirectory] Using existing directory despite validation failures: ${candidatePath}`,
					"WasmDirectory",
				)
				break
			}
		}

		// If still no path found, use the first candidate path
		if (!selectedPath) {
			selectedPath = candidatePaths[0]
			selectedValidationResult = validateWasmDirectory(selectedPath)
			logger.error(
				`[getWasmDirectory] No existing directory found, using default path: ${selectedPath}`,
				"WasmDirectory",
			)
		}

		// Enhanced error logging with validation details
		logger.error("[getWasmDirectory] WASM directory validation failed:", "WasmDirectory")
		logger.error(`  Selected path: ${selectedPath}`, "WasmDirectory")
		if (selectedValidationResult) {
			logger.error(
				`  Missing critical files: ${selectedValidationResult.missingCriticalFiles.join(", ")}`,
				"WasmDirectory",
			)
			if (selectedValidationResult.foundFiles.length > 0) {
				logger.error(`  Found files: ${selectedValidationResult.foundFiles.join(", ")}`, "WasmDirectory")
			}
		}
		logger.error("[getWasmDirectory] To fix this issue:", "WasmDirectory")
		logger.error(
			"  1. Verify WASM files exist in src/wasms/tree-sitter/ (should be committed to repo)",
			"WasmDirectory",
		)
		logger.error(
			"  2. If missing, run 'pnpm regenerate-wasms' to download and copy to static directory",
			"WasmDirectory",
		)
		logger.error(
			"  3. Or run command 'Roo-Cline: Download Tree-sitter WASM Files' (downloads to dist, temporary)",
			"WasmDirectory",
		)
		logger.error(`  4. See troubleshooting guide: ${TROUBLESHOOTING_URL}`, "WasmDirectory")

		// Run diagnostic integration
		try {
			logger.debug("[getWasmDirectory] Running comprehensive WASM diagnostics...", "WasmDirectory")
			const diagnosticReport = diagnoseWasmSetup(selectedPath)
			const formattedReport = formatDiagnosticReport(diagnosticReport)
			logger.debug(`[getWasmDirectory] Diagnostic report:\n${formattedReport}`, "WasmDirectory")
		} catch (e) {
			logger.warn(`[getWasmDirectory] Error running diagnostics: ${e}`, "WasmDirectory")
		}
	}

	// Update cache with validation result
	if (selectedPath && selectedValidationResult) {
		wasmDirectoryCache = {
			path: selectedPath,
			timestamp: Date.now(),
			validationResult: selectedValidationResult,
		}
	}

	logger.info(
		`[getWasmDirectory] WASM directory resolved: ${selectedPath} (from extension: ${foundExtensionId || inferenceMethod || "inferred"})`,
		"WasmDirectory",
	)

	return selectedPath!
}

/**
 * Invalidate the cached WASM directory
 */
export function invalidateWasmDirectoryCache(): void {
	logger.info("[invalidateWasmDirectoryCache] Cache invalidation requested", "WasmDirectory")
	wasmDirectoryCache = null
}

/**
 * Reset the cached WASM directory (mainly for testing)
 * @deprecated Use invalidateWasmDirectoryCache() instead
 */
export function resetWasmDirectoryCache(): void {
	logger.warn(
		"[resetWasmDirectoryCache] Deprecated function called, use invalidateWasmDirectoryCache() instead",
		"WasmDirectory",
	)
	invalidateWasmDirectoryCache()
}
