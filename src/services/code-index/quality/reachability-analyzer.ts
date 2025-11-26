import { Node } from "web-tree-sitter"
import { IReachabilityContext, ScopeType, ReachabilityAnalysisConfig } from "./interfaces/reachability"
import { ReachabilityContext } from "./reachability-context"
import {
	ReturnHandler,
	BreakHandler,
	ContinueHandler,
	ThrowHandler,
	ConditionalHandler,
	SwitchHandler,
} from "./handlers"

/**
 * Coordinates AST analysis using the reachability context system
 */
export class ReachabilityAnalyzer {
	private context: IReachabilityContext | null = null
	private config: ReachabilityAnalysisConfig
	private startTime: number = 0
	private lastAnalysisStats: { depth: number; time: number; unreachableNodes: number } | null = null

	constructor(config: ReachabilityAnalysisConfig = {}) {
		this.config = {
			maxAnalysisDepth: 1000,
			enableDebugging: false,
			maxAnalysisTime: 10000, // 10 seconds
			...config,
		}
	}

	/**
	 * Analyzes an AST node for unreachable code
	 */
	analyze(rootNode: Node, context: IReachabilityContext, language: string): void {
		this.context = context
		this.startTime = Date.now()

		// Start analysis at root level
		context.enterScope(ScopeType.BLOCK, rootNode)

		// Traverse the AST
		this.traverseNode(rootNode, 0)

		// Exit root scope
		context.exitScope()

		// Store final stats before nullifying context
		this.lastAnalysisStats = {
			depth: context.scopeStack.length,
			time: Date.now() - this.startTime,
			unreachableNodes: context.unreachableNodes.length,
		}

		this.context = null
	}

	/**
	 * Creates a new ReachabilityContext with default handlers
	 */
	createContext(): IReachabilityContext {
		const handlers = [
			new ReturnHandler(),
			new BreakHandler(),
			new ContinueHandler(),
			new ThrowHandler(),
			new ConditionalHandler(),
			new SwitchHandler(),
		]

		return new ReachabilityContext(handlers)
	}

	/**
	 * Traverses AST nodes with proper scope management
	 */
	private traverseNode(node: Node, depth: number): void {
		if (!this.context) return

		// Check analysis limits
		if (this.shouldAbortAnalysis(depth)) {
			return
		}

		// Debug logging
		if (this.config.enableDebugging) {
			console.debug(`Analyzing node: ${node.type} at line ${node.startPosition.row + 1}`)
		}

		// Process the current node
		this.context.processNode(node)

		// Handle scope-entering nodes
		if (this.isScopeEnteringNode(node)) {
			this.handleScopeEntry(node)
		}

		// Traverse children
		for (const child of node.children || []) {
			if (child) {
				this.traverseNode(child, depth + 1)
			}
		}

		// Handle scope-exiting nodes
		if (this.isScopeExitingNode(node)) {
			this.handleScopeExit(node)
		}
	}

	/**
	 * Check if analysis should be aborted based on limits
	 */
	private shouldAbortAnalysis(depth: number): boolean {
		// Check depth limit
		if (this.config.maxAnalysisDepth && depth > this.config.maxAnalysisDepth) {
			if (this.config.enableDebugging) {
				console.warn(`Analysis depth exceeded limit: ${depth}`)
			}
			return true
		}

		// Check time limit
		if (this.config.maxAnalysisTime) {
			const elapsed = Date.now() - this.startTime
			if (elapsed > this.config.maxAnalysisTime) {
				if (this.config.enableDebugging) {
					console.warn(`Analysis time exceeded limit: ${elapsed}ms`)
				}
				return true
			}
		}

		return false
	}

	/**
	 * Check if a node type represents a scope-entering construct
	 */
	private isScopeEnteringNode(node: Node): boolean {
		const scopeEnteringTypes = [
			"function_declaration",
			"function_definition",
			"arrow_function",
			"function_expression",
			"method_definition",
			"for_statement",
			"for_in_statement",
			"for_of_statement",
			"while_statement",
			"do_statement",
			"if_statement",
			"switch_statement",
			"try_statement",
			"catch_clause",
			"finally_clause",
			"class_declaration",
			"class_expression",
			"block",
		]

		return scopeEnteringTypes.includes(node.type)
	}

	/**
	 * Check if a node type represents a scope-exiting construct
	 */
	private isScopeExitingNode(node: Node): boolean {
		// For most constructs, the same node that enters a scope also exits it
		// The scope is exited after processing its children
		return this.isScopeEnteringNode(node)
	}

	/**
	 * Handle entering a new scope
	 */
	private handleScopeEntry(node: Node): void {
		if (!this.context) return

		let scopeType: ScopeType

		switch (node.type) {
			case "function_declaration":
			case "function_definition":
			case "arrow_function":
			case "function_expression":
			case "method_definition":
				scopeType = ScopeType.FUNCTION
				break
			case "for_statement":
			case "for_in_statement":
			case "for_of_statement":
			case "while_statement":
			case "do_statement":
				scopeType = ScopeType.LOOP
				break
			case "if_statement":
				scopeType = ScopeType.CONDITIONAL
				break
			case "switch_statement":
				scopeType = ScopeType.SWITCH
				break
			case "try_statement":
			case "catch_clause":
			case "finally_clause":
				scopeType = ScopeType.TRY_CATCH
				break
			case "class_declaration":
			case "class_expression":
			case "block":
			default:
				scopeType = ScopeType.BLOCK
		}

		this.context.enterScope(scopeType, node)

		if (this.config.enableDebugging) {
			console.debug(`Entered scope: ${scopeType} at line ${node.startPosition.row + 1}`)
		}
	}

	/**
	 * Handle exiting a scope
	 */
	private handleScopeExit(node: Node): void {
		if (!this.context) return

		const scopeType = this.context.currentScope?.scopeType

		this.context.exitScope()

		if (this.config.enableDebugging && scopeType) {
			console.debug(`Exited scope: ${scopeType} at line ${node.startPosition.row + 1}`)
		}
	}

	/**
	 * Get analysis statistics
	 */
	getAnalysisStats(): { depth: number; time: number; unreachableNodes: number } | null {
		if (this.context) {
			return {
				depth: this.context.scopeStack.length,
				time: Date.now() - this.startTime,
				unreachableNodes: this.context.unreachableNodes.length,
			}
		}

		// Return stored stats if context is null (after analysis completes)
		return this.lastAnalysisStats
	}
}
