import * as path from "path"
import * as fs from "fs"
import { Parser as ParserT, Language as LanguageT, Query as QueryT } from "web-tree-sitter"
import { logger } from "../shared/logger"
import { MetricsCollector } from "../code-index/utils/metrics-collector"
import { getWasmDirectory } from "./get-wasm-directory"

// Helper function to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === "development"

// Helper function to check strict WASM loading mode
function getStrictWasmLoading(): boolean {
	return (
		process.env.ROO_CODE_STRICT_WASM_LOADING === "true" ||
		(isDevelopment && process.env.ROO_CODE_STRICT_WASM_LOADING !== "false")
	)
}
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
	scalaQuery,
} from "./queries"

export interface LanguageParser {
	[key: string]: {
		parser: ParserT
		query: QueryT
		language: LanguageT
	}
}

async function loadLanguage(langName: string, sourceDirectory?: string) {
	const baseDir = sourceDirectory || getWasmDirectory()
	const wasmPath = path.join(baseDir, `tree-sitter-${langName}.wasm`)

	const strictWasmLoading = getStrictWasmLoading()

	// Log the full WASM path before attempting to load
	logger.debug(`Attempting to load language WASM: ${wasmPath}`, "LanguageParser")

	// Check if WASM file exists before attempting to load it
	if (!fs.existsSync(wasmPath)) {
		const errorMessage = `WASM file not found: ${wasmPath}`
		const downloadInstructions =
			"Run 'Download Tree-sitter WASM Files' command or execute 'pnpm download-wasms' to fix this issue"

		logger.error(errorMessage, "LanguageParser")

		// Add prominent warning with download instructions
		if (isDevelopment) {
			logger.error(`🚨 DEVELOPMENT MODE: Missing WASM file detected!`, "LanguageParser")
			logger.error(`   ${downloadInstructions}`, "LanguageParser")
			logger.error(`   WASM directory: ${baseDir}`, "LanguageParser")
		} else {
			logger.warn(`${downloadInstructions}`, "LanguageParser")
		}

		if (strictWasmLoading) {
			throw new Error(`${errorMessage}. ${downloadInstructions}`)
		} else {
			logger.warn(
				`Graceful degradation: Skipping language ${langName} due to missing WASM file. ${downloadInstructions}`,
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
		const downloadInstructions =
			"Run 'Download Tree-sitter WASM Files' command or execute 'pnpm download-wasms' to fix this issue"

		logger.error(errorMessage, "LanguageParser")

		// Add download instructions for loading errors too
		if (isDevelopment) {
			logger.error(`🚨 DEVELOPMENT MODE: WASM loading error detected!`, "LanguageParser")
			logger.error(`   ${downloadInstructions}`, "LanguageParser")
			logger.error(`   WASM path: ${wasmPath}`, "LanguageParser")
		} else {
			logger.warn(`${downloadInstructions}`, "LanguageParser")
		}

		if (strictWasmLoading) {
			throw new Error(`${errorMessage}. ${downloadInstructions}`)
		} else {
			logger.warn(
				`Graceful degradation: Skipping language ${langName} due to loading error. ${downloadInstructions}`,
				"LanguageParser",
			)
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
	const baseDir = sourceDirectory || getWasmDirectory()
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
	const baseDir = sourceDirectory || getWasmDirectory()
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

	const strictWasmLoading = getStrictWasmLoading()

	// Run diagnostics once before initializing parsers
	if (!hasRunDiagnostics) {
		const diagnostics = diagnoseWasmSetup(getWasmDirectory())

		// If critical WASM files are missing, handle based on strict mode
		if (!diagnostics.mainWasmExists) {
			const downloadInstructions =
				"Run 'Download Tree-sitter WASM Files' command or execute 'pnpm download-wasms' to fix this issue"
			const errorMessage = `Critical setup error: tree-sitter.wasm not found in ${diagnostics.wasmDirectory}. ${downloadInstructions}`

			logger.error(errorMessage, "LanguageParser")

			// Add prominent development warnings
			if (isDevelopment) {
				logger.error(`🚨 DEVELOPMENT MODE: Critical WASM files missing!`, "LanguageParser")
				logger.error(`   ${downloadInstructions}`, "LanguageParser")
				logger.error(`   WASM directory: ${diagnostics.wasmDirectory}`, "LanguageParser")
				logger.error(`   Missing files: ${diagnostics.missingWasms.join(", ")}`, "LanguageParser")
			} else {
				logger.warn(downloadInstructions, "LanguageParser")
			}

			if (strictWasmLoading) {
				// In strict mode, throw an error to fail fast
				throw new Error(errorMessage)
			} else {
				// In non-strict mode, log a warning and return empty parsers for graceful degradation
				logger.warn(
					`Graceful degradation: Operating without tree-sitter parsers due to missing WASM files. ${downloadInstructions}`,
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
					const wasmPath = path.join(getWasmDirectory(), "tree-sitter.wasm")
					logger.debug(`Locating tree-sitter.wasm at ${wasmPath}`, "LanguageParser")
					return wasmPath
				},
			})
			isParserInitialized = true
			logger.info("Parser initialized successfully - tree-sitter.wasm loaded", "LanguageParser")
		} catch (error) {
			const downloadInstructions =
				"Run 'Download Tree-sitter WASM Files' command or execute 'pnpm download-wasms' to fix this issue"
			const errorMessage = `Error initializing parser: ${error instanceof Error ? error.message : error}. ${downloadInstructions}`

			logger.error(errorMessage, "LanguageParser")

			// Add development-specific error details
			if (isDevelopment) {
				logger.error(`🚨 DEVELOPMENT MODE: Parser initialization failed!`, "LanguageParser")
				logger.error(`   ${downloadInstructions}`, "LanguageParser")
				logger.error(
					`   Attempted WASM path: ${path.join(getWasmDirectory(), "tree-sitter.wasm")}`,
					"LanguageParser",
				)
			}

			throw new Error(errorMessage)
		}
	}

	const extensionsToLoad = new Set(filesToParse.map((file) => path.extname(file).toLowerCase().slice(1)))
	const parsers: LanguageParser = {}

	// Log which extensions are being loaded
	logger.info(`Loading parsers for extensions: ${Array.from(extensionsToLoad).join(", ")}`, "LanguageParser")

	for (const ext of Array.from(extensionsToLoad)) {
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
						try {
							logger.debug(
								`Creating query for ${ext}: ${javascriptQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, javascriptQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
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
						try {
							logger.debug(
								`Creating query for ${ext}: ${typescriptQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, typescriptQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
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
						try {
							logger.debug(
								`Creating query for ${ext}: ${tsxQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, tsxQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load tsx language")
					}
					break
				case "py":
					language = await loadLanguage("python", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${pythonQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, pythonQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load python language")
					}
					break
				case "rs":
					language = await loadLanguage("rust", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${rustQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, rustQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load rust language")
					}
					break
				case "go":
					language = await loadLanguage("go", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${goQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, goQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load go language")
					}
					break
				case "cpp":
				case "hpp":
					language = await loadLanguage("cpp", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${cppQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, cppQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load cpp language")
					}
					break
				case "c":
				case "h":
					language = await loadLanguage("c", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${cQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, cQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load c language")
					}
					break
				case "cs":
					language = await loadLanguage("c_sharp", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${csharpQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, csharpQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load c_sharp language")
					}
					break
				case "rb":
					language = await loadLanguage("ruby", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${rubyQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, rubyQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load ruby language")
					}
					break
				case "java":
					language = await loadLanguage("java", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${javaQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, javaQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load java language")
					}
					break
				case "php":
					language = await loadLanguage("php", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${phpQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, phpQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load php language")
					}
					break
				case "swift":
					language = await loadLanguage("swift", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${swiftQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, swiftQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load swift language")
					}
					break
				case "kt":
				case "kts":
					language = await loadLanguage("kotlin", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${kotlinQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, kotlinQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load kotlin language")
					}
					break
				case "css":
					language = await loadLanguage("css", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${cssQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, cssQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load css language")
					}
					break
				case "html":
					language = await loadLanguage("html", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${htmlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, htmlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load html language")
					}
					break
				case "ml":
				case "mli":
					language = await loadLanguage("ocaml", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${ocamlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, ocamlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load ocaml language")
					}
					break
				case "scala":
					language = await loadLanguage("scala", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${scalaQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, scalaQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load scala language")
					}
					break
				case "sol":
					language = await loadLanguage("solidity", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${solidityQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, solidityQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load solidity language")
					}
					break
				case "toml":
					language = await loadLanguage("toml", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${tomlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, tomlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load toml language")
					}
					break
				case "xml":
					language = await loadLanguage("xml", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${xmlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, xmlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load xml language")
					}
					break
				case "yaml":
				case "yml":
					language = await loadLanguage("yaml", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${yamlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, yamlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load yaml language")
					}
					break
				case "vue":
					language = await loadLanguage("vue", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${vueQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, vueQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load vue language")
					}
					break
				case "lua":
					language = await loadLanguage("lua", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${luaQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, luaQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load lua language")
					}
					break
				case "rdl":
					language = await loadLanguage("systemrdl", sourceDirectory)
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${systemrdlQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, systemrdlQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load systemrdl language")
					}
					break
				case "tla":
					language = await loadLanguage("tlaplus", getWasmDirectory())
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${tlaPlusQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, tlaPlusQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load tlaplus language")
					}
					break
				case "zig":
					language = await loadLanguage("zig", getWasmDirectory())
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${zigQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, zigQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load zig language")
					}
					break
				case "ejs":
				case "erb":
					parserKey = "embedded_template" // Use same key for both extensions.
					language = await loadLanguage("embedded_template", getWasmDirectory())
					if (language) {
						try {
							logger.debug(
								`Creating query for ${parserKey}: ${embeddedTemplateQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, embeddedTemplateQuery)
							logger.debug(
								`Successfully created query for ${parserKey} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${parserKey}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
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
					language = await loadLanguage("elisp", getWasmDirectory())
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${elispQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, elispQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
						metricsCollector?.recordParserMetric(ext, "loadSuccess")
					} else {
						metricsCollector?.recordParserMetric(ext, "loadFailure", 1, "Failed to load elisp language")
					}
					break
				case "ex":
				case "exs":
					language = await loadLanguage("elixir", getWasmDirectory())
					if (language) {
						try {
							logger.debug(
								`Creating query for ${ext}: ${elixirQuery.length} chars, attempting to parse...`,
								"LanguageParser",
							)
							query = new Query(language, elixirQuery)
							logger.debug(
								`Successfully created query for ${ext} with ${query!.patternCount} patterns`,
								"LanguageParser",
							)
						} catch (queryError) {
							logger.error(
								`Query creation failed for ${ext}: ${queryError instanceof Error ? queryError.message : queryError}`,
								"LanguageParser",
							)
							throw queryError
						}
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

			// Add query validation diagnostics
			logger.debug(`Query for ${parserKey} has ${query!.patternCount} patterns`, "LanguageParser")
			logger.debug(`Query capture names: ${query!.captureNames.join(", ")}`, "LanguageParser")

			// Add a test parse of a simple code snippet to verify the query works
			try {
				let testCode = ""
				switch (parserKey) {
					case "js":
					case "jsx":
					case "json":
						testCode = "function test() { return true; }"
						break
					case "ts":
					case "tsx":
						testCode = "function test(): boolean { return true; }"
						break
					case "py":
						testCode = "def test():\n    return True"
						break
					case "rs":
						testCode = "fn test() -> bool { true }"
						break
					case "go":
						testCode = "func test() bool { return true }"
						break
					case "cpp":
					case "hpp":
					case "c":
					case "h":
						testCode = "bool test() { return true; }"
						break
					case "cs":
						testCode = "bool Test() { return true; }"
						break
					case "rb":
						testCode = "def test\n  true\nend"
						break
					case "java":
						testCode = "boolean test() { return true; }"
						break
					case "php":
						testCode = "<?php function test() { return true; } ?>"
						break
					case "swift":
						testCode = "func test() -> Bool { return true }"
						break
					case "kt":
					case "kts":
						testCode = "fun test(): Boolean { return true }"
						break
					case "css":
						testCode = ".test { color: red; }"
						break
					case "html":
						testCode = '<div class="test">Test</div>'
						break
					case "ml":
					case "mli":
						testCode = "let test = true"
						break
					case "scala":
						testCode = "def test: Boolean = true"
						break
					case "sol":
						testCode = "function test() public returns (bool) { return true; }"
						break
					case "toml":
						testCode = "[test]\nkey = true"
						break
					case "xml":
						testCode = '<test attr="true"></test>'
						break
					case "yaml":
					case "yml":
						testCode = "test:\n  key: true"
						break
					case "vue":
						testCode = "<template><div>Test</div></template>"
						break
					case "lua":
						testCode = "function test() return true end"
						break
					case "rdl":
						testCode = "test { }"
						break
					case "tla":
						testCode = "Test == TRUE"
						break
					case "zig":
						testCode = "fn test() bool { return true; }"
						break
					case "embedded_template":
						testCode = "<%= test %>"
						break
					case "el":
						testCode = "(defun test () t)"
						break
					case "ex":
					case "exs":
						testCode = "def test, do: true"
						break
					default:
						testCode = "test"
						break
				}

				const testTree = parser.parse(testCode)
				const testMatches = query!.matches(testTree)
				logger.debug(
					`Query test for ${parserKey}: parsed ${testCode.length} chars, found ${testMatches.length} matches`,
					"LanguageParser",
				)

				// Add AST Node Type Validation
				// Extract node types from query patterns
				const extractPatternsFromQuery = (queryString: string): string[] => {
					// Use regex to extract node types from query patterns
					// Match patterns like "(identifier) @name" or "(function_declaration) @function"
					const nodeTypePattern = /\(([^@)\s]+)/g
					const matches = []
					let match

					// Known S-expression directives and predicates to skip
					const knownDirectives = new Set([
						"match?",
						"eq?",
						"not-eq?",
						"any?",
						"not-any?",
						"is?",
						"not-is?",
						"is-not?",
						"set!",
						"set!-dirty",
						"lua-match?",
						"pred!",
					])

					while ((match = nodeTypePattern.exec(queryString)) !== null) {
						const candidate = match[1]

						// Skip tokens that start with # (predicates)
						if (candidate.startsWith("#")) {
							continue
						}

						// Skip known directives
						if (knownDirectives.has(candidate)) {
							continue
						}

						matches.push(candidate)
					}
					return Array.from(new Set(matches)) // Remove duplicates
				}

				// Get the query string based on the language
				let queryString = ""
				switch (parserKey) {
					case "js":
					case "jsx":
					case "json":
						queryString = javascriptQuery
						break
					case "ts":
						queryString = typescriptQuery
						break
					case "tsx":
						queryString = tsxQuery
						break
					case "py":
						queryString = pythonQuery
						break
					case "rs":
						queryString = rustQuery
						break
					case "go":
						queryString = goQuery
						break
					case "cpp":
					case "hpp":
						queryString = cppQuery
						break
					case "c":
					case "h":
						queryString = cQuery
						break
					case "cs":
						queryString = csharpQuery
						break
					case "rb":
						queryString = rubyQuery
						break
					case "java":
						queryString = javaQuery
						break
					case "php":
						queryString = phpQuery
						break
					case "swift":
						queryString = swiftQuery
						break
					case "kt":
					case "kts":
						queryString = kotlinQuery
						break
					case "css":
						queryString = cssQuery
						break
					case "html":
						queryString = htmlQuery
						break
					case "ml":
					case "mli":
						queryString = ocamlQuery
						break
					case "scala":
						queryString = scalaQuery // Use proper Scala query
						break
					case "sol":
						queryString = solidityQuery
						break
					case "toml":
						queryString = tomlQuery
						break
					case "xml":
						queryString = xmlQuery
						break
					case "yaml":
					case "yml":
						queryString = yamlQuery
						break
					case "vue":
						queryString = vueQuery
						break
					case "lua":
						queryString = luaQuery
						break
					case "rdl":
						queryString = systemrdlQuery
						break
					case "tla":
						queryString = tlaPlusQuery
						break
					case "zig":
						queryString = zigQuery
						break
					case "embedded_template":
						queryString = embeddedTemplateQuery
						break
					case "el":
						queryString = elispQuery
						break
					case "ex":
					case "exs":
						queryString = elixirQuery
						break
					default:
						queryString = ""
						break
				}

				// Parse the test code snippet and extract all node types
				const nodeTypesInAST = new Set<string>()
				const nodeTypeCounts = new Map<string, number>()

				const traverseAST = (node: any, depth: number = 0) => {
					// Guard against pathological trees with a recursion depth cap
					// This assumes the small testCode snippets defined in the switch above
					const MAX_RECURSION_DEPTH = 1000
					if (depth > MAX_RECURSION_DEPTH) {
						logger.warn(
							`Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded during AST traversal. Skipping deeper nodes.`,
							"LanguageParser",
						)
						return
					}

					nodeTypesInAST.add(node.type)
					nodeTypeCounts.set(node.type, (nodeTypeCounts.get(node.type) || 0) + 1)
					node.children.forEach((child: any) => traverseAST(child, depth + 1))
				}
				traverseAST(testTree.rootNode)

				// Compare query patterns against actual node types
				const queryPatterns = extractPatternsFromQuery(queryString)
				const missingNodeTypes = queryPatterns.filter((pattern) => !nodeTypesInAST.has(pattern))

				if (missingNodeTypes.length > 0) {
					// Note: "missing node types" are heuristic and may include non-critical patterns
					// This doesn't necessarily indicate a hard failure, as some patterns might only match
					// in specific code contexts not covered by our simple test snippets
					logger.warn(
						`Query for ${parserKey} references node types not found in test AST: ${missingNodeTypes.join(", ")}`,
						"LanguageParser",
					)
				}

				// Log the top 10 most common node types found in the test parse
				const sortedNodeTypes = Array.from(nodeTypeCounts.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, 10)

				logger.debug(
					`Top 10 most common node types in test AST for ${parserKey}: ${sortedNodeTypes.map(([type, count]) => `${type} (${count})`).join(", ")}`,
					"LanguageParser",
				)
				logger.debug(
					`Node types in test AST for ${parserKey}: ${Array.from(nodeTypesInAST).join(", ")}`,
					"LanguageParser",
				)
			} catch (testError) {
				logger.warn(
					`Query test failed for ${parserKey}: ${testError instanceof Error ? testError.message : testError}`,
					"LanguageParser",
				)
			}

			// Log successful parser creation
			logger.debug(`Successfully created parser for: ${parserKey}`, "LanguageParser")
		} catch (error) {
			// Determine which specific operation failed based on the error and current state
			let failedOperation = "unknown operation"
			if (!language) {
				failedOperation = "language loading"
			} else if (!query) {
				failedOperation = "query creation"
			} else {
				failedOperation = "parser initialization"
			}

			const errorMessage = `Failed to load parser for extension '${ext}' during ${failedOperation}: ${error instanceof Error ? error.message : error}`
			logger.error(errorMessage, "LanguageParser")

			// Add additional context about the failure
			if (!language) {
				logger.error(
					`Language loading failed for ${ext}. This may indicate missing WASM files or incompatible language module.`,
					"LanguageParser",
				)
			} else if (!query) {
				logger.error(
					`Query creation failed for ${ext}. This may indicate syntax errors in the query or incompatible query patterns.`,
					"LanguageParser",
				)
			} else {
				logger.error(
					`Parser initialization failed for ${ext}. This may indicate issues with parser setup or language binding.`,
					"LanguageParser",
				)
			}

			// Record parser load failure if metrics collector is provided
			metricsCollector?.recordParserMetric(ext, "loadFailure", 1, errorMessage)

			const strictWasmLoading = getStrictWasmLoading()
			if (strictWasmLoading) {
				throw new Error(errorMessage)
			} else {
				logger.warn(
					`Graceful degradation: Continuing without parser for extension '${ext}' due to ${failedOperation} failure`,
					"LanguageParser",
				)
				continue // Continue to the next extension instead of throwing
			}
		}
	}

	// Log summary of loaded parsers
	const loadedParserKeys = Object.keys(parsers)
	logger.info(`Loaded ${loadedParserKeys.length} parsers: ${loadedParserKeys.join(", ")}`, "LanguageParser")

	// Final strict-mode check: ensure at least one parser was loaded when we had input files to process
	if (strictWasmLoading && filesToParse.length > 0 && Object.keys(parsers).length === 0) {
		const wasmDir = getWasmDirectory()
		const diag = diagnoseWasmSetup(wasmDir)
		throw new Error(`
No language parsers loaded in strict mode.
WASM Dir: ${wasmDir}
Diagnostics: ${JSON.stringify(diag, null, 2)}
Fix: Run 'pnpm download-wasms' or VSCode command 'Download Tree-sitter WASM Files'.`)
	}

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
