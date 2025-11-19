# Phase 12: Enhanced Context Implementation Plan

**Date:** 2025-11-19
**Status:** Planning
**Priority:** High (Priority 3 in roadmap)
**Estimated Duration:** 1-2 weeks
**Expected Progress:** 85-90% → 92-95% (+5-7%)

---

## Executive Summary

Phase 12 focuses on **enriching search results with contextual information** from the graph relationships built in Phase 10. Instead of returning isolated code snippets, we'll provide comprehensive context including:

- **Related code** - Callers, callees, parent classes, child classes
- **Related tests** - Tests that cover the code
- **Dependencies** - What the code depends on
- **Type information** - Type definitions and relationships
- **File-level summaries** - High-level overview of the file

This transforms search results from "here's the code" to "here's the code, what it depends on, what depends on it, and how it's tested."

---

## Goals

### Primary Goals

1. **Enrich search results** with graph-based context automatically
2. **Include related tests** when showing code to enable test-aware development
3. **Show dependency context** to understand code relationships
4. **Provide file summaries** for better orientation
5. **Improve LLM context quality** by providing complete, accurate information

### Success Criteria

- ✅ Search results include related code (callers, callees, inheritance)
- ✅ Search results include related tests when available
- ✅ Search results include dependency information
- ✅ File-level summaries are generated and included
- ✅ Context enrichment is automatic and transparent
- ✅ Performance impact is minimal (<100ms per result)
- ✅ All type checks and linter pass
- ✅ Changes committed and pushed immediately

---

## Current State Analysis

### What We Have (Phase 11)

**Graph Relationships:**

- ✅ CALLS / CALLED_BY - Function call graph
- ✅ TESTS / TESTED_BY - Test coverage
- ✅ HAS_TYPE / ACCEPTS_TYPE / RETURNS_TYPE - Type system
- ✅ EXTENDS / EXTENDED_BY / IMPLEMENTS / IMPLEMENTED_BY - Inheritance
- ✅ CONTAINS - File/class containment
- ✅ IMPORTS - Import relationships
- ✅ DEFINES - Nested definitions

**Impact Analysis Methods:**

- ✅ `findImpactedNodes()` - Find code impacted by changes
- ✅ `findDependencyTree()` - Find dependencies
- ✅ `calculateBlastRadius()` - Calculate change impact
- ✅ `assessChangeSafety()` - Assess change safety

**Search Infrastructure:**

- ✅ QueryAnalyzer - Intent detection
- ✅ SearchOrchestrator - Multi-backend routing
- ✅ Result formatting - Convert graph results to search results

### What's Missing

**Context Enrichment:**

- ❌ No automatic context enrichment for search results
- ❌ No related code inclusion (callers, callees, inheritance)
- ❌ No related test inclusion
- ❌ No dependency context
- ❌ No file-level summaries
- ❌ No type information enrichment

**Impact:**

- Search results are isolated snippets without context
- LLM doesn't know what calls the code or what it calls
- LLM doesn't know if code is tested
- LLM doesn't understand code dependencies
- LLM lacks file-level understanding

---

## Design

### Architecture Overview

```
SearchOrchestrator
    ↓
performSearch() → SearchResult[]
    ↓
enrichResults() → EnrichedSearchResult[]
    ↓
ContextEnrichmentService
    ├─→ enrichWithRelatedCode()
    ├─→ enrichWithTests()
    ├─→ enrichWithDependencies()
    ├─→ enrichWithTypeInfo()
    └─→ enrichWithFileSummary()
```

### Context Enrichment Types

#### 1. Related Code Enrichment

**For each search result, include:**

- **Callers** (up to 3) - Functions that call this code
- **Callees** (up to 3) - Functions this code calls
- **Parent classes** - Classes this extends/implements
- **Child classes** (up to 3) - Classes that extend/implement this
- **Sibling methods** - Other methods in the same class

**Example:**

```
Result: UserService.authenticate()
Related Code:
  Callers:
    - LoginController.login() (line 45)
    - AuthMiddleware.verify() (line 23)
  Callees:
    - Database.query() (line 12)
    - TokenService.generate() (line 34)
```

#### 2. Test Enrichment

**For each search result, include:**

- **Direct tests** - Tests that directly test this code
- **Integration tests** - Tests that exercise this code indirectly
- **Test coverage** - Percentage of code covered by tests

**Example:**

```
Result: UserService.authenticate()
Tests:
  - UserService.spec.ts::should authenticate valid user (line 15)
  - UserService.spec.ts::should reject invalid password (line 28)
  - AuthFlow.e2e.ts::should complete login flow (line 45)
Coverage: 85%
```

#### 3. Dependency Enrichment

**For each search result, include:**

- **Direct dependencies** (up to 5) - What this code imports/uses
- **Dependency depth** - How deep the dependency tree is
- **Circular dependencies** - If any detected

**Example:**

```
Result: UserService.authenticate()
Dependencies:
  - Database (direct)
  - TokenService (direct)
  - ConfigService (direct)
  - Logger (via TokenService)
Depth: 2 levels
```

#### 4. Type Information Enrichment

**For each search result, include:**

- **Type definition** - Full type signature
- **Type dependencies** - Types this type depends on
- **Type usage** - Where this type is used

**Example:**

```
Result: User interface
Type Info:
  Definition: interface User { id: string; name: string; email: string }
  Used by:
    - UserService.getUser() (return type)
    - LoginController.currentUser (property type)
    - Database.users (collection type)
```

#### 5. File Summary Enrichment

**For each file in results, include:**

- **Purpose** - What the file does (extracted from comments/exports)
- **Main exports** - Key classes/functions exported
- **Dependencies** - What the file imports
- **Test coverage** - Overall file test coverage

**Example:**

```
File: src/services/UserService.ts
Summary:
  Purpose: User authentication and management service
  Exports: UserService (class), authenticate(), getUser(), createUser()
  Dependencies: Database, TokenService, ConfigService
  Test Coverage: 85% (17/20 functions tested)
```

---

## Implementation Strategy

### Phase 12.1: Define Interfaces

**File:** `src/services/code-index/interfaces/context-enrichment.ts` (NEW)

```typescript
export interface EnrichedSearchResult extends SearchResult {
	relatedCode?: RelatedCodeContext
	tests?: TestContext
	dependencies?: DependencyContext
	typeInfo?: TypeInfoContext
	fileSummary?: FileSummaryContext
}

export interface RelatedCodeContext {
	callers: CodeReference[]
	callees: CodeReference[]
	parentClasses: CodeReference[]
	childClasses: CodeReference[]
	siblingMethods: CodeReference[]
}

export interface TestContext {
	directTests: CodeReference[]
	integrationTests: CodeReference[]
	coveragePercentage: number
}

export interface DependencyContext {
	directDependencies: CodeReference[]
	dependencyDepth: number
	circularDependencies: string[]
}

export interface TypeInfoContext {
	definition: string
	typeDependencies: CodeReference[]
	typeUsage: CodeReference[]
}

export interface FileSummaryContext {
	purpose: string
	mainExports: string[]
	dependencies: string[]
	testCoverage: number
}

export interface CodeReference {
	nodeId: string
	name: string
	filePath: string
	startLine: number
	endLine: number
	snippet?: string
}
```

### Phase 12.2: Implement Context Enrichment Service

**File:** `src/services/code-index/context/context-enrichment-service.ts` (NEW)

**Methods to implement:**

1. **`enrichSearchResults(results: SearchResult[]): Promise<EnrichedSearchResult[]>`**

    - Main entry point
    - Enriches all results in parallel
    - Returns enriched results

2. **`enrichWithRelatedCode(result: SearchResult): Promise<RelatedCodeContext>`**

    - Queries Neo4j for CALLS/CALLED_BY relationships
    - Queries Neo4j for EXTENDS/EXTENDED_BY/IMPLEMENTS/IMPLEMENTED_BY
    - Limits to top 3 most relevant for each category
    - Returns related code context

3. **`enrichWithTests(result: SearchResult): Promise<TestContext>`**

    - Queries Neo4j for TESTED_BY relationships
    - Calculates coverage percentage
    - Returns test context

4. **`enrichWithDependencies(result: SearchResult): Promise<DependencyContext>`**

    - Queries Neo4j for IMPORTS/CALLS relationships
    - Calculates dependency depth
    - Detects circular dependencies
    - Returns dependency context

5. **`enrichWithTypeInfo(result: SearchResult): Promise<TypeInfoContext>`**

    - Queries Neo4j for HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE
    - Extracts type definition from LSP
    - Finds type usage
    - Returns type info context

6. **`enrichWithFileSummary(filePath: string): Promise<FileSummaryContext>`**
    - Analyzes file-level exports
    - Extracts purpose from comments
    - Calculates file-level test coverage
    - Returns file summary

### Phase 12.3: Integrate with SearchOrchestrator

**File:** `src/services/code-index/query/search-orchestrator.ts` (MODIFY)

**Changes:**

1. **Add context enrichment toggle:**

    ```typescript
    interface SearchOptions {
    	enrichContext?: boolean // Default: true
    	maxRelatedItems?: number // Default: 3
    }
    ```

2. **Enrich results before returning:**

    ```typescript
    async search(query: string, options?: SearchOptions): Promise<EnrichedSearchResult[]> {
      const results = await this.performSearch(query)

      if (options?.enrichContext !== false) {
        return await this.contextEnrichmentService.enrichSearchResults(results, {
          maxRelatedItems: options?.maxRelatedItems ?? 3
        })
      }

      return results
    }
    ```

3. **Update result formatting:**
    - Modify `formatSearchResults()` to include enriched context
    - Add sections for related code, tests, dependencies
    - Format context in a readable way for LLM

---

## Implementation Tasks

### Task 12.1: Create Implementation Plan ✅

- [x] Create `PHASE12_ENHANCED_CONTEXT_PLAN.md`
- [x] Document context enrichment types
- [x] Design architecture and interfaces
- [x] Define implementation strategy

### Task 12.2: Analyze Existing Search Infrastructure

- [ ] Review `SearchOrchestrator` implementation
- [ ] Review `SearchResult` interface
- [ ] Review result formatting methods
- [ ] Identify integration points
- [ ] Document findings

### Task 12.3: Implement Context Enrichment Service

- [ ] Create `context-enrichment.ts` interface file
- [ ] Create `context-enrichment-service.ts` implementation
- [ ] Implement `enrichWithRelatedCode()`
- [ ] Implement `enrichWithTests()`
- [ ] Implement `enrichWithDependencies()`
- [ ] Implement `enrichWithTypeInfo()`
- [ ] Implement `enrichWithFileSummary()`
- [ ] Add error handling and logging

### Task 12.4: Integrate with Search Results

- [ ] Update `SearchOrchestrator` to use context enrichment
- [ ] Add `SearchOptions` interface with enrichment toggles
- [ ] Modify `search()` method to enrich results
- [ ] Update result formatting to include context
- [ ] Add configuration for max related items
- [ ] Test integration with existing search flows

### Task 12.5: Test and Validate

- [ ] Test related code enrichment with real examples
- [ ] Test test enrichment with real test files
- [ ] Test dependency enrichment with complex dependencies
- [ ] Test type info enrichment with TypeScript code
- [ ] Test file summary generation
- [ ] Verify performance impact (<100ms per result)
- [ ] Run type checks (`pnpm check-types`)
- [ ] Run linter (`pnpm lint`)
- [ ] Verify all tests pass

### Task 12.6: Commit and Push

- [ ] Commit all changes with descriptive message
- [ ] Push to remote immediately
- [ ] Update progress tracker

---

## Technical Specifications

### Neo4j Queries for Context Enrichment

#### 1. Find Callers (CALLED_BY)

```cypher
MATCH (target {id: $nodeId})<-[:CALLED_BY]-(caller)
RETURN caller
ORDER BY caller.name
LIMIT 3
```

#### 2. Find Callees (CALLS)

```cypher
MATCH (target {id: $nodeId})-[:CALLS]->(callee)
RETURN callee
ORDER BY callee.name
LIMIT 3
```

#### 3. Find Parent Classes (EXTENDS/IMPLEMENTS)

```cypher
MATCH (target {id: $nodeId})-[:EXTENDS|IMPLEMENTS]->(parent)
RETURN parent
ORDER BY parent.name
```

#### 4. Find Child Classes (EXTENDED_BY/IMPLEMENTED_BY)

```cypher
MATCH (target {id: $nodeId})<-[:EXTENDED_BY|IMPLEMENTED_BY]-(child)
RETURN child
ORDER BY child.name
LIMIT 3
```

#### 5. Find Tests (TESTED_BY)

```cypher
MATCH (target {id: $nodeId})<-[:TESTED_BY]-(test)
RETURN test
ORDER BY test.name
```

#### 6. Find Dependencies (IMPORTS/CALLS)

```cypher
MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*1..2]->(dep)
RETURN DISTINCT dep, length(path) as depth
ORDER BY depth, dep.name
LIMIT 5
```

#### 7. Find Type Usage (HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE)

```cypher
MATCH (target {id: $nodeId})<-[:HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE]-(usage)
RETURN usage
ORDER BY usage.name
LIMIT 5
```

### Performance Considerations

**Optimization Strategies:**

1. **Parallel Enrichment**

    - Enrich all results in parallel using `Promise.all()`
    - Each enrichment type runs in parallel
    - Total time = max(enrichment times), not sum

2. **Caching**

    - Cache file summaries (rarely change)
    - Cache type definitions (rarely change)
    - Use LRU cache with 1000 entry limit

3. **Lazy Loading**

    - Only enrich when `enrichContext: true`
    - Allow selective enrichment (e.g., only tests)
    - Skip enrichment for large result sets (>20 results)

4. **Query Optimization**
    - Use LIMIT in all Neo4j queries
    - Use indexes on node IDs
    - Batch queries when possible

**Expected Performance:**

- Related code: ~20ms per result
- Tests: ~10ms per result
- Dependencies: ~30ms per result
- Type info: ~15ms per result
- File summary: ~25ms per result (cached after first)
- **Total (parallel):** ~50-75ms per result

---

## Integration Points

### 1. SearchOrchestrator

**Current:**

```typescript
async search(query: string): Promise<SearchResult[]> {
  const analysis = this.queryAnalyzer.analyze(query)
  return await this.performSearch(analysis)
}
```

**Enhanced:**

```typescript
async search(query: string, options?: SearchOptions): Promise<EnrichedSearchResult[]> {
  const analysis = this.queryAnalyzer.analyze(query)
  const results = await this.performSearch(analysis)

  if (options?.enrichContext !== false) {
    return await this.contextEnrichmentService.enrichSearchResults(results, options)
  }

  return results as EnrichedSearchResult[]
}
```

### 2. CodebaseSearchTool

**Current:**

```typescript
const results = await searchOrchestrator.search(query)
return formatResults(results)
```

**Enhanced:**

```typescript
const results = await searchOrchestrator.search(query, {
	enrichContext: true,
	maxRelatedItems: 3,
})
return formatEnrichedResults(results)
```

### 3. Result Formatting

**Current:**

````markdown
## Search Results

### UserService.authenticate()

File: src/services/UserService.ts (lines 45-67)

```typescript
async authenticate(username: string, password: string): Promise<User> {
  // ...
}
```
````

````

**Enhanced:**
```markdown
## Search Results

### UserService.authenticate()
File: src/services/UserService.ts (lines 45-67)

```typescript
async authenticate(username: string, password: string): Promise<User> {
  // ...
}
````

**Related Code:**

- **Callers:** LoginController.login() (line 45), AuthMiddleware.verify() (line 23)
- **Callees:** Database.query() (line 12), TokenService.generate() (line 34)

**Tests:**

- UserService.spec.ts::should authenticate valid user (line 15)
- UserService.spec.ts::should reject invalid password (line 28)
- Coverage: 85%

**Dependencies:**

- Database (direct), TokenService (direct), ConfigService (direct)

```

---

## Success Metrics

### Quantitative Metrics

- **Context Enrichment Coverage:** >90% of results enriched
- **Performance Impact:** <100ms per result
- **Related Code Accuracy:** >95% relevant
- **Test Coverage Accuracy:** 100% (from graph)
- **Dependency Accuracy:** >95% complete

### Qualitative Metrics

- **LLM Context Quality:** Improved understanding of code relationships
- **Developer Experience:** Faster code comprehension
- **Search Usefulness:** More actionable results

### Progress Toward World-Class

- **Before Phase 12:** 85-90%
- **After Phase 12:** 92-95% (+5-7%)

**Breakdown:**
- Related code enrichment: +2%
- Test enrichment: +2%
- Dependency enrichment: +1%
- Type info enrichment: +1%
- File summaries: +1%

---

## Risks and Mitigation

### Risk 1: Performance Degradation

**Risk:** Context enrichment adds latency to search results

**Mitigation:**
- Parallel enrichment
- Caching
- Lazy loading
- Query optimization
- Skip enrichment for large result sets

### Risk 2: Incomplete Context

**Risk:** Graph relationships may be incomplete or missing

**Mitigation:**
- Graceful degradation (show what's available)
- Clear indication when context is partial
- Fallback to basic results if enrichment fails

### Risk 3: Information Overload

**Risk:** Too much context overwhelms the LLM

**Mitigation:**
- Limit related items (default: 3)
- Configurable enrichment levels
- Smart filtering (most relevant first)
- Collapsible sections in UI

---

## Future Enhancements

### Phase 12.5: Advanced Context (Future)

- **Semantic similarity** - Find similar code patterns
- **Historical context** - Show recent changes (git blame)
- **Usage examples** - Show real usage examples
- **Performance metrics** - Show execution time, memory usage
- **Security context** - Show security-sensitive code paths

### Phase 12.6: Context Personalization (Future)

- **User preferences** - Remember enrichment preferences
- **Project-specific** - Different enrichment for different projects
- **Query-specific** - Different enrichment based on query intent

---

## Conclusion

Phase 12 transforms search results from isolated code snippets into comprehensive, contextual information packages. By leveraging the graph relationships built in Phase 10, we provide the LLM with complete understanding of:

- **What the code does** (the code itself)
- **What depends on it** (callers, child classes)
- **What it depends on** (callees, parent classes, imports)
- **How it's tested** (test coverage)
- **How it's typed** (type information)
- **Where it lives** (file context)

This enables the LLM to make better decisions, generate better code, and provide better assistance to developers.

**Expected Impact:** +5-7% progress toward world-class status (85-90% → 92-95%)

---

**Document Status:** ✅ Complete and ready for implementation


```
