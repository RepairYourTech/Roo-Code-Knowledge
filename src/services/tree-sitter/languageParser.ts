import * as path from "path"
import * as vscode from "vscode"
import { getWasmDirectory, invalidateWasmDirectoryCache } from "./get-wasm-directory"
import { diagnoseWasmSetup, validateWasmDirectory, DiagnosticReport } from "./wasm-diagnostics"
import { logger } from "../shared/logger"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { MetricsCollector } from "../code-index/utils/metrics-collector"

const TROUBLESHOOTING_URL = "https://github.com/RooCline/Roo-Cline/blob/main/docs/TROUBLESHOOTING.md#wasm-files"

export interface LanguageParser {
	parser: any
	query: any
	language: any
}

// Type for indexed collection of language parsers
export interface LanguageParsers {
	[key: string]: LanguageParser
}

let hasRunDiagnostics = false
let languageParserMap: { [key: string]: LanguageParser } = {}

function getStrictWasmLoading(): boolean {
	const config = vscode.workspace.getConfiguration("roo-code")
	return config.get("treeSitterStrictWasmLoading", false)
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
			wasmDirectory = getWasmDirectory()
		} catch (error) {
			logger.debug(
				`Failed to locate WASM directory: ${error instanceof Error ? error.message : String(error)}`,
				"LanguageParser",
			)
			throw new Error(`Cannot locate tree-sitter WASM files. See troubleshooting guide: ${TROUBLESHOOTING_URL}`)
		}
		const { Parser } = require("web-tree-sitter")

		logger.debug(`Attempting to load language: ${langName}`, "LanguageParser")

		// For development or when sourceDirectory is provided, try to load from local path
		if (process.env.NODE_ENV === "development" || sourceDirectory) {
			const localPath = sourceDirectory || wasmDirectory
			const languagePath = path.join(localPath, `${langName}.wasm`)

			try {
				const language = await Parser.Language.load(languagePath)
				logger.debug(`Successfully loaded ${langName}.wasm from ${languagePath}`, "LanguageParser")

				// Record success metrics
				if (metricsCollector) {
					metricsCollector.recordParserMetric(langName, "loadSuccess")
				}

				// Capture telemetry for success
				try {
					TelemetryService.instance.captureWasmLoadSuccess(langName, languagePath, Date.now() - startTime)
				} catch (e) {
					logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
				}

				return language
			} catch (error) {
				// Fall back to node_modules if local loading fails
				logger.warn(
					`Failed to load ${langName}.wasm from ${languagePath}, falling back to node_modules: ${error instanceof Error ? error.message : String(error)}`,
					"LanguageParser",
				)

				// Record fallback metric
				if (metricsCollector) {
					metricsCollector.recordParserMetric(langName, "fallback")
				}
			}
		}

		// Try loading from node_modules
		try {
			const packagePath = require.resolve(
				`@tree-sitter-grammars/tree-sitter-${langName}/tree-sitter-${langName}.wasm`,
			)
			const language = await Parser.Language.load(packagePath)
			logger.debug(`Successfully loaded ${langName}.wasm from node_modules`, "LanguageParser")

			// Record success metrics
			if (metricsCollector) {
				metricsCollector.recordParserMetric(langName, "loadSuccess")
			}

			// Capture telemetry for success
			try {
				TelemetryService.instance.captureWasmLoadSuccess(langName, packagePath, Date.now() - startTime)
			} catch (e) {
				logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
			}

			return language
		} catch (error) {
			// Try alternative package name
			logger.debug(`Trying alternative package name for ${langName}`, "LanguageParser")
			const altPackagePath = require.resolve(`tree-sitter-${langName}/tree-sitter-${langName}.wasm`)
			const language = await Parser.Language.load(altPackagePath)
			logger.debug(`Successfully loaded ${langName}.wasm from alternative package`, "LanguageParser")

			// Record success metrics
			if (metricsCollector) {
				metricsCollector.recordParserMetric(langName, "loadSuccess")
			}

			// Capture telemetry for success
			try {
				TelemetryService.instance.captureWasmLoadSuccess(langName, altPackagePath, Date.now() - startTime)
			} catch (e) {
				logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
			}

			return language
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.error(`Failed to load language ${langName}: ${errorMessage}`, "LanguageParser")

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
			wasmDirectory = getWasmDirectory()
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

	// Initialize Parser once with validation and improved error handling
	let wasmDirectory: string
	try {
		wasmDirectory = getWasmDirectory()
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

			// Create basic query for each language
			let query
			try {
				switch (ext) {
					case "json":
						query = language.query("(object (_) @pair)")
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "ts":
					case "tsx":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(class_declaration name: (identifier) @class-name)
							(interface_declaration name: (identifier) @interface-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "py":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(class_definition name: (identifier) @class-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "rs":
						query = language.query(`
							(function_item name: (identifier) @function-name)
							(struct_item name: (type_identifier) @struct-name)
							(enum_item name: (type_identifier) @enum-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "go":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(struct_type name: (type_identifier) @struct-name)
							(interface_type name: (type_identifier) @interface-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "cpp":
					case "hpp":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(class_specifier name: (type_identifier) @class-name)
							(struct_specifier name: (type_identifier) @struct-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "c":
					case "h":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(struct_specifier name: (type_identifier) @struct-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "cs":
						query = language.query(`
							(method_declaration name: (identifier) @method-name)
							(class_declaration name: (identifier) @class-name)
							(interface_declaration name: (identifier) @interface-name)
						`)
						logger.debug(`Created query for ${parserKey} (${ext})`, "LanguageParser")
						break
					case "rb":
						query = language.query(`
							(method name: (identifier) @method-name)
							(class name: (constant) @class-name)
							(module name: (constant) @module-name)
						`)
						break
					case "java":
						query = language.query(`
							(method_declaration name: (identifier) @method-name)
							(class_declaration name: (identifier) @class-name)
							(interface_declaration name: (identifier) @interface-name)
						`)
						break
					case "php":
						query = language.query(`
							(function_definition name: (name) @function-name)
							(class_declaration name: (name) @class-name)
							(interface_declaration name: (name) @interface-name)
						`)
						break
					case "swift":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(class_declaration name: (identifier) @class-name)
							(protocol_declaration name: (identifier) @protocol-name)
						`)
						break
					case "kt":
					case "kts":
						query = language.query(`
							(function_declaration name: (simple_identifier) @function-name)
							(class_declaration name: (simple_identifier) @class-name)
							(interface_declaration name: (simple_identifier) @interface-name)
						`)
						break
					case "css":
						query = language.query(`
							(rule_set selector: (selectors) @selector)
							(at_rule) @at-rule
						`)
						break
					case "html":
						query = language.query(`
							(element) @element
							(attribute) @attribute
						`)
						break
					case "ml":
					case "mli":
						query = language.query(`
							(value_definition name: (lower_case_identifier) @function-name)
							(type_definition name: (type_constructor) @type-name)
						`)
						break
					case "scala":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(class_definition name: (identifier) @class-name)
							(trait_definition name: (identifier) @trait-name)
						`)
						break
					case "sol":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(contract_definition name: (identifier) @contract-name)
							(interface_definition name: (identifier) @interface-name)
						`)
						break
					case "toml":
						query = language.query(`
							(pair key: (bare_key) @key)
							(table (bare_key) @table-name)
						`)
						break
					case "yaml":
					case "yml":
						query = language.query(`
							(block_mapping_pair key: (flow_node) @key)
							(block_node (block_mapping) @mapping)
						`)
						break
					case "vue":
						query = language.query(`
							(element) @element
							(start_tag (tag_name) @tag-name)
						`)
						break
					case "lua":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(local_variable_declaration (variable_list (identifier) @variable-name))
						`)
						break
					case "rdl":
						query = language.query(`
							(signal_declaration name: (identifier) @signal-name)
							(property_declaration name: (identifier) @property-name)
						`)
						break
					case "tla":
						query = language.query(`
							(definition name: (identifier) @definition-name)
							(module_definition name: (identifier) @module-name)
						`)
						break
					case "zig":
						query = language.query(`
							(fn_proto name: (identifier) @function-name)
							(struct_decl name: (identifier) @struct-name)
						`)
						break
					case "erb":
						query = language.query(`
							(erb_directive) @directive
							(erb_statement) @statement
							(erb_expression) @expression
						`)
						break
					case "el":
						query = language.query(`
							(defun name: (symbol) @function-name)
							(defvar name: (symbol) @variable-name)
						`)
						break
					case "exs":
						query = language.query(`
							(function name: (identifier) @function-name)
							(defmodule name: (alias) @module-name)
						`)
						break
					default:
						// Create a generic query for unknown languages
						query = language.query(`
							(identifier) @identifier
							(string_literal) @string
							(comment) @comment
						`)
				}
			} catch (queryError) {
				logger.warn(
					`Failed to create query for ${parserKey}: ${queryError instanceof Error ? queryError.message : String(queryError)}`,
					"LanguageParser",
				)
				// Create a minimal fallback query
				try {
					query = language.query(`(identifier) @identifier`)
				} catch (fallbackError) {
					logger.warn(
						`Failed to create fallback query for ${parserKey}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
						"LanguageParser",
					)
					// Continue without a query
					query = null
				}
			}

			parser.setLanguage(language)
			parsers[parserKey] = { parser, query, language }
			languageParserMap[parserKey] = { parser, query, language }

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

						// Capture telemetry for parse success
						try {
							TelemetryService.instance.captureWasmParseSuccess(parserKey, captures.length)
						} catch (e) {
							logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
						}

						logger.debug(
							`Parser test successful for ${parserKey} with ${captures.length} captures`,
							"LanguageParser",
						)
						// If there are no captures, it might be fine depending on the test code
					}
				} catch (testError) {
					const errorMessage = testError instanceof Error ? testError.message : String(testError)
					logger.warn(
						`Parser test failed for ${parserKey}, but continuing: ${errorMessage}`,
						"LanguageParser",
					)

					// Record parse failure metric
					if (metricsCollector) {
						metricsCollector.recordParserMetric(parserKey, "parseFailed", 1, errorMessage)
					}

					// Capture telemetry for parse failure
					try {
						TelemetryService.instance.captureWasmParseFailure(parserKey, errorMessage)
					} catch (e) {
						logger.debug(`Telemetry capture failed: ${e}`, "LanguageParser")
					}
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			logger.error(`Failed to load parser for ${parserKey}: ${errorMessage}`, "LanguageParser")
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
