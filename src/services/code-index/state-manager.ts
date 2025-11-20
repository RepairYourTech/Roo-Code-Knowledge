import * as vscode from "vscode"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _processedItems: number = 0
	private _totalItems: number = 0
	private _currentItemUnit: string = "blocks"
	// Neo4j graph indexing progress tracking
	private _neo4jProcessedItems: number = 0
	private _neo4jTotalItems: number = 0
	private _neo4jStatus: "idle" | "indexing" | "indexed" | "error" | "disabled" = "disabled"
	private _neo4jMessage: string = ""
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
				// Optionally clear the message or set a default for non-indexing states
				if (newState === "Standby" && message === undefined) this._statusMessage = "Ready."
				if (newState === "Indexed" && message === undefined) this._statusMessage = "Index up-to-date."
				if (newState === "Error" && message === undefined) this._statusMessage = "An error occurred."
			}

			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	public reportBlockIndexingProgress(processedItems: number, totalItems: number): void {
		const progressChanged = processedItems !== this._processedItems || totalItems !== this._totalItems

		// Update if progress changes OR if the system wasn't already in 'Indexing' state
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedItems
			this._totalItems = totalItems
			this._currentItemUnit = "blocks"

			// Calculate combined progress if Neo4j is also indexing
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
			} else {
				// Just vector indexing
				message = `Indexed ${this._processedItems} / ${this._totalItems} ${this._currentItemUnit} found`
			}

			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._systemStatus = "Indexing" // Ensure state is Indexing
			this._statusMessage = message

			// Only fire update if status, message or progress actually changed
			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
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

			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._statusMessage = message

			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	// --- Neo4j Graph Indexing Progress ---

	/**
	 * Report Neo4j graph indexing progress
	 * @param processedItems Number of items processed
	 * @param totalItems Total number of items to process
	 * @param status Current Neo4j indexing status
	 * @param message Optional status message
	 */
	public reportNeo4jIndexingProgress(
		processedItems: number,
		totalItems: number,
		status?: "idle" | "indexing" | "indexed" | "error" | "disabled",
		message?: string,
	): void {
		const progressChanged = processedItems !== this._neo4jProcessedItems || totalItems !== this._neo4jTotalItems
		const statusChanged = status !== undefined && status !== this._neo4jStatus
		const messageChanged = message !== undefined && message !== this._neo4jMessage

		if (progressChanged || statusChanged || messageChanged) {
			this._neo4jProcessedItems = processedItems
			this._neo4jTotalItems = totalItems
			if (status !== undefined) this._neo4jStatus = status
			if (message !== undefined) this._neo4jMessage = message

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

			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	/**
	 * Set Neo4j status without changing progress counts
	 * @param status Neo4j indexing status
	 * @param message Optional status message
	 */
	public setNeo4jStatus(status: "idle" | "indexing" | "indexed" | "error" | "disabled", message?: string): void {
		if (status !== this._neo4jStatus || (message !== undefined && message !== this._neo4jMessage)) {
			this._neo4jStatus = status
			if (message !== undefined) this._neo4jMessage = message
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
