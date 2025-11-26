import * as vscode from "vscode"
import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderProvider } from "./interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "./interfaces/config"
import { DEFAULT_SEARCH_MIN_SCORE, DEFAULT_MAX_SEARCH_RESULTS } from "./constants"
import { getDefaultModelId, getModelDimension, getModelScoreThreshold } from "../../shared/embeddingModels"
import { ConfigValidator } from "./config-validator"
import { ConfigMigrator } from "./config-migrator"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private codebaseIndexEnabled: boolean = true
	private embedderProvider: EmbedderProvider = "openai"
	private modelId?: string
	private modelDimension?: number
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
	private geminiOptions?: { apiKey: string }
	private mistralOptions?: { apiKey: string }
	private vercelAiGatewayOptions?: { apiKey: string }
	private openRouterOptions?: { apiKey: string }
	private qdrantUrl?: string = "http://localhost:6333"
	private qdrantApiKey?: string
	private searchMinScore?: number
	private searchMaxResults?: number
	// Neo4j graph database configuration (optional, disabled by default)
	private neo4jEnabled: boolean = false
	private neo4jUrl?: string = "bolt://localhost:7687"
	private neo4jUsername?: string = "neo4j"
	private neo4jPassword?: string
	private neo4jDatabase?: string = "neo4j"

	constructor(private readonly contextProxy: ContextProxy) {
		// Initialize with current configuration
		// We skip strict validation on startup to avoid blocking initialization,
		// but we log any issues found.
		const config = this._readConfigurationFromStorage()
		const validation = ConfigValidator.validateConfig(config)

		if (!validation.valid) {
			console.error("Invalid initial configuration:", validation.errors)
			// ... (rest of the block)
			this._applyConfiguration({
				isConfigured: false,
				embedderProvider: "openai",
				qdrantUrl: "http://localhost:6333",
				qdrantApiKey: "",
				neo4jEnabled: false,
				// ... other defaults
			} as any)
			return
		}

		this._applyConfiguration(config)
	}

	/**
	 * Gets the context proxy instance
	 */
	public getContextProxy(): ContextProxy {
		return this.contextProxy
	}

	/**
	 * Reads configuration from storage and constructs a CodeIndexConfig object.
	 * Does NOT modify instance state.
	 */
	private _readConfigurationFromStorage(): CodeIndexConfig {
		// Load configuration from storage
		const rawGlobalState = this.contextProxy?.getGlobalState("codebaseIndexConfig")
		const codebaseIndexConfig = (rawGlobalState as any) ?? {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
			codebaseIndexSearchMinScore: 0.4,
			codebaseIndexSearchMaxResults: 50,
			// Neo4j defaults (disabled by default, simplified naming)
			neo4jEnabled: false,
			neo4jUrl: "bolt://localhost:7687",
			neo4jUsername: "neo4j",
			neo4jPassword: "",
			neo4jDatabase: "neo4j",
		}
		// console.log("DEBUG: _readConfigurationFromStorage raw config:", JSON.stringify(codebaseIndexConfig, null, 2))

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
			codebaseIndexSearchMinScore,
			codebaseIndexSearchMaxResults,
			neo4jEnabled,
			neo4jUri,
			neo4jUsername,
			configSchemaVersion,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""
		const openAiCompatibleBaseUrl = codebaseIndexConfig.codebaseIndexOpenAiCompatibleBaseUrl ?? ""
		const openAiCompatibleApiKey = this.contextProxy?.getSecret("codebaseIndexOpenAiCompatibleApiKey") ?? ""
		const geminiApiKey = this.contextProxy?.getSecret("codebaseIndexGeminiApiKey") ?? ""
		const mistralApiKey = this.contextProxy?.getSecret("codebaseIndexMistralApiKey") ?? ""
		const vercelAiGatewayApiKey = this.contextProxy?.getSecret("codebaseIndexVercelAiGatewayApiKey") ?? ""
		const openRouterApiKey = this.contextProxy?.getSecret("codebaseIndexOpenRouterApiKey") ?? ""
		const neo4jPassword = this.contextProxy?.getSecret("neo4jPassword") ?? ""

		// Read codebaseIndexEnabled from VSCode settings (persists across reinstalls)
		// Fall back to globalState value, then default to true
		const vscodeSettingEnabled = vscode.workspace.getConfiguration("roo-cline").get<boolean>("codeIndex.enabled")
		const finalEnabled = vscodeSettingEnabled ?? codebaseIndexEnabled ?? true

		// Validate and set model dimension
		let modelDimension: number | undefined
		const rawDimension = codebaseIndexConfig.codebaseIndexEmbedderModelDimension
		if (rawDimension !== undefined && rawDimension !== null) {
			const dimension = Number(rawDimension)
			if (!isNaN(dimension) && dimension > 0) {
				modelDimension = dimension
			} else {
				console.warn(
					`Invalid codebaseIndexEmbedderModelDimension value: ${rawDimension}. Must be a positive number.`,
				)
			}
		}

		// Determine embedder provider
		let embedderProvider: EmbedderProvider = "openai"
		if (codebaseIndexEmbedderProvider === "ollama") {
			embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			embedderProvider = "openai-compatible"
		} else if (codebaseIndexEmbedderProvider === "gemini") {
			embedderProvider = "gemini"
		} else if (codebaseIndexEmbedderProvider === "mistral") {
			embedderProvider = "mistral"
		} else if (codebaseIndexEmbedderProvider === "vercel-ai-gateway") {
			embedderProvider = "vercel-ai-gateway"
		} else if (codebaseIndexEmbedderProvider === "openrouter") {
			embedderProvider = "openrouter"
		}

		// Construct options objects
		const openAiOptions = { openAiNativeApiKey: openAiKey }
		const ollamaOptions = { ollamaBaseUrl: codebaseIndexEmbedderBaseUrl }
		const openAiCompatibleOptions =
			openAiCompatibleBaseUrl && openAiCompatibleApiKey
				? { baseUrl: openAiCompatibleBaseUrl, apiKey: openAiCompatibleApiKey }
				: undefined
		const geminiOptions = geminiApiKey ? { apiKey: geminiApiKey } : undefined
		const mistralOptions = mistralApiKey ? { apiKey: mistralApiKey } : undefined
		const vercelAiGatewayOptions = vercelAiGatewayApiKey ? { apiKey: vercelAiGatewayApiKey } : undefined
		const openRouterOptions = openRouterApiKey ? { apiKey: openRouterApiKey } : undefined

		// Construct and return the config object
		return {
			embedderProvider,
			modelId: codebaseIndexEmbedderModelId || undefined,
			modelDimension,
			openAiOptions,
			ollamaOptions,
			openAiCompatibleOptions,
			geminiOptions,
			mistralOptions,
			vercelAiGatewayOptions,
			openRouterOptions,
			qdrantUrl: codebaseIndexQdrantUrl ?? "http://localhost:6333",
			qdrantApiKey: qdrantApiKey ?? "",
			searchMinScore: codebaseIndexSearchMinScore,
			searchMaxResults: codebaseIndexSearchMaxResults,
			neo4jEnabled: neo4jEnabled ?? false,
			neo4jUrl: neo4jUri ?? "bolt://localhost:7687",
			neo4jUsername: neo4jUsername ?? "neo4j",
			neo4jPassword: neo4jPassword ?? "",
			neo4jDatabase: "neo4j",
			configSchemaVersion,
			// We need to calculate isConfigured for the object to be complete according to interface
			isConfigured: this._calculateIsConfigured(embedderProvider, {
				openAiOptions,
				ollamaOptions,
				openAiCompatibleOptions,
				geminiOptions,
				mistralOptions,
				vercelAiGatewayOptions,
				openRouterOptions,
				qdrantUrl: codebaseIndexQdrantUrl ?? "http://localhost:6333",
				qdrantApiKey: qdrantApiKey ?? "",
			}),
		}
	}

	/**
	 * Helper to calculate isConfigured state for the config object
	 */
	private _calculateIsConfigured(provider: EmbedderProvider, options: any): boolean {
		const qdrantUrl = options.qdrantUrl
		if (!qdrantUrl) return false

		switch (provider) {
			case "openai":
				return !!options.openAiOptions?.openAiNativeApiKey
			case "ollama":
				return !!options.ollamaOptions?.ollamaBaseUrl
			case "openai-compatible":
				return !!(options.openAiCompatibleOptions?.baseUrl && options.openAiCompatibleOptions?.apiKey)
			case "gemini":
				return !!options.geminiOptions?.apiKey
			case "mistral":
				return !!options.mistralOptions?.apiKey
			case "vercel-ai-gateway":
				return !!options.vercelAiGatewayOptions?.apiKey
			case "openrouter":
				return !!options.openRouterOptions?.apiKey
			default:
				return false
		}
	}

	/**
	 * Applies a configuration object to the instance state.
	 */
	private _applyConfiguration(config: CodeIndexConfig): void {
		// Read codebaseIndexEnabled from VSCode settings again to be sure (or trust the config object if we passed it)
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {}
		const vscodeSettingEnabled = vscode.workspace.getConfiguration("roo-cline").get<boolean>("codeIndex.enabled")
		this.codebaseIndexEnabled = vscodeSettingEnabled ?? codebaseIndexConfig.codebaseIndexEnabled ?? true

		this.embedderProvider = config.embedderProvider
		this.modelId = config.modelId
		this.modelDimension = config.modelDimension
		this.openAiOptions = config.openAiOptions
		this.ollamaOptions = config.ollamaOptions
		this.openAiCompatibleOptions = config.openAiCompatibleOptions
		this.geminiOptions = config.geminiOptions
		this.mistralOptions = config.mistralOptions
		this.vercelAiGatewayOptions = config.vercelAiGatewayOptions
		this.openRouterOptions = config.openRouterOptions
		this.qdrantUrl = config.qdrantUrl
		this.qdrantApiKey = config.qdrantApiKey
		this.searchMinScore = config.searchMinScore
		this.searchMaxResults = config.searchMaxResults
		this.neo4jEnabled = config.neo4jEnabled ?? false
		this.neo4jUrl = config.neo4jUrl
		this.neo4jUsername = config.neo4jUsername
		this.neo4jPassword = config.neo4jPassword
		this.neo4jDatabase = config.neo4jDatabase
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isConfigured: boolean
			embedderProvider: EmbedderProvider
			modelId?: string
			modelDimension?: number
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
			geminiOptions?: { apiKey: string }
			mistralOptions?: { apiKey: string }
			vercelAiGatewayOptions?: { apiKey: string }
			openRouterOptions?: { apiKey: string }
			qdrantUrl?: string
			qdrantApiKey?: string
			searchMinScore?: number
			searchMaxResults?: number
			neo4jEnabled: boolean
			neo4jUrl?: string
			neo4jUsername?: string
			neo4jPassword?: string
			neo4jDatabase?: string
		}
		requiresRestart: boolean
	}> {
		// Capture the ACTUAL previous state before loading new configuration
		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.codebaseIndexEnabled,
			configured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			modelDimension: this.modelDimension,
			openAiKey: this.openAiOptions?.openAiNativeApiKey ?? "",
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl ?? "",
			openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
			openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
			geminiApiKey: this.geminiOptions?.apiKey ?? "",
			mistralApiKey: this.mistralOptions?.apiKey ?? "",
			vercelAiGatewayApiKey: this.vercelAiGatewayOptions?.apiKey ?? "",
			openRouterApiKey: this.openRouterOptions?.apiKey ?? "",
			qdrantUrl: this.qdrantUrl ?? "",
			qdrantApiKey: this.qdrantApiKey ?? "",
			// Neo4j configuration snapshot
			neo4jEnabled: this.neo4jEnabled,
			neo4jUrl: this.neo4jUrl ?? "",
			neo4jUsername: this.neo4jUsername ?? "",
			neo4jPassword: this.neo4jPassword ?? "",
			neo4jDatabase: this.neo4jDatabase ?? "",
		}

		// Refresh secrets from VSCode storage to ensure we have the latest values
		await this.contextProxy.refreshSecrets()

		// Read new configuration candidate
		let newConfig = this._readConfigurationFromStorage()

		// Check for migration
		const migrator = new ConfigMigrator(this.contextProxy)
		if (migrator.needsMigration(newConfig)) {
			try {
				newConfig = await migrator.migrateConfig(newConfig)

				// Update global state with the new version to prevent re-migration
				// We only update the version and any fields that might have been added/changed in globalState structure
				// For now, we just update the version to mark it as migrated.
				const currentGlobalState = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {}
				await this.contextProxy.updateGlobalState("codebaseIndexConfig", {
					...currentGlobalState,
					configSchemaVersion: newConfig.configSchemaVersion,
				} as any)
			} catch (error) {
				console.error("Configuration migration failed:", error)
				vscode.window.showErrorMessage(`Configuration Migration Failed: ${error}`)
				// Return without applying changes
				return {
					configSnapshot: previousConfigSnapshot,
					currentConfig: {
						isConfigured: this.isConfigured(),
						embedderProvider: this.embedderProvider,
						modelId: this.modelId,
						modelDimension: this.modelDimension,
						openAiOptions: this.openAiOptions,
						ollamaOptions: this.ollamaOptions,
						openAiCompatibleOptions: this.openAiCompatibleOptions,
						geminiOptions: this.geminiOptions,
						mistralOptions: this.mistralOptions,
						vercelAiGatewayOptions: this.vercelAiGatewayOptions,
						openRouterOptions: this.openRouterOptions,
						qdrantUrl: this.qdrantUrl,
						qdrantApiKey: this.qdrantApiKey,
						searchMinScore: this.currentSearchMinScore,
						searchMaxResults: this.searchMaxResults,
						neo4jEnabled: this.neo4jEnabled,
						neo4jUrl: this.neo4jUrl,
						neo4jUsername: this.neo4jUsername,
						neo4jPassword: this.neo4jPassword,
						neo4jDatabase: this.neo4jDatabase,
					},
					requiresRestart: false,
				}
			}
		}

		// Validate configuration
		const validationResult = ConfigValidator.validateConfig(newConfig)

		if (!validationResult.valid) {
			// Log errors
			console.error("Configuration validation failed:", validationResult.errors)

			// Show notification to user
			vscode.window.showErrorMessage(`Code Index Configuration Error: ${validationResult.errors[0].message}`)

			// Do NOT apply configuration. Keep existing state.
			// We return the existing state as if nothing changed, but with requiresRestart = false
			return {
				configSnapshot: previousConfigSnapshot,
				currentConfig: {
					isConfigured: this.isConfigured(),
					embedderProvider: this.embedderProvider,
					modelId: this.modelId,
					modelDimension: this.modelDimension,
					openAiOptions: this.openAiOptions,
					ollamaOptions: this.ollamaOptions,
					openAiCompatibleOptions: this.openAiCompatibleOptions,
					geminiOptions: this.geminiOptions,
					mistralOptions: this.mistralOptions,
					vercelAiGatewayOptions: this.vercelAiGatewayOptions,
					openRouterOptions: this.openRouterOptions,
					qdrantUrl: this.qdrantUrl,
					qdrantApiKey: this.qdrantApiKey,
					searchMinScore: this.currentSearchMinScore,
					searchMaxResults: this.searchMaxResults,
					neo4jEnabled: this.neo4jEnabled,
					neo4jUrl: this.neo4jUrl,
					neo4jUsername: this.neo4jUsername,
					neo4jPassword: this.neo4jPassword,
					neo4jDatabase: this.neo4jDatabase,
				},
				requiresRestart: false,
			}
		}

		// Log warnings if any
		if (validationResult.warnings.length > 0) {
			console.warn("Configuration validation warnings:", validationResult.warnings)
		}

		// Apply valid configuration
		this._applyConfiguration(newConfig)

		const requiresRestart = this.doesConfigChangeRequireRestart(previousConfigSnapshot)

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				modelDimension: this.modelDimension,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				geminiOptions: this.geminiOptions,
				mistralOptions: this.mistralOptions,
				vercelAiGatewayOptions: this.vercelAiGatewayOptions,
				openRouterOptions: this.openRouterOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
				searchMinScore: this.currentSearchMinScore,
				searchMaxResults: this.searchMaxResults,
				neo4jEnabled: this.neo4jEnabled,
				neo4jUrl: this.neo4jUrl,
				neo4jUsername: this.neo4jUsername,
				neo4jPassword: this.neo4jPassword,
				neo4jDatabase: this.neo4jDatabase,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 *
	 * REQUIRED for all configurations:
	 * - Qdrant URL (vector store - always required)
	 * - Embedder-specific credentials (API key or base URL)
	 *
	 * OPTIONAL:
	 * - Neo4j configuration (can be enabled/disabled independently)
	 *
	 * The feature is considered "configured" when Qdrant + embedder are set up,
	 * regardless of Neo4j status.
	 */
	public isConfigured(): boolean {
		if (this.embedderProvider === "openai") {
			const openAiKey = this.openAiOptions?.openAiNativeApiKey
			const qdrantUrl = this.qdrantUrl
			return !!(openAiKey && qdrantUrl)
		} else if (this.embedderProvider === "ollama") {
			// Ollama model ID has a default, so only base URL is strictly required for config
			const ollamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl
			const qdrantUrl = this.qdrantUrl
			return !!(ollamaBaseUrl && qdrantUrl)
		} else if (this.embedderProvider === "openai-compatible") {
			const baseUrl = this.openAiCompatibleOptions?.baseUrl
			const apiKey = this.openAiCompatibleOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(baseUrl && apiKey && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "gemini") {
			const apiKey = this.geminiOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(apiKey && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "mistral") {
			const apiKey = this.mistralOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(apiKey && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "vercel-ai-gateway") {
			const apiKey = this.vercelAiGatewayOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(apiKey && qdrantUrl)
			return isConfigured
		} else if (this.embedderProvider === "openrouter") {
			const apiKey = this.openRouterOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			const isConfigured = !!(apiKey && qdrantUrl)
			return isConfigured
		}
		return false // Should not happen if embedderProvider is always set correctly
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 * Simplified logic: only restart for critical changes that affect service functionality.
	 *
	 * CRITICAL CHANGES (require restart):
	 * - Provider changes (openai -> ollama, etc.)
	 * - Authentication changes (API keys, base URLs)
	 * - Vector dimension changes (model changes that affect embedding size)
	 * - Qdrant connection changes (URL, API key)
	 * - Feature enable/disable transitions
	 *
	 * MINOR CHANGES (no restart needed):
	 * - Search minimum score adjustments
	 * - UI-only settings
	 * - Non-functional configuration tweaks
	 */
	doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured()

		// Handle null/undefined values safely
		const prevEnabled = prev?.enabled ?? false
		const prevConfigured = prev?.configured ?? false
		const prevProvider = prev?.embedderProvider ?? "openai"
		const prevOpenAiKey = prev?.openAiKey ?? ""
		const prevOllamaBaseUrl = prev?.ollamaBaseUrl ?? ""
		const prevOpenAiCompatibleBaseUrl = prev?.openAiCompatibleBaseUrl ?? ""
		const prevOpenAiCompatibleApiKey = prev?.openAiCompatibleApiKey ?? ""
		const prevModelDimension = prev?.modelDimension
		const prevGeminiApiKey = prev?.geminiApiKey ?? ""
		const prevMistralApiKey = prev?.mistralApiKey ?? ""
		const prevVercelAiGatewayApiKey = prev?.vercelAiGatewayApiKey ?? ""
		const prevOpenRouterApiKey = prev?.openRouterApiKey ?? ""
		const prevQdrantUrl = prev?.qdrantUrl ?? ""
		const prevQdrantApiKey = prev?.qdrantApiKey ?? ""
		const prevNeo4jEnabled = prev?.neo4jEnabled ?? false
		const prevNeo4jUrl = prev?.neo4jUrl ?? ""
		const prevNeo4jUsername = prev?.neo4jUsername ?? ""
		const prevNeo4jPassword = prev?.neo4jPassword ?? ""
		const prevNeo4jDatabase = prev?.neo4jDatabase ?? ""

		// 1. Transition from disabled/unconfigured to enabled/configured
		if ((!prevEnabled || !prevConfigured) && this.codebaseIndexEnabled && nowConfigured) {
			return true
		}

		// 2. Transition from enabled to disabled
		if (prevEnabled && !this.codebaseIndexEnabled) {
			return true
		}

		// 3. If wasn't ready before and isn't ready now, no restart needed
		if ((!prevEnabled || !prevConfigured) && (!this.codebaseIndexEnabled || !nowConfigured)) {
			return false
		}

		// 4. CRITICAL CHANGES - Always restart for these
		// Only check for critical changes if feature is enabled
		if (!this.codebaseIndexEnabled) {
			return false
		}

		// Provider change
		if (prevProvider !== this.embedderProvider) {
			return true
		}

		// Authentication changes (API keys)
		const currentOpenAiKey = this.openAiOptions?.openAiNativeApiKey ?? ""
		const currentOllamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl ?? ""
		const currentOpenAiCompatibleBaseUrl = this.openAiCompatibleOptions?.baseUrl ?? ""
		const currentOpenAiCompatibleApiKey = this.openAiCompatibleOptions?.apiKey ?? ""
		const currentModelDimension = this.modelDimension
		const currentGeminiApiKey = this.geminiOptions?.apiKey ?? ""
		const currentMistralApiKey = this.mistralOptions?.apiKey ?? ""
		const currentVercelAiGatewayApiKey = this.vercelAiGatewayOptions?.apiKey ?? ""
		const currentOpenRouterApiKey = this.openRouterOptions?.apiKey ?? ""
		const currentQdrantUrl = this.qdrantUrl ?? ""
		const currentQdrantApiKey = this.qdrantApiKey ?? ""

		if (prevOpenAiKey !== currentOpenAiKey) {
			return true
		}

		if (prevOllamaBaseUrl !== currentOllamaBaseUrl) {
			return true
		}

		if (
			prevOpenAiCompatibleBaseUrl !== currentOpenAiCompatibleBaseUrl ||
			prevOpenAiCompatibleApiKey !== currentOpenAiCompatibleApiKey
		) {
			return true
		}

		if (prevGeminiApiKey !== currentGeminiApiKey) {
			return true
		}

		if (prevMistralApiKey !== currentMistralApiKey) {
			return true
		}

		if (prevVercelAiGatewayApiKey !== currentVercelAiGatewayApiKey) {
			return true
		}

		if (prevOpenRouterApiKey !== currentOpenRouterApiKey) {
			return true
		}

		// Check for model dimension changes (generic for all providers)
		if (prevModelDimension !== currentModelDimension) {
			return true
		}

		if (prevQdrantUrl !== currentQdrantUrl || prevQdrantApiKey !== currentQdrantApiKey) {
			return true
		}

		// Neo4j configuration changes (requires restart if enabled/disabled or connection details change)
		const currentNeo4jEnabled = this.neo4jEnabled
		const currentNeo4jUrl = this.neo4jUrl ?? ""
		const currentNeo4jUsername = this.neo4jUsername ?? ""
		const currentNeo4jPassword = this.neo4jPassword ?? ""
		const currentNeo4jDatabase = this.neo4jDatabase ?? ""

		if (prevNeo4jEnabled !== currentNeo4jEnabled) {
			return true // Enabling/disabling Neo4j requires restart
		}

		// Only check Neo4j connection details if Neo4j is enabled
		if (currentNeo4jEnabled) {
			if (
				prevNeo4jUrl !== currentNeo4jUrl ||
				prevNeo4jUsername !== currentNeo4jUsername ||
				prevNeo4jPassword !== currentNeo4jPassword ||
				prevNeo4jDatabase !== currentNeo4jDatabase
			) {
				return true
			}
		}

		// Vector dimension changes (still important for compatibility)
		if (this._hasVectorDimensionChanged(prevProvider, prev?.modelId)) {
			return true
		}

		return false
	}

	/**
	 * Checks if model changes result in vector dimension changes that require restart.
	 */
	private _hasVectorDimensionChanged(prevProvider: EmbedderProvider, prevModelId?: string): boolean {
		const currentProvider = this.embedderProvider
		const currentModelId = this.modelId ?? getDefaultModelId(currentProvider)
		const resolvedPrevModelId = prevModelId ?? getDefaultModelId(prevProvider)

		// If model IDs are the same and provider is the same, no dimension change
		if (prevProvider === currentProvider && resolvedPrevModelId === currentModelId) {
			return false
		}

		// Get vector dimensions for both models
		const prevDimension = getModelDimension(prevProvider, resolvedPrevModelId)
		const currentDimension = getModelDimension(currentProvider, currentModelId)

		// If we can't determine dimensions, be safe and restart
		if (prevDimension === undefined || currentDimension === undefined) {
			return true
		}

		// Only restart if dimensions actually changed
		return prevDimension !== currentDimension
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			modelDimension: this.modelDimension,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			geminiOptions: this.geminiOptions,
			mistralOptions: this.mistralOptions,
			vercelAiGatewayOptions: this.vercelAiGatewayOptions,
			openRouterOptions: this.openRouterOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
			searchMinScore: this.currentSearchMinScore,
			searchMaxResults: this.currentSearchMaxResults,
			// Neo4j configuration
			neo4jEnabled: this.neo4jEnabled,
			neo4jUrl: this.neo4jUrl,
			neo4jUsername: this.neo4jUsername,
			neo4jPassword: this.neo4jPassword,
			neo4jDatabase: this.neo4jDatabase,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.codebaseIndexEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type (openai or ollama)
	 */
	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	/**
	 * Gets the current Qdrant configuration
	 */
	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}

	/**
	 * Gets whether Neo4j graph database integration is enabled.
	 *
	 * NOTE: Neo4j is OPTIONAL. The code indexing feature requires Qdrant (vector store)
	 * but can work with Qdrant alone. Neo4j provides additional graph-based relationships
	 * but is not required for basic code indexing functionality.
	 *
	 * Users CANNOT use Neo4j without Qdrant - Qdrant is always required.
	 */
	public get isNeo4jEnabled(): boolean {
		return this.neo4jEnabled
	}

	/**
	 * Gets the current Neo4j configuration
	 */
	public get neo4jConfig(): {
		enabled: boolean
		url?: string
		username?: string
		password?: string
		database?: string
	} {
		return {
			enabled: this.neo4jEnabled,
			url: this.neo4jUrl,
			username: this.neo4jUsername,
			password: this.neo4jPassword,
			database: this.neo4jDatabase,
		}
	}

	/**
	 * Gets the current model ID being used for embeddings.
	 */
	public get currentModelId(): string | undefined {
		return this.modelId
	}

	/**
	 * Gets the current model dimension being used for embeddings.
	 * Returns the model's built-in dimension if available, otherwise falls back to custom dimension.
	 */
	public get currentModelDimension(): number | undefined {
		// First try to get the model-specific dimension
		const modelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelDimension = getModelDimension(this.embedderProvider, modelId)

		// Only use custom dimension if model doesn't have a built-in dimension
		if (!modelDimension && this.modelDimension && this.modelDimension > 0) {
			return this.modelDimension
		}

		return modelDimension
	}

	/**
	 * Gets the configured minimum search score based on user setting, model-specific threshold, or fallback.
	 * Priority: 1) User setting, 2) Model-specific threshold, 3) Default DEFAULT_SEARCH_MIN_SCORE constant.
	 */
	public get currentSearchMinScore(): number {
		// First check if user has configured a custom score threshold
		if (this.searchMinScore !== undefined) {
			return this.searchMinScore
		}

		// Fall back to model-specific threshold
		const currentModelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelSpecificThreshold = getModelScoreThreshold(this.embedderProvider, currentModelId)
		return modelSpecificThreshold ?? DEFAULT_SEARCH_MIN_SCORE
	}

	/**
	 * Gets the configured maximum search results.
	 * Returns user setting if configured, otherwise returns default.
	 */
	public get currentSearchMaxResults(): number {
		return this.searchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS
	}
}
