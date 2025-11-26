import * as vscode from "vscode"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Enhanced Neo4j status with more granular states
export type Neo4jStatus =
	| "idle"
	| "indexing"
	| "indexed"
	| "error"
	| "disabled"
	| "connection-failed"
	| "resource-exhausted"

// Vector indexing status for better separation
export type VectorStatus = "idle" | "indexing" | "indexed" | "error"

// Overall system health status
export type SystemHealth = "healthy" | "degraded" | "failed"

// Error categorization for better user guidance
export type ErrorCategory = "connection" | "authentication" | "rate-limit" | "configuration" | "unknown"

export interface IndexingComponentStatus {
	vector: {
		status: VectorStatus
		processedItems: number
		totalItems: number
		message?: string
		errorCategory?: ErrorCategory
		errorTimestamp?: number
		retrySuggestion?: string
	}
	neo4j: {
		status: Neo4jStatus
		processedItems: number
		totalItems: number
		message?: string
		lastError?: string
		consecutiveFailures: number
		errorCategory?: ErrorCategory
		errorTimestamp?: number
		retrySuggestion?: string
	}
	system: {
		health: SystemHealth
		overallState: IndexingState
		message: string
	}
}

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _processedItems: number = 0
	private _totalItems: number = 0
	private _currentItemUnit: string = "blocks"

	// Enhanced Neo4j graph indexing progress tracking
	private _neo4jProcessedItems: number = 0
	private _neo4jTotalItems: number = 0
	private _neo4jStatus: Neo4jStatus = "disabled"
	private _neo4jMessage: string = ""
	private _neo4jLastError: string = ""
	private _neo4jConsecutiveFailures: number = 0

	// Vector indexing status tracking
	private _vectorStatus: VectorStatus = "idle"
	private _vectorMessage: string = ""

	// System health tracking
	private _systemHealth: SystemHealth = "healthy"

	// Detailed error tracking for vector store
	private _vectorErrorCategory: ErrorCategory | undefined
	private _vectorErrorTimestamp: number | undefined
	private _vectorRetrySuggestion: string | undefined

	// Detailed error tracking for Neo4j
	private _neo4jErrorCategory: ErrorCategory | undefined
	private _neo4jErrorTimestamp: number | undefined
	private _neo4jRetrySuggestion: string | undefined

	// File discovery metrics
	private _filesDiscovered: number = 0
	private _filesFilteredByRooignore: number = 0
	private _filesFilteredByExtension: number = 0
	private _filesSkippedBySize: number = 0
	private _filesSkippedByCache: number = 0
	private _filesActivelyIndexing: number = 0

	private _progressEmitter = new vscode.EventEmitter<ReturnType<typeof this.getCurrentStatus>>()

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			message: this._statusMessage,
			processedItems: this._processedItems,
			totalItems: this._totalItems,
			currentItemUnit: this._currentItemUnit,
			// Neo4j graph indexing status
			neo4jProcessedItems: this._neo4jProcessedItems,
			neo4jTotalItems: this._neo4jTotalItems,
			neo4jStatus: this._neo4jStatus,
			neo4jMessage: this._neo4jMessage,
			neo4jLastError: this._neo4jLastError,
			neo4jConsecutiveFailures: this._neo4jConsecutiveFailures,
			neo4jErrorCategory: this._neo4jErrorCategory,
			neo4jErrorTimestamp: this._neo4jErrorTimestamp,
			neo4jRetrySuggestion: this._neo4jRetrySuggestion,
			// Vector indexing status
			vectorStatus: this._vectorStatus,
			vectorMessage: this._vectorMessage,
			vectorErrorCategory: this._vectorErrorCategory,
			vectorErrorTimestamp: this._vectorErrorTimestamp,
			vectorRetrySuggestion: this._vectorRetrySuggestion,
			// System health
			systemHealth: this._systemHealth,
			// File discovery metrics
			filesDiscovered: this._filesDiscovered,
			filesFilteredByRooignore: this._filesFilteredByRooignore,
			filesFilteredByExtension: this._filesFilteredByExtension,
			filesSkippedBySize: this._filesSkippedBySize,
			filesSkippedByCache: this._filesSkippedByCache,
			filesActivelyIndexing: this._filesActivelyIndexing,
		}
	}

	/**
	 * Get detailed component status for better monitoring
	 */
	public getComponentStatus(): IndexingComponentStatus {
		return {
			vector: {
				status: this._vectorStatus,
				processedItems: this._processedItems,
				totalItems: this._totalItems,
				message: this._vectorMessage,
				errorCategory: this._vectorErrorCategory,
				errorTimestamp: this._vectorErrorTimestamp,
				retrySuggestion: this._vectorRetrySuggestion,
			},
			neo4j: {
				status: this._neo4jStatus,
				processedItems: this._neo4jProcessedItems,
				totalItems: this._neo4jTotalItems,
				message: this._neo4jMessage,
				lastError: this._neo4jLastError,
				consecutiveFailures: this._neo4jConsecutiveFailures,
				errorCategory: this._neo4jErrorCategory,
				errorTimestamp: this._neo4jErrorTimestamp,
				retrySuggestion: this._neo4jRetrySuggestion,
			},
			system: {
				health: this._systemHealth,
				overallState: this._systemStatus,
				message: this._statusMessage,
			},
		}
	}

	/**
	 * Categorize an error and provide retry suggestion
	 */
	public categorizeError(error: Error | string): { category: ErrorCategory; retrySuggestion: string } {
		const errorMessage = typeof error === "string" ? error : error.message
		const lowerMessage = errorMessage.toLowerCase()

		// Check for connection errors
		if (
			lowerMessage.includes("econnrefused") ||
			lowerMessage.includes("etimedout") ||
			lowerMessage.includes("network") ||
			lowerMessage.includes("unreachable") ||
			lowerMessage.includes("connect")
		) {
			return {
				category: "connection",
				retrySuggestion: "Verify service is running and accessible",
			}
		}

		// Check for authentication errors
		if (
			lowerMessage.includes("authentication") ||
			lowerMessage.includes("unauthorized") ||
			lowerMessage.includes("401") ||
			lowerMessage.includes("403") ||
			lowerMessage.includes("invalid credentials") ||
			lowerMessage.includes("api key")
		) {
			return {
				category: "authentication",
				retrySuggestion: "Check API key or credentials",
			}
		}

		// Check for rate limit errors
		if (
			lowerMessage.includes("rate limit") ||
			lowerMessage.includes("429") ||
			lowerMessage.includes("quota") ||
			lowerMessage.includes("too many requests")
		) {
			return {
				category: "rate-limit",
				retrySuggestion: "Wait and retry, or upgrade your plan",
			}
		}

		// Check for configuration errors
		if (
			lowerMessage.includes("configuration") ||
			lowerMessage.includes("invalid url") ||
			lowerMessage.includes("missing")
		) {
			return {
				category: "configuration",
				retrySuggestion: "Review your settings",
			}
		}

		// Default to unknown
		return {
			category: "unknown",
			retrySuggestion: "Check logs for details and retry",
		}
	}

	// --- State Management ---

	public setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}

			// Reset progress counters if moving to a non-indexing state or starting fresh
			if (newState !== "Indexing") {
				this._processedItems = 0
				this._totalItems = 0

				this._currentItemUnit = "blocks" // Reset to default unit

				// Reset file discovery metrics only if not transitioning to Indexed state
				// This allows users to see what happened during the scan even after it completes
				if (newState !== "Indexed") {
					this._filesDiscovered = 0
					this._filesFilteredByRooignore = 0
					this._filesFilteredByExtension = 0
					this._filesSkippedBySize = 0
					this._filesSkippedByCache = 0
					this._filesActivelyIndexing = 0
				}

				// Reset component statuses appropriately
				if (newState === "Standby") {
					this._vectorStatus = "idle"
					if (this._neo4jStatus !== "disabled" && this._neo4jStatus !== "error") {
						this._neo4jStatus = "idle"
					}
					if (message === undefined) this._statusMessage = "Ready."
				} else if (newState === "Indexed") {
					this._vectorStatus = "indexed"
					if (this._neo4jStatus === "indexing") {
						this._neo4jStatus = "indexed"
					}
					if (message === undefined) this._statusMessage = "Index up-to-date."
				} else if (newState === "Error") {
					this._vectorStatus = "error"
					if (message === undefined) this._statusMessage = "An error occurred."
				}
			}

			this._updateSystemHealth()
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Update system health based on component statuses
	 */
	private _updateSystemHealth(): void {
		const vectorHealthy = this._vectorStatus !== "error"
		const neo4jHealthy = !["error", "connection-failed", "resource-exhausted"].includes(this._neo4jStatus)

		if (vectorHealthy && neo4jHealthy) {
			this._systemHealth = "healthy"
		} else if (vectorHealthy || neo4jHealthy) {
			this._systemHealth = "degraded"
		} else {
			this._systemHealth = "failed"
		}
	}

	public reportBlockIndexingProgress(processedItems: number, totalItems: number): void {
		const progressChanged = processedItems !== this._processedItems || totalItems !== this._totalItems

		// Update if progress changes OR if the system wasn't already in 'Indexing' state
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedItems
			this._totalItems = totalItems
			this._currentItemUnit = "blocks"
			this._vectorStatus = "indexing"

			// Calculate combined progress with better status messages
			let message: string
			if (this._neo4jStatus === "indexing" && this._neo4jTotalItems > 0) {
				// Calculate combined percentage: (vector progress + neo4j progress) / 2
				const vectorPercent =
					this._totalItems > 0 ? Math.round((this._processedItems / this._totalItems) * 100) : 0
				const neo4jPercent =
					this._neo4jTotalItems > 0
						? Math.round((this._neo4jProcessedItems / this._neo4jTotalItems) * 100)
						: 0
				const combinedPercent = Math.round((vectorPercent + neo4jPercent) / 2)
				message = `Indexing ${combinedPercent}% complete (Vector: ${vectorPercent}%, Graph: ${neo4jPercent}%)`
			} else if (this._neo4jStatus === "error" || this._neo4jStatus === "connection-failed") {
				// Vector indexing continuing despite Neo4j failure
				const vectorPercent =
					this._totalItems > 0 ? Math.round((this._processedItems / this._totalItems) * 100) : 0
				message = `Vector indexing ${vectorPercent}% complete (Graph indexing unavailable)`
			} else {
				// Just vector indexing
				message = `Indexed ${this._processedItems} / ${this._totalItems} ${this._currentItemUnit} found`
			}

			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._systemStatus = "Indexing" // Ensure state is Indexing
			this._statusMessage = message
			this._vectorMessage = `Processing ${this._processedItems}/${this._totalItems} blocks`

			// Only fire update if status, message or progress actually changed
			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._updateSystemHealth()
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	public reportFileQueueProgress(processedFiles: number, totalFiles: number, currentFileBasename?: string): void {
		const progressChanged = processedFiles !== this._processedItems || totalFiles !== this._totalItems

		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedFiles
			this._totalItems = totalFiles
			this._currentItemUnit = "files"
			this._systemStatus = "Indexing"
			this._vectorStatus = "indexing"

			let message: string
			if (totalFiles > 0 && processedFiles < totalFiles) {
				message = `Processing ${processedFiles} / ${totalFiles} ${this._currentItemUnit}. Current: ${
					currentFileBasename || "..."
				}`
			} else if (totalFiles > 0 && processedFiles === totalFiles) {
				message = `Finished processing ${totalFiles} ${this._currentItemUnit} from queue.`
			} else {
				message = `File queue processed.`
			}

			this._vectorMessage = message

			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._statusMessage = message

			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._updateSystemHealth()
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	public reportFileDiscoveryMetrics(
		filesDiscovered: number,
		filesFilteredByRooignore: number,
		filesFilteredByExtension: number,
		filesSkippedBySize: number,
		filesSkippedByCache: number,
		filesActivelyIndexing: number,
	): void {
		const changed =
			filesDiscovered !== this._filesDiscovered ||
			filesFilteredByRooignore !== this._filesFilteredByRooignore ||
			filesFilteredByExtension !== this._filesFilteredByExtension ||
			filesSkippedBySize !== this._filesSkippedBySize ||
			filesSkippedByCache !== this._filesSkippedByCache ||
			filesActivelyIndexing !== this._filesActivelyIndexing

		if (changed) {
			this._filesDiscovered = filesDiscovered
			this._filesFilteredByRooignore = filesFilteredByRooignore
			this._filesFilteredByExtension = filesFilteredByExtension
			this._filesSkippedBySize = filesSkippedBySize
			this._filesSkippedByCache = filesSkippedByCache
			this._filesActivelyIndexing = filesActivelyIndexing

			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	// --- Neo4j Graph Indexing Progress ---

	/**
	 * Report Neo4j graph indexing progress
	 * @param processedItems Number of items processed
	 * @param totalItems Total number of items to process
	 * @param status Current Neo4j indexing status
	 * @param message Optional status message
	 * @param error Optional error information
	 */
	public reportNeo4jIndexingProgress(
		processedItems: number,
		totalItems: number,
		status?: Neo4jStatus,
		message?: string,
		error?: string,
	): void {
		const progressChanged = processedItems !== this._neo4jProcessedItems || totalItems !== this._neo4jTotalItems
		const statusChanged = status !== undefined && status !== this._neo4jStatus
		const messageChanged = message !== undefined && message !== this._neo4jMessage

		if (progressChanged || statusChanged || messageChanged) {
			this._neo4jProcessedItems = processedItems
			this._neo4jTotalItems = totalItems
			if (status !== undefined) {
				this._neo4jStatus = status
				// Track consecutive failures for circuit breaker logic
				if (status === "error" || status === "connection-failed" || status === "resource-exhausted") {
					this._neo4jConsecutiveFailures++
				} else if (status === "indexed" || status === "idle") {
					this._neo4jConsecutiveFailures = 0
				}
			}
			if (message !== undefined) this._neo4jMessage = message
			if (error !== undefined) this._neo4jLastError = error

			// If we're currently indexing and Neo4j progress changed, update the combined status message
			if (this._systemStatus === "Indexing" && progressChanged && this._neo4jStatus === "indexing") {
				const vectorPercent =
					this._totalItems > 0 ? Math.round((this._processedItems / this._totalItems) * 100) : 0
				const neo4jPercent =
					this._neo4jTotalItems > 0
						? Math.round((this._neo4jProcessedItems / this._neo4jTotalItems) * 100)
						: 0
				const combinedPercent = Math.round((vectorPercent + neo4jPercent) / 2)
				this._statusMessage = `Indexing ${combinedPercent}% complete (Vector: ${vectorPercent}%, Graph: ${neo4jPercent}%)`
			}

			this._updateSystemHealth()
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Set Neo4j status without changing progress counts
	 * @param status Neo4j indexing status
	 * @param message Optional status message
	 * @param error Optional error information
	 * @param errorCategory Optional error category
	 * @param retrySuggestion Optional retry suggestion
	 */
	public setNeo4jStatus(
		status: Neo4jStatus,
		message?: string,
		error?: string,
		errorCategory?: ErrorCategory,
		retrySuggestion?: string,
	): void {
		if (status !== this._neo4jStatus || (message !== undefined && message !== this._neo4jMessage)) {
			this._neo4jStatus = status
			if (message !== undefined) this._neo4jMessage = message
			if (error !== undefined) {
				this._neo4jLastError = error
				this._neo4jConsecutiveFailures++
				this._neo4jErrorCategory = errorCategory
				this._neo4jErrorTimestamp = Date.now()
				this._neo4jRetrySuggestion = retrySuggestion
			} else if (["indexed", "idle"].includes(status)) {
				this._neo4jConsecutiveFailures = 0
				this._neo4jErrorCategory = undefined
				this._neo4jErrorTimestamp = undefined
				this._neo4jRetrySuggestion = undefined
			}

			// Update system state based on Neo4j status if critical
			if (status === "connection-failed" || status === "resource-exhausted") {
				// Don't fail the entire system, just mark as degraded
				if (this._systemStatus === "Indexing") {
					const suffix = " (Graph indexing degraded)"
					// Remove any existing degradation suffix and add the new one
					this._statusMessage = this._statusMessage.replace(/\s*\(.*indexing.*degraded.*\)/, "") + suffix
				}
			}

			this._updateSystemHealth()
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Set vector indexing status independently
	 * @param status Vector indexing status
	 * @param message Optional status message
	 * @param errorCategory Optional error category
	 * @param errorMessage Optional error message. If provided and status is 'error', this will be used as the vector message if 'message' is not provided.
	 * @param retrySuggestion Optional retry suggestion
	 */
	public setVectorStatus(
		status: VectorStatus,
		message?: string,
		errorCategory?: ErrorCategory,
		errorMessage?: string,
		retrySuggestion?: string,
	): void {
		let finalMessage = message

		// If status is error and no message provided but errorMessage is, use errorMessage
		if (status === "error" && !finalMessage && errorMessage) {
			finalMessage = errorMessage
		}

		if (status !== this._vectorStatus || (finalMessage !== undefined && finalMessage !== this._vectorMessage)) {
			this._vectorStatus = status
			if (finalMessage !== undefined) this._vectorMessage = finalMessage

			// Set error details when status is error
			if (status === "error") {
				this._vectorErrorCategory = errorCategory
				this._vectorErrorTimestamp = Date.now()
				this._vectorRetrySuggestion = retrySuggestion
			} else if (status === "indexed" || status === "idle") {
				// Clear error details on success
				this._vectorErrorCategory = undefined
				this._vectorErrorTimestamp = undefined
				this._vectorRetrySuggestion = undefined
			}

			this._updateSystemHealth()
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Get Neo4j consecutive failure count for circuit breaker logic
	 */
	public getNeo4jConsecutiveFailures(): number {
		return this._neo4jConsecutiveFailures
	}

	/**
	 * Reset Neo4j consecutive failure count (for circuit breaker reset)
	 */
	public resetNeo4jConsecutiveFailures(): void {
		this._neo4jConsecutiveFailures = 0
		this._neo4jLastError = ""
		if (this._neo4jStatus === "error" || this._neo4jStatus === "connection-failed") {
			this._neo4jStatus = "idle"
		}
		this._progressEmitter.fire(this.getCurrentStatus())
	}

	/**
	 * Check if system is in degraded mode (one component failed, other working)
	 */
	public isSystemDegraded(): boolean {
		return this._systemHealth === "degraded"
	}

	/**
	 * Check if system has completely failed (both components failed)
	 */
	public isSystemFailed(): boolean {
		return this._systemHealth === "failed"
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
