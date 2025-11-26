/**
 * Smart rate limiting utilities with token bucket algorithm and predictive rate limit avoidance
 * Provides per-provider rate limit handling with intelligent backoff strategies
 */

/**
 * Rate limit state for a specific provider
 */
export interface ProviderRateLimitState {
	isRateLimited: boolean
	rateLimitResetTime: number
	consecutiveRateLimitErrors: number
	lastRateLimitError: number
	requestsInWindow: number
	windowStartTime: number
	tokensInWindow: number
	lastRequestTime: number
	averageRequestInterval: number
	predictiveLimitReached: boolean
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	maxRequestsPerWindow: number
	windowDurationMs: number
	maxConsecutiveErrors: number
	baseBackoffMs: number
	maxBackoffMs: number
	predictiveThreshold: number // percentage of window capacity before predictive throttling
	jitterFactor: number // randomization factor for request timing
}

/**
 * Token bucket state
 */
export interface TokenBucketState {
	tokens: number
	lastRefillTime: number
	refillRate: number // tokens per millisecond
	maxTokens: number
}

/**
 * Request metadata for rate limiting
 */
export interface RequestMetadata {
	provider: string
	tokens?: number
	timestamp: number
	priority: number
}

/**
 * Smart rate limiter with token bucket algorithm and predictive rate limit avoidance
 */
export class SmartRateLimiter {
	private readonly providerStates = new Map<string, ProviderRateLimitState>()
	private readonly tokenBuckets = new Map<string, TokenBucketState>()
	private readonly requestQueues = new Map<string, RequestMetadata[]>()
	private readonly config: RateLimitConfig
	private processingTimer?: NodeJS.Timeout

	constructor(config: Partial<RateLimitConfig> = {}) {
		this.config = {
			maxRequestsPerWindow: 100, // Conservative default
			windowDurationMs: 60000, // 1 minute
			maxConsecutiveErrors: 3,
			baseBackoffMs: 1000,
			maxBackoffMs: 30000, // 30 seconds
			predictiveThreshold: 0.8, // Start throttling at 80% capacity
			jitterFactor: 0.1, // 10% jitter
			...config,
		}
	}

	/**
	 * Initialize rate limiting for a provider
	 */
	initializeProvider(provider: string, maxTokens?: number, refillRate?: number): void {
		const state: ProviderRateLimitState = {
			isRateLimited: false,
			rateLimitResetTime: 0,
			consecutiveRateLimitErrors: 0,
			lastRateLimitError: 0,
			requestsInWindow: 0,
			windowStartTime: Date.now(),
			tokensInWindow: 0,
			lastRequestTime: 0,
			averageRequestInterval: 0,
			predictiveLimitReached: false,
		}

		const bucketState: TokenBucketState = {
			tokens: maxTokens || this.config.maxRequestsPerWindow,
			lastRefillTime: Date.now(),
			refillRate: refillRate || (maxTokens || this.config.maxRequestsPerWindow) / this.config.windowDurationMs,
			maxTokens: maxTokens || this.config.maxRequestsPerWindow,
		}

		this.providerStates.set(provider, state)
		this.tokenBuckets.set(provider, bucketState)
	}

	/**
	 * Check if a request can be made based on rate limits
	 */
	canMakeRequest(provider: string, tokens: number = 1): { canProceed: boolean; waitTime?: number; reason?: string } {
		const state = this.providerStates.get(provider)
		const bucket = this.tokenBuckets.get(provider)

		if (!state || !bucket) {
			return { canProceed: true, reason: "Provider not initialized" }
		}

		const now = Date.now()

		// Check if currently rate limited
		if (state.isRateLimited && now < state.rateLimitResetTime) {
			const waitTime = state.rateLimitResetTime - now
			return {
				canProceed: false,
				waitTime,
				reason: `Rate limited. Wait ${Math.ceil(waitTime / 1000)}s`,
			}
		}

		// Refill tokens based on time elapsed
		this.refillTokens(provider, now)

		// Check token bucket availability
		if (bucket.tokens < tokens) {
			return {
				canProceed: false,
				reason: `Token bucket exhausted. ${bucket.tokens}/${tokens} tokens available`,
			}
		}

		// Check predictive throttling
		const windowUsage = state.requestsInWindow / this.config.maxRequestsPerWindow
		if (windowUsage >= this.config.predictiveThreshold) {
			state.predictiveLimitReached = true

			// Calculate minimum interval to stay within limits
			const minInterval = this.config.windowDurationMs / this.config.maxRequestsPerWindow
			const recommendedDelay = Math.max(minInterval - state.averageRequestInterval, 0)

			return {
				canProceed: false,
				waitTime: recommendedDelay,
				reason: `Predictive throttling. Usage: ${(windowUsage * 100).toFixed(1)}%. Recommended delay: ${recommendedDelay}ms`,
			}
		}

		// Apply jitter to prevent thundering herd
		const jitter = Math.random() * this.config.jitterFactor * this.config.windowDurationMs

		return {
			canProceed: true,
			waitTime: jitter > 0 ? jitter : undefined,
			reason: jitter > 0 ? `Applied jitter: ${Math.ceil(jitter)}ms` : undefined,
		}
	}

	/**
	 * Record a successful request
	 */
	recordSuccess(provider: string, tokens: number): void {
		const state = this.providerStates.get(provider)
		const bucket = this.tokenBuckets.get(provider)

		if (!state || !bucket) return

		const now = Date.now()

		// Add request to provider-specific queue
		let requestQueue = this.requestQueues.get(provider)
		if (!requestQueue) {
			requestQueue = []
			this.requestQueues.set(provider, requestQueue)
		}

		requestQueue.push({
			provider,
			tokens,
			timestamp: now,
			priority: 1, // Default priority
		})

		// Update provider state
		state.lastRequestTime = now
		state.consecutiveRateLimitErrors = 0
		state.isRateLimited = false

		// Update token bucket
		bucket.tokens -= tokens
		bucket.lastRefillTime = now

		// Update window statistics
		this.updateWindowStats(provider, now)
	}

	/**
	 * Record a rate limit error
	 */
	recordRateLimitError(provider: string, error: any, resetTime?: number): void {
		const state = this.providerStates.get(provider)

		if (!state) return

		const now = Date.now()

		// Update provider state
		state.consecutiveRateLimitErrors++
		state.lastRateLimitError = now
		state.isRateLimited = true
		state.rateLimitResetTime = resetTime || now + this.calculateBackoff(state.consecutiveRateLimitErrors)

		console.warn(
			`[SmartRateLimiter] Rate limit hit for ${provider}: ${error.message}. Backing off for ${Math.ceil((state.rateLimitResetTime - now) / 1000)}s`,
		)
	}

	/**
	 * Calculate exponential backoff delay
	 */
	private calculateBackoff(consecutiveErrors: number): number {
		const backoff = this.config.baseBackoffMs * Math.pow(2, consecutiveErrors - 1)
		return Math.min(backoff, this.config.maxBackoffMs)
	}

	/**
	 * Refill tokens based on time elapsed
	 */
	private refillTokens(provider: string, now: number): void {
		const state = this.providerStates.get(provider)
		const bucket = this.tokenBuckets.get(provider)

		if (!state || !bucket) return

		const timeSinceLastRefill = now - bucket.lastRefillTime
		const tokensToAdd = Math.floor(timeSinceLastRefill * bucket.refillRate)

		bucket.tokens = Math.min(bucket.tokens + tokensToAdd, bucket.maxTokens)
		bucket.lastRefillTime = now
	}

	/**
	 * Update sliding window statistics
	 */
	private updateWindowStats(provider: string, now: number): void {
		const state = this.providerStates.get(provider)

		if (!state) return

		// Get or create provider-specific request queue
		let requestQueue = this.requestQueues.get(provider)
		if (!requestQueue) {
			requestQueue = []
			this.requestQueues.set(provider, requestQueue)
		}

		// Remove old requests outside the window
		const windowStart = now - this.config.windowDurationMs
		const filteredQueue = requestQueue.filter((req) => req.timestamp >= windowStart)
		this.requestQueues.set(provider, filteredQueue)

		// Update state
		state.requestsInWindow = filteredQueue.length
		state.windowStartTime = windowStart

		// Calculate average request interval
		if (filteredQueue.length > 1) {
			const intervals: number[] = []
			for (let i = 1; i < filteredQueue.length; i++) {
				intervals.push(filteredQueue[i].timestamp - filteredQueue[i - 1].timestamp)
			}
			state.averageRequestInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
		}
	}

	/**
	 * Get current rate limit status for a provider
	 */
	getProviderStatus(provider: string): ProviderRateLimitState | undefined {
		return this.providerStates.get(provider)
	}

	/**
	 * Get all provider statuses
	 */
	getAllProviderStatuses(): Record<string, ProviderRateLimitState> {
		const result: Record<string, ProviderRateLimitState> = {}
		for (const [provider, state] of this.providerStates.entries()) {
			result[provider] = { ...state }
		}
		return result
	}

	/**
	 * Get token bucket status for a provider
	 */
	getTokenBucketStatus(provider: string): TokenBucketState | undefined {
		return this.tokenBuckets.get(provider)
	}

	/**
	 * Wait for rate limit to reset
	 */
	async waitForRateLimitReset(provider: string): Promise<void> {
		const state = this.providerStates.get(provider)

		if (!state || !state.isRateLimited) {
			return
		}

		const now = Date.now()
		if (now < state.rateLimitResetTime) {
			const waitTime = state.rateLimitResetTime - now
			console.log(
				`[SmartRateLimiter] Waiting for rate limit reset for ${provider}: ${Math.ceil(waitTime / 1000)}s`,
			)

			await new Promise((resolve) => setTimeout(resolve, waitTime))

			// Reset rate limit state
			state.isRateLimited = false
			state.consecutiveRateLimitErrors = 0
		}
	}

	/**
	 * Start automatic processing timer
	 */
	startProcessingTimer(): void {
		if (this.processingTimer) {
			clearInterval(this.processingTimer)
		}

		this.processingTimer = setInterval(() => {
			this.processExpiredStates()
		}, 1000) // Check every second
	}

	/**
	 * Stop automatic processing timer
	 */
	stopProcessingTimer(): void {
		if (this.processingTimer) {
			clearInterval(this.processingTimer)
			this.processingTimer = undefined
		}
	}

	/**
	 * Process expired states and clean up
	 */
	private processExpiredStates(): void {
		const now = Date.now()

		for (const [provider, state] of this.providerStates.entries()) {
			// Reset rate limit if time has passed
			if (state.isRateLimited && now >= state.rateLimitResetTime) {
				console.log(`[SmartRateLimiter] Rate limit reset for ${provider}`)
				state.isRateLimited = false
				state.consecutiveRateLimitErrors = 0
			}

			// Clean up old request data
			this.updateWindowStats(provider, now)
		}
	}

	/**
	 * Reset provider state
	 */
	resetProvider(provider: string): void {
		this.providerStates.delete(provider)
		this.tokenBuckets.delete(provider)
		this.requestQueues.delete(provider)
	}

	/**
	 * Reset all providers
	 */
	resetAll(): void {
		this.providerStates.clear()
		this.tokenBuckets.clear()
		this.requestQueues.clear()
		this.stopProcessingTimer()
	}

	/**
	 * Get comprehensive rate limiting statistics
	 */
	getStatistics(): {
		totalProviders: number
		rateLimitedProviders: number
		averageRequestRates: Record<string, number>
		tokenUtilization: Record<string, number>
		predictiveThrottlingActive: Record<string, boolean>
	} {
		const stats: {
			totalProviders: number
			rateLimitedProviders: number
			averageRequestRates: Record<string, number>
			tokenUtilization: Record<string, number>
			predictiveThrottlingActive: Record<string, boolean>
		} = {
			totalProviders: this.providerStates.size,
			rateLimitedProviders: 0,
			averageRequestRates: {},
			tokenUtilization: {},
			predictiveThrottlingActive: {},
		}

		const now = Date.now()

		for (const [provider, state] of this.providerStates.entries()) {
			if (state.isRateLimited) {
				stats.rateLimitedProviders++
			}

			// Calculate average request rate
			if (state.averageRequestInterval > 0) {
				stats.averageRequestRates[provider] = 1000 / state.averageRequestInterval
			}

			// Calculate token utilization
			const bucket = this.tokenBuckets.get(provider)
			if (bucket) {
				const utilization = (bucket.maxTokens - bucket.tokens) / bucket.maxTokens
				stats.tokenUtilization[provider] = utilization
			}

			// Check predictive throttling
			stats.predictiveThrottlingActive[provider] = state.predictiveLimitReached
		}

		return stats
	}
}
