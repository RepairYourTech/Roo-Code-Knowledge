const path = require("path")
const fs = require("fs")

// Mock vscode
const vscode = {
	workspace: {
		getConfiguration: () => ({
			get: () => 500,
		}),
	},
	Uri: {
		file: (path: string) => ({ fsPath: path }),
	},
	WorkspaceFolder: {
		name: "test",
		uri: { fsPath: "/test" },
	},
}

// Type assertion to bypass TypeScript error
;(globalThis as any).vscode = vscode

// Mock other modules that might be required
;(globalThis as any).TelemetryService = {
	sendEvent: () => {},
	sendError: () => {},
	sendTiming: () => {},
}
;(globalThis as any).logger = {
	info: console.log,
	warn: console.warn,
	error: console.error,
	debug: console.debug,
}

// Export to make this a module
export {}

// Import dependencies
// We need to use ts-node to run this, or compile it.
// Since we are in a dev environment, we can try to use the existing build or just require the TS files if we use ts-node.
// But we don't have ts-node installed globally maybe.
// Let's try to use the compiled JS files if they exist, or just use the source with ts-node if available.
// Actually, let's just try to use the source files and assume we can run it with ts-node.

const { CodeParser } = require("./src/services/code-index/processors/parser")
const { loadRequiredLanguageParsers } = require("./src/services/tree-sitter/languageParser")

// Map file extensions to language names (consistent with languageParser.ts)
const extensionToLanguage: { [key: string]: string } = {
	js: "javascript",
	jsx: "javascript",
	json: "javascript",
	ts: "typescript",
	tsx: "tsx",
	py: "python",
	rs: "rust",
	go: "go",
	cpp: "cpp",
	hpp: "cpp",
	c: "c",
	h: "c",
	cs: "c_sharp",
	rb: "ruby",
	java: "java",
	php: "php",
	swift: "swift",
	kt: "kotlin",
	kts: "kotlin",
	css: "css",
	html: "html",
	ml: "ocaml",
	mli: "ocaml",
	scala: "scala",
	sol: "solidity",
	toml: "toml",
	yaml: "yaml",
	yml: "yaml",
	vue: "vue",
	lua: "lua",
	rdl: "systemrdl",
	tla: "tlaplus",
	zig: "zig",
	ejs: "ejs",
	erb: "erb",
	el: "elisp",
	ex: "elixir",
	exs: "elixir",
}

async function analyzeFile(filePath: string, parser: any, description: string) {
	console.log(`\n=== ANALYZING: ${description} ===`)
	console.log(`File path: ${filePath}`)

	const blocks = await parser.parseFile(filePath)

	// 1. Block counts and types
	console.log(`Total blocks found: ${blocks.length}`)

	// Count block types
	const blockTypes = new Map<string, number>()
	blocks.forEach((block: any) => {
		const count = blockTypes.get(block.type) || 0
		blockTypes.set(block.type, count + 1)
	})

	console.log("\nBlock types found:")
	for (const [type, count] of blockTypes.entries()) {
		console.log(`  ${type}: ${count}`)
	}

	// Count fallback chunks vs semantic blocks
	const fallbackChunks = blocks.filter(
		(block: any) => block.type.includes("fallback") || block.type.includes("emergency"),
	).length
	const semanticBlocks = blocks.length - fallbackChunks

	console.log(`\nSemantic blocks: ${semanticBlocks}`)
	console.log(`Fallback chunks: ${fallbackChunks}`)

	if (blocks.length > 0) {
		const fallbackPercentage = ((fallbackChunks / blocks.length) * 100).toFixed(2)
		console.log(`Fallback percentage: ${fallbackPercentage}%`)
	}

	// 2. For the first few blocks, log detailed information
	console.log("\nFirst few blocks details:")
	const blocksToExamine = Math.min(3, blocks.length)
	for (let i = 0; i < blocksToExamine; i++) {
		const block = blocks[i]
		console.log(`\nBlock ${i + 1}:`)
		console.log(`  Type: ${block.type}`)
		console.log(`  Identifier: ${block.identifier || "null"}`)
		console.log(`  Start line: ${block.start_line}`)
		console.log(`  End line: ${block.end_line}`)
		console.log(`  Content preview (first 100 chars): ${block.content.substring(0, 100).replace(/\n/g, "\\n")}...`)
	}

	// 3. Parser diagnostics for this file
	console.log("\nParser diagnostics:")
	const { getWasmDirectory } = require("./src/services/tree-sitter/get-wasm-directory")

	try {
		const wasmDir = getWasmDirectory()
		const ext = path.extname(filePath).slice(1).toLowerCase()
		console.log(`File extension: ${ext}`)

		const parsers = await loadRequiredLanguageParsers([filePath], wasmDir)
		const normalizedExt = extensionToLanguage[ext] || ext
		if (parsers && (parsers[normalizedExt] || parsers[ext])) {
			const language = parsers[normalizedExt] || parsers[ext]
			console.log(`Parser loaded successfully for ${ext}`)
			console.log(`Language name: ${language.language?.name || "Unknown"}`)

			if (language.query) {
				console.log(`Query pattern count: ${language.query.patternCount}`)
				console.log(`Query capture names: ${language.query.captureNames?.join(", ") || "None"}`)

				// Parse the actual file content and log captures
				const fileContent = require("fs").readFileSync(filePath, "utf8")
				const tree = language.parser.parse(fileContent)
				if (tree) {
					const captures = language.query.captures(tree.rootNode)
					console.log(`File captures: ${captures.length}`)

					// Count capture types
					const captureTypes = new Map<string, number>()
					captures.forEach((capture: any) => {
						const count = captureTypes.get(capture.name) || 0
						captureTypes.set(capture.name, count + 1)
					})

					console.log("Capture types:")
					for (const [name, count] of captureTypes.entries()) {
						console.log(`  ${name}: ${count}`)
					}
				}
			} else {
				console.log("No query available for this language")
			}
		} else {
			console.log(`Failed to load parser for ${ext}`)
		}
	} catch (error) {
		console.error(`Error loading parser: ${error instanceof Error ? error.message : String(error)}`)
	}

	return {
		blocks,
		semanticBlocks,
		fallbackChunks,
		blockTypes,
	}
}

async function test() {
	try {
		console.log("Starting reproduction test...")

		const parser = new CodeParser()

		// Test 1: Original parser.ts file
		const parserFile = path.join(__dirname, "src/services/code-index/processors/parser.ts")
		const parserResults = await analyzeFile(parserFile, parser, "Parser.ts (Original)")

		// Test 2: TypeScript fixture
		const tsFixtureFile = path.join(__dirname, "src/services/tree-sitter/__tests__/fixtures/sample-typescript.ts")
		const tsResults = await analyzeFile(tsFixtureFile, parser, "TypeScript Fixture")

		// 4. Add comparison between files
		console.log("\n=== COMPARISON SUMMARY ===")
		console.log("\nParser.ts (Original):")
		console.log(`  Total blocks: ${parserResults.blocks.length}`)
		console.log(`  Semantic blocks: ${parserResults.semanticBlocks}`)
		console.log(`  Fallback chunks: ${parserResults.fallbackChunks}`)

		if (parserResults.blocks.length > 0) {
			const parserFallbackPercentage = (
				(parserResults.fallbackChunks / parserResults.blocks.length) *
				100
			).toFixed(2)
			console.log(`  Fallback percentage: ${parserFallbackPercentage}%`)
		}

		console.log("\nTypeScript Fixture:")
		console.log(`  Total blocks: ${tsResults.blocks.length}`)
		console.log(`  Semantic blocks: ${tsResults.semanticBlocks}`)
		console.log(`  Fallback chunks: ${tsResults.fallbackChunks}`)

		if (tsResults.blocks.length > 0) {
			const tsFallbackPercentage = ((tsResults.fallbackChunks / tsResults.blocks.length) * 100).toFixed(2)
			console.log(`  Fallback percentage: ${tsFallbackPercentage}%`)
		}

		// 5. Add overall summary
		console.log("\n=== OVERALL SUMMARY ===")
		console.log("Note: Direct comparison between comprehensive and hardcoded queries would require")
		console.log("access to internal parser state, which is not available through the public API.")
		console.log("This would need to be implemented in the parser itself with a diagnostic mode.")

		console.log("\nAnalysis complete for both files:")

		// Evaluate parser.ts results
		if (parserResults.blocks.length > 0) {
			const parserFallbackPercentage = (
				(parserResults.fallbackChunks / parserResults.blocks.length) *
				100
			).toFixed(2)
			if (parseFloat(parserFallbackPercentage) > 50) {
				console.log("\n⚠️  Parser.ts: More than 50% of content is in fallback chunks.")
				console.log("   This suggests the queries need improvement for this language/file type.")
			} else if (parseFloat(parserFallbackPercentage) > 20) {
				console.log("\n⚠️  Parser.ts: Significant fallback chunking detected.")
				console.log("   Consider reviewing the query patterns for better semantic parsing.")
			} else {
				console.log("\n✅ Parser.ts: Good semantic parsing coverage.")
			}
		} else {
			console.log("❌ Parser.ts: No blocks were created - this indicates a parsing failure.")
		}

		// Evaluate TypeScript fixture results
		if (tsResults.blocks.length > 0) {
			const tsFallbackPercentage = ((tsResults.fallbackChunks / tsResults.blocks.length) * 100).toFixed(2)
			if (parseFloat(tsFallbackPercentage) > 50) {
				console.log("\n⚠️  TypeScript Fixture: More than 50% of content is in fallback chunks.")
				console.log("   This suggests the queries need improvement for TypeScript files.")
			} else if (parseFloat(tsFallbackPercentage) > 20) {
				console.log("\n⚠️  TypeScript Fixture: Significant fallback chunking detected.")
				console.log("   Consider reviewing the TypeScript query patterns for better semantic parsing.")
			} else {
				console.log("\n✅ TypeScript Fixture: Good semantic parsing coverage.")
			}
		} else {
			console.log("❌ TypeScript Fixture: No blocks were created - this indicates a parsing failure.")
		}
	} catch (e) {
		console.error("Error:", e)
	}
}

test()
