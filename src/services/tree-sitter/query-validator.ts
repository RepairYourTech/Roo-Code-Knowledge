// import Parser = require('web-tree-sitter');
import * as fs from "fs"
import * as path from "path"
import { analyzeASTStructure, generateNodeTypeReport, ASTAnalysisReport } from "./ast-introspection"

export interface ValidationResult {
	language: string
	passed: boolean
	testCases: TestCaseResult[]
	performance: {
		parseTimeMs: number
		queryTimeMs: number
	}
}

export interface TestCaseResult {
	file: string
	captures: number
	nodeTypesFound: string[]
	missingPatterns: string[]
}

export class QueryValidator {
	private parser: any = null
	private language: any = null

	constructor(
		private langName: string,
		private wasmPath: string,
		private verbose: boolean = false,
	) {}

	async initialize(): Promise<void> {
		const WebTreeSitter = require("web-tree-sitter")
		const { Parser, Language } = WebTreeSitter
		await Parser.init()
		this.language = await Language.load(this.wasmPath)
		this.parser = new Parser()
		this.parser.setLanguage(this.language)
	}

	async validateQuery(querySource: string, testFiles: string[]): Promise<ValidationResult> {
		if (this.verbose) {
			console.log(`Validating ${this.langName} with ${testFiles.length} test files`)
		}
		if (!this.parser || !this.language) {
			throw new Error("Validator not initialized")
		}

		let query: any
		try {
			// query = this.language.query(querySource);
			// Use new Query constructor as Language.query is deprecated
			const { Query } = require("web-tree-sitter")
			query = new Query(this.language, querySource)
		} catch (e) {
			console.error(`Failed to parse query for ${this.langName}:`, e)
			return {
				language: this.langName,
				passed: false,
				testCases: [],
				performance: { parseTimeMs: 0, queryTimeMs: 0 },
			}
		}

		const results: TestCaseResult[] = []
		let totalParseTime = 0
		let totalQueryTime = 0

		for (const file of testFiles) {
			const code = fs.readFileSync(file, "utf8")

			const parseStart = performance.now()
			const tree = this.parser.parse(code)
			totalParseTime += performance.now() - parseStart

			const queryStart = performance.now()
			const captures = query.captures(tree.rootNode)
			totalQueryTime += performance.now() - queryStart

			const report = generateNodeTypeReport(file, tree.rootNode, query)

			if (this.verbose) {
				console.log(
					`  ${path.basename(file)}: ${captures.length} captures, node types: ${Array.from(report.nodeTypes.keys()).slice(0, 3).join(", ")}...`,
				)
				if (report.mismatches.length > 0) {
					console.log(`    Missing patterns: ${report.mismatches.map((m) => m.pattern).join(", ")}`)
				}
			}

			results.push({
				file: path.basename(file),
				captures: captures.length,
				nodeTypesFound: Array.from(report.nodeTypes.keys()),
				missingPatterns: report.mismatches.map((m) => m.pattern),
			})

			tree.delete()
		}

		// Determine pass/fail - at least one capture in each file is a low bar,
		// but a good starting point for "broken vs working"
		const passed = results.every((r) => r.captures > 0)

		return {
			language: this.langName,
			passed,
			testCases: results,
			performance: {
				parseTimeMs: totalParseTime,
				queryTimeMs: totalQueryTime,
			},
		}
	}
}

export async function validateAllLanguages(
	languages: { name: string; wasmPath: string; queryPath: string; testPath: string }[],
	verbose: boolean = false,
): Promise<ValidationResult[]> {
	const results: ValidationResult[] = []

	for (const lang of languages) {
		if (!fs.existsSync(lang.wasmPath)) {
			console.warn(`Skipping ${lang.name}: WASM not found at ${lang.wasmPath}`)
			continue
		}

		const validator = new QueryValidator(lang.name, lang.wasmPath, verbose)
		await validator.initialize()

		// Load query from TS file or compiled JS
		let querySource: string
		try {
			// First try to read the file directly as text
			if (fs.existsSync(lang.queryPath)) {
				const content = fs.readFileSync(lang.queryPath, "utf8")

				// If it's a TypeScript file, try to extract the query string
				if (lang.queryPath.endsWith(".ts")) {
					// Look for exported template string or string literal
					const templateStringMatch = content.match(/export\s+default\s+`([^`]+)`/)
					if (templateStringMatch && templateStringMatch[1]) {
						querySource = templateStringMatch[1]
					} else {
						// Look for other export patterns
						const stringLiteralMatch = content.match(/export\s+default\s+["']([^"']+)["']/)
						if (stringLiteralMatch && stringLiteralMatch[1]) {
							querySource = stringLiteralMatch[1]
						} else {
							// Try to use ts-node to load the module
							try {
								// Register ts-node if not already registered
								if (!(process as any)[Symbol.for("ts-node.register.instance")]) {
									require("ts-node/register")
								}
								const queryModule = require(lang.queryPath)
								querySource = queryModule.default || queryModule
							} catch (tsNodeError) {
								console.error(`Failed to load TypeScript query file for ${lang.name}:`, tsNodeError)
								console.error(
									`Please run the validation script with ts-node or ensure the query file exports a default template string.`,
								)
								continue
							}
						}
					}
				} else {
					// For non-TS files, try to load as module
					const queryModule = require(lang.queryPath)
					querySource = queryModule.default || queryModule
				}
			} else {
				// If the original file doesn't exist, try to find compiled JS in dist
				const distPath = lang.queryPath.replace("/src/", "/dist/src/").replace(".ts", ".js")
				if (fs.existsSync(distPath)) {
					const queryModule = require(distPath)
					querySource = queryModule.default || queryModule
				} else {
					console.error(`Query file not found for ${lang.name}: ${lang.queryPath} (nor at ${distPath})`)
					continue
				}
			}
		} catch (e) {
			console.error(`Failed to load query file for ${lang.name}:`, e)
			continue
		}

		if (!fs.existsSync(lang.testPath)) {
			console.warn(`Test path does not exist for ${lang.name}: ${lang.testPath}`)
			continue
		}

		const testFiles = fs
			.readdirSync(lang.testPath)
			.filter((f) => !f.startsWith("."))
			.map((f) => path.join(lang.testPath, f))

		const result = await validator.validateQuery(querySource, testFiles)
		results.push(result)
	}

	return results
}

export function generateValidationReport(results: ValidationResult[]): string {
	let report = "# Tree-sitter Query Validation Report\n\n"

	// Summary Table
	report += "## Summary\n\n"
	report += "| Language | Status | Test Files | Parse Time (ms) | Query Time (ms) |\n"
	report += "|----------|--------|------------|-----------------|-----------------|\n"
	for (const result of results) {
		const status = result.passed ? "✅ PASS" : "❌ FAIL"
		const failingCount = result.testCases.filter((tc) => tc.captures === 0 || tc.missingPatterns.length > 0).length
		report += `| ${result.language} | ${status} | ${result.testCases.length} (${failingCount} failing) | ${result.performance.parseTimeMs.toFixed(2)} | ${result.performance.queryTimeMs.toFixed(2)} |\n`
	}
	report += "\n"

	// Detailed Results per Language
	for (const result of results) {
		report += `## ${result.language.toUpperCase()}\n\n`
		report += `**Status:** ${result.passed ? "✅ PASS" : "❌ FAIL"}\n\n`

		// Performance Summary
		report += "### Performance Summary\n\n"
		report += `- **Total Parse Time:** ${result.performance.parseTimeMs.toFixed(2)} ms\n`
		report += `- **Total Query Time:** ${result.performance.queryTimeMs.toFixed(2)} ms\n`
		report += `- **Average Parse Time per File:** ${(result.performance.parseTimeMs / result.testCases.length).toFixed(2)} ms\n`
		report += `- **Average Query Time per File:** ${(result.performance.queryTimeMs / result.testCases.length).toFixed(2)} ms\n\n`

		// Failing Test Cases
		const failures = result.testCases.filter((tc) => tc.captures === 0 || tc.missingPatterns.length > 0)
		if (failures.length > 0) {
			report += "### ❌ Failing Test Cases\n\n"
			for (const fail of failures) {
				report += `#### ${fail.file}\n\n`
				report += `- **Captures Found:** ${fail.captures}\n`

				if (fail.missingPatterns.length > 0) {
					report += `- **Missing Patterns:**\n`
					for (const pattern of fail.missingPatterns) {
						report += `  - \`${pattern}\`\n`
					}
				}

				if (fail.nodeTypesFound.length > 0) {
					report += `- **Node Types Found:** ${fail.nodeTypesFound.slice(0, 10).join(", ")}${fail.nodeTypesFound.length > 10 ? "..." : ""}\n`
				}

				report += "\n"
			}
		}

		// Passing Test Cases (if any)
		const passingTests = result.testCases.filter((tc) => tc.captures > 0 && tc.missingPatterns.length === 0)
		if (passingTests.length > 0) {
			report += "### ✅ Passing Test Cases\n\n"
			report += "| Test File | Captures | Node Types Found |\n"
			report += "|-----------|----------|-------------------|\n"

			for (const test of passingTests) {
				const nodeTypes = test.nodeTypesFound.slice(0, 5).join(", ")
				const moreTypes = test.nodeTypesFound.length > 5 ? ` (+${test.nodeTypesFound.length - 5} more)` : ""
				report += `| ${test.file} | ${test.captures} | ${nodeTypes}${moreTypes} |\n`
			}
			report += "\n"
		}

		// All Test Cases Summary
		report += "### All Test Cases Summary\n\n"
		report += "| Test File | Status | Captures | Missing Patterns |\n"
		report += "|-----------|--------|----------|------------------|\n"

		for (const test of result.testCases) {
			const status = test.captures > 0 && test.missingPatterns.length === 0 ? "✅ PASS" : "❌ FAIL"
			const missingPatterns =
				test.missingPatterns.length > 0
					? test.missingPatterns.slice(0, 3).join(", ") + (test.missingPatterns.length > 3 ? "..." : "")
					: "None"
			report += `| ${test.file} | ${status} | ${test.captures} | ${missingPatterns} |\n`
		}

		report += "\n---\n\n"
	}

	return report
}
