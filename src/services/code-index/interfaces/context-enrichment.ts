import { HybridSearchResult } from "../hybrid-search-service"

/**
 * Phase 12: Enhanced Context - Context Enrichment Interfaces
 *
 * These interfaces define the structure for enriching search results with
 * contextual information from the Neo4j graph database.
 */

/**
 * Reference to a code element in the graph
 */
export interface CodeReference {
	/** Node ID in Neo4j */
	nodeId: string
	/** Name of the code element */
	name: string
	/** File path */
	filePath: string
	/** Start line number */
	startLine: number
	/** End line number */
	endLine: number
	/** Optional code snippet */
	snippet?: string
	/** Type of code element (function, class, method, etc.) */
	type?: string
}

/**
 * Related code context (callers, callees, inheritance)
 */
export interface RelatedCodeContext {
	/** Functions/methods that call this code */
	callers: CodeReference[]
	/** Functions/methods this code calls */
	callees: CodeReference[]
	/** Parent classes (EXTENDS/IMPLEMENTS) */
	parentClasses: CodeReference[]
	/** Child classes (EXTENDED_BY/IMPLEMENTED_BY) */
	childClasses: CodeReference[]
	/** Sibling methods in the same class */
	siblingMethods: CodeReference[]
}

/**
 * Test coverage context
 */
export interface TestContext {
	/** Tests that directly test this code */
	directTests: CodeReference[]
	/** Integration tests that exercise this code */
	integrationTests: CodeReference[]
	/** Test coverage percentage (0-100) */
	coveragePercentage: number
}

/**
 * Dependency context
 */
export interface DependencyContext {
	/** Direct dependencies (imports, calls) */
	directDependencies: CodeReference[]
	/** Maximum depth of dependency tree */
	dependencyDepth: number
	/** Circular dependencies detected */
	circularDependencies: string[]
}

/**
 * Type information context
 */
export interface TypeInfoContext {
	/** Type definition string */
	definition: string
	/** Types this type depends on */
	typeDependencies: CodeReference[]
	/** Where this type is used */
	typeUsage: CodeReference[]
}

/**
 * File-level summary context
 */
export interface FileSummaryContext {
	/** Purpose of the file (extracted from comments/exports) */
	purpose: string
	/** Main exports from the file */
	mainExports: string[]
	/** Dependencies of the file */
	dependencies: string[]
	/** Overall file test coverage percentage */
	testCoverage: number
}

/**
 * Enriched search result with contextual information
 */
export interface EnrichedSearchResult extends HybridSearchResult {
	/** Related code context (callers, callees, inheritance) */
	relatedCode?: RelatedCodeContext
	/** Test coverage context */
	tests?: TestContext
	/** Dependency context */
	dependencies?: DependencyContext
	/** Type information context */
	typeInfo?: TypeInfoContext
	/** File-level summary */
	fileSummary?: FileSummaryContext
}

/**
 * Options for context enrichment
 */
export interface ContextEnrichmentOptions {
	/** Maximum number of related items per category (default: 3) */
	maxRelatedItems?: number
	/** Enable related code enrichment (default: true) */
	enrichRelatedCode?: boolean
	/** Enable test enrichment (default: true) */
	enrichTests?: boolean
	/** Enable dependency enrichment (default: true) */
	enrichDependencies?: boolean
	/** Enable type info enrichment (default: true) */
	enrichTypeInfo?: boolean
	/** Enable file summary enrichment (default: true) */
	enrichFileSummary?: boolean
	/** Skip enrichment for large result sets (default: 20) */
	skipEnrichmentThreshold?: number
}

/**
 * Interface for context enrichment service
 */
export interface IContextEnrichmentService {
	/**
	 * Enriches search results with contextual information
	 */
	enrichSearchResults(
		results: HybridSearchResult[],
		options?: ContextEnrichmentOptions,
	): Promise<EnrichedSearchResult[]>

	/**
	 * Enriches a single result with related code context
	 */
	enrichWithRelatedCode(result: HybridSearchResult, maxItems: number): Promise<RelatedCodeContext | undefined>

	/**
	 * Enriches a single result with test context
	 */
	enrichWithTests(result: HybridSearchResult): Promise<TestContext | undefined>

	/**
	 * Enriches a single result with dependency context
	 */
	enrichWithDependencies(result: HybridSearchResult, maxItems: number): Promise<DependencyContext | undefined>

	/**
	 * Enriches a single result with type information
	 */
	enrichWithTypeInfo(result: HybridSearchResult, maxItems: number): Promise<TypeInfoContext | undefined>

	/**
	 * Enriches with file-level summary
	 */
	enrichWithFileSummary(filePath: string): Promise<FileSummaryContext | undefined>
}
