import * as path from "path"
import * as fs from "fs"

interface Block {
	type: string
	identifier: string | null
	start_line: number
	end_line: number
	content: string
}

// Simple mock parser for demonstration
class MockCodeParser {
	async parseFile(filePath: string): Promise<Block[]> {
		const content = fs.readFileSync(filePath, "utf8")
		const lines = content.split("\n")

		// Simple heuristic to identify different code blocks
		const blocks: Block[] = []
		let currentBlock: Block | null = null
		let braceCount = 0

		lines.forEach((line: string, index: number) => {
			const trimmed = line.trim()

			// Detect function/class/interface declarations
			if (trimmed.match(/^(async\s+)?function\s+\w+|class\s+\w+|interface\s+\w+/)) {
				if (currentBlock) {
					blocks.push(currentBlock)
				}
				const match = trimmed.match(/\w+/)
				currentBlock = {
					type: "function",
					identifier: match ? match[0] : "anonymous",
					start_line: index + 1,
					end_line: index + 1,
					content: line,
				}
				braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
			}
			// Detect export statements
			else if (trimmed.startsWith("export")) {
				if (currentBlock) {
					blocks.push(currentBlock)
				}
				const match = trimmed.match(/\w+/)
				currentBlock = {
					type: "export",
					identifier: match ? match[0] : "anonymous",
					start_line: index + 1,
					end_line: index + 1,
					content: line,
				}
				braceCount = 0
			}
			// Continue current block
			else if (currentBlock) {
				currentBlock.content += "\n" + line
				currentBlock.end_line = index + 1
				braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length

				if (braceCount <= 0 && trimmed.includes("}")) {
					blocks.push(currentBlock)
					currentBlock = null
					braceCount = 0
				}
			}
			// Create fallback chunks for unrecognized code
			else if (trimmed && !currentBlock) {
				blocks.push({
					type: "fallback",
					identifier: null,
					start_line: index + 1,
					end_line: index + 1,
					content: line,
				})
			}
		})

		if (currentBlock) {
			blocks.push(currentBlock)
		}

		return blocks
	}
}

async function analyzeFile(filePath: string, parser: MockCodeParser, description: string) {
	console.log(`\n=== ANALYZING: ${description} ===`)
	console.log(`File path: ${filePath}`)

	const blocks = await parser.parseFile(filePath)

	// 1. Block counts and types
	console.log(`Total blocks found: ${blocks.length}`)

	// Count block types
	const blockTypes = new Map<string, number>()
	blocks.forEach((block) => {
		const count = blockTypes.get(block.type) || 0
		blockTypes.set(block.type, count + 1)
	})

	console.log("\nBlock types found:")
	for (const [type, count] of blockTypes.entries()) {
		console.log(`  ${type}: ${count}`)
	}

	// Count fallback chunks vs semantic blocks
	const fallbackChunks = blocks.filter(
		(block) => block.type.includes("fallback") || block.type.includes("emergency"),
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

		const parser = new MockCodeParser()

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
		console.log("This demonstrates the enhanced test workflow with TypeScript fixture support.")
		console.log("The actual implementation would use the real CodeParser with tree-sitter queries.")

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
