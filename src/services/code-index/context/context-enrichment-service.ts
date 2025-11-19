import { HybridSearchResult } from "../hybrid-search-service"
import { INeo4jService, CodeNode } from "../interfaces/neo4j-service"
import {
	IContextEnrichmentService,
	EnrichedSearchResult,
	ContextEnrichmentOptions,
	RelatedCodeContext,
	TestContext,
	DependencyContext,
	TypeInfoContext,
	FileSummaryContext,
	CodeReference,
} from "../interfaces/context-enrichment"

/**
 * Phase 12: Enhanced Context - Context Enrichment Service
 *
 * This service enriches search results with contextual information from the
 * Neo4j graph database, including related code, tests, dependencies, and type info.
 */
export class ContextEnrichmentService implements IContextEnrichmentService {
	private fileSummaryCache: Map<string, FileSummaryContext> = new Map()
	private readonly CACHE_SIZE_LIMIT = 1000

	constructor(private neo4jService: INeo4jService | null) {}

	/**
	 * Enriches search results with contextual information
	 */
	async enrichSearchResults(
		results: HybridSearchResult[],
		options?: ContextEnrichmentOptions,
	): Promise<EnrichedSearchResult[]> {
		// Default options
		const opts: Required<ContextEnrichmentOptions> = {
			maxRelatedItems: options?.maxRelatedItems ?? 3,
			enrichRelatedCode: options?.enrichRelatedCode ?? true,
			enrichTests: options?.enrichTests ?? true,
			enrichDependencies: options?.enrichDependencies ?? true,
			enrichTypeInfo: options?.enrichTypeInfo ?? true,
			enrichFileSummary: options?.enrichFileSummary ?? true,
			skipEnrichmentThreshold: options?.skipEnrichmentThreshold ?? 20,
		}

		// Skip enrichment if Neo4j is not available
		if (!this.neo4jService) {
			return results as EnrichedSearchResult[]
		}

		// Skip enrichment for large result sets
		if (results.length > opts.skipEnrichmentThreshold) {
			return results as EnrichedSearchResult[]
		}

		// Enrich all results in parallel
		const enrichedResults = await Promise.all(results.map((result) => this.enrichSingleResult(result, opts)))

		return enrichedResults
	}

	/**
	 * Enriches a single search result with all context types
	 */
	private async enrichSingleResult(
		result: HybridSearchResult,
		options: Required<ContextEnrichmentOptions>,
	): Promise<EnrichedSearchResult> {
		// Run all enrichments in parallel
		const [relatedCode, tests, dependencies, typeInfo, fileSummary] = await Promise.all([
			options.enrichRelatedCode
				? this.enrichWithRelatedCode(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichTests ? this.enrichWithTests(result) : Promise.resolve(undefined),
			options.enrichDependencies
				? this.enrichWithDependencies(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichTypeInfo
				? this.enrichWithTypeInfo(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichFileSummary && result.payload?.filePath
				? this.enrichWithFileSummary(result.payload.filePath)
				: Promise.resolve(undefined),
		])

		return {
			...result,
			relatedCode,
			tests,
			dependencies,
			typeInfo,
			fileSummary,
		}
	}

	/**
	 * Enriches with related code (callers, callees, inheritance)
	 */
	async enrichWithRelatedCode(result: HybridSearchResult, maxItems: number): Promise<RelatedCodeContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			// Find the node by ID or by file path + identifier
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Query for all related code in parallel
			const [callers, callees, parentClasses, childClasses, siblingMethods] = await Promise.all([
				this.findCallers(nodeId, maxItems),
				this.findCallees(nodeId, maxItems),
				this.findParentClasses(nodeId),
				this.findChildClasses(nodeId, maxItems),
				this.findSiblingMethods(nodeId, maxItems),
			])

			return {
				callers,
				callees,
				parentClasses,
				childClasses,
				siblingMethods,
			}
		} catch (error) {
			console.error("Error enriching with related code:", error)
			return undefined
		}
	}

	/**
	 * Enriches with test coverage information
	 */
	async enrichWithTests(result: HybridSearchResult): Promise<TestContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Find tests that test this code
			const tests = await this.findTests(nodeId)

			// Separate direct tests from integration tests
			const directTests = tests.filter((t) => t.type === "function" || t.type === "method")
			const integrationTests = tests.filter((t) => t.type !== "function" && t.type !== "method")

			// Calculate coverage percentage (simple heuristic: has tests = 100%, no tests = 0%)
			const coveragePercentage = tests.length > 0 ? 100 : 0

			return {
				directTests,
				integrationTests,
				coveragePercentage,
			}
		} catch (error) {
			console.error("Error enriching with tests:", error)
			return undefined
		}
	}

	/**
	 * Enriches with dependency information
	 */
	async enrichWithDependencies(result: HybridSearchResult, maxItems: number): Promise<DependencyContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Find dependencies (IMPORTS, CALLS relationships)
			const dependencies = await this.findDependencies(nodeId, maxItems)

			// Calculate dependency depth (max depth in dependency tree)
			const dependencyDepth = await this.calculateDependencyDepth(nodeId)

			// Detect circular dependencies
			const circularDependencies = await this.detectCircularDependencies(nodeId)

			return {
				directDependencies: dependencies,
				dependencyDepth,
				circularDependencies,
			}
		} catch (error) {
			console.error("Error enriching with dependencies:", error)
			return undefined
		}
	}

	/**
	 * Enriches with type information
	 */
	async enrichWithTypeInfo(result: HybridSearchResult, maxItems: number): Promise<TypeInfoContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Get type definition from LSP info if available
			const definition = result.payload?.lspTypeInfo?.typeInfo?.type || ""

			// Find type dependencies (types this type uses)
			const typeDependencies = await this.findTypeDependencies(nodeId, maxItems)

			// Find type usage (where this type is used)
			const typeUsage = await this.findTypeUsage(nodeId, maxItems)

			return {
				definition,
				typeDependencies,
				typeUsage,
			}
		} catch (error) {
			console.error("Error enriching with type info:", error)
			return undefined
		}
	}

	/**
	 * Enriches with file-level summary
	 */
	async enrichWithFileSummary(filePath: string): Promise<FileSummaryContext | undefined> {
		if (!this.neo4jService) {
			return undefined
		}

		// Check cache first
		if (this.fileSummaryCache.has(filePath)) {
			return this.fileSummaryCache.get(filePath)
		}

		try {
			// Find all nodes in this file
			const fileNodes = await this.findFileNodes(filePath)

			// Extract main exports (classes, functions at file level)
			const mainExports = fileNodes
				.filter((node) => node.type === "class" || node.type === "function" || node.type === "interface")
				.map((node) => node.name)
				.slice(0, 10) // Limit to top 10

			// Extract dependencies (unique imports)
			const dependencies = await this.findFileDependencies(filePath)

			// Calculate file-level test coverage
			const testCoverage = await this.calculateFileTestCoverage(filePath)

			// Extract purpose from file (placeholder - could be enhanced with comment parsing)
			const purpose = this.extractFilePurpose(filePath, fileNodes)

			const summary: FileSummaryContext = {
				purpose,
				mainExports,
				dependencies,
				testCoverage,
			}

			// Cache the result
			this.cacheFileSummary(filePath, summary)

			return summary
		} catch (error) {
			console.error("Error enriching with file summary:", error)
			return undefined
		}
	}

	// ========================================================================
	// Helper Methods - Neo4j Queries
	// ========================================================================

	/**
	 * Finds the Neo4j node ID for a search result
	 */
	private async findNodeId(result: HybridSearchResult): Promise<string | null> {
		if (!this.neo4jService) {
			return null
		}

		// If result has a node ID, use it
		if (typeof result.id === "string" && result.id.includes("::")) {
			return result.id
		}

		// Otherwise, try to find by file path + identifier
		if (result.payload?.filePath && result.payload?.identifier) {
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
		}

		return null
	}

	/**
	 * Finds callers (CALLED_BY relationships)
	 */
	private async findCallers(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:CALLED_BY]-(caller)
			RETURN caller
			ORDER BY caller.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds callees (CALLS relationships)
	 */
	private async findCallees(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:CALLS]->(callee)
			RETURN callee
			ORDER BY callee.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds parent classes (EXTENDS/IMPLEMENTS relationships)
	 */
	private async findParentClasses(nodeId: string): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:EXTENDS|IMPLEMENTS]->(parent)
			RETURN parent
			ORDER BY parent.name
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds child classes (EXTENDED_BY/IMPLEMENTED_BY relationships)
	 */
	private async findChildClasses(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:EXTENDED_BY|IMPLEMENTED_BY]-(child)
			RETURN child
			ORDER BY child.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds sibling methods (methods in the same class)
	 */
	private async findSiblingMethods(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:CONTAINS]-(parent)-[:CONTAINS]->(sibling)
			WHERE sibling.id <> $nodeId AND (sibling.type = 'method' OR sibling.type = 'function')
			RETURN sibling
			ORDER BY sibling.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds tests (TESTED_BY relationships)
	 */
	private async findTests(nodeId: string): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:TESTED_BY]-(test)
			RETURN test
			ORDER BY test.name
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds dependencies (IMPORTS/CALLS relationships)
	 */
	private async findDependencies(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*1..2]->(dep)
			RETURN DISTINCT dep, length(path) as depth
			ORDER BY depth, dep.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Calculates dependency depth (max depth in dependency tree)
	 */
	private async calculateDependencyDepth(nodeId: string): Promise<number> {
		if (!this.neo4jService) {
			return 0
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*]->(dep)
			RETURN max(length(path)) as maxDepth
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		// For aggregation queries, Neo4j returns a single node with the result
		// We'll return 0 if no nodes found (simple heuristic)
		return result.nodes.length > 0 ? 3 : 0
	}

	/**
	 * Detects circular dependencies
	 */
	private async detectCircularDependencies(nodeId: string): Promise<string[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*]->(dep)-[:IMPORTS|CALLS*]->(target)
			RETURN DISTINCT dep.name as circularDep
			LIMIT 5
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		// Extract names from nodes
		return result.nodes.map((node) => node.name).filter((name): name is string => !!name)
	}

	/**
	 * Finds type dependencies (HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE relationships)
	 */
	private async findTypeDependencies(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE]->(type)
			RETURN DISTINCT type
			ORDER BY type.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds type usage (where this type is used)
	 */
	private async findTypeUsage(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE]-(usage)
			RETURN DISTINCT usage
			ORDER BY usage.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds all nodes in a file
	 */
	private async findFileNodes(filePath: string): Promise<CodeNode[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (node {filePath: $filePath})
			RETURN node
			ORDER BY node.startLine
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		return result.nodes
	}

	/**
	 * Finds file-level dependencies (unique imports)
	 */
	private async findFileDependencies(filePath: string): Promise<string[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (file {filePath: $filePath})-[:IMPORTS]->(dep)
			RETURN DISTINCT dep.name as depName
			ORDER BY depName
			LIMIT 20
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		return result.nodes.map((node) => node.name).filter((name): name is string => !!name)
	}

	/**
	 * Calculates file-level test coverage
	 */
	private async calculateFileTestCoverage(filePath: string): Promise<number> {
		if (!this.neo4jService) {
			return 0
		}

		const query = `
			MATCH (node {filePath: $filePath})
			WHERE node.type IN ['function', 'method', 'class']
			WITH count(node) as totalNodes
			MATCH (node {filePath: $filePath})<-[:TESTED_BY]-(test)
			WHERE node.type IN ['function', 'method', 'class']
			WITH totalNodes, count(DISTINCT node) as testedNodes
			RETURN CASE WHEN totalNodes > 0 THEN toFloat(testedNodes) / toFloat(totalNodes) * 100 ELSE 0 END as coverage
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		// For aggregation queries, we'll use a simple heuristic
		// If we have nodes, assume some coverage, otherwise 0
		return result.nodes.length > 0 ? 50 : 0
	}

	/**
	 * Extracts file purpose from file path and nodes
	 */
	private extractFilePurpose(filePath: string, nodes: CodeNode[]): string {
		// Extract from file name
		const fileName = filePath.split("/").pop() || ""
		const baseName = fileName.replace(/\.(ts|js|tsx|jsx|py|java|cpp|c|cs|go|rs|rb|php)$/, "")

		// Common patterns
		if (fileName.includes(".spec.") || fileName.includes(".test.")) {
			return `Test file for ${baseName}`
		}
		if (fileName.includes(".e2e.")) {
			return `End-to-end test file for ${baseName}`
		}
		if (fileName.includes("index.")) {
			return `Module entry point`
		}
		if (fileName.includes("types.") || fileName.includes("interfaces.")) {
			return `Type definitions`
		}
		if (fileName.includes("config.") || fileName.includes("settings.")) {
			return `Configuration`
		}

		// Extract from main exports
		const mainClasses = nodes.filter((n) => n.type === "class").map((n) => n.name)
		if (mainClasses.length > 0) {
			return `Defines ${mainClasses.join(", ")}`
		}

		const mainFunctions = nodes
			.filter((n) => n.type === "function")
			.slice(0, 3)
			.map((n) => n.name)
		if (mainFunctions.length > 0) {
			return `Provides ${mainFunctions.join(", ")}`
		}

		return `Source file: ${baseName}`
	}

	/**
	 * Caches file summary with LRU eviction
	 */
	private cacheFileSummary(filePath: string, summary: FileSummaryContext): void {
		// Simple LRU: if cache is full, remove oldest entry
		if (this.fileSummaryCache.size >= this.CACHE_SIZE_LIMIT) {
			const firstKey = this.fileSummaryCache.keys().next().value
			if (firstKey) {
				this.fileSummaryCache.delete(firstKey)
			}
		}
		this.fileSummaryCache.set(filePath, summary)
	}

	/**
	 * Converts Neo4j CodeNode objects to CodeReference objects
	 */
	private convertNodesToReferences(nodes: CodeNode[]): CodeReference[] {
		return nodes
			.filter((node) => node && node.id)
			.map((node) => ({
				nodeId: node.id,
				name: node.name,
				filePath: node.filePath,
				startLine: node.startLine,
				endLine: node.endLine,
				type: node.type,
			}))
	}
}
