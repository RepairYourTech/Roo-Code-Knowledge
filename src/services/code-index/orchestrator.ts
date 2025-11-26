import * as vscode from "vscode"
import * as path from "path"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager, IndexingState } from "./state-manager"
import { IFileWatcher, IVectorStore, BatchProcessingSummary, IGraphIndexer, INeo4jService } from "./interfaces"
import { DirectoryScanner } from "./processors"
import { Neo4jService } from "./graph/neo4j-service"
import { CacheManager } from "./cache-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { t } from "../../i18n"
import { MetricsCollector } from "./utils/metrics-collector"
import { Logger } from "../../shared/logger"
import {
	PipelineParallelizer,
	EmbeddingParallelizer,
	VectorStoreParallelizer,
	GraphDatabaseParallelizer,
	QueueTask,
	ParallelProcessingConfig,
} from "./utils/pipeline-parallelizer"

/**
 * Custom error class for batch indexing failures with detailed stats
 */
class BatchFailureError extends Error {
	constructor(
		message: string,
		public readonly cumulativeBlocksIndexed: number,
		public readonly cumulativeBlocksFoundSoFar: number,
		public readonly firstErrorMessage: string,
	) {
		super(message)
		this.name = "BatchFailureError"
	}
}

/**
 * Manages the code indexing workflow, coordinating between different services and managers.
 */
export class CodeIndexOrchestrator {
	private _fileWatcherSubscriptions: vscode.Disposable[] = []
	private _isProcessing: boolean = false

	// Pipeline parallelization components
	private embeddingParallelizer: EmbeddingParallelizer
	private vectorStoreParallelizer: VectorStoreParallelizer
	private graphDatabaseParallelizer?: GraphDatabaseParallelizer

	// Metrics collector for enhanced error tracking
	private readonly metricsCollector?: MetricsCollector

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly vectorStore: IVectorStore,
		private readonly scanner: DirectoryScanner,
		private readonly fileWatcher: IFileWatcher,
		private readonly graphIndexer?: IGraphIndexer,
		private readonly neo4jService?: INeo4jService,
		private readonly logger?: Logger,
		private readonly outputChannel?: vscode.OutputChannel,
		metricsCollector?: MetricsCollector,
	) {
		this.log = logger
		this.metricsCollector = metricsCollector

		// Initialize pipeline parallelizers
		this.embeddingParallelizer = new EmbeddingParallelizer({
			maxConcurrency: 3, // Conservative for embedding APIs
			maxQueueSize: 50,
			retryStrategy: "exponential",
			baseRetryDelay: 2000,
			maxRetryDelay: 30000,
		})

		this.vectorStoreParallelizer = new VectorStoreParallelizer({
			maxConcurrency: 8, // Higher for vector stores
			maxQueueSize: 100,
			retryStrategy: "linear",
			baseRetryDelay: 500,
			maxRetryDelay: 5000,
		})

		if (this.graphIndexer && this.neo4jService) {
			this.graphDatabaseParallelizer = new GraphDatabaseParallelizer({
				maxConcurrency: 2, // Conservative for graph operations
				maxQueueSize: 25,
				retryStrategy: "exponential",
				baseRetryDelay: 1000,
				maxRetryDelay: 10000,
				deadlockDetection: true,
				deadlockTimeout: 60000,
			})
		}

		// Set up event handlers for parallelization
		this.setupParallelizationEventHandlers()
	}

	/**
	 * Set up event handlers for pipeline parallelization
	 */
	private setupParallelizationEventHandlers(): void {
		// Set up embedding parallelizer event handlers
		this.embeddingParallelizer.setEventHandlers({
			onTaskComplete: async (task, result) => {
				this.log?.info(`[CodeIndexOrchestrator] Embedding task ${task.id} completed`)
				// Record metrics via manager (if available)
				// Note: This would require access to the manager instance
				// For now, we'll just log the completion
			},
			onTaskError: async (task, error) => {
				this.log?.error(`[CodeIndexOrchestrator] Embedding task ${task.id} failed:`, error)
			},
		})

		// Set up vector store parallelizer event handlers
		this.vectorStoreParallelizer.setEventHandlers({
			onTaskComplete: async (task, result) => {
				this.log?.info(`[CodeIndexOrchestrator] Vector store task ${task.id} completed`)
				// Record metrics via manager (if available)
				// Note: This would require access to the manager instance
				// For now, we'll just log the completion
			},
			onTaskError: async (task, error) => {
				this.log?.error(`[CodeIndexOrchestrator] Vector store task ${task.id} failed:`, error)
			},
		})

		// Set up graph database parallelizer event handlers
		if (this.graphDatabaseParallelizer) {
			this.graphDatabaseParallelizer.setEventHandlers({
				onTaskComplete: async (task, result) => {
					this.log?.info(`[CodeIndexOrchestrator] Graph database task ${task.id} completed`)
					// Record metrics via manager (if available)
					// Note: This would require access to the manager instance
					// For now, we'll just log the completion
				},
				onTaskError: async (task, error) => {
					this.log?.error(`[CodeIndexOrchestrator] Graph database task ${task.id} failed:`, error)
					// Record metrics via manager (if available)
					// Note: This would require access to the manager instance
					// For now, we'll just log the completion
				},
			})
		}
	}

	private log?: Logger

	/**
	 * Cancel any active indexing operation
	 */
	public cancelIndexing(): void {
		this.log?.info("[CodeIndexOrchestrator] Cancelling active indexing operation")

		// Cancel scanner first to prevent new files from being processed
		this.scanner.cancel()

		// Set _isProcessing to false immediately so the UI updates
		// and subsequent operations know indexing is no longer active
		const wasProcessing = this._isProcessing
		this._isProcessing = false

		// If we were processing, ensure any in-progress operations are properly terminated
		if (wasProcessing) {
			this.log?.info("[CodeIndexOrchestrator] Indexing cancelled, clearing processing state")
		}
	}

	/**
	 * Starts the file watcher if not already running.
	 */
	private async _startWatcher(): Promise<void> {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error("Cannot start watcher: Service not configured.")
		}

		this.stateManager.setSystemState("Indexing", "Initializing file watcher...")

		try {
			await this.fileWatcher.initialize()

			this._fileWatcherSubscriptions = [
				this.fileWatcher.onDidStartBatchProcessing((filePaths: string[]) => {}),
				this.fileWatcher.onBatchProgressUpdate(({ processedInBatch, totalInBatch, currentFile }) => {
					if (totalInBatch > 0 && this.stateManager.state !== "Indexing") {
						this.stateManager.setSystemState("Indexing", "Processing file changes...")
					}
					this.stateManager.reportFileQueueProgress(
						processedInBatch,
						totalInBatch,
						currentFile ? path.basename(currentFile) : undefined,
					)
					if (processedInBatch === totalInBatch) {
						// Covers (N/N) and (0/0)
						if (totalInBatch > 0) {
							// Batch with items completed
							this.stateManager.setSystemState("Indexed", "File changes processed. Index up-to-date.")
						} else {
							if (this.stateManager.state === "Indexing") {
								// Only transition if it was "Indexing"
								this.stateManager.setSystemState("Indexed", "Index up-to-date. File queue empty.")
							}
						}
					}
				}),
				this.fileWatcher.onDidFinishBatchProcessing((summary: BatchProcessingSummary) => {
					if (summary.batchError) {
						// Enhanced error handling with state manager updates and categorization
						const errorMessage = summary.batchError.message || String(summary.batchError)
						const errorStack = summary.batchError.stack

						// Enhanced error logging with file-level details
						this.log?.error(`[CodeIndexOrchestrator] Batch processing failed:`, {
							error: errorMessage,
							stack: errorStack,
							filesProcessed: summary.processedFiles.length,
							timestamp: new Date().toISOString(),
							currentState: this.stateManager.state,
						})

						// Record batch error metrics if metrics collector is available
						this.metricsCollector?.recordOperationMetrics("batchProcessingError", 0, false)

						// Categorize the error for better user guidance
						const categorized = this.stateManager.categorizeError(summary.batchError)

						// Count error types in the batch with file-level details
						const errorFiles = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "error" || f.status === "local_error",
						)
						const successFiles = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "success",
						)

						// Log file-level details for debugging
						this.log?.error(`[CodeIndexOrchestrator] Batch processing file-level details:`, {
							successFiles: successFiles.map((f: any) => f.filePath),
							errorFiles: errorFiles.map((f: any) => ({ filePath: f.filePath, error: f.error })),
							totalFiles: summary.processedFiles.length,
						})

						// Determine if this is a critical batch error (affects all files) or partial
						const isCriticalBatchError =
							errorFiles.length === summary.processedFiles.length && summary.processedFiles.length > 0

						// Update state manager based on error severity
						if (isCriticalBatchError) {
							// All files in batch failed - this is critical
							this.stateManager.setVectorStatus(
								"error",
								`Batch processing failed for all ${errorFiles.length} files`,
								categorized.category,
								errorMessage,
								categorized.retrySuggestion,
							)

							// Record critical batch error metrics
							this.metricsCollector?.recordOperationMetrics("criticalBatchError", 0, false)

							// Log telemetry for critical batch failure
							TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
								error: errorMessage,
								stack: errorStack,
								location: "orchestrator:fileWatcher:batchProcessing:critical",
								errorCategory: categorized.category,
								filesAffected: errorFiles.length,
								totalFiles: summary.processedFiles.length,
							})

							// Show user notification for critical failures
							vscode.window
								.showErrorMessage(
									`Batch indexing failed: ${categorized.category}. ${categorized.retrySuggestion}`,
									"Show Output",
								)
								.then((action) => {
									if (action === "Show Output") {
										this.outputChannel?.show()
									}
								})
						} else {
							// Partial batch failure - still report as error but with different message
							this.stateManager.setVectorStatus(
								"error",
								`Batch partially failed: ${errorFiles.length} of ${summary.processedFiles.length} files had errors`,
								categorized.category,
								errorMessage,
								categorized.retrySuggestion,
							)

							// Record partial batch error metrics
							this.metricsCollector?.recordOperationMetrics("partialBatchError", 0, false)

							// Log telemetry for partial batch failure
							TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
								error: errorMessage,
								stack: errorStack,
								location: "orchestrator:fileWatcher:batchProcessing:partial",
								errorCategory: categorized.category,
								filesAffected: errorFiles.length,
								totalFiles: summary.processedFiles.length,
							})
						}
					} else {
						// Success path - log summary statistics
						const successCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "success",
						).length
						const errorCount = summary.processedFiles.filter(
							(f: { status: string }) => f.status === "error" || f.status === "local_error",
						).length

						// Record batch success metrics if metrics collector is available
						if (errorCount === 0) {
							this.metricsCollector?.recordOperationMetrics("batchSuccess", 0, true)
						} else {
							this.metricsCollector?.recordOperationMetrics("batchPartialSuccess", 0, true)
						}

						// Log batch completion with stats
						if (errorCount > 0) {
							this.log?.error(`[CodeIndexOrchestrator] Batch completed with errors:`, {
								success: successCount,
								errors: errorCount,
								total: summary.processedFiles.length,
							})
						} else {
							this.log?.info(`[CodeIndexOrchestrator] Batch completed successfully:`, {
								success: successCount,
								total: summary.processedFiles.length,
							})
						}
					}
				}),
			]
		} catch (error) {
			this.log?.error("[CodeIndexOrchestrator] Failed to start file watcher:", error)
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "_startWatcher",
			})
			throw error
		}
	}

	/**
	 * Updates the status of a file in the state manager.
	 */

	/**
	 * Initiates the indexing process (initial scan and starts watcher).
	 */
	public async startIndexing(): Promise<void> {
		// Check if workspace is available first
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			this.stateManager.setSystemState("Error", t("embeddings:orchestrator.indexingRequiresWorkspace"))
			this.log?.info("[CodeIndexOrchestrator] Start rejected: No workspace folder open.")
			return
		}

		if (!this.configManager.isFeatureConfigured) {
			this.stateManager.setSystemState("Standby", "Missing configuration. Save your settings to start indexing.")
			this.log?.info("[CodeIndexOrchestrator] Start rejected: Missing configuration.")
			return
		}

		if (
			this._isProcessing ||
			(this.stateManager.state !== "Standby" &&
				this.stateManager.state !== "Error" &&
				this.stateManager.state !== "Indexed")
		) {
			this.log?.info(
				`[CodeIndexOrchestrator] Start rejected: Already processing or in state ${this.stateManager.state}.`,
			)
			return
		}

		// Reset cancellation flag before starting
		this.scanner.resetCancellation()

		this._isProcessing = true
		this.stateManager.setSystemState("Indexing", "Initializing services...")

		this.log?.info(`[CodeIndexOrchestrator] Starting indexing for workspace: ${this.workspacePath}`)

		// Track whether we successfully connected to Qdrant and started indexing
		// This helps us decide whether to preserve cache on error
		let indexingStarted = false

		try {
			const collectionCreated = await this.vectorStore.initialize()

			// Successfully connected to Qdrant
			indexingStarted = true

			if (collectionCreated) {
				await this.cacheManager.clearCacheFile()
			}

			// Check if the collection already has indexed data
			// If it does, we can skip the full scan and just start the watcher
			const hasExistingData = await this.vectorStore.hasIndexedData()

			if (hasExistingData && !collectionCreated) {
				// Collection exists with data - run incremental scan to catch any new/changed files
				// This handles files added while workspace was closed or Qdrant was inactive
				this.log?.info(
					"[CodeIndexOrchestrator] Collection already has indexed data. Running incremental scan for new/changed files...",
				)
				this.stateManager.setSystemState("Indexing", "Checking for new or modified files...")

				// Mark as incomplete at the start of incremental scan
				await this.vectorStore.markIndexingIncomplete()

				let cumulativeBlocksIndexed = 0
				let cumulativeBlocksFoundSoFar = 0
				let batchErrors: Error[] = []

				const handleFileParsed = (fileBlockCount: number) => {
					cumulativeBlocksFoundSoFar += fileBlockCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const handleBlocksIndexed = (indexedCount: number) => {
					cumulativeBlocksIndexed += indexedCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				// Run incremental scan - scanner will skip unchanged files using cache
				const result = await this.scanner.scanDirectory(
					this.workspacePath,
					(batchError: Error) => {
						// Enhanced error logging with detailed context
						this.log?.error(
							`[CodeIndexOrchestrator] Error during incremental scan batch: ${batchError.message}`,
							{
								error: batchError.message,
								stack: batchError.stack,
								timestamp: new Date().toISOString(),
								currentState: this.stateManager.state,
								cumulativeBlocksIndexed,
								cumulativeBlocksFoundSoFar,
							},
						)

						// Record error metrics if metrics collector is available
						this.metricsCollector?.recordOperationMetrics("incrementalScanError", 0, false)

						batchErrors.push(batchError)
					},
					handleBlocksIndexed,
					handleFileParsed,
				)

				if (!result) {
					throw new Error("Incremental scan failed, is scanner initialized?")
				}

				// Report file discovery metrics
				this.stateManager.reportFileDiscoveryMetrics(
					result.filesDiscovered,
					result.filesDiscovered - result.filesAfterRooignore,
					result.filesAfterRooignore - result.filesAfterExtensionFilter,
					result.filesSkippedBySize,
					result.filesSkippedByCache,
					result.filesProcessed,
				)

				this.log?.info(`[CodeIndexOrchestrator] Incremental scan completed:
					Files processed: ${result.stats.processed}
					Files skipped: ${result.stats.skipped}
					Files discovered: ${result.filesDiscovered}
					Files filtered by .rooignore: ${result.filesDiscovered - result.filesAfterRooignore}
					Files filtered by extension: ${result.filesAfterRooignore - result.filesAfterExtensionFilter}
					Blocks indexed: ${cumulativeBlocksIndexed}
					Blocks found so far: ${cumulativeBlocksFoundSoFar}
				`)

				// If new files were found and indexed, log the results
				if (cumulativeBlocksFoundSoFar > 0) {
					this.log?.info(
						`[CodeIndexOrchestrator] Incremental scan completed: ${cumulativeBlocksIndexed} blocks indexed from new/changed files`,
					)
				} else {
					this.log?.info("[CodeIndexOrchestrator] No new or changed files found")
				}

				await this._startWatcher()

				// Mark indexing as complete after successful incremental scan
				await this.vectorStore.markIndexingComplete()

				this.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))
			} else {
				// No existing data or collection was just created - do a full scan
				this.stateManager.setSystemState("Indexing", "Services ready. Starting workspace scan...")
				this.log?.info("[CodeIndexOrchestrator] Starting full workspace scan...")

				// Mark as incomplete at the start of full scan
				await this.vectorStore.markIndexingIncomplete()

				let cumulativeBlocksIndexed = 0
				let cumulativeBlocksFoundSoFar = 0
				let batchErrors: Error[] = []

				const handleFileParsed = (fileBlockCount: number) => {
					cumulativeBlocksFoundSoFar += fileBlockCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const handleBlocksIndexed = (indexedCount: number) => {
					cumulativeBlocksIndexed += indexedCount
					this.stateManager.reportBlockIndexingProgress(cumulativeBlocksIndexed, cumulativeBlocksFoundSoFar)
				}

				const result = await this.scanner.scanDirectory(
					this.workspacePath,
					(batchError: Error) => {
						// Enhanced error logging with detailed context
						this.log?.error(
							`[CodeIndexOrchestrator] Error during initial scan batch: ${batchError.message}`,
							{
								error: batchError.message,
								stack: batchError.stack,
								timestamp: new Date().toISOString(),
								currentState: this.stateManager.state,
								cumulativeBlocksIndexed,
								cumulativeBlocksFoundSoFar,
							},
						)

						// Record error metrics if metrics collector is available
						this.metricsCollector?.recordOperationMetrics("initialScanError", 0, false)

						batchErrors.push(batchError)
					},
					handleBlocksIndexed,
					handleFileParsed,
				)

				if (!result) {
					throw new Error("Scan failed, is scanner initialized?")
				}

				const { stats } = result

				// Report file discovery metrics
				this.stateManager.reportFileDiscoveryMetrics(
					result.filesDiscovered,
					result.filesDiscovered - result.filesAfterRooignore,
					result.filesAfterRooignore - result.filesAfterExtensionFilter,
					result.filesSkippedBySize,
					result.filesSkippedByCache,
					result.filesProcessed,
				)

				this.log?.info(`[CodeIndexOrchestrator] Full scan completed:
					Files processed: ${stats.processed}
					Files skipped: ${stats.skipped}
					Files discovered: ${result.filesDiscovered}
					Files filtered by .rooignore: ${result.filesDiscovered - result.filesAfterRooignore}
					Files filtered by extension: ${result.filesAfterRooignore - result.filesAfterExtensionFilter}
					Blocks indexed: ${cumulativeBlocksIndexed}
					Blocks found so far: ${cumulativeBlocksFoundSoFar}
				`)

				// Check if any blocks were actually indexed successfully
				// If no blocks were indexed but blocks were found, it means all batches failed
				if (cumulativeBlocksIndexed === 0 && cumulativeBlocksFoundSoFar > 0) {
					if (batchErrors.length > 0) {
						// Use the first batch error as it's likely representative of the main issue
						const firstError = batchErrors[0]
						throw new BatchFailureError(
							`Indexing failed: ${firstError.message}`,
							cumulativeBlocksIndexed,
							cumulativeBlocksFoundSoFar,
							firstError.message,
						)
					} else {
						throw new Error(t("embeddings:orchestrator.indexingFailedNoBlocks"))
					}
				}

				// Check for partial failures - if a significant portion of blocks failed
				const failureRate = (cumulativeBlocksFoundSoFar - cumulativeBlocksIndexed) / cumulativeBlocksFoundSoFar
				if (batchErrors.length > 0 && failureRate > 0.1) {
					// More than 10% of blocks failed to index
					const firstError = batchErrors[0]
					throw new BatchFailureError(
						`Indexing partially failed: Only ${cumulativeBlocksIndexed} of ${cumulativeBlocksFoundSoFar} blocks were indexed. ${firstError.message}`,
						cumulativeBlocksIndexed,
						cumulativeBlocksFoundSoFar,
						firstError.message,
					)
				}

				// CRITICAL: If there were ANY batch errors and NO blocks were successfully indexed,
				// this is a complete failure regardless of the failure rate calculation
				if (batchErrors.length > 0 && cumulativeBlocksIndexed === 0) {
					const firstError = batchErrors[0]
					throw new BatchFailureError(
						`Indexing failed completely: ${firstError.message}`,
						cumulativeBlocksIndexed,
						cumulativeBlocksFoundSoFar,
						firstError.message,
					)
				}

				// Final sanity check: If we found blocks but indexed none and somehow no errors were reported,
				// this is still a failure
				if (cumulativeBlocksFoundSoFar > 0 && cumulativeBlocksIndexed === 0) {
					throw new Error(t("embeddings:orchestrator.indexingFailedCritical"))
				}

				await this._startWatcher()

				// Mark indexing as complete after successful full scan
				await this.vectorStore.markIndexingComplete()

				this.stateManager.setSystemState("Indexed", t("embeddings:orchestrator.fileWatcherStarted"))
			}
		} catch (error: any) {
			// Enhanced error logging with more context
			this.log?.error("[CodeIndexOrchestrator] Error during indexing:", {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				timestamp: new Date().toISOString(),
				currentState: this.stateManager.state,
				indexingStarted,
				workspacePath: this.workspacePath,
			})

			// Record error metrics if metrics collector is available
			this.metricsCollector?.recordOperationMetrics("indexingError", 0, false)

			// Get categorized error information from state manager
			const componentStatus = this.stateManager.getComponentStatus()
			const categorizedError = this.stateManager.categorizeError(error)

			// Log categorized error information
			this.log?.info("[CodeIndexOrchestrator] Categorized error information:", {
				category: categorizedError.category,
				retrySuggestion: categorizedError.retrySuggestion,
				componentStatus,
			})

			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "startIndexing",
				errorCategory: categorizedError.category,
				componentStatus,
			})

			// Show user-facing error notification with targeted guidance
			const errorMessage = error instanceof Error ? error.message : String(error)
			let notificationMessage: string
			let errorCategory: string
			let retrySuggestion: string

			// Check if this is a batch failure error with detailed stats
			if (error instanceof BatchFailureError) {
				notificationMessage = `Indexing failed: ${error.cumulativeBlocksIndexed} of ${error.cumulativeBlocksFoundSoFar} code blocks were indexed. ${error.firstErrorMessage}. This may be due to API rate limits, network issues, or configuration problems.`
				// Categorize batch failure errors
				const categorized = this.stateManager.categorizeError(error.firstErrorMessage)
				errorCategory = categorized.category
				retrySuggestion = categorized.retrySuggestion
			} else {
				// Use state manager's categorizeError for other errors
				const categorized = this.stateManager.categorizeError(error)
				errorCategory = categorized.category
				retrySuggestion = categorized.retrySuggestion

				// Build notification message based on error type
				if (errorMessage.toLowerCase().includes("qdrant") || errorMessage.toLowerCase().includes("vector")) {
					notificationMessage =
						"Failed to initialize vector store. Please verify Qdrant is running and accessible."
				} else if (
					errorMessage.toLowerCase().includes("neo4j") ||
					errorMessage.toLowerCase().includes("graph")
				) {
					notificationMessage =
						"Failed to initialize graph database. Please verify Neo4j connection settings."
				} else if (
					errorMessage.toLowerCase().includes("embedding") ||
					errorMessage.toLowerCase().includes("api")
				) {
					notificationMessage =
						"Failed to initialize embedding provider. Please verify your API key and configuration."
				} else {
					notificationMessage = `Indexing failed to start: ${errorMessage}. Check the Output panel for details.`
				}
			}

			// Set vector error status with categorization
			this.stateManager.setVectorStatus(
				"error",
				errorMessage,
				errorCategory as any,
				errorMessage,
				retrySuggestion,
			)

			const action = await vscode.window.showErrorMessage(notificationMessage, "Show Output")
			if (action === "Show Output") {
				this.outputChannel?.show()
			}

			if (indexingStarted) {
				try {
					await this.vectorStore.clearCollection()
				} catch (cleanupError) {
					this.log?.error("[CodeIndexOrchestrator] Failed to clean up after error:", cleanupError)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
						stack: cleanupError instanceof Error ? cleanupError.stack : undefined,
						location: "startIndexing.cleanup",
					})
				}
			}

			// Only clear cache if indexing had started (Qdrant connection succeeded)
			// If we never connected to Qdrant, preserve cache for future incremental scan when it comes back
			if (indexingStarted) {
				// Indexing started but failed mid-way - clear cache to avoid cache-Qdrant mismatch
				await this.cacheManager.clearCacheFile()
				this.log?.info(
					"[CodeIndexOrchestrator] Indexing failed after starting. Clearing cache to avoid inconsistency.",
				)
			} else {
				// Never connected to Qdrant - preserve cache for future incremental scan
				this.log?.info(
					"[CodeIndexOrchestrator] Failed to connect to Qdrant. Preserving cache for future incremental scan.",
				)
			}

			this.stateManager.setSystemState(
				"Error",
				t("embeddings:orchestrator.failedDuringInitialScan", {
					errorMessage: error.message || t("embeddings:orchestrator.unknownError"),
				}),
			)
			this.stopWatcher()
		} finally {
			this._isProcessing = false
		}
	}
	/**
	 * Stops the file watcher and cleans up resources.
	 */
	public stopWatcher(): void {
		this.fileWatcher.dispose()
		this._fileWatcherSubscriptions.forEach((sub) => sub.dispose())
		this._fileWatcherSubscriptions = []

		if (this.stateManager.state !== "Error") {
			this.stateManager.setSystemState("Standby", t("embeddings:orchestrator.fileWatcherStopped"))
		}
		this._isProcessing = false
	}

	/**
	 * Dispose of the orchestrator and clean up parallelizers
	 */
	public dispose(): void {
		this.log?.info("[CodeIndexOrchestrator] Disposing orchestrator and cleaning up parallelizers")

		// Shutdown parallelizers
		this.embeddingParallelizer?.shutdown()
		this.vectorStoreParallelizer?.shutdown()
		this.graphDatabaseParallelizer?.shutdown()

		// Stop file watcher
		this.stopWatcher()
	}

	/**
	 * Clears all index data by stopping the watcher, clearing the vector store,
	 * clearing the Neo4j graph (if enabled), and resetting the cache file.
	 *
	 * IMPORTANT: This clears BOTH Qdrant AND Neo4j (if enabled).
	 * Neo4j depends on Qdrant data, so they must be cleared together.
	 */
	public async clearIndexData(): Promise<void> {
		this._isProcessing = true

		const errors: string[] = []

		try {
			await this.stopWatcher()

			// Clear Qdrant vector store
			try {
				if (this.configManager.isFeatureConfigured) {
					await this.vectorStore.deleteCollection()
					this.log?.info("[CodeIndexOrchestrator] Qdrant collection deleted successfully")
				} else {
					this.log?.info("[CodeIndexOrchestrator] Service not configured, skipping vector collection clear.")
				}
			} catch (error: any) {
				const errorMsg = `Failed to clear Qdrant collection: ${error.message}`
				errors.push(errorMsg)
				this.log?.error("[CodeIndexOrchestrator]", errorMsg, error)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					location: "clearIndexData:qdrant",
				})

				// Report categorized error to state manager
				const categorized = this.stateManager.categorizeError(error)
				this.stateManager.setVectorStatus(
					"error",
					errorMsg,
					categorized.category,
					errorMsg,
					categorized.retrySuggestion,
				)
			}

			// Clear Neo4j graph database if enabled or if service is available
			this.log?.info(`[CodeIndexOrchestrator] Neo4j clearing check: neo4jService=${!!this.neo4jService}`)

			if (this.neo4jService) {
				this.log?.info("[CodeIndexOrchestrator] Starting Neo4j graph database clear...")
				try {
					await this.neo4jService.clearAll()
					this.log?.info("[CodeIndexOrchestrator] Neo4j graph database cleared successfully")
				} catch (error: any) {
					const errorMsg = `Failed to clear Neo4j graph: ${error.message}`
					errors.push(errorMsg)
					this.log?.error("[CodeIndexOrchestrator]", errorMsg, error)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						location: "clearIndexData:neo4j",
					})

					// Report categorized error to state manager
					const categorized = this.stateManager.categorizeError(error)
					this.stateManager.setNeo4jStatus(
						"error",
						"Neo4j clear failed",
						errorMsg,
						categorized.category,
						categorized.retrySuggestion,
					)
				}
			} else {
				// Fallback: Try to create a temporary service if config exists
				// This handles the case where the user disabled Neo4j but wants to delete the index
				const neo4jConfig = {
					enabled: true, // Force enable for this operation
					url: this.configManager.neo4jConfig.url || "",
					username: this.configManager.neo4jConfig.username || "",
					password: this.configManager.neo4jConfig.password || "",
					database: "neo4j", // Default
				}

				if (neo4jConfig.url && neo4jConfig.username) {
					this.log?.info(
						"[CodeIndexOrchestrator] Neo4j service not active, creating temporary connection for clearing...",
					)
					const tempService = new Neo4jService(neo4jConfig)
					try {
						await tempService.initialize()
						if (tempService.isConnected()) {
							await tempService.clearAll()
							this.log?.info(
								"[CodeIndexOrchestrator] Neo4j graph database cleared successfully (temp connection)",
							)
						}
					} catch (error: any) {
						const errorMsg = `Failed to clear Neo4j graph (temp connection): ${error.message}`
						errors.push(errorMsg)
						this.log?.error("[CodeIndexOrchestrator]", errorMsg, error)

						// Report categorized error to state manager
						const categorized = this.stateManager.categorizeError(error)
						this.stateManager.setNeo4jStatus(
							"error",
							"Neo4j clear failed",
							errorMsg,
							categorized.category,
							categorized.retrySuggestion,
						)
					} finally {
						await tempService.close()
					}
				}
			}

			// Clear cache file
			await this.cacheManager.clearCacheFile()

			// Reset Neo4j status to idle after clearing
			this.stateManager.setNeo4jStatus("idle", "")

			// Set final state based on whether errors occurred
			if (errors.length > 0) {
				this.stateManager.setSystemState("Error", `Index data partially cleared. Errors: ${errors.join("; ")}`)
			} else {
				this.stateManager.setSystemState("Standby", "Index data cleared successfully.")
			}
		} finally {
			this._isProcessing = false
		}
	}

	/**
	 * Gets the current state of the indexing system.
	 */
	public get state(): IndexingState {
		return this.stateManager.state
	}
}
