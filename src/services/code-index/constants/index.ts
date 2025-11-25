import { CODEBASE_INDEX_DEFAULTS } from "@roo-code/types"

/**Parser */
export const MAX_BLOCK_CHARS = 5000
/**
 * Minimum character threshold for code blocks (10 characters).
 *
 * This threshold filters out trivial content like single braces, empty lines, or very small snippets.
 * It is applied during both semantic parsing and fallback chunking to ensure meaningful code blocks.
 *
 * During fallback chunking, this can filter out small but valid code snippets. If too many valid
 * blocks are being filtered, check the logs for filtered chunk counts and consider adjusting.
 *
 * The logging in parser.ts tracks filtered chunks with messages like:
 * - "MIN_BLOCK_CHARS filtering: X chunks filtered out (smallest: Y chars, threshold: 10)"
 * - "High number of filtered chunks (X) - consider lowering MIN_BLOCK_CHARS threshold from 10"
 */
export const MIN_BLOCK_CHARS = 10
/**
 * Minimum character threshold for fallback chunking (10 characters).
 *
 * This allows for different thresholds between semantic parsing and fallback chunking.
 * Default is the same as MIN_BLOCK_CHARS but can be adjusted independently if needed.
 *
 * Fallback chunking is used when semantic parsing fails or for unsupported file types,
 * so a more lenient threshold might be appropriate for some use cases.
 */
export const MIN_FALLBACK_CHUNK_CHARS = 10
export const MIN_CHUNK_REMAINDER_CHARS = 200 // Minimum characters for the *next* chunk after a split
export const MAX_CHARS_TOLERANCE_FACTOR = 1.5 // 50% tolerance for max chars (increased from 1.15 for Phase 3)

// Phase 3: Intelligent Chunking - Semantic boundary limits
export const SEMANTIC_MAX_CHARS = 3000 // Maximum size for complete semantic units (functions, classes)
export const ABSOLUTE_MAX_CHARS = 5000 // Hard limit before forced split at logical boundaries

/**Search */
export const DEFAULT_SEARCH_MIN_SCORE = CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE
export const DEFAULT_MAX_SEARCH_RESULTS = CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS

/**File Watcher */
export const QDRANT_CODE_BLOCK_NAMESPACE = "f47ac10b-58cc-4372-a567-0e02b2c3d479"
/**
 * Maximum file size limit for indexing (1MB).
 *
 * Files larger than this threshold are automatically skipped during the indexing process to prevent
 * memory issues, maintain performance, and avoid indexing generated files that are typically large.
 *
 * Why files larger than this threshold are skipped:
 * - Memory consumption: Large files can cause significant memory usage during parsing and embedding
 * - Performance impact: Processing large files slows down the entire indexing pipeline
 * - Generated files: Many large files are auto-generated (minified JS, compiled binaries, large data files)
 * - Diminishing returns: Very large files often contain repetitive or less relevant code snippets
 *
 * Common file types that may exceed this limit:
 * - Minified JavaScript files (.min.js)
 * - Large JSON data files
 * - Compiled libraries or bundles
 * - Generated code with extensive boilerplate
 * - Large configuration files with extensive data
 * - Binary files that were accidentally included
 *
 * Troubleshooting guidance when legitimate code files are being skipped:
 * - Check if the file can be reasonably split into smaller, focused modules
 * - Consider if the file contains generated code that should be excluded from version control
 * - For configuration files, evaluate if they can be simplified or split into logical sections
 * - If the file is genuinely necessary, consider increasing this limit with caution
 * - Monitor memory usage and indexing performance when adjusting this threshold
 *
 * Current value: 1MB (1 * 1024 * 1024 bytes)
 */
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

/**Directory Scanner */
export const BATCH_SEGMENT_THRESHOLD = 1000 // Number of code segments to batch for embeddings/upserts
export const MAX_BATCH_RETRIES = 3
export const INITIAL_RETRY_DELAY_MS = 500
export const PARSING_CONCURRENCY = 10
export const MAX_PENDING_BATCHES = 20 // Maximum number of batches to accumulate before waiting

/**OpenAI Embedder */
export const MAX_BATCH_TOKENS = 100000
export const MAX_ITEM_TOKENS = 8191
export const MAX_BATCH_ITEMS = 2048 // Maximum number of items per batch (OpenAI limit)
export const BATCH_PROCESSING_CONCURRENCY = 10

/**Gemini Embedder */
export const GEMINI_MAX_ITEM_TOKENS = 2048
export const GEMINI_MAX_BATCH_ITEMS = 100 // Gemini's strict limit: "at most 100 requests can be in one batch"
