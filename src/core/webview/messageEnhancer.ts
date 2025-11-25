import { ProviderSettings, ClineMessage, GlobalState, TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import { supportPrompt } from "../../shared/support-prompt"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { ProviderSettingsManager } from "../config/ProviderSettingsManager"
import { ClineProvider } from "./ClineProvider"
import { CodeIndexManager } from "../../services/code-index/manager"

export interface MessageEnhancerOptions {
	text: string
	apiConfiguration: ProviderSettings
	customSupportPrompts?: Record<string, any>
	listApiConfigMeta: Array<{ id: string; name?: string }>
	enhancementApiConfigId?: string
	includeTaskHistoryInEnhance?: boolean
	currentClineMessages?: ClineMessage[]
	providerSettingsManager: ProviderSettingsManager
	codeIndexManager?: CodeIndexManager
}

export interface MessageEnhancerResult {
	success: boolean
	enhancedText?: string
	error?: string
}

/**
 * Cached codebase context for common prompt patterns
 */
interface CachedCodebaseContext {
	value: string
	timestamp: number
}

/**
 * Enhances a message prompt using AI, optionally including task history and codebase context
 */
export class MessageEnhancer {
	// LRU cache for common prompt patterns
	private static codebaseContextCache: Map<string, CachedCodebaseContext> = new Map()
	private static readonly CACHE_SIZE_LIMIT = 50 // Conservative limit
	private static readonly CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
	/**
	 * Enhances a message prompt using the configured AI provider
	 * @param options Configuration options for message enhancement
	 * @returns Enhanced message result with success status
	 */
	static async enhanceMessage(options: MessageEnhancerOptions): Promise<MessageEnhancerResult> {
		try {
			const {
				text,
				apiConfiguration,
				customSupportPrompts,
				listApiConfigMeta,
				enhancementApiConfigId,
				includeTaskHistoryInEnhance,
				currentClineMessages,
				providerSettingsManager,
				codeIndexManager,
			} = options

			// Determine which API configuration to use
			let configToUse: ProviderSettings = apiConfiguration

			// Try to get enhancement config first, fall back to current config
			if (enhancementApiConfigId && listApiConfigMeta.find(({ id }) => id === enhancementApiConfigId)) {
				const { name: _, ...providerSettings } = await providerSettingsManager.getProfile({
					id: enhancementApiConfigId,
				})

				if (providerSettings.apiProvider) {
					configToUse = providerSettings
				}
			}

			// Prepare the prompt to enhance
			let promptToEnhance = text

			// Include task history if enabled and available
			if (includeTaskHistoryInEnhance && currentClineMessages && currentClineMessages.length > 0) {
				const taskHistory = this.extractTaskHistory(currentClineMessages)
				if (taskHistory) {
					promptToEnhance = `${text}\n\nUse the following previous conversation context as needed:\n${taskHistory}`
				}
			}

			// Get codebase context if CodeIndexManager is available
			const codebaseContext = await this.getCodebaseContext(text, codeIndexManager)

			// Create the enhancement prompt using the support prompt system
			const enhancementPrompt = supportPrompt.create(
				"ENHANCE",
				{ userInput: promptToEnhance, codebaseContext },
				customSupportPrompts,
			)

			// Call the single completion handler to get the enhanced prompt
			const enhancedText = await singleCompletionHandler(configToUse, enhancementPrompt)

			return {
				success: true,
				enhancedText,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	/**
	 * Gets codebase context for the user's prompt by searching the code index
	 * Uses caching to avoid redundant searches for common patterns
	 * @param userPrompt The user's original prompt
	 * @param codeIndexManager Optional CodeIndexManager instance
	 * @returns Formatted codebase context string
	 */
	private static async getCodebaseContext(userPrompt: string, codeIndexManager?: CodeIndexManager): Promise<string> {
		// If no code index manager or feature not enabled, return empty context
		if (!codeIndexManager || !codeIndexManager.isFeatureEnabled) {
			return "No codebase context available (code index not enabled)"
		}

		try {
			// Create a cache key from the prompt (normalize to lowercase, trim)
			const cacheKey = userPrompt.toLowerCase().trim().slice(0, 100) // Limit key length

			// Check cache first
			const cached = this.getFromCache(cacheKey)
			if (cached) {
				return cached
			}

			// Search the codebase for relevant context
			// Use the user's prompt as the search query
			const searchResults = await codeIndexManager.searchIndex(userPrompt)

			// If no results, return a message
			if (!searchResults || searchResults.length === 0) {
				const noResultsMessage = "No relevant code found in the codebase for this prompt"
				this.setInCache(cacheKey, noResultsMessage)
				return noResultsMessage
			}

			// Format the search results into a concise context string
			const contextParts: string[] = []

			// Take top 5 results to keep context manageable
			const topResults = searchResults.slice(0, 5)

			for (const result of topResults) {
				const filePath = result.payload?.filePath || "unknown"
				const content = result.payload?.codeChunk || ""
				const score = result.score?.toFixed(2) || "N/A"
				const identifier = result.payload?.identifier || null
				const type = result.payload?.type || null

				// Truncate content to avoid context explosion
				const truncatedContent = content.slice(0, 300)
				const contentPreview = truncatedContent + (content.length > 300 ? "..." : "")

				// Add identifier and type info if available
				const metaInfo = identifier && type ? ` [${type}: ${identifier}]` : ""

				contextParts.push(`File: ${filePath}${metaInfo} (relevance: ${score})
${contentPreview}`)
			}

			const formattedContext = contextParts.join("\n\n---\n\n")

			// Cache the result
			this.setInCache(cacheKey, formattedContext)

			return formattedContext
		} catch (error) {
			// Log error but don't fail the enhancement
			console.error("Failed to get codebase context:", error)
			return "Error retrieving codebase context"
		}
	}

	/**
	 * Gets a value from the cache if it exists and hasn't expired
	 * @param key Cache key
	 * @returns Cached value or null if not found/expired
	 */
	private static getFromCache(key: string): string | null {
		const cached = this.codebaseContextCache.get(key)
		if (!cached) return null

		// Check TTL
		if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
			this.codebaseContextCache.delete(key)
			return null
		}

		return cached.value
	}

	/**
	 * Sets a value in the cache with LRU eviction
	 * @param key Cache key
	 * @param value Value to cache
	 */
	private static setInCache(key: string, value: string): void {
		// Simple FIFO: if cache is full, remove oldest entry by insertion order
		if (this.codebaseContextCache.size >= this.CACHE_SIZE_LIMIT) {
			const firstKey = this.codebaseContextCache.keys().next().value
			if (firstKey) {
				this.codebaseContextCache.delete(firstKey)
			}
		}

		this.codebaseContextCache.set(key, {
			value,
			timestamp: Date.now(),
		})
	}

	/**
	 * Extracts relevant task history from Cline messages for context
	 * @param messages Array of Cline messages
	 * @returns Formatted task history string
	 */
	private static extractTaskHistory(messages: ClineMessage[]): string {
		try {
			const relevantMessages = messages
				.filter((msg) => {
					// Include user messages (type: "ask" with text) and assistant messages (type: "say" with say: "text")
					if (msg.type === "ask" && msg.text) {
						return true
					}
					if (msg.type === "say" && msg.say === "text" && msg.text) {
						return true
					}
					return false
				})
				.slice(-10) // Limit to last 10 messages to avoid context explosion

			return relevantMessages
				.map((msg) => {
					const role = msg.type === "ask" ? "User" : "Assistant"
					const content = msg.text || ""
					// Truncate long messages
					return `${role}: ${content.slice(0, 500)}${content.length > 500 ? "..." : ""}`
				})
				.join("\n")
		} catch (error) {
			// Log error but don't fail the enhancement
			console.error("Failed to extract task history:", error)
			return ""
		}
	}

	/**
	 * Captures telemetry for prompt enhancement
	 * @param taskId Optional task ID for telemetry tracking
	 * @param includeTaskHistory Whether task history was included in the enhancement
	 */
	static captureTelemetry(taskId?: string, includeTaskHistory?: boolean): void {
		if (TelemetryService.hasInstance()) {
			// Use captureEvent directly to include the includeTaskHistory property
			TelemetryService.instance.captureEvent(TelemetryEventName.PROMPT_ENHANCED, {
				...(taskId && { taskId }),
				includeTaskHistory: includeTaskHistory ?? false,
			})
		}
	}
}
