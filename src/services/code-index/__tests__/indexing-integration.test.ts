// Mock ContextProxy
vi.mock("../../../core/config/ContextProxy")

// Mock embeddingModels module
vi.mock("../../../shared/embeddingModels")

// Mock vscode module - unified mock combining all required behaviors
vi.mock("vscode", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		EventEmitter: vi.fn().mockImplementation(() => ({
			event: vi.fn(),
			fire: vi.fn(),
			dispose: vi.fn(),
		})),
		window: {
			activeTextEditor: null,
			showErrorMessage: vi.fn(),
		},
		workspace: {
			getConfiguration: vi.fn().mockReturnValue({
				get: vi.fn(),
			}),
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
		Uri: {
			file: vi.fn(),
		},
		RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
		commands: {
			executeCommand: vi.fn(),
		},
	}
})

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { CodeIndexManager } from "../manager"
import { CodeIndexServiceFactory } from "../service-factory"
import type { MockedClass } from "vitest"
import * as path from "path"

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vi.fn(),
		},
	},
}))

// Mock i18n
vi.mock("../../i18n", () => ({
	t: (key: string, params?: any) => {
		if (key === "embeddings:orchestrator.failedDuringInitialScan" && params?.errorMessage) {
			return `Failed during initial scan: ${params.errorMessage}`
		}
		return key
	},
}))

vi.mock("../service-factory")
const MockedCodeIndexServiceFactory = CodeIndexServiceFactory as MockedClass<typeof CodeIndexServiceFactory>

describe("CodeIndexingIntegration - Neo4j Error Handling and Recovery", () => {
	let mockContext: any
	let manager: CodeIndexManager
	let mockNeo4jService: any
	let mockVectorStore: any
	let mockScanner: any
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

		// Mock Neo4j service with various failure scenarios
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

		// Mock state manager
		mockStateManager = {
			onProgressUpdate: vi.fn(),
			getCurrentStatus: vi.fn(),
			getComponentStatus: vi.fn(),
			setSystemState: vi.fn(),
			reportBlockIndexingProgress: vi.fn(),
			reportNeo4jIndexingProgress: vi.fn(),
			setNeo4jStatus: vi.fn(),
			setVectorStatus: vi.fn(),
			getNeo4jConsecutiveFailures: vi.fn().mockReturnValue(0),
			resetNeo4jConsecutiveFailures: vi.fn(),
			isSystemDegraded: vi.fn().mockReturnValue(false),
			isSystemFailed: vi.fn().mockReturnValue(false),
			dispose: vi.fn(),
		}

		// Set up the manager with mocked dependencies
		;(manager as any)._stateManager = mockStateManager
	})

	afterEach(() => {
		CodeIndexManager.disposeAll()
		vi.clearAllMocks()
	})

	describe("Scenario 1: Normal Operation - Both Vector and Graph Indexing Work", () => {
		it("should complete indexing successfully with both vector and graph indexing", async () => {
			// Arrange
			mockNeo4jService.isConnected.mockReturnValue(true)
			mockNeo4jService.initialize.mockResolvedValue(undefined)
			mockVectorStore.initialize.mockResolvedValue(false) // No existing data
			mockVectorStore.hasIndexedData.mockResolvedValue(false)
			mockScanner.scanDirectory.mockResolvedValue({
				stats: { processed: 2072, skipped: 0, errors: 0 },
				codeBlocks: [], // Mock code blocks
			})

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
				}),
				validateEmbedder: vi.fn().mockResolvedValue({ valid: true }),
			}

			MockedCodeIndexServiceFactory.mockImplementation(() => mockServiceFactoryInstance as any)

			// Mock context proxy
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
			expect(mockNeo4jService.initialize).toHaveBeenCalled()
			expect(mockVectorStore.initialize).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("idle", "Neo4j graph indexing ready")
			expect(manager.isInitialized).toBe(true)
		})
	})

	describe("Scenario 2: Neo4j Connection Failure - Graceful Degradation", () => {
		it("should degrade gracefully to vector-only indexing when Neo4j fails", async () => {
			// Arrange
			mockNeo4jService.isConnected.mockReturnValue(false)
			mockNeo4jService.initialize.mockRejectedValue(new Error("Neo4j connection failed"))
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)
			mockScanner.scanDirectory.mockResolvedValue({
				stats: { processed: 2072, skipped: 0, errors: 0 },
				codeBlocks: [],
			})

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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
			expect(mockVectorStore.initialize).toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[CodeIndexManager] Neo4j service initialization completed but connection verification failed",
				),
				expect.any(Object),
			)

			// System should still be initialized with vector indexing working
			expect(manager.isInitialized).toBe(true)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Scenario 3: Neo4j Resource Exhaustion - Circuit Breaker Pattern", () => {
		it("should trigger circuit breaker after consecutive failures", async () => {
			// Arrange - simulate multiple consecutive failures
			mockNeo4jService.isConnected.mockReturnValue(false)
			mockNeo4jService.initialize.mockRejectedValue(new Error("Resource exhausted"))
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)

			// Mock state manager to track consecutive failures
			let failureCount = 0
			mockStateManager.getNeo4jConsecutiveFailures.mockImplementation(() => {
				return failureCount
			})
			mockStateManager.setNeo4jStatus.mockImplementation((status: string, message?: string, error?: string) => {
				if (status === "error" || status === "resource-exhausted") {
					failureCount++
				}
			})

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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

			// Act - attempt initialization multiple times to trigger circuit breaker
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockNeo4jService.initialize).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith(
				"error",
				expect.any(String),
				expect.any(String),
			)

			// Verify consecutive failure tracking
			expect(mockStateManager.getNeo4jConsecutiveFailures()).toBeGreaterThan(0)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Scenario 4: Neo4j Recovery - System Recovers When Neo4j Becomes Available", () => {
		it("should recover when Neo4j becomes available again", async () => {
			// Arrange - initial failure
			mockNeo4jService.isConnected.mockReturnValue(false)
			mockNeo4jService.initialize.mockRejectedValueOnce(new Error("Connection failed"))
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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

			// Simulate recovery - Neo4j becomes available
			mockNeo4jService.isConnected.mockReturnValue(true)
			mockNeo4jService.initialize.mockResolvedValueOnce(undefined)

			// Reset and reinitialize to simulate recovery
			CodeIndexManager.disposeAll()
			manager = CodeIndexManager.getInstance(mockContext)!
			;(manager as any)._stateManager = mockStateManager

			// Act again - should recover
			await manager.initialize(mockContextProxy as any)

			// Assert
			expect(mockStateManager.resetNeo4jConsecutiveFailures).toHaveBeenCalled()
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith("idle", "Neo4j graph indexing ready")
		})
	})

	describe("Scenario 5: Mixed Success/Failure - Some Batches Succeed, Others Fail", () => {
		it("should handle mixed batch processing results gracefully", async () => {
			// Arrange
			mockNeo4jService.isConnected.mockReturnValue(true)
			mockNeo4jService.initialize.mockResolvedValue(undefined)
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)

			// Simulate mixed success/failure in batch processing
			mockNeo4jService.upsertNodes.mockImplementation((nodes: any[]) => {
				if (nodes.length > 100) {
					throw new Error("Batch too large")
				}
				return Promise.resolve()
			})

			mockScanner.scanDirectory.mockResolvedValue({
				stats: { processed: 2072, skipped: 0, errors: 0 },
				codeBlocks: Array.from({ length: 2072 }, (_, i) => ({
					id: `block-${i}`,
					filePath: `file-${Math.floor(i / 10)}.js`,
					content: `content ${i}`,
					startLine: (i % 10) + 1,
					endLine: (i % 10) + 5,
					type: "function",
					name: `function-${i}`,
					language: "javascript",
				})),
			})

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Batch too large"), expect.any(Object))

			// System should still be initialized despite some batch failures
			expect(manager.isInitialized).toBe(true)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Scenario 6: Stuck at 757/2072 Blocks - Original Issue Simulation", () => {
		it("should handle the specific scenario that was causing indexing to get stuck", async () => {
			// Arrange - simulate the exact scenario from the original issue
			mockNeo4jService.isConnected.mockReturnValue(true)
			mockNeo4jService.initialize.mockResolvedValue(undefined)
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)

			// Simulate Neo4j operation that hangs or fails at specific point
			let callCount = 0
			mockNeo4jService.upsertNodes.mockImplementation((nodes: any[]) => {
				callCount++
				// Simulate failure after processing 757 blocks
				if (callCount === 8 && nodes.length > 0) {
					// 8th batch, around 757 blocks
					return Promise.reject(new Error("Neo4j resource exhaustion"))
				}
				return Promise.resolve()
			})

			// Mock scanner to return the exact number of blocks from the issue
			mockScanner.scanDirectory.mockResolvedValue({
				stats: { processed: 2072, skipped: 0, errors: 0 },
				codeBlocks: Array.from({ length: 2072 }, (_, i) => ({
					id: `block-${i}`,
					filePath: `file-${Math.floor(i / 10)}.js`,
					content: `content ${i}`,
					startLine: (i % 10) + 1,
					endLine: (i % 10) + 5,
					type: "function",
					name: `function-${i}`,
					language: "javascript",
				})),
			})

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalled()
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("Neo4j resource exhaustion"),
				expect.any(Object),
			)

			// Verify that the error was handled gracefully
			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith(
				"resource-exhausted",
				expect.any(String),
				expect.any(String),
			)

			// System should still be initialized with vector indexing continuing
			expect(manager.isInitialized).toBe(true)

			consoleErrorSpy.mockRestore()
		})
	})

	describe("Error Propagation and Logging", () => {
		it("should properly log and propagate Neo4j errors", async () => {
			// Arrange
			const specificError = new Error("Neo4j authentication failed")
			mockNeo4jService.isConnected.mockReturnValue(false)
			mockNeo4jService.initialize.mockRejectedValue(specificError)
			mockVectorStore.initialize.mockResolvedValue(false)
			mockVectorStore.hasIndexedData.mockResolvedValue(false)

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
				createFileWatcher: vi.fn().mockReturnValue({
					onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
					watch: vi.fn(),
					stopWatcher: vi.fn(),
					dispose: vi.fn(),
				}),
				createServices: vi.fn().mockReturnValue({
					embedder: { embedderInfo: { name: "openai" } },
					vectorStore: mockVectorStore,
					scanner: mockScanner,
					neo4jService: mockNeo4jService,
					fileWatcher: {
						onDidStartBatchProcessing: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						onBatchProgressUpdate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
						watch: vi.fn(),
						stopWatcher: vi.fn(),
						dispose: vi.fn(),
					},
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
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"[CodeIndexManager] Neo4j service initialization completed but connection verification failed",
				),
				expect.objectContaining({
					error: expect.stringContaining("Neo4j authentication failed"),
				}),
			)

			expect(mockStateManager.setNeo4jStatus).toHaveBeenCalledWith(
				"error",
				"Neo4j connection verification failed",
				expect.any(String),
			)

			consoleErrorSpy.mockRestore()
		})
	})
})
