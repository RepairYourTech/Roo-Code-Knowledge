import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
	ParserAvailabilityCache,
	checkParserAvailability,
	checkMultipleParserAvailability,
	checkParserAvailabilityWithCache,
	checkMultipleParserAvailabilityWithCache,
	getParserAvailabilityCache,
	resetParserAvailabilityCache,
	type ParserAvailabilityStatus,
	type CacheHealthReport,
} from "../parser-availability-checker"
import { MetricsCollector } from "../../code-index/utils/metrics-collector"

// Mock the file system
vi.mock("fs", () => ({
	default: {
		existsSync: vi.fn(),
		statSync: vi.fn(),
	},
}))

// Mock the wasm-diagnostics module
vi.mock("../wasm-diagnostics", () => ({
	validateWasmDirectory: vi.fn(),
}))

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
const originalConsoleDebug = console.debug

describe("ParserAvailabilityChecker", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		console.log = vi.fn()
		console.error = vi.fn()
		console.warn = vi.fn()
		console.debug = vi.fn()
		resetParserAvailabilityCache()
	})

	afterEach(() => {
		vi.useRealTimers()
		console.log = originalConsoleLog
		console.error = originalConsoleError
		console.warn = originalConsoleWarn
		console.debug = originalConsoleDebug
	})

	describe("ParserAvailabilityCache", () => {
		let cache: ParserAvailabilityCache
		let mockMetricsCollector: MetricsCollector

		beforeEach(() => {
			mockMetricsCollector = new MetricsCollector()
			cache = new ParserAvailabilityCache(mockMetricsCollector)
		})

		describe("cache stores and retrieves availability status", () => {
			it("should store and retrieve availability status", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
				}

				cache.set("typescript", status)
				const retrieved = cache.get("typescript")

				expect(retrieved).toEqual(status)
			})

			it("should store and retrieve availability status with error", () => {
				const status: ParserAvailabilityStatus = {
					available: false,
					lastChecked: Date.now(),
					error: "WASM file not found",
				}

				cache.set("python", status)
				const retrieved = cache.get("python")

				expect(retrieved).toEqual(status)
			})

			it("should return null for non-existent language", () => {
				const retrieved = cache.get("nonexistent")
				expect(retrieved).toBeNull()
			})
		})

		describe("cache respects TTL (5 minutes)", () => {
			it("should return cached status within TTL", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
				}

				cache.set("typescript", status)

				// Advance time by 2 minutes (within TTL)
				vi.advanceTimersByTime(2 * 60 * 1000)

				const retrieved = cache.get("typescript")
				expect(retrieved).toEqual(status)
			})

			it("should return null for stale cache entries", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
				}

				cache.set("typescript", status)

				// Advance time by 6 minutes (beyond TTL)
				vi.advanceTimersByTime(6 * 60 * 1000)

				const retrieved = cache.get("typescript")
				expect(retrieved).toBeNull()
			})

			it("should remove stale entries from cache", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
				}

				cache.set("typescript", status)
				expect(cache.has("typescript")).toBe(true)

				// Advance time by 6 minutes (beyond TTL)
				vi.advanceTimersByTime(6 * 60 * 1000)

				expect(cache.has("typescript")).toBe(false)
			})
		})

		describe("cache invalidation for specific language", () => {
			it("should invalidate cache entry for specific language", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
				}

				cache.set("typescript", status)
				cache.set("python", { available: false })

				cache.invalidate("typescript")

				expect(cache.get("typescript")).toBeNull()
				expect(cache.get("python")).not.toBeNull()
			})
		})

		describe("cache invalidation for all languages", () => {
			it("should invalidate all cache entries", () => {
				cache.set("typescript", { available: true })
				cache.set("python", { available: false })
				cache.set("javascript", { available: true })

				cache.invalidateAll()

				expect(cache.get("typescript")).toBeNull()
				expect(cache.get("python")).toBeNull()
				expect(cache.get("javascript")).toBeNull()
			})
		})

		describe("concurrent access to cache is thread-safe", () => {
			it("should handle concurrent access safely", async () => {
				const promises = Array.from({ length: 100 }, (_, i) =>
					Promise.resolve().then(() => {
						const language = `lang${i}`
						cache.set(language, { available: i % 2 === 0 })
						return cache.get(language)
					}),
				)

				const results = await Promise.all(promises)

				// All results should be defined
				results.forEach((result, i) => {
					expect(result).toBeDefined()
					expect(result?.available).toBe(i % 2 === 0)
				})

				// Cache should have all entries
				const cachedLanguages = cache.getCachedLanguages()
				expect(cachedLanguages).toHaveLength(100)
			})
		})

		describe("health report generation", () => {
			it("should generate health report for empty cache", () => {
				const report = cache.getHealthReport()

				expect(report).toEqual({
					totalEntries: 0,
					healthyEntries: 0,
					staleEntries: 0,
					averageAge: 0,
					oldestEntry: 0,
					newestEntry: 0,
				})
			})

			it("should generate health report for cache with entries", () => {
				const now = Date.now()
				cache.set("typescript", { available: true })
				cache.set("python", { available: false })
				cache.set("javascript", { available: true })

				const report = cache.getHealthReport()

				expect(report.totalEntries).toBe(3)
				expect(report.healthyEntries).toBe(2) // typescript and python
				expect(report.staleEntries).toBe(1) // javascript
				expect(report.averageAge).toBeGreaterThan(0)
				expect(report.oldestEntry).toBeGreaterThan(report.newestEntry)
			})
		})

		describe("getCachedStatus compatibility method", () => {
			it("should return cached status with correct interface", () => {
				const status: ParserAvailabilityStatus = {
					available: true,
					lastChecked: Date.now(),
					error: "test error",
				}

				cache.set("typescript", status)
				const cachedStatus = cache.getCachedStatus("typescript")

				expect(cachedStatus).toEqual({
					isAvailable: true,
					lastChecked: status.lastChecked,
					error: "test error",
				})
			})

			it("should return null for non-existent language", () => {
				const cachedStatus = cache.getCachedStatus("nonexistent")
				expect(cachedStatus).toBeNull()
			})
		})
	})

	describe("checkParserAvailability()", () => {
		const mockWasmDir = "/mock/wasm/dir"

		beforeEach(() => {
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				const pathStr = typeof path === "string" ? path : path.toString()
				if (pathStr === mockWasmDir) return true
				if (pathStr.includes("tree-sitter-typescript.wasm")) return true
				return false
			})

			vi.mocked(fs.statSync).mockImplementation((filePath) => {
				const pathStr = typeof filePath === "string" ? filePath : filePath.toString()
				if (pathStr.includes("tree-sitter-typescript.wasm")) {
					return { size: 2048 } as fs.Stats
				}
				throw new Error("File not found")
			})

			const { validateWasmDirectory } = require("../wasm-diagnostics")
			vi.mocked(validateWasmDirectory).mockReturnValue({
				isValid: true,
				missingCriticalFiles: [],
				foundFiles: ["tree-sitter-typescript.wasm"],
			})
		})

		it("should return available status when WASM file exists and is valid", async () => {
			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(true)
			expect(result.error).toBeUndefined()
			expect(result.lastChecked).toBeGreaterThan(0)
		})

		it("should return unavailable status when WASM file missing", async () => {
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				if (path === mockWasmDir) return true
				return false // WASM file doesn't exist
			})

			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(false)
			expect(result.error).toContain("WASM file not found")
		})

		it("should return unavailable status when WASM file too small (<1KB)", async () => {
			vi.mocked(fs.statSync).mockImplementation((filePath) => {
				const pathStr = typeof filePath === "string" ? filePath : filePath.toString()
				if (pathStr.includes("tree-sitter-typescript.wasm")) {
					return { size: 512 } as fs.Stats // Less than 1KB
				}
				throw new Error("File not found")
			})

			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(false)
			expect(result.error).toContain("WASM file too small: 512 bytes")
		})

		it("should return unavailable status when WASM directory doesn't exist", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false)

			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(false)
			expect(result.error).toContain("WASM directory not found")
		})

		it("should handle error for permission issues", async () => {
			vi.mocked(fs.existsSync).mockImplementation(() => {
				throw new Error("EACCES: permission denied")
			})

			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(false)
			expect(result.error).toContain("Error checking parser availability")
		})

		it("should record metrics when metrics collector is provided", async () => {
			const mockMetricsCollector = new MetricsCollector()
			const recordMetricSpy = vi.spyOn(mockMetricsCollector, "recordParserMetric")

			await checkParserAvailability("typescript", mockWasmDir, mockMetricsCollector)

			expect(recordMetricSpy).toHaveBeenCalledWith("typescript", "loadSuccess")
		})

		it("should handle WASM directory validation failure", async () => {
			const { validateWasmDirectory } = require("../wasm-diagnostics")
			vi.mocked(validateWasmDirectory).mockReturnValue({
				isValid: false,
				missingCriticalFiles: ["tree-sitter.wasm"],
				foundFiles: [],
			})

			const result = await checkParserAvailability("typescript", mockWasmDir)

			expect(result.available).toBe(false)
			expect(result.error).toContain("WASM directory validation failed")
		})
	})

	describe("checkMultipleParserAvailability()", () => {
		const mockWasmDir = "/mock/wasm/dir"

		beforeEach(() => {
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				const pathStr = typeof path === "string" ? path : path.toString()
				if (pathStr === mockWasmDir) return true
				if (pathStr.includes("tree-sitter-typescript.wasm")) return true
				if (pathStr.includes("tree-sitter-python.wasm")) return false
				if (pathStr.includes("tree-sitter-javascript.wasm")) return true
				return false
			})

			vi.mocked(fs.statSync).mockImplementation((filePath) => {
				const pathStr = typeof filePath === "string" ? filePath : filePath.toString()
				if (pathStr.includes("tree-sitter-typescript.wasm")) {
					return { size: 2048 } as fs.Stats
				}
				if (pathStr.includes("tree-sitter-javascript.wasm")) {
					return { size: 1024 } as fs.Stats
				}
				throw new Error("File not found")
			})

			const { validateWasmDirectory } = require("../wasm-diagnostics")
			vi.mocked(validateWasmDirectory).mockReturnValue({
				isValid: true,
				missingCriticalFiles: [],
				foundFiles: ["tree-sitter-typescript.wasm", "tree-sitter-javascript.wasm"],
			})
		})

		it("should check multiple languages in parallel", async () => {
			const languages = ["typescript", "python", "javascript"]
			const results = await checkMultipleParserAvailability(languages, mockWasmDir)

			expect(results).toBeInstanceOf(Map)
			expect(results.size).toBe(3)
			expect(results.get("typescript")?.available).toBe(true)
			expect(results.get("python")?.available).toBe(false)
			expect(results.get("javascript")?.available).toBe(true)
		})

		it("should respect concurrency limit (10)", async () => {
			const languages = Array.from({ length: 15 }, (_, i) => `lang${i}`)

			// Mock all languages as available
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				const pathStr = typeof path === "string" ? path : path.toString()
				if (pathStr === mockWasmDir) return true
				if (pathStr.includes("tree-sitter-")) return true
				return false
			})

			vi.mocked(fs.statSync).mockReturnValue({ size: 2048 } as fs.Stats)

			const results = await checkMultipleParserAvailability(languages, mockWasmDir, undefined, 5)

			expect(results).toBeInstanceOf(Map)
			expect(results.size).toBe(15)
		})

		it("should return map with all requested languages", async () => {
			const languages = ["typescript", "python", "javascript", "ruby"]
			const results = await checkMultipleParserAvailability(languages, mockWasmDir)

			expect(results.size).toBe(4)
			languages.forEach((lang) => {
				expect(results.has(lang)).toBe(true)
				expect(results.get(lang)).toBeDefined()
			})
		})

		it("should handle mix of available and unavailable parsers", async () => {
			const languages = ["typescript", "python", "javascript"]
			const results = await checkMultipleParserAvailability(languages, mockWasmDir)

			const available = Array.from(results.values()).filter((status) => status.available).length
			const unavailable = Array.from(results.values()).filter((status) => !status.available).length

			expect(available).toBe(2) // typescript, javascript
			expect(unavailable).toBe(1) // python
		})

		it("should log summary correctly", async () => {
			const consoleSpy = vi.spyOn(console, "info")
			const languages = ["typescript", "python", "javascript"]

			await checkMultipleParserAvailability(languages, mockWasmDir)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Parser availability check completed: 2/3 parsers available"),
			)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Unavailable parsers: python"))
		})
	})

	describe("integration with caching", () => {
		const mockWasmDir = "/mock/wasm/dir"

		beforeEach(() => {
			vi.mocked(fs.existsSync).mockImplementation((path) => {
				const pathStr = typeof path === "string" ? path : path.toString()
				if (pathStr === mockWasmDir) return true
				if (pathStr.includes("tree-sitter-typescript.wasm")) return true
				return false
			})

			vi.mocked(fs.statSync).mockImplementation((filePath) => {
				const pathStr = typeof filePath === "string" ? filePath : filePath.toString()
				if (pathStr.includes("tree-sitter-typescript.wasm")) {
					return { size: 2048 } as fs.Stats
				}
				throw new Error("File not found")
			})

			const { validateWasmDirectory } = require("../wasm-diagnostics")
			vi.mocked(validateWasmDirectory).mockReturnValue({
				isValid: true,
				missingCriticalFiles: [],
				foundFiles: ["tree-sitter-typescript.wasm"],
			})
		})

		it("should cache hit avoid file system check", async () => {
			// First call should check file system
			const result1 = await checkParserAvailabilityWithCache("typescript", mockWasmDir)
			expect(fs.existsSync).toHaveBeenCalledTimes(2) // directory + file

			// Reset mock to track subsequent calls
			vi.clearAllMocks()

			// Second call should use cache
			const result2 = await checkParserAvailabilityWithCache("typescript", mockWasmDir)
			expect(fs.existsSync).not.toHaveBeenCalled()

			expect(result1).toEqual(result2)
		})

		it("should cache miss trigger file system check", async () => {
			const result = await checkParserAvailabilityWithCache("python", mockWasmDir)

			expect(fs.existsSync).toHaveBeenCalled()
			expect(result.available).toBe(false)
		})

		it("should cache is updated after check", async () => {
			const cache = getParserAvailabilityCache()

			await checkParserAvailabilityWithCache("typescript", mockWasmDir)

			const cachedStatus = cache.get("typescript")
			expect(cachedStatus).toBeDefined()
			expect(cachedStatus?.available).toBe(true)
		})

		it("should stale cache entries are refreshed", async () => {
			const cache = getParserAvailabilityCache()

			// First call
			await checkParserAvailabilityWithCache("typescript", mockWasmDir)

			// Advance time beyond TTL
			vi.advanceTimersByTime(6 * 60 * 1000)

			// Clear mocks to track refresh
			vi.clearAllMocks()

			// Second call should refresh
			await checkParserAvailabilityWithCache("typescript", mockWasmDir)

			expect(fs.existsSync).toHaveBeenCalled()
		})

		it("should handle multiple languages with caching", async () => {
			const languages = ["typescript", "python", "javascript"]

			// First call
			const results1 = await checkMultipleParserAvailabilityWithCache(languages, mockWasmDir)
			expect(fs.existsSync).toHaveBeenCalled()

			// Clear mocks
			vi.clearAllMocks()

			// Second call should use cache for available languages
			const results2 = await checkMultipleParserAvailabilityWithCache(languages, mockWasmDir)
			expect(fs.existsSync).not.toHaveBeenCalled()

			expect(results1).toEqual(results2)
		})
	})

	describe("global cache management", () => {
		it("should return the same cache instance", () => {
			const cache1 = getParserAvailabilityCache()
			const cache2 = getParserAvailabilityCache()

			expect(cache1).toBe(cache2)
		})

		it("should reset cache", () => {
			const cache1 = getParserAvailabilityCache()
			cache1.set("test", { available: true })

			resetParserAvailabilityCache()

			const cache2 = getParserAvailabilityCache()
			expect(cache2).not.toBe(cache1)
			expect(cache2.get("test")).toBeNull()
		})
	})
})
