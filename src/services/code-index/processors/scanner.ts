import { listFiles } from "../../glob/list-files"
import { Ignore } from "ignore"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { stat } from "fs/promises"
import * as path from "path"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "../shared/get-relative-path"
import { getWorkspacePathForContext } from "../../../utils/path"
import { scannerExtensions } from "../shared/supported-extensions"
import * as vscode from "vscode"
import {
	CodeBlock,
	ICodeParser,
	IEmbedder,
	IVectorStore,
	IDirectoryScanner,
	IBM25Index,
	BM25Document,
	IGraphIndexer,
} from "../interfaces"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CacheManager } from "../cache-manager"
import { t } from "../../../i18n"
import { buildEmbeddingContext, EnhancedCodeSegment } from "../types/metadata"
import { createOutputChannelLogger, type LogFunction } from "../../../utils/outputChannelLogger"

// Per-file mutex map for Neo4j file indexing operations to prevent race conditions
// This allows concurrent indexing of different files while preventing concurrent indexing of the same file
const fileMutexMap = new Map<string, Mutex>()

// Track which file is holding which mutex for deadlock detection
const mutexHolders = new Map<string, string>()
// Track which file is waiting for which mutex
const mutexWaiters = new Map<string, Set<string>>()

// Circuit breaker pattern for Neo4j operations - module level state shared across all scanner instances
const circuitBreakerState = {
	connectionErrors: {
		consecutiveFailures: 0,
		lastFailureTime: 0,
		isOpen: false,
	},
	transactionErrors: {
		consecutiveFailures: 0,
		lastFailureTime: 0,
		isOpen: false,
	},
	deadlockErrors: {
		consecutiveFailures: 0,
		lastFailureTime: 0,
		isOpen: false,
	},
}

// Track active Neo4j transactions across all batches
let activeNeo4jTransactions = 0

import {
	MAX_CONCURRENT_TRANSACTIONS,
	MUTEX_TIMEOUT_MS,
	DEADLOCK_DETECTION_ENABLED,
	DEADLOCK_RETRY_DELAY_MS,
	MAX_DEADLOCK_RETRIES,
	TRANSACTION_TIMEOUT_MS,
	MAX_BATCH_RETRIES,
	INITIAL_RETRY_DELAY_MS,
} from "../constants"
import { isPathInIgnoredDirectory } from "../../glob/ignore-utils"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
import { Package } from "../../../shared/package"

// Additional constants needed for scanner functionality
const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const QDRANT_CODE_BLOCK_NAMESPACE = uuidv5("code-blocks", DNS_NAMESPACE)
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 10 // 10MB
const MAX_LIST_FILES_LIMIT_CODE_INDEX = 10000
const BATCH_SEGMENT_THRESHOLD = 100
const PARSING_CONCURRENCY = 4
const BATCH_PROCESSING_CONCURRENCY = 2
const MAX_PENDING_BATCHES = 5

export class DirectoryScanner implements IDirectoryScanner {
	private readonly batchSegmentThreshold: number
	// Track cumulative Neo4j progress across all batches
	private neo4jCumulativeFilesProcessed: number = 0
	private neo4jTotalFilesToProcess: number = 0
	// Cancellation support
	private _cancelled: boolean = false

	/**
	 * Get or create a mutex for a specific file
	 * @param filePath The file path to get a mutex for
	 * @returns The mutex for the file
	 */
	private getFileMutex(filePath: string): Mutex {
		if (!fileMutexMap.has(filePath)) {
			fileMutexMap.set(filePath, new Mutex())
		}
		return fileMutexMap.get(filePath)!
	}

	/**
	 * Clean up a mutex for a file after processing is complete
	 * @param filePath The file path to clean up the mutex for
	 */
	private cleanupFileMutex(filePath: string): void {
		fileMutexMap.delete(filePath)
		mutexHolders.delete(filePath)
		mutexWaiters.delete(filePath)
	}

	/**
	 * Detect deadlock conditions between files
	 * @param waitingFile The file waiting for a mutex
	 * @param holdingFile The file holding the mutex
	 * @returns True if a deadlock is detected
	 */
	private detectDeadlock(waitingFile: string, holdingFile: string): boolean {
		if (!DEADLOCK_DETECTION_ENABLED) {
			return false
		}

		// Track the waiting relationship
		if (!mutexWaiters.has(holdingFile)) {
			mutexWaiters.set(holdingFile, new Set())
		}
		mutexWaiters.get(holdingFile)!.add(waitingFile)

		// Check for circular dependency (deadlock)
		const visited = new Set<string>()
		const recursionStack = new Set<string>()

		const hasCycle = (file: string): boolean => {
			if (recursionStack.has(file)) {
				return true // Cycle detected
			}
			if (visited.has(file)) {
				return false
			}

			visited.add(file)
			recursionStack.add(file)

			const waiters = mutexWaiters.get(file)
			if (waiters) {
				for (const waiter of waiters) {
					if (hasCycle(waiter)) {
						return true
					}
				}
			}

			recursionStack.delete(file)
			return false
		}

		return hasCycle(waitingFile)
	}

	/**
	 * Break a deadlock by releasing the mutex of the specified file
	 * @param filePath The file whose mutex should be released
	 */
	private breakDeadlock(filePath: string): void {
		this.log(`[DirectoryScanner] Breaking deadlock for file: ${filePath}`)
		const mutex = fileMutexMap.get(filePath)
		if (mutex) {
			// Force cleanup of the mutex
			this.cleanupFileMutex(filePath)
			fileMutexMap.set(filePath, new Mutex())
		}
	}

	/**
	 * Wait for available Neo4j transaction slot
	 */
	private async waitForTransactionSlot(): Promise<void> {
		while (activeNeo4jTransactions >= MAX_CONCURRENT_TRANSACTIONS) {
			this.log(
				`[DirectoryScanner] Waiting for Neo4j transaction slot (${activeNeo4jTransactions}/${MAX_CONCURRENT_TRANSACTIONS} active)`,
			)
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
	}

	/**
	 * Safely increment active transaction counter with mutex protection
	 */
	private async incrementActiveTransactions(): Promise<void> {
		const mutex = this.getFileMutex("activeTransactions")
		const release = await mutex.acquire()
		try {
			if (activeNeo4jTransactions < 0) {
				this.log(
					`[DirectoryScanner] Active transactions counter was negative (${activeNeo4jTransactions}), resetting to 0`,
				)
				activeNeo4jTransactions = 0
			}
			activeNeo4jTransactions++
		} finally {
			release()
		}
	}

	/**
	 * Safely decrement active transaction counter with mutex protection
	 */
	private async decrementActiveTransactions(): Promise<void> {
		const mutex = this.getFileMutex("activeTransactions")
		const release = await mutex.acquire()
		try {
			activeNeo4jTransactions--
			if (activeNeo4jTransactions < 0) {
				this.log(
					`[DirectoryScanner] Active transactions counter went negative (${activeNeo4jTransactions}), clamping to 0`,
				)
				activeNeo4jTransactions = 0
			}
		} finally {
			release()
		}
	}

	/**
	 * Check if circuit breaker is open for a specific error type
	 * @param errorType The type of error to check
	 * @returns True if circuit breaker is open
	 */
	private isCircuitBreakerOpen(errorType: "connectionErrors" | "transactionErrors" | "deadlockErrors"): boolean {
		const state = circuitBreakerState[errorType]
		const now = Date.now()

		// Check if circuit breaker should be reset (5 minute timeout)
		if (state.isOpen && now - state.lastFailureTime > 5 * 60 * 1000) {
			this.log(`[DirectoryScanner] Circuit breaker reset for ${errorType}`)
			state.consecutiveFailures = 0
			state.isOpen = false
			return false
		}

		return state.isOpen
	}

	/**
	 * Update circuit breaker state after an error
	 * @param errorType The type of error
	 */
	private updateCircuitBreaker(errorType: "connectionErrors" | "transactionErrors" | "deadlockErrors"): void {
		const state = circuitBreakerState[errorType]
		state.consecutiveFailures++
		state.lastFailureTime = Date.now()

		if (state.consecutiveFailures >= 3) {
			this.log(
				`[DirectoryScanner] Circuit breaker opened for ${errorType} (${state.consecutiveFailures} consecutive failures)`,
			)
			state.isOpen = true
		}
	}

	/**
	 * Reset circuit breaker state after successful operation
	 * @param errorType The type of error to reset
	 */
	private resetCircuitBreaker(errorType: "connectionErrors" | "transactionErrors" | "deadlockErrors"): void {
		const state = circuitBreakerState[errorType]
		if (state.consecutiveFailures > 0) {
			this.log(`[DirectoryScanner] Circuit breaker reset for ${errorType} after successful operation`)
			state.consecutiveFailures = 0
			state.isOpen = false
		}
	}

	/**
	 * Topologically sort files based on import dependencies
	 * @param blocksByFile Map of file paths to their blocks
	 * @returns Array of file paths in dependency order
	 */
	private topologicalSortFiles(blocksByFile: Map<string, CodeBlock[]>): string[] {
		const files = Array.from(blocksByFile.keys())
		const dependencies = new Map<string, Set<string>>()

		// Build dependency graph
		for (const [filePath, blocks] of blocksByFile) {
			const deps = new Set<string>()
			for (const block of blocks) {
				if (block.imports) {
					for (const importInfo of block.imports) {
						// Try to resolve import path to actual file path
						const resolvedPath = this.resolveImportPath(importInfo.source, filePath)
						if (resolvedPath && blocksByFile.has(resolvedPath)) {
							deps.add(resolvedPath)
						}
					}
				}
			}
			dependencies.set(filePath, deps)
		}

		// Topological sort (Kahn's algorithm)
		const inDegree = new Map<string, number>()
		const queue: string[] = []
		const result: string[] = []

		// Initialize in-degrees
		for (const file of files) {
			inDegree.set(file, 0)
		}

		// Calculate in-degrees
		for (const [file, deps] of dependencies) {
			for (const dep of deps) {
				inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
			}
		}

		// Find nodes with no incoming edges
		for (const [file, degree] of inDegree) {
			if (degree === 0) {
				queue.push(file)
			}
		}

		// Process queue
		while (queue.length > 0) {
			const current = queue.shift()!
			result.push(current)

			const deps = dependencies.get(current)
			if (deps) {
				for (const dep of deps) {
					const newDegree = (inDegree.get(dep) || 0) - 1
					inDegree.set(dep, newDegree)
					if (newDegree === 0) {
						queue.push(dep)
					}
				}
			}
		}

		// If there are remaining nodes (cycle), add them in any order
		if (result.length < files.length) {
			this.log("[DirectoryScanner] Circular dependency detected, processing remaining files in arbitrary order")
			for (const file of files) {
				if (!result.includes(file)) {
					result.push(file)
				}
			}
		}

		return result
	}

	/**
	 * Resolve import path to actual file path
	 * @param importPath The import path from the file
	 * @param currentFilePath The current file path
	 * @returns Resolved file path or null if not found
	 */
	private resolveImportPath(importPath: string, currentFilePath: string): string | null {
		// Simple implementation - could be enhanced with more sophisticated resolution
		if (importPath.startsWith("./") || importPath.startsWith("../")) {
			const dir = path.dirname(currentFilePath)
			const resolved = path.resolve(dir, importPath)
			// Try common extensions
			for (const ext of [".ts", ".tsx", ".js", ".jsx", ".py", ".java"]) {
				const withExt = resolved + ext
				if (fileMutexMap.has(withExt)) {
					return withExt
				}
			}
		}
		return null
	}

	constructor(
		private readonly embedder: IEmbedder,
		private readonly qdrantClient: IVectorStore,
		private readonly codeParser: ICodeParser,
		private readonly cacheManager: CacheManager,
		private readonly ignoreInstance: Ignore,
		private readonly bm25Index?: IBM25Index,
		batchSegmentThreshold?: number,
		private readonly graphIndexer?: IGraphIndexer,
		private readonly stateManager?: any, // CodeIndexStateManager - optional for backward compatibility
		private readonly outputChannel?: vscode.OutputChannel,
	) {
		this.log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}
		// Get the configurable batch size from VSCode settings, fallback to default
		// If not provided in constructor, try to get from VSCode settings
		if (batchSegmentThreshold !== undefined) {
			this.batchSegmentThreshold = batchSegmentThreshold
		} else {
			try {
				this.batchSegmentThreshold = vscode.workspace
					.getConfiguration(Package.name)
					.get<number>("codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD)
			} catch {
				// In test environment, vscode.workspace might not be available
				this.batchSegmentThreshold = BATCH_SEGMENT_THRESHOLD
			}
		}
	}

	private readonly log: LogFunction

	/**
	 * Cancel the current indexing operation
	 */
	public cancel(): void {
		this._cancelled = true
		this.log("[DirectoryScanner] Indexing cancelled by user")
	}

	/**
	 * Reset the cancellation flag (call before starting a new scan)
	 */
	public resetCancellation(): void {
		this._cancelled = false
	}

	/**
	 * Recursively scans a directory for code blocks in supported files.
	 * @param directoryPath The directory to scan
	 * @param rooIgnoreController Optional RooIgnoreController instance for filtering
	 * @param context VS Code ExtensionContext for cache storage
	 * @param onError Optional error handler callback
	 * @returns Promise<{codeBlocks: CodeBlock[], stats: {processed: number, skipped: number}}> Array of parsed code blocks and processing stats
	 */
	public async scanDirectory(
		directory: string,
		onError?: (error: Error) => void,
		onBlocksIndexed?: (indexedCount: number) => void,
		onFileParsed?: (fileBlockCount: number) => void,
	): Promise<{ stats: { processed: number; skipped: number }; totalBlockCount: number }> {
		const directoryPath = directory
		// Capture workspace context at scan start
		const scanWorkspace = getWorkspacePathForContext(directoryPath)

		// Check for cancellation before starting
		if (this._cancelled) {
			this.log("[DirectoryScanner] Scan aborted - cancelled before start")
			throw new Error("Indexing cancelled by user")
		}

		// Get all files recursively (handles .gitignore automatically)
		const [allPaths, _] = await listFiles(directoryPath, true, MAX_LIST_FILES_LIMIT_CODE_INDEX)

		// Filter out directories (marked with trailing '/')
		const filePaths = allPaths.filter((p) => !p.endsWith("/"))

		// Initialize RooIgnoreController if not provided
		const ignoreController = new RooIgnoreController(directoryPath)

		await ignoreController.initialize()

		// Filter paths using .rooignore
		const allowedPaths = ignoreController.filterPaths(filePaths)

		// Filter by supported extensions, ignore patterns, and excluded directories
		const supportedPaths = allowedPaths.filter((filePath) => {
			const ext = path.extname(filePath).toLowerCase()
			const relativeFilePath = generateRelativeFilePath(filePath, scanWorkspace)

			// Check if file is in an ignored directory using the shared helper
			if (isPathInIgnoredDirectory(filePath)) {
				return false
			}

			return scannerExtensions.includes(ext) && !this.ignoreInstance.ignores(relativeFilePath)
		})

		// Initialize tracking variables
		const processedFiles = new Set<string>()
		let processedCount = 0
		let skippedCount = 0

		// Reset Neo4j cumulative counters at the start of each scan
		this.neo4jCumulativeFilesProcessed = 0
		this.neo4jTotalFilesToProcess = 0

		// Initialize parallel processing tools
		const parseLimiter = pLimit(PARSING_CONCURRENCY) // Concurrency for file parsing
		const batchLimiter = pLimit(BATCH_PROCESSING_CONCURRENCY) // Concurrency for batch processing
		const mutex = new Mutex()

		// Shared batch accumulators (protected by mutex)
		let currentBatchBlocks: CodeBlock[] = []
		let currentBatchTexts: string[] = []
		let currentBatchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[] = []
		const activeBatchPromises = new Set<Promise<void>>()
		let pendingBatchCount = 0

		// Initialize block counter
		let totalBlockCount = 0

		// Process all files in parallel with concurrency control
		const parsePromises = supportedPaths.map((filePath) =>
			parseLimiter(async () => {
				// Check for cancellation before processing each file
				if (this._cancelled) {
					throw new Error("Indexing cancelled by user")
				}

				try {
					// Check file size
					const stats = await stat(filePath)
					if (stats.size > MAX_FILE_SIZE_BYTES) {
						skippedCount++ // Skip large files
						return
					}

					// Check for cancellation before reading file
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// Read file content
					const content = await vscode.workspace.fs
						.readFile(vscode.Uri.file(filePath))
						.then((buffer) => Buffer.from(buffer).toString("utf-8"))

					// Check for cancellation after reading file
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// Calculate current hash
					const currentFileHash = createHash("sha256").update(content).digest("hex")
					processedFiles.add(filePath)

					// Check against cache
					const cachedFileHash = this.cacheManager.getHash(filePath)
					const isNewFile = !cachedFileHash
					if (cachedFileHash === currentFileHash) {
						// File is unchanged
						skippedCount++
						return
					}

					// Check for cancellation before parsing
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// File is new or changed - parse it using the injected parser function
					const blocks = await this.codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
					const fileBlockCount = blocks.length
					onFileParsed?.(fileBlockCount)
					processedCount++

					// Check for cancellation after parsing
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// Process embeddings if configured
					if (this.embedder && this.qdrantClient && blocks.length > 0) {
						let addedBlocksFromFile = false
						for (const block of blocks) {
							const trimmedContent = block.content.trim()
							if (trimmedContent) {
								currentBatchBlocks.push(block)
								currentBatchTexts.push(trimmedContent)
								addedBlocksFromFile = true
							}
						}

						// Add file info once per file (outside the block loop)
						if (addedBlocksFromFile) {
							totalBlockCount += fileBlockCount
							currentBatchFileInfos.push({
								filePath,
								fileHash: currentFileHash,
								isNew: isNewFile,
							})

							// Check if batch threshold is met AFTER adding all blocks for this file
							// This ensures a file is never split across batches
							if (currentBatchBlocks.length >= this.batchSegmentThreshold) {
								// Check for cancellation before processing batch
								if (this._cancelled) {
									throw new Error("Indexing cancelled by user")
								}

								// Wait if we've reached the maximum pending batches
								while (pendingBatchCount >= MAX_PENDING_BATCHES) {
									// Check for cancellation while waiting
									if (this._cancelled) {
										throw new Error("Indexing cancelled by user")
									}
									// Wait for at least one batch to complete
									await Promise.race(activeBatchPromises)
								}

								// Copy current batch data and clear accumulators
								const batchBlocks = [...currentBatchBlocks]
								const batchTexts = [...currentBatchTexts]
								const batchFileInfos = [...currentBatchFileInfos]
								currentBatchBlocks = []
								currentBatchTexts = []
								currentBatchFileInfos = []

								// Increment pending batch count
								pendingBatchCount++

								// Queue batch processing
								const batchPromise = batchLimiter(() =>
									this.processBatch(
										batchBlocks,
										batchTexts,
										batchFileInfos,
										scanWorkspace,
										onError,
										onBlocksIndexed,
									),
								)
								activeBatchPromises.add(batchPromise)

								// Clean up completed promises to prevent memory accumulation
								batchPromise.finally(() => {
									activeBatchPromises.delete(batchPromise)
									pendingBatchCount--
								})
							}
						}
					} else {
						// Only update hash if not being processed in a batch
						await this.cacheManager.updateHash(filePath, currentFileHash)
					}
				} catch (error) {
					this.log(`Error processing file ${filePath} in workspace ${scanWorkspace}:`, error)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
						stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
						location: "scanDirectory:processFile",
					})
					if (onError) {
						onError(
							error instanceof Error
								? new Error(`${error.message} (Workspace: ${scanWorkspace}, File: ${filePath})`)
								: new Error(
										t("embeddings:scanner.unknownErrorProcessingFile", { filePath }) +
											` (Workspace: ${scanWorkspace})`,
									),
						)
					}
				}
			}),
		)

		// Wait for all parsing to complete
		try {
			await Promise.all(parsePromises)
		} catch (error) {
			// If cancelled, propagate the error
			if (error instanceof Error && error.message === "Indexing cancelled by user") {
				this.log("[DirectoryScanner] File parsing cancelled by user")
				throw error
			}
			// Otherwise, let the error propagate normally
			throw error
		}

		// Check for cancellation before processing final batch
		if (this._cancelled) {
			this.log("[DirectoryScanner] Scan aborted - cancelled before final batch")
			throw new Error("Indexing cancelled by user")
		}

		// Process any remaining items in batch
		if (currentBatchBlocks.length > 0) {
			const release = await mutex.acquire()
			try {
				// Check for cancellation before final batch
				if (this._cancelled) {
					release()
					throw new Error("Indexing cancelled by user")
				}

				// Copy current batch data and clear accumulators
				const batchBlocks = [...currentBatchBlocks]
				const batchTexts = [...currentBatchTexts]
				const batchFileInfos = [...currentBatchFileInfos]
				currentBatchBlocks = []
				currentBatchTexts = []
				currentBatchFileInfos = []

				// Increment pending batch count for final batch
				pendingBatchCount++

				// Queue final batch processing
				const batchPromise = batchLimiter(() =>
					this.processBatch(batchBlocks, batchTexts, batchFileInfos, scanWorkspace, onError, onBlocksIndexed),
				)
				activeBatchPromises.add(batchPromise)

				// Clean up completed promises to prevent memory accumulation
				batchPromise.finally(() => {
					activeBatchPromises.delete(batchPromise)
					pendingBatchCount--
				})
			} finally {
				release()
			}
		}

		// Wait for all batch processing to complete
		try {
			await Promise.all(activeBatchPromises)
		} catch (error) {
			// If cancelled, propagate the error
			if (error instanceof Error && error.message === "Indexing cancelled by user") {
				this.log("[DirectoryScanner] Batch processing cancelled by user")
				throw error
			}
			// Otherwise, let the error propagate normally
			throw error
		}

		// Report final Neo4j status after all batches complete
		if (this.graphIndexer && this.stateManager && this.neo4jTotalFilesToProcess > 0) {
			this.stateManager.reportNeo4jIndexingProgress(
				this.neo4jCumulativeFilesProcessed,
				this.neo4jTotalFilesToProcess,
				"indexed",
				`Graph index complete: ${this.neo4jCumulativeFilesProcessed} files indexed`,
			)
		}

		// Handle deleted files
		const oldHashes = this.cacheManager.getAllHashes()
		for (const cachedFilePath of Object.keys(oldHashes)) {
			if (!processedFiles.has(cachedFilePath)) {
				// File was deleted or is no longer supported/indexed
				if (this.qdrantClient) {
					try {
						await this.qdrantClient.deletePointsByFilePath(cachedFilePath)
						await this.cacheManager.deleteHash(cachedFilePath)
					} catch (error: any) {
						const errorStatus = error?.status || error?.response?.status || error?.statusCode
						const errorMessage = error instanceof Error ? error.message : String(error)

						this.log(
							`[DirectoryScanner] Failed to delete points for ${cachedFilePath} in workspace ${scanWorkspace}:`,
							error,
						)

						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(errorMessage),
							stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
							location: "scanDirectory:deleteRemovedFiles",
							errorStatus: errorStatus,
						})

						if (onError) {
							// Report error to error handler
							onError(
								error instanceof Error
									? new Error(
											`${error.message} (Workspace: ${scanWorkspace}, File: ${cachedFilePath})`,
										)
									: new Error(
											t("embeddings:scanner.unknownErrorDeletingPoints", {
												filePath: cachedFilePath,
											}) + ` (Workspace: ${scanWorkspace})`,
										),
							)
						}
						// Log error and continue processing instead of re-throwing
						this.log(`Failed to delete points for removed file: ${cachedFilePath}`, error)
					}
				}
			}
		}

		return {
			stats: {
				processed: processedCount,
				skipped: skippedCount,
			},
			totalBlockCount,
		}
	}

	private async processBatch(
		batchBlocks: CodeBlock[],
		batchTexts: string[],
		batchFileInfos: { filePath: string; fileHash: string; isNew: boolean }[],
		scanWorkspace: string,
		onError?: (error: Error) => void,
		onBlocksIndexed?: (indexedCount: number) => void,
	): Promise<void> {
		if (batchBlocks.length === 0) return

		// Check for cancellation before processing batch
		if (this._cancelled) {
			this.log("[DirectoryScanner] Batch processing aborted - cancelled")
			throw new Error("Indexing cancelled by user")
		}

		let attempts = 0
		let success = false
		let lastError: Error | null = null
		let batchFailed = false

		// Group blocks and file infos by file path for per-file processing
		const blocksByFile = new Map<string, CodeBlock[]>()
		const fileInfosByFile = new Map<string, { filePath: string; fileHash: string; isNew: boolean }>()

		for (const block of batchBlocks) {
			if (!blocksByFile.has(block.file_path)) {
				blocksByFile.set(block.file_path, [])
			}
			blocksByFile.get(block.file_path)!.push(block)
		}

		for (const fileInfo of batchFileInfos) {
			fileInfosByFile.set(fileInfo.filePath, fileInfo)
		}

		while (attempts < MAX_BATCH_RETRIES && !success) {
			attempts++
			try {
				// Check for cancellation before each retry
				if (this._cancelled) {
					this.log("[DirectoryScanner] Batch processing aborted - cancelled during retry")
					throw new Error("Indexing cancelled by user")
				}

				// Process each file individually while holding its mutex for the entire lifecycle
				for (const [filePath, fileBlocks] of blocksByFile) {
					const fileInfo = fileInfosByFile.get(filePath)
					if (!fileInfo) {
						this.log(`[DirectoryScanner] No file info found for ${filePath}, skipping`)
						continue
					}

					// Get file-specific mutex before any processing to prevent race conditions
					const fileMutex = this.getFileMutex(filePath)
					const release = await fileMutex.acquire()

					try {
						// Check for cancellation before processing this file
						if (this._cancelled) {
							throw new Error("Indexing cancelled by user")
						}

						this.log(`[DirectoryScanner] Processing file with full lifecycle mutex: ${filePath}`)

						// Step 1: Delete existing points for modified files (Qdrant operation)
						if (!fileInfo.isNew) {
							try {
								await this.qdrantClient.deletePointsByMultipleFilePaths([filePath])
								this.log(`[DirectoryScanner] Deleted existing points for modified file: ${filePath}`)
							} catch (deleteError: any) {
								const errorMessage =
									deleteError instanceof Error ? deleteError.message : String(deleteError)
								this.log(`[DirectoryScanner] Failed to delete points for ${filePath}:`, deleteError)

								// Mark batch as failed for transaction coordination
								batchFailed = true

								TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
									error: sanitizeErrorMessage(errorMessage),
									stack:
										deleteError instanceof Error
											? sanitizeErrorMessage(deleteError.stack || "")
											: undefined,
									location: "processBatch:deletePointsByFilePath",
									filePath: filePath,
								})

								// Re-throw to trigger retry
								throw new Error(`Failed to delete points for file ${filePath}: ${errorMessage}`, {
									cause: deleteError,
								})
							}
						}

						// Step 2: Create embeddings for this file's blocks
						const enrichedTexts = fileBlocks.map((block) => {
							// If block has enhanced metadata, use buildEmbeddingContext
							if (block.symbolMetadata || block.documentation || block.lspTypeInfo) {
								const segment: EnhancedCodeSegment = {
									segmentHash: block.segmentHash,
									filePath: block.file_path,
									content: block.content,
									startLine: block.start_line,
									endLine: block.end_line,
									fileHash: block.fileHash,
									identifier: block.identifier,
									type: block.type,
									language: path.extname(block.file_path).slice(1).toLowerCase(),
									symbolMetadata: block.symbolMetadata,
									documentation: block.documentation,
									lspTypeInfo: block.lspTypeInfo,
								}
								return buildEmbeddingContext(segment)
							}
							// Fallback to plain content for blocks without metadata
							return block.content
						})

						const { embeddings } = await this.embedder.createEmbeddings(enrichedTexts)

						// Step 3: Prepare and upsert points to Qdrant
						const points = fileBlocks.map((block, index) => {
							const normalizedAbsolutePath = generateNormalizedAbsolutePath(
								block.file_path,
								scanWorkspace,
							)
							const pointId = uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE)

							const ext = path.extname(block.file_path).slice(1).toLowerCase()
							const languageMap: Record<string, string> = {
								ts: "TypeScript",
								tsx: "TypeScript",
								js: "JavaScript",
								jsx: "JavaScript",
								py: "Python",
								java: "Java",
								cpp: "C++",
								c: "C",
								cs: "C#",
								go: "Go",
								rs: "Rust",
								rb: "Ruby",
								php: "PHP",
								swift: "Swift",
								kt: "Kotlin",
								scala: "Scala",
							}
							const language = languageMap[ext] || ext

							return {
								id: pointId,
								vector: embeddings[index],
								payload: {
									filePath: generateRelativeFilePath(normalizedAbsolutePath, scanWorkspace),
									codeChunk: block.content,
									startLine: block.start_line,
									endLine: block.end_line,
									segmentHash: block.segmentHash,
									identifier: block.identifier,
									type: block.type,
									language,
									symbolMetadata: block.symbolMetadata,
									imports: block.imports,
									exports: block.exports,
									documentation: block.documentation,
									lspTypeInfo: block.lspTypeInfo,
								},
							}
						})

						await this.qdrantClient.upsertPoints(points)
						onBlocksIndexed?.(fileBlocks.length)
						this.log(`[DirectoryScanner] Upserted ${fileBlocks.length} points for file: ${filePath}`)

						// Step 4: Add to BM25 index if available
						if (this.bm25Index) {
							const languageMap: Record<string, string> = {
								ts: "TypeScript",
								tsx: "TypeScript",
								js: "JavaScript",
								jsx: "JavaScript",
								py: "Python",
								java: "Java",
								cpp: "C++",
								c: "C",
								cs: "C#",
								go: "Go",
								rs: "Rust",
								rb: "Ruby",
								php: "PHP",
								swift: "Swift",
								kt: "Kotlin",
								scala: "Scala",
							}
							const bm25Documents: BM25Document[] = fileBlocks.map((block) => {
								const ext = path.extname(block.file_path).slice(1).toLowerCase()
								const language = languageMap[ext] || ext
								return {
									id: block.segmentHash,
									text: block.content,
									filePath: block.file_path,
									startLine: block.start_line,
									endLine: block.end_line,
									metadata: {
										identifier: block.identifier,
										type: block.type,
										language,
									},
								}
							})
							this.bm25Index.addDocuments(bm25Documents)
						}

						// Step 5: Add to Neo4j graph if available
						if (this.graphIndexer) {
							// Wait for available transaction slot
							await this.waitForTransactionSlot()
							await this.incrementActiveTransactions()

							try {
								this.log(`[DirectoryScanner] Starting Neo4j indexing for file: ${filePath}`)
								await this.graphIndexer.indexFile(filePath, fileBlocks)
								this.neo4jCumulativeFilesProcessed++
								this.log(
									`[DirectoryScanner] Successfully indexed file to Neo4j: ${filePath} (${this.neo4jCumulativeFilesProcessed}/${this.neo4jTotalFilesToProcess})`,
								)

								// Report cumulative progress
								if (this.stateManager) {
									this.stateManager.reportNeo4jIndexingProgress(
										this.neo4jCumulativeFilesProcessed,
										this.neo4jTotalFilesToProcess,
										"indexing",
										`Indexed ${this.neo4jCumulativeFilesProcessed}/${this.neo4jTotalFilesToProcess} files to graph`,
									)
								}

								// Reset circuit breaker on successful operation
								this.resetCircuitBreaker("transactionErrors")
								this.resetCircuitBreaker("connectionErrors")
								this.resetCircuitBreaker("deadlockErrors")
							} catch (error) {
								// Mark batch as failed for transaction coordination
								batchFailed = true

								// Enhanced error handling with proper error propagation and circuit breaker pattern
								const errorMessage = error instanceof Error ? error.message : String(error)
								const errorStack = error instanceof Error ? error.stack : undefined

								this.log(`[Neo4j Connection Error] Error indexing file to Neo4j:`, {
									filePath: filePath,
									error: errorMessage,
									stack: errorStack,
									processedFiles: `${this.neo4jCumulativeFilesProcessed}/${this.neo4jTotalFilesToProcess}`,
									circuitBreakerState: Object.entries(circuitBreakerState)
										.map(([type, state]) => `${type}: ${state.consecutiveFailures}/3 failures`)
										.join(", "),
								})

								// Determine error type for circuit breaker
								let errorType: "connectionErrors" | "transactionErrors" | "deadlockErrors"
								if (
									errorMessage.includes("connection") ||
									errorMessage.includes("pool") ||
									errorMessage.includes("timeout")
								) {
									errorType = "connectionErrors"
									this.log(
										`[DirectoryScanner] Neo4j connection issue detected - possible resource exhaustion. Consider reducing batch size or concurrency.`,
									)
								} else if (errorMessage.includes("deadlock") || errorMessage.includes("lock")) {
									errorType = "deadlockErrors"
								} else {
									errorType = "transactionErrors"
								}

								// Update circuit breaker for specific error type
								this.updateCircuitBreaker(errorType)
								const cbState = circuitBreakerState[errorType]
								this.log(`[Neo4j ${errorType}] Consecutive failures: ${cbState.consecutiveFailures}/3`)

								// Update state manager with cumulative circuit breaker statistics
								if (this.stateManager && cbState.consecutiveFailures < 3) {
									// Only update if circuit breaker hasn't opened yet (will be updated in the circuit breaker block if it opens)
									this.stateManager.reportNeo4jIndexingProgress(
										this.neo4jCumulativeFilesProcessed,
										this.neo4jTotalFilesToProcess,
										"error",
										`Graph indexing error: ${errorMessage} (${errorType} failure ${cbState.consecutiveFailures}/3)`,
									)
								}

								// Report to telemetry for monitoring with full error context
								TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
									error: sanitizeErrorMessage(errorMessage),
									stack: sanitizeErrorMessage(errorStack || ""),
									location: "processBatch:neo4jIndexing",
									filePath: filePath,
									errorType: errorType,
									circuitBreakerState: cbState,
									cumulativeStats: {
										processedFiles: this.neo4jCumulativeFilesProcessed,
										totalFiles: this.neo4jTotalFilesToProcess,
									},
								})

								// Circuit breaker: stop Neo4j indexing after consecutive failures
								if (this.isCircuitBreakerOpen(errorType)) {
									const cbState = circuitBreakerState[errorType]
									this.log(
										`[Neo4j Circuit Breaker] Circuit breaker triggered for ${errorType} - disabling Neo4j indexing for this batch.`,
									)
									this.log(
										`[Neo4j Circuit Breaker] State: ${cbState.consecutiveFailures} consecutive failures`,
									)

									// Report circuit breaker activation to telemetry
									TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
										error: sanitizeErrorMessage(errorMessage),
										stack: sanitizeErrorMessage(errorStack || ""),
										location: "processBatch:neo4jCircuitBreaker",
										errorType: "circuit_breaker_triggered",
										circuitBreakerType: errorType,
										circuitBreakerState: circuitBreakerState[errorType],
									})

									// Update state manager with detailed circuit breaker status
									if (this.stateManager) {
										const categorized = this.stateManager.categorizeError(error as Error)
										this.stateManager.setNeo4jStatus(
											"error",
											`Neo4j indexing disabled - circuit breaker triggered (${errorType})`,
											errorMessage,
											categorized.category,
											`Circuit breaker activated after ${cbState.consecutiveFailures} consecutive ${errorType}. ${categorized.retrySuggestion}`,
										)
									}

									// Don't re-throw for circuit breaker - continue with vector indexing
									return
								}

								// Re-throw critical errors that should stop the entire indexing process
								if (
									errorMessage.includes("authentication") ||
									errorMessage.includes("authorization") ||
									errorMessage.includes("invalid database")
								) {
									this.log(
										`[DirectoryScanner] Critical Neo4j error - stopping indexing: ${errorMessage}`,
									)
									throw new Error(`Neo4j critical error: ${errorMessage}`)
								}

								// For other errors, log and continue with vector indexing (graceful degradation)
								this.log(
									`[DirectoryScanner] Neo4j error handled gracefully - continuing with vector indexing: ${errorMessage}`,
								)
							} finally {
								// Decrement active transaction counter
								await this.decrementActiveTransactions()
							}
						}

						// Step 6: Update cache hash for successfully processed file
						// Only update if batch didn't fail (transaction coordination)
						if (!batchFailed) {
							await this.cacheManager.updateHash(fileInfo.filePath, fileInfo.fileHash)
							this.log(`[DirectoryScanner] Updated cache hash for file: ${filePath}`)
						} else {
							this.log(
								`[DirectoryScanner] File processing failed - not updating cache hash for: ${filePath}`,
							)

							TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
								error: "File-level transaction failure",
								location: "processBatch:fileFailure",
								filePath: filePath,
							})
						}
					} finally {
						// Release mutex for this file
						release()
						this.log(`[DirectoryScanner] Released mutex for file: ${filePath}`)
					}
				}

				success = true
			} catch (error) {
				lastError = error as Error
				this.log(
					`[DirectoryScanner] Error processing batch (attempt ${attempts}) in workspace ${scanWorkspace}:`,
					error,
				)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
					stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
					location: "processBatch:retry",
					attemptNumber: attempts,
					batchSize: batchBlocks.length,
				})

				if (attempts < MAX_BATCH_RETRIES) {
					const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		if (!success && lastError) {
			this.log(`[DirectoryScanner] Failed to process batch after ${MAX_BATCH_RETRIES} attempts`)
			// Preserve the original error message from embedders which now have detailed i18n messages
			const errorMessage = lastError.message || "Unknown error"

			// Always call onError callback if provided for additional reporting
			if (onError) {
				onError(
					new Error(
						t("embeddings:scanner.failedToProcessBatchWithError", {
							maxRetries: MAX_BATCH_RETRIES,
							errorMessage,
						}),
					),
				)
			}

			// Always throw to ensure errors propagate to orchestrator, even if onError callback not provided
			// This ensures batch processing failures are never silently swallowed
			throw new Error(
				t("embeddings:scanner.failedToProcessBatchWithError", {
					maxRetries: MAX_BATCH_RETRIES,
					errorMessage,
				}),
				{ cause: lastError },
			)
		}
	}
}
