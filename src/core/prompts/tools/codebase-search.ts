import { ToolArgs } from "./types"

export function getCodebaseSearchDescription(args: ToolArgs): string {
	return `## codebase_search
Description: Find code most relevant to your search query using a world-class hybrid search system that combines semantic understanding, keyword matching, and graph relationships. This tool is your primary way to explore and understand the codebase.

**How It Works:**
- **Hybrid Search**: Automatically combines semantic (vector) search with keyword (BM25) search for optimal results
- **Intelligent Routing**: Analyzes your query and routes to the best search strategy (semantic, keyword, graph, or hybrid)
- **Graph-Aware**: Understands code relationships (calls, tests, inheritance, types) for deeper insights
- **Context Enrichment**: Results automatically include related code, tests, callers, and dependencies
- **Quality Metrics**: Includes complexity scores, test coverage, and dead code detection

**What You Can Find:**

*Basic Searches:*
- Specific symbols: "UserService class", "authenticate function", "API_KEY constant"
- Concepts & logic: "user authentication flow", "database connection pooling", "error handling"
- Implementations: "how to hash passwords", "JWT token validation", "file upload handling"
- Patterns: "React components with hooks", "Express middleware", "async error handling"

*Advanced Searches (Graph-Powered):*
- Function call graph: "what calls the authenticate function" or "what does UserService.login call"
- Test coverage: "tests for UserService" or "what tests the authenticate function"
- Inheritance hierarchy: "classes that extend BaseController" or "implementations of IAuthProvider"
- Type relationships: "functions that return User type" or "methods that accept AuthConfig"
- Impact analysis: "what would break if I change authenticate function"
- Dependency analysis: "what does the payment module depend on"

*Quality-Focused Searches:*
- Complexity: "most complex functions in auth module" or "high complexity code that needs refactoring"
- Coverage: "untested code in services" or "functions without tests"
- Dead code: "unused functions" or "code that's never called"

**Results Include:**
- File path and line numbers (start/end)
- Relevance score (>0.8 = highly relevant, 0.6-0.8 = relevant, <0.6 = tangential)
- Code chunk with context
- Symbol information (function/class name, type like "function_definition" or "class_definition")
- Language (inferred from file extension)
- **Related code**: Functions/classes that call or are called by this code
- **Tests**: Test files that cover this code
- **Dependencies**: What this code depends on and what depends on it
- **Type info**: Parameter types, return types, type relationships
- **Quality metrics**: Complexity scores (cyclomatic/cognitive), test coverage, usage frequency

**Best Practices:**
- Use natural language: "user authentication logic" not "auth.*user"
- Be specific but not overly narrow: "JWT token generation" not "line 45 in auth.ts"
- Reuse the user's exact wording when they ask questions - their phrasing helps semantic search
- For architectural questions, use graph queries: "what calls X", "what extends Y", "tests for Z"
- Before refactoring, check impact: "what would break if I change X"
- To find quality issues: "complex code", "untested functions", "dead code"
- Start broad, then refine based on results
- Queries MUST be in English (translate if needed)

Parameters:
- query: (required) Natural language search query describing what you're looking for
- path: (optional) Limit search to specific subdirectory (relative to ${args.cwd}). Leave empty for entire workspace.

Usage:
<codebase_search>
<query>Your natural language query here</query>
<path>Optional subdirectory path</path>
</codebase_search>

Examples:

*Basic Semantic Search:*
<codebase_search>
<query>User authentication with JWT tokens</query>
<path>src/auth</path>
</codebase_search>

<codebase_search>
<query>how to validate email addresses</query>
</codebase_search>

<codebase_search>
<query>React components that use useState hook</query>
<path>src/components</path>
</codebase_search>

*Graph-Powered Searches:*
<codebase_search>
<query>what calls the processPayment function</query>
</codebase_search>

<codebase_search>
<query>tests for UserService class</query>
</codebase_search>

<codebase_search>
<query>classes that extend BaseController</query>
</codebase_search>

<codebase_search>
<query>what would break if I change the authenticate function</query>
</codebase_search>

*Quality-Focused Searches:*
<codebase_search>
<query>most complex functions that need refactoring</query>
<path>src/services</path>
</codebase_search>

<codebase_search>
<query>untested code in the payment module</query>
<path>src/payment</path>
</codebase_search>

<codebase_search>
<query>unused functions that might be dead code</query>
</codebase_search>
`
}
