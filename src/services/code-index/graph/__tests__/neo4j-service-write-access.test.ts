import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Neo4jService } from "../neo4j-service"
import neo4j from "neo4j-driver"

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

	return {
		default: mockDriver,
		...mockModule,
	}
})

describe("Neo4jService - Write Access Verification", () => {
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
		// Mock connected state
		;(neo4jService as any).connected = true
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	it("should use WRITE session for deleteNode", async () => {
		await neo4jService.deleteNode("test-id")
		expect(mockDriver.session).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultAccessMode: neo4j.session.WRITE,
			}),
		)
	})

	it("should use WRITE session for deleteNodesByFilePath", async () => {
		await neo4jService.deleteNodesByFilePath("/path/to/file")
		expect(mockDriver.session).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultAccessMode: neo4j.session.WRITE,
			}),
		)
	})

	it("should use WRITE session for deleteNodesByMultipleFilePaths", async () => {
		await neo4jService.deleteNodesByMultipleFilePaths(["/path/to/file1", "/path/to/file2"])
		expect(mockDriver.session).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultAccessMode: neo4j.session.WRITE,
			}),
		)
	})

	it("should use WRITE session for clearAll", async () => {
		await neo4jService.clearAll()
		expect(mockDriver.session).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultAccessMode: neo4j.session.WRITE,
			}),
		)
	})
})
