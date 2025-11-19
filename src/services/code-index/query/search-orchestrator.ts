/**
 * Unified Search Orchestrator
 * Routes queries to appropriate search backends based on query analysis
 */

import { QueryAnalyzer, QueryAnalysis, SearchBackend } from "./query-analyzer"
import { HybridSearchService, HybridSearchResult, HybridSearchConfig } from "../hybrid-search-service"
import {
	INeo4jService,
	CodeNode,
	ImpactAnalysisResult,
	DependencyAnalysisResult,
	BlastRadiusResult,
	ChangeSafetyResult,
} from "../interfaces/neo4j-service"
import { ILSPService } from "../interfaces/lsp-service"
import { VectorStoreSearchResult } from "../interfaces/vector-store"
import { ContextEnrichmentService } from "../context/context-enrichment-service"
import { EnrichedSearchResult, ContextEnrichmentOptions } from "../interfaces/context-enrichment"
import { QualityMetricsService } from "../quality/quality-metrics-service"
import { QualityMetricsOptions, QualityEnrichedResult } from "../interfaces/quality-metrics"

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
	/** Phase 12: Context enrichment options */
	contextEnrichment?: ContextEnrichmentOptions
	/** Phase 13: Quality metrics options */
	qualityMetrics?: QualityMetricsOptions
}

/**
 * Result from orchestrated search with metadata
 * Phase 12: Now extends EnrichedSearchResult to include context enrichment
 * Phase 13: Now extends QualityEnrichedResult to include quality metrics
 */
export interface OrchestrationResult extends QualityEnrichedResult {
	/** Query analysis that determined the search strategy */
	queryAnalysis?: QueryAnalysis
	/** Which backends were used for this result */
	usedBackends?: SearchBackend[]
	/** Phase 12: Context enrichment fields */
	relatedCode?: any
	tests?: any
	dependencies?: any
	typeInfo?: any
	fileSummary?: any
}

/**
 * Orchestrates search across multiple backends based on query intent
 */
export class SearchOrchestrator {
	private readonly queryAnalyzer: QueryAnalyzer
	private readonly contextEnrichmentService: ContextEnrichmentService
	private readonly qualityMetricsService: QualityMetricsService

	constructor(
		private readonly hybridSearchService: HybridSearchService,
		private readonly neo4jService?: INeo4jService,
		private readonly lspService?: ILSPService,
	) {
		this.queryAnalyzer = new QueryAnalyzer()
		// Phase 12: Initialize context enrichment service
		this.contextEnrichmentService = new ContextEnrichmentService(neo4jService || null)
		// Phase 13: Initialize quality metrics service
		this.qualityMetricsService = new QualityMetricsService(neo4jService || null)
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

		// 5. Phase 12: Enrich results with contextual information
		const enrichedResults = await this.contextEnrichmentService.enrichSearchResults(
			enhancedResults,
			options?.contextEnrichment,
		)

		// 6. Phase 13: Enrich results with quality metrics
		const qualityEnrichedResults = await this.qualityMetricsService.enrichWithQualityMetrics(
			enrichedResults,
			options?.qualityMetrics,
		)

		// 7. Add orchestration metadata
		return qualityEnrichedResults.map((result) => ({
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

			case "impact_analysis":
				// Phase 11: Find all code impacted by changing this symbol
				if (analysis.symbolName) {
					const result = await this.neo4jService.findImpactedNodes(analysis.symbolName, 3)
					return this.convertImpactAnalysisToResults(result)
				}
				break

			case "dependency_analysis":
				// Phase 11: Find comprehensive dependency tree
				if (analysis.symbolName) {
					const result = await this.neo4jService.findDependencyTree(analysis.symbolName, 3)
					return this.convertDependencyAnalysisToResults(result)
				}
				break

			case "blast_radius":
				// Phase 11: Calculate blast radius of change
				if (analysis.symbolName) {
					const result = await this.neo4jService.calculateBlastRadius(analysis.symbolName, 3)
					return this.convertBlastRadiusToResults(result)
				}
				break

			case "change_safety":
				// Phase 11: Assess change safety
				if (analysis.symbolName) {
					const result = await this.neo4jService.assessChangeSafety(analysis.symbolName)
					return this.convertChangeSafetyToResults(result)
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

	/**
	 * Phase 11: Converts impact analysis result to search results
	 */
	private convertImpactAnalysisToResults(result: ImpactAnalysisResult): HybridSearchResult[] {
		const results: HybridSearchResult[] = []

		// Add impacted nodes as results
		result.impactedNodes.forEach((node, index) => {
			const chain = result.dependencyChains.find((c) => c.path[0]?.id === node.id)
			const explanation = chain
				? `Impacted via: ${chain.relationshipTypes.join(" → ")} (depth: ${chain.depth})`
				: "Impacted by this change"

			results.push({
				id: node.id,
				score: 1.0 - index * 0.02, // Higher scores for more directly impacted nodes
				payload: {
					filePath: node.filePath,
					codeChunk: explanation,
					startLine: node.startLine,
					endLine: node.endLine,
					identifier: node.name,
					type: node.type,
					language: node.language,
				},
				hybridScore: 1.0 - index * 0.02,
				vectorScore: 0,
				bm25Score: 0,
			})
		})

		// Add test nodes with special marker
		result.testCoverage.testNodes.forEach((node, index) => {
			results.push({
				id: node.id,
				score: 0.9 - index * 0.02,
				payload: {
					filePath: node.filePath,
					codeChunk: "🧪 Test coverage for this code",
					startLine: node.startLine,
					endLine: node.endLine,
					identifier: node.name,
					type: node.type,
					language: node.language,
				},
				hybridScore: 0.9 - index * 0.02,
				vectorScore: 0,
				bm25Score: 0,
			})
		})

		return results
	}

	/**
	 * Phase 11: Converts dependency analysis result to search results
	 */
	private convertDependencyAnalysisToResults(result: DependencyAnalysisResult): HybridSearchResult[] {
		return result.dependencies.map((node, index) => {
			const chain = result.dependencyChains.find((c) => c.path[c.path.length - 1]?.id === node.id)
			const explanation = chain
				? `Dependency via: ${chain.relationshipTypes.join(" → ")} (depth: ${chain.depth})`
				: "Direct dependency"

			return {
				id: node.id,
				score: 1.0 - index * 0.02,
				payload: {
					filePath: node.filePath,
					codeChunk: explanation,
					startLine: node.startLine,
					endLine: node.endLine,
					identifier: node.name,
					type: node.type,
					language: node.language,
				},
				hybridScore: 1.0 - index * 0.02,
				vectorScore: 0,
				bm25Score: 0,
			}
		})
	}

	/**
	 * Phase 11: Converts blast radius result to search results
	 */
	private convertBlastRadiusToResults(result: BlastRadiusResult): HybridSearchResult[] {
		const results: HybridSearchResult[] = []

		// Add summary as first result
		if (result.targetNode) {
			const summary = `
📊 Blast Radius Analysis for ${result.targetNode.name}:
- Risk Score: ${result.metrics.riskScore}/100
- Impacted Nodes: ${result.metrics.totalImpactedNodes}
- Impacted Files: ${result.metrics.totalImpactedFiles}
- Dependencies: ${result.metrics.totalDependencies}
- Tests: ${result.metrics.totalTests}
- Max Impact Depth: ${result.metrics.maxImpactDepth}
			`.trim()

			results.push({
				id: result.targetNode.id,
				score: 1.0,
				payload: {
					filePath: result.targetNode.filePath,
					codeChunk: summary,
					startLine: result.targetNode.startLine,
					endLine: result.targetNode.endLine,
					identifier: result.targetNode.name,
					type: result.targetNode.type,
					language: result.targetNode.language,
				},
				hybridScore: 1.0,
				vectorScore: 0,
				bm25Score: 0,
			})
		}

		// Add impacted nodes
		result.impactedNodes.forEach((node, index) => {
			results.push({
				id: node.id,
				score: 0.9 - index * 0.02,
				payload: {
					filePath: node.filePath,
					codeChunk: "⚠️ Impacted by change",
					startLine: node.startLine,
					endLine: node.endLine,
					identifier: node.name,
					type: node.type,
					language: node.language,
				},
				hybridScore: 0.9 - index * 0.02,
				vectorScore: 0,
				bm25Score: 0,
			})
		})

		return results
	}

	/**
	 * Phase 11: Converts change safety result to search results
	 */
	private convertChangeSafetyToResults(result: ChangeSafetyResult): HybridSearchResult[] {
		const safetyEmoji = {
			safe: "✅",
			moderate: "⚠️",
			risky: "🔶",
			dangerous: "🚨",
		}

		const summary = `
${safetyEmoji[result.safetyLevel]} Change Safety Assessment: ${result.safetyLevel.toUpperCase()}
Risk Score: ${result.riskScore}/100

Reasons:
${result.reasons.map((r) => `- ${r}`).join("\n")}

Recommendations:
${result.recommendations.map((r) => `- ${r}`).join("\n")}

Impact Summary:
- Impacted Nodes: ${result.impactSummary.impactedNodes}
- Impacted Files: ${result.impactSummary.impactedFiles}
- Max Depth: ${result.impactSummary.maxDepth}

Test Coverage:
- Has Tests: ${result.testCoverage.hasTests ? "Yes" : "No"}
- Test Count: ${result.testCoverage.testCount}
		`.trim()

		return [
			{
				id: result.nodeId,
				score: 1.0,
				payload: {
					filePath: "",
					codeChunk: summary,
					startLine: 0,
					endLine: 0,
					identifier: result.nodeName,
					type: "safety_assessment",
					language: undefined,
				},
				hybridScore: 1.0,
				vectorScore: 0,
				bm25Score: 0,
			},
		]
	}
}
