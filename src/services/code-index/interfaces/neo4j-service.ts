/**
 * Interface for Neo4j graph database service
 */

/**
 * Configuration for Neo4j connection
 */
export interface Neo4jConfig {
	enabled: boolean
	url: string
	username: string
	password: string
	database: string
	/** Whether to use encryption for the connection. If not specified, will be inferred from URL scheme (https/wss => true, http/ws => false) */
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
	// Query optimization settings
	queryTimeouts?: Record<string, number>
	/** Cache TTL for blast radius results in milliseconds (default: 5 minutes) */
	blastRadiusCacheTTL?: number
	/** Maximum cache size for blast radius results (default: 100 entries) */
	blastRadiusCacheSize?: number
	/** Threshold for slow query logging in milliseconds (default: 1000ms) */
	slowQueryThreshold?: number
}

/**
 * Represents a code entity node in the graph
 */
export interface CodeNode {
	id: string // Unique identifier (same as vector store ID)
	type: "function" | "class" | "method" | "interface" | "variable" | "import" | "file"
	name: string
	filePath: string
	startLine: number
	endLine: number
	language?: string
}

/**
 * Import relationship metadata
 * Used for IMPORTS relationships to track source modules and imported symbols
 */
export interface ImportMetadata {
	/** Source module or package being imported */
	source: string
	/** Array of imported symbols (empty for default imports) */
	symbols: string[]
	/** Whether this is a default import */
	isDefault: boolean
}

/**
 * Call relationship metadata
 * Used for CALLS/CALLED_BY relationships to track call locations and types
 */
export interface CallMetadata {
	/** Type of call (direct, indirect, async, etc.) */
	callType: string
	/** Line number where the call occurs */
	line: number
	/** Column number where the call occurs */
	column: number
}

/**
 * Test relationship metadata
 * Used for TESTS/TESTED_BY relationships to track test coverage information
 */
export interface TestRelationshipMetadata {
	/** Confidence level of test detection (0-1) */
	confidence: number
	/** Method used to detect the test relationship */
	detectionMethod: string
	/** Test framework being used (jest, mocha, vitest, etc.) */
	testFramework?: string
}

/**
 * Type relationship metadata
 * Used for HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE relationships
 */
export interface TypeMetadata {
	/** String representation of the type */
	typeString: string
	/** Whether the type was inferred or explicitly declared */
	isInferred?: boolean
	/** Source of the type information (LSP, TypeScript compiler, etc.) */
	source?: string
}

/**
 * Extends relationship metadata
 * Used for EXTENDS/EXTENDED_BY relationships to track inheritance
 */
export interface ExtendsMetadata {
	/** Name of the parent class being extended */
	parentClass: string
	/** Whether the parent class is abstract */
	isAbstract?: boolean
}

/**
 * Implements relationship metadata
 * Used for IMPLEMENTS/IMPLEMENTED_BY relationships to track interface implementations
 */
export interface ImplementsMetadata {
	/** Name of the interface being implemented */
	interface: string
}

/**
 * Union type for all relationship metadata types
 * Provides type safety while maintaining flexibility for different relationship types
 */
export type RelationshipMetadata =
	| ImportMetadata
	| CallMetadata
	| TestRelationshipMetadata
	| TypeMetadata
	| ExtendsMetadata
	| ImplementsMetadata
	| Record<string, string | number | boolean | string[]>

/**
 * Validation error for metadata fields
 * Used to report specific type mismatches in relationship metadata
 */
export interface MetadataValidationError {
	/** Field name that failed validation */
	field: string
	/** Expected type for the field */
	expectedType: string
	/** Actual type that was provided */
	actualType: string
	/** Human-readable error message */
	message: string
}

/**
 * Result of metadata validation operation
 * Contains validation status and detailed error information
 */
export interface MetadataValidationResult {
	/** Whether validation passed without errors */
	valid: boolean
	/** Array of validation errors (empty if valid) */
	errors: MetadataValidationError[]
}

/**
 * Validation error for CodeNode fields
 * Used to report specific property issues in node validation
 */
export interface CodeNodeValidationError {
	/** Field name that failed validation */
	field: keyof CodeNode
	/** Human-readable error message */
	message: string
	/** The value that failed validation */
	value: unknown
}

/**
 * Represents a relationship between code entities
 * Phase 10: Added CALLED_BY for bidirectional call graph queries
 * Phase 10, Task 2: Added TESTS/TESTED_BY for test coverage relationships
 */
export interface CodeRelationship {
	fromId: string
	toId: string
	type:
		| "CALLS"
		| "CALLED_BY"
		| "TESTS" // Phase 10, Task 2: Test -> Source relationship
		| "TESTED_BY" // Phase 10, Task 2: Source -> Test relationship
		| "HAS_TYPE" // Phase 10, Task 3: Variable/Property -> Type relationship
		| "ACCEPTS_TYPE" // Phase 10, Task 3: Function -> Parameter Type relationship
		| "RETURNS_TYPE" // Phase 10, Task 3: Function -> Return Type relationship
		| "IMPORTS"
		| "EXTENDS"
		| "EXTENDED_BY" // Phase 10, Task 4: Parent Class -> Child Class relationship
		| "IMPLEMENTS"
		| "IMPLEMENTED_BY" // Phase 10, Task 4: Interface -> Implementation relationship
		| "CONTAINS"
		| "DEFINES"
		| "USES"
	metadata?: RelationshipMetadata
}

/**
 * Type guard function to validate CodeNode type values
 * @param type String to validate as a CodeNode type
 * @returns True if the type is valid for CodeNode
 */
export function isValidCodeNodeType(type: string): type is CodeNode["type"] {
	const validTypes: CodeNode["type"][] = ["function", "class", "method", "interface", "variable", "import", "file"]
	return validTypes.includes(type as CodeNode["type"])
}

/**
 * Type guard function to validate CodeNode objects at runtime
 * @param node Unknown value to validate as a CodeNode
 * @returns True if the value is a valid CodeNode
 */
export function isValidCodeNode(node: unknown): node is CodeNode {
	if (!node || typeof node !== "object") {
		return false
	}

	const n = node as Record<string, unknown>

	// Check required fields
	if (typeof n.id !== "string" || n.id.trim() === "") {
		return false
	}

	if (!isValidCodeNodeType(String(n.type))) {
		return false
	}

	if (typeof n.name !== "string" || n.name.trim() === "") {
		return false
	}

	if (typeof n.filePath !== "string" || n.filePath.trim() === "") {
		return false
	}

	if (typeof n.startLine !== "number" || n.startLine < 1) {
		return false
	}

	if (typeof n.endLine !== "number" || n.endLine < n.startLine) {
		return false
	}

	// Optional language field
	if (n.language !== undefined && (typeof n.language !== "string" || n.language.trim() === "")) {
		return false
	}

	return true
}

/**
 * Result from a graph query
 */
export interface GraphQueryResult {
	nodes: CodeNode[]
	relationships: CodeRelationship[]
	/** Query execution metadata including performance metrics */
	metadata?: {
		/** Time taken to execute the query in milliseconds */
		executionTimeMs?: number
		/** Number of records returned by the query */
		recordCount?: number
		/** Type of query executed */
		queryType?: string
		/** Timestamp when the query was executed */
		timestamp?: Date
	}
}

/**
 * Error types for Neo4j operations
 */
export enum Neo4jErrorType {
	CONNECTION_ERROR = "connection_error",
	TIMEOUT_ERROR = "timeout_error",
	AUTHENTICATION_ERROR = "authentication_error",
	DATABASE_ERROR = "database_error",
	QUERY_ERROR = "query_error",
	CONSTRAINT_VIOLATION = "constraint_violation",
	TRANSIENT_ERROR = "transient_error",
	TRANSACTION_ERROR = "transaction_error",
	DEADLOCK_ERROR = "deadlock_error",
	CONFIGURATION_ERROR = "configuration_error",
}

/**
 * Enhanced error interface for Neo4j operations
 */
export interface Neo4jError extends Error {
	type: Neo4jErrorType
	/** Original error that caused this error */
	cause?: Error
	/** Additional context about the error */
	context?: Record<string, unknown>
	/** Whether the error is retryable */
	retryable?: boolean
	/** Number of retry attempts made */
	retryAttempts?: number
	/** ID of the transaction that failed */
	transactionId?: string
	/** Whether the error is due to a deadlock */
	isDeadlock?: boolean
}

/**
 * Connection pool metrics
 */
export interface ConnectionPoolMetrics {
	totalConnections: number
	activeConnections: number
	idleConnections: number
	acquisitionAttempts: number
	acquisitionFailures: number
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
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
	slowQueryCount: number
	cacheHits: number
	cacheMisses: number
}

/**
 * Statistics for a Neo4j index
 */
export interface IndexStatistics {
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
export interface IndexMaintenanceResult {
	timestamp: Date
	indexesChecked: number
	indexesHealthy: number
	indexesFailed: string[]
	indexesRebuilt: string[]
	recommendations: string[]
}

/**
 * Performance metrics for a specific operation type
 */
export interface OperationMetrics {
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
 * Represents a dependency chain in the graph
 * Phase 11: Impact Analysis
 */
export interface DependencyChain {
	path: CodeNode[]
	relationshipTypes: string[]
	depth: number
}

/**
 * Result from impact analysis query
 * Phase 11: Impact Analysis
 */
export interface ImpactAnalysisResult {
	impactedNodes: CodeNode[]
	dependencyChains: DependencyChain[]
	blastRadius: {
		totalNodes: number
		totalFiles: number
		maxDepth: number
	}
	testCoverage: {
		hasTests: boolean
		testNodes: CodeNode[]
		coveragePercentage: number
	}
}

/**
 * Result from dependency analysis query
 * Phase 11: Impact Analysis
 */
export interface DependencyAnalysisResult {
	dependencies: CodeNode[]
	dependencyChains: DependencyChain[]
	dependencyTree: {
		totalNodes: number
		totalFiles: number
		maxDepth: number
	}
}

/**
 * Result from blast radius calculation
 * Phase 11: Impact Analysis
 */
export interface BlastRadiusResult {
	targetNode: CodeNode | null
	impactedNodes: CodeNode[]
	dependencies: CodeNode[]
	tests: CodeNode[]
	metrics: {
		totalImpactedNodes: number
		totalImpactedFiles: number
		totalDependencies: number
		totalTests: number
		maxImpactDepth: number
		maxDependencyDepth: number
		riskScore: number // 0-100, higher = riskier change
	}
}

/**
 * Result from change safety assessment
 * Phase 11: Impact Analysis
 */
export interface ChangeSafetyResult {
	nodeId: string
	nodeName: string
	safetyLevel: "safe" | "moderate" | "risky" | "dangerous"
	riskScore: number // 0-100
	reasons: string[]
	recommendations: string[]
	impactSummary: {
		impactedNodes: number
		impactedFiles: number
		maxDepth: number
	}
	testCoverage: {
		hasTests: boolean
		testCount: number
		coveragePercentage: number
	}
}

/**
 * Interface for Neo4j transaction operations
 *
 * Transactions provide atomicity, consistency, isolation, and durability (ACID) guarantees
 * for database operations. They should be used when multiple operations need to be
 * executed as a single unit of work.
 *
 * Transaction lifecycle:
 * 1. Begin transaction with beginTransaction()
 * 2. Execute operations using run() method
 * 3. Commit with commit() to save changes OR rollback() to discard
 *
 * Usage patterns:
 * - Use transactions for complex operations involving multiple nodes/relationships
 * - Use transactions for batch operations (> 1000 items)
 * - Keep transactions short-lived to avoid locks and deadlocks
 * - Always handle exceptions and ensure proper cleanup
 *
 * Isolation levels:
 * - Neo4j provides READ_COMMITTED isolation by default
 * - Write operations acquire exclusive locks on affected nodes/relationships
 * - Read operations can proceed concurrently with writes to different data
 */
export interface INeo4jTransaction {
	/**
	 * Commit the transaction, making all changes permanent
	 * @throws {Neo4jError} If the transaction has already been closed or cannot be committed
	 */
	commit(): Promise<void>

	/**
	 * Rollback the transaction, discarding all changes
	 * @throws {Neo4jError} If the transaction has already been closed
	 */
	rollback(): Promise<void>

	/**
	 * Execute a Cypher query within this transaction
	 * @param cypher The Cypher query to execute
	 * @param parameters Optional parameters for the query
	 * @returns Query result
	 * @throws {Neo4jError} If the query fails or transaction is closed
	 */
	run(cypher: string, parameters?: Record<string, unknown>): Promise<any>

	/**
	 * Check if the transaction is still open and can accept operations
	 * @returns true if the transaction is open, false if committed or rolled back
	 */
	isOpen(): boolean
}

/**
 * Interface for Neo4j graph database operations
 */
export interface INeo4jService {
	/**
	 * Initialize the Neo4j connection and create indexes
	 */
	initialize(): Promise<void>

	/**
	 * Check if the service is connected and ready
	 */
	isConnected(): boolean

	/**
	 * Get service metrics including performance and error statistics
	 */
	getMetrics(): ServiceMetrics

	/**
	 * Get connection pool metrics for monitoring resource usage
	 */
	getConnectionPoolMetrics(): ConnectionPoolMetrics

	/**
	 * Get per-operation performance metrics
	 * @returns Map of operation names to their performance metrics
	 */
	getOperationMetrics(): Map<string, OperationMetrics>

	/**
	 * Get Neo4j index statistics including usage and health
	 * @returns Index statistics including name, state, type, and usage metrics
	 */
	getIndexStats(): Promise<IndexStatistics[]>

	/**
	 * Analyze query execution plan using EXPLAIN or PROFILE
	 * Useful for debugging slow queries and verifying index usage
	 * @param cypher The Cypher query to analyze
	 * @param parameters Optional parameters for the query
	 * @param profile If true, uses PROFILE (includes execution stats), otherwise EXPLAIN (plan only)
	 * @returns Query execution plan details
	 */
	explainQuery(cypher: string, parameters?: Record<string, unknown>, profile?: boolean): Promise<any>

	/**
	 * Perform index maintenance including health checks and statistics logging
	 * Should be called periodically (e.g., daily) to ensure index health
	 * @returns Maintenance results including any issues found
	 */
	performIndexMaintenance(): Promise<IndexMaintenanceResult>

	/**
	 * Begin a new write transaction for atomic operations
	 *
	 * Transactions should be used when:
	 * - Multiple operations need to succeed or fail together
	 * - Performing batch operations (> 1000 items)
	 * - Complex graph modifications requiring consistency
	 *
	 * Concurrency behavior:
	 * - Write transactions acquire exclusive locks on modified nodes/relationships
	 * - Multiple concurrent transactions may deadlock if they access the same resources
	 * - Keep transactions short-lived to minimize lock contention
	 *
	 * @returns A transaction interface for executing operations
	 * @throws {Neo4jError} If a transaction cannot be created
	 */
	beginTransaction(): Promise<INeo4jTransaction>

	/**
	 * Execute an operation within a transaction with automatic commit/rollback
	 *
	 * This method provides a convenient way to execute operations within a transaction
	 * without manually managing the transaction lifecycle. The transaction is automatically
	 * committed if the operation succeeds, or rolled back if it throws an exception.
	 *
	 * @param operation A function that receives a transaction and returns a result
	 * @returns The result of the operation
	 * @throws {Neo4jError} If the operation fails or transaction cannot be created
	 */
	executeInTransaction<T>(operation: (tx: INeo4jTransaction) => Promise<T>): Promise<T>

	/**
	 * Add or update a code node in the graph
	 */
	upsertNode(node: CodeNode): Promise<void>

	/**
	 * Add or update multiple code nodes in the graph
	 * @param nodes Array of nodes to upsert
	 * @description Batch operation limit: Recommended maximum of 1000 nodes per call for optimal performance.
	 * For larger batches, consider using transactions with executeInTransaction() to ensure atomicity.
	 * Warning: Large batches (> 1000 nodes) may cause memory issues, timeouts, or transaction size limits.
	 */
	upsertNodes(nodes: CodeNode[]): Promise<void>

	/**
	 * Create a relationship between two nodes
	 */
	createRelationship(relationship: CodeRelationship): Promise<void>

	/**
	 * Create multiple relationships
	 * @param relationships Array of relationships to create
	 * @description Batch operation limit: Recommended maximum of 1000 relationships per call for optimal performance.
	 * For larger batches, consider using transactions with executeInTransaction() to ensure atomicity.
	 * Warning: Large batches (> 1000 relationships) may cause memory issues, timeouts, or transaction size limits.
	 */
	createRelationships(relationships: CodeRelationship[]): Promise<void>

	/**
	 * Delete a node and all its relationships
	 */
	deleteNode(id: string): Promise<void>

	/**
	 * Delete all nodes for a specific file path
	 */
	deleteNodesByFilePath(filePath: string): Promise<void>

	/**
	 * Delete multiple nodes by file paths
	 */
	deleteNodesByMultipleFilePaths(filePaths: string[]): Promise<void>

	/**
	 * Find all nodes that call a specific function/method
	 */
	findCallers(nodeId: string): Promise<CodeNode[]>

	/**
	 * Find all nodes that are called by a specific function/method
	 */
	findCallees(nodeId: string): Promise<CodeNode[]>

	/**
	 * Find all dependencies (imports) for a file
	 */
	findDependencies(filePath: string): Promise<CodeNode[]>

	/**
	 * Find all files that depend on (import) a specific file
	 */
	findDependents(filePath: string): Promise<CodeNode[]>

	/**
	 * Find all implementations of an interface
	 */
	findImplementations(interfaceId: string): Promise<CodeNode[]>

	/**
	 * Find all subclasses of a class
	 */
	findSubclasses(classId: string): Promise<CodeNode[]>

	/**
	 * Execute a custom Cypher query
	 * @param cypher The Cypher query to execute
	 * @param parameters Optional parameters for the query
	 * @param timeout Optional timeout in milliseconds (default: from config)
	 * @param allowDangerousQueries Set to true only for trusted queries with user input (prevents Cypher injection)
	 */
	executeQuery(
		cypher: string,
		parameters?: Record<string, unknown>,
		timeout?: number,
		allowDangerousQueries?: boolean,
	): Promise<GraphQueryResult>

	/**
	 * Clear all data from the graph (for testing/reset)
	 */
	clearAll(): Promise<void>

	/**
	 * Close the Neo4j connection
	 */
	close(): Promise<void>

	/**
	 * Get statistics about the graph
	 */
	getStats(): Promise<{
		nodeCount: number
		relationshipCount: number
		fileCount: number
	}>

	/**
	 * Phase 11: Find all nodes impacted by changing a symbol
	 * Traverses CALLED_BY, EXTENDED_BY, IMPLEMENTED_BY, TESTED_BY relationships
	 * @param nodeId The ID of the node to analyze
	 * @param maxDepth Maximum traversal depth (default: 3, range: 1-10)
	 * @param limit Maximum number of results to return (default: 1000)
	 */
	findImpactedNodes(nodeId: string, maxDepth?: number, limit?: number): Promise<ImpactAnalysisResult>

	/**
	 * Phase 11: Find all dependencies of a symbol
	 * Traverses CALLS, EXTENDS, IMPLEMENTS, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS relationships
	 * @param nodeId The ID of the node to analyze
	 * @param maxDepth Maximum traversal depth (default: 3, range: 1-10)
	 * @param limit Maximum number of results to return (default: 1000)
	 */
	findDependencyTree(nodeId: string, maxDepth?: number, limit?: number): Promise<DependencyAnalysisResult>

	/**
	 * Phase 11: Calculate blast radius of changing a symbol
	 * Combines impact analysis, dependency analysis, and test coverage
	 * @param nodeId The ID of the node to analyze
	 * @param maxDepth Maximum traversal depth (default: 3, range: 1-10)
	 * @param limit Maximum number of results to return (default: 1000)
	 */
	calculateBlastRadius(nodeId: string, maxDepth?: number, limit?: number): Promise<BlastRadiusResult>

	/**
	 * Phase 11: Assess whether it's safe to change a symbol
	 * Combines blast radius with test coverage to provide safety assessment
	 */
	assessChangeSafety(nodeId: string): Promise<ChangeSafetyResult>

	/**
	 * Add or update multiple code nodes within a transaction
	 * @param nodes Array of nodes to upsert
	 * @param tx Transaction to use for the operation
	 */
	upsertNodesInTransaction(nodes: CodeNode[], tx: INeo4jTransaction): Promise<void>

	/**
	 * Create multiple relationships within a transaction
	 * @param relationships Array of relationships to create
	 * @param tx Transaction to use for the operation
	 */
	createRelationshipsInTransaction(relationships: CodeRelationship[], tx: INeo4jTransaction): Promise<void>

	/**
	 * Delete nodes by file path within a transaction
	 * @param filePath File path to delete nodes for
	 * @param tx Transaction to use for the operation
	 */
	deleteNodesByFilePathInTransaction(filePath: string, tx: INeo4jTransaction): Promise<void>

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
	validateNode(node: CodeNode): Promise<CodeNodeValidationError[]>

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
	validateRelationship(relationship: CodeRelationship): Promise<MetadataValidationError[]>

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
	getValidationMetrics(): {
		nodeValidationFailures: number
		relationshipValidationFailures: number
		metadataValidationFailures: number
	}
}
