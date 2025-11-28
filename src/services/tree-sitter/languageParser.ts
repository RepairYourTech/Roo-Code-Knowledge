import * as path from "path"
import * as vscode from "vscode"
import {
	getWasmDirectory,
	getWasmDirectorySync,
	invalidateWasmDirectoryCache,
	getWasmDirectoryWithRetry,
} from "./get-wasm-directory"
import { diagnoseWasmSetup, validateWasmDirectory, DiagnosticReport, formatDiagnosticReport } from "./wasm-diagnostics"
import { logger } from "../shared/logger"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { MetricsCollector } from "../code-index/utils/metrics-collector"
import * as queries from "./queries"
import { loadLanguageWithRetry, WasmLoadOptions } from "./wasm-loader-with-retry"
import { ParserAvailabilityCache, checkMultipleParserAvailability } from "./parser-availability-checker"

const TROUBLESHOOTING_URL = "https://github.com/RooCline/Roo-Cline/blob/main/docs/TROUBLESHOOTING.md#wasm-files"

export interface LanguageParser {
	parser: any
	query: any
	language: any
	querySource?: "comprehensive" | "hardcoded" | "fallback" | "none"
	queryPatternCount?: number
}

// Type for indexed collection of language parsers
export interface LanguageParsers {
	[key: string]: LanguageParser
}

let hasRunDiagnostics = false
let languageParserMap: { [key: string]: LanguageParser } = {}

// Module-level availability cache
const parserAvailabilityCache = new ParserAvailabilityCache()

export function getParserAvailabilityCache(): ParserAvailabilityCache {
	return parserAvailabilityCache
}

function getStrictWasmLoading(): boolean {
	const config = vscode.workspace.getConfiguration("roo-code")
	return config.get("treeSitterStrictWasmLoading", false)
}

function getComprehensiveQuery(languageName: string): string | null {
	// Map language names to query exports
	const languageToQueryMap: { [key: string]: string } = {
		typescript: "typescriptQuery",
		javascript: "javascriptQuery",
		tsx: "tsxQuery",
		python: "pythonQuery",
		rust: "rustQuery",
		go: "goQuery",
		cpp: "cppQuery",
		c: "cQuery",
		c_sharp: "csharpQuery",
		ruby: "rubyQuery",
		java: "javaQuery",
		php: "phpQuery",
		swift: "swiftQuery",
		kotlin: "kotlinQuery",
		css: "cssQuery",
		html: "htmlQuery",
		ocaml: "ocamlQuery",
		scala: "scalaQuery",
		solidity: "solidityQuery",
		toml: "tomlQuery",
		yaml: "yamlQuery",
		vue: "vueQuery",
		lua: "luaQuery",
		systemrdl: "systemrdlQuery",
		tlaplus: "tlaPlusQuery",
		zig: "zigQuery",
		embedded_template: "embeddedTemplateQuery",
		elisp: "elispQuery",
		elixir: "elixirQuery",
		xml: "xmlQuery",
	}

	// Handle special cases
	const queryKey = languageToQueryMap[languageName]
	if (!queryKey) {
		logger.debug(`No comprehensive query mapping found for language: ${languageName}`, "LanguageParser")
		return null
	}

	// Check if the query exists in the queries module
	if (queryKey in queries) {
		logger.debug(`Found comprehensive query for ${languageName}: ${queryKey}`, "LanguageParser")
		return (queries as any)[queryKey]
	}

	logger.debug(`Comprehensive query not found for language: ${languageName}`, "LanguageParser")
	return null
}

async function loadLanguage(langName: string, sourceDirectory?: string, metricsCollector?: MetricsCollector) {
	const startTime = Date.now()

	try {
		// Capture telemetry for load attempt
		try {
			TelemetryService.instance.captureWasmLoadAttempt(langName)
		} catch (e) {
			logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
		}

		// Record load attempt metric
		if (metricsCollector) {
			metricsCollector.recordParserMetric(langName, "loadAttempt")
		}

		let wasmDirectory: string
		try {
			wasmDirectory = getWasmDirectorySync()
		} catch (error) {
			logger.debug(
				`Failed to locate WASM directory: ${error instanceof Error ? error.message : String(error)}`,
				"LanguageParser",
			)
			throw new Error(`Cannot locate tree-sitter WASM files. See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
		}
		const { Parser } = require("web-tree-sitter")

		logger.debug(`Attempting to load language: ${langName}`, "LanguageParser")

		// Use retry logic for WASM loading
		const retryOptions: WasmLoadOptions = {
			maxRetries: 3,
			initialDelayMs: 100,
			maxDelayMs: 2000,
		}

		let loadResult

		// For development or when sourceDirectory is provided, try to load from local path
		if (process.env.NODE_ENV === "development" || sourceDirectory) {
			const localPath = sourceDirectory || wasmDirectory
			loadResult = await loadLanguageWithRetry(langName, localPath, Parser, retryOptions)

			if (loadResult.success) {
				logger.debug(
					`Successfully loaded ${langName}.wasm from ${loadResult.wasmPath} with retry logic (${loadResult.attemptCount} attempts, ${loadResult.totalDuration}ms)`,
					"LanguageParser",
				)

				// Record success metrics
				if (metricsCollector) {
					metricsCollector.recordParserMetric(langName, "loadSuccess")
					// Record retry attempts as loadSuccess count to track total attempts
					if (loadResult.attemptCount > 1) {
						metricsCollector.recordParserMetric(langName, "loadSuccess", loadResult.attemptCount - 1)
					}
				}

				// Capture telemetry for success
				try {
					TelemetryService.instance.captureWasmLoadSuccess(
						langName,
						loadResult.wasmPath!,
						Date.now() - startTime,
					)
				} catch (e) {
					logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
				}

				return loadResult.languageObj
			} else {
				// Fall back to node_modules if local loading fails
				logger.warn(
					`Failed to load ${langName}.wasm from local path after ${loadResult.attemptCount} attempts, falling back to node_modules: ${loadResult.error?.message}`,
					"LanguageParser",
				)

				// Record fallback metric
				if (metricsCollector) {
					metricsCollector.recordParserMetric(langName, "fallback")
				}
			}
		}

		// Try loading from node_modules with retry logic
		try {
			const packagePath = require.resolve(
				`@tree-sitter-grammars/tree-sitter-${langName}/tree-sitter-${langName}.wasm`,
			)
			loadResult = await loadLanguageWithRetry(langName, path.dirname(packagePath), Parser, retryOptions)

			if (loadResult.success) {
				logger.debug(
					`Successfully loaded ${langName}.wasm from node_modules with retry logic (${loadResult.attemptCount} attempts, ${loadResult.totalDuration}ms)`,
					"LanguageParser",
				)

				// Record success metrics
				if (metricsCollector) {
					metricsCollector.recordParserMetric(langName, "loadSuccess")
					// Record retry attempts as loadSuccess count to track total attempts
					if (loadResult.attemptCount > 1) {
						metricsCollector.recordParserMetric(langName, "loadSuccess", loadResult.attemptCount - 1)
					}
				}

				// Capture telemetry for success
				try {
					TelemetryService.instance.captureWasmLoadSuccess(
						langName,
						loadResult.wasmPath!,
						Date.now() - startTime,
					)
				} catch (e) {
					logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
				}

				return loadResult.languageObj
			}
		} catch (error) {
			// Try alternative package name with retry logic
			logger.debug(`Trying alternative package name for ${langName}`, "LanguageParser")
			try {
				const altPackagePath = require.resolve(`tree-sitter-${langName}/tree-sitter-${langName}.wasm`)
				loadResult = await loadLanguageWithRetry(langName, path.dirname(altPackagePath), Parser, retryOptions)

				if (loadResult.success) {
					logger.debug(
						`Successfully loaded ${langName}.wasm from alternative package with retry logic (${loadResult.attemptCount} attempts, ${loadResult.totalDuration}ms)`,
						"LanguageParser",
					)

					// Record success metrics
					if (metricsCollector) {
						metricsCollector.recordParserMetric(langName, "loadSuccess")
						// Record retry attempts as loadSuccess count to track total attempts
						if (loadResult.attemptCount > 1) {
							metricsCollector.recordParserMetric(langName, "loadSuccess", loadResult.attemptCount - 1)
						}
					}

					// Capture telemetry for success
					try {
						TelemetryService.instance.captureWasmLoadSuccess(
							langName,
							loadResult.wasmPath!,
							Date.now() - startTime,
						)
					} catch (e) {
						logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
					}

					return loadResult.languageObj
				}
			} catch (altError) {
				logger.debug(
					`Alternative package also failed for ${langName}: ${altError instanceof Error ? altError.message : String(altError)}`,
					"LanguageParser",
				)
			}
		}

		// All attempts failed, update availability cache
		parserAvailabilityCache.invalidate(langName)

		// Record final failure metrics
		const finalError = loadResult?.error || new Error(`Failed to load ${langName} from all sources`)
		const errorMessage = finalError.message

		if (metricsCollector) {
			metricsCollector.recordParserMetric(langName, "loadFailure", 1, errorMessage)
		}

		// Capture telemetry for failure
		try {
			TelemetryService.instance.captureWasmLoadFailure(langName, errorMessage, true)
		} catch (e) {
			logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
		}

		logger.error(`Failed to load language ${langName} after all retry attempts: ${errorMessage}`, "LanguageParser")
		return null
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error(`Unexpected error loading language ${langName}: ${errorMessage}`, "LanguageParser")

		// Record failure metrics
		if (metricsCollector) {
			metricsCollector.recordParserMetric(langName, "loadFailure", 1, errorMessage)
		}

		// Capture telemetry for failure
		try {
			TelemetryService.instance.captureWasmLoadFailure(langName, errorMessage, true)
		} catch (e) {
			logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
		}

		return null
	}
}

export async function loadRequiredLanguageParsers(
	filesToParse: string[],
	sourceDirectory?: string,
	metricsCollector?: MetricsCollector,
): Promise<{ [key: string]: LanguageParser }> {
	const { Parser } = require("web-tree-sitter")

	// Note: If implementing WASM downloads in this file, call invalidateWasmDirectoryCache()
	// after any successful download operation to ensure the cache is refreshed

	// Run diagnostics once before initializing parsers
	if (!hasRunDiagnostics) {
		let wasmDirectory: string | undefined
		try {
			wasmDirectory = getWasmDirectorySync()
		} catch (error) {
			logger.debug(
				`Failed to locate WASM directory for diagnostics: ${error instanceof Error ? error.message : String(error)}`,
				"LanguageParser",
			)
			// Let diagnoseWasmSetup handle the resolution
		}
		const diagnosticReport = diagnoseWasmSetup(wasmDirectory)

		// Capture telemetry for diagnostic run
		try {
			TelemetryService.instance.captureWasmDiagnosticRun(
				diagnosticReport.isHealthy,
				diagnosticReport.missingCriticalFiles.length,
				diagnosticReport.totalFiles,
				Math.round(diagnosticReport.totalSize / 1024),
			)
		} catch (e) {
			logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
		}

		// If critical WASM files are missing, handle based on strict mode
		if (!diagnosticReport.isHealthy) {
			const downloadInstructions = `Missing tree-sitter WASM files in ${diagnosticReport.wasmDirectory}.
See troubleshooting guide: ${TROUBLESHOOTING_URL}`

			if (getStrictWasmLoading()) {
				throw new Error(`Strict mode enabled. ${downloadInstructions}`)
			} else {
				logger.warn(downloadInstructions, "LanguageParser")
			}
		}

		// Check if WASM directory exists and suggest running download command if it doesn't
		if (!diagnosticReport.wasmDirectoryExists) {
			const downloadInstructions = `WASM directory not found at ${diagnosticReport.wasmDirectory}.
See troubleshooting guide: ${TROUBLESHOOTING_URL}`

			if (getStrictWasmLoading()) {
				throw new Error(`Strict mode enabled. ${downloadInstructions}`)
			} else {
				logger.warn(downloadInstructions, "LanguageParser")
			}
		}

		hasRunDiagnostics = true
	}

	// Extract unique extensions from files to parse
	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: { [key: string]: LanguageParser } = {}

	// Map file extensions to language names
	const extensionToLanguage: { [key: string]: string } = {
		js: "javascript",
		jsx: "javascript",
		json: "javascript",
		ts: "typescript",
		tsx: "tsx",
		py: "python",
		rs: "rust",
		go: "go",
		cpp: "cpp",
		hpp: "cpp",
		c: "c",
		h: "c",
		cs: "c_sharp",
		rb: "ruby",
		java: "java",
		php: "php",
		swift: "swift",
		kt: "kotlin",
		kts: "kotlin",
		css: "css",
		html: "html",
		ml: "ocaml",
		mli: "ocaml",
		scala: "scala",
		sol: "solidity",
		toml: "toml",
		// Note: xml extension removed - requires separate @tree-sitter-grammars/tree-sitter-xml package
		yaml: "yaml",
		yml: "yaml",
		vue: "vue",
		lua: "lua",
		rdl: "systemrdl",
		tla: "tlaplus",
		zig: "zig",
		ejs: "ejs",
		erb: "erb",
		el: "elisp",
		ex: "elixir",
		exs: "elixir",
	}

	// Pre-flight availability check for all required languages
	const requiredLanguages = Array.from(extensionsToLoad)
		.map((ext) => extensionToLanguage[ext] || ext)
		.filter(Boolean)
	logger.debug(
		`Performing pre-flight availability check for ${requiredLanguages.length} languages: ${requiredLanguages.join(", ")}`,
		"LanguageParser",
	)

	const availabilityResults = await checkMultipleParserAvailability(
		requiredLanguages,
		undefined,
		metricsCollector,
		10,
	)
	const availabilityArray = Array.from(availabilityResults.entries()).map(([language, status]) => ({
		language,
		...status,
	}))
	const availableLanguages = availabilityArray.filter((result) => result.available).map((result) => result.language)
	const unavailableLanguages = availabilityArray.filter((result) => !result.available)

	logger.info(
		`Parser availability check: ${availableLanguages.length}/${requiredLanguages.length} available`,
		"LanguageParser",
	)

	if (unavailableLanguages.length > 0) {
		logger.warn(`Unavailable parsers: ${unavailableLanguages.map((u) => u.language).join(", ")}`, "LanguageParser")
		unavailableLanguages.forEach((unavailable) => {
			logger.debug(`  ${unavailable.language}: ${unavailable.error || "Unknown error"}`, "LanguageParser")
		})
	}

	// If strict mode enabled and critical parsers unavailable, throw early with detailed error
	if (getStrictWasmLoading() && unavailableLanguages.length > 0) {
		const criticalLanguages = ["javascript", "typescript", "python", "rust", "go", "cpp", "c"]
		const missingCritical = unavailableLanguages.filter((u) => criticalLanguages.includes(u.language))

		if (missingCritical.length > 0) {
			throw new Error(`Strict mode enabled. Critical parsers unavailable: ${missingCritical.map((u) => u.language).join(", ")}.
Missing files: ${missingCritical.map((u) => u.error || "Unknown error").join("; ")}.
See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
		}
	}

	// Initialize Parser once with validation and improved error handling
	let wasmDirectory: string
	try {
		wasmDirectory = await getWasmDirectoryWithRetry({ allowFallback: true, strictMode: getStrictWasmLoading() })
	} catch (error) {
		logger.debug(
			`Failed to locate WASM directory: ${error instanceof Error ? error.message : String(error)}`,
			"LanguageParser",
		)
		throw new Error(`Cannot locate tree-sitter WASM files. See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
	}

	// Validate WASM directory before Parser.init()
	const validationResult = validateWasmDirectory(wasmDirectory)
	if (!validationResult.isValid) {
		const errorMsg = `WASM directory validation failed. Missing critical files: ${validationResult.missingCriticalFiles.join(", ")}`
		if (getStrictWasmLoading()) {
			throw new Error(`Strict mode enabled. ${errorMsg}. See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
		} else {
			logger.warn(`${errorMsg}. Continuing in non-strict mode.`, "LanguageParser")
		}
	}

	await Parser.init({
		locateFile: (scriptName: string, _scriptDirectory: string) => {
			const fullPath = path.join(wasmDirectory, scriptName)
			logger.debug(`Tree-sitter requesting file: ${scriptName}, full path: ${fullPath}`, "LanguageParser")

			// Check if the file exists and log a warning if it doesn't
			const fs = require("fs")
			if (!fs.existsSync(fullPath)) {
				logger.warn(`Tree-sitter requested file that doesn't exist: ${fullPath}`, "LanguageParser")
			}

			return fullPath
		},
	})

	// Load language parsers based on file extensions
	for (const ext of Array.from(extensionsToLoad)) {
		const parserKey = extensionToLanguage[ext] || ext

		// Skip if already loaded
		if (languageParserMap[parserKey]) {
			parsers[parserKey] = languageParserMap[parserKey]
			continue
		}

		// Skip loading for parsers marked as unavailable in cache
		const cachedStatus = parserAvailabilityCache.getCachedStatus(parserKey)
		if (cachedStatus && !cachedStatus.isAvailable) {
			logger.debug(
				`Skipping ${parserKey} - marked as unavailable in cache: ${cachedStatus.error || "Unknown error"}`,
				"LanguageParser",
			)
			continue
		}

		try {
			const language = await loadLanguage(parserKey, sourceDirectory, metricsCollector)
			if (!language) {
				if (getStrictWasmLoading()) {
					throw new Error(`Failed to load language: ${parserKey}`)
				} else {
					logger.warn(`Failed to load language: ${parserKey}`, "LanguageParser")
					continue
				}
			}

			const parser = new Parser()
			parser.setLanguage(language)

			// Create query for each language - first try comprehensive query, then fallback to hardcoded
			let query
			let querySource: "comprehensive" | "hardcoded" | "fallback" | "none" = "unknown" as any
			let queryPatternCount = 0
			let captureNames: string[] = []

			try {
				// First, try to get comprehensive query
				const comprehensiveQuery = getComprehensiveQuery(parserKey)
				if (comprehensiveQuery) {
					try {
						query = language.query(comprehensiveQuery)
						querySource = "comprehensive"
						queryPatternCount = query.patterns.length
						captureNames = query.captureNames || []

						logger.debug(
							`Created comprehensive query for ${parserKey} (${ext}) with ${queryPatternCount} patterns and ${captureNames.length} captures: [${captureNames.join(", ")}]`,
							"LanguageParser",
						)

						// Record metrics for comprehensive query usage
						if (metricsCollector) {
							metricsCollector.recordParserMetric(parserKey, "loadSuccess", 1)
							metricsCollector.recordParserMetric(parserKey, "querySource_comprehensive", 1)
						}

						// Capture telemetry for comprehensive query usage
						try {
							TelemetryService.instance.captureEvent(TelemetryEventName.WASM_PARSE_SUCCESS, {
								language: parserKey,
								querySource: "comprehensive",
								patternCount: queryPatternCount,
								captureCount: captureNames.length,
							})
						} catch (e) {
							logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
						}
					} catch (comprehensiveError) {
						logger.warn(
							`Failed to create comprehensive query for ${parserKey}, falling back to hardcoded: ${comprehensiveError instanceof Error ? comprehensiveError.message : String(comprehensiveError)}`,
							"LanguageParser",
						)
						query = null
					}
				}

				// If comprehensive query failed or doesn't exist, use hardcoded queries
				if (!query) {
					querySource = "hardcoded"
					switch (ext) {
						case "json":
							query = language.query("(object (_) @pair)")
							queryPatternCount = 1
							captureNames = ["pair"]
							break
						case "ts":
						case "tsx":
							query = language.query(`
								(function_declaration name: (identifier) @function-name)
								(class_declaration name: (identifier) @class-name)
								(interface_declaration name: (identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "interface-name"]
							break
						case "py":
							query = language.query(`
								(function_definition name: (identifier) @function-name)
								(class_definition name: (identifier) @class-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "class-name"]
							break
						case "rs":
							query = language.query(`
								(function_item name: (identifier) @function-name)
								(struct_item name: (type_identifier) @struct-name)
								(enum_item name: (type_identifier) @enum-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "struct-name", "enum-name"]
							break
						case "go":
							query = language.query(`
								(function_declaration name: (identifier) @function-name)
								(struct_type name: (type_identifier) @struct-name)
								(interface_type name: (type_identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "struct-name", "interface-name"]
							break
						case "cpp":
						case "hpp":
							query = language.query(`
								(function_definition name: (identifier) @function-name)
								(class_specifier name: (type_identifier) @class-name)
								(struct_specifier name: (type_identifier) @struct-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "struct-name"]
							break
						case "c":
						case "h":
							query = language.query(`
								(function_definition name: (identifier) @function-name)
								(struct_specifier name: (type_identifier) @struct-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "struct-name"]
							break
						case "cs":
							query = language.query(`
								(method_declaration name: (identifier) @method-name)
								(class_declaration name: (identifier) @class-name)
								(interface_declaration name: (identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["method-name", "class-name", "interface-name"]
							break
						case "rb":
							query = language.query(`
								(method name: (identifier) @method-name)
								(class name: (constant) @class-name)
								(module name: (constant) @module-name)
							`)
							queryPatternCount = 3
							captureNames = ["method-name", "class-name", "module-name"]
							break
						case "java":
							query = language.query(`
								(method_declaration name: (identifier) @method-name)
								(class_declaration name: (identifier) @class-name)
								(interface_declaration name: (identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["method-name", "class-name", "interface-name"]
							break
						case "php":
							query = language.query(`
								(function_definition name: (name) @function-name)
								(class_declaration name: (name) @class-name)
								(interface_declaration name: (name) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "interface-name"]
							break
						case "swift":
							query = language.query(`
								(function_declaration name: (identifier) @function-name)
								(class_declaration name: (identifier) @class-name)
								(protocol_declaration name: (identifier) @protocol-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "protocol-name"]
							break
						case "kt":
						case "kts":
							query = language.query(`
								(function_declaration name: (simple_identifier) @function-name)
								(class_declaration name: (simple_identifier) @class-name)
								(interface_declaration name: (simple_identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "interface-name"]
							break
						case "css":
							query = language.query(`
								(rule_set selector: (selectors) @selector)
								(at_rule) @at-rule
							`)
							queryPatternCount = 2
							captureNames = ["selector", "at-rule"]
							break
						case "html":
							query = language.query(`
								(element) @element
								(attribute) @attribute
							`)
							queryPatternCount = 2
							captureNames = ["element", "attribute"]
							break
						case "ml":
						case "mli":
							query = language.query(`
								(value_definition name: (lower_case_identifier) @function-name)
								(type_definition name: (type_constructor) @type-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "type-name"]
							break
						case "scala":
							query = language.query(`
								(function_definition name: (identifier) @function-name)
								(class_definition name: (identifier) @class-name)
								(trait_definition name: (identifier) @trait-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "class-name", "trait-name"]
							break
						case "sol":
							query = language.query(`
								(function_definition name: (identifier) @function-name)
								(contract_definition name: (identifier) @contract-name)
								(interface_definition name: (identifier) @interface-name)
							`)
							queryPatternCount = 3
							captureNames = ["function-name", "contract-name", "interface-name"]
							break
						case "toml":
							query = language.query(`
								(pair key: (bare_key) @key)
								(table (bare_key) @table-name)
							`)
							queryPatternCount = 2
							captureNames = ["key", "table-name"]
							break
						case "yaml":
						case "yml":
							query = language.query(`
								(block_mapping_pair key: (flow_node) @key)
								(block_node (block_mapping) @mapping)
							`)
							queryPatternCount = 2
							captureNames = ["key", "mapping"]
							break
						case "vue":
							query = language.query(`
								(element) @element
								(start_tag (tag_name) @tag-name)
							`)
							queryPatternCount = 2
							captureNames = ["element", "tag-name"]
							break
						case "lua":
							query = language.query(`
								(function_declaration name: (identifier) @function-name)
								(local_variable_declaration (variable_list (identifier) @variable-name))
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "variable-name"]
							break
						case "rdl":
							query = language.query(`
								(signal_declaration name: (identifier) @signal-name)
								(property_declaration name: (identifier) @property-name)
							`)
							queryPatternCount = 2
							captureNames = ["signal-name", "property-name"]
							break
						case "tla":
							query = language.query(`
								(definition name: (identifier) @definition-name)
								(module_definition name: (identifier) @module-name)
							`)
							queryPatternCount = 2
							captureNames = ["definition-name", "module-name"]
							break
						case "zig":
							query = language.query(`
								(fn_proto name: (identifier) @function-name)
								(struct_decl name: (identifier) @struct-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "struct-name"]
							break
						case "erb":
							query = language.query(`
								(erb_directive) @directive
								(erb_statement) @statement
								(erb_expression) @expression
							`)
							queryPatternCount = 3
							captureNames = ["directive", "statement", "expression"]
							break
						case "el":
							query = language.query(`
								(defun name: (symbol) @function-name)
								(defvar name: (symbol) @variable-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "variable-name"]
							break
						case "exs":
							query = language.query(`
								(function name: (identifier) @function-name)
								(defmodule name: (alias) @module-name)
							`)
							queryPatternCount = 2
							captureNames = ["function-name", "module-name"]
							break
						default:
							// Create a generic query for unknown languages
							query = language.query(`
								(identifier) @identifier
								(string_literal) @string
								(comment) @comment
							`)
							queryPatternCount = 3
							captureNames = ["identifier", "string", "comment"]
					}

					logger.debug(
						`Created hardcoded query for ${parserKey} (${ext}) with ${queryPatternCount} patterns and ${captureNames.length} captures: [${captureNames.join(", ")}]`,
						"LanguageParser",
					)

					// Record metrics for hardcoded query usage
					if (metricsCollector) {
						metricsCollector.recordParserMetric(parserKey, "loadSuccess", 1)
						metricsCollector.recordParserMetric(parserKey, "querySource_hardcoded", 1)
					}

					// Capture telemetry for hardcoded query usage
					try {
						TelemetryService.instance.captureEvent(TelemetryEventName.WASM_PARSE_SUCCESS, {
							language: parserKey,
							querySource: "hardcoded",
							patternCount: queryPatternCount,
							captureCount: captureNames.length,
						})
					} catch (e) {
						logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
					}
				}
			} catch (queryError) {
				logger.warn(
					`Failed to create query for ${parserKey}: ${queryError instanceof Error ? queryError.message : String(queryError)}`,
					"LanguageParser",
				)
				// Create a minimal fallback query
				try {
					query = language.query(`(identifier) @identifier`)
					querySource = "fallback"
					queryPatternCount = 1
					captureNames = ["identifier"]

					// Record metrics for fallback query usage
					if (metricsCollector) {
						metricsCollector.recordParserMetric(parserKey, "fallback", 1)
					}
				} catch (fallbackError) {
					logger.warn(
						`Failed to create fallback query for ${parserKey}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
						"LanguageParser",
					)
					// Continue without a query
					query = null
					querySource = "none"
					queryPatternCount = 0
					captureNames = []
				}
			}

			parser.setLanguage(language)
			// Create a single LanguageParser object with all properties
			const languageParser: LanguageParser = { parser, query, language, querySource, queryPatternCount }
			// Assign the same object to both collections to ensure consistency
			parsers[parserKey] = languageParser
			languageParserMap[parserKey] = languageParser

			// Test the parser on a simple snippet to ensure it works
			if (query && query !== null) {
				try {
					// Record parse attempt metric
					if (metricsCollector) {
						metricsCollector.recordParserMetric(parserKey, "parseAttempt")
					}

					// Capture telemetry for parse attempt
					try {
						TelemetryService.instance.captureWasmParseAttempt(parserKey)
					} catch (e) {
						logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
					}

					const testCode = getTestCodeForLanguage(parserKey)
					if (testCode) {
						const testTree = parser.parse(testCode)
						let captures = []
						if (query) {
							captures = query.captures(testTree.rootNode)

							// Record captures metric
							if (metricsCollector) {
								metricsCollector.recordParserMetric(parserKey, "captures", captures.length)
							}
						}

						// Record parse success metric
						if (metricsCollector) {
							metricsCollector.recordParserMetric(parserKey, "parseSuccess")
						}

						// Capture telemetry for parse success with query source information
						try {
							TelemetryService.instance.captureEvent(TelemetryEventName.WASM_PARSE_SUCCESS, {
								language: parserKey,
								querySource: querySource,
								patternCount: queryPatternCount,
								captureCount: captureNames.length,
								testCaptures: captures.length,
							})
						} catch (e) {
							logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
						}

						// Enhanced logging with query source information
						logger.debug(
							`Parser test successful for ${parserKey} - Query source: ${querySource}, Patterns: ${queryPatternCount}, Captures: ${captureNames.length}, Test captures: ${captures.length}`,
							"LanguageParser",
						)

						// Warning for zero captures with comprehensive query
						if (querySource === "comprehensive" && captures.length === 0) {
							logger.warn(
								`Comprehensive query for ${parserKey} produced zero captures on test code. This may indicate an issue with the query or test code.`,
								"LanguageParser",
							)
						}

						// Log capture names for debugging
						if (captureNames.length > 0) {
							logger.debug(
								`Query capture names for ${parserKey}: [${captureNames.join(", ")}]`,
								"LanguageParser",
							)
						}
					}
				} catch (testError) {
					const errorMessage = testError instanceof Error ? testError.message : String(testError)
					logger.warn(
						`Parser test failed for ${parserKey} (Query source: ${querySource}), but continuing: ${errorMessage}`,
						"LanguageParser",
					)

					// Record parse failure metric
					if (metricsCollector) {
						metricsCollector.recordParserMetric(parserKey, "parseFailed", 1, errorMessage)
					}

					// Capture telemetry for parse failure with query source information
					try {
						TelemetryService.instance.captureEvent(TelemetryEventName.WASM_PARSE_FAILURE, {
							language: parserKey,
							querySource: querySource,
							error: errorMessage,
						})
					} catch (e) {
						logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
					}
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load parser for ${parserKey}: ${errorMessage}`, "LanguageParser")

			// Classify error type for better handling
			const isTransientError =
				errorMessage.includes("ENOENT") ||
				errorMessage.includes("EACCES") ||
				errorMessage.includes("ETIMEDOUT") ||
				errorMessage.includes("timeout") ||
				errorMessage.includes("network")

			const isPermanentError =
				errorMessage.includes("HTTP 404") ||
				errorMessage.includes("HTTP 403") ||
				errorMessage.includes("Invalid WASM format") ||
				errorMessage.includes("WASM validation failed") ||
				errorMessage.includes("Syntax error") ||
				errorMessage.includes("Unsupported WASM")

			// Update availability cache with failure status
			parserAvailabilityCache.invalidate(parserKey)

			// Provide specific recovery suggestions based on error type
			if (isTransientError) {
				logger.warn(
					`Transient error loading ${parserKey}: ${errorMessage}. Suggestion: Retry indexing operation later.`,
					"LanguageParser",
				)
			} else if (isPermanentError) {
				logger.warn(
					`Permanent error loading ${parserKey}: ${errorMessage}. Suggestion: Run 'Roo-Cline: Download Tree-sitter WASM Files' command.`,
					"LanguageParser",
				)
			} else {
				logger.warn(
					`Unknown error loading ${parserKey}: ${errorMessage}. Suggestion: Check file permissions and disk space.`,
					"LanguageParser",
				)
			}

			if (getStrictWasmLoading()) {
				throw error
			}
			// Continue to the next extension instead of throwing
			continue
		}
	}

	// Log loaded parsers for debugging
	const loadedParserKeys = Object.keys(parsers)
	logger.info(`Loaded ${loadedParserKeys.length} parsers: ${loadedParserKeys.join(", ")}`, "LanguageParser")

	// Recovery attempt: if no parsers loaded and WASM directory validation failed, suggest diagnostics
	if (Object.keys(parsers).length === 0 && filesToParse.length > 0) {
		logger.warn("No parsers loaded, attempting recovery diagnostics...", "LanguageParser")

		try {
			// Run comprehensive diagnostics
			const diagnosticReport = diagnoseWasmSetup()
			const formattedReport = formatDiagnosticReport(diagnosticReport)

			logger.error("=== WASM Setup Diagnostic Report ===", "LanguageParser")
			logger.error(formattedReport, "LanguageParser")
			logger.error("=== End Diagnostic Report ===", "LanguageParser")

			// Provide specific recovery commands based on diagnostic results
			if (!diagnosticReport.wasmDirectoryExists) {
				logger.error(
					"RECOVERY: WASM directory not found. Run 'Roo-Cline: Download Tree-sitter WASM Files' command.",
					"LanguageParser",
				)
			} else if (diagnosticReport.missingCriticalFiles.length > 0) {
				logger.error(
					`RECOVERY: Missing critical files: ${diagnosticReport.missingCriticalFiles.join(", ")}. Run 'Roo-Cline: Download Tree-sitter WASM Files' command.`,
					"LanguageParser",
				)
			} else if (!diagnosticReport.webTreeSitterVersion) {
				logger.error(
					"RECOVERY: web-tree-sitter package not found. Run 'pnpm install' to install dependencies.",
					"LanguageParser",
				)
			} else {
				logger.error(
					"RECOVERY: Unknown issue. Check logs above and see troubleshooting guide.",
					"LanguageParser",
				)
			}

			logger.error(
				`RECOVERY: After fixing issues, retry the indexing operation. See: ${TROUBLESHOOTING_URL}`,
				"LanguageParser",
			)
		} catch (diagnosticError) {
			logger.error(
				`Failed to run recovery diagnostics: ${diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)}`,
				"LanguageParser",
			)
		}
	}

	// Final strict-mode check: ensure at least one parser was loaded when we had input files to process
	if (getStrictWasmLoading() && filesToParse.length > 0 && Object.keys(parsers).length === 0) {
		const diagnosticReport = diagnoseWasmSetup()
		throw new Error(`
No language parsers loaded in strict mode.
WASM Dir: ${diagnosticReport.wasmDirectory}
Diagnostics: ${JSON.stringify(diagnosticReport, null, 2)}
See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
	}

	return parsers
}

function getTestCodeForLanguage(parserKey: string): string {
	const testCases: { [key: string]: string } = {
		javascript: "function test() { return true; }",
		typescript: "function test(): boolean { return true; }",
		python: "def test():\n    return True",
		rust: "fn test() -> bool { true }",
		go: "func test() bool { return true }",
		cpp: "bool test() { return true; }",
		c: "bool test() { return true; }",
		c_sharp: "bool Test() { return true; }",
		ruby: "def test\n  true\nend",
		java: "boolean test() { return true; }",
		php: "function test() { return true; }",
		swift: "func test() -> Bool { return true }",
		kotlin: "fun test(): Boolean = true",
		css: ".test { color: red; }",
		html: '<div class="test">Test</div>',
		ocaml: "let test = true",
		scala: "def test: Boolean = true",
		solidity: "function test() public pure returns (bool) { return true; }",
		toml: '[test]\nkey = "value"',
		yaml: "test: true",
		lua: "function test() return true end",
		el: "(defun test () t)",
		elixir: "def test, do: true end",
	}

	return testCases[parserKey] || ""
}

/**
 * Returns a list of all languages that have parsers available
 * @returns Array of language names with available parsers
 */
export function getAvailableParsers(): string[] {
	return Object.keys(languageParserMap)
}

/**
 * Returns the current load status of all parsers
 * @returns Map of language names to load status and error information
 */
export function getParserLoadStatus(): Map<string, { loaded: boolean; error?: string }> {
	const status = new Map<string, { loaded: boolean; error?: string }>()

	// Get all supported language extensions
	const supportedExtensions = [
		"js",
		"jsx",
		"json",
		"ts",
		"tsx",
		"py",
		"rs",
		"go",
		"cpp",
		"hpp",
		"c",
		"h",
		"cs",
		"rb",
		"java",
		"php",
		"swift",
		"kt",
		"kts",
		"css",
		"html",
		"ml",
		"mli",
		"scala",
		"sol",
		"toml",
		"yaml",
		"yml",
		"vue",
		"lua",
		"rdl",
		"tla",
		"zig",
		"ejs",
		"erb",
		"el",
		"ex",
		"exs",
	]

	supportedExtensions.forEach((ext) => {
		const isLoaded = Object.prototype.hasOwnProperty.call(languageParserMap, ext)
		status.set(ext, { loaded: isLoaded })
	})

	// Handle special case for embedded_template
	status.set("embedded_template", {
		loaded: Object.prototype.hasOwnProperty.call(languageParserMap, "embedded_template"),
	})

	return status
}

/**
 * Reload a specific parser by invalidating cache and attempting to load again
 * @param language Name of the language parser to reload
 * @param sourceDirectory Optional source directory for WASM files
 * @param metricsCollector Optional metrics collector
 * @returns Promise resolving to success/failure status
 */
export async function reloadParser(
	language: string,
	sourceDirectory?: string,
	metricsCollector?: MetricsCollector,
): Promise<{ success: boolean; error?: string }> {
	try {
		logger.info(`Reloading parser: ${language}`, "LanguageParser")

		// Invalidate cache for this language
		parserAvailabilityCache.invalidate(language)

		// Remove from language parser map if it exists
		if (languageParserMap[language]) {
			delete languageParserMap[language]
			logger.debug(`Removed ${language} from language parser map`, "LanguageParser")
		}

		// Attempt to reload parser with retry logic
		const reloadedLanguage = await loadLanguage(language, sourceDirectory, metricsCollector)

		if (reloadedLanguage) {
			logger.info(`Successfully reloaded parser: ${language}`, "LanguageParser")
			return { success: true }
		} else {
			const error = `Failed to reload parser: ${language}`
			logger.error(error, "LanguageParser")
			return { success: false, error }
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error(`Error reloading parser ${language}: ${errorMessage}`, "LanguageParser")
		return { success: false, error: errorMessage }
	}
}

/**
 * Validate availability of all supported parsers and return health report
 * @returns Promise resolving to health report with available/unavailable counts
 */
export async function validateAllParsers(): Promise<{
	total: number
	available: number
	unavailable: number
	languages: Array<{ language: string; isAvailable: boolean; error?: string }>
}> {
	try {
		logger.info("Validating all parsers...", "LanguageParser")

		// Get all supported language names from extension mapping
		const supportedLanguages = Object.values({
			js: "javascript",
			jsx: "javascript",
			json: "javascript",
			ts: "typescript",
			tsx: "tsx",
			py: "python",
			rs: "rust",
			go: "go",
			cpp: "cpp",
			hpp: "cpp",
			c: "c",
			h: "c",
			cs: "c_sharp",
			rb: "ruby",
			java: "java",
			php: "php",
			swift: "swift",
			kt: "kotlin",
			kts: "kotlin",
			css: "css",
			html: "html",
			ml: "ocaml",
			mli: "ocaml",
			scala: "scala",
			sol: "solidity",
			toml: "toml",
			yaml: "yaml",
			yml: "yaml",
			vue: "vue",
			lua: "lua",
			rdl: "systemrdl",
			tla: "tlaplus",
			zig: "zig",
			ejs: "ejs",
			erb: "erb",
			el: "elisp",
			ex: "elixir",
			exs: "elixir",
		}).filter((lang, index, arr) => arr.indexOf(lang) === index) // Remove duplicates

		// Check availability for all languages
		const availabilityResults = await checkMultipleParserAvailability(supportedLanguages)
		const availabilityArray = Array.from(availabilityResults.entries()).map(([language, status]) => ({
			language,
			...status,
		}))

		const available = availabilityArray.filter((result) => result.available)
		const unavailable = availabilityArray.filter((result) => !result.available)

		// Log detailed report
		logger.info(
			`Parser validation complete: ${available.length}/${supportedLanguages.length} available`,
			"LanguageParser",
		)

		if (unavailable.length > 0) {
			logger.warn(`Unavailable parsers: ${unavailable.map((u) => u.language).join(", ")}`, "LanguageParser")
			unavailable.forEach((u) => {
				logger.debug(`  ${u.language}: ${u.error || "Unknown error"}`, "LanguageParser")
			})
		}

		return {
			total: supportedLanguages.length,
			available: available.length,
			unavailable: unavailable.length,
			languages: availabilityArray
				.map(({ language, available, error }) => ({
					language,
					isAvailable: available,
					error,
				}))
				.sort((a, b) => a.language.localeCompare(b.language)),
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error(`Error validating parsers: ${errorMessage}`, "LanguageParser")

		// Return error state
		return {
			total: 0,
			available: 0,
			unavailable: 0,
			languages: [
				{
					language: "error",
					isAvailable: false,
					error: errorMessage,
				},
			],
		}
	}
}
