import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Neo4jService } from "../neo4j-service"
import type { CodeNode, CodeRelationship } from "../../interfaces/neo4j-service"
import { CodebaseIndexErrorLogger } from "../error-logger"

// Mock neo4j driver
vi.mock("neo4j-driver", () => ({
	driver: vi.fn(),
	auth: {
		basic: vi.fn(),
	},
	bookmarkManager: vi.fn(),
	int: vi.fn((value: number) => ({ toNumber: () => value })),
	default: {
		driver: vi.fn(),
		auth: {
			basic: vi.fn(),
		},
		bookmarkManager: vi.fn(),
		int: vi.fn((value: number) => ({ toNumber: () => value })),
	},
}))

// Mock async-mutex
vi.mock("async-mutex", () => ({
	Mutex: vi.fn().mockImplementation(() => ({
		acquire: vi.fn().mockResolvedValue(vi.fn()),
	})),
}))

describe("Neo4jService Query Optimization and Security", () => {
	let neo4jService: Neo4jService
	let mockDriver: any
	let mockErrorLogger: CodebaseIndexErrorLogger

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Mock error logger
		mockErrorLogger = {
			logError: vi.fn().mockResolvedValue(undefined),
		} as any

		// Mock driver
		mockDriver = {
			verifyConnectivity: vi.fn(),
			session: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}),
			close: vi.fn().mockResolvedValue(undefined),
		}

		// Create service with enhanced configuration
		neo4jService = new Neo4jService(
			{
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				// Enhanced configuration for testing
				maxConnectionPoolSize: 10,
				connectionAcquisitionTimeout: 5000,
				maxConnectionLifetime: 3600000,
				maxRetries: 3,
				initialRetryDelay: 100,
				maxRetryDelay: 1000,
				circuitBreakerThreshold: 5,
				circuitBreakerTimeout: 30000,
				healthCheckInterval: 10000,
				queryTimeout: 5000,
				sessionMaxTransactionRetryTime: 30000,
				sessionIdleTimeout: 10000,
				// New configuration options for query optimization
				slowQueryThreshold: 1000,
				blastRadiusCacheTTL: 300000,
				blastRadiusCacheSize: 100,
			},
			mockErrorLogger,
		)

		// Replace private driver with our mock
		;(neo4jService as any).driver = mockDriver
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	describe("Security - Cypher Injection Prevention", () => {
		it("should reject invalid relationship types in createRelationship", async () => {
			const relationship = {
				fromId: "node1",
				toId: "node2",
				type: "INVALID_TYPE" as any,
			}

			await expect(neo4jService.createRelationship(relationship)).rejects.toThrow(
				"Invalid relationship type: INVALID_TYPE. Valid types are: CALLS, CALLED_BY, TESTS, TESTED_BY, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS, EXTENDS, EXTENDED_BY, IMPLEMENTS, IMPLEMENTED_BY, CONTAINS, DEFINES, USES",
			)
		})

		it("should accept valid relationship types in createRelationship", async () => {
			const validRelationships = [
				"CALLS",
				"CALLED_BY",
				"TESTS",
				"TESTED_BY",
				"HAS_TYPE",
				"ACCEPTS_TYPE",
				"RETURNS_TYPE",
				"IMPORTS",
				"EXTENDS",
				"EXTENDED_BY",
				"IMPLEMENTS",
				"IMPLEMENTED_BY",
				"CONTAINS",
				"DEFINES",
				"USES",
			]

			for (const type of validRelationships) {
				const relationship = {
					fromId: "node1",
					toId: "node2",
					type: type as any,
				}

				await expect(neo4jService.createRelationship(relationship)).resolves.toBeUndefined()
			}
		})

		it("should reject invalid maxDepth in findImpactedNodes", async () => {
			await expect(neo4jService.findImpactedNodes("node1", -1)).rejects.toThrow(
				"Invalid maxDepth: -1. Must be an integer between 1 and 10",
			)
		})

		it("should reject maxDepth > 10 in findImpactedNodes", async () => {
			await expect(neo4jService.findImpactedNodes("node1", 11)).rejects.toThrow(
				"Invalid maxDepth: 11. Must be an integer between 1 and 10",
			)
		})

		it("should reject non-integer maxDepth in findImpactedNodes", async () => {
			await expect(neo4jService.findImpactedNodes("node1", 3.5 as any)).rejects.toThrow(
				"Invalid maxDepth: 3.5. Must be an integer between 1 and 10",
			)
		})

		it("should reject dangerous queries in executeQuery", async () => {
			await expect(
				neo4jService.executeQuery("MATCH (n) WHERE n.id = '" + "malicious" + "' RETURN n"),
			).rejects.toThrow(
				"executeQuery called with potentially dangerous query without allowDangerousQueries=true. Use parameterized queries instead.",
			)
		})

		it("should allow parameterized queries in executeQuery", async () => {
			await expect(
				neo4jService.executeQuery("MATCH (n) WHERE n.id = $id RETURN n", { id: "test" }),
			).resolves.toBeDefined()
		})

		it("should allow dangerous queries with allowDangerousQueries=true", async () => {
			await expect(
				neo4jService.executeQuery("MATCH (n) WHERE n.id = '" + "malicious" + "' RETURN n", {}, undefined, true),
			).resolves.toBeDefined()
		})
	})

	describe("Index Coverage and Performance", () => {
		it("should create composite indexes during initialization", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			await neo4jService.initialize()

			// Verify composite indexes are created
			expect(mockSession.run).toHaveBeenCalledWith(
				"CREATE INDEX code_node_file_path_type IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath, n.type)",
			)
			expect(mockSession.run).toHaveBeenCalledWith(
				"CREATE INDEX code_node_type_name IF NOT EXISTS FOR (n:CodeNode) ON (n.type, n.name)",
			)
		})

		it("should use index hints in queries", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "impacted") return { id: "node1", type: "function", name: "test" }
								if (key === "path") return { start: { id: "node1" }, end: { id: "target" } }
								if (key === "rels") return []
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			await neo4jService.findImpactedNodes("target", 3)

			// Verify index hint is used
			expect(mockSession.run).toHaveBeenCalledWith(
				expect.stringContaining("USING INDEX target:CodeNode(id)"),
				expect.any(Object),
			)
		})

		it("should cache blast radius results", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "impacted") return { id: "node1", type: "function", name: "test" }
								if (key === "path") return { start: { id: "node1" }, end: { id: "target" } }
								if (key === "rels") return []
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// First call
			const result1 = await neo4jService.calculateBlastRadius("target", 3)

			// Second call should use cache
			const result2 = await neo4jService.calculateBlastRadius("target", 3)

			expect(result1).toEqual(result2)
			// Second call should not hit the database
			expect(mockSession.run).toHaveBeenCalledTimes(4) // 2 for impact, 2 for dependency
		})
	})

	describe("Query Performance", () => {
		it("should log slow queries", async () => {
			const mockSession = {
				run: vi.fn().mockImplementation(() => {
					return new Promise((resolve) => setTimeout(() => resolve({ records: [] }), 1500)) // Slow query
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Use fake timers
			vi.useFakeTimers()

			// Capture the promise returned by executeQuery
			const queryPromise = neo4jService.executeQuery("MATCH (n) RETURN n")

			// Advance timers by the mock delay
			vi.advanceTimersByTime(1500)

			// Wait for the captured promise to resolve
			await queryPromise

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Slow query detected"),
				expect.stringContaining("duration"),
				expect.stringContaining("executeQuery"),
			)

			// Restore timers and console spy
			vi.useRealTimers()
			consoleWarnSpy.mockRestore()
		})

		it("should track per-operation metrics", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Perform multiple operations
			await neo4jService.findCallers("node1")
			await neo4jService.findCallers("node2")
			await neo4jService.findCallees("node3")

			const metrics = neo4jService.getOperationMetrics()

			expect(metrics.get("findCallers")?.totalCalls).toBe(2)
			expect(metrics.get("findCallees")?.totalCalls).toBe(1)
		})
	})

	describe("Index Statistics and Maintenance", () => {
		it("should get index statistics", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "name") return "code_node_id"
								if (key === "state") return "ONLINE"
								if (key === "type") return "RANGE"
								if (key === "labelsOrTypes") return ["CodeNode"]
								if (key === "properties") return ["id"]
								if (key === "uniqueness") return "NONUNIQUE"
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const stats = await neo4jService.getIndexStats()

			expect(stats).toHaveLength(1)
			expect(stats[0]).toMatchObject({
				name: "code_node_id",
				state: "ONLINE",
				type: "RANGE",
				labelsOrTypes: ["CodeNode"],
				properties: ["id"],
				uniqueness: "NONUNIQUE",
			})
		})

		it("should perform index maintenance", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "name") return "code_node_id"
								if (key === "state") return "ONLINE"
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const result = await neo4jService.performIndexMaintenance()

			expect(result.timestamp).toBeInstanceOf(Date)
			expect(result.indexesChecked).toBeGreaterThan(0)
			expect(result.indexesHealthy).toBeGreaterThan(0)
		})
	})

	describe("Query Plan Analysis", () => {
		it("should explain query execution plan", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "plan")
									return {
										operator: "NodeByIndexScan",
										labels: ["CodeNode"],
										properties: ["id"],
									}
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const plan = await neo4jService.explainQuery("MATCH (n:CodeNode {id: $id}) RETURN n", { id: "test" })

			expect(plan).toMatchObject({
				operator: "NodeByIndexScan",
				labels: ["CodeNode"],
				properties: ["id"],
			})
		})
	})

	describe("Error Handling", () => {
		it("should handle connection errors gracefully", async () => {
			const connectionError = new Error("ECONNREFUSED: Connection refused")
			mockDriver.verifyConnectivity.mockRejectedValue(connectionError)

			await expect(neo4jService.initialize()).rejects.toThrow(
				"Neo4j connection failed. Please check if Neo4j is running and accessible at bolt://localhost:7687",
			)
		})

		it("should handle query timeouts", async () => {
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				queryTimeout: 100, // Very short timeout
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ records: [] }), 200)), // Longer than timeout
				),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			await expect(service.executeQuery("MATCH (n) RETURN n")).rejects.toThrow(
				"Query timeout after 100ms: executeQuery",
			)
		})
	})

	describe("Query Optimization Features", () => {
		it("should apply LIMIT clauses to prevent unbounded results", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "impacted") return { id: "node1", type: "function", name: "test" }
								if (key === "path") return { start: { id: "node1" }, end: { id: "target" } }
								if (key === "rels") return []
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			await neo4jService.findImpactedNodes("target", 3, 10)

			// Verify LIMIT is applied
			expect(mockSession.run).toHaveBeenCalledWith(
				expect.stringContaining("LIMIT $limit"),
				expect.objectContaining({ limit: 10 }),
			)
		})

		it("should use DISTINCT optimization for impact analysis", async () => {
			const mockSession = {
				run: vi.fn().mockResolvedValue({
					records: [
						{
							get: vi.fn((key: string) => {
								if (key === "impacted") return { id: "node1", type: "function", name: "test" }
								if (key === "path") return { start: { id: "node1" }, end: { id: "target" } }
								if (key === "rels") return []
								return null
							}),
						},
					],
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			await neo4jService.findImpactedNodes("target", 3)

			// Verify WITH DISTINCT is used
			expect(mockSession.run).toHaveBeenCalledWith(
				expect.stringContaining("WITH DISTINCT impacted"),
				expect.any(Object),
			)
		})
	})
})
