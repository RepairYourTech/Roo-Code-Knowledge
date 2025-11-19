import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

/**
 * Error log entry for Neo4j graph indexing
 */
export interface GraphIndexErrorEntry {
	timestamp: string
	filePath: string
	operation: string
	error: string
	stack?: string
	blockType?: string
	blockIdentifier?: string
	nodeId?: string
	additionalContext?: Record<string, any>
}

/**
 * Persistent error logger for Neo4j graph indexing
 * Writes errors to a log file that persists across sessions
 */
export class GraphIndexErrorLogger {
	private logFilePath: string
	private errorBuffer: GraphIndexErrorEntry[] = []
	private flushTimer: NodeJS.Timeout | null = null
	private readonly FLUSH_INTERVAL_MS = 5000 // Flush every 5 seconds
	private readonly MAX_BUFFER_SIZE = 100 // Flush if buffer exceeds this size

	constructor(private readonly context: vscode.ExtensionContext) {
		// Store log file in extension's global storage path
		const storagePath = context.globalStorageUri.fsPath
		this.logFilePath = path.join(storagePath, "neo4j-graph-errors.log")
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
			console.error("[GraphIndexErrorLogger] Failed to create log directory:", error)
		}
	}

	/**
	 * Log an error with full context
	 */
	async logError(entry: Omit<GraphIndexErrorEntry, "timestamp">): Promise<void> {
		const fullEntry: GraphIndexErrorEntry = {
			...entry,
			timestamp: new Date().toISOString(),
		}

		// Add to buffer
		this.errorBuffer.push(fullEntry)

		// Also log to console for immediate visibility
		console.error(
			`[Neo4j Graph Error] ${entry.operation} - ${entry.filePath}:`,
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

		try {
			// Get current buffer and clear it
			const entriesToWrite = [...this.errorBuffer]
			this.errorBuffer = []

			// Format entries as JSON lines
			const lines = entriesToWrite.map((entry) => JSON.stringify(entry)).join("\n") + "\n"

			// Append to log file
			await fs.appendFile(this.logFilePath, lines, "utf-8")
		} catch (error) {
			console.error("[GraphIndexErrorLogger] Failed to write to log file:", error)
			// Put entries back in buffer
			this.errorBuffer.unshift(...this.errorBuffer)
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
	async readErrors(limit?: number): Promise<GraphIndexErrorEntry[]> {
		try {
			const content = await fs.readFile(this.logFilePath, "utf-8")
			const lines = content.trim().split("\n").filter(Boolean)

			const errors = lines
				.map((line) => {
					try {
						return JSON.parse(line) as GraphIndexErrorEntry
					} catch {
						return null
					}
				})
				.filter((e): e is GraphIndexErrorEntry => e !== null)

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
		errorsByOperation: Record<string, number>
		errorsByFile: Record<string, number>
		recentErrors: GraphIndexErrorEntry[]
	}> {
		const errors = await this.readErrors()

		const errorsByOperation: Record<string, number> = {}
		const errorsByFile: Record<string, number> = {}

		for (const error of errors) {
			errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1
			errorsByFile[error.filePath] = (errorsByFile[error.filePath] || 0) + 1
		}

		return {
			totalErrors: errors.length,
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
