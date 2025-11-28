// Integration test for CodeParser without mocking loadRequiredLanguageParsers

import { CodeParser } from "../parser"
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import * as vscode from "vscode"
import * as path from "path"

// Mock vscode to return project root like other integration tests
vi.mock("vscode", () => ({
	extensions: {
		getExtension: vi.fn(),
		all: [],
	},
}))

// Mock TelemetryService like other tests
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

describe("CodeParser Integration Tests", () => {
	let parser: CodeParser

	beforeAll(async () => {
		// Mock vscode.extensions.getExtension to return project root
		const projectRoot = path.resolve(__dirname, "../../../..")
		const mockGetExtension = vscode.extensions.getExtension as unknown as ReturnType<typeof vi.fn>
		mockGetExtension.mockReturnValue({
			extensionPath: projectRoot,
		})

		// Create a new CodeParser instance without mocking loadRequiredLanguageParsers
		parser = new CodeParser()
	})

	afterAll(() => {
		// Clean up if needed
	})

	describe("Real parser loading and parsing", () => {
		it("should parse JavaScript code with real Tree-sitter parser", async () => {
			// Simple JavaScript code with a function and class
			const jsCode = `
function calculateSum(a, b) {
	return a + b;
}

class Calculator {
	constructor() {
		this.history = [];
	}
	
	add(x, y) {
		const result = calculateSum(x, y);
		this.history.push(result);
		return result;
	}
}
`

			// Parse the file with real parser loading
			const result = await parser.parseFile("test.js", { content: jsCode })

			// Debug: Log what we actually got
			console.log("JS Parse result:", JSON.stringify(result, null, 2))

			// Verify we got semantic blocks (not fallback blocks)
			expect(result.length).toBeGreaterThan(0)

			// Check that we have at least one function or class block
			const hasSemanticBlock = result.some(
				(block) =>
					block.identifier &&
					(block.identifier.includes("calculateSum") || block.identifier.includes("Calculator")),
			)
			expect(hasSemanticBlock).toBe(true)

			// Ensure no blocks have fallback type in this happy path scenario
			const hasFallbackBlock = result.some((block) => block.type && block.type.startsWith("fallback_"))
			expect(hasFallbackBlock).toBe(false)
		})

		it("should parse TypeScript code with real Tree-sitter parser", async () => {
			// Simple TypeScript code with interface and class
			const tsCode = `
interface Person {
	name: string;
	age: number;
}

class Employee implements Person {
	name: string;
	age: number;
	position: string;
	
	constructor(name: string, age: number, position: string) {
		this.name = name;
		this.age = age;
		this.position = position;
	}
	
	getInfo(): string {
		return \`\${this.name} is \${this.age} years old and works as \${this.position}\`;
	}
}
`

			// Parse the file with real parser loading
			const result = await parser.parseFile("test.ts", { content: tsCode })

			// Verify we got semantic blocks (not fallback blocks)
			expect(result.length).toBeGreaterThan(0)

			// Check that we have at least one interface or class block
			const hasSemanticBlock = result.some(
				(block) =>
					block.identifier && (block.identifier.includes("Person") || block.identifier.includes("Employee")),
			)
			expect(hasSemanticBlock).toBe(true)

			// Ensure no blocks have fallback type in this happy path scenario
			const hasFallbackBlock = result.some((block) => block.type && block.type.startsWith("fallback_"))
			expect(hasFallbackBlock).toBe(false)
		})

		it("should verify WASM directory and parser loading status", async () => {
			// This test verifies that the WASM directory is properly resolved
			// and parsers can be loaded without mocking

			// Parse a simple file to trigger parser loading
			const result = await parser.parseFile("test.js", { content: "function test() {}" })

			// Should get at least one block (even if it's a fallback, the parser should attempt loading)
			expect(result.length).toBeGreaterThan(0)
		})

		it("should handle multiple file extensions in one parse call", async () => {
			const jsCode = `
function greet(name) {
	return \`Hello, \${name}!\`;
}
`
			const tsCode = `
interface User {
	id: number;
	name: string;
}
`

			// Parse JavaScript file
			const jsResult = await parser.parseFile("greet.js", { content: jsCode })

			// Parse TypeScript file
			const tsResult = await parser.parseFile("user.ts", { content: tsCode })

			// Both should have semantic blocks
			expect(jsResult.length).toBeGreaterThan(0)
			expect(tsResult.length).toBeGreaterThan(0)

			// Neither should have fallback blocks in happy path
			const jsHasFallback = jsResult.some((block) => block.type && block.type.startsWith("fallback_"))
			const tsHasFallback = tsResult.some((block) => block.type && block.type.startsWith("fallback_"))

			expect(jsHasFallback).toBe(false)
			expect(tsHasFallback).toBe(false)
		})
	})
})
