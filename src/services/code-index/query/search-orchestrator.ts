/**
 * Unified Search Orchestrator
 * Routes queries to appropriate search backends based on query analysis
 */

import { QueryAnalyzer, QueryAnalysis, SearchBackend } from "./query-analyzer"
import { HybridSearchService, HybridSearchResult, HybridSearchConfig } from "../hybrid-search-service"
import { INeo4jService, CodeNode } from "../interfaces/neo4j-service"
import { ILSPService } from "../interfaces/lsp-service"
import { VectorStoreSearchResult } from "../interfaces/vector-store"

/**
 * Options for search orchestration
 */
export interface SearchOrchestrationOptions {
	/** Directory prefix to filter results */
	directoryPrefix?: string
	/** Maximum number of results to return */
	maxResults?: number
	/** Minimum score threshold */
	minScore?: number
	/** Override automatic backend selection */
	forceBackends?: SearchBackend[]
	/** Override automatic weight calculation */
	forceWeights?: {
		vector?: number
		bm25?: number
		graph?: number
		lsp?: number
	}
}

/**
 * Result from orchestrated search with metadata
 */
export interface OrchestrationResult extends HybridSearchResult {
	/** Query analysis that determined the search strategy */
	queryAnalysis?: QueryAnalysis
	/** Which backends were used for this result */
	usedBackends?: SearchBackend[]
}

/**
 * Orchestrates search across multiple backends based on query intent
 */
export class SearchOrchestrator {
	private readonly queryAnalyzer: QueryAnalyzer

	constructor(
		private readonly hybridSearchService: HybridSearchService,
		private readonly neo4jService?: INeo4jService,
		private readonly lspService?: ILSPService,
	) {
		this.queryAnalyzer = new QueryAnalyzer()
	}

	/**
	 * Performs intelligent search routing based on query analysis
	 */
	public async search(query: string, options?: SearchOrchestrationOptions): Promise<OrchestrationResult[]> {
		// 1. Analyze query to determine intent and strategy
		const analysis = this.queryAnalyzer.analyze(query)

		// 2. Override backends/weights if specified in options
		const backends = options?.forceBackends ?? analysis.backends
		const weights = options?.forceWeights
			? {
					vector: options.forceWeights.vector ?? analysis.weights.vector,
					bm25: options.forceWeights.bm25 ?? analysis.weights.bm25,
					graph: options.forceWeights.graph ?? analysis.weights.graph,
					lsp: options.forceWeights.lsp ?? analysis.weights.lsp,
				}
			: analysis.weights

		// Create modified analysis with overridden weights
		const effectiveAnalysis: QueryAnalysis = {
			...analysis,
			weights,
		}

		// 3. Route to appropriate backends
		const results = await this.routeQuery(query, effectiveAnalysis, backends, options)

		// 4. Apply query-specific enhancements
		const enhancedResults = this.applyQueryEnhancements(results, effectiveAnalysis)

		// 5. Add orchestration metadata
		return enhancedResults.map((result) => ({
			...result,
			queryAnalysis: effectiveAnalysis,
			usedBackends: backends,
		}))
	}

	/**
	 * Routes query to appropriate search backends
	 */
	private async routeQuery(
		query: string,
		analysis: QueryAnalysis,
		backends: SearchBackend[],
		options?: SearchOrchestrationOptions,
	): Promise<HybridSearchResult[]> {
		// Determine if we need graph or LSP-specific queries
		const needsGraphQuery = backends.includes("graph") && this.neo4jService
		const needsLSPQuery = backends.includes("lsp") && this.lspService

		// If we only need vector + BM25, use hybrid search directly
		if (!needsGraphQuery && !needsLSPQuery) {
			return this.performHybridSearch(query, analysis, options)
		}

		// For graph/LSP queries, we need to combine results from multiple sources
		const promises: Promise<HybridSearchResult[]>[] = []

		// Always include hybrid search (vector + BM25)
		if (backends.includes("vector") || backends.includes("bm25")) {
			promises.push(this.performHybridSearch(query, analysis, options))
		}

		// Add graph search if needed
		if (needsGraphQuery) {
			promises.push(this.performGraphSearch(query, analysis, options))
		}

		// Add LSP search if needed
		if (needsLSPQuery) {
			promises.push(this.performLSPSearch(query, analysis, options))
		}

		// Execute all searches in parallel
		const allResults = await Promise.all(promises)

		// Merge results from all backends
		return this.mergeMultiBackendResults(allResults.flat(), analysis)
	}

	/**
	 * Performs hybrid search (vector + BM25)
	 */
	private async performHybridSearch(
		query: string,
		analysis: QueryAnalysis,
		options?: SearchOrchestrationOptions,
	): Promise<HybridSearchResult[]> {
		// Build hybrid search config from analysis weights
		const config: HybridSearchConfig = {
			vectorWeight: analysis.weights.vector / (analysis.weights.vector + analysis.weights.bm25) || 0.7,
			bm25Weight: analysis.weights.bm25 / (analysis.weights.vector + analysis.weights.bm25) || 0.3,
			fusionStrategy: "weighted",
		}

		// Apply test file filtering if needed
		let directoryPrefix = options?.directoryPrefix
		if (analysis.testFilesOnly && !directoryPrefix) {
			// This is a hint - actual filtering happens in the search service
			// We could enhance this by adding a filter parameter to hybrid search
		}

		return this.hybridSearchService.searchIndex(query, directoryPrefix, config)
	}

	/**
	 * Performs graph-based search using Neo4j
	 */
	private async performGraphSearch(
		query: string,
		analysis: QueryAnalysis,
		options?: SearchOrchestrationOptions,
	): Promise<HybridSearchResult[]> {
		if (!this.neo4jService) {
			return []
		}

		// Graph queries are intent-specific
		let nodes: CodeNode[] = []

		switch (analysis.intent) {
			case "find_callers":
				// Find who calls the symbol
				if (analysis.symbolName) {
					nodes = await this.neo4jService.findCallers(analysis.symbolName)
				}
				break

			case "find_callees":
				// Find what the symbol calls
				if (analysis.symbolName) {
					nodes = await this.neo4jService.findCallees(analysis.symbolName)
				}
				break

			case "find_dependencies":
				// Find what the file/module imports
				if (analysis.symbolName) {
					nodes = await this.neo4jService.findDependencies(analysis.symbolName)
				}
				break

			case "find_dependents":
				// Find what imports the file/module
				if (analysis.symbolName) {
					nodes = await this.neo4jService.findDependents(analysis.symbolName)
				}
				break

			default:
				// For other intents, graph search is not applicable
				return []
		}

		// Convert Neo4j nodes to search results
		return this.convertNodesToResults(nodes)
	}

	/**
	 * Performs LSP-based search
	 */
	private async performLSPSearch(
		query: string,
		analysis: QueryAnalysis,
		options?: SearchOrchestrationOptions,
	): Promise<HybridSearchResult[]> {
		if (!this.lspService) {
			return []
		}

		// LSP search is primarily for type-based queries
		// This is a placeholder - actual implementation would require
		// workspace-wide LSP queries which are not directly supported
		// Instead, we rely on LSP type info already embedded in vector store payloads
		return []
	}

	/**
	 * Merges results from multiple backends
	 */
	private mergeMultiBackendResults(results: HybridSearchResult[], analysis: QueryAnalysis): HybridSearchResult[] {
		// Create a map to deduplicate by ID
		const resultMap = new Map<string, HybridSearchResult>()

		for (const result of results) {
			const id = String(result.id)
			const existing = resultMap.get(id)

			if (!existing) {
				resultMap.set(id, result)
			} else {
				// If we have duplicate results from different backends, keep the one with higher score
				if (result.score > existing.score) {
					resultMap.set(id, result)
				}
			}
		}

		// Sort by score descending
		return Array.from(resultMap.values()).sort((a, b) => b.score - a.score)
	}

	/**
	 * Applies query-specific enhancements to results
	 */
	private applyQueryEnhancements(results: HybridSearchResult[], analysis: QueryAnalysis): HybridSearchResult[] {
		let enhanced = [...results]

		// Boost exported symbols for implementation queries
		if (analysis.boostExported) {
			enhanced = enhanced.map((result) => {
				const isExported = result.payload?.exports && result.payload.exports.length > 0
				if (isExported) {
					return {
						...result,
						score: result.score * 1.15, // 15% boost for exported symbols
						hybridScore: result.hybridScore * 1.15,
					}
				}
				return result
			})
		}

		// Filter to test files only if requested
		if (analysis.testFilesOnly) {
			enhanced = enhanced.filter((result) => {
				const filePath = result.payload?.filePath || ""
				return (
					filePath.includes(".test.") ||
					filePath.includes(".spec.") ||
					filePath.includes("__tests__") ||
					filePath.includes("/test/") ||
					filePath.includes("/tests/")
				)
			})
		}

		// Re-sort after enhancements
		return enhanced.sort((a, b) => b.score - a.score)
	}

	/**
	 * Converts Neo4j CodeNode results to HybridSearchResult format
	 */
	private convertNodesToResults(nodes: CodeNode[]): HybridSearchResult[] {
		return nodes.map((node, index) => ({
			id: node.id,
			score: 1.0 - index * 0.05, // Decreasing score based on order
			payload: {
				filePath: node.filePath,
				codeChunk: "", // Graph results don't have code chunks
				startLine: node.startLine,
				endLine: node.endLine,
				identifier: node.name,
				type: node.type,
				language: node.language,
			},
			hybridScore: 1.0 - index * 0.05,
			vectorScore: 0,
			bm25Score: 0,
		}))
	}
}
