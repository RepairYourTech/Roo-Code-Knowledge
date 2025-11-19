/**
 * Interface for BM25 keyword search index
 */

export interface BM25SearchResult {
	/** Unique identifier for the document */
	id: string
	/** BM25 relevance score */
	score: number
	/** The original document text */
	document: string
}

export interface BM25Document {
	/** Unique identifier (typically segmentHash) */
	id: string
	/** The text content to index */
	text: string
	/** File path for the document */
	filePath: string
	/** Start line number */
	startLine: number
	/** End line number */
	endLine: number
	/** Optional metadata */
	metadata?: Record<string, any>
}

export interface BM25IndexStats {
	/** Total number of documents in the index */
	documentCount: number
	/** Total number of unique terms */
	termCount: number
	/** Average document length */
	avgDocLength: number
}

export interface IBM25Index {
	/**
	 * Adds a single document to the BM25 index
	 * @param document Document to add
	 */
	addDocument(document: BM25Document): void

	/**
	 * Adds multiple documents to the BM25 index
	 * @param documents Documents to add
	 */
	addDocuments(documents: BM25Document[]): void

	/**
	 * Searches the BM25 index for relevant documents
	 * @param query Search query string
	 * @param limit Maximum number of results to return
	 * @returns Array of search results sorted by relevance
	 */
	search(query: string, limit?: number): BM25SearchResult[]

	/**
	 * Removes a document from the index by ID
	 * @param id Document ID to remove
	 */
	removeDocument(id: string): void

	/**
	 * Removes all documents for a given file path
	 * @param filePath File path to remove documents for
	 */
	removeDocumentsByFilePath(filePath: string): void

	/**
	 * Clears the entire index
	 */
	clear(): void

	/**
	 * Gets statistics about the index
	 * @returns Index statistics
	 */
	getStats(): BM25IndexStats

	/**
	 * Checks if the index is empty
	 * @returns True if index has no documents
	 */
	isEmpty(): boolean
}
