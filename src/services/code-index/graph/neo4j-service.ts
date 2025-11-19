import neo4j, { Driver, Session, Integer } from "neo4j-driver"
import {
	INeo4jService,
	Neo4jConfig,
	CodeNode,
	CodeRelationship,
	GraphQueryResult,
	ImpactAnalysisResult,
	DependencyAnalysisResult,
	BlastRadiusResult,
	ChangeSafetyResult,
	DependencyChain,
} from "../interfaces/neo4j-service"

/**
 * Neo4j implementation of the graph database service
 */
export class Neo4jService implements INeo4jService {
	private driver: Driver | null = null
	private config: Neo4jConfig
	private connected: boolean = false

	constructor(config: Neo4jConfig) {
		this.config = config
	}

	/**
	 * Initialize the Neo4j connection and create indexes
	 */
	public async initialize(): Promise<void> {
		if (!this.config.enabled) {
			return // Neo4j is disabled, skip initialization
		}

		try {
			// Create driver
			this.driver = neo4j.driver(this.config.url, neo4j.auth.basic(this.config.username, this.config.password), {
				maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
				maxConnectionPoolSize: 50,
				connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
			})

			// Verify connectivity
			await this.driver.verifyConnectivity()

			// Create indexes for better performance
			await this.createIndexes()

			this.connected = true
		} catch (error) {
			this.connected = false
			throw new Error(`Failed to initialize Neo4j: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Create indexes for better query performance
	 */
	private async createIndexes(): Promise<void> {
		const session = this.getSession()
		try {
			// Create index on CodeNode.id for fast lookups
			await session.run("CREATE INDEX code_node_id IF NOT EXISTS FOR (n:CodeNode) ON (n.id)")

			// Create index on CodeNode.filePath for file-based queries
			await session.run("CREATE INDEX code_node_file_path IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath)")

			// Create index on CodeNode.type for type-based queries
			await session.run("CREATE INDEX code_node_type IF NOT EXISTS FOR (n:CodeNode) ON (n.type)")

			// Create index on CodeNode.name for name-based searches
			await session.run("CREATE INDEX code_node_name IF NOT EXISTS FOR (n:CodeNode) ON (n.name)")
		} finally {
			await session.close()
		}
	}

	/**
	 * Get a new session
	 */
	private getSession(): Session {
		if (!this.driver) {
			throw new Error("Neo4j driver not initialized")
		}
		return this.driver.session({ database: this.config.database })
	}

	/**
	 * Check if the service is connected and ready
	 */
	public isConnected(): boolean {
		return this.connected && this.driver !== null
	}

	/**
	 * Add or update a code node in the graph
	 */
	public async upsertNode(node: CodeNode): Promise<void> {
		if (!this.isConnected()) return

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Add or update multiple code nodes in the graph
	 */
	public async upsertNodes(nodes: CodeNode[]): Promise<void> {
		if (!this.isConnected() || nodes.length === 0) return

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Create a relationship between two nodes
	 */
	public async createRelationship(relationship: CodeRelationship): Promise<void> {
		if (!this.isConnected()) return

		const session = this.getSession()
		try {
			await session.run(
				`
				MATCH (from:CodeNode {id: $fromId})
				MATCH (to:CodeNode {id: $toId})
				MERGE (from)-[r:${relationship.type}]->(to)
				SET r.metadata = $metadata
				`,
				{
					fromId: relationship.fromId,
					toId: relationship.toId,
					metadata: relationship.metadata || {},
				},
			)
		} finally {
			await session.close()
		}
	}

	/**
	 * Create multiple relationships
	 */
	public async createRelationships(relationships: CodeRelationship[]): Promise<void> {
		if (!this.isConnected() || relationships.length === 0) return

		// Group relationships by type for efficient batch processing
		const relationshipsByType = new Map<string, CodeRelationship[]>()
		for (const rel of relationships) {
			const existing = relationshipsByType.get(rel.type) || []
			existing.push(rel)
			relationshipsByType.set(rel.type, existing)
		}

		const session = this.getSession()
		try {
			// Process each relationship type in batch
			for (const [type, rels] of relationshipsByType.entries()) {
				await session.run(
					`
					UNWIND $relationships AS rel
					MATCH (from:CodeNode {id: rel.fromId})
					MATCH (to:CodeNode {id: rel.toId})
					MERGE (from)-[r:${type}]->(to)
					SET r.metadata = rel.metadata
					`,
					{
						relationships: rels.map((r) => ({
							fromId: r.fromId,
							toId: r.toId,
							metadata: r.metadata || {},
						})),
					},
				)
			}
		} finally {
			await session.close()
		}
	}

	/**
	 * Delete a node and all its relationships
	 */
	public async deleteNode(id: string): Promise<void> {
		if (!this.isConnected()) return

		const session = this.getSession()
		try {
			await session.run(
				`
				MATCH (n:CodeNode {id: $id})
				DETACH DELETE n
				`,
				{ id },
			)
		} finally {
			await session.close()
		}
	}

	/**
	 * Delete all nodes for a specific file path
	 */
	public async deleteNodesByFilePath(filePath: string): Promise<void> {
		if (!this.isConnected()) return

		const session = this.getSession()
		try {
			await session.run(
				`
				MATCH (n:CodeNode {filePath: $filePath})
				DETACH DELETE n
				`,
				{ filePath },
			)
		} finally {
			await session.close()
		}
	}

	/**
	 * Delete multiple nodes by file paths
	 */
	public async deleteNodesByMultipleFilePaths(filePaths: string[]): Promise<void> {
		if (!this.isConnected() || filePaths.length === 0) return

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all nodes that call a specific function/method
	 */
	public async findCallers(nodeId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all nodes that are called by a specific function/method
	 */
	public async findCallees(nodeId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all dependencies (imports) for a file
	 */
	public async findDependencies(filePath: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all files that depend on (import) a specific file
	 */
	public async findDependents(filePath: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all implementations of an interface
	 */
	public async findImplementations(interfaceId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Find all subclasses of a class
	 */
	public async findSubclasses(classId: string): Promise<CodeNode[]> {
		if (!this.isConnected()) return []

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Execute a custom Cypher query
	 */
	public async executeQuery(cypher: string, parameters?: Record<string, unknown>): Promise<GraphQueryResult> {
		if (!this.isConnected()) {
			return { nodes: [], relationships: [] }
		}

		const session = this.getSession()
		try {
			const result = await session.run(cypher, parameters || {})

			const nodes: CodeNode[] = []
			const relationships: CodeRelationship[] = []

			for (const record of result.records) {
				// Extract nodes and relationships from the result
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
			await session.close()
		}
	}

	/**
	 * Clear all data from the graph (for testing/reset)
	 */
	public async clearAll(): Promise<void> {
		if (!this.isConnected()) return

		const session = this.getSession()
		try {
			await session.run("MATCH (n:CodeNode) DETACH DELETE n")
		} finally {
			await session.close()
		}
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

		const session = this.getSession()
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
			await session.close()
		}
	}

	/**
	 * Phase 11: Find all nodes impacted by changing a symbol
	 * Traverses CALLED_BY, EXTENDED_BY, IMPLEMENTED_BY, TESTED_BY relationships
	 */
	public async findImpactedNodes(nodeId: string, maxDepth: number = 3): Promise<ImpactAnalysisResult> {
		if (!this.isConnected()) {
			return {
				impactedNodes: [],
				dependencyChains: [],
				blastRadius: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
				testCoverage: { hasTests: false, testNodes: [], coveragePercentage: 0 },
			}
		}

		const session = this.getSession()
		try {
			// Find all nodes impacted by changing nodeId (up to maxDepth levels)
			// Traverse CALLED_BY, EXTENDED_BY, IMPLEMENTED_BY relationships
			const impactResult = await session.run(
				`
				MATCH path = (impacted:CodeNode)-[:CALLED_BY|EXTENDED_BY|IMPLEMENTED_BY*1..${maxDepth}]->(target:CodeNode {id: $nodeId})
				WITH impacted, path, relationships(path) AS rels
				RETURN DISTINCT impacted,
					   [node IN nodes(path) | node] AS pathNodes,
					   [rel IN rels | type(rel)] AS relTypes,
					   length(path) AS depth
				ORDER BY depth ASC
				`,
				{ nodeId },
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
			const testNodes: CodeNode[] = testResult.records.map((record) => this.recordToCodeNode(record.get("test")))

			// Calculate test coverage percentage
			// If there are tests, coverage is 100%, otherwise 0%
			// In a more sophisticated implementation, this could be based on actual code coverage metrics
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
			await session.close()
		}
	}

	/**
	 * Phase 11: Find all dependencies of a symbol
	 * Traverses CALLS, EXTENDS, IMPLEMENTS, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS relationships
	 */
	public async findDependencyTree(nodeId: string, maxDepth: number = 3): Promise<DependencyAnalysisResult> {
		if (!this.isConnected()) {
			return {
				dependencies: [],
				dependencyChains: [],
				dependencyTree: { totalNodes: 0, totalFiles: 0, maxDepth: 0 },
			}
		}

		const session = this.getSession()
		try {
			// Find all dependencies of nodeId (up to maxDepth levels)
			// Traverse CALLS, EXTENDS, IMPLEMENTS, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS relationships
			const result = await session.run(
				`
				MATCH path = (source:CodeNode {id: $nodeId})-[:CALLS|EXTENDS|IMPLEMENTS|HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE|IMPORTS*1..${maxDepth}]->(dependency:CodeNode)
				WITH dependency, path, relationships(path) AS rels
				RETURN DISTINCT dependency,
					   [node IN nodes(path) | node] AS pathNodes,
					   [rel IN rels | type(rel)] AS relTypes,
					   length(path) AS depth
				ORDER BY depth ASC
				`,
				{ nodeId },
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
			await session.close()
		}
	}

	/**
	 * Phase 11: Calculate blast radius of changing a symbol
	 * Combines impact analysis, dependency analysis, and test coverage
	 */
	public async calculateBlastRadius(nodeId: string, maxDepth: number = 3): Promise<BlastRadiusResult> {
		if (!this.isConnected()) {
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

		const session = this.getSession()
		try {
			// Get the target node
			const targetResult = await session.run(
				`
				MATCH (target:CodeNode {id: $nodeId})
				RETURN target
				`,
				{ nodeId },
			)

			const targetNode =
				targetResult.records.length > 0 ? this.recordToCodeNode(targetResult.records[0].get("target")) : null

			// Get impact analysis and dependency analysis in parallel
			const [impactAnalysis, dependencyAnalysis] = await Promise.all([
				this.findImpactedNodes(nodeId, maxDepth),
				this.findDependencyTree(nodeId, maxDepth),
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

			return {
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
		} finally {
			await session.close()
		}
	}

	/**
	 * Phase 11: Assess whether it's safe to change a symbol
	 * Combines blast radius with test coverage to provide safety assessment
	 */
	public async assessChangeSafety(nodeId: string): Promise<ChangeSafetyResult> {
		if (!this.isConnected()) {
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
		const blastRadius = await this.calculateBlastRadius(nodeId, 3)

		if (!blastRadius.targetNode) {
			return {
				nodeId,
				nodeName: "Unknown",
				safetyLevel: "dangerous",
				riskScore: 100,
				reasons: ["Node not found in graph"],
				recommendations: ["Verify the node ID is correct"],
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
	 * Generate reasons for the safety assessment
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
				recommendations.push("Run existing tests to verify the change")
			}
		}

		if (safetyLevel === "moderate") {
			recommendations.push("Review impacted code before making changes")
			if (blastRadius.metrics.totalTests === 0) {
				recommendations.push("Consider adding tests before making changes")
			} else {
				recommendations.push("Run existing tests to verify the change")
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
	 * Close the Neo4j connection
	 */
	public async close(): Promise<void> {
		if (this.driver) {
			await this.driver.close()
			this.driver = null
			this.connected = false
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
}
