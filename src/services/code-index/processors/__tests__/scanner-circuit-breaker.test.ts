import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { DirectoryScanner } from "../scanner"
import { stat } from "fs/promises"

// Mock TelemetryService
vi.mock("../../../../../packages/telemetry/src/TelemetryService", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
		writeFile: vi.fn(),
		mkdir: vi.fn(),
		access: vi.fn(),
		rename: vi.fn(),
		constants: {},
	},
	stat: vi.fn(),
}))

// Create a simple mock for vscode since we can't access the real one
vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [
			{
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		],
		getWorkspaceFolder: vi.fn().mockReturnValue({
			uri: {
				fsPath: "/mock/workspace",
			},
		}),
		fs: {
			readFile: vi.fn().mockResolvedValue(Buffer.from("test content")),
		},
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue(50), // Mock batch size
		}),
	},
	Uri: {
		file: vi.fn().mockImplementation((path) => path),
	},
	window: {
		activeTextEditor: {
			document: {
				uri: {
					fsPath: "/mock/workspace",
				},
			},
		},
	},
}))

vi.mock("../../../../core/ignore/RooIgnoreController")
vi.mock("ignore")

// Override the Jest-based mock with a vitest-compatible version
vi.mock("../../../glob/list-files", () => ({
	listFiles: vi.fn(),
}))

// Mock setTimeout for circuit breaker reset testing
const mockSetTimeout = vi.fn()
vi.mock("timers", () => ({
	setTimeout: mockSetTimeout,
}))

describe("DirectoryScanner - Circuit Breaker Pattern", () => {
	let scanner: DirectoryScanner
	let mockEmbedder: any
	let mockVectorStore: any
	let mockCodeParser: any
	let mockCacheManager: any
	let mockGraphIndexer: any
	let mockIgnoreInstance: any
	let mockStats: any

	beforeEach(async () => {
		// Reset the global circuit breaker state
		vi.stubGlobal("consecutiveNeo4jFailures", 0)

		mockEmbedder = {
			createEmbeddings: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
			embedderInfo: { name: "mock-embedder", dimensions: 384 },
		}
		mockVectorStore = {
			upsertPoints: vi.fn().mockResolvedValue(undefined),
			deletePointsByFilePath: vi.fn().mockResolvedValue(undefined),
			deletePointsByMultipleFilePaths: vi.fn().mockResolvedValue(undefined),
			initialize: vi.fn().mockResolvedValue(true),
			search: vi.fn().mockResolvedValue([]),
			clearCollection: vi.fn().mockResolvedValue(undefined),
			deleteCollection: vi.fn().mockResolvedValue(undefined),
			collectionExists: vi.fn().mockResolvedValue(true),
		}
		mockCodeParser = {
			parseFile: vi.fn().mockResolvedValue([]),
		}
		mockCacheManager = {
			getHash: vi.fn().mockReturnValue(undefined),
			getAllHashes: vi.fn().mockReturnValue({}),
			updateHash: vi.fn().mockResolvedValue(undefined),
			deleteHash: vi.fn().mockResolvedValue(undefined),
			initialize: vi.fn().mockResolvedValue(undefined),
			clearCacheFile: vi.fn().mockResolvedValue(undefined),
		}
		mockIgnoreInstance = {
			ignores: vi.fn().mockReturnValue(false),
		}

		mockGraphIndexer = {
			indexFile: vi.fn(),
		}

		scanner = new DirectoryScanner(
			mockEmbedder,
			mockVectorStore,
			mockCodeParser,
			mockCacheManager,
			mockIgnoreInstance,
			undefined, // bm25Index
			50, // batchSegmentThreshold
			mockGraphIndexer,
		)

		// Mock default implementations - create proper Stats object
		mockStats = {
			size: 1024,
			isFile: () => true,
			isDirectory: () => false,
			isBlockDevice: () => false,
			isCharacterDevice: () => false,
			isSymbolicLink: () => false,
			isFIFO: () => false,
			isSocket: () => false,
			dev: 0,
			ino: 0,
			mode: 0,
			nlink: 0,
			uid: 0,
			gid: 0,
			rdev: 0,
			blksize: 0,
			blocks: 0,
			atimeMs: 0,
			mtimeMs: 0,
			ctimeMs: 0,
			atime: new Date(),
			mtime: new Date(),
			ctime: new Date(),
			birthtimeMs: 0,
			atimeNs: BigInt(0),
			mtimeNs: BigInt(0),
			ctimeNs: BigInt(0),
			birthtimeNs: BigInt(0),
		}
		vi.mocked(stat).mockResolvedValue(mockStats)

		// Get and mock the listFiles function
		const { listFiles } = await import("../../../glob/list-files")
		vi.mocked(listFiles).mockResolvedValue([["test/file1.js", "test/file2.js"], false])
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.unstubAllGlobals()
	})

	describe("Circuit Breaker Functionality", () => {
		it("should track consecutive Neo4j failures correctly", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)
			mockGraphIndexer.indexFile.mockRejectedValue(new Error("Connection pool exhausted"))

			// Mock console methods to capture logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await scanner.scanDirectory("/test")

			// Assert
			expect(mockGraphIndexer.indexFile).toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Error indexing to Neo4j:"),
				expect.objectContaining({
					error: expect.stringContaining("Connection pool exhausted"),
				}),
			)
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j consecutive failures: 1/3"))

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
		})

		it("should trigger circuit breaker after MAX_CONSECUTIVE_FAILURES", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Simulate 3 consecutive failures to trigger circuit breaker
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))

			// Mock console methods to capture logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await scanner.scanDirectory("/test")

			// Assert
			expect(mockGraphIndexer.indexFile).toHaveBeenCalledTimes(3)
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j consecutive failures: 1/3"))
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j consecutive failures: 2/3"))
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j circuit breaker triggered - 3 consecutive failures"),
			)

			// Verify circuit breaker reset timer was set
			expect(mockSetTimeout).toHaveBeenCalledWith(
				expect.any(Function),
				5 * 60 * 1000, // 5 minutes
			)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
		})

		it("should reset circuit breaker after timeout", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// First, trigger circuit breaker
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act - first scan to trigger circuit breaker
			await scanner.scanDirectory("/test")

			// Verify circuit breaker was triggered
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j circuit breaker triggered"))

			// Get the timeout callback and execute it to simulate reset
			const timeoutCallback = mockSetTimeout.mock.calls[0]?.[0]
			expect(timeoutCallback).toBeDefined()

			// Reset mocks for second scan
			vi.clearAllMocks()
			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)
			mockGraphIndexer.indexFile.mockResolvedValue(undefined) // Now succeeds

			// Act - simulate circuit breaker reset
			timeoutCallback()

			// Assert
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j circuit breaker reset - re-enabling Neo4j indexing"),
			)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should continue vector indexing when circuit breaker is triggered", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Trigger circuit breaker on Neo4j
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			const result = await scanner.scanDirectory("/test")

			// Assert
			// Vector indexing should still succeed
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()

			// Neo4j should have failed and triggered circuit breaker
			expect(mockGraphIndexer.indexFile).toHaveBeenCalledTimes(3)
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j circuit breaker triggered"))

			// Overall scan should still complete successfully
			expect(result.stats.processed).toBe(1)
			expect(result.totalBlockCount).toBe(1)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
		})

		it("should handle resource exhaustion patterns specifically", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Simulate resource exhaustion error
			mockGraphIndexer.indexFile.mockRejectedValue(
				new Error("Neo4j connection pool exhausted - too many connections"),
			)

			// Mock console and telemetry
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const telemetrySpy = vi.spyOn(
				require("../../../../../packages/telemetry/src/TelemetryService").TelemetryService.instance,
				"captureEvent",
			)

			// Act
			await scanner.scanDirectory("/test")

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j connection issue detected - possible resource exhaustion"),
			)
			expect(telemetrySpy).toHaveBeenCalledWith(
				"CODE_INDEX_ERROR",
				expect.objectContaining({
					errorType: "connection_exhaustion",
				}),
			)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
			telemetrySpy.mockRestore()
		})

		it("should reset consecutive failures on successful operations", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// First fail, then succeed
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockResolvedValueOnce(undefined)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await scanner.scanDirectory("/test")

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j consecutive failures: 1/3"))
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j operation succeeded - resetting consecutive failure counter"),
			)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should handle critical Neo4j errors differently", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Simulate critical authentication error
			mockGraphIndexer.indexFile.mockRejectedValue(new Error("Neo4j authentication failed"))

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act & Assert
			await expect(scanner.scanDirectory("/test")).rejects.toThrow(
				"Neo4j critical error: Neo4j authentication failed",
			)

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Critical Neo4j error - stopping indexing"),
			)

			consoleErrorSpy.mockRestore()
		})

		it("should handle mutex timeout detection", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Mock slow mutex acquisition
			const mockMutex = {
				acquire: vi.fn().mockImplementation(async () => {
					// Simulate slow acquisition
					await new Promise((resolve) => setTimeout(resolve, 35000)) // 35 seconds
					return vi.fn()
				}),
			}

			// Create scanner with mocked mutex
			const scannerWithSlowMutex = new DirectoryScanner(
				mockEmbedder,
				mockVectorStore,
				mockCodeParser,
				mockCacheManager,
				mockIgnoreInstance,
				undefined, // bm25Index
				50, // batchSegmentThreshold
				mockGraphIndexer,
			)

			// Mock console methods
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Mock Date.now to control timing
			const mockDateNow = vi
				.fn()
				.mockReturnValueOnce(1000000) // Start time
				.mockReturnValueOnce(1035000) // After 35 seconds
			vi.stubGlobal("Date", { now: mockDateNow })

			// Act
			await scannerWithSlowMutex.scanDirectory("/test")

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j mutex acquisition took 35000ms for file: test/file1.js"),
			)

			vi.unstubAllGlobals()
			consoleWarnSpy.mockRestore()
		})

		it("should handle mutex release timeout detection", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)
			mockGraphIndexer.indexFile.mockResolvedValue(undefined)

			// Mock slow mutex release
			const mockRelease = vi.fn().mockImplementation(async () => {
				// Simulate slow release
				await new Promise((resolve) => setTimeout(resolve, 6000)) // 6 seconds
			})

			const mockMutex = {
				acquire: vi.fn().mockResolvedValue(mockRelease),
			}

			// Create scanner with mocked mutex
			const scannerWithSlowRelease = new DirectoryScanner(
				mockEmbedder,
				mockVectorStore,
				mockCodeParser,
				mockCacheManager,
				mockIgnoreInstance,
				undefined, // bm25Index
				50, // batchSegmentThreshold
				mockGraphIndexer,
			)

			// Mock console methods
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Mock Date.now to control timing
			const mockDateNow = vi
				.fn()
				.mockReturnValueOnce(2000000) // Start time
				.mockReturnValueOnce(2006000) // After 6 seconds
			vi.stubGlobal("Date", { now: mockDateNow })

			// Act
			await scannerWithSlowRelease.scanDirectory("/test")

			// Assert
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j mutex release took 6000ms for file: test/file1.js"),
			)

			vi.unstubAllGlobals()
			consoleWarnSpy.mockRestore()
		})
	})

	describe("Error Handling and Recovery", () => {
		it("should handle mixed success/failure scenarios gracefully", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
				{
					id: "block-2",
					file_path: "test/file2.js",
					content: "test content 2",
					start_line: 6,
					end_line: 10,
					type: "function",
					name: "test2",
					fileHash: "hash2",
					segmentHash: "segment-hash-2",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Simulate mixed success/failure
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockResolvedValueOnce(undefined) // Second file succeeds

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			const result = await scanner.scanDirectory("/test")

			// Assert
			expect(mockGraphIndexer.indexFile).toHaveBeenCalledTimes(2)
			expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Neo4j consecutive failures: 1/3"))
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j operation succeeded - resetting consecutive failure counter"),
			)

			// Overall scan should still complete successfully
			expect(result.stats.processed).toBe(2)
			expect(result.totalBlockCount).toBe(2)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
			consoleLogSpy.mockRestore()
		})

		it("should continue vector indexing when Neo4j fails with non-critical errors", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)
			mockGraphIndexer.indexFile.mockRejectedValue(new Error("Temporary network issue"))

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			const result = await scanner.scanDirectory("/test")

			// Assert
			// Vector indexing should continue and succeed
			expect(mockEmbedder.createEmbeddings).toHaveBeenCalled()
			expect(mockVectorStore.upsertPoints).toHaveBeenCalled()

			// Neo4j should fail gracefully
			expect(mockGraphIndexer.indexFile).toHaveBeenCalled()
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j error handled gracefully - continuing with vector indexing"),
			)

			// Overall scan should still complete successfully
			expect(result.stats.processed).toBe(1)
			expect(result.totalBlockCount).toBe(1)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
		})
	})

	describe("Progress Reporting with Circuit Breaker", () => {
		it("should report Neo4j progress correctly during circuit breaker activation", async () => {
			// Arrange
			const mockBlocks = [
				{
					id: "block-1",
					file_path: "test/file1.js",
					content: "test content 1",
					start_line: 1,
					end_line: 5,
					type: "function",
					name: "test1",
					fileHash: "hash1",
					segmentHash: "segment-hash-1",
				},
			]

			mockCodeParser.parseFile.mockResolvedValue(mockBlocks)

			// Trigger circuit breaker
			mockGraphIndexer.indexFile
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))
				.mockRejectedValueOnce(new Error("Connection pool exhausted"))

			// Mock state manager
			const mockStateManager = {
				reportNeo4jIndexingProgress: vi.fn(),
			}

			const scannerWithStateManager = new DirectoryScanner(
				mockEmbedder,
				mockVectorStore,
				mockCodeParser,
				mockCacheManager,
				mockIgnoreInstance,
				undefined, // bm25Index
				50, // batchSegmentThreshold
				mockGraphIndexer,
				mockStateManager,
			)

			// Mock console methods
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			// Act
			await scannerWithStateManager.scanDirectory("/test")

			// Assert
			expect(mockStateManager.reportNeo4jIndexingProgress).toHaveBeenCalledWith(
				expect.any(Number), // processed files
				expect.any(Number), // total files
				"error", // status
				expect.stringContaining("Graph indexing failed"), // message
			)

			consoleErrorSpy.mockRestore()
			consoleWarnSpy.mockRestore()
		})
	})
})
