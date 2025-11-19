# Phase 13: Quality Metrics Implementation Plan

**Status:** In Progress  
**Target:** 92-95% → 100% World-Class Status (+5-8% progress)  
**Duration:** 1-2 weeks  
**Complexity:** Medium-High  
**Prerequisites:** Phases 10-12 (Graph Relationships, Impact Analysis, Enhanced Context)

---

## 🎯 Objectives

Implement comprehensive code quality metrics that leverage the Neo4j graph database, Tree-sitter AST analysis, and LSP integration to provide:

1. **Complexity Metrics** - Cyclomatic and cognitive complexity analysis
2. **Test Coverage** - Accurate test coverage calculation using graph relationships
3. **Dead Code Detection** - Identify unused functions, unreachable code, orphaned nodes
4. **Quality Scoring** - Multi-factor quality scores for code segments and files
5. **Integration** - Seamless integration with search results and context enrichment

---

## 📊 Current State Analysis

### What We Have (From Previous Phases)

**Phase 10: Critical Graph Relationships**

- ✅ CALLS / CALLED_BY relationships
- ✅ TESTS / TESTED_BY relationships
- ✅ HAS_TYPE / ACCEPTS_TYPE / RETURNS_TYPE relationships
- ✅ EXTENDS / EXTENDED_BY / IMPLEMENTS / IMPLEMENTED_BY relationships

**Phase 11: Impact Analysis**

- ✅ Graph traversal for impact analysis
- ✅ Dependency tree calculation
- ✅ Blast radius assessment
- ✅ Change safety evaluation

**Phase 12: Enhanced Context**

- ✅ Context enrichment service
- ✅ Related code, tests, dependencies, type info
- ✅ File summaries with caching

**Existing Infrastructure:**

- ✅ Tree-sitter AST parser (`src/services/code-index/parser/code-parser.ts`)
- ✅ Neo4j graph database (`src/services/code-index/graph/neo4j-service.ts`)
- ✅ LSP integration (`src/services/code-index/lsp/lsp-service.ts`)
- ✅ Search orchestration (`src/services/code-index/query/search-orchestrator.ts`)

### What's Missing (Phase 13 Scope)

**Complexity Metrics:**

- ❌ Cyclomatic complexity calculation
- ❌ Cognitive complexity calculation
- ❌ Nesting depth analysis
- ❌ Function length metrics

**Test Coverage:**

- ❌ Accurate coverage percentage calculation
- ❌ Uncovered code identification
- ❌ Test quality assessment
- ❌ Coverage trends over time

**Dead Code Detection:**

- ❌ Unused function detection (no CALLED_BY relationships)
- ❌ Unreachable code detection (no paths from entry points)
- ❌ Orphaned node detection (no relationships)
- ❌ Unused import detection

**Quality Scoring:**

- ❌ Multi-factor quality score calculation
- ❌ Code smell detection
- ❌ Maintainability index
- ❌ Technical debt estimation

---

## 🏗️ Architecture Design

### Quality Metrics Service

**File:** `src/services/code-index/quality/quality-metrics-service.ts`

**Responsibilities:**

1. Calculate complexity metrics from AST
2. Calculate test coverage from graph relationships
3. Detect dead code using graph analysis
4. Compute quality scores combining multiple factors
5. Cache results for performance

**Key Methods:**

```typescript
interface IQualityMetricsService {
	// Complexity Analysis
	calculateComplexity(nodeId: string): Promise<ComplexityMetrics>
	calculateFileComplexity(filePath: string): Promise<FileComplexityMetrics>

	// Test Coverage
	calculateCoverage(nodeId: string): Promise<CoverageMetrics>
	calculateFileCoverage(filePath: string): Promise<FileCoverageMetrics>

	// Dead Code Detection
	findDeadCode(filePath?: string): Promise<DeadCodeReport>
	findUnusedFunctions(): Promise<CodeNode[]>
	findOrphanedNodes(): Promise<CodeNode[]>

	// Quality Scoring
	calculateQualityScore(nodeId: string): Promise<QualityScore>
	calculateFileQualityScore(filePath: string): Promise<FileQualityScore>

	// Batch Operations
	enrichWithQualityMetrics(results: HybridSearchResult[]): Promise<EnrichedSearchResult[]>
}
```

### Data Structures

**File:** `src/services/code-index/interfaces/quality-metrics.ts`

```typescript
interface ComplexityMetrics {
	cyclomaticComplexity: number // Number of decision points + 1
	cognitiveComplexity: number // Weighted complexity based on nesting
	nestingDepth: number // Maximum nesting level
	functionLength: number // Lines of code
	parameterCount: number // Number of parameters
}

interface CoverageMetrics {
	isTested: boolean
	directTests: number // Count of direct test relationships
	integrationTests: number // Count of integration test relationships
	coveragePercentage: number // 0-100
	uncoveredLines: number[] // Line numbers not covered
}

interface DeadCodeReport {
	unusedFunctions: CodeReference[]
	orphanedNodes: CodeReference[]
	unreachableCode: CodeReference[]
	unusedImports: string[]
	totalDeadCodeLines: number
}

interface QualityScore {
	overall: number // 0-100 composite score
	complexity: number // 0-100 (lower complexity = higher score)
	coverage: number // 0-100 (test coverage percentage)
	maintainability: number // 0-100 (based on multiple factors)
	factors: {
		hasTests: boolean
		isWellDocumented: boolean
		hasLowComplexity: boolean
		hasNoDeadCode: boolean
		followsConventions: boolean
	}
}
```

---

## 🔧 Implementation Tasks

### Task 13.1: Create Implementation Plan ✅

- [x] Create PHASE13_QUALITY_METRICS_PLAN.md
- [x] Define architecture and interfaces
- [x] Identify integration points

### Task 13.2: Analyze Existing Infrastructure

- [ ] Review Tree-sitter AST parser capabilities
- [ ] Review Neo4j graph query methods
- [ ] Review search orchestration integration points
- [ ] Document complexity calculation algorithms

**Files to Review:**

- `src/services/code-index/parser/code-parser.ts`
- `src/services/code-index/graph/neo4j-service.ts`
- `src/services/code-index/query/search-orchestrator.ts`
- `src/services/code-index/context/context-enrichment-service.ts`

### Task 13.3: Implement Quality Metrics Service

- [ ] Create interfaces (`quality-metrics.ts`)
- [ ] Implement complexity analysis
- [ ] Implement test coverage calculation
- [ ] Implement dead code detection
- [ ] Implement quality scoring
- [ ] Add LRU caching for performance

**Files to Create:**

- `src/services/code-index/interfaces/quality-metrics.ts`
- `src/services/code-index/quality/quality-metrics-service.ts`

### Task 13.4: Integrate with Search Infrastructure

- [ ] Extend SearchOrchestrator to include quality metrics
- [ ] Update CodebaseSearchTool to format quality metrics
- [ ] Add quality metrics to search result type definitions

**Files to Modify:**

- `src/services/code-index/query/search-orchestrator.ts`
- `src/core/tools/CodebaseSearchTool.ts`

### Task 13.5: Test and Validate

- [ ] Create comprehensive unit tests
- [ ] Test complexity calculations with real code
- [ ] Test coverage calculations with test files
- [ ] Test dead code detection
- [ ] Run type checks and linter
- [ ] Validate performance (<50ms per result)

**Files to Create:**

- `src/services/code-index/quality/__tests__/quality-metrics-service.spec.ts`

### Task 13.6: Commit and Push

- [ ] Commit all changes with detailed message
- [ ] Push to remote immediately

---

## 📐 Complexity Calculation Algorithms

### Cyclomatic Complexity

**Definition:** Number of linearly independent paths through code
**Formula:** `M = E - N + 2P`

- E = number of edges in control flow graph
- N = number of nodes
- P = number of connected components (usually 1)

**Simplified Calculation:**

```
Cyclomatic Complexity = 1 + (number of decision points)

Decision points:
- if, else if
- for, while, do-while
- case in switch
- catch
- && and || in conditions
- ternary operator (? :)
```

**Implementation Strategy:**

1. Parse AST with Tree-sitter
2. Count decision point nodes
3. Add 1 to the count

**Thresholds:**

- 1-10: Simple, low risk
- 11-20: Moderate complexity
- 21-50: High complexity, needs refactoring
- 50+: Very high complexity, critical

### Cognitive Complexity

**Definition:** Measure of how difficult code is to understand
**Key Difference from Cyclomatic:** Considers nesting and structural complexity

**Calculation Rules:**

1. **Increment for each:**

    - if, else if, else, ternary
    - switch
    - for, while, do-while
    - catch
    - && and || in conditions
    - Recursion

2. **Nesting Penalty:**

    - Each level of nesting adds +1 to the increment
    - Example: if inside if = +2 (base +1, nesting +1)

3. **No Increment for:**
    - else (already counted with if)
    - switch cases (only switch itself counts)

**Implementation Strategy:**

1. Traverse AST depth-first
2. Track nesting level
3. Apply rules based on node type and depth

**Thresholds:**

- 0-5: Very simple
- 6-10: Simple
- 11-20: Moderate
- 21-50: Complex
- 50+: Very complex

---

## 🧪 Test Coverage Calculation

### Strategy

**Leverage Phase 10 TESTS/TESTED_BY Relationships:**

1. **Direct Coverage:**

    ```cypher
    MATCH (code:function)-[:TESTED_BY]->(test)
    RETURN count(test) as directTests
    ```

2. **Integration Coverage:**

    ```cypher
    MATCH (code:function)<-[:CALLS]-(caller)-[:TESTED_BY]->(test)
    RETURN count(DISTINCT test) as integrationTests
    ```

3. **Coverage Percentage:**

    ```typescript
    coveragePercentage = (testedNodes / totalNodes) * 100
    ```

4. **File-Level Coverage:**
    ```cypher
    MATCH (file:file)-[:CONTAINS]->(node)
    OPTIONAL MATCH (node)-[:TESTED_BY]->(test)
    RETURN
      count(node) as totalNodes,
      count(test) as testedNodes
    ```

### Coverage Metrics

```typescript
interface CoverageMetrics {
	isTested: boolean // Has at least one test
	directTests: number // Direct TESTED_BY relationships
	integrationTests: number // Tests via callers
	coveragePercentage: number // 0-100
	testQuality: "none" | "low" | "medium" | "high"
}
```

**Test Quality Assessment:**

- `none`: No tests (0%)
- `low`: Only integration tests (1-50%)
- `medium`: Some direct tests (51-80%)
- `high`: Good direct test coverage (81-100%)

---

## 🔍 Dead Code Detection

### Unused Functions

**Strategy:** Find functions with no CALLED_BY relationships

```cypher
MATCH (func:function)
WHERE NOT (func)<-[:CALLED_BY]-()
  AND NOT (func)<-[:TESTED_BY]-()
  AND NOT func.isExported = true
RETURN func
```

**Exceptions:**

- Exported functions (may be used externally)
- Entry points (main, handlers)
- Test functions
- Lifecycle methods (constructor, componentDidMount, etc.)

### Orphaned Nodes

**Strategy:** Find nodes with no relationships

```cypher
MATCH (node)
WHERE NOT (node)-[]-()
RETURN node
```

### Unreachable Code

**Strategy:** Find nodes with no path from entry points

```cypher
MATCH (entry:function {isEntryPoint: true})
MATCH (node:function)
WHERE NOT EXISTS {
  MATCH path = (entry)-[:CALLS*]->(node)
}
AND node.id <> entry.id
RETURN node
```

---

## 🎯 Quality Scoring Algorithm

### Multi-Factor Score Calculation

```typescript
function calculateQualityScore(metrics: {
	complexity: ComplexityMetrics
	coverage: CoverageMetrics
	deadCode: boolean
	documentation: boolean
}): QualityScore {
	// Complexity Score (0-100, higher is better)
	const complexityScore = Math.max(0, 100 - metrics.complexity.cyclomaticComplexity * 2)

	// Coverage Score (0-100)
	const coverageScore = metrics.coverage.coveragePercentage

	// Maintainability Score (0-100)
	const maintainabilityScore =
		complexityScore * 0.4 + coverageScore * 0.3 + (metrics.documentation ? 20 : 0) + (metrics.deadCode ? 0 : 10)

	// Overall Score (weighted average)
	const overallScore = complexityScore * 0.3 + coverageScore * 0.4 + maintainabilityScore * 0.3

	return {
		overall: Math.round(overallScore),
		complexity: Math.round(complexityScore),
		coverage: Math.round(coverageScore),
		maintainability: Math.round(maintainabilityScore),
		factors: {
			hasTests: metrics.coverage.isTested,
			isWellDocumented: metrics.documentation,
			hasLowComplexity: metrics.complexity.cyclomaticComplexity <= 10,
			hasNoDeadCode: !metrics.deadCode,
			followsConventions: true, // Placeholder for future analysis
		},
	}
}
```

### Score Interpretation

**Overall Score:**

- 90-100: Excellent quality
- 75-89: Good quality
- 60-74: Acceptable quality
- 40-59: Needs improvement
- 0-39: Poor quality, refactor needed

---

## 🔌 Integration Points

### SearchOrchestrator Integration

**File:** `src/services/code-index/query/search-orchestrator.ts`

**Changes:**

1. Add `QualityMetricsService` as dependency
2. Add `includeQualityMetrics` option to `SearchOrchestrationOptions`
3. Call `enrichWithQualityMetrics()` after context enrichment
4. Extend `OrchestrationResult` to include quality metrics

```typescript
interface SearchOrchestrationOptions {
	// ... existing options ...
	contextEnrichment?: ContextEnrichmentOptions
	qualityMetrics?: QualityMetricsOptions // NEW
}

interface QualityMetricsOptions {
	includeComplexity?: boolean
	includeCoverage?: boolean
	includeDeadCodeCheck?: boolean
	includeQualityScore?: boolean
}

interface OrchestrationResult extends EnrichedSearchResult {
	// ... existing fields ...
	qualityMetrics?: QualityMetrics // NEW
}
```

### CodebaseSearchTool Integration

**File:** `src/core/tools/CodebaseSearchTool.ts`

**Changes:**

1. Add quality metrics to result type definition
2. Format quality metrics in JSON output
3. Format quality metrics in text output

```typescript
// Add to result type
interface SearchResult {
	// ... existing fields ...
	qualityMetrics?: {
		complexity?: ComplexityMetrics
		coverage?: CoverageMetrics
		qualityScore?: QualityScore
	}
}

// Format in text output
if (result.qualityMetrics) {
	const qm = result.qualityMetrics
	if (qm.qualityScore) {
		parts.push(`Quality Score: ${qm.qualityScore.overall}/100`)
	}
	if (qm.complexity) {
		parts.push(`Complexity: ${qm.complexity.cyclomaticComplexity}`)
	}
	if (qm.coverage) {
		parts.push(`Test Coverage: ${qm.coverage.coveragePercentage}%`)
	}
}
```

---

## ⚡ Performance Considerations

### Caching Strategy

**LRU Cache for Quality Metrics:**

- Cache size: 500 entries
- Cache key: `${nodeId}:${metricType}`
- TTL: 5 minutes (metrics can change as code changes)

```typescript
class QualityMetricsService {
	private metricsCache = new LRUCache<string, any>({
		max: 500,
		ttl: 5 * 60 * 1000, // 5 minutes
	})

	private getCacheKey(nodeId: string, type: string): string {
		return `${nodeId}:${type}`
	}
}
```

### Lazy Loading

**Only calculate metrics when requested:**

- Don't calculate by default for all search results
- Require explicit opt-in via `qualityMetrics` option
- Skip for large result sets (>20 results)

### Parallel Processing

**Calculate metrics in parallel:**

```typescript
async enrichWithQualityMetrics(results: HybridSearchResult[]): Promise<EnrichedSearchResult[]> {
  return Promise.all(
    results.map(async (result) => {
      const [complexity, coverage, qualityScore] = await Promise.all([
        this.calculateComplexity(nodeId),
        this.calculateCoverage(nodeId),
        this.calculateQualityScore(nodeId)
      ])

      return {
        ...result,
        qualityMetrics: { complexity, coverage, qualityScore }
      }
    })
  )
}
```

### Performance Targets

- **Complexity calculation:** <10ms per function
- **Coverage calculation:** <20ms per function (requires graph query)
- **Dead code detection:** <100ms per file
- **Quality score:** <5ms (combines cached metrics)
- **Total enrichment:** <50ms per search result

---

## 🧪 Testing Strategy

### Unit Tests

**File:** `src/services/code-index/quality/__tests__/quality-metrics-service.spec.ts`

**Test Coverage:**

1. **Complexity Calculation:**

    - Simple function (complexity = 1)
    - Function with if statements
    - Function with loops
    - Nested conditions
    - Edge cases (empty function, very complex function)

2. **Coverage Calculation:**

    - Function with no tests
    - Function with direct tests
    - Function with integration tests
    - File-level coverage

3. **Dead Code Detection:**

    - Unused function detection
    - Orphaned node detection
    - Exported function handling
    - Entry point handling

4. **Quality Scoring:**
    - High quality code (low complexity, high coverage)
    - Low quality code (high complexity, no coverage)
    - Edge cases (missing metrics)

### Integration Tests

**Test with Real Codebase:**

1. Run quality metrics on this codebase
2. Verify complexity calculations match manual analysis
3. Verify coverage calculations match actual test coverage
4. Verify dead code detection finds known unused code

---

## 📈 Success Metrics

### Quantitative Metrics

**Accuracy:**

- Complexity calculations match manual analysis: >95%
- Coverage calculations match actual coverage: >90%
- Dead code detection false positive rate: <5%

**Performance:**

- Complexity calculation: <10ms per function
- Coverage calculation: <20ms per function
- Dead code detection: <100ms per file
- Total enrichment: <50ms per result

**Coverage:**

- Unit test coverage: >90%
- Integration test coverage: >80%

### Qualitative Metrics

**Usefulness:**

- Quality metrics help identify refactoring candidates
- Coverage metrics help identify untested code
- Dead code detection helps clean up codebase
- Quality scores provide actionable insights

**Integration:**

- Seamlessly integrated with search results
- No performance degradation
- Backward compatible (metrics are optional)

---

## 🎯 Expected Impact

### Progress Toward World-Class Status

**Before Phase 13:** 92-95%
**After Phase 13:** **100%** (+5-8% progress)

**Impact Breakdown:**

- Complexity metrics: +2%
- Test coverage calculation: +2%
- Dead code detection: +2%
- Quality scoring: +2%

### User Benefits

1. **Better Code Quality Awareness:**

    - See complexity scores in search results
    - Identify high-complexity functions that need refactoring
    - Track quality trends over time

2. **Improved Test Coverage:**

    - Identify untested code
    - See coverage percentages in search results
    - Prioritize testing efforts

3. **Cleaner Codebase:**

    - Find and remove dead code
    - Identify orphaned nodes
    - Clean up unused imports

4. **Data-Driven Refactoring:**
    - Quality scores guide refactoring priorities
    - Complexity metrics identify problem areas
    - Coverage metrics ensure safety

---

## 🚀 Implementation Order

### Phase 1: Interfaces and Core Service (Day 1-2)

1. Create `quality-metrics.ts` interfaces
2. Create `QualityMetricsService` skeleton
3. Implement complexity calculation
4. Add unit tests for complexity

### Phase 2: Coverage and Dead Code (Day 3-4)

1. Implement coverage calculation
2. Implement dead code detection
3. Add unit tests for coverage and dead code
4. Test with real codebase

### Phase 3: Quality Scoring (Day 5)

1. Implement quality score calculation
2. Add caching layer
3. Add unit tests for quality scoring
4. Performance optimization

### Phase 4: Integration (Day 6-7)

1. Integrate with SearchOrchestrator
2. Update CodebaseSearchTool
3. Add integration tests
4. End-to-end testing

### Phase 5: Polish and Documentation (Day 8)

1. Run all tests
2. Type checks and linter
3. Performance validation
4. Commit and push

---

## 🔮 Future Enhancements (Post-Phase 13)

### Phase 14 Considerations

After completing Phase 13, conduct an audit to determine if **Phase 14: Search Result Reranking** is needed:

**Questions to Answer:**

1. Are search results sufficiently relevant with current hybrid search?
2. Would quality metrics improve result ranking?
3. Is LLM-based reranking worth the cost/complexity?
4. Are there specific query types that need better ranking?

**Potential Phase 14 Scope:**

- LLM-based result reranking
- Learning-to-rank models
- Cross-encoder reranking
- Quality-aware result boosting
- User feedback integration

**Decision Criteria:**

- If search relevance is >90%, Phase 14 may not be needed
- If quality metrics significantly improve ranking, implement Phase 14
- If user feedback indicates ranking issues, implement Phase 14

---

## ✅ Acceptance Criteria

### Phase 13 Complete When:

1. ✅ All interfaces defined and documented
2. ✅ QualityMetricsService fully implemented
3. ✅ Complexity calculation working and tested
4. ✅ Coverage calculation working and tested
5. ✅ Dead code detection working and tested
6. ✅ Quality scoring working and tested
7. ✅ Integration with SearchOrchestrator complete
8. ✅ Integration with CodebaseSearchTool complete
9. ✅ All unit tests passing (>90% coverage)
10. ✅ All integration tests passing
11. ✅ Type checks passing
12. ✅ Linter passing
13. ✅ Performance targets met
14. ✅ Changes committed and pushed
15. ✅ Phase 14 audit conducted

---

## 📝 Notes

### Key Design Decisions

1. **Use Tree-sitter for Complexity:**

    - Accurate AST-based analysis
    - Language-agnostic approach
    - Consistent with existing parser

2. **Use Neo4j for Coverage:**

    - Leverage TESTS/TESTED_BY relationships
    - Accurate relationship-based coverage
    - Efficient graph queries

3. **Use Graph Analysis for Dead Code:**

    - Relationship-based detection
    - Accurate and comprehensive
    - Handles complex dependency chains

4. **Multi-Factor Quality Scoring:**
    - Combines multiple metrics
    - Weighted scoring for importance
    - Actionable insights

### Risks and Mitigations

**Risk:** Complexity calculation performance
**Mitigation:** LRU caching, lazy loading, parallel processing

**Risk:** Coverage calculation accuracy
**Mitigation:** Leverage Phase 10 relationships, validate with real tests

**Risk:** Dead code false positives
**Mitigation:** Handle exceptions (exports, entry points, lifecycle methods)

**Risk:** Integration complexity
**Mitigation:** Follow Phase 12 pattern, optional enrichment, backward compatible

---

**End of Phase 13 Implementation Plan**
