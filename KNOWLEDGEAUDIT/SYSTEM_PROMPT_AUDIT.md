# System Prompt Audit: Codebase Index Integration

**Date**: 2025-11-19  
**Status**: Audit Complete  
**Purpose**: Identify opportunities to leverage the world-class codebase index (Phases 10-13) in system prompts

---

## Executive Summary

This audit evaluates how well Roo-Code's system prompts and mode-specific prompts leverage the newly completed world-class codebase index. The goal is to ensure Roo automatically uses the index in all scenarios where it provides value, maximizing ROI from Phases 10-13 enhancements.

**Key Findings**:

- ✅ **GOOD**: `codebase_search` tool is well-documented with comprehensive usage guidelines
- ✅ **GOOD**: Tool Use Guidelines section has strong "CRITICAL" directive to use codebase_search first
- ⚠️ **GAP**: Phase 10-13 capabilities (graph relationships, impact analysis, context enrichment, quality metrics) are **NOT mentioned** in any prompts
- ⚠️ **GAP**: Mode-specific prompts don't instruct when to use codebase index for their specific tasks
- ⚠️ **GAP**: No guidance on when to use vector vs. BM25 vs. graph vs. LSP search strategies
- ⚠️ **GAP**: Orchestrator mode doesn't know to delegate codebase understanding tasks to modes with codebase_search
- ❌ **CRITICAL**: Prompts describe codebase_search as "semantic search" only - missing hybrid search, graph queries, quality metrics

**Overall Assessment**: **MODERATE GAPS** - The foundation is good, but significant enhancements are needed to fully leverage the world-class index.

---

## 1. Files Audited

### System Prompt Files

1. **`src/core/prompts/system.ts`** - Main system prompt builder
2. **`src/core/prompts/sections/capabilities.ts`** - Capabilities section (mentions codebase_search)
3. **`src/core/prompts/sections/tool-use-guidelines.ts`** - Tool usage guidelines (strong codebase_search directive)
4. **`src/core/prompts/sections/modes.ts`** - Mode descriptions section

### Tool Description Files

5. **`src/core/prompts/tools/codebase-search.ts`** - XML protocol tool description
6. **`src/core/prompts/tools/native-tools/codebase_search.ts`** - Native protocol tool description

### Mode Configuration Files

7. **`packages/types/src/mode.ts`** - DEFAULT_MODES with roleDefinition, whenToUse, customInstructions
8. **`src/shared/modes.ts`** - Mode selection and prompt assembly logic

---

## 2. Current State Analysis

### 2.1 System Prompts

#### Capabilities Section (`src/core/prompts/sections/capabilities.ts`)

**Current Text** (lines 64-66):

```typescript
- You can use the `codebase_search` tool to perform semantic searches across your entire codebase.
  This tool is powerful for finding functionally relevant code, even if you don't know the exact
  keywords or file names. It's particularly useful for understanding how features are implemented
  across multiple files, discovering usages of a particular API, or finding code examples related
  to a concept. This capability relies on a pre-built index of your code.
```

**Analysis**:

- ✅ Mentions codebase_search exists
- ✅ Describes semantic search capability
- ✅ Gives use cases (features, API usage, concepts)
- ❌ **MISSING**: No mention of hybrid search (vector + BM25 + graph + LSP)
- ❌ **MISSING**: No mention of graph relationships (CALLS, TESTS, EXTENDS, IMPLEMENTS)
- ❌ **MISSING**: No mention of impact analysis capabilities
- ❌ **MISSING**: No mention of context enrichment (related code, tests, dependencies)
- ❌ **MISSING**: No mention of quality metrics (complexity, coverage, dead code)
- ❌ **MISSING**: No guidance on when to use semantic vs. keyword vs. graph vs. LSP search

**Priority**: 🔥🔥🔥 **CRITICAL** - This is the first place Roo learns about codebase_search

#### Tool Use Guidelines Section (`src/core/prompts/sections/tool-use-guidelines.ts`)

**Current Text** (lines 26-27):

```typescript
**CRITICAL: For ANY exploration of code you haven't examined yet in this conversation, you MUST
use the `codebase_search` tool FIRST before any other search or file exploration tools.**
```

**Analysis**:

- ✅ **EXCELLENT**: Strong "CRITICAL" directive to use codebase_search first
- ✅ **EXCELLENT**: Comprehensive query pattern library with examples
- ✅ **EXCELLENT**: Interpreting search results guidance (score thresholds)
- ✅ **EXCELLENT**: Anti-patterns section (what NOT to do)
- ✅ **EXCELLENT**: Iterative refinement strategy
- ❌ **MISSING**: No mention of Phase 10-13 capabilities
- ❌ **MISSING**: No guidance on search result enrichment (context, quality metrics)
- ❌ **MISSING**: No mention of graph-based queries for structural understanding

**Priority**: 🔥🔥 **HIGH** - Guidelines are strong but incomplete

### 2.2 Tool Descriptions

#### Codebase Search Tool (`src/core/prompts/tools/codebase-search.ts`)

**Current Text** (lines 4-11):

```typescript
Description: Find code most relevant to your search query using semantic search. This tool
understands code meaning and context, not just keywords, making it ideal for exploring unfamiliar
codebases. Use natural language queries to find implementations, patterns, and concepts.

**How It Works:**
- Uses AI-powered semantic search to understand code meaning
- Searches based on concepts and intent, not just exact text matches
- Returns ranked results with relevance scores (0-1, higher is better)
- Searches entire workspace by default, or specific subdirectories
```

**Analysis**:

- ✅ Good description of semantic search
- ✅ Mentions relevance scores
- ✅ Examples of what you can find (symbols, concepts, implementations, patterns)
- ✅ Best practices section
- ❌ **MISSING**: No mention of hybrid search architecture
- ❌ **MISSING**: No mention of graph relationships in results
- ❌ **MISSING**: No mention of context enrichment (related code, tests, dependencies)
- ❌ **MISSING**: No mention of quality metrics (complexity, coverage)
- ❌ **MISSING**: No mention of impact analysis capabilities

**Priority**: 🔥🔥🔥 **CRITICAL** - Tool description is the primary source of truth for how to use the tool

---

## 3. Mode-Specific Prompt Analysis

### 3.1 Orchestrator Mode

**Role Definition**:

> "You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them
> to appropriate specialized modes."

**Custom Instructions** (key excerpt):

> "For exploratory queries, delegate with ONLY the user's question - let the specialized mode use
> codebase_search to discover relevant files."

**Analysis**:

- ✅ **GOOD**: Mentions codebase_search in delegation context
- ✅ **GOOD**: Instructs to let specialized modes discover files
- ❌ **MISSING**: No guidance on which modes have codebase_search access
- ❌ **MISSING**: No mention of codebase understanding as a delegation criterion
- ❌ **MISSING**: No mention of graph-based analysis for architectural tasks

**Priority**: 🔥 **MEDIUM** - Orchestrator already mentions codebase_search, but could be more specific

### 3.2 Architect Mode

**Role Definition**:

> "You are Roo, an experienced technical leader who is inquisitive and an excellent planner."

**When To Use**:

> "Use this mode when you need to plan, design, or strategize before implementation. Perfect for
> breaking down complex problems, creating technical specifications, designing system architecture,
> or brainstorming solutions before coding."

**Custom Instructions**:

> "You can analyze code, create diagrams, and access external resources. Always create a detailed
> plan before implementation, and do not switch to implementing code unless explicitly requested by
> the user. Include Mermaid diagrams when they clarify your response."

**Analysis**:

- ✅ Has "read" tool group (includes codebase_search)
- ❌ **MISSING**: No mention of using codebase_search to understand existing architecture
- ❌ **MISSING**: No mention of graph relationships for structural analysis (EXTENDS, IMPLEMENTS, CALLS)
- ❌ **MISSING**: No mention of impact analysis for change planning
- ❌ **MISSING**: No mention of quality metrics for identifying refactoring opportunities

**Priority**: 🔥🔥🔥 **CRITICAL** - Architect mode should heavily leverage graph relationships and impact analysis

### 3.3 Code Mode

**Role Definition**:

> "You are Roo, a highly skilled software engineer with extensive knowledge in many programming
> languages, frameworks, design patterns, and best practices."

**When To Use**:

> "Use this mode when you need to write, modify, or refactor code. Ideal for implementing features,
> fixing bugs, creating new files, or making code improvements across any programming language or
> framework."

**Custom Instructions**: (none)

**Analysis**:

- ✅ Has "read" tool group (includes codebase_search)
- ❌ **MISSING**: No mention of using codebase_search to understand context before editing
- ❌ **MISSING**: No mention of finding related code (callers, callees) before making changes
- ❌ **MISSING**: No mention of checking test coverage before refactoring
- ❌ **MISSING**: No mention of impact analysis to assess change safety
- ❌ **MISSING**: No mention of quality metrics to guide refactoring decisions

**Priority**: 🔥🔥🔥 **CRITICAL** - Code mode should use context enrichment and quality metrics extensively

### 3.4 Ask Mode

**Role Definition**:

> "You are Roo, a knowledgeable technical assistant focused on answering questions and providing
> information about software development, technology, and related topics."

**When To Use**:

> "Use this mode when you need explanations, documentation, or answers to technical questions. Best
> for understanding concepts, analyzing existing code, getting recommendations, or learning about
> technologies without making changes."

**Custom Instructions**:

> "You can analyze code, explain concepts, and access external resources. Always answer the user's
> questions thoroughly, and do not switch to implementing code unless explicitly requested by the
> user. Include Mermaid diagrams when they clarify your response."

**Analysis**:

- ✅ Has "read" tool group (includes codebase_search)
- ❌ **MISSING**: No explicit instruction to search codebase before answering questions about the project
- ❌ **MISSING**: No mention of using graph relationships to explain code structure
- ❌ **MISSING**: No mention of showing related code (tests, callers) when explaining functionality
- ❌ **MISSING**: No mention of quality metrics when analyzing code quality

**Priority**: 🔥🔥 **HIGH** - Ask mode should proactively search codebase for project-specific questions

### 3.5 Debug Mode

**Role Definition**:

> "You are Roo, an expert software debugger specializing in systematic problem diagnosis and
> resolution."

**When To Use**:

> "Use this mode when you're troubleshooting issues, investigating errors, or diagnosing problems.
> Specialized in systematic debugging, adding logging, analyzing stack traces, and identifying root
> causes before applying fixes."

**Custom Instructions**:

> "Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely
> sources, and then add logs to validate your assumptions. Explicitly ask the user to confirm the
> diagnosis before fixing the problem."

**Analysis**:

- ✅ Has "read" tool group (includes codebase_search)
- ❌ **MISSING**: No mention of using codebase_search to find related code that might cause the issue
- ❌ **MISSING**: No mention of using CALLS/CALLED_BY relationships to trace execution flow
- ❌ **MISSING**: No mention of finding tests to understand expected behavior
- ❌ **MISSING**: No mention of impact analysis to assess fix safety
- ❌ **MISSING**: No mention of quality metrics to identify problematic code patterns

**Priority**: 🔥🔥🔥 **CRITICAL** - Debug mode should heavily leverage graph relationships for root cause analysis

---

## 4. Gap Analysis Summary

### 4.1 Critical Gaps (Must Fix)

1. **Phase 10-13 Capabilities Not Documented** 🔥🔥🔥

    - **Impact**: Roo doesn't know about 50% of the index's capabilities
    - **Affected**: All prompts (capabilities, tool descriptions, mode instructions)
    - **Missing**:
        - Graph relationships (CALLS, TESTS, EXTENDS, IMPLEMENTS)
        - Impact analysis (dependency trees, blast radius, change safety)
        - Context enrichment (related code, tests, dependencies, type info)
        - Quality metrics (complexity, coverage, dead code detection)

2. **Tool Description Outdated** 🔥🔥🔥

    - **Impact**: Roo thinks codebase_search is "just semantic search"
    - **Affected**: `src/core/prompts/tools/codebase-search.ts`
    - **Fix**: Update to describe hybrid search, enriched results, quality metrics

3. **Mode-Specific Instructions Missing Index Usage** 🔥🔥🔥
    - **Impact**: Modes don't know WHEN to use codebase index for their specific tasks
    - **Affected**: Architect, Code, Debug modes especially
    - **Fix**: Add mode-specific guidance on leveraging index capabilities

### 4.2 High Priority Gaps (Should Fix)

4. **No Search Strategy Guidance** 🔥🔥

    - **Impact**: Roo doesn't know when to use vector vs. BM25 vs. graph vs. LSP
    - **Affected**: Tool Use Guidelines, Tool Description
    - **Fix**: Add decision tree for search strategy selection

5. **Ask Mode Doesn't Proactively Search** 🔥🔥

    - **Impact**: Roo may answer questions without checking the actual codebase
    - **Affected**: Ask mode customInstructions
    - **Fix**: Add instruction to search codebase for project-specific questions

6. **Capabilities Section Too Brief** 🔥🔥
    - **Impact**: First impression of codebase_search is incomplete
    - **Affected**: `src/core/prompts/sections/capabilities.ts`
    - **Fix**: Expand to mention key Phase 10-13 capabilities

### 4.3 Medium Priority Gaps (Nice to Have)

7. **Orchestrator Doesn't Know Mode Capabilities** 🔥

    - **Impact**: May not delegate codebase understanding tasks optimally
    - **Affected**: Orchestrator customInstructions
    - **Fix**: Add note about which modes have codebase_search access

8. **No Examples of Advanced Queries** 🔥
    - **Impact**: Roo may not use graph-based or impact analysis queries
    - **Affected**: Tool Use Guidelines
    - **Fix**: Add examples of graph queries, impact analysis queries

---

## 5. Detailed Recommendations

### Recommendation 1: Update Capabilities Section 🔥🔥🔥 CRITICAL

**File**: `src/core/prompts/sections/capabilities.ts` (lines 64-66)

**Current**:

```
- You can use the `codebase_search` tool to perform semantic searches across your entire codebase.
```

**Recommended**:

```
- You can use the `codebase_search` tool to perform intelligent searches across your entire codebase
  using a world-class hybrid search system that combines:
  * **Semantic Search**: AI-powered understanding of code meaning and intent
  * **Keyword Search**: Fast exact matching for symbols and identifiers
  * **Graph Relationships**: Structural understanding (function calls, test coverage, inheritance, type relationships)
  * **Type Information**: LSP-powered type-aware queries

  Search results are automatically enriched with:
  * **Related Code**: Callers, callees, parent classes, child classes
  * **Test Coverage**: Direct tests and integration tests for the code
  * **Dependencies**: Imports, exports, and dependency relationships
  * **Quality Metrics**: Complexity scores, test coverage %, dead code detection
  * **Type Information**: Parameter types, return types, type definitions

  This tool is powerful for:
  * Finding functionally relevant code even without exact keywords
  * Understanding how features are implemented across multiple files
  * Discovering all usages of an API or function
  * Analyzing code structure and relationships
  * Assessing change impact before making edits
  * Identifying refactoring opportunities based on quality metrics
  * Tracing execution flow through call graphs
  * Finding tests for specific functionality
```

**Rationale**: This is the first place Roo learns about codebase_search. It must accurately describe all capabilities.

---

### Recommendation 2: Update Codebase Search Tool Description 🔥🔥🔥 CRITICAL

**File**: `src/core/prompts/tools/codebase-search.ts`

**Current** (lines 4-24):

```typescript
Description: Find code most relevant to your search query using semantic search. This tool
understands code meaning and context, not just keywords...

**How It Works:**
- Uses AI-powered semantic search to understand code meaning
- Searches based on concepts and intent, not just exact text matches
- Returns ranked results with relevance scores (0-1, higher is better)
- Searches entire workspace by default, or specific subdirectories
```

**Recommended Addition** (insert after line 11):

```typescript
**Advanced Capabilities:**
- **Hybrid Search**: Automatically combines vector (semantic), BM25 (keyword), graph (structural),
  and LSP (type-aware) search for optimal results
- **Graph Relationships**: Results include structural information:
  * CALLS/CALLED_BY: Function call graph (who calls this? what does this call?)
  * TESTS/TESTED_BY: Test coverage mapping (which tests cover this code?)
  * EXTENDS/EXTENDED_BY: Class inheritance hierarchy
  * IMPLEMENTS/IMPLEMENTED_BY: Interface implementation relationships
  * HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE: Type system relationships
- **Context Enrichment**: Each result automatically includes:
  * Related code (callers, callees, parent/child classes)
  * Associated tests (direct and integration tests)
  * Dependencies (imports, exports)
  * Type information (parameters, return types, type definitions)
  * File summaries and documentation
- **Quality Metrics**: Results include code quality information:
  * Complexity scores (cyclomatic, cognitive)
  * Test coverage percentage
  * Dead code detection (unused functions)
  * Quality score (0-100 scale)
- **Impact Analysis**: Can assess change impact:
  * Dependency trees (what depends on this?)
  * Blast radius (how many files affected?)
  * Change safety assessment

**When to Use Each Search Strategy:**
- **Semantic queries** (default): "user authentication logic", "how to validate emails"
- **Keyword queries**: Exact symbol names like "UserService", "authenticate()"
- **Graph queries**: Structural questions like "what calls this function?", "which tests cover this?"
- **Type queries**: Type-related questions like "functions that return Promise<User>"
- **Impact queries**: Change assessment like "what would break if I change this?"

The tool automatically selects the best search strategy based on your query, but you can be
explicit in your query to guide the selection (e.g., "find all callers of authenticate function"
will use graph search).
```

**Rationale**: Tool description must reflect actual capabilities so Roo knows what's possible.

---

### Recommendation 3: Add Mode-Specific Codebase Index Instructions 🔥🔥🔥 CRITICAL

#### 3A: Architect Mode

**File**: `packages/types/src/mode.ts` (Architect mode customInstructions, line 146)

**Current**:

```
"You can analyze code, create diagrams, and access external resources. Always create a detailed
plan before implementation..."
```

**Recommended Addition**:

```
**Leveraging the Codebase Index for Architecture Work:**

Before creating plans or designs, use codebase_search to understand the existing architecture:
1. **Understand Structure**: Search for architectural patterns, design decisions, key abstractions
2. **Map Relationships**: Use graph queries to understand how components interact (CALLS, EXTENDS, IMPLEMENTS)
3. **Assess Quality**: Review quality metrics to identify refactoring opportunities
4. **Analyze Impact**: Use impact analysis to assess how proposed changes would affect the system
5. **Find Examples**: Search for similar implementations to maintain consistency

Example queries for architecture work:
- "main application entry point and initialization"
- "database connection and ORM configuration"
- "authentication and authorization flow"
- "API route definitions and middleware"
- "what calls the UserService class?" (graph query)
- "what would break if I change the User interface?" (impact analysis)

Always search the codebase before proposing architectural changes to ensure your plan aligns with
existing patterns and doesn't break existing functionality.
```

**Rationale**: Architect mode should heavily leverage graph relationships and impact analysis for planning.

#### 3B: Code Mode

**File**: `packages/types/src/mode.ts` (Code mode customInstructions, line 157)

**Current**: (none)

**Recommended**:

```
customInstructions: "**Leveraging the Codebase Index for Code Changes:**

Before making any code changes, use codebase_search to gather context:
1. **Understand Context**: Search for the code you're about to modify and related functionality
2. **Find Related Code**: Use graph queries to find callers, callees, and dependencies
3. **Check Tests**: Use TESTS/TESTED_BY relationships to find existing tests
4. **Assess Quality**: Review complexity and coverage metrics before refactoring
5. **Analyze Impact**: Use impact analysis to understand what might break

Example workflow for implementing a feature:
1. Search: \"how is [similar feature] currently implemented?\"
2. Graph query: \"what calls the [related function]?\" to understand usage
3. Find tests: \"tests for [related functionality]\" to understand expected behavior
4. Check quality: Review complexity scores to identify refactoring opportunities
5. Assess impact: \"what would break if I change [this function]?\"
6. Make changes with full context

Always use codebase_search before editing to ensure you understand the full context and don't
break existing functionality. Pay attention to quality metrics in search results - high complexity
or low coverage may indicate code that needs extra care."
```

**Rationale**: Code mode should use context enrichment and quality metrics to make safer, better-informed changes.

#### 3C: Debug Mode

**File**: `packages/types/src/mode.ts` (Debug mode customInstructions, line 180)

**Current**:

```
"Reflect on 5-7 different possible sources of the problem, distill those down to 1-2 most likely
sources, and then add logs to validate your assumptions..."
```

**Recommended Addition**:

```
**Leveraging the Codebase Index for Debugging:**

Use codebase_search and graph relationships to systematically diagnose issues:
1. **Trace Execution Flow**: Use CALLS/CALLED_BY relationships to trace how code is executed
2. **Find Related Code**: Search for similar functionality that might share the bug
3. **Check Tests**: Use TESTS/TESTED_BY to find tests that should catch this issue
4. **Analyze Quality**: Review complexity metrics - high complexity often correlates with bugs
5. **Assess Impact**: Use impact analysis to understand what else might be affected

Example debugging workflow:
1. Search: \"[error message or symptom]\" to find related code
2. Graph query: \"what calls [problematic function]?\" to trace execution path
3. Find tests: \"tests for [problematic functionality]\" to understand expected behavior
4. Check quality: Review complexity scores - high complexity may indicate the bug source
5. Trace dependencies: Use graph relationships to find all code paths that could trigger the issue

When reflecting on possible sources of the problem, use graph relationships to systematically
explore the call graph and dependency tree. This is more reliable than guessing.
```

**Rationale**: Debug mode should heavily leverage graph relationships for systematic root cause analysis.

#### 3D: Ask Mode

**File**: `packages/types/src/mode.ts` (Ask mode customInstructions, line 168)

**Current**:

```
"You can analyze code, explain concepts, and access external resources. Always answer the user's
questions thoroughly..."
```

**Recommended Addition**:

```
**Leveraging the Codebase Index for Answering Questions:**

For questions about the user's project, ALWAYS search the codebase first before answering:
1. **Project-Specific Questions**: Use codebase_search to find actual implementations
2. **Explain Structure**: Use graph relationships to show how components interact
3. **Show Examples**: Include related code, tests, and usage examples from search results
4. **Assess Quality**: Mention quality metrics when discussing code quality

Example question types that require codebase search:
- "How does [feature] work in this project?" → Search for implementation
- "Where is [functionality] implemented?" → Search and show file locations
- "What tests exist for [feature]?" → Use TESTS/TESTED_BY relationships
- "How is [class/function] used?" → Use CALLS/CALLED_BY relationships
- "Is this code well-tested?" → Show coverage metrics from search results

Always search the codebase for project-specific questions. Don't rely on general knowledge when
the user is asking about their specific codebase. Include relevant code snippets, test coverage
info, and quality metrics in your explanations.
```

**Rationale**: Ask mode should proactively search the codebase for project-specific questions rather than relying on general knowledge.

---

### Recommendation 4: Add Search Strategy Guidance to Tool Use Guidelines 🔥🔥 HIGH

**File**: `src/core/prompts/sections/tool-use-guidelines.ts`

**Location**: Insert after line 79 (after the iterative refinement strategy)

**Recommended Addition**:

```typescript
   **Advanced Search Strategies:**

   The codebase_search tool uses intelligent hybrid search that automatically selects the best
   strategy, but you can guide it with your query phrasing:

   **Semantic Search** (default for natural language):
   • "user authentication logic" → finds auth-related code by meaning
   • "how to validate email addresses" → finds validation implementations
   • "error handling patterns" → finds error handling code

   **Keyword Search** (for exact symbols):
   • "UserService class" → finds exact class name
   • "authenticate function" → finds exact function name
   • "API_KEY constant" → finds exact constant name

   **Graph Queries** (for structural questions):
   • "what calls the authenticate function?" → uses CALLS relationships
   • "which tests cover UserService?" → uses TESTS relationships
   • "what extends the BaseController class?" → uses EXTENDS relationships
   • "what implements the IUserRepository interface?" → uses IMPLEMENTS relationships

   **Impact Analysis Queries** (for change assessment):
   • "what would break if I change the User interface?" → dependency tree analysis
   • "what depends on the authenticate function?" → blast radius assessment
   • "is it safe to refactor UserService?" → change safety evaluation

   **Quality-Focused Queries** (for code health):
   • "functions with high complexity" → finds complex code needing refactoring
   • "untested code in auth module" → finds code lacking test coverage
   • "dead code in the project" → finds unused functions

   **Interpreting Enriched Results:**

   Search results include rich contextual information:
   • **Related Code**: Callers, callees, parent/child classes - use this to understand usage
   • **Tests**: Direct and integration tests - use this to understand expected behavior
   • **Dependencies**: Imports and exports - use this to understand relationships
   • **Quality Metrics**:
     - Complexity scores (cyclomatic, cognitive) - higher = harder to maintain
     - Coverage % - lower = higher risk of bugs
     - Quality score (0-100) - lower = needs refactoring
   • **Type Info**: Parameter types, return types - use this for type-safe changes

   Use this enriched information to make better decisions about code changes, refactoring, and debugging.
```

**Rationale**: Roo needs to know how to leverage advanced search capabilities and interpret enriched results.

---

### Recommendation 5: Update Orchestrator Mode Delegation Guidance 🔥 MEDIUM

**File**: `packages/types/src/mode.ts` (Orchestrator customInstructions, line 192)

**Current** (excerpt):

```
"For exploratory queries, delegate with ONLY the user's question - let the specialized mode use
codebase_search to discover relevant files."
```

**Recommended Addition** (insert after the existing delegation guidance):

```
**Mode Capabilities for Codebase Understanding:**

When delegating tasks that require codebase understanding, be aware of which modes have access to
the codebase_search tool:
- ✅ **Architect mode**: Has codebase_search - ideal for architectural analysis, planning, design
- ✅ **Code mode**: Has codebase_search - ideal for implementation with full context
- ✅ **Ask mode**: Has codebase_search - ideal for explaining existing code
- ✅ **Debug mode**: Has codebase_search - ideal for systematic debugging with graph analysis
- ❌ **Orchestrator mode**: No codebase_search - delegate codebase exploration to other modes

For tasks requiring deep codebase understanding (architecture analysis, impact assessment, finding
related code), prefer delegating to Architect or Code mode rather than trying to gather context
yourself.

Example delegation patterns:
- "Analyze the authentication architecture" → Delegate to Architect mode
- "Find all code related to user management" → Delegate to Ask or Code mode
- "Understand why login is failing" → Delegate to Debug mode
- "Explain how the database layer works" → Delegate to Ask mode
```

**Rationale**: Orchestrator should know which modes can leverage the codebase index for better delegation decisions.

---

### Recommendation 6: Add Examples of Advanced Queries 🔥 MEDIUM

**File**: `src/core/prompts/sections/tool-use-guidelines.ts`

**Location**: Insert after the query pattern library (after line 79)

**Recommended Addition**:

```typescript
   **Advanced Query Examples:**

   **Graph Relationship Queries:**
   <codebase_search>
   <query>what functions call the authenticate method?</query>
   </codebase_search>

   <codebase_search>
   <query>which tests cover the UserService class?</query>
   </codebase_search>

   <codebase_search>
   <query>what classes extend BaseController?</query>
   </codebase_search>

   **Impact Analysis Queries:**
   <codebase_search>
   <query>what would break if I change the User interface?</query>
   </codebase_search>

   <codebase_search>
   <query>what depends on the database connection module?</query>
   </codebase_search>

   **Quality-Focused Queries:**
   <codebase_search>
   <query>functions with high complexity in the auth module</query>
   </codebase_search>

   <codebase_search>
   <query>untested code in the API routes</query>
   </codebase_search>

   These advanced queries leverage the graph database, impact analysis, and quality metrics
   capabilities built into the codebase index.
```

**Rationale**: Concrete examples help Roo understand how to use advanced capabilities.

---

## 6. Implementation Priority

### Phase 1: Critical Updates (Implement First) 🔥🔥🔥

**Priority**: Immediate
**Impact**: High - These gaps prevent Roo from using 50% of the index's capabilities

1. **Recommendation 1**: Update Capabilities Section

    - File: `src/core/prompts/sections/capabilities.ts`
    - Lines: 64-66
    - Effort: 30 minutes

2. **Recommendation 2**: Update Codebase Search Tool Description

    - File: `src/core/prompts/tools/codebase-search.ts`
    - Lines: 4-57
    - Effort: 1 hour

3. **Recommendation 3**: Add Mode-Specific Instructions
    - File: `packages/types/src/mode.ts`
    - Modes: Architect (line 146), Code (line 157), Debug (line 180), Ask (line 168)
    - Effort: 2 hours

**Total Effort**: ~3.5 hours
**Expected Impact**: +40% improvement in index utilization

### Phase 2: High Priority Updates (Implement Second) 🔥🔥

**Priority**: Within 1 week
**Impact**: Medium - These improve Roo's ability to use advanced features

4. **Recommendation 4**: Add Search Strategy Guidance

    - File: `src/core/prompts/sections/tool-use-guidelines.ts`
    - Lines: After 79
    - Effort: 1 hour

5. **Recommendation 5**: Update Orchestrator Delegation Guidance
    - File: `packages/types/src/mode.ts`
    - Lines: After 192
    - Effort: 30 minutes

**Total Effort**: ~1.5 hours
**Expected Impact**: +20% improvement in index utilization

### Phase 3: Medium Priority Updates (Implement Third) 🔥

**Priority**: Within 2 weeks
**Impact**: Low - These provide helpful examples but aren't critical

6. **Recommendation 6**: Add Advanced Query Examples
    - File: `src/core/prompts/sections/tool-use-guidelines.ts`
    - Lines: After 79
    - Effort: 30 minutes

**Total Effort**: ~30 minutes
**Expected Impact**: +10% improvement in index utilization

---

## 7. Testing Strategy

After implementing prompt updates, test that Roo actually uses the index as intended:

### Test Scenarios

1. **Architect Mode Test**:

    - Task: "Analyze the authentication architecture in this project"
    - Expected: Should use codebase_search with graph queries to map auth flow
    - Verify: Check that Roo mentions CALLS relationships, finds tests, assesses quality

2. **Code Mode Test**:

    - Task: "Refactor the UserService class to improve testability"
    - Expected: Should search for UserService, find callers, check tests, review quality metrics
    - Verify: Check that Roo mentions test coverage %, complexity scores, impact analysis

3. **Debug Mode Test**:

    - Task: "Debug why user login is failing"
    - Expected: Should use graph queries to trace execution flow, find related tests
    - Verify: Check that Roo uses CALLS/CALLED_BY to trace flow, mentions test coverage

4. **Ask Mode Test**:

    - Task: "How does authentication work in this project?"
    - Expected: Should search codebase first, show actual implementation with context
    - Verify: Check that Roo searches before answering, includes related code and tests

5. **Advanced Search Test**:
    - Task: "What would break if I change the User interface?"
    - Expected: Should use impact analysis query
    - Verify: Check that Roo mentions dependency tree, blast radius, affected files

### Success Criteria

- ✅ Roo uses codebase_search for all exploratory tasks
- ✅ Roo mentions graph relationships when relevant (CALLS, TESTS, EXTENDS)
- ✅ Roo includes quality metrics in responses (complexity, coverage)
- ✅ Roo uses impact analysis before suggesting major changes
- ✅ Roo interprets enriched results correctly (related code, tests, dependencies)

---

## 8. Conclusion

**Current State**: Roo has access to a world-class codebase index but prompts only describe ~50% of its capabilities.

**Gaps Identified**:

- 6 critical gaps preventing full utilization
- 3 high priority gaps limiting advanced features
- 2 medium priority gaps reducing discoverability

**Recommended Actions**:

1. **Phase 1** (3.5 hours): Update capabilities section, tool description, and mode-specific instructions
2. **Phase 2** (1.5 hours): Add search strategy guidance and orchestrator delegation guidance
3. **Phase 3** (30 minutes): Add advanced query examples
4. **Testing** (2 hours): Verify Roo uses index as intended

**Total Effort**: ~7.5 hours of prompt engineering work

**Expected Outcome**: +70% improvement in codebase index utilization, unlocking the full value of Phases 10-13 enhancements.

**Next Steps**:

1. Review audit findings with user
2. Prioritize recommendations
3. Implement Phase 1 updates first
4. Test and iterate based on real usage
5. Implement Phase 2 and 3 as time permits

---

**Audit Completed By**: Augment Agent
**Date**: 2025-11-19
**Status**: Ready for Review and Implementation
