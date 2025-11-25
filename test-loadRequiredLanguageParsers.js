const { loadRequiredLanguageParsers } = require("./services/tree-sitter/languageParser.ts")

async function test() {
	console.log("Testing loadRequiredLanguageParsers with mixed extensions...")

	try {
		// Test 1: Mixed supported and unsupported extensions
		console.log("Test 1: Mixed extensions")
		const parsers1 = await loadRequiredLanguageParsers(["test.js", "test.py", "test.xyz"])
		console.log("Test 1 Result:", Object.keys(parsers1))

		// Test 2: All unsupported extensions
		console.log("Test 2: All unsupported")
		const parsers2 = await loadRequiredLanguageParsers(["test.xyz", "test.unknown", "test.unsupported"])
		console.log("Test 2 Result:", Object.keys(parsers2))

		// Test 3: Empty array
		console.log("Test 3: Empty array")
		const parsers3 = await loadRequiredLanguageParsers([])
		console.log("Test 3 Result:", Object.keys(parsers3))

		console.log("All tests completed successfully!")
	} catch (error) {
		console.error("Test failed:", error)
	}
}

test()
