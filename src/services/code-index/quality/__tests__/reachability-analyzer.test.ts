import { ReachabilityAnalyzer } from "../reachability-analyzer"
import { ReachabilityContext } from "../reachability-context"
import { ScopeType, UnreachableReason } from "../interfaces/reachability"

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
function asNode(mockNode: MockNode): any {
	return mockNode as unknown as any
}

describe("ReachabilityAnalyzer", () => {
	let analyzer: ReachabilityAnalyzer

	beforeEach(() => {
		analyzer = new ReachabilityAnalyzer({
			maxAnalysisDepth: 100,
			enableDebugging: false,
			maxAnalysisTime: 1000,
		})
	})

	describe("Context Creation", () => {
		it("should create a ReachabilityContext with default handlers", () => {
			const context = analyzer.createContext()

			expect(context).toBeInstanceOf(ReachabilityContext)
			expect(context.scopeStack).toEqual([])
			expect(context.unreachableNodes).toEqual([])
		})
	})

	describe("Basic Analysis", () => {
		it("should analyze simple function with return", () => {
			const functionNode = new MockNode("function_declaration")
			const returnNode = new MockNode("return_statement", "return 42", 5)
			const unreachableNode = new MockNode("expression_statement", "console.log('unreachable')", 6)

			functionNode.children = [returnNode, unreachableNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			expect(context.unreachableNodes.length).toBeGreaterThan(0)
			expect(context.unreachableNodes[0].reason).toBe(UnreachableReason.AFTER_RETURN)
		})

		it("should analyze nested scopes correctly", () => {
			const functionNode = new MockNode("function_declaration")
			const loopNode = new MockNode("for_statement")
			const breakNode = new MockNode("break_statement", "break", 10)
			const unreachableNode = new MockNode("expression_statement", "console.log('unreachable')", 11)

			functionNode.children = [loopNode]
			loopNode.children = [breakNode, unreachableNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			expect(context.unreachableNodes.length).toBeGreaterThan(0)
			expect(context.unreachableNodes[0].reason).toBe(UnreachableReason.AFTER_BREAK)
		})

		it("should handle empty AST gracefully", () => {
			const emptyNode = new MockNode("program")

			const context = analyzer.createContext()
			analyzer.analyze(asNode(emptyNode), context, "javascript")

			expect(context.unreachableNodes.length).toBe(0)
			expect(context.scopeStack.length).toBe(0)
		})
	})

	describe("Scope Management", () => {
		it("should enter and exit function scopes", () => {
			const functionNode = new MockNode("function_declaration")
			const statementNode = new MockNode("expression_statement", "console.log('test')", 3)

			functionNode.children = [statementNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			// Should have entered and exited the function scope
			expect(context.scopeStack.length).toBe(0)
		})

		it("should handle multiple nested scopes", () => {
			const functionNode = new MockNode("function_declaration")
			const ifNode = new MockNode("if_statement")
			const loopNode = new MockNode("for_statement")
			const statementNode = new MockNode("expression_statement", "console.log('test')", 5)

			functionNode.children = [ifNode]
			ifNode.children = [loopNode]
			loopNode.children = [statementNode]

			const context = analyzer.createContext()
			analyzer.analyze(asNode(functionNode), context, "javascript")

			// Should have entered and exited all scopes
			expect(context.scopeStack.length).toBe(0)
		})
	})

	describe("Analysis Limits", () => {
		it("should respect max analysis depth", () => {
			const deepNode = new MockNode("function_declaration")
			let currentNode = deepNode

			// Create a deep nesting structure
			for (let i = 0; i < 150; i++) {
				const childNode = new MockNode("block")
				currentNode.children = [childNode]
				currentNode = childNode
			}

			const context = analyzer.createContext()
			analyzer.analyze(asNode(deepNode), context, "javascript")

			// Should have stopped at max depth
			expect(context.scopeStack.length).toBe(0)
		})

		it("should handle analysis time limit", () => {
			const slowAnalyzer = new ReachabilityAnalyzer({
				maxAnalysisTime: 1, // 1ms
			})

			const functionNode = new MockNode("function_declaration")
			const context = slowAnalyzer.createContext()

			// Should not throw even with very low time limit
			expect(() => {
				slowAnalyzer.analyze(asNode(functionNode), context, "javascript")
			}).not.toThrow()
		})
	})

	describe("Configuration", () => {
		it("should use custom configuration", () => {
			const customAnalyzer = new ReachabilityAnalyzer({
				maxAnalysisDepth: 50,
				enableDebugging: true,
				maxAnalysisTime: 5000,
			})

			expect(customAnalyzer).toBeInstanceOf(ReachabilityAnalyzer)

			const context = customAnalyzer.createContext()
			expect(context).toBeInstanceOf(ReachabilityContext)
		})
	})

	describe("Analysis Stats", () => {
		it("should return null when no analysis is active", () => {
			const stats = analyzer.getAnalysisStats()
			expect(stats).toBeNull()
		})

		it("should return analysis statistics during analysis", () => {
			const functionNode = new MockNode("function_declaration")
			const context = analyzer.createContext()

			// Start analysis
			analyzer.analyze(asNode(functionNode), context, "javascript")

			// Stats should be available after analysis
			const stats = analyzer.getAnalysisStats()
			expect(stats).not.toBeNull()
			expect(stats!.depth).toBe(0)
			expect(stats!.time).toBeGreaterThanOrEqual(0)
			expect(stats!.unreachableNodes).toBe(0)
		})
	})
})
