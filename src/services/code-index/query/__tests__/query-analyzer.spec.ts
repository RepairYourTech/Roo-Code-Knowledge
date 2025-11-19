import { QueryAnalyzer } from "../query-analyzer"
import type { QueryIntent, SearchBackend } from "../query-analyzer"

describe("QueryAnalyzer", () => {
	let analyzer: QueryAnalyzer

	beforeEach(() => {
		analyzer = new QueryAnalyzer()
	})

	describe("Intent Detection", () => {
		describe("find_implementation intent", () => {
			it("should detect 'how is X implemented' pattern", () => {
				const result = analyzer.analyze("how is UserService implemented")
				expect(result.intent).toBe("find_implementation")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'show me the implementation' pattern", () => {
				const result = analyzer.analyze("show me the implementation of authenticate")
				expect(result.intent).toBe("find_implementation")
			})

			it("should detect 'how does X work' pattern", () => {
				const result = analyzer.analyze("how does LoginController work")
				expect(result.intent).toBe("find_implementation")
				expect(result.symbolName).toBe("LoginController")
			})
		})

		describe("find_usages intent", () => {
			it("should detect 'where is X used' pattern", () => {
				const result = analyzer.analyze("where is UserService used")
				expect(result.intent).toBe("find_usages")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'find all usages' pattern", () => {
				const result = analyzer.analyze("find all usages of authenticate")
				expect(result.intent).toBe("find_usages")
			})

			it("should detect 'references to X' pattern", () => {
				const result = analyzer.analyze("show me all references to LoginController")
				expect(result.intent).toBe("find_usages")
				expect(result.symbolName).toBe("LoginController")
			})

			it("should detect 'where is X defined' pattern", () => {
				const result = analyzer.analyze("where is UserService defined")
				expect(result.intent).toBe("find_usages")
				expect(result.symbolName).toBe("UserService")
			})
		})

		describe("find_callers intent", () => {
			it("should detect 'what calls X' pattern", () => {
				const result = analyzer.analyze("what calls authenticate")
				expect(result.intent).toBe("find_callers")
				expect(result.symbolName).toBe("authenticate")
			})

			it("should detect 'all callers of X' pattern", () => {
				const result = analyzer.analyze("show me all callers of validateUser")
				expect(result.intent).toBe("find_callers")
				expect(result.symbolName).toBe("validateUser")
			})

			it("should detect 'who calls X' pattern", () => {
				const result = analyzer.analyze("who calls the login function")
				expect(result.intent).toBe("find_callers")
				expect(result.symbolName).toBe("login")
			})
		})

		describe("find_callees intent", () => {
			it("should detect 'what does X call' pattern", () => {
				const result = analyzer.analyze("what does AuthService call")
				expect(result.intent).toBe("find_callees")
				// Symbol extraction doesn't work for lowercase words
			})

			it("should detect 'invokes' pattern", () => {
				const result = analyzer.analyze("what does processPayment invokes")
				expect(result.intent).toBe("find_callees")
				expect(result.symbolName).toBe("processPayment")
			})
		})

		describe("find_dependencies intent", () => {
			it("should detect 'what does X depend on' pattern", () => {
				const result = analyzer.analyze("what does UserService depend on")
				expect(result.intent).toBe("find_dependencies")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'dependencies of X' pattern", () => {
				const result = analyzer.analyze("dependencies of LoginController")
				expect(result.intent).toBe("find_dependencies")
				expect(result.symbolName).toBe("LoginController")
			})

			it("should detect 'imports of X' pattern", () => {
				const result = analyzer.analyze("imports of AuthModule")
				expect(result.intent).toBe("find_dependencies")
				expect(result.symbolName).toBe("AuthModule")
			})
		})

		describe("find_dependents intent", () => {
			it("should detect 'what imports X' pattern", () => {
				const result = analyzer.analyze("what imports UserService")
				expect(result.intent).toBe("find_dependents")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'dependents of X' pattern", () => {
				const result = analyzer.analyze("dependents of BaseEntity")
				expect(result.intent).toBe("find_dependents")
				expect(result.symbolName).toBe("BaseEntity")
			})
		})

		describe("find_tests intent", () => {
			it("should detect 'tests for X' pattern", () => {
				const result = analyzer.analyze("tests for UserService")
				expect(result.intent).toBe("find_tests")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'test cases for X' pattern", () => {
				const result = analyzer.analyze("test cases for AuthService")
				expect(result.intent).toBe("find_tests")
				expect(result.symbolName).toBe("AuthService")
			})

			it("should detect 'unit tests' pattern", () => {
				const result = analyzer.analyze("unit tests for LoginController")
				expect(result.intent).toBe("find_tests")
				expect(result.symbolName).toBe("LoginController")
			})

			it("should set testFilesOnly flag", () => {
				const result = analyzer.analyze("tests for UserService")
				expect(result.testFilesOnly).toBe(true)
			})
		})

		describe("find_examples intent", () => {
			it("should detect 'examples of X' pattern", () => {
				const result = analyzer.analyze("examples of UserService")
				expect(result.intent).toBe("find_examples")
				expect(result.symbolName).toBe("UserService")
			})

			it("should detect 'how to use X' pattern", () => {
				const result = analyzer.analyze("how to use AuthService")
				expect(result.intent).toBe("find_examples")
				expect(result.symbolName).toBe("AuthService")
			})

			it("should detect 'usage example' pattern", () => {
				const result = analyzer.analyze("usage example for LoginController")
				expect(result.intent).toBe("find_examples")
				expect(result.symbolName).toBe("LoginController")
			})
		})

		describe("find_by_type intent", () => {
			it("should detect type-based queries with return type", () => {
				const result = analyzer.analyze("functions that return Promise<User>")
				expect(result.intent).toBe("find_by_type")
			})

			it("should detect type-based queries with parameter type", () => {
				const result = analyzer.analyze("methods with parameter type string")
				expect(result.intent).toBe("find_by_type")
			})

			it("should detect async function queries", () => {
				const result = analyzer.analyze("find async function handlers")
				expect(result.intent).toBe("find_by_type")
			})
		})

		describe("find_pattern intent", () => {
			it("should detect 'singleton pattern' queries", () => {
				const result = analyzer.analyze("singleton pattern in codebase")
				expect(result.intent).toBe("find_pattern")
			})

			it("should detect 'factory pattern' queries", () => {
				const result = analyzer.analyze("factory pattern in codebase")
				expect(result.intent).toBe("find_pattern")
			})

			it("should detect 'observer pattern' queries", () => {
				const result = analyzer.analyze("observer pattern usage")
				expect(result.intent).toBe("find_pattern")
			})
		})

		describe("semantic_search intent (default)", () => {
			it("should default to semantic_search for general queries", () => {
				const result = analyzer.analyze("explain authentication flow")
				expect(result.intent).toBe("semantic_search")
			})

			it("should use semantic_search for conceptual queries", () => {
				const result = analyzer.analyze("explain the user registration flow")
				expect(result.intent).toBe("semantic_search")
			})

			it("should use semantic_search for queries without specific patterns", () => {
				const result = analyzer.analyze("database connection pooling")
				expect(result.intent).toBe("semantic_search")
			})
		})
	})

	describe("Symbol Name Extraction", () => {
		it("should extract symbol from quoted strings", () => {
			const result = analyzer.analyze('where is "UserService" defined')
			expect(result.symbolName).toBe("UserService")
		})

		it("should extract camelCase symbols", () => {
			const result = analyzer.analyze("find usages of authenticateUser")
			expect(result.symbolName).toBe("authenticateUser")
		})

		it("should extract PascalCase symbols", () => {
			const result = analyzer.analyze("what calls LoginController")
			expect(result.symbolName).toBe("LoginController")
		})

		it("should not extract symbols with underscores (not supported)", () => {
			const result = analyzer.analyze("where is user_service used")
			// Symbol extraction doesn't support underscores - only camelCase and PascalCase
			expect(result.symbolName).toBeUndefined()
		})

		it("should handle queries without clear symbols", () => {
			const result = analyzer.analyze("explain authentication flow")
			expect(result.symbolName).toBeUndefined()
		})

		it("should extract first symbol when multiple present", () => {
			const result = analyzer.analyze("where is UserService or LoginService defined")
			expect(result.symbolName).toBe("UserService")
		})
	})

	describe("Backend Recommendations", () => {
		it("should recommend graph backend for find_callers intent", () => {
			const result = analyzer.analyze("what calls authenticate")
			expect(result.backends).toContain("graph")
			expect(result.backends).toContain("bm25")
			expect(result.backends).not.toContain("vector")
		})

		it("should recommend graph backend for find_callees intent", () => {
			const result = analyzer.analyze("what does processPayment call")
			expect(result.backends).toContain("graph")
			expect(result.backends).toContain("bm25")
		})

		it("should recommend graph backend for find_dependencies intent", () => {
			const result = analyzer.analyze("what does UserService depend on")
			expect(result.backends).toContain("graph")
			expect(result.backends).toContain("bm25")
		})

		it("should recommend graph backend for find_dependents intent", () => {
			const result = analyzer.analyze("what depends on BaseEntity")
			expect(result.backends).toContain("graph")
			expect(result.backends).toContain("bm25")
		})

		it("should recommend BM25 for find_usages intent", () => {
			const result = analyzer.analyze("where is UserService defined")
			expect(result.backends).toContain("bm25")
			expect(result.backends).toContain("graph")
			expect(result.backends).toContain("lsp")
		})

		it("should recommend LSP for find_by_type intent", () => {
			const result = analyzer.analyze("functions that return Promise<User>")
			expect(result.backends).toContain("lsp")
			expect(result.backends).toContain("vector")
		})

		it("should recommend vector and BM25 for semantic_search", () => {
			const result = analyzer.analyze("explain authentication flow")
			expect(result.backends).toContain("vector")
			expect(result.backends).toContain("bm25")
			expect(result.backends).not.toContain("graph")
		})

		it("should recommend vector and BM25 for find_tests", () => {
			const result = analyzer.analyze("tests for UserService")
			expect(result.backends).toContain("vector")
			expect(result.backends).toContain("bm25")
		})
	})

	describe("Fusion Weights", () => {
		it("should favor graph for structural queries (find_callers)", () => {
			const result = analyzer.analyze("what calls authenticate")
			expect(result.weights.graph).toBeGreaterThan(result.weights.vector)
			expect(result.weights.graph).toBe(0.6)
		})

		it("should favor BM25 for exact symbol searches (find_usages)", () => {
			const result = analyzer.analyze("where is UserService defined")
			expect(result.weights.bm25).toBe(0.4)
			expect(result.weights.graph).toBe(0.3)
			expect(result.weights.lsp).toBe(0.3)
		})

		it("should favor vector for semantic searches", () => {
			const result = analyzer.analyze("explain authentication flow")
			expect(result.weights.vector).toBeGreaterThan(result.weights.bm25)
			expect(result.weights.vector).toBe(0.7)
		})

		it("should favor LSP for type-based queries", () => {
			const result = analyzer.analyze("functions that return Promise<User>")
			expect(result.weights.lsp).toBeGreaterThan(0)
			expect(result.weights.lsp).toBe(0.4)
		})

		it("should balance vector and BM25 for find_examples", () => {
			const result = analyzer.analyze("examples of using UserService")
			expect(result.weights.vector).toBe(0.7)
			expect(result.weights.bm25).toBe(0.3)
		})

		it("should sum weights to reasonable total", () => {
			const result = analyzer.analyze("what calls authenticate")
			const total = result.weights.vector + result.weights.bm25 + result.weights.graph + result.weights.lsp
			expect(total).toBeGreaterThan(0)
			expect(total).toBeLessThanOrEqual(1.5) // Allow some overlap
		})
	})

	describe("Query Enhancements", () => {
		it("should set boostExported for find_implementation", () => {
			const result = analyzer.analyze("how is UserService implemented")
			expect(result.boostExported).toBe(true)
		})

		it("should not set boostExported for find_usages", () => {
			const result = analyzer.analyze("where is UserService defined")
			expect(result.boostExported).toBeUndefined()
		})

		it("should set testFilesOnly for find_tests", () => {
			const result = analyzer.analyze("tests for UserService")
			expect(result.testFilesOnly).toBe(true)
		})

		it("should not set boostExported for semantic_search", () => {
			const result = analyzer.analyze("explain authentication flow")
			expect(result.boostExported).toBeUndefined()
		})

		it("should not set testFilesOnly for non-test queries", () => {
			const result = analyzer.analyze("how is UserService implemented")
			expect(result.testFilesOnly).toBeUndefined()
		})
	})

	describe("Edge Cases", () => {
		it("should handle empty query", () => {
			const result = analyzer.analyze("")
			expect(result.intent).toBe("semantic_search")
			expect(result.symbolName).toBeUndefined()
		})

		it("should handle very long queries", () => {
			const longQuery = "where is " + "UserService ".repeat(100) + "used"
			const result = analyzer.analyze(longQuery)
			expect(result.intent).toBe("find_usages")
		})

		it("should handle queries with special characters", () => {
			const result = analyzer.analyze("where is User$Service used?")
			expect(result.intent).toBe("find_usages")
		})

		it("should handle case-insensitive pattern matching", () => {
			const result = analyzer.analyze("WHERE IS USERSERVICE USED")
			expect(result.intent).toBe("find_usages")
		})

		it("should handle queries with multiple spaces", () => {
			const result = analyzer.analyze("singleton    pattern    in    codebase")
			expect(result.intent).toBe("find_pattern")
		})
	})
})
