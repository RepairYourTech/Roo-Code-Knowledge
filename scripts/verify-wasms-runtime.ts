#!/usr/bin/env node

/**
 * CI Verification Script for WASM Files
 *
 * This script verifies that WASM files are properly configured and can be loaded
 * by web-tree-sitter in a runtime environment. It performs real filesystem checks
 * and attempts to load core language grammars to ensure they work correctly.
 *
 * Usage:
 *   - Direct execution: node scripts/verify-wasms-runtime.ts
 *   - Via pnpm: pnpm verify:wasms
 *   - CI: Automatically runs as part of the test suite
 */

import * as path from "path"
import * as fs from "fs"

// Mock vscode for non-VS Code environments
const mockVscode = {
	extensions: {
		getExtension: (id: string) => {
			// In CI/local environment, try to find the extension path by looking at the current directory structure
			const projectRoot = path.resolve(__dirname, "..")
			const packageJsonPath = path.join(projectRoot, "package.json")

			if (fs.existsSync(packageJsonPath)) {
				try {
					const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
					const expectedNames = ["roo-cline", "roo-code", "claude-dev"]
					if (expectedNames.some((name) => packageJson.name?.includes(name))) {
						return {
							extensionPath: projectRoot,
							id: id,
						}
					}
				} catch (e) {
					// Ignore errors
				}
			}
			return null
		},
		all: [],
	},
}

// Mock vscode module
const vscodeModule = mockVscode

// Import our modules after mocking
let getWasmDirectory: any
let validateWasmDirectory: any

try {
	// Try to import from the actual source
	const wasmDirModule = require("../src/services/tree-sitter/get-wasm-directory")
	const wasmDiagnosticsModule = require("../src/services/tree-sitter/wasm-diagnostics")

	getWasmDirectory = wasmDirModule.getWasmDirectory
	validateWasmDirectory = wasmDiagnosticsModule.validateWasmDirectory
} catch (error) {
	console.error("❌ Failed to import required modules:", error)
	console.error("💡 Make sure you're running this script from the project root")
	process.exit(1)
}

// Mock logger to avoid dependency issues
const mockLogger = {
	info: (message: string, context?: string) => console.log(`[INFO] ${context ? `[${context}] ` : ""}${message}`),
	debug: (message: string, context?: string) => console.log(`[DEBUG] ${context ? `[${context}] ` : ""}${message}`),
	warn: (message: string, context?: string) => console.warn(`[WARN] ${context ? `[${context}] ` : ""}${message}`),
	error: (message: string, context?: string) => console.error(`[ERROR] ${context ? `[${context}] ` : ""}${message}`),
}

// Replace the logger in the imported modules
try {
	const loggerModule = require("../src/services/shared/logger")
	loggerModule.logger = mockLogger
} catch (e) {
	// Ignore if logger module can't be replaced
}

// Core languages to verify
const CORE_LANGUAGES = ["typescript", "javascript", "python"]

/**
 * Initialize web-tree-sitter and load a language
 */
async function loadLanguage(languageName: string, wasmPath: string): Promise<any> {
	try {
		// Dynamically import web-tree-sitter
		const webTreeSitter = require("web-tree-sitter")
		const { Parser, Language } = webTreeSitter

		// Initialize the parser if not already initialized
		await Parser.init()

		// Load the language
		const languageWasmPath = path.join(wasmPath, `tree-sitter-${languageName}.wasm`)
		if (!fs.existsSync(languageWasmPath)) {
			throw new Error(`WASM file not found: ${languageWasmPath}`)
		}

		const language = await Language.load(languageWasmPath)
		return language
	} catch (error) {
		throw new Error(`Failed to load ${languageName}: ${error}`)
	}
}

/**
 * Verify that a language can parse basic code
 */
async function verifyLanguageParsing(languageName: string, language: any): Promise<boolean> {
	try {
		const webTreeSitter = require("web-tree-sitter")
		const { Parser } = webTreeSitter

		const parser = new Parser()
		parser.setLanguage(language)

		// Test code snippets for each language
		const testSnippets: { [key: string]: string } = {
			typescript: "interface Test { prop: string; } class MyClass implements Test { prop = 'hello'; }",
			javascript: "function test() { return function nested() { return 42; }; }",
			python: "class TestClass: def method(self): return [x for x in range(10)]",
		}

		const testCode = testSnippets[languageName]
		if (!testCode) {
			throw new Error(`No test snippet available for ${languageName}`)
		}

		// Parse the test code
		const tree = parser.parse(testCode)
		if (!tree) {
			throw new Error(`Failed to parse test code for ${languageName}`)
		}

		// Basic validation - check if we got a root node
		const rootNode = tree.rootNode
		if (!rootNode || rootNode.childCount === 0) {
			throw new Error(`Invalid parse tree for ${languageName}`)
		}

		return true
	} catch (error) {
		throw new Error(`Failed to verify ${languageName} parsing: ${error}`)
	}
}

/**
 * Main verification function
 */
async function main(): Promise<void> {
	console.log("🔍 Starting WASM runtime verification...")
	console.log("=====================================")

	try {
		// Step 1: Get the WASM directory
		console.log("\n📁 Step 1: Resolving WASM directory...")
		let wasmDirectory: string

		try {
			// Force revalidation to ensure we get the latest state
			wasmDirectory = getWasmDirectory(true)
			console.log(`✅ WASM directory resolved: ${wasmDirectory}`)
		} catch (error) {
			console.error(`❌ Failed to resolve WASM directory: ${error}`)
			console.error("💡 This indicates a critical issue with WASM file setup")
			process.exit(1)
		}

		// Step 2: Validate the WASM directory
		console.log("\n🔍 Step 2: Validating WASM directory...")
		let validationResult

		try {
			validationResult = validateWasmDirectory(wasmDirectory)
			if (validationResult.isValid) {
				console.log(`✅ WASM directory validation passed`)
				console.log(`   Found files: ${validationResult.foundFiles.join(", ")}`)
			} else {
				console.error(`❌ WASM directory validation failed`)
				console.error(`   Missing critical files: ${validationResult.missingCriticalFiles.join(", ")}`)
				if (validationResult.foundFiles.length > 0) {
					console.error(`   Found files: ${validationResult.foundFiles.join(", ")}`)
				}
				process.exit(1)
			}
		} catch (error) {
			console.error(`❌ Error during WASM directory validation: ${error}`)
			process.exit(1)
		}

		// Step 3: Initialize web-tree-sitter and load core languages
		console.log("\n🚀 Step 3: Testing web-tree-sitter runtime...")
		let webTreeSitter

		try {
			webTreeSitter = require("web-tree-sitter")
			console.log("✅ web-tree-sitter package loaded")
		} catch (error) {
			console.error(`❌ Failed to load web-tree-sitter package: ${error}`)
			console.error("💡 Run 'pnpm install' to install dependencies")
			process.exit(1)
		}

		// Step 4: Load and verify each core language
		console.log("\n📚 Step 4: Loading and verifying core languages...")
		const loadedLanguages: { [key: string]: any } = {}

		for (const languageName of CORE_LANGUAGES) {
			console.log(`\n   Testing ${languageName}...`)

			try {
				// Load the language
				const language = await loadLanguage(languageName, wasmDirectory)
				loadedLanguages[languageName] = language
				console.log(`   ✅ ${languageName} loaded successfully`)

				// Verify parsing capability
				const parsingWorks = await verifyLanguageParsing(languageName, language)
				if (parsingWorks) {
					console.log(`   ✅ ${languageName} parsing verification passed`)
				}
			} catch (error) {
				console.error(`   ❌ ${languageName} verification failed: ${error}`)
				process.exit(1)
			}
		}

		// Step 5: Final verification summary
		console.log("\n🎉 Step 5: Final verification summary...")
		console.log("=====================================")
		console.log("✅ All verifications passed!")
		console.log(`✅ WASM directory: ${wasmDirectory}`)
		console.log(`✅ Core languages verified: ${CORE_LANGUAGES.join(", ")}`)
		console.log(`✅ web-tree-sitter runtime is functional`)

		console.log("\n💡 WASM files are ready for use in production!")
	} catch (error) {
		console.error("\n❌ Verification failed with unexpected error:", error)
		process.exit(1)
	}
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
	console.error("❌ Unhandled Promise Rejection at:", promise, "reason:", reason)
	process.exit(1)
})

// Run the verification
if (require.main === module) {
	main().catch((error) => {
		console.error("❌ Verification script failed:", error)
		process.exit(1)
	})
}

export { main as verifyWasmsRuntime }
