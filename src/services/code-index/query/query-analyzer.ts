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
	| "impact_analysis" // Phase 11: Find what breaks if changed
	| "dependency_analysis" // Phase 11: Find comprehensive dependency tree
	| "blast_radius" // Phase 11: Calculate change impact radius
	| "change_safety" // Phase 11: Assess change safety
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

		// Phase 11: Impact analysis intent
		if (
			this.matchesPattern(lowerQuery, [
				"what breaks if",
				"what will break",
				"impact of changing",
				"affected by changing",
				"who depends on",
				"what uses this",
			])
		) {
			return {
				intent: "impact_analysis",
				symbolName: this.extractSymbolName(query),
				backends: ["graph"],
				weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 },
			}
		}

		// Phase 11: Dependency analysis intent
		if (
			this.matchesPattern(lowerQuery, [
				"what does this depend on",
				"dependencies of",
				"what does this use",
				"dependency tree",
				"full dependencies",
			])
		) {
			return {
				intent: "dependency_analysis",
				symbolName: this.extractSymbolName(query),
				backends: ["graph"],
				weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 },
			}
		}

		// Phase 11: Blast radius intent
		if (
			this.matchesPattern(lowerQuery, [
				"blast radius",
				"impact radius",
				"scope of change",
				"how big is the change",
				"change impact",
			])
		) {
			return {
				intent: "blast_radius",
				symbolName: this.extractSymbolName(query),
				backends: ["graph"],
				weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 },
			}
		}

		// Phase 11: Change safety intent
		if (
			this.matchesPattern(lowerQuery, [
				"can i safely change",
				"is it safe to change",
				"safe to modify",
				"risk of changing",
				"safety assessment",
			])
		) {
			return {
				intent: "change_safety",
				symbolName: this.extractSymbolName(query),
				backends: ["graph"],
				weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 },
			}
		}

		// Find callers intent
		if (this.matchesPattern(lowerQuery, ["all callers", "who calls", "what calls", "find callers"])) {
			return {
				intent: "find_callers",
				symbolName: this.extractSymbolName(query),
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.4, graph: 0.6, lsp: 0 },
			}
		}

		// Find dependents intent (check before "what does" to avoid conflict)
		if (
			this.matchesPattern(lowerQuery, [
				"what depends on",
				"what imports",
				"what requires",
				"imported by",
				"dependents",
			])
		) {
			return {
				intent: "find_dependents",
				symbolName: this.extractSymbolName(query),
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.3, graph: 0.7, lsp: 0 },
			}
		}

		// Find dependencies intent (check before "what does" to avoid conflict)
		if (
			this.matchesPattern(lowerQuery, ["depend on", "dependencies", "imports", "requires", "what does it import"])
		) {
			return {
				intent: "find_dependencies",
				symbolName: this.extractSymbolName(query),
				backends: ["graph", "bm25"],
				weights: { vector: 0, bm25: 0.3, graph: 0.7, lsp: 0 },
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

		// Find tests intent
		if (
			this.matchesPattern(lowerQuery, ["test", "tests for", "test cases", "test file", "spec file", "unit test"])
		) {
			return {
				intent: "find_tests",
				symbolName: this.extractSymbolName(query),
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
				symbolName: this.extractSymbolName(query),
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
	 * Improved heuristic: looks for quoted strings, symbols after keywords, or capitalized/camelCase words
	 */
	private extractSymbolName(query: string): string | undefined {
		// Try to find quoted strings first (highest priority)
		const quotedMatch = query.match(/["'`]([^"'`]+)["'`]/)
		if (quotedMatch) {
			return quotedMatch[1]
		}

		// Try to extract symbol after common keywords
		// Patterns: "for X", "of X", "to X", "calls X", "uses X", "on X", "use X"
		const keywordPatterns = [
			/\b(?:for|of|on)\s+([A-Z][a-zA-Z0-9_]*)\b/, // "for UserService", "of UserService"
			/\b(?:for|of|on)\s+([a-z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/, // "for authenticateUser"
			/\b(?:use|uses)\s+([A-Z][a-zA-Z0-9_]*)\b/, // "use AuthService", "to use AuthService"
			/\b(?:use|uses)\s+([a-z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/, // "use authenticateUser"
			/\b(?:calls|imports|requires)\s+([A-Z][a-zA-Z0-9_]*)\b/, // "calls UserService"
			/\b(?:calls|imports|requires)\s+([a-z][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/, // "calls authenticateUser"
			/\b(?:calls|imports|requires)\s+(?:the\s+)?([a-z_]+)\b/, // "calls the login" or "calls authenticate"
		]

		for (const pattern of keywordPatterns) {
			const match = query.match(pattern)
			if (match) {
				return match[1]
			}
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
