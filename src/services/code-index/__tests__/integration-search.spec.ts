/**
 * Integration tests for multi-backend search
 * Tests the end-to-end search flow from CodeIndexManager through SearchOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { CodeIndexManager } from "../manager"
import { SearchOrchestrator } from "../query/search-orchestrator"
import { HybridSearchService, HybridSearchResult } from "../hybrid-search-service"
import { INeo4jService, CodeNode } from "../interfaces/neo4j-service"
import { ILSPService } from "../interfaces/lsp-service"
import { ExportInfo } from "../types/metadata"

describe("Integration: Multi-Backend Search", () => {
	let mockHybridSearchService: HybridSearchService
	let mockNeo4jService: INeo4jService
	let mockLSPService: ILSPService
	let searchOrchestrator: SearchOrchestrator

	// Helper to create mock search results
	const createMockResult = (
		id: string,
		score: number,
		filePath: string,
		identifier: string,
		exportSymbols: string[] = [],
	): HybridSearchResult => ({
		id,
		score,
		payload: {
			filePath,
			codeChunk: `export function ${identifier}() { /* implementation */ }`,
			startLine: 1,
			endLine: 10,
			identifier,
			type: "function",
			language: "typescript",
			exports: exportSymbols.map((symbol) => ({ symbol, type: "named" as const })),
		},
		hybridScore: score,
		vectorScore: score * 0.7,
		bm25Score: score * 0.3,
	})

	// Helper to create mock Neo4j nodes
	const createMockNode = (
		id: string,
		name: string,
		filePath: string,
		type: "function" | "class" | "method" | "interface" | "variable" | "import" | "file" = "function",
	): CodeNode => ({
		id,
		name,
		type,
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

		// Create search orchestrator
		searchOrchestrator = new SearchOrchestrator(mockHybridSearchService, mockNeo4jService, mockLSPService)
	})

	describe("End-to-End Search Flow", () => {
		it("should perform semantic search using hybrid backend", async () => {
			const mockResults = [
				createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService", ["UserService"]),
				createMockResult("result2", 0.85, "src/services/auth-service.ts", "AuthService", ["AuthService"]),
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await searchOrchestrator.search("user authentication services")

			expect(results).toHaveLength(2)
			expect(results[0].payload?.identifier).toBe("UserService")
			expect(results[0].queryAnalysis?.intent).toBe("semantic_search")
			expect(results[0].usedBackends).toContain("vector")
			expect(results[0].usedBackends).toContain("bm25")
		})

		it("should perform implementation search with exported symbol boost", async () => {
			const mockResults = [
				createMockResult("result1", 0.8, "src/services/user-service.ts", "UserService", ["UserService"]),
				createMockResult("result2", 0.8, "src/internal/user-impl.ts", "UserServiceImpl", []),
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await searchOrchestrator.search("how is UserService implemented")

			// Exported symbol should be boosted (0.8 * 1.15 = 0.92)
			expect(results[0].score).toBeCloseTo(0.92, 2)
			expect(results[0].payload?.identifier).toBe("UserService")
			expect(results[1].score).toBe(0.8)
			expect(results[1].payload?.identifier).toBe("UserServiceImpl")
			expect(results[0].queryAnalysis?.intent).toBe("find_implementation")
			expect(results[0].queryAnalysis?.boostExported).toBe(true)
		})

		it("should perform test search with test file filtering", async () => {
			const mockResults = [
				createMockResult("result1", 0.9, "src/__tests__/user-service.spec.ts", "testUserService"),
				createMockResult("result2", 0.85, "src/services/user-service.ts", "UserService"),
				createMockResult("result3", 0.8, "src/user-service.test.ts", "testUserServiceIntegration"),
			]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await searchOrchestrator.search("tests for UserService")

			// Should only include test files
			expect(results).toHaveLength(2)
			expect(results[0].payload?.filePath).toContain("spec.ts")
			expect(results[1].payload?.filePath).toContain("test.ts")
			expect(results[0].queryAnalysis?.intent).toBe("find_tests")
			expect(results[0].queryAnalysis?.testFilesOnly).toBe(true)
		})
	})

	describe("Graph Query Routing", () => {
		it("should route caller queries to Neo4j graph backend", async () => {
			const mockGraphNodes = [
				createMockNode("node1", "AuthController.login", "src/controllers/auth-controller.ts"),
				createMockNode("node2", "UserController.register", "src/controllers/user-controller.ts"),
			]

			vi.mocked(mockNeo4jService.findCallers).mockResolvedValue(mockGraphNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await searchOrchestrator.search("who calls UserService")

			expect(mockNeo4jService.findCallers).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(2)
			expect(results[0].payload?.identifier).toBe("AuthController.login")
			expect(results[0].queryAnalysis?.intent).toBe("find_callers")
			expect(results[0].usedBackends).toContain("graph")
		})

		it("should route callee queries to Neo4j graph backend", async () => {
			const mockGraphNodes = [
				createMockNode("node1", "validateUser", "src/utils/validation.ts"),
				createMockNode("node2", "hashPassword", "src/utils/crypto.ts"),
			]

			vi.mocked(mockNeo4jService.findCallees).mockResolvedValue(mockGraphNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await searchOrchestrator.search("what does UserService call")

			expect(mockNeo4jService.findCallees).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(2)
			expect(results[0].payload?.identifier).toBe("validateUser")
			expect(results[0].queryAnalysis?.intent).toBe("find_callees")
			expect(results[0].usedBackends).toContain("graph")
		})

		it("should route dependency queries to Neo4j graph backend", async () => {
			const mockGraphNodes = [
				createMockNode("node1", "express", "node_modules/express/index.js", "import"),
				createMockNode("node2", "bcrypt", "node_modules/bcrypt/index.js", "import"),
			]

			vi.mocked(mockNeo4jService.findDependencies).mockResolvedValue(mockGraphNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await searchOrchestrator.search("what does UserService depend on")

			expect(mockNeo4jService.findDependencies).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(2)
			expect(results[0].payload?.identifier).toBe("express")
			expect(results[0].queryAnalysis?.intent).toBe("find_dependencies")
			expect(results[0].usedBackends).toContain("graph")
		})

		it("should route dependent queries to Neo4j graph backend", async () => {
			const mockGraphNodes = [
				createMockNode("node1", "AuthController", "src/controllers/auth-controller.ts", "class"),
				createMockNode("node2", "UserController", "src/controllers/user-controller.ts", "class"),
			]

			vi.mocked(mockNeo4jService.findDependents).mockResolvedValue(mockGraphNodes)
			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue([])

			const results = await searchOrchestrator.search("what depends on UserService")

			expect(mockNeo4jService.findDependents).toHaveBeenCalledWith("UserService")
			expect(results).toHaveLength(2)
			expect(results[0].payload?.identifier).toBe("AuthController")
			expect(results[0].queryAnalysis?.intent).toBe("find_dependents")
			expect(results[0].usedBackends).toContain("graph")
		})
	})

	describe("LSP-Based Type Searches", () => {
		it("should route type queries to LSP backend", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await searchOrchestrator.search("what is the return type of UserService.getUser")

			expect(results).toHaveLength(1)
			expect(results[0].queryAnalysis?.intent).toBe("find_by_type")
			expect(results[0].usedBackends).toContain("lsp")
		})
	})

	describe("Hybrid Search with Different Fusion Weights", () => {
		it("should use vector-heavy weights for semantic queries", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			await searchOrchestrator.search("user authentication logic")

			// Semantic search should favor vector search (70% vector, 30% BM25)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(
				"user authentication logic",
				undefined,
				expect.objectContaining({
					vectorWeight: 0.7,
					bm25Weight: 0.3,
				}),
			)
		})

		it("should use balanced weights for implementation queries", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			await searchOrchestrator.search("how is UserService implemented")

			// Implementation search should use balanced weights (60% vector, 40% BM25)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalledWith(
				"how is UserService implemented",
				undefined,
				expect.objectContaining({
					vectorWeight: 0.6,
					bm25Weight: 0.4,
				}),
			)
		})
	})

	describe("Backward Compatibility", () => {
		it("should return results compatible with existing search API", async () => {
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await searchOrchestrator.search("find UserService")

			// Results should have all standard HybridSearchResult fields
			expect(results[0]).toHaveProperty("id")
			expect(results[0]).toHaveProperty("score")
			expect(results[0]).toHaveProperty("payload")
			expect(results[0]).toHaveProperty("hybridScore")
			expect(results[0]).toHaveProperty("vectorScore")
			expect(results[0]).toHaveProperty("bm25Score")

			// Results should also have orchestration metadata
			expect(results[0]).toHaveProperty("queryAnalysis")
			expect(results[0]).toHaveProperty("usedBackends")
		})

		it("should work without Neo4j service (optional backend)", async () => {
			const orchestratorWithoutNeo4j = new SearchOrchestrator(mockHybridSearchService)
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestratorWithoutNeo4j.search("who calls UserService")

			// Should fall back to hybrid search
			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
		})

		it("should work without LSP service (optional backend)", async () => {
			const orchestratorWithoutLSP = new SearchOrchestrator(mockHybridSearchService, mockNeo4jService)
			const mockResults = [createMockResult("result1", 0.9, "src/services/user-service.ts", "UserService")]

			vi.mocked(mockHybridSearchService.searchIndex).mockResolvedValue(mockResults)

			const results = await orchestratorWithoutLSP.search("what is the return type of UserService.getUser")

			// Should fall back to hybrid search
			expect(results).toHaveLength(1)
			expect(mockHybridSearchService.searchIndex).toHaveBeenCalled()
		})
	})
})
