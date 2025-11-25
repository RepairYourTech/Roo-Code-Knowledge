import { describe, it, expect, vi, beforeEach } from "vitest"

// Simple test to verify the basic functionality
describe("Simple loadRequiredLanguageParsers test", () => {
	it("should handle empty array", async () => {
		// This is a basic test that should work without mocking
		const { loadRequiredLanguageParsers } = await import("../languageParser")

		const result = await loadRequiredLanguageParsers([])
		expect(result).toBeDefined()
		expect(Object.keys(result)).toHaveLength(0)
	})
})
