const path = require("path")
const fs = require("fs")

// Mock vscode
const vscode = {
	workspace: {
		getConfiguration: () => ({
			get: () => 500,
		}),
	},
}

// Type assertion to bypass TypeScript error
;(globalThis as any).vscode = vscode

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

async function test() {
	try {
		console.log("Starting reproduction test...")

		const parser = new CodeParser()
		const testFile = path.join(__dirname, "src/services/code-index/processors/parser.ts") // Use itself as test file

		console.log(`Parsing file: ${testFile}`)
		const blocks = await parser.parseFile(testFile)

		console.log(`Blocks found: ${blocks.length}`)
		if (blocks.length > 0) {
			console.log("First block:", blocks[0])
		} else {
			console.error("No blocks found!")
		}
	} catch (e) {
		console.error("Error:", e)
	}
}

test()
