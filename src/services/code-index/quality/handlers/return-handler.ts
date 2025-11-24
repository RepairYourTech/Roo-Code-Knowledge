import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import { IReachabilityContext, UnreachableReason, ScopeType, IReturnHandler } from "../interfaces/reachability"

/**
 * Handler for return statements
 * Marks the current function scope as unreachable after a return
 */
export class ReturnHandler extends BaseControlFlowHandler implements IReturnHandler {
	readonly type = "return_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "return_statement"
	}

	/**
	 * Process a return statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processReturn(node, context)
	}

	/**
	 * Mark current function scope as having returned
	 */
	processReturn(node: Node, context: IReachabilityContext): void {
		// Find the nearest function scope
		const functionScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.FUNCTION)

		if (functionScope) {
			functionScope.isReachable = false
			functionScope.unreachableReason = UnreachableReason.AFTER_RETURN
			functionScope.unreachableAt = this.getLineNumber(node)
		} else {
			// If we're not in a function scope, mark the current scope as unreachable
			// This handles cases like arrow functions or other constructs
			context.markUnreachable(UnreachableReason.AFTER_RETURN, this.getLineNumber(node))
		}
	}
}
