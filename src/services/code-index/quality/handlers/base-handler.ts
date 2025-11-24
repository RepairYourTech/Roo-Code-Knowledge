import { Node } from "web-tree-sitter"
import { IControlFlowHandler, IReachabilityContext } from "../interfaces/reachability"

/**
 * Base class for all control flow handlers
 */
export abstract class BaseControlFlowHandler implements IControlFlowHandler {
	/**
	 * Type of control flow this handler manages
	 */
	abstract readonly type: string

	/**
	 * Process a control flow node and update reachability context
	 */
	abstract process(node: Node, context: IReachabilityContext): void

	/**
	 * Check if a node should be handled by this handler
	 */
	abstract canHandle(nodeType: string): boolean

	/**
	 * Helper method to get line number from node
	 */
	protected getLineNumber(node: Node): number {
		return node.startPosition.row + 1
	}

	/**
	 * Helper method to check if a node has a child field
	 */
	protected getChildNode(node: Node, fieldName: string): Node | null {
		return node.childForFieldName(fieldName)
	}

	/**
	 * Helper method to get all children of a specific type
	 */
	protected getChildrenOfType(node: Node, nodeType: string): Node[] {
		return node.children.filter((child): child is Node => child !== null).filter((child) => child.type === nodeType)
	}

	/**
	 * Helper method to check if a node is significant for reporting
	 */
	protected isSignificantNode(node: Node): boolean {
		const insignificantTypes = ["comment", ";", "{", "}", "program"]
		return !insignificantTypes.includes(node.type) && node.text.trim().length > 0
	}
}
