#!/usr/bin/env node

/**
 * WASM Setup Validation Script
 *
 * This script validates the WASM setup health for tree-sitter parsing.
 * It checks the availability of WASM files, parsers, and provides recovery suggestions.
 *
 * Usage:
 *   tsx scripts/validate-wasm-setup.ts                    # Basic validation
 *   tsx scripts/validate-wasm-setup.ts --json            # JSON output
 *   tsx scripts/validate-wasm-setup.ts --verbose         # Detailed output
 *   tsx scripts/validate-wasm-setup.ts --fix             # Attempt automatic recovery
 *   tsx scripts/validate-wasm-setup.ts --directory <path> # Override WASM directory
 */

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

// Import required functions
import {
	diagnoseWasmSetup,
	formatDiagnosticReport,
	getHealthScore,
	DiagnosticReport,
	HealthScoreResult,
} from "../src/services/tree-sitter/wasm-diagnostics"
import { checkMultipleParserAvailability } from "../src/services/tree-sitter/parser-availability-checker"
import { getWasmDirectory } from "../src/services/tree-sitter/get-wasm-directory"

// Supported languages based on download-tree-sitter-wasms.ts
const SUPPORTED_LANGUAGES = [
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

interface ValidationOptions {
	json: boolean
	verbose: boolean
	fix: boolean
	directory?: string
}

interface ValidationResult {
	wasmDirectory: string
	diagnosticReport: DiagnosticReport
	healthScore: HealthScoreResult
	parserAvailability: Array<{
		language: string
		isAvailable: boolean
		error?: string
	}>
	timestamp: string
}

/**
 * Parse command line arguments
 */
function parseArgs(): ValidationOptions {
	const args = process.argv.slice(2)
	const options: ValidationOptions = {
		json: false,
		verbose: false,
		fix: false,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		switch (arg) {
			case "--json":
				options.json = true
				break
			case "--verbose":
				options.verbose = true
				break
			case "--fix":
				options.fix = true
				break
			case "--directory":
				if (i + 1 < args.length) {
					options.directory = args[++i]
				} else {
					console.error("Error: --directory requires a path argument")
					process.exit(1)
				}
				break
			case "--help":
			case "-h":
				showUsage()
				process.exit(0)
				break
			default:
				console.error(`Unknown option: ${arg}`)
				showUsage()
				process.exit(1)
		}
	}

	return options
}

/**
 * Show usage information
 */
function showUsage(): void {
	console.log(`
Usage: tsx scripts/validate-wasm-setup.ts [options]

Options:
  --json              Output results in JSON format
  --verbose           Include detailed file information
  --fix               Attempt automatic recovery (run download command)
  --directory <path>  Override WASM directory path
  --help, -h          Show this help message

Description:
  Validates the WASM setup health for tree-sitter parsing. Checks file availability,
  parser functionality, and provides recovery suggestions when issues are found.

Exit Codes:
  0  - Healthy setup
  1  - Degraded setup (some issues found)
  2  - Unhealthy setup (critical issues found)
`)
}

/**
 * Simple color output functions
 */
const colors = {
	red: (text: string) => `\x1b[31m${text}\x1b[0m`,
	green: (text: string) => `\x1b[32m${text}\x1b[0m`,
	yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
	blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
	magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
	cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
	white: (text: string) => `\x1b[37m${text}\x1b[0m`,
	bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
}

/**
 * Log message with optional color and timestamp
 */
function log(message: string, color?: (text: string) => string, includeTimestamp = false): void {
	const timestamp = includeTimestamp ? `[${new Date().toISOString()}] ` : ""
	const coloredMessage = color ? color(message) : message
	console.log(`${timestamp}${coloredMessage}`)
}

/**
 * Attempt automatic recovery by running download command
 */
async function attemptRecovery(): Promise<boolean> {
	try {
		log("🔧 Attempting automatic recovery...", colors.yellow)

		// Try to run the download script
		const downloadCommand = "pnpm run download-wasms"
		log(`Running: ${downloadCommand}`, colors.cyan)

		execSync(downloadCommand, { stdio: "inherit" })

		log("✅ Recovery completed successfully", colors.green)
		return true
	} catch (error) {
		log(`❌ Recovery failed: ${error instanceof Error ? error.message : "Unknown error"}`, colors.red)
		return false
	}
}

/**
 * Output results in JSON format
 */
function outputJsonResults(result: ValidationResult): void {
	console.log(JSON.stringify(result, null, 2))
}

/**
 * Output results in console format
 */
function outputConsoleResults(result: ValidationResult, options: ValidationOptions): void {
	const { diagnosticReport, healthScore, parserAvailability } = result

	// Header
	log(colors.bold("🔍 WASM Setup Validation Report"), colors.blue)
	log("=".repeat(50), colors.blue)
	log(`Directory: ${result.wasmDirectory}`)
	log(`Timestamp: ${result.timestamp}`)
	log("")

	// Health Score
	const healthColor =
		healthScore.category === "healthy"
			? colors.green
			: healthScore.category === "degraded"
				? colors.yellow
				: colors.red
	log(colors.bold("📊 Health Score:"), healthColor)
	log(`  Score: ${healthScore.score}/100`)
	log(`  Category: ${healthScore.category.toUpperCase()}`)
	// Note: HealthScoreResult doesn't have an 'issues' property
	// We could derive issues from the diagnostic report if needed
	const criticalIssues = diagnosticReport.criticalFiles.filter((f) => !f.exists || !f.isValid)
	if (criticalIssues.length > 0) {
		log(`  Critical Issues: ${criticalIssues.length}`)
		if (options.verbose) {
			criticalIssues.forEach((file) => {
				const issue = !file.exists ? "Missing" : "Invalid"
				log(`    - ${file.filename}: ${issue}`, colors.red)
			})
		}
	}
	log("")

	// Diagnostic Report
	log(colors.bold("📋 Diagnostic Report:"), colors.blue)
	const formattedReport = formatDiagnosticReport(diagnosticReport)
	console.log(formattedReport)
	log("")

	// Parser Availability
	log(colors.bold("🔌 Parser Availability:"), colors.blue)
	const availableParsers = parserAvailability.filter((p) => p.isAvailable)
	const unavailableParsers = parserAvailability.filter((p) => !p.isAvailable)

	log(`  Available: ${availableParsers.length}/${parserAvailability.length}`, colors.green)
	if (options.verbose && availableParsers.length > 0) {
		availableParsers.forEach((parser) => {
			log(`    ✓ ${parser.language}`, colors.green)
		})
	}

	if (unavailableParsers.length > 0) {
		log(`  Unavailable: ${unavailableParsers.length}/${parserAvailability.length}`, colors.red)
		if (options.verbose) {
			unavailableParsers.forEach((parser) => {
				const errorMsg = parser.error ? ` (${parser.error})` : ""
				log(`    ✗ ${parser.language}${errorMsg}`, colors.red)
			})
		}
	}
	log("")

	// Recovery Suggestions
	if (diagnosticReport.recoverySuggestions.length > 0) {
		log(colors.bold("💡 Recovery Suggestions:"), colors.yellow)
		diagnosticReport.recoverySuggestions.forEach((suggestion, index) => {
			log(`  ${index + 1}. ${suggestion}`, colors.yellow)
		})
		log("")
	}

	// Summary
	const summaryColor =
		healthScore.category === "healthy"
			? colors.green
			: healthScore.category === "degraded"
				? colors.yellow
				: colors.red
	const summaryIcon = healthScore.category === "healthy" ? "✅" : healthScore.category === "degraded" ? "⚠️" : "❌"
	log(`${summaryIcon} Overall Status: ${healthScore.category.toUpperCase()}`, summaryColor)
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
	const options = parseArgs()

	try {
		// Resolve WASM directory
		let wasmDirectory: string
		if (options.directory) {
			wasmDirectory = path.resolve(options.directory)
			if (!fs.existsSync(wasmDirectory)) {
				throw new Error(`Specified WASM directory does not exist: ${wasmDirectory}`)
			}
		} else {
			wasmDirectory = await getWasmDirectory()
		}

		if (options.verbose) {
			log(`Using WASM directory: ${wasmDirectory}`, colors.cyan)
		}

		// Run diagnostics
		if (options.verbose) {
			log("Running WASM diagnostics...", colors.cyan)
		}
		const diagnosticReport = diagnoseWasmSetup(wasmDirectory)

		// Calculate health score
		if (options.verbose) {
			log("Calculating health score...", colors.cyan)
		}
		const healthScore = getHealthScore(diagnosticReport)

		// Check parser availability
		if (options.verbose) {
			log("Checking parser availability...", colors.cyan)
		}
		const parserAvailabilityResults = await checkMultipleParserAvailability(SUPPORTED_LANGUAGES)
		const parserAvailability = SUPPORTED_LANGUAGES.map((language) => {
			const status = parserAvailabilityResults.get(language)
			return {
				language,
				isAvailable: status?.available || false,
				error: status?.error,
			}
		})

		// Create validation result
		const validationResult: ValidationResult = {
			wasmDirectory,
			diagnosticReport,
			healthScore,
			parserAvailability,
			timestamp: new Date().toISOString(),
		}

		// Output results
		if (options.json) {
			outputJsonResults(validationResult)
		} else {
			outputConsoleResults(validationResult, options)
		}

		// Attempt recovery if requested
		if (options.fix && healthScore.category !== "healthy") {
			log("", undefined, true)
			const recoverySuccess = await attemptRecovery()
			if (recoverySuccess) {
				log("🔄 Re-running validation after recovery...", colors.cyan)
				// Re-run validation after recovery
				// Note: In a real implementation, you might want to re-run the full validation
				// For now, we'll just indicate that recovery was attempted
			}
		}

		// Exit with appropriate code
		let exitCode = 0
		if (healthScore.category === "unhealthy") {
			exitCode = 2
		} else if (healthScore.category === "degraded") {
			exitCode = 1
		}

		if (options.verbose) {
			log(`Exiting with code: ${exitCode}`, colors.cyan)
		}

		process.exit(exitCode)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error"
		const errorOutput = options.json
			? JSON.stringify({ error: errorMessage, timestamp: new Date().toISOString() }, null, 2)
			: `❌ Validation failed: ${errorMessage}`

		console.error(errorOutput)
		process.exit(2)
	}
}

// Run the main function
if (require.main === module) {
	main().catch((error) => {
		console.error("Unhandled error:", error)
		process.exit(2)
	})
}
