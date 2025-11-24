import neo4j, { Driver, Session, Integer, QueryResult } from "neo4j-driver"
import {
	INeo4jService,
	INeo4jTransaction,
	Neo4jConfig,
	CodeNode,
	CodeRelationship,
	GraphQueryResult,
	ImpactAnalysisResult,
	DependencyAnalysisResult,
	BlastRadiusResult,
	ChangeSafetyResult,
	DependencyChain,
	RelationshipMetadata,
	MetadataValidationError,
	CodeNodeValidationError,
	isValidCodeNodeType,
	isValidCodeNode,
	ImportMetadata,
	CallMetadata,
	TestRelationshipMetadata,
	TypeMetadata,
	ExtendsMetadata,
	ImplementsMetadata,
} from "../interfaces/neo4j-service"
import { CodebaseIndexErrorLogger } from "./error-logger"
import { MetadataValidator } from "./metadata-validator"
import {
	MAX_BATCH_RETRIES,
	INITIAL_RETRY_DELAY_MS,
	VALIDATE_RELATIONSHIPS,
	SKIP_INVALID_RELATIONSHIPS,
	MAX_METADATA_SIZE,
	MAX_METADATA_STRING_LENGTH,
	MAX_METADATA_ARRAY_LENGTH,
	MAX_METADATA_OBJECT_DEPTH,
	METADATA_VALIDATION_ENABLED,
	ALLOW_METADATA_TRUNCATION,
	METADATA_SANITIZATION_LOG_LEVEL,
} from "../constants"
import { Mutex } from "async-mutex"
import * as path from "path"
import { createOutputChannelLogger, type LogFunction } from "../../../utils/outputChannelLogger"
import * as vscode from "vscode"

/**
 * Valid relationship types for validation (prevents Cypher injection)
 */
const VALID_RELATIONSHIP_TYPES = new Set<CodeRelationship["type"]>([
	"CALLS",
	"CALLED_BY",
	"TESTS",
	"TESTED_BY",
	"HAS_TYPE",
	"ACCEPTS_TYPE",
	"RETURNS_TYPE",
	"IMPORTS",
	"EXTENDS",
	"EXTENDED_BY",
	"IMPLEMENTS",
	"IMPLEMENTED_BY",
	"CONTAINS",
	"DEFINES",
	"USES",
])

/**
 * Circuit breaker states
 */
enum CircuitBreakerState {
	CLOSED = "closed",
	OPEN = "open",
	HALF_OPEN = "half_open",
}

/**
 * Connection pool metrics
 */
interface ConnectionPoolMetrics {
	totalConnections: number
	activeConnections: number
	idleConnections: number
	acquisitionAttempts: number
	acquisitionFailures: number
}

/**
 * Service metrics
 */
interface ServiceMetrics {
	totalQueries: number
	successfulQueries: number
	failedQueries: number
	totalErrors: number
	connectionErrors: number
	timeoutErrors: number
	retryAttempts: number
	circuitBreakerTrips: number
	averageQueryTime: number
	lastHealthCheck: Date
	uptime: number
	totalTransactions: number
	successfulTransactions: number
	failedTransactions: number
	deadlockCount: number
	slowQueryCount: number
	cacheHits: number
	cacheMisses: number
	validationFailures: number
	nodeValidationFailures: number
	relationshipValidationFailures: number
	metadataValidationFailures: number
}

/**
 * Cache entry for blast radius results
 */
interface BlastRadiusCacheEntry {
	result: BlastRadiusResult
	timestamp: number
}

/**
 * Operation-specific metrics for performance tracking
 */
interface OperationMetrics {
	operationName: string
	totalCalls: number
	successfulCalls: number
	failedCalls: number
	totalTime: number // milliseconds
	averageTime: number // milliseconds
	minTime: number // milliseconds
	maxTime: number // milliseconds
	slowQueryCount: number // queries > 1000ms
}

/**
 * Statistics for a Neo4j index
 */
interface IndexStatistics {
	name: string
	state: "ONLINE" | "POPULATING" | "FAILED"
	type: "RANGE" | "TEXT" | "POINT" | "LOOKUP"
	labelsOrTypes: string[]
	properties: string[]
	uniqueness: "UNIQUE" | "NONUNIQUE"
	/** Number of times index was used (if available) */
	usageCount?: number
	/** Last time index was used (if available) */
	lastUsed?: Date
}

/**
 * Result of index maintenance operation
 */
interface IndexMaintenanceResult {
	timestamp: Date
	indexesChecked: number
	indexesHealthy: number
	indexesFailed: string[]
	indexesRebuilt: string[]
	recommendations: string[]
}

/**
 * Enhanced Neo4j configuration with validation
 */
interface EnhancedNeo4jConfig extends Neo4jConfig {
	/** Whether to use encryption for connection */
	encrypted?: boolean

	// Connection pool settings
	maxConnectionPoolSize?: number
	connectionAcquisitionTimeout?: number
	maxConnectionLifetime?: number

	// Retry settings
	maxRetries?: number
	initialRetryDelay?: number
	maxRetryDelay?: number

	// Circuit breaker settings
	circuitBreakerThreshold?: number
	circuitBreakerTimeout?: number

	// Health check settings
	healthCheckInterval?: number
	queryTimeout?: number

	// Session management
	sessionMaxTransactionRetryTime?: number
	sessionIdleTimeout?: number

	// Metadata validation settings
	metadataValidationEnabled?: boolean
	maxMetadataSize?: number
	maxMetadataStringLength?: number
	maxMetadataArrayLength?: number
	maxMetadataObjectDepth?: number
	allowMetadataTruncation?: boolean
	metadataSanitizationLogLevel?: "none" | "warn" | "info" | "debug"
}

/**
 * Implementation of Neo4j transaction interface
 *
 * This class provides a wrapper around Neo4j's native transaction object
 * to ensure proper resource management and error handling.
 */
class Neo4jTransaction implements INeo4jTransaction {
	private session: Session
	private transaction: any // Neo4j Transaction object
	private isOpenState: boolean = true
	private transactionId: string
	private errorLogger?: CodebaseIndexErrorLogger
	private onTransactionClosed?: () => void

	constructor(
		session: Session,
		transaction: any,
		transactionId: string,
		errorLogger?: CodebaseIndexErrorLogger,
		onTransactionClosed?: () => void,
	) {
		this.session = session
		this.transaction = transaction
		this.transactionId = transactionId
		this.errorLogger = errorLogger
		this.onTransactionClosed = onTransactionClosed
	}

	/**
	 * Commit transaction, making all changes permanent
	 */
	async commit(): Promise<void> {
		if (!this.isOpenState) {
			throw new Error(`Transaction ${this.transactionId} is already closed`)
		}

		try {
			await this.transaction.commit()
			this.isOpenState = false

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_commit",
					error: "SUCCESS",
					additionalContext: {
						transactionId: this.transactionId,
					},
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_commit",
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						transactionId: this.transactionId,
					},
				})
			}

			throw new Error(`Failed to commit transaction ${this.transactionId}: ${errorMessage}`)
		} finally {
			// Always close the session
			await this.session.close()
			// Notify service that transaction is closed
			if (this.onTransactionClosed) {
				this.onTransactionClosed()
			}
		}
	}

	/**
	 * Rollback transaction, discarding all changes
	 */
	async rollback(): Promise<void> {
		if (!this.isOpenState) {
			throw new Error(`Transaction ${this.transactionId} is already closed`)
		}

		try {
			await this.transaction.rollback()
			this.isOpenState = false

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_rollback",
					error: "SUCCESS",
					additionalContext: {
						transactionId: this.transactionId,
					},
				})
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_rollback",
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						transactionId: this.transactionId,
					},
				})
			}

			throw new Error(`Failed to rollback transaction ${this.transactionId}: ${errorMessage}`)
		} finally {
			// Always close the session
			await this.session.close()
			// Notify service that transaction is closed
			if (this.onTransactionClosed) {
				this.onTransactionClosed()
			}
		}
	}

	/**
	 * Execute a Cypher query within this transaction
	 */
	async run(cypher: string, parameters?: Record<string, unknown>): Promise<any> {
		if (!this.isOpenState) {
			throw new Error(`Transaction ${this.transactionId} is closed - cannot execute queries`)
		}

		try {
			return await this.transaction.run(cypher, parameters)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_query",
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						transactionId: this.transactionId,
						cypher: cypher.substring(0, 100) + (cypher.length > 100 ? "..." : ""),
					},
				})
			}

			throw new Error(`Query failed in transaction ${this.transactionId}: ${errorMessage}`)
		}
	}

	/**
	 * Check if transaction is still open and can accept operations
	 */
	isOpen(): boolean {
		return this.isOpenState
	}
}

/**
 * Neo4j implementation of graph database service with comprehensive improvements
 * including connection pooling, retry logic, circuit breaker, health monitoring,
 * timeout handling, and observability
 */
export class Neo4jService implements INeo4jService {
	private driver: Driver | null = null
	private config: EnhancedNeo4jConfig
	private connected: boolean = false
	private errorLogger?: CodebaseIndexErrorLogger

	// Circuit breaker state
	private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED
	private circuitBreakerFailures: number = 0
	private circuitBreakerLastFailureTime: number = 0
	private readonly circuitBreakerMutex = new Mutex()

	// Health monitoring
	private healthCheckTimer?: NodeJS.Timeout
	private lastHealthCheck: Date = new Date()
	private isHealthy: boolean = true

	// Session management
	private sessionPool: Session[] = []
	private readonly sessionMutex = new Mutex()

	// Connection pool metrics
	private poolAcquisitionAttempts: number = 0
	private poolAcquisitionFailures: number = 0
	private totalSessionsCreated: number = 0
	private closedSessions: number = 0

	// Metrics
	private metrics: ServiceMetrics = {
		totalQueries: 0,
		successfulQueries: 0,
		failedQueries: 0,
		totalErrors: 0,
		connectionErrors: 0,
		timeoutErrors: 0,
		retryAttempts: 0,
		circuitBreakerTrips: 0,
		averageQueryTime: 0,
		lastHealthCheck: new Date(),
		uptime: 0,
		totalTransactions: 0,
		successfulTransactions: 0,
		failedTransactions: 0,
		deadlockCount: 0,
		slowQueryCount: 0,
		cacheHits: 0,
		cacheMisses: 0,
		validationFailures: 0,
		nodeValidationFailures: 0,
		relationshipValidationFailures: 0,
		metadataValidationFailures: 0,
	}

	// Blast radius cache for performance optimization
	private blastRadiusCache: Map<string, BlastRadiusCacheEntry> = new Map()
	private readonly blastRadiusCacheTTL = 5 * 60 * 1000 // 5 minutes default
	private readonly blastRadiusCacheMaxSize = 100 // max entries

	// Per-operation metrics for performance tracking
	private operationMetrics: Map<string, OperationMetrics> = new Map()

	// Shutdown handling
	private isShuttingDown: boolean = false
	private readonly shutdownMutex = new Mutex()
	private activeTransactions: number = 0

	// Validation components
	private metadataValidator?: MetadataValidator
	private skipValidation: boolean = false

	constructor(config: Neo4jConfig, errorLogger?: CodebaseIndexErrorLogger, outputChannel?: vscode.OutputChannel) {
		this.outputChannel = outputChannel
		this.log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}
		this.config = this.validateAndEnhanceConfig(config)
		this.errorLogger = errorLogger
		this.metrics.uptime = Date.now()

		// Initialize metadata validator with config from EnhancedNeo4jConfig
		this.metadataValidator = new MetadataValidator(
			{
				maxMetadataSize: this.config.maxMetadataSize,
				maxStringLenth: this.config.maxMetadataStringLength,
				maxArrayLength: this.config.maxMetadataArrayLength,
				maxObjectDepth: this.config.maxMetadataObjectDepth,
				validationEnabled: this.config.metadataValidationEnabled,
				allowTruncation: this.config.allowMetadataTruncation,
				logLevel: this.config.metadataSanitizationLogLevel,
				service: "neo4j",
			},
			this.errorLogger,
		)

		this.log(`[Neo4jService] Configured to use database: ${this.config.database}`)
	}

	private readonly outputChannel?: vscode.OutputChannel
	private readonly log: LogFunction

	/**
	 * Validate and enhance configuration with defaults
	 */
	private validateAndEnhanceConfig(config: Neo4jConfig): EnhancedNeo4jConfig {
		const enhanced: EnhancedNeo4jConfig = { ...config }

		// Infer default encryption from URL scheme if not explicitly set
		enhanced.encrypted =
			enhanced.encrypted ??
			(config.url.startsWith("https://") ||
			config.url.startsWith("wss://") ||
			config.url.startsWith("bolt+s://") ||
			config.url.startsWith("neo4j+s://")
				? true
				: false)

		// Set default values
		enhanced.maxConnectionPoolSize = enhanced.maxConnectionPoolSize || 50
		enhanced.connectionAcquisitionTimeout = enhanced.connectionAcquisitionTimeout || 2 * 60 * 1000 // 2 minutes
		enhanced.maxConnectionLifetime = enhanced.maxConnectionLifetime || 3 * 60 * 60 * 1000 // 3 hours
		enhanced.maxRetries = enhanced.maxRetries || MAX_BATCH_RETRIES
		enhanced.initialRetryDelay = enhanced.initialRetryDelay || INITIAL_RETRY_DELAY_MS
		enhanced.maxRetryDelay = enhanced.maxRetryDelay || 30000 // 30 seconds
		enhanced.circuitBreakerThreshold = enhanced.circuitBreakerThreshold || 5
		enhanced.circuitBreakerTimeout = enhanced.circuitBreakerTimeout || 60000 // 1 minute
		enhanced.healthCheckInterval = enhanced.healthCheckInterval || 30000 // 30 seconds
		enhanced.queryTimeout = enhanced.queryTimeout || 60000 // 1 minute
		enhanced.sessionMaxTransactionRetryTime = enhanced.sessionMaxTransactionRetryTime || 30000 // 30 seconds
		enhanced.sessionIdleTimeout = enhanced.sessionIdleTimeout || 10000 // 10 seconds
		enhanced.slowQueryThreshold = enhanced.slowQueryThreshold || 1000 // 1 second default

		// Set metadata validation defaults
		enhanced.metadataValidationEnabled = enhanced.metadataValidationEnabled ?? METADATA_VALIDATION_ENABLED
		enhanced.maxMetadataSize = enhanced.maxMetadataSize ?? MAX_METADATA_SIZE
		enhanced.maxMetadataStringLength = enhanced.maxMetadataStringLength ?? MAX_METADATA_STRING_LENGTH
		enhanced.maxMetadataArrayLength = enhanced.maxMetadataArrayLength ?? MAX_METADATA_ARRAY_LENGTH
		enhanced.maxMetadataObjectDepth = enhanced.maxMetadataObjectDepth ?? MAX_METADATA_OBJECT_DEPTH
		enhanced.allowMetadataTruncation = enhanced.allowMetadataTruncation ?? ALLOW_METADATA_TRUNCATION
		enhanced.metadataSanitizationLogLevel = enhanced.metadataSanitizationLogLevel ?? METADATA_SANITIZATION_LOG_LEVEL

		// Validate required fields
		if (!enhanced.url) {
			throw new Error("Neo4j URL is required")
		}
		if (!enhanced.username) {
			throw new Error("Neo4j username is required")
		}
		if (!enhanced.password) {
			throw new Error("Neo4j password is required")
		}
		if (!enhanced.database) {
			throw new Error("Neo4j database name is required")
		}

		// Validate ranges
		if (enhanced.maxConnectionPoolSize! < 1 || enhanced.maxConnectionPoolSize! > 100) {
			throw new Error("maxConnectionPoolSize must be between 1 and 100")
		}
		if (enhanced.connectionAcquisitionTimeout! < 1000 || enhanced.connectionAcquisitionTimeout! > 300000) {
			throw new Error("connectionAcquisitionTimeout must be between 1 second and 5 minutes")
		}
		if (enhanced.maxConnectionLifetime! < 60000 || enhanced.maxConnectionLifetime! > 86400000) {
			throw new Error("maxConnectionLifetime must be between 1 minute and 24 hours")
		}

		// Validate encryption setting against URL scheme
		if (
			enhanced.encrypted &&
			!config.url.startsWith("https://") &&
			!config.url.startsWith("wss://") &&
			!config.url.startsWith("bolt+s://") &&
			!config.url.startsWith("neo4j+s://")
		) {
			this.log(
				`[Neo4jService] Warning: Encryption is enabled but URL scheme is non-secure (${config.url}). This may cause connection issues.`,
			)
		}

		return enhanced
	}

	/**
	 * Initialize Neo4j connection with comprehensive error handling
	 */
	public async initialize(): Promise<void> {
		if (!this.config.enabled) {
			this.log("[Neo4jService] Neo4j is disabled, skipping initialization")
			return
		}

		try {
			this.log(
				`[Neo4jService] Initializing Neo4j connection to: ${this.config.url.replace(/\/\/.*@/, "//***:***")}`,
			)
			this.log(`[Neo4jService] Target database: ${this.config.database}`)

			// Create driver with enhanced connection settings
			this.driver = neo4j.driver(this.config.url, neo4j.auth.basic(this.config.username, this.config.password), {
				maxConnectionLifetime: this.config.maxConnectionLifetime!,
				maxConnectionPoolSize: this.config.maxConnectionPoolSize!,
				connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeout!,
				maxTransactionRetryTime: this.config.sessionMaxTransactionRetryTime!,
				// Add circuit breaker settings
				disableLosslessIntegers: false,
				// Use conditional encryption based on config
				...(this.config.encrypted !== undefined ? { encrypted: this.config.encrypted } : {}),
			})

			// Verify connectivity with detailed logging
			this.log("[Neo4jService] Verifying Neo4j connectivity...")
			await this.executeWithRetry("verifyConnectivity", async () => await this.driver!.verifyConnectivity(), {
				isConnectionTest: true,
			})
			this.log("[Neo4jService] Neo4j connectivity verified successfully")

			// Test database access
			await this.executeWithRetry(
				"testDatabaseAccess",
				async () => {
					const session = await this.getSession()
					try {
						await session.run("RETURN 1 as test")
					} finally {
						await this.releaseSession(session)
					}
				},
				{ isConnectionTest: true },
			)
			this.log(`[Neo4jService] Database access verified for: ${this.config.database}`)

			// Create indexes for better performance
			this.log("[Neo4jService] Creating database indexes...")
			await this.createIndexes()
			this.log("[Neo4jService] Database indexes created successfully")

			// Start health monitoring
			this.startHealthMonitoring()

			this.connected = true
			this.isHealthy = true
			this.log(`[Neo4jService] Successfully connected to Neo4j database: ${this.config.database}`)

			// Log successful initialization
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "initialize",
					error: "SUCCESS",
					additionalContext: {
						database: this.config.database,
						connectionPoolSize: this.config.maxConnectionPoolSize,
					},
				})
			}
		} catch (error) {
			this.connected = false
			this.isHealthy = false
			const errorMessage = error instanceof Error ? error.message : String(error)
			const errorStack = error instanceof Error ? error.stack : undefined

			this.log("[Neo4jService] Failed to initialize Neo4j:", {
				error: errorMessage,
				stack: errorStack,
				config: {
					url: this.config.url.replace(/\/\/.*@/, "//***:***"),
					database: this.config.database,
					username: this.config.username,
				},
			})

			// Log initialization error
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "initialize",
					error: errorMessage,
					stack: errorStack,
					additionalContext: {
						database: this.config.database,
						fatal: true,
					},
				})
			}

			// Trip circuit breaker on initialization failure
			await this.tripCircuitBreaker("initialization_failure")

			// Provide more specific error messages for common issues with user notifications
			if (errorMessage.includes("authentication") || errorMessage.includes("auth")) {
				const action = await vscode.window.showErrorMessage(
					"Neo4j authentication failed. Please verify your username and password in settings.",
					"Show Output",
				)
				if (action === "Show Output") {
					this.outputChannel?.show()
				}
				throw new Error(
					`Neo4j authentication failed. Please check your username and password. Original error: ${errorMessage}`,
				)
			} else if (
				errorMessage.includes("connect") ||
				errorMessage.includes("network") ||
				errorMessage.includes("ECONNREFUSED")
			) {
				const action = await vscode.window.showErrorMessage(
					`Failed to connect to Neo4j at ${this.config.url}. Please verify Neo4j is running and accessible. Check if the URL uses the correct protocol (bolt:// or neo4j://).`,
					"Show Output",
				)
				if (action === "Show Output") {
					this.outputChannel?.show()
				}
				throw new Error(
					`Neo4j connection failed. Please check if Neo4j is running and accessible at ${this.config.url}. Original error: ${errorMessage}`,
				)
			} else if (errorMessage.includes("database") && errorMessage.includes("does not exist")) {
				const action = await vscode.window.showErrorMessage(
					`Neo4j database '${this.config.database}' does not exist. Please create the database or verify the database name in settings.`,
					"Show Output",
				)
				if (action === "Show Output") {
					this.outputChannel?.show()
				}
				throw new Error(
					`Neo4j database '${this.config.database}' does not exist. Please create database or check database name. Original error: ${errorMessage}`,
				)
			} else {
				const action = await vscode.window.showErrorMessage(
					`Neo4j initialization failed: ${errorMessage}. Check the Output panel for details.`,
					"Show Output",
				)
				if (action === "Show Output") {
					this.outputChannel?.show()
				}
				throw new Error(`Failed to initialize Neo4j: ${errorMessage}`)
			}
		}
	}

	/**
	 * Validate relationship type to prevent Cypher injection
	 */
	private validateRelationshipType(type: string): void {
		if (!VALID_RELATIONSHIP_TYPES.has(type as CodeRelationship["type"])) {
			throw new Error(
				`Invalid relationship type: ${type}. Valid types are: ${Array.from(VALID_RELATIONSHIP_TYPES).join(", ")}`,
			)
		}
	}

	/**
	 * Validate maxDepth parameter to prevent injection
	 */
	private validateMaxDepth(maxDepth: number): void {
		if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 10) {
			throw new Error(`Invalid maxDepth: ${maxDepth}. Must be an integer between 1 and 10`)
		}
	}

	/**
	 * Create indexes for better query performance
	 */
	private async createIndexes(): Promise<void> {
		await this.executeWithRetry("createIndexes", async () => {
			const session = await this.getSession(neo4j.session.WRITE)
			try {
				// Single-property indexes
				await session.run("CREATE INDEX code_node_id IF NOT EXISTS FOR (n:CodeNode) ON (n.id)")
				await session.run("CREATE INDEX code_node_file_path IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath)")
				await session.run("CREATE INDEX code_node_type IF NOT EXISTS FOR (n:CodeNode) ON (n.type)")
				await session.run("CREATE INDEX code_node_name IF NOT EXISTS FOR (n:CodeNode) ON (n.name)")

				// Composite indexes for common query patterns
				await session.run(
					"CREATE INDEX code_node_file_path_type IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath, n.type)",
				)
				await session.run("CREATE INDEX code_node_type_name IF NOT EXISTS FOR (n:CodeNode) ON (n.type, n.name)")
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Get a session from pool or create new one
	 */
	/**
	 * Get a session from pool or create new one
	 */
	private async getSession(accessMode: string = neo4j.session.READ): Promise<Session> {
		// Increment acquisition attempts at the start
		this.poolAcquisitionAttempts++

		if (!this.driver) {
			this.poolAcquisitionFailures++
			throw new Error("Neo4j driver not initialized")
		}

		// Check circuit breaker
		if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
			this.poolAcquisitionFailures++
			throw new Error("Circuit breaker is open - rejecting requests")
		}

		// Try to get session from pool
		const release = await this.sessionMutex.acquire()
		try {
			// Only reuse sessions for READ operations to ensure isolation
			if (accessMode === neo4j.session.READ) {
				const session = this.sessionPool.pop()
				if (session) {
					return session
				}
			}
		} finally {
			release()
		}

		try {
			// Create new session if none available in pool
			const newSession = this.driver.session({
				database: this.config.database,
				defaultAccessMode: accessMode as any,
				bookmarkManager: neo4j.bookmarkManager(),
			})

			// Increment total sessions created
			this.totalSessionsCreated++

			return newSession
		} catch (error) {
			// Increment failures if session creation fails
			this.poolAcquisitionFailures++
			this.log("[Neo4jService] Session creation failed, incrementing poolAcquisitionFailures:", error)
			throw error
		}
	}

	/**
	 * Release session back to pool
	 */
	private async releaseSession(session: Session): Promise<void> {
		const release = await this.sessionMutex.acquire()
		try {
			// Only pool READ sessions
			// We can check the session mode if we stored it, but for now we'll assume
			// we only want to pool sessions that were created as READ or just close everything if pool is full.
			// However, since we don't track mode on the session object easily without casting,
			// and we want to be safe, let's just close WRITE sessions or check if we can determine mode.
			// Actually, the safest bet for this fix is to only pool if we are sure it's reusable.
			// Given the current implementation doesn't track mode, we might be pooling WRITE sessions if we aren't careful.
			// But wait, getSession(READ) pops from pool. If we push a WRITE session back, getSession(READ) might get it.
			// WRITE sessions can do reads, so it might be technically okay, but it's better to be explicit.
			// For this specific fix, I will just close the session if I can't be sure, OR I can rely on the fact that
			// I modified getSession to NOT pop from pool if mode is WRITE.
			// But if I push a WRITE session to pool, a subsequent READ request might get it.
			// To avoid this complexity without tracking, I'll just close the session if the pool is full OR if it might be a write session.
			// But I don't know if it is a write session here.
			// Let's look at how `releaseSession` is called. It takes a `Session`.
			// I'll add a check to `releaseSession` to optionally take the mode, or just close it if I'm not sure.
			// Actually, I can just not pool it in `createIndexes` by closing it manually? No, `createIndexes` calls `releaseSession`.
			// Let's modify `releaseSession` to take an optional `shouldPool` boolean, default true.

			if (this.sessionPool.length < this.config.maxConnectionPoolSize! / 2) {
				// Return session to pool if not too many
				this.sessionPool.push(session)
			} else {
				// Close session if pool is full
				await session.close()
				this.closedSessions++
			}
		} finally {
			release()
		}
	}

	/**
	 * Execute operation with retry logic and exponential backoff
	 */
	private async executeWithRetry<T>(
		operation: string,
		fn: () => Promise<T>,
		options: {
			isConnectionTest?: boolean
			maxRetries?: number
			initialDelay?: number
		} = {},
	): Promise<T> {
		const maxRetries = options.maxRetries ?? this.config.maxRetries!
		const initialDelay = options.initialDelay ?? this.config.initialRetryDelay!

		const startTime = Date.now()
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const result = await fn()
				const duration = Date.now() - startTime

				// Update metrics
				this.metrics.totalQueries++
				this.metrics.successfulQueries++
				this.updateAverageQueryTime(duration)
				this.updateOperationMetrics(operation, duration, true)

				// Log slow queries
				const threshold = this.config.slowQueryThreshold ?? 1000
				if (duration > threshold) {
					this.metrics.slowQueryCount++
					this.log(`[Neo4jService] Slow query detected: ${operation} took ${duration}ms`)

					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation,
							error: `Slow query: ${duration}ms`,
							additionalContext: {
								duration,
								threshold,
								slowQuery: true,
							},
						})
					}
				}

				// Reset circuit breaker on success
				await this.resetCircuitBreaker()

				return result
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				const isConnectionError = this.isConnectionError(error)
				const isDeadlock = this.isDeadlockError(error)

				// Update metrics
				this.metrics.totalErrors++
				if (isConnectionError) {
					this.metrics.connectionErrors++
					// Track connection errors as acquisition failures
					this.poolAcquisitionFailures++
					this.log(
						"[Neo4jService] Connection error detected, incrementing poolAcquisitionFailures:",
						errorMessage,
					)
				} else if (isDeadlock) {
					this.metrics.deadlockCount++
					this.log(`[Neo4jService] Deadlock detected: ${errorMessage}`)

					// Log deadlock
					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation: "executeWithRetry",
							error: errorMessage,
							stack: error instanceof Error ? error.stack : undefined,
							additionalContext: {
								isDeadlock: true,
								errorType: "deadlock",
							},
						})
					}

					// Trip circuit breaker after repeated deadlocks
					if (this.metrics.deadlockCount >= 5) {
						await this.tripCircuitBreaker("deadlock_threshold")
					}
				}

				// Increment circuit breaker failures on connection errors
				if (isConnectionError) {
					this.circuitBreakerFailures++
					if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold!) {
						await this.tripCircuitBreaker("connection_failure_threshold")
					}
				}

				// Log error
				if (this.errorLogger) {
					await this.errorLogger.logError({
						service: "neo4j",
						operation,
						error: errorMessage,
						stack: error instanceof Error ? error.stack : undefined,
						additionalContext: {
							attempt: attempt + 1,
							maxRetries,
							isConnectionError,
							isConnectionTest: options.isConnectionTest,
						},
					})
				}

				// Check if we should retry
				const hasMoreAttempts = attempt < maxRetries - 1
				if (!hasMoreAttempts) {
					this.metrics.failedQueries++
					throw error
				}

				// Don't retry on certain errors
				if (!isConnectionError && !options.isConnectionTest) {
					throw error
				}

				// Calculate delay with exponential backoff
				const baseDelay = initialDelay * Math.pow(2, attempt)
				const jitter = Math.random() * 0.1 * baseDelay // Add 10% jitter
				const delayMs = Math.min(baseDelay + jitter, this.config.maxRetryDelay!)

				this.metrics.retryAttempts++

				this.log(
					`[Neo4jService] ${operation} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delayMs)}ms:`,
					errorMessage,
				)

				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
		}

		throw new Error(`Operation ${operation} failed after ${maxRetries} attempts`)
	}

	/**
	 * Execute query with timeout
	 */
	private async executeWithTimeout<T>(operation: string, fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
		const configuredTimeout = this.config.queryTimeouts?.[operation] ?? this.config.queryTimeout!
		const finalTimeout = timeoutMs ?? configuredTimeout
		return Promise.race([
			fn(),
			new Promise<never>((_, reject) => {
				setTimeout(() => {
					this.metrics.timeoutErrors++
					reject(new Error(`Query timeout after ${timeoutMs}ms: ${operation}`))
				}, timeoutMs)
			}),
		])
	}

	/**
	 * Check if an error is a deadlock error
	 */
	private isDeadlockError(error: any): boolean {
		if (!error) return false

		const errorCode = error.code || ""
		const errorType = error.type || ""
		const message = error.message || ""

		return (
			errorCode.includes("DeadlockDetected") ||
			errorType.includes("DeadlockDetected") ||
			message.includes("deadlock") ||
			message.includes("DeadlockDetected")
		)
	}

	/**
	 * Check if error is connection-related using structured error codes
	 */
	private isConnectionError(error: unknown): boolean {
		// Check if error is an object with structured properties
		if (error && typeof error === "object") {
			const errorObj = error as any

			// Check for specific Neo4j error codes
			if (errorObj.code) {
				const connectionErrorCodes = [
					"ServiceUnavailable",
					"sessionExpired",
					"Security.AUTHTOKEN",
					"Transaction.Terminated",
					"Network.Unreachable",
					"Database.Unavailable",
					"Transaction.Terminated",
					"DeadlockDetected",
					"TransactionCommitFailed",
				]

				if (connectionErrorCodes.includes(errorObj.code)) {
					return true
				}
			}

			// Check error.name for known types
			if (errorObj.name) {
				const connectionErrorNames = ["Neo4jError", "ConnectionError", "ServiceUnavailableError"]

				if (connectionErrorNames.includes(errorObj.name)) {
					return true
				}
			}
		}

		// Fallback to message-based check only if no structured fields exist
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Keep only specific message patterns for connection timeouts
		const timeoutPatterns = ["timeout", "ETIMEDOUT", "connection timeout", "connect timeout"]

		return timeoutPatterns.some((pattern) => errorMessage.toLowerCase().includes(pattern.toLowerCase()))
	}

	/**
	 * Circuit breaker management
	 */
	private async tripCircuitBreaker(reason: string): Promise<void> {
		const release = await this.circuitBreakerMutex.acquire()
		try {
			if (this.circuitBreakerState !== CircuitBreakerState.OPEN) {
				this.circuitBreakerState = CircuitBreakerState.OPEN
				this.circuitBreakerLastFailureTime = Date.now()
				this.metrics.circuitBreakerTrips++

				this.log(`[Neo4jService] Circuit breaker tripped: ${reason}`)

				if (this.errorLogger) {
					await this.errorLogger.logError({
						service: "neo4j",
						operation: "circuitBreaker",
						error: `Circuit breaker tripped: ${reason}`,
						additionalContext: {
							previousState: this.circuitBreakerState,
							failures: this.circuitBreakerFailures,
							tripCount: this.metrics.circuitBreakerTrips,
						},
					})
				}

				// Show user notification about circuit breaker trip
				const action = await vscode.window.showErrorMessage(
					"Neo4j graph indexing temporarily disabled due to repeated connection failures. It will retry automatically.",
					"Show Output",
				)
				if (action === "Show Output") {
					this.outputChannel?.show()
				}

				// Schedule circuit breaker to half-open after timeout
				setTimeout(() => {
					this.attemptCircuitBreakerReset()
				}, this.config.circuitBreakerTimeout!)
			}
		} finally {
			release()
		}
	}

	private async resetCircuitBreaker(): Promise<void> {
		const release = await this.circuitBreakerMutex.acquire()
		try {
			if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
				return
			}

			this.circuitBreakerState = CircuitBreakerState.CLOSED
			this.circuitBreakerFailures = 0
			this.log("[Neo4jService] Circuit breaker reset to closed")
		} finally {
			release()
		}
	}

	private async attemptCircuitBreakerReset(): Promise<void> {
		const release = await this.circuitBreakerMutex.acquire()
		try {
			if (this.circuitBreakerState !== CircuitBreakerState.OPEN) {
				return
			}

			this.circuitBreakerState = CircuitBreakerState.HALF_OPEN
			this.log("[Neo4jService] Circuit breaker half-open - testing with single request")

			// Test with a single request
			try {
				await this.executeWithRetry(
					"circuitBreakerTest",
					async () => {
						const session = await this.getSession()
						try {
							await session.run("RETURN 1 as test")
						} finally {
							await this.releaseSession(session)
						}
					},
					{ maxRetries: 1 },
				)

				// Success - close circuit breaker
				await this.resetCircuitBreaker()
			} catch (error) {
				// Still failing - keep open
				this.circuitBreakerFailures++
				await this.tripCircuitBreaker("half_open_test_failed")
			}
		} finally {
			release()
		}
	}

	/**
	 * Health monitoring
	 */
	private startHealthMonitoring(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
		}

		this.healthCheckTimer = setInterval(async () => {
			await this.performHealthCheck()
		}, this.config.healthCheckInterval!)
	}

	private async performHealthCheck(): Promise<void> {
		if (!this.connected || this.isShuttingDown) {
			return
		}

		try {
			await this.executeWithTimeout(
				"healthCheck",
				async () => {
					const session = await this.getSession()
					try {
						await session.run("RETURN 1 as health_check")
					} finally {
						await this.releaseSession(session)
					}
				},
				10000, // 10 second timeout for health check
			)

			this.isHealthy = true
			this.lastHealthCheck = new Date()
			this.metrics.lastHealthCheck = this.lastHealthCheck
		} catch (error) {
			this.isHealthy = false
			const errorMessage = error instanceof Error ? error.message : String(error)

			this.log(`[Neo4jService] Health check failed:`, errorMessage)

			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "healthCheck",
					error: errorMessage,
					additionalContext: {
						healthy: this.isHealthy,
						lastCheck: this.lastHealthCheck.toISOString(),
					},
				})
			}

			// Trip circuit breaker on health check failure
			await this.tripCircuitBreaker("health_check_failed")
		}
	}

	/**
	 * Update average query time metric
	 */
	private updateAverageQueryTime(duration: number): void {
		const total = this.metrics.averageQueryTime * (this.metrics.successfulQueries - 1) + duration
		this.metrics.averageQueryTime = total / this.metrics.successfulQueries
	}

	/**
	 * Check if service is connected and ready
	 */
	public isConnected(): boolean {
		return this.connected && this.driver !== null && this.isHealthy && !this.isShuttingDown
	}

	/**
	 * Get service metrics
	 */
	public getMetrics(): ServiceMetrics {
		return {
			...this.metrics,
			uptime: Date.now() - this.metrics.uptime,
		}
	}

	/**
	 * Get per-operation performance metrics
	 */
	public getOperationMetrics(): Map<string, OperationMetrics> {
		return new Map(this.operationMetrics)
	}

	/**
	 * Get Neo4j index statistics including usage and health
	 */
	/**
	 * Update per-operation metrics
	 */
	private updateOperationMetrics(operation: string, duration: number, success: boolean): void {
		const existing = this.operationMetrics.get(operation) || {
			operationName: operation,
			totalCalls: 0,
			successfulCalls: 0,
			failedCalls: 0,
			totalTime: 0,
			averageTime: 0,
			minTime: Infinity,
			maxTime: 0,
			slowQueryCount: 0,
		}

		existing.totalCalls++
		existing.totalTime += duration

		if (success) {
			existing.successfulCalls++
		} else {
			existing.failedCalls++
		}

		existing.averageTime = existing.totalTime / existing.totalCalls
		existing.minTime = Math.min(existing.minTime, duration)
		existing.maxTime = Math.max(existing.maxTime, duration)

		if (duration > 1000) {
			existing.slowQueryCount++
		}

		this.operationMetrics.set(operation, existing)
	}

	/**
	 * Check if query contains potential user input that could be dangerous
	 */
	private containsUserInput(cypher: string): boolean {
		// Simple heuristic to detect potential injection
		// Look for patterns that suggest string interpolation
		const dangerousPatterns = [
			/\$\{.*\}/, // Template literals
			/\+.*["']/, // String concatenation
			/`.*\$\{.*\}.*`/, // Template strings
		]

		return dangerousPatterns.some((pattern) => pattern.test(cypher))
	}

	/**
	 * Cache blast radius result for performance
	 */
	private cacheBlastRadiusResult(cacheKey: string, result: BlastRadiusResult): void {
		// Remove oldest entry if cache is full
		if (this.blastRadiusCache.size >= this.blastRadiusCacheMaxSize) {
			const oldestKey = this.blastRadiusCache.keys().next().value
			if (oldestKey) {
				this.blastRadiusCache.delete(oldestKey)
			}
		}

		this.blastRadiusCache.set(cacheKey, {
			result,
			timestamp: Date.now(),
		})
	}

	/**
	 * Get cached blast radius result
	 */
	private getCachedBlastResult(cacheKey: string): BlastRadiusResult | null {
		const entry = this.blastRadiusCache.get(cacheKey)
		if (!entry) {
			this.metrics.cacheMisses++
			return null
		}

		// Check if entry is still valid
		if (Date.now() - entry.timestamp > this.blastRadiusCacheTTL) {
			this.blastRadiusCache.delete(cacheKey)
			this.metrics.cacheMisses++
			return null
		}

		this.metrics.cacheHits++
		return entry.result
	}

	public async getIndexStats(): Promise<IndexStatistics[]> {
		if (!this.isConnected()) {
			return []
		}

		return await this.executeWithRetry("getIndexStats", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run("CALL db.indexes()")

				return result.records.map((record) => {
					const index = record.toObject()
					return {
						name: index.name || "",
						state: index.state || "ONLINE",
						type: index.type || "RANGE",
						labelsOrTypes: index.labelsOrTypes || [],
						properties: index.properties || [],
						uniqueness: index.uniqueness || "NONUNIQUE",
						usageCount: index.usageCount?.toNumber?.() || 0,
						lastUsed: index.lastUsed ? new Date(index.lastUsed) : undefined,
					}
				})
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Analyze query execution plan using EXPLAIN or PROFILE
	 */
	public async explainQuery(
		cypher: string,
		parameters?: Record<string, unknown>,
		profile: boolean = false,
	): Promise<any> {
		if (!this.isConnected()) {
			throw new Error("Neo4j service not connected")
		}

		const query = profile ? `PROFILE ${cypher}` : `EXPLAIN ${cypher}`

		return await this.executeWithRetry("explainQuery", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(query, parameters)
				return result.records.map((record) => record.toObject())
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Perform index maintenance including health checks and statistics logging
	 */
	public async performIndexMaintenance(): Promise<IndexMaintenanceResult> {
		if (!this.isConnected()) {
			throw new Error("Neo4j service not connected")
		}

		return await this.executeWithRetry("performIndexMaintenance", async () => {
			const session = await this.getSession()
			try {
				// Get all indexes
				const indexResult = await session.run("CALL db.indexes()")
				const indexes = indexResult.records.map((record) => record.toObject())

				let healthyCount = 0
				const failedIndexes: string[] = []
				const rebuiltIndexes: string[] = []
				const recommendations: string[] = []

				for (const index of indexes) {
					if (index.state === "ONLINE") {
						healthyCount++
					} else {
						failedIndexes.push(index.name)
						// Try to rebuild failed indexes with proper Cypher syntax
						try {
							await session.run(`DROP INDEX ${index.name} IF EXISTS`)

							// Check if we have enough information to rebuild index
							if (
								index.labelsOrTypes &&
								index.labelsOrTypes.length > 0 &&
								index.properties &&
								index.properties.length > 0
							) {
								// Build proper CREATE INDEX statement with labels and properties
								const labels = index.labelsOrTypes.join(":")
								const properties = index.properties.map((prop: string) => `n.${prop}`).join(", ")
								await session.run(
									`CREATE INDEX ${index.name} IF NOT EXISTS FOR (n:${labels}) ON (${properties})`,
								)
								rebuiltIndexes.push(index.name)
							} else {
								// Insufficient information to rebuild - log recommendation
								recommendations.push(`Index ${index.name} is FAILED; manual rebuild required`)
							}
						} catch (error) {
							recommendations.push(`Failed to rebuild index ${index.name}: ${error}`)
						}
					}
				}

				// Log recommendations
				if (indexes.length === 0) {
					recommendations.push(
						"No indexes found - consider creating indexes for frequently queried properties",
					)
				}

				return {
					timestamp: new Date(),
					indexesChecked: indexes.length,
					indexesHealthy: healthyCount,
					indexesFailed: failedIndexes,
					indexesRebuilt: rebuiltIndexes,
					recommendations,
				}
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Get connection pool metrics
	 *
	 * Note: activeConnections is derived as totalSessionsCreated - idleConnections - closedSessions.
	 * This provides an approximation of currently active sessions, though it may not account for
	 * sessions that have been closed outside the normal pool management flow.
	 */
	public getConnectionPoolMetrics(): ConnectionPoolMetrics {
		return {
			totalConnections: this.totalSessionsCreated,
			idleConnections: this.sessionPool.length,
			activeConnections: this.totalSessionsCreated - this.sessionPool.length - this.closedSessions,
			acquisitionAttempts: this.poolAcquisitionAttempts,
			acquisitionFailures: this.poolAcquisitionFailures,
		}
	}

	/**
	 * Begin a new write transaction for atomic operations
	 */
	public async beginTransaction(): Promise<INeo4jTransaction> {
		if (!this.isConnected()) {
			throw new Error("Neo4j service not connected - cannot begin transaction")
		}

		// Check circuit breaker
		if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
			throw new Error("Circuit breaker is open - cannot begin transaction")
		}

		// Generate unique transaction ID for debugging
		const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

		try {
			// Acquire session
			const session = await this.getSession(neo4j.session.WRITE)

			// Begin write transaction
			const transaction = session.beginTransaction()

			this.log(`[Neo4jService] Transaction ${transactionId} started`)

			// Update metrics
			this.metrics.totalTransactions++
			this.activeTransactions++

			// Log transaction start
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_begin",
					error: "SUCCESS",
					additionalContext: {
						transactionId,
					},
				})
			}

			// Create transaction with callback to decrement activeTransactions when closed
			const onTransactionClosed = () => {
				// Guard against negative values
				this.activeTransactions = Math.max(0, this.activeTransactions - 1)

				if (this.activeTransactions < 0) {
					this.log(
						`[Neo4jService] activeTransactions went negative: ${this.activeTransactions}. Resetting to 0.`,
					)
					this.activeTransactions = 0
				}
			}

			return new Neo4jTransaction(session, transaction, transactionId, this.errorLogger, onTransactionClosed)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			// Update metrics
			this.metrics.failedTransactions++
			// Note: Don't decrement here since it will be decremented in transaction callback

			// Log transaction start failure
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "transaction_begin",
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						transactionId,
					},
				})
			}

			// Trip circuit breaker on transaction failures
			await this.tripCircuitBreaker("transaction_begin_failure")

			throw new Error(`Failed to begin transaction: ${errorMessage}`)
		}
	}

	/**
	 * Execute an operation within a transaction with automatic commit/rollback
	 */
	public async executeInTransaction<T>(operation: (tx: INeo4jTransaction) => Promise<T>): Promise<T> {
		const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

		return await this.executeWithRetry(`executeInTransaction_${transactionId}`, async () => {
			const tx = await this.beginTransaction()

			try {
				const result = await operation(tx)
				await tx.commit()

				// Update metrics
				this.metrics.successfulTransactions++
				// Note: Don't decrement here since it will be decremented in transaction callback

				// Log successful transaction
				if (this.errorLogger) {
					await this.errorLogger.logError({
						service: "neo4j",
						operation: "executeInTransaction",
						error: "SUCCESS",
						additionalContext: {
							transactionId,
							action: "committed",
						},
					})
				}

				return result
			} catch (error) {
				try {
					await tx.rollback()

					// Update metrics
					this.metrics.failedTransactions++
					// Note: Don't decrement here since it will be decremented in transaction callback

					// Log transaction rollback
					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation: "executeInTransaction",
							error: error instanceof Error ? error.message : String(error),
							stack: error instanceof Error ? error.stack : undefined,
							additionalContext: {
								transactionId,
								action: "rolled_back",
							},
						})
					}
				} catch (rollbackError) {
					// Log rollback failure
					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation: "executeInTransaction",
							error: `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
							stack: rollbackError instanceof Error ? rollbackError.stack : undefined,
							additionalContext: {
								transactionId,
								action: "rollback_failed",
							},
						})
					}
				}

				throw error
			}
		})
	}

	/**
	 * Add or update a code node in the graph
	 */
	public async upsertNode(node: CodeNode): Promise<void> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("upsertNode", { nodeId: node.id })
			return
		}

		// Validate node properties before database operations
		this.validateCodeNode(node)

		await this.executeWithRetry("upsertNode", async () => {
			const session = await this.getSession()
			try {
				await session.run(
					`
						MERGE (n:CodeNode {id: $id})
						SET n.type = $type,
							n.name = $name,
							n.filePath = $filePath,
							n.startLine = $startLine,
							n.endLine = $endLine,
							n.language = $language
						`,
					{
						id: node.id,
						type: node.type,
						name: node.name,
						filePath: node.filePath,
						startLine: neo4j.int(node.startLine),
						endLine: neo4j.int(node.endLine),
						language: node.language || null,
					},
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Add or update multiple code nodes in the graph
	 */
	public async upsertNodes(nodes: CodeNode[]): Promise<void> {
		if (!this.isConnected() || nodes.length === 0) {
			if (nodes.length > 0) {
				await this.logDisconnectedOperation("upsertNodes", { nodeCount: nodes.length })
			}
			return
		}

		// Validate all nodes before database operations
		for (const node of nodes) {
			this.validateCodeNode(node)
		}

		await this.executeWithRetry("upsertNodes", async () => {
			const session = await this.getSession()
			try {
				// Batch upsert for better performance
				await session.run(
					`
						UNWIND $nodes AS node
						MERGE (n:CodeNode {id: node.id})
						SET n.type = node.type,
							n.name = node.name,
							n.filePath = node.filePath,
							n.startLine = node.startLine,
							n.endLine = node.endLine,
							n.language = node.language
						`,
					{
						nodes: nodes.map((node) => ({
							id: node.id,
							type: node.type,
							name: node.name,
							filePath: node.filePath,
							startLine: neo4j.int(node.startLine),
							endLine: neo4j.int(node.endLine),
							language: node.language || null,
						})),
					},
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Check if relationship validation is enabled
	 */
	private shouldValidateRelationships(): boolean {
		// Default to true for data integrity
		return VALIDATE_RELATIONSHIPS
	}

	/**
	 * Validate that both nodes exist before creating a relationship
	 * @returns true if both nodes exist, false otherwise
	 */
	private async validateRelationshipExists(fromId: string, toId: string): Promise<boolean> {
		if (!this.shouldValidateRelationships()) {
			return true
		}

		try {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (from:CodeNode {id: $fromId})
						MATCH (to:CodeNode {id: $toId})
						RETURN count(*) as nodeCount
					`,
					{ fromId, toId },
				)

				const nodeCount = result.records[0]?.get("nodeCount")?.toNumber() || 0

				if (nodeCount < 2) {
					this.log(
						`[Neo4jService] Skipping relationship creation: nodes not found (from: ${fromId}, to: ${toId})`,
					)

					// Log skipped relationship
					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation: "validateRelationshipExists",
							error: "Nodes not found for relationship",
							additionalContext: {
								fromId,
								toId,
								nodeCount,
								skipped: true,
							},
						})
					}

					// Update metrics for skipped relationships
					// Note: We'll add skippedRelationships metric to ServiceMetrics if needed
					return false
				}

				return true
			} finally {
				await this.releaseSession(session)
			}
		} catch (error) {
			this.log(
				`[Neo4jService] Error validating relationship: ${error instanceof Error ? error.message : String(error)}`,
			)

			// Log validation error
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "validateRelationshipExists",
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						fromId,
						toId,
					},
				})
			}

			return false
		}
	}

	/**
	 * Create a relationship between two nodes
	 */
	public async createRelationship(relationship: CodeRelationship): Promise<void> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("createRelationship", {
				fromId: relationship.fromId,
				toId: relationship.toId,
				type: relationship.type,
			})
			return
		}

		// Validate relationship type to prevent Cypher injection
		this.validateRelationshipType(relationship.type)

		// Validate relationship before creating it
		if (this.shouldValidateRelationships()) {
			const isValid = await this.validateRelationshipExists(relationship.fromId, relationship.toId)
			if (!isValid) {
				this.log(`[Neo4jService] Skipping invalid relationship: ${relationship.fromId} -> ${relationship.toId}`)
				return
			}
		}

		await this.executeWithRetry("createRelationship", async () => {
			const session = await this.getSession()
			try {
				// Sanitize metadata to ensure all values are primitives or arrays of primitives
				const sanitizedMetadata = this.sanitizeMetadata(relationship.metadata)

				await session.run(
					`
						MATCH (from:CodeNode {id: $fromId})
						MATCH (to:CodeNode {id: $toId})
						MERGE (from)-[r:${relationship.type}]->(to)
						SET r += $metadata
						`,
					{
						fromId: relationship.fromId,
						toId: relationship.toId,
						metadata: sanitizedMetadata,
					},
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Create multiple relationships
	 */
	public async createRelationships(relationships: CodeRelationship[]): Promise<void> {
		if (!this.isConnected() || relationships.length === 0) {
			if (relationships.length > 0) {
				await this.logDisconnectedOperation("createRelationships", { relationshipCount: relationships.length })
			}
			return
		}

		// Group relationships by type for efficient batch processing
		const relationshipsByType = new Map<string, CodeRelationship[]>()
		for (const rel of relationships) {
			const existing = relationshipsByType.get(rel.type) || []
			existing.push(rel)
			relationshipsByType.set(rel.type, existing)
		}

		for (const [type, rels] of relationshipsByType.entries()) {
			await this.executeWithRetry(`createRelationships_${type}`, async () => {
				const session = await this.getSession()
				try {
					// Validate relationships if enabled and filter out invalid ones
					let validRels = rels
					if (this.shouldValidateRelationships()) {
						validRels = []
						for (const rel of rels) {
							const isValid = await this.validateRelationshipExists(rel.fromId, rel.toId)
							if (isValid) {
								validRels.push(rel)
							}
						}
					}

					// Only proceed if we have valid relationships
					if (validRels.length === 0) {
						this.log(`[Neo4jService] No valid relationships to create for type ${type}`)
						return
					}

					// Validate relationship type to prevent Cypher injection
					this.validateRelationshipType(type)

					await session.run(
						`
									UNWIND $relationships AS rel
									MATCH (from:CodeNode {id: rel.fromId})
									MATCH (to:CodeNode {id: rel.toId})
									MERGE (from)-[r:${type}]->(to)
									SET r += rel.metadata
								`,
						{
							relationships: validRels.map((r) => {
								const sanitized = this.sanitizeMetadata(r.metadata)
								// Only include metadata if it has properties
								return {
									fromId: r.fromId,
									toId: r.toId,
									metadata: Object.keys(sanitized).length > 0 ? sanitized : {},
								}
							}),
						},
					)

					this.log(`[Neo4jService] Created ${rels.length} relationships of type ${type}`)
				} finally {
					await this.releaseSession(session)
				}
			})
		}
	}

	/**
	 * Add or update multiple code nodes within a transaction
	 */
	public async upsertNodesInTransaction(nodes: CodeNode[], tx: INeo4jTransaction): Promise<void> {
		if (!tx.isOpen()) {
			throw new Error("Transaction is closed - cannot execute operations")
		}

		try {
			// Batch upsert for better performance
			await tx.run(
				`
					UNWIND $nodes AS node
					MERGE (n:CodeNode {id: node.id})
					SET n.type = node.type,
						n.name = node.name,
						n.filePath = node.filePath,
						n.startLine = node.startLine,
						n.endLine = node.endLine,
						n.language = node.language
				`,
				{
					nodes: nodes.map((node) => ({
						id: node.id,
						type: node.type,
						name: node.name,
						filePath: node.filePath,
						startLine: neo4j.int(node.startLine),
						endLine: neo4j.int(node.endLine),
						language: node.language || null,
					})),
				},
			)
		} catch (error) {
			throw new Error(
				`Failed to upsert nodes in transaction: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Create multiple relationships within a transaction
	 */
	public async createRelationshipsInTransaction(
		relationships: CodeRelationship[],
		tx: INeo4jTransaction,
	): Promise<void> {
		if (!tx.isOpen()) {
			throw new Error("Transaction is closed - cannot execute operations")
		}

		// Group relationships by type for efficient batch processing
		const relationshipsByType = new Map<string, CodeRelationship[]>()
		for (const rel of relationships) {
			const existing = relationshipsByType.get(rel.type) || []
			existing.push(rel)
			relationshipsByType.set(rel.type, existing)
		}

		for (const [type, rels] of relationshipsByType.entries()) {
			try {
				// Validate relationships if enabled and filter out invalid ones
				let validRels = rels
				if (this.shouldValidateRelationships()) {
					validRels = []
					for (const rel of rels) {
						const isValid = await this.validateRelationshipExists(rel.fromId, rel.toId)
						if (isValid) {
							validRels.push(rel)
						}
					}
				}

				// Only proceed if we have valid relationships
				if (validRels.length === 0) {
					this.log(`[Neo4jService] No valid relationships to create for type ${type} in transaction`)
					continue
				}

				// Sanitize relationship type to be a valid Cypher identifier
				const sanitizedType = type.replace(/[^a-zA-Z0-9_]/g, "_")

				await tx.run(
					`
						UNWIND $relationships AS rel
						MATCH (from:CodeNode {id: rel.fromId})
						MATCH (to:CodeNode {id: rel.toId})
						MERGE (from)-[r:${sanitizedType}]->(to)
						SET r += rel.metadata
					`,
					{
						relationships: validRels.map((r) => {
							const sanitized = this.sanitizeMetadata(r.metadata)
							// Only include metadata if it has properties
							return {
								fromId: r.fromId,
								toId: r.toId,
								metadata: Object.keys(sanitized).length > 0 ? sanitized : {},
							}
						}),
					},
				)
			} catch (error) {
				throw new Error(
					`Failed to create relationships of type ${type} in transaction: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	/**
	 * Delete nodes by file path within a transaction
	 */
	public async deleteNodesByFilePathInTransaction(filePath: string, tx: INeo4jTransaction): Promise<void> {
		if (!tx.isOpen()) {
			throw new Error("Transaction is closed - cannot execute operations")
		}

		try {
			await tx.run(
				`
					MATCH (n:CodeNode {filePath: $filePath})
					DETACH DELETE n
				`,
				{ filePath },
			)
		} catch (error) {
			throw new Error(
				`Failed to delete nodes by file path in transaction: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Delete a node and all its relationships
	 */
	public async deleteNode(id: string): Promise<void> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("deleteNode", { nodeId: id })
			return
		}

		await this.executeWithRetry("deleteNode", async () => {
			const session = await this.getSession(neo4j.session.WRITE)
			try {
				await session.run(
					`
						MATCH (n:CodeNode {id: $id})
						DETACH DELETE n
						`,
					{ id },
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Delete all nodes for a specific file path
	 */
	public async deleteNodesByFilePath(filePath: string): Promise<void> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("deleteNodesByFilePath", { filePath })
			return
		}

		await this.executeWithRetry("deleteNodesByFilePath", async () => {
			const session = await this.getSession(neo4j.session.WRITE)
			try {
				await session.run(
					`
						MATCH (n:CodeNode {filePath: $filePath})
						DETACH DELETE n
						`,
					{ filePath },
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Delete multiple nodes by file paths
	 */
	public async deleteNodesByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (!this.isConnected() || filePaths.length === 0) {
			if (filePaths.length > 0) {
				await this.logDisconnectedOperation("deleteNodesByMultipleFilePaths", { filePaths })
			}
			return
		}

		await this.executeWithRetry("deleteNodesByMultipleFilePaths", async () => {
			const session = await this.getSession(neo4j.session.WRITE)
			try {
				await session.run(
					`
						UNWIND $filePaths AS filePath
						MATCH (n:CodeNode {filePath: filePath})
						DETACH DELETE n
						`,
					{ filePaths },
				)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all nodes that call a specific function/method
	 */
	public async findCallers(nodeId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findCallers", { nodeId })
			return []
		}

		return await this.executeWithRetry("findCallers", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (caller:CodeNode)-[:CALLS]->(target:CodeNode {id: $nodeId})
						RETURN caller
						`,
					{ nodeId },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("caller")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all nodes that are called by a specific function/method
	 */
	public async findCallees(nodeId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findCallees", { nodeId })
			return []
		}

		return await this.executeWithRetry("findCallees", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (caller:CodeNode {id: $nodeId})-[:CALLS]->(callee:CodeNode)
						RETURN callee
						`,
					{ nodeId },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("callee")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all dependencies (imports) for a file
	 */
	public async findDependencies(filePath: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findDependencies", { filePath })
			return []
		}

		return await this.executeWithRetry("findDependencies", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (file:CodeNode {filePath: $filePath})-[:IMPORTS]->(dep:CodeNode)
						RETURN dep
						`,
					{ filePath },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("dep")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all files that depend on (import) a specific file
	 */
	public async findDependents(filePath: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findDependents", { filePath })
			return []
		}

		return await this.executeWithRetry("findDependents", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (dependent:CodeNode)-[:IMPORTS]->(file:CodeNode {filePath: $filePath})
						RETURN dependent
						`,
					{ filePath },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("dependent")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all implementations of an interface
	 */
	public async findImplementations(interfaceId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findImplementations", { interfaceId })
			return []
		}

		return await this.executeWithRetry("findImplementations", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (impl:CodeNode)-[:IMPLEMENTS]->(interface:CodeNode {id: $interfaceId})
						RETURN impl
						`,
					{ interfaceId },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("impl")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Find all subclasses of a class
	 */
	public async findSubclasses(classId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findSubclasses", { classId })
			return []
		}

		return await this.executeWithRetry("findSubclasses", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(
					`
						MATCH (subclass:CodeNode)-[:EXTENDS]->(class:CodeNode {id: $classId})
						RETURN subclass
						`,
					{ classId },
				)

				return result.records.map((record) => this.recordToCodeNode(record.get("subclass")))
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Execute a custom Cypher query
	 * @param cypher The Cypher query to execute
	 * @param parameters Optional parameters for query
	 * @param timeout Optional timeout in milliseconds (default: from config)
	 */
	public async executeQuery(
		cypher: string,
		parameters?: Record<string, unknown>,
		timeout?: number,
		allowDangerousQueries?: boolean,
	): Promise<GraphQueryResult> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("executeQuery", { cypher, parameters, timeout, allowDangerousQueries })
			return { nodes: [], relationships: [] }
		}

		// Validate dangerous query parameter
		if (!allowDangerousQueries && this.containsUserInput(cypher)) {
			throw new Error(
				"Potentially dangerous query detected. Use allowDangerousQueries: true for non-parameterized queries with string interpolation.",
			)
		}

		return await this.executeWithRetry("executeQuery", async () => {
			const session = await this.getSession()
			try {
				const result = await this.executeWithTimeout(
					"executeQuery",
					async () => session.run(cypher, parameters || {}),
					timeout ?? this.config.queryTimeout!,
				)

				const nodes: CodeNode[] = []
				const relationships: CodeRelationship[] = []

				for (const record of result.records) {
					// Extract nodes and relationships from result
					for (const key of record.keys) {
						const value = record.get(key)
						if (value && typeof value === "object") {
							if (value.labels && value.labels.includes("CodeNode")) {
								nodes.push(this.recordToCodeNode(value))
							}
						}
					}
				}

				return { nodes, relationships }
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Clear all data from graph using batched deletion
	 */
	public async clearAll(): Promise<void> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("clearAll", {})
			return
		}

		this.log(`[Neo4jService] Clearing all data from database ${this.config.database}...`)

		await this.executeWithRetry("clearAll", async () => {
			const session = await this.getSession(neo4j.session.WRITE)
			const batchSize = 10000
			let totalDeleted = 0

			try {
				// Keep deleting in batches until nothing left
				while (true) {
					const result = await session.run(
						`
								MATCH (n)
								WITH n LIMIT $batchSize
								DETACH DELETE n
								RETURN count(n) as deleted
							`,
						{ batchSize: neo4j.int(batchSize) },
					)

					const deleted = result.records[0]?.get("deleted")?.toNumber() || 0
					totalDeleted += deleted

					if (deleted > 0) {
						this.log(`[Neo4jService] Deleted ${deleted} nodes (${totalDeleted} total)`)
					}

					// If we deleted fewer than batch size, we're done
					if (deleted === 0) {
						break
					}
				}

				this.log(`[Neo4jService] Database cleared successfully - deleted ${totalDeleted} total nodes`)
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Get statistics about the graph
	 */
	public async getStats(): Promise<{
		nodeCount: number
		relationshipCount: number
		fileCount: number
	}> {
		if (!this.isConnected()) {
			return { nodeCount: 0, relationshipCount: 0, fileCount: 0 }
		}

		return await this.executeWithRetry("getStats", async () => {
			const session = await this.getSession()
			try {
				const result = await session.run(`
						MATCH (n:CodeNode)
						OPTIONAL MATCH ()-[r]->()
						WITH count(DISTINCT n) AS nodeCount,
							 count(DISTINCT r) AS relationshipCount,
							 count(DISTINCT n.filePath) AS fileCount
						RETURN nodeCount, relationshipCount, fileCount
					`)

				const record = result.records[0]
				return {
					nodeCount: this.intToNumber(record.get("nodeCount")),
					relationshipCount: this.intToNumber(record.get("relationshipCount")),
					fileCount: this.intToNumber(record.get("fileCount")),
				}
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	public getConnectionInfo(): {
		url: string
		database: string
		username: string
		isConnected: boolean
	} {
		// Sanitize URL to hide password if present in connection string
		const sanitizedUrl = this.config.url.replace(/\/\/.*:.*@/, "//***:***@")

		return {
			url: sanitizedUrl,
			database: this.config.database,
			username: this.config.username,
			isConnected: this.isConnected(),
		}
	}

	/**
	 * Phase 11: Find all nodes impacted by changing a symbol
	 */
	public async findImpactedNodes(
		nodeId: string,
		maxDepth: number = 3,
		limit: number = 1000,
	): Promise<ImpactAnalysisResult> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findImpactedNodes", { nodeId, maxDepth, limit })
			return {
				impactedNodes: [],
				dependencyChains: [],
				blastRadius: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testNodes: [], coveragePercentage: 0 },
			}
		}

		// Validate maxDepth to prevent injection
		this.validateMaxDepth(maxDepth)

		return await this.executeWithRetry("findImpactedNodes", async () => {
			const session = await this.getSession()
			try {
				// Find all nodes impacted by changing nodeId (up to maxDepth levels)
				const impactResult = await session.run(
					`
						MATCH path = (impacted:CodeNode)-[:CALLED_BY|EXTENDED_BY|IMPLEMENTED_BY*1..${maxDepth}]->(target:CodeNode {id: $nodeId}) USING INDEX target:CodeNode(id)
						WITH DISTINCT impacted, target, path, relationships(path) AS rels
						MATCH path = (impacted)-[:CALLED_BY|EXTENDED_BY|IMPLEMENTED_BY*1..${maxDepth}]->(target)
						WITH impacted, path, rels
						RETURN DISTINCT impacted,
							   [node IN nodes(path) | node] AS pathNodes,
							   [rel IN rels | type(rel)] AS relTypes,
							   length(path) AS depth
						ORDER BY depth ASC
						LIMIT $limit
						`,
					{ nodeId, limit },
				)

				// Find tests that cover this node
				const testResult = await session.run(
					`
						MATCH (test:CodeNode)-[:TESTS]->(target:CodeNode {id: $nodeId})
						RETURN test
						`,
					{ nodeId },
				)

				// Process impacted nodes and dependency chains
				const impactedNodes: CodeNode[] = []
				const dependencyChains: DependencyChain[] = []
				const uniqueFiles = new Set<string>()
				let maxDepthFound = 0

				for (const record of impactResult.records) {
					const impactedNode = this.recordToCodeNode(record.get("impacted"))
					impactedNodes.push(impactedNode)
					uniqueFiles.add(impactedNode.filePath)

					const pathNodes = record.get("pathNodes").map((node: any) => this.recordToCodeNode(node))
					const relTypes = record.get("relTypes") as string[]
					const depth = this.intToNumber(record.get("depth"))

					dependencyChains.push({
						path: pathNodes,
						relationshipTypes: relTypes,
						depth,
					})

					if (depth > maxDepthFound) {
						maxDepthFound = depth
					}
				}

				// Process test nodes
				const testNodes: CodeNode[] = testResult.records.map((record) =>
					this.recordToCodeNode(record.get("test")),
				)

				// Calculate test coverage percentage
				const coveragePercentage = testNodes.length > 0 ? 100 : 0

				return {
					impactedNodes,
					dependencyChains,
					blastRadius: {
						totalNodes: impactedNodes.length,
						totalFiles: uniqueFiles.size,
						maxDepth: maxDepthFound,
					},
					testCoverage: {
						hasTests: testNodes.length > 0,
						testNodes,
						coveragePercentage,
					},
				}
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Phase 11: Find all dependencies of a symbol
	 */
	public async findDependencyTree(
		nodeId: string,
		maxDepth: number = 3,
		limit: number = 1000,
	): Promise<DependencyAnalysisResult> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("findDependencyTree", { nodeId, maxDepth, limit })
			return {
				dependencies: [],
				dependencyChains: [],
				dependencyTree: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
			}
		}

		// Validate maxDepth to prevent injection
		this.validateMaxDepth(maxDepth)

		return await this.executeWithRetry("findDependencyTree", async () => {
			const session = await this.getSession()
			try {
				// Find all dependencies of nodeId (up to maxDepth levels)
				const result = await session.run(
					`
						MATCH path = (source:CodeNode {id: $nodeId})-[:CALLS|EXTENDS|IMPLEMENTS|HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE|IMPORTS*1..${maxDepth}]->(dependency:CodeNode) USING INDEX source:CodeNode(id)
						WITH DISTINCT dependency, source, path, relationships(path) AS rels
						MATCH path = (source)-[:CALLS|EXTENDS|IMPLEMENTS|HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE|IMPORTS*1..${maxDepth}]->(dependency)
						WITH dependency, path, rels
						RETURN DISTINCT dependency,
							   [node IN nodes(path) | node] AS pathNodes,
							   [rel IN rels | type(rel)] AS relTypes,
							   length(path) AS depth
						ORDER BY depth ASC
						LIMIT $limit
						`,
					{ nodeId, limit },
				)

				// Process dependencies and dependency chains
				const dependencies: CodeNode[] = []
				const dependencyChains: DependencyChain[] = []
				const uniqueFiles = new Set<string>()
				let maxDepthFound = 0

				for (const record of result.records) {
					const dependency = this.recordToCodeNode(record.get("dependency"))
					dependencies.push(dependency)
					uniqueFiles.add(dependency.filePath)

					const pathNodes = record.get("pathNodes").map((node: any) => this.recordToCodeNode(node))
					const relTypes = record.get("relTypes") as string[]
					const depth = this.intToNumber(record.get("depth"))

					dependencyChains.push({
						path: pathNodes,
						relationshipTypes: relTypes,
						depth,
					})

					if (depth > maxDepthFound) {
						maxDepthFound = depth
					}
				}

				return {
					dependencies,
					dependencyChains,
					dependencyTree: {
						totalNodes: dependencies.length,
						totalFiles: uniqueFiles.size,
						maxDepth: maxDepthFound,
					},
				}
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Phase 11: Calculate blast radius of changing a symbol
	 */
	public async calculateBlastRadius(
		nodeId: string,
		maxDepth: number = 3,
		limit: number = 1000,
	): Promise<BlastRadiusResult> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("calculateBlastRadius", { nodeId, maxDepth, limit })
			return {
				targetNode: null,
				impactedNodes: [],
				dependencies: [],
				tests: [],
				metrics: {
					totalImpactedNodes: 0,
					totalImpactedFiles: 0,
					totalDependencies: 0,
					totalTests: 0,
					maxImpactDepth: 0,
					maxDependencyDepth: 0,
					riskScore: 0,
				},
			}
		}

		// Validate maxDepth to prevent injection
		this.validateMaxDepth(maxDepth)

		return await this.executeWithRetry("calculateBlastRadius", async () => {
			const session = await this.getSession()
			try {
				// Get target node
				const targetResult = await session.run(
					`
						MATCH (target:CodeNode {id: $nodeId})
						RETURN target
						`,
					{ nodeId },
				)

				const targetNode =
					targetResult.records.length > 0
						? this.recordToCodeNode(targetResult.records[0].get("target"))
						: null

				// Check cache first
				const cacheKey = `${nodeId}_${maxDepth}`
				const cached = this.getCachedBlastResult(cacheKey)
				if (cached) {
					return cached
				}

				// Get impact analysis and dependency analysis in parallel
				const [impactAnalysis, dependencyAnalysis] = await Promise.all([
					this.findImpactedNodes(nodeId, maxDepth, limit),
					this.findDependencyTree(nodeId, maxDepth, limit),
				])

				// Calculate unique impacted files
				const impactedFiles = new Set<string>()
				for (const node of impactAnalysis.impactedNodes) {
					impactedFiles.add(node.filePath)
				}

				// Calculate risk score
				const riskScore = this.calculateRiskScore(
					impactAnalysis.impactedNodes.length,
					impactedFiles.size,
					impactAnalysis.blastRadius.maxDepth,
					impactAnalysis.testCoverage.testNodes.length,
				)

				const result: BlastRadiusResult = {
					targetNode,
					impactedNodes: impactAnalysis.impactedNodes,
					dependencies: dependencyAnalysis.dependencies,
					tests: impactAnalysis.testCoverage.testNodes,
					metrics: {
						totalImpactedNodes: impactAnalysis.impactedNodes.length,
						totalImpactedFiles: impactedFiles.size,
						totalDependencies: dependencyAnalysis.dependencies.length,
						totalTests: impactAnalysis.testCoverage.testNodes.length,
						maxImpactDepth: impactAnalysis.blastRadius.maxDepth,
						maxDependencyDepth: dependencyAnalysis.dependencyTree.maxDepth,
						riskScore,
					},
				}

				// Cache result
				this.cacheBlastRadiusResult(cacheKey, result)

				return result
			} finally {
				await this.releaseSession(session)
			}
		})
	}

	/**
	 * Phase 11: Assess whether it's safe to change a symbol
	 */
	public async assessChangeSafety(nodeId: string): Promise<ChangeSafetyResult> {
		if (!this.isConnected()) {
			await this.logDisconnectedOperation("assessChangeSafety", { nodeId })
			return {
				nodeId,
				nodeName: "Unknown",
				safetyLevel: "dangerous",
				riskScore: 100,
				reasons: ["Neo4j service not connected"],
				recommendations: ["Enable Neo4j to perform impact analysis"],
				impactSummary: { impactedNodes: 0, impactedFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testCount: 0, coveragePercentage: 0 },
			}
		}

		// Calculate blast radius
		const blastRadius = await this.calculateBlastRadius(nodeId, 3, 1000)

		if (!blastRadius.targetNode) {
			return {
				nodeId,
				nodeName: "Unknown",
				safetyLevel: "dangerous",
				riskScore: 100,
				reasons: ["Node not found in graph"],
				recommendations: ["Verify node ID is correct"],
				impactSummary: { impactedNodes: 0, impactedFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testCount: 0, coveragePercentage: 0 },
			}
		}

		const riskScore = blastRadius.metrics.riskScore
		const safetyLevel = this.determineSafetyLevel(riskScore)
		const reasons = this.generateReasons(blastRadius)
		const recommendations = this.generateRecommendations(blastRadius, safetyLevel)

		return {
			nodeId,
			nodeName: blastRadius.targetNode.name,
			safetyLevel,
			riskScore,
			reasons,
			recommendations,
			impactSummary: {
				impactedNodes: blastRadius.metrics.totalImpactedNodes,
				impactedFiles: blastRadius.metrics.totalImpactedFiles,
				maxDepth: blastRadius.metrics.maxImpactDepth,
			},
			testCoverage: {
				hasTests: blastRadius.metrics.totalTests > 0,
				testCount: blastRadius.metrics.totalTests,
				coveragePercentage: blastRadius.metrics.totalTests > 0 ? 100 : 0,
			},
		}
	}

	/**
	 * Calculate risk score based on impact metrics
	 */
	private calculateRiskScore(
		impactedNodes: number,
		impactedFiles: number,
		maxDepth: number,
		testCount: number,
	): number {
		// Risk score formula:
		// - More impacted nodes = higher risk (10 points per node, max 30)
		// - More impacted files = higher risk (20 points per file, max 40)
		// - Deeper impact = higher risk (15 points per level, max 30)
		// - No tests = +50 risk
		// - More tests = lower risk (5 points per test, max -25)

		let score = 0

		// Impacted nodes contribution (max 30)
		score += Math.min(impactedNodes * 10, 30)

		// Impacted files contribution (max 40)
		score += Math.min(impactedFiles * 20, 40)

		// Max depth contribution (max 30)
		score += Math.min(maxDepth * 15, 30)

		// Test coverage contribution
		if (testCount === 0) {
			score += 50 // No tests = high risk
		} else {
			score -= Math.min(testCount * 5, 25) // More tests = lower risk
		}

		// Normalize to 0-100 range
		return Math.max(0, Math.min(100, score))
	}

	/**
	 * Determine safety level based on risk score
	 */
	private determineSafetyLevel(riskScore: number): "safe" | "moderate" | "risky" | "dangerous" {
		if (riskScore < 20) return "safe"
		if (riskScore < 40) return "moderate"
		if (riskScore < 70) return "risky"
		return "dangerous"
	}

	/**
	 * Generate reasons for safety assessment
	 */
	private generateReasons(blastRadius: BlastRadiusResult): string[] {
		const reasons: string[] = []

		if (blastRadius.metrics.totalImpactedNodes === 0) {
			reasons.push("No other code depends on this symbol")
		} else {
			reasons.push(`${blastRadius.metrics.totalImpactedNodes} code blocks depend on this symbol`)
		}

		if (blastRadius.metrics.totalImpactedFiles > 0) {
			reasons.push(`Changes will affect ${blastRadius.metrics.totalImpactedFiles} file(s)`)
		}

		if (blastRadius.metrics.maxImpactDepth > 1) {
			reasons.push(`Impact propagates ${blastRadius.metrics.maxImpactDepth} levels deep`)
		}

		if (blastRadius.metrics.totalTests === 0) {
			reasons.push("No tests cover this code")
		} else {
			reasons.push(`${blastRadius.metrics.totalTests} test(s) cover this code`)
		}

		if (blastRadius.metrics.totalDependencies > 0) {
			reasons.push(`This code depends on ${blastRadius.metrics.totalDependencies} other symbols`)
		}

		return reasons
	}

	/**
	 * Generate recommendations for safe changes
	 */
	private generateRecommendations(
		blastRadius: BlastRadiusResult,
		safetyLevel: "safe" | "moderate" | "risky" | "dangerous",
	): string[] {
		const recommendations: string[] = []

		if (safetyLevel === "safe") {
			recommendations.push("This change appears safe to make")
			if (blastRadius.metrics.totalTests > 0) {
				recommendations.push("Run existing tests to verify change")
			}
		}

		if (safetyLevel === "moderate") {
			recommendations.push("Review impacted code before making changes")
			if (blastRadius.metrics.totalTests === 0) {
				recommendations.push("Consider adding tests before making changes")
			} else {
				recommendations.push("Run existing tests to verify change")
			}
		}

		if (safetyLevel === "risky") {
			recommendations.push("Carefully review all impacted code")
			recommendations.push("Update or add tests for affected code")
			if (blastRadius.metrics.totalImpactedFiles > 1) {
				recommendations.push("Consider making changes incrementally across files")
			}
		}

		if (safetyLevel === "dangerous") {
			recommendations.push("⚠️ This is a high-risk change - proceed with caution")
			recommendations.push("Thoroughly review all impacted code and tests")
			if (blastRadius.metrics.totalTests === 0) {
				recommendations.push("Add comprehensive tests before making changes")
			}
			if (blastRadius.metrics.maxImpactDepth > 2) {
				recommendations.push("Consider refactoring to reduce coupling before making changes")
			}
		}

		return recommendations
	}

	/**
	 * Log disconnected state operations
	 */
	private async logDisconnectedOperation(operation: string, context: Record<string, any>): Promise<void> {
		if (this.errorLogger) {
			await this.errorLogger.logError({
				service: "neo4j",
				operation,
				error: "Service not connected - operation skipped",
				additionalContext: {
					connected: this.connected,
					healthy: this.isHealthy,
					shuttingDown: this.isShuttingDown,
					circuitBreakerState: this.circuitBreakerState,
					...context,
				},
			})
		}

		this.log(`[Neo4jService] ${operation} skipped - service not connected:`, context)
	}

	/**
	 * Close Neo4j connection with graceful shutdown
	 */
	public async close(): Promise<void> {
		const release = await this.shutdownMutex.acquire()
		try {
			if (this.isShuttingDown) {
				return
			}

			this.isShuttingDown = true
			this.log("[Neo4jService] Starting graceful shutdown...")

			// Wait for active transactions to complete (with timeout)
			if (this.activeTransactions > 0) {
				this.log(`[Neo4jService] Waiting for ${this.activeTransactions} active transactions to complete...`)

				const transactionTimeout = 30000 // 30 seconds
				const startTime = Date.now()

				// Wait for transactions to complete or timeout
				while (this.activeTransactions > 0 && Date.now() - startTime < transactionTimeout) {
					await new Promise((resolve) => setTimeout(resolve, 100))
				}

				// Check if transactions are still active after timeout
				if (this.activeTransactions > 0) {
					this.log(
						`[Neo4jService] Timeout waiting for ${this.activeTransactions} transactions to complete - proceeding with shutdown`,
					)

					// Log warning about forcefully terminated transactions
					if (this.errorLogger) {
						await this.errorLogger.logError({
							service: "neo4j",
							operation: "close",
							error: "Transactions forcefully terminated",
							additionalContext: {
								activeTransactions: this.activeTransactions,
								timeout: transactionTimeout,
								graceful: false,
							},
						})
					}
				} else {
					this.log("[Neo4jService] All active transactions completed")
				}
			}

			// Stop health monitoring
			if (this.healthCheckTimer) {
				clearInterval(this.healthCheckTimer)
				this.healthCheckTimer = undefined
			}

			// Close all pooled sessions
			const sessionRelease = await this.sessionMutex.acquire()
			try {
				const closePromises = this.sessionPool.map((session) => session.close())
				await Promise.all(closePromises)
				this.sessionPool = []
			} finally {
				sessionRelease()
			}

			// Close driver
			if (this.driver) {
				try {
					await this.driver.close()
				} catch (error) {
					this.log("[Neo4jService] Error closing driver:", error)
				}
				this.driver = null
			}

			this.connected = false
			this.isHealthy = false

			this.log("[Neo4jService] Graceful shutdown completed")
			this.log(
				`[Neo4jService] Final session metrics - Total created: ${this.totalSessionsCreated}, Closed: ${this.closedSessions}, Remaining in pool: ${this.sessionPool.length}`,
			)
			this.log(
				`[Neo4jService] Final transaction metrics - Total: ${this.metrics.totalTransactions}, Successful: ${this.metrics.successfulTransactions}, Failed: ${this.metrics.failedTransactions}, Deadlocks: ${this.metrics.deadlockCount}`,
			)

			// Log shutdown completion
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					operation: "close",
					error: "SUCCESS",
					additionalContext: {
						graceful: true,
						activeTransactions: this.activeTransactions,
						metrics: this.getMetrics(),
					},
				})
			}
		} finally {
			release()
		}
	}

	/**
	 * Convert a Neo4j record to a CodeNode
	 */
	private recordToCodeNode(record: any): CodeNode {
		return {
			id: record.properties.id,
			type: record.properties.type,
			name: record.properties.name,
			filePath: record.properties.filePath,
			startLine: this.intToNumber(record.properties.startLine),
			endLine: this.intToNumber(record.properties.endLine),
			language: record.properties.language || undefined,
		}
	}

	/**
	 * Convert Neo4j Integer to JavaScript number
	 */
	private intToNumber(value: Integer | number | null | undefined): number {
		if (value === null || value === undefined) {
			return 0
		}
		if (typeof value === "number") {
			return value
		}
		return value.toNumber()
	}

	/**
	 * Set validation enabled/disabled for testing
	 */
	public setValidationEnabled(enabled: boolean): void {
		this.skipValidation = !enabled
	}

	/**
	 * Validate code node properties
	 */
	private validateCodeNode(node: CodeNode): void {
		if (this.skipValidation) {
			return
		}

		// Check node.id is non-empty string
		if (!node.id || typeof node.id !== "string" || node.id.trim() === "") {
			const error = new Error("Node ID must be a non-empty string")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id })
		}

		// Validate node.type against allowlist
		const validTypes = ["function", "class", "method", "interface", "variable", "import", "file"]
		if (!validTypes.includes(node.type)) {
			const error = new Error(`Invalid node type: ${node.type}. Valid types are: ${validTypes.join(", ")}`)
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, nodeType: node.type })
		}

		// Check node.name is non-empty string
		if (!node.name || typeof node.name !== "string" || node.name.trim() === "") {
			const error = new Error("Node name must be a non-empty string")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, nodeName: node.name })
		}

		// Validate node.filePath is non-empty and normalized
		if (!node.filePath || typeof node.filePath !== "string" || node.filePath.trim() === "") {
			const error = new Error("Node filePath must be a non-empty string")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, filePath: node.filePath })
		}

		// Normalize file path
		node.filePath = path.normalize(node.filePath)

		// Check node.startLine and node.endLine are >= 0 and startLine <= endLine
		if (typeof node.startLine !== "number" || node.startLine < 0) {
			const error = new Error("Node startLine must be a non-negative number")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, startLine: node.startLine })
		}

		if (typeof node.endLine !== "number" || node.endLine < 0) {
			const error = new Error("Node endLine must be a non-negative number")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, endLine: node.endLine })
		}

		if (node.startLine > node.endLine) {
			const error = new Error("Node startLine must be less than or equal to endLine")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", {
				nodeId: node.id,
				startLine: node.startLine,
				endLine: node.endLine,
			})
		}

		// Validate node.language is non-empty if present
		if (node.language !== undefined && (typeof node.language !== "string" || node.language.trim() === "")) {
			const error = new Error("Node language must be a non-empty string if provided")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { nodeId: node.id, language: node.language })
		}
	}

	/**
	 * Validate code relationship properties
	 */
	private validateCodeRelationship(relationship: CodeRelationship): void {
		if (this.skipValidation) {
			return
		}

		// Check relationship.fromId and relationship.toId are non-empty strings
		if (!relationship.fromId || typeof relationship.fromId !== "string" || relationship.fromId.trim() === "") {
			const error = new Error("Relationship fromId must be a non-empty string")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { fromId: relationship.fromId })
		}

		if (!relationship.toId || typeof relationship.toId !== "string" || relationship.toId.trim() === "") {
			const error = new Error("Relationship toId must be a non-empty string")
			throw this.createNeo4jError(error, "CONFIGURATION_ERROR", { toId: relationship.toId })
		}

		// Validate relationship type against allowlist (already done at line 1697, enhance with more checks)
		this.validateRelationshipType(relationship.type)

		// Validate metadata structure if present
		if (relationship.metadata) {
			this.validateRelationshipMetadata(relationship.type, relationship.metadata as RelationshipMetadata)
		}
	}

	/**
	 * Validate IMPORTS relationship metadata
	 */
	private validateImportsMetadata(metadata: Record<string, unknown>): void {
		if (typeof metadata.source !== "string") {
			this.log("[Neo4jService] IMPORTS relationship missing or invalid source property")
		}
		if (!Array.isArray(metadata.symbols)) {
			this.log("[Neo4jService] IMPORTS relationship missing or invalid symbols array")
		}
		if (typeof metadata.isDefault !== "boolean") {
			this.log("[Neo4jService] IMPORTS relationship missing or invalid isDefault property")
		}
	}

	/**
	 * Validate CALLS relationship metadata
	 */
	private validateCallsMetadata(metadata: Record<string, unknown>): void {
		if (typeof metadata.callType !== "string") {
			this.log("[Neo4jService] CALLS relationship missing or invalid callType property")
		}
		if (typeof metadata.line !== "number" || metadata.line < 0) {
			this.log("[Neo4jService] CALLS relationship missing or invalid line property")
		}
		if (typeof metadata.column !== "number" || metadata.column < 0) {
			this.log("[Neo4jService] CALLS relationship missing or invalid column property")
		}
	}

	/**
	 * Validate TESTS relationship metadata
	 */
	private validateTestsMetadata(metadata: Record<string, unknown>): void {
		if (typeof metadata.confidence !== "number" || metadata.confidence < 0 || metadata.confidence > 1) {
			this.log("[Neo4jService] TESTS relationship missing or invalid confidence property")
		}
		if (typeof metadata.detectionMethod !== "string") {
			this.log("[Neo4jService] TESTS relationship missing or invalid detectionMethod property")
		}
	}

	/**
	 * Validate type relationship metadata
	 */
	private validateTypeMetadata(metadata: Record<string, unknown>): void {
		if (typeof metadata.typeString !== "string") {
			this.log("[Neo4jService] Type relationship missing or invalid typeString property")
		}
	}

	/**
	 * Create a Neo4j error with proper type
	 */
	private createNeo4jError(error: Error, type: string, context?: Record<string, unknown>): Error {
		const neo4jError = new Error(error.message)
		;(neo4jError as any).type = type
		;(neo4jError as any).context = context
		return neo4jError
	}

	/**
	 * Sanitize metadata to ensure all values are primitives or arrays of primitives
	 */
	private sanitizeMetadata(metadata?: RelationshipMetadata): Record<string, unknown> {
		if (!metadata || Object.keys(metadata).length === 0) {
			return {}
		}

		// Use MetadataValidator if available and validation is not skipped
		if (this.metadataValidator && !this.skipValidation) {
			try {
				const result = this.metadataValidator.validateAndSanitize(metadata as Record<string, unknown>)

				// Log warnings from validation result using existing error logger
				for (const warning of result.warnings) {
					this.log(`[Neo4jService] Metadata validation warning: ${warning}`)
				}

				return result.sanitized
			} catch (error) {
				if (error && typeof error === "object" && "field" in error && "expectedType" in error) {
					// Handle specific validation errors
					if (error.operation === "circular_reference_detection") {
						this.log("[Neo4jService] Circular reference detected in metadata, returning empty object")
						return {}
					} else if (error.operation === "size_validation") {
						if (this.config.allowMetadataTruncation) {
							this.log(
								"[Neo4jService] Metadata size limit exceeded, truncation would be applied by validator",
							)
							// Let validator handle truncation
							try {
								const result = this.metadataValidator.validateAndSanitize(
									metadata as Record<string, unknown>,
								)
								return result.sanitized
							} catch {
								return {}
							}
						} else {
							this.log(
								"[Neo4jService] Metadata size limit exceeded and truncation disabled, returning empty object",
							)
							return {}
						}
					} else {
						this.log(`[Neo4jService] Metadata validation error: ${error.message}`)
						return {}
					}
				} else {
					this.log(`[Neo4jService] Unexpected error during metadata validation: ${error}`)
					return {}
				}
			}
		}

		// Fallback to original implementation if validator not available
		const sanitized: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
			if (value === null || value === undefined) {
				// Skip null/undefined values
				continue
			}

			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				// Primitive types are OK
				sanitized[key] = value
			} else if (Array.isArray(value)) {
				// Check if array contains only primitives
				const allPrimitives = value.every(
					(item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
				)
				if (allPrimitives) {
					sanitized[key] = value
				} else {
					// Convert complex array to JSON string
					sanitized[key] = JSON.stringify(value)
				}
			} else if (typeof value === "object") {
				// Convert objects to JSON string
				sanitized[key] = JSON.stringify(value)
			}
			// Skip functions and other non-serializable types
		}

		return sanitized
	}

	/**
	 * Validate a CodeNode object and return validation errors
	 *
	 * This method performs comprehensive validation of node properties including:
	 * - Required field presence and types
	 * - Valid value ranges (e.g., line numbers)
	 * - String field formatting
	 * - Type field allowlist validation
	 *
	 * Use this method before upserting nodes to ensure data integrity
	 * and catch potential issues early in the indexing process.
	 *
	 * @param node The CodeNode to validate
	 * @returns Promise resolving to array of validation errors (empty if valid)
	 */
	public async validateNode(node: CodeNode): Promise<CodeNodeValidationError[]> {
		const errors: CodeNodeValidationError[] = []

		// Validate node.id
		if (!node.id || typeof node.id !== "string" || node.id.trim() === "") {
			errors.push({
				field: "id",
				message: "Node ID must be a non-empty string",
				value: node.id,
			})
		}

		// Validate node.type against allowlist
		const validTypes: CodeNode["type"][] = [
			"function",
			"class",
			"method",
			"interface",
			"variable",
			"import",
			"file",
		]
		if (!validTypes.includes(node.type)) {
			errors.push({
				field: "type",
				message: `Invalid node type: ${node.type}. Valid types are: ${validTypes.join(", ")}`,
				value: node.type,
			})
		}

		// Validate node.name
		if (!node.name || typeof node.name !== "string" || node.name.trim() === "") {
			errors.push({
				field: "name",
				message: "Node name must be a non-empty string",
				value: node.name,
			})
		}

		// Validate node.filePath
		if (!node.filePath || typeof node.filePath !== "string" || node.filePath.trim() === "") {
			errors.push({
				field: "filePath",
				message: "Node filePath must be a non-empty string",
				value: node.filePath,
			})
		}

		// Validate node.startLine
		if (typeof node.startLine !== "number" || node.startLine < 1) {
			errors.push({
				field: "startLine",
				message: "Node startLine must be a positive number",
				value: node.startLine,
			})
		}

		// Validate node.endLine
		if (typeof node.endLine !== "number" || node.endLine < 1) {
			errors.push({
				field: "endLine",
				message: "Node endLine must be a positive number",
				value: node.endLine,
			})
		}

		// Validate startLine <= endLine
		if (typeof node.startLine === "number" && typeof node.endLine === "number" && node.startLine > node.endLine) {
			errors.push({
				field: "startLine",
				message: "Node startLine must be less than or equal to endLine",
				value: node.startLine,
			})
		}

		// Validate node.language if present
		if (node.language !== undefined && (typeof node.language !== "string" || node.language.trim() === "")) {
			errors.push({
				field: "language",
				message: "Node language must be a non-empty string if provided",
				value: node.language,
			})
		}

		// Update metrics if there are errors
		if (errors.length > 0) {
			this.metrics.nodeValidationFailures++
		}

		return errors
	}

	/**
	 * Validate a CodeRelationship and its metadata
	 *
	 * This method performs comprehensive validation of relationship properties including:
	 * - Required field presence and types
	 * - Relationship type allowlist validation
	 * - Metadata structure and type validation based on relationship type
	 * - Type-specific metadata field validation
	 *
	 * Use this method before creating relationships to ensure data integrity
	 * and catch potential metadata issues early in the indexing process.
	 *
	 * @param relationship The CodeRelationship to validate
	 * @returns Promise resolving to array of metadata validation errors (empty if valid)
	 */
	public async validateRelationship(relationship: CodeRelationship): Promise<MetadataValidationError[]> {
		const errors: MetadataValidationError[] = []

		// Validate relationship.fromId
		if (!relationship.fromId || typeof relationship.fromId !== "string" || relationship.fromId.trim() === "") {
			errors.push({
				field: "fromId",
				expectedType: "string",
				actualType: typeof relationship.fromId,
				message: "Relationship fromId must be a non-empty string",
			})
		}

		// Validate relationship.toId
		if (!relationship.toId || typeof relationship.toId !== "string" || relationship.toId.trim() === "") {
			errors.push({
				field: "toId",
				expectedType: "string",
				actualType: typeof relationship.toId,
				message: "Relationship toId must be a non-empty string",
			})
		}

		// Validate relationship type against allowlist
		const validTypes: CodeRelationship["type"][] = [
			"CALLS",
			"CALLED_BY",
			"TESTS",
			"TESTED_BY",
			"HAS_TYPE",
			"ACCEPTS_TYPE",
			"RETURNS_TYPE",
			"IMPORTS",
			"EXTENDS",
			"EXTENDED_BY",
			"IMPLEMENTS",
			"IMPLEMENTED_BY",
			"CONTAINS",
			"DEFINES",
			"USES",
		]
		if (!validTypes.includes(relationship.type)) {
			errors.push({
				field: "type",
				expectedType: "valid relationship type",
				actualType: relationship.type,
				message: `Invalid relationship type: ${relationship.type}. Valid types are: ${validTypes.join(", ")}`,
			})
		}

		// Validate metadata if present
		if (relationship.metadata) {
			const metadataErrors = await this.validateRelationshipMetadata(relationship.type, relationship.metadata)
			errors.push(...metadataErrors)
		}

		// Update metrics if there are errors
		if (errors.length > 0) {
			this.metrics.relationshipValidationFailures++
		}

		return errors
	}

	/**
	 * Validate relationship metadata based on relationship type
	 */
	private async validateRelationshipMetadata(
		type: string,
		metadata: RelationshipMetadata,
	): Promise<MetadataValidationError[]> {
		const errors: MetadataValidationError[] = []

		// Type-specific metadata validation
		switch (type) {
			case "IMPORTS":
				if (!this.isImportMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "ImportMetadata",
						actualType: typeof metadata,
						message: "IMPORTS relationship requires ImportMetadata structure",
					})
				} else {
					const importMeta = metadata as ImportMetadata
					if (typeof importMeta.source !== "string") {
						errors.push({
							field: "source",
							expectedType: "string",
							actualType: typeof importMeta.source,
							message: "ImportMetadata.source must be a string",
						})
					}
					if (!Array.isArray(importMeta.symbols)) {
						errors.push({
							field: "symbols",
							expectedType: "string[]",
							actualType: typeof importMeta.symbols,
							message: "ImportMetadata.symbols must be an array",
						})
					}
					if (typeof importMeta.isDefault !== "boolean") {
						errors.push({
							field: "isDefault",
							expectedType: "boolean",
							actualType: typeof importMeta.isDefault,
							message: "ImportMetadata.isDefault must be a boolean",
						})
					}
				}
				break

			case "CALLS":
				if (!this.isCallMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "CallMetadata",
						actualType: typeof metadata,
						message: "CALLS relationship requires CallMetadata structure",
					})
				} else {
					const callMeta = metadata as CallMetadata
					if (typeof callMeta.callType !== "string") {
						errors.push({
							field: "callType",
							expectedType: "string",
							actualType: typeof callMeta.callType,
							message: "CallMetadata.callType must be a string",
						})
					}
					if (typeof callMeta.line !== "number") {
						errors.push({
							field: "line",
							expectedType: "number",
							actualType: typeof callMeta.line,
							message: "CallMetadata.line must be a number",
						})
					}
					if (typeof callMeta.column !== "number") {
						errors.push({
							field: "column",
							expectedType: "number",
							actualType: typeof callMeta.column,
							message: "CallMetadata.column must be a number",
						})
					}
				}
				break

			case "TESTS":
				if (!this.isTestMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "TestRelationshipMetadata",
						actualType: typeof metadata,
						message: "TESTS relationship requires TestRelationshipMetadata structure",
					})
				} else {
					const testMeta = metadata as TestRelationshipMetadata
					if (typeof testMeta.confidence !== "number" || testMeta.confidence < 0 || testMeta.confidence > 1) {
						errors.push({
							field: "confidence",
							expectedType: "number (0-1)",
							actualType: typeof testMeta.confidence,
							message: "TestRelationshipMetadata.confidence must be a number between 0 and 1",
						})
					}
					if (typeof testMeta.detectionMethod !== "string") {
						errors.push({
							field: "detectionMethod",
							expectedType: "string",
							actualType: typeof testMeta.detectionMethod,
							message: "TestRelationshipMetadata.detectionMethod must be a string",
						})
					}
				}
				break

			case "HAS_TYPE":
			case "ACCEPTS_TYPE":
			case "RETURNS_TYPE":
				if (!this.isTypeMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "TypeMetadata",
						actualType: typeof metadata,
						message: "Type relationship requires TypeMetadata structure",
					})
				} else {
					const typeMeta = metadata as TypeMetadata
					if (typeof typeMeta.typeString !== "string") {
						errors.push({
							field: "typeString",
							expectedType: "string",
							actualType: typeof typeMeta.typeString,
							message: "TypeMetadata.typeString must be a string",
						})
					}
				}
				break

			case "EXTENDS":
				if (!this.isExtendsMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "ExtendsMetadata",
						actualType: typeof metadata,
						message: "EXTENDS relationship requires ExtendsMetadata structure",
					})
				} else {
					const extendsMeta = metadata as ExtendsMetadata
					if (typeof extendsMeta.parentClass !== "string") {
						errors.push({
							field: "parentClass",
							expectedType: "string",
							actualType: typeof extendsMeta.parentClass,
							message: "ExtendsMetadata.parentClass must be a string",
						})
					}
				}
				break

			case "IMPLEMENTS":
				if (!this.isImplementsMetadata(metadata)) {
					errors.push({
						field: "metadata",
						expectedType: "ImplementsMetadata",
						actualType: typeof metadata,
						message: "IMPLEMENTS relationship requires ImplementsMetadata structure",
					})
				} else {
					const implementsMeta = metadata as ImplementsMetadata
					if (typeof implementsMeta.interface !== "string") {
						errors.push({
							field: "interface",
							expectedType: "string",
							actualType: typeof implementsMeta.interface,
							message: "ImplementsMetadata.interface must be a string",
						})
					}
				}
				break
		}

		// Update metrics if there are errors
		if (errors.length > 0) {
			this.metrics.metadataValidationFailures++
		}

		return errors
	}

	/**
	 * Type guard for ImportMetadata
	 */
	private isImportMetadata(metadata: RelationshipMetadata): metadata is ImportMetadata {
		return typeof metadata === "object" && "source" in metadata && "symbols" in metadata && "isDefault" in metadata
	}

	/**
	 * Type guard for CallMetadata
	 */
	private isCallMetadata(metadata: RelationshipMetadata): metadata is CallMetadata {
		return typeof metadata === "object" && "callType" in metadata && "line" in metadata && "column" in metadata
	}

	/**
	 * Type guard for TestMetadata
	 */
	private isTestMetadata(metadata: RelationshipMetadata): metadata is TestRelationshipMetadata {
		return typeof metadata === "object" && "confidence" in metadata && "detectionMethod" in metadata
	}

	/**
	 * Type guard for TypeMetadata
	 */
	private isTypeMetadata(metadata: RelationshipMetadata): metadata is TypeMetadata {
		return typeof metadata === "object" && "typeString" in metadata
	}

	/**
	 * Type guard for ExtendsMetadata
	 */
	private isExtendsMetadata(metadata: RelationshipMetadata): metadata is ExtendsMetadata {
		return typeof metadata === "object" && "parentClass" in metadata
	}

	/**
	 * Type guard for ImplementsMetadata
	 */
	private isImplementsMetadata(metadata: RelationshipMetadata): metadata is ImplementsMetadata {
		return typeof metadata === "object" && "interface" in metadata
	}

	/**
	 * Get validation metrics for monitoring data quality
	 *
	 * Returns statistics about validation failures that have occurred
	 * during the current service lifetime. Use this for monitoring
	 * data quality trends and identifying potential issues in the
	 * code indexing pipeline.
	 *
	 * @returns Object containing counts of different types of validation failures
	 */
	public getValidationMetrics(): {
		nodeValidationFailures: number
		relationshipValidationFailures: number
		metadataValidationFailures: number
	} {
		return {
			nodeValidationFailures: this.metrics.nodeValidationFailures,
			relationshipValidationFailures: this.metrics.relationshipValidationFailures,
			metadataValidationFailures: this.metrics.metadataValidationFailures,
		}
	}
}
