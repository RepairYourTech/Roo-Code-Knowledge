import { CodeBlock } from "./file-processor"
import { CodeNode, CodeRelationship } from "./neo4j-service"

/**
 * Result of indexing a file into the graph database
 */
export interface GraphIndexResult {
	/** Number of nodes created during indexing */
	nodesCreated: number

	/** Number of relationships created during indexing */
	relationshipsCreated: number

	/** File path that was indexed */
	filePath: string
	// Note: errors are now thrown via exceptions instead of being returned in this result object
}

/**
 * Interface for the graph indexer service
 * Extracts code relationships from parsed code blocks and indexes them into Neo4j
 */
export interface IGraphIndexer {
	/**
	 * Index a single code block into the graph database
	 * @param block The code block to index
	 * @returns Promise resolving to the index result
	 */
	indexBlock(block: CodeBlock): Promise<GraphIndexResult>

	/**
	 * Index multiple code blocks into the graph database (batch operation)
	 * @param blocks The code blocks to index
	 * @returns Promise resolving to the combined index result
	 */
	indexBlocks(blocks: CodeBlock[]): Promise<GraphIndexResult>

	/**
	 * Index an entire file into the graph database
	 * Creates file node and all contained code blocks
	 * @param filePath The file path
	 * @param blocks All code blocks from the file
	 * @returns Promise resolving to the index result
	 */
	indexFile(filePath: string, blocks: CodeBlock[]): Promise<GraphIndexResult>

	/**
	 * Remove all nodes and relationships for a file
	 * @param filePath The file path to remove
	 * @returns Promise resolving when deletion is complete
	 */
	removeFile(filePath: string): Promise<void>

	/**
	 * Extract code nodes from a code block
	 * @param block The code block to extract nodes from
	 * @returns Array of code nodes
	 */
	extractNodes(block: CodeBlock): CodeNode[]

	/**
	 * Extract code relationships from a code block
	 * @param block The code block to extract relationships from
	 * @param allBlocks All blocks in the file (for resolving references)
	 * @returns Array of code relationships
	 */
	extractRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[]

	/**
	 * Clear all graph data
	 * @returns Promise resolving when clear is complete
	 */
	clearAll(): Promise<void>
}
