import { SearchOrchestrator, SearchOrchestrationOptions, OrchestrationResult } from "../search-orchestrator"
import { HybridSearchService, HybridSearchResult } from "../../hybrid-search-service"
import { INeo4jService, CodeNode } from "../../interfaces/neo4j-service"
import { ILSPService } from "../../interfaces/lsp-service"
import { ExportInfo } from "../../types/metadata"
import { vi, describe, it, expect, beforeEach } from "vitest"

describe("SearchOrchestrator", () => {
	let orchestrator: SearchOrchestrator
	let mockHybridSearchService: HybridSearchService
	let mockNeo4jService: INeo4jService
	let mockLSPService: ILSPService

	// Helper to create mock search results
	const createMockResult = (
		id: string,
		score: number,
		filePath: string,
		exportSymbols: string[] = [],
	): HybridSearchResult => ({
		id,
		score,
		payload: {
			filePath,
			codeChunk: `// Code for ${id}`,
			startLine: 1,
			endLine: 10,
			identifier: id,
			type: "function",
			language: "typescript",
			exports: exportSymbols.map((symbol) => ({ symbol, type: "named" as const })),
		},
		hybridScore: score,
		vectorScore: score * 0.7,
		bm25Score: score * 0.3,
	})

	// Helper to create mock Neo4j nodes
	const createMockNode = (id: string, name: string, filePath: string): CodeNode => ({
		id,
		name,
		type: "function",
		filePath,
		startLine: 1,
		endLine: 10,
		language: "typescript",
	})

	beforeEach(() => {
		// Create mock services
		mockHybridSearchService = {
			searchIndex: vi.fn(),
		} as any

		mockNeo4jService = {
			findCallers: vi.fn(),
			findCallees: vi.fn(),
			findDependencies: vi.fn(),
			findDependents: vi.fn(),
		} as any

		mockLSPService = {} as any

		// Create orchestrator with all backends
		orchestrator = new SearchOrchestrator(mockHybridSearchService, mockNeo4jService, mockLSPService)
	})

	describe("Query Routing", () => {
		it("should route find_implementation to hybrid search (vector + BM25)", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user-service.ts", ["UserService"])]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("how is UserService implemented")

			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(
				"how is UserService implemented",
				undefined,
				expect.objectContaining({
					vectorWeight: expect.any(Number),
					bm25Weight: expect.any(Number),
					fusionStrategy: "weighted",
				}),
			)
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_implementation")
		})

		it("should route find_callers to graph backend", async () => {
			const mockNodes = [createMockNode("node1", "authenticate", "src/auth.ts")]
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await orchestrator.search("who calls UserService")

			expect(mockNeo4jService.findCallers).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_callers")
		})

		it("should route find_callees to graph backend", async () => {
			const mockNodes = [createMockNode("node1", "validateUser", "src/validation.ts")]
			vi.mocked(mockNeo4jService.findCallees).mockResolvedValue(mockNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await orchestrator.search("what does UserService call")

			expect(mockNeo4jService.findCallees).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_callees")
		})

		it("should route find_dependencies to graph backend", async () => {
			const mockNodes = [createMockNode("node1", "express", "node_modules/express/index.js")]
			vi.mocked(mockNeo4jService.findDependencies).mockResolvedValue(mockNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await orchestrator.search("what does UserService depend on")

			expect(mockNeo4jService.findDependencies).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_dependencies")
		})

		it("should route find_dependents to graph backend", async () => {
			const mockNodes = [createMockNode("node1", "AuthController", "src/controllers/auth.ts")]
			vi.mocked(mockNeo4jService.findDependents).mockResolvedValue(mockNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await orchestrator.search("what depends on UserService")

			expect(mockNeo4jService.findDependents).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_dependents")
		})

		it("should route semantic_search to hybrid search", async () => {
			const mockResults = [createMockResult("result1", 0.85, "src/utils.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("authentication logic in the codebase")

			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("semantic_search")
		})
	})

	describe("Parallel Execution", () => {
		it("should execute graph + hybrid searches in parallel", async () => {
			const mockHybridResults = [createMockResult("hybrid1", 0.8, "src/user.ts")]
			const mockGraphNodes = [createMockNode("graph1", "login", "src/auth.ts")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockHybridResults)
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockGraphNodes)

			const startTime = Date.now()
			await orchestrator.search("who calls UserService")
			const duration = Date.now() - startTime

			// Both should be called
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
			expect(mockNeo4jService.findCallers).toHaveBeenCalled()

			// Should complete quickly (parallel execution)
			expect(duration).toBeLessThan(100)
		})
	})

	describe("Result Merging and Deduplication", () => {
		it("should deduplicate results from different backends", async () => {
			// Same result from both hybrid and graph
			const mockHybridResults = [createMockResult("result1", 0.8, "src/user.ts")]
			const mockGraphNodes = [createMockNode("result1", "UserService", "src/user.ts")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockHybridResults)
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockGraphNodes)

			const results = await orchestrator.search("who calls UserService")

			// Should only have one result (deduplicated)
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("result1")
		})

		it("should keep higher score when deduplicating", async () => {
			// Same ID but different scores
			const mockHybridResults = [createMockResult("result1", 0.9, "src/user.ts")]
			const mockGraphNodes = [createMockNode("result1", "UserService", "src/user.ts")] // Graph score will be 1.0

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockHybridResults)
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockGraphNodes)

			const results = await orchestrator.search("who calls UserService")

			// Should keep the graph result (score 1.0 > 0.9)
			expect(results).toHaveLength(1)
			expect(results[0].score).toBe(1.0)
		})

		it("should sort results by score descending", async () => {
			const mockResults = [
				createMockResult("result1", 0.5, "src/a.ts"),
				createMockResult("result2", 0.9, "src/b.ts"),
				createMockResult("result3", 0.7, "src/c.ts"),
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("find something")

			// Should be sorted by score descending
			expect(results[0].score).toBe(0.9)
			expect(results[1].score).toBe(0.7)
			expect(results[2].score).toBe(0.5)
		})
	})

	describe("Query Enhancements", () => {
		it("should boost exported symbols for find_implementation queries", async () => {
			const mockResults = [
				createMockResult("result1", 0.8, "src/user.ts", ["UserService"]), // Exported
				createMockResult("result2", 0.8, "src/internal.ts", []), // Not exported
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("how is UserService implemented")

			// Exported symbol should have boosted score (0.8 * 1.15 = 0.92)
			expect(results[0].score).toBeCloseTo(0.92, 2)
			expect(results[0].id).toBe("result1")
			// Non-exported should remain at 0.8
			expect(results[1].score).toBe(0.8)
			expect(results[1].id).toBe("result2")
		})

		it("should filter to test files only for find_tests queries", async () => {
			const mockResults = [
				createMockResult("result1", 0.9, "src/__tests__/user.spec.ts"),
				createMockResult("result2", 0.85, "src/user.ts"), // Not a test file
				createMockResult("result3", 0.8, "src/user.test.ts"),
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("tests for UserService")

			// Should only include test files
			expect(results).toHaveLength(2)
			expect(results[0].payload?.filePath).toContain("spec.ts")
			expect(results[1].payload?.filePath).toContain("test.ts")
		})

		it("should recognize various test file patterns", async () => {
			const mockResults = [
				createMockResult("result1", 0.9, "src/__tests__/user.ts"),
				createMockResult("result2", 0.85, "src/test/user.ts"),
				createMockResult("result3", 0.8, "src/tests/user.ts"),
				createMockResult("result4", 0.75, "src/user.spec.js"),
				createMockResult("result5", 0.7, "src/user.test.js"),
				createMockResult("result6", 0.65, "src/user.ts"), // Not a test
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("test cases for UserService")

			// Should include all test patterns but not the regular file
			expect(results).toHaveLength(5)
			expect(results.every((r) => r.id !== "result6")).toBe(true)
		})
	})

	describe("Fallback Behavior", () => {
		it("should work when neo4jService is undefined", async () => {
			const orchestratorWithoutNeo4j = new SearchOrchestrator(mockHybridSearchService)
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			// Graph query should fall back to hybrid search
			const results = await orchestratorWithoutNeo4j.search("who calls UserService")

			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
		})

		it("should work when lspService is undefined", async () => {
			const orchestratorWithoutLSP = new SearchOrchestrator(mockHybridSearchService, mockNeo4jService)
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			// LSP query should fall back to hybrid search
			const results = await orchestratorWithoutLSP.search("what is the return type of UserService")

			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
		})

		it("should work with only hybrid search service", async () => {
			const minimalOrchestrator = new SearchOrchestrator(mockHybridSearchService)
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await minimalOrchestrator.search("find UserService")

			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
		})
	})

	describe("Options Handling", () => {
		it("should override backends with forceBackends option", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const options: SearchOrchestrationOptions = {
				forceBackends: ["vector", "bm25"], // Force hybrid search even for graph query
			}

			const results = await orchestrator.search("who calls UserService", options)

			// Should use hybrid search instead of graph
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
			expect(mockNeo4jService.findCallers).not.toHaveBeenCalled()
			expect(results[0].usedBackends).toEqual(["vector", "bm25"])
		})

		it("should override weights with forceWeights option", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const options: SearchOrchestrationOptions = {
				forceWeights: {
					vector: 0.5,
					bm25: 0.5,
					graph: 0,
					lsp: 0,
				},
			}

			await orchestrator.search("find UserService", options)

			// Should use custom weights (50/50 split)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(
				"find UserService",
				undefined,
				expect.objectContaining({
					vectorWeight: 0.5,
					bm25Weight: 0.5,
				}),
			)
		})

		it("should pass directoryPrefix option to hybrid search", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/services/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const options: SearchOrchestrationOptions = {
				directoryPrefix: "src/services",
			}

			await orchestrator.search("find UserService", options)

			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(
				"find UserService",
				"src/services",
				expect.any(Object),
			)
		})
	})

	describe("Orchestration Metadata", () => {
		it("should include query analysis in results", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("how is UserService implemented")

			expect(results[0].queryAnalysis).toBeDefined()
			expect(results[0].queryAnalysis?.intent).toBe("find_implementation")
			expect(results[0].queryAnalysis?.symbolName).toBe("UserService")
		})

		it("should include used backends in results", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("find UserService")

			expect(results[0].usedBackends).toBeDefined()
			expect(results[0].usedBackends).toContain("vector")
			expect(results[0].usedBackends).toContain("bm25")
		})

		it("should include graph backend when used", async () => {
			const mockNodes = [createMockNode("node1", "authenticate", "src/auth.ts")]
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await orchestrator.search("who calls UserService")

			expect(results[0].usedBackends).toContain("graph")
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty results from all backends", async () => {
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue([])

			const results = await orchestrator.search("who calls NonExistentService")

			expect(results).toHaveLength(0)
		})

		it("should handle query with no symbol name", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			const mockNodes: CodeNode[] = []
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)
			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockNodes)

			const results = await orchestrator.search("who calls something")

			// Should still work - "something" will be extracted as symbol
			expect(results).toHaveLength(1)
			// Graph backend should be called with extracted symbol
			expect(mockNeo4jService.findCallers).toHaveBeenCalledWith("something")
		})

		it("should handle very long queries", async () => {
			const longQuery = "how is " + "UserService ".repeat(100) + "implemented"
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search(longQuery)

			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(longQuery, undefined, expect.any(Object))
		})

		it("should handle special characters in queries", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/user.ts")]
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestrator.search("find User$Service with @decorator")

			expect(results).toHaveLength(1)
		})
	})
})
