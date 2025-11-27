import { CodeParser } from "../parser"
import { loadRequiredLanguageParsers } from "../../../tree-sitter/languageParser"
import { readFile } from "fs/promises"
import { vi, describe, it, expect, beforeEach } from "vitest"

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Override Jest-based fs/promises mock with vitest-compatible version
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
	readFile: vi.fn(),
}))

vi.mock("../../../tree-sitter/languageParser")
vi.mock("../../../tree-sitter/markdownParser")

describe("CodeParser Imports Propagation", () => {
	let parser: CodeParser

	beforeEach(() => {
		vi.clearAllMocks()
		parser = new CodeParser()
		;(loadRequiredLanguageParsers as any).mockResolvedValue({} as any)
		vi.mocked(readFile).mockResolvedValue("// default test content")
	})

	describe("_performFallbackChunking", () => {
		it("should propagate imports to fallback chunks", async () => {
			const content = `/* This is a long test content string that exceeds 100 characters to test fallback chunking behavior.
			It includes multiple lines and various JavaScript constructs to simulate real-world code.
			line1: const a = 1;
			line2: const b = 2;
			line3: function sum() { return a + b; }
			line4: class Adder { constructor(x, y) { this.x = x; this.y = y; } }
			line5: const instance = new Adder(1, 2);
			line6: console.log(instance.x + instance.y);
			line7: // More comments to pad the length to ensure we hit the minimum character requirement */`

			const mockImports = [
				{
					source: "react",
					specifiers: ["useState", "useEffect"],
					isDefault: false,
					isNamespace: false,
					isTypeOnly: false,
					symbols: [],
					isDynamic: false,
				},
			]

			const result = await parser["_performFallbackChunking"]("test.js", content, "hash", new Set(), mockImports)

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].type).toBe("fallback_chunk")
			expect(result[0].imports).toEqual(mockImports)
		})
	})

	describe("_chunkLeafNodeByLines", () => {
		it("should propagate imports to leaf node chunks", async () => {
			const mockNode = {
				text: `/* This is a long test content string that exceeds 100 characters to test line chunking behavior.
				line1: const a = 1;
				line2: const b = 2;
				line3: function sum() { return a + b; }
				line4: class Multiplier { constructor(x, y) { this.x = x; this.y = y; } }
				line5: const instance = new Multiplier(3, 4);
				line6: console.log(instance.x * instance.y);
				line7: // More comments to pad the length to ensure we hit the minimum character requirement */`,
				startPosition: { row: 10 },
				endPosition: { row: 12 },
				type: "function",
			} as any

			const mockImports = [
				{
					source: "lodash",
					specifiers: ["debounce"],
					isDefault: false,
					isNamespace: false,
					isTypeOnly: false,
					symbols: [],
					isDynamic: false,
				},
			]

			const result = await parser["_chunkLeafNodeByLines"](mockNode, "test.js", "hash", new Set(), mockImports)

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].imports).toEqual(mockImports)
		})
	})
})
