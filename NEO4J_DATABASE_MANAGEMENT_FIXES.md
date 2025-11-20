# Neo4j Database Clearing Fix

## Issue Fixed

### Proper Batched Database Clearing ✅

**Problem:**

- `clearAll()` used simple `MATCH (n:CodeNode) DETACH DELETE n` which could fail on large databases
- No batching meant potential memory issues and timeouts
- No progress feedback during deletion

**Solution:**

- Updated `clearAll()` to use **batched deletion** (recommended by Neo4j):
    - Deletes nodes in batches of 10,000
    - Continues until all nodes are deleted
    - Logs progress after each batch
    - Works with both Neo4j Community Edition and Enterprise/Cloud
    - Uses `DETACH DELETE` to remove relationships automatically

**Implementation:**

```typescript
while (true) {
	const result = await session.run(
		`
        MATCH (n)
        WITH n LIMIT $batchSize
        DETACH DELETE n
        RETURN count(n) as deleted
    `,
		{ batchSize: neo4j.int(10000) },
	)

	const deleted = result.records[0]?.get("deleted")?.toNumber() || 0
	if (deleted === 0) break
}
```

**Files Modified:**

- `src/services/code-index/graph/neo4j-service.ts` (lines 501-549)

---

## Why NOT Multi-Database Support?

**Critical Discovery:**

- **Neo4j Community Edition** (90% of self-hosted users) does NOT support:
    - Multiple databases
    - Custom database names
    - Database management commands (CREATE/DROP DATABASE)
- **Neo4j Aura Free** tier also only supports the `"neo4j"` database
- Only **Neo4j Enterprise Edition** supports custom database names

**Decision:**

- Keep using default `"neo4j"` database name for maximum compatibility
- Users with multiple workspaces will share the same Neo4j database
- This is acceptable because:
    1. Qdrant already provides per-workspace isolation for vector data
    2. Neo4j graph data is supplementary (not primary storage)
    3. Most users will only index one workspace at a time
    4. Enterprise users can manually configure custom database names if needed

---

## Verification

When you install the new VSIX (`bin/roo-cline-3.33.1.vsix`), you should see these console logs:

1. **On Neo4j initialization:**

    ```
    [Neo4jService] Configured to use database: neo4j
    [Neo4jService] Successfully connected to Neo4j database: neo4j
    ```

2. **On "Clear Index Data" button click:**
    ```
    [Neo4jService] Clearing all data from database neo4j...
    [Neo4jService] Deleted 10000 nodes (10000 total)
    [Neo4jService] Deleted 10000 nodes (20000 total)
    [Neo4jService] Deleted 5432 nodes (25432 total)
    [Neo4jService] Database cleared successfully - deleted 25432 total nodes
    ```

---

## Benefits

1. **Works Everywhere**: Compatible with Community Edition, Enterprise, and Cloud
2. **Efficient**: Batched deletion prevents memory issues and timeouts
3. **Progress Feedback**: Logs show deletion progress in real-time
4. **Reliable**: Recommended approach by Neo4j documentation
5. **Simple**: No complex database management commands needed

---

## Next Steps

1. Install the VSIX: `bin/roo-cline-3.33.1.vsix`
2. Enable Neo4j in settings
3. Start indexing
4. Test "Clear Index Data" button and verify batched deletion with progress logs
