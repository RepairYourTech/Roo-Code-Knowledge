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
	metadata?: Record<string, unknown>
}

/**
 * Result from a graph query
 */
export interface GraphQueryResult {
	nodes: CodeNode[]
	relationships: CodeRelationship[]
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
	 * Add or update a code node in the graph
	 */
	upsertNode(node: CodeNode): Promise<void>

	/**
	 * Add or update multiple code nodes in the graph
	 */
	upsertNodes(nodes: CodeNode[]): Promise<void>

	/**
	 * Create a relationship between two nodes
	 */
	createRelationship(relationship: CodeRelationship): Promise<void>

	/**
	 * Create multiple relationships
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
	 */
	executeQuery(cypher: string, parameters?: Record<string, unknown>): Promise<GraphQueryResult>

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
	 */
	findImpactedNodes(nodeId: string, maxDepth?: number): Promise<ImpactAnalysisResult>

	/**
	 * Phase 11: Find all dependencies of a symbol
	 * Traverses CALLS, EXTENDS, IMPLEMENTS, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS relationships
	 */
	findDependencyTree(nodeId: string, maxDepth?: number): Promise<DependencyAnalysisResult>

	/**
	 * Phase 11: Calculate blast radius of changing a symbol
	 * Combines impact analysis, dependency analysis, and test coverage
	 */
	calculateBlastRadius(nodeId: string, maxDepth?: number): Promise<BlastRadiusResult>

	/**
	 * Phase 11: Assess whether it's safe to change a symbol
	 * Combines blast radius with test coverage to provide safety assessment
	 */
	assessChangeSafety(nodeId: string): Promise<ChangeSafetyResult>
}
