#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

// Expected languages from download-tree-sitter-wasms.ts
const expectedLanguages = [
	"javascript",
	"typescript",
	"tsx",
	"python",
	"rust",
	"go",
	"cpp",
	"c",
	"c_sharp", // Note: c-sharp in queries, but c_sharp in file naming
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

function main() {
	const staticDir = path.join(__dirname, "..", "src", "wasms", "tree-sitter")
	const distDir = path.join(__dirname, "..", "src", "dist", "services", "tree-sitter")

	// Check static bundled directory (primary source)
	if (!fs.existsSync(staticDir)) {
		console.error("❌ Static WASM directory not found:", staticDir)
		console.error("💡 This directory should contain committed WASM files")
		console.error("💡 Run: pnpm regenerate-wasms, then copy files to src/wasms/tree-sitter/")
		process.exit(1)
	}

	console.log("📁 Static WASM directory:", staticDir)
	const staticWasms = fs.readdirSync(staticDir).filter((f) => f.endsWith(".wasm"))
	console.log("🔍 Found", staticWasms.length, "WASM files in static directory")

	// Check if any files exist in static directory
	if (staticWasms.length === 0) {
		console.error("❌ No WASM files found in static directory!")
		console.error("💡 Run: pnpm regenerate-wasms")
		console.error("💡 Then: cp dist/services/tree-sitter/*.wasm src/wasms/tree-sitter/")
		console.error("💡 Finally: git add src/wasms/tree-sitter/*.wasm && git commit")
		process.exit(1)
	}

	// Use static directory files for validation
	const wasms = staticWasms
	const dir = staticDir

	// Check for core parser
	const hasCoreWasm = wasms.includes("tree-sitter.wasm")
	if (!hasCoreWasm) {
		console.error("❌ Core parser tree-sitter.wasm is missing!")
		console.error("💡 Run: pnpm regenerate-wasms")
		console.error("💡 Then: cp dist/services/tree-sitter/*.wasm src/wasms/tree-sitter/")
		process.exit(1)
	}

	// Count language-specific files
	const languageWasms = wasms.filter((f) => f.startsWith("tree-sitter-") && f !== "tree-sitter.wasm")
	console.log("🎯 Found", languageWasms.length, "language-specific WASM files")

	const expectedCount = expectedLanguages.length
	const totalExpected = expectedCount + 1 // +1 for core parser
	console.log("✅ Expected:", totalExpected, "WASM files (1 core +", expectedCount, "languages)")

	// Calculate missing ratio and validate
	const missingRatio = (expectedCount - languageWasms.length) / expectedCount
	if (missingRatio >= 0.5) {
		console.error("❌ Significantly fewer language WASM files than expected!")
		console.error("   Expected:", expectedCount, "languages, Found:", languageWasms.length)
		console.error("   This indicates missing language parsers that will affect code parsing functionality.")
		console.error("💡 To fix this issue:")
		console.error("   1. Run: pnpm regenerate-wasms")
		console.error("   2. Copy: cp dist/services/tree-sitter/*.wasm src/wasms/tree-sitter/")
		console.error("   3. Commit: git add src/wasms/tree-sitter/*.wasm && git commit")
		process.exit(1)
	}

	// Success
	console.log("✅ Static WASM files validation passed!")
	console.log("📋 Files found in src/wasms/tree-sitter/:")
	staticWasms.forEach((file) => console.log("   -", file))

	// Optional: Check dist directory (post-build verification)
	if (fs.existsSync(distDir)) {
		const distWasms = fs.readdirSync(distDir).filter((f) => f.endsWith(".wasm"))
		console.log("\n📦 Build output check: Found", distWasms.length, "WASM files in dist/services/tree-sitter/")
	}
}

if (require.main === module) {
	main()
}
