#!/usr/bin/env node

/**
 * Tree-sitter Query Validation Script
 *
 * This script validates tree-sitter queries against test fixtures.
 * It must be run with ts-node to properly handle TypeScript query files.
 *
 * Usage:
 *   npm run validate-queries                    # Validate all languages
 *   npm run validate-queries -- --language=typescript  # Validate specific language
 *   npm run validate-queries -- --verbose      # Enable verbose output
 */

import * as fs from "fs"
import * as path from "path"
import { validateAllLanguages, generateValidationReport } from "../src/services/tree-sitter/query-validator"

// Configuration
const LANGUAGES = [
	{
		name: "typescript",
		wasm: "tree-sitter-typescript.wasm",
		query: "typescript.ts",
		testDir: "typescript",
	},
	{
		name: "javascript",
		wasm: "tree-sitter-javascript.wasm",
		query: "javascript.ts",
		testDir: "javascript",
	},
	{
		name: "python",
		wasm: "tree-sitter-python.wasm",
		query: "python.ts",
		testDir: "python",
	},
	{
		name: "rust",
		wasm: "tree-sitter-rust.wasm",
		query: "rust.ts",
		testDir: "rust",
	},
	{
		name: "java",
		wasm: "tree-sitter-java.wasm",
		query: "java.ts",
		testDir: "java",
	},
	{
		name: "go",
		wasm: "tree-sitter-go.wasm",
		query: "go.ts",
		testDir: "go",
	},
	{
		name: "cpp",
		wasm: "tree-sitter-cpp.wasm",
		query: "cpp.ts",
		testDir: "cpp",
	},
]

const ROOT_DIR = path.resolve(__dirname, "..")
const WASM_DIR = path.join(ROOT_DIR, "resources", "app", "extensions", "roo-cline", "dist", "tree-sitter-wasms")
// Fallback WASM dir if running in dev environment
const WASM_DEV_DIR = path.join(ROOT_DIR, "dist", "tree-sitter-wasms")
const WASM_SRC_DIR = path.join(ROOT_DIR, "src", "services", "tree-sitter")

const QUERIES_DIR = path.join(ROOT_DIR, "src", "services", "tree-sitter", "queries")
const FIXTURES_DIR = path.join(ROOT_DIR, "test-fixtures")

async function main() {
	const args = process.argv.slice(2)

	// Parse CLI options
	const languageArgs = args
		.filter((arg) => arg.startsWith("--language="))
		.map((arg) => arg.split("=")[1])
		.filter((lang) => lang) // Filter out empty values

	const verbose = args.includes("--verbose")
	const fix = args.includes("--fix") // No-op for now as per instructions

	console.log("Starting Tree-sitter Query Validation...")
	if (languageArgs.length > 0) {
		console.log(`Filtering for languages: ${languageArgs.join(", ")}`)
	}
	if (verbose) console.log("Verbose mode enabled")
	if (fix) console.log("Fix flag detected (no-op for now)")

	// Locate WASM directory
	let wasmPath = WASM_DIR
	if (!fs.existsSync(wasmPath)) {
		wasmPath = WASM_DEV_DIR
		if (!fs.existsSync(wasmPath)) {
			wasmPath = WASM_SRC_DIR
			if (!fs.existsSync(wasmPath)) {
				// Try to find it in node_modules if possible, or just fail
				console.warn(`WASM directory not found at ${WASM_DIR} or ${WASM_DEV_DIR} or ${WASM_SRC_DIR}`)
			}
		}
	}
	console.log(`Using WASM directory: ${wasmPath}`)

	const languagesToValidate = LANGUAGES.filter(
		(lang) => languageArgs.length === 0 || languageArgs.includes(lang.name),
	).map((lang) => ({
		name: lang.name,
		wasmPath: path.join(wasmPath, lang.wasm),
		queryPath: path.join(QUERIES_DIR, lang.query),
		testPath: path.join(FIXTURES_DIR, lang.testDir),
	}))

	if (languagesToValidate.length === 0) {
		console.error(`No languages found matching: ${languageArgs.join(", ")}`)
		process.exit(1)
	}

	try {
		const results = await validateAllLanguages(languagesToValidate, verbose)

		// Generate report
		const report = generateValidationReport(results)
		console.log(report)

		// Save report
		const reportPath = path.join(ROOT_DIR, "INDEXAUDIT", "QUERY_VALIDATION_REPORT.md")
		fs.writeFileSync(reportPath, report)
		console.log(`Report saved to ${reportPath}`)

		// Check for failures
		const failures = results.filter((r) => !r.passed)
		if (failures.length > 0) {
			console.error(`Validation failed for: ${failures.map((f) => f.language).join(", ")}`)
			process.exit(1)
		} else {
			console.log("All languages passed validation!")
			process.exit(0)
		}
	} catch (error) {
		console.error("Validation script error:", error)
		process.exit(1)
	}
}

main()
