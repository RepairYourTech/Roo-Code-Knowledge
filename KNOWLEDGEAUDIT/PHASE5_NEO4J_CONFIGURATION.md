# Phase 5: Neo4j Graph Database Integration - Configuration Guide

**Status:** Task 5.1 Complete ✅  
**Date:** 2025-11-19

## Overview

Neo4j integration is **completely optional** and disabled by default. Users can enable it to gain graph-based code navigation capabilities like "find all callers of this function" or "show me the dependency graph".

## Configuration Options

### 1. Master Switch

- **`codebaseIndexNeo4jEnabled`** (boolean, default: `false`)
    - Master switch to enable/disable Neo4j integration
    - When `false`, no Neo4j connections are made and no graph indexing occurs
    - Changing this value requires a restart

### 2. Connection Settings

- **`codebaseIndexNeo4jUrl`** (string, default: `"bolt://localhost:7687"`)

    - Neo4j connection URL
    - Supports `bolt://`, `neo4j://`, `bolt+s://`, `neo4j+s://` protocols
    - Example: `"bolt://localhost:7687"` for local instance
    - Example: `"neo4j+s://xxx.databases.neo4j.io"` for Neo4j Aura

- **`codebaseIndexNeo4jUsername`** (string, default: `"neo4j"`)

    - Username for Neo4j authentication
    - Default user is typically `"neo4j"`

- **`codebaseIndexNeo4jPassword`** (secret)

    - Password for Neo4j authentication
    - Stored securely via VSCode secrets API
    - Secret key: `"codebaseIndexNeo4jPassword"`

- **`codebaseIndexNeo4jDatabase`** (string, default: `"neo4j"`)
    - Database name to use
    - Default database is `"neo4j"`
    - Neo4j Community Edition only supports one database

## Storage Locations

### Global State (Non-Sensitive)

Stored in VSCode global state (`codebaseIndexConfig`):

```typescript
{
  codebaseIndexNeo4jEnabled: false,
  codebaseIndexNeo4jUrl: "bolt://localhost:7687",
  codebaseIndexNeo4jUsername: "neo4j",
  codebaseIndexNeo4jDatabase: "neo4j"
}
```

### Secrets (Sensitive)

Stored in VSCode secrets API:

- `codebaseIndexNeo4jPassword` - Neo4j password

## Configuration Manager API

### Getters

```typescript
// Check if Neo4j is enabled
configManager.isNeo4jEnabled // boolean

// Get full Neo4j configuration
configManager.neo4jConfig // { enabled, url, username, password, database }
```

### Configuration Loading

Neo4j configuration is loaded in `_loadAndSetConfiguration()` and included in:

1. `getConfig()` - Returns current configuration state
2. `loadConfiguration()` - Loads from storage and detects changes
3. `doesConfigChangeRequireRestart()` - Detects if restart is needed

### Restart Detection

Changes to Neo4j configuration trigger a restart if:

1. **Enabled/Disabled**: `neo4jEnabled` changes from `true` to `false` or vice versa
2. **Connection Changes** (only when enabled):
    - `neo4jUrl` changes
    - `neo4jUsername` changes
    - `neo4jPassword` changes
    - `neo4jDatabase` changes

## Implementation Details

### Files Modified

1. **`src/services/code-index/interfaces/config.ts`**

    - Added Neo4j fields to `CodeIndexConfig` interface
    - Added Neo4j fields to `PreviousConfigSnapshot` type

2. **`src/services/code-index/config-manager.ts`**
    - Added private fields for Neo4j configuration
    - Updated `_loadAndSetConfiguration()` to load Neo4j settings
    - Updated `loadConfiguration()` to snapshot Neo4j state
    - Updated `getConfig()` to return Neo4j configuration
    - Added `isNeo4jEnabled` getter
    - Added `neo4jConfig` getter
    - Updated `doesConfigChangeRequireRestart()` to detect Neo4j changes

### Default Values

All Neo4j configuration has safe defaults:

- **Enabled**: `false` (disabled by default)
- **URL**: `"bolt://localhost:7687"` (standard local Neo4j)
- **Username**: `"neo4j"` (default Neo4j username)
- **Password**: `""` (empty, must be configured by user)
- **Database**: `"neo4j"` (default database name)

## Backward Compatibility

✅ **Fully backward compatible**

- Existing configurations without Neo4j settings work unchanged
- Neo4j is disabled by default
- No impact on existing vector/BM25 search functionality
- Users who don't enable Neo4j see no changes

## Next Steps

- **Task 5.2**: Install Neo4j Driver (`neo4j-driver` npm package)
- **Task 5.3**: Create Neo4j Service (connection management, queries)
- **Task 5.4**: Create Graph Indexer (extract relationships from code)
- **Task 5.5**: Integrate Neo4j into Pipeline (scanner, file watcher)

## Testing Checklist

- [ ] Configuration loads with Neo4j disabled (default)
- [ ] Configuration loads with Neo4j enabled
- [ ] Restart detection works for enabling/disabling Neo4j
- [ ] Restart detection works for connection changes
- [ ] Secrets are stored securely
- [ ] Backward compatibility maintained
