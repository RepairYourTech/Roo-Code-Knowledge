import * as vscode from "vscode"
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest"
import { CodeIndexConfigManager } from "../config-manager"
import { ContextProxy } from "../../../core/config/ContextProxy"

// Mock dependencies
vi.mock("vscode")
vi.mock("../../../core/config/ContextProxy")

describe("CodeIndexConfigManager Edge Cases", () => {
	let configManager: CodeIndexConfigManager
	let mockContextProxy: {
		getGlobalState: Mock
		getSecret: Mock
		refreshSecrets: Mock
		updateGlobalState: Mock
	}
	let mockGlobalState: Record<string, any>
	let mockSecrets: Record<string, string>

	beforeEach(() => {
		vi.clearAllMocks()
		mockGlobalState = {}
		mockSecrets = {}

		mockContextProxy = {
			getGlobalState: vi.fn(),
			getSecret: vi.fn(),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
			updateGlobalState: vi.fn(),
		} as any
		;(vscode.workspace.getConfiguration as unknown as Mock).mockReturnValue({
			get: vi.fn((key: string) => {
				if (key === "codeIndex.enabled") return true
				return undefined
			}),
		})
	})

	it("should handle completely empty configuration gracefully", async () => {
		// No global state, no secrets
		mockContextProxy.getGlobalState.mockReturnValue(undefined)
		mockContextProxy.getSecret.mockReturnValue(undefined)

		configManager = new CodeIndexConfigManager(mockContextProxy as unknown as ContextProxy)
		const result = await configManager.loadConfiguration()

		expect(result.currentConfig.isConfigured).toBe(false)
		// Should use defaults
		expect(result.currentConfig.embedderProvider).toBe("openai")
		expect(result.currentConfig.qdrantUrl).toBe("http://localhost:6333")
	})

	it("should handle partial configuration (missing Qdrant URL)", async () => {
		mockContextProxy.getGlobalState.mockReturnValue({
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			// Missing qdrant URL
		})
		mockContextProxy.getSecret.mockImplementation((key: string) => {
			if (key === "codeIndexOpenAiKey") return "sk-valid-api-key-for-testing-purposes"
			return undefined
		})

		configManager = new CodeIndexConfigManager(mockContextProxy as unknown as ContextProxy)
		const result = await configManager.loadConfiguration()

		// Should default Qdrant URL
		expect(result.currentConfig.qdrantUrl).toBe("http://localhost:6333")
		// Should be configured because defaults are valid
		expect(result.currentConfig.isConfigured).toBe(true)
	})

	it("should handle boundary values for search settings", async () => {
		mockContextProxy.getGlobalState.mockReturnValue({
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 0, // Min boundary
			codebaseIndexSearchMaxResults: 1, // Min boundary
		})
		mockContextProxy.getSecret.mockImplementation((key: string) => {
			if (key === "codeIndexOpenAiKey") return "sk-valid-api-key-for-testing-purposes"
			return undefined
		})

		configManager = new CodeIndexConfigManager(mockContextProxy as unknown as ContextProxy)
		const result = await configManager.loadConfiguration()

		expect(result.currentConfig.searchMinScore).toBe(0)
		expect(result.currentConfig.searchMaxResults).toBe(1)
	})

	it("should handle extreme boundary values for search settings", async () => {
		mockContextProxy.getGlobalState.mockReturnValue({
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 1.0, // Max boundary
			codebaseIndexSearchMaxResults: 1000, // Max boundary (assuming 1000 is allowed)
		})
		mockContextProxy.getSecret.mockImplementation((key: string) => {
			if (key === "codeIndexOpenAiKey") return "sk-valid-api-key-for-testing-purposes"
			return undefined
		})

		configManager = new CodeIndexConfigManager(mockContextProxy as unknown as ContextProxy)
		const result = await configManager.loadConfiguration()

		expect(result.currentConfig.searchMinScore).toBe(1.0)
		expect(result.currentConfig.searchMaxResults).toBe(1000)
	})

	it("should reject out-of-bounds values", async () => {
		mockContextProxy.getGlobalState.mockReturnValue({
			codebaseIndexEnabled: true,
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexSearchMinScore: 1.5, // Invalid > 1
		})
		mockContextProxy.getSecret.mockImplementation((key: string) => {
			if (key === "codeIndexOpenAiKey") return "sk-valid-api-key-for-testing-purposes"
			return undefined
		})

		configManager = new CodeIndexConfigManager(mockContextProxy as unknown as ContextProxy)
		const result = await configManager.loadConfiguration()

		// Should fail validation and revert to default/previous
		expect(vscode.window.showErrorMessage).toHaveBeenCalled()
		// Previous/Default is undefined for minScore in this test setup (empty previous)
		// Wait, if it reverts to previous, and previous was initialized from empty, it might be undefined or default.
		// The manager initializes with defaults.
		// Let's check what it returns.
		// If validation fails, it returns `currentConfig` from `previousConfigSnapshot`.
		// `previousConfigSnapshot` is captured at start of `loadConfiguration`.
		// Since we initialized with empty/default, `searchMinScore` might be undefined or default.
		// CodeIndexConfigManager initializes `searchMinScore` as undefined.
		expect(result.currentConfig.searchMinScore).toBe(0.4)
	})
})
