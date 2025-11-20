/**
 * Transaction and concurrency configuration constants for the code index service.
 * These constants control how database operations are handled, including transaction sizing,
 * timeout behavior, retry logic, and concurrency management.
 */

// ====================
// Transaction Configuration
// ====================

/**
 * Maximum number of operations that can be included in a single transaction.
 *
 * Impact on Performance:
 * - Larger values reduce transaction overhead but increase memory usage
 * - Smaller values provide more frequent commits and better progress visibility
 *
 * Trade-offs:
 * - Too large: Risk of timeout errors and higher memory consumption
 * - Too small: Increased database round trips and reduced throughput
 */
export const MAX_TRANSACTION_SIZE = 5000

/**
 * Maximum time in milliseconds that a transaction can run before timing out.
 *
 * Impact on Reliability:
 * - Prevents long-running transactions from blocking other operations
 * - Ensures database resources are eventually released
 *
 * Trade-offs:
 * - Too short: Frequent timeouts on large operations
 * - Too long: Resources may be held unnecessarily long, causing contention
 */
export const TRANSACTION_TIMEOUT_MS = 60000

/**
 * Whether to validate relationships before creating them.
 *
 * Impact on Data Integrity:
 * - true: Ensures both nodes exist before creating relationship
 * - false: Faster performance but may create dangling relationships
 *
 * Trade-offs:
 * - true: Slightly slower due to validation queries
 * - false: Risk of orphaned relationships if nodes don't exist
 */
export const VALIDATE_RELATIONSHIPS = true

/**
 * Whether to skip creating relationships that fail validation.
 *
 * Impact on Error Handling:
 * - true: Silently skips invalid relationships
 * - false: Throws errors for invalid relationships
 *
 * Trade-offs:
 * - true: Better performance but may hide data issues
 * - false: More verbose error reporting but slower processing
 */
export const SKIP_INVALID_RELATIONSHIPS = true

/**
 * Maximum number of batch retries for transient failures.
 *
 * Impact on Reliability:
 * - Higher values increase success rate for transient failures
 * - Lower values fail faster on persistent issues
 *
 * Trade-offs:
 * - Too high: May mask persistent connectivity issues
 * - Too low: May fail on temporary network glitches
 */
export const MAX_BATCH_RETRIES = 3

/**
 * Initial delay in milliseconds for exponential backoff retry.
 *
 * Impact on Performance:
 * - Higher values reduce load on failing systems
 * - Lower values provide faster recovery from transient issues
 *
 * Trade-offs:
 * - Too high: Slower recovery from temporary issues
 * - Too low: May overwhelm struggling systems
 */
export const INITIAL_RETRY_DELAY_MS = 1000

/**
 * Maximum number of transactions that can be executed concurrently.
 *
 * Impact on Performance:
 * - Controls database connection pool utilization
 * - Affects overall throughput and resource consumption
 *
 * Trade-offs:
 * - Too high: Database connection exhaustion and resource contention
 * - Too low: Underutilization of database capabilities and reduced throughput
 */
export const MAX_CONCURRENT_TRANSACTIONS = 5

/**
 * Delay in milliseconds between transaction retry attempts.
 *
 * Impact on Reliability:
 * - Provides time for transient issues to resolve
 * - Implements exponential backoff strategy when combined with retry count
 *
 * Trade-offs:
 * - Too short: May overwhelm the system during recovery
 * - Too long: Unnecessary delays in processing
 */
export const TRANSACTION_RETRY_DELAY_MS = 2000

/**
 * Maximum number of retry attempts for failed transactions.
 *
 * Impact on Reliability:
 * - Provides resilience against transient failures
 * - Balances between retry attempts and error propagation
 *
 * Trade-offs:
 * - Too high: Prolonged failure scenarios and resource waste
 * - Too low: Insufficient recovery from temporary issues
 */
export const MAX_TRANSACTION_RETRIES = 3

// ====================
// Deadlock Configuration
// ====================

/**
 * Flag to enable or disable automatic deadlock detection and handling.
 *
 * Impact on Reliability:
 * - When enabled, automatically detects and recovers from deadlock situations
 * - Provides better error handling and user experience
 *
 * Trade-offs:
 * - Enabled: Slight performance overhead for deadlock detection
 * - Disabled: Deadlocks may cause permanent failures until manual intervention
 */
export const DEADLOCK_DETECTION_ENABLED = true

/**
 * Delay in milliseconds between deadlock retry attempts.
 *
 * Impact on Reliability:
 * - Allows time for conflicting transactions to complete
 * - Reduces likelihood of immediate re-deadlock
 *
 * Trade-offs:
 * - Too short: High probability of re-deadlocking
 * - Too long: Unnecessary delays in conflict resolution
 */
export const DEADLOCK_RETRY_DELAY_MS = 5000

/**
 * Maximum number of retry attempts for operations affected by deadlocks.
 *
 * Impact on Reliability:
 * - Provides multiple opportunities to resolve deadlock situations
 * - Balances persistence with failure escalation
 *
 * Trade-offs:
 * - Too high: Prolonged deadlock resolution attempts
 * - Too low: May give up too early on resolvable conflicts
 */
export const MAX_DEADLOCK_RETRIES = 3

// ====================
// Mutex Configuration
// ====================

/**
 * Maximum time in milliseconds to wait for acquiring a mutex lock.
 *
 * Impact on Performance:
 * - Prevents indefinite blocking on contested resources
 * - Ensures timely failure when resources are unavailable
 *
 * Trade-offs:
 * - Too short: Frequent timeouts on high-contention resources
 * - Too long: Operations may wait excessively long for locks
 */
export const MUTEX_TIMEOUT_MS = 60000

/**
 * Interval in milliseconds for running mutex cleanup operations.
 *
 * Impact on Performance:
 * - Removes stale mutex locks that may be holding resources
 * - Prevents memory leaks from abandoned mutexes
 *
 * Trade-offs:
 * - Too frequent: Unnecessary CPU overhead for cleanup
 * - Too infrequent: Stale locks may persist longer, blocking operations
 */
export const MUTEX_CLEANUP_INTERVAL_MS = 300000

// ====================
// Metadata Validation Configuration
// ====================

/**
 * Maximum total size of serialized metadata to prevent Neo4j property size limit violations.
 *
 * Neo4j Documentation Reference:
 * - Neo4j has a default property size limit of 32KB per property
 * - This limit leaves a buffer for encoding overhead and ensures compatibility
 * - See: https://neo4j.com/docs/cypher-manual/current/syntax/configuration/#cypher-property-size-limit
 *
 * Impact on Data Storage:
 * - Prevents database errors from oversized properties
 * - Ensures metadata can be reliably stored and retrieved
 * - Provides consistent behavior across different Neo4j configurations
 *
 * Trade-offs:
 * - Too high: Risk of hitting Neo4j's hard limits and data loss
 * - Too low: May truncate useful metadata prematurely
 */
export const MAX_METADATA_SIZE = 30000

/**
 * Maximum length for individual string values in metadata.
 *
 * Impact on Performance:
 * - Prevents excessively large string properties that can slow down queries
 * - Reduces memory consumption during metadata processing
 * - Improves overall database performance by limiting property sizes
 *
 * Trade-offs:
 * - Too high: May impact query performance and memory usage
 * - Too low: Could truncate important documentation or identifiers
 */
export const MAX_METADATA_STRING_LENGTH = 10000

/**
 * Maximum number of items in metadata arrays.
 *
 * Impact on Memory and Performance:
 * - Prevents memory issues during batch operations
 * - Limits processing time for array operations
 * - Reduces risk of stack overflow during serialization
 *
 * Trade-offs:
 * - Too high: May cause memory pressure during processing
 * - Too low: Could limit useful metadata collection (e.g., long dependency lists)
 */
export const MAX_METADATA_ARRAY_LENGTH = 100

/**
 * Maximum nesting depth for objects in metadata.
 *
 * Impact on Processing:
 * - Prevents stack overflow during circular reference detection
 * - Limits processing time for complex object serialization
 * - Reduces risk of infinite loops in recursive processing
 *
 * Trade-offs:
 * - Too high: Risk of stack overflow and performance issues
 * - Too low: May prevent storage of legitimately complex metadata structures
 */
export const MAX_METADATA_OBJECT_DEPTH = 5

/**
 * Flag to enable/disable metadata validation before insertion.
 *
 * Impact on Data Quality:
 * - When enabled, ensures all metadata meets size and structure constraints
 * - Provides early detection of problematic metadata
 * - Maintains data consistency across the index
 *
 * Trade-offs:
 * - Enabled: Slight performance overhead for validation
 * - Disabled: Faster processing but risk of database errors from invalid metadata
 */
export const METADATA_VALIDATION_ENABLED = true

/**
 * Logging level for metadata transformations.
 *
 * Impact on Observability:
 * - Controls verbosity of metadata processing logs
 * - Helps with debugging metadata issues
 * - Provides visibility into data quality problems
 *
 * Options:
 * - 'none': No logging of metadata transformations
 * - 'warn': Log only warnings and errors
 * - 'info': Log informational messages about transformations
 * - 'debug': Detailed logging including successful transformations
 *
 * Trade-offs:
 * - Higher levels: More visibility but potential log noise
 * - Lower levels: Cleaner logs but less debugging information
 */
export const METADATA_SANITIZATION_LOG_LEVEL = "warn"

/**
 * Whether to truncate oversized metadata or reject it entirely.
 *
 * Impact on Data Completeness:
 * - When true, oversized metadata is truncated to fit limits
 * - When false, oversized metadata causes the entire operation to fail
 *
 * Trade-offs:
 * - true: Better resilience but potential data loss
 * - false: Preserves data integrity but may fail operations on large metadata
 */
export const ALLOW_METADATA_TRUNCATION = true

// ====================
// Re-export all other constants from index.ts
// ====================

export * from "./constants/index"
