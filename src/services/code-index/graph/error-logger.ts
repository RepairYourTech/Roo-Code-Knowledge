import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

/**
 * Supported codebase indexing services
 */
export type CodebaseIndexService = "neo4j" | "qdrant" | "bm25" | "tree-sitter" | "ast" | "lsp" | "parser" | "embedder"

/**
 * Error log entry for codebase indexing services
 */
export interface CodebaseIndexErrorEntry {
	timestamp: string
	service: CodebaseIndexService
	filePath?: string
	operation: string
	error: string
	stack?: string
	blockType?: string
	blockIdentifier?: string
	nodeId?: string
	additionalContext?: Record<string, any>
}

/**
 * Legacy type alias for backward compatibility
 * @deprecated Use CodebaseIndexErrorEntry instead
 */
export type GraphIndexErrorEntry = CodebaseIndexErrorEntry

/**
 * Persistent error logger for all codebase indexing services
 * Writes errors to a unified log file that persists across sessions
 *
 * Supports logging errors from:
 * - Neo4j graph database
 * - Qdrant vector store
 * - BM25 search index
 * - Tree-sitter parser
 * - AST analysis
 * - LSP integration
 * - Code parsers
 * - Embedding providers
 */
export class CodebaseIndexErrorLogger {
	private logFilePath: string
	private errorBuffer: CodebaseIndexErrorEntry[] = []
	private flushTimer: NodeJS.Timeout | null = null
	private readonly FLUSH_INTERVAL_MS = 5000 // Flush every 5 seconds
	private readonly MAX_BUFFER_SIZE = 100 // Flush if buffer exceeds this size

	constructor(private readonly context: vscode.ExtensionContext) {
		// Store log file in extension's global storage path
		const storagePath = context.globalStorageUri.fsPath
		this.logFilePath = path.join(storagePath, "codebase-index-errors.log")
		console.log(`[CodebaseIndexErrorLogger] Error log file: ${this.logFilePath}`)
		this.ensureLogDirectory()
	}

	/**
	 * Ensure the log directory exists
	 */
	private async ensureLogDirectory(): Promise<void> {
		try {
			const dir = path.dirname(this.logFilePath)
			await fs.mkdir(dir, { recursive: true })
		} catch (error) {
			console.error(`[${this.constructor.name}] Failed to create log directory:`, error)
		}
	}

	/**
	 * Log an error with full context
	 */
	async logError(entry: Omit<CodebaseIndexErrorEntry, "timestamp">): Promise<void> {
		const fullEntry: CodebaseIndexErrorEntry = {
			...entry,
			timestamp: new Date().toISOString(),
		}

		// Add to buffer
		this.errorBuffer.push(fullEntry)

		// Also log to console for immediate visibility
		const serviceLabel = entry.service.toUpperCase()
		const fileContext = entry.filePath ? ` - ${entry.filePath}` : ""
		console.error(
			`[${serviceLabel} Error] ${entry.operation}${fileContext}:`,
			entry.error,
			entry.additionalContext || "",
		)

		// Flush if buffer is full
		if (this.errorBuffer.length >= this.MAX_BUFFER_SIZE) {
			await this.flush()
		} else {
			// Schedule flush
			this.scheduleFlush()
		}
	}

	/**
	 * Schedule a flush operation
	 */
	private scheduleFlush(): void {
		if (this.flushTimer) {
			return // Already scheduled
		}

		this.flushTimer = setTimeout(() => {
			this.flush()
			this.flushTimer = null
		}, this.FLUSH_INTERVAL_MS)
	}

	/**
	 * Flush buffered errors to disk
	 */
	async flush(): Promise<void> {
		if (this.errorBuffer.length === 0) {
			return
		}

		// Move entriesToWrite declaration outside try so it's available in catch
		let entriesToWrite: any[] = []
		try {
			// Get current buffer and clear it
			entriesToWrite = [...this.errorBuffer]
			this.errorBuffer = []

			// Format entries as JSON lines
			const lines = entriesToWrite.map((entry) => JSON.stringify(entry)).join("\n") + "\n"

			// Append to log file
			await fs.appendFile(this.logFilePath, lines, "utf-8")
		} catch (error) {
			console.error(`[${this.constructor.name}] Failed to write to log file:`, error)
			// Put entries back in buffer using the captured entries
			if (entriesToWrite.length > 0) {
				this.errorBuffer.unshift(...entriesToWrite)
			}
		}
	}

	/**
	 * Get the log file path
	 */
	getLogFilePath(): string {
		return this.logFilePath
	}

	/**
	 * Read all errors from the log file
	 */
	async readErrors(limit?: number): Promise<CodebaseIndexErrorEntry[]> {
		try {
			const content = await fs.readFile(this.logFilePath, "utf-8")
			const lines = content.trim().split("\n").filter(Boolean)

			const errors = lines
				.map((line) => {
					try {
						return JSON.parse(line) as CodebaseIndexErrorEntry
					} catch {
						return null
					}
				})
				.filter((e): e is CodebaseIndexErrorEntry => e !== null)

			// Return most recent errors first
			errors.reverse()

			return limit ? errors.slice(0, limit) : errors
		} catch (error) {
			if ((error as any).code === "ENOENT") {
				return [] // File doesn't exist yet
			}
			throw error
		}
	}

	/**
	 * Get errors for a specific service
	 */
	async getErrorsForService(service: CodebaseIndexService, limit?: number): Promise<CodebaseIndexErrorEntry[]> {
		const allErrors = await this.readErrors()
		const serviceErrors = allErrors.filter((e) => e.service === service)
		return limit ? serviceErrors.slice(0, limit) : serviceErrors
	}

	/**
	 * Get errors for a specific file
	 */
	async getErrorsForFile(filePath: string, limit?: number): Promise<CodebaseIndexErrorEntry[]> {
		const allErrors = await this.readErrors()
		const fileErrors = allErrors.filter((e) => e.filePath === filePath)
		return limit ? fileErrors.slice(0, limit) : fileErrors
	}

	/**
	 * Get errors for a specific service and file
	 */
	async getErrorsForServiceAndFile(
		service: CodebaseIndexService,
		filePath: string,
		limit?: number,
	): Promise<CodebaseIndexErrorEntry[]> {
		const allErrors = await this.readErrors()
		const filtered = allErrors.filter((e) => e.service === service && e.filePath === filePath)
		return limit ? filtered.slice(0, limit) : filtered
	}

	/**
	 * Clear the error log
	 */
	async clearLog(): Promise<void> {
		try {
			await fs.unlink(this.logFilePath)
		} catch (error) {
			if ((error as any).code !== "ENOENT") {
				throw error
			}
		}
	}

	/**
	 * Get error statistics
	 */
	async getErrorStats(): Promise<{
		totalErrors: number
		errorsByService: Record<string, number>
		errorsByOperation: Record<string, number>
		errorsByFile: Record<string, number>
		recentErrors: CodebaseIndexErrorEntry[]
	}> {
		const errors = await this.readErrors()

		const errorsByService: Record<string, number> = {}
		const errorsByOperation: Record<string, number> = {}
		const errorsByFile: Record<string, number> = {}

		for (const error of errors) {
			errorsByService[error.service] = (errorsByService[error.service] || 0) + 1
			errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1
			if (error.filePath) {
				errorsByFile[error.filePath] = (errorsByFile[error.filePath] || 0) + 1
			}
		}

		return {
			totalErrors: errors.length,
			errorsByService,
			errorsByOperation,
			errorsByFile,
			recentErrors: errors.slice(0, 10),
		}
	}

	/**
	 * Dispose and flush any remaining errors
	 */
	async dispose(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}
		await this.flush()
	}
}

/**
 * Legacy class alias for backward compatibility
 * @deprecated Use CodebaseIndexErrorLogger instead
 */
export class GraphIndexErrorLogger extends CodebaseIndexErrorLogger {
	constructor(context: vscode.ExtensionContext) {
		super(context)
		console.warn("[GraphIndexErrorLogger] This class is deprecated. Use CodebaseIndexErrorLogger instead.")
	}
}
