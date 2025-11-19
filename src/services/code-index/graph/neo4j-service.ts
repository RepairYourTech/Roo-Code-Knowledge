import neo4j, { Driver, Session, Integer } from "neo4j-driver"
import { INeo4jService, Neo4jConfig, CodeNode, CodeRelationship, GraphQueryResult } from "../interfaces/neo4j-service"

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
