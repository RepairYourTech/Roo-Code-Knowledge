// npx vitest run services/code-index/__tests__/state-manager-enhanced-tracking.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest"
import { CodeIndexStateManager } from "../state-manager"

// Mock VSCode APIs
vi.mock("vscode", () => ({
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

describe("CodeIndexStateManager - Enhanced Tracking and Circuit Breaker Integration", () => {
	let stateManager: CodeIndexStateManager

	beforeEach(() => {
		stateManager = new CodeIndexStateManager()
		vi.clearAllMocks()
	})

	describe("Neo4j Status Tracking", () => {
		it("should track Neo4j consecutive failures correctly", () => {
			// Initially should have 0 failures
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(0)

			// Simulate first failure
			stateManager.setNeo4jStatus("error", "First error", "Error details")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(1)

			// Simulate second failure
			stateManager.setNeo4jStatus("error", "Second error", "Error details 2")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(2)

			// Check status reflects failures
			const status = stateManager.getCurrentStatus()
			expect(status.neo4jStatus).toBe("error")
			expect(status.neo4jLastError).toBe("Error details 2")
			expect(status.neo4jConsecutiveFailures).toBe(2)
		})

		it("should reset Neo4j consecutive failures on success", () => {
			// First, accumulate failures
			stateManager.setNeo4jStatus("error", "Error", "Error details")
			stateManager.setNeo4jStatus("connection-failed", "Connection failed", "Connection error")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(2)

			// Reset on success
			stateManager.setNeo4jStatus("indexed", "Success")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(0)

			// Reset on idle
			stateManager.setNeo4jStatus("error", "Another error", "Error details")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(1)
			stateManager.setNeo4jStatus("idle", "Idle")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(0)
		})

		it("should reset Neo4j consecutive failures manually", () => {
			// Accumulate failures
			stateManager.setNeo4jStatus("error", "Error", "Error details")
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(1)

			// Manual reset
			stateManager.resetNeo4jConsecutiveFailures()
			expect(stateManager.getNeo4jConsecutiveFailures()).toBe(0)
			expect(stateManager.getCurrentStatus().neo4jLastError).toBe("")
			expect(stateManager.getCurrentStatus().neo4jStatus).toBe("idle")
		})

		it("should track different Neo4j status types", () => {
			const statuses = [
				"idle",
				"indexing",
				"indexed",
				"error",
				"disabled",
				"connection-failed",
				"resource-exhausted",
			]

			statuses.forEach((status) => {
				stateManager.setNeo4jStatus(status as any, `Testing ${status}`)
				expect(stateManager.getCurrentStatus().neo4jStatus).toBe(status)
				expect(stateManager.getCurrentStatus().neo4jMessage).toBe(`Testing ${status}`)
			})
		})
	})

	describe("Vector Status Tracking", () => {
		it("should track vector status independently", () => {
			// Initially should be idle
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("idle")

			// Set to indexing
			stateManager.setVectorStatus("indexing", "Vector indexing in progress")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("indexing")
			expect(stateManager.getCurrentStatus().vectorMessage).toBe("Vector indexing in progress")

			// Set to indexed
			stateManager.setVectorStatus("indexed", "Vector indexing complete")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("indexed")
			expect(stateManager.getCurrentStatus().vectorMessage).toBe("Vector indexing complete")

			// Set to error
			stateManager.setVectorStatus("error", "Vector indexing failed")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("error")
			expect(stateManager.getCurrentStatus().vectorMessage).toBe("Vector indexing failed")
		})
	})

	describe("System Health Tracking", () => {
		it("should calculate system health correctly", () => {
			// Initially healthy
			expect(stateManager.getCurrentStatus().systemHealth).toBe("healthy")

			// Vector error, Neo4j healthy -> degraded
			stateManager.setVectorStatus("error", "Vector error")
			expect(stateManager.getCurrentStatus().systemHealth).toBe("degraded")

			// Reset vector, Neo4j error -> degraded
			stateManager.setVectorStatus("indexed", "Vector OK")
			stateManager.setNeo4jStatus("error", "Neo4j error", "Error details")
			expect(stateManager.getCurrentStatus().systemHealth).toBe("degraded")

			// Both error -> failed
			stateManager.setVectorStatus("error", "Vector error")
			expect(stateManager.getCurrentStatus().systemHealth).toBe("failed")

			// Vector recovered, Neo4j still error -> degraded
			stateManager.setVectorStatus("indexed", "Vector recovered")
			expect(stateManager.getCurrentStatus().systemHealth).toBe("degraded")

			// Both recovered -> healthy
			stateManager.setNeo4jStatus("indexed", "Neo4j recovered")
			expect(stateManager.getCurrentStatus().systemHealth).toBe("healthy")
		})

		it("should provide system health status methods", () => {
			// Initially healthy
			expect(stateManager.isSystemDegraded()).toBe(false)
			expect(stateManager.isSystemFailed()).toBe(false)

			// Make degraded
			stateManager.setVectorStatus("error", "Vector error")
			expect(stateManager.isSystemDegraded()).toBe(true)
			expect(stateManager.isSystemFailed()).toBe(false)

			// Make failed
			stateManager.setNeo4jStatus("error", "Neo4j error", "Error details")
			expect(stateManager.isSystemDegraded()).toBe(false)
			expect(stateManager.isSystemFailed()).toBe(true)

			// Recover
			stateManager.setVectorStatus("indexed", "Vector OK")
			expect(stateManager.isSystemDegraded()).toBe(true)
			expect(stateManager.isSystemFailed()).toBe(false)

			// Full recovery
			stateManager.setNeo4jStatus("indexed", "Neo4j OK")
			expect(stateManager.isSystemDegraded()).toBe(false)
			expect(stateManager.isSystemFailed()).toBe(false)
		})
	})

	describe("Component Status Integration", () => {
		it("should provide comprehensive component status", () => {
			// Set some status
			stateManager.setSystemState("Indexing", "System indexing")
			stateManager.reportBlockIndexingProgress(50, 100)
			stateManager.setNeo4jStatus("indexing", "Neo4j indexing")
			stateManager.setVectorStatus("indexing", "Vector indexing")

			const componentStatus = stateManager.getComponentStatus()

			// Check vector component
			expect(componentStatus.vector.status).toBe("indexing")
			expect(componentStatus.vector.processedItems).toBe(50)
			expect(componentStatus.vector.totalItems).toBe(100)
			expect(componentStatus.vector.message).toBe("Processing 50/100 blocks")

			// Check Neo4j component
			expect(componentStatus.neo4j.status).toBe("indexing")
			expect(componentStatus.neo4j.processedItems).toBe(0)
			expect(componentStatus.neo4j.totalItems).toBe(0)
			expect(componentStatus.neo4j.message).toBe("Neo4j indexing")
			expect(componentStatus.neo4j.consecutiveFailures).toBe(0)

			// Check system component
			expect(componentStatus.system.health).toBe("healthy")
			expect(componentStatus.system.overallState).toBe("Indexing")
			expect(componentStatus.system.message).toBe("System indexing")
		})
	})

	describe("Progress Reporting Integration", () => {
		it("should handle combined progress reporting", () => {
			const progressListener = vi.fn()
			stateManager.onProgressUpdate(progressListener)

			// Start vector indexing
			stateManager.reportBlockIndexingProgress(25, 100)
			expect(progressListener).toHaveBeenCalledTimes(1)

			const firstCall = progressListener.mock.calls[0][0]
			expect(firstCall.processedItems).toBe(25)
			expect(firstCall.totalItems).toBe(100)
			expect(firstCall.vectorStatus).toBe("indexing")
			expect(firstCall.systemStatus).toBe("Indexing")

			// Start Neo4j indexing
			stateManager.reportNeo4jIndexingProgress(10, 50, "indexing", "Neo4j indexing")
			expect(progressListener).toHaveBeenCalledTimes(2)

			const secondCall = progressListener.mock.calls[1][0]
			expect(secondCall.neo4jProcessedItems).toBe(10)
			expect(secondCall.neo4jTotalItems).toBe(50)
			expect(secondCall.neo4jStatus).toBe("indexing")
			expect(secondCall.neo4jMessage).toBe("Neo4j indexing")
		})

		it("should handle vector-only progress when Neo4j fails", () => {
			const progressListener = vi.fn()
			stateManager.onProgressUpdate(progressListener)

			// Start vector indexing
			stateManager.reportBlockIndexingProgress(50, 100)

			// Neo4j fails
			stateManager.setNeo4jStatus("error", "Neo4j failed", "Error details")

			// Continue vector progress
			stateManager.reportBlockIndexingProgress(75, 100)

			const lastCall = progressListener.mock.calls[progressListener.mock.calls.length - 1][0]
			expect(lastCall.systemStatus).toBe("Indexing")
			expect(lastCall.statusMessage).toContain("Vector indexing 75% complete (Graph indexing unavailable)")
			expect(lastCall.neo4jStatus).toBe("error")
			expect(lastCall.vectorStatus).toBe("indexing")
		})

		it("should handle Neo4j-only progress when vector fails", () => {
			const progressListener = vi.fn()
			stateManager.onProgressUpdate(progressListener)

			// Vector fails
			stateManager.setVectorStatus("error", "Vector failed")

			// Continue Neo4j progress
			stateManager.reportNeo4jIndexingProgress(25, 50, "indexing", "Neo4j continuing")

			const lastCall = progressListener.mock.calls[progressListener.mock.calls.length - 1][0]
			expect(lastCall.vectorStatus).toBe("error")
			expect(lastCall.neo4jStatus).toBe("indexing")
			expect(lastCall.systemHealth).toBe("degraded")
		})
	})

	describe("Event Emission", () => {
		it("should emit progress events correctly", () => {
			const progressListener = vi.fn()
			stateManager.onProgressUpdate(progressListener)

			// Multiple status changes
			stateManager.setSystemState("Indexing", "Starting")
			stateManager.reportBlockIndexingProgress(10, 100)
			stateManager.setNeo4jStatus("indexing", "Neo4j started")
			stateManager.setVectorStatus("indexed", "Vector done")

			// Should have fired for each change
			expect(progressListener).toHaveBeenCalledTimes(4)

			// Check the last call has all updated information
			const lastCall = progressListener.mock.calls[3][0]
			expect(lastCall.vectorStatus).toBe("indexed")
			expect(lastCall.systemStatus).toBe("Indexing")
			expect(lastCall.systemHealth).toBe("degraded") // Neo4j still indexing
		})

		it("should handle event listener disposal", () => {
			const progressListener = vi.fn()
			const disposable = stateManager.onProgressUpdate(progressListener)

			// Should receive events
			stateManager.setSystemState("Indexing", "Starting")
			expect(progressListener).toHaveBeenCalledTimes(1)

			// Dispose and should not receive more events
			disposable.dispose()
			stateManager.setSystemState("Indexed", "Complete")
			expect(progressListener).toHaveBeenCalledTimes(1) // Still 1, not 2
		})
	})

	describe("Status Retrieval", () => {
		it("should provide current status snapshot", () => {
			// Set various states
			stateManager.setSystemState("Indexing", "System indexing")
			stateManager.reportBlockIndexingProgress(30, 60)
			stateManager.setNeo4jStatus("error", "Neo4j error", "Error details")
			stateManager.setVectorStatus("indexing", "Vector working")

			const status = stateManager.getCurrentStatus()

			// Check all fields
			expect(status.systemStatus).toBe("Indexing")
			expect(status.message).toBe("System indexing")
			expect(status.processedItems).toBe(30)
			expect(status.totalItems).toBe(60)
			expect(status.currentItemUnit).toBe("blocks")

			// Neo4j fields
			expect(status.neo4jStatus).toBe("error")
			expect(status.neo4jMessage).toBe("Neo4j error")
			expect(status.neo4jLastError).toBe("Error details")
			expect(status.neo4jConsecutiveFailures).toBe(1)

			// Vector fields
			expect(status.vectorStatus).toBe("indexing")
			expect(status.vectorMessage).toBe("Processing 30/60 blocks")

			// System health
			expect(status.systemHealth).toBe("degraded")
		})

		it("should provide component status snapshot", () => {
			// Set various states
			stateManager.setSystemState("Indexed", "Complete")
			stateManager.reportBlockIndexingProgress(100, 100)
			stateManager.setNeo4jStatus("indexed", "Neo4j complete")
			stateManager.setVectorStatus("indexed", "Vector complete")

			const componentStatus = stateManager.getComponentStatus()

			// Check structure
			expect(componentStatus).toHaveProperty("vector")
			expect(componentStatus).toHaveProperty("neo4j")
			expect(componentStatus).toHaveProperty("system")

			// Check vector component
			expect(componentStatus.vector.status).toBe("indexed")
			expect(componentStatus.vector.processedItems).toBe(100)
			expect(componentStatus.vector.totalItems).toBe(100)

			// Check Neo4j component
			expect(componentStatus.neo4j.status).toBe("indexed")
			expect(componentStatus.neo4j.processedItems).toBe(0)
			expect(componentStatus.neo4j.totalItems).toBe(0)
			expect(componentStatus.neo4j.consecutiveFailures).toBe(0)

			// Check system component
			expect(componentStatus.system.health).toBe("healthy")
			expect(componentStatus.system.overallState).toBe("Indexed")
			expect(componentStatus.system.message).toBe("Complete")
		})
	})

	describe("Edge Cases", () => {
		it("should handle rapid status changes", () => {
			const progressListener = vi.fn()
			stateManager.onProgressUpdate(progressListener)

			// Rapid status changes
			stateManager.setSystemState("Indexing", "Start")
			stateManager.setNeo4jStatus("error", "Error 1", "Details 1")
			stateManager.setNeo4jStatus("indexing", "Recovered")
			stateManager.setVectorStatus("error", "Vector error")
			stateManager.setSystemState("Error", "System error")

			// Should handle all changes without errors
			expect(progressListener).toHaveBeenCalledTimes(5)

			// Final state should be consistent
			const finalStatus = stateManager.getCurrentStatus()
			expect(finalStatus.systemStatus).toBe("Error")
			expect(finalStatus.systemHealth).toBe("failed")
			expect(finalStatus.vectorStatus).toBe("error")
			expect(finalStatus.neo4jStatus).toBe("indexing")
		})

		it("should handle status transitions correctly", () => {
			// Test standby transitions
			stateManager.setSystemState("Indexing", "Starting")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("indexing")
			expect(stateManager.getCurrentStatus().neo4jStatus).toBe("idle") // Not disabled/error

			stateManager.setSystemState("Standby", "Ready")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("idle")
			expect(stateManager.getCurrentStatus().neo4jStatus).toBe("idle")

			// Test indexed transitions
			stateManager.setSystemState("Indexing", "Starting")
			stateManager.setNeo4jStatus("indexing", "Neo4j working")
			stateManager.setSystemState("Indexed", "Complete")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("indexed")
			expect(stateManager.getCurrentStatus().neo4jStatus).toBe("indexed")

			// Test error transitions
			stateManager.setSystemState("Error", "Failed")
			expect(stateManager.getCurrentStatus().vectorStatus).toBe("error")
			expect(stateManager.getCurrentStatus().neo4jStatus).toBe("indexed") // Should preserve Neo4j state
		})
	})
})
