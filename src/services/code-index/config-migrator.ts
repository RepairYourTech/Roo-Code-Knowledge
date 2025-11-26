import * as vscode from "vscode"
import { CodeIndexConfig } from "./interfaces/config"
import { ContextProxy } from "../../core/config/ContextProxy"

/**
 * Service for migrating configuration between schema versions.
 * Handles schema updates, data transformation, and backup creation.
 */
export class ConfigMigrator {
	private static readonly CURRENT_SCHEMA_VERSION = "1.0.0"
	private static readonly BACKUP_PREFIX = "codeIndexConfig_backup_"

	constructor(private readonly contextProxy: ContextProxy) {}

	/**
	 * Checks if the current configuration needs migration.
	 *
	 * @param config The current configuration object
	 * @returns True if migration is needed
	 */
	public needsMigration(config: CodeIndexConfig): boolean {
		if (!config) return false

		// If no version is present, it's a legacy config that needs migration (or initial setup)
		// For now, we assume if it has data but no version, it might need migration.
		// However, if it's a fresh install, it might also have no version.
		// We can check if specific legacy fields exist or if the version is lower than current.

		const configVersion = config.configSchemaVersion

		// If no version, we treat it as version 0.0.0
		if (!configVersion) {
			// Check if there is actual data to migrate. If config is empty/default, maybe we just set the version.
			// For this implementation, we'll assume any config without a version needs "migration"
			// (which might just be adding the version).
			return true
		}

		return this.compareVersions(configVersion, ConfigMigrator.CURRENT_SCHEMA_VERSION) < 0
	}

	/**
	 * Migrates the configuration to the current schema version.
	 *
	 * @param config The configuration to migrate
	 * @returns The migrated configuration
	 */
	public async migrateConfig(config: CodeIndexConfig): Promise<CodeIndexConfig> {
		const currentVersion = config.configSchemaVersion || "0.0.0"

		if (this.compareVersions(currentVersion, ConfigMigrator.CURRENT_SCHEMA_VERSION) >= 0) {
			return config
		}

		console.log(
			`Migrating configuration from version ${currentVersion} to ${ConfigMigrator.CURRENT_SCHEMA_VERSION}`,
		)

		// Create a backup before migrating
		await this.createBackup(config)

		let migratedConfig = { ...config }

		// Migration steps
		// Example: 0.0.0 -> 1.0.0
		if (this.compareVersions(currentVersion, "1.0.0") < 0) {
			migratedConfig = this.migrateToVersion1_0_0(migratedConfig)
		}

		// Future migrations:
		// if (this.compareVersions(currentVersion, "2.0.0") < 0) {
		//     migratedConfig = this.migrateToVersion2_0_0(migratedConfig)
		// }

		return migratedConfig
	}

	/**
	 * Creates a backup of the current configuration.
	 *
	 * @param config The configuration to backup
	 */
	public async createBackup(config: CodeIndexConfig): Promise<void> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const backupFileName = `${ConfigMigrator.BACKUP_PREFIX}${timestamp}.json`

		try {
			const storageUri = this.contextProxy.globalStorageUri
			const backupUri = vscode.Uri.joinPath(storageUri, "config-backups", backupFileName)

			// Ensure backup directory exists
			const backupDir = vscode.Uri.joinPath(storageUri, "config-backups")
			await vscode.workspace.fs.createDirectory(backupDir)

			// Write backup file
			const backupData = new TextEncoder().encode(JSON.stringify(config, null, 2))
			await vscode.workspace.fs.writeFile(backupUri, backupData)

			console.log(`Configuration backup created at: ${backupUri.fsPath}`)
		} catch (error) {
			console.error("Failed to create configuration backup:", error)
			// We don't throw here to allow migration to proceed even if backup fails,
			// but we log the error.
		}
	}

	/**
	 * Migration step to version 1.0.0
	 * Adds configSchemaVersion and ensures default values for new fields.
	 */
	private migrateToVersion1_0_0(config: CodeIndexConfig): CodeIndexConfig {
		const newConfig = { ...config }

		// Set the new version
		newConfig.configSchemaVersion = "1.0.0"

		// Ensure Neo4j defaults if enabled but missing details
		if (newConfig.neo4jEnabled) {
			if (
				newConfig.neo4jCircuitBreakerThreshold === undefined ||
				newConfig.neo4jCircuitBreakerThreshold === null
			) {
				newConfig.neo4jCircuitBreakerThreshold = 5
			}
			if (newConfig.neo4jMaxConnectionPoolSize === undefined || newConfig.neo4jMaxConnectionPoolSize === null) {
				newConfig.neo4jMaxConnectionPoolSize = 50
			}
		}

		return newConfig
	}

	/**
	 * Compares two semantic version strings.
	 * Returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2.
	 */
	private compareVersions(v1: string, v2: string): number {
		const parts1 = v1.split(".").map(Number)
		const parts2 = v2.split(".").map(Number)

		for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
			const p1 = parts1[i] || 0
			const p2 = parts2[i] || 0

			if (p1 < p2) return -1
			if (p1 > p2) return 1
		}

		return 0
	}
}
