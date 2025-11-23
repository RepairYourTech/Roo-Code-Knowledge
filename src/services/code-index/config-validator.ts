import {
	// API Key validation constants
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

	// URL validation constants
	MIN_URL_LENGTH,
	MAX_URL_LENGTH,
	ALLOWED_NEO4J_PROTOCOLS,

	// Model dimension validation
	MIN_MODEL_DIMENSION,
	MAX_MODEL_DIMENSION,

	// Search validation constants
	MIN_SEARCH_RESULTS,
	MAX_SEARCH_RESULTS_LIMIT,

	// Test secret patterns
	TEST_SECRET_PATTERNS,
	SUSPICIOUS_SECRET_PATTERNS,
	SECRET_MASK_STRING,
	SECRET_VISIBLE_CHARS,

	// Validation mode flags
	STRICT_VALIDATION_MODE,

	// Batch size validation
	MIN_BATCH_SIZE,
	MAX_BATCH_SIZE,
	PRODUCTION_MIN_BATCH_SIZE,
	PRODUCTION_MAX_BATCH_SIZE,

	// Pool size validation
	MIN_POOL_SIZE,
	MAX_POOL_SIZE,
	MIN_NEO4J_CONNECTION_POOL_SIZE,
	MAX_NEO4J_CONNECTION_POOL_SIZE,
	PRODUCTION_MIN_NEO4J_POOL_SIZE,

	// Timeout validation
	MIN_TIMEOUT_MS,
	MAX_TIMEOUT_MS,

	// Retry validation
	MIN_RETRY_ATTEMPTS,
	MAX_RETRY_ATTEMPTS,

	// Cache size validation
	MIN_CACHE_SIZE,
	MAX_CACHE_SIZE,
	MIN_LSP_CACHE_SIZE,
	MAX_LSP_CACHE_SIZE,

	// Production safety flags
	WARN_ON_DISABLED_CIRCUIT_BREAKERS,
	WARN_ON_TEST_SECRETS_IN_PRODUCTION,
	WARN_ON_EXTREME_BATCH_SIZES,
	WARN_ON_LOW_POOL_SIZES,

	// Bounds checking
	STRICT_BOUNDS_CHECKING,
	CLAMP_OUT_OF_BOUNDS_VALUES,
	VALIDATE_ON_LOAD,
	LOG_VALIDATION_FAILURES,
} from "./constants"

import {
	CodeIndexConfig,
	ConfigurationValidationError,
	ConfigurationValidationResult,
	ConfigBoundsViolation,
	ConfigValidationOptions,
} from "./interfaces/config"

/**
 * Configuration validator class for code indexing system
 *
 * This class provides comprehensive validation of configuration values, including
 * bounds checking, format validation, production safety checks, and structured
 * error reporting.
 *
 * @example
 * ```typescript
 * const config: CodeIndexConfig = { ... };
 * const result = ConfigValidator.validateConfig(config);
 *
 * if (!result.valid) {
 *   console.error('Configuration errors:', result.errors);
 * }
 * ```
 */
export class ConfigValidator {
	/**
	 * Validates a complete configuration object
	 *
	 * @param config The configuration to validate
	 * @param options Optional validation options
	 * @returns Comprehensive validation result
	 */
	static validateConfig(
		config: CodeIndexConfig,
		options: ConfigValidationOptions = {},
	): ConfigurationValidationResult {
		const startTime = Date.now()
		const errors: ConfigurationValidationError[] = []
		const warnings: ConfigurationValidationError[] = []

		// Check if config is null or undefined
		if (!config) {
			errors.push({
				field: "config",
				message: "Configuration object is required",
				severity: "error",
				suggestion: "Provide a valid configuration object",
				code: "REQUIRED_FIELD",
			})

			return {
				valid: false,
				errors,
				warnings,
				timestamp: new Date(),
				metadata: {
					duration: Date.now() - startTime,
					version: "1.0.0",
					reachabilityChecked: false,
				},
			}
		}

		// Validate required fields
		ConfigValidator.validateRequiredFields(config, errors)

		// Validate provider-specific configuration
		ConfigValidator.validateProviderConfig(config, errors, warnings, options)

		// Validate Neo4j configuration if enabled
		if (config.neo4jEnabled) {
			ConfigValidator.validateNeo4jConfig(config, errors, warnings, options)
		}

		// Validate search configuration
		ConfigValidator.validateSearchConfig(config, errors, warnings, options)

		// Validate LSP configuration
		ConfigValidator.validateLspConfig(config, errors, warnings, options)

		// Validate validation configuration
		ConfigValidator.validateValidationConfig(config, errors, warnings)

		// Perform production safety checks
		if (options.checkProduction !== false) {
			const productionWarnings = ConfigValidator.checkProductionSafety(config)
			warnings.push(...productionWarnings)
		}

		const duration = Date.now() - startTime

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			timestamp: new Date(),
			metadata: {
				duration,
				version: "1.0.0",
				reachabilityChecked: false,
			},
		}
	}

	/**
	 * Validates numeric bounds with optional recommended ranges
	 *
	 * @param value The numeric value to validate
	 * @param min Minimum allowed value
	 * @param max Maximum allowed value
	 * @param field Field name for error reporting
	 * @param recommended Optional recommended range
	 * @returns Validation result with bounds information
	 */
	static validateNumericBounds(
		value: number | undefined,
		min: number,
		max: number,
		field: string,
		recommended?: { min?: number; max?: number },
	): { valid: boolean; violation?: ConfigBoundsViolation } {
		if (value === undefined || value === null) {
			return { valid: true } // Optional field
		}

		if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
			return {
				valid: false,
				violation: ConfigValidator.createBoundsViolation(field, value, min, max, recommended, "rejected"),
			}
		}

		if (value < min || value > max) {
			const action = CLAMP_OUT_OF_BOUNDS_VALUES ? "clamped" : "rejected"
			return {
				valid: CLAMP_OUT_OF_BOUNDS_VALUES,
				violation: ConfigValidator.createBoundsViolation(field, value, min, max, recommended, action),
			}
		}

		// Check recommended bounds
		if (
			recommended &&
			((recommended.min !== undefined && value < recommended.min) ||
				(recommended.max !== undefined && value > recommended.max))
		) {
			return {
				valid: true,
				violation: ConfigValidator.createBoundsViolation(field, value, min, max, recommended, "accepted"),
			}
		}

		return { valid: true }
	}

	/**
	 * Validates string length against minimum and maximum bounds
	 *
	 * @param value The string to validate
	 * @param minLength Minimum allowed length
	 * @param maxLength Maximum allowed length
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateStringLength(
		value: string | undefined,
		minLength: number,
		maxLength: number,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError } {
		if (value === undefined || value === null) {
			return { valid: true } // Optional field
		}

		if (typeof value !== "string") {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be a string`,
					severity: "error",
					code: "INVALID_TYPE",
				},
			}
		}

		if (value.length < minLength || value.length > maxLength) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} length must be between ${minLength} and ${maxLength} characters`,
					severity: "error",
					suggestion: `Ensure ${field} is at least ${minLength} characters and at most ${maxLength} characters`,
					code: "INVALID_LENGTH",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Validates URL format and protocol
	 *
	 * @param url The URL to validate
	 * @param allowedProtocols Array of allowed protocols
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateUrl(
		url: string | undefined,
		allowedProtocols: string[],
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError } {
		if (url === undefined || url === null) {
			return { valid: true } // Optional field
		}

		const lengthValidation = ConfigValidator.validateStringLength(url, MIN_URL_LENGTH, MAX_URL_LENGTH, field)
		if (!lengthValidation.valid) {
			return lengthValidation
		}

		try {
			const parsedUrl = new URL(url)
			const protocol = parsedUrl.protocol.replace(":", "")

			if (!allowedProtocols.includes(protocol)) {
				return {
					valid: false,
					error: {
						field,
						message: `${field} protocol "${protocol}" is not allowed`,
						severity: "error",
						suggestion: `Use one of the allowed protocols: ${allowedProtocols.join(", ")}`,
						code: "INVALID_PROTOCOL",
					},
				}
			}
		} catch (error) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} is not a valid URL`,
					severity: "error",
					suggestion: `Ensure ${field} is a properly formatted URL`,
					code: "INVALID_URL",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Validates API key format and strength
	 *
	 * @param key The API key to validate
	 * @param minLength Minimum key length
	 * @param provider Provider name for error messages
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateApiKey(
		key: string | undefined,
		minLength: number,
		provider: string,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError; warning?: ConfigurationValidationError } {
		if (key === undefined || key === null) {
			return { valid: true } // Optional field
		}

		const lengthValidation = ConfigValidator.validateStringLength(key, minLength, MAX_API_KEY_LENGTH, field)
		if (!lengthValidation.valid) {
			return {
				valid: false,
				error: {
					...lengthValidation.error!,
					message: `${provider} API key ${lengthValidation.error!.message.toLowerCase()}`,
					suggestion: `Ensure ${provider} API key is at least ${minLength} characters long`,
				},
			}
		}

		// Check for test secrets
		const lowerKey = key.toLowerCase()
		const isTestSecret = TEST_SECRET_PATTERNS.some((pattern) => lowerKey.includes(pattern))

		if (isTestSecret) {
			return {
				valid: true,
				warning: {
					field,
					message: `${provider} API key appears to be a test or example key`,
					severity: "warning",
					suggestion: `Replace with a production ${provider} API key`,
					code: "TEST_SECRET_DETECTED",
				},
			}
		}

		// Check for suspicious patterns
		const isSuspicious = SUSPICIOUS_SECRET_PATTERNS.some((pattern) => pattern.test(key))
		if (isSuspicious) {
			return {
				valid: true,
				warning: {
					field,
					message: `${provider} API key follows a suspicious pattern`,
					severity: "warning",
					suggestion: `Verify that this is a valid ${provider} API key`,
					code: "SUSPICIOUS_SECRET_PATTERN",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Validates batch size with production warnings
	 *
	 * @param size The batch size to validate
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateBatchSize(
		size: number | undefined,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError; warning?: ConfigurationValidationError } {
		const boundsValidation = ConfigValidator.validateNumericBounds(size, MIN_BATCH_SIZE, MAX_BATCH_SIZE, field, {
			min: PRODUCTION_MIN_BATCH_SIZE,
			max: PRODUCTION_MAX_BATCH_SIZE,
		})

		if (!boundsValidation.valid) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`,
					severity: "error",
					suggestion: `Set ${field} to a value between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`,
					code: "OUT_OF_BOUNDS",
				},
			}
		}

		if (boundsValidation.violation) {
			const violation = boundsValidation.violation
			if (violation.action === "accepted" && WARN_ON_EXTREME_BATCH_SIZES) {
				return {
					valid: true,
					warning: {
						field,
						message: `${field} ${size} is outside recommended production range (${PRODUCTION_MIN_BATCH_SIZE}-${PRODUCTION_MAX_BATCH_SIZE})`,
						severity: "warning",
						suggestion: `Consider adjusting ${field} to between ${PRODUCTION_MIN_BATCH_SIZE} and ${PRODUCTION_MAX_BATCH_SIZE} for optimal performance`,
						code: "PRODUCTION_RECOMMENDATION",
					},
				}
			}
		}

		return { valid: true }
	}

	/**
	 * Validates connection pool size with production warnings
	 *
	 * @param size The pool size to validate
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validatePoolSize(
		size: number | undefined,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError; warning?: ConfigurationValidationError } {
		const boundsValidation = ConfigValidator.validateNumericBounds(size, MIN_POOL_SIZE, MAX_POOL_SIZE, field, {
			min: PRODUCTION_MIN_NEO4J_POOL_SIZE,
		})

		if (!boundsValidation.valid) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be between ${MIN_POOL_SIZE} and ${MAX_POOL_SIZE}`,
					severity: "error",
					suggestion: `Set ${field} to a value between ${MIN_POOL_SIZE} and ${MAX_POOL_SIZE}`,
					code: "OUT_OF_BOUNDS",
				},
			}
		}

		if (boundsValidation.violation) {
			const violation = boundsValidation.violation
			if (violation.action === "accepted" && WARN_ON_LOW_POOL_SIZES) {
				return {
					valid: true,
					warning: {
						field,
						message: `${field} ${size} is below recommended production minimum (${PRODUCTION_MIN_NEO4J_POOL_SIZE})`,
						severity: "warning",
						suggestion: `Consider increasing ${field} to at least ${PRODUCTION_MIN_NEO4J_POOL_SIZE} for production workloads`,
						code: "PRODUCTION_RECOMMENDATION",
					},
				}
			}
		}

		return { valid: true }
	}

	/**
	 * Validates timeout values
	 *
	 * @param timeout The timeout to validate
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateTimeout(
		timeout: number | undefined,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError } {
		const boundsValidation = ConfigValidator.validateNumericBounds(timeout, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, field)

		if (!boundsValidation.valid) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be between ${MIN_TIMEOUT_MS}ms and ${MAX_TIMEOUT_MS}ms`,
					severity: "error",
					suggestion: `Set ${field} to a value between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds`,
					code: "OUT_OF_BOUNDS",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Validates retry attempt counts
	 *
	 * @param attempts The retry attempts to validate
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateRetryAttempts(
		attempts: number | undefined,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError } {
		const boundsValidation = ConfigValidator.validateNumericBounds(
			attempts,
			MIN_RETRY_ATTEMPTS,
			MAX_RETRY_ATTEMPTS,
			field,
		)

		if (!boundsValidation.valid) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be between ${MIN_RETRY_ATTEMPTS} and ${MAX_RETRY_ATTEMPTS}`,
					severity: "error",
					suggestion: `Set ${field} to a value between ${MIN_RETRY_ATTEMPTS} and ${MAX_RETRY_ATTEMPTS}`,
					code: "OUT_OF_BOUNDS",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Validates cache sizes
	 *
	 * @param size The cache size to validate
	 * @param field Field name for error reporting
	 * @returns Validation result
	 */
	static validateCacheSize(
		size: number | undefined,
		field: string,
	): { valid: boolean; error?: ConfigurationValidationError } {
		const minSize = field.includes("lsp") ? MIN_LSP_CACHE_SIZE : MIN_CACHE_SIZE
		const maxSize = field.includes("lsp") ? MAX_LSP_CACHE_SIZE : MAX_CACHE_SIZE

		const boundsValidation = ConfigValidator.validateNumericBounds(size, minSize, maxSize, field)

		if (!boundsValidation.valid) {
			return {
				valid: false,
				error: {
					field,
					message: `${field} must be between ${minSize} and ${maxSize}`,
					severity: "error",
					suggestion: `Set ${field} to a value between ${minSize} and ${maxSize}`,
					code: "OUT_OF_BOUNDS",
				},
			}
		}

		return { valid: true }
	}

	/**
	 * Performs production safety checks on configuration
	 *
	 * @param config The configuration to check
	 * @returns Array of production warnings
	 */
	static checkProductionSafety(config: CodeIndexConfig): ConfigurationValidationError[] {
		const warnings: ConfigurationValidationError[] = []

		// Check for disabled circuit breakers
		if (WARN_ON_DISABLED_CIRCUIT_BREAKERS && config.neo4jEnabled) {
			const threshold = config.neo4jCircuitBreakerThreshold
			if (threshold === 0 || threshold === undefined) {
				warnings.push(
					ConfigValidator.createProductionWarning(
						"neo4jCircuitBreakerThreshold",
						"Circuit breaker is disabled",
						"Enable circuit breaker with threshold of 5-10 for production reliability",
					),
				)
			}
		}

		// Check for test secrets in production
		if (WARN_ON_TEST_SECRETS_IN_PRODUCTION) {
			const providerConfigs = [
				{ key: config.openAiOptions?.openAiNativeApiKey, name: "OpenAI" },
				{ key: config.geminiOptions?.apiKey, name: "Gemini" },
				{ key: config.openRouterOptions?.apiKey, name: "OpenRouter" },
				{ key: config.mistralOptions?.apiKey, name: "Mistral" },
				{ key: config.vercelAiGatewayOptions?.apiKey, name: "Vercel AI Gateway" },
				{ key: config.qdrantApiKey, name: "Qdrant" },
			]

			for (const { key, name } of providerConfigs) {
				if (key) {
					const lowerKey = key.toLowerCase()
					const isTestSecret = TEST_SECRET_PATTERNS.some((pattern) => lowerKey.includes(pattern))
					if (isTestSecret) {
						warnings.push(
							ConfigValidator.createProductionWarning(
								`${name.toLowerCase()}ApiKey`,
								`Test ${name} API key detected`,
								`Replace with a production ${name} API key`,
							),
						)
					}
				}
			}
		}

		// Check for extreme batch sizes
		if (WARN_ON_EXTREME_BATCH_SIZES) {
			const batchSizes = [{ size: config.lspBatchSize, field: "lspBatchSize" }]

			for (const { size, field } of batchSizes) {
				if (size && (size < PRODUCTION_MIN_BATCH_SIZE || size > PRODUCTION_MAX_BATCH_SIZE)) {
					warnings.push(
						ConfigValidator.createProductionWarning(
							field,
							`Batch size ${size} is outside recommended production range`,
							`Consider setting ${field} to between ${PRODUCTION_MIN_BATCH_SIZE} and ${PRODUCTION_MAX_BATCH_SIZE}`,
						),
					)
				}
			}
		}

		// Check for low connection pool sizes
		if (WARN_ON_LOW_POOL_SIZES && config.neo4jEnabled) {
			const poolSize = config.neo4jMaxConnectionPoolSize
			if (poolSize && poolSize < PRODUCTION_MIN_NEO4J_POOL_SIZE) {
				warnings.push(
					ConfigValidator.createProductionWarning(
						"neo4jMaxConnectionPoolSize",
						`Connection pool size ${poolSize} is below recommended production minimum`,
						`Consider increasing pool size to at least ${PRODUCTION_MIN_NEO4J_POOL_SIZE} for production workloads`,
					),
				)
			}
		}

		// Check for unsafe timeout values
		const timeouts = [
			{ timeout: config.neo4jQueryTimeout, field: "neo4jQueryTimeout" },
			{ timeout: config.lspTimeout, field: "lspTimeout" },
		]

		for (const { timeout, field } of timeouts) {
			if (timeout && timeout > 300000) {
				// 5 minutes
				warnings.push(
					ConfigValidator.createProductionWarning(
						field,
						`Timeout ${timeout}ms is very high and may cause resource exhaustion`,
						`Consider reducing ${field} to under 5 minutes for better responsiveness`,
					),
				)
			}
		}

		// Check for disabled retry logic
		if (config.neo4jEnabled) {
			const maxRetries = config.neo4jMaxRetries
			if (maxRetries === 0) {
				warnings.push(
					ConfigValidator.createProductionWarning(
						"neo4jMaxRetries",
						"Retry logic is disabled",
						"Enable retries with at least 3 attempts for production reliability",
					),
				)
			}
		}

		return warnings
	}

	/**
	 * Enforces bounds on numeric values
	 *
	 * @param value The value to enforce bounds on
	 * @param min Minimum allowed value
	 * @param max Maximum allowed value
	 * @param clamp Whether to clamp or reject out-of-bounds values
	 * @returns Enforced value
	 */
	static enforceNumericBounds(
		value: number,
		min: number,
		max: number,
		clamp: boolean = CLAMP_OUT_OF_BOUNDS_VALUES,
	): number {
		if (clamp) {
			return ConfigValidator.clampValue(value, min, max)
		}

		if (!ConfigValidator.isWithinBounds(value, min, max)) {
			throw new Error(`Value ${value} is outside bounds [${min}, ${max}]`)
		}

		return value
	}

	/**
	 * Clamps a value to within specified bounds
	 *
	 * @param value The value to clamp
	 * @param min Minimum bound
	 * @param max Maximum bound
	 * @returns Clamped value
	 */
	static clampValue(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value))
	}

	/**
	 * Checks if a value is within bounds
	 *
	 * @param value The value to check
	 * @param min Minimum bound
	 * @param max Maximum bound
	 * @returns True if value is within bounds
	 */
	static isWithinBounds(value: number, min: number, max: number): boolean {
		return value >= min && value <= max
	}

	/**
	 * Checks if a value is within recommended bounds
	 *
	 * @param value The value to check
	 * @param recommended Recommended bounds
	 * @returns True if value is within recommended bounds
	 */
	static isWithinRecommendedBounds(value: number, recommended: { min?: number; max?: number }): boolean {
		if (recommended.min !== undefined && value < recommended.min) {
			return false
		}
		if (recommended.max !== undefined && value > recommended.max) {
			return false
		}
		return true
	}

	/**
	 * Creates a bounds violation object
	 *
	 * @param field Field name
	 * @param value The violating value
	 * @param min Minimum allowed value
	 * @param max Maximum allowed value
	 * @param recommended Recommended range
	 * @param action Action taken
	 * @returns Bounds violation object
	 */
	static createBoundsViolation(
		field: string,
		value: any,
		min?: number,
		max?: number,
		recommended?: { min?: number; max?: number },
		action: "rejected" | "clamped" | "accepted" = "rejected",
	): ConfigBoundsViolation {
		const severity = action === "rejected" ? "error" : "warning"

		return {
			field,
			value,
			min,
			max,
			recommended,
			severity,
			action,
		}
	}

	/**
	 * Creates a production warning
	 *
	 * @param field Field name
	 * @param message Warning message
	 * @param suggestion Suggested fix
	 * @returns Production warning object
	 */
	static createProductionWarning(field: string, message: string, suggestion: string): ConfigurationValidationError {
		return {
			field,
			message,
			severity: "warning",
			suggestion,
			code: "PRODUCTION_SAFETY",
		}
	}

	/**
	 * Aggregates multiple validation results
	 *
	 * @param results Array of validation results
	 * @returns Aggregated validation result
	 */
	static aggregateValidationResults(results: ConfigurationValidationResult[]): ConfigurationValidationResult {
		const allErrors = results.flatMap((r) => r.errors)
		const allWarnings = results.flatMap((r) => r.warnings)
		const totalDuration = results.reduce((sum, r) => sum + (r.metadata?.duration || 0), 0)

		return {
			valid: allErrors.length === 0,
			errors: allErrors,
			warnings: allWarnings,
			timestamp: new Date(),
			metadata: {
				duration: totalDuration,
				version: "1.0.0",
				reachabilityChecked: results.some((r) => r.metadata?.reachabilityChecked),
			},
		}
	}

	// Private helper methods

	/**
	 * Validates required configuration fields
	 */
	private static validateRequiredFields(config: CodeIndexConfig, errors: ConfigurationValidationError[]): void {
		if (!config.embedderProvider) {
			errors.push({
				field: "embedderProvider",
				message: "Embedder provider is required",
				severity: "error",
				suggestion: "Select an embedding provider from the available options",
				code: "REQUIRED_FIELD",
			})
		}
	}

	/**
	 * Validates provider-specific configuration
	 */
	private static validateProviderConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		switch (config.embedderProvider) {
			case "openai":
				ConfigValidator.validateOpenAiConfig(config, errors, warnings, options)
				break
			case "ollama":
				ConfigValidator.validateOllamaConfig(config, errors, warnings, options)
				break
			case "openai-compatible":
				ConfigValidator.validateOpenAiCompatibleConfig(config, errors, warnings, options)
				break
			case "gemini":
				ConfigValidator.validateGeminiConfig(config, errors, warnings, options)
				break
			case "mistral":
				ConfigValidator.validateMistralConfig(config, errors, warnings, options)
				break
			case "vercel-ai-gateway":
				ConfigValidator.validateVercelAiGatewayConfig(config, errors, warnings, options)
				break
			case "openrouter":
				ConfigValidator.validateOpenRouterConfig(config, errors, warnings, options)
				break
		}

		// Validate model dimension
		if (config.modelDimension !== undefined) {
			const dimensionValidation = ConfigValidator.validateNumericBounds(
				config.modelDimension,
				MIN_MODEL_DIMENSION,
				MAX_MODEL_DIMENSION,
				"modelDimension",
			)

			if (!dimensionValidation.valid) {
				errors.push({
					field: "modelDimension",
					message: `Model dimension must be between ${MIN_MODEL_DIMENSION} and ${MAX_MODEL_DIMENSION}`,
					severity: "error",
					suggestion: `Set modelDimension to a value between ${MIN_MODEL_DIMENSION} and ${MAX_MODEL_DIMENSION}`,
					code: "OUT_OF_BOUNDS",
				})
			}
		}
	}

	/**
	 * Validates OpenAI configuration
	 */
	private static validateOpenAiConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.openAiOptions?.openAiNativeApiKey) {
			errors.push({
				field: "openAiOptions.openAiNativeApiKey",
				message: "OpenAI API key is required when using OpenAI provider",
				severity: "error",
				suggestion: "Configure a valid OpenAI API key in VSCode settings or secrets",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const keyValidation = ConfigValidator.validateApiKey(
			config.openAiOptions.openAiNativeApiKey,
			MIN_OPENAI_KEY_LENGTH,
			"OpenAI",
			"openAiOptions.openAiNativeApiKey",
		)

		if (!keyValidation.valid) {
			errors.push(keyValidation.error!)
		} else if (keyValidation.warning) {
			warnings.push(keyValidation.warning)
		}
	}

	/**
	 * Validates Ollama configuration
	 */
	private static validateOllamaConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!(config.ollamaOptions as any)?.baseUrl) {
			errors.push({
				field: "ollamaOptions.baseUrl",
				message: "Ollama base URL is required when using Ollama provider",
				severity: "error",
				suggestion: "Configure the Ollama server URL in settings",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const urlValidation = ConfigValidator.validateUrl(
			(config.ollamaOptions as any).baseUrl,
			["http", "https"],
			"ollamaOptions.baseUrl",
		)

		if (!urlValidation.valid) {
			errors.push(urlValidation.error!)
		}
	}

	/**
	 * Validates OpenAI Compatible configuration
	 */
	private static validateOpenAiCompatibleConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.openAiCompatibleOptions?.baseUrl) {
			errors.push({
				field: "openAiCompatibleOptions.baseUrl",
				message: "Base URL is required when using OpenAI Compatible provider",
				severity: "error",
				suggestion: "Configure the base URL for the OpenAI Compatible API",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const urlValidation = ConfigValidator.validateUrl(
			config.openAiCompatibleOptions.baseUrl,
			["http", "https"],
			"openAiCompatibleOptions.baseUrl",
		)

		if (!urlValidation.valid) {
			errors.push(urlValidation.error!)
		}

		if (config.openAiCompatibleOptions.apiKey) {
			const keyValidation = ConfigValidator.validateApiKey(
				config.openAiCompatibleOptions.apiKey,
				MIN_OPENAI_COMPATIBLE_KEY_LENGTH,
				"OpenAI Compatible",
				"openAiCompatibleOptions.apiKey",
			)

			if (!keyValidation.valid) {
				errors.push(keyValidation.error!)
			} else if (keyValidation.warning) {
				warnings.push(keyValidation.warning)
			}
		}
	}

	/**
	 * Validates Gemini configuration
	 */
	private static validateGeminiConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.geminiOptions?.apiKey) {
			errors.push({
				field: "geminiOptions.apiKey",
				message: "Gemini API key is required when using Gemini provider",
				severity: "error",
				suggestion: "Configure a valid Gemini API key in VSCode settings or secrets",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const keyValidation = ConfigValidator.validateApiKey(
			config.geminiOptions.apiKey,
			MIN_GEMINI_KEY_LENGTH,
			"Gemini",
			"geminiOptions.apiKey",
		)

		if (!keyValidation.valid) {
			errors.push(keyValidation.error!)
		} else if (keyValidation.warning) {
			warnings.push(keyValidation.warning)
		}
	}

	/**
	 * Validates Mistral configuration
	 */
	private static validateMistralConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.mistralOptions?.apiKey) {
			errors.push({
				field: "mistralOptions.apiKey",
				message: "Mistral API key is required when using Mistral provider",
				severity: "error",
				suggestion: "Configure a valid Mistral API key in VSCode settings or secrets",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const keyValidation = ConfigValidator.validateApiKey(
			config.mistralOptions.apiKey,
			MIN_MISTRAL_KEY_LENGTH,
			"Mistral",
			"mistralOptions.apiKey",
		)

		if (!keyValidation.valid) {
			errors.push(keyValidation.error!)
		} else if (keyValidation.warning) {
			warnings.push(keyValidation.warning)
		}
	}

	/**
	 * Validates Vercel AI Gateway configuration
	 */
	private static validateVercelAiGatewayConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.vercelAiGatewayOptions?.apiKey) {
			errors.push({
				field: "vercelAiGatewayOptions.apiKey",
				message: "Vercel AI Gateway API key is required when using Vercel AI Gateway provider",
				severity: "error",
				suggestion: "Configure a valid Vercel AI Gateway API key in VSCode settings or secrets",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const keyValidation = ConfigValidator.validateApiKey(
			config.vercelAiGatewayOptions.apiKey,
			MIN_VERCEL_AI_GATEWAY_KEY_LENGTH,
			"Vercel AI Gateway",
			"vercelAiGatewayOptions.apiKey",
		)

		if (!keyValidation.valid) {
			errors.push(keyValidation.error!)
		} else if (keyValidation.warning) {
			warnings.push(keyValidation.warning)
		}
	}

	/**
	 * Validates OpenRouter configuration
	 */
	private static validateOpenRouterConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		if (!config.openRouterOptions?.apiKey) {
			errors.push({
				field: "openRouterOptions.apiKey",
				message: "OpenRouter API key is required when using OpenRouter provider",
				severity: "error",
				suggestion: "Configure a valid OpenRouter API key in VSCode settings or secrets",
				code: "REQUIRED_FIELD",
			})
			return
		}

		const keyValidation = ConfigValidator.validateApiKey(
			config.openRouterOptions.apiKey,
			MIN_OPENROUTER_KEY_LENGTH,
			"OpenRouter",
			"openRouterOptions.apiKey",
		)

		if (!keyValidation.valid) {
			errors.push(keyValidation.error!)
		} else if (keyValidation.warning) {
			warnings.push(keyValidation.warning)
		}
	}

	/**
	 * Validates Neo4j configuration
	 */
	private static validateNeo4jConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		// Validate Neo4j URL
		if (config.neo4jUrl) {
			const urlValidation = ConfigValidator.validateUrl(config.neo4jUrl, ALLOWED_NEO4J_PROTOCOLS, "neo4jUrl")

			if (!urlValidation.valid) {
				errors.push(urlValidation.error!)
			}
		}

		// Validate Neo4j password
		if (config.neo4jPassword) {
			const passwordValidation = ConfigValidator.validateStringLength(
				config.neo4jPassword,
				1,
				MAX_NEO4J_PASSWORD_LENGTH,
				"neo4jPassword",
			)

			if (!passwordValidation.valid) {
				errors.push(passwordValidation.error!)
			}
		}

		// Validate connection pool size
		if (config.neo4jMaxConnectionPoolSize !== undefined) {
			const poolValidation = ConfigValidator.validatePoolSize(
				config.neo4jMaxConnectionPoolSize,
				"neo4jMaxConnectionPoolSize",
			)

			if (!poolValidation.valid) {
				errors.push(poolValidation.error!)
			} else if (poolValidation.warning) {
				warnings.push(poolValidation.warning)
			}
		}

		// Validate timeouts
		const timeouts = [
			{ timeout: config.neo4jConnectionAcquisitionTimeout, field: "neo4jConnectionAcquisitionTimeout" },
			{ timeout: config.neo4jQueryTimeout, field: "neo4jQueryTimeout" },
			{ timeout: config.neo4jCircuitBreakerTimeout, field: "neo4jCircuitBreakerTimeout" },
		]

		for (const { timeout, field } of timeouts) {
			if (timeout !== undefined) {
				const timeoutValidation = ConfigValidator.validateTimeout(timeout, field)
				if (!timeoutValidation.valid) {
					errors.push(timeoutValidation.error!)
				}
			}
		}

		// Validate retry attempts
		if (config.neo4jMaxRetries !== undefined) {
			const retryValidation = ConfigValidator.validateRetryAttempts(config.neo4jMaxRetries, "neo4jMaxRetries")

			if (!retryValidation.valid) {
				errors.push(retryValidation.error!)
			}
		}
	}

	/**
	 * Validates search configuration
	 */
	private static validateSearchConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		// Validate search min score
		if (config.searchMinScore !== undefined) {
			if (typeof config.searchMinScore !== "number" || config.searchMinScore < 0 || config.searchMinScore > 1) {
				errors.push({
					field: "searchMinScore",
					message: "Search minimum score must be a number between 0.0 and 1.0",
					severity: "error",
					suggestion: "Set searchMinScore to a value between 0.0 and 1.0",
					code: "OUT_OF_BOUNDS",
				})
			}
		}

		// Validate search max results
		if (config.searchMaxResults !== undefined) {
			const boundsValidation = ConfigValidator.validateNumericBounds(
				config.searchMaxResults,
				MIN_SEARCH_RESULTS,
				MAX_SEARCH_RESULTS_LIMIT,
				"searchMaxResults",
			)

			if (!boundsValidation.valid) {
				errors.push({
					field: "searchMaxResults",
					message: `Search max results must be between ${MIN_SEARCH_RESULTS} and ${MAX_SEARCH_RESULTS_LIMIT}`,
					severity: "error",
					suggestion: `Set searchMaxResults to a value between ${MIN_SEARCH_RESULTS} and ${MAX_SEARCH_RESULTS_LIMIT}`,
					code: "OUT_OF_BOUNDS",
				})
			}
		}
	}

	/**
	 * Validates LSP configuration
	 */
	private static validateLspConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
		options: ConfigValidationOptions,
	): void {
		// Validate LSP batch size
		if (config.lspBatchSize !== undefined) {
			const batchValidation = ConfigValidator.validateBatchSize(config.lspBatchSize, "lspBatchSize")

			if (!batchValidation.valid) {
				errors.push(batchValidation.error!)
			} else if (batchValidation.warning) {
				warnings.push(batchValidation.warning)
			}
		}

		// Validate LSP timeout
		if (config.lspTimeout !== undefined) {
			const timeoutValidation = ConfigValidator.validateTimeout(config.lspTimeout, "lspTimeout")

			if (!timeoutValidation.valid) {
				errors.push(timeoutValidation.error!)
			}
		}

		// Validate LSP cache size
		if (config.lspCacheSize !== undefined) {
			const cacheValidation = ConfigValidator.validateCacheSize(config.lspCacheSize, "lspCacheSize")

			if (!cacheValidation.valid) {
				errors.push(cacheValidation.error!)
			}
		}

		// Validate LSP cache TTL
		if (config.lspCacheTtl !== undefined) {
			const ttlValidation = ConfigValidator.validateTimeout(config.lspCacheTtl, "lspCacheTtl")

			if (!ttlValidation.valid) {
				errors.push(ttlValidation.error!)
			}
		}

		// Validate LSP concurrency limit
		if (config.lspConcurrencyLimit !== undefined) {
			const boundsValidation = ConfigValidator.validateNumericBounds(
				config.lspConcurrencyLimit,
				1,
				20,
				"lspConcurrencyLimit",
			)

			if (!boundsValidation.valid) {
				errors.push({
					field: "lspConcurrencyLimit",
					message: "LSP concurrency limit must be between 1 and 20",
					severity: "error",
					suggestion: "Set lspConcurrencyLimit to a value between 1 and 20",
					code: "OUT_OF_BOUNDS",
				})
			}
		}
	}

	/**
	 * Validates validation configuration
	 */
	private static validateValidationConfig(
		config: CodeIndexConfig,
		errors: ConfigurationValidationError[],
		warnings: ConfigurationValidationError[],
	): void {
		// No specific validation needed for validation configuration fields
		// These are primarily boolean flags that control validation behavior
	}
}
