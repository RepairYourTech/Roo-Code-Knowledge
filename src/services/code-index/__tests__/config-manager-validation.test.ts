import * as vscode from "vscode"
import { vi, describe, it, expect, beforeEach, type Mock, type Mocked } from "vitest"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { ConfigValidator } from "../config-validator"

// Mock dependencies
vi.mock("vscode")
vi.mock("../../../core/config/ContextProxy")

describe("CodeIndexConfigManager Validation", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: Mocked<ContextProxy>
	let mockGlobalState: Record<string, any>
	let mockSecrets: Record<string, string>

	beforeEach(() => {
		vi.clearAllMocks()
		mockGlobalState = {}
		mockSecrets = {}

		// Setup ContextProxy mock
		mockContextProxy = {
			getGlobalState: vi.fn((key: string) => mockGlobalState[key]),
			getSecret: vi.fn((key: string) => mockSecrets[key]),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
			updateGlobalState: vi.fn(),
		} as any

		// Setup VS Code configuration mock
		;(vscode.workspace.getConfiguration as Mock).mockReturnValue({
			get: vi.fn((key: string) => {
				if (key === "codeIndex.enabled") return true
				return undefined
			}),
		})
	})

	it("should load valid configuration successfully", async () => {
		// Setup valid config
		mockGlobalState["codebaseIndexConfig"] = {
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
		}
		mockSecrets["codeIndexOpenAiKey"] = "sk-valid-api-key-for-testing-purposes"
		mockSecrets["codeIndexQdrantApiKey"] = "valid-qdrant-key"

		configManager = new CodeIndexConfigManager(mockContextProxy)
		const result = await configManager.loadConfiguration()

		expect(result.currentConfig.isConfigured).toBe(true)
		expect(result.currentConfig.embedderProvider).toBe("openai")
	})

	it("should reject invalid configuration and return previous snapshot", async () => {
		// 1. Initialize with valid config
		mockGlobalState["codebaseIndexConfig"] = {
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
		}
		mockSecrets["codeIndexOpenAiKey"] = "sk-valid-api-key-for-testing-purposes"

		configManager = new CodeIndexConfigManager(mockContextProxy)

		// 2. Attempt to load invalid config (invalid URL)
		mockGlobalState["codebaseIndexConfig"] = {
			...mockGlobalState["codebaseIndexConfig"],
			codebaseIndexQdrantUrl: "not-a-url",
		}

		const result = await configManager.loadConfiguration()

		// Should return previous valid state (from initialization)
		// Note: Since we initialized with valid config, previous snapshot should reflect that.
		// However, loadConfiguration captures snapshot *before* loading new config.
		// So result.configSnapshot should be the valid one.
		// And result.currentConfig should match snapshot because validation failed.

		expect(result.currentConfig.qdrantUrl).toBe("http://localhost:6333") // The initial valid one
		expect(vscode.window.showErrorMessage).toHaveBeenCalled()
	})

	it("should warn on production safety issues but apply config", async () => {
		// Setup config with warnings (e.g. test key)
		mockGlobalState["codebaseIndexConfig"] = {
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
		}
		mockSecrets["codeIndexOpenAiKey"] = "sk-test-key-12345678901234567890" // Test key pattern

		configManager = new CodeIndexConfigManager(mockContextProxy)

		// Spy on console.warn
		const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

		const result = await configManager.loadConfiguration()

		// Should still apply the config because warnings don't block
		expect(result.currentConfig.openAiOptions?.openAiNativeApiKey).toContain("sk-test-key")
		expect(consoleSpy).toHaveBeenCalled()

		consoleSpy.mockRestore()
	})

	it("should validate Neo4j configuration when enabled", async () => {
		// Setup config with Neo4j enabled but invalid URI
		mockGlobalState["codebaseIndexConfig"] = {
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
			neo4jEnabled: true,
			neo4jUri: "invalid-protocol://localhost",
		}
		mockSecrets["codeIndexOpenAiKey"] = "sk-valid-api-key-for-testing-purposes"

		configManager = new CodeIndexConfigManager(mockContextProxy)
		const result = await configManager.loadConfiguration()

		// Should reject due to invalid Neo4j URI
		expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("protocol"))
		// Should have reverted to default/previous (where Neo4j is disabled by default)
		expect(result.currentConfig.neo4jEnabled).toBe(false)
	})
})
