/**
 * Comprehensive metrics collection system for the code indexing pipeline
 * Provides real-time visibility into performance, reliability, and throughput
 */

/**
 * Batch processing metrics
 */
export interface BatchMetrics {
	batchId: string
	startTime: number
	endTime?: number
	duration?: number // milliseconds
	itemCount: number
	success: boolean
	errorType?: string
	retryCount: number
	provider: string // embedding provider
	tokenCount: number
	vectorStoreOperationTime?: number // time for Qdrant operations
	graphOperationTime?: number // time for Neo4j operations
}

/**
 * Provider-specific metrics
 */
export interface ProviderMetrics {
	providerName: string
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	averageLatency: number // milliseconds
	totalTokens: number
	rateLimitHits: number
	lastRateLimitTime?: number
	circuitBreakerTrips: number
	currentRateLimitDelay?: number
}

/**
 * Operation-specific performance metrics
 */
export interface OperationMetrics {
	operationName: string
	totalCalls: number
	successfulCalls: number
	failedCalls: number
	averageTime: number // milliseconds
	minTime: number
	maxTime: number
	slowQueryCount: number // queries > threshold
	lastUpdated: number
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
	timestamp: number
	memoryUsage: NodeJS.MemoryUsage
	cpuUsage?: NodeJS.CpuUsage
	activeConnections: number
	pendingOperations: number
	errorRate: number // 0-1
	throughput: number // operations per second
}

/**
 * Real-time progress tracking
 */
export interface ProgressMetrics {
	totalFiles: number
	processedFiles: number
	failedFiles: number
	totalBatches: number
	processedBatches: number
	failedBatches: number
	totalCodeBlocks: number
	processedCodeBlocks: number
	currentOperation?: string
	estimatedTimeRemaining?: number // seconds
}

/**
 * File-level metrics by file type
 */
export interface FileTypeMetrics {
	fileType: string
	discovered: number
	filteredByRooignore: number
	filteredByExtension: number
	skippedBySize: number
	skippedByCache: number
	parsed: number
	parseFailed: number
	blocksGenerated: number
}

/**
 * Block-level metrics by file type
 */
export interface BlockTypeMetrics {
	fileType: string
	blocksGenerated: number
	blocksEmbedded: number
	blocksStored: number
	blocksFailed: number
}

/**
 * Parser-specific metrics by language
 */
export interface ParserMetrics {
	language: string
	loadAttempts: number
	loadSuccesses: number
	loadFailures: number
	parseAttempts: number
	parseSuccesses: number
	parseFailed: number
	totalCaptures: number
	fallbackTriggered: number
	averageCapturesPerFile: number
	lastError?: string
	// New metrics for query effectiveness
	queryEffectiveness: number
	zeroCaptures: number
	comprehensiveQueryUsage: number
	hardcodedQueryUsage: number
	fallbackQueryUsage: number
	noneQueryUsage: number
	unknownQueryUsage: number
	averageFileSize: number
}

/**
 * Query source metrics
 */
export interface QuerySourceMetrics {
	language: string
	source: "comprehensive" | "hardcoded"
	count: number
}

/**
 * Capture effectiveness metrics
 */
export interface CaptureEffectivenessMetrics {
	language: string
	querySource: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown"
	captureCount: number
	fileCount: number
}

/**
 * Zero capture event metrics
 */
export interface ZeroCaptureEventMetrics {
	language: string
	querySource: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown"
	fileSize: number
	eventCount: number
}

/**
 * Fallback chunking trigger metrics
 */
export interface FallbackChunkingTriggerMetrics {
	language: string
	reason: "zeroCaptures" | "parseError" | "noParser"
	count: number
}

/**
 * Graph indexing metrics
 */
export interface GraphIndexingMetrics {
	fileType: string
	fallbackChunksIndexed: number
	fallbackNodesCreated: number
	fallbackRelationshipsCreated: number
}

/**
 * Comprehensive metrics collector for the code indexing pipeline
 */
export class MetricsCollector {
	private batchMetrics: BatchMetrics[] = []
	private providerMetrics: Map<string, ProviderMetrics> = new Map()
	private operationMetrics: Map<string, OperationMetrics> = new Map()
	private progressMetrics: ProgressMetrics = {
		totalFiles: 0,
		processedFiles: 0,
		failedFiles: 0,
		totalBatches: 0,
		processedBatches: 0,
		failedBatches: 0,
		totalCodeBlocks: 0,
		processedCodeBlocks: 0,
	}
	private fileTypeMetrics: Map<string, FileTypeMetrics> = new Map()
	private blockTypeMetrics: Map<string, BlockTypeMetrics> = new Map()
	private parserMetrics: Map<string, ParserMetrics> = new Map()
	private querySourceMetrics: Map<string, QuerySourceMetrics> = new Map()
	private captureEffectivenessMetrics: Map<string, CaptureEffectivenessMetrics> = new Map()
	private zeroCaptureEventMetrics: Map<string, ZeroCaptureEventMetrics> = new Map()
	private fallbackChunkingTriggerMetrics: Map<string, FallbackChunkingTriggerMetrics> = new Map()
	private graphIndexingMetrics: Map<string, GraphIndexingMetrics> = new Map()

	// Performance thresholds
	private readonly slowQueryThreshold = 1000 // 1 second
	private readonly healthCheckInterval = 30000 // 30 seconds
	private readonly metricsRetentionPeriod = 24 * 60 * 60 * 1000 // 24 hours

	// Timers and intervals
	private healthCheckTimer?: NodeJS.Timeout
	private lastHealthCheck = 0

	constructor() {
		this.startHealthMonitoring()
	}

	/**
	 * Record batch processing metrics
	 */
	recordBatchMetrics(metrics: Omit<BatchMetrics, "duration" | "endTime">): void {
		const endTime = Date.now()
		const duration = endTime - metrics.startTime

		const completeMetrics: BatchMetrics = {
			...metrics,
			endTime,
			duration,
		}

		this.batchMetrics.push(completeMetrics)
		this.updateProgressMetrics(metrics)
		this.cleanupOldMetrics()

		// Update provider metrics
		this.updateProviderMetrics(metrics.provider, {
			success: metrics.success,
			latency: metrics.vectorStoreOperationTime || metrics.graphOperationTime || duration,
			tokenCount: metrics.tokenCount,
		})
	}

	/**
	 * Record operation-specific metrics
	 */
	recordOperationMetrics(
		operationName: string,
		duration: number,
		success: boolean,
		metadata?: Record<string, any>,
	): void {
		const existing = this.operationMetrics.get(operationName) || {
			operationName,
			totalCalls: 0,
			successfulCalls: 0,
			failedCalls: 0,
			averageTime: 0,
			minTime: Infinity,
			maxTime: 0,
			slowQueryCount: 0,
			lastUpdated: Date.now(),
		}

		existing.totalCalls++
		if (success) {
			existing.successfulCalls++
		} else {
			existing.failedCalls++
		}

		// Update timing metrics
		existing.minTime = Math.min(existing.minTime, duration)
		existing.maxTime = Math.max(existing.maxTime, duration)

		// Calculate new average
		const totalTime = existing.averageTime * (existing.totalCalls - 1) + duration
		existing.averageTime = totalTime / existing.totalCalls

		if (duration > this.slowQueryThreshold) {
			existing.slowQueryCount++
		}

		existing.lastUpdated = Date.now()
		this.operationMetrics.set(operationName, existing)
	}

	/**
	 * Record provider-specific metrics
	 */
	recordProviderMetrics(
		providerName: string,
		metrics: {
			success: boolean
			latency: number
			tokenCount?: number
			rateLimited?: boolean
			circuitBreakerTrip?: boolean
		},
	): void {
		const existing = this.providerMetrics.get(providerName) || {
			providerName,
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageLatency: 0,
			totalTokens: 0,
			rateLimitHits: 0,
			circuitBreakerTrips: 0,
		}

		existing.totalRequests++
		if (metrics.success) {
			existing.successfulRequests++
		} else {
			existing.failedRequests++
		}

		// Update latency
		const totalTime = existing.averageLatency * (existing.totalRequests - 1) + metrics.latency
		existing.averageLatency = totalTime / existing.totalRequests

		// Update tokens
		if (metrics.tokenCount) {
			existing.totalTokens += metrics.tokenCount
		}

		// Update rate limit tracking
		if (metrics.rateLimited) {
			existing.rateLimitHits++
			existing.lastRateLimitTime = Date.now()
		}

		// Update circuit breaker tracking
		if (metrics.circuitBreakerTrip) {
			existing.circuitBreakerTrips++
		}

		this.providerMetrics.set(providerName, existing)
	}

	/**
	 * Update progress metrics
	 */
	updateProgress(operation: {
		type: "file" | "batch" | "block"
		count: number
		success: boolean
		currentOperation?: string
	}): void {
		switch (operation.type) {
			case "file":
				this.progressMetrics.totalFiles += operation.count
				if (operation.success) {
					this.progressMetrics.processedFiles += operation.count
				} else {
					this.progressMetrics.failedFiles += operation.count
				}
				break

			case "batch":
				this.progressMetrics.totalBatches += operation.count
				if (operation.success) {
					this.progressMetrics.processedBatches += operation.count
				} else {
					this.progressMetrics.failedBatches += operation.count
				}
				break

			case "block":
				this.progressMetrics.totalCodeBlocks += operation.count
				if (operation.success) {
					this.progressMetrics.processedCodeBlocks += operation.count
				}
				break
		}

		if (operation.currentOperation) {
			this.progressMetrics.currentOperation = operation.currentOperation
		}

		// Estimate remaining time based on current throughput
		this.updateEstimatedTimeRemaining()
	}

	/**
	 * Get current progress metrics
	 */
	getProgressMetrics(): ProgressMetrics {
		return { ...this.progressMetrics }
	}

	/**
	 * Get provider metrics for a specific provider
	 */
	getProviderMetrics(providerName: string): ProviderMetrics | undefined {
		return this.providerMetrics.get(providerName)
	}

	/**
	 * Get all provider metrics
	 */
	getAllProviderMetrics(): ProviderMetrics[] {
		return Array.from(this.providerMetrics.values())
	}

	/**
	 * Get operation metrics for a specific operation
	 */
	getOperationMetrics(operationName: string): OperationMetrics | undefined {
		return this.operationMetrics.get(operationName)
	}

	/**
	 * Get all operation metrics
	 */
	getAllOperationMetrics(): OperationMetrics[] {
		return Array.from(this.operationMetrics.values())
	}

	/**
	 * Get recent batch metrics
	 */
	getRecentBatchMetrics(count: number = 100): BatchMetrics[] {
		return this.batchMetrics.slice(-count)
	}

	/**
	 * Get system health metrics
	 */
	getSystemHealthMetrics(): SystemHealthMetrics {
		const memoryUsage = process.memoryUsage()
		const cpuUsage = process.cpuUsage()

		// Calculate error rate from recent batches
		const recentBatches = this.getRecentBatchMetrics(50)
		const errorRate =
			recentBatches.length > 0 ? recentBatches.filter((b) => !b.success).length / recentBatches.length : 0

		// Calculate throughput from recent operations
		const recentOperations = this.getAllOperationMetrics()
		const totalOperations = recentOperations.reduce((sum, op) => sum + op.totalCalls, 0)
		const totalTime = recentOperations.reduce((sum, op) => sum + op.averageTime * op.totalCalls, 0)
		const throughput = totalTime > 0 ? (totalOperations * 1000) / totalTime : 0

		return {
			timestamp: Date.now(),
			memoryUsage,
			cpuUsage,
			activeConnections: this.providerMetrics.size,
			pendingOperations: this.batchMetrics.filter((b) => !b.endTime).length,
			errorRate,
			throughput,
		}
	}

	/**
	 * Record file type metrics
	 */
	recordFileTypeMetric(
		fileType: string,
		metric:
			| "discovered"
			| "filteredByRooignore"
			| "filteredByExtension"
			| "skippedBySize"
			| "skippedByCache"
			| "parsed"
			| "parseFailed"
			| "blocksGenerated",
		count: number = 1,
	): void {
		const existing = this.fileTypeMetrics.get(fileType) || {
			fileType,
			discovered: 0,
			filteredByRooignore: 0,
			filteredByExtension: 0,
			skippedBySize: 0,
			skippedByCache: 0,
			parsed: 0,
			parseFailed: 0,
			blocksGenerated: 0,
		}

		existing[metric] += count
		this.fileTypeMetrics.set(fileType, existing)
	}

	/**
	 * Record block type metrics
	 */
	recordBlockTypeMetric(
		fileType: string,
		metric: "generated" | "embedded" | "stored" | "failed",
		count: number,
	): void {
		const existing = this.blockTypeMetrics.get(fileType) || {
			fileType,
			blocksGenerated: 0,
			blocksEmbedded: 0,
			blocksStored: 0,
			blocksFailed: 0,
		}

		switch (metric) {
			case "generated":
				existing.blocksGenerated += count
				break
			case "embedded":
				existing.blocksEmbedded += count
				break
			case "stored":
				existing.blocksStored += count
				break
			case "failed":
				existing.blocksFailed += count
				break
		}

		this.blockTypeMetrics.set(fileType, existing)
	}

	/**
	 * Record graph indexing metrics
	 */
	recordGraphIndexingMetric(
		fileType: string,
		metric: "fallbackChunksIndexed" | "fallbackNodesCreated" | "fallbackRelationshipsCreated",
		count: number,
	): void {
		const existing = this.graphIndexingMetrics.get(fileType) || {
			fileType,
			fallbackChunksIndexed: 0,
			fallbackNodesCreated: 0,
			fallbackRelationshipsCreated: 0,
		}

		switch (metric) {
			case "fallbackChunksIndexed":
				existing.fallbackChunksIndexed += count
				break
			case "fallbackNodesCreated":
				existing.fallbackNodesCreated += count
				break
			case "fallbackRelationshipsCreated":
				existing.fallbackRelationshipsCreated += count
				break
		}

		this.graphIndexingMetrics.set(fileType, existing)
	}

	/**
	 * Record parser metrics
	 */
	recordParserMetric(
		language: string,
		metric:
			| "loadAttempt"
			| "loadSuccess"
			| "loadFailure"
			| "parseAttempt"
			| "parseSuccess"
			| "parseFailed"
			| "captures"
			| "fallback"
			| "queryEffectiveness"
			| "zeroCaptures"
			| "querySource_comprehensive"
			| "querySource_hardcoded"
			| "querySource_fallback"
			| "querySource_none"
			| "querySource_unknown"
			| "captureCount"
			| "fileSize"
			| "zeroCaptureEvent"
			| "captureEffectiveness"
			| "fallbackChunkingTrigger",
		count: number = 1,
		error?: string,
		querySource?: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown",
		fileSize?: number,
		fallbackReason?: "zeroCaptures" | "parseError" | "noParser",
	): void {
		const existing = this.parserMetrics.get(language) || {
			language,
			loadAttempts: 0,
			loadSuccesses: 0,
			loadFailures: 0,
			parseAttempts: 0,
			parseSuccesses: 0,
			parseFailed: 0,
			totalCaptures: 0,
			fallbackTriggered: 0,
			averageCapturesPerFile: 0,
			// New metrics for query effectiveness
			queryEffectiveness: 0,
			zeroCaptures: 0,
			comprehensiveQueryUsage: 0,
			hardcodedQueryUsage: 0,
			fallbackQueryUsage: 0,
			noneQueryUsage: 0,
			unknownQueryUsage: 0,
			averageFileSize: 0,
		}

		switch (metric) {
			case "loadAttempt":
				existing.loadAttempts += count
				break
			case "loadSuccess":
				existing.loadSuccesses += count
				break
			case "loadFailure":
				existing.loadFailures += count
				if (error) {
					existing.lastError = error
				}
				break
			case "parseAttempt":
				existing.parseAttempts += count
				break
			case "parseSuccess":
				existing.parseSuccesses += count
				break
			case "parseFailed":
				existing.parseFailed += count
				break
			case "captures":
				existing.totalCaptures += count
				// Update average captures per file
				if (existing.parseSuccesses > 0) {
					existing.averageCapturesPerFile = existing.totalCaptures / existing.parseSuccesses
				}
				break
			case "fallback":
				existing.fallbackTriggered += count
				break
			case "queryEffectiveness":
				existing.queryEffectiveness += count
				break
			case "zeroCaptures":
				existing.zeroCaptures += count
				break
			case "querySource_comprehensive":
				existing.comprehensiveQueryUsage += count
				this.recordQuerySourceMetric(language, "comprehensive", count)
				break
			case "querySource_hardcoded":
				existing.hardcodedQueryUsage += count
				this.recordQuerySourceMetric(language, "hardcoded", count)
				break
			case "querySource_fallback":
				existing.fallbackQueryUsage += count
				break
			case "querySource_none":
				existing.noneQueryUsage += count
				break
			case "querySource_unknown":
				existing.unknownQueryUsage += count
				break
			case "captureCount":
				// Record capture effectiveness with query source
				if (querySource) {
					this.recordCaptureEffectivenessMetric(language, querySource, count)
				}
				break
			case "zeroCaptureEvent":
				// Record zero capture event with query source and file size
				if (querySource && fileSize) {
					this.recordZeroCaptureEventMetric(language, querySource, fileSize)
				}
				break
			case "captureEffectiveness":
				// This metric is already handled by the captureCount case
				break
			case "fallbackChunkingTrigger":
				// Record fallback chunking trigger with reason
				if (fallbackReason) {
					this.recordFallbackChunkingTriggerMetric(language, fallbackReason, count)
				}
				break
			case "fileSize": {
				// Update average file size
				const totalFiles = existing.parseAttempts || 1
				existing.averageFileSize = (existing.averageFileSize * (totalFiles - 1) + count) / totalFiles
				break
			}
		}

		this.parserMetrics.set(language, existing)
	}

	/**
	 * Get file type metrics for a specific file type
	 */
	getFileTypeMetrics(fileType: string): FileTypeMetrics | undefined {
		return this.fileTypeMetrics.get(fileType)
	}

	/**
	 * Get block type metrics for a specific file type
	 */
	getBlockTypeMetrics(fileType: string): BlockTypeMetrics | undefined {
		return this.blockTypeMetrics.get(fileType)
	}

	/**
	 * Get parser metrics for a specific language
	 */
	getParserMetrics(language: string): ParserMetrics | undefined {
		return this.parserMetrics.get(language)
	}

	/**
	 * Get all file type metrics
	 */
	getAllFileTypeMetrics(): FileTypeMetrics[] {
		return Array.from(this.fileTypeMetrics.values())
	}

	/**
	 * Get all block type metrics
	 */
	getAllBlockTypeMetrics(): BlockTypeMetrics[] {
		return Array.from(this.blockTypeMetrics.values())
	}

	/**
	 * Get all parser metrics
	 */
	getAllParserMetrics(): ParserMetrics[] {
		return Array.from(this.parserMetrics.values())
	}

	/**
	 * Record query source metric
	 */
	recordQuerySourceMetric(language: string, source: "comprehensive" | "hardcoded", count: number = 1): void {
		const key = `${language}:${source}`
		const existing = this.querySourceMetrics.get(key) || {
			language,
			source,
			count: 0,
		}
		existing.count += count
		this.querySourceMetrics.set(key, existing)
	}

	/**
	 * Record capture effectiveness metric
	 */
	recordCaptureEffectivenessMetric(
		language: string,
		querySource: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown",
		captureCount: number,
	): void {
		const key = `${language}:${querySource}`
		const existing = this.captureEffectivenessMetrics.get(key) || {
			language,
			querySource,
			captureCount: 0,
			fileCount: 0,
		}
		existing.captureCount += captureCount
		existing.fileCount += 1
		this.captureEffectivenessMetrics.set(key, existing)
	}

	/**
	 * Record zero capture event metric
	 */
	recordZeroCaptureEventMetric(
		language: string,
		querySource: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown",
		fileSize: number,
	): void {
		const key = `${language}:${querySource}`
		const existing = this.zeroCaptureEventMetrics.get(key) || {
			language,
			querySource,
			fileSize: 0,
			eventCount: 0,
		}
		existing.fileSize = (existing.fileSize * existing.eventCount + fileSize) / (existing.eventCount + 1)
		existing.eventCount += 1
		this.zeroCaptureEventMetrics.set(key, existing)
	}

	/**
	 * Record fallback chunking trigger metric
	 */
	recordFallbackChunkingTriggerMetric(
		language: string,
		reason: "zeroCaptures" | "parseError" | "noParser",
		count: number = 1,
	): void {
		const key = `${language}:${reason}`
		const existing = this.fallbackChunkingTriggerMetrics.get(key) || {
			language,
			reason,
			count: 0,
		}
		existing.count += count
		this.fallbackChunkingTriggerMetrics.set(key, existing)
	}

	/**
	 * Get query source metrics
	 */
	getQuerySourceMetrics(language?: string, source?: "comprehensive" | "hardcoded"): QuerySourceMetrics[] {
		let metrics = Array.from(this.querySourceMetrics.values())
		if (language) {
			metrics = metrics.filter((m) => m.language === language)
		}
		if (source) {
			metrics = metrics.filter((m) => m.source === source)
		}
		return metrics
	}

	/**
	 * Get capture effectiveness metrics
	 */
	getCaptureEffectivenessMetrics(
		language?: string,
		querySource?: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown",
	): CaptureEffectivenessMetrics[] {
		let metrics = Array.from(this.captureEffectivenessMetrics.values())
		if (language) {
			metrics = metrics.filter((m) => m.language === language)
		}
		if (querySource) {
			metrics = metrics.filter((m) => m.querySource === querySource)
		}
		return metrics
	}

	/**
	 * Get zero capture event metrics
	 */
	getZeroCaptureEventMetrics(
		language?: string,
		querySource?: "comprehensive" | "hardcoded" | "fallback" | "none" | "unknown",
	): ZeroCaptureEventMetrics[] {
		let metrics = Array.from(this.zeroCaptureEventMetrics.values())
		if (language) {
			metrics = metrics.filter((m) => m.language === language)
		}
		if (querySource) {
			metrics = metrics.filter((m) => m.querySource === querySource)
		}
		return metrics
	}

	/**
	 * Get fallback chunking trigger metrics
	 */
	getFallbackChunkingTriggerMetrics(
		language?: string,
		reason?: "zeroCaptures" | "parseError" | "noParser",
	): FallbackChunkingTriggerMetrics[] {
		let metrics = Array.from(this.fallbackChunkingTriggerMetrics.values())
		if (language) {
			metrics = metrics.filter((m) => m.language === language)
		}
		if (reason) {
			metrics = metrics.filter((m) => m.reason === reason)
		}
		return metrics
	}

	/**
	 * Get graph indexing metrics
	 */
	getGraphIndexingMetrics(fileType?: string): GraphIndexingMetrics[] {
		let metrics = Array.from(this.graphIndexingMetrics.values())
		if (fileType) {
			metrics = metrics.filter((m) => m.fileType === fileType)
		}
		return metrics
	}

	/**
	 * Get all graph indexing metrics
	 */
	getAllGraphIndexingMetrics(): GraphIndexingMetrics[] {
		return Array.from(this.graphIndexingMetrics.values())
	}

	/**
	 * Get comprehensive performance summary
	 */
	getPerformanceSummary(): {
		batch: {
			total: number
			successRate: number
			averageDuration: number
			averageItemsPerBatch: number
		}
		providers: ProviderMetrics[]
		operations: OperationMetrics[]
		health: SystemHealthMetrics
		progress: ProgressMetrics
		fileTypes: FileTypeMetrics[]
		blockTypes: BlockTypeMetrics[]
		parsers: ParserMetrics[]
		querySources: QuerySourceMetrics[]
		captureEffectiveness: CaptureEffectivenessMetrics[]
		zeroCaptureEvents: ZeroCaptureEventMetrics[]
		fallbackChunkingTriggers: FallbackChunkingTriggerMetrics[]
		graphIndexing: GraphIndexingMetrics[]
	} {
		const recentBatches = this.getRecentBatchMetrics(100)
		const successfulBatches = recentBatches.filter((b) => b.success)

		return {
			batch: {
				total: recentBatches.length,
				successRate: recentBatches.length > 0 ? successfulBatches.length / recentBatches.length : 0,
				averageDuration:
					recentBatches.length > 0
						? recentBatches.reduce((sum, b) => sum + (b.duration || 0), 0) / recentBatches.length
						: 0,
				averageItemsPerBatch:
					recentBatches.length > 0
						? recentBatches.reduce((sum, b) => sum + b.itemCount, 0) / recentBatches.length
						: 0,
			},
			providers: this.getAllProviderMetrics(),
			operations: this.getAllOperationMetrics(),
			health: this.getSystemHealthMetrics(),
			progress: this.getProgressMetrics(),
			fileTypes: this.getAllFileTypeMetrics(),
			blockTypes: this.getAllBlockTypeMetrics(),
			parsers: this.getAllParserMetrics(),
			querySources: Array.from(this.querySourceMetrics.values()),
			captureEffectiveness: Array.from(this.captureEffectivenessMetrics.values()),
			zeroCaptureEvents: Array.from(this.zeroCaptureEventMetrics.values()),
			fallbackChunkingTriggers: Array.from(this.fallbackChunkingTriggerMetrics.values()),
			graphIndexing: Array.from(this.graphIndexingMetrics.values()),
		}
	}

	/**
	 * Reset all metrics
	 */
	resetMetrics(): void {
		this.batchMetrics = []
		this.providerMetrics.clear()
		this.operationMetrics.clear()
		this.progressMetrics = {
			totalFiles: 0,
			processedFiles: 0,
			failedFiles: 0,
			totalBatches: 0,
			processedBatches: 0,
			failedBatches: 0,
			totalCodeBlocks: 0,
			processedCodeBlocks: 0,
		}
		this.fileTypeMetrics.clear()
		this.blockTypeMetrics.clear()
		this.parserMetrics.clear()
		this.querySourceMetrics.clear()
		this.captureEffectivenessMetrics.clear()
		this.zeroCaptureEventMetrics.clear()
		this.fallbackChunkingTriggerMetrics.clear()
		this.graphIndexingMetrics.clear()
	}

	/**
	 * Start health monitoring
	 */
	private startHealthMonitoring(): void {
		this.healthCheckTimer = setInterval(() => {
			this.performHealthCheck()
		}, this.healthCheckInterval)
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
		const now = Date.now()
		this.lastHealthCheck = now

		const health = this.getSystemHealthMetrics()

		// Check for warning conditions
		if (health.errorRate > 0.1) {
			console.warn(`[MetricsCollector] High error rate detected: ${(health.errorRate * 100).toFixed(1)}%`)
		}

		if (health.memoryUsage.heapUsed / health.memoryUsage.heapTotal > 0.8) {
			console.warn(
				`[MetricsCollector] High memory usage: ${((health.memoryUsage.heapUsed / health.memoryUsage.heapTotal) * 100).toFixed(1)}%`,
			)
		}

		if (health.throughput < 1) {
			console.warn(`[MetricsCollector] Low throughput: ${health.throughput.toFixed(2)} ops/sec`)
		}
	}

	/**
	 * Update progress metrics from batch metrics
	 */
	private updateProgressMetrics(batchMetrics: Omit<BatchMetrics, "duration" | "endTime">): void {
		// This is called when batch completes
		// Progress is updated separately via updateProgress method
	}

	/**
	 * Update provider metrics from batch metrics
	 */
	private updateProviderMetrics(
		providerName: string,
		metrics: {
			success: boolean
			latency: number
			tokenCount: number
		},
	): void {
		this.recordProviderMetrics(providerName, metrics)
	}

	/**
	 * Update estimated time remaining
	 */
	private updateEstimatedTimeRemaining(): void {
		if (this.progressMetrics.processedBatches === 0) {
			this.progressMetrics.estimatedTimeRemaining = undefined
			return
		}

		const totalBatches = this.progressMetrics.totalBatches
		const processedBatches = this.progressMetrics.processedBatches
		const remainingBatches = totalBatches - processedBatches

		if (remainingBatches <= 0) {
			this.progressMetrics.estimatedTimeRemaining = 0
			return
		}

		// Estimate based on recent batch performance
		const recentBatches = this.getRecentBatchMetrics(10)
		if (recentBatches.length === 0) {
			return
		}

		// Filter batches that have valid duration values
		const batchesWithDuration = recentBatches.filter(
			(b) => b.duration !== undefined && b.duration !== null && b.duration > 0,
		)
		if (batchesWithDuration.length === 0) {
			return
		}

		const averageBatchTime =
			batchesWithDuration.reduce((sum, b) => sum + b.duration!, 0) / batchesWithDuration.length

		this.progressMetrics.estimatedTimeRemaining = Math.ceil(
			(remainingBatches * averageBatchTime) / 1000, // convert to seconds
		)
	}

	/**
	 * Clean up old metrics to prevent memory leaks
	 */
	private cleanupOldMetrics(): void {
		const cutoffTime = Date.now() - this.metricsRetentionPeriod

		// Clean up old batch metrics
		this.batchMetrics = this.batchMetrics.filter((m) => m.startTime > cutoffTime)

		// Clean up old operation metrics
		for (const [name, metrics] of this.operationMetrics.entries()) {
			if (metrics.lastUpdated < cutoffTime) {
				this.operationMetrics.delete(name)
			}
		}
	}

	/**
	 * Dispose of the metrics collector
	 */
	dispose(): void {
		this.stopHealthMonitoring()
		this.resetMetrics()
	}
}
