import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Neo4jService } from "../neo4j-service"
import type { MockedClass } from "vitest"
import type { CodeNode, CodeRelationship } from "../../interfaces/neo4j-service"
import { CodebaseIndexErrorLogger } from "../error-logger"

// Mock neo4j driver
vi.mock("neo4j-driver", () => {
	const mockDriver = vi.fn()
	const mockAuth = {
		basic: vi.fn(),
	}

	const mockModule = {
		driver: mockDriver,
		auth: mockAuth,
		int: vi.fn((value: number) => ({ toNumber: () => value })),
		session: {
			READ: "READ",
			WRITE: "WRITE",
		},
		bookmarkManager: vi.fn(),
	}

	// Return both default export and named exports
	return {
		default: mockDriver,
		...mockModule,
	}
})

// Import after mocking
import neo4j, { auth, int, session, bookmarkManager } from "neo4j-driver"

describe("Neo4jService - Error Handling and Connection Verification", () => {
	let neo4jService: Neo4jService
	let mockDriver: any

	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()

		// Mock driver
		mockDriver = {
			verifyConnectivity: vi.fn(),
			session: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}),
			close: vi.fn().mockResolvedValue(undefined),
		}

		// Create service with test configuration
		neo4jService = new Neo4jService({
			enabled: true,
			url: "bolt://localhost:7687",
			username: "test",
			password: "test",
			database: "testdb",
		})

		// Replace private driver with our mock
		;(neo4jService as any).driver = mockDriver
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	describe("Initialization Error Handling", () => {
		it("should handle authentication failures gracefully", async () => {
			// Arrange
			const authError = new Error("Authentication failed")
			mockDriver.verifyConnectivity.mockRejectedValue(authError)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act & Assert
			await expect(neo4jService.initialize()).rejects.toThrow(
				"Neo4j authentication failed. Please check your username and password. Original error: Authentication failed",
			)

			// Verify error logging
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Failed to initialize Neo4j:",
				expect.objectContaining({
					error: "Authentication failed",
					config: expect.objectContaining({
						url: "bolt://***:***",
						database: "testdb",
						username: "test",
					}),
				}),
			)

			expect(consoleLogSpy).not.toHaveBeenCalled()

			// Verify service state
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle connection failures gracefully", async () => {
			// Arrange
			const connectionError = new Error("ECONNREFUSED: Connection refused")
			mockDriver.verifyConnectivity.mockRejectedValue(connectionError)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act & Assert
			await expect(neo4jService.initialize()).rejects.toThrow(
				"Neo4j connection failed. Please check if Neo4j is running and accessible at bolt://localhost:7687. Original error: ECONNREFUSED: Connection refused",
			)

			// Verify error logging
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Failed to initialize Neo4j:",
				expect.objectContaining({
					error: "ECONNREFUSED: Connection refused",
					config: expect.objectContaining({
						url: "bolt://***:***",
						database: "testdb",
						username: "test",
					}),
				}),
			)

			expect(consoleLogSpy).not.toHaveBeenCalled()

			// Verify service state
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle database not found errors gracefully", async () => {
			// Arrange
			const dbError = new Error("Database 'testdb' does not exist")
			mockDriver.verifyConnectivity.mockRejectedValue(dbError)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act & Assert
			await expect(neo4jService.initialize()).rejects.toThrow(
				"Neo4j database 'testdb' does not exist. Please create the database or check the database name. Original error: Database 'testdb' does not exist",
			)

			// Verify error logging
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Failed to initialize Neo4j:",
				expect.objectContaining({
					error: "Database 'testdb' does not exist",
					config: expect.objectContaining({
						url: "bolt://***:***",
						database: "testdb",
						username: "test",
					}),
				}),
			)

			expect(consoleLogSpy).not.toHaveBeenCalled()

			// Verify service state
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle generic errors gracefully", async () => {
			// Arrange
			const genericError = new Error("Something went wrong")
			mockDriver.verifyConnectivity.mockRejectedValue(genericError)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act & Assert
			await expect(neo4jService.initialize()).rejects.toThrow("Failed to initialize Neo4j: Something went wrong")

			// Verify error logging
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Failed to initialize Neo4j:",
				expect.objectContaining({
					error: "Something went wrong",
					config: expect.objectContaining({
						url: "bolt://***:***",
						database: "testdb",
						username: "test",
					}),
				}),
			)

			expect(consoleLogSpy).not.toHaveBeenCalled()

			// Verify service state
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle session test failures gracefully", async () => {
			// Arrange
			const sessionTestError = new Error("Session test failed")
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockRejectedValue(sessionTestError),
				close: vi.fn().mockResolvedValue(undefined),
			})

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act & Assert
			await expect(neo4jService.initialize()).rejects.toThrow("Failed to initialize Neo4j: Session test failed")

			// Verify error logging
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Failed to initialize Neo4j:",
				expect.objectContaining({
					error: "Session test failed",
					config: expect.objectContaining({
						url: "bolt://***:***",
						database: "testdb",
						username: "test",
					}),
				}),
			)

			expect(consoleLogSpy).not.toHaveBeenCalled()

			// Verify service state
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should initialize successfully when all checks pass", async () => {
			// Arrange
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			})

			// Mock console methods
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await neo4jService.initialize()

			// Assert
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[Neo4jService] Initializing Neo4j connection to: bolt://***:***",
			)
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Target database: testdb")
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Verifying Neo4j connectivity...")
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Neo4j connectivity verified successfully")
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Database access verified for: testdb")
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Creating database indexes...")
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Database indexes created successfully")
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[Neo4jService] Successfully connected to Neo4j database: testdb",
			)

			// Verify service state
			expect(neo4jService.isConnected()).toBe(true)

			consoleLogSpy.mockRestore()
		})

		it("should skip initialization when disabled", async () => {
			// Arrange
			const disabledService = new Neo4jService({
				enabled: false, // Disabled
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Mock console methods
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await disabledService.initialize()

			// Assert
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Neo4j is disabled, skipping initialization")
			expect(mockDriver.verifyConnectivity).not.toHaveBeenCalled()

			// Verify service state
			expect(disabledService.isConnected()).toBe(false)

			consoleLogSpy.mockRestore()
		})
	})

	describe("Connection Verification", () => {
		it("should return false when not connected", () => {
			// Arrange
			;(neo4jService as any).connected = false
			;(neo4jService as any).driver = null

			// Act & Assert
			expect(neo4jService.isConnected()).toBe(false)
		})

		it("should return true when connected", () => {
			// Arrange
			;(neo4jService as any).connected = true
			;(neo4jService as any).driver = mockDriver

			// Act & Assert
			expect(neo4jService.isConnected()).toBe(true)
		})
	})

	describe("CRUD Operations with Error Handling", () => {
		beforeEach(() => {
			// Set up successful initialization for CRUD tests
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			})
		})

		it("should handle upsertNode errors gracefully", async () => {
			// Arrange
			const upsertError = new Error("Node upsert failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(upsertError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.upsertNode({
				id: "test-node-1",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error upserting node:", upsertError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle upsertNodes errors gracefully", async () => {
			// Arrange
			const upsertError = new Error("Batch upsert failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(upsertError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.upsertNodes([
				{
					id: "test-node-1",
					type: "function",
					name: "testFunction1",
					filePath: "/test/file1.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				},
				{
					id: "test-node-2",
					type: "function",
					name: "testFunction2",
					filePath: "/test/file2.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				},
			])

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error upserting nodes:", upsertError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle createRelationship errors gracefully", async () => {
			// Arrange
			const relationshipError = new Error("Relationship creation failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(relationshipError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.createRelationship({
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
				metadata: { context: "test" },
			})

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Error creating relationship:",
				relationshipError,
			)

			consoleErrorSpy.mockRestore()
		})

		it("should handle createRelationships errors gracefully", async () => {
			// Arrange
			const relationshipError = new Error("Batch relationship creation failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(relationshipError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.createRelationships([
				{
					fromId: "node-1",
					toId: "node-2",
					type: "CALLS",
					metadata: { context: "test" },
				},
				{
					fromId: "node-2",
					toId: "node-3",
					type: "IMPORTS",
					metadata: { module: "test" },
				},
			])

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Error creating relationships:",
				relationshipError,
			)

			consoleErrorSpy.mockRestore()
		})

		it("should handle deleteNode errors gracefully", async () => {
			// Arrange
			const deleteError = new Error("Node deletion failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(deleteError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.deleteNode("test-node-1")

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error deleting node:", deleteError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle deleteNodesByFilePath errors gracefully", async () => {
			// Arrange
			const deleteError = new Error("File deletion failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(deleteError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.deleteNodesByFilePath("/test/file.js")

			// Assert - should not throw, just log and continue
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error deleting nodes:", deleteError)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Query Operations with Error Handling", () => {
		beforeEach(() => {
			// Set up successful initialization for query tests
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			})
		})

		it("should handle findCallers errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Query failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findCallers("test-node")

			// Assert - should return empty array on error
			expect(result).toEqual([])
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding callers:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle findCallees errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Query failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findCallees("test-node")

			// Assert - should return empty array on error
			expect(result).toEqual([])
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding callees:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle findDependencies errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Query failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findDependencies("/test/file.js")

			// Assert - should return empty array on error
			expect(result).toEqual([])
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding dependencies:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle findDependents errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Query failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findDependents("/test/file.js")

			// Assert - should return empty array on error
			expect(result).toEqual([])
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding dependents:", queryError)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Advanced Query Operations with Error Handling", () => {
		beforeEach(() => {
			// Set up successful initialization for advanced query tests
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			})
		})

		it("should handle findImpactedNodes errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Impact analysis failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findImpactedNodes("test-node")

			// Assert - should return default empty result on error
			expect(result).toEqual({
				impactedNodes: [],
				dependencyChains: [],
				blastRadius: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testNodes: [], coveragePercentage: 0 },
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding impacted nodes:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle findDependencyTree errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Dependency analysis failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.findDependencyTree("test-node")

			// Assert - should return default empty result on error
			expect(result).toEqual({
				dependencies: [],
				dependencyChains: [],
				dependencyTree: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error finding dependency tree:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle calculateBlastRadius errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Blast radius calculation failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.calculateBlastRadius("test-node")

			// Assert - should return default empty result on error
			expect(result).toEqual({
				targetNode: null,
				impactedNodes: [],
				dependencies: [],
				tests: [],
				metrics: {
					totalImpactedNodes: 0,
					totalImpactedFiles: 0,
					totalDependencies: 0,
					totalTests: 0,
					maxImpactDepth: 0,
					maxDependencyDepth: 0,
					riskScore: 0,
				},
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error calculating blast radius:", queryError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle assessChangeSafety errors gracefully", async () => {
			// Arrange
			const queryError = new Error("Safety assessment failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(queryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.assessChangeSafety("test-node")

			// Assert - should return dangerous result on error
			expect(result).toEqual({
				nodeId: "test-node",
				nodeName: "Unknown",
				safetyLevel: "dangerous",
				riskScore: 100,
				reasons: ["Neo4j service not connected"],
				recommendations: ["Enable Neo4j to perform impact analysis"],
				impactSummary: { impactedNodes: 0, impactedFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testCount: 0, coveragePercentage: 0 },
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error assessing change safety:", queryError)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Utility Operations with Error Handling", () => {
		beforeEach(() => {
			// Set up successful initialization for utility tests
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)
			mockDriver.session.mockReturnValue({
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			})
		})

		it("should handle clearAll errors gracefully", async () => {
			// Arrange
			const clearError = new Error("Clear operation failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(clearError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await expect(neo4jService.clearAll()).rejects.toThrow("Clear operation failed")

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error clearing database:", clearError)

			consoleErrorSpy.mockRestore()
		})

		it("should handle getStats errors gracefully", async () => {
			// Arrange
			const statsError = new Error("Stats query failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(statsError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			const result = await neo4jService.getStats()

			// Assert - should return default empty stats on error
			expect(result).toEqual({ nodeCount: 0, relationshipCount: 0, fileCount: 0 })
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error getting stats:", statsError)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Connection Error Detection", () => {
		it("should detect various connection error patterns", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private method for testing
			const isConnectionError = (service as any).isConnectionError.bind(service)

			// Act & Assert
			expect(isConnectionError("connection timeout")).toBe(true)
			expect(isConnectionError("pool acquisition failed")).toBe(true)
			expect(isConnectionError("network unreachable")).toBe(true)
			expect(isConnectionError("ECONNREFUSED")).toBe(true)
			expect(isConnectionError("ENOTFOUND")).toBe(true)
			expect(isConnectionError("ECONNRESET")).toBe(true)
			expect(isConnectionError("ETIMEDOUT")).toBe(true)
			expect(isConnectionError("Service unavailable")).toBe(true)
			expect(isConnectionError("Database unavailable")).toBe(true)
			expect(isConnectionError("Connection pool exhausted")).toBe(true)

			// Should not detect non-connection errors
			expect(isConnectionError("authentication failed")).toBe(false)
			expect(isConnectionError("invalid cypher syntax")).toBe(false)
			expect(isConnectionError("constraint violation")).toBe(false)
			expect(isConnectionError("permission denied")).toBe(false)
		})
	})

	describe("Metadata Sanitization", () => {
		it("should sanitize complex metadata correctly", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private method for testing
			const sanitizeMetadata = (service as any).sanitizeMetadata.bind(service)

			// Act & Assert
			// Test with complex nested object
			const complexMetadata = {
				nested: {
					object: {
						array: [1, 2, 3],
						string: "test",
					},
				},
				function: () => "should be removed",
				symbol: Symbol("test"),
			}

			const sanitized = sanitizeMetadata(complexMetadata)

			// Should remove functions and symbols, convert objects to strings
			expect(sanitized).toEqual({
				nested: {
					object: {
						array: [1, 2, 3],
						string: "test",
					},
				},
				function: '{"key":"function"}', // Functions should be stringified
				symbol: '{"key":"Symbol(test)}', // Symbols should be stringified
			})

			// Test with null/undefined values
			const metadataWithNulls = {
				validString: "test",
				nullValue: null,
				undefinedValue: undefined,
				validNumber: 42,
				validBoolean: true,
				validArray: [1, 2, 3],
			}

			const sanitizedNulls = sanitizeMetadata(metadataWithNulls)

			// Should skip null/undefined values
			expect(sanitizedNulls).toEqual({
				validString: "test",
				validNumber: 42,
				validBoolean: true,
				validArray: [1, 2, 3],
			})

			// Should not include null/undefined keys
			expect(sanitizedNulls).not.toHaveProperty("nullValue")
			expect(sanitizedNulls).not.toHaveProperty("undefinedValue")
		})

		it("should handle primitive arrays correctly", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private method for testing
			const sanitizeMetadata = (service as any).sanitizeMetadata.bind(service)

			// Act & Assert
			// Test with primitive arrays
			const metadataWithPrimitives = {
				stringArray: ["test1", "test2"],
				numberArray: [1, 2, 3],
				booleanArray: [true, false],
				mixedArray: ["string", 42, true],
			}

			const sanitizedPrimitives = sanitizeMetadata(metadataWithPrimitives)

			// Should preserve primitive arrays as-is
			expect(sanitizedPrimitives.stringArray).toEqual(["test1", "test2"])
			expect(sanitizedPrimitives.numberArray).toEqual([1, 2, 3])
			expect(sanitizedPrimitives.booleanArray).toEqual([true, false])
			expect(sanitizedPrimitives.mixedArray).toEqual(["string", 42, true])
		})

		it("should convert complex arrays to JSON strings", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private method for testing
			const sanitizeMetadata = (service as any).sanitizeMetadata.bind(service)

			// Act & Assert
			// Test with complex array
			const metadataWithComplexArray = {
				complexArray: [
					{ name: "test1", value: 42 },
					{ name: "test2", value: 24 },
				],
			}

			const sanitizedComplex = sanitizeMetadata(metadataWithComplexArray)

			// Should convert complex array to JSON string
			expect(sanitizedComplex.complexArray).toBe('[{"name":"test1","value":42},{"name":"test2","value":24}]')
		})
	})

	describe("Session Management", () => {
		it("should handle session creation errors", () => {
			// Arrange
			const sessionError = new Error("Session creation failed")
			mockDriver.session.mockImplementation(() => {
				throw sessionError
			})

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act & Assert
			expect(() => {
				neo4jService.upsertNode({
					id: "test",
					type: "function",
					name: "testFunction",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				})
			}).toThrow("Neo4j driver not initialized")
		})

		it("should handle session close errors", async () => {
			// Arrange
			const closeError = new Error("Session close failed")
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockRejectedValue(closeError),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await neo4jService.upsertNode({
				id: "test",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert - error should be logged but not thrown
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error closing session:", closeError)

			consoleErrorSpy.mockRestore()
		})
	})
})
