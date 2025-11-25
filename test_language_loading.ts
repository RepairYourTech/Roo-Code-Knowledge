const path = require("path")
const { loadRequiredLanguageParsers } = require("./src/services/tree-sitter/languageParser")

async function test() {
	try {
		console.log("Testing loadRequiredLanguageParsers...")

		// Mock files to parse
		const files = ["test.ts", "test.js"]

		console.log("Loading parsers for:", files)
		const parsers = await loadRequiredLanguageParsers(files)

		console.log("Parsers loaded:", Object.keys(parsers))

		if (parsers["ts"]) {
			console.log("TypeScript parser loaded successfully")
			const tree = parsers["ts"].parser.parse("const x: number = 1;")
			console.log("Parsed tree root:", tree.rootNode.type)
		} else {
			console.error("TypeScript parser NOT loaded")
		}
	} catch (e) {
		console.error("Error:", e)
	}
}

test()
