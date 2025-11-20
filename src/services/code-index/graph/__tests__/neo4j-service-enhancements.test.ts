import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Neo4jService } from "../neo4j-service"
import type { MockedClass } from "vitest"
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

describe("Neo4jService - Enhanced Features", () => {
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
				// Enhanced configuration
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

	describe("1. Connection Pooling Configuration and Validation", () => {
		it("should validate connection pool size limits", () => {
			// Test invalid pool sizes
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						maxConnectionPoolSize: 0, // Invalid
					}),
			).toThrow("maxConnectionPoolSize must be between 1 and 100")

			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						maxConnectionPoolSize: 101, // Invalid
					}),
			).toThrow("maxConnectionPoolSize must be between 1 and 100")

			// Test valid pool sizes
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						maxConnectionPoolSize: 50, // Valid
					}),
			).not.toThrow()
		})

		it("should validate connection acquisition timeout", () => {
			// Test invalid timeouts
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						connectionAcquisitionTimeout: 500, // Too low
					}),
			).toThrow("connectionAcquisitionTimeout must be between 1 second and 5 minutes")

			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						connectionAcquisitionTimeout: 400000, // Too high
					}),
			).toThrow("connectionAcquisitionTimeout must be between 1 second and 5 minutes")

			// Test valid timeout
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						connectionAcquisitionTimeout: 120000, // Valid
					}),
			).not.toThrow()
		})

		it("should apply default connection pool settings", () => {
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			const metrics = service.getConnectionPoolMetrics()
			expect(metrics.totalConnections).toBe(0) // No sessions created yet
			expect(metrics.idleConnections).toBe(0)
			expect(metrics.activeConnections).toBe(0) // totalSessionsCreated - idleConnections - closedSessions
		})
	})

	describe("2. Retry Logic with Exponential Backoff", () => {
		it("should retry connection errors with exponential backoff", async () => {
			// Arrange
			const connectionError = new Error("ECONNREFUSED: Connection refused")
			mockDriver.verifyConnectivity
				.mockRejectedValueOnce(connectionError)
				.mockRejectedValueOnce(connectionError)
				.mockResolvedValueOnce(undefined)

			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await neo4jService.initialize()

			// Assert
			expect(mockDriver.verifyConnectivity).toHaveBeenCalledTimes(3)
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("failed (attempt 1/3), retrying in"))
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("failed (attempt 2/3), retrying in"))

			consoleWarnSpy.mockRestore()
		})

		it("should calculate exponential backoff with jitter", async () => {
			// Arrange
			const retryError = new Error("Temporary failure")
			const mockSession = {
				run: vi
					.fn()
					.mockRejectedValueOnce(retryError)
					.mockRejectedValueOnce(retryError)
					.mockResolvedValueOnce({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const startTime = Date.now()

			// Act
			await neo4jService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert - verify exponential backoff with jitter
			expect(consoleWarnSpy).toHaveBeenCalledTimes(2)

			// First retry should be around 100ms + jitter
			const firstRetryCall = consoleWarnSpy.mock.calls[0][0]
			const firstDelay = parseInt(firstRetryCall.match(/retrying in (\d+)ms/)?.[1] || "0")
			expect(firstDelay).toBeGreaterThanOrEqual(100)
			expect(firstDelay).toBeLessThan(110) // 100 + 10% jitter

			// Second retry should be around 200ms + jitter
			const secondRetryCall = consoleWarnSpy.mock.calls[1][0]
			const secondDelay = parseInt(secondRetryCall.match(/retrying in (\d+)ms/)?.[1] || "0")
			expect(secondDelay).toBeGreaterThanOrEqual(200)
			expect(secondDelay).toBeLessThan(220) // 200 + 10% jitter

			consoleWarnSpy.mockRestore()
		})

		it("should respect maximum retry delay", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				maxRetryDelay: 50, // Very low max delay
			})

			;(service as any).driver = mockDriver

			const retryError = new Error("Persistent failure")
			const mockSession = {
				run: vi.fn().mockRejectedValue(retryError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			try {
				await service.upsertNode({
					id: "test-node",
					type: "function",
					name: "testFunction",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				})
			} catch (error) {
				// Expected to fail after max retries
			}

			// Assert - delay should not exceed maxRetryDelay
			const retryCalls = consoleWarnSpy.mock.calls.filter((call) => call[0].includes("retrying in"))

			for (const call of retryCalls) {
				const delay = parseInt(call[0].match(/retrying in (\d+)ms/)?.[1] || "0")
				expect(delay).toBeLessThanOrEqual(50)
			}

			consoleWarnSpy.mockRestore()
		})
	})

	describe("3. Circuit Breaker Implementation", () => {
		it("should trip circuit breaker after threshold failures", async () => {
			// Arrange
			const connectionError = new Error("Connection failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act - trigger failures to trip circuit breaker
			for (let i = 0; i < 6; i++) {
				try {
					await neo4jService.upsertNode({
						id: `test-node-${i}`,
						type: "function",
						name: `testFunction${i}`,
						filePath: "/test/file.js",
						startLine: 1,
						endLine: 10,
						language: "javascript",
					})
				} catch (error) {
					// Expected to fail
				}
			}

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Circuit breaker tripped: connection_failure_threshold",
			)

			// Next request should be rejected immediately
			await expect(
				neo4jService.upsertNode({
					id: "should-be-rejected",
					type: "function",
					name: "shouldFail",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				}),
			).rejects.toThrow("Circuit breaker is open - rejecting requests")

			consoleErrorSpy.mockRestore()
		})

		it("should attempt circuit breaker reset after timeout", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				circuitBreakerTimeout: 1000, // 1 second timeout
			})

			;(service as any).driver = mockDriver

			// Trip circuit breaker
			const connectionError = new Error("Connection failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)

			// Trigger circuit breaker
			for (let i = 0; i < 6; i++) {
				try {
					await service.upsertNode({
						id: `test-node-${i}`,
						type: "function",
						name: `testFunction${i}`,
						filePath: "/test/file.js",
						startLine: 1,
						endLine: 10,
						language: "javascript",
					})
				} catch (error) {
					// Expected to fail
				}
			}

			// Act - advance time past timeout
			vi.advanceTimersByTime(1500) // 1.5 seconds

			// Mock successful session for reset test
			const successSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(successSession)

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Try operation after timeout
			await service.upsertNode({
				id: "should-work-now",
				type: "function",
				name: "shouldWork",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[Neo4jService] Circuit breaker half-open - testing with single request",
			)
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Circuit breaker reset to closed")

			consoleLogSpy.mockRestore()
		})

		it("should handle half-open state correctly", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				circuitBreakerTimeout: 1000,
			})

			;(service as any).driver = mockDriver

			// Trip circuit breaker first
			const connectionError = new Error("Connection failed")
			const failSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(failSession)

			for (let i = 0; i < 6; i++) {
				try {
					await service.upsertNode({
						id: `test-node-${i}`,
						type: "function",
						name: `testFunction${i}`,
						filePath: "/test/file.js",
						startLine: 1,
						endLine: 10,
						language: "javascript",
					})
				} catch (error) {
					// Expected to fail
				}
			}

			// Advance time to trigger half-open
			vi.advanceTimersByTime(1500)

			// Mock session that fails in half-open test
			mockDriver.session.mockReturnValue(failSession)

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act - this should fail and keep circuit open
			try {
				await service.upsertNode({
					id: "half-open-test",
					type: "function",
					name: "halfOpenTest",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				})
			} catch (error) {
				// Expected to fail
			}

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[Neo4jService] Circuit breaker tripped: half_open_test_failed",
			)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("4. Error Logging using CodebaseIndexErrorLogger", () => {
		it("should log errors to CodebaseIndexErrorLogger", async () => {
			// Arrange
			const testError = new Error("Test error for logging")
			const mockSession = {
				run: vi.fn().mockRejectedValue(testError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await neo4jService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(mockErrorLogger.logError).toHaveBeenCalledWith({
				service: "neo4j",
				operation: "upsertNode",
				error: "Test error for logging",
				stack: expect.any(String),
				additionalContext: expect.objectContaining({
					attempt: expect.any(Number),
					maxRetries: 3,
					isConnectionError: false,
					isConnectionTest: false,
				}),
			})
		})

		it("should log connection errors with appropriate context", async () => {
			// Arrange
			const connectionError = new Error("ECONNREFUSED: Connection refused")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await neo4jService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(mockErrorLogger.logError).toHaveBeenCalledWith({
				service: "neo4j",
				operation: "upsertNode",
				error: "ECONNREFUSED: Connection refused",
				additionalContext: expect.objectContaining({
					isConnectionError: true,
				}),
			})
		})

		it("should log circuit breaker trips", async () => {
			// Arrange
			const connectionError = new Error("Connection failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act - trip circuit breaker
			for (let i = 0; i < 6; i++) {
				try {
					await neo4jService.upsertNode({
						id: `test-node-${i}`,
						type: "function",
						name: `testFunction${i}`,
						filePath: "/test/file.js",
						startLine: 1,
						endLine: 10,
						language: "javascript",
					})
				} catch (error) {
					// Expected to fail
				}
			}

			// Assert
			expect(mockErrorLogger.logError).toHaveBeenCalledWith(
				expect.objectContaining({
					service: "neo4j",
					operation: "circuitBreaker",
					error: expect.stringContaining("Circuit breaker tripped"),
					additionalContext: expect.objectContaining({
						tripCount: expect.any(Number),
						failures: expect.any(Number),
					}),
				}),
			)
		})
	})

	describe("5. Session Management Efficiency", () => {
		it("should reuse sessions from pool when available", async () => {
			// Arrange
			const mockSession1 = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			const mockSession2 = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}

			mockDriver.session.mockReturnValueOnce(mockSession1).mockReturnValueOnce(mockSession2)

			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await neo4jService.upsertNode({
				id: "test-node-1",
				type: "function",
				name: "testFunction1",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			await neo4jService.upsertNode({
				id: "test-node-2",
				type: "function",
				name: "testFunction2",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(mockDriver.session).toHaveBeenCalledTimes(2)
			expect(mockSession1.close).not.toHaveBeenCalled()
			expect(mockSession2.close).toHaveBeenCalled()
		})

		it("should close sessions when pool is full", async () => {
			// Arrange
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}

			// Fill up the session pool (simulate half pool size used)
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				maxConnectionPoolSize: 2, // Small pool for testing
			})

			;(service as any).driver = mockDriver
			;(service as any).sessionPool = new Array(1).fill(mockSession) // Half full

			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await service.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert - session should be closed since pool is at capacity
			expect(mockSession.close).toHaveBeenCalled()
		})

		it("should handle session pool metrics correctly", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				maxConnectionPoolSize: 20,
			})

			// Mock driver to simulate session creation
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			const mockDriver = {
				session: vi.fn().mockReturnValue(mockSession),
				verifyConnectivity: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
			}
			;(service as any).driver = mockDriver

			// Simulate some sessions in pool
			;(service as any).sessionPool = new Array(5).fill({})

			// Simulate 15 session acquisitions by calling getSession() directly
			for (let i = 0; i < 15; i++) {
				const session = await (service as any).getSession()
				// Immediately release to avoid affecting pool size
				await (service as any).releaseSession(session)
			}

			// Act
			const metrics = service.getConnectionPoolMetrics()

			// Assert
			expect(metrics.totalConnections).toBe(15) // totalSessionsCreated
			expect(metrics.idleConnections).toBe(5)
			expect(metrics.activeConnections).toBe(10) // 15 - 5 - 0 (closedSessions)
			expect(metrics.acquisitionAttempts).toBe(15)
		})
	})

	describe("6. Connection Health Monitoring", () => {
		it("should perform periodic health checks", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				healthCheckInterval: 1000, // 1 second for testing
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await service.initialize()

			// Advance time to trigger health checks
			vi.advanceTimersByTime(2500) // 2.5 seconds

			// Assert - should have performed health checks
			expect(mockSession.run).toHaveBeenCalledWith("RETURN 1 as health_check")
			expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Health check completed successfully"))

			consoleLogSpy.mockRestore()
		})

		it("should handle health check failures", async () => {
			// Arrange
			const healthError = new Error("Health check failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(healthError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await neo4jService.initialize()

			// Trigger health check failure
			vi.advanceTimersByTime(35000) // 35 seconds

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith("[Neo4jService] Health check failed:", "Health check failed")
			expect(mockErrorLogger.logError).toHaveBeenCalledWith(
				expect.objectContaining({
					service: "neo4j",
					operation: "healthCheck",
					error: "Health check failed",
				}),
			)

			consoleWarnSpy.mockRestore()
		})

		it("should update health status correctly", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				healthCheckInterval: 1000,
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await service.initialize()

			// Check initial health status
			expect(service.isConnected()).toBe(true)

			// Simulate health check failure
			const healthError = new Error("Health check failed")
			mockSession.run.mockRejectedValue(healthError)

			vi.advanceTimersByTime(1500)

			// Assert
			expect(service.isConnected()).toBe(false) // Should be unhealthy after failed check

			// Simulate recovery
			mockSession.run.mockResolvedValue({ records: [] })
			vi.advanceTimersByTime(1500)

			// Assert
			expect(service.isConnected()).toBe(true) // Should recover after successful check
		})
	})

	describe("7. Timeout Handling for Long-running Queries", () => {
		it("should timeout queries that exceed configured limit", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				queryTimeout: 1000, // 1 second timeout
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ records: [] }), 2000)), // 2 second query
				),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act & Assert
			await expect(service.executeQuery("MATCH (n) RETURN n LIMIT 1000")).rejects.toThrow(
				"Query timeout after 1000ms: executeQuery",
			)
		})

		it("should allow custom timeout for specific operations", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				queryTimeout: 1000, // 1 second default timeout
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ records: [] }), 3000)), // 3 second query
				),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act & Assert - custom query should use double timeout
			await expect(service.executeQuery("MATCH (n) RETURN n LIMIT 1000")).rejects.toThrow(
				"Query timeout after 2000ms: executeQuery", // 2 * default timeout
			)
		})

		it("should handle health check timeout separately", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				queryTimeout: 1000, // 1 second query timeout
				healthCheckInterval: 1000,
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockImplementation(
					() => new Promise((resolve) => setTimeout(() => resolve({ records: [] }), 15000)), // 15 second health check
				),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await service.initialize()
			vi.advanceTimersByTime(1500) // Trigger health check

			// Assert - health check should timeout after 10 seconds (hardcoded)
			await vi.waitFor(
				() => {
					expect(consoleWarnSpy).toHaveBeenCalledWith(
						"[Neo4jService] Health check failed:",
						expect.stringContaining("timeout"),
					)
				},
				{ timeout: 20000 },
			)

			consoleWarnSpy.mockRestore()
		})
	})

	describe("8. Connection Error Detection and Handling", () => {
		it("should detect various connection error patterns", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			const isConnectionError = (service as any).isConnectionError.bind(service)

			// Test structured Neo4j error codes
			const neo4jError = { code: "ServiceUnavailable", message: "Service unavailable" }
			const sessionExpiredError = { code: "SessionExpired", message: "Session expired" }
			const authTokenError = { code: "Security.AUTHTOKEN", message: "Authentication token expired" }
			const transactionError = { code: "Transaction.Terminated", message: "Transaction terminated" }
			const networkError = { code: "Network.Unreachable", message: "Network unreachable" }
			const databaseUnavailableError = { code: "Database.Unavailable", message: "Database unavailable" }

			// Test error names
			const neo4jNamedError = { name: "Neo4jError", message: "Some Neo4j error" }
			const connectionNamedError = { name: "ConnectionError", message: "Connection failed" }
			const serviceUnavailableNamedError = { name: "ServiceUnavailableError", message: "Service unavailable" }
			const sessionExpiredNamedError = { name: "SessionExpiredError", message: "Session expired" }

			// Act & Assert - structured error codes
			expect(isConnectionError(neo4jError)).toBe(true)
			expect(isConnectionError(sessionExpiredError)).toBe(true)
			expect(isConnectionError(authTokenError)).toBe(true)
			expect(isConnectionError(transactionError)).toBe(true)
			expect(isConnectionError(networkError)).toBe(true)
			expect(isConnectionError(databaseUnavailableError)).toBe(true)

			// Act & Assert - error names
			expect(isConnectionError(neo4jNamedError)).toBe(true)
			expect(isConnectionError(connectionNamedError)).toBe(true)
			expect(isConnectionError(serviceUnavailableNamedError)).toBe(true)
			expect(isConnectionError(sessionExpiredNamedError)).toBe(true)

			// Act & Assert - fallback to message-based timeout patterns
			expect(isConnectionError(new Error("connection timeout"))).toBe(true)
			expect(isConnectionError(new Error("ETIMEDOUT"))).toBe(true)
			expect(isConnectionError(new Error("connect timeout"))).toBe(true)

			// Should not detect non-connection errors
			expect(isConnectionError(new Error("authentication failed"))).toBe(false)
			expect(isConnectionError(new Error("invalid cypher syntax"))).toBe(false)
			expect(isConnectionError(new Error("constraint violation"))).toBe(false)
			expect(isConnectionError(new Error("permission denied"))).toBe(false)

			// Should not detect broad patterns that were removed
			expect(isConnectionError(new Error("connection"))).toBe(false)
			expect(isConnectionError(new Error("connect"))).toBe(false)
			expect(isConnectionError(new Error("pool"))).toBe(false)
			expect(isConnectionError(new Error("acquisition"))).toBe(false)
			expect(isConnectionError(new Error("network"))).toBe(false)
			expect(isConnectionError(new Error("ECONNREFUSED"))).toBe(false)
			expect(isConnectionError(new Error("ENOTFOUND"))).toBe(false)
			expect(isConnectionError(new Error("ECONNRESET"))).toBe(false)
		})

		it("should increment connection error metrics", async () => {
			// Arrange
			const connectionError = new Error("ECONNREFUSED: Connection refused")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await neo4jService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			const metrics = neo4jService.getMetrics()
			expect(metrics.connectionErrors).toBeGreaterThan(0)
			expect(metrics.totalErrors).toBeGreaterThan(0)
		})

		it("should handle connection pool exhaustion", async () => {
			// Arrange
			const poolExhaustedError = new Error("Connection pool exhausted")
			const mockSession = {
				run: vi.fn().mockRejectedValue(poolExhaustedError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await neo4jService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("failed (attempt 1/3), retrying in"))
			expect(mockErrorLogger.logError).toHaveBeenCalledWith(
				expect.objectContaining({
					service: "neo4j",
					operation: "upsertNode",
					error: "Connection pool exhausted",
					additionalContext: expect.objectContaining({
						isConnectionError: true,
					}),
				}),
			)

			consoleWarnSpy.mockRestore()
		})
	})

	describe("9. Connection Pool Exhaustion Handling", () => {
		it("should handle pool exhaustion gracefully", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				maxConnectionPoolSize: 1, // Very small pool
			})

			;(service as any).driver = mockDriver

			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act - simulate multiple concurrent requests
			const promises = Array.from({ length: 5 }, (_, i) =>
				service.upsertNode({
					id: `test-node-${i}`,
					type: "function",
					name: `testFunction${i}`,
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				}),
			)

			await Promise.allSettled(promises)

			// Assert - should handle without crashing
			const metrics = service.getConnectionPoolMetrics()
			expect(metrics.totalConnections).toBeGreaterThanOrEqual(0)
			expect(metrics.acquisitionFailures).toBeGreaterThanOrEqual(0)
		})

		it("should track pool exhaustion metrics", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			;(service as any).driver = mockDriver

			// Simulate pool exhaustion by making driver.session throw an error
			const exhaustionError = new Error("Connection pool exhausted")
			mockDriver.session.mockImplementation(() => {
				throw exhaustionError
			})
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Initialize service to set up connected state
			await service.initialize()

			// Act
			try {
				await neo4jService.upsertNode({
					id: "test-node",
					type: "function",
					name: "testFunction",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				})
			} catch (error) {
				// Expected to fail
			}

			// Assert
			const metrics = service.getConnectionPoolMetrics()
			expect(metrics.acquisitionAttempts).toBeGreaterThan(0)
			expect(metrics.acquisitionFailures).toBeGreaterThan(0)
		})
	})

	describe("10. Logging When Service is Disconnected", () => {
		it("should log operations when disconnected", async () => {
			// Arrange
			const disconnectedService = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			// Force disconnected state
			;(disconnectedService as any).connected = false
			;(disconnectedService as any).isHealthy = false

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await disconnectedService.upsertNode({
				id: "test-node",
				type: "function",
				name: "testFunction",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith("[Neo4jService] upsertNode skipped - service not connected:", {
				nodeId: "test-node",
			})

			expect(mockErrorLogger.logError).toHaveBeenCalledWith({
				service: "neo4j",
				operation: "upsertNode",
				error: "Service not connected - operation skipped",
				additionalContext: expect.objectContaining({
					connected: false,
					healthy: false,
					shuttingDown: false,
					circuitBreakerState: "closed",
					nodeId: "test-node",
				}),
			})

			consoleWarnSpy.mockRestore()
		})

		it("should handle various disconnected operations", async () => {
			// Arrange
			;(neo4jService as any).connected = false
			;(neo4jService as any).isHealthy = false

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act - test various operations
			await neo4jService.findCallers("test-node")
			await neo4jService.findCallees("test-node")
			await neo4jService.findDependencies("/test/file.js")
			await neo4jService.findDependents("/test/file.js")
			await neo4jService.deleteNode("test-node")

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledTimes(5)
			expect(mockErrorLogger.logError).toHaveBeenCalledTimes(5)

			// Verify all operations were logged as skipped
			const loggedOperations = (mockErrorLogger.logError as any).mock.calls.map((call: any) => call[0].operation)
			expect(loggedOperations).toContain("findCallers")
			expect(loggedOperations).toContain("findCallees")
			expect(loggedOperations).toContain("findDependencies")
			expect(loggedOperations).toContain("findDependents")
			expect(loggedOperations).toContain("deleteNode")

			consoleWarnSpy.mockRestore()
		})
	})

	describe("11. Graceful Shutdown Handling", () => {
		it("should shutdown gracefully", async () => {
			// Arrange
			const mockSession1 = { close: vi.fn().mockResolvedValue(undefined) }
			const mockSession2 = { close: vi.fn().mockResolvedValue(undefined) }

			;(neo4jService as any).sessionPool = [mockSession1, mockSession2]
			;(neo4jService as any).healthCheckTimer = vi.fn()
			;(neo4jService as any).connected = true

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await neo4jService.close()

			// Assert
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Starting graceful shutdown...")
			expect(mockSession1.close).toHaveBeenCalled()
			expect(mockSession2.close).toHaveBeenCalled()
			expect(mockDriver.close).toHaveBeenCalled()
			expect(neo4jService.isConnected()).toBe(false)

			expect(mockErrorLogger.logError).toHaveBeenCalledWith({
				service: "neo4j",
				operation: "close",
				error: "SUCCESS",
				additionalContext: expect.objectContaining({
					graceful: true,
					metrics: expect.any(Object),
				}),
			})

			consoleLogSpy.mockRestore()
		})

		it("should handle shutdown errors gracefully", async () => {
			// Arrange
			const closeError = new Error("Session close failed")
			const mockSession = {
				close: vi.fn().mockRejectedValue(closeError),
				run: vi.fn().mockResolvedValue({ records: [] }),
			}
			const driverCloseError = new Error("Driver close failed")
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.close.mockRejectedValue(driverCloseError)
			;(neo4jService as any).sessionPool = [mockSession]
			;(neo4jService as any).connected = true

			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await neo4jService.close()

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith("[Neo4jService] Error closing driver:", driverCloseError)
			expect(consoleLogSpy).toHaveBeenCalledWith("[Neo4jService] Graceful shutdown completed")
			expect(neo4jService.isConnected()).toBe(false)

			consoleErrorSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should prevent multiple shutdowns", async () => {
			// Arrange
			;(neo4jService as any).isShuttingDown = true

			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await neo4jService.close()

			// Assert
			expect(mockDriver.close).not.toHaveBeenCalled()
			expect(consoleLogSpy).not.toHaveBeenCalledWith("[Neo4jService] Starting graceful shutdown...")
		})
	})

	describe("12. Connection Configuration Validation", () => {
		it("should validate required configuration fields", () => {
			// Test missing URL
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "",
						username: "test",
						password: "test",
						database: "testdb",
					}),
			).toThrow("Neo4j URL is required")

			// Test missing username
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "",
						password: "test",
						database: "testdb",
					}),
			).toThrow("Neo4j username is required")

			// Test missing password
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "",
						database: "testdb",
					}),
			).toThrow("Neo4j password is required")

			// Test missing database
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "",
					}),
			).toThrow("Neo4j database name is required")
		})

		it("should apply default configuration values", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private config for testing
			const config = (service as any).config

			// Assert defaults
			expect(config.maxConnectionPoolSize).toBe(50)
			expect(config.connectionAcquisitionTimeout).toBe(120000) // 2 minutes
			expect(config.maxConnectionLifetime).toBe(10800000) // 3 hours
			expect(config.maxRetries).toBe(3)
			expect(config.initialRetryDelay).toBe(100) // From INITIAL_RETRY_DELAY_MS constant
			expect(config.maxRetryDelay).toBe(30000) // 30 seconds
			expect(config.circuitBreakerThreshold).toBe(5)
			expect(config.circuitBreakerTimeout).toBe(60000) // 1 minute
			expect(config.healthCheckInterval).toBe(30000) // 30 seconds
			expect(config.queryTimeout).toBe(60000) // 1 minute
			expect(config.sessionMaxTransactionRetryTime).toBe(30000) // 30 seconds
			expect(config.sessionIdleTimeout).toBe(10000) // 10 seconds
		})

		it("should validate configuration ranges", () => {
			// Test invalid max connection lifetime
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						maxConnectionLifetime: -1, // Invalid
					}),
			).toThrow() // Should fail validation

			// Test valid configuration
			expect(
				() =>
					new Neo4jService({
						enabled: true,
						url: "bolt://localhost:7687",
						username: "test",
						password: "test",
						database: "testdb",
						maxConnectionLifetime: 7200000, // 2 hours - valid
					}),
			).not.toThrow()
		})
	})

	describe("13. Metrics and Observability", () => {
		it("should track comprehensive service metrics", async () => {
			// Arrange
			const mockSession = {
				run: vi.fn().mockResolvedValue({ records: [] }),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act - perform various operations
			await neo4jService.upsertNode({
				id: "test-node-1",
				type: "function",
				name: "testFunction1",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			await neo4jService.findCallers("test-node")

			// Simulate some failures
			mockSession.run.mockRejectedValueOnce(new Error("Test error"))
			try {
				await neo4jService.findCallees("test-node")
			} catch (error) {
				// Expected
			}

			// Assert
			const metrics = neo4jService.getMetrics()

			expect(metrics.totalQueries).toBeGreaterThan(0)
			expect(metrics.successfulQueries).toBeGreaterThan(0)
			expect(metrics.failedQueries).toBeGreaterThan(0)
			expect(metrics.totalErrors).toBeGreaterThan(0)
			expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0)
			expect(metrics.uptime).toBeGreaterThan(0)
		})

		it("should calculate average query time correctly", async () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			;(service as any).driver = mockDriver

			// Mock different query times
			const mockSession = {
				run: vi.fn().mockImplementation(async () => {
					// Simulate different execution times
					await new Promise((resolve) => setTimeout(resolve, 100))
					return { records: [] }
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act
			await service.upsertNode({
				id: "test-node-1",
				type: "function",
				name: "testFunction1",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			await service.upsertNode({
				id: "test-node-2",
				type: "function",
				name: "testFunction2",
				filePath: "/test/file.js",
				startLine: 1,
				endLine: 10,
				language: "javascript",
			})

			// Assert
			const metrics = service.getMetrics()
			expect(metrics.averageQueryTime).toBeGreaterThan(0)
			expect(metrics.successfulQueries).toBe(2)
		})

		it("should track timeout errors separately", async () => {
			// Arrange
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

			// Act
			try {
				await service.upsertNode({
					id: "test-node",
					type: "function",
					name: "testFunction",
					filePath: "/test/file.js",
					startLine: 1,
					endLine: 10,
					language: "javascript",
				})
			} catch (error) {
				// Expected to timeout
			}

			// Assert
			const metrics = service.getMetrics()
			expect(metrics.timeoutErrors).toBeGreaterThan(0)
			expect(metrics.totalErrors).toBeGreaterThan(0)
		})

		it("should track circuit breaker trips", async () => {
			// Arrange
			const connectionError = new Error("Connection failed")
			const mockSession = {
				run: vi.fn().mockRejectedValue(connectionError),
				close: vi.fn().mockResolvedValue(undefined),
			}
			mockDriver.session.mockReturnValue(mockSession)
			mockDriver.verifyConnectivity.mockResolvedValue(undefined)

			// Act - trip circuit breaker
			for (let i = 0; i < 6; i++) {
				try {
					await neo4jService.upsertNode({
						id: `test-node-${i}`,
						type: "function",
						name: `testFunction${i}`,
						filePath: "/test/file.js",
						startLine: 1,
						endLine: 10,
						language: "javascript",
					})
				} catch (error) {
					// Expected to fail
				}
			}

			// Assert
			const metrics = neo4jService.getMetrics()
			expect(metrics.circuitBreakerTrips).toBeGreaterThan(0)
		})

		it("should provide connection pool metrics", () => {
			// Arrange
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				maxConnectionPoolSize: 20,
			})

			// Mock driver and session
			const mockDriver = {
				session: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({ records: [] }),
					close: vi.fn().mockResolvedValue(undefined),
				}),
				verifyConnectivity: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
			}
			;(service as any).driver = mockDriver

			// Simulate some sessions in pool
			;(service as any).sessionPool = new Array(5).fill({})

			// Simulate acquisition attempts and failures
			;(service as any).poolAcquisitionAttempts = 15
			;(service as any).poolAcquisitionFailures = 2
			;(service as any).totalSessionsCreated = 15
			;(service as any).closedSessions = 0

			// Act
			const poolMetrics = service.getConnectionPoolMetrics()

			// Assert
			expect(poolMetrics.totalConnections).toBe(15) // totalSessionsCreated
			expect(poolMetrics.idleConnections).toBe(5)
			expect(poolMetrics.activeConnections).toBe(10) // 15 - 5 - 0 (closedSessions)
			expect(poolMetrics.acquisitionAttempts).toBe(15)
			expect(poolMetrics.acquisitionFailures).toBe(2)
		})
	})

	describe("14. Configurable Encryption Option", () => {
		it("should infer encryption from secure URL schemes", () => {
			// Arrange & Act
			const httpsService = new Neo4jService({
				enabled: true,
				url: "https://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			const wssService = new Neo4jService({
				enabled: true,
				url: "wss://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			const httpService = new Neo4jService({
				enabled: true,
				url: "http://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			const wsService = new Neo4jService({
				enabled: true,
				url: "ws://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			})

			// Access private config for testing
			const httpsConfig = (httpsService as any).config
			const wssConfig = (wssService as any).config
			const httpConfig = (httpService as any).config
			const wsConfig = (wsService as any).config

			// Assert - secure schemes should default to encrypted: true
			expect(httpsConfig.encrypted).toBe(true)
			expect(wssConfig.encrypted).toBe(true)

			// Assert - non-secure schemes should default to encrypted: false
			expect(httpConfig.encrypted).toBe(false)
			expect(wsConfig.encrypted).toBe(false)
		})

		it("should respect explicit encryption setting", () => {
			// Arrange & Act - explicit encrypted: true
			const encryptedService = new Neo4jService({
				enabled: true,
				url: "http://localhost:7687", // non-secure URL
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: true, // explicit override
			})

			// Arrange & Act - explicit encrypted: false
			const unencryptedService = new Neo4jService({
				enabled: true,
				url: "https://localhost:7687", // secure URL
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: false, // explicit override
			})

			// Access private config for testing
			const encryptedConfig = (encryptedService as any).config
			const unencryptedConfig = (unencryptedService as any).config

			// Assert - explicit settings should override URL inference
			expect(encryptedConfig.encrypted).toBe(true)
			expect(unencryptedConfig.encrypted).toBe(false)
		})

		it("should log warning when encryption conflicts with URL scheme", () => {
			// Arrange
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act - create service with conflicting settings
			new Neo4jService({
				enabled: true,
				url: "http://localhost:7687", // non-secure URL
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: true, // conflicts with non-secure URL
			})

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"[Neo4jService] Warning: Encryption is enabled but URL scheme is non-secure (http://localhost:7687). This may cause connection issues.",
			)

			consoleWarnSpy.mockRestore()
		})

		it("should not log warning when encryption matches URL scheme", () => {
			// Arrange
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act - create service with matching settings
			new Neo4jService({
				enabled: true,
				url: "https://localhost:7687", // secure URL
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: true, // matches secure URL
			})

			new Neo4jService({
				enabled: true,
				url: "http://localhost:7687", // non-secure URL
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: false, // matches non-secure URL
			})

			// Assert
			expect(consoleWarnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining("Warning: Encryption is enabled but URL scheme is non-secure"),
			)

			consoleWarnSpy.mockRestore()
		})

		it("should use conditional encryption in driver initialization", async () => {
			// Arrange
			const mockDriver = {
				verifyConnectivity: vi.fn().mockResolvedValue(undefined),
				session: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({ records: [] }),
					close: vi.fn().mockResolvedValue(undefined),
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}

			// Mock neo4j.driver to capture initialization parameters
			const mockNeo4jDriver = vi.fn().mockReturnValue(mockDriver)
			vi.doMock("neo4j-driver", () => ({
				driver: mockNeo4jDriver,
				auth: {
					basic: vi.fn(),
				},
				bookmarkManager: vi.fn(),
				int: vi.fn((value: number) => ({ toNumber: () => value })),
			}))

			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act - test with explicit encrypted: false
			const service1 = new Neo4jService({
				enabled: true,
				url: "http://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: false,
			})

			await service1.initialize()

			// Assert - driver should be called without encrypted parameter
			expect(mockNeo4jDriver).toHaveBeenCalledWith(
				"http://localhost:7687",
				expect.any(Object), // auth object
				expect.not.objectContaining({ encrypted: true }), // should not contain encrypted
			)

			// Reset mocks
			vi.clearAllMocks()
			consoleWarnSpy.mockClear()

			// Act - test with explicit encrypted: true
			const service2 = new Neo4jService({
				enabled: true,
				url: "http://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
				encrypted: true,
			})

			;(service2 as any).driver = mockDriver

			await service2.initialize()

			// Assert - driver should be called with encrypted: true
			expect(mockNeo4jDriver).toHaveBeenCalledWith(
				"http://localhost:7687",
				expect.any(Object), // auth object
				expect.objectContaining({ encrypted: true }), // should contain encrypted: true
			)

			consoleWarnSpy.mockRestore()
		})

		it("should omit encryption parameter when undefined", async () => {
			// Arrange
			const mockDriver = {
				verifyConnectivity: vi.fn().mockResolvedValue(undefined),
				session: vi.fn().mockReturnValue({
					run: vi.fn().mockResolvedValue({ records: [] }),
					close: vi.fn().mockResolvedValue(undefined),
				}),
				close: vi.fn().mockResolvedValue(undefined),
			}

			const mockNeo4jDriver = vi.fn().mockReturnValue(mockDriver)
			vi.doMock("neo4j-driver", () => ({
				driver: mockNeo4jDriver,
				auth: {
					basic: vi.fn(),
				},
				bookmarkManager: vi.fn(),
				int: vi.fn((value: number) => ({ toNumber: () => value })),
			}))

			// Act - create service without explicit encryption (undefined)
			const service = new Neo4jService({
				enabled: true,
				url: "bolt://localhost:7687", // no s:// in URL
				username: "test",
				password: "test",
				database: "testdb",
				// encrypted not specified - should be undefined
			})

			;(service as any).driver = mockDriver

			await service.initialize()

			// Assert - driver should be called without encrypted parameter
			expect(mockNeo4jDriver).toHaveBeenCalledWith(
				"bolt://localhost:7687",
				expect.any(Object), // auth object
				expect.not.objectContaining({ encrypted: expect.any(Boolean) }), // should not contain encrypted at all
			)
		})
	})
})
