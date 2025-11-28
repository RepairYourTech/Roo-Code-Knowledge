import { describe, it, expect, beforeEach, vi } from "vitest"
import { GraphIndexer } from "../graph-indexer"
import { CodeBlock } from "../../interfaces/file-processor"
import { INeo4jService, CodeNode, CodeRelationship } from "../../interfaces/neo4j-service"
import { MetricsCollector } from "../../utils/metrics-collector"

// Mock Neo4j service
const mockNeo4jService: INeo4jService = {
	// Core service methods
	initialize: vi.fn(),
	isConnected: vi.fn().mockReturnValue(true),
	getMetrics: vi.fn(),
	getConnectionPoolMetrics: vi.fn(),
	getOperationMetrics: vi.fn(),
	getIndexStats: vi.fn(),
	explainQuery: vi.fn(),
	performIndexMaintenance: vi.fn(),
	validateNode: vi.fn(),
	validateRelationship: vi.fn(),
	getValidationMetrics: vi.fn(),
	beginTransaction: vi.fn(),
	executeInTransaction: vi.fn(),
	upsertNode: vi.fn(),
	upsertNodes: vi.fn(),
	upsertNodesInTransaction: vi.fn(),
	createRelationship: vi.fn(),
	createRelationships: vi.fn(),
	createRelationshipsInTransaction: vi.fn(),
	deleteNode: vi.fn(),
	deleteNodesByFilePath: vi.fn(),
	deleteNodesByFilePathInTransaction: vi.fn(),
	deleteNodesByMultipleFilePaths: vi.fn(),
	findCallers: vi.fn(),
	findCallees: vi.fn(),
	findDependencies: vi.fn(),
	findDependents: vi.fn(),
	findImplementations: vi.fn(),
	findSubclasses: vi.fn(),
	executeQuery: vi.fn(),
	clearAll: vi.fn(),
	close: vi.fn(),
	getStats: vi.fn(),
	findImpactedNodes: vi.fn(),
	findDependencyTree: vi.fn(),
	calculateBlastRadius: vi.fn(),
	assessChangeSafety: vi.fn(),
}

describe("GraphIndexer - Fallback Chunk Indexing", () => {
	let graphIndexer: GraphIndexer

	beforeEach(() => {
		vi.clearAllMocks()
		graphIndexer = new GraphIndexer(mockNeo4jService)
	})

	describe("Node Type Mapping", () => {
		it("should map fallback_chunk to function node type", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "CalculateSum",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 20,
				content:
					"Public Function CalculateSum(a As Integer, b As Integer) As Integer\n    Return a + b\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].type).toBe("function")
			expect(nodes[0].name).toBe("CalculateSum")
			expect(nodes[0].filePath).toBe("/src/Calculator.vb")
			expect(nodes[0].startLine).toBe(10)
			expect(nodes[0].endLine).toBe(20)
		})

		it("should map emergency_fallback to function node type", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/ScalaExample.scala",
				identifier: "processData",
				type: "emergency_fallback",
				start_line: 15,
				end_line: 25,
				content: "def processData(input: String): String = {\n  input.toUpperCase\n}",
				fileHash: "hash2",
				segmentHash: "segment2",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].type).toBe("function")
			expect(nodes[0].name).toBe("processData")
			expect(nodes[0].filePath).toBe("/src/ScalaExample.scala")
		})

		it("should map emergency_fallback_full_file to function node type", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/FullFileExample.cs",
				identifier: null,
				type: "emergency_fallback_full_file",
				start_line: 1,
				end_line: 100,
				content:
					'using System;\n\nnamespace MyApp {\n  class Program {\n    static void Main() {\n      Console.WriteLine("Hello World");\n    }\n  }\n}',
				fileHash: "hash3",
				segmentHash: "segment3",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].type).toBe("function")
		})
	})

	describe("Synthetic Identifier Generation", () => {
		it("should generate synthetic identifiers for fallback chunks without names", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: null,
				type: "fallback_chunk",
				start_line: 10,
				end_line: 20,
				content:
					"Public Function CalculateSum(a As Integer, b As Integer) As Integer\n    Return a + b\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("fallback_chunk_Calculator.vb_L10-20")
			expect(nodes[0].type).toBe("function")
		})

		it("should generate synthetic identifiers for emergency fallback without names", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/ScalaExample.scala",
				identifier: null,
				type: "emergency_fallback",
				start_line: 5,
				end_line: 15,
				content: "def processData(input: String): String = {\n  input.toUpperCase\n}",
				fileHash: "hash2",
				segmentHash: "segment2",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("emergency_fallback_ScalaExample.scala_L5-15")
			expect(nodes[0].type).toBe("function")
		})

		it("should generate synthetic identifiers for emergency_fallback_full_file", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/FullFileExample.cs",
				identifier: null,
				type: "emergency_fallback_full_file",
				start_line: 1,
				end_line: 100,
				content:
					'using System;\n\nnamespace MyApp {\n  class Program {\n    static void Main() {\n      Console.WriteLine("Hello World");\n    }\n  }\n}',
				fileHash: "hash3",
				segmentHash: "segment3",
			}

			// Act
			const nodes = graphIndexer.extractNodes(block)

			// Assert
			expect(nodes).toHaveLength(1)
			expect(nodes[0].name).toBe("emergency_fallback_full_file_FullFileExample.cs_L1-100")
			expect(nodes[0].type).toBe("function")
		})
	})

	describe("Relationship Extraction", () => {
		it("should extract IMPORTS relationships from fallback chunks", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "CalculateSum",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 20,
				content:
					"Imports System.Math\nPublic Function CalculateSum(a As Integer, b As Integer) As Integer\n    Return a + b\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
				imports: [
					{
						source: "System.Math",
						symbols: ["Math"],
						isDefault: false,
						isDynamic: false,
					},
				],
			}

			// Act
			const relationships = graphIndexer.extractRelationships(block, [block])

			// Assert
			expect(relationships).toHaveLength(1)
			expect(relationships[0].type).toBe("IMPORTS")
			expect(relationships[0].toId).toBe("import:/src/Calculator.vb:System.Math")
			expect((relationships[0].metadata as any).source).toBe("System.Math")
		})

		it("should extract CALLS relationships from fallback chunks", () => {
			// Arrange
			const block: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "CalculateSum",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 20,
				content:
					"Public Function CalculateSum(a As Integer, b As Integer) As Integer\n    Return Math.Max(a, b)\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
				calls: [
					{
						calleeName: "Max",
						callType: "static_method",
						line: 12,
						column: 10,
						qualifier: "Math",
					},
				],
			}

			const targetBlock: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Max",
				type: "function",
				start_line: 30,
				end_line: 35,
				content:
					"Public Function Max(a As Integer, b As Integer) As Integer\n    If a > b Then Return a Else Return b\nEnd Function",
				fileHash: "hash4",
				segmentHash: "segment4",
			}

			// Act
			const relationships = graphIndexer.extractRelationships(block, [block, targetBlock])

			// Assert
			expect(relationships).toHaveLength(2) // CALLS and CALLED_BY
			const callsRelationship = relationships.find((r) => r.type === "CALLS")
			expect(callsRelationship).toBeDefined()
			// Verify the toId is in the expected format
			expect(callsRelationship?.toId).toMatch(/^node:.*:Calculator\.vb:\d+:\d+$/)
			expect((callsRelationship?.metadata as any).callType).toBe("static_method")
		})

		it("should extract DEFINES relationships for nested blocks in fallback chunks", () => {
			// Arrange
			const parentBlock: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "CalculatorClass",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 50,
				content:
					"Public Class Calculator\n    Public Function Add(a As Integer, b As Integer) As Integer\n        Return a + b\n    End Function\n    \n    Public Function Subtract(a As Integer, b As Integer) As Integer\n        Return a - b\n    End Function\nEnd Class",
				fileHash: "hash1",
				segmentHash: "segment1",
			}

			const nestedBlock1: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Add",
				type: "function",
				start_line: 12,
				end_line: 15,
				content: "Public Function Add(a As Integer, b As Integer) As Integer\n    Return a + b\nEnd Function",
				fileHash: "hash2",
				segmentHash: "segment2",
			}

			const nestedBlock2: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Subtract",
				type: "function",
				start_line: 17,
				end_line: 20,
				content:
					"Public Function Subtract(a As Integer, b As Integer) As Integer\n    Return a - b\nEnd Function",
				fileHash: "hash3",
				segmentHash: "segment3",
			}

			// Act
			const relationships = graphIndexer.extractRelationships(parentBlock, [
				parentBlock,
				nestedBlock1,
				nestedBlock2,
			])

			// Assert
			const definesRelationships = relationships.filter((r) => r.type === "DEFINES")
			expect(definesRelationships).toHaveLength(2)
			// Verify the fromId and toId are in the expected format
			expect(definesRelationships[0].fromId).toMatch(/^node:.*:Calculator\.vb:\d+:\d+$/)
			expect(definesRelationships[0].toId).toMatch(/^node:.*:Calculator\.vb:\d+:\d+$/)
			expect(definesRelationships[1].fromId).toMatch(/^node:.*:Calculator\.vb:\d+:\d+$/)
			expect(definesRelationships[1].toId).toMatch(/^node:.*:Calculator\.vb:\d+:\d+$/)
		})
	})

	describe("Indexing Integration", () => {
		it("should index fallback chunks to Neo4j via indexBlocks()", async () => {
			// Arrange
			const fallbackChunk: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "CalculateSum",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 20,
				content:
					"Public Function CalculateSum(a As Integer, b As Integer) As Integer\n    Return a + b\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
				imports: [
					{
						source: "System.Math",
						symbols: ["Math"],
						isDefault: false,
						isDynamic: false,
					},
				],
				calls: [
					{
						calleeName: "Max",
						callType: "static_method",
						line: 12,
						column: 10,
						qualifier: "Math",
					},
				],
			}

			const emergencyFallback: CodeBlock = {
				file_path: "/src/ScalaExample.scala",
				identifier: null,
				type: "emergency_fallback",
				start_line: 5,
				end_line: 15,
				content: "def processData(input: String): String = {\n  input.toUpperCase\n}",
				fileHash: "hash2",
				segmentHash: "segment2",
			}

			const blocks = [fallbackChunk, emergencyFallback]

			// Act
			await graphIndexer.indexBlocks(blocks)

			// Assert
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalledTimes(1)
			expect(mockNeo4jService.createRelationships).toHaveBeenCalledTimes(1)

			// Verify nodes
			const upsertedNodes = (mockNeo4jService.upsertNodes as any).mock.calls[0][0] as CodeNode[]
			expect(upsertedNodes).toHaveLength(2)

			// Check fallback chunk node
			const fallbackNode = upsertedNodes.find((n) => n.name === "CalculateSum")
			expect(fallbackNode).toBeDefined()
			expect(fallbackNode?.type).toBe("function")
			expect(fallbackNode?.filePath).toBe("/src/Calculator.vb")

			// Check emergency fallback node
			const emergencyNode = upsertedNodes.find((n) => n.name === "emergency_fallback_ScalaExample.scala_L5-15")
			expect(emergencyNode).toBeDefined()
			expect(emergencyNode?.type).toBe("function")

			// Verify relationships
			const createdRelationships = (mockNeo4jService.createRelationships as any).mock
				.calls[0][0] as CodeRelationship[]

			// At minimum, an IMPORTS relationship is expected
			// CALLS and CALLED_BY relationships are present only when the call target is resolvable
			const importsRelationships = createdRelationships.filter((r) => r.type === "IMPORTS")
			expect(importsRelationships.length).toBeGreaterThanOrEqual(1)

			const importsRelationship = importsRelationships.find(
				(r) => r.toId === "import:/src/Calculator.vb:System.Math",
			)
			expect(importsRelationship).toBeDefined()

			// Check for optional CALLS relationship - it may not be created if the target is not resolvable
			const callsRelationship = createdRelationships.find((r) => r.type === "CALLS")
			if (callsRelationship) {
				// If present, verify it has the expected shape
				expect(callsRelationship.fromId).toBeDefined()
				expect(callsRelationship.toId).toBeDefined()
			}
		})

		it("should handle mixed blocks including fallback chunks and regular blocks", async () => {
			// Arrange
			const regularFunction: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Multiply",
				type: "function",
				start_line: 30,
				end_line: 35,
				content:
					"Public Function Multiply(a As Integer, b As Integer) As Integer\n    Return a * b\nEnd Function",
				fileHash: "hash3",
				segmentHash: "segment3",
			}

			const fallbackChunk: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Divide",
				type: "fallback_chunk",
				start_line: 40,
				end_line: 45,
				content:
					"Public Function Divide(a As Integer, b As Integer) As Integer\n    Return a / b\nEnd Function",
				fileHash: "hash4",
				segmentHash: "segment4",
			}

			const blocks = [regularFunction, fallbackChunk]

			// Act
			await graphIndexer.indexBlocks(blocks)

			// Assert
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalledTimes(1)

			const upsertedNodes = (mockNeo4jService.upsertNodes as any).mock.calls[0][0] as CodeNode[]
			expect(upsertedNodes).toHaveLength(2)

			// Verify both nodes are indexed correctly
			const regularNode = upsertedNodes.find((n) => n.name === "Multiply")
			expect(regularNode).toBeDefined()
			expect(regularNode?.type).toBe("function")

			const fallbackNode = upsertedNodes.find((n) => n.name === "Divide")
			expect(fallbackNode).toBeDefined()
			expect(fallbackNode?.type).toBe("function")
		})

		it("should index Swift fallback chunks to Neo4j via indexBlocks()", async () => {
			// Arrange
			const swiftFallbackBlock: CodeBlock = {
				file_path: "/src/SwiftExample.swift",
				identifier: "calculateSum",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 15,
				content: "func calculateSum(a: Int, b: Int) -> Int {\n    return a + b\n}",
				fileHash: "swift-hash1",
				segmentHash: "swift-segment1",
				imports: [
					{
						source: "Foundation",
						symbols: ["NSObject"],
						isDefault: false,
						isDynamic: false,
					},
				],
				calls: [
					{
						calleeName: "print",
						callType: "function",
						line: 12,
						column: 5,
						qualifier: undefined,
					},
				],
			}

			// Act
			await graphIndexer.indexBlocks([swiftFallbackBlock])

			// Assert
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalledTimes(1)
			expect(mockNeo4jService.createRelationships).toHaveBeenCalledTimes(1)

			// Verify nodes
			const upsertedNodes = (mockNeo4jService.upsertNodes as any).mock.calls[0][0] as CodeNode[]
			expect(upsertedNodes).toHaveLength(1)

			// Check Swift fallback chunk node
			const swiftNode = upsertedNodes.find((n) => n.name === "calculateSum")
			expect(swiftNode).toBeDefined()
			expect(swiftNode?.type).toBe("function")
			expect(swiftNode?.filePath).toBe("/src/SwiftExample.swift")

			// Verify relationships
			const createdRelationships = (mockNeo4jService.createRelationships as any).mock
				.calls[0][0] as CodeRelationship[]

			// Check for IMPORTS relationship
			const importsRelationships = createdRelationships.filter((r) => r.type === "IMPORTS")
			expect(importsRelationships.length).toBeGreaterThanOrEqual(1)

			const importsRelationship = importsRelationships.find(
				(r) => r.toId === "import:/src/SwiftExample.swift:Foundation",
			)
			expect(importsRelationship).toBeDefined()

			// Check for optional CALLS relationship
			const callsRelationship = createdRelationships.find((r) => r.type === "CALLS")
			if (callsRelationship) {
				expect(callsRelationship.fromId).toBeDefined()
				expect(callsRelationship.toId).toBeDefined()
			}
		})

		it("should index Swift emergency fallback chunks to Neo4j via indexBlocks()", async () => {
			// Arrange
			const swiftEmergencyFallbackBlock: CodeBlock = {
				file_path: "/src/SwiftEmergencyExample.swift",
				identifier: null,
				type: "emergency_fallback",
				start_line: 5,
				end_line: 10,
				content:
					"class SwiftCalculator {\n    func add(_ a: Int, _ b: Int) -> Int {\n        return a + b\n    }\n}",
				fileHash: "swift-emergency-hash1",
				segmentHash: "swift-emergency-segment1",
			}

			// Act
			await graphIndexer.indexBlocks([swiftEmergencyFallbackBlock])

			// Assert
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalledTimes(1)
			expect(mockNeo4jService.createRelationships).toHaveBeenCalledTimes(0)

			// Verify nodes
			const upsertedNodes = (mockNeo4jService.upsertNodes as any).mock.calls[0][0] as CodeNode[]
			expect(upsertedNodes).toHaveLength(1)

			// Check Swift emergency fallback node with synthetic identifier
			const swiftNode = upsertedNodes.find(
				(n) => n.name === "emergency_fallback_SwiftEmergencyExample.swift_L5-10",
			)
			expect(swiftNode).toBeDefined()
			expect(swiftNode?.type).toBe("function")
			expect(swiftNode?.filePath).toBe("/src/SwiftEmergencyExample.swift")
		})
	})

	describe("MetricsCollector Integration", () => {
		let mockMetricsCollector: MetricsCollector
		let recordGraphIndexingMetricSpy: any

		beforeEach(() => {
			mockMetricsCollector = new MetricsCollector()
			recordGraphIndexingMetricSpy = vi.spyOn(mockMetricsCollector, "recordGraphIndexingMetric")
		})

		it("should record metrics for fallback chunks when MetricsCollector is provided", async () => {
			// Arrange
			const fallbackChunk: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "TestFunction",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 15,
				content: "Public Function TestFunction() As Integer\n    Return 42\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
			}

			const blocks = [fallbackChunk]
			graphIndexer = new GraphIndexer(mockNeo4jService, undefined, undefined, true, mockMetricsCollector)

			// Act
			await graphIndexer.indexBlocks(blocks)

			// Assert
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith("vb", "fallbackChunksIndexed", 1)
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith("vb", "fallbackNodesCreated", expect.any(Number))
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith(
				"vb",
				"fallbackRelationshipsCreated",
				expect.any(Number),
			)
		})

		it("should not record metrics when MetricsCollector is undefined", async () => {
			// Arrange
			const fallbackChunk: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "TestFunction",
				type: "fallback_chunk",
				start_line: 10,
				end_line: 15,
				content: "Public Function TestFunction() As Integer\n    Return 42\nEnd Function",
				fileHash: "hash1",
				segmentHash: "segment1",
			}

			const blocks = [fallbackChunk]
			// Create GraphIndexer without MetricsCollector
			graphIndexer = new GraphIndexer(mockNeo4jService)

			// Act
			await graphIndexer.indexBlocks(blocks)

			// Assert - should not throw and no metrics should be recorded
			expect(mockNeo4jService.upsertNodes).toHaveBeenCalled()
		})

		it("should record metrics only for fallback chunks in mixed blocks", async () => {
			// Arrange
			const regularFunction: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Multiply",
				type: "function",
				start_line: 30,
				end_line: 35,
				content:
					"Public Function Multiply(a As Integer, b As Integer) As Integer\n    Return a * b\nEnd Function",
				fileHash: "hash3",
				segmentHash: "segment3",
			}

			const fallbackChunk: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Divide",
				type: "fallback_chunk",
				start_line: 40,
				end_line: 45,
				content:
					"Public Function Divide(a As Integer, b As Integer) As Integer\n    Return a / b\nEnd Function",
				fileHash: "hash4",
				segmentHash: "segment4",
			}

			const emergencyFallback: CodeBlock = {
				file_path: "/src/Calculator.vb",
				identifier: "Subtract",
				type: "emergency_fallback",
				start_line: 50,
				end_line: 55,
				content:
					"Public Function Subtract(a As Integer, b As Integer) As Integer\n    Return a - b\nEnd Function",
				fileHash: "hash5",
				segmentHash: "segment5",
			}

			const blocks = [regularFunction, fallbackChunk, emergencyFallback]
			graphIndexer = new GraphIndexer(mockNeo4jService, undefined, undefined, true, mockMetricsCollector)

			// Act
			await graphIndexer.indexBlocks(blocks)

			// Assert
			// Should record metrics for 2 fallback chunks (fallback_chunk + emergency_fallback)
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith("vb", "fallbackChunksIndexed", 2)
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith("vb", "fallbackNodesCreated", expect.any(Number))
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledWith(
				"vb",
				"fallbackRelationshipsCreated",
				expect.any(Number),
			)

			// Verify 3 calls were made (one for each metric type)
			expect(recordGraphIndexingMetricSpy).toHaveBeenCalledTimes(3)
		})
	})
})
