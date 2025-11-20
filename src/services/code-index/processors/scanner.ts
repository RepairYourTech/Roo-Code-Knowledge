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

// Global mutex for Neo4j file indexing operations to prevent race conditions
// This ensures that when File A is being indexed (delete + create nodes + create relationships),
// File B cannot delete its nodes in parallel, which would break relationships from A to B
const neo4jFileMutex = new Mutex()
import {
	QDRANT_CODE_BLOCK_NAMESPACE,
	MAX_FILE_SIZE_BYTES,
	MAX_LIST_FILES_LIMIT_CODE_INDEX,
	BATCH_SEGMENT_THRESHOLD,
	MAX_BATCH_RETRIES,
	INITIAL_RETRY_DELAY_MS,
	PARSING_CONCURRENCY,
	BATCH_PROCESSING_CONCURRENCY,
	MAX_PENDING_BATCHES,
} from "../constants"
import { isPathInIgnoredDirectory } from "../../glob/ignore-utils"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
import { Package } from "../../../shared/package"

export class DirectoryScanner implements IDirectoryScanner {
	private readonly batchSegmentThreshold: number
	// Track cumulative Neo4j progress across all batches
	private neo4jCumulativeFilesProcessed: number = 0
	private neo4jTotalFilesToProcess: number = 0
	// Cancellation support
	private _cancelled: boolean = false

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
	) {
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

	/**
	 * Cancel the current indexing operation
	 */
	public cancel(): void {
		this._cancelled = true
		console.log("[DirectoryScanner] Indexing cancelled by user")
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
			console.log("[DirectoryScanner] Scan aborted - cancelled before start")
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
				try {
					// Check file size
					const stats = await stat(filePath)
					if (stats.size > MAX_FILE_SIZE_BYTES) {
						skippedCount++ // Skip large files
						return
					}

					// Read file content
					const content = await vscode.workspace.fs
						.readFile(vscode.Uri.file(filePath))
						.then((buffer) => Buffer.from(buffer).toString("utf-8"))

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

					// File is new or changed - parse it using the injected parser function
					const blocks = await this.codeParser.parseFile(filePath, { content, fileHash: currentFileHash })
					const fileBlockCount = blocks.length
					onFileParsed?.(fileBlockCount)
					processedCount++

					// Process embeddings if configured
					if (this.embedder && this.qdrantClient && blocks.length > 0) {
						const release = await mutex.acquire()
						try {
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
									// Wait if we've reached the maximum pending batches
									while (pendingBatchCount >= MAX_PENDING_BATCHES) {
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
						} finally {
							release()
						}
					} else {
						// Only update hash if not being processed in a batch
						await this.cacheManager.updateHash(filePath, currentFileHash)
					}
				} catch (error) {
					console.error(`Error processing file ${filePath} in workspace ${scanWorkspace}:`, error)
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
		await Promise.all(parsePromises)

		// Process any remaining items in batch
		if (currentBatchBlocks.length > 0) {
			const release = await mutex.acquire()
			try {
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
		await Promise.all(activeBatchPromises)

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

						console.error(
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
						console.error(`Failed to delete points for removed file: ${cachedFilePath}`, error)
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
			console.log("[DirectoryScanner] Batch processing aborted - cancelled")
			throw new Error("Indexing cancelled by user")
		}

		let attempts = 0
		let success = false
		let lastError: Error | null = null

		while (attempts < MAX_BATCH_RETRIES && !success) {
			attempts++
			try {
				// Check for cancellation before each retry
				if (this._cancelled) {
					console.log("[DirectoryScanner] Batch processing aborted - cancelled during retry")
					throw new Error("Indexing cancelled by user")
				}
				// --- Deletion Step ---
				const uniqueFilePaths = [
					...new Set(
						batchFileInfos
							.filter((info) => !info.isNew) // Only modified files (not new)
							.map((info) => info.filePath),
					),
				]
				if (uniqueFilePaths.length > 0) {
					try {
						await this.qdrantClient.deletePointsByMultipleFilePaths(uniqueFilePaths)
					} catch (deleteError: any) {
						const errorStatus =
							deleteError?.status || deleteError?.response?.status || deleteError?.statusCode
						const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)

						console.error(
							`[DirectoryScanner] Failed to delete points for ${uniqueFilePaths.length} files before upsert in workspace ${scanWorkspace}:`,
							deleteError,
						)

						TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
							error: sanitizeErrorMessage(errorMessage),
							stack:
								deleteError instanceof Error
									? sanitizeErrorMessage(deleteError.stack || "")
									: undefined,
							location: "processBatch:deletePointsByMultipleFilePaths",
							fileCount: uniqueFilePaths.length,
							errorStatus: errorStatus,
						})

						// Re-throw with workspace context
						throw new Error(
							`Failed to delete points for ${uniqueFilePaths.length} files. Workspace: ${scanWorkspace}. ${errorMessage}`,
							{ cause: deleteError },
						)
					}
				}
				// --- End Deletion Step ---

				// Phase 2: Create metadata-enriched embeddings for batch
				const enrichedTexts = batchBlocks.map((block) => {
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

				// Prepare points for Qdrant
				const points = batchBlocks.map((block, index) => {
					const normalizedAbsolutePath = generateNormalizedAbsolutePath(block.file_path, scanWorkspace)

					// Use segmentHash for unique ID generation to handle multiple segments from same line
					const pointId = uuidv5(block.segmentHash, QDRANT_CODE_BLOCK_NAMESPACE)

					// Get file extension for language detection
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
							// Phase 2: Enhanced metadata
							identifier: block.identifier,
							type: block.type,
							language,
							symbolMetadata: block.symbolMetadata,
							imports: block.imports,
							exports: block.exports,
							documentation: block.documentation,
							// Phase 6: LSP type information
							lspTypeInfo: block.lspTypeInfo,
						},
					}
				})

				// Upsert points to Qdrant
				await this.qdrantClient.upsertPoints(points)
				onBlocksIndexed?.(batchBlocks.length)

				// Also add to BM25 index if available
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
					const bm25Documents: BM25Document[] = batchBlocks.map((block) => {
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

				// Also add to Neo4j graph if available
				if (this.graphIndexer) {
					try {
						// Group blocks by file for efficient indexing
						const blocksByFile = new Map<string, CodeBlock[]>()
						for (const block of batchBlocks) {
							if (!blocksByFile.has(block.file_path)) {
								blocksByFile.set(block.file_path, [])
							}
							blocksByFile.get(block.file_path)!.push(block)
						}

						// Update total files count (cumulative across all batches)
						const batchFileCount = blocksByFile.size
						this.neo4jTotalFilesToProcess += batchFileCount

						// Index each file's blocks to Neo4j with mutex protection
						// This prevents race conditions where File A creates relationships to File B's nodes
						// while File B is being re-indexed (delete + create) in a parallel batch
						for (const [filePath, fileBlocks] of blocksByFile) {
							// Acquire mutex before indexing this file
							const release = await neo4jFileMutex.acquire()
							try {
								await this.graphIndexer.indexFile(filePath, fileBlocks)
								this.neo4jCumulativeFilesProcessed++

								// Report cumulative progress
								if (this.stateManager) {
									this.stateManager.reportNeo4jIndexingProgress(
										this.neo4jCumulativeFilesProcessed,
										this.neo4jTotalFilesToProcess,
										"indexing",
										`Indexed ${this.neo4jCumulativeFilesProcessed}/${this.neo4jTotalFilesToProcess} files to graph`,
									)
								}
							} finally {
								release()
							}
						}
					} catch (error) {
						// Log error but don't fail the entire indexing process
						const errorMessage = error instanceof Error ? error.message : String(error)
						console.error(`[DirectoryScanner] Error indexing to Neo4j:`, error)
						if (this.stateManager) {
							this.stateManager.reportNeo4jIndexingProgress(
								0,
								0,
								"error",
								`Graph indexing failed: ${errorMessage}`,
							)
						}
					}
				}

				// Update hashes for successfully processed files in this batch
				for (const fileInfo of batchFileInfos) {
					await this.cacheManager.updateHash(fileInfo.filePath, fileInfo.fileHash)
				}
				success = true
			} catch (error) {
				lastError = error as Error
				console.error(
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
			console.error(`[DirectoryScanner] Failed to process batch after ${MAX_BATCH_RETRIES} attempts`)
			if (onError) {
				// Preserve the original error message from embedders which now have detailed i18n messages
				const errorMessage = lastError.message || "Unknown error"

				// For other errors, provide context
				onError(
					new Error(
						t("embeddings:scanner.failedToProcessBatchWithError", {
							maxRetries: MAX_BATCH_RETRIES,
							errorMessage,
						}),
					),
				)
			}
		}
	}
}
