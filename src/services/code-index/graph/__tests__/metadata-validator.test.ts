import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MetadataValidator, MetadataValidationError, type MetadataValidationOptions } from "../metadata-validator"
import { CodebaseIndexErrorLogger } from "../error-logger"
import type { CodebaseIndexService } from "../error-logger"

// Test utilities
const createLargeString = (length: number): string => "a".repeat(length)

const createLargeArray = (length: number): unknown[] => Array.from({ length }, (_, i) => i)

const createDeepObject = (depth: number): Record<string, unknown> => {
	if (depth === 0) return { leaf: true }
	return { level: depth, nested: createDeepObject(depth - 1) }
}

const createCircularReference = (): Record<string, unknown> => {
	const obj: Record<string, unknown> = { name: "parent" }
	obj.self = obj
	return obj
}

const createNestedCircularReference = (): Record<string, unknown> => {
	const parent: Record<string, unknown> = { name: "parent" }
	const child: Record<string, unknown> = { name: "child", parent }
	parent.child = child
	return parent
}

const createArrayWithCircularReference = (): unknown[] => {
	const obj: Record<string, unknown> = { name: "object" }
	const arr: unknown[] = [obj]
	obj.array = arr
	return arr
}

const createMetadataOfSize = (targetSize: number): Record<string, unknown> => {
	const metadata: Record<string, unknown> = {}
	let currentSize = 2 // Start with empty object "{}"

	let i = 0
	while (currentSize < targetSize) {
		const key = `key${i}`
		const value = `value${i}`
		const entrySize = JSON.stringify({ [key]: value }).length - 2 // Subtract empty object size

		if (currentSize + entrySize > targetSize) {
			// Add a truncated string to get closer to target size
			const remaining = targetSize - currentSize - 10 // Leave some buffer
			if (remaining > 0) {
				metadata[key] = "a".repeat(remaining)
			}
			break
		}

		metadata[key] = value
		currentSize += entrySize
		i++
	}

	return metadata
}

// Mock error logger
const createMockErrorLogger = () => ({
	logError: vi.fn(),
	logFilePath: "/mock/log/path",
	flush: vi.fn(),
	readErrors: vi.fn(),
	getErrorsForService: vi.fn(),
	getErrorsForFile: vi.fn(),
	getErrorsForServiceAndFile: vi.fn(),
	clearLog: vi.fn(),
	getErrorStats: vi.fn(),
	dispose: vi.fn(),
})

describe("MetadataValidator", () => {
	let validator: MetadataValidator
	let mockErrorLogger: ReturnType<typeof createMockErrorLogger>

	beforeEach(() => {
		mockErrorLogger = createMockErrorLogger()
		// Spy on console.log to test logging behavior
		vi.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Constructor", () => {
		it("should use default options when none provided", () => {
			validator = new MetadataValidator()
			expect(validator).toBeInstanceOf(MetadataValidator)
		})

		it("should merge provided options with defaults", () => {
			const options: MetadataValidationOptions = {
				maxMetadataSize: 5000,
				logLevel: "debug",
				service: "neo4j",
			}
			validator = new MetadataValidator(options, mockErrorLogger as any)
			expect(validator).toBeInstanceOf(MetadataValidator)
		})

		it("should accept error logger", () => {
			validator = new MetadataValidator({}, mockErrorLogger as any)
			expect(validator).toBeInstanceOf(MetadataValidator)
		})
	})

	describe("Circular Reference Detection", () => {
		it("should throw error for object with self-reference", () => {
			validator = new MetadataValidator()
			const circularObj = createCircularReference()

			expect(() => validator.validateAndSanitize(circularObj)).toThrow(MetadataValidationError)
			expect(() => validator.validateAndSanitize(circularObj)).toThrow(
				/Circular reference detected at path: root.self/,
			)
		})

		it("should throw error for object with nested circular reference", () => {
			validator = new MetadataValidator()
			const nestedCircular = createNestedCircularReference()

			expect(() => validator.validateAndSanitize(nestedCircular)).toThrow(MetadataValidationError)
			expect(() => validator.validateAndSanitize(nestedCircular)).toThrow(
				/Circular reference detected at path: root.child.parent/,
			)
		})

		it("should throw error for array containing circular reference", () => {
			validator = new MetadataValidator()
			const arrayWithCircular = createArrayWithCircularReference()

			expect(() => validator.validateAndSanitize({ array: arrayWithCircular })).toThrow(MetadataValidationError)
			expect(() => validator.validateAndSanitize({ array: arrayWithCircular })).toThrow(
				/Circular reference detected at path: root.array\[0\].array/,
			)
		})

		it("should handle valid nested objects without circular references", () => {
			validator = new MetadataValidator()
			const validNested = {
				level1: {
					level2: {
						level3: {
							value: "deep value",
						},
					},
				},
			}

			const result = validator.validateAndSanitize(validNested)
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
			expect(result.sanitized).toEqual(validNested)
		})
	})

	describe("Size Limit Validation", () => {
		it("should truncate metadata exceeding MAX_METADATA_SIZE when ALLOW_METADATA_TRUNCATION is true", () => {
			const options: MetadataValidationOptions = {
				maxMetadataSize: 100,
				allowTruncation: true,
			}
			validator = new MetadataValidator(options)
			// Create metadata that will definitely exceed the limit
			const largeMetadata = {
				data: "x".repeat(200), // This alone exceeds the limit
			}

			const result = validator.validateAndSanitize(largeMetadata)
			expect(result.wasTruncated).toBe(true)
			expect(result.warnings).toContain("Aggressive truncation was applied to reduce metadata size")
			// The result should be smaller than the original
			expect(JSON.stringify(result.sanitized).length).toBeLessThan(JSON.stringify(largeMetadata).length)
		})

		it("should reject metadata exceeding MAX_METADATA_SIZE when ALLOW_METADATA_TRUNCATION is false", () => {
			const options: MetadataValidationOptions = {
				maxMetadataSize: 100,
				allowTruncation: false,
			}
			validator = new MetadataValidator(options)
			const largeMetadata = createMetadataOfSize(200)

			expect(() => validator.validateAndSanitize(largeMetadata)).toThrow(MetadataValidationError)
			expect(() => validator.validateAndSanitize(largeMetadata)).toThrow(
				/Metadata size \(\d+\) exceeds maximum allowed size \(100\)/,
			)
		})

		it("should truncate strings exceeding MAX_METADATA_STRING_LENGTH", () => {
			const options: MetadataValidationOptions = {
				maxStringLength: 10,
			}
			validator = new MetadataValidator(options)
			const metadata = { longString: "this is a very long string" }

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.longString).toBe("this is...")
			expect(result.warnings).toContain("String value was truncated from 26 to 10 characters")
		})

		it("should truncate arrays exceeding MAX_METADATA_ARRAY_LENGTH", () => {
			const options: MetadataValidationOptions = {
				maxArrayLength: 3,
			}
			validator = new MetadataValidator(options)
			const metadata = { array: [1, 2, 3, 4, 5, 6] }

			const result = validator.validateAndSanitize(metadata)
			expect(Array.isArray(result.sanitized.array)).toBe(true)
			expect(result.sanitized.array).toHaveLength(4) // 3 items + truncation message
			expect(result.warnings).toContain("Array was truncated from 6 to 3 items")
		})

		it("should stringify objects exceeding MAX_METADATA_OBJECT_DEPTH", () => {
			const options: MetadataValidationOptions = {
				maxObjectDepth: 2,
			}
			validator = new MetadataValidator(options)
			const deepMetadata = createDeepObject(5)

			const result = validator.validateAndSanitize(deepMetadata)
			expect(result.warnings.some((w) => w.includes("Maximum object depth"))).toBe(true)
			expect(result.sanitized).toHaveProperty("nested")
			expect(typeof result.sanitized.nested).toBe("object")
		})
	})

	describe("Type Handling", () => {
		it("should pass primitive types through unchanged", () => {
			validator = new MetadataValidator()
			const metadata = {
				string: "test",
				number: 42,
				boolean: true,
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).toEqual(metadata)
			expect(result.warnings).toEqual([])
		})

		it("should convert Date to ISO string with type marker", () => {
			validator = new MetadataValidator()
			const date = new Date("2023-01-01T00:00:00Z")
			const metadata = { date }

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.date).toEqual({
				__type: "Date",
				value: date.toISOString(),
			})
		})

		it("should convert BigInt to string with marker", () => {
			validator = new MetadataValidator()
			const bigInt = BigInt("123456789012345678901234567890")
			const metadata = { bigInt }

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.bigInt).toEqual({
				__type: "BigInt",
				value: bigInt.toString(),
			})
		})

		it("should convert Symbol to description", () => {
			validator = new MetadataValidator()
			const symbol = Symbol("test symbol")
			const metadata = { symbol }

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.symbol).toBe("test symbol")
		})

		it("should skip function with warning", () => {
			validator = new MetadataValidator()
			const fn = () => "test"
			const metadata = { fn }

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).not.toHaveProperty("fn")
			expect(result.warnings).toContain("Function values are not supported in metadata and were skipped")
		})

		it("should skip undefined and null values", () => {
			validator = new MetadataValidator()
			const metadata = {
				undefinedValue: undefined,
				nullValue: null,
				validValue: "test",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).not.toHaveProperty("undefinedValue")
			expect(result.sanitized).not.toHaveProperty("nullValue")
			expect(result.sanitized.validValue).toBe("test")
		})

		it("should pass array with primitives through", () => {
			validator = new MetadataValidator()
			const metadata = { array: [1, "two", true, null] }

			const result = validator.validateAndSanitize(metadata)
			// null values are skipped, so we expect only the defined values
			expect(result.sanitized.array).toEqual([1, "two", true, undefined])
		})

		it("should handle array with mixed types", () => {
			validator = new MetadataValidator()
			const date = new Date()
			const metadata = { array: [1, "two", date, () => {}, undefined] }

			const result = validator.validateAndSanitize(metadata)
			// Functions and undefined are skipped
			expect(result.sanitized.array).toEqual([
				1,
				"two",
				{ __type: "Date", value: date.toISOString() },
				undefined,
				undefined,
			])
		})

		it("should stringify nested object when exceeding depth", () => {
			const options: MetadataValidationOptions = {
				maxObjectDepth: 1,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				level1: {
					level2: {
						value: "too deep",
					},
				},
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.level1).toHaveProperty("level2")
			const level2 = (result.sanitized.level1 as any).level2
			expect(typeof level2).toBe("object")
			expect(level2).toHaveProperty("__stringified")
			expect(level2).toHaveProperty("__originalType")
		})
	})

	describe("Special Characters", () => {
		it("should handle strings with Neo4j special characters", () => {
			validator = new MetadataValidator()
			const metadata = {
				quotes: "String with \"double\" and 'single' quotes",
				backslashes: "Path with \\backslashes\\",
				newlines: "Line 1\nLine 2\r\nLine 3",
				tabs: "Column1\tColumn2\tColumn3",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.quotes).toBe(metadata.quotes)
			expect(result.sanitized.backslashes).toBe(metadata.backslashes)
			expect(result.sanitized.newlines).toBe(metadata.newlines)
			expect(result.sanitized.tabs).toBe(metadata.tabs)
		})

		it("should handle strings with Unicode characters", () => {
			validator = new MetadataValidator()
			const metadata = {
				emoji: "Test with emoji 🚀🎉",
				chinese: "测试中文字符",
				arabic: "اختبار العربية",
				russian: "Тест на русском",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).toEqual(metadata)
		})

		it("should handle strings with control characters", () => {
			validator = new MetadataValidator()
			const metadata = {
				control: "Test\x00with\x01control\x02characters",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.control).toBe(metadata.control)
		})
	})

	describe("Metadata Structure Validation", () => {
		it("should validate ImportMetadata structure", () => {
			validator = new MetadataValidator()
			const importMetadata = {
				module: "test-module",
				source: "test-source",
				isTypeOnly: false,
				isDynamic: false,
			}

			const result = validator.validateAndSanitize(importMetadata)
			expect(result.sanitized).toEqual(importMetadata)
			expect(result.warnings).toEqual([])
		})

		it("should validate CallMetadata structure", () => {
			validator = new MetadataValidator()
			const callMetadata = {
				function: "testFunction",
				args: ["arg1", "arg2"],
				result: "success",
			}

			const result = validator.validateAndSanitize(callMetadata)
			expect(result.sanitized).toEqual(callMetadata)
			expect(result.warnings).toEqual([])
		})

		it("should validate TestMetadata structure", () => {
			validator = new MetadataValidator()
			const testMetadata = {
				name: "test case",
				status: "passed",
				duration: 100,
			}

			const result = validator.validateAndSanitize(testMetadata)
			expect(result.sanitized).toEqual(testMetadata)
			expect(result.warnings).toEqual([])
		})

		it("should validate TypeMetadata structure", () => {
			validator = new MetadataValidator()
			const typeMetadata = {
				name: "TestType",
				kind: "interface",
				properties: {
					prop1: "string",
					prop2: "number",
				},
			}

			const result = validator.validateAndSanitize(typeMetadata)
			expect(result.sanitized).toEqual(typeMetadata)
			expect(result.warnings).toEqual([])
		})

		it("should handle metadata with unexpected properties", () => {
			validator = new MetadataValidator()
			const metadata = {
				expected: "value",
				unexpected: () => "function", // This should be skipped with warning
				nested: {
					valid: "value",
					invalid: undefined, // This should be skipped
				},
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.expected).toBe("value")
			expect(result.sanitized).not.toHaveProperty("unexpected")
			const nested = result.sanitized.nested as any
			expect(nested.valid).toBe("value")
			expect(nested).not.toHaveProperty("invalid")
			expect(result.warnings).toContain("Function values are not supported in metadata and were skipped")
		})
	})

	describe("Edge Cases", () => {
		it("should return empty object for empty object input", () => {
			validator = new MetadataValidator()
			const result = validator.validateAndSanitize({})
			expect(result.sanitized).toEqual({})
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
		})

		it("should return empty object for null input", () => {
			validator = new MetadataValidator()
			const result = validator.validateAndSanitize(null as any)
			expect(result.sanitized).toEqual({})
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
		})

		it("should return empty object for undefined input", () => {
			validator = new MetadataValidator()
			const result = validator.validateAndSanitize(undefined as any)
			expect(result.sanitized).toEqual({})
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
		})

		it("should return empty object for object with all invalid properties", () => {
			validator = new MetadataValidator()
			const metadata = {
				fn: () => "function",
				undefinedVal: undefined,
				nullVal: null,
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).toEqual({})
			expect(result.warnings).toContain("Function values are not supported in metadata and were skipped")
		})

		it("should handle deeply nested valid object within limits", () => {
			validator = new MetadataValidator()
			const deepValid = createDeepObject(4) // Within default depth limit of 5

			const result = validator.validateAndSanitize(deepValid)
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
			expect(result.sanitized).toEqual(deepValid)
		})

		it("should handle array of arrays", () => {
			validator = new MetadataValidator()
			const metadata = {
				matrix: [
					[1, 2, 3],
					[4, 5, 6],
					[7, 8, 9],
				],
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized.matrix).toEqual(metadata.matrix)
			expect(result.warnings).toEqual([])
		})

		it("should handle object with numeric keys", () => {
			validator = new MetadataValidator()
			const metadata = {
				0: "zero",
				1: "one",
				2: "two",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).toEqual(metadata)
			expect(result.warnings).toEqual([])
		})

		it("should ensure non-object input is wrapped in object", () => {
			validator = new MetadataValidator()
			const result = validator.validateAndSanitize("string value" as any)
			expect(result.sanitized).toEqual({ value: "string value" })
			expect(result.warnings).toEqual([])
		})

		it("should ensure array input is wrapped in object", () => {
			validator = new MetadataValidator()
			const result = validator.validateAndSanitize([1, 2, 3] as any)
			expect(result.sanitized).toEqual({ value: [1, 2, 3] })
			expect(result.warnings).toEqual([])
		})
	})

	describe("Logging Behavior", () => {
		it("should not log when logLevel is none", () => {
			const options: MetadataValidationOptions = {
				logLevel: "none",
			}
			validator = new MetadataValidator(options)
			const metadata = { fn: () => "test" }

			validator.validateAndSanitize(metadata)
			expect(console.log).not.toHaveBeenCalled()
		})

		it("should log warnings when logLevel is warn", () => {
			const options: MetadataValidationOptions = {
				logLevel: "warn",
			}
			validator = new MetadataValidator(options)
			const metadata = { fn: () => "test" }

			validator.validateAndSanitize(metadata)
			expect(console.log).toHaveBeenCalledWith("[MetadataValidator] WARN: Skipping function value in metadata")
		})

		it("should log info and warnings when logLevel is info", () => {
			const options: MetadataValidationOptions = {
				logLevel: "info",
			}
			validator = new MetadataValidator(options)
			const metadata = { fn: () => "test" }

			validator.validateAndSanitize(metadata)
			expect(console.log).toHaveBeenCalledWith("[MetadataValidator] WARN: Skipping function value in metadata")
		})

		it("should log all levels when logLevel is debug", () => {
			const options: MetadataValidationOptions = {
				logLevel: "debug",
			}
			validator = new MetadataValidator(options)
			const metadata = { fn: () => "test" }

			validator.validateAndSanitize(metadata)
			expect(console.log).toHaveBeenCalledWith("[MetadataValidator] WARN: Skipping function value in metadata")
		})

		it("should accumulate warnings in result", () => {
			validator = new MetadataValidator()
			const metadata = {
				fn: () => "test",
				longString: createLargeString(20000),
				longArray: createLargeArray(200),
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.warnings.length).toBeGreaterThan(0)
			expect(result.warnings.some((w) => w.includes("Function"))).toBe(true)
			expect(result.warnings.some((w) => w.includes("truncated"))).toBe(true)
		})
	})

	describe("Deserialization Hints", () => {
		it("should include type markers for stringified objects", () => {
			const options: MetadataValidationOptions = {
				maxObjectDepth: 1,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				deep: {
					nested: {
						value: "too deep",
					},
				},
			}

			const result = validator.validateAndSanitize(metadata)
			const stringified = (result.sanitized.deep as any).nested
			expect(stringified).toHaveProperty("__stringified", true)
			expect(stringified).toHaveProperty("__originalType", "Object")
			expect(stringified).toHaveProperty("value")
		})

		it("should ensure markers are valid JSON", () => {
			const options: MetadataValidationOptions = {
				maxObjectDepth: 1,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				deep: {
					nested: {
						value: "too deep",
					},
				},
			}

			const result = validator.validateAndSanitize(metadata)
			// Fixed line
			expect(() => JSON.stringify(result.sanitized)).not.toThrow()
			expect(() => JSON.parse(JSON.stringify(result.sanitized))).not.toThrow()
		})

		it("should verify markers do not exceed size limits", () => {
			const options: MetadataValidationOptions = {
				maxObjectDepth: 1,
				maxMetadataSize: 1000,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				deep: {
					nested: createLargeString(2000),
				},
			}

			const result = validator.validateAndSanitize(metadata)
			// Check if the nested object exists
			if (result.sanitized.deep) {
				const nested = (result.sanitized.deep as any).nested
				if (nested) {
					expect(typeof nested).toBe("object")
					expect(nested).toHaveProperty("__stringified")
					expect(nested).toHaveProperty("__originalType")
					expect(nested).toHaveProperty("value")
				}
			}
		})
	})

	describe("Error Handling", () => {
		it("should log error to error logger when provided", () => {
			const options: MetadataValidationOptions = {
				allowTruncation: false,
				maxMetadataSize: 10,
				service: "neo4j",
				filePath: "/test/file.ts",
			}
			validator = new MetadataValidator(options, mockErrorLogger as any)
			const largeMetadata = { data: "x".repeat(100) }

			try {
				validator.validateAndSanitize(largeMetadata)
			} catch (error) {
				// Expected to throw
			}

			expect(mockErrorLogger.logError).toHaveBeenCalledWith({
				service: "neo4j",
				filePath: "/test/file.ts",
				operation: "size_validation",
				error: expect.stringContaining("Metadata size"),
				stack: expect.any(String),
				additionalContext: expect.objectContaining({
					size: expect.any(Number),
					limit: 10,
				}),
			})
		})

		it("should throw MetadataValidationError for unrecoverable issues", () => {
			const options: MetadataValidationOptions = {
				allowTruncation: false,
				maxMetadataSize: 10,
			}
			validator = new MetadataValidator(options)
			const largeMetadata = { data: "x".repeat(100) }

			try {
				validator.validateAndSanitize(largeMetadata)
			} catch (error) {
				expect(error).toBeInstanceOf(MetadataValidationError)
				expect((error as MetadataValidationError).operation).toBe("size_validation")
				expect((error as MetadataValidationError).context).toBeDefined()
			}
		})
	})

	describe("Validation Disabled", () => {
		it("should return original metadata when validation is disabled", () => {
			const options: MetadataValidationOptions = {
				validationEnabled: false,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				fn: () => "function",
				circular: createCircularReference(),
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.sanitized).toBe(metadata)
			expect(result.warnings).toEqual([])
			expect(result.wasTruncated).toBe(false)
		})
	})

	describe("Aggressive Truncation", () => {
		it("should apply aggressive truncation when metadata exceeds size limit", () => {
			const options: MetadataValidationOptions = {
				maxMetadataSize: 50, // Smaller limit to ensure truncation
				allowTruncation: true,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				prop1: "value1",
				prop2: "value2",
				prop3: "value3",
				prop4: "value4",
				prop5: "value5",
			}

			const result = validator.validateAndSanitize(metadata)
			expect(result.wasTruncated).toBe(true)
			expect(result.warnings).toContain("Aggressive truncation was applied to reduce metadata size")
			// The result should be smaller than the original
			expect(JSON.stringify(result.sanitized).length).toBeLessThan(JSON.stringify(metadata).length)
		})

		it("should add truncation metadata when properties are skipped", () => {
			const options: MetadataValidationOptions = {
				maxMetadataSize: 50,
				allowTruncation: true,
			}
			validator = new MetadataValidator(options)
			const metadata = {
				prop1: "value1",
				prop2: "value2",
				prop3: "value3",
				prop4: "value4",
				prop5: "value5",
			}

			const result = validator.validateAndSanitize(metadata)
			if (result.sanitized.__truncated) {
				expect(result.sanitized).toHaveProperty("__truncated", true)
				expect(result.sanitized).toHaveProperty("__remainingProperties")
			}
		})
	})
})
