import { describe, it, expect, beforeEach } from "vitest"
import { GraphIndexer } from "../graph-indexer"
import { CodeBlock } from "../../interfaces/file-processor"
import { INeo4jService } from "../../interfaces/neo4j-service"

describe("GraphIndexer - Synthetic Identifier Generation", () => {
	let graphIndexer: GraphIndexer
	let mockNeo4jService: INeo4jService

	beforeEach(() => {
		// Create a minimal mock Neo4j service
		mockNeo4jService = {
			upsertNodes: async () => {},
			createRelationships: async () => {},
		} as any

		graphIndexer = new GraphIndexer(mockNeo4jService)
	})

	describe("generateSyntheticIdentifier", () => {
		it("should generate synthetic identifier for CSS declaration without name", () => {
			const block: CodeBlock = {
				file_path: "/home/user/project/styles/globals.css",
				identifier: null,
				type: "declaration",
				start_line: 54,
				end_line: 56,
				content: "color: red;",
				segmentHash: "abc123",
				fileHash: "def456",
			}

			const nodes = graphIndexer.extractNodes(block)

			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("declaration_globals.css_L54-56")
		})

		it("should generate synthetic identifier for markdown content", () => {
			const block: CodeBlock = {
				file_path: "/docs/README.md",
				identifier: null,
				type: "markdown_content",
				start_line: 1,
				end_line: 10,
				content: "This is some markdown content",
				segmentHash: "xyz789",
				fileHash: "uvw012",
			}

			const nodes = graphIndexer.extractNodes(block)

			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("markdown_content_README.md_L1-10")
		})

		it("should generate synthetic identifier for keyframes statement", () => {
			const block: CodeBlock = {
				file_path: "/styles/animations.css",
				identifier: "",
				type: "keyframes_statement",
				start_line: 115,
				end_line: 125,
				content: "@keyframes spin { ... }",
				segmentHash: "key123",
				fileHash: "frame456",
			}

			const nodes = graphIndexer.extractNodes(block)

			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("keyframes_statement_animations.css_L115-125")
		})

		it("should preserve existing identifier when present", () => {
			const block: CodeBlock = {
				file_path: "/src/utils.ts",
				identifier: "calculateTotal",
				type: "function_declaration",
				start_line: 50,
				end_line: 60,
				content: "function calculateTotal() { ... }",
				segmentHash: "calc123",
				fileHash: "util456",
			}

			const nodes = graphIndexer.extractNodes(block)

			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("calculateTotal")
		})

		it("should handle whitespace-only identifier as empty", () => {
			const block: CodeBlock = {
				file_path: "/test.css",
				identifier: "   ",
				type: "rule_set",
				start_line: 10,
				end_line: 15,
				content: ".class { }",
				segmentHash: "rule123",
				fileHash: "test456",
			}

			const nodes = graphIndexer.extractNodes(block)

			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("rule_set_test.css_L10-15")
		})

		it("should generate deterministic identifiers for same location", () => {
			const block1: CodeBlock = {
				file_path: "/app/styles.css",
				identifier: null,
				type: "declaration",
				start_line: 25,
				end_line: 27,
				content: "margin: 0;",
				segmentHash: "hash1",
				fileHash: "file1",
			}

			const block2: CodeBlock = {
				file_path: "/app/styles.css",
				identifier: null,
				type: "declaration",
				start_line: 25,
				end_line: 27,
				content: "padding: 0;",
				segmentHash: "hash2",
				fileHash: "file2",
			}

			const nodes1 = graphIndexer.extractNodes(block1)
			const nodes2 = graphIndexer.extractNodes(block2)

			// Same location should produce same synthetic identifier
			expect(nodes1[0].name).toBe(nodes2[0].name)
			expect(nodes1[0].name).toBe("declaration_styles.css_L25-27")
		})

		it("should extract filename correctly from various path formats", () => {
			const testCases = [
				{
					path: "/home/user/project/file.css",
					expected: "file.css",
				},
				{
					path: "relative/path/file.md",
					expected: "file.md",
				},
				{
					path: "C:\\Windows\\path\\file.js",
					expected: "file.js",
				},
				{
					path: "single-file.ts",
					expected: "single-file.ts",
				},
			]

			testCases.forEach(({ path, expected }) => {
				const block: CodeBlock = {
					file_path: path,
					identifier: null,
					type: "test_block",
					start_line: 1,
					end_line: 5,
					content: "test",
					segmentHash: "test",
					fileHash: "test",
				}

				const nodes = graphIndexer.extractNodes(block)
				expect(nodes[0].name).toContain(expected)
			})
		})
	})

	describe("extractNodes validation", () => {
		it("should still validate other properties even with synthetic identifiers", () => {
			// Invalid line range
			const invalidBlock: CodeBlock = {
				file_path: "/test.css",
				identifier: null,
				type: "declaration",
				start_line: 100,
				end_line: 50, // End before start
				content: "test",
				segmentHash: "test",
				fileHash: "test",
			}

			const nodes = graphIndexer.extractNodes(invalidBlock)
			expect(nodes).toHaveLength(0)
		})

		it("should skip blocks with empty file path", () => {
			const block: CodeBlock = {
				file_path: "",
				identifier: null,
				type: "declaration",
				start_line: 1,
				end_line: 5,
				content: "test",
				segmentHash: "test",
				fileHash: "test",
			}

			const nodes = graphIndexer.extractNodes(block)
			expect(nodes).toHaveLength(0)
		})
	})
})
