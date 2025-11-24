import { CodeNode } from "./neo4j-service"
import { HybridSearchResult } from "../hybrid-search-service"

/**
 * Complexity metrics for a code segment
 */
export interface ComplexityMetrics {
	/** Cyclomatic complexity (number of decision points + 1) */
	cyclomaticComplexity: number
	/** Cognitive complexity (weighted by nesting) */
	cognitiveComplexity: number
	/** Maximum nesting depth */
	nestingDepth: number
	/** Lines of code */
	functionLength: number
	/** Number of parameters */
	parameterCount: number
	/** Number of duplicate code instances detected */
	duplicateCodeCount?: number
}

/**
 * Test coverage metrics for a code segment
 */
export interface CoverageMetrics {
	/** Whether the code has at least one test */
	isTested: boolean
	/** Number of direct test relationships */
	directTests: number
	/** Number of integration tests (tests via callers) */
	integrationTests: number
	/** Coverage percentage (0-100) */
	coveragePercentage: number
	/** Test quality assessment */
	testQuality: "none" | "low" | "medium" | "high"
}

/**
 * File-level complexity metrics
 */
export interface FileComplexityMetrics {
	/** File path */
	filePath: string
	/** Average cyclomatic complexity */
	averageComplexity: number
	/** Maximum cyclomatic complexity */
	maxComplexity: number
	/** Total lines of code */
	totalLines: number
	/** Number of functions */
	functionCount: number
	/** Functions with high complexity (>10) */
	highComplexityFunctions: Array<{
		name: string
		complexity: number
		startLine: number
	}>
}

/**
 * File-level coverage metrics
 */
export interface FileCoverageMetrics {
	/** File path */
	filePath: string
	/** Total number of testable nodes */
	totalNodes: number
	/** Number of tested nodes */
	testedNodes: number
	/** Coverage percentage (0-100) */
	coveragePercentage: number
	/** Untested functions */
	untestedFunctions: string[]
}

/**
 * Reference to a code element
 */
export interface CodeReference {
	/** Node ID in graph */
	nodeId: string
	/** Symbol name */
	name: string
	/** File path */
	filePath: string
	/** Start line */
	startLine: number
	/** End line */
	endLine: number
	/** Code snippet (optional) */
	snippet?: string
	/** Node type */
	type?: string
}

/**
 * Dead code detection report
 */
export interface DeadCodeReport {
	/** Unused functions (no CALLED_BY relationships) */
	unusedFunctions: CodeReference[]
	/** Orphaned nodes (no relationships) */
	orphanedNodes: CodeReference[]
	/** Unreachable code (no path from entry points) */
	unreachableCode: CodeReference[]
	/** Unused imports */
	unusedImports: string[]
	/** Total lines of dead code */
	totalDeadCodeLines: number
}

/**
 * Quality score for a code segment
 */
export interface QualityScore {
	/** Overall quality score (0-100) */
	overall: number
	/** Complexity score (0-100, higher is better) */
	complexity: number
	/** Coverage score (0-100) */
	coverage: number
	/** Maintainability score (0-100) */
	maintainability: number
	/** Quality factors */
	factors: {
		hasTests: boolean
		isWellDocumented: boolean
		hasLowComplexity: boolean
		hasNoDeadCode: boolean
		followsConventions: boolean
	}
}

/**
 * File-level quality score
 */
export interface FileQualityScore extends QualityScore {
	/** File path */
	filePath: string
	/** Number of issues */
	issueCount: number
	/** Specific issues */
	issues: string[]
}

/**
 * Combined quality metrics
 */
export interface QualityMetrics {
	/** Complexity metrics */
	complexity?: ComplexityMetrics
	/** Coverage metrics */
	coverage?: CoverageMetrics
	/** Quality score */
	qualityScore?: QualityScore
}

/**
 * Options for quality metrics calculation
 */
export interface QualityMetricsOptions {
	/** Include complexity metrics */
	includeComplexity?: boolean
	/** Include coverage metrics */
	includeCoverage?: boolean
	/** Include dead code check */
	includeDeadCodeCheck?: boolean
	/** Include quality score */
	includeQualityScore?: boolean
	/** Maximum results to enrich (default: 20) */
	maxResults?: number
}

/**
 * Search result enriched with quality metrics
 */
export interface QualityEnrichedResult extends HybridSearchResult {
	/** Quality metrics */
	qualityMetrics?: QualityMetrics
}

/**
 * Quality metrics service interface
 */
export interface IQualityMetricsService {
	/** Calculate complexity metrics for a code node */
	calculateComplexity(nodeId: string): Promise<ComplexityMetrics | null>

	/** Calculate file-level complexity metrics */
	calculateFileComplexity(filePath: string): Promise<FileComplexityMetrics | null>

	/** Calculate coverage metrics for a code node */
	calculateCoverage(nodeId: string): Promise<CoverageMetrics | null>

	/** Calculate file-level coverage metrics */
	calculateFileCoverage(filePath: string): Promise<FileCoverageMetrics | null>

	/** Find dead code in a file or entire codebase */
	findDeadCode(filePath?: string): Promise<DeadCodeReport>

	/** Find unused functions */
	findUnusedFunctions(filePath?: string): Promise<CodeNode[]>

	/** Find orphaned nodes */
	findOrphanedNodes(filePath?: string): Promise<CodeNode[]>

	/** Calculate quality score for a code node */
	calculateQualityScore(nodeId: string): Promise<QualityScore | null>

	/** Calculate file-level quality score */
	calculateFileQualityScore(filePath: string): Promise<FileQualityScore | null>

	/** Enrich search results with quality metrics */
	enrichWithQualityMetrics(
		results: HybridSearchResult[],
		options?: QualityMetricsOptions,
	): Promise<QualityEnrichedResult[]>
}
