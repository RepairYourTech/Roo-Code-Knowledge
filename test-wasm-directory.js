#!/usr/bin/env node

// Enhanced WASM directory validation script with comprehensive diagnostics
const fs = require("fs")
const path = require("path")

// ANSI color codes for terminal output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
}

// Helper function for colored output
function colorLog(message, color = "reset") {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

// Critical WASM files that must be present
const CRITICAL_FILES = [
	"tree-sitter.wasm",
	"tree-sitter-javascript.wasm",
	"tree-sitter-typescript.wasm",
	"tree-sitter-python.wasm",
]

// All supported language WASM files
const ALL_LANGUAGE_FILES = [
	"tree-sitter-javascript.wasm",
	"tree-sitter-typescript.wasm",
	"tree-sitter-tsx.wasm",
	"tree-sitter-python.wasm",
	"tree-sitter-rust.wasm",
	"tree-sitter-go.wasm",
	"tree-sitter-cpp.wasm",
	"tree-sitter-c.wasm",
	"tree-sitter-c_sharp.wasm",
	"tree-sitter-ruby.wasm",
	"tree-sitter-java.wasm",
	"tree-sitter-php.wasm",
	"tree-sitter-swift.wasm",
	"tree-sitter-kotlin.wasm",
	"tree-sitter-css.wasm",
	"tree-sitter-html.wasm",
	"tree-sitter-ocaml.wasm",
	"tree-sitter-mli.wasm",
	"tree-sitter-scala.wasm",
	"tree-sitter-solidity.wasm",
	"tree-sitter-toml.wasm",
	"tree-sitter-xml.wasm",
	"tree-sitter-yaml.wasm",
	"tree-sitter-vue.wasm",
	"tree-sitter-lua.wasm",
	"tree-sitter-systemrdl.wasm",
	"tree-sitter-tlaplus.wasm",
	"tree-sitter-zig.wasm",
	"tree-sitter-ejs.wasm",
	"tree-sitter-erb.wasm",
	"tree-sitter-elisp.wasm",
	"tree-sitter-elixir.wasm",
]

/**
 * Get the version of a package from its package.json
 */
function getPackageVersion(packageName) {
	try {
		const packagePath = require.resolve(`${packageName}/package.json`)
		const packageJson = require(packagePath)
		return packageJson.version || null
	} catch (error) {
		return null
	}
}

/**
 * Get file status information for a WASM file
 */
function getFileStatus(wasmDir, filename) {
	const filePath = path.join(wasmDir, filename)
	let exists = false
	let size = 0
	let isValid = false

	try {
		const stats = fs.statSync(filePath)
		exists = stats.isFile()
		size = stats.size
		// Consider a file valid if it exists and is larger than 1KB (1024 bytes)
		isValid = exists && size > 1024
	} catch (error) {
		// File doesn't exist or can't be accessed
		exists = false
		size = 0
		isValid = false
	}

	return {
		filename,
		exists,
		size,
		isValid,
		path: filePath,
	}
}

/**
 * Detect if running in development vs production environment
 */
function detectEnvironment() {
	const isDev =
		fs.existsSync(path.join(process.cwd(), "src")) && fs.existsSync(path.join(process.cwd(), "package.json"))

	const hasNodeModules = fs.existsSync(path.join(process.cwd(), "node_modules"))

	return {
		isDevelopment: isDev,
		hasNodeModules: hasNodeModules,
		environment: isDev ? "development" : "production",
	}
}

/**
 * Find the WASM directory using the new resolution order
 */
function findWasmDirectory() {
	const rootDir = process.cwd()

	// Candidate paths matching the resolution order in get-wasm-directory.ts
	// Resolution order:
	// 1. Production builds (dist/services/tree-sitter)
	// 2. Monorepo development builds (src/dist/services/tree-sitter)
	// 3. Alternative build outputs (out/services/tree-sitter)
	// 4. Direct path (services/tree-sitter)
	// 5. Source path for development (src/services/tree-sitter) - fallback for dev environments
	const candidatePaths = [
		path.join(rootDir, "dist", "services", "tree-sitter"), // Production
		path.join(rootDir, "src", "dist", "services", "tree-sitter"), // Monorepo dev
		path.join(rootDir, "out", "services", "tree-sitter"), // Alternative build output
		path.join(rootDir, "services", "tree-sitter"), // Direct path
		path.join(rootDir, "src", "services", "tree-sitter"), // Development fallback
	]

	for (const candidatePath of candidatePaths) {
		if (fs.existsSync(candidatePath)) {
			return candidatePath
		}
	}

	return null
}

/**
 * Calculate health score based on file presence and validity
 */
function calculateHealthScore(criticalFiles, optionalFiles) {
	const totalExpected = CRITICAL_FILES.length + ALL_LANGUAGE_FILES.length
	const validCritical = criticalFiles.filter((f) => f.isValid).length
	const validOptional = optionalFiles.filter((f) => f.isValid).length
	const totalValid = validCritical + validOptional

	return Math.round((totalValid / totalExpected) * 100)
}

/**
 * Generate troubleshooting suggestions based on issues found
 */
function generateTroubleshootingSuggestions(report) {
	const suggestions = []

	if (!report.wasmDirectoryExists) {
		suggestions.push({
			issue: "WASM directory not found",
			solution: 'Run the VS Code command "Roo-Cline: Download Tree-sitter WASM Files"',
			command: "pnpm download-wasms",
		})
	}

	if (report.missingCriticalFiles.length > 0) {
		suggestions.push({
			issue: `Missing critical files: ${report.missingCriticalFiles.join(", ")}`,
			solution: "Download missing WASM files",
			command: "pnpm download-wasms",
		})
	}

	const invalidFiles = report.criticalFiles.filter((f) => f.exists && !f.isValid)
	if (invalidFiles.length > 0) {
		suggestions.push({
			issue: `Invalid files (too small): ${invalidFiles.map((f) => f.filename).join(", ")}`,
			solution: "Re-download WASM files to fix corruption",
			command: "pnpm download-wasms",
		})
	}

	if (!report.webTreeSitterVersion) {
		suggestions.push({
			issue: "web-tree-sitter package not found",
			solution: "Install required dependencies",
			command: "pnpm install",
		})
	}

	if (!report.treeSitterWasmsVersion) {
		suggestions.push({
			issue: "tree-sitter-wasms package not found",
			solution: "Install WASM package for development",
			command: "pnpm install",
		})
	}

	return suggestions
}

/**
 * Main diagnostic function
 */
function diagnoseWasmSetup() {
	colorLog("\n=== Tree-sitter WASM Diagnostics ===", "cyan")
	console.log("")

	const env = detectEnvironment()
	colorLog(`Environment: ${env.environment.toUpperCase()}`, "blue")
	colorLog(`Node Modules: ${env.hasNodeModules ? "Present" : "Missing"}`, "blue")
	console.log("")

	// Directory Resolution Section
	colorLog("📁 Directory Resolution", "yellow")
	const wasmDirectory = findWasmDirectory()
	const wasmDirectoryExists = wasmDirectory !== null

	if (wasmDirectoryExists) {
		colorLog(`  ✅ Found: ${wasmDirectory}`, "green")
	} else {
		colorLog("  ❌ WASM directory not found in expected locations", "red")
		colorLog("  🔍 Searched paths:", "yellow")
		const rootDir = process.cwd()
		;[
			path.join(rootDir, "dist", "services", "tree-sitter"),
			path.join(rootDir, "src", "dist", "services", "tree-sitter"),
			path.join(rootDir, "out", "services", "tree-sitter"),
			path.join(rootDir, "services", "tree-sitter"),
			path.join(rootDir, "src", "services", "tree-sitter"),
		].forEach((p) => colorLog(`    - ${p}`, "white"))
	}
	console.log("")

	// Get package versions
	const webTreeSitterVersion = getPackageVersion("web-tree-sitter")
	const treeSitterWasmsVersion = getPackageVersion("tree-sitter-wasms")

	// Package Information Section
	colorLog("📦 Package Information", "yellow")
	colorLog(`  web-tree-sitter: ${webTreeSitterVersion || "❌ Not found"}`, webTreeSitterVersion ? "green" : "red")
	colorLog(
		`  tree-sitter-wasms: ${treeSitterWasmsVersion || "❌ Not found"}`,
		treeSitterWasmsVersion ? "green" : "red",
	)
	console.log("")

	if (!wasmDirectoryExists) {
		colorLog("❌ Cannot proceed without WASM directory", "red")
		return {
			wasmDirectory,
			wasmDirectoryExists,
			criticalFiles: [],
			optionalFiles: [],
			missingCriticalFiles: CRITICAL_FILES,
			totalFiles: 0,
			totalSize: 0,
			webTreeSitterVersion,
			treeSitterWasmsVersion,
			healthScore: 0,
		}
	}

	// Get status for critical files
	const criticalFiles = CRITICAL_FILES.map((filename) => {
		return getFileStatus(wasmDirectory, filename)
	})

	// Get status for optional files
	const optionalFileNames = ALL_LANGUAGE_FILES.filter(
		(file) => !CRITICAL_FILES.includes(file) && file !== "tree-sitter.wasm",
	)
	const optionalFiles = optionalFileNames.map((filename) => {
		return getFileStatus(wasmDirectory, filename)
	})

	// Critical Files Section
	colorLog("🔴 Critical Files", "yellow")
	criticalFiles.forEach((file) => {
		const status = file.exists ? (file.isValid ? "✅" : "⚠️") : "❌"
		const sizeInfo = file.exists ? ` (${(file.size / 1024).toFixed(1)}KB)` : ""
		const color = file.exists ? (file.isValid ? "green" : "yellow") : "red"
		colorLog(`  ${status} ${file.filename}${sizeInfo}`, color)
	})
	console.log("")

	// Optional Files Section
	const presentOptionalFiles = optionalFiles.filter((f) => f.exists).length
	colorLog(`🟡 Optional Files: ${presentOptionalFiles} of ${optionalFiles.length} present`, "yellow")
	if (presentOptionalFiles > 0) {
		const presentList = optionalFiles.filter((f) => f.exists).slice(0, 10)
		presentList.forEach((file) => {
			const sizeInfo = ` (${(file.size / 1024).toFixed(1)}KB)`
			colorLog(`  ✅ ${file.filename}${sizeInfo}`, "green")
		})
		if (presentOptionalFiles > 10) {
			colorLog(`  ... and ${presentOptionalFiles - 10} more`, "white")
		}
	}
	console.log("")

	// Calculate totals
	const totalFiles = criticalFiles.filter((f) => f.exists).length + optionalFiles.filter((f) => f.exists).length
	const totalSize = [...criticalFiles, ...optionalFiles].reduce((sum, file) => sum + (file.exists ? file.size : 0), 0)
	const missingCriticalFiles = criticalFiles.filter((f) => !f.exists || !f.isValid).map((f) => f.filename)
	const healthScore = calculateHealthScore(criticalFiles, optionalFiles)

	// Summary Section
	colorLog("📊 Summary", "yellow")
	colorLog(`  Total Files: ${totalFiles}`, "white")
	colorLog(`  Total Size: ${(totalSize / 1024).toFixed(1)}KB`, "white")
	colorLog(
		`  WASM Setup Health: ${healthScore}% (${totalFiles}/${CRITICAL_FILES.length + optionalFiles.length} files valid)`,
		healthScore >= 80 ? "green" : healthScore >= 50 ? "yellow" : "red",
	)
	console.log("")

	// Troubleshooting Section
	const report = {
		wasmDirectory,
		wasmDirectoryExists,
		criticalFiles,
		optionalFiles,
		missingCriticalFiles,
		totalFiles,
		totalSize,
		webTreeSitterVersion,
		treeSitterWasmsVersion,
		healthScore,
	}

	const suggestions = generateTroubleshootingSuggestions(report)
	if (suggestions.length > 0) {
		colorLog("🔧 Troubleshooting Suggestions", "yellow")
		suggestions.forEach((suggestion, index) => {
			colorLog(`  ${index + 1}. Issue: ${suggestion.issue}`, "red")
			colorLog(`     Solution: ${suggestion.solution}`, "white")
			if (suggestion.command) {
				colorLog(`     Command: ${suggestion.command}`, "cyan")
			}
			console.log("")
		})
	} else {
		colorLog("✅ No issues detected!", "green")
	}

	return report
}

/**
 * Main function
 */
function testWasmDirectoryResolution() {
	try {
		const report = diagnoseWasmSetup()

		// Exit with appropriate code
		if (report.healthScore < 50) {
			colorLog("\n❌ WASM setup has serious issues. Please follow the troubleshooting suggestions above.", "red")
			process.exit(1)
		} else if (report.healthScore < 80) {
			colorLog(
				"\n⚠️ WASM setup has some issues. Consider following the suggestions for optimal performance.",
				"yellow",
			)
			process.exit(0)
		} else {
			colorLog("\n🎉 WASM setup is healthy!", "green")
			process.exit(0)
		}
	} catch (error) {
		colorLog(`\n❌ Test failed: ${error.message}`, "red")
		console.error(error.stack)
		process.exit(1)
	}
}

// Run the test if this script is executed directly
if (require.main === module) {
	testWasmDirectoryResolution()
}

module.exports = {
	testWasmDirectoryResolution,
	diagnoseWasmSetup,
	findWasmDirectory,
	getFileStatus,
	detectEnvironment,
}
