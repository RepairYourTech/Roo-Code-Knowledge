import { ApiHandlerOptions } from "../../../shared/api" // Adjust path if needed
import { EmbedderProvider } from "./manager"

/**
 * Configuration state for the code indexing feature
 */
export interface CodeIndexConfig {
	isConfigured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number // Generic dimension property for all providers
	openAiOptions?: ApiHandlerOptions
	ollamaOptions?: ApiHandlerOptions
	openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	geminiOptions?: { apiKey: string }
	mistralOptions?: { apiKey: string }
	vercelAiGatewayOptions?: { apiKey: string }
	openRouterOptions?: { apiKey: string }
	qdrantUrl?: string
	qdrantApiKey?: string
	searchMinScore?: number
	searchMaxResults?: number
	// Neo4j graph database configuration (optional)
	neo4jEnabled?: boolean
	neo4jUrl?: string
	neo4jUsername?: string
	neo4jPassword?: string
	neo4jDatabase?: string
	// Neo4j advanced configuration
	neo4jCircuitBreakerThreshold?: number
	neo4jMaxConnectionPoolSize?: number
	neo4jMaxRetries?: number
	neo4jQueryTimeout?: number
	neo4jConnectionAcquisitionTimeout?: number
	neo4jCircuitBreakerTimeout?: number
	// LSP configuration
	lspBatchSize?: number
	lspTimeout?: number
	lspCacheSize?: number
	lspCacheTtl?: number
	lspConcurrencyLimit?: number
	// Configuration schema version for migration
	configSchemaVersion?: string
}

/**
 * Snapshot of previous configuration used to determine if a restart is required
 */
export type PreviousConfigSnapshot = {
	enabled: boolean
	configured: boolean
	embedderProvider: EmbedderProvider
	modelId?: string
	modelDimension?: number // Generic dimension property
	openAiKey?: string
	ollamaBaseUrl?: string
	openAiCompatibleBaseUrl?: string
	openAiCompatibleApiKey?: string
	geminiApiKey?: string
	mistralApiKey?: string
	vercelAiGatewayApiKey?: string
	openRouterApiKey?: string
	qdrantUrl?: string
	qdrantApiKey?: string
	// Neo4j configuration snapshot
	neo4jEnabled?: boolean
	neo4jUrl?: string
	neo4jUsername?: string
	neo4jPassword?: string
	neo4jDatabase?: string
}

/**
 * Represents a validation error in the configuration
 */
export interface ConfigurationValidationError {
	field: string
	message: string
	severity: "error" | "warning"
	suggestion?: string
	code?: string
}

/**
 * Result of a configuration validation operation
 */
export interface ConfigurationValidationResult {
	valid: boolean
	errors: ConfigurationValidationError[]
	warnings: ConfigurationValidationError[]
	timestamp: Date
	metadata?: {
		duration: number
		version: string
		reachabilityChecked: boolean
	}
}

/**
 * Details about a configuration value that violates bounds
 */
export interface ConfigBoundsViolation {
	field: string
	value: any
	min?: number
	max?: number
	recommended?: {
		min?: number
		max?: number
	}
	action: "rejected" | "clamped" | "accepted"
	severity?: "error" | "warning"
}

/**
 * Options for configuration validation
 */
export interface ConfigValidationOptions {
	checkReachability?: boolean
	checkProduction?: boolean
	strictMode?: boolean
}
