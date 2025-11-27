import * as fs from "fs"
import * as path from "path"

const TROUBLESHOOTING_URL = "https://github.com/RooCline/Roo-Cline/blob/main/docs/TROUBLESHOOTING.md#wasm-files"

/**
 * Status information for a WASM file
 */
export interface WasmFileStatus {
	filename: string
	exists: boolean
	size: number
	isValid: boolean
	path: string
}

/**
 * Comprehensive diagnostic report for WASM setup
 */
export interface DiagnosticReport {
	wasmDirectory: string
	wasmDirectoryExists: boolean
	criticalFiles: WasmFileStatus[]
	optionalFiles: WasmFileStatus[]
	missingCriticalFiles: string[]
	totalFiles: number
	totalSize: number
	webTreeSitterVersion: string | null
	treeSitterWasmsVersion: string | null
	recommendations: string[]
	isHealthy: boolean
}

/**
 * Result of WASM directory validation
 */
export interface ValidationResult {
	isValid: boolean
	missingCriticalFiles: string[]
	foundFiles: string[]
}

// List of critical WASM files that must be present
const CRITICAL_FILES = [
	"tree-sitter.wasm",
	"tree-sitter-javascript.wasm",
	"tree-sitter-typescript.wasm",
	"tree-sitter-python.wasm",
]

// List of all supported language WASM files
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
	// Note: tree-sitter-xml.wasm excluded - requires separate @tree-sitter-grammars/tree-sitter-xml package
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
function getPackageVersion(packageName: string): string | null {
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
function getFileStatus(wasmDir: string, filename: string): WasmFileStatus {
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
 * Diagnose the WASM setup and return a comprehensive report
 * @param wasmDirectory Optional WASM directory path. If not provided, will attempt to resolve using a lightweight mechanism
 */
export function diagnoseWasmSetup(wasmDirectory?: string): DiagnosticReport {
	// If no directory provided, try to resolve it using a lightweight mechanism
	if (!wasmDirectory) {
		// Try to infer the directory from common locations without calling getWasmDirectory
		const possiblePaths = [
			path.join(__dirname, "..", "..", "dist", "services", "tree-sitter"),
			path.join(__dirname, "..", "..", "out", "services", "tree-sitter"),
			path.join(__dirname, "..", "..", "services", "tree-sitter"),
		]

		// Find the first existing directory
		for (const possiblePath of possiblePaths) {
			if (fs.existsSync(possiblePath) && fs.statSync(possiblePath).isDirectory()) {
				wasmDirectory = possiblePath
				break
			}
		}

		// If still not found, use the first path as a fallback
		if (!wasmDirectory) {
			wasmDirectory = possiblePaths[0]
		}
	}
	const recommendations: string[] = []
	let wasmDirectoryExists = false
	let totalSize = 0
	let totalFiles = 0

	// Check if WASM directory exists
	try {
		const stats = fs.statSync(wasmDirectory)
		wasmDirectoryExists = stats.isDirectory()
	} catch (error) {
		wasmDirectoryExists = false
	}

	// Generate recommendations based on directory existence
	if (!wasmDirectoryExists) {
		recommendations.push("WASM directory not found. Run 'Roo-Cline: Download Tree-sitter WASM Files' command.")
	}

	// Get status for critical files
	const criticalFiles: WasmFileStatus[] = CRITICAL_FILES.map((filename) => {
		const status = getFileStatus(wasmDirectory, filename)
		if (status.exists) {
			totalSize += status.size
			totalFiles++
		}
		return status
	})

	// Get status for optional files (all language files except critical ones)
	const optionalFileNames = ALL_LANGUAGE_FILES.filter(
		(file) => !CRITICAL_FILES.includes(file) && file !== "tree-sitter.wasm",
	)
	const optionalFiles: WasmFileStatus[] = optionalFileNames.map((filename) => {
		const status = getFileStatus(wasmDirectory, filename)
		if (status.exists) {
			totalSize += status.size
			totalFiles++
		}
		return status
	})

	// Identify missing critical files
	const missingCriticalFiles = criticalFiles.filter((file) => !file.exists).map((file) => file.filename)

	// Generate recommendations based on critical files
	if (wasmDirectoryExists && criticalFiles.length === 0) {
		recommendations.push("WASM directory is empty. Run download command.")
	} else if (missingCriticalFiles.length > 0) {
		recommendations.push(`Missing critical WASM files: ${missingCriticalFiles.join(", ")}. Run download command.`)
	}

	// Check for files that are too small (likely corrupted)
	const smallFiles = criticalFiles.filter((file) => file.exists && !file.isValid)
	if (smallFiles.length > 0) {
		recommendations.push(
			`Some WASM files appear corrupted (size < 1KB): ${smallFiles.map((f) => f.filename).join(", ")}. Re-run download command.`,
		)
	}

	// Check for web-tree-sitter package
	const webTreeSitterVersion = getPackageVersion("web-tree-sitter")
	if (!webTreeSitterVersion) {
		recommendations.push("web-tree-sitter package not installed. Run 'pnpm install'.")
	}

	// Check for tree-sitter-wasms package
	const treeSitterWasmsVersion = getPackageVersion("tree-sitter-wasms")

	// Determine if the setup is healthy
	const isHealthy =
		wasmDirectoryExists &&
		missingCriticalFiles.length === 0 &&
		criticalFiles.every((file) => file.isValid) &&
		webTreeSitterVersion !== null

	// Add troubleshooting link if there are any issues
	if (!isHealthy) {
		recommendations.push(`For detailed troubleshooting steps, visit: ${TROUBLESHOOTING_URL}`)
	}

	return {
		wasmDirectory,
		wasmDirectoryExists,
		criticalFiles,
		optionalFiles,
		missingCriticalFiles,
		totalFiles,
		totalSize,
		webTreeSitterVersion,
		treeSitterWasmsVersion,
		recommendations,
		isHealthy,
	}
}

/**
 * Format a diagnostic report as human-readable text
 */
export function formatDiagnosticReport(report: DiagnosticReport): string {
	const lines: string[] = []

	// Header
	lines.push("=== Tree-sitter WASM Diagnostics ===")
	lines.push("")

	// WASM Directory status
	lines.push("WASM Directory:")
	lines.push(`  Path: ${report.wasmDirectory}`)
	lines.push(`  Exists: ${report.wasmDirectoryExists ? "✅" : "❌"}`)
	lines.push("")

	// Critical files status
	lines.push("Critical Files:")
	for (const file of report.criticalFiles) {
		const status = file.exists ? (file.isValid ? "✅" : "⚠️") : "❌"
		const sizeInfo = file.exists ? ` (${(file.size / 1024).toFixed(1)}KB)` : ""
		lines.push(`  ${status} ${file.filename}${sizeInfo}`)
	}
	lines.push("")

	// Optional files summary
	const presentOptionalFiles = report.optionalFiles.filter((f) => f.exists).length
	lines.push(`Optional Files: ${presentOptionalFiles} of ${report.optionalFiles.length} present`)
	lines.push("")

	// Total size
	lines.push(`Total Size: ${(report.totalSize / 1024).toFixed(1)}KB`)
	lines.push("")

	// Package versions
	lines.push("Package Versions:")
	lines.push(`  web-tree-sitter: ${report.webTreeSitterVersion || "❌ Not found"}`)
	lines.push(`  tree-sitter-wasms: ${report.treeSitterWasmsVersion || "❌ Not found"}`)
	lines.push("")

	// Overall health
	lines.push(`Overall Health: ${report.isHealthy ? "✅ Healthy" : "❌ Issues detected"}`)
	lines.push("")

	// Recommendations
	if (report.recommendations.length > 0) {
		lines.push("Recommendations:")
		report.recommendations.forEach((rec, index) => {
			lines.push(`  ${index + 1}. ${rec}`)
		})
	} else {
		lines.push("✅ No issues detected!")
	}

	// Add troubleshooting guide link
	lines.push("")
	lines.push(`📖 Troubleshooting Guide: ${TROUBLESHOOTING_URL}`)

	return lines.join("\n")
}

/**
 * Validate a WASM directory for critical files only
 */
export function validateWasmDirectory(dirPath: string): ValidationResult {
	const missingCriticalFiles: string[] = []
	const foundFiles: string[] = []

	// Check if directory exists
	let directoryExists = false
	try {
		const stats = fs.statSync(dirPath)
		directoryExists = stats.isDirectory()
	} catch (error) {
		// Directory doesn't exist
		return {
			isValid: false,
			missingCriticalFiles: CRITICAL_FILES,
			foundFiles: [],
		}
	}

	// Check for each critical file
	for (const filename of CRITICAL_FILES) {
		const filePath = path.join(dirPath, filename)
		let exists = false
		let isValid = false

		try {
			const stats = fs.statSync(filePath)
			exists = stats.isFile()
			isValid = exists && stats.size > 1024 // Valid if > 1KB
		} catch (error) {
			exists = false
			isValid = false
		}

		if (exists && isValid) {
			foundFiles.push(filename)
		} else {
			missingCriticalFiles.push(filename)
		}
	}

	const isValid = directoryExists && missingCriticalFiles.length === 0

	return {
		isValid,
		missingCriticalFiles,
		foundFiles,
	}
}
