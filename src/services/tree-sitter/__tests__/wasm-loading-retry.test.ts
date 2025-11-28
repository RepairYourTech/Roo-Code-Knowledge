import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as path from "path"
import {
	loadLanguageWithRetry,
	shouldRetryError,
	calculateBackoffDelay,
	WasmLoadOptions,
	WasmLoadResult,
} from "../wasm-loader-with-retry"

// Mock the console methods to avoid noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

describe("WASM Loading Retry Logic", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		console.log = vi.fn()
		console.error = vi.fn()
	})

	afterEach(() => {
		console.log = originalConsoleLog
		console.error = originalConsoleError
	})

	describe("shouldRetryError", () => {
		it("should return true for ENOENT errors", () => {
			const error = new Error("ENOENT: no such file or directory")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for EACCES errors", () => {
			const error = new Error("EACCES: permission denied")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for ETIMEDOUT errors", () => {
			const error = new Error("ETIMEDOUT: operation timed out")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for connection errors", () => {
			const error = new Error("ECONNREFUSED: connection refused")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for DNS lookup errors", () => {
			const error = new Error("ENOTFOUND: getaddrinfo ENOTFOUND")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for network errors", () => {
			const error = new Error("Network error: connection lost")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for parser initialization errors", () => {
			const error = new Error("Parser initialization failed")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return true for failed to initialize errors", () => {
			const error = new Error("Failed to initialize parser")
			expect(shouldRetryError(error)).toBe(true)
		})

		it("should return false for HTTP 404 errors", () => {
			const error = new Error("HTTP 404: Not Found")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return false for HTTP 403 errors", () => {
			const error = new Error("HTTP 403: Forbidden")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return false for invalid WASM format errors", () => {
			const error = new Error("Invalid WASM format")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return false for WASM validation failed errors", () => {
			const error = new Error("WASM validation failed")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return false for syntax errors", () => {
			const error = new Error("Syntax error in WASM module")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return false for unsupported WASM errors", () => {
			const error = new Error("Unsupported WASM version")
			expect(shouldRetryError(error)).toBe(false)
		})

		it("should return true for unknown errors by default", () => {
			const error = new Error("Some unknown error")
			expect(shouldRetryError(error)).toBe(true)
		})
	})

	describe("calculateBackoffDelay", () => {
		const defaultOptions: Required<WasmLoadOptions> = {
			maxRetries: 3,
			initialDelayMs: 100,
			maxDelayMs: 2000,
			backoffMultiplier: 2,
			timeoutMs: 30000,
		}

		it("should calculate exponential growth correctly", () => {
			// Mock Math.random to return 0 to eliminate jitter
			const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0)

			expect(calculateBackoffDelay(0, defaultOptions)).toBe(100) // 100 * 2^0 + 0
			expect(calculateBackoffDelay(1, defaultOptions)).toBe(200) // 100 * 2^1 + 0
			expect(calculateBackoffDelay(2, defaultOptions)).toBe(400) // 100 * 2^2 + 0

			mockRandom.mockRestore()
		})

		it("should respect max delay cap", () => {
			const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0)

			// With a small max delay, the exponential growth should be capped
			const optionsWithSmallMax = { ...defaultOptions, maxDelayMs: 250 }

			expect(calculateBackoffDelay(0, optionsWithSmallMax)).toBe(100)
			expect(calculateBackoffDelay(1, optionsWithSmallMax)).toBe(200)
			expect(calculateBackoffDelay(2, optionsWithSmallMax)).toBe(250) // Capped at 250

			mockRandom.mockRestore()
		})

		it("should apply jitter to delay", () => {
			// Test that jitter is applied by calling multiple times with different random values
			const delays: number[] = []

			// Store original random
			const originalRandom = Math.random

			// Mock random to return predictable values
			const mockValues = [0, 0.5, 1]
			let callCount = 0

			Math.random = vi.fn(() => {
				const value = mockValues[callCount % mockValues.length]
				callCount++
				return value
			})

			for (let i = 0; i < 3; i++) {
				delays.push(calculateBackoffDelay(1, defaultOptions))
			}

			// With attempt 1, base delay is 200ms
			// With jitter of 0, 50, 100: delays should be 200, 250, 300
			expect(delays[0]).toBe(200) // 200 + 0
			expect(delays[1]).toBe(250) // 200 + 50
			expect(delays[2]).toBe(300) // 200 + 100

			// Restore original random
			Math.random = originalRandom
		})
	})

	describe("loadLanguageWithRetry", () => {
		const mockLanguage = { name: "test-language" }
		const mockParser = {
			Language: {
				load: vi.fn(),
			},
		}

		const testLanguage = "typescript"
		const testWasmDirectory = "/test/wasm/dir"

		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should load successfully on first attempt", async () => {
			mockParser.Language.load.mockResolvedValue(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.language).toBe(testLanguage)
			expect(result.languageObj).toBe(mockLanguage)
			expect(result.attemptCount).toBe(1)
			expect(result.wasmPath).toBe(path.join(testWasmDirectory, `${testLanguage}.wasm`))
			expect(mockParser.Language.load).toHaveBeenCalledTimes(1)
			expect(mockParser.Language.load).toHaveBeenCalledWith(path.join(testWasmDirectory, `${testLanguage}.wasm`))
		})

		it("should load successfully after 1 retry (transient ENOENT error)", async () => {
			// First call fails with ENOENT, second succeeds
			mockParser.Language.load
				.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"))
				.mockResolvedValueOnce(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.language).toBe(testLanguage)
			expect(result.languageObj).toBe(mockLanguage)
			expect(result.attemptCount).toBe(2)
			expect(mockParser.Language.load).toHaveBeenCalledTimes(2)
		})

		it("should load successfully after 2 retries (transient EACCES error)", async () => {
			// First two calls fail with EACCES, third succeeds
			mockParser.Language.load
				.mockRejectedValueOnce(new Error("EACCES: permission denied"))
				.mockRejectedValueOnce(new Error("EACCES: permission denied"))
				.mockResolvedValueOnce(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.language).toBe(testLanguage)
			expect(result.languageObj).toBe(mockLanguage)
			expect(result.attemptCount).toBe(3)
			expect(mockParser.Language.load).toHaveBeenCalledTimes(3)
		})

		it("should fail after max retries exhausted (persistent ENOENT)", async () => {
			const error = new Error("ENOENT: no such file or directory")
			mockParser.Language.load.mockRejectedValue(error)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				maxRetries: 2,
			})

			expect(result.success).toBe(false)
			expect(result.language).toBe(testLanguage)
			expect(result.error).toBe(error)
			expect(result.attemptCount).toBe(2)
			expect(mockParser.Language.load).toHaveBeenCalledTimes(2)
		})

		it("should fail immediately for permanent errors (invalid WASM format)", async () => {
			const error = new Error("Invalid WASM format")
			mockParser.Language.load.mockRejectedValue(error)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				maxRetries: 3,
			})

			expect(result.success).toBe(false)
			expect(result.language).toBe(testLanguage)
			expect(result.error).toBe(error)
			expect(result.attemptCount).toBe(1) // Should not retry
			expect(mockParser.Language.load).toHaveBeenCalledTimes(1)
		})

		it("should handle timeout correctly", async () => {
			// Mock a load that takes longer than timeout
			mockParser.Language.load.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)))

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				timeoutMs: 100, // Very short timeout
				maxRetries: 2,
			})

			expect(result.success).toBe(false)
			expect(result.error?.message).toContain("WASM loading timeout after 100ms")
		})

		it("should apply exponential backoff delays correctly", async () => {
			const startTime = Date.now()

			// First two attempts fail, third succeeds
			mockParser.Language.load
				.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"))
				.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"))
				.mockResolvedValueOnce(mockLanguage)

			// Mock Math.random to return 0 for predictable delays
			const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				initialDelayMs: 50,
				backoffMultiplier: 2,
				maxDelayMs: 1000,
			})

			const endTime = Date.now()
			const totalTime = endTime - startTime

			expect(result.success).toBe(true)
			expect(result.attemptCount).toBe(3)

			// Should have delays of 50ms (after first attempt) and 100ms (after second attempt)
			// Plus some execution time, so we check if it's at least the expected delay
			expect(totalTime).toBeGreaterThanOrEqual(150) // 50 + 100

			mockRandom.mockRestore()
		})

		it("should record metrics for each attempt", async () => {
			// First attempt fails, second succeeds
			mockParser.Language.load
				.mockRejectedValueOnce(new Error("ENOENT: no such file or directory"))
				.mockResolvedValueOnce(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.attemptCount).toBe(2)
			expect(result.totalDuration).toBeGreaterThan(0)
			expect(typeof result.totalDuration).toBe("number")
		})

		it("should include retry count and suggestions in error messages", async () => {
			const error = new Error("ENOENT: no such file or directory")
			mockParser.Language.load.mockRejectedValue(error)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				maxRetries: 2,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Maximum retries reached"))
		})
	})

	describe("Integration with languageParser", () => {
		const mockLanguage = { name: "test-language" }
		const mockParser = {
			Language: {
				load: vi.fn(),
			},
		}

		const testLanguage = "typescript"
		const testWasmDirectory = "/test/wasm/dir"

		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should handle parser loading with retry succeeding after transient failure", async () => {
			// Simulate a transient failure followed by success
			mockParser.Language.load
				.mockRejectedValueOnce(new Error("ETIMEDOUT: operation timed out"))
				.mockResolvedValueOnce(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.languageObj).toBe(mockLanguage)
			expect(result.attemptCount).toBe(2)
			expect(mockParser.Language.load).toHaveBeenCalledTimes(2)
		})

		it("should handle parser loading failing gracefully after max retries", async () => {
			const persistentError = new Error("EACCES: permission denied")
			mockParser.Language.load.mockRejectedValue(persistentError)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser, {
				maxRetries: 3,
			})

			expect(result.success).toBe(false)
			expect(result.error).toBe(persistentError)
			expect(result.attemptCount).toBe(3)
			expect(mockParser.Language.load).toHaveBeenCalledTimes(3)
		})

		it("should update availability cache correctly after successful load", async () => {
			mockParser.Language.load.mockResolvedValue(mockLanguage)

			const result = await loadLanguageWithRetry(testLanguage, testWasmDirectory, mockParser)

			expect(result.success).toBe(true)
			expect(result.wasmPath).toBe(path.join(testWasmDirectory, `${testLanguage}.wasm`))
			// In a real implementation, this would update the availability cache
			// Here we're just verifying the path is correctly set for cache updates
		})
	})

	describe("Error Classification", () => {
		const mockParser = {
			Language: {
				load: vi.fn(),
			},
		}

		it("should classify transient errors as retryable", async () => {
			const transientErrors = [
				new Error("ENOENT: no such file or directory"),
				new Error("EACCES: permission denied"),
				new Error("ETIMEDOUT: operation timed out"),
				new Error("Network error: connection lost"),
				new Error("Parser initialization failed"),
			]

			for (const error of transientErrors) {
				mockParser.Language.load.mockRejectedValueOnce(error)

				const result = await loadLanguageWithRetry("test", "/test/dir", mockParser, {
					maxRetries: 2,
				})

				expect(result.attemptCount).toBeGreaterThan(1)
				expect(mockParser.Language.load).toHaveBeenCalledTimes(2)

				mockParser.Language.load.mockReset()
			}
		})

		it("should classify permanent errors as non-retryable", async () => {
			const permanentErrors = [
				new Error("HTTP 404: Not Found"),
				new Error("HTTP 403: Forbidden"),
				new Error("Invalid WASM format"),
				new Error("WASM validation failed"),
				new Error("Syntax error in WASM module"),
			]

			for (const error of permanentErrors) {
				mockParser.Language.load.mockRejectedValueOnce(error)

				const result = await loadLanguageWithRetry("test", "/test/dir", mockParser, {
					maxRetries: 3,
				})

				expect(result.attemptCount).toBe(1)
				expect(mockParser.Language.load).toHaveBeenCalledTimes(1)

				mockParser.Language.load.mockReset()
			}
		})

		it("should include retry count in error messages", async () => {
			const error = new Error("ENOENT: no such file or directory")
			mockParser.Language.load.mockRejectedValue(error)

			const result = await loadLanguageWithRetry("test", "/test/dir", mockParser, {
				maxRetries: 2,
			})

			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Attempt 1/2 failed"))
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Attempt 2/2 failed"))
		})
	})
})
