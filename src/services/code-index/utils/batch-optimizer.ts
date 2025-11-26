import { CodeBlock } from "../interfaces"

/**
 * Performance metrics for batch processing optimization
 */
interface BatchPerformanceMetrics {
	averageProcessingTime: number // milliseconds
	successRate: number // 0-1
	averageLatency: number // milliseconds
	throughput: number // items per second
	lastUpdated: number
}

/**
 * Batch optimization configuration
 */
interface BatchOptimizationConfig {
	minBatchSize: number
	maxBatchSize: number
	targetLatency: number // milliseconds
	targetThroughput: number // items per second
	adjustmentFactor: number // how aggressively to adjust batch size
	metricsWindow: number // number of recent batches to consider
}

/**
 * Adaptive batch sizing result
 */
interface BatchSizingResult {
	optimalBatchSize: number
	reasoning: string
	confidence: number // 0-1
	adjustmentMade: boolean
}

/**
 * Token estimation result
 */
interface TokenEstimation {
	tokenCount: number
	confidence: number // 0-1
	method: "length-based" | "complexity-based" | "hybrid"
	itemCount: number
}

/**
 * Adaptive batch optimizer that dynamically adjusts batch sizes based on performance metrics
 * and content characteristics to optimize throughput while respecting token limits
 */
export class AdaptiveBatchOptimizer {
	private performanceHistory: BatchPerformanceMetrics[] = []
	private readonly config: BatchOptimizationConfig
	private readonly maxTokenLimit: number
	private readonly maxItemTokens: number

	// Performance tracking
	private totalBatchesProcessed = 0
	private successfulBatches = 0
	private totalProcessingTime = 0
	private totalItemsProcessed = 0

	constructor(maxTokenLimit: number, maxItemTokens: number, config: Partial<BatchOptimizationConfig> = {}) {
		this.maxTokenLimit = maxTokenLimit
		this.maxItemTokens = maxItemTokens

		this.config = {
			minBatchSize: 5,
			maxBatchSize: 100,
			targetLatency: 2000, // 2 seconds
			targetThroughput: 50, // 50 items per second
			adjustmentFactor: 0.2, // 20% adjustment
			metricsWindow: 10, // consider last 10 batches
			...config,
		}
	}

	/**
	 * Calculate optimal batch size based on content and performance history
	 */
	calculateOptimalBatchSize(items: CodeBlock[], currentBatchSize: number): BatchSizingResult {
		// Estimate tokens for the items
		const tokenEstimate = this.estimateTokens(items)

		// Calculate theoretical maximum based on token limits
		const tokenBasedMaxSize = this.calculateTokenBasedBatchSize(tokenEstimate)

		// Get performance-based recommendation
		const performanceBasedSize = this.calculatePerformanceBasedBatchSize(currentBatchSize)

		// Combine recommendations with confidence weighting
		const finalSize = this.combineRecommendations(tokenBasedMaxSize, performanceBasedSize, tokenEstimate.confidence)

		const adjustmentMade = finalSize !== currentBatchSize
		const reasoning = this.generateReasoning(tokenBasedMaxSize, performanceBasedSize, finalSize, tokenEstimate)

		return {
			optimalBatchSize: finalSize,
			reasoning,
			confidence: this.calculateConfidence(tokenEstimate, this.performanceHistory.length),
			adjustmentMade,
		}
	}

	/**
	 * Record batch performance for future optimization
	 */
	recordBatchPerformance(batchSize: number, processingTime: number, success: boolean, itemCount: number): void {
		this.totalBatchesProcessed++
		if (success) {
			this.successfulBatches++
		}
		this.totalProcessingTime += processingTime
		this.totalItemsProcessed += itemCount

		const metrics: BatchPerformanceMetrics = {
			averageProcessingTime: processingTime,
			successRate: success ? 1 : 0,
			averageLatency: itemCount > 0 ? processingTime / itemCount : 0, // per item latency
			throughput: processingTime > 0 ? itemCount / (processingTime / 1000) : 0, // items per second
			lastUpdated: Date.now(),
		}

		// Add to history and maintain window size
		this.performanceHistory.push(metrics)
		if (this.performanceHistory.length > this.config.metricsWindow) {
			this.performanceHistory.shift()
		}
	}

	/**
	 * Estimate token count for a batch of items
	 */
	private estimateTokens(items: CodeBlock[]): TokenEstimation {
		if (items.length === 0) {
			return { tokenCount: 0, confidence: 1, method: "length-based", itemCount: 0 }
		}

		// Use multiple estimation methods for better accuracy
		const lengthBased = this.estimateTokensByLength(items)
		const complexityBased = this.estimateTokensByComplexity(items)

		// Weighted combination based on confidence
		const combinedTokens = Math.round(lengthBased.tokenCount * 0.6 + complexityBased.tokenCount * 0.4)

		const combinedConfidence = Math.max(lengthBased.confidence, complexityBased.confidence)

		return {
			tokenCount: combinedTokens,
			confidence: combinedConfidence,
			method: "hybrid",
			itemCount: items.length,
		}
	}

	/**
	 * Estimate tokens based on text length (simple but fast)
	 */
	private estimateTokensByLength(items: CodeBlock[]): TokenEstimation {
		const totalLength = items.reduce((sum, item) => sum + item.content.length, 0)
		const estimatedTokens = Math.ceil(totalLength / 4) // Rough estimate: 1 token ≈ 4 chars

		// Confidence is lower for very short or very long content
		let confidence = 0.7
		if (totalLength > 100 && totalLength < 10000) {
			confidence = 0.8
		} else if (totalLength >= 10000) {
			confidence = 0.6
		}

		return {
			tokenCount: estimatedTokens,
			confidence,
			method: "length-based",
			itemCount: items.length,
		}
	}

	/**
	 * Estimate tokens based on code complexity (more accurate but slower)
	 */
	private estimateTokensByComplexity(items: CodeBlock[]): TokenEstimation {
		let complexityScore = 0
		let totalLength = 0

		for (const item of items) {
			totalLength += item.content.length

			// Factor in complexity indicators
			const content = item.content
			complexityScore += (content.match(/\b(if|else|for|while|function|class|try|catch)\b/g) || []).length * 2
			complexityScore += (content.match(/[{}[\]()]/g) || []).length
			complexityScore += (content.match(/\/\/.*$/gm) || []).length * 0.5 // comments
			complexityScore += (content.match(/\/\*[\s\S]*?\*\//g) || []).length * 0.5 // block comments
		}

		// Base token estimate + complexity adjustment
		const baseTokens = Math.ceil(totalLength / 4)
		const complexityMultiplier = totalLength > 0 ? 1 + (complexityScore / totalLength) * 0.3 : 1
		const estimatedTokens = Math.round(baseTokens * complexityMultiplier)

		// Higher confidence for complexity-based estimation
		const confidence = totalLength > 50 ? 0.85 : 0.6

		return {
			tokenCount: estimatedTokens,
			confidence,
			method: "complexity-based",
			itemCount: items.length,
		}
	}

	/**
	 * Calculate maximum batch size based on token limits
	 */
	private calculateTokenBasedBatchSize(tokenEstimate: TokenEstimation): number {
		if (tokenEstimate.tokenCount === 0) {
			return this.config.minBatchSize
		}

		// Calculate how many items we can fit within token limits
		// Use the actual item count from tokenEstimate instead of hardcoded minBatchSize
		const avgTokensPerItem = tokenEstimate.itemCount > 0 ? tokenEstimate.tokenCount / tokenEstimate.itemCount : 0
		const maxItemsByTokens =
			avgTokensPerItem > 0 ? Math.floor(this.maxTokenLimit / avgTokensPerItem) : this.config.maxBatchSize
		const maxItemsByItemLimit =
			avgTokensPerItem > 0 ? Math.floor(this.maxItemTokens / avgTokensPerItem) : this.config.maxBatchSize

		// Use the more restrictive limit
		const tokenLimitedSize = Math.min(maxItemsByTokens, maxItemsByItemLimit, this.config.maxBatchSize)

		// Apply confidence-based safety margin (lower confidence = larger margin)
		const safetyMargin = tokenEstimate.confidence < 0.7 ? 0.3 : tokenEstimate.confidence < 0.9 ? 0.2 : 0.1
		const adjustedSize = Math.floor(tokenLimitedSize * (1 - safetyMargin))

		return Math.max(this.config.minBatchSize, Math.min(this.config.maxBatchSize, adjustedSize))
	}

	/**
	 * Calculate batch size based on performance history
	 */
	private calculatePerformanceBasedBatchSize(currentBatchSize: number): number {
		if (this.performanceHistory.length === 0) {
			return currentBatchSize
		}

		// Calculate average metrics from history
		const avgLatency =
			this.performanceHistory.reduce((sum, m) => sum + m.averageLatency, 0) / this.performanceHistory.length
		const avgThroughput =
			this.performanceHistory.reduce((sum, m) => sum + m.throughput, 0) / this.performanceHistory.length
		const avgSuccessRate =
			this.performanceHistory.reduce((sum, m) => sum + m.successRate, 0) / this.performanceHistory.length

		let recommendedSize = currentBatchSize

		// Adjust based on latency
		if (avgLatency > this.config.targetLatency) {
			// Too slow, reduce batch size
			const latencyRatio = avgLatency / this.config.targetLatency
			recommendedSize = Math.floor(currentBatchSize / latencyRatio)
		} else if (avgLatency < this.config.targetLatency * 0.7) {
			// Very fast, can increase batch size
			const speedRatio = this.config.targetLatency / avgLatency
			recommendedSize = Math.ceil(currentBatchSize * Math.min(speedRatio, 1.5))
		}

		// Adjust based on throughput
		if (avgThroughput < this.config.targetThroughput * 0.8) {
			// Low throughput, try larger batches
			recommendedSize = Math.ceil(recommendedSize * 1.1)
		}

		// Adjust based on success rate
		if (avgSuccessRate < 0.9) {
			// Low success rate, reduce batch size
			recommendedSize = Math.floor(recommendedSize * 0.8)
		}

		// Apply adjustment factor for stability
		const adjustment = 1 + this.config.adjustmentFactor * (recommendedSize > currentBatchSize ? 1 : -1)
		const adjustedSize = Math.round(currentBatchSize * adjustment)

		return Math.max(this.config.minBatchSize, Math.min(this.config.maxBatchSize, adjustedSize))
	}

	/**
	 * Combine token-based and performance-based recommendations
	 */
	private combineRecommendations(
		tokenBasedSize: number,
		performanceBasedSize: number,
		tokenConfidence: number,
	): number {
		// Weight token-based recommendation more heavily when confidence is high
		const tokenWeight = 0.5 + tokenConfidence * 0.3 // 0.5-0.8
		const performanceWeight = 1 - tokenWeight

		const combinedSize = Math.round(tokenBasedSize * tokenWeight + performanceBasedSize * performanceWeight)

		return Math.max(this.config.minBatchSize, Math.min(this.config.maxBatchSize, combinedSize))
	}

	/**
	 * Generate human-readable reasoning for the batch size decision
	 */
	private generateReasoning(
		tokenBasedSize: number,
		performanceBasedSize: number,
		finalSize: number,
		tokenEstimate: TokenEstimation,
	): string {
		const reasons: string[] = []

		if (finalSize === tokenBasedSize) {
			reasons.push(`Token limits primary factor (${tokenEstimate.tokenCount} tokens estimated)`)
		}

		if (this.performanceHistory.length > 0) {
			const avgLatency =
				this.performanceHistory.reduce((sum, m) => sum + m.averageLatency, 0) / this.performanceHistory.length
			const avgThroughput =
				this.performanceHistory.reduce((sum, m) => sum + m.throughput, 0) / this.performanceHistory.length

			reasons.push(`Performance: ${avgLatency.toFixed(0)}ms latency, ${avgThroughput.toFixed(1)} items/sec`)
		}

		if (finalSize > Math.min(tokenBasedSize, performanceBasedSize)) {
			reasons.push("Conservative increase for stability")
		} else if (finalSize < Math.max(tokenBasedSize, performanceBasedSize)) {
			reasons.push("Conservative decrease for reliability")
		}

		return reasons.join("; ")
	}

	/**
	 * Calculate confidence in the batch size recommendation
	 */
	private calculateConfidence(tokenEstimate: TokenEstimation, historyLength: number): number {
		// Base confidence from token estimation
		let confidence = tokenEstimate.confidence * 0.6

		// Add confidence from performance history
		if (historyLength >= 5) {
			confidence += 0.3
		} else if (historyLength >= 2) {
			confidence += 0.1
		}

		return Math.min(1, confidence)
	}

	/**
	 * Get current performance statistics
	 */
	getPerformanceStats(): {
		totalBatches: number
		successRate: number
		averageProcessingTime: number
		averageThroughput: number
		currentBatchSize: number
	} {
		return {
			totalBatches: this.totalBatchesProcessed,
			successRate: this.totalBatchesProcessed > 0 ? this.successfulBatches / this.totalBatchesProcessed : 0,
			averageProcessingTime:
				this.totalBatchesProcessed > 0 ? this.totalProcessingTime / this.totalBatchesProcessed : 0,
			averageThroughput:
				this.totalProcessingTime > 0 ? (this.totalItemsProcessed * 1000) / this.totalProcessingTime : 0,
			currentBatchSize:
				this.performanceHistory.length > 0
					? Math.min(
							Math.max(
								this.config.minBatchSize,
								Math.round(
									(this.performanceHistory[this.performanceHistory.length - 1].throughput *
										this.config.targetLatency) /
										1000,
								),
							),
							this.config.maxBatchSize,
						)
					: this.config.minBatchSize,
		}
	}

	/**
	 * Reset performance history (useful for major configuration changes)
	 */
	resetPerformanceHistory(): void {
		this.performanceHistory = []
		this.totalBatchesProcessed = 0
		this.successfulBatches = 0
		this.totalProcessingTime = 0
		this.totalItemsProcessed = 0
	}

	/**
	 * Get optimization configuration
	 */
	getConfig(): BatchOptimizationConfig {
		return { ...this.config }
	}

	/**
	 * Update optimization configuration
	 */
	updateConfig(newConfig: Partial<BatchOptimizationConfig>): void {
		Object.assign(this.config, newConfig)
	}
}
