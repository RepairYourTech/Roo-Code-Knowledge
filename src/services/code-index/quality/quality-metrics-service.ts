import { Node } from "web-tree-sitter"
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

	constructor(private neo4jService: INeo4jService | null) {}

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
			// Note: We need the actual source code to parse with Tree-sitter
			// For now, we'll use a simplified approach based on the code chunk
			const astNode = await this.getASTNode(node)
			if (!astNode) return null

			// Calculate complexity metrics
			const cyclomaticComplexity = this.calculateCyclomaticComplexity(astNode)
			const cognitiveComplexity = this.calculateCognitiveComplexity(astNode)
			const nestingDepth = this.calculateNestingDepth(astNode)
			const functionLength = node.endLine - node.startLine + 1
			const parameterCount = this.countParameters(astNode)

			const metrics: ComplexityMetrics = {
				cyclomaticComplexity,
				cognitiveComplexity,
				nestingDepth,
				functionLength,
				parameterCount,
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
	 * Calculate cyclomatic complexity from AST
	 * Formula: 1 + (number of decision points)
	 */
	private calculateCyclomaticComplexity(node: Node): number {
		let complexity = 1 // Base complexity

		// Decision point node types
		const decisionPoints = [
			"if_statement",
			"else_clause",
			"for_statement",
			"while_statement",
			"do_statement",
			"switch_statement",
			"case_clause",
			"catch_clause",
			"ternary_expression",
			"conditional_expression",
			"binary_expression", // For && and ||
		]

		// Traverse AST and count decision points
		const traverse = (n: Node) => {
			if (decisionPoints.includes(n.type)) {
				// Special handling for binary expressions (only count && and ||)
				if (n.type === "binary_expression") {
					const operator = n.childForFieldName("operator")
					if (operator && (operator.text === "&&" || operator.text === "||")) {
						complexity++
					}
				} else {
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
	 * Calculate cognitive complexity from AST
	 * Considers nesting and structural complexity
	 */
	private calculateCognitiveComplexity(node: Node, nestingLevel: number = 0): number {
		let complexity = 0

		// Increment points based on node type
		const incrementPoints: Record<string, number> = {
			if_statement: 1,
			else_clause: 1,
			for_statement: 1,
			while_statement: 1,
			do_statement: 1,
			switch_statement: 1,
			catch_clause: 1,
			ternary_expression: 1,
			conditional_expression: 1,
		}

		// Add base increment for this node
		const baseIncrement = incrementPoints[node.type] || 0
		if (baseIncrement > 0) {
			// Add nesting penalty
			complexity += baseIncrement + nestingLevel
		}

		// Recursively calculate for children with increased nesting
		const newNestingLevel = baseIncrement > 0 ? nestingLevel + 1 : nestingLevel
		for (const child of node.children || []) {
			if (child) {
				complexity += this.calculateCognitiveComplexity(child, newNestingLevel)
			}
		}

		return complexity
	}

	/**
	 * Calculate maximum nesting depth
	 */
	private calculateNestingDepth(node: Node, currentDepth: number = 0): number {
		const nestingNodes = [
			"if_statement",
			"for_statement",
			"while_statement",
			"do_statement",
			"switch_statement",
			"try_statement",
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
	 */
	private countParameters(node: Node): number {
		// Find parameter list node
		const params = node.childForFieldName("parameters")
		if (!params) return 0

		// Count parameter nodes
		let count = 0
		for (const child of params.children || []) {
			if (
				child &&
				(child.type === "required_parameter" ||
					child.type === "optional_parameter" ||
					child.type === "parameter")
			) {
				count++
			}
		}

		return count
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
	 * Note: This is a placeholder - actual implementation would need to parse the source code
	 */
	private async getASTNode(node: CodeNode): Promise<Node | null> {
		// TODO: Implement actual AST parsing
		// For now, return null to indicate AST is not available
		// In a full implementation, we would:
		// 1. Read the source file
		// 2. Parse it with Tree-sitter
		// 3. Find the node at the specified line range
		return null
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
			// Find unused functions and orphaned nodes in parallel
			const [unusedFunctions, orphanedNodes] = await Promise.all([
				this.findUnusedFunctions(filePath),
				this.findOrphanedNodes(filePath),
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
				unreachableCode: [], // TODO: Implement unreachable code detection
				unusedImports: [], // TODO: Implement unused import detection
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
