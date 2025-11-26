import { Node } from "web-tree-sitter"
import { BaseControlFlowHandler } from "./base-handler"
import {
	IReachabilityContext,
	UnreachableReason,
	ScopeType,
	ISwitchHandler,
	BranchContext,
} from "../interfaces/reachability"

/**
 * Handler for switch statements
 * Tracks reachability for each case separately
 */
export class SwitchHandler extends BaseControlFlowHandler implements ISwitchHandler {
	readonly type = "switch_statement"

	/**
	 * Check if this handler can process the given node type
	 */
	canHandle(nodeType: string): boolean {
		return nodeType === "switch_statement"
	}

	/**
	 * Process a switch statement node
	 */
	process(node: Node, context: IReachabilityContext): void {
		this.processSwitch(node, context)
	}

	/**
	 * Process switch statements with case-specific reachability
	 */
	processSwitch(node: Node, context: IReachabilityContext): void {
		// Enter switch scope
		context.enterScope(ScopeType.SWITCH, node)

		// Get the body of the switch statement
		const bodyNode = this.getChildNode(node, "body")
		if (!bodyNode) {
			context.exitScope()
			return
		}

		// Process each case
		const caseBranches: BranchContext[] = []
		let hasDefaultCase = false
		let previousCaseHadBreak = false

		for (const child of bodyNode.children || []) {
			if (!child) continue

			if (child.type === "case") {
				// Create a branch for this case
				const caseBranch: BranchContext = {
					id: `case_${this.getLineNumber(child)}`,
					isReachable: context.getCurrentReachability() && !previousCaseHadBreak,
					condition: this.getChildNode(child, "value")?.text,
					parentNode: node,
				}

				caseBranches.push(caseBranch)
				context.addBranchContext(caseBranch)

				// Process the case body
				this.processCaseBody(child, context, caseBranch)

				// Check if this case has a break statement
				previousCaseHadBreak = this.hasBreakStatement(child)
			} else if (child.type === "default_clause") {
				// Handle default case
				hasDefaultCase = true
				const defaultBranch: BranchContext = {
					id: `default_${this.getLineNumber(child)}`,
					isReachable: context.getCurrentReachability() && !previousCaseHadBreak,
					condition: "default",
					parentNode: node,
				}

				caseBranches.push(defaultBranch)
				context.addBranchContext(defaultBranch)

				// Process the default body
				this.processCaseBody(child, context, defaultBranch)
			}
		}

		// Exit switch scope
		context.exitScope()

		// Determine if the switch statement as a whole is reachable
		this.analyzeSwitchReachability(caseBranches, hasDefaultCase, context)

		// Clean up branch contexts
		for (const branch of caseBranches) {
			context.removeBranchContext(branch.id)
		}
	}

	/**
	 * Process the body of a case statement
	 */
	private processCaseBody(caseNode: Node, context: IReachabilityContext, branch: BranchContext): void {
		// Process all children of the case (except the case value itself)
		for (const child of caseNode.children || []) {
			if (!child) continue
			if (child.type === "switch_case") continue // Skip the case declaration

			context.processNode(child)
		}

		// Update branch reachability based on what happened during processing
		branch.isReachable = context.getCurrentReachability()
	}

	/**
	 * Check if a case statement contains a break statement
	 */
	private hasBreakStatement(caseNode: Node): boolean {
		// Look for break statements in the case body
		for (const child of caseNode.children || []) {
			if (!child) continue
			if (child.type === "case") continue // Skip the case declaration

			if (this.containsBreakStatement(child)) {
				return true
			}
		}
		return false
	}

	/**
	 * Recursively check if a node or its children contain a break statement
	 */
	private containsBreakStatement(node: Node): boolean {
		if (node.type === "break_statement") {
			return true
		}

		for (const child of node.children || []) {
			if (child && this.containsBreakStatement(child)) {
				return true
			}
		}

		return false
	}

	/**
	 * Analyze the overall reachability of the switch statement
	 */
	private analyzeSwitchReachability(
		caseBranches: BranchContext[],
		hasDefaultCase: boolean,
		context: IReachabilityContext,
	): void {
		// Check if all cases terminate (have break/return/throw)
		const allCasesTerminate = caseBranches.every((branch) => !branch.isReachable)
		const hasReachableBranch = caseBranches.some((branch) => branch.isReachable)

		if (hasDefaultCase && allCasesTerminate) {
			// All cases terminate including default, so code after switch is reachable
			// No action needed - context remains reachable
		} else if (!hasDefaultCase && !hasReachableBranch) {
			// No reachable branches and no default case - switch might not handle the value
			context.markUnreachable(UnreachableReason.CONDITIONAL_FALSE)
		}
		// Otherwise, context remains reachable (either has reachable branches or default case)
	}
}
