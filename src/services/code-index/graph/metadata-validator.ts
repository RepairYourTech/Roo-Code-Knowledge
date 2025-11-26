import {
	MAX_METADATA_SIZE,
	MAX_METADATA_STRING_LENGTH,
	MAX_METADATA_ARRAY_LENGTH,
	MAX_METADATA_OBJECT_DEPTH,
	METADATA_VALIDATION_ENABLED,
	METADATA_SANITIZATION_LOG_LEVEL,
	ALLOW_METADATA_TRUNCATION,
} from "../constants"
import { CodebaseIndexErrorLogger, type CodebaseIndexService } from "./error-logger"

/**
 * Configuration options for metadata validation
 */
export interface MetadataValidationOptions {
	/** Maximum total size of serialized metadata */
	maxMetadataSize?: number
	/** Maximum length for individual string values */
	maxStringLength?: number
	/** Maximum number of items in metadata arrays */
	maxArrayLength?: number
	/** Maximum nesting depth for objects in metadata */
	maxObjectDepth?: number
	/** Whether to enable validation */
	validationEnabled?: boolean
	/** Whether to allow truncation of oversized metadata */
	allowTruncation?: boolean
	/** Logging level for transformations */
	logLevel?: "none" | "warn" | "info" | "debug"
	/** Service name for error logging */
	service?: CodebaseIndexService
	/** File path for error context */
	filePath?: string
}

/**
 * Result of metadata validation and sanitization
 */
export interface MetadataValidationResult {
	/** The sanitized metadata object */
	sanitized: Record<string, unknown>
	/** Array of warnings generated during processing */
	warnings: string[]
	/** Whether the metadata was truncated */
	wasTruncated: boolean
}

/**
 * Error thrown when metadata validation encounters unrecoverable issues
 */
export class MetadataValidationError extends Error {
	constructor(
		message: string,
		public readonly operation: string,
		public readonly context?: Record<string, unknown>,
	) {
		super(message)
		this.name = "MetadataValidationError"
	}
}

/**
 * Internal options type with all required fields
 */
interface InternalMetadataValidationOptions {
	maxMetadataSize: number
	maxStringLength: number
	maxArrayLength: number
	maxObjectDepth: number
	validationEnabled: boolean
	allowTruncation: boolean
	logLevel: "none" | "warn" | "info" | "debug"
	service: CodebaseIndexService
	filePath?: string
}

/**
 * Utility class for validating and sanitizing metadata objects before storage
 *
 * This class provides comprehensive validation and sanitization of metadata objects
 * to ensure they comply with Neo4j property size limits and maintain data integrity.
 */
export class MetadataValidator {
	private readonly options: InternalMetadataValidationOptions
	private readonly errorLogger?: CodebaseIndexErrorLogger

	constructor(options: MetadataValidationOptions = {}, errorLogger?: CodebaseIndexErrorLogger) {
		this.options = {
			maxMetadataSize: options.maxMetadataSize ?? MAX_METADATA_SIZE,
			maxStringLength: options.maxStringLength ?? MAX_METADATA_STRING_LENGTH,
			maxArrayLength: options.maxArrayLength ?? MAX_METADATA_ARRAY_LENGTH,
			maxObjectDepth: options.maxObjectDepth ?? MAX_METADATA_OBJECT_DEPTH,
			validationEnabled: options.validationEnabled ?? METADATA_VALIDATION_ENABLED,
			allowTruncation: options.allowTruncation ?? ALLOW_METADATA_TRUNCATION,
			logLevel: options.logLevel ?? METADATA_SANITIZATION_LOG_LEVEL,
			service: options.service ?? "ast",
			filePath: options.filePath,
		}
		this.errorLogger = errorLogger
	}

	/**
	 * Main method that validates and sanitizes metadata
	 *
	 * @param metadata The raw metadata object to validate and sanitize
	 * @returns Validation result with sanitized metadata and warnings
	 * @throws MetadataValidationError for unrecoverable issues
	 */
	validateAndSanitize(metadata: Record<string, unknown>): MetadataValidationResult {
		const warnings: string[] = []
		let wasTruncated = false

		// Skip validation if disabled
		if (!this.options.validationEnabled) {
			return { sanitized: metadata, warnings, wasTruncated }
		}

		try {
			// Check for circular references first
			this.detectCircularReferences(metadata)

			// Sanitize the metadata
			const sanitized = this.sanitizeValue(metadata, 0, warnings, new WeakSet())

			// Ensure the result is a Record<string, unknown>
			const sanitizedRecord = this.ensureRecord(sanitized)

			// Calculate final size
			const finalSize = this.calculateSize(sanitizedRecord)

			// Handle oversized metadata
			if (finalSize > this.options.maxMetadataSize) {
				if (this.options.allowTruncation) {
					this.logTransformation(
						"warn",
						`Metadata size (${finalSize}) exceeds limit (${this.options.maxMetadataSize}), applying aggressive truncation`,
					)
					wasTruncated = true
					// Apply more aggressive truncation
					const aggressivelyTruncated = this.aggressivelyTruncate(sanitizedRecord, warnings)
					return {
						sanitized: aggressivelyTruncated,
						warnings,
						wasTruncated,
					}
				} else {
					throw new MetadataValidationError(
						`Metadata size (${finalSize}) exceeds maximum allowed size (${this.options.maxMetadataSize})`,
						"size_validation",
						{ size: finalSize, limit: this.options.maxMetadataSize },
					)
				}
			}

			return { sanitized: sanitizedRecord, warnings, wasTruncated }
		} catch (error) {
			// Log the error if logger is available
			if (this.errorLogger && error instanceof MetadataValidationError) {
				this.errorLogger.logError({
					service: this.options.service,
					filePath: this.options.filePath,
					operation: error.operation,
					error: error.message,
					stack: error.stack,
					additionalContext: error.context,
				})
			}
			throw error
		}
	}

	/**
	 * Ensures the value is a Record<string, unknown>
	 */
	private ensureRecord(value: unknown): Record<string, unknown> {
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			return value as Record<string, unknown>
		}
		return { value }
	}

	/**
	 * Detects circular references in an object using WeakSet
	 *
	 * @param obj The object to check for circular references
	 * @param visited WeakSet to track visited objects
	 * @param path Current path for error reporting
	 * @throws MetadataValidationError if circular reference is detected
	 */
	private detectCircularReferences(
		obj: unknown,
		visited: WeakSet<object> = new WeakSet(),
		path: string = "root",
	): void {
		if (obj === null || typeof obj !== "object") {
			return
		}

		if (visited.has(obj)) {
			throw new MetadataValidationError(
				`Circular reference detected at path: ${path}`,
				"circular_reference_detection",
				{ path },
			)
		}

		visited.add(obj)

		if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				this.detectCircularReferences(item, visited, `${path}[${index}]`)
			})
		} else {
			Object.entries(obj).forEach(([key, value]) => {
				this.detectCircularReferences(value, visited, `${path}.${key}`)
			})
		}

		visited.delete(obj)
	}

	/**
	 * Recursively sanitizes a value based on its type
	 *
	 * @param value The value to sanitize
	 * @param depth Current nesting depth
	 * @param warnings Array to collect warnings
	 * @param visited WeakSet to track visited objects for circular reference detection
	 * @returns The sanitized value
	 */
	private sanitizeValue(value: unknown, depth: number, warnings: string[], visited: WeakSet<object>): unknown {
		// Check depth limit
		if (depth > this.options.maxObjectDepth) {
			this.logTransformation(
				"warn",
				`Maximum object depth (${this.options.maxObjectDepth}) exceeded, stringifying object`,
			)
			return this.addDeserializationHint(value, "Object")
		}

		// Handle primitives
		if (value === null || value === undefined) {
			return undefined // Skip null/undefined values
		}

		if (typeof value === "string") {
			return this.truncateString(value, warnings)
		}

		if (typeof value === "number" || typeof value === "boolean") {
			return value
		}

		// Handle Date objects
		if (value instanceof Date) {
			return {
				__type: "Date",
				value: value.toISOString(),
			}
		}

		// Handle BigInt
		if (typeof value === "bigint") {
			return {
				__type: "BigInt",
				value: value.toString(),
			}
		}

		// Handle Symbol
		if (typeof value === "symbol") {
			return value.description || "Symbol"
		}

		// Handle Function
		if (typeof value === "function") {
			this.logTransformation("warn", "Skipping function value in metadata")
			warnings.push("Function values are not supported in metadata and were skipped")
			return undefined
		}

		// Handle Arrays
		if (Array.isArray(value)) {
			return this.truncateArray(value, depth, warnings, visited)
		}

		// Handle Objects
		if (typeof value === "object") {
			// Check for circular references
			if (visited.has(value)) {
				throw new MetadataValidationError(
					"Circular reference detected during sanitization",
					"circular_reference_detection",
				)
			}

			visited.add(value)
			const result: Record<string, unknown> = {}

			for (const [key, val] of Object.entries(value)) {
				const sanitized = this.sanitizeValue(val, depth + 1, warnings, visited)
				if (sanitized !== undefined) {
					result[key] = sanitized
				}
			}

			visited.delete(value)
			return result
		}

		// Handle any other types
		this.logTransformation("warn", `Unsupported value type: ${typeof value}, converting to string`)
		warnings.push(`Unsupported value type (${typeof value}) was converted to string`)
		return String(value)
	}

	/**
	 * Estimates the serialized size of a metadata object
	 *
	 * @param obj The object to measure
	 * @returns Estimated size in bytes
	 */
	private calculateSize(obj: unknown): number {
		try {
			return JSON.stringify(obj).length
		} catch (error) {
			// If JSON.stringify fails, estimate based on object properties
			if (typeof obj === "object" && obj !== null) {
				return Object.keys(obj).length * 20 // Rough estimate
			}
			return String(obj).length
		}
	}

	/**
	 * Truncates a string to the maximum allowed length
	 *
	 * @param str The string to truncate
	 * @param warnings Array to collect warnings
	 * @returns The truncated string
	 */
	private truncateString(str: string, warnings: string[]): string {
		if (str.length <= this.options.maxStringLength) {
			return str
		}

		this.logTransformation(
			"warn",
			`String truncated from ${str.length} to ${this.options.maxStringLength} characters`,
		)
		warnings.push(`String value was truncated from ${str.length} to ${this.options.maxStringLength} characters`)

		return str.substring(0, this.options.maxStringLength - 3) + "..."
	}

	/**
	 * Truncates an array to the maximum allowed length
	 *
	 * @param arr The array to truncate
	 * @param depth Current nesting depth
	 * @param warnings Array to collect warnings
	 * @param visited WeakSet to track visited objects
	 * @returns The truncated array
	 */
	private truncateArray(arr: unknown[], depth: number, warnings: string[], visited: WeakSet<object>): unknown[] {
		// Always return a sanitized array of consistent type
		const limit = this.options.maxArrayLength

		if (arr.length <= limit) {
			return arr.map((item) => this.sanitizeValue(item, depth + 1, warnings, visited))
		}

		this.logTransformation("warn", `Array truncated from ${arr.length} to ${limit} items`)
		warnings.push(`Array was truncated from ${arr.length} to ${limit} items`)

		// Return only the truncated items without mixing types
		const truncated = arr.slice(0, limit)
		return truncated.map((item) => this.sanitizeValue(item, depth + 1, warnings, visited))
	}

	/**
	 * Logs metadata transformations based on configured log level
	 *
	 * @param level The log level
	 * @param message The message to log
	 */
	private logTransformation(level: "warn" | "info" | "debug", message: string): void {
		if (this.options.logLevel === "none") {
			return
		}

		const shouldLog =
			this.options.logLevel === "debug" ||
			(this.options.logLevel === "info" && level !== "debug") ||
			(this.options.logLevel === "warn" && level === "warn")

		if (shouldLog) {
			console.log(`[MetadataValidator] ${level.toUpperCase()}: ${message}`)
		}
	}

	/**
	 * Adds deserialization hints to stringified objects
	 *
	 * @param value The value that was stringified
	 * @param originalType The original type of the value
	 * @returns Object with deserialization hints
	 */
	private addDeserializationHint(value: unknown, originalType: string): unknown {
		try {
			const stringified = JSON.stringify(value)
			return {
				__stringified: true,
				__originalType: originalType,
				value: stringified,
			}
		} catch (error) {
			// If JSON.stringify fails, fall back to string conversion
			return {
				__stringified: true,
				__originalType: originalType,
				value: String(value),
			}
		}
	}

	/**
	 * Applies aggressive truncation to reduce metadata size
	 * Enhanced to handle larger metadata limits and smarter truncation
	 *
	 * @param obj The object to truncate
	 * @param warnings Array to collect warnings
	 * @returns Aggressively truncated object
	 */
	private aggressivelyTruncate(obj: Record<string, unknown>, warnings: string[]): Record<string, unknown> {
		this.logTransformation("warn", "Applying aggressive truncation to reduce metadata size")
		warnings.push("Aggressive truncation was applied to reduce metadata size")

		const result: Record<string, unknown> = {}
		let currentSize = 0
		const maxAllowedSize = this.options.maxMetadataSize * 0.8 // Leave some buffer

		// Enhanced truncation with priority-based processing
		const entries = Object.entries(obj)

		// Prioritize important metadata fields for relationship extraction
		const priorityFields = ["calls", "imports", "identifier", "type", "calleeName", "callType"]
		const prioritizedEntries = entries.sort(([keyA], [keyB]) => {
			const priorityA = priorityFields.includes(keyA) ? 0 : 1
			const priorityB = priorityFields.includes(keyB) ? 0 : 1
			return priorityA - priorityB
		})

		for (const [key, value] of prioritizedEntries) {
			const serializedValue = JSON.stringify(value)

			// For arrays, consider truncating individual items if the array is too large
			if (Array.isArray(value) && value.length > this.options.maxArrayLength) {
				const truncatedArray = value.slice(0, this.options.maxArrayLength)
				const truncatedSerialized = JSON.stringify(truncatedArray)

				if (currentSize + truncatedSerialized.length > maxAllowedSize) {
					// Add truncated array with indicator
					result[key] = [
						...truncatedArray,
						`... and ${value.length - this.options.maxArrayLength} more items (truncated due to size limit)`,
					]
					currentSize += JSON.stringify(result[key]).length
					warnings.push(
						`Array '${key}' truncated from ${value.length} to ${this.options.maxArrayLength} items`,
					)
					continue
				} else {
					result[key] = truncatedArray
					currentSize += truncatedSerialized.length
					if (value.length > this.options.maxArrayLength) {
						warnings.push(
							`Array '${key}' truncated from ${value.length} to ${this.options.maxArrayLength} items`,
						)
					}
					continue
				}
			}

			if (currentSize + serializedValue.length > maxAllowedSize) {
				// Add a truncated indicator and stop
				result.__truncated = true
				result.__remainingProperties = entries.length - Object.keys(result).length
				result.__truncatedSize = currentSize
				result.__maxSize = this.options.maxMetadataSize
				break
			}

			result[key] = value
			currentSize += serializedValue.length
		}

		return result
	}
}
