import { describe, it, expect, beforeEach, vi } from "vitest"
import { QualityMetricsService } from "../quality-metrics-service"
import { INeo4jService, CodeNode } from "../../interfaces/neo4j-service"
import { HybridSearchResult } from "../../hybrid-search-service"

describe("QualityMetricsService", () => {
	let service: QualityMetricsService
	let mockNeo4jService: INeo4jService

	beforeEach(() => {
		// Create mock Neo4j service
		mockNeo4jService = {
			executeQuery: vi.fn(),
			createNode: vi.fn(),
			updateNode: vi.fn(),
			deleteNode: vi.fn(),
			createRelationship: vi.fn(),
			deleteRelationship: vi.fn(),
			findNode: vi.fn(),
			findRelationships: vi.fn(),
			findCallers: vi.fn(),
			findCallees: vi.fn(),
			findImpactedNodes: vi.fn(),
			findDependencyTree: vi.fn(),
			calculateBlastRadius: vi.fn(),
			assessChangeSafety: vi.fn(),
		} as unknown as INeo4jService

		service = new QualityMetricsService(mockNeo4jService)
	})

	describe("calculateCoverage", () => {
		it("should calculate coverage metrics for a tested node", async () => {
			// Mock Neo4j query response
			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: [
					{
						directTests: 2,
						integrationTests: 1,
					},
				],
				relationships: [],
			})

			const result = await service.calculateCoverage("test-node-id")

			expect(result).toEqual({
				isTested: true,
				directTests: 2,
				integrationTests: 1,
				coveragePercentage: 100,
				testQuality: "medium",
			})
		})

		it("should calculate coverage metrics for an untested node", async () => {
			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: [
					{
						directTests: 0,
						integrationTests: 0,
					},
				],
				relationships: [],
			})

			const result = await service.calculateCoverage("test-node-id")

			expect(result).toEqual({
				isTested: false,
				directTests: 0,
				integrationTests: 0,
				coveragePercentage: 0,
				testQuality: "none",
			})
		})

		it("should assess test quality as high for 3+ direct tests", async () => {
			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: [
					{
						directTests: 5,
						integrationTests: 2,
					},
				],
				relationships: [],
			})

			const result = await service.calculateCoverage("test-node-id")

			expect(result?.testQuality).toBe("high")
		})

		it("should assess test quality as low for integration tests only", async () => {
			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: [
					{
						directTests: 0,
						integrationTests: 3,
					},
				],
				relationships: [],
			})

			const result = await service.calculateCoverage("test-node-id")

			expect(result?.testQuality).toBe("low")
			expect(result?.coveragePercentage).toBe(50)
		})
	})

	describe("findUnusedFunctions", () => {
		it("should find functions with no CALLED_BY relationships", async () => {
			const unusedFunctions: CodeNode[] = [
				{
					id: "func1",
					name: "unusedFunction",
					type: "function",
					filePath: "/test/file.ts",
					startLine: 10,
					endLine: 20,
				},
			]

			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: unusedFunctions,
				relationships: [],
			})

			const result = await service.findUnusedFunctions()

			expect(result).toEqual(unusedFunctions)
			expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(
				expect.stringContaining("NOT (func)<-[:CALLED_BY]-()"),
				{},
			)
		})

		it("should filter by file path when provided", async () => {
			vi.mocked(mockNeo4jService.executeQuery).mockResolvedValue({
				nodes: [],
				relationships: [],
			})

			await service.findUnusedFunctions("/test/file.ts")

			expect(mockNeo4jService.executeQuery).toHaveBeenCalledWith(
				expect.stringContaining("func.filePath = $filePath"),
				{ filePath: "/test/file.ts" },
			)
		})
	})

	describe("enrichWithQualityMetrics", () => {
		it("should enrich search results with quality metrics", async () => {
			const searchResults: HybridSearchResult[] = [
				{
					id: "result1",
					score: 0.9,
					payload: {
						filePath: "/test/file.ts",
						identifier: "testFunction",
						codeChunk: "function testFunction() {}",
						startLine: 1,
						endLine: 3,
						type: "function",
					},
				},
			]

			// Mock finding node ID
			vi.mocked(mockNeo4jService.executeQuery)
				.mockResolvedValueOnce({
					nodes: [{ id: "node-123" }],
					relationships: [],
				})
				// Mock coverage query
				.mockResolvedValueOnce({
					nodes: [{ directTests: 2, integrationTests: 1 }],
					relationships: [],
				})

			const result = await service.enrichWithQualityMetrics(searchResults, {
				includeComplexity: false,
				includeCoverage: true,
				includeQualityScore: false,
			})

			expect(result).toHaveLength(1)
			expect(result[0].qualityMetrics).toBeDefined()
			expect(result[0].qualityMetrics?.coverage).toEqual({
				isTested: true,
				directTests: 2,
				integrationTests: 1,
				coveragePercentage: 100,
				testQuality: "medium",
			})
		})

		it("should skip enrichment for large result sets", async () => {
			const largeResults = Array(30).fill({
				id: "result",
				score: 0.9,
				payload: { filePath: "/test/file.ts" },
			})

			const result = await service.enrichWithQualityMetrics(largeResults, { maxResults: 20 })

			expect(result).toEqual(largeResults)
			expect(mockNeo4jService.executeQuery).not.toHaveBeenCalled()
		})
	})
})
