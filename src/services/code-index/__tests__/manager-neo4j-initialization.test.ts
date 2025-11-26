import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { CodeIndexManager } from "../manager"
import { CodeIndexServiceFactory } from "../service-factory"
import type { MockedClass } from "vitest"
import * as path from "path"

// Mock vscode module
vi.mock("vscode", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		window: {
			activeTextEditor: null,
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: testWorkspacePath },
					name: "test",
					index: 0,
				},
			],
			createFileSystemWatcher: vi.fn().mockReturnValue({
				onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
				dispose: vi.fn(),
			}),
		},
		RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
	}
})

// Mock only the essential dependencies
vi.mock("../../../utils/path", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		getWorkspacePath: vi.fn(() => testWorkspacePath),
	}
})

// Mock fs/promises for RooIgnoreController
vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn().mockRejectedValue(new Error("File not found")), // Simulate no .gitignore/.rooignore
	},
}))

// Mock file utils for RooIgnoreController
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false), // Simulate no .rooignore file
}))

// Mock ignore module
vi.mock("ignore", () => ({
	default: vi.fn().mockReturnValue({
		add: vi.fn(),
		ignores: vi.fn().mockReturnValue(false),
	}),
}))

vi.mock("../state-manager", () => ({
	CodeIndexStateManager: vi.fn().mockImplementation(() => ({
		onProgressUpdate: vi.fn(),
		getCurrentStatus: vi.fn(),
		dispose: vi.fn(),
		setSystemState: vi.fn(),
		setNeo4jStatus: vi.fn(),
		getComponentStatus: vi.fn(),
		reportNeo4jIndexingProgress: vi.fn(),
		getNeo4jConsecutiveFailures: vi.fn().mockReturnValue(0),
		resetNeo4jConsecutiveFailures: vi.fn(),
		isSystemDegraded: vi.fn().mockReturnValue(false),
		isSystemFailed: vi.fn().mockReturnValue(false),
	})),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

vi.mock("../service-factory")
const MockedCodeIndexServiceFactory = CodeIndexServiceFactory as MockedClass<typeof CodeIndexServiceFactory>

describe("CodeIndexManager - Neo4j Initialization and Error Handling", () => {
	let mockContext: any
	let manager: CodeIndexManager
	let mockNeo4jService: any
	let mockVectorStore: any
	let mockScanner: any
	let mockFileWatcher: any
	let mockStateManager: any

	// Define test paths
	const testWorkspacePath = path.join(path.sep, "test", "workspace")
	const testExtensionPath = path.join(path.sep, "test", "extension")
	const testStoragePath = path.join(path.sep, "test", "storage")

	beforeEach(() => {
		// Clear all instances before each test
		CodeIndexManager.disposeAll()

		mockContext = {
			subscriptions: [],
			workspaceState: {} as any,
			globalState: {} as any,
			extensionUri: {} as any,
			extensionPath: testExtensionPath,
			asAbsolutePath: vi.fn(),
			storageUri: {} as any,
			storagePath: testStoragePath,
			globalStorageUri: {} as any,
			globalStoragePath: testStoragePath,
			logUri: {} as any,
			logPath: testStoragePath,
			extensionMode: 3, // vscode.ExtensionMode.Test
			secrets: {} as any,
			environmentVariableCollection: {} as any,
			extension: {} as any,
			languageModelAccessInformation: {} as any,
		}

		manager = CodeIndexManager.getInstance(mockContext)!

		// Mock Neo4j service
		mockNeo4jService = {
			isConnected: vi.fn(),
			initialize: vi.fn(),
			close: vi.fn(),
			upsertNodes: vi.fn(),
			createRelationships: vi.fn(),
			deleteNodesByFilePath: vi.fn(),
			clearAll: vi.fn(),
			getStats: vi.fn(),
		}

		// Mock vector store
		mockVectorStore = {
			initialize: vi.fn(),
			hasIndexedData: vi.fn(),
			markIndexingIncomplete: vi.fn(),
			markIndexingComplete: vi.fn(),
			clearCollection: vi.fn(),
			upsertPoints: vi.fn(),
			deletePointsByFilePath: vi.fn(),
			deletePointsByMultipleFilePaths: vi.fn(),
		}

		// Mock scanner
		mockScanner = {
			scanDirectory: vi.fn(),
		}

		// Mock file watcher
		mockFileWatcher = {
			initialize: vi.fn().mockResolvedValue(undefined),
			onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
			watch: vi.fn(),
			stopWatcher: vi.fn(),
			dispose: vi.fn(),
		}

		// Mock state manager
		mockStateManager = {
			onProgressUpdate: vi.fn(),
			getCurrentStatus: vi.fn(),
			getComponentStatus: vi.fn(),
			setSystemState: vi.fn(),
			setNeo4jStatus: vi.fn(),
			reportNeo4jIndexingProgress: vi.fn(),
			getNeo4jConsecutiveFailures: vi.fn().mockReturnValue(0),
			resetNeo4jConsecutiveFailures: vi.fn(),
			isSystemDegraded: vi.fn().mockReturnValue(false),
			isSystemFailed: vi.fn().mockReturnValue(false),
		}
	})

	afterEach(() => {
		CodeIndexManager.disposeAll()
		vi.clearAllMocks()
	})

	describe("Neo4j Service Initialization", () => {
		it("should initialize Neo4j service when enabled and configuration is valid", async () => {
			// Arrange
			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Act
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockServiceFactoryInstance.createNeo4jService).toHaveBeenCalled()
			expect(mockNeo4jService.initialize).toHaveBeenCalled()
			expect(mockNeo4jService.isConnected).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("idle", "Neo4j graph indexing ready")
			expect(manager.isInitialized).toBe(true)
		})

		it("should handle Neo4j initialization failure gracefully", async () => {
			// Arrange
			mockNeo4jService.initialize.mockRejectedValue(new Error("Neo4j connection failed"))
			mockNeo4jService.isConnected.mockReturnValue(false)

			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Mock console.error to capture error logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockNeo4jService.initialize).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("error", expect.any(String))
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith(
				"error",
				"Neo4j connection verification failed",
				expect.any(String),
			)

			// System should still initialize with vector indexing
			expect(mockVectorStore.initialize).toHaveBeenCalled()
			expect(manager.isInitialized).toBe(true)

			consoleErrorSpy.mockRestore()
		})

		it("should skip Neo4j initialization when disabled", async () => {
			// Arrange
			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: false, // Disabled
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: false, // Disabled
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Mock console.log to capture logging
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockServiceFactoryInstance.createNeo4jService).not.toHaveBeenCalled()
			expect(mockNeo4jService.initialize).not.toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("disabled", "Neo4j graph indexing is disabled")
			expect(manager.isInitialized).toBe(true)

			consoleLogSpy.mockRestore()
		})

		it("should handle Neo4j connection verification failure", async () => {
			// Arrange - initialization succeeds but connection verification fails
			mockNeo4jService.initialize.mockResolvedValue(undefined)
			mockNeo4jService.isConnected.mockReturnValue(false)

			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Mock console.error to capture error logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockNeo4jService.initialize).toHaveBeenCalled()
			expect(mockNeo4jService.isConnected).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith(
				"error",
				"Neo4j connection verification failed",
			)
			expect(manager.isInitialized).toBe(true)

			consoleErrorSpy.mockRestore()
		})

		it("should report telemetry for Neo4j initialization failures", async () => {
			// Arrange
			const specificError = new Error("Neo4j authentication failed")
			mockNeo4jService.initialize.mockRejectedValue(specificError)
			mockNeo4jService.isConnected.mockReturnValue(false)

			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Mock console.error and telemetry
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			const telemetrySpy = vi.spyOn(require("@roo-code/telemetry").TelemetryService.instance, "captureEvent")

			// Act
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[CodeIndexManager] Neo4j service initialization completed but connection verification failed",
				),
				expect.any(Object),
			)

			expect(telemetrySpy).toHaveBeenCalledWith(
				"CODE_INDEX_ERROR",
				expect.objectContaining({
					error: expect.stringContaining("Neo4j connection verification failed"),
					location: "_recreateServices:neo4jInitialization",
					errorType: "connection_verification_failed",
				}),
			)

			consoleErrorSpy.mockRestore()
			telemetrySpy.mockRestore()
		})
	})

	describe("Neo4j Service Cleanup", () => {
		it("should close Neo4j connection when indexing is disabled", async () => {
			// Arrange
			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: false, // Disabled
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: false, // Disabled
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// First initialize to create Neo4j service
			await manager.initialize(mockContextProxy as any)
			// Should not have called initialize since Neo4j is disabled
			expect(mockNeo4jService.initialize).toHaveBeenCalledTimes(0)

			// Mock console.log to capture cleanup logging
			const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			// Act - trigger settings change to disable indexing
			await manager.handleSettingsChange()

			// Assert
			expect(mockNeo4jService.close).toHaveBeenCalled()
			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[CodeIndexManager] Neo4j connection closed (indexing disabled)"),
			)

			consoleLogSpy.mockRestore()
		})

		it("should handle Neo4j close errors gracefully", async () => {
			// Arrange
			const closeError = new Error("Neo4j close failed")
			mockNeo4jService.close.mockRejectedValue(closeError)

			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: false, // Disabled
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: false, // Disabled
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// First initialize to create Neo4j service
			await manager.initialize(mockContextProxy as any)

			// Mock console.error to capture error logging
			const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			// Act - trigger settings change to disable indexing
			await manager.handleSettingsChange()

			// Assert
			expect(mockNeo4jService.close).toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[CodeIndexManager] Error closing Neo4j connection:"),
				closeError,
			)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Neo4j Error Recovery", () => {
		it("should recover from Neo4j errors when settings are reconfigured", async () => {
			// Arrange - initial failure
			mockNeo4jService.initialize.mockRejectedValueOnce(new Error("Connection failed"))
			mockNeo4jService.isConnected.mockReturnValueOnce(false)

			const mockServiceFactoryInstance = {
				configManager: {
					isFeatureConfigured: true,
					isFeatureEnabled: true,
					getConfig: vi.fn().mockReturnValue({
						isConfigured: true,
						embedderProvider: "openai",
						modelId: "text-embedding-3-small",
						openAiOptions: { openAiNativeApiKey: "test-key" },
						qdrantUrl: "http://localhost:6333",
						qdrantApiKey: "test-key",
						searchMinScore: 0.4,
						neo4jEnabled: true,
						neo4jUrl: "bolt://localhost:7687",
						neo4jUsername: "neo4j",
						neo4jPassword: "password",
						neo4jDatabase: "neo4j",
					}),
				},
				workspacePath: testWorkspacePath,
				cacheManager: {
					initialize: vi.fn().mockResolvedValue(undefined),
					clearCacheFile: vi.fn().mockResolvedValue(undefined),
				},
				createEmbedder: vi.fn().mockReturnValue({ embedderInfo: { name: "openai" } }),
				createVectorStore: vi.fn().mockReturnValue(mockVectorStore),
				createNeo4jService: vi.fn().mockReturnValue(mockNeo4jService),
				createDirectoryScanner: vi.fn().mockReturnValue(mockScanner),
				createFileWatcher: vi.fn().mockReturnValue(mockFileWatcher),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: mockFileWatcher,
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			const mockContextProxy = {
				getValue: vi.fn(),
				setValue: vi.fn(),
				storeSecret: vi.fn(),
				getSecret: vi.fn(),
				refreshSecrets: vi.fn().mockResolvedValue(undefined),
				getGlobalState: vi.fn().mockReturnValue({
					codebaseIndexEnabled: true,
					codebaseIndexQdrantUrl: "http://localhost:6333",
					codebaseIndexEmbedderProvider: "openai",
					codebaseIndexEmbedderModelId: "text-embedding-3-small",
					codebaseIndexEmbedderModelDimension: 1536,
					codebaseIndexSearchMaxResults: 10,
					codebaseIndexSearchMinScore: 0.4,
					codebaseIndexNeo4jEnabled: true,
					codebaseIndexNeo4jUrl: "bolt://localhost:7687",
					codebaseIndexNeo4jUsername: "neo4j",
					codebaseIndexNeo4jPassword: "password",
					codebaseIndexNeo4jDatabase: "neo4j",
				}),
			}

			// Act - initial initialization (should fail)
			await manager.initialize(mockContextProxy as any)

			// Verify initial failure
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("error", expect.any(String))

			// Now simulate recovery - Neo4j becomes available
			mockNeo4jService.initialize.mockResolvedValueOnce(undefined)
			mockNeo4jService.isConnected.mockReturnValueOnce(true)

			// Reset and reinitialize to simulate recovery
			CodeIndexManager.disposeAll()

			// Mock CodeIndexManager getInstance method for this test
			const getInstanceSpy = vi.spyOn(CodeIndexManager, "getInstance").mockReturnValue(mockStateManager as any)

			manager = CodeIndexManager.getInstance(mockContext)!

			// Act again - should recover
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("idle", "Neo4j graph indexing ready")
			expect(manager.isInitialized).toBe(true)
		})
	})
})
