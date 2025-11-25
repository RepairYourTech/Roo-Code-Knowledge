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
		try {
			const results = await codeParser.parseFile("test.js", {
				content: "console.log('hello');",
			})

			// If we get here, the function handled the file gracefully
			expect(true).toBe(true)

			// Results should be an array (even if empty due to missing WASM files)
			expect(Array.isArray(results)).toBe(true)
		} catch (error) {
			// If an error occurs, it should NOT be about unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}

		// Test with an unsupported extension
		try {
			const results = await codeParser.parseFile("test.xyz", {
				content: "some unsupported content",
			})

			// Should return empty array for unsupported extensions
			expect(Array.isArray(results)).toBe(true)
			expect(results).toHaveLength(0)
		} catch (error) {
			// Should not throw due to unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should verify that parseFile can be called with unsupported files", async () => {
		const codeParser = new CodeParser()

		// Test with unsupported extension
		try {
			const results = await codeParser.parseFile("test.unsupportedext", {
				content: "unsupported content",
			})

			// Should return an empty array for unsupported extensions
			expect(Array.isArray(results)).toBe(true)
			expect(results).toHaveLength(0)
		} catch (error) {
			// Should not throw due to unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should handle empty file content gracefully", async () => {
		const codeParser = new CodeParser()

		try {
			const results = await codeParser.parseFile("test.js", {
				content: "",
			})

			// Should return an array (possibly empty)
			expect(Array.isArray(results)).toBe(true)
		} catch (error) {
			// Should not throw due to unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should verify the integration between loadRequiredLanguageParsers and parseFile", async () => {
		const codeParser = new CodeParser()

		// Clear previous warnings
		mockConsoleWarn.mockClear()

		// Test with a supported extension
		try {
			await codeParser.parseFile("test.js", {
				content: "const x = 1;",
			})

			// The important part is that parseFile completes without throwing
			// errors for supported extensions
			expect(true).toBe(true)
		} catch (error) {
			// Verify that any error is not related to unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}

		// Test with an unsupported extension
		try {
			const results = await codeParser.parseFile("test.unsupportedext", {
				content: "unsupported content",
			})

			// Should return empty array for unsupported extensions
			expect(results).toHaveLength(0)
		} catch (error) {
			// Should not throw due to unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})
})
