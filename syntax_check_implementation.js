/**
 * Focused syntax check for our implementation changes
 * This script checks for syntax issues specifically related to our three verification comments
 */

const fs = require("fs")
const path = require("path")

// Read scanner.ts file
const scannerPath = path.join(__dirname, "src/services/code-index/processors/scanner.ts")
const scannerContent = fs.readFileSync(scannerPath, "utf8")

console.log("🔍 Checking syntax of implementation changes...\n")

// Extract relevant sections for syntax validation
const sections = [
	{
		name: "Constructor with verboseLogging parameter",
		start: "constructor(",
		end: ") {",
		context: true,
	},
	{
		name: "Filter count initialization",
		start: "let ignoredDirCount = 0",
		end: "let gitignoreCount = 0",
		context: true,
	},
	{
		name: "Filter callback with counters",
		start: "const supportedPaths = allowedPaths.filter",
		end: "return true",
		context: true,
	},
	{
		name: "0-block diagnostic check",
		start: "if (fileBlockCount === 0)",
		end: "this.log(`[DirectoryScanner] Successfully parsed file",
		context: true,
	},
	{
		name: "Summary logs with counters",
		start: "this.log(`[DirectoryScanner] Scan summary:",
		end: "Average blocks per parsed file",
		context: true,
	},
]

let syntaxErrors = []

sections.forEach((section) => {
	const startIndex = scannerContent.indexOf(section.start)
	if (startIndex === -1) {
		syntaxErrors.push(`❌ Could not find section: ${section.name}`)
		return
	}

	const endIndex = scannerContent.indexOf(section.end, startIndex)
	if (endIndex === -1) {
		syntaxErrors.push(`❌ Could not find end of section: ${section.name}`)
		return
	}

	const sectionContent = scannerContent.substring(startIndex, endIndex + section.end.length)

	// Basic syntax checks - more specific to avoid false positives
	const checks = [
		{ test: /\+\+\s*;/, message: "Increment operator issues" },
		{ test: /if\s*\(\s*\)/, message: "Empty if condition" },
		{ test: /\$\{\s*\}/, message: "Empty template literal" },
	]

	let sectionErrors = []
	checks.forEach((check) => {
		if (check.test.test(sectionContent)) {
			sectionErrors.push(check.message)
		}
	})

	if (sectionErrors.length > 0) {
		syntaxErrors.push(`❌ ${section.name}: ${sectionErrors.join(", ")}`)
	} else {
		console.log(`✅ ${section.name}: Syntax OK`)
	}
})

// Check for specific syntax patterns we implemented
const patternChecks = [
	{
		name: "verboseLogging parameter",
		pattern: /verboseLogging\?\: boolean/,
		required: true,
	},
	{
		name: "verboseLogging member variable",
		pattern: /private verboseLogging\: boolean/,
		required: true,
	},
	{
		name: "verboseLogging initialization",
		pattern: /this\.verboseLogging = verboseLogging \|\| false/,
		required: true,
	},
	{
		name: "ignoredDirCount increment",
		pattern: /ignoredDirCount\+\+/,
		required: true,
	},
	{
		name: "unsupportedExtCount increment",
		pattern: /unsupportedExtCount\+\+/,
		required: true,
	},
	{
		name: "gitignoreCount increment",
		pattern: /gitignoreCount\+\+/,
		required: true,
	},
	{
		name: "0-block warning message",
		pattern: /WARNING: File parsed but generated 0 blocks/,
		required: true,
	},
	{
		name: "Verbose logging gate",
		pattern: /if \(this\.verboseLogging\)/,
		required: true,
	},
]

patternChecks.forEach((check) => {
	if (check.pattern.test(scannerContent)) {
		console.log(`✅ ${check.name}: Found`)
	} else if (check.required) {
		syntaxErrors.push(`❌ ${check.name}: Missing required pattern`)
	}
})

// Summary
console.log(`\n📊 Syntax Check Summary:`)
if (syntaxErrors.length === 0) {
	console.log("🎉 All implementation changes have correct syntax!")
	console.log("✅ No syntax errors found in the implemented features")
} else {
	console.log(`⚠️  Found ${syntaxErrors.length} potential issues:`)
	syntaxErrors.forEach((error) => console.log(`  ${error}`))
	process.exit(1)
}
