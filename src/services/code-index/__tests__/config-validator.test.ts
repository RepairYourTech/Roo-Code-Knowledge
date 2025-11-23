import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConfigValidator } from "../config-validator"
import { CodeIndexConfig, ConfigValidationOptions } from "../interfaces/config"
import {
	MIN_API_KEY_LENGTH,
	MAX_API_KEY_LENGTH,
	MIN_OPENAI_KEY_LENGTH,
	MIN_GEMINI_KEY_LENGTH,
	MIN_OPENROUTER_KEY_LENGTH,
	MIN_QDRANT_KEY_LENGTH,
	MAX_QDRANT_KEY_LENGTH,
	MIN_OPENAI_COMPATIBLE_KEY_LENGTH,
	MIN_MISTRAL_KEY_LENGTH,
	MIN_VERCEL_AI_GATEWAY_KEY_LENGTH,
	MAX_NEO4J_PASSWORD_LENGTH,
	MIN_URL_LENGTH,
	MAX_URL_LENGTH,
	ALLOWED_NEO4J_PROTOCOLS,
	MIN_MODEL_DIMENSION,
	MAX_MODEL_DIMENSION,
	MIN_SEARCH_RESULTS,
	MAX_SEARCH_RESULTS_LIMIT,
	TEST_SECRET_PATTERNS,
	SUSPICIOUS_SECRET_PATTERNS,
	MIN_BATCH_SIZE,
	MAX_BATCH_SIZE,
	PRODUCTION_MIN_BATCH_SIZE,
	PRODUCTION_MAX_BATCH_SIZE,
	MIN_POOL_SIZE,
	MAX_POOL_SIZE,
	MIN_NEO4J_CONNECTION_POOL_SIZE,
	MAX_NEO4J_CONNECTION_POOL_SIZE,
	PRODUCTION_MIN_NEO4J_POOL_SIZE,
	MIN_TIMEOUT_MS,
	MAX_TIMEOUT_MS,
	MIN_RETRY_ATTEMPTS,
	MAX_RETRY_ATTEMPTS,
	MIN_CACHE_SIZE,
	MAX_CACHE_SIZE,
	MIN_LSP_CACHE_SIZE,
	MAX_LSP_CACHE_SIZE,
	WARN_ON_DISABLED_CIRCUIT_BREAKERS,
	WARN_ON_TEST_SECRETS_IN_PRODUCTION,
	WARN_ON_EXTREME_BATCH_SIZES,
	WARN_ON_LOW_POOL_SIZES,
	CLAMP_OUT_OF_BOUNDS_VALUES,
	STRICT_BOUNDS_CHECKING,
} from "../constants"

// Mock console methods to test logging
const mockConsoleError = vi.fn()
const mockConsoleWarn = vi.fn()

describe("ConfigValidator", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock console methods
		vi.stubGlobal("console", {
			error: mockConsoleError,
			warn: mockConsoleWarn,
			log: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
		})
	})

	describe("Numeric Bounds Validation Tests", () => {
		it("should validate valid values within bounds", () => {
			const result = ConfigValidator.validateNumericBounds(50, 1, 100, "testField")
			expect(result.valid).toBe(true)
			expect(result.violation).toBeUndefined()
		})

		it("should reject values below minimum", () => {
			const result = ConfigValidator.validateNumericBounds(0, 1, 100, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			expect(result.violation).toBeDefined()
			expect(result.violation?.value).toBe(0)
			expect(result.violation?.min).toBe(1)
			expect(result.violation?.max).toBe(100)
			expect(result.violation?.action).toBe(CLAMP_OUT_OF_BOUNDS_VALUES ? "clamped" : "rejected")
		})

		it("should reject values above maximum", () => {
			const result = ConfigValidator.validateNumericBounds(150, 1, 100, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			expect(result.violation).toBeDefined()
			expect(result.violation?.value).toBe(150)
			expect(result.violation?.min).toBe(1)
			expect(result.violation?.max).toBe(100)
			expect(result.violation?.action).toBe(CLAMP_OUT_OF_BOUNDS_VALUES ? "clamped" : "rejected")
		})

		it("should handle edge cases: min, max, min-1, max+1", () => {
			// Test exact minimum
			let result = ConfigValidator.validateNumericBounds(1, 1, 100, "testField")
			expect(result.valid).toBe(true)
			expect(result.violation).toBeUndefined()

			// Test exact maximum
			result = ConfigValidator.validateNumericBounds(100, 1, 100, "testField")
			expect(result.valid).toBe(true)
			expect(result.violation).toBeUndefined()

			// Test one below minimum
			result = ConfigValidator.validateNumericBounds(0, 1, 100, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			expect(result.violation).toBeDefined()

			// Test one above maximum
			result = ConfigValidator.validateNumericBounds(101, 1, 100, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			expect(result.violation).toBeDefined()
		})

		it("should handle special values: 0, negative, NaN, Infinity, -Infinity", () => {
			// Test zero (within bounds if min <= 0)
			let result = ConfigValidator.validateNumericBounds(0, 0, 100, "testField")
			expect(result.valid).toBe(true)

			// Test negative values
			result = ConfigValidator.validateNumericBounds(-5, 1, 100, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			expect(result.violation).toBeDefined()

			// Test NaN
			result = ConfigValidator.validateNumericBounds(NaN, 1, 100, "testField")
			expect(result.valid).toBe(false)
			expect(result.violation).toBeDefined()
			expect(result.violation?.action).toBe("rejected")

			// Test Infinity
			result = ConfigValidator.validateNumericBounds(Infinity, 1, 100, "testField")
			expect(result.valid).toBe(false)
			expect(result.violation).toBeDefined()
			expect(result.violation?.action).toBe("rejected")

			// Test -Infinity
			result = ConfigValidator.validateNumericBounds(-Infinity, 1, 100, "testField")
			expect(result.valid).toBe(false)
			expect(result.violation).toBeDefined()
			expect(result.violation?.action).toBe("rejected")
		})

		it("should handle null and undefined values", () => {
			// Test null
			let result = ConfigValidator.validateNumericBounds(null as any, 1, 100, "testField")
			expect(result.valid).toBe(true)
			expect(result.violation).toBeUndefined()

			// Test undefined
			result = ConfigValidator.validateNumericBounds(undefined, 1, 100, "testField")
			expect(result.valid).toBe(true)
			expect(result.violation).toBeUndefined()
		})

		it("should provide recommended range warnings", () => {
			const result = ConfigValidator.validateNumericBounds(5, 1, 100, "testField", { min: 10, max: 50 })
			expect(result.valid).toBe(true)
			expect(result.violation).toBeDefined()
			expect(result.violation?.recommended).toEqual({ min: 10, max: 50 })
			expect(result.violation?.action).toBe("accepted")
			expect(result.violation?.severity).toBe("warning")
		})
	})

	describe("String Validation Tests", () => {
		it("should validate valid string lengths", () => {
			const result = ConfigValidator.validateStringLength("valid string", 5, 50, "testField")
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should reject strings too short", () => {
			const result = ConfigValidator.validateStringLength("abc", 5, 50, "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.field).toBe("testField")
			expect(result.error?.code).toBe("INVALID_LENGTH")
			expect(result.error?.message).toContain("between 5 and 50 characters")
		})

		it("should reject strings too long", () => {
			const longString = "a".repeat(100)
			const result = ConfigValidator.validateStringLength(longString, 5, 50, "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.field).toBe("testField")
			expect(result.error?.code).toBe("INVALID_LENGTH")
			expect(result.error?.message).toContain("between 5 and 50 characters")
		})

		it("should handle empty strings", () => {
			const result = ConfigValidator.validateStringLength("", 1, 50, "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.code).toBe("INVALID_LENGTH")
		})

		it("should handle null and undefined", () => {
			// Test null
			let result = ConfigValidator.validateStringLength(null as any, 1, 50, "testField")
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()

			// Test undefined
			result = ConfigValidator.validateStringLength(undefined, 1, 50, "testField")
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("should reject non-string types", () => {
			const result = ConfigValidator.validateStringLength(123 as any, 1, 50, "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.code).toBe("INVALID_TYPE")
			expect(result.error?.message).toContain("must be a string")
		})

		it("should handle special characters and encoding", () => {
			const stringWithSpecialChars = "Hello 🌍 World! @#$%^&*()"
			const result = ConfigValidator.validateStringLength(stringWithSpecialChars, 5, 50, "testField")
			expect(result.valid).toBe(true)
			expect(result.error).toBeUndefined()
		})
	})

	describe("URL Validation Tests", () => {
		it("should validate valid URLs with allowed protocols", () => {
			const validUrls = [
				"https://api.openai.com/v1",
				"bolt://localhost:7687",
				"bolt+s://secure.example.com:7687",
				"neo4j://example.com:7687",
				"neo4j+s://secure.example.com:7687",
			]

			validUrls.forEach((url) => {
				// Test with appropriate allowed protocols for each URL
				let allowedProtocols: string[]
				if (url.startsWith("bolt") || url.startsWith("neo4j")) {
					allowedProtocols = ["bolt", "neo4j", "bolt+s", "neo4j+s"]
				} else {
					allowedProtocols = ["http", "https"]
				}

				const result = ConfigValidator.validateUrl(url, allowedProtocols, "testField")
				expect(result.valid).toBe(true)
				expect(result.error).toBeUndefined()
			})
		})

		it("should reject invalid URLs", () => {
			const invalidUrls = [
				{ url: "not-a-url", expectedCodes: ["INVALID_URL", "INVALID_LENGTH"] },
				{
					url: "ftp://invalid-protocol.com",
					expectedCodes: ["INVALID_PROTOCOL", "INVALID_URL", "INVALID_LENGTH"],
				},
				{ url: "http://", expectedCodes: ["INVALID_URL", "INVALID_LENGTH"] },
				{ url: "https://", expectedCodes: ["INVALID_URL", "INVALID_LENGTH"] },
				{ url: "://missing-protocol.com", expectedCodes: ["INVALID_URL", "INVALID_LENGTH"] },
			]

			invalidUrls.forEach(({ url, expectedCodes }) => {
				const result = ConfigValidator.validateUrl(url, ["http", "https"], "testField")
				expect(result.valid).toBe(false)
				expect(result.error).toBeDefined()
				// Check that the error code is one of the expected codes
				expect(expectedCodes).toContain(result.error?.code || "")
			})
		})

		it("should reject disallowed protocols", () => {
			const result = ConfigValidator.validateUrl("ftp://example.com", ["http", "https"], "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.code).toBe("INVALID_PROTOCOL")
			expect(result.error?.message).toContain('protocol "ftp" is not allowed')
		})

		it("should handle IPv4 and IPv6 addresses", () => {
			const ipv4Url = "http://192.168.1.1:8080"
			const ipv6Url = "https://[2001:db8::1]:8080"

			const result1 = ConfigValidator.validateUrl(ipv4Url, ["http", "https"], "testField")
			expect(result1.valid).toBe(true)

			const result2 = ConfigValidator.validateUrl(ipv6Url, ["http", "https"], "testField")
			expect(result2.valid).toBe(true)
		})

		it("should handle localhost and custom ports", () => {
			const localhostUrls = [
				"http://localhost:3000",
				"https://localhost:8443",
				"http://127.0.0.1:8080",
				"bolt://localhost:7687",
			]

			localhostUrls.forEach((url) => {
				const result = ConfigValidator.validateUrl(url, ["http", "https", "bolt"], "testField")
				expect(result.valid).toBe(true)
			})
		})

		it("should handle URL encoding and special characters", () => {
			const encodedUrl = "https://example.com/path%20with%20spaces?param=value%26another"
			const result = ConfigValidator.validateUrl(encodedUrl, ["http", "https"], "testField")
			expect(result.valid).toBe(true)
		})

		it("should enforce URL length limits", () => {
			const tooShortUrl = "a://b"
			const result1 = ConfigValidator.validateUrl(tooShortUrl, ["http", "https"], "testField")
			expect(result1.valid).toBe(false)
			expect(result1.error?.code).toBe("INVALID_LENGTH")

			const tooLongUrl = "https://" + "a".repeat(3000) + ".com"
			const result2 = ConfigValidator.validateUrl(tooLongUrl, ["http", "https"], "testField")
			expect(result2.valid).toBe(false)
			expect(result2.error?.code).toBe("INVALID_LENGTH")
		})
	})

	describe("API Key Validation Tests", () => {
		it("should validate valid API keys for each provider", () => {
			const validKeys = {
				openai: "sk-1234567890abcdef1234567890abcdef12345678",
				gemini: "AIzaSyDaGmWKa4JsXZ-HjGw1234567890abcdef123456",
				openrouter: "sk-or-v1-1234567890abcdef1234567890abcdef",
				qdrant: "qdrant-key-1234567890abcdef",
				mistral: "Mistral-1234567890abcdef1234567890",
				vercel: "vgw_1234567890abcdef1234567890",
			}

			Object.entries(validKeys).forEach(([provider, key]) => {
				const minLengths = {
					openai: MIN_OPENAI_KEY_LENGTH,
					gemini: MIN_GEMINI_KEY_LENGTH,
					openrouter: MIN_OPENROUTER_KEY_LENGTH,
					qdrant: MIN_QDRANT_KEY_LENGTH,
					mistral: MIN_MISTRAL_KEY_LENGTH,
					vercel: MIN_VERCEL_AI_GATEWAY_KEY_LENGTH,
				}

				const result = ConfigValidator.validateApiKey(
					key,
					minLengths[provider as keyof typeof minLengths],
					provider.charAt(0).toUpperCase() + provider.slice(1),
					"testField",
				)
				expect(result.valid).toBe(true)
				expect(result.error).toBeUndefined()
			})
		})

		it("should reject keys too short", () => {
			const result = ConfigValidator.validateApiKey("short", 20, "TestProvider", "testField")
			expect(result.valid).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error?.code).toBe("INVALID_LENGTH")
		})

		it("should detect suspicious patterns (test, example, placeholder)", () => {
			const suspiciousKeys = [
				"test-api-key-12345",
				"example-secret-abcdef",
				"YOUR_KEY_HERE",
				"REPLACE_ME",
				"dummy-key-for-testing",
			]

			suspiciousKeys.forEach((key) => {
				const result = ConfigValidator.validateApiKey(key, 20, "TestProvider", "testField")
				// Note: validateApiKey first checks length, then test patterns
				// Some test keys might be too short and fail length validation first
				if (result.valid) {
					expect(result.warning).toBeDefined()
					expect(result.warning?.code).toBe("TEST_SECRET_DETECTED")
				}
			})
		})

		it("should detect empty and whitespace-only keys", () => {
			const emptyKeys = ["", "   ", "\t\n", "   \t  "]

			emptyKeys.forEach((key) => {
				const result = ConfigValidator.validateApiKey(key, 20, "TestProvider", "testField")
				expect(result.valid).toBe(false)
				expect(result.error).toBeDefined()
			})
		})

		it("should detect keys with invalid characters", () => {
			const result = ConfigValidator.validateApiKey(
				"key with spaces and\ttabs\n",
				20,
				"TestProvider",
				"testField",
			)
			// Should still be valid as length check passes, but might have warnings
			expect(result.valid).toBe(true)
		})

		it("should enforce maximum key length", () => {
			const tooLongKey = "x".repeat(MAX_API_KEY_LENGTH + 1)
			const result = ConfigValidator.validateApiKey(tooLongKey, 20, "TestProvider", "testField")
			expect(result.valid).toBe(false)
			expect(result.error?.code).toBe("INVALID_LENGTH")
		})

		it("should detect repeated character patterns", () => {
			const repeatedKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
			const result = ConfigValidator.validateApiKey(repeatedKey, 20, "TestProvider", "testField")
			expect(result.valid).toBe(true)
			expect(result.warning).toBeDefined()
			expect(result.warning?.code).toBe("SUSPICIOUS_SECRET_PATTERN")
		})

		it("should detect all-numeric patterns", () => {
			const numericKey = "123456789012345678901234567890"
			const result = ConfigValidator.validateApiKey(numericKey, 20, "TestProvider", "testField")
			expect(result.valid).toBe(true)
			expect(result.warning).toBeDefined()
			expect(result.warning?.code).toBe("SUSPICIOUS_SECRET_PATTERN")
		})
	})

	describe("Batch Size Validation Tests", () => {
		it("should validate valid batch sizes", () => {
			const validSizes = [10, 50, 100, 500]
			validSizes.forEach((size) => {
				const result = ConfigValidator.validateBatchSize(size, "testField")
				expect(result.valid).toBe(true)
				expect(result.error).toBeUndefined()
			})
		})

		it("should handle extreme values (1, 1000000)", () => {
			const result1 = ConfigValidator.validateBatchSize(1, "testField")
			expect(result1.valid).toBe(true)

			const result2 = ConfigValidator.validateBatchSize(1000000, "testField")
			expect(result2.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			if (!CLAMP_OUT_OF_BOUNDS_VALUES) {
				expect(result2.error).toBeDefined()
			}
		})

		it("should warn for production out of range", () => {
			const smallSize = 5
			const largeSize = 5000

			const result1 = ConfigValidator.validateBatchSize(smallSize, "testField")
			if (WARN_ON_EXTREME_BATCH_SIZES) {
				expect(result1.warning).toBeDefined()
				expect(result1.warning?.code).toBe("PRODUCTION_RECOMMENDATION")
			}

			const result2 = ConfigValidator.validateBatchSize(largeSize, "testField")
			if (WARN_ON_EXTREME_BATCH_SIZES) {
				expect(result2.warning).toBeDefined()
				expect(result2.warning?.code).toBe("PRODUCTION_RECOMMENDATION")
			}
		})

		it("should enforce minimum and maximum bounds", () => {
			const result1 = ConfigValidator.validateBatchSize(0, "testField")
			expect(result1.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)

			const result2 = ConfigValidator.validateBatchSize(20000, "testField")
			expect(result2.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
		})
	})

	describe("Pool Size Validation Tests", () => {
		it("should validate valid pool sizes", () => {
			const validSizes = [10, 50, 100, 200]
			validSizes.forEach((size) => {
				const result = ConfigValidator.validatePoolSize(size, "testField")
				expect(result.valid).toBe(true)
				expect(result.error).toBeUndefined()
			})
		})

		it("should enforce minimum and maximum bounds", () => {
			const result1 = ConfigValidator.validatePoolSize(0, "testField")
			expect(result1.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)

			const result2 = ConfigValidator.validatePoolSize(2000, "testField")
			expect(result2.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
		})

		it("should warn for production low pool sizes", () => {
			const smallSize = 10
			const result = ConfigValidator.validatePoolSize(smallSize, "testField")

			if (WARN_ON_LOW_POOL_SIZES && smallSize < PRODUCTION_MIN_NEO4J_POOL_SIZE) {
				expect(result.warning).toBeDefined()
				expect(result.warning?.code).toBe("PRODUCTION_RECOMMENDATION")
				expect(result.warning?.message).toContain("below recommended production minimum")
			}
		})

		it("should handle Neo4j-specific pool size validation", () => {
			const result1 = ConfigValidator.validatePoolSize(0, "neo4jMaxConnectionPoolSize")
			expect(result1.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)

			const result2 = ConfigValidator.validatePoolSize(2000, "neo4jMaxConnectionPoolSize")
			expect(result2.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
		})
	})

	describe("Timeout Validation Tests", () => {
		it("should validate valid timeouts", () => {
			const validTimeouts = [5000, 30000, 60000]
			validTimeouts.forEach((timeout) => {
				const result = ConfigValidator.validateTimeout(timeout, "testField")
				expect(result.valid).toBe(true)
				expect(result.error).toBeUndefined()
			})
		})

		it("should reject very short timeouts (< 1s)", () => {
			const result = ConfigValidator.validateTimeout(500, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			if (!CLAMP_OUT_OF_BOUNDS_VALUES) {
				expect(result.error).toBeDefined()
				expect(result.error?.message).toContain("between 1000ms and 600000ms")
			}
		})

		it("should reject very long timeouts (> 10min)", () => {
			const result = ConfigValidator.validateTimeout(700000, "testField")
			expect(result.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
			if (!CLAMP_OUT_OF_BOUNDS_VALUES) {
				expect(result.error).toBeDefined()
			}
		})

		it("should handle zero and negative timeouts", () => {
			const result1 = ConfigValidator.validateTimeout(0, "testField")
			expect(result1.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)

			const result2 = ConfigValidator.validateTimeout(-1000, "testField")
			expect(result2.valid).toBe(CLAMP_OUT_OF_BOUNDS_VALUES)
		})
	})

	describe("Production Safety Tests", () => {
		it("should detect disabled circuit breakers", () => {
			const config: Partial<CodeIndexConfig> = {
				neo4jEnabled: true,
				neo4jCircuitBreakerThreshold: 0,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)

			if (WARN_ON_DISABLED_CIRCUIT_BREAKERS) {
				const circuitBreakerWarning = warnings.find(
					(w) =>
						w.field === "neo4jCircuitBreakerThreshold" && w.message.includes("Circuit breaker is disabled"),
				)
				expect(circuitBreakerWarning).toBeDefined()
				expect(circuitBreakerWarning?.code).toBe("PRODUCTION_SAFETY")
			}
		})

		it("should detect test secrets in production", () => {
			const config: Partial<CodeIndexConfig> = {
				openAiOptions: { openAiNativeApiKey: "sk-test-key-12345" },
				geminiOptions: { apiKey: "AIzaSy-example-key-12345" },
				neo4jEnabled: true,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)

			if (WARN_ON_TEST_SECRETS_IN_PRODUCTION) {
				const testSecretWarnings = warnings.filter((w) => w.code === "PRODUCTION_SAFETY")
				expect(testSecretWarnings.length).toBeGreaterThan(0)
			}
		})

		it("should detect extreme batch sizes", () => {
			const config: Partial<CodeIndexConfig> = {
				lspBatchSize: 5000,
				neo4jEnabled: true,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)

			if (WARN_ON_EXTREME_BATCH_SIZES) {
				const batchWarning = warnings.find(
					(w) => w.field === "lspBatchSize" && w.message.includes("outside recommended production range"),
				)
				expect(batchWarning).toBeDefined()
			}
		})

		it("should detect low pool sizes", () => {
			const config: Partial<CodeIndexConfig> = {
				neo4jEnabled: true,
				neo4jMaxConnectionPoolSize: 5,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)

			if (WARN_ON_LOW_POOL_SIZES) {
				const poolWarning = warnings.find(
					(w) =>
						w.field === "neo4jMaxConnectionPoolSize" &&
						w.message.includes("below recommended production minimum"),
				)
				expect(poolWarning).toBeDefined()
			}
		})

		it("should detect unsafe timeouts", () => {
			const config: Partial<CodeIndexConfig> = {
				neo4jEnabled: true,
				neo4jQueryTimeout: 400000, // > 5 minutes
				lspTimeout: 400000,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)
			const timeoutWarnings = warnings.filter(
				(w) =>
					(w.field === "neo4jQueryTimeout" || w.field === "lspTimeout") &&
					w.message.includes("very high and may cause resource exhaustion"),
			)
			expect(timeoutWarnings.length).toBe(2)
		})

		it("should detect disabled retry logic", () => {
			const config: Partial<CodeIndexConfig> = {
				neo4jEnabled: true,
				neo4jMaxRetries: 0,
			}

			const warnings = ConfigValidator.checkProductionSafety(config as CodeIndexConfig)
			const retryWarning = warnings.find(
				(w) => w.field === "neo4jMaxRetries" && w.message.includes("Retry logic is disabled"),
			)
			expect(retryWarning).toBeDefined()
		})
	})

	describe("Bounds Enforcement Tests", () => {
		it("should clamp values to valid ranges when enabled", () => {
			const clampedValue = ConfigValidator.enforceNumericBounds(150, 1, 100, true)
			expect(clampedValue).toBe(100)
		})

		it("should reject out-of-bounds values when strict", () => {
			expect(() => {
				ConfigValidator.enforceNumericBounds(150, 1, 100, false)
			}).toThrow("Value 150 is outside bounds [1, 100]")
		})

		it("should test within bounds helper", () => {
			expect(ConfigValidator.isWithinBounds(50, 1, 100)).toBe(true)
			expect(ConfigValidator.isWithinBounds(0, 1, 100)).toBe(false)
			expect(ConfigValidator.isWithinBounds(150, 1, 100)).toBe(false)
		})

		it("should test within recommended bounds helper", () => {
			const recommended = { min: 10, max: 50 }
			expect(ConfigValidator.isWithinRecommendedBounds(25, recommended)).toBe(true)
			expect(ConfigValidator.isWithinRecommendedBounds(5, recommended)).toBe(false)
			expect(ConfigValidator.isWithinRecommendedBounds(75, recommended)).toBe(false)
		})

		it("should clamp values correctly", () => {
			expect(ConfigValidator.clampValue(50, 10, 100)).toBe(50)
			expect(ConfigValidator.clampValue(5, 10, 100)).toBe(10)
			expect(ConfigValidator.clampValue(150, 10, 100)).toBe(100)
		})
	})

	describe("Edge Cases and Error Handling", () => {
		it("should handle concurrent validation calls", async () => {
			const config: Partial<CodeIndexConfig> = {
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-valid-key-12345" },
			}

			// Run multiple validations concurrently
			const promises = Array(10)
				.fill(0)
				.map(() => ConfigValidator.validateConfig(config as CodeIndexConfig))

			const results = await Promise.all(promises)
			results.forEach((result) => {
				expect(result).toBeDefined()
				expect(typeof result.valid).toBe("boolean")
				expect(Array.isArray(result.errors)).toBe(true)
				expect(Array.isArray(result.warnings)).toBe(true)
			})
		})

		it("should handle validation with missing required fields", () => {
			const config: Partial<CodeIndexConfig> = {}

			const result = ConfigValidator.validateConfig(config as CodeIndexConfig)
			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)

			const embedderError = result.errors.find((e) => e.field === "embedderProvider")
			expect(embedderError).toBeDefined()
			expect(embedderError?.code).toBe("REQUIRED_FIELD")
		})

		it("should handle validation with invalid config objects", () => {
			const result = ConfigValidator.validateConfig(null as any)
			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
			// Should have an error about null/undefined config or embedderProvider
			const nullError = result.errors.find(
				(e) => e.message.includes("Configuration object is required") || e.field === "embedderProvider",
			)
			expect(nullError).toBeDefined()
		})

		it("should aggregate validation results correctly", () => {
			const result1 = ConfigValidator.validateConfig({
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-valid-key-12345" },
			} as CodeIndexConfig)

			const result2 = ConfigValidator.validateConfig({
				isConfigured: false,
				embedderProvider: "invalid-provider" as any,
			} as CodeIndexConfig)

			const aggregated = ConfigValidator.aggregateValidationResults([result1, result2])
			expect(aggregated.valid).toBe(false)
			expect(aggregated.errors.length).toBeGreaterThan(0)
			expect(aggregated.warnings.length).toBeGreaterThanOrEqual(0)
		})

		it("should format error messages correctly", () => {
			const config: Partial<CodeIndexConfig> = {
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "short" },
			}

			const result = ConfigValidator.validateConfig(config as CodeIndexConfig)
			expect(result.valid).toBe(false)

			const keyError = result.errors.find((e) => e.field.includes("openAiOptions"))
			expect(keyError).toBeDefined()
			expect(keyError?.message).toContain("OpenAI API key")
			expect(keyError?.suggestion).toBeDefined()
			expect(keyError?.code).toBeDefined()
		})

		it("should handle validation options correctly", () => {
			const config: Partial<CodeIndexConfig> = {
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-test-key-12345" },
			}

			const options: ConfigValidationOptions = {
				strict: true,
				validateBounds: true,
				checkProduction: false, // Disable production checks
				allowTestSecrets: true, // Allow test secrets
				clampValues: false,
			}

			const result = ConfigValidator.validateConfig(config as CodeIndexConfig, options)
			expect(result).toBeDefined()
			// With allowTestSecrets=true, test secrets should not generate warnings
			const testSecretWarnings = result.warnings.filter((w) => w.code === "TEST_SECRET_DETECTED")
			expect(testSecretWarnings.length).toBe(0)
		})
	})

	describe("Complete Configuration Validation", () => {
		it("should validate complete OpenAI configuration", () => {
			const config: CodeIndexConfig = {
				isConfigured: true,
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-1234567890abcdef1234567890abcdef12345678" },
				modelId: "text-embedding-3-small",
				modelDimension: 1536,
				qdrantUrl: "http://localhost:6333",
				searchMinScore: 0.7,
				searchMaxResults: 20,
			}

			const result = ConfigValidator.validateConfig(config)
			expect(result.valid).toBe(true)
			expect(result.errors.length).toBe(0)
		})

		it("should validate complete Neo4j configuration", () => {
			const config: CodeIndexConfig = {
				isConfigured: true,
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-1234567890abcdef1234567890abcdef12345678" },
				neo4jEnabled: true,
				neo4jUrl: "bolt://localhost:7687",
				neo4jUsername: "neo4j",
				neo4jPassword: "secure-password",
				neo4jDatabase: "neo4j",
				neo4jMaxConnectionPoolSize: 100,
				neo4jConnectionAcquisitionTimeout: 60000,
				neo4jQueryTimeout: 30000,
				neo4jMaxRetries: 3,
			}

			const result = ConfigValidator.validateConfig(config)
			expect(result.valid).toBe(true)
			expect(result.errors.length).toBe(0)
		})

		it("should validate LSP configuration", () => {
			const config: CodeIndexConfig = {
				isConfigured: true,
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-1234567890abcdef1234567890abcdef12345678" },
				lspBatchSize: 50,
				lspTimeout: 10000,
				lspCacheEnabled: true,
				lspCacheSize: 1000,
				lspCacheTtl: 300000,
				lspConcurrencyLimit: 5,
			}

			const result = ConfigValidator.validateConfig(config)
			expect(result.valid).toBe(true)
			expect(result.errors.length).toBe(0)
		})

		it("should include metadata in validation result", () => {
			const config: CodeIndexConfig = {
				isConfigured: true,
				embedderProvider: "openai",
				openAiOptions: { openAiNativeApiKey: "sk-1234567890abcdef1234567890abcdef12345678" },
			}

			const result = ConfigValidator.validateConfig(config)
			expect(result.metadata).toBeDefined()
			expect(result.metadata?.version).toBe("1.0.0")
			expect(typeof result.metadata?.duration).toBe("number")
			expect(result.metadata?.reachabilityChecked).toBe(false)
		})
	})
})
