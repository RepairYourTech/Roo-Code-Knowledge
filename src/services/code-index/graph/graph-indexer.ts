import { CodeBlock } from "../interfaces/file-processor"
import { CodeNode, CodeRelationship, INeo4jService } from "../interfaces/neo4j-service"
import { IGraphIndexer, GraphIndexResult } from "../interfaces/graph-indexer"

/**
 * Graph indexer implementation
 * Extracts code relationships from parsed code blocks and indexes them into Neo4j
 */
export class GraphIndexer implements IGraphIndexer {
	constructor(private neo4jService: INeo4jService) {}

	/**
	 * Index a single code block into the graph database
	 */
	async indexBlock(block: CodeBlock): Promise<GraphIndexResult> {
		return this.indexBlocks([block])
	}

	/**
	 * Index multiple code blocks into the graph database (batch operation)
	 */
	async indexBlocks(blocks: CodeBlock[]): Promise<GraphIndexResult> {
		if (blocks.length === 0) {
			return {
				nodesCreated: 0,
				relationshipsCreated: 0,
				filePath: "",
				errors: [],
			}
		}

		const filePath = blocks[0].file_path
		const errors: string[] = []
		let nodesCreated = 0
		let relationshipsCreated = 0

		try {
			// Extract all nodes from all blocks
			const allNodes: CodeNode[] = []
			for (const block of blocks) {
				const nodes = this.extractNodes(block)
				allNodes.push(...nodes)
			}

			// Create nodes in batch
			if (allNodes.length > 0) {
				await this.neo4jService.upsertNodes(allNodes)
				nodesCreated = allNodes.length
			}

			// Extract all relationships from all blocks
			const allRelationships: CodeRelationship[] = []
			for (const block of blocks) {
				const relationships = this.extractRelationships(block, blocks)
				allRelationships.push(...relationships)
			}

			// Create relationships in batch
			if (allRelationships.length > 0) {
				await this.neo4jService.createRelationships(allRelationships)
				relationshipsCreated = allRelationships.length
			}

			// TODO: Add telemetry events when they are defined in @roo-code/types
			// TelemetryService.instance?.captureEvent(TelemetryEventName.CodeIndexGraphIndexed, {
			// 	filePath,
			// 	nodesCreated,
			// 	relationshipsCreated,
			// })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			errors.push(errorMessage)

			// TODO: Add telemetry events when they are defined in @roo-code/types
			// TelemetryService.instance?.captureEvent(TelemetryEventName.CodeIndexGraphIndexError, {
			// 	filePath,
			// 	error: errorMessage,
			// })
		}

		return {
			nodesCreated,
			relationshipsCreated,
			filePath,
			errors: errors.length > 0 ? errors : undefined,
		}
	}

	/**
	 * Index an entire file into the graph database
	 */
	async indexFile(filePath: string, blocks: CodeBlock[]): Promise<GraphIndexResult> {
		// First, remove any existing data for this file
		await this.removeFile(filePath)

		// Create a file node
		const fileNode: CodeNode = {
			id: `file:${filePath}`,
			type: "file",
			name: filePath.split("/").pop() || filePath,
			filePath,
			startLine: 1,
			endLine: blocks.length > 0 ? Math.max(...blocks.map((b) => b.end_line)) : 1,
		}

		await this.neo4jService.upsertNode(fileNode)

		// Index all blocks
		const result = await this.indexBlocks(blocks)

		// Create CONTAINS relationships from file to all top-level nodes
		const containsRelationships: CodeRelationship[] = blocks.map((block) => ({
			fromId: fileNode.id,
			toId: this.generateNodeId(block),
			type: "CONTAINS",
		}))

		if (containsRelationships.length > 0) {
			await this.neo4jService.createRelationships(containsRelationships)
		}

		return {
			...result,
			nodesCreated: result.nodesCreated + 1, // +1 for file node
			relationshipsCreated: result.relationshipsCreated + containsRelationships.length,
		}
	}

	/**
	 * Remove all nodes and relationships for a file
	 */
	async removeFile(filePath: string): Promise<void> {
		await this.neo4jService.deleteNodesByFilePath(filePath)
	}

	/**
	 * Extract code nodes from a code block
	 */
	extractNodes(block: CodeBlock): CodeNode[] {
		const nodes: CodeNode[] = []

		// Determine node type from block type
		const nodeType = this.mapBlockTypeToNodeType(block.type)
		if (!nodeType) {
			return nodes
		}

		// Create primary node for this block
		const node: CodeNode = {
			id: this.generateNodeId(block),
			type: nodeType,
			name: block.identifier || "anonymous",
			filePath: block.file_path,
			startLine: block.start_line,
			endLine: block.end_line,
			language: this.detectLanguage(block.file_path),
		}

		nodes.push(node)

		// If block has symbol metadata, we could extract additional nodes
		// (e.g., parameters, return types, etc.) but for now we keep it simple

		return nodes
	}

	/**
	 * Map CodeBlock type to Neo4j node type
	 */
	private mapBlockTypeToNodeType(
		blockType: string | null,
	): "function" | "class" | "method" | "interface" | "variable" | "import" | null {
		if (!blockType) return null

		const type = blockType.toLowerCase()

		// Map common tree-sitter node types to our node types
		if (type.includes("function") || type.includes("func")) {
			return "function"
		}
		if (type.includes("class")) {
			return "class"
		}
		if (type.includes("method")) {
			return "method"
		}
		if (type.includes("interface") || type.includes("trait")) {
			return "interface"
		}
		if (type.includes("variable") || type.includes("const") || type.includes("let")) {
			return "variable"
		}
		if (type.includes("import")) {
			return "import"
		}

		// Default to function for other definition types
		if (type.includes("definition")) {
			return "function"
		}

		return null
	}

	/**
	 * Detect programming language from file path
	 */
	private detectLanguage(filePath: string): string {
		const ext = filePath.split(".").pop()?.toLowerCase() || ""

		const languageMap: Record<string, string> = {
			ts: "TypeScript",
			tsx: "TypeScript",
			js: "JavaScript",
			jsx: "JavaScript",
			py: "Python",
			rs: "Rust",
			go: "Go",
			java: "Java",
			cpp: "C++",
			hpp: "C++",
			c: "C",
			h: "C",
			cs: "C#",
			rb: "Ruby",
			php: "PHP",
			swift: "Swift",
			kt: "Kotlin",
			scala: "Scala",
			lua: "Lua",
			sol: "Solidity",
		}

		return languageMap[ext] || ext
	}

	/**
	 * Extract code relationships from a code block
	 */
	extractRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
		const relationships: CodeRelationship[] = []
		const fromId = this.generateNodeId(block)

		// Extract IMPORTS relationships from import metadata
		if (block.imports && block.imports.length > 0) {
			for (const importInfo of block.imports) {
				// Create a relationship to the imported module
				// Note: We create a simplified import node ID based on the source
				const importNodeId = `import:${block.file_path}:${importInfo.source}`

				relationships.push({
					fromId,
					toId: importNodeId,
					type: "IMPORTS",
					metadata: {
						source: importInfo.source,
						symbols: importInfo.symbols,
						isDefault: importInfo.isDefault,
					},
				})
			}
		}

		// Extract EXTENDS relationships from symbol metadata
		if (block.symbolMetadata) {
			const metadata = block.symbolMetadata

			// For classes that extend other classes
			// Note: This would require parsing the class declaration to find the extends clause
			// For now, we'll leave this as a placeholder for future enhancement
		}

		// Extract IMPLEMENTS relationships from symbol metadata
		// Note: This would require parsing interface implementations
		// For now, we'll leave this as a placeholder for future enhancement

		// Extract CALLS relationships by analyzing the code content
		// This is complex and would require parsing function calls in the code
		// For now, we'll leave this as a placeholder for future enhancement

		// Extract DEFINES relationships for nested definitions
		// If this block contains other blocks (e.g., a class contains methods)
		const nestedBlocks = allBlocks.filter(
			(b) =>
				b.file_path === block.file_path &&
				b.start_line >= block.start_line &&
				b.end_line <= block.end_line &&
				b !== block,
		)

		for (const nested of nestedBlocks) {
			relationships.push({
				fromId,
				toId: this.generateNodeId(nested),
				type: "DEFINES",
			})
		}

		return relationships
	}

	/**
	 * Clear all graph data
	 */
	async clearAll(): Promise<void> {
		await this.neo4jService.clearAll()
	}

	/**
	 * Generate a unique node ID for a code block
	 */
	private generateNodeId(block: CodeBlock): string {
		return `${block.type}:${block.file_path}:${block.start_line}`
	}
}
