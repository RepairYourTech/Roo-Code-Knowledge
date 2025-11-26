import * as path from "path"
import * as vscode from "vscode"
import { getWasmDirectory } from "./get-wasm-directory"

// Define MetricsCollector interface
interface MetricsCollector {
	recordParserMetric?: (
		extension: string,
		status:
			| "loadAttempt"
			| "loadSuccess"
			| "loadFailure"
			| "parseAttempt"
			| "parseSuccess"
			| "parseFailed"
			| "captures"
			| "fallback",
		count?: number,
		error?: string,
	) => void
}

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

async function loadLanguage(langName: string, sourceDirectory?: string) {
	try {
		const wasmDirectory = getWasmDirectory()
		const { Parser } = require("web-tree-sitter")

		// For development or when sourceDirectory is provided, try to load from local path
		if (process.env.NODE_ENV === "development" || sourceDirectory) {
			const localPath = sourceDirectory || wasmDirectory
			const languagePath = path.join(localPath, `${langName}.wasm`)

			try {
				const language = await Parser.Language.load(languagePath)
				return language
			} catch (error) {
				// Fall back to node_modules if local loading fails
				console.warn(`Failed to load ${langName}.wasm from ${languagePath}:`, error)
			}
		}

		// Try loading from node_modules
		try {
			const packagePath = require.resolve(
				`@tree-sitter-grammars/tree-sitter-${langName}/tree-sitter-${langName}.wasm`,
			)
			const language = await Parser.Language.load(packagePath)
			return language
		} catch (error) {
			// Try alternative package name
			const altPackagePath = require.resolve(`tree-sitter-${langName}/tree-sitter-${langName}.wasm`)
			const language = await Parser.Language.load(altPackagePath)
			return language
		}
	} catch (error) {
		console.error(`Failed to load language ${langName}:`, error)
		return null
	}
}

function diagnoseWasmSetup(_sourceDirectory?: string) {
	const report = {
		wasmDirectoryExists: false,
		wasmDirectory: getWasmDirectory(),
		wasmFiles: [] as string[],
		missingWasms: [] as string[],
		expectedLanguages: [
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
			"swift",
			"kotlin",
			"css",
			"html",
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
			"ejs",
			"erb",
			"elisp",
			"elixir",
		],
	}

	try {
		const fs = require("fs")

		// Check if WASM directory exists
		try {
			const stats = fs.statSync(report.wasmDirectory)
			report.wasmDirectoryExists = stats.isDirectory()
		} catch (error) {
			report.wasmDirectoryExists = false
		}

		// List existing WASM files
		if (report.wasmDirectoryExists) {
			try {
				report.wasmFiles = fs.readdirSync(report.wasmDirectory).filter((file: string) => file.endsWith(".wasm"))
			} catch (error) {
				report.wasmFiles = []
			}
		}

		// Check for missing WASM files
		if (report.wasmDirectoryExists) {
			report.expectedLanguages.forEach((lang) => {
				const expectedFile = `${lang}.wasm`
				if (!report.wasmFiles.includes(expectedFile)) {
					report.missingWasms.push(expectedFile)
				}
			})
		}

		// Additional diagnostic info
		try {
			const webTreeSitterPath = require.resolve("web-tree-sitter")
			report.wasmFiles.push(`web-tree-sitter found at: ${webTreeSitterPath}`)
		} catch (error) {
			report.missingWasms.push("web-tree-sitter package not found")
		}
	} catch (error) {
		report.missingWasms.push(`Error during diagnosis: ${error}`)
	}

	return report
}

export async function loadRequiredLanguageParsers(
	filesToParse: string[],
	sourceDirectory?: string,
	_metricsCollector?: MetricsCollector,
): Promise<{ [key: string]: LanguageParser }> {
	const { Parser } = require("web-tree-sitter")

	const strictWasmLoading = getStrictWasmLoading()

	// Run diagnostics once before initializing parsers
	if (!hasRunDiagnostics) {
		// If critical WASM files are missing, handle based on strict mode
		const downloadInstructions = `Missing tree-sitter WASM files in ${getWasmDirectory()}.
Please run 'pnpm download-wasms' or use VSCode command 'Download Tree-sitter WASM Files' to install them.`

		if (strictWasmLoading) {
			throw new Error(`Strict mode enabled. ${downloadInstructions}`)
		} else {
			console.warn(downloadInstructions)
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
		xml: "xml",
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

	// Initialize Parser once
	await Parser.init({
		locateFile: (scriptName: string, _scriptDirectory: string) => {
			return path.join(getWasmDirectory(), scriptName)
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
			const language = await loadLanguage(parserKey, sourceDirectory)
			if (!language) {
				if (strictWasmLoading) {
					throw new Error(`Failed to load language: ${parserKey}`)
				} else {
					console.warn(`Failed to load language: ${parserKey}`)
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
						break
					case "ts":
					case "tsx":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(class_declaration name: (identifier) @class-name)
							(interface_declaration name: (identifier) @interface-name)
						`)
						break
					case "py":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(class_definition name: (identifier) @class-name)
						`)
						break
					case "rs":
						query = language.query(`
							(function_item name: (identifier) @function-name)
							(struct_item name: (type_identifier) @struct-name)
							(enum_item name: (type_identifier) @enum-name)
						`)
						break
					case "go":
						query = language.query(`
							(function_declaration name: (identifier) @function-name)
							(struct_type name: (type_identifier) @struct-name)
							(interface_type name: (type_identifier) @interface-name)
						`)
						break
					case "cpp":
					case "hpp":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(class_specifier name: (type_identifier) @class-name)
							(struct_specifier name: (type_identifier) @struct-name)
						`)
						break
					case "c":
					case "h":
						query = language.query(`
							(function_definition name: (identifier) @function-name)
							(struct_specifier name: (type_identifier) @struct-name)
						`)
						break
					case "cs":
						query = language.query(`
							(method_declaration name: (identifier) @method-name)
							(class_declaration name: (identifier) @class-name)
							(interface_declaration name: (identifier) @interface-name)
						`)
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
					case "xml":
						query = language.query(`
							(element) @element
							(attribute (attribute_name) @attribute-name)
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
				console.warn(`Failed to create query for ${parserKey}:`, queryError)
				// Create a minimal fallback query
				try {
					query = language.query(`(identifier) @identifier`)
				} catch (fallbackError) {
					console.warn(`Failed to create fallback query for ${parserKey}:`, fallbackError)
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
					const testCode = getTestCodeForLanguage(parserKey)
					if (testCode) {
						const testTree = parser.parse(testCode)
						if (query) {
							query.captures(testTree.rootNode)
						}
						// If there are no captures, it might be fine depending on the test code
					}
				} catch (testError) {
					console.warn(`Parser test failed for ${parserKey}, but continuing:`, testError)
				}
			}
		} catch (error) {
			console.error(`Failed to load parser for ${parserKey}:`, error)
			if (strictWasmLoading) {
				throw error
			}
			// Continue to the next extension instead of throwing
			continue
		}
	}

	// Log loaded parsers for debugging
	const loadedParserKeys = Object.keys(parsers)
	console.info(`Loaded ${loadedParserKeys.length} parsers: ${loadedParserKeys.join(", ")}`)

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
		xml: "<test>content</test>",
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
