import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import { IReachabilityContext, UnreachableReason, ScopeType, IBreakHandler } from "../interfaces/reachability"

/**
 * Handler for break statements
 * Marks the current loop scope as unreachable after a break
 */
export class BreakHandler extends BaseControlFlowHandler implements IBreakHandler {
	readonly type = "break_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "break_statement"
	}

	/**
	 * Process a break statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processBreak(node, context)
	}

	/**
	 * Mark current loop scope as broken
	 */
	processBreak(node: Node, context: IReachabilityContext): void {
		// Find the nearest loop scope (for, while, do-while)
		const loopScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.LOOP)

		if (loopScope) {
			loopScope.isReachable = false
			loopScope.unreachableReason = UnreachableReason.AFTER_BREAK
			loopScope.unreachableAt = this.getLineNumber(node)
		} else {
			// If we're not in a loop scope, check for switch scope
			// Break statements can also be used in switch statements
			const switchScope = context.scopeStack.find((scope) => scope.scopeType === ScopeType.SWITCH)

			if (switchScope) {
				// In switch statements, break doesn't necessarily make code unreachable
				// It just exits the switch, so we don't mark the scope as unreachable here
				// The switch handler will handle the proper logic
				return
			}

			// If we're not in a loop or switch scope, this is a syntax error
			// But for reachability analysis, we'll mark current scope as unreachable
			context.markUnreachable(UnreachableReason.AFTER_BREAK, this.getLineNumber(node))
		}
	}
}
