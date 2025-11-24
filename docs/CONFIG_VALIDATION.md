# Configuration Validation and Migration

This document describes the configuration validation and migration system for the Code Indexing service.

## Overview

The Code Indexing service uses a robust configuration management system that ensures:

1.  **Runtime Validation**: All configuration values are validated before being applied.
2.  **Fail-Safe Behavior**: Invalid configurations are rejected, and the system reverts to the last known good state or safe defaults.
3.  **Schema Migration**: Configuration schemas are versioned, and automatic migration logic handles updates from older versions.
4.  **User Feedback**: Validation errors are surfaced to the user via VS Code notifications.

## Validation Rules

Configuration is validated using the `ConfigValidator` class. Key validation rules include:

### General

- **API Keys**: Must be non-empty strings if the provider requires them.
- **URLs**: Must be valid URLs with appropriate protocols (http/https/bolt).

### Embedder Settings

- **Model Dimensions**: Must be positive integers.
- **Batch Sizes**: Must be within safe limits (e.g., 1-100 for LSP).
- **Timeouts**: Must be positive integers.

### Search Settings

- **Min Score**: Must be between 0 and 1.
- **Max Results**: Must be a positive integer.

### Neo4j Settings (Optional)

- **Connection Pool**: Must be within safe limits (e.g., 1-100).
- **Circuit Breaker**: Thresholds must be positive.
- **Retries**: Must be non-negative.

## Migration System

The `ConfigMigrator` class handles configuration schema updates.

- **Versioning**: Configuration objects include a `configSchemaVersion` field.
- **Automatic Migration**: When loading configuration, the system checks if the version is outdated.
- **Backups**: Before applying any migration, a backup of the current configuration is saved to the global storage directory (`config-backups/`).
- **Idempotency**: Migrations are idempotent and only run when necessary.

## Error Handling

- **Validation Errors**: Prevent the configuration from being applied. The user is notified, and the error is logged.
- **Validation Warnings**: Logged to the console but do not block configuration application.
- **Migration Errors**: Prevent the new configuration from being applied. The system falls back to the previous valid state.

## Adding New Configuration

When adding new configuration properties:

1.  Update `CodeIndexConfig` interface in `src/services/code-index/interfaces/config.ts`.
2.  Add validation logic in `ConfigValidator` (`src/services/code-index/config-validator.ts`).
3.  Add default values in `CodeIndexConfigManager` (`src/services/code-index/config-manager.ts`).
4.  If the change requires migration (e.g., renaming fields, changing structure), update `ConfigMigrator` and increment `CURRENT_SCHEMA_VERSION`.
