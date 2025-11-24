import * as vscode from "vscode"
import { vi, describe, it, expect, beforeEach, type Mock, type Mocked } from "vitest"
import { ConfigMigrator } from "../config-migrator"
import { ContextProxy } from "../../../core/config/ContextProxy"
import { CodeIndexConfig } from "../interfaces/config"

// Mock dependencies
vi.mock("vscode")
vi.mock("../../../core/config/ContextProxy")

describe("ConfigMigrator", () => {
	let migrator: ConfigMigrator
	let mockContextProxy: Mocked<ContextProxy>
	let mockFs: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockContextProxy = {
			globalStorageUri: { fsPath: "/mock/storage" },
			updateGlobalState: vi.fn(),
		} as any

		mockFs = {
			createDirectory: vi.fn(),
			writeFile: vi.fn(),
		}
		;(vscode.workspace.fs as any) = mockFs
		;(vscode.Uri.joinPath as Mock) = vi.fn((uri, ...parts) => ({
			fsPath: `${uri.fsPath}/${parts.join("/")}`,
		}))

		migrator = new ConfigMigrator(mockContextProxy)
	})

	it("should identify legacy config (no version) as needing migration", () => {
		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
			// No configSchemaVersion
		} as any

		expect(migrator.needsMigration(config)).toBe(true)
	})

	it("should identify older version as needing migration", () => {
		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
			configSchemaVersion: "0.9.0",
		} as any

		expect(migrator.needsMigration(config)).toBe(true)
	})

	it("should NOT migrate current version", () => {
		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
			configSchemaVersion: "1.0.0", // Assuming 1.0.0 is current
		} as any

		expect(migrator.needsMigration(config)).toBe(false)
	})

	it("should migrate legacy config to version 1.0.0 and set defaults", async () => {
		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
			neo4jEnabled: true,
			// Missing Neo4j details
		} as any

		const migrated = await migrator.migrateConfig(config)

		expect(migrated.configSchemaVersion).toBe("1.0.0")
		expect(migrated.neo4jCircuitBreakerThreshold).toBe(5) // Default added
		expect(migrated.neo4jMaxConnectionPoolSize).toBe(50) // Default added
	})

	it("should create backup before migration", async () => {
		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
		} as any

		await migrator.migrateConfig(config)

		expect(mockFs.createDirectory).toHaveBeenCalled()
		expect(mockFs.writeFile).toHaveBeenCalled()
	})

	it("should handle backup failure gracefully and continue migration", async () => {
		mockFs.writeFile.mockRejectedValue(new Error("Write failed"))
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		const config: CodeIndexConfig = {
			isConfigured: true,
			embedderProvider: "openai",
		} as any

		// Should not throw
		const migrated = await migrator.migrateConfig(config)

		expect(migrated.configSchemaVersion).toBe("1.0.0")
		expect(consoleSpy).toHaveBeenCalled()
		consoleSpy.mockRestore()
	})
})
