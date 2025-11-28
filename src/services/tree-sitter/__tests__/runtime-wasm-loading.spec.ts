import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import * as path from "path"
import * as vscode from "vscode"
import { Parser, Language, Query } from "web-tree-sitter"
import { getWasmDirectory } from "../get-wasm-directory"

// Mock vscode to return the project root
vi.mock("vscode", () => ({
	extensions: {
		getExtension: vi.fn(),
		all: [],
	},
}))

describe("Runtime WASM Loading Integration Test", () => {
	const mockGetExtension = vscode.extensions.getExtension as unknown as ReturnType<typeof vi.fn>
	let wasmDirectory: string
	let parsers: { [key: string]: Parser }
	let languages: { [key: string]: Language }

	beforeAll(async () => {
		// Mock vscode.extensions.getExtension to return project root
		const projectRoot = path.resolve(__dirname, "../../../..")
		mockGetExtension.mockReturnValue({
			extensionPath: projectRoot,
		})

		// Get the WASM directory using the real function
		wasmDirectory = getWasmDirectory()
		console.log(`WASM directory resolved to: ${wasmDirectory}`)

		// Initialize the Parser
		await Parser.init()
		console.log("Parser initialized")

		// Initialize objects to store parsers and languages
		parsers = {}
		languages = {}

		// Test code snippets for each language
		const testSnippets = {
			typescript: "const foo = (x: number) => x * 2;",
			javascript: "const bar = (y) => y + 1;",
			python: "def baz(z): return z * 3",
		}

		// Load languages and create parsers
		try {
			// Load TypeScript
			console.log("Loading TypeScript language...")
			languages.typescript = await Language.load(path.join(wasmDirectory, "tree-sitter-typescript.wasm"))
			parsers.typescript = new Parser()
			parsers.typescript.setLanguage(languages.typescript)

			// Test parsing
			const tsTree = parsers.typescript.parse(testSnippets.typescript)
			expect(tsTree).toBeDefined()
			expect(tsTree!.rootNode).toBeDefined()
			expect(tsTree!.rootNode!.childCount).toBeGreaterThan(0)
			console.log("TypeScript language loaded and parsing works")

			// Load JavaScript
			console.log("Loading JavaScript language...")
			languages.javascript = await Language.load(path.join(wasmDirectory, "tree-sitter-javascript.wasm"))
			parsers.javascript = new Parser()
			parsers.javascript.setLanguage(languages.javascript)

			// Test parsing
			const jsTree = parsers.javascript.parse(testSnippets.javascript)
			expect(jsTree).toBeDefined()
			expect(jsTree!.rootNode).toBeDefined()
			expect(jsTree!.rootNode!.childCount).toBeGreaterThan(0)
			console.log("JavaScript language loaded and parsing works")

			// Load Python
			console.log("Loading Python language...")
			languages.python = await Language.load(path.join(wasmDirectory, "tree-sitter-python.wasm"))
			parsers.python = new Parser()
			parsers.python.setLanguage(languages.python)

			// Test parsing
			const pyTree = parsers.python.parse(testSnippets.python)
			expect(pyTree).toBeDefined()
			expect(pyTree!.rootNode).toBeDefined()
			expect(pyTree!.rootNode!.childCount).toBeGreaterThan(0)
			console.log("Python language loaded and parsing works")
		} catch (error) {
			console.error("Error loading languages:", error)
			throw new Error(`Failed to load WASM languages: ${error}`)
		}
	})

	it("should resolve WASM directory to src/wasms/tree-sitter", () => {
		expect(wasmDirectory).toContain("src")
		expect(wasmDirectory).toContain("wasms")
		expect(wasmDirectory).toContain("tree-sitter")
		console.log(`WASM directory resolved correctly: ${wasmDirectory}`)
	})

	it("should load and parse TypeScript with web-tree-sitter", () => {
		const code = "interface Test { prop: string; } class MyClass implements Test { prop = 'hello'; }"

		const tree = parsers.typescript.parse(code)
		expect(tree).toBeDefined()
		expect(tree!.rootNode).toBeDefined()
		expect(tree!.rootNode!.text).toBe(code)
		expect(tree!.rootNode!.childCount).toBeGreaterThan(0)

		console.log(`TypeScript parsed successfully: ${tree!.rootNode!.type}`)
		console.log(`Root node children: ${tree!.rootNode!.childCount}`)
	})

	it("should load and parse JavaScript with web-tree-sitter", () => {
		const code = "function test() { return function nested() { return 42; }; }"

		const tree = parsers.javascript.parse(code)
		expect(tree).toBeDefined()
		expect(tree!.rootNode).toBeDefined()
		expect(tree!.rootNode!.text).toBe(code)
		expect(tree!.rootNode!.childCount).toBeGreaterThan(0)

		console.log(`JavaScript parsed successfully: ${tree!.rootNode!.type}`)
		console.log(`Root node children: ${tree!.rootNode!.childCount}`)
	})

	it("should load and parse Python with web-tree-sitter", () => {
		const code = "class TestClass: def method(self): return [x for x in range(10)]"

		const tree = parsers.python.parse(code)
		expect(tree).toBeDefined()
		expect(tree!.rootNode).toBeDefined()
		expect(tree!.rootNode!.text).toBe(code)
		expect(tree!.rootNode!.childCount).toBeGreaterThan(0)

		console.log(`Python parsed successfully: ${tree!.rootNode!.type}`)
		console.log(`Root node children: ${tree!.rootNode!.childCount}`)
	})

	it("should create and execute queries on parsed code", () => {
		// Test TypeScript query - use simple identifier capture
		const tsQueryText = `
			(identifier) @name
		`

		const tsQuery = languages.typescript.query(tsQueryText)
		const tsCode = "interface MyInterface {} class MyClass {} function myFunc() {}"
		const tsTree = parsers.typescript.parse(tsCode)
		const tsCaptures = tsQuery.captures(tsTree!.rootNode!)

		expect(tsCaptures.length).toBeGreaterThan(0)
		console.log(`TypeScript query captures: ${tsCaptures.length}`)
		tsCaptures.forEach((capture) => {
			console.log(`  ${capture.name}: ${capture.node.text}`)
		})

		// Test JavaScript query - use simple identifier capture
		const jsQueryText = `
			(identifier) @name
		`

		const jsQuery = languages.javascript.query(jsQueryText)
		const jsCode = "function myFunc() {} class MyClass {} const myVar = 42;"
		const jsTree = parsers.javascript.parse(jsCode)
		const jsCaptures = jsQuery.captures(jsTree!.rootNode!)

		expect(jsCaptures.length).toBeGreaterThan(0)
		console.log(`JavaScript query captures: ${jsCaptures.length}`)
		jsCaptures.forEach((capture) => {
			console.log(`  ${capture.name}: ${capture.node.text}`)
		})

		// Test Python query - use simple identifier capture
		const pyQueryText = `
			(identifier) @name
		`

		const pyQuery = languages.python.query(pyQueryText)
		const pyCode = "class MyClass: def my_method(self): pass"
		const pyTree = parsers.python.parse(pyCode)
		const pyCaptures = pyQuery.captures(pyTree!.rootNode!)

		expect(pyCaptures.length).toBeGreaterThan(0)
		console.log(`Python query captures: ${pyCaptures.length}`)
		pyCaptures.forEach((capture) => {
			console.log(`  ${capture.name}: ${capture.node.text}`)
		})
	})

	it("should verify WASM files exist in the resolved directory", () => {
		const fs = require("fs")

		const requiredFiles = ["tree-sitter-typescript.wasm", "tree-sitter-javascript.wasm", "tree-sitter-python.wasm"]

		requiredFiles.forEach((file) => {
			const filePath = path.join(wasmDirectory, file)
			expect(fs.existsSync(filePath)).toBe(true)
			console.log(`WASM file exists: ${file}`)
		})
	})

	afterAll(() => {
		// Clean up parsers
		Object.values(parsers).forEach((parser) => {
			parser.delete()
		})
		// Languages don't need explicit cleanup in web-tree-sitter
		console.log("Cleaned up parsers")
	})
})
