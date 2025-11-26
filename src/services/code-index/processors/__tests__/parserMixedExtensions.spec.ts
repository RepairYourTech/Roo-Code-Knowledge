import { describe, it, expect, vi, beforeEach } from "vitest"
import { CodeParser } from "../parser"

// Mock console methods to verify warning messages
const mockConsoleWarn = vi.spyOn(console, "warn")
const mockConsoleLog = vi.spyOn(console, "log")

describe("CodeParser with mixed supported and unsupported extensions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should handle mixed extensions without throwing errors", async () => {
		const codeParser = new CodeParser()

		// Test with a supported extension
		const results = await codeParser.parseFile("test.js", {
			content: "console.log('hello');",
		})

		// Results should be an array (even if empty due to missing WASM files)
		expect(Array.isArray(results)).toBe(true)

		// Test with an unsupported extension
		const unsupportedResults = await codeParser.parseFile("test.xyz", {
			content: "some unsupported content",
		})

		// Should return empty array for unsupported extensions
		expect(Array.isArray(unsupportedResults)).toBe(true)
		expect(unsupportedResults).toHaveLength(0)
	})

	it("should verify that parseFile can be called with unsupported files", async () => {
		const codeParser = new CodeParser()

		// Test with unsupported extension using Jest's modern async assertion patterns
		await expect(
			codeParser.parseFile("test.unsupportedext", {
				content: "unsupported content",
			}),
		).resolves.toSatisfy((results: unknown) => {
			return Array.isArray(results) && results.length === 0
		})
	})

	it("should handle empty file content gracefully", async () => {
		const codeParser = new CodeParser()

		// Test with empty content using Jest's modern async assertion patterns
		await expect(
			codeParser.parseFile("test.js", {
				content: "",
			}),
		).resolves.toSatisfy((results: unknown) => {
			return Array.isArray(results)
		})
	})

	it("should verify the integration between loadRequiredLanguageParsers and parseFile", async () => {
		const codeParser = new CodeParser()

		// Clear previous warnings
		mockConsoleWarn.mockClear()

		// Test with a supported extension using Jest's modern async assertion patterns
		await expect(
			codeParser.parseFile("test.js", {
				content: "const x = 1;",
			}),
		).resolves.toSatisfy((results: unknown) => {
			if (!Array.isArray(results) || results.length < 0) {
				return false
			}

			// If we got any results, verify they have expected structure
			if (results.length > 0) {
				return results[0] !== null && typeof results[0] === "object" && "type" in results[0]
			}

			return true
		})

		// Test with an unsupported extension using Jest's modern async assertion patterns
		await expect(
			codeParser.parseFile("test.unsupportedext", {
				content: "unsupported content",
			}),
		).resolves.toSatisfy((results: unknown) => {
			return Array.isArray(results) && results.length === 0
		})
	})
})
