import { listFiles } from "../../glob/list-files"
import { Ignore } from "ignore"
import { RooIgnoreController } from "../../../core/ignore/RooIgnoreController"
import { stat } from "fs/promises"
import * as path from "path"
import { generateNormalizedAbsolutePath, generateRelativeFilePath } from "../shared/get-relative-path"
import { getWorkspacePathForContext } from "../../../utils/path"
import { scannerExtensions } from "../shared/supported-extensions"
import * as vscode from "vscode"
import { MAX_CONTENT_PREVIEW_CHARS } from "../constants"
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
import { PointStruct } from "../interfaces/vector-store"
import { createHash } from "crypto"
import { v5 as uuidv5 } from "uuid"
import pLimit from "p-limit"
import { Mutex } from "async-mutex"
import { CacheManager } from "../cache-manager"
import { t } from "../../../i18n"
import { buildEmbeddingContext, EnhancedCodeSegment } from "../types/metadata"
import { AdaptiveBatchOptimizer } from "../utils/batch-optimizer"
import { Logger } from "../../../shared/logger"
import { MetricsCollector } from "../utils/metrics-collector"

// Per-file mutex map for Neo4j file indexing operations to prevent race conditions
// This allows concurrent indexing of different files while preventing concurrent indexing of same file
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
	MAX_FILE_SIZE_BYTES,
	BATCH_SEGMENT_THRESHOLD,
	PARSING_CONCURRENCY,
	BATCH_PROCESSING_CONCURRENCY,
	MAX_PENDING_BATCHES,
	QDRANT_CODE_BLOCK_NAMESPACE,
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
} from "../constants"
import { isPathInIgnoredDirectory } from "../../glob/ignore-utils"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
import { Package } from "../../../shared/package"

export class DirectoryScanner implements IDirectoryScanner {
	private batchSegmentThreshold: number
	// Track cumulative Neo4j progress across all batches
	private neo4jCumulativeFilesProcessed: number = 0
	private neo4jTotalFilesToProcess: number = 0
	// Cancellation support
	private _cancelled: boolean = false

	// Adaptive batch optimization
	private batchOptimizer: AdaptiveBatchOptimizer
	private totalBatchesProcessed = 0
	// Verbose logging control
	private verboseLogging: boolean = false

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
		const waiters = mutexWaiters.get(holdingFile) || new Set()
		const updatedWaiters = new Set(waiters)
		updatedWaiters.add(waitingFile)
		mutexWaiters.set(holdingFile, updatedWaiters)

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
		this.log?.info(`[DirectoryScanner] Breaking deadlock for file: ${filePath}`)
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
			this.log?.info(
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
				this.log?.info(
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
				this.log?.info(
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
			this.log?.info(`[DirectoryScanner] Circuit breaker reset for ${errorType}`)
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
			this.log?.info(
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
			this.log?.info(`[DirectoryScanner] Circuit breaker reset for ${errorType} after successful operation`)
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
				if (files.includes(dep)) {
					inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
				}
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
			this.log?.info(
				"[DirectoryScanner] Circular dependency detected, processing remaining files in arbitrary order",
			)
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
		private readonly logger?: Logger,
		verboseLogging?: boolean,
		private readonly metricsCollector?: MetricsCollector,
	) {
		this.log = logger
		this.verboseLogging = verboseLogging || false

		// Initialize adaptive batch optimizer
		this.batchOptimizer = new AdaptiveBatchOptimizer(MAX_BATCH_TOKENS, MAX_ITEM_TOKENS, {
			minBatchSize: 5,
			maxBatchSize: 100,
			targetLatency: 2000, // 2 seconds
			targetThroughput: 50, // 50 items per second
			adjustmentFactor: 0.2, // 20% adjustment
			metricsWindow: 10, // consider last 10 batches
		})

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

		// Inject metrics collector into parser if available
		if (this.metricsCollector) {
			this.codeParser.setMetricsCollector(this.metricsCollector)
		}
	}

	private readonly log?: Logger

	/**
	 * Helper method to extract file extension from path
	 */
	private getFileExtension(filePath: string): string {
		return path.extname(filePath).toLowerCase()
	}

	/**
	 * Cancel the current indexing operation
	 */
	public cancel(): void {
		this._cancelled = true
		this.log?.info("[DirectoryScanner] Indexing cancelled by user")
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
	): Promise<{
		stats: { processed: number; skipped: number }
		totalBlockCount: number
		filesDiscovered: number
		filesAfterRooignore: number
		filesAfterExtensionFilter: number
		filesSkippedBySize: number
		filesSkippedByCache: number
		filesProcessed: number
	}> {
		const directoryPath = directory
		// Capture workspace context at scan start
		const scanWorkspace = getWorkspacePathForContext(directoryPath)

		// Check for cancellation before starting
		if (this._cancelled) {
			this.log?.info("[DirectoryScanner] Scan aborted - cancelled before start")
			throw new Error("Indexing cancelled by user")
		}

		// Get all files recursively (handles .gitignore automatically)
		const [allPaths, _] = await listFiles(directoryPath, true)

		// Filter out directories (marked with trailing '/')
		const filePaths = allPaths.filter((p) => !p.endsWith("/"))
		const dirCount = allPaths.length - filePaths.length

		this.log?.info(
			`[DirectoryScanner] Discovered ${allPaths.length} paths (${dirCount} directories, ${filePaths.length} files)`,
		)

		// Log each discovered file with its extension (verbose only)
		if (this.verboseLogging) {
			for (const filePath of filePaths) {
				const ext = path.extname(filePath).toLowerCase()
				this.log?.info(`[DirectoryScanner] Discovered file: ${filePath} (extension: ${ext || "none"})`)
			}
		}

		// Record file discovery metrics
		for (const filePath of filePaths) {
			const ext = this.getFileExtension(filePath)
			this.metricsCollector?.recordFileTypeMetric(ext, "discovered")
		}

		// Initialize RooIgnoreController if not provided
		const ignoreController = new RooIgnoreController(directoryPath)

		await ignoreController.initialize()

		// Filter paths using .rooignore
		const allowedPaths = ignoreController.filterPaths(filePaths)
		this.log?.info(`[DirectoryScanner] ${allowedPaths.length} files remain after .rooignore filtering`)

		// record rooignore filtering metrics
		for (const filePath of filePaths) {
			if (!allowedPaths.includes(filePath)) {
				const ext = this.getFileExtension(filePath)
				this.metricsCollector?.recordFileTypeMetric(ext, "filteredByRooignore")
			}
		}

		// Initialize filter counters before using them in the filter callback
		let ignoredDirCount = 0
		let unsupportedExtCount = 0
		let gitignoreCount = 0

		// Filter by supported extensions, ignore patterns, and excluded directories
		const supportedPaths = allowedPaths.filter((filePath) => {
			const ext = path.extname(filePath).toLowerCase()
			const relativeFilePath = generateRelativeFilePath(filePath, scanWorkspace)

			// Check if file is in an ignored directory using the shared helper
			if (isPathInIgnoredDirectory(filePath)) {
				if (this.verboseLogging) {
					this.log?.info(`[DirectoryScanner] Filtered out file in ignored directory: ${filePath}`)
				}
				ignoredDirCount++
				return false
			}

			const isSupportedExt = scannerExtensions.includes(ext)
			const isIgnoredByGitignore = this.ignoreInstance.ignores(relativeFilePath)

			if (!isSupportedExt) {
				if (this.verboseLogging) {
					this.log?.info(
						`[DirectoryScanner] Filtered out file with unsupported extension: ${filePath} (extension: ${ext})`,
					)
				}
				unsupportedExtCount++
				this.metricsCollector?.recordFileTypeMetric(ext, "filteredByExtension")
				return false
			}

			if (isIgnoredByGitignore) {
				if (this.verboseLogging) {
					this.log?.info(`[DirectoryScanner] Filtered out file ignored by .gitignore: ${filePath}`)
				}
				gitignoreCount++
				this.metricsCollector?.recordFileTypeMetric(ext, "filteredByRooignore")
				return false
			}

			if (this.verboseLogging) {
				this.log?.info(`[DirectoryScanner] File passed all filters: ${filePath}`)
			}
			return true
		})
		this.log?.info(
			`[DirectoryScanner] ${supportedPaths.length} files remain after extension and .gitignore filtering`,
		)

		// Initialize tracking variables
		const processedFiles = new Set<string>()
		let processedCount = 0
		let skippedCount = 0
		let sizeSkippedCount = 0
		let cacheSkippedCount = 0

		// Initialize zero block tracking variables
		let zeroBlockCount = 0
		const zeroBlockExtensions = new Map<string, number>()
		const blockCountDistribution = {
			zero: 0,
			oneToFive: 0,
			sixToTen: 0,
			tenPlus: 0,
		}

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

				let stats: any = null

				try {
					// Check file size
					try {
						stats = await stat(filePath)
					} catch (statError) {
						this.log?.info(
							`[DirectoryScanner] Failed to get file stats for ${filePath}: ${statError instanceof Error ? statError.message : String(statError)}`,
						)
						return
					}
					if (this.verboseLogging) {
						this.log?.info(`[DirectoryScanner] File size check: ${filePath} (${stats.size} bytes)`)
					}
					if (stats.size > MAX_FILE_SIZE_BYTES) {
						if (this.verboseLogging) {
							this.log?.info(
								`[DirectoryScanner] File too large, skipping: ${filePath} (${stats.size} bytes > ${MAX_FILE_SIZE_BYTES} bytes)`,
							)
						}
						skippedCount++ // Skip large files
						sizeSkippedCount++
						const ext = this.getFileExtension(filePath)
						this.metricsCollector?.recordFileTypeMetric(ext, "skippedBySize")
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
						if (this.verboseLogging) {
							this.log?.info(`[DirectoryScanner] Cache hit - file unchanged: ${filePath}`)
						}
						skippedCount++
						cacheSkippedCount++
						const ext = this.getFileExtension(filePath)
						this.metricsCollector?.recordFileTypeMetric(ext, "skippedByCache")
						return
					}

					if (this.verboseLogging) {
						if (isNewFile) {
							this.log?.info(`[DirectoryScanner] Cache miss - new file: ${filePath}`)
						} else {
							this.log?.info(`[DirectoryScanner] Cache miss - file modified: ${filePath} (hash changed)`)
						}
					}

					// Check for cancellation before parsing
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// File is new or changed - parse it using the injected parser function
					const blocks = await this.codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
					const fileBlockCount = blocks.length
					const ext = this.getFileExtension(filePath)

					// Add diagnostic for 0-block parses
					if (fileBlockCount === 0) {
						const fileExtension = path.extname(filePath).toLowerCase()
						const fileSize = stats?.size || "unknown"
						this.log?.info(
							`[DirectoryScanner] WARNING: File parsed but generated 0 blocks: ${filePath} (extension: ${fileExtension}, size: ${fileSize} bytes)`,
						)
						// Enhanced diagnostics for 0-block files
						this.log?.info(
							`[DirectoryScanner] File content preview: ${content.substring(0, MAX_CONTENT_PREVIEW_CHARS).replace(/\n/g, " ")}...`,
							"DirectoryScanner",
						)
						// Log parser method used (tree-sitter or fallback)
						const parserUsed = (this.codeParser as any).getParserType
							? (this.codeParser as any).getParserType(filePath)
							: "unknown"
						this.log?.info(
							`[DirectoryScanner] Parser type used: ${parserUsed} for file: ${filePath}`,
							"DirectoryScanner",
						)

						// Track zero block statistics
						zeroBlockCount++
						zeroBlockExtensions.set(fileExtension, (zeroBlockExtensions.get(fileExtension) || 0) + 1)
					}

					// Track block count distribution
					if (fileBlockCount === 0) {
						blockCountDistribution.zero++
					} else if (fileBlockCount <= 5) {
						blockCountDistribution.oneToFive++
					} else if (fileBlockCount <= 10) {
						blockCountDistribution.sixToTen++
					} else {
						blockCountDistribution.tenPlus++
					}

					this.log?.info(
						`[DirectoryScanner] Successfully parsed file: ${filePath} (${fileBlockCount} code blocks found)`,
					)
					onFileParsed?.(fileBlockCount)
					processedCount++

					// Record parse metrics
					if (fileBlockCount > 0) {
						this.metricsCollector?.recordFileTypeMetric(ext, "parsed")
						this.metricsCollector?.recordBlockTypeMetric(ext, "generated", fileBlockCount)
						this.metricsCollector?.recordFileTypeMetric(ext, "blocksGenerated", fileBlockCount)
					} else {
						this.metricsCollector?.recordFileTypeMetric(ext, "parseFailed")
					}

					// Log aggregate statistics for zero block files
					if (processedCount > 0 && processedCount % 50 === 0) {
						const zeroBlockPercentage = ((zeroBlockCount / processedCount) * 100).toFixed(2)
						this.log?.info(
							`[DirectoryScanner] Aggregate stats after ${processedCount} files: ${zeroBlockCount} files (${zeroBlockPercentage}%) generated 0 blocks`,
							"DirectoryScanner",
						)

						// Log extensions with zero block issues
						const extensionsWithIssues = Array.from(zeroBlockExtensions.entries())
							.filter(([_, count]) => count > 0)
							.map(([ext, count]) => `${ext}: ${count}`)
							.join(", ")
						if (extensionsWithIssues) {
							this.log?.info(
								`[DirectoryScanner] Extensions with 0-block issues: ${extensionsWithIssues}`,
								"DirectoryScanner",
							)
						}

						// Critical warning if >50% of files generate 0 blocks
						if (parseFloat(zeroBlockPercentage) > 50) {
							this.log?.info(
								`[DirectoryScanner] CRITICAL WARNING: ${zeroBlockPercentage}% of files are generating 0 blocks. This suggests parser configuration issues.`,
								"DirectoryScanner",
							)
						}
					}

					// Check for cancellation after parsing
					if (this._cancelled) {
						throw new Error("Indexing cancelled by user")
					}

					// Process embeddings if configured
					if (this.embedder && this.qdrantClient && blocks.length > 0) {
						const previousBatchSize = currentBatchBlocks.length
						this.log?.info(`Filtering blocks for embeddings: ${blocks.length} blocks parsed`)

						let filteredCount = 0
						let addedBlocksFromFile = false
						for (const block of blocks) {
							const trimmedContent = block.content.trim()
							if (trimmedContent) {
								currentBatchBlocks.push(block)
								currentBatchTexts.push(trimmedContent)
								addedBlocksFromFile = true
							} else {
								filteredCount++
							}
						}

						this.log?.info(
							`Blocks after filtering empty content: ${currentBatchBlocks.length - previousBatchSize} added (${filteredCount} filtered out due to empty content)`,
						)

						// Add file info once per file (outside the block loop)
						if (addedBlocksFromFile) {
							totalBlockCount += fileBlockCount
							currentBatchFileInfos.push({
								filePath,
								fileHash: currentFileHash,
								isNew: isNewFile,
							})

							// Use adaptive batch sizing to determine if we should process current batch
							const batchOptimization = this.batchOptimizer.calculateOptimalBatchSize(
								currentBatchBlocks,
								this.batchSegmentThreshold,
							)

							// Check if we should process the batch based on adaptive sizing
							const shouldProcessBatch = currentBatchBlocks.length >= batchOptimization.optimalBatchSize

							if (shouldProcessBatch) {
								this.log?.info(
									`[DirectoryScanner] Adaptive batch optimization: ${batchOptimization.reasoning}`,
								)

								// Use the optimized batch size for this batch
								const optimizedBatchSize = batchOptimization.optimalBatchSize
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
					const errorMessage = error instanceof Error ? error.message : String(error)
					const errorStack = error instanceof Error ? error.stack : undefined
					this.log?.info(
						`[DirectoryScanner] Error processing file: ${filePath} in workspace: ${scanWorkspace}`,
					)
					this.log?.info(`[DirectoryScanner] Error details: ${errorMessage}`)
					if (errorStack) {
						this.log?.info(`[DirectoryScanner] Error stack: ${errorStack}`)
					}
					this.log?.info(`[DirectoryScanner] File size: ${stats?.size || "unknown"} bytes`)
					this.log?.info(`[DirectoryScanner] File extension: ${path.extname(filePath).toLowerCase()}`)

					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(errorMessage),
						stack: sanitizeErrorMessage(errorStack || ""),
						location: "scanDirectory:processFile",
						filePath: filePath,
						fileSize: stats?.size,
						fileExtension: path.extname(filePath).toLowerCase(),
					})

					// Create enhanced error with context
					const enhancedError =
						error instanceof Error
							? new Error(
									`${error.message} (Workspace: ${scanWorkspace}, File: ${filePath}, Size: ${stats?.size || "unknown"} bytes)`,
								)
							: new Error(
									t("embeddings:scanner.unknownErrorProcessingFile", { filePath }) +
										` (Workspace: ${scanWorkspace}, Size: ${stats?.size || "unknown"} bytes)`,
								)

					// Preserve original error stack and context
					if (error instanceof Error) {
						enhancedError.stack = error.stack
					}

					if (onError) {
						onError(enhancedError)
					}

					// Re-throw the error to ensure proper error propagation instead of continuing silently
					throw enhancedError
				}
			}),
		)

		// Wait for all parsing to complete
		try {
			await Promise.all(parsePromises)
		} catch (error) {
			// If cancelled, propagate the error
			if (error instanceof Error && error.message === "Indexing cancelled by user") {
				this.log?.info("[DirectoryScanner] File parsing cancelled by user")
				throw error
			}
			// Otherwise, let the error propagate normally
			throw error
		}

		// Check for cancellation before processing final batch
		if (this._cancelled) {
			this.log?.info("[DirectoryScanner] Scan aborted - cancelled before final batch")
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
				this.log?.info("[DirectoryScanner] Batch processing cancelled by user")
				throw error
			}
			// Otherwise, let the error propagate normally
			throw error
		}

		// Calculate zero block percentage for summary
		const zeroBlockPercentage = processedCount > 0 ? ((zeroBlockCount / processedCount) * 100).toFixed(2) : "0"
		const extensionsWithIssues = Array.from(zeroBlockExtensions.entries())
			.filter(([_, count]) => count > 0)
			.map(([ext]) => ext)

		this.log?.info(`[DirectoryScanner] Scan summary:
			Total files discovered: ${filePaths.length}
			Files after .rooignore: ${allowedPaths.length}
			Files filtered by ignored directories: ${ignoredDirCount}
			Files filtered by unsupported extensions: ${unsupportedExtCount}
			Files filtered by .gitignore: ${gitignoreCount}
			Files to process: ${supportedPaths.length}
			Files skipped by size: ${sizeSkippedCount}
			Files skipped by cache: ${cacheSkippedCount}
			Files parsed: ${processedCount}
			Total blocks found: ${totalBlockCount}
			Average blocks per parsed file: ${processedCount > 0 ? (totalBlockCount / processedCount).toFixed(2) : "0"}
			Files generating 0 blocks: ${zeroBlockCount} (${zeroBlockPercentage}%)
			Extensions with 0-block issues: ${extensionsWithIssues.join(", ") || "None"}
			Most common block counts: 0 blocks: ${blockCountDistribution.zero}, 1-5 blocks: ${blockCountDistribution.oneToFive}, 6-10 blocks: ${blockCountDistribution.sixToTen}, 10+ blocks: ${blockCountDistribution.tenPlus}
		`)

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

						this.log?.info(
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
						this.log?.info(`Failed to delete points for removed file: ${cachedFilePath}`, error)
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
			filesDiscovered: filePaths.length,
			filesAfterRooignore: allowedPaths.length,
			filesAfterExtensionFilter: supportedPaths.length,
			filesSkippedBySize: sizeSkippedCount,
			filesSkippedByCache: cacheSkippedCount,
			filesProcessed: processedCount,
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
			this.log?.info("[DirectoryScanner] Batch processing aborted - cancelled")
			throw new Error("Indexing cancelled by user")
		}

		// Record batch start time for performance tracking
		const batchStartTime = Date.now()

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

		// Comprehensive batch entry logging
		this.log?.info(
			`[DirectoryScanner] processBatch ENTRY: Received ${batchBlocks.length} blocks from ${batchFileInfos.length} files`,
		)
		this.log?.info(
			`Files in batch: ${Array.from(blocksByFile.entries())
				.map(([path, blocks]) => `${path} (${blocks.length} blocks)`)
				.join(", ")}`,
		)

		let attempts = 0
		let success = false
		let lastError: Error | null = null
		let batchFailed = false
		const filesWithFailedMetrics = new Set<string>()

		while (attempts < MAX_BATCH_RETRIES && !success) {
			attempts++
			try {
				// Check for cancellation before each retry
				if (this._cancelled) {
					this.log?.info("[DirectoryScanner] Batch processing aborted - cancelled during retry")
					throw new Error("Indexing cancelled by user")
				}

				// Process each file individually while holding its mutex for entire lifecycle
				for (const [filePath, fileBlocks] of blocksByFile) {
					const fileInfo = fileInfosByFile.get(filePath)
					if (!fileInfo) {
						this.log?.info(`[DirectoryScanner] No file info found for ${filePath}, skipping`)
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

						this.log?.info(`[DirectoryScanner] Processing file with full lifecycle mutex: ${filePath}`)
						this.log?.info(
							`[DirectoryScanner] Processing ${fileBlocks.length} blocks for file: ${filePath}`,
						)

						// Step 1: Delete existing points for modified files (Qdrant operation)
						if (!fileInfo.isNew) {
							try {
								await this.qdrantClient.deletePointsByMultipleFilePaths([filePath])
								this.log?.info(
									`[DirectoryScanner] Deleted existing points for modified file: ${filePath}`,
								)
							} catch (deleteError: any) {
								const errorMessage =
									deleteError instanceof Error ? deleteError.message : String(deleteError)
								this.log?.info(
									`[DirectoryScanner] Failed to delete points for ${filePath}:`,
									deleteError,
								)

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
							}
						}

						// Step 2: Generate embeddings for all blocks in batch
						const enrichedTexts: string[] = []
						for (const block of fileBlocks) {
							const enrichedText = buildEmbeddingContext(block)
							enrichedTexts.push(enrichedText)
						}

						// Step 3: Generate embeddings in a single API call for entire batch
						this.log?.info(
							`[DirectoryScanner] Generating embeddings for ${enrichedTexts.length} enriched text segments`,
						)
						const embeddingResponse = await this.embedder.createEmbeddings(enrichedTexts)
						this.log?.info(
							`[DirectoryScanner] Generated ${embeddingResponse.embeddings.length} embeddings for batch`,
						)

						// Verification logging for embedding generation
						this.log?.info(
							`[DirectoryScanner] Embedding generation: Requested ${enrichedTexts.length} embeddings, received ${embeddingResponse.embeddings.length} embeddings for file: ${filePath}`,
						)
						if (enrichedTexts.length !== embeddingResponse.embeddings.length) {
							this.log?.info(
								`[DirectoryScanner] ERROR: Embedding count mismatch for ${filePath}: expected ${enrichedTexts.length}, got ${embeddingResponse.embeddings.length}`,
							)

							// Mark batch as failed to prevent cache hash update
							batchFailed = true

							// Record failed block metrics
							const ext = this.getFileExtension(filePath)
							this.metricsCollector?.recordBlockTypeMetric(ext, "failed", fileBlocks.length)
							filesWithFailedMetrics.add(filePath)

							// Report to telemetry for monitoring
							TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
								error: `Embedding count mismatch for ${filePath}: expected ${enrichedTexts.length}, got ${embeddingResponse.embeddings.length}`,
								location: "processBatch:embeddingCountMismatch",
								filePath: filePath,
								expectedCount: enrichedTexts.length,
								actualCount: embeddingResponse.embeddings.length,
							})

							// Throw error to trigger batch retry path
							throw new Error(
								`Embedding count mismatch for ${filePath}: expected ${enrichedTexts.length}, got ${embeddingResponse.embeddings.length}`,
							)
						}

						// Record successful embedding metrics
						const ext = this.getFileExtension(filePath)
						this.metricsCollector?.recordBlockTypeMetric(ext, "embedded", fileBlocks.length)

						// Step 4: Prepare and upsert points to Qdrant
						const points: PointStruct[] = []
						for (let i = 0; i < embeddingResponse.embeddings.length; i++) {
							const enrichedText = enrichedTexts[i]
							const embedding = embeddingResponse.embeddings[i]
							const block = fileBlocks[i]

							// Validate array bounds
							if (i >= fileBlocks.length) {
								this.log?.info(
									`[DirectoryScanner] ERROR: Embedding index ${i} out of bounds for ${filePath}: only ${fileBlocks.length} embeddings available`,
								)

								// Record failed block metrics
								const ext = this.getFileExtension(filePath)
								this.metricsCollector?.recordBlockTypeMetric(ext, "failed", fileBlocks.length)
								filesWithFailedMetrics.add(filePath)

								TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
									error: `Embedding index ${i} out of bounds for ${filePath}: only ${fileBlocks.length} embeddings available`,
									location: "processBatch:embeddingIndexOutOfBounds",
									filePath: filePath,
								})

								// Throw error to trigger batch retry path
								throw new Error(
									`Embedding index ${i} out of bounds for ${filePath}: only ${fileBlocks.length} embeddings available`,
								)
							}

							const point: PointStruct = {
								id: uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE),
								vector: embedding,
								payload: {
									file_path: block.file_path,
									identifier: block.identifier,
									type: block.type,
									start_line: block.start_line,
									end_line: block.end_line,
									content: block.content,
									fileHash: block.fileHash,
									segmentHash: block.segmentHash,
									symbolMetadata: block.symbolMetadata,
									imports: block.imports,
									exports: block.exports,
									documentation: block.documentation,
									lspTypeInfo: block.lspTypeInfo,
									calls: block.calls,
									testMetadata: block.testMetadata,
									// React-specific metadata
									reactComponentMetadata: block.reactComponentMetadata,
									reactHookMetadata: block.reactHookMetadata,
									jsxMetadata: block.jsxMetadata,
								} as any,
							}
							points.push(point)
						}

						// Step 5: Upsert points to Qdrant
						this.log?.info(`[DirectoryScanner] Upserting ${points.length} points to Qdrant for batch`)
						await this.qdrantClient.upsertPoints(points)

						// Step 6: Update cache hash for successfully processed file
						// Only update if batch didn't fail (transaction coordination)
						if (!batchFailed) {
							await this.cacheManager.updateHash(fileInfo.filePath, fileInfo.fileHash)
							this.log?.info(`[DirectoryScanner] Updated cache hash for file: ${filePath}`)
						} else {
							this.log?.info(
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
						this.log?.info(`[DirectoryScanner] Released mutex for file: ${filePath}`)
					}
				}

				success = true
			} catch (error) {
				lastError = error as Error
				this.log?.info(
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

				// Record failed metrics for all files in batch that haven't already been recorded
				for (const [filePath, fileBlocks] of blocksByFile) {
					if (!filesWithFailedMetrics.has(filePath)) {
						this.metricsCollector?.recordBlockTypeMetric(
							this.getFileExtension(filePath),
							"failed",
							fileBlocks.length,
						)
					}
				}

				if (attempts < MAX_BATCH_RETRIES) {
					const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts - 1)
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		// Success case - log successful batch completion
		if (success) {
			this.log?.info(
				`[DirectoryScanner] processBatch EXIT: Successfully processed ${batchBlocks.length} blocks from ${blocksByFile.size} files in ${Date.now() - batchStartTime}ms`,
			)
		}

		// Failure case - handle batch failure after exhausting retries
		if (!success && lastError) {
			this.log?.info(
				`[DirectoryScanner] processBatch EXIT-ERROR: Failed to process batch after ${MAX_BATCH_RETRIES} attempts`,
			)
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
