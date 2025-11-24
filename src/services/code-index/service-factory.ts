import * as vscode from "vscode"
import { OpenAiEmbedder } from "./embedders/openai"
import { CodeIndexOllamaEmbedder } from "./embedders/ollama"
import { OpenAICompatibleEmbedder } from "./embedders/openai-compatible"
import { GeminiEmbedder } from "./embedders/gemini"
import { MistralEmbedder } from "./embedders/mistral"
import { VercelAiGatewayEmbedder } from "./embedders/vercel-ai-gateway"
import { OpenRouterEmbedder } from "./embedders/openrouter"
import { EmbedderProvider, getDefaultModelId, getModelDimension } from "../../shared/embeddingModels"
import { QdrantVectorStore } from "./vector-store/qdrant-client"
import { CodeParser, DirectoryScanner, FileWatcher } from "./processors"
import {
	ICodeParser,
	IEmbedder,
	IFileWatcher,
	IVectorStore,
	IBM25Index,
	INeo4jService,
	IGraphIndexer,
	ILSPService,
} from "./interfaces"
import { CodeIndexConfigManager } from "./config-manager"
import { CacheManager } from "./cache-manager"
import { Neo4jService } from "./graph/neo4j-service"
import { GraphIndexer } from "./graph/graph-indexer"
import { CodebaseIndexErrorLogger } from "./graph/error-logger"
import { LSPService } from "./lsp/lsp-service"
import { SearchOrchestrator } from "./query/search-orchestrator"
import { HybridSearchService } from "./hybrid-search-service"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { Ignore } from "ignore"
import { t } from "../../i18n"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { Package } from "../../shared/package"
import { BATCH_SEGMENT_THRESHOLD } from "./constants"
import { createOutputChannelLogger, type LogFunction } from "../../utils/outputChannelLogger"

/**
 * Factory class responsible for creating and configuring code indexing service dependencies.
 */
export class CodeIndexServiceFactory {
	constructor(
		private readonly configManager: CodeIndexConfigManager,
		private readonly workspacePath: string,
		private readonly cacheManager: CacheManager,
		private readonly outputChannel: vscode.OutputChannel,
	) {
		this.log = createOutputChannelLogger(outputChannel)
	}

	private readonly log: LogFunction

	public get config(): CodeIndexConfigManager {
		return this.configManager
	}

	/**
	 * Creates an embedder instance based on the current configuration.
	 */
	public createEmbedder(): IEmbedder {
		const config = this.configManager.getConfig()

		const provider = config.embedderProvider as EmbedderProvider

		if (provider === "openai") {
			const apiKey = config.openAiOptions?.openAiNativeApiKey

			if (!apiKey) {
				throw new Error(t("embeddings:serviceFactory.openAiConfigMissing"))
			}
			return new OpenAiEmbedder({
				...config.openAiOptions,
				openAiEmbeddingModelId: config.modelId,
			})
		} else if (provider === "ollama") {
			if (!config.ollamaOptions?.ollamaBaseUrl) {
				throw new Error(t("embeddings:serviceFactory.ollamaConfigMissing"))
			}
			return new CodeIndexOllamaEmbedder({
				...config.ollamaOptions,
				ollamaModelId: config.modelId,
			})
		} else if (provider === "openai-compatible") {
			if (!config.openAiCompatibleOptions?.baseUrl || !config.openAiCompatibleOptions?.apiKey) {
				throw new Error(t("embeddings:serviceFactory.openAiCompatibleConfigMissing"))
			}
			return new OpenAICompatibleEmbedder(
				config.openAiCompatibleOptions.baseUrl,
				config.openAiCompatibleOptions.apiKey,
				config.modelId,
				undefined, // maxItemTokens
				undefined, // maxBatchItems
				this.outputChannel,
			)
		} else if (provider === "gemini") {
			if (!config.geminiOptions?.apiKey) {
				throw new Error(t("embeddings:serviceFactory.geminiConfigMissing"))
			}
			return new GeminiEmbedder(config.geminiOptions.apiKey, config.modelId, this.outputChannel)
		} else if (provider === "mistral") {
			if (!config.mistralOptions?.apiKey) {
				throw new Error(t("embeddings:serviceFactory.mistralConfigMissing"))
			}
			return new MistralEmbedder(config.mistralOptions.apiKey, config.modelId)
		} else if (provider === "vercel-ai-gateway") {
			if (!config.vercelAiGatewayOptions?.apiKey) {
				throw new Error(t("embeddings:serviceFactory.vercelAiGatewayConfigMissing"))
			}
			return new VercelAiGatewayEmbedder(config.vercelAiGatewayOptions.apiKey, config.modelId)
		} else if (provider === "openrouter") {
			if (!config.openRouterOptions?.apiKey) {
				throw new Error(t("embeddings:serviceFactory.openRouterConfigMissing"))
			}
			return new OpenRouterEmbedder(config.openRouterOptions.apiKey, config.modelId)
		}

		throw new Error(
			t("embeddings:serviceFactory.invalidEmbedderType", { embedderProvider: config.embedderProvider }),
		)
	}

	/**
	 * Validates an embedder instance to ensure it's properly configured.
	 * @param embedder The embedder instance to validate
	 * @returns Promise resolving to validation result
	 */
	public async validateEmbedder(embedder: IEmbedder): Promise<{ valid: boolean; error?: string }> {
		try {
			return await embedder.validateConfiguration()
		} catch (error) {
			// Capture telemetry for the error
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				location: "validateEmbedder",
			})

			// If validation throws an exception, preserve the original error message
			return {
				valid: false,
				error: error instanceof Error ? error.message : "embeddings:validation.configurationError",
			}
		}
	}

	/**
	 * Creates a vector store instance using the current configuration.
	 */
	public createVectorStore(): IVectorStore {
		const config = this.configManager.getConfig()

		const provider = config.embedderProvider as EmbedderProvider
		const defaultModel = getDefaultModelId(provider)
		// Use the embedding model ID from config, not the chat model IDs
		const modelId = config.modelId ?? defaultModel

		let vectorSize: number | undefined

		// First try to get the model-specific dimension from profiles
		vectorSize = getModelDimension(provider, modelId)

		// Only use manual dimension if model doesn't have a built-in dimension
		if (!vectorSize && config.modelDimension && config.modelDimension > 0) {
			vectorSize = config.modelDimension
		}

		if (vectorSize === undefined || vectorSize <= 0) {
			if (provider === "openai-compatible") {
				throw new Error(
					t("embeddings:serviceFactory.vectorDimensionNotDeterminedOpenAiCompatible", { modelId, provider }),
				)
			} else {
				throw new Error(t("embeddings:serviceFactory.vectorDimensionNotDetermined", { modelId, provider }))
			}
		}

		if (!config.qdrantUrl) {
			throw new Error(t("embeddings:serviceFactory.qdrantUrlMissing"))
		}

		// Assuming constructor is updated: new QdrantVectorStore(workspacePath, url, vectorSize, apiKey?, outputChannel?)
		return new QdrantVectorStore(
			this.workspacePath,
			config.qdrantUrl,
			vectorSize,
			config.qdrantApiKey,
			this.outputChannel,
		)
	}

	/**
	 * Creates an LSP service instance
	 * Phase 6: LSP Integration for accurate type information
	 */
	public createLSPService(): ILSPService {
		return new LSPService()
	}

	/**
	 * Creates a code parser instance with optional LSP service
	 * Phase 6: Parser can be enriched with LSP type information
	 */
	public createParser(lspService?: ILSPService): ICodeParser {
		return new CodeParser(lspService)
	}

	/**
	 * Creates a Neo4j service instance if Neo4j is enabled
	 * @returns Neo4j service instance or undefined if disabled
	 */
	public createNeo4jService(): INeo4jService | undefined {
		if (!this.configManager.isNeo4jEnabled) {
			return undefined
		}

		const config = this.configManager.neo4jConfig

		// Validate required fields and provide defaults
		// NOTE: We use "neo4j" as the default database name because:
		// 1. Neo4j Community Edition (90% of self-hosted users) does NOT support multiple databases
		// 2. Neo4j Aura Free tier also only supports the "neo4j" database
		// 3. Custom database names require Neo4j Enterprise Edition
		const neo4jConfig = {
			enabled: config.enabled,
			url: config.url || "bolt://localhost:7687",
			username: config.username || "neo4j",
			password: config.password || "",
			database: config.database || "neo4j",
		}

		return new Neo4jService(neo4jConfig, undefined, this.outputChannel)
	}

	/**
	 * Creates a graph indexer instance if Neo4j is enabled
	 * @param neo4jService Neo4j service instance
	 * @param context VSCode extension context for error logging
	 * @returns Graph indexer instance or undefined if Neo4j is disabled
	 */
	public createGraphIndexer(
		neo4jService?: INeo4jService,
		context?: vscode.ExtensionContext,
	): IGraphIndexer | undefined {
		if (!neo4jService || !this.configManager.isNeo4jEnabled) {
			this.log("[ServiceFactory] GraphIndexer NOT created - Neo4j is disabled or service unavailable")
			return undefined
		}

		// Create error logger for persistent error tracking
		const errorLogger = context ? new CodebaseIndexErrorLogger(context) : undefined

		if (!errorLogger) {
			this.log("[ServiceFactory] GraphIndexer created WITHOUT error logger - context not provided")
		} else {
			this.log("[ServiceFactory] GraphIndexer created WITH error logger")
		}

		return new GraphIndexer(neo4jService, errorLogger, this.outputChannel)
	}

	/**
	 * Creates a directory scanner instance with its required dependencies.
	 */
	public createDirectoryScanner(
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		parser: ICodeParser,
		ignoreInstance: Ignore,
		bm25Index?: IBM25Index,
		graphIndexer?: IGraphIndexer,
		stateManager?: any, // CodeIndexStateManager - optional for backward compatibility
	): DirectoryScanner {
		// Get the configurable batch size from VSCode settings
		let batchSize: number
		try {
			batchSize = vscode.workspace
				.getConfiguration(Package.name)
				.get<number>("codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD)
		} catch {
			// In test environment, vscode.workspace might not be available
			batchSize = BATCH_SEGMENT_THRESHOLD
		}
		return new DirectoryScanner(
			embedder,
			vectorStore,
			parser,
			this.cacheManager,
			ignoreInstance,
			bm25Index,
			batchSize,
			graphIndexer,
			stateManager,
			this.outputChannel,
		)
	}

	/**
	 * Creates a file watcher instance with its required dependencies.
	 */
	public createFileWatcher(
		context: vscode.ExtensionContext,
		embedder: IEmbedder,
		vectorStore: IVectorStore,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
		rooIgnoreController?: RooIgnoreController,
		bm25Index?: IBM25Index,
		graphIndexer?: IGraphIndexer,
		stateManager?: any, // CodeIndexStateManager - optional for backward compatibility
	): IFileWatcher {
		// Get the configurable batch size from VSCode settings
		let batchSize: number
		try {
			batchSize = vscode.workspace
				.getConfiguration(Package.name)
				.get<number>("codeIndex.embeddingBatchSize", BATCH_SEGMENT_THRESHOLD)
		} catch {
			// In test environment, vscode.workspace might not be available
			batchSize = BATCH_SEGMENT_THRESHOLD
		}
		return new FileWatcher(
			this.workspacePath,
			context,
			cacheManager,
			embedder,
			vectorStore,
			bm25Index,
			ignoreInstance,
			rooIgnoreController,
			batchSize,
			graphIndexer,
			stateManager,
			this.outputChannel,
		)
	}

	/**
	 * Creates a search orchestrator for intelligent query routing
	 * Phase 7: Hybrid Search & Routing
	 */
	public createSearchOrchestrator(
		hybridSearchService: HybridSearchService,
		neo4jService?: INeo4jService,
		lspService?: ILSPService,
	): SearchOrchestrator {
		return new SearchOrchestrator(hybridSearchService, neo4jService, lspService)
	}

	/**
	 * Creates all required service dependencies if the service is properly configured.
	 * @throws Error if the service is not properly configured
	 */
	public createServices(
		context: vscode.ExtensionContext,
		cacheManager: CacheManager,
		ignoreInstance: Ignore,
		rooIgnoreController?: RooIgnoreController,
		bm25Index?: IBM25Index,
		stateManager?: any, // CodeIndexStateManager - optional for backward compatibility
	): {
		embedder: IEmbedder
		vectorStore: IVectorStore
		parser: ICodeParser
		scanner: DirectoryScanner
		fileWatcher: IFileWatcher
		neo4jService?: INeo4jService
		graphIndexer?: IGraphIndexer
		lspService?: ILSPService
	} {
		if (!this.configManager.isFeatureConfigured) {
			throw new Error(t("embeddings:serviceFactory.codeIndexingNotConfigured"))
		}

		const embedder = this.createEmbedder()
		const vectorStore = this.createVectorStore()

		// Create LSP service and parser with LSP support (Phase 6)
		const lspService = this.createLSPService()
		const parser = this.createParser(lspService)

		// Create Neo4j service and graph indexer if enabled
		const neo4jService = this.createNeo4jService()
		const graphIndexer = this.createGraphIndexer(neo4jService, context)

		const scanner = this.createDirectoryScanner(
			embedder,
			vectorStore,
			parser,
			ignoreInstance,
			bm25Index,
			graphIndexer,
			stateManager,
		)
		const fileWatcher = this.createFileWatcher(
			context,
			embedder,
			vectorStore,
			cacheManager,
			ignoreInstance,
			rooIgnoreController,
			bm25Index,
			graphIndexer,
			stateManager,
		)

		return {
			embedder,
			vectorStore,
			parser,
			scanner,
			fileWatcher,
			neo4jService,
			graphIndexer,
			lspService,
		}
	}
}
