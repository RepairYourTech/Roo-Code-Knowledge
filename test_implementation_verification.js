/**
 * Test script to verify the implementation changes in scanner.ts
 * This script validates that all three verification comments have been correctly implemented.
 */

const fs = require("fs")
const path = require("path")

// Read the scanner.ts file
const scannerPath = path.join(__dirname, "src/services/code-index/processors/scanner.ts")
const scannerContent = fs.readFileSync(scannerPath, "utf8")

console.log("🔍 Verifying implementation changes in scanner.ts...\n")

// Test 1: Filter counts implementation
console.log("✅ Test 1: Filter counts implementation")
const filterCountChecks = [
	{
		name: "ignoredDirCount initialized",
		pattern: /let ignoredDirCount = 0/,
		found: scannerContent.includes("let ignoredDirCount = 0"),
	},
	{
		name: "unsupportedExtCount initialized",
		pattern: /let unsupportedExtCount = 0/,
		found: scannerContent.includes("let unsupportedExtCount = 0"),
	},
	{
		name: "gitignoreCount initialized",
		pattern: /let gitignoreCount = 0/,
		found: scannerContent.includes("let gitignoreCount = 0"),
	},
	{
		name: "ignoredDirCount incremented",
		pattern: /ignoredDirCount\+\+/,
		found: scannerContent.includes("ignoredDirCount++"),
	},
	{
		name: "unsupportedExtCount incremented",
		pattern: /unsupportedExtCount\+\+/,
		found: scannerContent.includes("unsupportedExtCount++"),
	},
	{
		name: "gitignoreCount incremented",
		pattern: /gitignoreCount\+\+/,
		found: scannerContent.includes("gitignoreCount++"),
	},
	{
		name: "Summary log includes ignoredDirCount",
		pattern: /Files filtered by ignored directories: \${ignoredDirCount}/,
		found: scannerContent.includes("Files filtered by ignored directories: ${ignoredDirCount}"),
	},
	{
		name: "Summary log includes unsupportedExtCount",
		pattern: /Files filtered by unsupported extensions: \${unsupportedExtCount}/,
		found: scannerContent.includes("Files filtered by unsupported extensions: ${unsupportedExtCount}"),
	},
	{
		name: "Summary log includes gitignoreCount",
		pattern: /Files filtered by \.gitignore: \${gitignoreCount}/,
		found: scannerContent.includes("Files filtered by .gitignore: ${gitignoreCount}"),
	},
]

filterCountChecks.forEach((check) => {
	console.log(`  ${check.found ? "✅" : "❌"} ${check.name}`)
})

// Test 2: 0-block diagnostics implementation
console.log("\n✅ Test 2: 0-block diagnostics implementation")
const zeroBlockChecks = [
	{
		name: "Conditional check for fileBlockCount === 0",
		pattern: /if \(fileBlockCount === 0\)/,
		found: scannerContent.includes("if (fileBlockCount === 0)"),
	},
	{
		name: 'Warning message with "parsed but generated 0 blocks"',
		pattern: /WARNING: File parsed but generated 0 blocks/,
		found: scannerContent.includes("WARNING: File parsed but generated 0 blocks"),
	},
	{
		name: "Includes file path in warning",
		pattern: /\${filePath}/,
		found: scannerContent.includes("${filePath}"),
	},
	{
		name: "Includes file extension in warning",
		pattern: /\${fileExtension}/,
		found: scannerContent.includes("${fileExtension}"),
	},
	{
		name: "Includes file size in warning",
		pattern: /\${fileSize}/,
		found: scannerContent.includes("${fileSize}"),
	},
	{
		name: "Success log preserved for non-zero blocks",
		pattern: /Successfully parsed file.*code blocks found/,
		found: scannerContent.includes("Successfully parsed file") && scannerContent.includes("code blocks found"),
	},
]

zeroBlockChecks.forEach((check) => {
	console.log(`  ${check.found ? "✅" : "❌"} ${check.name}`)
})

// Test 3: Verbose logging implementation
console.log("\n✅ Test 3: Verbose logging implementation")
const verboseLoggingChecks = [
	{
		name: "verboseLogging parameter in constructor",
		pattern: /verboseLogging\?\: boolean/,
		found: scannerContent.includes("verboseLogging?: boolean"),
	},
	{
		name: "verboseLogging stored as member variable",
		pattern: /private verboseLogging: boolean = false/,
		found: scannerContent.includes("private verboseLogging: boolean = false"),
	},
	{
		name: "verboseLogging initialized in constructor",
		pattern: /this\.verboseLogging = verboseLogging \|\| false/,
		found: scannerContent.includes("this.verboseLogging = verboseLogging || false"),
	},
	{
		name: "Per-file logs gated behind verboseLogging",
		pattern: /if \(this\.verboseLogging\)/,
		found: (scannerContent.match(/if \(this\.verboseLogging\)/g) || []).length >= 3,
	},
	{
		name: "Summary logs remain unconditional",
		pattern: /this\.log\(`\[DirectoryScanner\] Scan summary:/,
		found: scannerContent.includes("this.log(`[DirectoryScanner] Scan summary:"),
	},
]

verboseLoggingChecks.forEach((check) => {
	console.log(`  ${check.found ? "✅" : "❌"} ${check.name}`)
})

// Summary
const allChecks = [...filterCountChecks, ...zeroBlockChecks, ...verboseLoggingChecks]
const passedChecks = allChecks.filter((check) => check.found).length
const totalChecks = allChecks.length

console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed`)

if (passedChecks === totalChecks) {
	console.log("🎉 All implementation changes have been correctly verified!")
} else {
	console.log("⚠️  Some implementation changes may be missing or incorrect.")
	process.exit(1)
}
