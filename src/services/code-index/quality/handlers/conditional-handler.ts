import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import {
	IReachabilityContext,
	UnreachableReason,
	ScopeType,
	IConditionalHandler,
	BranchContext,
} from "../interfaces/reachability"

/**
 * Handler for conditional statements (if/else)
 * Tracks reachability for each branch separately
 */
export class ConditionalHandler extends BaseControlFlowHandler implements IConditionalHandler {
	readonly type = "if_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "if_statement" || nodeType === "elif_clause"
	}

	/**
	 * Process a conditional statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processConditional(node, context)
	}

	/**
	 * Process if/else statements with branch-specific reachability
	 */
	processConditional(node: Node, context: IReachabilityContext): void {
		// Create branch contexts for if and else branches
		const ifBranch: BranchContext = {
			id: `if_${this.getLineNumber(node)}`,
			isReachable: context.getCurrentReachability(),
			condition: this.getChildNode(node, "condition")?.text,
			parentNode: node,
		}

		context.addBranchContext(ifBranch)

		// Enter conditional scope
		context.enterScope(ScopeType.CONDITIONAL, node)

		// Process if branch
		const consequenceNode = this.getChildNode(node, "consequence")
		if (consequenceNode) {
			this.processBranch(consequenceNode, context, ifBranch)
		}

		// Process else branch if present
		const alternativeNode = this.getChildNode(node, "alternative")
		let elseBranch: BranchContext | null = null

		if (alternativeNode) {
			elseBranch = {
				id: `else_${this.getLineNumber(node)}`,
				isReachable: context.getCurrentReachability(),
				condition: "else",
				parentNode: node,
			}

			context.addBranchContext(elseBranch)
			this.processBranch(alternativeNode, context, elseBranch)
		}

		// Exit conditional scope
		context.exitScope()

		// Merge branch reachability
		const branches = [ifBranch, elseBranch].filter((branch): branch is BranchContext => branch !== null)
		this.mergeBranches(branches, context)

		// Clean up branch contexts
		context.removeBranchContext(ifBranch.id)
		if (elseBranch) {
			context.removeBranchContext(elseBranch.id)
		}
	}

	/**
	 * Process a single branch with its own reachability context
	 */
	private processBranch(node: Node, context: IReachabilityContext, branch: BranchContext): void {
		// Save current reachability state
		const wasReachable = context.getCurrentReachability()

		// Process the branch
		for (const child of node.children || []) {
			if (child) {
				context.processNode(child)
			}
		}

		// Update branch reachability based on what happened during processing
		branch.isReachable = context.getCurrentReachability()
	}

	/**
	 * Merge reachability from multiple branches
	 */
	mergeBranches(branches: BranchContext[], context: IReachabilityContext): void {
		// Merge reachability from all branches
		// A scope is reachable if ANY branch is reachable
		const hasReachableBranch = branches.some((branch) => branch.isReachable)

		if (!hasReachableBranch) {
			// If all branches are unreachable, mark the context as unreachable
			context.markUnreachable(UnreachableReason.CONDITIONAL_FALSE)
		}

		// Note: The actual merging logic might be more complex depending on:
		// 1. Whether we can statically determine the condition
		// 2. Whether all branches have return statements
		// 3. Whether all branches have throw statements
		// This is a simplified implementation that can be enhanced
	}
}
