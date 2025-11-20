import * as vscode from "vscode"
import { ContextProxy } from "../../core/config/ContextProxy"
import { VectorStoreSearchResult } from "./interfaces"
import { IndexingState } from "./interfaces/manager"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { CodeIndexServiceFactory } from "./service-factory"
import { CodeIndexSearchService } from "./search-service"
import { HybridSearchService } from "./hybrid-search-service"
import { CodeIndexOrchestrator } from "./orchestrator"
import { BM25IndexService } from "./bm25/bm25-index"
import { CacheManager } from "./cache-manager"
import { SearchOrchestrator } from "./query/search-orchestrator"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import fs from "fs/promises"
import ignore from "ignore"
import path from "path"
import { t } from "../../i18n"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

export class CodeIndexManager {
	// --- Singleton Implementation ---
	private static instances = new Map<string, CodeIndexManager>() // Map workspace path to instance

	// Specialized class instances
	private _configManager: CodeIndexConfigManager | undefined
	private readonly _stateManager: CodeIndexStateManager
	private _serviceFactory: CodeIndexServiceFactory | undefined
	private _orchestrator: CodeIndexOrchestrator | undefined
	private _searchService: CodeIndexSearchService | undefined
	private _hybridSearchService: HybridSearchService | undefined
	private _searchOrchestrator: SearchOrchestrator | undefined // Phase 7: Intelligent search routing
	private _bm25Index: BM25IndexService | undefined
	private _cacheManager: CacheManager | undefined
	private _neo4jService: any | undefined // INeo4jService - track for cleanup

	// Flag to prevent race conditions during error recovery
	private _isRecoveringFromError = false

	public static getInstance(context: vscode.ExtensionContext, workspacePath?: string): CodeIndexManager | undefined {
		// If workspacePath is not provided, try to get it from the active editor or first workspace folder
		if (!workspacePath) {
			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
				workspacePath = workspaceFolder?.uri.fsPath
			}

			if (!workspacePath) {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (!workspaceFolders || workspaceFolders.length === 0) {
					return undefined
				}
				// Use the first workspace folder as fallback
				workspacePath = workspaceFolders[0].uri.fsPath
			}
		}

		if (!CodeIndexManager.instances.has(workspacePath)) {
			CodeIndexManager.instances.set(workspacePath, new CodeIndexManager(workspacePath, context))
		}
		return CodeIndexManager.instances.get(workspacePath)!
	}

	public static disposeAll(): void {
		for (const instance of CodeIndexManager.instances.values()) {
			instance.dispose()
		}
		CodeIndexManager.instances.clear()
	}

	private readonly workspacePath: string
	private readonly context: vscode.ExtensionContext

	// Private constructor for singleton pattern
	private constructor(workspacePath: string, context: vscode.ExtensionContext) {
		this.workspacePath = workspacePath
		this.context = context
		this._stateManager = new CodeIndexStateManager()
	}

	// --- Public API ---

	public get onProgressUpdate() {
		return this._stateManager.onProgressUpdate
	}

	private assertInitialized() {
		if (!this._configManager || !this._orchestrator || !this._hybridSearchService || !this._cacheManager) {
			throw new Error("CodeIndexManager not initialized. Call initialize() first.")
		}
	}

	public get state(): IndexingState {
		if (!this.isFeatureEnabled) {
			return "Standby"
		}
		this.assertInitialized()
		return this._orchestrator!.state
	}

	public get isFeatureEnabled(): boolean {
		return this._configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this._configManager?.isFeatureConfigured ?? false
	}

	public get isInitialized(): boolean {
		try {
			this.assertInitialized()
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * Initializes the manager with configuration and dependent services.
	 * Must be called before using any other methods.
	 * @returns Object indicating if a restart is needed
	 */
	public async initialize(contextProxy: ContextProxy): Promise<{ requiresRestart: boolean }> {
		// 1. ConfigManager Initialization and Configuration Loading
		if (!this._configManager) {
			this._configManager = new CodeIndexConfigManager(contextProxy)
		}
		// Load configuration once to get current state and restart requirements
		const { requiresRestart } = await this._configManager.loadConfiguration()

		// 2. Check if feature is enabled
		if (!this.isFeatureEnabled) {
			if (this._orchestrator) {
				// Cancel any active indexing operation
				this._orchestrator.cancelIndexing()
				this._orchestrator.stopWatcher()
			}
			// Close Neo4j connection when indexing is disabled
			if (this._neo4jService) {
				try {
					await this._neo4jService.close()
					console.log("[CodeIndexManager] Neo4j connection closed (indexing disabled)")
					this._neo4jService = undefined
				} catch (error) {
					console.error("[CodeIndexManager] Error closing Neo4j connection:", error)
				}
			}
			return { requiresRestart }
		}

		// 3. Initialize Neo4j status based on configuration
		if (this._configManager.isNeo4jEnabled) {
			this._stateManager.setNeo4jStatus("idle", "Neo4j graph indexing enabled")
		} else {
			this._stateManager.setNeo4jStatus("disabled", "")
		}

		// 4. Check if workspace is available
		const workspacePath = this.workspacePath
		if (!workspacePath) {
			this._stateManager.setSystemState("Standby", "No workspace folder open")
			return { requiresRestart }
		}

		// 4. CacheManager Initialization
		if (!this._cacheManager) {
			this._cacheManager = new CacheManager(this.context, this.workspacePath)
			await this._cacheManager.initialize()
		}

		// 4. Determine if Core Services Need Recreation
		const needsServiceRecreation = !this._serviceFactory || requiresRestart

		if (needsServiceRecreation) {
			await this._recreateServices()
		}

		// 5. Handle Indexing Start/Restart
		// The enhanced vectorStore.initialize() in startIndexing() now handles dimension changes automatically
		// by detecting incompatible collections and recreating them, so we rely on that for dimension changes
		const shouldStartOrRestartIndexing =
			requiresRestart ||
			(needsServiceRecreation && (!this._orchestrator || this._orchestrator.state !== "Indexing"))

		if (shouldStartOrRestartIndexing) {
			this._orchestrator?.startIndexing() // This method is async, but we don't await it here
		}

		return { requiresRestart }
	}

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 * Automatically recovers from error state if needed before starting.
	 *
	 * @important This method should NEVER be awaited as it starts a long-running background process.
	 * The indexing will continue asynchronously and progress will be reported through events.
	 */
	public async startIndexing(): Promise<void> {
		if (!this.isFeatureEnabled) {
			return
		}

		// Check if we're in error state and recover if needed
		const currentStatus = this.getCurrentStatus()
		if (currentStatus.systemStatus === "Error") {
			await this.recoverFromError()

			// After recovery, we need to reinitialize since recoverFromError clears all services
			// This will be handled by the caller (webviewMessageHandler) checking isInitialized
			return
		}

		this.assertInitialized()
		await this._orchestrator!.startIndexing()
	}

	/**
	 * Cancels any active indexing operation and sets state back to Standby
	 */
	public cancelIndexing(): void {
		if (!this._orchestrator) {
			return
		}

		console.log("[CodeIndexManager] Cancelling indexing operation")
		this._orchestrator.cancelIndexing()
		this._stateManager.setSystemState("Standby", "Indexing cancelled by user")
	}

	/**
	 * Stops the file watcher and potentially cleans up resources.
	 */
	public stopWatcher(): void {
		if (!this.isFeatureEnabled) {
			return
		}
		if (this._orchestrator) {
			this._orchestrator.stopWatcher()
		}
	}

	/**
	 * Recovers from error state by clearing the error and resetting internal state.
	 * This allows the manager to be re-initialized after a recoverable error.
	 *
	 * This method clears all service instances (configManager, serviceFactory, orchestrator, searchService)
	 * to force a complete re-initialization on the next operation. This ensures a clean slate
	 * after recovering from errors such as network failures or configuration issues.
	 *
	 * @remarks
	 * - Safe to call even when not in error state (idempotent)
	 * - Does not restart indexing automatically - call initialize() after recovery
	 * - Service instances will be recreated on next initialize() call
	 * - Prevents race conditions from multiple concurrent recovery attempts
	 */
	public async recoverFromError(): Promise<void> {
		// Prevent race conditions from multiple rapid recovery attempts
		if (this._isRecoveringFromError) {
			return
		}

		this._isRecoveringFromError = true
		try {
			// Clear error state
			this._stateManager.setSystemState("Standby", "")
		} catch (error) {
			// Log error but continue with recovery - clearing service instances is more important
			console.error("Failed to clear error state during recovery:", error)
		} finally {
			// Force re-initialization by clearing service instances
			// This ensures a clean slate even if state update failed
			this._configManager = undefined
			this._serviceFactory = undefined
			this._orchestrator = undefined
			this._searchService = undefined

			// Reset the flag after recovery is complete
			this._isRecoveringFromError = false
		}
	}

	/**
	 * Cleans up the manager instance.
	 */
	public dispose(): void {
		if (this._orchestrator) {
			this.stopWatcher()
		}
		// Close Neo4j connection on dispose
		if (this._neo4jService) {
			this._neo4jService
				.close()
				.then(() => {
					console.log("[CodeIndexManager] Neo4j connection closed (dispose)")
					this._neo4jService = undefined
				})
				.catch((error: any) => {
					console.error("[CodeIndexManager] Error closing Neo4j connection on dispose:", error)
				})
		}
		this._stateManager.dispose()
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the Qdrant collection,
	 * clearing the Neo4j graph (if enabled), and deleting the cache file.
	 *
	 * IMPORTANT: This can be called even when indexing is disabled, to allow users
	 * to clean up old index data. It will clear BOTH Qdrant AND Neo4j (if enabled).
	 */
	public async clearIndexData(): Promise<void> {
		// Allow clearing even when feature is disabled - users should be able to clean up old data
		// But we need the orchestrator to be initialized
		if (!this._orchestrator) {
			// If orchestrator doesn't exist, we can't clear Qdrant/Neo4j, but we can clear cache
			if (this._cacheManager) {
				await this._cacheManager.clearCacheFile()
			}
			return
		}

		await this._orchestrator.clearIndexData()
		// Note: orchestrator.clearIndexData() already clears cache, but call it again to be safe
		if (this._cacheManager) {
			await this._cacheManager.clearCacheFile()
		}
	}

	// --- Private Helpers ---

	public getCurrentStatus() {
		const status = this._stateManager.getCurrentStatus()
		return {
			...status,
			workspacePath: this.workspacePath,
		}
	}

	public async searchIndex(query: string, directoryPrefix?: string): Promise<VectorStoreSearchResult[]> {
		if (!this.isFeatureEnabled) {
			return []
		}
		this.assertInitialized()

		// Phase 7: Use intelligent search orchestrator if available
		if (this._searchOrchestrator) {
			const results = await this._searchOrchestrator.search(query, {
				directoryPrefix,
				maxResults: this._configManager!.currentSearchMaxResults,
				minScore: this._configManager!.currentSearchMinScore,
			})
			// Return results without orchestration metadata for backward compatibility
			return results
		}

		// Fallback to hybrid search if orchestrator not available
		return this._hybridSearchService!.searchIndex(query, directoryPrefix)
	}

	/**
	 * Private helper method to recreate services with current configuration.
	 * Used by both initialize() and handleSettingsChange().
	 */
	private async _recreateServices(): Promise<void> {
		// Stop watcher if it exists
		if (this._orchestrator) {
			this.stopWatcher()
		}
		// Clear existing services to ensure clean state
		this._orchestrator = undefined
		this._searchService = undefined
		this._hybridSearchService = undefined
		this._bm25Index = undefined

		// (Re)Initialize service factory
		this._serviceFactory = new CodeIndexServiceFactory(
			this._configManager!,
			this.workspacePath,
			this._cacheManager!,
		)

		const ignoreInstance = ignore()
		const workspacePath = this.workspacePath

		if (!workspacePath) {
			this._stateManager.setSystemState("Standby", "")
			return
		}

		// Create .gitignore instance
		const ignorePath = path.join(workspacePath, ".gitignore")
		try {
			const content = await fs.readFile(ignorePath, "utf8")
			ignoreInstance.add(content)
			ignoreInstance.add(".gitignore")
		} catch (error) {
			// Should never happen: reading file failed even though it exists
			console.error("Unexpected error loading .gitignore:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_recreateServices",
			})
		}

		// Create RooIgnoreController instance
		const rooIgnoreController = new RooIgnoreController(workspacePath)
		await rooIgnoreController.initialize()

		// (Re)Initialize BM25 index BEFORE creating services
		this._bm25Index = new BM25IndexService()

		// (Re)Create shared service instances
		const { embedder, vectorStore, scanner, fileWatcher, neo4jService, graphIndexer, lspService } =
			this._serviceFactory.createServices(
				this.context,
				this._cacheManager!,
				ignoreInstance,
				rooIgnoreController,
				this._bm25Index,
				this._stateManager, // Pass state manager for Neo4j progress tracking
			)

		// Initialize Neo4j if enabled
		if (neo4jService) {
			try {
				await neo4jService.initialize()
				console.log("[CodeIndexManager] Neo4j service initialized successfully")
				// Track neo4jService for cleanup
				this._neo4jService = neo4jService
			} catch (error) {
				console.error("[CodeIndexManager] Failed to initialize Neo4j:", error)
				// Don't fail initialization if Neo4j connection fails
			}
		}

		// Validate embedder configuration before proceeding
		const validationResult = await this._serviceFactory.validateEmbedder(embedder)
		if (!validationResult.valid) {
			const errorMessage = validationResult.error || "Embedder configuration validation failed"
			this._stateManager.setSystemState("Error", errorMessage)
			throw new Error(errorMessage)
		}

		// (Re)Initialize orchestrator
		this._orchestrator = new CodeIndexOrchestrator(
			this._configManager!,
			this._stateManager,
			this.workspacePath,
			this._cacheManager!,
			vectorStore,
			scanner,
			fileWatcher,
			graphIndexer,
			neo4jService,
		)

		// (Re)Initialize search service (keep for backward compatibility)
		this._searchService = new CodeIndexSearchService(
			this._configManager!,
			this._stateManager,
			embedder,
			vectorStore,
		)

		// (Re)Initialize hybrid search service
		this._hybridSearchService = new HybridSearchService(
			this._configManager!,
			this._stateManager,
			embedder,
			vectorStore,
			this._bm25Index,
		)

		// Phase 7: (Re)Initialize search orchestrator for intelligent query routing
		this._searchOrchestrator = this._serviceFactory.createSearchOrchestrator(
			this._hybridSearchService,
			neo4jService,
			lspService,
		)

		// Clear any error state after successful recreation
		this._stateManager.setSystemState("Standby", "")
	}

	/**
	 * Handle code index settings changes.
	 * This method should be called when code index settings are updated
	 * to ensure the CodeIndexConfigManager picks up the new configuration.
	 * If the configuration changes require a restart, the service will be restarted.
	 */
	public async handleSettingsChange(): Promise<void> {
		if (this._configManager) {
			const { requiresRestart } = await this._configManager.loadConfiguration()

			const isFeatureEnabled = this.isFeatureEnabled
			const isFeatureConfigured = this.isFeatureConfigured

			// If feature is disabled, stop the service
			if (!isFeatureEnabled) {
				// Stop the orchestrator if it exists
				if (this._orchestrator) {
					// Cancel any active indexing operation
					this._orchestrator.cancelIndexing()
					this._orchestrator.stopWatcher()
				}
				// Close Neo4j connection when indexing is disabled
				if (this._neo4jService) {
					try {
						await this._neo4jService.close()
						console.log("[CodeIndexManager] Neo4j connection closed (indexing disabled via settings)")
						this._neo4jService = undefined
					} catch (error) {
						console.error("[CodeIndexManager] Error closing Neo4j connection:", error)
					}
				}
				// Set state to indicate service is disabled
				this._stateManager.setSystemState("Standby", "Code indexing is disabled")
				return
			}

			if (requiresRestart && isFeatureEnabled && isFeatureConfigured) {
				try {
					// Ensure cacheManager is initialized before recreating services
					if (!this._cacheManager) {
						this._cacheManager = new CacheManager(this.context, this.workspacePath)
						await this._cacheManager.initialize()
					}

					// Recreate services with new configuration
					await this._recreateServices()
				} catch (error) {
					// Error state already set in _recreateServices
					console.error("Failed to recreate services:", error)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						location: "handleSettingsChange",
					})
					// Re-throw the error so the caller knows validation failed
					throw error
				}
			}
		}
	}
}
