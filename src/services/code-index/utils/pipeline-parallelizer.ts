/**
 * Pipeline parallelization utilities for improved throughput
 * Implements producer-consumer pattern with intelligent retry and backoff
 */

/**
 * Task queue item for parallel processing
 */
export interface QueueTask<T> {
	id: string
	data: T
	priority: number
	attempts: number
	maxAttempts: number
	createdAt: number
	scheduledAt?: number
	retryDelay?: number
	onProgress?: (progress: number) => void
}

/**
 * Parallel processing configuration
 */
export interface ParallelProcessingConfig {
	maxConcurrency: number
	maxQueueSize: number
	retryStrategy: "exponential" | "linear" | "fixed"
	baseRetryDelay: number // milliseconds
	maxRetryDelay: number // milliseconds
	deadlockDetection: boolean
	deadlockTimeout: number // milliseconds
	healthCheckInterval: number // milliseconds
}

/**
 * Processing statistics
 */
export interface ProcessingStats {
	totalTasks: number
	completedTasks: number
	failedTasks: number
	averageProcessingTime: number
	throughput: number // tasks per second
	concurrentWorkers: number
	queueSize: number
	errorRate: number
}

/**
 * Pipeline parallelizer implementing producer-consumer pattern with intelligent retry
 */
export class PipelineParallelizer<T, R> {
	private readonly config: ParallelProcessingConfig
	private taskQueue: QueueTask<T>[] = []
	private activeWorkers = new Map<string, { worker: Promise<R>; startTime: number }>()
	private processingStats: ProcessingStats = {
		totalTasks: 0,
		completedTasks: 0,
		failedTasks: 0,
		averageProcessingTime: 0,
		throughput: 0,
		concurrentWorkers: 0,
		queueSize: 0,
		errorRate: 0,
	}
	private healthCheckTimer?: NodeJS.Timeout
	private isShutdown = false

	// Event handlers
	private onTaskComplete?: (task: QueueTask<T>, result: R) => void
	private onTaskError?: (task: QueueTask<T>, error: Error) => void
	private onTaskProgress?: (task: QueueTask<T>, progress: number) => void

	constructor(config: Partial<ParallelProcessingConfig> = {}) {
		this.config = {
			maxConcurrency: 10,
			maxQueueSize: 1000,
			retryStrategy: "exponential",
			baseRetryDelay: 1000,
			maxRetryDelay: 30000,
			deadlockDetection: true,
			deadlockTimeout: 30000,
			healthCheckInterval: 5000,
			...config,
		}
	}

	/**
	 * Set event handlers
	 */
	setEventHandlers(handlers: {
		onTaskComplete?: (task: QueueTask<T>, result: R) => void
		onTaskError?: (task: QueueTask<T>, error: Error) => void
		onTaskProgress?: (task: QueueTask<T>, progress: number) => void
	}): void {
		this.onTaskComplete = handlers.onTaskComplete
		this.onTaskError = handlers.onTaskError
		this.onTaskProgress = handlers.onTaskProgress
	}

	/**
	 * Add a task to the queue
	 */
	addTask(task: Omit<QueueTask<T>, "id" | "createdAt" | "attempts">): string {
		const taskId = this.generateTaskId()
		const queueTask: QueueTask<T> = {
			...task,
			id: taskId,
			createdAt: Date.now(),
			attempts: 0,
			maxAttempts: task.maxAttempts || 3,
		}

		// Check queue size limit
		if (this.taskQueue.length >= this.config.maxQueueSize) {
			console.warn(
				`[PipelineParallelizer] Task queue full (${this.taskQueue.length}/${this.config.maxQueueSize})`,
			)
			throw new Error("Task queue is full")
		}

		this.taskQueue.push(queueTask)
		this.processingStats.totalTasks++
		this.updateStats()

		// Trigger processing
		setImmediate(() => this.processQueue())

		return taskId
	}

	/**
	 * Process tasks from queue with concurrency control
	 */
	private async processQueue(): Promise<void> {
		if (this.isShutdown) {
			return
		}

		// Check if we can start more workers
		while (this.activeWorkers.size < this.config.maxConcurrency && this.taskQueue.length > 0) {
			const task = this.taskQueue.shift()
			if (!task) break

			// Calculate retry delay if this is a retry
			if (task.attempts > 0 && task.retryDelay) {
				await new Promise((resolve) => setTimeout(resolve, task.retryDelay))
			}

			// Start worker
			const workerPromise = this.executeTask(task)
			this.activeWorkers.set(task.id, {
				worker: workerPromise,
				startTime: Date.now(),
			})

			// Handle completion
			workerPromise
				.then((result) => {
					this.activeWorkers.delete(task.id)
					this.processingStats.completedTasks++
					this.updateStats()
					this.onTaskComplete?.(task, result)
				})
				.catch((error) => {
					this.activeWorkers.delete(task.id)
					this.handleTaskError(task, error)
				})
		}
	}

	/**
	 * Execute a single task with error handling and retry logic
	 */
	private async executeTask(task: QueueTask<T>): Promise<R> {
		const startTime = Date.now()

		try {
			// Detect potential deadlocks
			if (this.config.deadlockDetection) {
				this.checkForDeadlocks(task)
			}

			// Report progress start
			this.onTaskProgress?.(task, 0)

			// Execute the actual task (this would be injected)
			const result = await this.performTask(task)

			// Report progress completion
			this.onTaskProgress?.(task, 100)

			return result
		} catch (error) {
			const processingTime = Date.now() - startTime
			console.error(`[PipelineParallelizer] Task ${task.id} failed:`, error)

			// Re-throw to trigger retry logic
			throw error
		}
	}

	/**
	 * Handle task errors and schedule retries if appropriate
	 */
	private handleTaskError(task: QueueTask<T>, error: Error): void {
		task.attempts++

		// Calculate retry delay based on strategy
		let retryDelay = this.config.baseRetryDelay
		if (this.config.retryStrategy === "exponential") {
			retryDelay = Math.min(
				this.config.baseRetryDelay * Math.pow(2, task.attempts - 1),
				this.config.maxRetryDelay,
			)
		} else if (this.config.retryStrategy === "linear") {
			retryDelay = Math.min(this.config.baseRetryDelay * task.attempts, this.config.maxRetryDelay)
		}

		// Determine if we should retry
		const shouldRetry = task.attempts < task.maxAttempts && this.isRetryableError(error)

		if (shouldRetry) {
			// Schedule retry
			const retryTask: QueueTask<T> = {
				...task,
				attempts: task.attempts,
				retryDelay,
			}

			// Insert back into queue with priority
			this.insertTaskByPriority(retryTask)
			this.onTaskError?.(task, error)
		} else {
			// Mark as failed
			this.processingStats.failedTasks++
			this.updateStats()
			this.onTaskError?.(task, error)
		}
	}

	/**
	 * Check if an error is retryable
	 */
	private isRetryableError(error: Error): boolean {
		// Network errors, timeouts, and temporary failures are retryable
		const retryablePatterns = [
			/ECONNRESET/,
			/ETIMEDOUT/,
			/ENOTFOUND/,
			/ECONNREFUSED/,
			/network/i,
			/timeout/i,
			/rate limit/i,
			/temporary/i,
			/busy/i,
		]

		const errorMessage = error.message.toLowerCase()
		return retryablePatterns.some((pattern) => pattern.test(errorMessage))
	}

	/**
	 * Detect potential deadlocks in task processing
	 */
	private checkForDeadlocks(task: QueueTask<T>): void {
		const now = Date.now()
		const taskAge = now - task.createdAt

		if (taskAge > this.config.deadlockTimeout) {
			console.warn(`[PipelineParallelizer] Potential deadlock detected for task ${task.id}, age: ${taskAge}ms`)

			// Cancel the task if it's been waiting too long
			const worker = this.activeWorkers.get(task.id)
			if (worker) {
				// Note: In a real implementation, we'd need a way to cancel the ongoing task
				// For now, we just log the warning
			}
		}
	}

	/**
	 * Insert task by priority (higher priority = processed first)
	 */
	private insertTaskByPriority(task: QueueTask<T>): void {
		let insertIndex = this.taskQueue.length

		for (let i = 0; i < this.taskQueue.length; i++) {
			if (this.taskQueue[i].priority < task.priority) {
				insertIndex = i
				break
			}
		}

		this.taskQueue.splice(insertIndex, 0, task)
	}

	/**
	 * Update processing statistics
	 */
	private updateStats(): void {
		this.processingStats.concurrentWorkers = this.activeWorkers.size
		this.processingStats.queueSize = this.taskQueue.length
		this.processingStats.errorRate =
			this.processingStats.totalTasks > 0 ? this.processingStats.failedTasks / this.processingStats.totalTasks : 0

		// Calculate throughput (tasks per second over last minute)
		const recentCompleted = this.processingStats.completedTasks
		const timeWindow = 60000 // 1 minute
		this.processingStats.throughput = (recentCompleted * 1000) / timeWindow
	}

	/**
	 * Get current processing statistics
	 */
	getStats(): ProcessingStats {
		return { ...this.processingStats }
	}

	/**
	 * Get queue status
	 */
	getQueueStatus(): {
		pending: number
		active: number
		totalProcessed: number
		failed: number
	} {
		return {
			pending: this.taskQueue.length,
			active: this.activeWorkers.size,
			totalProcessed: this.processingStats.completedTasks,
			failed: this.processingStats.failedTasks,
		}
	}

	/**
	 * Start health monitoring
	 */
	startHealthMonitoring(): void {
		this.healthCheckTimer = setInterval(() => {
			this.performHealthCheck()
		}, this.config.healthCheckInterval)
	}

	/**
	 * Stop health monitoring
	 */
	stopHealthMonitoring(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = undefined
		}
	}

	/**
	 * Perform health check and log warnings
	 */
	private performHealthCheck(): void {
		const { pending, active } = this.getQueueStatus()

		if (pending > this.config.maxQueueSize * 0.8) {
			console.warn(`[PipelineParallelizer] High queue backlog: ${pending} tasks pending`)
		}

		if (active === this.config.maxConcurrency) {
			console.warn(`[PipelineParallelizer] Max concurrency reached: ${active} workers active`)
		}

		if (this.processingStats.errorRate > 0.1) {
			console.warn(
				`[PipelineParallelizer] High error rate: ${(this.processingStats.errorRate * 100).toFixed(1)}%`,
			)
		}
	}

	/**
	 * Generate unique task ID
	 */
	private generateTaskId(): string {
		return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Abstract method to be implemented by concrete classes
	 * This method should contain the actual task execution logic
	 */
	protected async performTask(task: QueueTask<T>): Promise<R> {
		throw new Error("performTask method must be implemented by subclass")
	}

	/**
	 * Graceful shutdown
	 */
	async shutdown(): Promise<void> {
		this.isShutdown = true
		this.stopHealthMonitoring()

		// Wait for all active workers to complete
		const workerPromises = Array.from(this.activeWorkers.values()).map((w) => w.worker)
		await Promise.allSettled(workerPromises)

		// Clear remaining queue
		this.taskQueue = []
		this.activeWorkers.clear()
	}

	/**
	 * Force stop all operations
	 */
	forceStop(): void {
		this.isShutdown = true
		this.stopHealthMonitoring()

		// Clear everything immediately
		this.taskQueue = []
		this.activeWorkers.clear()
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.processingStats = {
			totalTasks: 0,
			completedTasks: 0,
			failedTasks: 0,
			averageProcessingTime: 0,
			throughput: 0,
			concurrentWorkers: 0,
			queueSize: 0,
			errorRate: 0,
		}
	}
}

/**
 * Specialized parallelizer for embedding operations
 */
export class EmbeddingParallelizer extends PipelineParallelizer<
	{ texts: string[]; model?: string },
	{ embeddings: number[][]; usage: any }
> {
	constructor(config?: Partial<ParallelProcessingConfig>) {
		super({
			maxConcurrency: 5, // Embedding APIs typically have strict rate limits
			maxQueueSize: 100,
			retryStrategy: "exponential",
			baseRetryDelay: 2000, // Start with 2 seconds for embedding retries
			maxRetryDelay: 30000, // Max 30 seconds
			...config,
		})
	}

	/**
	 * Execute embedding task
	 */
	protected override async performTask(
		task: QueueTask<{ texts: string[]; model?: string }>,
	): Promise<{ embeddings: number[][]; usage: any }> {
		// This would be implemented with actual embedding logic
		// For now, return a mock result
		throw new Error("EmbeddingParallelizer.performTask must be implemented with actual embedding logic")
	}
}

/**
 * Specialized parallelizer for vector store operations
 */
export class VectorStoreParallelizer extends PipelineParallelizer<
	{ points: any[]; operation: string },
	{ success: boolean; count: number }
> {
	constructor(config?: Partial<ParallelProcessingConfig>) {
		super({
			maxConcurrency: 10, // Vector stores can handle more concurrency
			maxQueueSize: 200,
			retryStrategy: "linear",
			baseRetryDelay: 500, // Faster retries for vector operations
			maxRetryDelay: 5000,
			...config,
		})
	}

	/**
	 * Execute vector store task
	 */
	protected override async performTask(
		task: QueueTask<{ points: any[]; operation: string }>,
	): Promise<{ success: boolean; count: number }> {
		// This would be implemented with actual vector store logic
		// For now, return a mock result
		throw new Error("VectorStoreParallelizer.performTask must be implemented with actual vector store logic")
	}
}

/**
 * Specialized parallelizer for graph database operations
 */
export class GraphDatabaseParallelizer extends PipelineParallelizer<
	{ operations: any[]; operation: string },
	{ success: boolean; count: number }
> {
	constructor(config?: Partial<ParallelProcessingConfig>) {
		super({
			maxConcurrency: 3, // Graph databases need conservative concurrency
			maxQueueSize: 50,
			retryStrategy: "exponential",
			baseRetryDelay: 1000, // Conservative retries for graph operations
			maxRetryDelay: 10000,
			deadlockDetection: true,
			deadlockTimeout: 60000, // Longer timeout for graph operations
			...config,
		})
	}

	/**
	 * Execute graph database task
	 */
	protected override async performTask(
		task: QueueTask<{ operations: any[]; operation: string }>,
	): Promise<{ success: boolean; count: number }> {
		// This would be implemented with actual graph database logic
		// For now, return a mock result
		throw new Error("GraphDatabaseParallelizer.performTask must be implemented with actual graph database logic")
	}
}
