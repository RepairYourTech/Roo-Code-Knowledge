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
 * Options for WASM directory resolution
 */
export interface WasmDirectoryResolutionOptions {
	/**
	 * Force revalidation of cached paths
	 */
	forceRevalidate?: boolean
	/**
	 * Allow fallback to download mechanism when validation fails
	 */
	allowFallback?: boolean
	/**
	 * Enable strict mode that throws errors immediately instead of attempting recovery
	 */
	strictMode?: boolean
}

/**
 * Get the directory containing tree-sitter WASM files
 * @param optionsOrForceRevalidate Options for resolution or legacy boolean for force revalidation
 * @returns Absolute path to the WASM directory
 */
export async function getWasmDirectory(
	optionsOrForceRevalidate?: boolean | WasmDirectoryResolutionOptions,
): Promise<string> {
	// Handle legacy boolean parameter for backward compatibility
	let options: WasmDirectoryResolutionOptions
	if (typeof optionsOrForceRevalidate === "boolean") {
		options = { forceRevalidate: optionsOrForceRevalidate }
	} else {
		options = optionsOrForceRevalidate || {}
	}

	// Set default values
	options.allowFallback = options.allowFallback !== undefined ? options.allowFallback : true
	options.strictMode = options.strictMode !== undefined ? options.strictMode : false

	logger.info("[getWasmDirectory] FUNCTION CALLED - checking for WASM directory", "WasmDirectory")

	// Check if we should force revalidation
	if (options.forceRevalidate && wasmDirectoryCache) {
		logger.info("[getWasmDirectory] Force revalidation requested, clearing cache", "WasmDirectory")
		wasmDirectoryCache = null
	}

	// Check cache validity
	const isCacheDisabled = process.env.ROO_CODE_DISABLE_WASM_CACHE === "true"
	if (wasmDirectoryCache && !isCacheDisabled) {
		const cacheAge = Date.now() - wasmDirectoryCache.timestamp
		if (cacheAge < CACHE_EXPIRY_MS) {
			// Determine path type for logging (path-separator agnostic)
			const srcWasmPath = path.join("src", "wasms", "tree-sitter")
			const distServicesPath = path.join("dist", "services", "tree-sitter")
			const normalizedCachePath = path.normalize(wasmDirectoryCache.path)

			const isSrcWasmPath =
				path.relative(normalizedCachePath, srcWasmPath) === "" ||
				!path.relative(srcWasmPath, normalizedCachePath).startsWith("..")
			const isDistServicesPath =
				path.relative(normalizedCachePath, distServicesPath) === "" ||
				!path.relative(distServicesPath, normalizedCachePath).startsWith("..")

			const pathType = isSrcWasmPath
				? "Runtime packaged source (priority #1)"
				: isDistServicesPath
					? "Legacy/compat (priority #2)"
					: "Other path"

			logger.debug(
				`[getWasmDirectory] Using cached WASM directory: ${wasmDirectoryCache.path} (${pathType}, age: ${Math.round(cacheAge / 1000)}s)`,
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

		// Enhanced debugging information
		logger.error(`[getWasmDirectory] Current working directory: ${process.cwd()}`, "WasmDirectory")
		logger.error(`[getWasmDirectory] __dirname: ${__dirname}`, "WasmDirectory")

		// Log all available extensions for debugging
		const allExtensions = vscode.extensions.all.map((ext) => ext.id)
		logger.error(
			`[getWasmDirectory] Available extensions (${allExtensions.length}): ${allExtensions.slice(0, 10).join(", ")}${allExtensions.length > 10 ? "..." : ""}`,
			"WasmDirectory",
		)

		// Enhanced recovery suggestions
		logger.error("[getWasmDirectory] Recovery steps:", "WasmDirectory")
		logger.error("  1. Ensure VS Code extension is properly installed and activated", "WasmDirectory")
		logger.error("  2. Try reloading VS Code window", "WasmDirectory")
		logger.error("  3. Check if extension is enabled in VS Code extensions panel", "WasmDirectory")
		logger.error(
			"  4. In development mode, ensure you're running from within the extension context",
			"WasmDirectory",
		)
		logger.error(`  5. See troubleshooting guide: ${TROUBLESHOOTING_URL}`, "WasmDirectory")

		throw new Error(
			`${errorMessage}. Current working directory: ${process.cwd()}, __dirname: ${__dirname}. See troubleshooting guide: ${TROUBLESHOOTING_URL}`,
		)
	}

	// Define candidate paths in order of preference
	// Resolution order:
	// 1. Runtime packaged source (src/wasms/tree-sitter) - highest priority for runtime packaged WASM files
	// 2. Legacy/compat (dist/services/tree-sitter) - for backward compatibility with existing installations
	// 3. Monorepo development builds (src/dist/services/tree-sitter)
	// 4. Alternative build outputs (out/services/tree-sitter)
	// 5. Direct path (services/tree-sitter)
	// 6. Source path for development (src/services/tree-sitter) - fallback for dev environments
	const candidatePaths = [
		path.join(extensionPath, "src", "wasms", "tree-sitter"), // Runtime packaged source (NEW - highest priority)
		path.join(extensionPath, "dist", "services", "tree-sitter"), // Legacy/compat (moved to #2)
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
			// Determine path type for logging (path-separator agnostic)
			const pathIndex = candidatePaths.indexOf(candidatePath) + 1
			const srcWasmPath = path.join("src", "wasms", "tree-sitter")
			const distServicesPath = path.join("dist", "services", "tree-sitter")
			const normalizedCandidatePath = path.normalize(candidatePath)

			const isSrcWasmPath =
				path.relative(normalizedCandidatePath, srcWasmPath) === "" ||
				!path.relative(srcWasmPath, normalizedCandidatePath).startsWith("..")
			const isDistServicesPath =
				path.relative(normalizedCandidatePath, distServicesPath) === "" ||
				!path.relative(distServicesPath, normalizedCandidatePath).startsWith("..")

			let pathType = ""
			if (isSrcWasmPath) {
				pathType = " (Runtime packaged source - priority #1)"
			} else if (isDistServicesPath) {
				pathType = " (Legacy/compat - priority #2)"
			} else {
				pathType = ` (priority #${pathIndex})`
			}

			logger.info(
				`[getWasmDirectory] Found valid WASM directory at: ${candidatePath}${pathType}`,
				"WasmDirectory",
			)
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
		if (!selectedPath && candidatePaths.length > 0) {
			selectedPath = candidatePaths[0] || null
			if (selectedPath) {
				selectedValidationResult = validateWasmDirectory(selectedPath)
				logger.error(
					`[getWasmDirectory] No existing directory found, using default path: ${selectedPath}`,
					"WasmDirectory",
				)
			}
		}

		// Enhanced error logging with validation details
		logger.error("[getWasmDirectory] WASM directory validation failed:", "WasmDirectory")
		logger.error(`  Current working directory: ${process.cwd()}`, "WasmDirectory")
		logger.error(`  __dirname: ${__dirname}`, "WasmDirectory")
		logger.error(`  Extension path: ${extensionPath}`, "WasmDirectory")
		logger.error(`  Selected path: ${selectedPath}`, "WasmDirectory")

		// List all candidate paths with their validation results
		logger.error("[getWasmDirectory] Candidate paths checked:", "WasmDirectory")
		candidatePaths.forEach((candidatePath, index) => {
			const validationResult = validateWasmDirectory(candidatePath)
			const exists = fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()
			logger.error(
				`  ${index + 1}. ${candidatePath} - Exists: ${exists}, Valid: ${validationResult.isValid}`,
				"WasmDirectory",
			)
			if (!validationResult.isValid) {
				logger.error(`     Missing: ${validationResult.missingCriticalFiles.join(", ")}`, "WasmDirectory")
			}
		})

		if (selectedValidationResult) {
			logger.error(
				`  Missing critical files: ${selectedValidationResult.missingCriticalFiles.join(", ")}`,
				"WasmDirectory",
			)
			if (selectedValidationResult.foundFiles.length > 0) {
				logger.error(`  Found files: ${selectedValidationResult.foundFiles.join(", ")}`, "WasmDirectory")
			}
		}

		// Enhanced recovery suggestions based on environment
		const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev"
		logger.error("[getWasmDirectory] Recovery steps:", "WasmDirectory")
		if (isDevelopment) {
			logger.error("  Development environment detected:", "WasmDirectory")
			logger.error(
				"  1. Run 'pnpm regenerate-wasms' to download and copy to src/wasms/tree-sitter/",
				"WasmDirectory",
			)
			logger.error("  2. Ensure src/wasms/tree-sitter/ directory exists and contains WASM files", "WasmDirectory")
			logger.error("  3. Check that WASM files are committed to the repository", "WasmDirectory")
		} else {
			logger.error("  Production environment detected:", "WasmDirectory")
			logger.error(
				"  1. Run command 'Roo-Cline: Download Tree-sitter WASM Files' from command palette",
				"WasmDirectory",
			)
			logger.error(
				"  2. Ensure dist/services/tree-sitter/ directory exists and contains WASM files",
				"WasmDirectory",
			)
			logger.error("  3. Try reloading the VS Code window", "WasmDirectory")
		}
		logger.error(`  4. See troubleshooting guide: ${TROUBLESHOOTING_URL}`, "WasmDirectory")

		// Run diagnostic integration
		try {
			logger.debug("[getWasmDirectory] Running comprehensive WASM diagnostics...", "WasmDirectory")
			const diagnosticReport = diagnoseWasmSetup(selectedPath || undefined)
			const formattedReport = formatDiagnosticReport(diagnosticReport)
			logger.debug(`[getWasmDirectory] Diagnostic report:\n${formattedReport}`, "WasmDirectory")
		} catch (e) {
			logger.warn(`[getWasmDirectory] Error running diagnostics: ${e}`, "WasmDirectory")
		}
	}

	// Automatic recovery mechanism when validation fails
	if (!selectedValidationResult?.isValid && options.allowFallback && !options.strictMode) {
		logger.warn("[getWasmDirectory] Validation failed, attempting automatic recovery", "WasmDirectory")

		try {
			// Check if download-wasms module is available
			const downloadWasmsModule = await import("./download-wasms")
			if (downloadWasmsModule && typeof downloadWasmsModule.downloadTreeSitterWasms === "function") {
				logger.warn("[getWasmDirectory] Download module available, suggesting recovery action", "WasmDirectory")

				const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev"
				if (isDevelopment) {
					logger.warn(
						"[getWasmDirectory] DEVELOPMENT MODE: Run 'pnpm regenerate-wasms' to download and copy WASM files to src/wasms/tree-sitter/",
						"WasmDirectory",
					)
				} else {
					logger.warn(
						"[getWasmDirectory] PRODUCTION MODE: Run 'Roo-Cline: Download Tree-sitter WASM Files' command from command palette",
						"WasmDirectory",
					)
				}
				logger.warn(
					"[getWasmDirectory] After running the download command, the WASM directory should be automatically detected",
					"WasmDirectory",
				)
			} else {
				logger.warn(
					"[getWasmDirectory] Download module not available, manual intervention required",
					"WasmDirectory",
				)
			}
		} catch (e) {
			logger.warn(`[getWasmDirectory] Could not check download module availability: ${e}`, "WasmDirectory")
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
 * Synchronous version of getWasmDirectory for backward compatibility
 * @param optionsOrForceRevalidate Options for resolution or legacy boolean for force revalidation
 * @returns Absolute path to the WASM directory
 */
export function getWasmDirectorySync(optionsOrForceRevalidate?: boolean | WasmDirectoryResolutionOptions): string {
	// Handle legacy boolean parameter for backward compatibility
	let options: WasmDirectoryResolutionOptions
	if (typeof optionsOrForceRevalidate === "boolean") {
		options = { forceRevalidate: optionsOrForceRevalidate }
	} else {
		options = optionsOrForceRevalidate || {}
	}

	// Set default values
	options.allowFallback = options.allowFallback !== undefined ? options.allowFallback : true
	options.strictMode = options.strictMode !== undefined ? options.strictMode : false

	logger.info("[getWasmDirectorySync] FUNCTION CALLED - checking for WASM directory", "WasmDirectory")

	// Check if we should force revalidation
	if (options.forceRevalidate && wasmDirectoryCache) {
		logger.info("[getWasmDirectorySync] Force revalidation requested, clearing cache", "WasmDirectory")
		wasmDirectoryCache = null
	}

	// Check cache validity
	const isCacheDisabled = process.env.ROO_CODE_DISABLE_WASM_CACHE === "true"
	if (wasmDirectoryCache && !isCacheDisabled) {
		const cacheAge = Date.now() - wasmDirectoryCache.timestamp
		if (cacheAge < CACHE_EXPIRY_MS) {
			// Determine path type for logging (path-separator agnostic)
			const srcWasmPath = path.join("src", "wasms", "tree-sitter")
			const distServicesPath = path.join("dist", "services", "tree-sitter")
			const normalizedCachePath = path.normalize(wasmDirectoryCache.path)

			const isSrcWasmPath =
				path.relative(normalizedCachePath, srcWasmPath) === "" ||
				!path.relative(srcWasmPath, normalizedCachePath).startsWith("..")
			const isDistServicesPath =
				path.relative(normalizedCachePath, distServicesPath) === "" ||
				!path.relative(distServicesPath, normalizedCachePath).startsWith("..")

			const pathType = isSrcWasmPath
				? "Runtime packaged source (priority #1)"
				: isDistServicesPath
					? "Legacy/compat (priority #2)"
					: "Other path"

			logger.debug(
				`[getWasmDirectorySync] Using cached WASM directory: ${wasmDirectoryCache.path} (${pathType}, age: ${Math.round(cacheAge / 1000)}s)`,
				"WasmDirectory",
			)
			return wasmDirectoryCache.path
		} else {
			logger.debug(
				`[getWasmDirectorySync] Cache expired (${Math.round(cacheAge / 1000)}s old), revalidating`,
				"WasmDirectory",
			)
			wasmDirectoryCache = null
		}
	}

	if (isCacheDisabled) {
		logger.debug("[getWasmDirectorySync] WASM cache disabled via environment variable", "WasmDirectory")
	}

	logger.debug("[getWasmDirectorySync] Attempting to locate WASM directory...", "WasmDirectory")

	// Find the extension - works for both roo-cline and forks
	// Try common extension IDs (note: getExtension() is case-sensitive)
	const possibleExtensionIds = [
		"rooveterinaryinc.roo-cline", // Lowercase variant (used by installed VSIX)
		"RooVeterinaryInc.roo-cline", // PascalCase variant
		"RooCodeInc.roo-code",
		"saoudrizwan.claude-dev", // Original Cline
	]

	logger.debug(
		`[getWasmDirectorySync] Checking ${possibleExtensionIds.length} possible extension IDs: ${possibleExtensionIds.join(", ")}`,
		"WasmDirectory",
	)

	let extensionPath: string | undefined
	let foundExtensionId: string | undefined
	let inferenceMethod: string | undefined

	for (const extensionId of possibleExtensionIds) {
		logger.debug(`[getWasmDirectorySync] Checking for extension: ${extensionId}`, "WasmDirectory")
		const ext = vscode.extensions.getExtension(extensionId)
		if (ext) {
			extensionPath = ext.extensionPath
			foundExtensionId = extensionId
			inferenceMethod = "found via vscode.extensions"
			logger.info(
				`[getWasmDirectorySync] Found extension: ${extensionId} at path: ${extensionPath}`,
				"WasmDirectory",
			)
			break
		} else {
			logger.debug(`[getWasmDirectorySync] Extension not found: ${extensionId}`, "WasmDirectory")
		}
	}

	// Fallback for development/test environment where vscode.extensions might not be fully populated
	// or we are running in a context where the extension isn't "installed" in the standard way
	if (!extensionPath) {
		logger.warn("[getWasmDirectorySync] Could not determine extension path via vscode.extensions", "WasmDirectory")

		// In dev/test, we might be able to infer the path from the current working directory or __dirname
		// This is a heuristic fallback
		try {
			// Check if we are in the extension source tree
			const currentDir = __dirname
			logger.debug(`[getWasmDirectorySync] Current __dirname: ${currentDir}`, "WasmDirectory")

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
						`[getWasmDirectorySync] Inferred extension path from __dirname (dist): ${extensionPath}`,
						"WasmDirectory",
					)
				} else {
					const srcIndex = currentDir.lastIndexOf("src")
					if (srcIndex !== -1) {
						extensionPath = currentDir.substring(0, srcIndex) // Parent of src
						inferenceMethod = "inferred from __dirname (src)"
						logger.info(
							`[getWasmDirectorySync] Inferred extension path from __dirname (src): ${extensionPath}`,
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
									`[getWasmDirectorySync] Validated extension path via package.json: ${packageJson.name}`,
									"WasmDirectory",
								)
							} else {
								logger.warn(
									`[getWasmDirectorySync] Unexpected extension name in package.json: ${packageJson.name}`,
									"WasmDirectory",
								)
							}
						} catch (e) {
							logger.warn(`[getWasmDirectorySync] Error reading package.json: ${e}`, "WasmDirectory")
						}
					} else {
						logger.warn(
							`[getWasmDirectorySync] No package.json found at inferred path: ${packageJsonPath}`,
							"WasmDirectory",
						)
					}
				}
			}
		} catch (e) {
			logger.warn(`[getWasmDirectorySync] Error trying to infer path from __dirname: ${e}`, "WasmDirectory")
		}
	}

	if (!extensionPath) {
		const errorMessage = `Could not determine extension path for WASM files. Tried extension IDs: ${possibleExtensionIds.join(", ")}`
		logger.error(`[getWasmDirectorySync] ${errorMessage}`, "WasmDirectory")

		// Enhanced debugging information
		logger.error(`[getWasmDirectorySync] Current working directory: ${process.cwd()}`, "WasmDirectory")
		logger.error(`[getWasmDirectorySync] __dirname: ${__dirname}`, "WasmDirectory")

		// Log all available extensions for debugging
		const allExtensions = vscode.extensions.all.map((ext) => ext.id)
		logger.error(
			`[getWasmDirectorySync] Available extensions (${allExtensions.length}): ${allExtensions.slice(0, 10).join(", ")}${allExtensions.length > 10 ? "..." : ""}`,
			"WasmDirectory",
		)

		// Enhanced recovery suggestions
		logger.error("[getWasmDirectorySync] Recovery steps:", "WasmDirectory")
		logger.error("  1. Ensure VS Code extension is properly installed and activated", "WasmDirectory")
		logger.error("  2. Try reloading VS Code window", "WasmDirectory")
		logger.error("  3. Check if extension is enabled in VS Code extensions panel", "WasmDirectory")
		logger.error(
			"  4. In development mode, ensure you're running from within the extension context",
			"WasmDirectory",
		)
		logger.error(`  5. See troubleshooting guide: ${TROUBLESHOOTING_URL}`, "WasmDirectory")

		throw new Error(
			`${errorMessage}. Current working directory: ${process.cwd()}, __dirname: ${__dirname}. See troubleshooting guide: ${TROUBLESHOOTING_URL}`,
		)
	}

	// Define candidate paths in order of preference
	// Resolution order:
	// 1. Runtime packaged source (src/wasms/tree-sitter) - highest priority for runtime packaged WASM files
	// 2. Legacy/compat (dist/services/tree-sitter) - for backward compatibility with existing installations
	// 3. Monorepo development builds (src/dist/services/tree-sitter)
	// 4. Alternative build outputs (out/services/tree-sitter)
	// 5. Direct path (services/tree-sitter)
	// 6. Source path for development (src/services/tree-sitter) - fallback for dev environments
	const candidatePaths = [
		path.join(extensionPath, "src", "wasms", "tree-sitter"), // Runtime packaged source (NEW - highest priority)
		path.join(extensionPath, "dist", "services", "tree-sitter"), // Legacy/compat (moved to #2)
		path.join(extensionPath, "src", "dist", "services", "tree-sitter"), // Monorepo dev
		path.join(extensionPath, "out", "services", "tree-sitter"), // Alternative build output
		path.join(extensionPath, "services", "tree-sitter"), // Direct path
		path.join(extensionPath, "src", "services", "tree-sitter"), // Development fallback
	]

	logger.debug(`[getWasmDirectorySync] Checking candidate paths:`, "WasmDirectory")
	candidatePaths.forEach((candidatePath, index) => {
		logger.debug(`  ${index + 1}. ${candidatePath}`, "WasmDirectory")
	})

	let selectedPath: string | null = null
	let selectedValidationResult: ValidationResult | null = null

	// Check each candidate path with comprehensive validation
	for (const candidatePath of candidatePaths) {
		logger.debug(`[getWasmDirectorySync] Validating candidate path: ${candidatePath}`, "WasmDirectory")
		const validationResult = validateWasmDirectory(candidatePath)

		if (validationResult.isValid) {
			selectedPath = candidatePath
			selectedValidationResult = validationResult
			// Determine path type for logging (path-separator agnostic)
			const pathIndex = candidatePaths.indexOf(candidatePath) + 1
			const srcWasmPath = path.join("src", "wasms", "tree-sitter")
			const distServicesPath = path.join("dist", "services", "tree-sitter")
			const normalizedCandidatePath = path.normalize(candidatePath)

			const isSrcWasmPath =
				path.relative(normalizedCandidatePath, srcWasmPath) === "" ||
				!path.relative(srcWasmPath, normalizedCandidatePath).startsWith("..")
			const isDistServicesPath =
				path.relative(normalizedCandidatePath, distServicesPath) === "" ||
				!path.relative(distServicesPath, normalizedCandidatePath).startsWith("..")

			let pathType = ""
			if (isSrcWasmPath) {
				pathType = " (Runtime packaged source - priority #1)"
			} else if (isDistServicesPath) {
				pathType = " (Legacy/compat - priority #2)"
			} else {
				pathType = ` (priority #${pathIndex})`
			}

			logger.info(
				`[getWasmDirectorySync] Found valid WASM directory at: ${candidatePath}${pathType}`,
				"WasmDirectory",
			)
			logger.debug(
				`[getWasmDirectorySync] Found files: ${validationResult.foundFiles.join(", ")}`,
				"WasmDirectory",
			)
			break
		} else {
			logger.debug(`[getWasmDirectorySync] Path validation failed: ${candidatePath}`, "WasmDirectory")
			logger.debug(
				`[getWasmDirectorySync] Missing critical files: ${validationResult.missingCriticalFiles.join(", ")}`,
				"WasmDirectory",
			)
			if (validationResult.foundFiles.length > 0) {
				logger.debug(
					`[getWasmDirectorySync] Found files: ${validationResult.foundFiles.join(", ")}`,
					"WasmDirectory",
				)
			}
		}
	}

	// If no path passed validation, fall back to the first existing directory
	if (!selectedPath) {
		logger.warn(
			"[getWasmDirectorySync] No candidate path passed validation, falling back to first existing directory",
			"WasmDirectory",
		)

		for (const candidatePath of candidatePaths) {
			if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
				selectedPath = candidatePath
				selectedValidationResult = validateWasmDirectory(candidatePath)
				logger.warn(
					`[getWasmDirectorySync] Using existing directory despite validation failures: ${candidatePath}`,
					"WasmDirectory",
				)
				break
			}
		}

		// If still no path found, use the first candidate path
		if (!selectedPath && candidatePaths.length > 0) {
			selectedPath = candidatePaths[0] || null
			if (selectedPath) {
				selectedValidationResult = validateWasmDirectory(selectedPath)
				logger.error(
					`[getWasmDirectorySync] No existing directory found, using default path: ${selectedPath}`,
					"WasmDirectory",
				)
			}
		}

		// Enhanced error logging with validation details
		logger.error("[getWasmDirectorySync] WASM directory validation failed:", "WasmDirectory")
		logger.error(`  Current working directory: ${process.cwd()}`, "WasmDirectory")
		logger.error(`  __dirname: ${__dirname}`, "WasmDirectory")
		logger.error(`  Extension path: ${extensionPath}`, "WasmDirectory")
		logger.error(`  Selected path: ${selectedPath}`, "WasmDirectory")

		// List all candidate paths with their validation results
		logger.error("[getWasmDirectorySync] Candidate paths checked:", "WasmDirectory")
		candidatePaths.forEach((candidatePath, index) => {
			const validationResult = validateWasmDirectory(candidatePath)
			const exists = fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()
			logger.error(
				`  ${index + 1}. ${candidatePath} - Exists: ${exists}, Valid: ${validationResult.isValid}`,
				"WasmDirectory",
			)
			if (!validationResult.isValid) {
				logger.error(`     Missing: ${validationResult.missingCriticalFiles.join(", ")}`, "WasmDirectory")
			}
		})

		if (selectedValidationResult) {
			logger.error(
				`  Missing critical files: ${selectedValidationResult.missingCriticalFiles.join(", ")}`,
				"WasmDirectory",
			)
			if (selectedValidationResult.foundFiles.length > 0) {
				logger.error(`  Found files: ${selectedValidationResult.foundFiles.join(", ")}`, "WasmDirectory")
			}
		}

		// Enhanced recovery suggestions based on environment
		const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev"
		logger.error("[getWasmDirectorySync] Recovery steps:", "WasmDirectory")
		if (isDevelopment) {
			logger.error("  Development environment detected:", "WasmDirectory")
			logger.error(
				"  1. Run 'pnpm regenerate-wasms' to download and copy to src/wasms/tree-sitter/",
				"WasmDirectory",
			)
			logger.error("  2. Ensure src/wasms/tree-sitter/ directory exists and contains WASM files", "WasmDirectory")
			logger.error("  3. Check that WASM files are committed to the repository", "WasmDirectory")
		} else {
			logger.error("  Production environment detected:", "WasmDirectory")
			logger.error(
				"  1. Run command 'Roo-Cline: Download Tree-sitter WASM Files' from command palette",
				"WasmDirectory",
			)
			logger.error(
				"  2. Ensure dist/services/tree-sitter/ directory exists and contains WASM files",
				"WasmDirectory",
			)
			logger.error("  3. Try reloading the VS Code window", "WasmDirectory")
		}
		logger.error(`  4. See troubleshooting guide: ${TROUBLESHOOTING_URL}`, "WasmDirectory")
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
		`[getWasmDirectorySync] WASM directory resolved: ${selectedPath} (from extension: ${foundExtensionId || inferenceMethod || "inferred"})`,
		"WasmDirectory",
	)

	return selectedPath!
}

/**
 * Get the directory containing tree-sitter WASM files with retry logic for transient failures
 * @param optionsOrForceRevalidate Options for resolution or legacy boolean for force revalidation
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @param retryDelayMs Delay between retries in milliseconds (default: 500)
 * @returns Promise resolving to absolute path to the WASM directory
 */
export async function getWasmDirectoryWithRetry(
	optionsOrForceRevalidate?: boolean | WasmDirectoryResolutionOptions,
	maxRetries: number = 3,
	retryDelayMs: number = 500,
): Promise<string> {
	// Handle legacy boolean parameter for backward compatibility
	let options: WasmDirectoryResolutionOptions
	if (typeof optionsOrForceRevalidate === "boolean") {
		options = { forceRevalidate: optionsOrForceRevalidate }
	} else {
		options = optionsOrForceRevalidate || {}
	}

	// Set default values
	options.allowFallback = options.allowFallback !== undefined ? options.allowFallback : true
	options.strictMode = options.strictMode !== undefined ? options.strictMode : false

	logger.info(
		`[getWasmDirectoryWithRetry] Starting WASM directory resolution with up to ${maxRetries} retries`,
		"WasmDirectory",
	)

	let lastError: Error | null = null

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.debug(`[getWasmDirectoryWithRetry] Attempt ${attempt} of ${maxRetries}`, "WasmDirectory")

			// Invalidate cache between retries to ensure fresh resolution
			if (attempt > 1) {
				invalidateWasmDirectoryCache()
				logger.debug(
					`[getWasmDirectoryWithRetry] Cache invalidated for retry attempt ${attempt}`,
					"WasmDirectory",
				)
			}

			const wasmDirectory = await getWasmDirectory(options)
			logger.info(
				`[getWasmDirectoryWithRetry] Successfully resolved WASM directory on attempt ${attempt}: ${wasmDirectory}`,
				"WasmDirectory",
			)
			return wasmDirectory
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))

			// Check if this is a retryable error
			const isRetryableError =
				lastError.message.includes("ENOENT") ||
				lastError.message.includes("EACCES") ||
				lastError.message.includes("timeout") ||
				lastError.message.includes("network")

			if (attempt === maxRetries) {
				logger.error(`[getWasmDirectoryWithRetry] All ${maxRetries} attempts exhausted`, "WasmDirectory")
				break
			}

			if (!isRetryableError) {
				logger.warn(
					`[getWasmDirectoryWithRetry] Non-retryable error on attempt ${attempt}: ${lastError.message}`,
					"WasmDirectory",
				)
				break
			}

			logger.warn(
				`[getWasmDirectoryWithRetry] Retryable error on attempt ${attempt}: ${lastError.message}`,
				"WasmDirectory",
			)
			logger.info(`[getWasmDirectoryWithRetry] Waiting ${retryDelayMs}ms before retry...`, "WasmDirectory")

			// Wait before retry
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
		}
	}

	// All retries exhausted or non-retryable error
	const errorMessage = `Failed to resolve WASM directory after ${maxRetries} attempts. Last error: ${lastError?.message || "Unknown error"}`
	logger.error(`[getWasmDirectoryWithRetry] ${errorMessage}`, "WasmDirectory")

	// Enhanced error message with recovery suggestions
	const enhancedErrorMessage = `${errorMessage}. Recovery suggestions:
1. Check your internet connection and try again
2. Run 'pnpm regenerate-wasms' in development mode
3. Run 'Roo-Cline: Download Tree-sitter WASM Files' command in production mode
4. Try reloading VS Code window
5. See troubleshooting guide: ${TROUBLESHOOTING_URL}`

	throw new Error(enhancedErrorMessage)
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
