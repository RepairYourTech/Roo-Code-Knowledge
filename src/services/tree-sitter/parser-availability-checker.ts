import * as fs from "fs"
import * as path from "path"
import { validateWasmDirectory } from "./wasm-diagnostics"
import { MetricsCollector } from "../code-index/utils/metrics-collector"

// Simple logger implementation for the module
const logger = {
	debug: (message: string, ...args: any[]) => console.debug(`[ParserAvailabilityChecker] ${message}`, ...args),
	info: (message: string, ...args: any[]) => console.info(`[ParserAvailabilityChecker] ${message}`, ...args),
	warn: (message: string, ...args: any[]) => console.warn(`[ParserAvailabilityChecker] ${message}`, ...args),
	error: (message: string, ...args: any[]) => console.error(`[ParserAvailabilityChecker] ${message}`, ...args),
}

export interface ParserAvailabilityStatus {
	available: boolean
	lastChecked: number
	error?: string
}

export interface CacheHealthReport {
	totalEntries: number
	healthyEntries: number
	staleEntries: number
	averageAge: number
	oldestEntry: number
	newestEntry: number
}

export class ParserAvailabilityCache {
	private cache: Map<string, ParserAvailabilityStatus> = new Map()
	private readonly ttlMs: number = 5 * 60 * 1000 // 5 minutes

	constructor(private metricsCollector?: MetricsCollector) {}

	/**
	 * Get availability status from cache
	 */
	get(language: string): ParserAvailabilityStatus | null {
		const entry = this.cache.get(language)
		if (!entry) {
			return null
		}

		// Check if entry is stale
		if (Date.now() - entry.lastChecked > this.ttlMs) {
			this.cache.delete(language)
			return null
		}

		return entry
	}

	/**
	 * Set availability status in cache
	 */
	set(language: string, status: Omit<ParserAvailabilityStatus, "lastChecked">): void {
		const entry: ParserAvailabilityStatus = {
			...status,
			lastChecked: Date.now(),
		}
		this.cache.set(language, entry)

		if (this.metricsCollector) {
			this.metricsCollector.recordParserMetric(language, status.available ? "loadSuccess" : "loadFailure")
		}
	}

	/**
	 * Invalidate cache entry for specific language
	 */
	invalidate(language: string): void {
		this.cache.delete(language)
	}

	/**
	 * Invalidate all cache entries
	 */
	invalidateAll(): void {
		this.cache.clear()
	}

	/**
	 * Get health report for cache
	 */
	getHealthReport(): CacheHealthReport {
		const now = Date.now()
		const entries = Array.from(this.cache.values())

		if (entries.length === 0) {
			return {
				totalEntries: 0,
				healthyEntries: 0,
				staleEntries: 0,
				averageAge: 0,
				oldestEntry: 0,
				newestEntry: 0,
			}
		}

		const healthyEntries = entries.filter((entry) => now - entry.lastChecked <= this.ttlMs)
		const staleEntries = entries.length - healthyEntries.length
		const ages = entries.map((entry) => now - entry.lastChecked)
		const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length
		const oldestEntry = Math.max(...ages)
		const newestEntry = Math.min(...ages)

		return {
			totalEntries: entries.length,
			healthyEntries: healthyEntries.length,
			staleEntries,
			averageAge,
			oldestEntry,
			newestEntry,
		}
	}

	/**
	 * Get all cached languages
	 */
	getCachedLanguages(): string[] {
		return Array.from(this.cache.keys())
	}

	/**
	 * Check if cache has entry for language
	 */
	has(language: string): boolean {
		const entry = this.cache.get(language)
		if (!entry) {
			return false
		}

		// Check if entry is stale
		if (Date.now() - entry.lastChecked > this.ttlMs) {
			this.cache.delete(language)
			return false
		}

		return true
	}

	/**
	 * Get cached status with compatibility interface
	 */
	getCachedStatus(language: string): { isAvailable: boolean; lastChecked: number; error?: string } | null {
		const entry = this.get(language)
		if (!entry) {
			return null
		}

		return {
			isAvailable: entry.available,
			lastChecked: entry.lastChecked,
			error: entry.error,
		}
	}
}

/**
 * Check if a parser is available for a specific language
 */
export async function checkParserAvailability(
	language: string,
	wasmDir?: string,
	metricsCollector?: MetricsCollector,
): Promise<ParserAvailabilityStatus> {
	const startTime = Date.now()

	try {
		// Get WASM directory
		const wasmDirectory = wasmDir || path.join(process.cwd(), "node_modules", "web-tree-sitter")

		// Check if WASM directory exists
		if (!fs.existsSync(wasmDirectory)) {
			const status = {
				available: false,
				lastChecked: Date.now(),
				error: `WASM directory not found: ${wasmDirectory}`,
			}

			if (metricsCollector) {
				metricsCollector.recordParserMetric(language, "loadFailure")
			}

			return status
		}

		// Check specific WASM file for the language
		const wasmFileName = `tree-sitter-${language}.wasm`
		const wasmFilePath = path.join(wasmDirectory, wasmFileName)

		// Check if WASM file exists
		if (!fs.existsSync(wasmFilePath)) {
			const status = {
				available: false,
				lastChecked: Date.now(),
				error: `WASM file not found: ${wasmFilePath}`,
			}

			if (metricsCollector) {
				metricsCollector.recordParserMetric(language, "loadFailure")
			}

			return status
		}

		// Check file size (must be at least 1KB)
		const stats = fs.statSync(wasmFilePath)
		if (stats.size < 1024) {
			const status = {
				available: false,
				lastChecked: Date.now(),
				error: `WASM file too small: ${stats.size} bytes (minimum 1024 bytes)`,
			}

			if (metricsCollector) {
				metricsCollector.recordParserMetric(language, "loadFailure")
			}

			return status
		}

		// Validate WASM directory
		const validationResult = validateWasmDirectory(wasmDirectory)
		if (!validationResult.isValid) {
			const status = {
				available: false,
				lastChecked: Date.now(),
				error: `WASM directory validation failed: ${validationResult.missingCriticalFiles.join(", ")}`,
			}

			if (metricsCollector) {
				metricsCollector.recordParserMetric(language, "loadFailure")
			}

			return status
		}

		// If we reach here, the parser is available
		const status = {
			available: true,
			lastChecked: Date.now(),
		}

		if (metricsCollector) {
			metricsCollector.recordParserMetric(language, "loadSuccess")
		}

		const duration = Date.now() - startTime
		logger.debug(`Parser availability check for ${language} completed in ${duration}ms`)

		return status
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const status = {
			available: false,
			lastChecked: Date.now(),
			error: `Error checking parser availability: ${errorMessage}`,
		}

		if (metricsCollector) {
			metricsCollector.recordParserMetric(language, "loadFailure")
		}

		logger.error(`Error checking parser availability for ${language}: ${errorMessage}`)

		return status
	}
}

/**
 * Check parser availability for multiple languages in parallel
 */
export async function checkMultipleParserAvailability(
	languages: string[],
	wasmDir?: string,
	metricsCollector?: MetricsCollector,
	concurrencyLimit: number = 10,
): Promise<Map<string, ParserAvailabilityStatus>> {
	const results = new Map<string, ParserAvailabilityStatus>()

	// Process languages in batches to respect concurrency limit
	for (let i = 0; i < languages.length; i += concurrencyLimit) {
		const batch = languages.slice(i, i + concurrencyLimit)

		const batchPromises = batch.map(async (language) => {
			const status = await checkParserAvailability(language, wasmDir, metricsCollector)
			return { language, status }
		})

		const batchResults = await Promise.all(batchPromises)

		for (const { language, status } of batchResults) {
			results.set(language, status)
		}
	}

	// Log summary
	const availableCount = Array.from(results.values()).filter((status) => status.available).length
	const totalCount = results.size

	logger.info(`Parser availability check completed: ${availableCount}/${totalCount} parsers available`)

	// Log unavailable parsers
	const unavailableParsers = Array.from(results.entries())
		.filter(([, status]) => !status.available)
		.map(([language]) => language)

	if (unavailableParsers.length > 0) {
		logger.warn(`Unavailable parsers: ${unavailableParsers.join(", ")}`)
	}

	return results
}

/**
 * Global cache instance
 */
let globalCache: ParserAvailabilityCache | null = null

/**
 * Get or create the global parser availability cache
 */
export function getParserAvailabilityCache(metricsCollector?: MetricsCollector): ParserAvailabilityCache {
	if (!globalCache) {
		globalCache = new ParserAvailabilityCache(metricsCollector)
	}
	return globalCache
}

/**
 * Reset the global cache (useful for testing)
 */
export function resetParserAvailabilityCache(): void {
	globalCache = null
}

/**
 * Check parser availability with caching
 */
export async function checkParserAvailabilityWithCache(
	language: string,
	wasmDir?: string,
	metricsCollector?: MetricsCollector,
): Promise<ParserAvailabilityStatus> {
	const cache = getParserAvailabilityCache(metricsCollector)

	// Check cache first
	const cachedStatus = cache.get(language)
	if (cachedStatus) {
		return cachedStatus
	}

	// Check availability and cache result
	const status = await checkParserAvailability(language, wasmDir, metricsCollector)
	cache.set(language, status)

	return status
}

/**
 * Check multiple parser availability with caching
 */
export async function checkMultipleParserAvailabilityWithCache(
	languages: string[],
	wasmDir?: string,
	metricsCollector?: MetricsCollector,
	concurrencyLimit: number = 10,
): Promise<Map<string, ParserAvailabilityStatus>> {
	const cache = getParserAvailabilityCache(metricsCollector)
	const results = new Map<string, ParserAvailabilityStatus>()
	const languagesToCheck: string[] = []

	// Check cache first
	for (const language of languages) {
		const cachedStatus = cache.get(language)
		if (cachedStatus) {
			results.set(language, cachedStatus)
		} else {
			languagesToCheck.push(language)
		}
	}

	// Check uncached languages
	if (languagesToCheck.length > 0) {
		const newResults = await checkMultipleParserAvailability(
			languagesToCheck,
			wasmDir,
			metricsCollector,
			concurrencyLimit,
		)

		// Cache new results
		for (const [language, status] of newResults) {
			cache.set(language, status)
			results.set(language, status)
		}
	}

	return results
}
