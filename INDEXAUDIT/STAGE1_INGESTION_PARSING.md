# STAGE 1 AUDIT REPORT: Ingestion & Parsing

**Pipeline Stage**: File Discovery → Parsing → Chunking Strategy Selection  
**Date**: 2025-11-27  
**Auditor**: Comprehensive Manual Pipeline Audit

---

## EXECUTIVE SUMMARY

This stage audit traces the complete data flow from initial file discovery through parsing and chunking strategy selection. The investigation identified **8 distinct fallback chunking trigger points** in `parser.ts` and confirmed that fallback chunking is being invoked systematically due to Tree-sitter query execution failures.

### Critical Findings

1. **Fallback Chunking Trigger**: The system resorts to fallback chunking when Tree-sitter queries return zero captures (lines 787-914 in `parser.ts`)
2. **Import Propagation**: File-level imports are correctly extracted (line 919) and should be propagated to all blocks including fallback chunks
3. **Metadata Extraction**: Symbol metadata extraction occurs but is dependent on semantic captures being available

---

## COMPONENT BREAKDOWN

### 1. File Discovery & Ingestion Entry Point

**File**: `src/services/code-index/orchestrator.ts`  
**Function**: `startIndexing()` (lines 359-754)  
**Responsibility**: Orchestrates the entire indexing workflow

#### Data Flow

```typescript
// Line 523: Scanner is invoked for full scan
const result = await this.scanner.scanDirectory(
	this.workspacePath,
	(batchError: Error) => {
		/* error handler */
	},
	handleBlocksIndexed,
	handleFileParsed,
)
```

#### Key Decision Points

- **Line 409**: Check if collection has existing data (`hasExistingData`)
- **Line 411-500**: Incremental scan path (for existing collections)
- **Line 501-628**: Full scan path (for new/empty collections)

---

### 2. Directory Scanning & File Filtering

**File**: `src/services/code-index/processors/scanner.ts`  
**Function**: `scanDirectory()` (lines 472-1503)  
**Responsibility**: Discover files, filter by extension/ignore rules, parse files

#### Discovery Phase (Lines 498-528)

```typescript
// Line 498: Get all files recursively (handles .gitignore)
const [allPaths, _] = await listFiles(directoryPath, true)

// Line 501: Filter directories
const filePaths = allPaths.filter((p) => !p.endsWith("/"))

// Line 523-528: Apply .rooignore filtering
const ignoreController = new RooIgnoreController(directoryPath)
await ignoreController.initialize()
const allowedPaths = ignoreController.filterPaths(filePaths)
```

#### Extension & Size Filtering (Lines 545-585)

```typescript
// Line 545: Filter by supported extensions
const supportedPaths = allowedPaths.filter((filePath) => {
	const ext = path.extname(filePath).toLowerCase()
	const isSupportedExt = scannerExtensions.includes(ext)
	const isIgnoredByGitignore = this.ignoreInstance.ignores(relativeFilePath)

	if (!isSupportedExt) {
		unsupportedExtCount++
		return false
	}
	// ... additional filtering logic
})
```

#### Parallel Parsing (Lines 627-710)

```typescript
// Line 627: Map each file to parser with concurrency control
const parsePromises = supportedPaths.map((filePath) =>
	parseLimiter(async () => {
		// Line 638-645: Check file size
		stats = await stat(filePath)
		if (stats.size > MAX_FILE_SIZE_BYTES) {
			skippedCount++
			return
		}

		// Line 678-693: Cache check
		const currentFileHash = createHash("sha256").update(content).digest("hex")
		const cachedFileHash = this.cacheManager.getHash(filePath)
		if (cachedFileHash === currentFileHash) {
			skippedCount++
			return // File unchanged, skip parsing
		}

		// Line 710: CRITICAL - File parsing entry point
		const blocks = await this.codeParser.parseFile(filePath, {
			content,
			fileHash: currentFileHash,
		})
	}),
)
```

**Finding**: Files are correctly discovered, filtered, and routed to the parser. No issues identified in this phase.

---

### 3. Code Parsing & Chunking Strategy

**File**: `src/services/code-index/processors/parser.ts`  
**Class**: `CodeParser`  
**Primary Function**: `parseContent()` (lines 407-1203)

This is the **CRITICAL COMPONENT** where fallback chunking triggers are located.

#### Entry Point Analysis

```typescript
// Line 407: parseContent() - Main parsing entry point
private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const seenSegmentHashes = new Set<string>()

    // Line 412: Handle markdown files specially
    if (ext === "md" || ext === "markdown") {
        return this.parseMarkdownContent(filePath, content, fileHash, seenSegmentHashes)
    }
```

#### FALLBACK TRIGGER POINT #1: Unsupported Extension (Lines 417-437)

**Trigger**: Extension configured for fallback chunking

```typescript
// Line 417: Check if extension requires fallback
if (shouldUseFallbackChunking(`.${ext}`)) {
	const reason = "noParser"
	this.metricsCollector?.recordParserMetric(
		normalizedExt,
		"fallbackChunkingTrigger",
		1,
		undefined,
		undefined,
		undefined,
		reason,
	)

	// Line 429: FALLBACK TRIGGER #1
	return this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		undefined,
		"unsupported extension",
	)
}
```

**Reason**: Extensions in `FALLBACK_EXTENSIONS` (e.g., `.vb`, `.scala`, `.swift`)  
**Impact**: These files NEVER get semantic parsing  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #2: Parser Load Failed (Lines 449-487)

**Trigger**: Pending parser load fails with exception

```typescript
// Line 443-447: Wait for pending load
const pendingLoad = this.pendingLoads.get(normalizedExt)
if (pendingLoad) {
	try {
		await pendingLoad
	} catch (error) {
		// Line 468: Log parser load failure
		logger.warn(`Parser load failed for ${ext}, falling back to chunking`, "CodeParser")

		// Line 479: FALLBACK TRIGGER #2
		return this._performFallbackChunking(
			filePath,
			content,
			fileHash,
			seenSegmentHashes,
			undefined,
			"parser load failed",
		)
	}
}
```

**Reason**: WASM parser failed to load or Tree-sitter initialization error  
**Impact**: Affects all files of that extension for the session  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #3: WASM Directory Unavailable (Lines 516-540)

**Trigger**: `getWasmDirectory()` throws exception

```typescript
// Line 495: Get WASM directory
try {
	wasmDir = getWasmDirectory()
} catch (error) {
	logger.error(`getWasmDirectory() failed: ${error.message}`, "CodeParser")
	logger.warn(`WASM directory unavailable, falling back to chunking for ${filePath}`, "CodeParser")

	// Line 532: FALLBACK TRIGGER #3
	return this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		undefined,
		"WASM directory unavailable",
	)
}
```

**Reason**: Extension activation issue, VSIX packaging problem, or runtime path resolution failure  
**Impact**: CATASTROPHIC - affects ALL parseable files  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #4: Parser Loading Exception (Lines 579-607)

**Trigger**: `loadRequiredLanguageParsers()` throws exception

```typescript
// Line 542: Load parsers
const loadPromise = loadRequiredLanguageParsers([filePath], wasmDir, this.metricsCollector)
this.pendingLoads.set(normalizedExt, loadPromise)
try {
	const newParsers = await loadPromise
	// ... parser validation
} catch (error) {
	logger.error(`Error loading language parser for ${filePath}...`)
	logger.warn(`Parser loading failed for ${ext}, falling back to chunking`, "CodeParser")

	// Line 599: FALLBACK TRIGGER #4
	return this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		undefined,
		"parser loading failed",
	)
}
```

**Reason**: WASM file missing, parser initialization error, or query compilation failure  
**Impact**: Affects all files of that extension for the session  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #5: No Parser Available (Lines 614-631)

**Trigger**: Parser not found in `loadedParsers` after loading attempt

```typescript
// Line 614: Check for loaded parser
const language = this.loadedParsers[normalizedExt] || this.loadedParsers[ext]
if (!language) {
	logger.warn(`No parser available for file extension: ${ext}`, "CodeParser")
	logger.warn(`No WASM parser for ${ext}, forcing fallback chunking`, "CodeParser")

	// Line 623: FALLBACK TRIGGER #5
	return this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		undefined,
		"no parser available",
	)
}
```

**Reason**: Parser loaded but not added to `loadedParsers`, or graceful degradation after WASM missing  
**Impact**: Affects specific files that should have parsers  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #6: Tree Parsing Failed (Lines 693-713)

**Trigger**: `language.parser.parse()` throws exception

```typescript
// Line 636-637: Parse tree
try {
	tree = language.parser.parse(content)
} catch (e) {
	logger.error(`Error parsing ${filePath} with ${ext} parser: ${e.message}`, "CodeParser")
	logger.warn(`Tree parsing failed for ${filePath}, falling back to chunking`, "CodeParser")
	this.metricsCollector?.recordParserMetric(normalizedExt, "parseFailed")

	// Line 705: FALLBACK TRIGGER #6
	return this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		undefined,
		"tree parsing failed",
	)
}
```

**Reason**: Malformed code, parser bug, or syntax error in file  
**Impact**: Affects individual files with syntax issues  
**Import Handling**: `undefined` passed as imports parameter

---

#### FALLBACK TRIGGER POINT #7: Zero Captures (Lines 1136-1164)

**Trigger**: Query execution returns zero captures AND content length is sufficient

```typescript
// Line 734: Execute query
captures = language.query.captures(tree.rootNode)
logger.debug(`Query captures for ${filePath}: ${captures.length}`, "CodeParser")

// ... capture processing ...

// Line 1137: Check if results array is still empty after capture processing
if (results.length === 0 && content.length >= MIN_BLOCK_CHARS) {
	logger.debug(`Applying fallback chunking for ${filePath} due to empty captures...`, "CodeParser")
	this.metricsCollector?.recordParserMetric(normalizedExt, "fallback")

	// Line 919: CRITICAL - File imports ARE extracted before this point
	const fileImports = this.extractFileImports(tree)

	// Line 1154: FALLBACK TRIGGER #7 - WITH IMPORTS
	const fallbackResults = this._performFallbackChunking(
		filePath,
		content,
		fileHash,
		seenSegmentHashes,
		fileImports, // <-- IMPORTS ARE PASSED HERE
		"zero captures",
		querySource,
	)
	results.push(...fallbackResults)
}
```

**Reason**: Tree-sitter query patterns don't match AST node types in the file  
**Impact**: **THIS IS THE PRIMARY FAILURE MODE** - affects most files currently  
**Import Handling**: **CORRECTLY PASSED** - `fileImports` extracted at line 919

**CRITICAL OBSERVATION**: This is the ONLY fallback trigger that receives imports!

---

#### FALLBACK TRIGGER POINT #8: Emergency Fallback (Lines 1167-1200)

**Trigger**: No blocks created after all parsing attempts AND content is non-empty

```typescript
// Line 1167: Emergency fallback check
if (results.length === 0 && content.trim().length > 0) {
	if (!ENABLE_EMERGENCY_FALLBACK || content.length < MIN_EMERGENCY_FALLBACK_CHARS) {
		return results // Return empty array
	}

	logger.warn(`Emergency fallback: No blocks created for ${filePath}. Creating single block.`, "CodeParser")

	// Line 1182-1197: Create single block for entire file
	results.push({
		file_path: filePath,
		identifier: null,
		type: "emergency_fallback_full_file",
		start_line: 1,
		end_line: content.split("\n").length,
		content: content,
		segmentHash,
		fileHash,
	})
}
```

**Reason**: Absolute last resort when all other strategies fail  
**Impact**: Affects files that are too small or have no recognizable structure  
**Import Handling**: **NO IMPORTS** - created as single block without metadata

---

## ROOT CAUSE HYPOTHESIS: Fallback Chunking

### Primary Cause: Tree-sitter Query Mismatch

**Location**: Lines 734-746 in `parser.ts`

```typescript
// Line 734: Execute the query
captures = language.query.captures(tree.rootNode)
logger.debug(`Query captures for ${filePath}: ${captures.length}`, "CodeParser")
```

**Hypothesis**: The comprehensive Tree-sitter queries are not matching the AST node types produced by the parsers.

####Evidence

1. **Extensive logging** (lines 787-898) shows query diagnostics including:

    - Expected node types in query (line 866)
    - Found node types in tree (line 867)
    - Matching types (line 869)
    - Content preview (lines 802-809)
    - Top node types in AST (lines 812-831)

2. **Zero capture telemetry** (lines 900-909) captures detailed diagnostics:

    ```typescript
    TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
    	error: `No captures found for file: ${filePath}...`,
    	extension: ext,
    	contentLength: content.length,
    	shouldUseFallback: shouldUseFallbackChunking(`.${ext}`),
    })
    ```

3. **Query source tracking** (lines 761-784) distinguishes:
    - Comprehensive queries
    - Emergency queries
    - Unknown sources

### Secondary Causes

1. **WASM Loading Failures** (Triggers #2, #3, #4, #5)

    - Missing WASM files in VSIX bundle
    - Incorrect path resolution in `getWasmDirectory()`
    - Parser initialization errors

2. **Import Propagation Gap** (Triggers #1-#6)
    - Six of eight fallback triggers pass `undefined` for imports
    - Only Trigger #7 (zero captures) correctly passes imports
    - This explains missing IMPORTS relationships in Neo4j

---

## METADATA EXTRACTION ANALYSIS

**File**: `src/services/code-index/processors/parser.ts`  
**Function**: `extractFileImports()` (called at line 919)

```typescript
// Line 919: Extract file-level imports once
const fileImports = this.extractFileImports(tree)

// Line 922: Detect if this is a test file
const testMetadata = this.detectTestFile(filePath, tree, ext)
```

**Finding**: Imports are extracted BEFORE fallback chunking decision, which means they SHOULD be available for propagation.

**CRITICAL GAP**: When fallback triggers #1-#6 are hit (early returns), the import extraction at line 919 is NEVER REACHED because the function returns before this point.

---

## VERIFICATION ARTIFACTS

### Log Patterns to Search For

1. **Fallback chunking triggers**:

    ```
    "Applying fallback chunking for"
    "No captures found for file"
    "Parser load failed for"
    "WASM directory unavailable"
    ```

2. **Zero block failures**:

    ```
    "WARNING: File parsed but generated 0 blocks"
    "No blocks created by fallback chunking"
    ```

3. **Query diagnostics**:
    ```
    "Query captures for"
    "Expected node types in query"
    "Found node types in tree"
    "Top node types in AST"
    ```

---

## RECOMMENDED NEXT STEPS

1. **Verify WASM Loading**: Check if `getWasmDirectory()` is functioning correctly and WASM files are present
2. **Query Analysis**: Compare query patterns against actual AST node types for failing files
3. **Import Propagation**: Trace actual import data through to Neo4j to confirm propagation gap
4. **Neo4j Relationship Creation**: Verify if zero relationships is due to missing imports or relationship extraction logic

---

## FILES & FUNCTIONS REFERENCE

| Component    | File                    | Function/Line                            | Responsibility           |
| ------------ | ----------------------- | ---------------------------------------- | ------------------------ |
| Orchestrator | `orchestrator.ts`       | `startIndexing()` (359-754)              | Workflow coordination    |
| Scanner      | `scanner.ts`            | `scanDirectory()` (472-1503)             | File discovery & parsing |
| Parser       | `parser.ts`             | `parseContent()` (407-1203)              | Semantic parsing         |
| Parser       | `parser.ts`             | `_performFallbackChunking()` (1407-1512) | Fallback strategy        |
| Parser       | `parser.ts`             | `extractFileImports()`                   | Import extraction        |
| Metadata     | `metadata-extractor.ts` | `extractImportInfo()`                    | Import metadata          |
