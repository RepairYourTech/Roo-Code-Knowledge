import { Node } from "web-tree-sitter"
import { readFile } from "fs/promises"
import * as path from "path"
import { INeo4jService, CodeNode } from "../interfaces/neo4j-service"
import {
	IQualityMetricsService,
	ComplexityMetrics,
	CoverageMetrics,
	QualityScore,
	QualityMetrics,
	QualityMetricsOptions,
	QualityEnrichedResult,
	FileComplexityMetrics,
	FileCoverageMetrics,
	FileQualityScore,
	DeadCodeReport,
	CodeReference,
} from "../interfaces/quality-metrics"
import { HybridSearchResult } from "../hybrid-search-service"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { getWasmDirectory } from "../../tree-sitter/get-wasm-directory"
import { ImportInfo } from "../types/metadata"
import { ReachabilityAnalyzer, UnreachableNode } from "./reachability"

/**
 * Service for calculating code quality metrics including complexity,
 * test coverage, dead code detection, and quality scoring.
 *
 * Phase 13: Quality Metrics
 */
export class QualityMetricsService implements IQualityMetricsService {
	private metricsCache: Map<string, any> = new Map()
	private readonly CACHE_SIZE_LIMIT = 500
	private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
	private languageParsers: LanguageParser = {}
	private pendingParserLoads: Map<string, Promise<LanguageParser>> = new Map()
	private reachabilityAnalyzer: ReachabilityAnalyzer

	constructor(private neo4jService: INeo4jService | null) {
		this.reachabilityAnalyzer = new ReachabilityAnalyzer({
			maxAnalysisDepth: 1000,
			enableDebugging: false,
			maxAnalysisTime: 10000, // 10 seconds
		})
	}

	/**
	 * Enriches search results with quality metrics
	 */
	async enrichWithQualityMetrics(
		results: HybridSearchResult[],
		options?: QualityMetricsOptions,
	): Promise<QualityEnrichedResult[]> {
		// Default options
		const opts: Required<QualityMetricsOptions> = {
			includeComplexity: options?.includeComplexity ?? true,
			includeCoverage: options?.includeCoverage ?? true,
			includeDeadCodeCheck: options?.includeDeadCodeCheck ?? false,
			includeQualityScore: options?.includeQualityScore ?? true,
			maxResults: options?.maxResults ?? 20,
		}

		// Skip enrichment for large result sets
		if (results.length > opts.maxResults) {
			return results
		}

		// Skip if Neo4j is not available
		if (!this.neo4jService) {
			return results
		}

		// Enrich results in parallel
		return Promise.all(
			results.map(async (result) => {
				try {
					// Find the node ID for this result
					const nodeId = await this.findNodeId(result)
					if (!nodeId) {
						return result
					}

					// Calculate metrics in parallel
					const [complexity, coverage, qualityScore] = await Promise.all([
						opts.includeComplexity ? this.calculateComplexity(nodeId) : Promise.resolve(null),
						opts.includeCoverage ? this.calculateCoverage(nodeId) : Promise.resolve(null),
						opts.includeQualityScore ? this.calculateQualityScore(nodeId) : Promise.resolve(null),
					])

					// Build quality metrics object
					const qualityMetrics: QualityMetrics = {}
					if (complexity) qualityMetrics.complexity = complexity
					if (coverage) qualityMetrics.coverage = coverage
					if (qualityScore) qualityMetrics.qualityScore = qualityScore

					return {
						...result,
						qualityMetrics: Object.keys(qualityMetrics).length > 0 ? qualityMetrics : undefined,
					}
				} catch (error) {
					// Gracefully handle errors - don't break search results
					console.debug("Failed to enrich result with quality metrics:", error)
					return result
				}
			}),
		)
	}

	/**
	 * Calculate complexity metrics for a code node
	 */
	async calculateComplexity(nodeId: string): Promise<ComplexityMetrics | null> {
		// Check cache
		const cacheKey = `complexity:${nodeId}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Get the node from Neo4j
			const node = await this.getNode(nodeId)
			if (!node) return null

			// Get the AST node for this code segment
			const astNode = await this.getASTNode(node)
			if (!astNode) return null

			// Calculate complexity metrics
			const cyclomaticComplexity = this.calculateCyclomaticComplexity(astNode)
			const cognitiveComplexity = this.calculateCognitiveComplexity(astNode)
			const nestingDepth = this.calculateNestingDepth(astNode)

			// Calculate function length more accurately from AST
			const functionLength = this.calculateFunctionLength(astNode)
			const parameterCount = this.countParameters(astNode)

			// Detect duplicate code in the file
			const duplicateCodeCount = await this.detectDuplicateCode(node.filePath, astNode)

			const metrics: ComplexityMetrics = {
				cyclomaticComplexity,
				cognitiveComplexity,
				nestingDepth,
				functionLength,
				parameterCount,
				duplicateCodeCount,
			}

			// Cache the result
			this.setInCache(cacheKey, metrics)

			return metrics
		} catch (error) {
			console.debug("Failed to calculate complexity:", error)
			return null
		}
	}

	/**
	 * Calculate function length from AST node
	 * Counts actual lines of code (excluding comments and empty lines)
	 */
	private calculateFunctionLength(astNode: Node): number {
		try {
			const lines = astNode.text.split("\n")
			let codeLines = 0
			let inMultiLineComment = false

			for (const line of lines) {
				const trimmed = line.trim()

				// Skip empty lines
				if (trimmed === "") continue

				// Handle multi-line comment state tracking
				if (inMultiLineComment) {
					// Check if this line contains the closing of the multi-line comment
					if (trimmed.includes("*/")) {
						inMultiLineComment = false
						// If the line also contains code after the closing comment, count it as code
						const afterComment = trimmed.split("*/")[1]
						if (afterComment && afterComment.trim()) {
							codeLines++
						}
					}
					// Still in multi-line comment, skip this line
					continue
				}

				// Check for opening of multi-line comment when not already in one
				if (trimmed.includes("/*")) {
					// Check if both /* and */ are on the same line (inline comment)
					const hasInlineComment = trimmed.includes("*/")

					if (hasInlineComment) {
						// Handle inline /* ... */ comment
						const beforeComment = trimmed.split("/*")[0]
						const afterComment = trimmed.split("*/")[1]

						// Count as code if there's content before or after the inline comment
						if ((beforeComment && beforeComment.trim()) || (afterComment && afterComment.trim())) {
							codeLines++
						}
						// No need to toggle state since it's inline
						continue
					} else {
						// Start of multi-line comment, set state and continue
						inMultiLineComment = true
						continue
					}
				}

				// Skip comment-only lines (single-line comments)
				if (trimmed.startsWith("//")) continue
				if (trimmed.startsWith("#")) continue // Python, shell comments
				if (trimmed.startsWith("--")) continue // SQL, Lua comments
				if (trimmed.startsWith("*") && !trimmed.startsWith("* ")) continue // Skip continuation of multi-line comment

				codeLines++
			}

			return codeLines
		} catch (error) {
			console.debug("Failed to calculate function length:", error)
			// Fallback to total line count
			return astNode.endPosition.row - astNode.startPosition.row + 1
		}
	}

	/**
	 * Calculate cognitive complexity
	 * Based on SonarQube's Cognitive Complexity specification
	 */
	private calculateCognitiveComplexity(node: Node, nestingLevel: number = 0): number {
		let complexity = 0

		// Decision point node types across different languages
		// These increment complexity
		const incrementPoints: Record<string, number> = {
			// Basic control flow
			if_statement: 1,
			else: 1,
			elif: 1,
			for_statement: 1,
			for_in_statement: 1,
			while_statement: 1,
			do_statement: 1,
			switch_statement: 1,
			switch_expression: 1,
			case: 1,
			case_clause: 1,
			catch_clause: 1,
			except_clause: 1,
			finally_clause: 1,

			// Conditional expressions
			ternary_expression: 1,
			conditional_expression: 1,

			// Language-specific constructs
			guard_statement: 1, // Swift
			match_expression: 1, // Rust, Swift
			match_arm: 1, // Rust
			match_case: 1, // Swift
		}

		// Add base increment for this node
		const baseIncrement = incrementPoints[node.type] || 0
		if (baseIncrement > 0) {
			// Add nesting penalty (current nesting level)
			complexity += baseIncrement + nestingLevel
		}

		// Handle binary logical operators specially
		if (node.type === "binary_expression") {
			const operator = node.childForFieldName("operator")
			if (
				operator &&
				(operator.text === "&&" || operator.text === "||" || operator.text === "and" || operator.text === "or")
			) {
				complexity += 1 // Boolean operators don't increase nesting
			}
		} else if (node.type === "boolean_operator") {
			// Python boolean operators
			complexity += 1
		} else if (node.type === "logical_expression") {
			// Some languages use logical_expression
			complexity += 1
		}

		// Recursively calculate for children with increased nesting
		// Only structural nodes increase nesting level for their children
		const nestingNodes = [
			"if_statement",
			"else_clause",
			"elif",
			"for_statement",
			"for_in_statement",
			"while_statement",
			"do_statement",
			"switch_statement",
			"switch_expression",
			"case_clause",
			"case",
			"catch_clause",
			"except_clause",
			"finally_clause",
			"function_definition", // Nested functions
			"arrow_function",
			"lambda_expression",
		]

		const increasesNesting = nestingNodes.includes(node.type)
		const newNestingLevel = increasesNesting ? nestingLevel + 1 : nestingLevel

		for (const child of node.children || []) {
			if (child) {
				complexity += this.calculateCognitiveComplexity(child, newNestingLevel)
			}
		}

		return complexity
	}

	/**
	 * Calculate cyclomatic complexity from AST
	 * Formula: 1 + (number of decision points)
	 */
	private calculateCyclomaticComplexity(node: Node): number {
		let complexity = 1 // Base complexity

		// Decision point node types across different languages
		const decisionPoints = [
			// Control flow statements
			"if_statement",
			"else_clause",
			"else",
			"elif",
			"for_statement",
			"for_in_statement",
			"while_statement",
			"do_statement",
			"switch_statement",
			"switch_expression",
			"case_clause",
			"case",
			"default_clause",
			"default",
			"catch_clause",
			"try_statement",
			"except_clause",
			"finally_clause",

			// Conditional expressions
			"ternary_expression",
			"conditional_expression",
			"binary_expression", // For && and ||
			"boolean_operator", // Python
			"logical_expression", // Some languages

			// Loop control
			"break_statement",
			"continue_statement",
			"goto_statement",

			// Language-specific constructs
			"guard_statement", // Swift
			"match_expression", // Rust, Swift
			"match_arm", // Rust
			"match_case", // Swift
		]

		// Logical operators that increase complexity (excluding bitwise operators)
		const logicalOperators = ["&&", "||", "and", "or"]

		// Traverse AST and count decision points
		const traverse = (n: Node) => {
			let countedByType = false
			if (decisionPoints.includes(n.type)) {
				// Special handling for binary expressions (only count logical operators)
				if (n.type === "binary_expression") {
					const operator = n.childForFieldName("operator")
					if (operator && logicalOperators.some((op) => operator.text.includes(op))) {
						complexity++
						countedByType = true
					}
				} else if (n.type === "boolean_operator") {
					// Python boolean operators
					complexity++
					countedByType = true
				} else if (n.type === "logical_expression") {
					// Some languages use logical_expression
					complexity++
					countedByType = true
				} else {
					complexity++
					countedByType = true
				}
			}

			// Only detect logical operators on node kinds that actually represent operators
			// Avoid scanning full text which can match inside strings/comments
			if (
				!countedByType &&
				n.type &&
				(n.type === "LogicalExpression" ||
					n.type === "BinaryExpression" ||
					n.type === "&&" ||
					n.type === "||" ||
					n.type === "??")
			) {
				// Check if this node has logical operators and increment complexity at most once
				if (n.text && logicalOperators.some((op) => n.text.includes(op))) {
					complexity++
				}
			}

			for (const child of n.children || []) {
				if (child) {
					traverse(child)
				}
			}
		}

		traverse(node)
		return complexity
	}

	/**
	 * Calculate maximum nesting depth
	 * Supports multiple programming languages
	 */
	private calculateNestingDepth(node: Node, currentDepth: number = 0): number {
		// Nesting node types across different languages
		const nestingNodes = [
			// Control flow
			"if_statement",
			"else_clause",
			"elif",
			"for_statement",
			"for_in_statement",
			"while_statement",
			"do_statement",
			"switch_statement",
			"switch_expression",
			"case_clause",
			"case",
			"default_clause",
			"default",

			// Exception handling
			"try_statement",
			"catch_clause",
			"except_clause",
			"finally_clause",

			// Language-specific constructs
			"guard_statement", // Swift
			"match_expression", // Rust, Swift
			"match_arm", // Rust
			"match_case", // Swift
			"with_statement", // Python
			"async_statement", // Python
			"comprehension", // Python
			"lambda_expression", // Python, functional languages

			// Block expressions
			"block", // Many languages
			"function_body", // Some languages
		]

		const isNestingNode = nestingNodes.includes(node.type)
		const newDepth = isNestingNode ? currentDepth + 1 : currentDepth

		let maxDepth = newDepth

		for (const child of node.children || []) {
			if (child) {
				const childDepth = this.calculateNestingDepth(child, newDepth)
				maxDepth = Math.max(maxDepth, childDepth)
			}
		}

		return maxDepth
	}

	/**
	 * Count function parameters
	 * Supports multiple programming languages
	 */
	private countParameters(node: Node): number {
		// Try different field names for parameter lists across languages
		const params =
			node.childForFieldName("parameters") ||
			node.childForFieldName("parameter_list") ||
			node.childForFieldName("formal_parameters") ||
			node.childForFieldName("arguments") ||
			node.children?.find(
				(child) =>
					child &&
					(child.type === "parameters" ||
						child.type === "parameter_list" ||
						child.type === "formal_parameters" ||
						child.type === "arguments"),
			)

		if (!params) return 0

		// Parameter node types across different languages
		const parameterTypes = [
			"required_parameter",
			"optional_parameter",
			"parameter",
			"parameter_declaration",
			"variadic_parameter",
			"rest_parameter",
			"self_parameter", // Python
			"keyword_parameter", // Python
			"positional_parameter", // Python
			"default_parameter", // Python
			"typed_parameter", // Some languages
			"field_parameter", // Rust
			"type_parameter", // Generic type parameters
		]

		// Count parameter nodes
		let count = 0
		for (const child of params.children || []) {
			if (child && parameterTypes.includes(child.type)) {
				count++
			}
		}

		return count
	}

	/**
	 * Detect duplicate code using AST pattern matching
	 * Finds similar code structures across the codebase
	 */
	private async detectDuplicateCode(filePath: string, astNode: Node): Promise<number> {
		try {
			// Get file extension
			const ext = path.extname(filePath).toLowerCase().slice(1)
			if (!ext) {
				return 0
			}

			// Load language parser if not already loaded
			await this.loadLanguageParser(filePath)

			// Get parser for this language
			const languageParser = this.languageParsers[ext]
			if (!languageParser) {
				return 0
			}

			// Read the entire file for comprehensive analysis
			const sourceCode = await readFile(filePath, "utf8")
			const tree = languageParser.parser.parse(sourceCode)

			if (!tree || !tree.rootNode) {
				return 0
			}

			// Extract function/method nodes from the entire file
			const functions = this.extractFunctionsFromAST(tree.rootNode)

			if (functions.length < 2) {
				return 0 // No duplicates possible with less than 2 functions
			}

			// Calculate similarity between functions
			let duplicateCount = 0
			const processedPairs = new Set<string>()

			// Limit analysis to first 50 functions to prevent performance issues
			const functionsToAnalyze = functions.slice(0, 50)
			if (functions.length > 50) {
				console.debug(
					`Limiting duplicate detection to first 50 of ${functions.length} functions in ${filePath}`,
				)
			}

			for (let i = 0; i < functionsToAnalyze.length; i++) {
				for (let j = i + 1; j < functionsToAnalyze.length; j++) {
					const pairKey = `${i}-${j}`
					if (processedPairs.has(pairKey)) continue

					const similarity = this.calculateASTSimilarity(functions[i], functions[j])
					if (similarity > 0.8) {
						// 80% similarity threshold
						duplicateCount++
						processedPairs.add(pairKey)
					}
				}
			}

			return duplicateCount
		} catch (error) {
			console.debug(`Failed to detect duplicate code in ${filePath}:`, error)
			return 0
		}
	}

	/**
	 * Extract function/method nodes from AST
	 */
	private extractFunctionsFromAST(rootNode: Node): Node[] {
		const functions: Node[] = []

		// Function node types across different languages
		const functionTypes = [
			"function_declaration",
			"function_definition",
			"function_item",
			"function_expression",
			"arrow_function",
			"method_definition",
			"method_declaration",
			"method_signature",
			"constructor_declaration",
			"macro_definition", // Rust
			"decorated_definition", // Python
		]

		const traverse = (node: Node) => {
			if (functionTypes.includes(node.type)) {
				functions.push(node)
			}

			for (const child of node.children || []) {
				if (child) {
					traverse(child)
				}
			}
		}

		traverse(rootNode)
		return functions
	}

	/**
	 * Calculate similarity between two AST nodes
	 * Uses structural similarity based on node types and structure
	 */
	private calculateASTSimilarity(node1: Node, node2: Node): number {
		try {
			// Get normalized AST representations
			const ast1 = this.normalizeASTNode(node1)
			const ast2 = this.normalizeASTNode(node2)

			// Calculate structural similarity
			return this.calculateStructuralSimilarity(ast1, ast2)
		} catch (error) {
			console.debug("Failed to calculate AST similarity:", error)
			return 0
		}
	}

	/**
	 * Normalize AST node for comparison
	 * Removes identifiers and literals, focuses on structure
	 */
	private normalizeASTNode(node: Node): any {
		const normalized: any = {
			type: node.type,
			children: [],
		}

		// Process children, but skip identifiers and literals
		for (const child of node.children || []) {
			if (!child) continue

			// Skip content that doesn't affect structure
			if (this.isContentNode(child.type)) {
				continue
			}

			normalized.children.push(this.normalizeASTNode(child))
		}

		return normalized
	}

	/**
	 * Check if node type contains content rather than structure
	 */
	private isContentNode(nodeType: string): boolean {
		const contentTypes = [
			"identifier",
			"type_identifier",
			"property_identifier",
			"string_literal",
			"number_literal",
			"boolean_literal",
			"null_literal",
			"comment",
			"escape_sequence",
		]
		return contentTypes.includes(nodeType)
	}

	/**
	 * Calculate structural similarity between two normalized ASTs
	 */
	private calculateStructuralSimilarity(ast1: any, ast2: any): number {
		if (!ast1 || !ast2) return 0

		// Check if types match
		if (ast1.type !== ast2.type) {
			return 0
		}

		// If both are leaf nodes, they're identical
		if (ast1.children.length === 0 && ast2.children.length === 0) {
			return 1
		}

		// Calculate similarity based on children
		const maxChildren = Math.max(ast1.children.length, ast2.children.length)
		if (maxChildren === 0) {
			return 1
		}

		let totalSimilarity = 0
		const matchedIndices2 = new Set<number>()

		// Try to match children from ast1 to ast2
		for (let i = 0; i < ast1.children.length; i++) {
			let bestMatch = 0
			let bestIndex = -1

			for (let j = 0; j < ast2.children.length; j++) {
				if (matchedIndices2.has(j)) continue

				const similarity = this.calculateStructuralSimilarity(ast1.children[i], ast2.children[j])
				if (similarity > bestMatch) {
					bestMatch = similarity
					bestIndex = j
				}
			}

			if (bestIndex >= 0) {
				totalSimilarity += bestMatch
				matchedIndices2.add(bestIndex)
			}
		}

		// Normalize by the maximum possible similarity
		return totalSimilarity / maxChildren
	}

	/**
	 * Helper: Get node from Neo4j
	 */
	private async getNode(nodeId: string): Promise<CodeNode | null> {
		if (!this.neo4jService) return null

		try {
			const result = await this.neo4jService.executeQuery(
				`
				MATCH (node {id: $nodeId})
				RETURN node
				LIMIT 1
			`,
				{ nodeId },
			)

			return result.nodes[0] || null
		} catch (error) {
			console.debug("Failed to get node:", error)
			return null
		}
	}

	/**
	 * Helper: Get AST node for a code segment
	 * Parses the source file using tree-sitter and finds the node at the specified line range
	 */
	private async getASTNode(node: CodeNode): Promise<Node | null> {
		try {
			// Extract file extension
			const ext = path.extname(node.filePath).toLowerCase().slice(1)
			if (!ext) {
				return null
			}

			// Load language parser if not already loaded
			await this.loadLanguageParser(node.filePath)

			// Get the parser for this language
			const languageParser = this.languageParsers[ext]
			if (!languageParser) {
				console.debug(`No parser available for file extension: ${ext}`)
				return null
			}

			// Read the source file
			const sourceCode = await readFile(node.filePath, "utf8")

			// Parse the source code
			const tree = languageParser.parser.parse(sourceCode)
			if (!tree || !tree.rootNode) {
				console.debug(`Failed to parse file: ${node.filePath}`)
				return null
			}

			// Find the node at the specified line range
			return this.findNodeAtLineRange(tree.rootNode, node.startLine, node.endLine)
		} catch (error) {
			console.debug(`Failed to get AST node for ${node.filePath}:`, error)
			return null
		}
	}

	/**
	 * Loads language parser for a specific file if not already loaded
	 */
	private async loadLanguageParser(filePath: string): Promise<void> {
		const ext = path.extname(filePath).toLowerCase().slice(1)

		// Return if already loaded
		if (this.languageParsers[ext]) {
			return
		}

		// Check if there's a pending load
		const pendingLoad = this.pendingParserLoads.get(ext)
		if (pendingLoad) {
			await pendingLoad
			return
		}

		// Start a new load
		const loadPromise = loadRequiredLanguageParsers([filePath], getWasmDirectory())
		this.pendingParserLoads.set(ext, loadPromise)

		try {
			const newParsers = await loadPromise
			if (newParsers) {
				this.languageParsers = { ...this.languageParsers, ...newParsers }
			}
		} catch (error) {
			console.error(`Error loading language parser for ${filePath}:`, error)
		} finally {
			this.pendingParserLoads.delete(ext)
		}
	}

	/**
	 * Finds the AST node that encompasses the specified line range
	 */
	private findNodeAtLineRange(rootNode: Node, startLine: number, endLine: number): Node | null {
		// Convert to 0-based for tree-sitter
		const startLineZero = startLine - 1
		const endLineZero = endLine - 1

		// Find the best matching node
		let bestNode: Node | null = null
		let bestScore = Infinity

		const traverse = (node: Node) => {
			const nodeStartLine = node.startPosition.row
			const nodeEndLine = node.endPosition.row

			// Check if this node encompasses the target range
			if (nodeStartLine <= startLineZero && nodeEndLine >= endLineZero) {
				// Calculate a score based on how well the node fits the range
				const lineDiff = nodeEndLine - nodeStartLine - (endLineZero - startLineZero)
				const score = lineDiff + (Math.abs(nodeStartLine - startLineZero) + Math.abs(nodeEndLine - endLineZero))

				if (score < bestScore) {
					bestScore = score
					bestNode = node
				}
			}

			// Continue traversing children
			for (const child of node.children || []) {
				if (child) {
					traverse(child)
				}
			}
		}

		traverse(rootNode)
		return bestNode
	}

	/**
	 * Helper: Find node ID for a search result
	 */
	private async findNodeId(result: HybridSearchResult): Promise<string | null> {
		if (!this.neo4jService) return null
		if (!result.payload) return null

		try {
			const query = `
				MATCH (node {filePath: $filePath, name: $name})
				RETURN node
				LIMIT 1
			`
			const queryResult = await this.neo4jService.executeQuery(query, {
				filePath: result.payload.filePath,
				name: result.payload.identifier,
			})

			return queryResult.nodes[0]?.id || null
		} catch (error) {
			console.debug("Failed to find node ID:", error)
			return null
		}
	}

	/**
	 * Helper: Get from cache
	 */
	private getFromCache(key: string): any {
		const cached = this.metricsCache.get(key)
		if (!cached) return null

		// Check TTL
		if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
			this.metricsCache.delete(key)
			return null
		}

		return cached.value
	}

	/**
	 * Helper: Set in cache with LRU eviction
	 */
	private setInCache(key: string, value: any): void {
		// Remove existing entry to update LRU order
		if (this.metricsCache.has(key)) {
			this.metricsCache.delete(key)
		}

		// Simple LRU: if cache is full, remove oldest entry
		if (this.metricsCache.size >= this.CACHE_SIZE_LIMIT) {
			const firstKey = this.metricsCache.keys().next().value
			if (firstKey) {
				this.metricsCache.delete(firstKey)
			}
		}

		this.metricsCache.set(key, {
			value,
			timestamp: Date.now(),
		})
	}

	// Placeholder implementations for remaining interface methods
	// These will be implemented in the next chunk

	async calculateFileComplexity(filePath: string): Promise<FileComplexityMetrics | null> {
		// Check cache
		const cacheKey = `file-complexity:${filePath}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Get all functions in the file
			const query = `
				MATCH (file:file {filePath: $filePath})-[:CONTAINS]->(func)
				WHERE func.type IN ['function', 'method']
				RETURN func
			`

			const result = await this.neo4jService.executeQuery(query, { filePath })
			const functions = result.nodes || []

			if (functions.length === 0) return null

			// Calculate complexity for each function
			const complexities: Array<{ name: string; complexity: number; startLine: number }> = []
			let totalComplexity = 0
			let maxComplexity = 0
			let totalLines = 0

			for (const func of functions) {
				const complexity = await this.calculateComplexity(func.id)
				if (complexity) {
					const cyclomaticComplexity = complexity.cyclomaticComplexity
					complexities.push({
						name: func.name,
						complexity: cyclomaticComplexity,
						startLine: func.startLine,
					})
					totalComplexity += cyclomaticComplexity
					maxComplexity = Math.max(maxComplexity, cyclomaticComplexity)
					totalLines += func.endLine - func.startLine + 1
				}
			}

			const averageComplexity = functions.length > 0 ? totalComplexity / functions.length : 0

			// Find high complexity functions (>10)
			const highComplexityFunctions = complexities.filter((c) => c.complexity > 10)

			const metrics: FileComplexityMetrics = {
				filePath,
				averageComplexity: Math.round(averageComplexity * 10) / 10, // Round to 1 decimal
				maxComplexity,
				totalLines,
				functionCount: functions.length,
				highComplexityFunctions,
			}

			// Cache the result
			this.setInCache(cacheKey, metrics)

			return metrics
		} catch (error) {
			console.debug("Failed to calculate file complexity:", error)
			return null
		}
	}

	async calculateCoverage(nodeId: string): Promise<CoverageMetrics | null> {
		// Check cache
		const cacheKey = `coverage:${nodeId}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Query for test relationships
			const query = `
				MATCH (node {id: $nodeId})
				OPTIONAL MATCH (node)-[:TESTED_BY]->(directTest)
				OPTIONAL MATCH (node)<-[:CALLS]-(caller)-[:TESTED_BY]->(integrationTest)
				RETURN
					count(DISTINCT directTest) as directTests,
					count(DISTINCT integrationTest) as integrationTests
			`

			const result = await this.neo4jService.executeQuery(query, { nodeId })
			if (!result.nodes || result.nodes.length === 0) return null

			const data = result.nodes[0] as any
			const directTests = data.directTests || 0
			const integrationTests = data.integrationTests || 0

			// Calculate coverage metrics
			const isTested = directTests > 0 || integrationTests > 0
			const coveragePercentage = directTests > 0 ? 100 : integrationTests > 0 ? 50 : 0

			// Assess test quality
			let testQuality: "none" | "low" | "medium" | "high"
			if (directTests === 0 && integrationTests === 0) {
				testQuality = "none"
			} else if (directTests === 0) {
				testQuality = "low"
			} else if (directTests >= 3) {
				testQuality = "high"
			} else {
				testQuality = "medium"
			}

			const metrics: CoverageMetrics = {
				isTested,
				directTests,
				integrationTests,
				coveragePercentage,
				testQuality,
			}

			// Cache the result
			this.setInCache(cacheKey, metrics)

			return metrics
		} catch (error) {
			console.debug("Failed to calculate coverage:", error)
			return null
		}
	}

	async calculateFileCoverage(filePath: string): Promise<FileCoverageMetrics | null> {
		// Check cache
		const cacheKey = `file-coverage:${filePath}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Query for file-level coverage
			const query = `
				MATCH (file:file {filePath: $filePath})-[:CONTAINS]->(node)
				WHERE node.type IN ['function', 'method', 'class']
				OPTIONAL MATCH (node)-[:TESTED_BY]->(test)
				RETURN
					count(node) as totalNodes,
					count(DISTINCT test) as testedNodes,
					collect(CASE WHEN test IS NULL THEN node.name ELSE NULL END) as untestedFunctions
			`

			const result = await this.neo4jService.executeQuery(query, { filePath })
			if (!result.nodes || result.nodes.length === 0) return null

			const data = result.nodes[0] as any
			const totalNodes = data.totalNodes || 0
			const testedNodes = data.testedNodes || 0
			const untestedFunctions = (data.untestedFunctions || []).filter((name: string | null) => name !== null)

			const coveragePercentage = totalNodes > 0 ? Math.round((testedNodes / totalNodes) * 100) : 0

			const metrics: FileCoverageMetrics = {
				filePath,
				totalNodes,
				testedNodes,
				coveragePercentage,
				untestedFunctions,
			}

			// Cache the result
			this.setInCache(cacheKey, metrics)

			return metrics
		} catch (error) {
			console.debug("Failed to calculate file coverage:", error)
			return null
		}
	}

	async findDeadCode(filePath?: string): Promise<DeadCodeReport> {
		if (!this.neo4jService) {
			return {
				unusedFunctions: [],
				orphanedNodes: [],
				unreachableCode: [],
				unusedImports: [],
				totalDeadCodeLines: 0,
			}
		}

		try {
			// Find unused functions, orphaned nodes, unreachable code, and unused imports in parallel
			const [unusedFunctions, orphanedNodes, unreachableCode, unusedImports] = await Promise.all([
				this.findUnusedFunctions(filePath),
				this.findOrphanedNodes(filePath),
				this.findUnreachableCode(filePath),
				this.findUnusedImports(filePath),
			])

			// Convert to CodeReference
			const unusedFunctionRefs = unusedFunctions.map((node) => this.nodeToReference(node))
			const orphanedNodeRefs = orphanedNodes.map((node) => this.nodeToReference(node))

			// Calculate total dead code lines
			const totalDeadCodeLines = [...unusedFunctions, ...orphanedNodes].reduce(
				(sum, node) => sum + (node.endLine - node.startLine + 1),
				0,
			)

			return {
				unusedFunctions: unusedFunctionRefs,
				orphanedNodes: orphanedNodeRefs,
				unreachableCode,
				unusedImports,
				totalDeadCodeLines,
			}
		} catch (error) {
			console.debug("Failed to find dead code:", error)
			return {
				unusedFunctions: [],
				orphanedNodes: [],
				unreachableCode: [],
				unusedImports: [],
				totalDeadCodeLines: 0,
			}
		}
	}

	async findUnusedFunctions(filePath?: string): Promise<CodeNode[]> {
		if (!this.neo4jService) return []

		try {
			// Find functions with no CALLED_BY relationships
			// Exclude exported functions and test functions
			const query = `
				MATCH (func)
				WHERE func.type IN ['function', 'method']
				  AND NOT (func)<-[:CALLED_BY]-()
				  AND NOT (func)<-[:TESTED_BY]-()
				  AND NOT func.isExported = true
				  AND NOT func.name STARTS WITH 'test'
				  AND NOT func.name STARTS WITH 'it'
				  AND NOT func.name STARTS WITH 'describe'
				  ${filePath ? "AND func.filePath = $filePath" : ""}
				RETURN func
				LIMIT 100
			`

			const result = await this.neo4jService.executeQuery(query, filePath ? { filePath } : {})
			return result.nodes || []
		} catch (error) {
			console.debug("Failed to find unused functions:", error)
			return []
		}
	}

	async findOrphanedNodes(filePath?: string): Promise<CodeNode[]> {
		if (!this.neo4jService) return []

		try {
			// Find nodes with no relationships
			const query = `
				MATCH (node)
				WHERE NOT (node)-[]-()
				  AND node.type IN ['function', 'method', 'class', 'variable']
				  ${filePath ? "AND node.filePath = $filePath" : ""}
				RETURN node
				LIMIT 100
			`

			const result = await this.neo4jService.executeQuery(query, filePath ? { filePath } : {})
			return result.nodes || []
		} catch (error) {
			console.debug("Failed to find orphaned nodes:", error)
			return []
		}
	}

	/**
	 * Finds unreachable code in a file or entire codebase
	 * Analyzes AST to identify code paths that can never be executed
	 * @param filePath Optional file path to limit search to specific file
	 * @returns Promise resolving to array of CodeReference objects for unreachable code
	 */
	async findUnreachableCode(filePath?: string): Promise<CodeReference[]> {
		try {
			if (!this.neo4jService) return []

			// Get all files to analyze
			const filesQuery = filePath
				? `MATCH (file:file {filePath: $filePath}) RETURN file.filePath as filePath`
				: `MATCH (file:file) RETURN file.filePath as filePath LIMIT 50`

			const filesResult = await this.neo4jService.executeQuery(filesQuery, filePath ? { filePath } : {})
			const files = filesResult.nodes.map((node) => node.filePath)

			const unreachableCode: CodeReference[] = []

			// Process each file
			for (const file of files) {
				try {
					const fileUnreachableCode = await this.analyzeFileForUnreachableCode(file)
					unreachableCode.push(...fileUnreachableCode)
				} catch (error) {
					console.debug(`Failed to analyze unreachable code in ${file}:`, error)
				}
			}

			return unreachableCode
		} catch (error) {
			console.debug("Failed to find unreachable code:", error)
			return []
		}
	}

	/**
	 * Analyzes a single file for unreachable code
	 * @param filePath Path to the file to analyze
	 * @returns Promise resolving to array of CodeReference objects for unreachable code
	 */
	private async analyzeFileForUnreachableCode(filePath: string): Promise<CodeReference[]> {
		try {
			// Load language parser for the file
			await this.loadLanguageParser(filePath)
			const ext = path.extname(filePath).toLowerCase().slice(1)
			const languageParser = this.languageParsers[ext]

			if (!languageParser) {
				return []
			}

			// Read and parse the file
			const sourceCode = await readFile(filePath, "utf8")
			const tree = languageParser.parser.parse(sourceCode)

			if (!tree || !tree.rootNode) {
				return []
			}

			// Use the new reachability analyzer
			const context = this.reachabilityAnalyzer.createContext()
			this.reachabilityAnalyzer.analyze(tree.rootNode, context, ext)

			// Convert to CodeReference objects with enhanced information
			return context.getUnreachableNodes().map((unreachable: UnreachableNode) => ({
				nodeId: `unreachable-${filePath}-${unreachable.line}`,
				name: `unreachable_code_${unreachable.reason}`,
				filePath,
				startLine: unreachable.line,
				endLine: unreachable.node.endPosition.row + 1,
				type: unreachable.node.type,
				snippet: unreachable.snippet,
			}))
		} catch (error) {
			console.debug(`Failed to analyze file ${filePath} for unreachable code:`, error)
			return []
		}
	}

	/**
	 * Finds unreachable nodes using the new scoped reachability context system
	 * @param rootNode Root node of the AST
	 * @param language File extension for language-specific analysis
	 * @returns Array of unreachable AST nodes
	 */
	private findUnreachableNodes(rootNode: Node, language: string): Node[] {
		// Create new reachability context for this analysis
		const context = this.reachabilityAnalyzer.createContext()

		// Analyze the AST with proper scope tracking
		this.reachabilityAnalyzer.analyze(rootNode, context, language)

		// Convert unreachable nodes back to the expected format
		return context.getUnreachableNodes().map((unreachable: UnreachableNode) => unreachable.node)
	}

	/**
	 * Checks if a node represents a significant statement that should be reported as unreachable
	 * @param node AST node to check
	 * @returns True if the node is a significant statement
	 */
	private isSignificantStatement(node: Node): boolean {
		// Skip whitespace, comments, and certain structural nodes
		const insignificantTypes = [
			"comment",
			";", // semicolon
			"{",
			"}",
			"program",
			"source_file",
		]

		if (insignificantTypes.includes(node.type)) {
			return false
		}

		// Check if the node has meaningful content
		const text = node.text.trim()
		if (text.length === 0) {
			return false
		}

		// Consider it significant if it's a statement or declaration
		const significantTypes = [
			"expression_statement",
			"variable_declaration",
			"function_declaration",
			"class_declaration",
			"return_statement",
			"throw_statement",
			"break_statement",
			"continue_statement",
			"if_statement",
			"for_statement",
			"while_statement",
			"switch_statement",
			"try_statement",
		]

		return significantTypes.includes(node.type) || node.text.includes("=") || node.text.includes("(")
	}

	/**
	 * Analyzes a conditional node for unreachable branches
	 * @param node Conditional AST node
	 * @param language File extension for language-specific analysis
	 * @returns True if the conditional has unreachable branches
	 */
	private analyzeConditionalForUnreachableCode(node: Node, language: string): boolean {
		// Check for always-true or always-false conditions
		const conditionNode = node.childForFieldName("condition")
		if (!conditionNode) {
			return false
		}

		const conditionText = conditionNode.text.trim()

		// Common patterns that indicate unreachable code
		const unreachablePatterns = [
			/true\s*&&\s*false/, // true && false
			/false\s*\|\|\s*true/, // false || true
			/1\s*===\s*0/, // 1 === 0
			/0\s*===\s*1/, // 0 === 1
			/"[^"]*"\s*===\s*"[^"]*"/, // string === different string
			/'[^']*'\s*===\s*'[^']*'/, // single quote string === different string
		]

		for (const pattern of unreachablePatterns) {
			if (pattern.test(conditionText)) {
				return true
			}
		}

		// Check for redundant if-else-if chains
		if (node.type === "if_statement" || node.type === "elif_clause") {
			return this.checkRedundantConditions(node)
		}

		return false
	}

	/**
	 * Checks for redundant conditions in if-else-if chains
	 * @param node If statement node
	 * @returns True if redundant conditions are found
	 */
	private checkRedundantConditions(node: Node): boolean {
		// This is a simplified check - a full implementation would need more sophisticated analysis
		const conditions: string[] = []
		let current = node

		// Collect all conditions in the if-else-if chain
		while (current && (current.type === "if_statement" || current.type === "elif_clause")) {
			const conditionNode = current.childForFieldName("condition")
			if (conditionNode) {
				conditions.push(conditionNode.text.trim())
			}

			// Find the next else clause
			const elseClause =
				current.childForFieldName("alternative") ||
				current.children?.find((child) => child && child.type === "else_clause")

			if (elseClause) {
				// Check if the else clause contains another if statement
				const nestedIf = elseClause.children?.find((child) => child && child.type === "if_statement")
				if (nestedIf) {
					current = nestedIf
				} else {
					break
				}
			} else {
				break
			}
		}

		// Check for duplicate conditions
		for (let i = 0; i < conditions.length; i++) {
			for (let j = i + 1; j < conditions.length; j++) {
				if (conditions[i] === conditions[j]) {
					return true
				}
			}
		}

		return false
	}

	/**
	 * Finds unreachable branches in conditional statements
	 * @param node Conditional node
	 * @param unreachableNodes Array to add unreachable nodes to
	 */
	private findUnreachableBranches(node: Node, unreachableNodes: Node[]): void {
		// Find the unreachable branch and add its significant statements
		const alternativeNode = node.childForFieldName("alternative")
		if (alternativeNode) {
			this.findSignificantStatements(alternativeNode, unreachableNodes)
		}

		// For switch statements, check for unreachable cases
		if (node.type === "switch_statement") {
			const bodyNode = node.childForFieldName("body")
			if (bodyNode) {
				this.findUnreachableSwitchCases(bodyNode, unreachableNodes)
			}
		}
	}

	/**
	 * Finds all significant statements in a node and adds them to the unreachable nodes array
	 * @param node Node to search
	 * @param unreachableNodes Array to add unreachable nodes to
	 */
	private findSignificantStatements(node: Node, unreachableNodes: Node[]): void {
		if (this.isSignificantStatement(node)) {
			unreachableNodes.push(node)
		}

		for (const child of node.children || []) {
			if (child) {
				this.findSignificantStatements(child, unreachableNodes)
			}
		}
	}

	/**
	 * Finds unreachable switch cases
	 * @param bodyNode Switch statement body node
	 * @param unreachableNodes Array to add unreachable nodes to
	 */
	private findUnreachableSwitchCases(bodyNode: Node, unreachableNodes: Node[]): void {
		const cases =
			bodyNode.children?.filter(
				(child) => child && (child.type === "case_clause" || child.type === "default_clause"),
			) || []

		// Check for duplicate case values
		const caseValues: string[] = []
		for (const caseNode of cases) {
			if (caseNode && caseNode.type === "case_clause") {
				const valueNode = caseNode.childForFieldName("value")
				if (valueNode) {
					const value = valueNode.text.trim()
					if (caseValues.includes(value)) {
						// Duplicate case - mark it as unreachable
						this.findSignificantStatements(caseNode, unreachableNodes)
					} else {
						caseValues.push(value)
					}
				}
			}
		}

		// Check for unreachable default case (if all possible values are covered)
		const defaultCase = cases.find((child) => child && child.type === "default_clause")
		if (defaultCase && this.isAllCasesCovered(caseValues)) {
			this.findSignificantStatements(defaultCase, unreachableNodes)
		}
	}

	/**
	 * Checks if all possible cases are covered in a switch statement
	 * This is a simplified check - a full implementation would need type analysis
	 * @param caseValues Array of case values
	 * @returns True if all cases are covered
	 */
	private isAllCasesCovered(caseValues: string[]): boolean {
		// Simple heuristic: if we have boolean cases for both true and false
		const hasTrue = caseValues.some((value) => value === "true")
		const hasFalse = caseValues.some((value) => value === "false")

		return hasTrue && hasFalse
	}

	/**
	 * Finds unused imports in a file or entire codebase
	 * Tracks all import statements and analyzes code to find which imported symbols are actually used
	 * @param filePath Optional file path to limit search to specific file
	 * @returns Promise resolving to array of unused import names
	 */
	async findUnusedImports(filePath?: string): Promise<string[]> {
		try {
			if (!this.neo4jService) return []

			// Get all files to analyze
			const filesQuery = filePath
				? `MATCH (file:file {filePath: $filePath}) RETURN file.filePath as filePath`
				: `MATCH (file:file) RETURN file.filePath as filePath LIMIT 50`

			const filesResult = await this.neo4jService.executeQuery(filesQuery, filePath ? { filePath } : {})
			const files = filesResult.nodes.map((node) => node.filePath)

			const unusedImports: string[] = []

			// Process each file
			for (const file of files) {
				try {
					const fileUnusedImports = await this.analyzeFileForUnusedImports(file)
					unusedImports.push(...fileUnusedImports)
				} catch (error) {
					console.debug(`Failed to analyze unused imports in ${file}:`, error)
				}
			}

			return unusedImports
		} catch (error) {
			console.debug("Failed to find unused imports:", error)
			return []
		}
	}

	/**
	 * Analyzes a single file for unused imports
	 * @param filePath Path to the file to analyze
	 * @returns Promise resolving to array of unused import names
	 */
	private async analyzeFileForUnusedImports(filePath: string): Promise<string[]> {
		try {
			// Load language parser for the file
			await this.loadLanguageParser(filePath)
			const ext = path.extname(filePath).toLowerCase().slice(1)
			const languageParser = this.languageParsers[ext]

			if (!languageParser) {
				return []
			}

			// Read and parse the file
			const sourceCode = await readFile(filePath, "utf8")
			const tree = languageParser.parser.parse(sourceCode)

			if (!tree || !tree.rootNode) {
				return []
			}

			// Extract all imports from the file
			const imports = this.extractImportsFromAST(tree.rootNode, ext)

			// Extract all symbol usages from the file
			const usedSymbols = this.extractSymbolUsages(tree.rootNode, ext)

			// Find unused imports
			const unusedImports: string[] = []

			for (const importInfo of imports) {
				// Skip dynamic imports and certain framework imports
				if (importInfo.isDynamic || this.isFrameworkImport(importInfo.source)) {
					continue
				}

				// Check if imported symbols are used
				for (const symbol of importInfo.symbols) {
					if (symbol === "*") {
						// Wildcard import - check if any symbol from the module is used
						const modulePrefix = this.getModulePrefix(importInfo.source)
						const isUsed = usedSymbols.some(
							(usage) => usage.startsWith(modulePrefix) || usage.includes("."), // Heuristic for namespace usage
						)
						if (!isUsed) {
							unusedImports.push(`${importInfo.source}.*`)
						}
					} else {
						// Named import - check if the specific symbol is used
						const isUsed =
							usedSymbols.includes(symbol) ||
							usedSymbols.some((usage) => usage.includes(`${symbol}.`)) ||
							usedSymbols.some((usage) => usage.includes(`.${symbol}`))

						if (!isUsed) {
							unusedImports.push(`${importInfo.source}.${symbol}`)
						}
					}
				}

				// Check default imports
				if (importInfo.isDefault && importInfo.symbols.length === 0) {
					const moduleName = this.getModuleName(importInfo.source)
					const isUsed = usedSymbols.some(
						(usage) =>
							usage === moduleName ||
							usage.includes(`${moduleName}.`) ||
							usage.includes(`.${moduleName}`),
					)
					if (!isUsed) {
						unusedImports.push(importInfo.source)
					}
				}
			}

			return unusedImports
		} catch (error) {
			console.debug(`Failed to analyze file ${filePath} for unused imports:`, error)
			return []
		}
	}

	/**
	 * Extracts import information from AST
	 * @param rootNode Root node of the AST
	 * @param language File extension for language-specific analysis
	 * @returns Array of import information
	 */
	private extractImportsFromAST(rootNode: Node, language: string): ImportInfo[] {
		const imports: ImportInfo[] = []

		// Define import node types by language
		const importNodeTypes: Record<string, string[]> = {
			ts: ["import_statement", "export_statement"],
			tsx: ["import_statement", "export_statement"],
			js: ["import_statement", "export_statement"],
			jsx: ["import_statement", "export_statement"],
			py: ["import_statement", "import_from_statement", "future_import_statement"],
			rs: ["use_declaration"],
			go: ["import_declaration"],
			java: ["import_declaration"],
			cpp: ["include_directive", "using_directive"],
			cs: ["using_directive"],
		}

		const targetTypes = importNodeTypes[language] || ["import_statement"]

		// Find all import nodes
		const findImports = (node: Node) => {
			if (targetTypes.includes(node.type)) {
				// Extract import information using the existing metadata extractor
				const importInfo = this.extractImportInfoFromNode(node, language)
				if (importInfo) {
					imports.push(importInfo)
				}
			}

			for (const child of node.children || []) {
				if (child) {
					findImports(child)
				}
			}
		}

		findImports(rootNode)
		return imports
	}

	/**
	 * Extracts import information from a specific node
	 * @param node Import statement node
	 * @param language File extension for language-specific analysis
	 * @returns Import information or null
	 */
	private extractImportInfoFromNode(node: Node, language: string): ImportInfo | null {
		try {
			// This is a simplified version of the import extraction
			// In a full implementation, we would use the existing metadata extractor
			const nodeText = node.text.trim()

			// JavaScript/TypeScript imports
			if (["ts", "tsx", "js", "jsx"].includes(language)) {
				return this.parseJSImport(nodeText)
			}

			// Python imports
			if (language === "py") {
				return this.parsePythonImport(nodeText)
			}

			// Rust imports
			if (language === "rs") {
				return this.parseRustImport(nodeText)
			}

			// Go imports
			if (language === "go") {
				return this.parseGoImport(nodeText)
			}

			// Java imports
			if (language === "java") {
				return this.parseJavaImport(nodeText)
			}

			return null
		} catch (error) {
			console.debug("Failed to extract import info:", error)
			return null
		}
	}

	/**
	 * Parses JavaScript/TypeScript import statement
	 * @param importText Import statement text
	 * @returns Import information
	 */
	private parseJSImport(importText: string): ImportInfo {
		// Combined default + named imports: import React, { useState, useEffect } from 'react'
		const combinedMatch = importText.match(/import\s+(\w+),?\s*\{([^}]*)\}\s+from\s+['"`]([^'"`]+)['"`]/)
		if (combinedMatch) {
			const defaultIdentifier = combinedMatch[1]
			const namedBlock = combinedMatch[2]
			const module = combinedMatch[3]

			// Split and trim the named symbols while handling "as" aliases
			const namedSymbols = namedBlock
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
				.map((s) => s.split(" as ")[0].trim())

			// Combine default identifier with named symbols
			const symbols = [defaultIdentifier, ...namedSymbols]

			return {
				source: module,
				symbols,
				isDefault: true,
				isDynamic: false,
			}
		}

		// Default import: import name from 'module'
		const defaultMatch = importText.match(/import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/)
		if (defaultMatch) {
			return {
				source: defaultMatch[2],
				symbols: [defaultMatch[1]],
				isDefault: true,
				isDynamic: false,
			}
		}

		// Named imports: import { a, b, c as d } from 'module'
		const namedMatch = importText.match(/import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`]/)
		if (namedMatch) {
			const symbols = namedMatch[1].split(",").map((s) => s.trim().split(" as ")[0].trim())
			return {
				source: namedMatch[2],
				symbols,
				isDefault: false,
				isDynamic: false,
			}
		}

		// Namespace import: import * as name from 'module'
		const namespaceMatch = importText.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/)
		if (namespaceMatch) {
			return {
				source: namespaceMatch[2],
				symbols: ["*"],
				isDefault: false,
				isDynamic: false,
			}
		}

		// Side effect import: import 'module'
		const sideEffectMatch = importText.match(/import\s+['"`]([^'"`]+)['"`]/)
		if (sideEffectMatch) {
			return {
				source: sideEffectMatch[1],
				symbols: [],
				isDefault: true,
				isDynamic: false,
			}
		}

		// Dynamic import: import('module')
		const dynamicMatch = importText.match(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)
		if (dynamicMatch) {
			return {
				source: dynamicMatch[1],
				symbols: [],
				isDefault: false,
				isDynamic: true,
			}
		}

		// Fallback
		return {
			source: "",
			symbols: [],
			isDefault: false,
			isDynamic: false,
		}
	}

	/**
	 * Parses Python import statement
	 * @param importText Import statement text
	 * @returns Import information
	 */
	private parsePythonImport(importText: string): ImportInfo {
		// from module import name
		const fromMatch = importText.match(/from\s+([^ ]+)\s+import\s+(.+)/)
		if (fromMatch) {
			const module = fromMatch[1]
			const imports = fromMatch[2].split(",").map((s) => s.trim().split(" as ")[0].trim())

			return {
				source: module,
				symbols: imports,
				isDefault: imports.length === 1 && !importText.includes("("),
				isDynamic: false,
			}
		}

		// import module
		const importMatch = importText.match(/import\s+(.+)/)
		if (importMatch) {
			const module = importMatch[1].split(",")[0].trim().split(" as ")[0].trim()
			return {
				source: module,
				symbols: [],
				isDefault: true,
				isDynamic: false,
			}
		}

		return {
			source: "",
			symbols: [],
			isDefault: false,
			isDynamic: false,
		}
	}

	/**
	 * Parses Rust use declaration
	 * @param importText Use declaration text
	 * @returns Import information
	 */
	private parseRustImport(importText: string): ImportInfo {
		// use crate::module::item;
		const useMatch = importText.match(/use\s+([^;]+);/)
		if (useMatch) {
			const path = useMatch[1].trim()

			if (path.includes("*")) {
				// Wildcard import
				const parts = path.split("::")
				return {
					source: parts.slice(0, -1).join("::"),
					symbols: ["*"],
					isDefault: false,
					isDynamic: false,
				}
			} else {
				// Specific item import
				const parts = path.split("::")
				return {
					source: parts.slice(0, -1).join("::"),
					symbols: [parts[parts.length - 1]],
					isDefault: false,
					isDynamic: false,
				}
			}
		}

		return {
			source: "",
			symbols: [],
			isDefault: false,
			isDynamic: false,
		}
	}

	/**
	 * Parses Go import declaration
	 * @param importText Import declaration text
	 * @returns Import information
	 */
	private parseGoImport(importText: string): ImportInfo {
		// import "path" or import alias "path"
		const importMatch = importText.match(/import\s+(\w+\s+)?["`]([^"`]+)["`]/)
		if (importMatch) {
			const alias = importMatch[1]?.trim()
			const path = importMatch[2]

			return {
				source: path,
				symbols: [],
				isDefault: true,
				isDynamic: false,
				alias,
			}
		}

		return {
			source: "",
			symbols: [],
			isDefault: false,
			isDynamic: false,
		}
	}

	/**
	 * Parses Java import declaration
	 * @param importText Import declaration text
	 * @returns Import information
	 */
	private parseJavaImport(importText: string): ImportInfo {
		// import package.Class;
		const importMatch = importText.match(/import\s+([^;]+);/)
		if (importMatch) {
			const fullPath = importMatch[1].trim()

			if (fullPath.endsWith("*")) {
				// Wildcard import
				return {
					source: fullPath.slice(0, -2),
					symbols: ["*"],
					isDefault: false,
					isDynamic: false,
				}
			} else {
				// Specific class import
				const parts = fullPath.split(".")
				return {
					source: parts.slice(0, -1).join("."),
					symbols: [parts[parts.length - 1]],
					isDefault: false,
					isDynamic: false,
				}
			}
		}

		return {
			source: "",
			symbols: [],
			isDefault: false,
			isDynamic: false,
		}
	}

	/**
	 * Extracts all symbol usages from AST
	 * @param rootNode Root node of the AST
	 * @param language File extension for language-specific analysis
	 * @returns Array of used symbol names
	 */
	private extractSymbolUsages(rootNode: Node, language: string): string[] {
		const usedSymbols = new Set<string>()

		// Define identifier node types by language
		const identifierTypes: Record<string, string[]> = {
			ts: ["identifier", "property_identifier", "type_identifier"],
			tsx: ["identifier", "property_identifier", "type_identifier"],
			js: ["identifier", "property_identifier"],
			jsx: ["identifier", "property_identifier"],
			py: ["identifier", "attribute"],
			rs: ["identifier", "field_identifier", "type_identifier"],
			go: ["identifier"],
			java: ["identifier"],
			cpp: ["identifier"],
			cs: ["identifier"],
		}

		const targetTypes = identifierTypes[language] || ["identifier"]

		// Find all identifier nodes
		const findIdentifiers = (node: Node) => {
			if (targetTypes.includes(node.type)) {
				const symbol = node.text.trim()
				if (symbol && !this.isKeyword(symbol, language)) {
					usedSymbols.add(symbol)
				}
			}

			for (const child of node.children || []) {
				if (child) {
					findIdentifiers(child)
				}
			}
		}

		findIdentifiers(rootNode)
		return Array.from(usedSymbols)
	}

	/**
	 * Checks if a symbol is a language keyword
	 * @param symbol Symbol to check
	 * @param language File extension for language-specific keywords
	 * @returns True if the symbol is a keyword
	 */
	private isKeyword(symbol: string, language: string): boolean {
		const keywords: Record<string, string[]> = {
			ts: [
				"if",
				"else",
				"for",
				"while",
				"function",
				"class",
				"return",
				"var",
				"let",
				"const",
				"import",
				"export",
			],
			tsx: [
				"if",
				"else",
				"for",
				"while",
				"function",
				"class",
				"return",
				"var",
				"let",
				"const",
				"import",
				"export",
			],
			js: [
				"if",
				"else",
				"for",
				"while",
				"function",
				"class",
				"return",
				"var",
				"let",
				"const",
				"import",
				"export",
			],
			jsx: [
				"if",
				"else",
				"for",
				"while",
				"function",
				"class",
				"return",
				"var",
				"let",
				"const",
				"import",
				"export",
			],
			py: [
				"if",
				"else",
				"for",
				"while",
				"def",
				"class",
				"return",
				"import",
				"from",
				"as",
				"try",
				"except",
				"finally",
			],
			rs: ["if", "else", "for", "while", "fn", "struct", "return", "use", "mod", "impl", "let", "mut"],
			go: ["if", "else", "for", "func", "return", "import", "package", "var", "const", "go", "select", "defer"],
			java: [
				"if",
				"else",
				"for",
				"while",
				"class",
				"return",
				"import",
				"package",
				"public",
				"private",
				"protected",
			],
			cpp: ["if", "else", "for", "while", "return", "include", "using", "namespace", "class", "struct"],
			cs: [
				"if",
				"else",
				"for",
				"while",
				"class",
				"return",
				"using",
				"namespace",
				"public",
				"private",
				"protected",
			],
		}

		return keywords[language]?.includes(symbol) || false
	}

	/**
	 * Checks if an import is from a framework that should be ignored
	 * @param source Import source
	 * @returns True if the import is from a framework
	 */
	private isFrameworkImport(source: string): boolean {
		const frameworks = [
			"react",
			"vue",
			"angular",
			"express",
			"lodash",
			"moment",
			"axios",
			"jquery",
			"bootstrap",
			"@types",
			"@testing-library",
			"vitest",
			"jest",
			"mocha",
			"chai",
			"sinon",
			"enzyme",
			"cypress",
			"playwright",
			"selenium",
			"webdriver",
			"puppeteer",
			"webpack",
			"babel",
			"eslint",
			"prettier",
			"typescript",
			"ts-node",
			"nodemon",
			"concurrently",
			"cross-env",
		]

		return frameworks.some((framework) => source.toLowerCase().includes(framework))
	}

	/**
	 * Gets module prefix from import source
	 * @param source Import source
	 * @returns Module prefix
	 */
	private getModulePrefix(source: string): string {
		// For relative imports, use the last part of the path
		if (source.startsWith("./") || source.startsWith("../")) {
			const parts = source.split("/")
			return parts[parts.length - 1].replace(/\.\w+$/, "") // Remove extension
		}

		// For package imports, use the package name
		const parts = source.split("/")
		return parts[0]
	}

	/**
	 * Gets module name from import source
	 * @param source Import source
	 * @returns Module name
	 */
	private getModuleName(source: string): string {
		// For relative imports, use the last part of the path
		if (source.startsWith("./") || source.startsWith("../")) {
			const parts = source.split("/")
			return parts[parts.length - 1].replace(/\.\w+$/, "") // Remove extension
		}

		// For package imports, use the package name
		const parts = source.split("/")
		return parts[parts.length - 1]
	}

	async calculateQualityScore(nodeId: string): Promise<QualityScore | null> {
		// Check cache
		const cacheKey = `quality-score:${nodeId}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Get complexity and coverage metrics
			const [complexity, coverage] = await Promise.all([
				this.calculateComplexity(nodeId),
				this.calculateCoverage(nodeId),
			])

			// If we don't have any metrics, return null
			if (!complexity && !coverage) return null

			// Calculate component scores
			const complexityScore = complexity ? Math.max(0, 100 - complexity.cyclomaticComplexity * 2) : 50 // Default if not available

			const coverageScore = coverage ? coverage.coveragePercentage : 0

			// Check for documentation (simplified - would need to check actual code comments)
			// For now, assume not documented
			const isWellDocumented = false

			// Maintainability score (weighted combination)
			const maintainabilityScore = complexityScore * 0.4 + coverageScore * 0.3 + (isWellDocumented ? 20 : 0) + 10 // Base score

			// Overall score (weighted average)
			const overallScore = complexityScore * 0.3 + coverageScore * 0.4 + maintainabilityScore * 0.3

			const score: QualityScore = {
				overall: Math.round(overallScore),
				complexity: Math.round(complexityScore),
				coverage: Math.round(coverageScore),
				maintainability: Math.round(maintainabilityScore),
				factors: {
					hasTests: coverage ? coverage.isTested : false,
					isWellDocumented,
					hasLowComplexity: complexity ? complexity.cyclomaticComplexity <= 10 : true,
					hasNoDeadCode: true, // Simplified - would need dead code check
					followsConventions: true, // Placeholder for future analysis
				},
			}

			// Cache the result
			this.setInCache(cacheKey, score)

			return score
		} catch (error) {
			console.debug("Failed to calculate quality score:", error)
			return null
		}
	}

	async calculateFileQualityScore(filePath: string): Promise<FileQualityScore | null> {
		// Check cache
		const cacheKey = `file-quality-score:${filePath}`
		const cached = this.getFromCache(cacheKey)
		if (cached) return cached

		if (!this.neo4jService) return null

		try {
			// Get file-level metrics
			const [fileComplexity, fileCoverage, deadCode] = await Promise.all([
				this.calculateFileComplexity(filePath),
				this.calculateFileCoverage(filePath),
				this.findDeadCode(filePath),
			])

			// Calculate component scores
			const complexityScore = fileComplexity ? Math.max(0, 100 - fileComplexity.averageComplexity * 2) : 50

			const coverageScore = fileCoverage ? fileCoverage.coveragePercentage : 0

			const hasDeadCode = deadCode.totalDeadCodeLines > 0

			// Maintainability score
			const maintainabilityScore = complexityScore * 0.4 + coverageScore * 0.3 + (hasDeadCode ? 0 : 20) + 10

			// Overall score
			const overallScore = complexityScore * 0.3 + coverageScore * 0.4 + maintainabilityScore * 0.3

			// Collect issues
			const issues: string[] = []
			if (fileComplexity && fileComplexity.highComplexityFunctions.length > 0) {
				issues.push(`${fileComplexity.highComplexityFunctions.length} high-complexity functions`)
			}
			if (fileCoverage && fileCoverage.untestedFunctions.length > 0) {
				issues.push(`${fileCoverage.untestedFunctions.length} untested functions`)
			}
			if (hasDeadCode) {
				issues.push(`${deadCode.totalDeadCodeLines} lines of dead code`)
			}

			const score: FileQualityScore = {
				filePath,
				overall: Math.round(overallScore),
				complexity: Math.round(complexityScore),
				coverage: Math.round(coverageScore),
				maintainability: Math.round(maintainabilityScore),
				factors: {
					hasTests: fileCoverage ? fileCoverage.testedNodes > 0 : false,
					isWellDocumented: true, // Placeholder
					hasLowComplexity: fileComplexity ? fileComplexity.averageComplexity <= 10 : true,
					hasNoDeadCode: !hasDeadCode,
					followsConventions: true, // Placeholder
				},
				issueCount: issues.length,
				issues,
			}

			// Cache the result
			this.setInCache(cacheKey, score)

			return score
		} catch (error) {
			console.debug("Failed to calculate file quality score:", error)
			return null
		}
	}

	/**
	 * Helper: Convert CodeNode to CodeReference
	 */
	private nodeToReference(node: CodeNode): CodeReference {
		return {
			nodeId: node.id,
			name: node.name,
			filePath: node.filePath,
			startLine: node.startLine,
			endLine: node.endLine,
			type: node.type,
		}
	}
}
