import { ReachabilityAnalyzer } from "../reachability-analyzer"
import { ReachabilityContext } from "../reachability-context"
import { ScopeType, UnreachableReason } from "../interfaces/reachability"

// Mock Node class for testing
class MockNode {
	public type: string
	public name: string
	public startPosition: { row: number; column: number }
	public endPosition: { row: number; column: number }
	public text: string
	public children: MockNode[] = []

	constructor(type: string, text: string = "", startLine: number = 0, name: string = "") {
		this.type = type
		this.name = name
		this.text = text
		this.startPosition = { row: startLine, column: 0 }
		this.endPosition = { row: startLine, column: text.length }
	}

	childForFieldName(fieldName: string): MockNode | null {
		// Find the child matching the requested fieldName
		return this.children.find((child) => child.name === fieldName) || null
	}
}

// Helper function to cast MockNode to Node for testing
function asNode(mockNode: MockNode): any {
	return mockNode as unknown as any
}

describe("Reachability System Integration", () => {
	let analyzer: ReachabilityAnalyzer

	beforeEach(() => {
		analyzer = new ReachabilityAnalyzer({
			maxAnalysisDepth: 1000,
			enableDebugging: false,
			maxAnalysisTime: 10000,
		})
	})

	describe("Complete Workflow", () => {
		it("should analyze function with unreachable code after return", () => {
			// Create a simple function structure:
			// function test() {
			//   return 42;
			//   console.log("unreachable"); // This should be detected
			// }
			const functionNode = new MockNode("function_declaration")
			const returnNode = new MockNode("return_statement", "return 42", 2)
			const unreachableNode = new MockNode("expression_statement", 'console.log("unreachable")', 3)

			functionNode.children = [returnNode, unreachableNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			expect(context.unreachableNodes.length).toBe(1)
			expect(context.unreachableNodes[0].reason).toBe(UnreachableReason.AFTER_RETURN)
			expect(context.unreachableNodes[0].line).toBe(3)
			expect(context.unreachableNodes[0].snippet).toBe('console.log("unreachable")')
		})

		it("should analyze loop with unreachable code after break", () => {
			// Create a loop structure:
			// for (let i = 0; i < 10; i++) {
			//   if (i === 5) break;
			//   console.log(i); // This should be unreachable after break
			// }
			const loopNode = new MockNode("for_statement")
			const ifNode = new MockNode("if_statement")
			const breakNode = new MockNode("break_statement", "break", 3)
			const unreachableNode = new MockNode("expression_statement", "console.log(i)", 4)

			loopNode.children = [ifNode, unreachableNode]
			ifNode.children = [breakNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(loopNode), context, "javascript")

			expect(context.unreachableNodes.length).toBe(1)
			expect(context.unreachableNodes[0].reason).toBe(UnreachableReason.AFTER_BREAK)
			expect(context.unreachableNodes[0].line).toBe(4)
		})

		it("should analyze nested scopes correctly", () => {
			// Create nested function and loop:
			// function outer() {
			//   for (let i = 0; i < 10; i++) {
			//     if (i === 5) return;
			//     console.log(i);
			//   }
			//   console.log("after loop"); // This should be reachable
			// }
			const functionNode = new MockNode("function_declaration")
			const loopNode = new MockNode("for_statement")
			const ifNode = new MockNode("if_statement")
			const returnNode = new MockNode("return_statement", "return", 3)
			const reachableNode = new MockNode("expression_statement", "console.log(i)", 4)
			const afterLoopNode = new MockNode("expression_statement", 'console.log("after loop")', 6)

			functionNode.children = [loopNode, afterLoopNode]
			loopNode.children = [ifNode, reachableNode]
			ifNode.children = [returnNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			// The unreachable code should be inside the loop after the return
			const unreachableInLoop = context.unreachableNodes.find((n) => n.line === 4)
			expect(unreachableInLoop).toBeDefined()
			expect(unreachableInLoop!.reason).toBe(UnreachableReason.AFTER_RETURN)

			// Code after the loop should still be reachable
			const unreachableAfterLoop = context.unreachableNodes.find((n) => n.line === 6)
			expect(unreachableAfterLoop).toBeUndefined()
		})

		it("should handle complex control flow", () => {
			// Create a complex structure with multiple control flows:
			// function complex() {
			//   if (condition) {
			//     return 1;
			//   } else {
			//     for (let i = 0; i < 5; i++) {
			//       if (i === 2) break;
			//       console.log(i);
			//     }
			//   }
			//   console.log("end"); // This should be reachable
			// }
			const functionNode = new MockNode("function_declaration")
			const ifNode = new MockNode("if_statement")
			const returnNode = new MockNode("return_statement", "return 1", 2)
			const elseNode = new MockNode("else_clause")
			const loopNode = new MockNode("for_statement")
			const innerIfNode = new MockNode("if_statement")
			const breakNode = new MockNode("break_statement", "break", 5)
			const unreachableNode = new MockNode("expression_statement", "console.log(i)", 6)
			const endNode = new MockNode("expression_statement", 'console.log("end")', 8)

			functionNode.children = [ifNode, endNode]
			ifNode.children = [returnNode, elseNode]
			elseNode.children = [loopNode]
			loopNode.children = [innerIfNode, unreachableNode]
			innerIfNode.children = [breakNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			// Should detect unreachable code in loop after break
			const unreachableInLoop = context.unreachableNodes.find((n) => n.line === 6)
			expect(unreachableInLoop).toBeDefined()
			expect(unreachableInLoop!.reason).toBe(UnreachableReason.AFTER_BREAK)

			// End statement should be reachable (both branches can complete)
			const unreachableEnd = context.unreachableNodes.find((n) => n.line === 8)
			expect(unreachableEnd).toBeUndefined()
		})
	})

	describe("Error Handling", () => {
		it("should handle malformed AST gracefully", () => {
			const malformedNode = new MockNode("unknown_type")

			const context = analyzer.createContext()

			// Should not throw
			expect(() => {
				analyzer.analyze(asNode(malformedNode), context, "javascript")
			}).not.toThrow()

			// Should complete analysis
			expect(context.scopeStack.length).toBe(0)
		})

		it("should handle null/undefined nodes", () => {
			const context = analyzer.createContext()

			// Should not throw with null nodes
			expect(() => {
				analyzer.analyze(null as any, context, "javascript")
			}).not.toThrow()
		})
	})

	describe("Performance", () => {
		it("should handle large AST efficiently", () => {
			const largeFunction = new MockNode("function_declaration")
			let currentNode = largeFunction

			// Create a moderately deep structure
			for (let i = 0; i < 50; i++) {
				const childNode = new MockNode("block", `// Block ${i}`, i)
				currentNode.children = [childNode]
				currentNode = childNode
			}

			const startTime = Date.now()
			const context = analyzer.createContext()
			analyzer.analyze(asNode(largeFunction), context, "javascript")
			const endTime = Date.now()

			// Should complete in reasonable time (less than 100ms for this test)
			expect(endTime - startTime).toBeLessThan(100)
			expect(context.scopeStack.length).toBe(0)
		})
	})
})
