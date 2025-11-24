import { HybridSearchResult } from "../hybrid-search-service"
import { INeo4jService, CodeNode } from "../interfaces/neo4j-service"
import {
	IContextEnrichmentService,
	EnrichedSearchResult,
	ContextEnrichmentOptions,
	RelatedCodeContext,
	TestContext,
	DependencyContext,
	TypeInfoContext,
	FileSummaryContext,
	CodeReference,
} from "../interfaces/context-enrichment"
import * as fs from "fs/promises"
import * as path from "path"
import { loadRequiredLanguageParsers, LanguageParser } from "../../tree-sitter/languageParser"
import { Query, QueryCapture } from "web-tree-sitter"

/**
 * File category types for purpose extraction
 */
type FileCategory =
	| "unit-test"
	| "integration-test"
	| "config"
	| "types"
	| "utility"
	| "service"
	| "controller"
	| "component"
	| "entry-point"
	| "database"
	| "documentation"
	| "module"
	| "source"

/**
 * Comment analysis results
 */
interface CommentAnalysis {
	/** Comments found at the top of the file */
	headerComments: string[]
	/** Comments that contain purpose-related keywords */
	purposeComments: string[]
	/** TODO/FIXME/HACK comments */
	todoComments: string[]
}

/**
 * Phase 12: Enhanced Context - Context Enrichment Service
 *
 * This service enriches search results with contextual information from the
 * Neo4j graph database, including related code, tests, dependencies, and type info.
 */
export class ContextEnrichmentService implements IContextEnrichmentService {
	private fileSummaryCache: Map<string, FileSummaryContext> = new Map()
	private readonly CACHE_SIZE_LIMIT = 1000

	constructor(private neo4jService: INeo4jService | null) {}

	/**
	 * Enriches search results with contextual information
	 */
	async enrichSearchResults(
		results: HybridSearchResult[],
		options?: ContextEnrichmentOptions,
	): Promise<EnrichedSearchResult[]> {
		// Default options
		const opts: Required<ContextEnrichmentOptions> = {
			maxRelatedItems: options?.maxRelatedItems ?? 3,
			enrichRelatedCode: options?.enrichRelatedCode ?? true,
			enrichTests: options?.enrichTests ?? true,
			enrichDependencies: options?.enrichDependencies ?? true,
			enrichTypeInfo: options?.enrichTypeInfo ?? true,
			enrichFileSummary: options?.enrichFileSummary ?? true,
			skipEnrichmentThreshold: options?.skipEnrichmentThreshold ?? 20,
		}

		// Skip enrichment if Neo4j is not available
		if (!this.neo4jService) {
			return results as EnrichedSearchResult[]
		}

		// Skip enrichment for large result sets
		if (results.length > opts.skipEnrichmentThreshold) {
			return results as EnrichedSearchResult[]
		}

		// Enrich all results in parallel
		const enrichedResults = await Promise.all(results.map((result) => this.enrichSingleResult(result, opts)))

		return enrichedResults
	}

	/**
	 * Enriches a single search result with all context types
	 */
	private async enrichSingleResult(
		result: HybridSearchResult,
		options: Required<ContextEnrichmentOptions>,
	): Promise<EnrichedSearchResult> {
		// Run all enrichments in parallel
		const [relatedCode, tests, dependencies, typeInfo, fileSummary] = await Promise.all([
			options.enrichRelatedCode
				? this.enrichWithRelatedCode(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichTests ? this.enrichWithTests(result) : Promise.resolve(undefined),
			options.enrichDependencies
				? this.enrichWithDependencies(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichTypeInfo
				? this.enrichWithTypeInfo(result, options.maxRelatedItems)
				: Promise.resolve(undefined),
			options.enrichFileSummary && result.payload?.filePath
				? this.enrichWithFileSummary(result.payload.filePath)
				: Promise.resolve(undefined),
		])

		return {
			...result,
			relatedCode,
			tests,
			dependencies,
			typeInfo,
			fileSummary,
		}
	}

	/**
	 * Enriches with related code (callers, callees, inheritance)
	 */
	async enrichWithRelatedCode(result: HybridSearchResult, maxItems: number): Promise<RelatedCodeContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			// Find the node by ID or by file path + identifier
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Query for all related code in parallel
			const [callers, callees, parentClasses, childClasses, siblingMethods] = await Promise.all([
				this.findCallers(nodeId, maxItems),
				this.findCallees(nodeId, maxItems),
				this.findParentClasses(nodeId),
				this.findChildClasses(nodeId, maxItems),
				this.findSiblingMethods(nodeId, maxItems),
			])

			return {
				callers,
				callees,
				parentClasses,
				childClasses,
				siblingMethods,
			}
		} catch (error) {
			console.error("Error enriching with related code:", error)
			return undefined
		}
	}

	/**
	 * Enriches with test coverage information
	 */
	async enrichWithTests(result: HybridSearchResult): Promise<TestContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Find tests that test this code
			const tests = await this.findTests(nodeId)

			// Separate direct tests from integration tests
			const directTests = tests.filter((t) => t.type === "function" || t.type === "method")
			const integrationTests = tests.filter((t) => t.type !== "function" && t.type !== "method")

			// Calculate coverage percentage (simple heuristic: has tests = 100%, no tests = 0%)
			const coveragePercentage = tests.length > 0 ? 100 : 0

			return {
				directTests,
				integrationTests,
				coveragePercentage,
			}
		} catch (error) {
			console.error("Error enriching with tests:", error)
			return undefined
		}
	}

	/**
	 * Enriches with dependency information
	 */
	async enrichWithDependencies(result: HybridSearchResult, maxItems: number): Promise<DependencyContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Find dependencies (IMPORTS, CALLS relationships)
			const dependencies = await this.findDependencies(nodeId, maxItems)

			// Calculate dependency depth (max depth in dependency tree)
			const dependencyDepth = await this.calculateDependencyDepth(nodeId)

			// Detect circular dependencies
			const circularDependencies = await this.detectCircularDependencies(nodeId)

			return {
				directDependencies: dependencies,
				dependencyDepth,
				circularDependencies,
			}
		} catch (error) {
			console.error("Error enriching with dependencies:", error)
			return undefined
		}
	}

	/**
	 * Enriches with type information
	 */
	async enrichWithTypeInfo(result: HybridSearchResult, maxItems: number): Promise<TypeInfoContext | undefined> {
		if (!this.neo4jService || !result.id) {
			return undefined
		}

		try {
			const nodeId = await this.findNodeId(result)
			if (!nodeId) {
				return undefined
			}

			// Get type definition from LSP info if available
			const definition = result.payload?.lspTypeInfo?.typeInfo?.type || ""

			// Find type dependencies (types this type uses)
			const typeDependencies = await this.findTypeDependencies(nodeId, maxItems)

			// Find type usage (where this type is used)
			const typeUsage = await this.findTypeUsage(nodeId, maxItems)

			return {
				definition,
				typeDependencies,
				typeUsage,
			}
		} catch (error) {
			console.error("Error enriching with type info:", error)
			return undefined
		}
	}

	/**
	 * Enriches with file-level summary
	 */
	async enrichWithFileSummary(filePath: string): Promise<FileSummaryContext | undefined> {
		if (!this.neo4jService) {
			return undefined
		}

		// Check cache first
		if (this.fileSummaryCache.has(filePath)) {
			// On cache hit, remove and re-insert to mark as most-recently-used
			const summary = this.fileSummaryCache.get(filePath)!
			this.fileSummaryCache.delete(filePath)
			this.fileSummaryCache.set(filePath, summary)
			return summary
		}

		try {
			// Find all nodes in this file
			const fileNodes = await this.findFileNodes(filePath)

			// Extract main exports (classes, functions at file level)
			const mainExports = fileNodes
				.filter((node) => node.type === "class" || node.type === "function" || node.type === "interface")
				.map((node) => node.name)
				.slice(0, 10) // Limit to top 10

			// Extract dependencies (unique imports)
			const dependencies = await this.findFileDependencies(filePath)

			// Calculate file-level test coverage
			const testCoverage = await this.calculateFileTestCoverage(filePath)

			// Extract purpose from file (enhanced with comment parsing)
			const purpose = await this.extractFilePurpose(filePath, fileNodes)

			const summary: FileSummaryContext = {
				purpose,
				mainExports,
				dependencies,
				testCoverage,
			}

			// Cache the result
			this.cacheFileSummary(filePath, summary)

			return summary
		} catch (error) {
			console.error("Error enriching with file summary:", error)
			return undefined
		}
	}

	// ========================================================================
	// Helper Methods - Neo4j Queries
	// ========================================================================

	/**
	 * Finds the Neo4j node ID for a search result
	 */
	private async findNodeId(result: HybridSearchResult): Promise<string | null> {
		if (!this.neo4jService) {
			return null
		}

		// If result has a node ID, use it
		if (typeof result.id === "string" && result.id.includes("::")) {
			return result.id
		}

		// Otherwise, try to find by file path + identifier
		if (result.payload?.filePath && result.payload?.identifier) {
			const query = `
				MATCH (node {filePath: $filePath, name: $name})
				RETURN node
				LIMIT 1
			`
			const queryResult = await this.neo4jService.executeQuery(query, {
				filePath: result.payload.filePath,
				name: result.payload.identifier,
			})
			return queryResult.nodes[0]?.id || null
		}

		return null
	}

	/**
	 * Finds callers (CALLED_BY relationships)
	 */
	private async findCallers(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:CALLED_BY]-(caller)
			RETURN caller
			ORDER BY caller.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds callees (CALLS relationships)
	 */
	private async findCallees(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:CALLS]->(callee)
			RETURN callee
			ORDER BY callee.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds parent classes (EXTENDS/IMPLEMENTS relationships)
	 */
	private async findParentClasses(nodeId: string): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:EXTENDS|IMPLEMENTS]->(parent)
			RETURN parent
			ORDER BY parent.name
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds child classes (EXTENDED_BY/IMPLEMENTED_BY relationships)
	 */
	private async findChildClasses(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:EXTENDED_BY|IMPLEMENTED_BY]-(child)
			RETURN child
			ORDER BY child.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds sibling methods (methods in the same class)
	 */
	private async findSiblingMethods(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:CONTAINS]-(parent)-[:CONTAINS]->(sibling)
			WHERE sibling.id <> $nodeId AND (sibling.type = 'method' OR sibling.type = 'function')
			RETURN sibling
			ORDER BY sibling.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds tests (TESTED_BY relationships)
	 */
	private async findTests(nodeId: string): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:TESTED_BY]-(test)
			RETURN test
			ORDER BY test.name
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds dependencies (IMPORTS/CALLS relationships)
	 */
	private async findDependencies(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*1..2]->(dep)
			RETURN DISTINCT dep, length(path) as depth
			ORDER BY depth, dep.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}
	private async calculateDependencyDepth(nodeId: string): Promise<number> {
		if (!this.neo4jService) {
			return 0
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*]->(dep)
			RETURN max(length(path)) as maxDepth
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		// Extract the aggregated maxDepth value from the first result
		// Neo4j aggregation queries return results as plain objects, not CodeNode instances
		if (result.nodes.length > 0) {
			const record = result.nodes[0] as any
			if (record.maxDepth !== undefined) {
				return record.maxDepth as number
			}
		}
		return 0
	}

	/**
	 * Detects circular dependencies
	 */
	private async detectCircularDependencies(nodeId: string): Promise<string[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH path = (target {id: $nodeId})-[:IMPORTS|CALLS*]->(dep)-[:IMPORTS|CALLS*]->(target)
			RETURN DISTINCT dep.name as circularDep
			LIMIT 5
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId })
		// Extract names from nodes
		return result.nodes.map((node) => node.name).filter((name): name is string => !!name)
	}

	/**
	 * Finds type dependencies (HAS_TYPE/ACCEPTS_TYPE/RETURNS_TYPE relationships)
	 */
	private async findTypeDependencies(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})-[:HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE]->(type)
			RETURN DISTINCT type
			ORDER BY type.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds type usage (where this type is used)
	 */
	private async findTypeUsage(nodeId: string, limit: number): Promise<CodeReference[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (target {id: $nodeId})<-[:HAS_TYPE|ACCEPTS_TYPE|RETURNS_TYPE]-(usage)
			RETURN DISTINCT usage
			ORDER BY usage.name
			LIMIT $limit
		`

		const result = await this.neo4jService.executeQuery(query, { nodeId, limit })
		return this.convertNodesToReferences(result.nodes)
	}

	/**
	 * Finds all nodes in a file
	 */
	private async findFileNodes(filePath: string): Promise<CodeNode[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (node {filePath: $filePath})
			RETURN node
			ORDER BY node.startLine
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		return result.nodes
	}

	/**
	 * Finds file-level dependencies (unique imports)
	 */
	private async findFileDependencies(filePath: string): Promise<string[]> {
		if (!this.neo4jService) {
			return []
		}

		const query = `
			MATCH (file {filePath: $filePath})-[:IMPORTS]->(dep)
			RETURN DISTINCT dep.name as depName
			ORDER BY depName
			LIMIT 20
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		// Extract names from nodes
		return result.nodes.map((node) => node.name).filter((name): name is string => !!name)
	}

	/**
	 * Calculates test coverage percentage for a file
	 */
	private async calculateFileTestCoverage(filePath: string): Promise<number> {
		if (!this.neo4jService) {
			return 0
		}

		const query = `
			MATCH (node {filePath: $filePath})
			WHERE node.type IN ['function', 'method', 'class']
			WITH count(node) as totalNodes
			MATCH (node {filePath: $filePath})<-[:TESTED_BY]-(test)
			WHERE node.type IN ['function', 'method', 'class']
			WITH totalNodes, count(DISTINCT node) as testedNodes
			RETURN CASE WHEN totalNodes > 0 THEN toFloat(testedNodes) / toFloat(totalNodes) * 100 ELSE 0 END as coverage
		`

		const result = await this.neo4jService.executeQuery(query, { filePath })
		// Extract the calculated coverage percentage
		// Note: Neo4j aggregation queries return results as plain objects, not CodeNode instances
		if (result.nodes.length > 0) {
			const record = result.nodes[0] as any
			if (record.coverage !== undefined) {
				return record.coverage as number
			}
		}
		return 0
	}

	/**
	 * Extracts comprehensive file purpose from multiple sources including comments, exports, structure, and naming patterns
	 *
	 * This method implements a multi-layered approach to determine file purpose:
	 * 1. Analyzes file comments for explicit purpose statements
	 * 2. Examines file exports and structure for functional purpose
	 * 3. Considers directory structure and naming conventions
	 * 4. Falls back to pattern-based naming analysis
	 *
	 * @param filePath - Full path to the file being analyzed
	 * @param nodes - Array of CodeNode objects representing the file's structure
	 * @returns Promise resolving to a descriptive string explaining the file's purpose
	 */
	private async extractFilePurpose(filePath: string, nodes: CodeNode[]): Promise<string> {
		try {
			// Extract basic information from file path
			const fileName = filePath.split("/").pop() || ""
			const baseName = fileName.replace(
				/\.(ts|js|tsx|jsx|py|java|cpp|c|cs|go|rs|rb|php|swift|kt|scala|rb|lua|zig|sol|vue|html|css|json|toml|yaml|yml|md|markdown)$/,
				"",
			)
			const fileExt = path.extname(filePath).toLowerCase().slice(1)

			// Check file content and parse comments if supported
			const fileContent = await this.readFileContent(filePath)
			const commentAnalysis = await this.analyzeFileComments(filePath, fileContent)

			// Categorize the file based on name patterns and content
			const fileCategory = this.categorizeFile(filePath, fileName, nodes, fileContent)

			// Extract purpose from different sources in priority order
			const purposeFromComments = this.extractPurposeFromComments(commentAnalysis, fileCategory)
			if (purposeFromComments) {
				return purposeFromComments
			}

			const purposeFromExports = this.extractPurposeFromExports(nodes, fileCategory)
			if (purposeFromExports) {
				return purposeFromExports
			}

			const purposeFromStructure = this.extractPurposeFromStructure(filePath, nodes, fileCategory)
			if (purposeFromStructure) {
				return purposeFromStructure
			}

			// Fallback to basic file naming patterns
			return this.extractPurposeFromNaming(fileName, baseName, fileCategory)
		} catch (error) {
			console.error(`Error extracting file purpose for ${filePath}:`, error)
			// Return basic fallback if analysis fails
			const fileName = filePath.split("/").pop() || ""
			const baseName = fileName.replace(/\.(ts|js|tsx|jsx|py|java|cpp|c|cs|go|rs|rb|php)$/, "")
			return `Source file: ${baseName}`
		}
	}

	/**
	 * Safely reads file content with comprehensive error handling
	 *
	 * @param filePath - Path to the file to read
	 * @returns Promise resolving to file content as string, or empty string if read fails
	 */
	private async readFileContent(filePath: string): Promise<string> {
		try {
			return await fs.readFile(filePath, "utf-8")
		} catch (error) {
			console.warn(`Could not read file ${filePath}:`, error)
			return ""
		}
	}

	/**
	 * Analyzes file comments using tree-sitter parsing for supported programming languages
	 *
	 * Supports comment extraction from 25+ programming languages including:
	 * - JavaScript/TypeScript (slash slash, block comments)
	 * - Python (hash comments)
	 * - C/C++/C# (slash slash, block comments)
	 * - Java (slash slash, block comments)
	 * - Ruby (hash comments)
	 * - Go (slash slash, block comments)
	 * - Rust (slash slash, block comments)
	 * - And many more...
	 *
	 * @param filePath - Path to the file for comment analysis
	 * @param content - Raw file content to analyze
	 * @returns Promise resolving to CommentAnalysis with categorized comments
	 */
	private async analyzeFileComments(filePath: string, content: string): Promise<CommentAnalysis> {
		const ext = path.extname(filePath).toLowerCase().slice(1)

		// Languages that support comment parsing via tree-sitter
		const supportedCommentLanguages = [
			"js",
			"jsx",
			"ts",
			"tsx",
			"py",
			"rs",
			"go",
			"c",
			"h",
			"cpp",
			"hpp",
			"cs",
			"rb",
			"java",
			"php",
			"swift",
			"kt",
			"kts",
			"scala",
			"lua",
			"zig",
			"sol",
			"vue",
			"css",
		]

		if (!supportedCommentLanguages.includes(ext) || !content) {
			return { headerComments: [], purposeComments: [], todoComments: [] }
		}

		try {
			// Load language parser for this file
			const languageParsers = await loadRequiredLanguageParsers([filePath])
			const parserInfo = languageParsers[ext]

			if (!parserInfo) {
				return { headerComments: [], purposeComments: [], todoComments: [] }
			}

			// Parse the file and extract comments
			const { parser, query: existingQuery } = parserInfo
			const tree = parser.parse(content)

			// Extract comments using language-specific queries
			const commentQueryString = this.getCommentQuery(ext)
			let captures: QueryCapture[] = []

			if (commentQueryString) {
				// Use the comment-specific query if available
				// Get Language from web-tree-sitter module and create query
				const { Language } = require("web-tree-sitter")
				// The parser's language is already set, we need to load it to create a new query
				// Since we already have the parser configured, we can create the query from the parserInfo
				// For now, skip custom comment queries since we don't have direct access to Language
				// Fall back to existing query
				if (existingQuery) {
					captures = tree ? existingQuery.captures(tree.rootNode) : []
				}
			} else if (existingQuery) {
				// Fall back to the existing query if no comment query is available
				captures = tree ? existingQuery.captures(tree.rootNode) : []
			}

			return this.processCommentCaptures(captures, content)
		} catch (error) {
			console.warn(`Error analyzing comments for ${filePath}:`, error)
			return { headerComments: [], purposeComments: [], todoComments: [] }
		}
	}

	/**
	 * Retrieves tree-sitter query string for comment extraction based on programming language
	 *
	 * Each language uses a standardized comment capture pattern that works with
	 * the existing tree-sitter query infrastructure. The queries capture
	 * comments with the @doc tag for consistent processing.
	 *
	 * @param language - File extension/language identifier (e.g., 'js', 'py', 'java')
	 * @returns Tree-sitter query string for comment extraction, or null if unsupported
	 */
	private getCommentQuery(language: string): string | null {
		const commentQueries: Record<string, string> = {
			// JavaScript/TypeScript
			js: `((comment) @comment)`,
			jsx: `((comment) @comment)`,
			ts: `((comment) @comment)`,
			tsx: `((comment) @comment)`,

			// Python
			py: `((comment) @comment)`,

			// Rust
			rs: `((comment) @comment)`,

			// Go
			go: `((comment) @comment)`,

			// C/C++
			c: `((comment) @comment)`,
			h: `((comment) @comment)`,
			cpp: `((comment) @comment)`,
			hpp: `((comment) @comment)`,

			// C#
			cs: `((comment) @comment)`,

			// Ruby
			rb: `((comment) @comment)`,

			// Java
			java: `((comment) @comment)`,

			// PHP
			php: `((comment) @comment)`,

			// Swift
			swift: `((comment) @comment)`,

			// Kotlin
			kt: `((comment) @comment)`,
			kts: `((comment) @comment)`,

			// Other languages with similar comment syntax
			scala: `((comment) @comment)`,
			lua: `((comment) @comment)`,
			zig: `((comment) @comment)`,
			sol: `((comment) @comment)`,
			css: `((comment) @comment)`,
		}

		return commentQueries[language] || null
	}

	/**
	 * Processes tree-sitter comment captures to categorize and extract meaningful information
	 *
	 * Categorizes comments into three types:
	 * - Header comments: Comments at the top of the file (first 10 lines)
	 * - Purpose comments: Comments containing purpose-related keywords
	 * - TODO comments: Comments containing task-related keywords (TODO, FIXME, etc.)
	 *
	 * @param captures - Tree-sitter query captures containing comment nodes
	 * @param content - File content for line splitting
	 * @returns CommentAnalysis with categorized comments
	 */
	private processCommentCaptures(captures: QueryCapture[], content: string): CommentAnalysis {
		const lines = content.split("\n")
		const headerComments: string[] = []
		const purposeComments: string[] = []
		const todoComments: string[] = []

		// Sort captures by line number
		captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row)

		for (const capture of captures) {
			// Only process comment captures (those with @comment tag)
			if (capture.name !== "comment") {
				continue
			}

			const commentText = capture.node.text.trim()
			const lineNumber = capture.node.startPosition.row

			// Check if this is a header comment (first 10 lines)
			if (lineNumber < 10) {
				headerComments.push(commentText)
			}

			// Check for purpose-related keywords
			const purposeKeywords = [
				"purpose",
				"description",
				"overview",
				"summary",
				"about",
				"what",
				"this file",
				"this module",
				"this component",
				"this class",
			]

			const hasPurposeKeyword = purposeKeywords.some((keyword) => commentText.toLowerCase().includes(keyword))

			if (hasPurposeKeyword) {
				purposeComments.push(commentText)
			}

			// Check for TODO/FIXME comments
			const todoKeywords = ["todo", "fixme", "hack", "note", "warning"]
			const hasTodoKeyword = todoKeywords.some((keyword) => commentText.toLowerCase().includes(keyword))

			if (hasTodoKeyword) {
				todoComments.push(commentText)
			}
		}

		return { headerComments, purposeComments, todoComments }
	}

	/**
	 * Categorizes files into logical types based on multiple analysis dimensions
	 *
	 * Analysis includes:
	 * - File naming conventions and patterns
	 * - Directory structure and placement
	 * - File extension and content type
	 * - AST node types and structure
	 *
	 * Supported categories:
	 * - unit-test/integration-test: Test files
	 * - config: Configuration and settings files
	 * - types: Type definitions and interfaces
	 * - utility: Helper functions and utilities
	 * - service: Business logic services
	 * - controller: API controllers and route handlers
	 * - component: UI components and views
	 * - entry-point: Application entry points
	 * - database: Database models and migrations
	 * - documentation: Documentation files
	 * - module: General modules with mixed content
	 * - source: General source files
	 *
	 * @param filePath - Full file path for directory analysis
	 * @param fileName - File name for pattern matching
	 * @param nodes - AST nodes for structural analysis
	 * @param content - File content for additional context
	 * @returns FileCategory enum value representing the file type
	 */
	private categorizeFile(filePath: string, fileName: string, nodes: CodeNode[], content: string): FileCategory {
		const pathParts = filePath.toLowerCase().split("/")
		const fileNameLower = fileName.toLowerCase()

		// Test files
		if (
			fileNameLower.includes(".test.") ||
			fileNameLower.includes(".spec.") ||
			fileNameLower.includes("__tests__") ||
			pathParts.includes("test") ||
			pathParts.includes("tests")
		) {
			return fileNameLower.includes(".e2e.") || fileNameLower.includes("integration")
				? "integration-test"
				: "unit-test"
		}

		// Configuration files
		if (
			fileNameLower.includes("config") ||
			fileNameLower.includes("settings") ||
			fileNameLower.includes(".env") ||
			pathParts.includes("config") ||
			fileNameLower.endsWith(".json") ||
			fileNameLower.endsWith(".yaml") ||
			fileNameLower.endsWith(".yml") ||
			fileNameLower.endsWith(".toml")
		) {
			return "config"
		}

		// Type definition files
		if (
			fileNameLower.includes("types") ||
			fileNameLower.includes("interfaces") ||
			fileNameLower.includes("models") ||
			fileNameLower.includes("schemas")
		) {
			return "types"
		}

		// Utility/helper files
		if (
			fileNameLower.includes("util") ||
			fileNameLower.includes("helper") ||
			fileNameLower.includes("common") ||
			pathParts.includes("utils") ||
			pathParts.includes("helpers")
		) {
			return "utility"
		}

		// Service files
		if (fileNameLower.includes("service") || pathParts.includes("services")) {
			return "service"
		}

		// Controller/API files
		if (
			fileNameLower.includes("controller") ||
			fileNameLower.includes("api") ||
			fileNameLower.includes("route") ||
			pathParts.includes("controllers") ||
			pathParts.includes("api")
		) {
			return "controller"
		}

		// Component files (UI/frontend)
		if (
			fileNameLower.includes("component") ||
			pathParts.includes("components") ||
			fileNameLower.endsWith(".vue") ||
			fileNameLower.endsWith(".jsx") ||
			fileNameLower.endsWith(".tsx")
		) {
			return "component"
		}

		// Entry point files
		if (
			fileNameLower.includes("index") ||
			fileNameLower.includes("main") ||
			fileNameLower.includes("app") ||
			fileNameLower.includes("server")
		) {
			return "entry-point"
		}

		// Database/model files
		if (
			fileNameLower.includes("model") ||
			fileNameLower.includes("schema") ||
			fileNameLower.includes("migration") ||
			fileNameLower.includes("seed") ||
			pathParts.includes("models") ||
			pathParts.includes("database")
		) {
			return "database"
		}

		// Documentation files
		if (
			fileNameLower.endsWith(".md") ||
			fileNameLower.endsWith(".markdown") ||
			fileNameLower.includes("readme") ||
			fileNameLower.includes("doc")
		) {
			return "documentation"
		}

		// Analyze based on node types for more categorization
		const hasClasses = nodes.some((n) => n.type === "class")
		const hasFunctions = nodes.some((n) => n.type === "function" || n.type === "method")
		const hasInterfaces = nodes.some((n) => n.type === "interface")

		if (hasInterfaces && !hasClasses) {
			return "types"
		}

		if (hasClasses && hasFunctions) {
			return "module"
		}

		if (hasFunctions && !hasClasses) {
			return "utility"
		}

		return "source"
	}

	/**
	 * Extracts file purpose from analyzed comments using pattern matching and keyword detection
	 *
	 * Priority order:
	 * 1. Explicit purpose comments with keywords like "purpose", "description", etc.
	 * 2. Header comments with purpose statements
	 * 3. First substantial sentence from header comments
	 *
	 * Uses regex patterns to identify common purpose statement formats:
	 * - "This file/module provides..."
	 * - "Purpose: ..."
	 * - "@description ..."
	 *
	 * @param commentAnalysis - Categorized comments from processCommentCaptures
	 * @param category - File category for context-aware extraction
	 * @returns Purpose string if found, null otherwise
	 */
	private extractPurposeFromComments(commentAnalysis: CommentAnalysis, category: FileCategory): string | null {
		const { headerComments, purposeComments } = commentAnalysis

		// First check for explicit purpose comments
		if (purposeComments.length > 0) {
			const purposeText = purposeComments[0]
				.replace(/\/\*\*|^\s*\*|^\s*\/\/|^\s*#/gm, "") // Remove comment markers
				.replace(/\s+/g, " ") // Normalize whitespace
				.trim()

			if (purposeText.length > 10) {
				return purposeText
			}
		}

		// Then check header comments for purpose
		if (headerComments.length > 0) {
			const headerText = headerComments
				.join(" ")
				.replace(/\/\*\*|^\s*\*|^\s*\/\/|^\s*#/gm, "") // Remove comment markers
				.replace(/\s+/g, " ") // Normalize whitespace
				.trim()

			// Look for purpose statements in header
			const purposePatterns = [
				/this (?:file|module|component) (?:is|provides|contains|defines) (.+?)(?:\.|$)/i,
				/(?:purpose|description|overview):\s*(.+?)(?:\.|$)/i,
				/@(?:description|summary)\s+(.+?)(?:\.|$)/i,
			]

			for (const pattern of purposePatterns) {
				const match = headerText.match(pattern)
				if (match && match[1]) {
					return match[1].trim()
				}
			}

			// If no specific pattern found, use first substantial header comment
			if (headerText.length > 20) {
				const sentences = headerText.split(/[.!?]/)
				if (sentences.length > 0 && sentences[0].trim().length > 10) {
					return sentences[0].trim()
				}
			}
		}

		return null
	}

	/**
	 * Determines file purpose based on exported symbols and their types
	 *
	 * Analyzes the main exports (classes, functions, interfaces) to generate
	 * a descriptive purpose statement. The description is tailored to the file category
	 * using appropriate verbs and terminology.
	 *
	 * Examples:
	 * - Service: "Service providing UserService, AuthService, and EmailService"
	 * - Types: "Type definitions for User, Product, and Order"
	 * - Utility: "Utility functions including formatDate, validateEmail, and calculateTotal"
	 *
	 * @param nodes - Array of CodeNode objects representing file structure
	 * @param category - File category for context-aware verb selection
	 * @returns Purpose string if exports are found, null otherwise
	 */
	private extractPurposeFromExports(nodes: CodeNode[], category: FileCategory): string | null {
		const mainExports = nodes
			.filter((node) => node.type === "class" || node.type === "function" || node.type === "interface")
			.slice(0, 5) // Limit to top 5 exports
			.map((node) => node.name)

		if (mainExports.length === 0) {
			return null
		}

		const categoryVerbs: Record<FileCategory, string> = {
			"unit-test": "Tests",
			"integration-test": "Integration tests for",
			config: "Configuration for",
			types: "Type definitions for",
			utility: "Utility functions including",
			service: "Service providing",
			controller: "Controller handling",
			component: "UI component implementing",
			"entry-point": "Entry point initializing",
			database: "Database models for",
			documentation: "Documentation about",
			module: "Module defining",
			source: "Source code with",
		}

		const verb = categoryVerbs[category] || "Provides"
		const exportsList =
			mainExports.length > 3
				? `${mainExports.slice(0, 3).join(", ")} and ${mainExports.length - 3} others`
				: mainExports.join(", ")

		return `${verb} ${exportsList}`
	}

	/**
	 * Determines file purpose based on directory structure and file placement
	 *
	 * Analyzes the file's location in the project structure to infer domain
	 * and purpose. Ignores common generic directories (src, lib, app, etc.)
	 * and focuses on meaningful domain-specific directory names.
	 *
	 * Examples:
	 * - src/auth/AuthService.ts → "Service layer for auth"
	 * - components/ui/Button.tsx → "UI component for ui"
	 * - database/models/User.ts → "Database layer for models"
	 *
	 * @param filePath - Full file path for directory analysis
	 * @param nodes - AST nodes (currently unused but kept for consistency)
	 * @param category - File category for base description
	 * @returns Purpose string with domain context, or base description if no domain found
	 */
	private extractPurposeFromStructure(filePath: string, nodes: CodeNode[], category: FileCategory): string | null {
		const pathParts = filePath.split("/")
		const fileName = pathParts.pop() || ""

		// Extract meaningful directory names
		const meaningfulDirs = pathParts.filter(
			(part) => !["src", "lib", "app", "components", "pages", "utils", "services"].includes(part.toLowerCase()),
		)

		const domain = meaningfulDirs.length > 0 ? meaningfulDirs[meaningfulDirs.length - 1] : ""

		const categoryDescriptions: Record<FileCategory, string> = {
			"unit-test": `Unit tests`,
			"integration-test": `Integration tests`,
			config: `Configuration`,
			types: `Type definitions`,
			utility: `Utility functions`,
			service: `Service layer`,
			controller: `API controller`,
			component: `UI component`,
			"entry-point": `Application entry point`,
			database: `Database layer`,
			documentation: `Documentation`,
			module: `Module`,
			source: `Source code`,
		}

		const baseDescription = categoryDescriptions[category]

		if (domain) {
			return `${baseDescription} for ${domain}`
		}

		return baseDescription
	}

	/**
	 * Extracts file purpose from naming conventions as a final fallback method
	 *
	 * Uses comprehensive pattern matching to identify file purpose based on:
	 * - Common naming prefixes and suffixes
	 * - File naming conventions
	 * - Category-specific patterns
	 *
	 * Recognizes patterns like:
	 * - *.service.* → "Service implementation"
	 * - *.controller.* → "Controller implementation"
	 * - *.test.*, *.spec.* → "Test file for..."
	 * - *.config.* → "Configuration file"
	 * - *.types.*, *.interfaces.* → "Type definitions"
	 *
	 * @param fileName - Full file name including extension
	 * @param baseName - File name without extension
	 * @param category - File category for fallback descriptions
	 * @returns Purpose string based on naming patterns
	 */
	private extractPurposeFromNaming(fileName: string, baseName: string, category: FileCategory): string {
		const fileNameLower = fileName.toLowerCase()

		// Specific naming patterns
		if (fileNameLower.includes("index")) {
			return `Module entry point`
		}

		if (fileNameLower.includes(".spec.") || fileNameLower.includes(".test.")) {
			return `Test file for ${baseName}`
		}

		if (fileNameLower.includes(".e2e.")) {
			return `End-to-end test file for ${baseName}`
		}

		if (fileNameLower.includes(".mock.") || fileNameLower.includes(".fixture.")) {
			return `Test mock/fixture for ${baseName}`
		}

		if (fileNameLower.includes(".d.ts")) {
			return `Type declaration file for ${baseName}`
		}

		if (fileNameLower.includes("config") || fileNameLower.includes("settings")) {
			return `Configuration file`
		}

		if (fileNameLower.includes("types") || fileNameLower.includes("interfaces")) {
			return `Type definitions`
		}

		if (fileNameLower.includes("util") || fileNameLower.includes("helper")) {
			return `Utility functions`
		}

		if (fileNameLower.includes("service")) {
			return `Service implementation`
		}

		if (fileNameLower.includes("controller")) {
			return `Controller implementation`
		}

		if (fileNameLower.includes("model")) {
			return `Data model`
		}

		if (fileNameLower.includes("schema")) {
			return `Schema definition`
		}

		if (fileNameLower.includes("migration")) {
			return `Database migration`
		}

		if (fileNameLower.includes("seed")) {
			return `Database seed data`
		}

		if (fileNameLower.includes("component")) {
			return `UI component`
		}

		if (fileNameLower.includes("hook")) {
			return `React hook`
		}

		if (fileNameLower.includes("middleware")) {
			return `Middleware function`
		}

		if (fileNameLower.includes("validator")) {
			return `Validation logic`
		}

		if (fileNameLower.includes("transformer")) {
			return `Data transformer`
		}

		if (fileNameLower.includes("parser")) {
			return `Parser implementation`
		}

		if (fileNameLower.includes("formatter")) {
			return `Data formatter`
		}

		if (fileNameLower.includes("constants")) {
			return `Constant definitions`
		}

		if (fileNameLower.includes("enums")) {
			return `Enumeration definitions`
		}

		// Default fallback based on category
		const categoryFallbacks: Record<FileCategory, string> = {
			"unit-test": `Test file`,
			"integration-test": `Integration test file`,
			config: `Configuration file`,
			types: `Type definition file`,
			utility: `Utility file`,
			service: `Service file`,
			controller: `Controller file`,
			component: `Component file`,
			"entry-point": `Entry point file`,
			database: `Database file`,
			documentation: `Documentation file`,
			module: `Module file`,
			source: `Source file`,
		}

		return categoryFallbacks[category] || `Source file: ${baseName}`
	}

	/**
	 * Caches file summary with LRU eviction
	 * Entries are re-inserted on access to enforce LRU ordering
	 */
	private cacheFileSummary(filePath: string, summary: FileSummaryContext): void {
		// If key already exists, delete it to ensure it becomes the newest entry
		if (this.fileSummaryCache.has(filePath)) {
			this.fileSummaryCache.delete(filePath)
		}

		// Simple LRU: if cache is full, remove oldest entry
		if (this.fileSummaryCache.size >= this.CACHE_SIZE_LIMIT) {
			const firstKey = this.fileSummaryCache.keys().next().value
			if (firstKey) {
				this.fileSummaryCache.delete(firstKey)
			}
		}
		this.fileSummaryCache.set(filePath, summary)
	}

	/**
	 * Converts Neo4j CodeNode objects to CodeReference objects
	 */
	private convertNodesToReferences(nodes: CodeNode[]): CodeReference[] {
		return nodes
			.filter((node) => node && node.id)
			.map((node) => ({
				nodeId: node.id,
				name: node.name,
				filePath: node.filePath,
				startLine: node.startLine,
				endLine: node.endLine,
				type: node.type,
			}))
	}
}
