/**
 * Query intent types for intelligent search routing
 */
export type QueryIntent =
	| "find_implementation" // Find where something is implemented
	| "find_usages" // Find where something is used
	| "find_callers" // Find who calls a function
	| "find_callees" // Find what a function calls
	| "find_dependencies" // Find what a file/module depends on
	| "find_dependents" // Find what depends on a file/module
	| "find_tests" // Find test files or test cases
	| "find_examples" // Find usage examples
	| "find_by_type" // Find by LSP type information
	| "find_pattern" // Find design patterns or code patterns
	| "semantic_search" // General semantic search (default)

/**
 * Search backend types
 */
export type SearchBackend = "vector" | "bm25" | "graph" | "lsp"

/**
 * Result of query analysis
 */
export interface QueryAnalysis {
	/** Detected intent of the query */
	intent: QueryIntent
	/** Extracted symbol name (if any) */
	symbolName?: string
	/** Extracted symbol type (if any) */
	symbolType?: string
	/** Detected programming language (if any) */
	language?: string
	/** File pattern to filter by (if any) */
	filePattern?: string
	/** Recommended search backends to use */
	backends: SearchBackend[]
	/** Recommended weights for hybrid search fusion */
	weights: {
		vector: number
		bm25: number
		graph: number
		lsp: number
	}
	/** Whether to boost exported symbols */
	boostExported?: boolean
	/** Whether to filter to test files only */
	testFilesOnly?: boolean
}

/**
 * Analyzes search queries to determine intent and optimal search strategy
 */
export class QueryAnalyzer {
	/**
	 * Analyzes a query and returns recommended search strategy
	 */
	public analyze(query: string): QueryAnalysis {
		const lowerQuery = query.toLowerCase()

		// Find callers intent
		if (this.matchesPattern(lowerQuery, ["all callers", "who calls", "what calls", "find callers"])) {
			return {
				intent: "find_callers",
				symbolName: this.extractSymbolName(query),
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.4, graph: 0.6, lsp: 0 },
			}
		}

		// Find callees intent
		if (this.matchesPattern(lowerQuery, ["what does", "calls what", "find callees", "invokes"])) {
			return {
				intent: "find_callees",
				symbolName: this.extractSymbolName(query),
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.4, graph: 0.6, lsp: 0 },
			}
		}

		// Find usages intent
		if (this.matchesPattern(lowerQuery, ["all usages", "where is", "where used", "find usages", "references to"])) {
			return {
				intent: "find_usages",
				symbolName: this.extractSymbolName(query),
				backends: ["bm25", "graph", "lsp"],
				weights: { vector: 0, bm25: 0.4, graph: 0.3, lsp: 0.3 },
			}
		}

		// Find dependencies intent
		if (
			this.matchesPattern(lowerQuery, [
				"depends on",
				"dependencies",
				"imports",
				"requires",
				"what does it import",
			])
		) {
			return {
				intent: "find_dependencies",
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.3, graph: 0.7, lsp: 0 },
			}
		}

		// Find dependents intent
		if (this.matchesPattern(lowerQuery, ["dependents", "what imports", "what requires", "imported by"])) {
			return {
				intent: "find_dependents",
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.3, graph: 0.7, lsp: 0 },
			}
		}

		// Find tests intent
		if (
			this.matchesPattern(lowerQuery, ["test", "tests for", "test cases", "test file", "spec file", "unit test"])
		) {
			return {
				intent: "find_tests",
				backends: ["vector", "bm25"],
				weights: { vector: 0.6, bm25: 0.4, graph: 0, lsp: 0 },
				testFilesOnly: true,
			}
		}

		// Find by type intent (LSP-based)
		if (
			this.matchesPattern(lowerQuery, [
				"return type",
				"returns",
				"type is",
				"parameter type",
				"async function",
				"promise<",
			])
		) {
			return {
				intent: "find_by_type",
				backends: ["lsp", "vector", "bm25"],
				weights: { vector: 0.3, bm25: 0.3, graph: 0, lsp: 0.4 },
			}
		}

		// Find implementation intent
		if (
			this.matchesPattern(lowerQuery, ["implementation", "how is", "how does", "show me", "find implementation"])
		) {
			return {
				intent: "find_implementation",
				symbolName: this.extractSymbolName(query),
				backends: ["vector", "bm25"],
				weights: { vector: 0.6, bm25: 0.4, graph: 0, lsp: 0 },
				boostExported: true,
			}
		}

		// Find examples intent
		if (this.matchesPattern(lowerQuery, ["example", "examples of", "usage example", "how to use"])) {
			return {
				intent: "find_examples",
				backends: ["vector", "bm25"],
				weights: { vector: 0.7, bm25: 0.3, graph: 0, lsp: 0 },
			}
		}

		// Find pattern intent
		if (
			this.matchesPattern(lowerQuery, [
				"pattern",
				"design pattern",
				"singleton",
				"factory",
				"observer",
				"strategy",
			])
		) {
			return {
				intent: "find_pattern",
				backends: ["vector", "bm25"],
				weights: { vector: 0.8, bm25: 0.2, graph: 0, lsp: 0 },
			}
		}

		// Default: semantic search
		return {
			intent: "semantic_search",
			backends: ["vector", "bm25"],
			weights: { vector: 0.7, bm25: 0.3, graph: 0, lsp: 0 },
		}
	}

	/**
	 * Checks if query matches any of the given patterns
	 */
	private matchesPattern(query: string, patterns: string[]): boolean {
		return patterns.some((pattern) => query.includes(pattern))
	}

	/**
	 * Extracts symbol name from query
	 * Simple heuristic: looks for quoted strings or capitalized words
	 */
	private extractSymbolName(query: string): string | undefined {
		// Try to find quoted strings first
		const quotedMatch = query.match(/["'`]([^"'`]+)["'`]/)
		if (quotedMatch) {
			return quotedMatch[1]
		}

		// Try to find capitalized words (likely class/function names)
		const capitalizedMatch = query.match(/\b([A-Z][a-zA-Z0-9_]*)\b/)
		if (capitalizedMatch) {
			return capitalizedMatch[1]
		}

		// Try to find camelCase words
		const camelCaseMatch = query.match(/\b([a-z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/)
		if (camelCaseMatch) {
			return camelCaseMatch[1]
		}

		return undefined
	}
}
