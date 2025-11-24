import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import { IReachabilityContext, UnreachableReason, ScopeType, IThrowHandler } from "../interfaces/reachability"

/**
 * Handler for throw statements
 * Marks the current function scope as unreachable after a throw
 */
export class ThrowHandler extends BaseControlFlowHandler implements IThrowHandler {
	readonly type = "throw_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "throw_statement"
	}

	/**
	 * Process a throw statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processThrow(node, context)
	}

	/**
	 * Mark current function scope as having thrown
	 */
	processThrow(node: Node, context: IReachabilityContext): void {
		// Find the nearest function scope
		const functionScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.FUNCTION)

		if (functionScope) {
			functionScope.isReachable = false
			functionScope.unreachableReason = UnreachableReason.AFTER_THROW
			functionScope.unreachableAt = this.getLineNumber(node)
		} else {
			// If we're not in a function scope, check if we're in a try-catch block
			const tryCatchScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.TRY_CATCH)

			if (tryCatchScope) {
				// In a try-catch block, the throw doesn't necessarily make code unreachable
				// The catch block might handle it, so we don't mark the scope as unreachable here
				// The try-catch handler will handle the proper logic
				return
			}

			// If we're not in a function or try-catch scope, mark current scope as unreachable
			context.markUnreachable(UnreachableReason.AFTER_THROW, this.getLineNumber(node))
		}
	}
}
