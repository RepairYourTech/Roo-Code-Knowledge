import * as path from "path"
import { VectorStoreSearchResult } from "./interfaces"
import { IEmbedder } from "./interfaces/embedder"
import { IVectorStore } from "./interfaces/vector-store"
import { IBM25Index, BM25SearchResult } from "./interfaces/bm25-index"
import { CodeIndexConfigManager } from "./config-manager"
import { CodeIndexStateManager } from "./state-manager"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"

/**
 * Result from hybrid search combining vector and BM25 scores
 */
export interface HybridSearchResult extends VectorStoreSearchResult {
	/** Combined hybrid score (0-1) */
	hybridScore: number
	/** Original vector similarity score */
	vectorScore: number
	/** Original BM25 keyword score */
	bm25Score: number
}

/**
 * Configuration for hybrid search score fusion
 */
export interface HybridSearchConfig {
	/** Weight for vector search results (0-1, default: 0.7) */
	vectorWeight?: number
	/** Weight for BM25 search results (0-1, default: 0.3) */
	bm25Weight?: number
	/** Strategy for combining scores: 'weighted' or 'rrf' (reciprocal rank fusion) */
	fusionStrategy?: "weighted" | "rrf"
}

/**
 * Service that combines vector similarity search with BM25 keyword search
 * for improved retrieval accuracy
 */
export class HybridSearchService {
	private readonly defaultConfig: Required<HybridSearchConfig> = {
		vectorWeight: 0.7,
		bm25Weight: 0.3,
		fusionStrategy: "weighted",
	}

	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly stateManager: CodeIndexStateManager,
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
		private readonly bm25Index: IBM25Index,
	) {}

	/**
	 * Performs hybrid search combining vector and BM25 results
	 */
	public async searchIndex(
		query: string,
		directoryPrefix?: string,
		config?: HybridSearchConfig,
	): Promise<HybridSearchResult[]> {
		if (!this.configManager.isFeatureEnabled || !this.configManager.isFeatureConfigured) {
			throw new Error("Code index feature is disabled or not configured.")
		}

		const minScore = this.configManager.currentSearchMinScore
		const maxResults = this.configManager.currentSearchMaxResults

		const currentState = this.stateManager.getCurrentStatus().systemStatus
		if (currentState !== "Indexed" && currentState !== "Indexing") {
			throw new Error(`Code index is not ready for search. Current state: ${currentState}`)
		}

		try {
			// Merge config with defaults
			const searchConfig = { ...this.defaultConfig, ...config }

			// Run both searches in parallel
			const [vectorResults, bm25Results] = await Promise.all([
				this.performVectorSearch(query, directoryPrefix, minScore, maxResults * 2),
				this.performBM25Search(query, maxResults * 2),
			])

			// Merge and rank results
			const hybridResults =
				searchConfig.fusionStrategy === "rrf"
					? this.mergeWithRRF(vectorResults, bm25Results, maxResults)
					: this.mergeWithWeightedScores(vectorResults, bm25Results, searchConfig, maxResults)

			return hybridResults
		} catch (error) {
			console.error("[HybridSearchService] Error during search:", error)
			this.stateManager.setSystemState("Error", `Search failed: ${(error as Error).message}`)

			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: (error as Error).message,
				stack: (error as Error).stack,
				location: "hybridSearchIndex",
			})

			throw error
		}
	}

	/**
	 * Performs vector similarity search
	 */
	private async performVectorSearch(
		query: string,
		directoryPrefix: string | undefined,
		minScore: number,
		limit: number,
	): Promise<VectorStoreSearchResult[]> {
		const embeddingResponse = await this.embedder.createEmbeddings([query])
		const vector = embeddingResponse?.embeddings[0]
		if (!vector) {
			throw new Error("Failed to generate embedding for query.")
		}

		const normalizedPrefix = directoryPrefix ? path.normalize(directoryPrefix) : undefined
		return await this.vectorStore.search(vector, normalizedPrefix, minScore, limit)
	}

	/**
	 * Performs BM25 keyword search
	 */
	private async performBM25Search(query: string, limit: number): Promise<BM25SearchResult[]> {
		return this.bm25Index.search(query, limit)
	}

	/**
	 * Merges results using weighted score fusion
	 */
	private mergeWithWeightedScores(
		vectorResults: VectorStoreSearchResult[],
		bm25Results: BM25SearchResult[],
		config: Required<HybridSearchConfig>,
		limit: number,
	): HybridSearchResult[] {
		// Normalize vector scores (already 0-1 from cosine similarity)
		const normalizedVectorScores = this.normalizeScores(vectorResults.map((r) => r.score))

		// Normalize BM25 scores to 0-1 range
		const bm25Scores = bm25Results.map((r) => r.score)
		const normalizedBM25Scores = this.normalizeScores(bm25Scores)

		// Create lookup maps (convert IDs to strings for consistency)
		const vectorMap = new Map(
			vectorResults.map((r, i) => [String(r.id), { result: r, normalizedScore: normalizedVectorScores[i] }]),
		)
		const bm25Map = new Map(
			bm25Results.map((r, i) => [String(r.id), { result: r, normalizedScore: normalizedBM25Scores[i] }]),
		)

		// Get all unique document IDs
		const allIds = new Set([...vectorMap.keys(), ...bm25Map.keys()])

		// Calculate hybrid scores
		const hybridResults: HybridSearchResult[] = []

		for (const id of allIds) {
			const vectorEntry = vectorMap.get(id)
			const bm25Entry = bm25Map.get(id)

			const vectorScore = vectorEntry?.normalizedScore ?? 0
			const bm25Score = bm25Entry?.normalizedScore ?? 0

			// Calculate weighted hybrid score
			const hybridScore = config.vectorWeight * vectorScore + config.bm25Weight * bm25Score

			// Use vector result as base (it has all the metadata)
			const baseResult = vectorEntry?.result ?? this.createResultFromBM25(bm25Entry!.result)

			hybridResults.push({
				...baseResult,
				score: hybridScore, // Update score to hybrid score
				hybridScore,
				vectorScore,
				bm25Score,
			})
		}

		// Sort by hybrid score and limit
		return hybridResults.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, limit)
	}

	/**
	 * Merges results using Reciprocal Rank Fusion (RRF)
	 * RRF is more robust to score scale differences
	 */
	private mergeWithRRF(
		vectorResults: VectorStoreSearchResult[],
		bm25Results: BM25SearchResult[],
		limit: number,
	): HybridSearchResult[] {
		const k = 60 // RRF constant (typical value)

		// Create rank maps (convert IDs to strings for consistency)
		const vectorRanks = new Map(vectorResults.map((r, i) => [String(r.id), i + 1]))
		const bm25Ranks = new Map(bm25Results.map((r, i) => [String(r.id), i + 1]))

		// Get all unique document IDs
		const allIds = new Set([...vectorRanks.keys(), ...bm25Ranks.keys()])

		// Calculate RRF scores
		const hybridResults: HybridSearchResult[] = []

		for (const id of allIds) {
			const vectorRank = vectorRanks.get(id) ?? Infinity
			const bm25Rank = bm25Ranks.get(id) ?? Infinity

			// RRF formula: sum of 1/(k + rank) for each ranking
			const rrfScore = 1 / (k + vectorRank) + 1 / (k + bm25Rank)

			// Get original results
			const vectorResult = vectorResults.find((r) => String(r.id) === id)
			const bm25Result = bm25Results.find((r) => String(r.id) === id)

			const baseResult = vectorResult ?? this.createResultFromBM25(bm25Result!)

			hybridResults.push({
				...baseResult,
				score: rrfScore,
				hybridScore: rrfScore,
				vectorScore: vectorResult?.score ?? 0,
				bm25Score: bm25Result?.score ?? 0,
			})
		}

		// Sort by RRF score and limit
		return hybridResults.sort((a, b) => b.hybridScore - a.hybridScore).slice(0, limit)
	}

	/**
	 * Normalizes scores to 0-1 range using min-max normalization
	 */
	private normalizeScores(scores: number[]): number[] {
		if (scores.length === 0) return []

		const min = Math.min(...scores)
		const max = Math.max(...scores)

		// If all scores are the same, return array of 1s
		if (max === min) {
			return scores.map(() => 1)
		}

		return scores.map((score) => (score - min) / (max - min))
	}

	/**
	 * Creates a VectorStoreSearchResult from a BM25SearchResult
	 * Used when a document is only found in BM25 results
	 */
	private createResultFromBM25(bm25Result: BM25SearchResult): VectorStoreSearchResult {
		return {
			id: String(bm25Result.id),
			score: 0, // Will be overwritten with hybrid score
			payload: {
				filePath: "",
				codeChunk: bm25Result.document,
				startLine: 0,
				endLine: 0,
			},
		}
	}
}
