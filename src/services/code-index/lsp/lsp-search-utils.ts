/**
 * LSP Search Utilities
 * Helper functions for LSP-based search operations and result processing
 */

import * as vscode from "vscode"
import { HybridSearchResult } from "../hybrid-search-service"
import { WorkspaceSymbolInfo, TypeInfo, SignatureInfo } from "../interfaces/lsp-service"

/**
 * Converts LSP workspace symbols to hybrid search results
 */
export function convertWorkspaceSymbolsToHybridResults(
	symbols: WorkspaceSymbolInfo[],
	baseScore: number = 0.8,
): HybridSearchResult[] {
	return symbols.map((symbol, index) => {
		// Calculate score based on symbol's relevance score and position
		const positionScore = Math.max(0.1, 1.0 - index * 0.05)
		const finalScore = baseScore * positionScore * (symbol.score || 0.5)

		// Build code chunk with symbol information
		let codeChunk = `${symbolKindToString(symbol.kind)}: ${symbol.name}`

		if (symbol.containerName) {
			codeChunk += ` (in ${symbol.containerName})`
		}

		if (symbol.typeInfo) {
			codeChunk += `\nType: ${symbol.typeInfo.type}`
			if (symbol.typeInfo.documentation) {
				codeChunk += `\n${symbol.typeInfo.documentation}`
			}
		}

		if (symbol.signatureInfo) {
			const params = symbol.signatureInfo.parameters
				.map((p) => `${p.name}: ${p.type}${p.isOptional ? "?" : ""}`)
				.join(", ")
			codeChunk += `\nSignature: ${symbol.signatureInfo.name}(${params}): ${symbol.signatureInfo.returnType}`
		}

		return {
			id: `lsp-${symbol.location.uri.fsPath}-${symbol.location.range.start.line}-${symbol.location.range.start.character}`,
			score: finalScore,
			payload: {
				filePath: symbol.location.uri.fsPath,
				codeChunk,
				startLine: symbol.location.range.start.line + 1, // Convert to 1-based
				endLine: symbol.location.range.end.line + 1,
				identifier: symbol.name,
				type: symbolKindToString(symbol.kind),
				language: symbol.language,
				// Include LSP-specific information
				lspTypeInfo: {
					typeInfo: symbol.typeInfo,
					signatureInfo: symbol.signatureInfo,
					lspAvailable: true,
				},
			},
			hybridScore: finalScore,
			vectorScore: 0, // Pure LSP result, no vector component
			bm25Score: 0, // Pure LSP result, no BM25 component
		}
	})
}

/**
 * Converts LSP locations to hybrid search results
 */
export function convertLocationsToHybridResults(
	locations: vscode.Location[],
	query: string,
	context: string = "Reference",
	baseScore: number = 0.7,
): HybridSearchResult[] {
	return locations.map((location, index) => {
		const positionScore = Math.max(0.1, 1.0 - index * 0.05)
		const finalScore = baseScore * positionScore

		return {
			id: `lsp-ref-${location.uri.fsPath}-${location.range.start.line}-${location.range.start.character}`,
			score: finalScore,
			payload: {
				filePath: location.uri.fsPath,
				codeChunk: `${context} for "${query}"`,
				startLine: location.range.start.line + 1,
				endLine: location.range.end.line + 1,
				identifier: query,
				type: context.toLowerCase(),
				language: getLanguageFromPath(location.uri.fsPath),
			},
			hybridScore: finalScore,
			vectorScore: 0,
			bm25Score: 0,
		}
	})
}

/**
 * Filters LSP results by file patterns
 */
export function filterLSPResultsByPattern(
	results: HybridSearchResult[],
	directoryPrefix?: string,
	filePattern?: string,
): HybridSearchResult[] {
	if (!directoryPrefix && !filePattern) {
		return results
	}

	return results.filter((result) => {
		const filePath = result.payload?.filePath || ""

		if (directoryPrefix && !filePath.startsWith(directoryPrefix)) {
			return false
		}

		if (filePattern) {
			// Escape special regex characters and replace wildcards safely
			const escapedPattern = filePattern
				.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
				.replace(/\\\*/g, ".*") // Convert escaped wildcards back to regex pattern
			const regex = new RegExp(`^${escapedPattern}$`)
			if (!regex.test(filePath)) {
				return false
			}
		}

		return true
	})
}

/**
 * Ranks and limits LSP results
 */
export function rankLSPResults(results: HybridSearchResult[], maxResults?: number): HybridSearchResult[] {
	// Sort by score descending without mutating the original array
	const sorted = [...results].sort((a, b) => b.score - a.score)

	// Apply limit if specified
	if (maxResults && maxResults > 0) {
		return sorted.slice(0, maxResults)
	}

	return sorted
}

/**
 * Merges LSP results with existing hybrid search results
 */
export function mergeLSPResults(
	existingResults: HybridSearchResult[],
	lspResults: HybridSearchResult[],
	lspWeight: number = 0.4,
): HybridSearchResult[] {
	// Create a map for deduplication
	const resultMap = new Map<string, HybridSearchResult>()

	// Add existing results first
	for (const result of existingResults) {
		const id = String(result.id)
		resultMap.set(id, result)
	}

	// Add LSP results with weight adjustment
	for (const lspResult of lspResults) {
		const id = String(lspResult.id)
		const existing = resultMap.get(id)

		if (!existing) {
			// New result, apply LSP weight
			resultMap.set(id, {
				...lspResult,
				score: lspResult.score * lspWeight,
				hybridScore: lspResult.hybridScore * lspWeight,
			})
		} else {
			// Duplicate result, keep the one with higher score
			if (lspResult.score > existing.score) {
				resultMap.set(id, {
					...lspResult,
					score: Math.max(existing.score, lspResult.score * lspWeight),
					hybridScore: Math.max(existing.hybridScore, lspResult.hybridScore * lspWeight),
				})
			}
		}
	}

	// Convert back to array and sort
	return Array.from(resultMap.values()).sort((a, b) => b.score - a.score)
}

/**
 * Extracts type information from a query string
 */
export function extractTypeFromQuery(query: string): string | null {
	const lowerQuery = query.toLowerCase()

	// Look for type patterns
	const typePatterns = [
		/return[s]?[:\s]+([^\s,]+)/i,
		/type[:\s]+([^\s,]+)/i,
		/promise<([^>]+)>/i,
		/array<([^>]+)>/i,
		/([a-z][a-z0-9_]*(?:\[\])*)/i, // Simple type names
	]

	for (const pattern of typePatterns) {
		const match = query.match(pattern)
		if (match && match[1]) {
			return match[1].trim()
		}
	}

	return null
}

/**
 * Determines if a query is type-based
 */
export function isTypeBasedQuery(query: string): boolean {
	const typeKeywords = [
		"return type",
		"returns",
		"type is",
		"parameter type",
		"promise<",
		"array<",
		"function that returns",
		"method that returns",
	]

	const lowerQuery = query.toLowerCase()
	return typeKeywords.some((keyword) => lowerQuery.includes(keyword))
}

/**
 * Helper: Convert VSCode SymbolKind to string
 */
function symbolKindToString(kind: vscode.SymbolKind): string {
	switch (kind) {
		case vscode.SymbolKind.File:
			return "file"
		case vscode.SymbolKind.Module:
			return "module"
		case vscode.SymbolKind.Namespace:
			return "namespace"
		case vscode.SymbolKind.Package:
			return "package"
		case vscode.SymbolKind.Class:
			return "class"
		case vscode.SymbolKind.Method:
			return "method"
		case vscode.SymbolKind.Property:
			return "property"
		case vscode.SymbolKind.Field:
			return "field"
		case vscode.SymbolKind.Constructor:
			return "constructor"
		case vscode.SymbolKind.Enum:
			return "enum"
		case vscode.SymbolKind.Interface:
			return "interface"
		case vscode.SymbolKind.Function:
			return "function"
		case vscode.SymbolKind.Variable:
			return "variable"
		case vscode.SymbolKind.Constant:
			return "constant"
		case vscode.SymbolKind.String:
			return "string"
		case vscode.SymbolKind.Number:
			return "number"
		case vscode.SymbolKind.Boolean:
			return "boolean"
		case vscode.SymbolKind.Array:
			return "array"
		case vscode.SymbolKind.Object:
			return "object"
		case vscode.SymbolKind.Key:
			return "key"
		case vscode.SymbolKind.Null:
			return "null"
		case vscode.SymbolKind.EnumMember:
			return "enum member"
		case vscode.SymbolKind.Struct:
			return "struct"
		case vscode.SymbolKind.Event:
			return "event"
		case vscode.SymbolKind.Operator:
			return "operator"
		case vscode.SymbolKind.TypeParameter:
			return "type parameter"
		default:
			return "unknown"
	}
}

/**
 * Helper: Get programming language from file path
 */
function getLanguageFromPath(filePath: string): string | undefined {
	const extension = filePath.split(".").pop()?.toLowerCase()

	const extensionMap: Record<string, string> = {
		ts: "typescript",
		tsx: "typescript",
		js: "javascript",
		jsx: "javascript",
		py: "python",
		java: "java",
		cpp: "cpp",
		c: "c",
		cs: "csharp",
		go: "go",
		rs: "rust",
		php: "php",
		rb: "ruby",
		swift: "swift",
		kt: "kotlin",
		scala: "scala",
		vue: "vue",
		svelte: "svelte",
	}

	return extensionMap[extension || ""] || extension
}

/**
 * LSP Result Cache
 * Simple in-memory cache for LSP results to improve performance
 */
export class LSPResultCache {
	private cache = new Map<string, { result: any; timestamp: number }>()
	private readonly ttlMs = 5 * 60 * 1000 // 5 minutes TTL

	/**
	 * Get cached result
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key)
		if (!entry) {
			return null
		}

		// Check if expired
		if (Date.now() - entry.timestamp > this.ttlMs) {
			this.cache.delete(key)
			return null
		}

		return entry.result as T
	}

	/**
	 * Set cache entry
	 */
	set<T>(key: string, result: T): void {
		this.cache.set(key, {
			result,
			timestamp: Date.now(),
		})
	}

	/**
	 * Clear expired entries
	 */
	clearExpired(): void {
		const now = Date.now()
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.ttlMs) {
				this.cache.delete(key)
			}
		}
	}

	/**
	 * Clear all entries
	 */
	clear(): void {
		this.cache.clear()
	}
}

// Global cache instance
export const lspCache = new LSPResultCache()
