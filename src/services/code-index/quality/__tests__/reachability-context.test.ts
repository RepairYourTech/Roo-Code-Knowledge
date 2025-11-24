import { ReachabilityContext } from "../reachability-context"
import { ReturnHandler } from "../handlers/return-handler"
import { BreakHandler } from "../handlers/break-handler"
import { ScopeType, UnreachableReason } from "../interfaces/reachability"
import { Node } from "web-tree-sitter"

// Mock Node class for testing
class MockNode {
	public type: string
	public startPosition: { row: number; column: number }
	public endPosition: { row: number; column: number }
	public text: string
	public children: MockNode[] = []

	constructor(type: string, text: string = "", startLine: number = 0) {
		this.type = type
		this.text = text
		this.startPosition = { row: startLine, column: 0 }
		this.endPosition = { row: startLine, column: text.length }
	}

	childForFieldName(fieldName: string): MockNode | null {
		// Simple mock implementation
		return this.children[0] || null
	}
}

// Helper function to cast MockNode to Node for testing
function asNode(mockNode: MockNode): Node {
	return mockNode as unknown as Node
}

describe("ReachabilityContext", () => {
	let context: ReachabilityContext

	beforeEach(() => {
		const handlers = [new ReturnHandler(), new BreakHandler()]
		context = new ReachabilityContext(handlers)
	})

	describe("Scope Management", () => {
		it("should start with empty scope stack", () => {
			expect(context.scopeStack).toEqual([])
			expect(context.currentScope).toBeNull()
		})

		it("should enter and exit scopes correctly", () => {
			const mockNode = new MockNode("function_declaration")

			context.enterScope(ScopeType.FUNCTION, asNode(mockNode))

			expect(context.scopeStack.length).toBe(1)
			expect(context.currentScope?.scopeType).toBe(ScopeType.FUNCTION)
			expect(context.currentScope?.isReachable).toBe(true)

			context.exitScope()

			expect(context.scopeStack.length).toBe(0)
			expect(context.currentScope).toBeNull()
		})

		it("should handle nested scopes correctly", () => {
			const functionNode = new MockNode("function_declaration")
			const loopNode = new MockNode("for_statement")

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.enterScope(ScopeType.LOOP, asNode(loopNode))

			expect(context.scopeStack.length).toBe(2)
			expect(context.currentScope?.scopeType).toBe(ScopeType.LOOP)

			context.exitScope()

			expect(context.scopeStack.length).toBe(1)
			expect(context.currentScope?.scopeType).toBe(ScopeType.FUNCTION)
		})

		it("should inherit reachability from parent scope", () => {
			const functionNode = new MockNode("function_declaration")

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.markUnreachable(UnreachableReason.AFTER_RETURN)

			expect(context.getCurrentReachability()).toBe(false)

			context.enterScope(ScopeType.BLOCK)

			expect(context.getCurrentReachability()).toBe(false)
			expect(context.currentScope?.isReachable).toBe(false)
		})
	})

	describe("Reachability State", () => {
		it("should return true when no scopes exist", () => {
			expect(context.getCurrentReachability()).toBe(true)
		})

		it("should return true when all scopes are reachable", () => {
			const functionNode = new MockNode("function_declaration")
			const loopNode = new MockNode("for_statement")

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.enterScope(ScopeType.LOOP, asNode(loopNode))

			expect(context.getCurrentReachability()).toBe(true)
		})

		it("should return false when any scope is unreachable", () => {
			const functionNode = new MockNode("function_declaration")

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.markUnreachable(UnreachableReason.AFTER_RETURN)

			expect(context.getCurrentReachability()).toBe(false)
		})

		it("should mark current scope as unreachable", () => {
			const functionNode = new MockNode("function_declaration", "", 5)

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.markUnreachable(UnreachableReason.AFTER_RETURN, 5)

			expect(context.currentScope?.isReachable).toBe(false)
			expect(context.currentScope?.unreachableReason).toBe(UnreachableReason.AFTER_RETURN)
			expect(context.currentScope?.unreachableAt).toBe(5)
		})
	})

	describe("Unreachable Nodes", () => {
		it("should add unreachable nodes correctly", () => {
			const mockNode = new MockNode("expression_statement", "console.log('test')", 10)

			context.enterScope(ScopeType.FUNCTION)
			context.markUnreachable(UnreachableReason.AFTER_RETURN)
			context.addUnreachableNode(asNode(mockNode), UnreachableReason.AFTER_RETURN)

			const unreachableNodes = context.getUnreachableNodes()
			expect(unreachableNodes.length).toBe(1)
			expect(unreachableNodes[0].node).toBe(mockNode)
			expect(unreachableNodes[0].reason).toBe(UnreachableReason.AFTER_RETURN)
			expect(unreachableNodes[0].line).toBe(11) // 1-based
			expect(unreachableNodes[0].snippet).toBe("console.log('test')")
		})

		it("should not add nodes when reachable", () => {
			const mockNode = new MockNode("expression_statement", "console.log('test')", 10)

			context.addUnreachableNode(asNode(mockNode), UnreachableReason.DEAD_CODE)

			const unreachableNodes = context.getUnreachableNodes()
			expect(unreachableNodes.length).toBe(0)
		})
	})

	describe("Branch Contexts", () => {
		it("should manage branch contexts correctly", () => {
			const ifNode = new MockNode("if_statement")
			const branch = {
				id: "test_branch",
				isReachable: true,
				condition: "true",
				parentNode: asNode(ifNode),
			}

			context.addBranchContext(branch)

			expect(context.branchContexts.length).toBe(1)
			expect(context.getBranchContext("test_branch")).toBe(branch)

			context.removeBranchContext("test_branch")

			expect(context.branchContexts.length).toBe(0)
			expect(context.getBranchContext("test_branch")).toBeUndefined()
		})
	})

	describe("Control Flow Processing", () => {
		it("should process return statements", () => {
			const functionNode = new MockNode("function_declaration")
			const returnNode = new MockNode("return_statement", "return 42", 5)

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.processNode(asNode(returnNode))

			expect(context.currentScope?.isReachable).toBe(false)
			expect(context.currentScope?.unreachableReason).toBe(UnreachableReason.AFTER_RETURN)
		})

		it("should not process unknown node types", () => {
			const unknownNode = new MockNode("unknown_type")
			const initialReachability = context.getCurrentReachability()

			context.processNode(asNode(unknownNode))

			expect(context.getCurrentReachability()).toBe(initialReachability)
		})
	})

	describe("Reset", () => {
		it("should reset all state", () => {
			const functionNode = new MockNode("function_declaration")
			const returnNode = new MockNode("return_statement", "return 42", 5)
			const branch = {
				id: "test_branch",
				isReachable: true,
				condition: "true",
				parentNode: functionNode,
			}

			context.enterScope(ScopeType.FUNCTION, asNode(functionNode))
			context.markUnreachable(UnreachableReason.AFTER_RETURN)
			context.addUnreachableNode(asNode(returnNode), UnreachableReason.AFTER_RETURN)
			context.addBranchContext({
				...branch,
				parentNode: asNode(branch.parentNode as MockNode),
			})

			expect(context.scopeStack.length).toBe(1)
			expect(context.unreachableNodes.length).toBe(1)
			expect(context.branchContexts.length).toBe(1)

			context.reset()

			expect(context.scopeStack.length).toBe(0)
			expect(context.unreachableNodes.length).toBe(0)
			expect(context.branchContexts.length).toBe(0)
			expect(context.currentScope).toBeNull()
		})
	})

	describe("Handler Management", () => {
		it("should register and unregister handlers", () => {
			const customHandler = new ReturnHandler()

			context.registerHandler(customHandler)

			// Should not throw when processing a return statement
			const returnNode = new MockNode("return_statement", "return 42", 5)
			expect(() => context.processNode(asNode(returnNode))).not.toThrow()

			context.unregisterHandler("return_statement")

			// Should not process the node after unregistering
			const initialReachability = context.getCurrentReachability()
			context.processNode(asNode(returnNode))
			expect(context.getCurrentReachability()).toBe(initialReachability)
		})
	})
})
