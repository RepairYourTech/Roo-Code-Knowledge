import * as path from "path"
import * as fs from "fs"
import { Parser as ParserT, Language as LanguageT, Query as QueryT } from "web-tree-sitter"
import { logger } from "../shared/logger"
import { MetricsCollector } from "../code-index/utils/metrics-collector"
import {
	javascriptQuery,
	typescriptQuery,
	tsxQuery,
	pythonQuery,
	rustQuery,
	goQuery,
	cppQuery,
	cQuery,
	csharpQuery,
	rubyQuery,
	javaQuery,
	phpQuery,
	htmlQuery,
	swiftQuery,
	kotlinQuery,
	cssQuery,
	ocamlQuery,
	solidityQuery,
	tomlQuery,
	xmlQuery,
	yamlQuery,
	vueQuery,
	luaQuery,
	systemrdlQuery,
	tlaPlusQuery,
	zigQuery,
	embeddedTemplateQuery,
	elispQuery,
	elixirQuery,
} from "./queries"

export interface LanguageParser {
	[key: string]: {
		parser: ParserT
		query: QueryT
		language: LanguageT
	}
}

async function loadLanguage(langName: string, sourceDirectory?: string) {
	const baseDir = sourceDirectory || __dirname
	const wasmPath = path.join(baseDir, `tree-sitter-${langName}.wasm`)

	// Check for strict WASM loading mode
	const strictWasmLoading = process.env.ROO_CODE_STRICT_WASM_LOADING === "true"

	// Log the full WASM path before attempting to load
	logger.debug(`Attempting to load language WASM: ${wasmPath}`, "LanguageParser")

	// Check if WASM file exists before attempting to load it
	if (!fs.existsSync(wasmPath)) {
		const errorMessage = `WASM file not found: ${wasmPath}`
		logger.error(errorMessage, "LanguageParser")

		if (strictWasmLoading) {
			throw new Error(errorMessage)
		} else {
			logger.warn(
				`Graceful degradation: Skipping language ${langName} due to missing WASM file`,
				"LanguageParser",
			)
			return null // Return null to indicate language couldn't be loaded
		}
	}

	try {
		const { Language } = require("web-tree-sitter")
		const language = await Language.load(wasmPath)
		logger.debug(`Successfully loaded language: ${langName}`, "LanguageParser")
		return language
	} catch (error) {
		const errorMessage = `Failed to load language ${langName}: ${error instanceof Error ? error.message : error}`
		logger.error(errorMessage, "LanguageParser")

		if (strictWasmLoading) {
			throw new Error(errorMessage)
		} else {
			logger.warn(`Graceful degradation: Skipping language ${langName} due to loading error`, "LanguageParser")
			return null // Return null to indicate language couldn't be loaded
		}
	}
}

let isParserInitialized = false
let hasRunDiagnostics = false
let languageParserMap: LanguageParser = {}

/**
 * Verifies that all required WASM files exist in the specified directory
 * @param sourceDirectory Directory to check for WASM files
 */
function verifyWasmFiles(sourceDirectory?: string): void {
	const baseDir = sourceDirectory || __dirname
	logger.debug(`Verifying WASM files in directory: ${baseDir}`, "LanguageParser")

	try {
		const files = fs.readdirSync(baseDir)
		const wasmFiles = files.filter((file) => file.endsWith(".wasm"))

		if (wasmFiles.length === 0) {
			logger.warn(`No WASM files found in ${baseDir}`, "LanguageParser")
		} else {
			logger.debug(`Found ${wasmFiles.length} WASM files: ${wasmFiles.join(", ")}`, "LanguageParser")
		}
	} catch (error) {
		logger.error(
			`Error reading directory ${baseDir}: ${error instanceof Error ? error.message : error}`,
			"LanguageParser",
		)
	}
}

/**
 * Diagnostic function to check WASM setup and return a report
 * @param sourceDirectory Directory to check for WASM files
 * @returns Diagnostic report with WASM file status
 */
function diagnoseWasmSetup(sourceDirectory?: string) {
	const baseDir = sourceDirectory || __dirname
	const report: {
		wasmDirectory: string
		mainWasmExists: boolean
		languageWasmsFound: string[]
		missingWasms: string[]
	} = {
		wasmDirectory: baseDir,
		mainWasmExists: false,
		languageWasmsFound: [],
		missingWasms: [],
	}

	logger.debug(`Running WASM diagnostics in directory: ${baseDir}`, "LanguageParser")

	try {
		const files = fs.readdirSync(baseDir)
		const allWasmFiles = files.filter((file) => file.endsWith(".wasm"))

		// Check for main tree-sitter.wasm
		report.mainWasmExists = files.includes("tree-sitter.wasm")

		// Find language-specific WASM files
		report.languageWasmsFound = allWasmFiles.filter(
			(file) => file !== "tree-sitter.wasm" && file.startsWith("tree-sitter-"),
		)

		// List all WASM files found
		logger.debug(`All WASM files found: ${allWasmFiles.join(", ")}`, "LanguageParser")
		logger.debug(`Main tree-sitter.wasm exists: ${report.mainWasmExists}`, "LanguageParser")
		logger.debug(`Language WASM files found: ${report.languageWasmsFound.join(", ")}`, "LanguageParser")

		// Check for expected language WASMs that might be missing
		const expectedLanguages = [
			"javascript",
			"typescript",
			"tsx",
			"python",
			"rust",
			"go",
			"cpp",
			"c",
			"c_sharp",
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

		expectedLanguages.forEach((lang) => {
			const expectedFile = `tree-sitter-${lang}.wasm`
			if (!allWasmFiles.includes(expectedFile)) {
				report.missingWasms.push(expectedFile)
			}
		})

		if (report.missingWasms.length > 0) {
			logger.warn(`Missing expected WASM files: ${report.missingWasms.join(", ")}`, "LanguageParser")
		} else {
			logger.debug(`All expected language WASM files are present`, "LanguageParser")
		}
	} catch (error) {
		logger.error(
			`Error during WASM diagnostics: ${error instanceof Error ? error.message : error}`,
			"LanguageParser",
		)
	}

	logger.debug(`WASM diagnostics complete`, "LanguageParser")
	return report
}

/*
Using node bindings for tree-sitter is problematic in vscode extensions
because of incompatibility with electron. Going the .wasm route has the
advantage of not having to build for multiple architectures.

We use web-tree-sitter and tree-sitter-wasms which provides auto-updating
prebuilt WASM binaries for tree-sitter's language parsers.

This function loads WASM modules for relevant language parsers based on input files:
1. Extracts unique file extensions
2. Maps extensions to language names
3. Loads corresponding WASM files (containing grammar rules)
4. Uses WASM modules to initialize tree-sitter parsers

This approach optimizes performance by loading only necessary parsers once for all relevant files.

Sources:
- https://github.com/tree-sitter/node-tree-sitter/issues/169
- https://github.com/tree-sitter/node-tree-sitter/issues/168
- https://github.com/Gregoor/tree-sitter-wasms/blob/main/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md
- https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/test/query-test.js
*/
export async function loadRequiredLanguageParsers(
	filesToParse: string[],
	sourceDirectory?: string,
	metricsCollector?: MetricsCollector,
) {
	const { Parser, Query } = require("web-tree-sitter")

	// Check for strict WASM loading mode (default to false for graceful degradation)
	const strictWasmLoading = process.env.ROO_CODE_STRICT_WASM_LOADING === "true"

	// Run diagnostics once before initializing parsers
	if (!hasRunDiagnostics) {
		const diagnostics = diagnoseWasmSetup(sourceDirectory)

		// If critical WASM files are missing, handle based on strict mode
		if (!diagnostics.mainWasmExists) {
			const errorMessage = `Critical setup error: tree-sitter.wasm not found in ${diagnostics.wasmDirectory}. Please ensure all required WASM files are present.`
			logger.error(errorMessage, "LanguageParser")

			if (strictWasmLoading) {
				// In strict mode, throw an error to fail fast
				throw new Error(errorMessage)
			} else {
				// In non-strict mode, log a warning and return empty parsers for graceful degradation
				logger.warn(
					`Graceful degradation: Operating without tree-sitter parsers due to missing WASM files. Markdown and other non-tree-sitter parsing will continue to work.`,
					"LanguageParser",
				)
				hasRunDiagnostics = true
				return {} // Return empty LanguageParser map
			}
		}

		hasRunDiagnostics = true
	}

	if (!isParserInitialized) {
		try {
			await Parser.init({
				locateFile(scriptName: string, scriptDirectory: string) {
					const baseDir = sourceDirectory || __dirname
					const wasmPath = path.join(baseDir, "tree-sitter.wasm")
					logger.debug(`Locating tree-sitter.wasm at ${wasmPath}`, "LanguageParser")
					return wasmPath
				},
			})
			isParserInitialized = true
			logger.info("Parser initialized successfully - tree-sitter.wasm loaded", "LanguageParser")
		} catch (error) {
			const errorMessage = `Error initializing parser: ${error instanceof Error ? error.message : error}`
			logger.error(errorMessage, "LanguageParser")
			throw new Error(errorMessage)
		}
	}

	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: LanguageParser = {}

	// Log which extensions are being loaded
	logger.info(`Loading parsers for extensions: ${Array.from(extensionsToLoad).join(", ")}`, "LanguageParser")

	for (const ext of extensionsToLoad) {
		let language: LanguageT | null = null
		let query: QueryT | null = null
		let parserKey = ext // Default to using extension as key

		try {
			// Log before attempting to load each language
			logger.debug(`Loading parser for extension: ${ext}`, "LanguageParser")

			// Record parser load attempt if metrics collector is provided
			metricsCollector?.recordParserMetric(ext, "loadAttempt")

			switch (ext) {
				case "js":
				case "jsx":
				case "json":
					language = await loadLanguage("javascript", sourceDirectory)
					if (language) {
						query = new Query(language, javascriptQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(
							ext,
							"loadFailure",
							1,
							"Failed to load javascript language",
						)
					}
					break
				case "ts":
					language = await loadLanguage("typescript", sourceDirectory)
					if (language) {
						query = new Query(language, typescriptQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(
							ext,
							"loadFailure",
							1,
							"Failed to load typescript language",
						)
					}
					break
				case "tsx":
					language = await loadLanguage("tsx", sourceDirectory)
					if (language) {
						query = new Query(language, tsxQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load tsx language")
					}
					break
				case "py":
					language = await loadLanguage("python", sourceDirectory)
					if (language) {
						query = new Query(language, pythonQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load python language")
					}
					break
				case "rs":
					language = await loadLanguage("rust", sourceDirectory)
					if (language) {
						query = new Query(language, rustQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load rust language")
					}
					break
				case "go":
					language = await loadLanguage("go", sourceDirectory)
					if (language) {
						query = new Query(language, goQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load go language")
					}
					break
				case "cpp":
				case "hpp":
					language = await loadLanguage("cpp", sourceDirectory)
					if (language) {
						query = new Query(language, cppQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load cpp language")
					}
					break
				case "c":
				case "h":
					language = await loadLanguage("c", sourceDirectory)
					if (language) {
						query = new Query(language, cQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load c language")
					}
					break
				case "cs":
					language = await loadLanguage("c_sharp", sourceDirectory)
					if (language) {
						query = new Query(language, csharpQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load c_sharp language")
					}
					break
				case "rb":
					language = await loadLanguage("ruby", sourceDirectory)
					if (language) {
						query = new Query(language, rubyQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load ruby language")
					}
					break
				case "java":
					language = await loadLanguage("java", sourceDirectory)
					if (language) {
						query = new Query(language, javaQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load java language")
					}
					break
				case "php":
					language = await loadLanguage("php", sourceDirectory)
					if (language) {
						query = new Query(language, phpQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load php language")
					}
					break
				case "swift":
					language = await loadLanguage("swift", sourceDirectory)
					if (language) {
						query = new Query(language, swiftQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load swift language")
					}
					break
				case "kt":
				case "kts":
					language = await loadLanguage("kotlin", sourceDirectory)
					if (language) {
						query = new Query(language, kotlinQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load kotlin language")
					}
					break
				case "css":
					language = await loadLanguage("css", sourceDirectory)
					if (language) {
						query = new Query(language, cssQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load css language")
					}
					break
				case "html":
					language = await loadLanguage("html", sourceDirectory)
					if (language) {
						query = new Query(language, htmlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load html language")
					}
					break
				case "ml":
				case "mli":
					language = await loadLanguage("ocaml", sourceDirectory)
					if (language) {
						query = new Query(language, ocamlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load ocaml language")
					}
					break
				case "scala":
					language = await loadLanguage("scala", sourceDirectory)
					if (language) {
						query = new Query(language, luaQuery) // Temporarily use Lua query until Scala is implemented
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load scala language")
					}
					break
				case "sol":
					language = await loadLanguage("solidity", sourceDirectory)
					if (language) {
						query = new Query(language, solidityQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load solidity language")
					}
					break
				case "toml":
					language = await loadLanguage("toml", sourceDirectory)
					if (language) {
						query = new Query(language, tomlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load toml language")
					}
					break
				case "xml":
					language = await loadLanguage("xml", sourceDirectory)
					if (language) {
						query = new Query(language, xmlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load xml language")
					}
					break
				case "yaml":
				case "yml":
					language = await loadLanguage("yaml", sourceDirectory)
					if (language) {
						query = new Query(language, yamlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load yaml language")
					}
					break
				case "vue":
					language = await loadLanguage("vue", sourceDirectory)
					if (language) {
						query = new Query(language, vueQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load vue language")
					}
					break
				case "lua":
					language = await loadLanguage("lua", sourceDirectory)
					if (language) {
						query = new Query(language, luaQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load lua language")
					}
					break
				case "rdl":
					language = await loadLanguage("systemrdl", sourceDirectory)
					if (language) {
						query = new Query(language, systemrdlQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load systemrdl language")
					}
					break
				case "tla":
					language = await loadLanguage("tlaplus", sourceDirectory)
					if (language) {
						query = new Query(language, tlaPlusQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load tlaplus language")
					}
					break
				case "zig":
					language = await loadLanguage("zig", sourceDirectory)
					if (language) {
						query = new Query(language, zigQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load zig language")
					}
					break
				case "ejs":
				case "erb":
					parserKey = "embedded_template" // Use same key for both extensions.
					language = await loadLanguage("embedded_template", sourceDirectory)
					if (language) {
						query = new Query(language, embeddedTemplateQuery)
						metricsCollector?.recordParserMetric(parserKey, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(
							parserKey,
							"loadFailure",
							1,
							"Failed to load embedded_template language",
						)
					}
					break
				case "el":
					language = await loadLanguage("elisp", sourceDirectory)
					if (language) {
						query = new Query(language, elispQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load elisp language")
					}
					break
				case "ex":
				case "exs":
					language = await loadLanguage("elixir", sourceDirectory)
					if (language) {
						query = new Query(language, elixirQuery)
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load elixir language")
					}
					break
				default:
					logger.warn(`Unsupported language extension: ${ext}. Skipping parser creation.`, "LanguageParser")
					continue // Skip to the next extension without adding to parsers
			}

			// Skip if language couldn't be loaded (graceful degradation)
			if (!language || !query) {
				logger.warn(
					`Graceful degradation: Skipping parser for extension '${ext}' due to missing language or query`,
					"LanguageParser",
				)
				continue
			}

			const parser = new Parser()
			parser.setLanguage(language)
			parsers[parserKey] = { parser, query, language }
			languageParserMap[parserKey] = { parser, query, language }

			// Log successful parser creation
			logger.debug(`Successfully created parser for: ${parserKey}`, "LanguageParser")
		} catch (error) {
			const errorMessage = `Failed to load parser for extension '${ext}': ${error instanceof Error ? error.message : error}`
			logger.error(errorMessage, "LanguageParser")

			// Record parser load failure if metrics collector is provided
			metricsCollector?.recordParserMetric(ext, "loadFailure", 1, errorMessage)

			// Check for strict WASM loading mode
			const strictWasmLoading = process.env.ROO_CODE_STRICT_WASM_LOADING === "true"
			if (strictWasmLoading) {
				throw new Error(errorMessage)
			} else {
				logger.warn(
					`Graceful degradation: Continuing without parser for extension '${ext}' due to error`,
					"LanguageParser",
				)
				continue // Continue to the next extension instead of throwing
			}
		}
	}

	// Log summary of loaded parsers
	const loadedParserKeys = Object.keys(parsers)
	logger.info(`Loaded ${loadedParserKeys.length} parsers: ${loadedParserKeys.join(", ")}`, "LanguageParser")

	return parsers
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
		"xml",
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
