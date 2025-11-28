// import Parser = require('web-tree-sitter');

export interface NodeTypeReport {
	nodeType: string
	count: number
	depths: number[]
	examples: string[]
}

export interface QueryMismatch {
	pattern: string
	expectedType: string
	actualType: string | null
	startLine: number
	endLine: number
}

export interface ASTAnalysisReport {
	filePath: string
	nodeTypes: Map<string, NodeTypeReport>
	mismatches: QueryMismatch[]
	rootNode: string
	totalNodes: number
}

/**
 * Analyzes the AST structure of a parsed code file
 */
export function analyzeASTStructure(rootNode: any): Map<string, NodeTypeReport> {
	const nodeTypes = new Map<string, NodeTypeReport>()

	function traverse(node: any, depth: number) {
		const type = node.type

		if (!nodeTypes.has(type)) {
			nodeTypes.set(type, {
				nodeType: type,
				count: 0,
				depths: [],
				examples: [],
			})
		}

		const report = nodeTypes.get(type)!
		report.count++
		if (!report.depths.includes(depth)) {
			report.depths.push(depth)
		}

		// Store first few examples of this node type
		if (report.examples.length < 3 && node.text.length < 100) {
			report.examples.push(node.text)
		}

		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child) {
				traverse(child, depth + 1)
			}
		}
	}

	traverse(rootNode, 0)
	return nodeTypes
}

/**
 * Extracts a hierarchical view of the AST node types
 */
export function extractNodeTypeHierarchy(rootNode: any): any {
	const result: any = {
		type: rootNode.type,
		children: [],
	}

	// Limit depth/breadth for readability if needed, but for now capture all
	for (let i = 0; i < rootNode.childCount; i++) {
		const child = rootNode.child(i)
		if (child) {
			result.children.push(extractNodeTypeHierarchy(child))
		}
	}

	return result
}

/**
 * Compares a query against an AST to identify potential mismatches
 */
export function compareQueryToAST(query: any, rootNode: any, language: string): QueryMismatch[] {
	const mismatches: QueryMismatch[] = []

	// We can inspect query.captureNames to see what it's looking for
	const captureNames = query.captureNames || []
	const captures = query.captures(rootNode) || []

	// Identify which capture names were NOT found
	const foundCaptures = new Set(captures.map((c: any) => c.name))

	// Get line numbers from the root node for reasonable defaults
	const rootStartLine = rootNode.startPosition ? rootNode.startPosition.row : 0
	const rootEndLine = rootNode.endPosition ? rootNode.endPosition.row : 0

	for (const name of captureNames) {
		if (!foundCaptures.has(name)) {
			mismatches.push({
				pattern: name,
				expectedType: name, // Best guess without parsing S-expression
				actualType: null,
				startLine: rootStartLine,
				endLine: rootEndLine,
			})
		}
	}

	return mismatches
}

/**
 * Generates a comprehensive report for a file
 */
export function generateNodeTypeReport(filePath: string, rootNode: any, query?: any): ASTAnalysisReport {
	const nodeTypes = analyzeASTStructure(rootNode)
	const mismatches: QueryMismatch[] = []

	if (query) {
		// Use compareQueryToAST to find mismatches
		const queryMismatches = compareQueryToAST(query, rootNode, "")
		mismatches.push(...queryMismatches)
	}

	return {
		filePath,
		nodeTypes,
		mismatches,
		rootNode: rootNode.type,
		totalNodes: Array.from(nodeTypes.values()).reduce((acc, curr) => acc + curr.count, 0),
	}
}

/**
 * Suggests query patterns based on the AST structure.
 *
 * Note: This function will perform a full AST traversal if existingNodeTypes is not provided.
 * For better performance, provide a precomputed nodeTypes map from analyzeASTStructure().
 */
export function suggestQueryPatterns(
	rootNode: any,
	language: string,
	existingNodeTypes?: Map<string, NodeTypeReport>,
): string[] {
	const suggestions: string[] = []
	const nodeTypes = existingNodeTypes || analyzeASTStructure(rootNode)

	// Common patterns to look for
	const commonTypes = [
		"function_declaration",
		"function_definition",
		"method_definition",
		"class_declaration",
		"class_definition",
		"interface_declaration",
		"impl_item",
		"struct_item",
	]

	for (const type of commonTypes) {
		if (nodeTypes.has(type)) {
			suggestions.push(`(${type}) @definition.${type}`)
		}
	}

	return suggestions
}
