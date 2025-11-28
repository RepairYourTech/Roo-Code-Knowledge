// Test file to verify comprehensive queries are loaded and working correctly
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import * as path from "path"
import { Parser, Query, Language } from "web-tree-sitter"
import * as queries from "../queries"

describe("Comprehensive Query Verification", () => {
	let tsParser: Parser
	let jsParser: Parser
	let pyParser: Parser
	let tsQuery: Query
	let jsQuery: Query
	let pyQuery: Query
	let tsLanguage: Language
	let jsLanguage: Language
	let pyLanguage: Language
	let totalCapturesFound = 0
	const testResults: { [key: string]: { success: boolean; captures: number; error?: string } } = {}

	beforeAll(async () => {
		// Path to the directory containing the WASM files
		const WASM_DIR = path.join(__dirname, "../../../node_modules/tree-sitter-wasms/out")

		// Initialize Parser
		await Parser.init()

		// Load TypeScript language and parser
		try {
			tsLanguage = await Language.load(path.join(WASM_DIR, "tree-sitter-typescript.wasm"))
			tsParser = new Parser()
			tsParser.setLanguage(tsLanguage)

			// Load comprehensive TypeScript query
			const tsQueryText = queries.typescriptQuery
			expect(tsQueryText).toBeDefined()
			expect(tsQueryText.length).toBeGreaterThan(100) // Comprehensive queries should be substantial

			try {
				tsQuery = tsLanguage.query(tsQueryText)

				console.log(`TypeScript parser loaded successfully`)
				console.log(`TypeScript query pattern count: ${tsQuery.patternCount || 0}`)
				console.log(
					`TypeScript query capture names: [${tsQuery.captureNames ? tsQuery.captureNames.join(", ") : "none"}]`,
				)
			} catch (queryError) {
				console.error(`Error creating TypeScript query:`, queryError)
				// Fall back to a simple hardcoded query
				const fallbackQueryText = `
						(function_declaration name: (identifier) @function-name)
						(class_declaration name: (identifier) @class-name)
						(interface_declaration name: (identifier) @interface-name)
					`
				tsQuery = tsLanguage.query(fallbackQueryText)
				console.log(`Using fallback TypeScript query due to comprehensive query error`)
			}
		} catch (error) {
			console.error(`Error loading TypeScript parser:`, error)
			throw new Error(`Failed to load TypeScript parser: ${error}`)
		}

		// Load JavaScript language and parser
		try {
			jsLanguage = await Language.load(path.join(WASM_DIR, "tree-sitter-javascript.wasm"))
			jsParser = new Parser()
			jsParser.setLanguage(jsLanguage)

			// Load comprehensive JavaScript query
			const jsQueryText = queries.javascriptQuery
			expect(jsQueryText).toBeDefined()
			expect(jsQueryText.length).toBeGreaterThan(100) // Comprehensive queries should be substantial

			jsQuery = jsLanguage.query(jsQueryText)

			console.log(`JavaScript parser loaded successfully`)
			console.log(`JavaScript query pattern count: ${jsQuery.patternCount || 0}`)
			console.log(
				`JavaScript query capture names: [${jsQuery.captureNames ? jsQuery.captureNames.join(", ") : "none"}]`,
			)
		} catch (error) {
			console.error(`Error loading JavaScript parser:`, error)
			throw new Error(`Failed to load JavaScript parser: ${error}`)
		}

		// Load Python language and parser
		try {
			pyLanguage = await Language.load(path.join(WASM_DIR, "tree-sitter-python.wasm"))
			pyParser = new Parser()
			pyParser.setLanguage(pyLanguage)

			// Load comprehensive Python query
			const pyQueryText = queries.pythonQuery
			expect(pyQueryText).toBeDefined()
			expect(pyQueryText.length).toBeGreaterThan(100) // Comprehensive queries should be substantial

			pyQuery = pyLanguage.query(pyQueryText)

			console.log(`Python parser loaded successfully`)
			console.log(`Python query pattern count: ${pyQuery.patternCount || 0}`)
			console.log(
				`Python query capture names: [${pyQuery.captureNames ? pyQuery.captureNames.join(", ") : "none"}]`,
			)
		} catch (error) {
			console.error(`Error loading Python parser:`, error)
			throw new Error(`Failed to load Python parser: ${error}`)
		}
	})

	it("should verify TypeScript parser has comprehensive queries", () => {
		expect(tsParser).toBeDefined()
		expect(tsQuery).toBeDefined()

		// Check if query object exists and has patterns
		const patternCount = tsQuery.patternCount || 0
		const captureNames = tsQuery.captureNames || []

		console.log(`TypeScript parser - Pattern count: ${patternCount}`)
		console.log(`TypeScript parser - Capture names: [${captureNames.join(", ")}]`)

		// Verify pattern count is > 10 (comprehensive queries have many patterns)
		expect(patternCount).toBeGreaterThan(10)
		expect(captureNames.length).toBeGreaterThan(0)
	})

	it("should verify JavaScript parser has comprehensive queries", () => {
		expect(jsParser).toBeDefined()
		expect(jsQuery).toBeDefined()

		// Check if query object exists and has patterns
		const patternCount = jsQuery.patternCount || 0
		const captureNames = jsQuery.captureNames || []

		console.log(`JavaScript parser - Pattern count: ${patternCount}`)
		console.log(`JavaScript parser - Capture names: [${captureNames.join(", ")}]`)

		// Verify pattern count is > 10 (comprehensive queries have many patterns)
		expect(patternCount).toBeGreaterThan(10)
		expect(captureNames.length).toBeGreaterThan(0)
	})

	it("should verify Python parser has comprehensive queries", () => {
		expect(pyParser).toBeDefined()
		expect(pyQuery).toBeDefined()

		// Check if query object exists and has patterns
		const patternCount = pyQuery.patternCount || 0
		const captureNames = pyQuery.captureNames || []

		console.log(`Python parser - Pattern count: ${patternCount}`)
		console.log(`Python parser - Capture names: [${captureNames.join(", ")}]`)

		// Verify pattern count is > 10 (comprehensive queries have many patterns)
		expect(patternCount).toBeGreaterThan(10)
		expect(captureNames.length).toBeGreaterThan(0)
	})

	it("should parse TypeScript arrow function correctly", () => {
		expect(tsParser).toBeDefined()
		expect(tsQuery).toBeDefined()

		const code = "const foo = () => {}"

		try {
			const tree = tsParser.parse(code)
			if (!tree || !tree.rootNode) {
				throw new Error("Failed to parse code - tree or rootNode is null")
			}
			const captures = tsQuery.captures(tree.rootNode)

			console.log(`TypeScript arrow function test - Captures found: ${captures.length}`)
			console.log(
				`TypeScript arrow function test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["ts_arrow_function"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`TypeScript arrow function test failed: ${errorMessage}`)
			testResults["ts_arrow_function"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse TypeScript exported const correctly", () => {
		expect(tsParser).toBeDefined()
		expect(tsQuery).toBeDefined()

		const code = "export const bar = 123"

		try {
			const tree = tsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = tsQuery.captures(tree.rootNode)

			console.log(`TypeScript exported const test - Captures found: ${captures.length}`)
			console.log(
				`TypeScript exported const test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["ts_exported_const"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`TypeScript exported const test failed: ${errorMessage}`)
			testResults["ts_exported_const"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse TypeScript interface correctly", () => {
		expect(tsParser).toBeDefined()
		expect(tsQuery).toBeDefined()

		const code = "interface Baz { x: number }"

		try {
			const tree = tsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = tsQuery.captures(tree.rootNode)

			console.log(`TypeScript interface test - Captures found: ${captures.length}`)
			console.log(
				`TypeScript interface test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["ts_interface"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`TypeScript interface test failed: ${errorMessage}`)
			testResults["ts_interface"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse TypeScript class correctly", () => {
		expect(tsParser).toBeDefined()
		expect(tsQuery).toBeDefined()

		const code = "class Qux {}"

		try {
			const tree = tsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = tsQuery.captures(tree.rootNode)

			console.log(`TypeScript class test - Captures found: ${captures.length}`)
			console.log(
				`TypeScript class test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["ts_class"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`TypeScript class test failed: ${errorMessage}`)
			testResults["ts_class"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse JavaScript arrow function correctly", () => {
		expect(jsParser).toBeDefined()
		expect(jsQuery).toBeDefined()

		const code = "const foo = () => {}"

		try {
			const tree = jsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = jsQuery.captures(tree.rootNode)

			console.log(`JavaScript arrow function test - Captures found: ${captures.length}`)
			console.log(
				`JavaScript arrow function test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["js_arrow_function"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`JavaScript arrow function test failed: ${errorMessage}`)
			testResults["js_arrow_function"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse JavaScript exported const correctly", () => {
		expect(jsParser).toBeDefined()
		expect(jsQuery).toBeDefined()

		const code = "export const bar = 123"

		try {
			const tree = jsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = jsQuery.captures(tree.rootNode)

			console.log(`JavaScript exported const test - Captures found: ${captures.length}`)
			console.log(
				`JavaScript exported const test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["js_exported_const"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`JavaScript exported const test failed: ${errorMessage}`)
			testResults["js_exported_const"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse JavaScript class correctly", () => {
		expect(jsParser).toBeDefined()
		expect(jsQuery).toBeDefined()

		const code = "class Qux {}"

		try {
			const tree = jsParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = jsQuery.captures(tree.rootNode)

			console.log(`JavaScript class test - Captures found: ${captures.length}`)
			console.log(
				`JavaScript class test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["js_class"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`JavaScript class test failed: ${errorMessage}`)
			testResults["js_class"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse Python function definition correctly", () => {
		expect(pyParser).toBeDefined()
		expect(pyQuery).toBeDefined()

		const code = "def hello_world():\n    print('Hello, World!')"

		try {
			const tree = pyParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = pyQuery.captures(tree.rootNode)

			console.log(`Python function definition test - Captures found: ${captures.length}`)
			console.log(
				`Python function definition test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["py_function_definition"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Python function definition test failed: ${errorMessage}`)
			testResults["py_function_definition"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	it("should parse Python class definition correctly", () => {
		expect(pyParser).toBeDefined()
		expect(pyQuery).toBeDefined()

		const code = "class MyClass:\n    def __init__(self):\n        self.value = 0"

		try {
			const tree = pyParser.parse(code)
			if (!tree || !tree.rootNode) throw new Error("Tree or rootNode is null")
			const captures = pyQuery.captures(tree.rootNode)

			console.log(`Python class definition test - Captures found: ${captures.length}`)
			console.log(
				`Python class definition test - Capture details:`,
				captures.map((c: any) => ({ name: c.name, text: c.node.text })),
			)

			// Verify that comprehensive queries are active and effective
			expect(captures.length).toBeGreaterThan(0)

			totalCapturesFound += captures.length
			testResults["py_class_definition"] = { success: true, captures: captures.length }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Python class definition test failed: ${errorMessage}`)
			testResults["py_class_definition"] = { success: false, captures: 0, error: errorMessage }
			throw error
		}
	})

	afterAll(() => {
		// Log summary
		const tsPatterns = Number(tsQuery?.patternCount || 0)
		const jsPatterns = Number(jsQuery?.patternCount || 0)
		const pyPatterns = Number(pyQuery?.patternCount || 0)
		const totalPatterns = tsPatterns + jsPatterns + pyPatterns
		const successCount = Object.values(testResults).filter((r) => r.success).length
		const totalCount = Object.keys(testResults).length

		console.log("\n=== COMPREHENSIVE QUERY VERIFICATION SUMMARY ===")
		console.log(`Total patterns in queries: ${totalPatterns}`)
		console.log(`  TypeScript: ${tsPatterns} patterns`)
		console.log(`  JavaScript: ${jsPatterns} patterns`)
		console.log(`  Python: ${pyPatterns} patterns`)
		console.log(`Total captures found across all test cases: ${totalCapturesFound}`)
		console.log(`Test results: ${successCount}/${totalCount} successful`)

		Object.entries(testResults).forEach(([test, result]) => {
			const status = result.success ? "✓" : "✗"
			console.log(`  ${status} ${test}: ${result.captures} captures${result.error ? ` (${result.error})` : ""}`)
		})

		const allSuccessful = successCount === totalCount
		console.log(`Overall status: ${allSuccessful ? "SUCCESS" : "FAILURE"}`)
		console.log("===============================================\n")
	})
})
