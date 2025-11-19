# Phase 10, Task 1: CALLS / CALLED_BY Implementation Plan

## Extracting Function Call Relationships from Tree-sitter AST

**Date:** 2025-11-19  
**Priority:** CRITICAL - #1 Blocker to World-Class Status  
**Estimated Effort:** 1-2 weeks

---

## Executive Summary

Implement extraction of function call relationships (CALLS / CALLED_BY) from Tree-sitter AST to enable impact analysis queries like "what breaks if I change this?" and "what calls this function?".

**Current State:**

- ✅ Tree-sitter parsing infrastructure exists
- ✅ Language-specific queries for definitions exist
- ✅ Neo4j graph database integrated
- ❌ NO call relationship extraction
- ❌ Placeholder comment in `graph-indexer.ts` line 277-279

**Target State:**

- ✅ Extract function calls from AST for all supported languages
- ✅ Create bidirectional CALLS / CALLED_BY relationships in Neo4j
- ✅ Support cross-file function calls
- ✅ Handle method calls, static calls, and dynamic calls
- ✅ Link calls to existing function/method nodes

---

## Technical Analysis

### Current Tree-sitter Infrastructure

**Parser Location:** `src/services/code-index/processors/parser.ts`

- Uses `web-tree-sitter` with WASM binaries
- Supports 30+ languages (TypeScript, JavaScript, Python, Rust, Go, C++, Java, etc.)
- Parses files into AST and runs language-specific queries
- Extracts code blocks (functions, classes, methods) for indexing

**Query Files:** `src/services/tree-sitter/queries/*.ts`

- Each language has a query file defining what to capture
- Current queries capture DEFINITIONS (functions, classes, methods)
- NO queries for CALLS/REFERENCES yet

**Graph Indexer:** `src/services/code-index/graph/graph-indexer.ts`

- `extractRelationships()` method has placeholder for CALLS extraction (line 277-279)
- Currently only extracts: IMPORTS, DEFINES, CONTAINS
- Needs to be extended to extract CALLS

---

## Implementation Strategy

### Approach: Two-Phase Extraction

**Phase A: AST-Based Call Extraction** (Primary)

- Add Tree-sitter queries to capture call expressions
- Extract calls during parsing in `parser.ts`
- Store call information in CodeBlock metadata

**Phase B: Graph Relationship Creation** (Secondary)

- Process call metadata in `graph-indexer.ts`
- Resolve call targets to existing function nodes
- Create bidirectional CALLS / CALLED_BY relationships

---

## Detailed Implementation Plan

### Step 1: Extend CodeBlock Interface

**File:** `src/services/code-index/interfaces/file-processor.ts`

**Add new field to CodeBlock:**

```typescript
export interface CodeBlock {
	// ... existing fields ...

	// Phase 10: Function call information
	calls?: CallInfo[]
}

export interface CallInfo {
	/** Name of the function/method being called */
	calleeName: string

	/** Type of call: 'function', 'method', 'static_method', 'constructor' */
	callType: "function" | "method" | "static_method" | "constructor"

	/** Line number where the call occurs */
	line: number

	/** Column number where the call occurs */
	column: number

	/** Object/class name for method calls (e.g., 'user' in user.save()) */
	receiver?: string

	/** Module/class name for static calls (e.g., 'Math' in Math.max()) */
	qualifier?: string

	/** Arguments passed to the call (for future use) */
	arguments?: string[]
}
```

---

### Step 2: Add Tree-sitter Queries for Call Expressions

**Files to Modify:**

- `src/services/tree-sitter/queries/typescript.ts`
- `src/services/tree-sitter/queries/javascript.ts`
- `src/services/tree-sitter/queries/python.ts`
- `src/services/tree-sitter/queries/rust.ts`
- `src/services/tree-sitter/queries/go.ts`
- (and other language query files)

**Example for TypeScript/JavaScript:**

```typescript
// Add to existing query string:

; Function calls
(call_expression
  function: (identifier) @call.function) @call

; Method calls
(call_expression
  function: (member_expression
    object: (identifier) @call.receiver
    property: (property_identifier) @call.method)) @call

; Static method calls
(call_expression
  function: (member_expression
    object: (identifier) @call.class
    property: (property_identifier) @call.static_method)) @call

; Constructor calls
(new_expression
  constructor: (identifier) @call.constructor) @call
```

**Example for Python:**

```python
; Function calls
(call
  function: (identifier) @call.function) @call

; Method calls
(call
  function: (attribute
    object: (identifier) @call.receiver
    attribute: (identifier) @call.method)) @call
```

---

### Step 3: Extract Call Information During Parsing

**File:** `src/services/code-index/processors/parser.ts`

**Add new method:**

```typescript
/**
 * Extract function calls from a code block's AST node
 * Phase 10: CALLS relationship extraction
 */
private extractCalls(node: any, filePath: string): CallInfo[] {
	const calls: CallInfo[] = []

	// Get file extension to determine language
	const ext = path.extname(filePath).substring(1)

	// Traverse the node to find call expressions
	const callNodes = this.findCallExpressions(node, ext)

	for (const callNode of callNodes) {
		const callInfo = this.parseCallExpression(callNode, ext)
		if (callInfo) {
			calls.push(callInfo)
		}
	}

	return calls
}

/**
 * Find all call expression nodes in the AST
 */
private findCallExpressions(node: any, language: string): any[] {
	const calls: any[] = []

	// Language-specific node type names for call expressions
	const callNodeTypes: Record<string, string[]> = {
		'ts': ['call_expression', 'new_expression'],
		'tsx': ['call_expression', 'new_expression'],
		'js': ['call_expression', 'new_expression'],
		'jsx': ['call_expression', 'new_expression'],
		'py': ['call'],
		'rs': ['call_expression'],
		'go': ['call_expression'],
		// ... add more languages
	}

	const targetTypes = callNodeTypes[language] || ['call_expression']

	// Recursively traverse the AST
	const traverse = (n: any) => {
		if (targetTypes.includes(n.type)) {
			calls.push(n)
		}
		for (const child of n.children || []) {
			traverse(child)
		}
	}

	traverse(node)
	return calls
}

/**
 * Parse a call expression node into CallInfo
 */
private parseCallExpression(callNode: any, language: string): CallInfo | null {
	// Language-specific parsing logic
	// This will vary by language syntax

	// For TypeScript/JavaScript:
	if (['ts', 'tsx', 'js', 'jsx'].includes(language)) {
		return this.parseJSCallExpression(callNode)
	}

	// For Python:
	if (language === 'py') {
		return this.parsePythonCallExpression(callNode)
	}

	// ... add more languages

	return null
}
```

---

### Step 4: Integrate Call Extraction into Parser

**File:** `src/services/code-index/processors/parser.ts`

**Modify the block creation logic** (around line 220-250):

```typescript
// After creating the CodeBlock, add call extraction:
const block: CodeBlock = {
	file_path: filePath,
	identifier: identifier,
	type: blockType,
	start_line: contentWithComments.startLine,
	end_line: nodeEndLine + 1,
	content: contentWithComments.content,
	fileHash: fileHash,
	segmentHash: segmentHash,
	symbolMetadata: symbolMetadata,
	imports: blockImports,
	exports: blockExports,
	documentation: documentation,
	lspTypeInfo: lspTypeInfo,
	// Phase 10: Extract function calls
	calls: this.extractCalls(currentNode, filePath),
}
```

---

### Step 5: Create CALLS Relationships in GraphIndexer

**File:** `src/services/code-index/graph/graph-indexer.ts`

**Replace placeholder (lines 277-279) with actual implementation:**

```typescript
// Phase 10: Extract CALLS relationships from call metadata
if (block.calls && block.calls.length > 0) {
	for (const call of block.calls) {
		// Resolve the call target to a node ID
		const targetNodeId = this.resolveCallTarget(call, block, allBlocks)

		if (targetNodeId) {
			// Create CALLS relationship
			relationships.push({
				fromId,
				toId: targetNodeId,
				type: "CALLS",
				metadata: {
					callType: call.callType,
					line: call.line,
					column: call.column,
				},
			})
		}
	}
}
```

**Add helper methods:**

```typescript
/**
 * Resolve a function call to the target node ID
 */
private resolveCallTarget(
	call: CallInfo,
	callerBlock: CodeBlock,
	allBlocks: CodeBlock[]
): string | null {
	const { calleeName, callType } = call

	// Strategy 1: Look for function/method in the same file
	const sameFileTarget = allBlocks.find(block =>
		block.file_path === callerBlock.file_path &&
		block.identifier === calleeName &&
		(block.type === 'function' || block.type === 'method')
	)

	if (sameFileTarget) {
		return this.generateNodeId(sameFileTarget)
	}

	// Strategy 2: Look for imported functions
	if (callerBlock.imports) {
		for (const importInfo of callerBlock.imports) {
			if (importInfo.symbols?.includes(calleeName)) {
				// Try to find the function in the imported file
				const importedTarget = this.findFunctionInImportedFile(
					calleeName,
					importInfo.source,
					callerBlock.file_path,
					allBlocks
				)

				if (importedTarget) {
					return this.generateNodeId(importedTarget)
				}
			}
		}
	}

	// If we can't resolve, return null (external library call)
	return null
}

/**
 * Find a function in an imported file
 */
private findFunctionInImportedFile(
	functionName: string,
	importSource: string,
	currentFilePath: string,
	allBlocks: CodeBlock[]
): CodeBlock | null {
	// Resolve the import source to an actual file path
	const importedFilePath = this.resolveImportPath(importSource, currentFilePath)

	if (!importedFilePath) {
		return null
	}

	// Find the function in the imported file
	return allBlocks.find(block =>
		block.file_path === importedFilePath &&
		block.identifier === functionName &&
		(block.type === 'function' || block.type === 'method')
	) || null
}

/**
 * Resolve an import source to a file path
 */
private resolveImportPath(importSource: string, currentFilePath: string): string | null {
	const path = require('path')

	// Skip node_modules imports
	if (!importSource.startsWith('.') && !importSource.startsWith('@/')) {
		return null
	}

	// Handle relative imports
	const currentDir = path.dirname(currentFilePath)
	const resolvedPath = path.resolve(currentDir, importSource)

	// Try common extensions
	const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go']
	for (const ext of extensions) {
		return resolvedPath + ext
	}

	return null
}
```

---

### Step 6: Create Bidirectional CALLED_BY Relationships

**File:** `src/services/code-index/interfaces/neo4j-service.ts`

**Update CodeRelationship type:**

```typescript
export interface CodeRelationship {
	fromId: string
	toId: string
	type: "CALLS" | "CALLED_BY" | "IMPORTS" | "EXTENDS" | "IMPLEMENTS" | "CONTAINS" | "DEFINES" | "USES"
	metadata?: Record<string, unknown>
}
```

**File:** `src/services/code-index/graph/graph-indexer.ts`

**Add reverse relationships:**

```typescript
// At the end of extractRelationships(), before returning:

// Create reverse CALLED_BY relationships for efficient queries
const callsRelationships = relationships.filter((r) => r.type === "CALLS")
for (const callsRel of callsRelationships) {
	relationships.push({
		fromId: callsRel.toId,
		toId: callsRel.fromId,
		type: "CALLED_BY",
		metadata: callsRel.metadata,
	})
}
```

---

## Testing Strategy

### Unit Tests

**File:** `src/services/code-index/graph/__tests__/graph-indexer-calls.spec.ts` (new)

Test cases:

1. ✅ Extract simple function calls in same file
2. ✅ Extract method calls on objects
3. ✅ Extract static method calls
4. ✅ Extract constructor calls
5. ✅ Extract calls to imported functions
6. ✅ Handle unresolved calls (external libraries)
7. ✅ Create bidirectional CALLS/CALLED_BY relationships

### Integration Tests

**File:** `src/services/code-index/__tests__/calls-integration.spec.ts` (new)

Test scenarios:

1. ✅ Index a file with function calls
2. ✅ Query "what calls this function?"
3. ✅ Query "what does this function call?"
4. ✅ Cross-file call resolution

---

## Success Criteria

✅ **Functional Requirements:**

1. Extract function calls from TypeScript/JavaScript files
2. Create CALLS relationships in Neo4j
3. Create reverse CALLED_BY relationships
4. Resolve calls to functions in the same file
5. Resolve calls to imported functions (basic)
6. Handle unresolved calls gracefully

✅ **Quality Requirements:**

1. All type checks pass
2. All linter checks pass
3. Unit test coverage > 80%
4. No performance degradation (< 10% slower indexing)

✅ **Query Capabilities:**

1. Can answer "what calls this function?"
2. Can answer "what does this function call?"
3. Can trace call chains (A → B → C)

---

## Limitations and Future Enhancements

**Current Limitations:**

- ❌ No support for dynamic calls (e.g., `obj[methodName]()`)
- ❌ No support for higher-order functions (callbacks, promises)
- ❌ Limited cross-file resolution (no full module resolution)
- ❌ No type-based method resolution (requires LSP integration)

**Future Enhancements (Phase 11+):**

- Use LSP for accurate type-based call resolution
- Implement full module resolution (tsconfig paths, node_modules)
- Track data flow through function calls
- Detect unused functions (no incoming CALLED_BY)

---

## Timeline

**Week 1:**

- Day 1-2: Extend CodeBlock interface, add Tree-sitter queries
- Day 3-4: Implement call extraction in parser
- Day 5: Write unit tests for call extraction

**Week 2:**

- Day 1-2: Implement call resolution in GraphIndexer
- Day 3: Create bidirectional relationships
- Day 4: Write integration tests
- Day 5: Manual testing, bug fixes, documentation

**Total:** 10 days (2 weeks)

---

## Next Steps

After completing this task:

1. **Commit and push** changes immediately
2. **Verify** queries work: "what calls X?", "what does X call?"
3. **Proceed to Phase 10, Task 2:** TESTS / TESTED_BY relationships
4. **Update audit document** with new completion scores

---

## References

- Tree-sitter documentation: https://tree-sitter.github.io/tree-sitter/
- Tree-sitter query syntax: https://tree-sitter.github.io/tree-sitter/using-parsers#pattern-matching-with-queries
- Neo4j Cypher queries: https://neo4j.com/docs/cypher-manual/current/
- Claude's world-class spec: `KNOWLEDGEAUDIT/CLAUDE_WORLD_CLASS_AUDIT.md`
