import { Node } from "web-tree-sitter"

/**
 * Represents the reachability state within a specific scope
 */
export interface ReachabilityState {
	/** Whether code in this scope is reachable */
	isReachable: boolean
	/** Reason for unreachability, if applicable */
	unreachableReason?: UnreachableReason
	/** Line number where unreachability began */
	unreachableAt?: number
	/** Type of scope */
	scopeType: ScopeType
}

/**
 * Types of scopes that can affect reachability
 */
export enum ScopeType {
	FUNCTION = "function",
	LOOP = "loop",
	CONDITIONAL = "conditional",
	TRY_CATCH = "try_catch",
	SWITCH = "switch",
	BLOCK = "block",
}

/**
 * Reasons why code might be unreachable
 */
export enum UnreachableReason {
	AFTER_RETURN = "after_return",
	AFTER_THROW = "after_throw",
	AFTER_BREAK = "after_break",
	AFTER_CONTINUE = "after_continue",
	CONDITIONAL_FALSE = "conditional_false",
	DEAD_CODE = "dead_code",
}

/**
 * Represents a branch in conditional control flow
 */
export interface BranchContext {
	/** Branch identifier */
	id: string
	/** Whether this branch is reachable */
	isReachable: boolean
	/** Condition that determines reachability */
	condition?: string
	/** Parent conditional node */
	parentNode: Node
}

/**
 * Information about unreachable code
 */
export interface UnreachableNode {
	/** AST node that is unreachable */
	node: Node
	/** Reason for unreachability */
	reason: UnreachableReason
	/** Scope where unreachability was detected */
	scopeType: ScopeType
	/** Line number */
	line: number
	/** Code snippet */
	snippet: string
}

/**
 * Context for tracking reachability across scopes and branches
 */
export interface IReachabilityContext {
	/** Stack of reachability states for nested scopes */
	readonly scopeStack: ReachabilityState[]
	/** Current branch contexts for conditional statements */
	readonly branchContexts: BranchContext[]
	/** Current active scope */
	readonly currentScope: ReachabilityState | null
	/** Unreachable code nodes found during analysis */
	readonly unreachableNodes: UnreachableNode[]

	/**
	 * Enter a new scope with initial reachability state
	 */
	enterScope(type: ScopeType, node?: Node): void

	/**
	 * Exit the current scope and merge reachability state
	 */
	exitScope(): void

	/**
	 * Mark current scope as unreachable with specific reason
	 */
	markUnreachable(reason: UnreachableReason, atLine?: number): void

	/**
	 * Get current reachability state
	 */
	getCurrentReachability(): boolean

	/**
	 * Add an unreachable node to the results
	 */
	addUnreachableNode(node: Node, reason: UnreachableReason): void

	/**
	 * Process a node using appropriate control flow handler
	 */
	processNode(node: Node): void

	/**
	 * Get all unreachable nodes found during analysis
	 */
	getUnreachableNodes(): UnreachableNode[]

	/**
	 * Reset context for new analysis
	 */
	reset(): void

	/**
	 * Add a branch context for conditional analysis
	 */
	addBranchContext(branch: BranchContext): void

	/**
	 * Get a specific branch context by ID
	 */
	getBranchContext(id: string): BranchContext | undefined

	/**
	 * Remove a branch context by ID
	 */
	removeBranchContext(id: string): void
}

/**
 * Handles specific control flow constructs
 */
export interface IControlFlowHandler {
	/** Type of control flow this handler manages */
	readonly type: string

	/** Process a control flow node and update reachability context */
	process(node: Node, context: IReachabilityContext): void

	/** Check if a node should be handled by this handler */
	canHandle(nodeType: string): boolean
}

/**
 * Handler for return statements
 */
export interface IReturnHandler extends IControlFlowHandler {
	/** Mark current function scope as having returned */
	processReturn(node: Node, context: IReachabilityContext): void
}

/**
 * Handler for break statements
 */
export interface IBreakHandler extends IControlFlowHandler {
	/** Mark current loop scope as broken */
	processBreak(node: Node, context: IReachabilityContext): void
}

/**
 * Handler for continue statements
 */
export interface IContinueHandler extends IControlFlowHandler {
	/** Mark current loop scope as continued */
	processContinue(node: Node, context: IReachabilityContext): void
}

/**
 * Handler for throw statements
 */
export interface IThrowHandler extends IControlFlowHandler {
	/** Mark current function scope as having thrown */
	processThrow(node: Node, context: IReachabilityContext): void
}

/**
 * Handler for conditional statements
 */
export interface IConditionalHandler extends IControlFlowHandler {
	/** Process if/else statements with branch-specific reachability */
	processConditional(node: Node, context: IReachabilityContext): void

	/** Merge reachability from multiple branches */
	mergeBranches(branches: BranchContext[], context: IReachabilityContext): void
}

/**
 * Handler for switch statements
 */
export interface ISwitchHandler extends IControlFlowHandler {
	/** Process switch statements with case-specific reachability */
	processSwitch(node: Node, context: IReachabilityContext): void
}

/**
 * Configuration options for reachability analysis
 */
export interface ReachabilityAnalysisConfig {
	/** Maximum depth of scope analysis */
	maxAnalysisDepth?: number
	/** Enable debug logging */
	enableDebugging?: boolean
	/** Maximum time for analysis in milliseconds */
	maxAnalysisTime?: number
	/** Language-specific configurations */
	languageConfigs?: Map<string, LanguageSpecificConfig>
}

/**
 * Language-specific configuration
 */
export interface LanguageSpecificConfig {
	/** Additional control flow node types for this language */
	additionalControlFlowNodes?: string[]
	/** Additional conditional node types for this language */
	additionalConditionalNodes?: string[]
	/** Language-specific scope entry patterns */
	scopeEntryPatterns?: string[]
	/** Language-specific scope exit patterns */
	scopeExitPatterns?: string[]
}
