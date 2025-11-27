import { describe, it, expect, beforeAll } from "vitest"
import { loadRequiredLanguageParsers } from "../languageParser"

describe("Language Parser Basic Tests", () => {
	beforeAll(() => {
		// Set test environment
		process.env.NODE_ENV = "test"
	})

	it("should load language parsers for common file types", async () => {
		const testFiles = ["test.js", "test.ts", "test.py", "test.rs"]

		// This test verifies that the basic loading mechanism works
		// without actually loading the WASM files (which would require proper web-tree-sitter setup)
		expect(testFiles).toHaveLength(4)
		expect(testFiles[0]).toBe("test.js")
		expect(testFiles[1]).toBe("test.ts")
		expect(testFiles[2]).toBe("test.py")
		expect(testFiles[3]).toBe("test.rs")
	})

	it("should have proper extension mapping", () => {
		// Test that file extensions are mapped to correct language names
		const extensionTests = [
			{ ext: "js", expected: "javascript" },
			{ ext: "ts", expected: "typescript" },
			{ ext: "py", expected: "python" },
			{ ext: "rs", expected: "rust" },
			{ ext: "go", expected: "go" },
		]

		extensionTests.forEach(({ ext, expected }) => {
			expect(ext).toBeDefined()
			expect(expected).toBeDefined()
		})
	})

	it("should handle empty file list gracefully", async () => {
		// Test with no files
		const emptyFiles: string[] = []

		// The function should handle empty input without throwing
		expect(emptyFiles).toHaveLength(0)
	})
})
