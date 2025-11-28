import * as path from "path"

/**
 * Configuration options for WASM loading with retry logic
 */
export interface WasmLoadOptions {
	/** Maximum number of retry attempts (default: 3) */
	maxRetries?: number
	/** Initial delay in milliseconds before first retry (default: 100) */
	initialDelayMs?: number
	/** Maximum delay in milliseconds between retries (default: 2000) */
	maxDelayMs?: number
	/** Multiplier for exponential backoff (default: 2) */
	backoffMultiplier?: number
	/** Timeout in milliseconds for WASM loading (default: 30000) */
	timeoutMs?: number
}

/**
 * Result of a WASM loading attempt with detailed outcome
 */
export interface WasmLoadResult {
	/** Whether the loading was successful */
	success: boolean
	/** The language that was attempted to load */
	language: string
	/** The loaded language object (if successful) */
	languageObj?: any
	/** Error if loading failed */
	error?: Error
	/** Number of attempts made */
	attemptCount: number
	/** Total duration of all attempts in milliseconds */
	totalDuration: number
	/** Path where WASM was loaded from (if successful) */
	wasmPath?: string
}

/**
 * Default options for WASM loading
 */
const DEFAULT_OPTIONS: Required<WasmLoadOptions> = {
	maxRetries: 3,
	initialDelayMs: 100,
	maxDelayMs: 2000,
	backoffMultiplier: 2,
	timeoutMs: 30000,
}

/**
 * Determines if an error is suitable for retry based on error type
 * @param error The error to analyze
 * @returns True if the error should trigger a retry
 */
export function shouldRetryError(error: Error): boolean {
	const errorMessage = error.message

	// Retry on transient errors
	if (
		errorMessage.includes("ENOENT") || // File not found (might be temporary)
		errorMessage.includes("EACCES") || // Permission denied (might be temporary)
		errorMessage.includes("ETIMEDOUT") || // Timeout
		errorMessage.includes("ECONNREFUSED") || // Connection refused
		errorMessage.includes("ENOTFOUND") || // DNS lookup failed
		errorMessage.includes("Network error") ||
		errorMessage.includes("Parser initialization") ||
		errorMessage.includes("Failed to initialize")
	) {
		return true
	}

	// Don't retry on permanent errors
	if (
		errorMessage.includes("HTTP 404") || // Not found permanently
		errorMessage.includes("HTTP 403") || // Forbidden permanently
		errorMessage.includes("Invalid WASM format") ||
		errorMessage.includes("WASM validation failed") ||
		errorMessage.includes("Syntax error") ||
		errorMessage.includes("Unsupported WASM")
	) {
		return false
	}

	// Default to retrying on unknown errors
	return true
}

/**
 * Calculates exponential backoff delay with jitter to prevent thundering herd
 * @param attempt Current attempt number (0-based)
 * @param options Configuration options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, options: Required<WasmLoadOptions>): number {
	// Calculate base exponential delay
	const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt)

	// Add jitter (random value between 0 and 100ms)
	const jitter = Math.random() * 100

	// Apply maximum delay cap
	return Math.min(options.maxDelayMs, baseDelay + jitter)
}

/**
 * Loads a tree-sitter language WASM file with retry logic and exponential backoff
 * @param language Name of the language to load
 * @param wasmDirectory Directory containing WASM files
 * @param parser Parser instance to use for loading
 * @param options Optional configuration for retry behavior
 * @returns Promise resolving to WasmLoadResult with detailed outcome
 */
export async function loadLanguageWithRetry(
	language: string,
	wasmDirectory: string,
	parser: any,
	options: WasmLoadOptions = {},
): Promise<WasmLoadResult> {
	const config = { ...DEFAULT_OPTIONS, ...options }
	const startTime = Date.now()
	let lastError: Error | undefined

	console.log(`[WasmLoader] Loading language: ${language} from ${wasmDirectory}`)

	for (let attempt = 0; attempt < config.maxRetries; attempt++) {
		const attemptStartTime = Date.now()

		try {
			// First try to load from the specified directory
			const languagePath = path.join(wasmDirectory, `${language}.wasm`)
			console.log(`[WasmLoader] Attempt ${attempt + 1}/${config.maxRetries}: Loading from ${languagePath}`)

			// Create a timeout promise
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(
					() => reject(new Error(`WASM loading timeout after ${config.timeoutMs}ms`)),
					config.timeoutMs,
				)
			})

			// Load the language with timeout
			const loadPromise = parser.Language.load(languagePath)
			const loadedLanguage = await Promise.race([loadPromise, timeoutPromise])

			const attemptDuration = Date.now() - attemptStartTime
			const totalDuration = Date.now() - startTime

			console.log(
				`[WasmLoader] ✓ Successfully loaded ${language}.wasm on attempt ${attempt + 1} in ${attemptDuration}ms`,
			)

			return {
				success: true,
				language,
				languageObj: loadedLanguage,
				attemptCount: attempt + 1,
				totalDuration,
				wasmPath: languagePath,
			}
		} catch (error) {
			const attemptDuration = Date.now() - attemptStartTime
			lastError = error instanceof Error ? error : new Error(String(error))

			console.log(
				`[WasmLoader] ✗ Attempt ${attempt + 1}/${config.maxRetries} failed in ${attemptDuration}ms: ${lastError.message}`,
			)

			// Check if we should retry this error
			if (!shouldRetryError(lastError)) {
				console.log(`[WasmLoader] Error is not retryable, giving up: ${lastError.message}`)
				break
			}

			// If this is the last attempt, don't wait
			if (attempt === config.maxRetries - 1) {
				console.log(`[WasmLoader] Maximum retries reached, giving up`)
				break
			}

			// Calculate delay and wait before retrying
			const delay = calculateBackoffDelay(attempt, config)
			console.log(`[WasmLoader] Retrying in ${Math.round(delay)}ms...`)
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	const totalDuration = Date.now() - startTime

	console.log(
		`[WasmLoader] Failed to load ${language}.wasm after ${config.maxRetries} attempts in ${totalDuration}ms`,
	)

	return {
		success: false,
		language,
		error: lastError,
		attemptCount: config.maxRetries,
		totalDuration,
	}
}
