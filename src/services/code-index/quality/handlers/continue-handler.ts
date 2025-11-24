import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import { IReachabilityContext, UnreachableReason, ScopeType, IContinueHandler } from "../interfaces/reachability"

/**
 * Handler for continue statements
 * Marks the current loop scope as unreachable after a continue
 */
export class ContinueHandler extends BaseControlFlowHandler implements IContinueHandler {
	readonly type = "continue_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "continue_statement"
	}

	/**
	 * Process a continue statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processContinue(node, context)
	}

	/**
	 * Mark current loop scope as continued
	 */
	processContinue(node: Node, context: IReachabilityContext): void {
		// Find the nearest loop scope (for, while, do-while)
		const loopScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.LOOP)

		if (loopScope) {
			loopScope.isReachable = false
			loopScope.unreachableReason = UnreachableReason.AFTER_CONTINUE
			loopScope.unreachableAt = this.getLineNumber(node)
		} else {
			// If we're not in a loop scope, this is a syntax error
			// But for reachability analysis, we'll mark current scope as unreachable
			context.markUnreachable(UnreachableReason.AFTER_CONTINUE, this.getLineNumber(node))
		}
	}
}
