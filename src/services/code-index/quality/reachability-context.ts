import { Node } from "web-tree-sitter"
import {
	IReachabilityContext,
	ReachabilityState,
	ScopeType,
	UnreachableReason,
	BranchContext,
	UnreachableNode,
	IControlFlowHandler,
} from "./interfaces/reachability"

/**
 * Implementation of reachability context that tracks scope-based reachability
 * using a stack-based approach to handle nested control flow constructs.
 */
export class ReachabilityContext implements IReachabilityContext {
	private _scopeStack: ReachabilityState[] = []
	private _branchContexts: BranchContext[] = []
	private _unreachableNodes: UnreachableNode[] = []
	private _controlFlowHandlers: Map<string, IControlFlowHandler> = new Map()

	/**
	 * Get the current scope stack
	 */
	get scopeStack(): ReachabilityState[] {
		return [...this._scopeStack]
	}

	/**
	 * Get the current branch contexts
	 */
	get branchContexts(): BranchContext[] {
		return [...this._branchContexts]
	}

	/**
	 * Get the current active scope
	 */
	get currentScope(): ReachabilityState | null {
		return this._scopeStack.length > 0 ? this._scopeStack[this._scopeStack.length - 1] : null
	}

	/**
	 * Get all unreachable nodes found during analysis
	 */
	get unreachableNodes(): UnreachableNode[] {
		return [...this._unreachableNodes]
	}

	constructor(handlers: IControlFlowHandler[] = []) {
		this.initializeHandlers(handlers)
	}

	/**
	 * Enter a new scope with initial reachability state
	 */
	enterScope(type: ScopeType, node?: Node): void {
		const newScope: ReachabilityState = {
			isReachable: this.getCurrentReachability(),
			scopeType: type,
		}

		this._scopeStack.push(newScope)
	}

	/**
	 * Exit the current scope and merge reachability state
	 */
	exitScope(): void {
		if (this._scopeStack.length > 0) {
			const exitedScope = this._scopeStack.pop()!

			// Merge reachability state with parent scope
			if (this._scopeStack.length > 0) {
				const parentScope = this._scopeStack[this._scopeStack.length - 1]
				// Only merge if parent scope is still reachable
				if (parentScope.isReachable && !exitedScope.isReachable) {
					// Handle scope-specific merging logic
					this.mergeScopeStates(parentScope, exitedScope)
				}
			}
		}
	}

	/**
	 * Mark current scope as unreachable with specific reason
	 */
	markUnreachable(reason: UnreachableReason, atLine?: number): void {
		const currentScope = this.currentScope
		if (currentScope) {
			currentScope.isReachable = false
			currentScope.unreachableReason = reason
			currentScope.unreachableAt = atLine
		}
	}

	/**
	 * Get current reachability state
	 */
	getCurrentReachability(): boolean {
		if (this._scopeStack.length === 0) return true

		// Check if any scope in the stack is unreachable
		return this._scopeStack.every((scope) => scope.isReachable)
	}

	/**
	 * Add an unreachable node to the results
	 */
	addUnreachableNode(node: Node, reason: UnreachableReason): void {
		const unreachableNode: UnreachableNode = {
			node,
			reason,
			scopeType: this.currentScope?.scopeType || ScopeType.BLOCK,
			line: node.startPosition.row + 1,
			snippet: node.text.trim().substring(0, 100),
		}

		this._unreachableNodes.push(unreachableNode)
	}

	/**
	 * Process a node using appropriate control flow handler
	 */
	processNode(node: Node): void {
		const handler = this._controlFlowHandlers.get(node.type)
		if (handler) {
			handler.process(node, this)
		}

		// Check if current node is unreachable
		if (!this.getCurrentReachability() && this.isSignificantStatement(node)) {
			const reason = this.currentScope?.unreachableReason || UnreachableReason.DEAD_CODE
			this.addUnreachableNode(node, reason)
		}
	}

	/**
	 * Get all unreachable nodes found during analysis
	 */
	getUnreachableNodes(): UnreachableNode[] {
		return [...this._unreachableNodes]
	}

	/**
	 * Reset context for new analysis
	 */
	reset(): void {
		this._scopeStack = []
		this._branchContexts = []
		this._unreachableNodes = []
	}

	/**
	 * Add a branch context for conditional analysis
	 */
	addBranchContext(branch: BranchContext): void {
		this._branchContexts.push(branch)
	}

	/**
	 * Get a specific branch context by ID
	 */
	getBranchContext(id: string): BranchContext | undefined {
		return this._branchContexts.find((branch) => branch.id === id)
	}

	/**
	 * Remove a branch context by ID
	 */
	removeBranchContext(id: string): void {
		const index = this._branchContexts.findIndex((branch) => branch.id === id)
		if (index !== -1) {
			this._branchContexts.splice(index, 1)
		}
	}

	/**
	 * Register a control flow handler
	 */
	registerHandler(handler: IControlFlowHandler): void {
		this._controlFlowHandlers.set(handler.type, handler)
	}

	/**
	 * Unregister a control flow handler
	 */
	unregisterHandler(type: string): void {
		this._controlFlowHandlers.delete(type)
	}

	/**
	 * Initialize control flow handlers
	 */
	private initializeHandlers(handlers: IControlFlowHandler[]): void {
		for (const handler of handlers) {
			this.registerHandler(handler)
		}
	}

	/**
	 * Check if a node is significant enough to be reported as unreachable
	 */
	private isSignificantStatement(node: Node): boolean {
		// Implementation to check if node is significant enough to report
		const insignificantTypes = ["comment", ";", "{", "}", "program"]
		return !insignificantTypes.includes(node.type) && node.text.trim().length > 0
	}

	/**
	 * Merge child scope state back into parent scope
	 */
	private mergeScopeStates(parent: ReachabilityState, child: ReachabilityState): void {
		// Logic to merge child scope state back into parent
		// This handles cases like conditional branches where we need to
		// determine if the parent scope should be marked as unreachable

		// For now, we'll keep the parent reachable if any child branch is reachable
		// This logic can be enhanced based on specific requirements
		if (child.scopeType === ScopeType.CONDITIONAL && !child.isReachable) {
			// For conditional scopes, we need to check all branches
			// This is a simplified implementation - the full logic would be in the conditional handler
			return
		}

		// For other scope types, we might want to propagate unreachability
		// This depends on the specific semantics of each scope type
	}
}
