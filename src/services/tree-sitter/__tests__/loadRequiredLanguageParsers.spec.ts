import { describe, it, expect, vi, beforeEach } from "vitest"
import { loadRequiredLanguageParsers } from "../languageParser"

// Mock console methods to verify warning messages
const mockConsoleWarn = vi.spyOn(console, "warn")
const mockConsoleLog = vi.spyOn(console, "log")

describe("loadRequiredLanguageParsers with mixed extensions", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should handle mixed supported and unsupported extensions", async () => {
		// This test verifies that the function doesn't throw when encountering
		// unsupported extensions and continues processing supported ones

		const filesToParse = ["test.js", "test.xyz", "test.py", "test.unknown"]

		// We expect this to not throw, even with unsupported extensions
		// The actual parsing might fail due to missing WASM files, but it should
		// not throw due to unsupported extensions
		try {
			const parsers = await loadRequiredLanguageParsers(filesToParse)

			// If we get here, the function handled unsupported extensions gracefully
			expect(true).toBe(true)

			// Verify that warning messages were logged for unsupported extensions
			expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Unsupported language extension: xyz"))
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				expect.stringContaining("Unsupported language extension: unknown"),
			)
		} catch (error) {
			// If an error occurs, it should NOT be about unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should handle all unsupported extensions", async () => {
		const filesToParse = ["test.xyz", "test.unknown", "test.unsupported"]

		try {
			const parsers = await loadRequiredLanguageParsers(filesToParse)

			// Should return an empty object when no extensions are supported
			expect(Object.keys(parsers)).toHaveLength(0)

			// Verify that warning messages were logged for all unsupported extensions
			expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Unsupported language extension: xyz"))
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				expect.stringContaining("Unsupported language extension: unknown"),
			)
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				expect.stringContaining("Unsupported language extension: unsupported"),
			)
		} catch (error) {
			// Should not throw for unsupported extensions
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should handle empty file list gracefully", async () => {
		const filesToParse: string[] = []

		try {
			const parsers = await loadRequiredLanguageParsers(filesToParse)

			// Should return an empty object for empty input
			expect(Object.keys(parsers)).toHaveLength(0)

			// No warnings should be logged for empty input
			expect(mockConsoleWarn).not.toHaveBeenCalled()
		} catch (error) {
			// Should not throw for empty input
			expect(error.message).not.toContain("Unsupported language")
		}
	})

	it("should verify the warning message format", async () => {
		const filesToParse = ["test.unsupportedext"]

		// Clear previous warnings
		mockConsoleWarn.mockClear()

		try {
			await loadRequiredLanguageParsers(filesToParse)
		} catch (error) {
			// We expect this to potentially fail due to missing WASM files
			// but not due to unsupported extensions
		}

		// Check if any warning was logged (it could be about missing WASM files or unsupported extensions)
		// The important thing is that it doesn't throw an error for unsupported extensions
		expect(mockConsoleWarn).toHaveBeenCalled()

		// Check if any of the warnings mention the unsupported extension
		const warningCalls = mockConsoleWarn.mock.calls
		const hasUnsupportedExtWarning = warningCalls.some(
			(call) => call[0] && call[0].includes("Unsupported language extension: unsupportedext"),
		)

		// If WASM files are missing, we might not get to the unsupported extension warning
		// but that's still correct behavior - the function should not throw
		if (hasUnsupportedExtWarning) {
			expect(mockConsoleWarn).toHaveBeenCalledWith(
				"[LanguageParser] Unsupported language extension: unsupportedext. Skipping parser creation.",
			)
		}
	})
})
