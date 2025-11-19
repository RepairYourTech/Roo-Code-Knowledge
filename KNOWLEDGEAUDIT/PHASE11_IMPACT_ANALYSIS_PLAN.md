# Phase 11: Impact Analysis Implementation Plan

**Status:** 🚧 In Progress
**Created:** 2025-11-19
**Target:** +10-15% progress toward world-class status (74% → 85-90%)

---

## Executive Summary

Phase 11 implements **impact analysis capabilities** that leverage the Neo4j graph relationships built in Phase 10. This enables the AI to answer critical questions like "what breaks if I change this?", "what does this depend on?", and "can I safely change this?" - essential for safe code modifications in existing codebases.

**Key Capabilities to Implement:**

1. **Impact Analysis** - Find all code affected by a change (traverse CALLED_BY, EXTENDED_BY, IMPLEMENTED_BY, TESTED_BY)
2. **Dependency Analysis** - Find all dependencies of a symbol (traverse CALLS, EXTENDS, IMPLEMENTS, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE)
3. **Blast Radius Calculation** - Calculate transitive dependencies up to N levels deep
4. **Change Safety Assessment** - Combine impact analysis with test coverage to assess change safety

---

## Current State Analysis

### Existing Graph Relationships (Phase 10)

**Implemented in Phase 10:**

- ✅ CALLS / CALLED_BY - Function call graph
- ✅ TESTS / TESTED_BY - Test coverage relationships
- ✅ HAS_TYPE / ACCEPTS_TYPE / RETURNS_TYPE - Type system relationships
- ✅ EXTENDS / EXTENDED_BY - Class inheritance
- ✅ IMPLEMENTS / IMPLEMENTED_BY - Interface implementation
- ✅ CONTAINS - File/class containment
- ✅ IMPORTS - Import relationships
- ✅ DEFINES - Nested definitions

**Total: 15 relationship types** available for traversal

### Existing Neo4j Service Methods

**Current query methods in `Neo4jService`:**

- `findCallers(nodeId)` - Find who calls a function (1-level CALLED_BY)
- `findCallees(nodeId)` - Find what a function calls (1-level CALLS)
- `findDependencies(filePath)` - Find imports (1-level IMPORTS)
- `findDependents(filePath)` - Find who imports (1-level reverse IMPORTS)
- `findImplementations(interfaceId)` - Find interface implementations (1-level IMPLEMENTED_BY)
- `findSubclasses(classId)` - Find class subclasses (1-level EXTENDED_BY)
- `executeQuery(cypher, params)` - Execute custom Cypher queries

**Limitations:**

- ❌ All queries are **1-level deep** only (no transitive traversal)
- ❌ No combined relationship traversal (e.g., CALLED_BY + EXTENDED_BY + TESTED_BY)
- ❌ No depth-limited traversal to prevent infinite loops
- ❌ No impact scoring or blast radius calculation
- ❌ No test coverage integration with impact analysis

### Existing Query Analyzer

**Current intents in `QueryAnalyzer`:**

- `find_callers` - "who calls this?"
- `find_callees` - "what does this call?"
- `find_dependencies` - "what does this import?"
- `find_dependents` - "what imports this?"
- `find_implementation` - "how is this implemented?"
- `find_usages` - "where is this used?"
- `find_tests` - "find tests for this"
- `find_by_type` - "find by type"
- `find_examples` - "find usage examples"
- `find_pattern` - "find design patterns"
- `semantic_search` - default

**Missing intents for Phase 11:**

- ❌ `impact_analysis` - "what breaks if I change this?"
- ❌ `dependency_analysis` - "what does this depend on?" (comprehensive, multi-level)
- ❌ `blast_radius` - "what's the impact of this change?"
- ❌ `change_safety` - "can I safely change this?"

---

## Implementation Strategy

### 1. New Impact Analysis Methods in Neo4jService

Add the following methods to `src/services/code-index/graph/neo4j-service.ts`:

#### A. `findImpactedNodes(nodeId: string, maxDepth: number): Promise<ImpactAnalysisResult>`

**Purpose:** Find all code that would be affected by changing a symbol

**Traversal Strategy:**

- Traverse CALLED_BY (who calls this?)
- Traverse EXTENDED_BY (who extends this class?)
- Traverse IMPLEMENTED_BY (who implements this interface?)
- Traverse TESTED_BY (what tests cover this?)
- Traverse up to `maxDepth` levels (default: 3)

**Return Type:**

```typescript
interface ImpactAnalysisResult {
	impactedNodes: CodeNode[]
	dependencyChains: DependencyChain[]
	blastRadius: {
		totalNodes: number
		totalFiles: number
		maxDepth: number
	}
	testCoverage: {
		hasTests: boolean
		testNodes: CodeNode[]
		coveragePercentage: number
	}
}

interface DependencyChain {
	path: CodeNode[]
	relationshipTypes: string[]
	depth: number
}
```

**Cypher Query:**

```cypher
// Find all nodes impacted by changing nodeId (up to maxDepth levels)
MATCH path = (impacted:CodeNode)-[:CALLED_BY|EXTENDED_BY|IMPLEMENTED_BY|TESTED_BY*1..${maxDepth}]->(target:CodeNode {id: $nodeId})
RETURN DISTINCT impacted, path
ORDER BY length(path) ASC
```

#### B. `findDependencyTree(nodeId: string, maxDepth: number): Promise<DependencyAnalysisResult>`

**Purpose:** Find all dependencies of a symbol (what it depends on)

**Traversal Strategy:**

- Traverse CALLS (what does this call?)
- Traverse EXTENDS (what class does this extend?)
- Traverse IMPLEMENTS (what interfaces does this implement?)
- Traverse HAS_TYPE (what types does this use?)
- Traverse ACCEPTS_TYPE (what parameter types does this accept?)
- Traverse RETURNS_TYPE (what return types does this use?)
- Traverse IMPORTS (what does this import?)
- Traverse up to `maxDepth` levels (default: 3)

**Return Type:**

```typescript
interface DependencyAnalysisResult {
	dependencies: CodeNode[]
	dependencyChains: DependencyChain[]
	dependencyTree: {
		totalNodes: number
		totalFiles: number
		maxDepth: number
	}
}
```

**Cypher Query:**

```cypher
// Find all dependencies of nodeId (up to maxDepth levels)
MATCH path = (source:CodeNode {id: $nodeId})-[:CALLS|EXTENDS|IMPLEMENTS|HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE|IMPORTS*1..${maxDepth}]->(dependency:CodeNode)
RETURN DISTINCT dependency, path
ORDER BY length(path) ASC
```

#### C. `calculateBlastRadius(nodeId: string, maxDepth: number): Promise<BlastRadiusResult>`

**Purpose:** Calculate the blast radius of changing a symbol

**Combines:**

- Impact analysis (who depends on this?)
- Dependency analysis (what does this depend on?)
- Test coverage (is this tested?)

**Return Type:**

```typescript
interface BlastRadiusResult {
	targetNode: CodeNode
	impactedNodes: CodeNode[]
	dependencies: CodeNode[]
	tests: CodeNode[]
	metrics: {
		totalImpactedNodes: number
		totalImpactedFiles: number
		totalDependencies: number
		totalTests: number
		maxImpactDepth: number
		maxDependencyDepth: number
		riskScore: number // 0-100, higher = riskier change
	}
}
```

**Risk Score Calculation:**

```typescript
riskScore =
	((impactedNodes.length * 10 + // More impacted nodes = higher risk
		impactedFiles.length * 20 + // More impacted files = higher risk
		maxImpactDepth * 15 + // Deeper impact = higher risk
		(tests.length === 0 ? 50 : 0) - // No tests = +50 risk
		tests.length * 5) / // More tests = lower risk
		100) *
	100 // Normalize to 0-100
```

#### D. `assessChangeSafety(nodeId: string): Promise<ChangeSafetyResult>`

**Purpose:** Assess whether it's safe to change a symbol

**Combines:**

- Blast radius calculation
- Test coverage analysis
- Impact depth analysis

**Return Type:**

```typescript
interface ChangeSafetyResult {
	nodeId: string
	nodeName: string
	safetyLevel: "safe" | "moderate" | "risky" | "dangerous"
	riskScore: number // 0-100
	reasons: string[]
	recommendations: string[]
	impactSummary: {
		impactedNodes: number
		impactedFiles: number
		maxDepth: number
	}
	testCoverage: {
		hasTests: boolean
		testCount: number
		coveragePercentage: number
	}
}
```

**Safety Level Determination:**

```typescript
if (riskScore < 20) return "safe"
if (riskScore < 40) return "moderate"
if (riskScore < 70) return "risky"
return "dangerous"
```

---

### 2. New Query Intents in QueryAnalyzer

Add the following intents to `src/services/code-index/query/query-analyzer.ts`:

#### A. `impact_analysis` Intent

**Trigger Patterns:**

- "what breaks if I change"
- "what will break"
- "impact of changing"
- "affected by changing"
- "what depends on"
- "who uses"

**Backend Configuration:**

```typescript
{
  intent: "impact_analysis",
  symbolName: extractSymbolName(query),
  backends: ["graph"],
  weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 }
}
```

#### B. `dependency_analysis` Intent

**Trigger Patterns:**

- "what does this depend on"
- "dependencies of"
- "what does this use"
- "dependency tree"
- "what does this import"

**Backend Configuration:**

```typescript
{
  intent: "dependency_analysis",
  symbolName: extractSymbolName(query),
  backends: ["graph"],
  weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 }
}
```

#### C. `blast_radius` Intent

**Trigger Patterns:**

- "blast radius"
- "impact radius"
- "scope of change"
- "how big is the change"

**Backend Configuration:**

```typescript
{
  intent: "blast_radius",
  symbolName: extractSymbolName(query),
  backends: ["graph"],
  weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 }
}
```

#### D. `change_safety` Intent

**Trigger Patterns:**

- "can I safely change"
- "is it safe to change"
- "safe to modify"
- "risk of changing"

**Backend Configuration:**

```typescript
{
  intent: "change_safety",
  symbolName: extractSymbolName(query),
  backends: ["graph"],
  weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 }
}
```

---

### 3. Integration with SearchOrchestrator

Update `src/services/code-index/query/search-orchestrator.ts` to handle new intents:

**In `performGraphSearch()` method:**

```typescript
case "impact_analysis":
  if (analysis.symbolName && this.neo4jService.findImpactedNodes) {
    const result = await this.neo4jService.findImpactedNodes(analysis.symbolName, 3)
    return this.convertImpactAnalysisToResults(result)
  }
  break

case "dependency_analysis":
  if (analysis.symbolName && this.neo4jService.findDependencyTree) {
    const result = await this.neo4jService.findDependencyTree(analysis.symbolName, 3)
    return this.convertDependencyAnalysisToResults(result)
  }
  break

case "blast_radius":
  if (analysis.symbolName && this.neo4jService.calculateBlastRadius) {
    const result = await this.neo4jService.calculateBlastRadius(analysis.symbolName, 3)
    return this.convertBlastRadiusToResults(result)
  }
  break

case "change_safety":
  if (analysis.symbolName && this.neo4jService.assessChangeSafety) {
    const result = await this.neo4jService.assessChangeSafety(analysis.symbolName)
    return this.convertChangeSafetyToResults(result)
  }
  break
```

---

## Implementation Tasks

### Task 11.1: Create Implementation Plan ✅

- [x] Analyze existing graph infrastructure
- [x] Design impact analysis query types
- [x] Design graph traversal algorithms
- [x] Design integration points
- [x] Document implementation plan

### Task 11.2: Analyze Existing Graph Infrastructure

- [ ] Review Neo4jService implementation
- [ ] Review GraphIndexer relationship extraction
- [ ] Review existing graph queries
- [ ] Identify integration points

### Task 11.3: Implement Impact Analysis Service

- [ ] Add `ImpactAnalysisResult` interface to neo4j-service.ts
- [ ] Add `DependencyAnalysisResult` interface to neo4j-service.ts
- [ ] Add `BlastRadiusResult` interface to neo4j-service.ts
- [ ] Add `ChangeSafetyResult` interface to neo4j-service.ts
- [ ] Implement `findImpactedNodes()` method
- [ ] Implement `findDependencyTree()` method
- [ ] Implement `calculateBlastRadius()` method
- [ ] Implement `assessChangeSafety()` method
- [ ] Add helper methods for result conversion

### Task 11.4: Integrate with Search Orchestrator

- [ ] Add new intents to QueryAnalyzer
- [ ] Update performGraphSearch() to handle new intents
- [ ] Add result conversion methods to SearchOrchestrator
- [ ] Test query routing for impact analysis queries

### Task 11.5: Test and Validate

- [ ] Test impact analysis with real codebase examples
- [ ] Test dependency analysis with real codebase examples
- [ ] Test blast radius calculation
- [ ] Test change safety assessment
- [ ] Verify results are accurate and useful
- [ ] Run type checks (pnpm check-types)
- [ ] Run linter (pnpm lint)

### Task 11.6: Commit and Push

- [ ] Commit all changes with descriptive message
- [ ] Push to remote immediately

---

## Success Criteria

✅ **Impact Analysis:**

- Can answer "what breaks if I change this function?" with complete list of affected code
- Returns dependency chains showing how code is connected
- Calculates blast radius (number of affected files/symbols)

✅ **Dependency Analysis:**

- Can answer "what does this class depend on?" with full dependency tree
- Shows all transitive dependencies up to N levels deep
- Identifies circular dependencies

✅ **Change Safety:**

- Can assess change safety based on impact + test coverage
- Provides risk score (0-100) and safety level (safe/moderate/risky/dangerous)
- Gives actionable recommendations

✅ **Integration:**

- QueryAnalyzer detects impact analysis queries
- SearchOrchestrator routes to Neo4j backend
- Results formatted for AI consumption with clear explanations

✅ **Quality:**

- All type checks pass (pnpm check-types)
- All linter checks pass (pnpm lint)
- Changes committed and pushed to remote

---

## Expected Impact

**Progress:** 74% → 85-90% (+10-15%)

**Capabilities Unlocked:**

- ✅ "What breaks if I change this?" - Complete impact analysis
- ✅ "What does this depend on?" - Full dependency tree
- ✅ "What's the blast radius?" - Quantified change impact
- ✅ "Can I safely change this?" - Risk assessment with recommendations

**User Value:**

- Safe code modifications in existing codebases
- Confidence when making changes
- Understanding of code dependencies
- Proactive risk assessment

---

## Next Steps After Phase 11

**Phase 12: Enhanced Context** (80-85% → 88-92%)

- Use relationships to provide better context in search results
- Show related code, tests, and dependencies
- Enhance AI's understanding of code structure

**Phase 13: Quality Metrics** (88-92% → 95-98%)

- Calculate code quality metrics using the graph
- Test coverage percentages
- Cyclomatic complexity
- Dead code detection

**Phase 14: Advanced Graph Queries** (95-98% → 100%)

- Circular dependency detection
- Unused code detection
- API surface analysis
- Refactoring suggestions

---

**End of Implementation Plan**
