# Neo4j Status Display - Implementation Checklist

## Overview

This checklist provides the exact files and line numbers to modify for implementing Neo4j progress tracking in the UI.

---

## Phase 1: Backend Type Definitions

### ✅ Task 1.1: Extend IndexingStatus Interface

**File:** `src/shared/ExtensionMessage.ts`  
**Line:** 41-48  
**Action:** Add optional Neo4j fields

```typescript
export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
	// ADD THESE:
	neo4jProcessedItems?: number
	neo4jTotalItems?: number
	neo4jStatus?: "idle" | "indexing" | "indexed" | "error" | "disabled"
	neo4jMessage?: string
}
```

---

## Phase 2: Backend State Management

### ✅ Task 2.1: Extend CodeIndexStateManager

**File:** `src/services/code-index/state-manager.ts`  
**Lines:** 6-11 (add new private fields)

```typescript
export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _processedItems: number = 0
	private _totalItems: number = 0
	private _currentItemUnit: string = "blocks"
	// ADD THESE:
	private _neo4jProcessedItems: number = 0
	private _neo4jTotalItems: number = 0
	private _neo4jStatus: "idle" | "indexing" | "indexed" | "error" | "disabled" = "disabled"
	private _neo4jMessage: string = ""
	private _progressEmitter = new vscode.EventEmitter<ReturnType<typeof this.getCurrentStatus>>()
```

### ✅ Task 2.2: Update getCurrentStatus Method

**File:** `src/services/code-index/state-manager.ts`  
**Lines:** 21-29

```typescript
public getCurrentStatus() {
	return {
		systemStatus: this._systemStatus,
		message: this._statusMessage,
		processedItems: this._processedItems,
		totalItems: this._totalItems,
		currentItemUnit: this._currentItemUnit,
		// ADD THESE:
		neo4jProcessedItems: this._neo4jProcessedItems,
		neo4jTotalItems: this._neo4jTotalItems,
		neo4jStatus: this._neo4jStatus,
		neo4jMessage: this._neo4jMessage,
	}
}
```

### ✅ Task 2.3: Add reportNeo4jIndexingProgress Method

**File:** `src/services/code-index/state-manager.ts`  
**Line:** 111 (after reportFileQueueProgress method)

```typescript
public reportNeo4jIndexingProgress(
	processedItems: number,
	totalItems: number,
	status?: "idle" | "indexing" | "indexed" | "error" | "disabled",
	message?: string,
): void {
	const progressChanged = processedItems !== this._neo4jProcessedItems || totalItems !== this._neo4jTotalItems
	const statusChanged = status && status !== this._neo4jStatus
	const messageChanged = message && message !== this._neo4jMessage

	if (progressChanged || statusChanged || messageChanged) {
		this._neo4jProcessedItems = processedItems
		this._neo4jTotalItems = totalItems
		if (status !== undefined) this._neo4jStatus = status
		if (message !== undefined) this._neo4jMessage = message

		this._progressEmitter.fire(this.getCurrentStatus())
	}
}

public setNeo4jStatus(status: "idle" | "indexing" | "indexed" | "error" | "disabled", message?: string): void {
	if (status !== this._neo4jStatus || (message && message !== this._neo4jMessage)) {
		this._neo4jStatus = status
		if (message !== undefined) this._neo4jMessage = message
		this._progressEmitter.fire(this.getCurrentStatus())
	}
}
```

---

## Phase 3: Backend Progress Tracking

### ✅ Task 3.1: Update DirectoryScanner - Neo4j Progress

**File:** `src/services/code-index/processors/scanner.ts`  
**Lines:** 540-560 (replace existing Neo4j indexing code)

```typescript
// Also add to Neo4j graph if available
if (this.graphIndexer) {
	try {
		// Group blocks by file for efficient indexing
		const blocksByFile = new Map<string, CodeBlock[]>()
		for (const block of batchBlocks) {
			if (!blocksByFile.has(block.file_path)) {
				blocksByFile.set(block.file_path, [])
			}
			blocksByFile.get(block.file_path)!.push(block)
		}

		// Report Neo4j indexing start
		const totalFiles = blocksByFile.size
		this.stateManager.reportNeo4jIndexingProgress(0, totalFiles, "indexing", "Indexing to graph database...")

		// Index each file's blocks to Neo4j
		let processedFiles = 0
		for (const [filePath, fileBlocks] of blocksByFile) {
			await this.graphIndexer.indexFile(filePath, fileBlocks)
			processedFiles++
			this.stateManager.reportNeo4jIndexingProgress(
				processedFiles,
				totalFiles,
				"indexing",
				`Indexed ${processedFiles}/${totalFiles} files to graph`,
			)
		}

		// Report Neo4j indexing complete
		this.stateManager.reportNeo4jIndexingProgress(processedFiles, processedFiles, "indexed", "Graph index complete")
	} catch (error) {
		// Log error but don't fail the entire indexing process
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`[DirectoryScanner] Error indexing to Neo4j:`, error)
		this.stateManager.reportNeo4jIndexingProgress(0, 0, "error", `Graph indexing failed: ${errorMessage}`)
	}
}
```

### ✅ Task 3.2: Update FileWatcher - Neo4j Progress

**File:** `src/services/code-index/processors/file-watcher.ts`  
**Lines:** 610-618 (replace existing Neo4j indexing code)

```typescript
// Index to Neo4j graph if available
if (this.graphIndexer && blocks.length > 0) {
	try {
		this.stateManager.reportNeo4jIndexingProgress(0, 1, "indexing", `Indexing ${path.basename(filePath)} to graph`)
		await this.graphIndexer.indexFile(filePath, blocks)
		this.stateManager.reportNeo4jIndexingProgress(1, 1, "indexed", "Graph index updated")
	} catch (error) {
		// Log error but don't fail the entire file processing
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`[FileWatcher] Error indexing file to Neo4j: ${filePath}`, error)
		this.stateManager.reportNeo4jIndexingProgress(0, 0, "error", `Graph indexing failed: ${errorMessage}`)
	}
}
```

### ✅ Task 3.3: Initialize Neo4j Status on Manager Start

**File:** `src/services/code-index/manager.ts`
**Lines:** 124-138 (in initialize method)

Add after line 133:

```typescript
// Initialize Neo4j status based on configuration
if (this._configManager.isNeo4jEnabled) {
	this._stateManager.setNeo4jStatus("idle", "Neo4j graph indexing enabled")
} else {
	this._stateManager.setNeo4jStatus("disabled", "")
}
```

---

## Phase 4: Frontend UI Changes

### ✅ Task 4.1: Add Neo4j Progress Calculation

**File:** `webview-ui/src/components/chat/CodeIndexPopover.tsx`
**Line:** 590 (after existing progressPercentage calculation)

```typescript
const progressPercentage = useMemo(
	() =>
		indexingStatus.totalItems > 0
			? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
			: 0,
	[indexingStatus.processedItems, indexingStatus.totalItems],
)

const transformStyleString = `translateX(-${100 - progressPercentage}%)`

// ADD THESE:
const neo4jProgressPercentage = useMemo(
	() =>
		(indexingStatus.neo4jTotalItems || 0) > 0
			? Math.round(((indexingStatus.neo4jProcessedItems || 0) / (indexingStatus.neo4jTotalItems || 0)) * 100)
			: 0,
	[indexingStatus.neo4jProcessedItems, indexingStatus.neo4jTotalItems],
)

const neo4jTransformStyleString = `translateX(-${100 - neo4jProgressPercentage}%)`
```

### ✅ Task 4.2: Update Status Section UI

**File:** `webview-ui/src/components/chat/CodeIndexPopover.tsx`
**Lines:** 653-683 (replace entire Status Section)

```tsx
{
	/* Status Section */
}
;<div className="space-y-2">
	<h4 className="text-sm font-medium">{t("settings:codeIndex.statusTitle")}</h4>

	{/* Overall Status Indicator */}
	<div className="text-sm text-vscode-descriptionForeground">
		<span
			className={cn("inline-block w-3 h-3 rounded-full mr-2", {
				"bg-gray-400": indexingStatus.systemStatus === "Standby",
				"bg-yellow-500 animate-pulse": indexingStatus.systemStatus === "Indexing",
				"bg-green-500": indexingStatus.systemStatus === "Indexed",
				"bg-red-500": indexingStatus.systemStatus === "Error",
			})}
		/>
		{t(`settings:codeIndex.indexingStatuses.${indexingStatus.systemStatus.toLowerCase()}`)}
		{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
	</div>

	{/* Vector Index Progress (Qdrant) */}
	{indexingStatus.systemStatus === "Indexing" && (
		<div className="mt-3 space-y-2">
			<div className="text-xs text-vscode-descriptionForeground font-medium">
				Vector Index: {indexingStatus.processedItems} / {indexingStatus.totalItems}{" "}
				{indexingStatus.currentItemUnit}
			</div>
			<ProgressPrimitive.Root
				className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
				value={progressPercentage}>
				<ProgressPrimitive.Indicator
					className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
					style={{
						transform: transformStyleString,
					}}
				/>
			</ProgressPrimitive.Root>
		</div>
	)}

	{/* Neo4j Graph Index Progress - Only show if Neo4j is enabled */}
	{currentSettings.neo4jEnabled && indexingStatus.neo4jStatus && indexingStatus.neo4jStatus !== "disabled" && (
		<div className="mt-3 space-y-2">
			<div className="flex items-center gap-2">
				<span
					className={cn("inline-block w-2 h-2 rounded-full", {
						"bg-gray-400": indexingStatus.neo4jStatus === "idle",
						"bg-yellow-500 animate-pulse": indexingStatus.neo4jStatus === "indexing",
						"bg-green-500": indexingStatus.neo4jStatus === "indexed",
						"bg-red-500": indexingStatus.neo4jStatus === "error",
					})}
				/>
				<span className="text-xs text-vscode-descriptionForeground font-medium">
					Graph Index (Neo4j):{" "}
					{indexingStatus.neo4jStatus === "indexing" || indexingStatus.neo4jStatus === "indexed"
						? `${indexingStatus.neo4jProcessedItems || 0} / ${indexingStatus.neo4jTotalItems || 0} files`
						: indexingStatus.neo4jStatus === "error"
							? "Error"
							: "Ready"}
				</span>
			</div>

			{indexingStatus.neo4jStatus === "indexing" && (
				<ProgressPrimitive.Root
					className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
					value={neo4jProgressPercentage}>
					<ProgressPrimitive.Indicator
						className="h-full w-full flex-1 bg-green-600 transition-transform duration-300 ease-in-out"
						style={{
							transform: neo4jTransformStyleString,
						}}
					/>
				</ProgressPrimitive.Root>
			)}

			{indexingStatus.neo4jStatus === "error" && indexingStatus.neo4jMessage && (
				<div className="text-xs text-vscode-errorForeground mt-1">⚠ {indexingStatus.neo4jMessage}</div>
			)}

			{indexingStatus.neo4jStatus === "indexed" && indexingStatus.neo4jMessage && (
				<div className="text-xs text-vscode-descriptionForeground mt-1">{indexingStatus.neo4jMessage}</div>
			)}
		</div>
	)}
</div>
```

---

## Phase 5: Testing

### ✅ Test Case 1: Neo4j Disabled

**Expected:** No Neo4j section visible, UI identical to current implementation

### ✅ Test Case 2: Neo4j Enabled - Both Indexing

**Expected:** Both progress bars visible, both showing progress

### ✅ Test Case 3: Neo4j Enabled - Qdrant Complete First

**Expected:** Qdrant shows complete, Neo4j still shows progress

### ✅ Test Case 4: Neo4j Connection Error

**Expected:** Neo4j shows error with message, Qdrant continues normally

### ✅ Test Case 5: File Watcher (Incremental)

**Expected:** Single file changes update both indexes

---

## Estimated Effort

| Phase                      | Tasks        | Estimated Time |
| -------------------------- | ------------ | -------------- |
| Phase 1: Type Definitions  | 1 task       | 15 minutes     |
| Phase 2: State Management  | 3 tasks      | 30 minutes     |
| Phase 3: Progress Tracking | 3 tasks      | 45 minutes     |
| Phase 4: Frontend UI       | 2 tasks      | 1 hour         |
| Phase 5: Testing           | 5 test cases | 1 hour         |
| **Total**                  | **14 tasks** | **~3.5 hours** |

---

## Dependencies

- ✅ Neo4j UI configuration (already implemented)
- ✅ Neo4j backend service (already implemented)
- ✅ GraphIndexer (already implemented)
- ✅ Existing progress tracking infrastructure

---

## Rollout Plan

1. **Implement backend changes** (Phases 1-3)
2. **Test backend** with console logging
3. **Implement frontend changes** (Phase 4)
4. **Manual testing** (Phase 5)
5. **Code review**
6. **Merge to feature branch**
7. **User testing**
8. **Merge to main**

---

## Success Criteria

- ✅ Users can see Neo4j indexing progress in real-time
- ✅ Neo4j errors are visible in the UI
- ✅ Qdrant-only users see no changes
- ✅ Both indexes can progress independently
- ✅ No performance degradation
- ✅ All existing tests pass
- ✅ New tests added for Neo4j progress tracking
