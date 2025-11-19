import BM25 from "okapibm25"
import { IBM25Index, BM25Document, BM25SearchResult, BM25IndexStats } from "../interfaces/bm25-index"

/**
 * Tokenizes code text for BM25 indexing
 * Splits on whitespace, punctuation, and common code delimiters
 */
function tokenizeCode(text: string): string[] {
	return (
		text
			// Split on whitespace and common code punctuation
			.split(/[\s\(\)\{\}\[\];,\.\:\<\>\=\+\-\*\/\&\|\!\?\@\#\$\%\^\~\`\"\'\\]+/)
			// Filter out empty tokens
			.filter((token) => token.length > 0)
			// Convert to lowercase for case-insensitive matching
			.map((token) => token.toLowerCase())
	)
}

/**
 * Joins tokens back into a string for BM25 (which expects string documents)
 */
function tokensToString(tokens: string[]): string {
	return tokens.join(" ")
}

/**
 * BM25 keyword search index implementation using okapibm25
 */
export class BM25IndexService implements IBM25Index {
	private documents: Map<string, BM25Document> = new Map()
	private documentTexts: string[] = []
	private documentIds: string[] = []

	// BM25 parameters (can be tuned)
	private readonly k1 = 1.2 // Term frequency saturation parameter (typical range: 1.2-2.0)
	private readonly b = 0.75 // Length normalization parameter (typical range: 0.5-0.8)

	constructor() {}

	/**
	 * Adds a single document to the index
	 */
	addDocument(document: BM25Document): void {
		// Store the document
		this.documents.set(document.id, document)

		// Tokenize and store as string for BM25
		const tokens = tokenizeCode(document.text)
		const tokenizedText = tokensToString(tokens)

		// Add to our parallel arrays for BM25
		this.documentIds.push(document.id)
		this.documentTexts.push(tokenizedText)
	}

	/**
	 * Adds multiple documents to the index
	 */
	addDocuments(documents: BM25Document[]): void {
		for (const doc of documents) {
			this.addDocument(doc)
		}
	}

	/**
	 * Searches the index using BM25 algorithm
	 */
	search(query: string, limit: number = 20): BM25SearchResult[] {
		if (this.isEmpty()) {
			return []
		}

		// Tokenize the query and convert to string
		const queryTerms = tokenizeCode(query)

		if (queryTerms.length === 0) {
			return []
		}

		// Run BM25 search - it expects query as array of keywords
		const scores = BM25(this.documentTexts, queryTerms, {
			k1: this.k1,
			b: this.b,
		}) as number[]

		// Combine scores with document IDs and sort
		const results: BM25SearchResult[] = scores
			.map((score, index) => ({
				id: this.documentIds[index],
				score,
				document: this.documentTexts[index],
			}))
			// Filter out zero scores
			.filter((result) => result.score > 0)
			// Sort by score descending
			.sort((a, b) => b.score - a.score)
			// Limit results
			.slice(0, limit)

		return results
	}

	/**
	 * Removes a document by ID
	 */
	removeDocument(id: string): void {
		const index = this.documentIds.indexOf(id)
		if (index !== -1) {
			this.documentIds.splice(index, 1)
			this.documentTexts.splice(index, 1)
			this.documents.delete(id)
		}
	}

	/**
	 * Removes all documents for a given file path
	 */
	removeDocumentsByFilePath(filePath: string): void {
		const idsToRemove: string[] = []

		// Find all document IDs for this file path
		for (const [id, doc] of this.documents.entries()) {
			if (doc.filePath === filePath) {
				idsToRemove.push(id)
			}
		}

		// Remove each document
		for (const id of idsToRemove) {
			this.removeDocument(id)
		}
	}

	/**
	 * Clears the entire index
	 */
	clear(): void {
		this.documents.clear()
		this.documentIds = []
		this.documentTexts = []
	}

	/**
	 * Gets index statistics
	 */
	getStats(): BM25IndexStats {
		const totalLength = this.documentTexts.reduce((sum, text) => sum + tokenizeCode(text).length, 0)

		// Count unique terms
		const uniqueTerms = new Set<string>()
		for (const text of this.documentTexts) {
			const tokens = tokenizeCode(text)
			tokens.forEach((token) => uniqueTerms.add(token))
		}

		return {
			documentCount: this.documents.size,
			termCount: uniqueTerms.size,
			avgDocLength: this.documents.size > 0 ? totalLength / this.documents.size : 0,
		}
	}

	/**
	 * Checks if index is empty
	 */
	isEmpty(): boolean {
		return this.documents.size === 0
	}
}
