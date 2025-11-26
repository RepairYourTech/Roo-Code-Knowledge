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
	const dir = path.join(__dirname, "..", "src", "services", "tree-sitter")

	// Check if directory exists
	if (!fs.existsSync(dir)) {
		console.error("❌ WASM directory not found:", dir)
		console.error("💡 Run: pnpm download-wasms")
		process.exit(1)
	}

	console.log("📁 WASM directory:", dir)

	// Get all .wasm files
	const wasms = fs.readdirSync(dir).filter((f) => f.endsWith(".wasm"))
	console.log("🔍 Found", wasms.length, "WASM files")

	// Check if any files exist
	if (wasms.length === 0) {
		console.error("❌ No WASM files found!")
		console.error("💡 Run: pnpm download-wasms locally and commit the resulting .wasm files")
		process.exit(1)
	}

	// Check for core parser
	const hasCoreWasm = wasms.includes("tree-sitter.wasm")
	if (!hasCoreWasm) {
		console.error("❌ Core parser tree-sitter.wasm is missing!")
		console.error("💡 Run: pnpm download-wasms locally and commit the resulting .wasm files")
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
		console.error("   1. Run: pnpm download-wasms")
		console.error("   2. Commit the generated .wasm files to your repository")
		process.exit(1)
	}

	// Success
	console.log("✅ WASM files validation passed!")
	console.log("📋 Files found:")
	wasms.forEach((file) => console.log("   -", file))
}

if (require.main === module) {
	main()
}
