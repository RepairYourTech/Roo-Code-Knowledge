import { OpenAICompatibleEmbedder } from "./openai-compatible"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import { GEMINI_MAX_ITEM_TOKENS, GEMINI_MAX_BATCH_ITEMS } from "../constants"
import { t } from "../../../i18n"
import { TelemetryEventName } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"
import * as vscode from "vscode"

/**
 * Gemini embedder implementation that wraps the OpenAI Compatible embedder
 * with configuration for Google's Gemini embedding API.
 *
 * Supported models:
 * - text-embedding-004 (dimension: 768)
 * - gemini-embedding-001 (dimension: 2048)
 */
export class GeminiEmbedder implements IEmbedder {
	private readonly openAICompatibleEmbedder: OpenAICompatibleEmbedder
	private static readonly GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
	private static readonly DEFAULT_MODEL = "gemini-embedding-001"
	private readonly modelId: string
	private readonly outputChannel?: vscode.OutputChannel

	/**
	 * Creates a new Gemini embedder
	 * @param apiKey The Gemini API key for authentication
	 * @param modelId The model ID to use (defaults to gemini-embedding-001)
	 * @param outputChannel Optional OutputChannel for error notifications
	 */
	constructor(apiKey: string, modelId?: string, outputChannel?: vscode.OutputChannel) {
		if (!apiKey) {
			throw new Error(t("embeddings:validation.apiKeyRequired"))
		}

		this.outputChannel = outputChannel

		// Use provided model or default
		this.modelId = modelId || GeminiEmbedder.DEFAULT_MODEL

		// Create an OpenAI Compatible embedder with Gemini's configuration
		// Pass GEMINI_MAX_BATCH_ITEMS to enforce Gemini's strict 100-item batch limit
		this.openAICompatibleEmbedder = new OpenAICompatibleEmbedder(
			GeminiEmbedder.GEMINI_BASE_URL,
			apiKey,
			this.modelId,
			GEMINI_MAX_ITEM_TOKENS,
			GEMINI_MAX_BATCH_ITEMS, // Gemini's strict limit: "at most 100 requests can be in one batch"
			outputChannel,
		)
	}

	/**
	 * Creates embeddings for the given texts using Gemini's embedding API
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.modelId

		// Log method entry
		console.log(
			`[GeminiEmbedder] createEmbeddings ENTRY: Received ${texts.length} texts to embed with model ${modelToUse}`,
		)

		try {
			const result = await this.openAICompatibleEmbedder.createEmbeddings(texts, modelToUse)

			// Log final verification
			console.log(
				`[GeminiEmbedder] createEmbeddings EXIT: Generated ${result.embeddings.length} embeddings from ${texts.length} input texts`,
			)

			// Check for embedding count mismatch
			if (result.embeddings.length !== texts.length) {
				console.error(
					`[GeminiEmbedder] CRITICAL: Embedding count mismatch! Input: ${texts.length}, Output: ${result.embeddings.length}`,
				)
			}

			return result
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "GeminiEmbedder:createEmbeddings",
			})
			throw error
		}
	}

	/**
	 * Validates the Gemini embedder configuration by delegating to the underlying OpenAI-compatible embedder
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		try {
			// Delegate validation to the OpenAI-compatible embedder
			// The error messages will be specific to Gemini since we're using Gemini's base URL
			return await this.openAICompatibleEmbedder.validateConfiguration()
		} catch (error) {
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "GeminiEmbedder:validateConfiguration",
			})
			throw error
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "gemini",
		}
	}

	public getProviderInfo(): {
		provider: string
		modelId: string
		baseUrl: string
	} {
		return {
			provider: "gemini",
			modelId: this.modelId,
			baseUrl: GeminiEmbedder.GEMINI_BASE_URL,
		}
	}
}
