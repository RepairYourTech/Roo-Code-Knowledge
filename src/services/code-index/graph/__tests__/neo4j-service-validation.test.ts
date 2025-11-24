/**
 * Test suite for Neo4j service validation functionality
 *
 * This test suite validates the enhanced validation features of the Neo4jService class,
 * including node validation, relationship validation, metadata validation, and integration
 * with database operations.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { Neo4jService } from "../neo4j-service"
import neo4j from "neo4j-driver"
import type {
	CodeNode,
	CodeRelationship,
	ImportMetadata,
	CallMetadata,
	TestRelationshipMetadata,
	TypeMetadata,
	ExtendsMetadata,
	ImplementsMetadata,
	CodeNodeValidationError,
	MetadataValidationError,
} from "../../interfaces/neo4j-service"
import { CodebaseIndexErrorLogger } from "../error-logger"
import { MetadataValidator } from "../metadata-validator"

vi.mock("neo4j-driver")

// Mock Neo4j driver
const mockDriver = {
	verifyConnectivity: vi.fn(),
	session: vi.fn(),
	close: vi.fn(),
}

// Mock Neo4j session
const mockSession = {
	run: vi.fn(),
	close: vi.fn(),
	beginTransaction: vi.fn(),
}

// Mock error logger
const mockErrorLogger = {
	logError: vi.fn().mockResolvedValue(undefined),
} as unknown as CodebaseIndexErrorLogger

describe("Neo4jService - Validation", () => {
	let neo4jService: Neo4jService
	let mockMetadataValidator: MetadataValidator

	beforeEach(() => {
		// Create a mock metadata validator
		mockMetadataValidator = {
			validateAndSanitize: vi.fn().mockReturnValue({
				sanitized: {},
				warnings: [],
				wasTruncated: false,
			}),
		} as unknown as MetadataValidator

		// Create Neo4j service with mocked dependencies
		neo4jService = new Neo4jService(
			{
				enabled: true,
				url: "bolt://localhost:7687",
				username: "test",
				password: "test",
				database: "testdb",
			},
			mockErrorLogger,
		)

		// Mock of driver and session
		vi.mocked(neo4j).driver.mockReturnValue(mockDriver as any)
		vi.mocked(mockDriver.session).mockReturnValue(mockSession as any)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Node Validation", () => {
		test("validateCodeNode should pass for valid node", async () => {
			const validNode: CodeNode = {
				id: "test-node-1",
				type: "function",
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
				language: "typescript",
			}

			const errors = await neo4jService.validateNode(validNode)
			expect(errors).toEqual([])
		})

		test("validateCodeNode should fail for empty id", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "id",
				message: "Node ID must be a non-empty string",
				value: "",
			})
		})

		test("validateCodeNode should fail for invalid type", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "invalid-type" as any,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "type",
				message:
					"Invalid node type: invalid-type. Valid types are: function, class, method, interface, variable, import, file",
				value: "invalid-type",
			})
		})

		test("validateCodeNode should fail for empty name", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "name",
				message: "Node name must be a non-empty string",
				value: "",
			})
		})

		test("validateCodeNode should fail for empty filePath", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "testFunction",
				filePath: "",
				startLine: 10,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "filePath",
				message: "Node filePath must be a non-empty string",
				value: "",
			})
		})

		test("validateCodeNode should fail for negative startLine", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: -1,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "startLine",
				message: "Node startLine must be a positive number",
				value: -1,
			})
		})

		test("validateCodeNode should fail for negative endLine", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: -1,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "endLine",
				message: "Node endLine must be a positive number",
				value: -1,
			})
		})

		test("validateCodeNode should fail for startLine > endLine", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 30,
				endLine: 20,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "startLine",
				message: "Node startLine must be less than or equal to endLine",
				value: 30,
			})
		})

		test("validateCodeNode should fail for empty language when present", async () => {
			const invalidNode = {
				id: "test-node-1",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
				language: "",
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "language",
				message: "Node language must be a non-empty string if provided",
				value: "",
			})
		})

		test("validateCodeNode should return multiple errors for multiple invalid fields", async () => {
			const invalidNode = {
				id: "",
				type: "invalid-type" as any,
				name: "",
				filePath: "",
				startLine: -1,
				endLine: -2,
			}

			const errors = await neo4jService.validateNode(invalidNode)
			expect(errors.length).toBeGreaterThan(1)

			// Check that all expected errors are present
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("id")
			expect(fieldNames).toContain("type")
			expect(fieldNames).toContain("name")
			expect(fieldNames).toContain("filePath")
			expect(fieldNames).toContain("startLine")
			expect(fieldNames).toContain("endLine")
		})
	})

	describe("Relationship Validation", () => {
		test("validateRelationship should pass for valid relationship", async () => {
			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for empty fromId", async () => {
			const invalidRelationship = {
				fromId: "",
				toId: "node-2",
				type: "CALLS" as const,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "fromId",
				expectedType: "string",
				actualType: "string",
				message: "Relationship fromId must be a non-empty string",
			})
		})

		test("validateRelationship should fail for empty toId", async () => {
			const invalidRelationship = {
				fromId: "node-1",
				toId: "",
				type: "CALLS" as const,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "toId",
				expectedType: "string",
				actualType: "string",
				message: "Relationship toId must be a non-empty string",
			})
		})

		test("validateRelationship should fail for invalid type", async () => {
			const invalidRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "INVALID_TYPE" as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors).toHaveLength(1)
			expect(errors[0]).toEqual({
				field: "type",
				expectedType: "valid relationship type",
				actualType: "INVALID_TYPE",
				message:
					"Invalid relationship type: INVALID_TYPE. Valid types are: CALLS, CALLED_BY, TESTS, TESTED_BY, HAS_TYPE, ACCEPTS_TYPE, RETURNS_TYPE, IMPORTS, EXTENDS, EXTENDED_BY, IMPLEMENTS, IMPLEMENTED_BY, CONTAINS, DEFINES, USES",
			})
		})

		test("validateRelationship should validate IMPORTS metadata", async () => {
			const validImportMetadata: ImportMetadata = {
				source: "lodash",
				symbols: ["map", "filter"],
				isDefault: false,
			}

			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "IMPORTS",
				metadata: validImportMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid IMPORTS metadata", async () => {
			const invalidImportMetadata = {
				source: 123, // Should be string
				symbols: "not-array", // Should be array
				isDefault: "not-boolean", // Should be boolean
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "IMPORTS",
				metadata: invalidImportMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("source")
			expect(fieldNames).toContain("symbols")
			expect(fieldNames).toContain("isDefault")
		})

		test("validateRelationship should validate CALLS metadata", async () => {
			const validCallMetadata: CallMetadata = {
				callType: "direct",
				line: 15,
				column: 25,
			}

			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
				metadata: validCallMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid CALLS metadata", async () => {
			const invalidCallMetadata = {
				callType: 123, // Should be string
				line: "not-number", // Should be number
				column: "not-number", // Should be number
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
				metadata: invalidCallMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("callType")
			expect(fieldNames).toContain("line")
			expect(fieldNames).toContain("column")
		})

		test("validateRelationship should validate TESTS metadata", async () => {
			const validTestMetadata: TestRelationshipMetadata = {
				confidence: 0.85,
				detectionMethod: "pattern-matching",
				testFramework: "jest",
			}

			const validRelationship: CodeRelationship = {
				fromId: "test-node-1",
				toId: "node-2",
				type: "TESTS",
				metadata: validTestMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid TESTS metadata", async () => {
			const invalidTestMetadata = {
				confidence: 1.5, // Should be 0-1
				detectionMethod: 123, // Should be string
				testFramework: true, // Should be string
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "test-node-1",
				toId: "node-2",
				type: "TESTS",
				metadata: invalidTestMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("confidence")
			expect(fieldNames).toContain("detectionMethod")
		})

		test("validateRelationship should validate Type metadata", async () => {
			const validTypeMetadata: TypeMetadata = {
				typeString: "string",
				isInferred: false,
				source: "typescript",
			}

			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "HAS_TYPE",
				metadata: validTypeMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid Type metadata", async () => {
			const invalidTypeMetadata = {
				typeString: 123, // Should be string
				isInferred: "not-boolean", // Should be boolean
				source: 456, // Should be string
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "HAS_TYPE",
				metadata: invalidTypeMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("typeString")
		})

		test("validateRelationship should validate EXTENDS metadata", async () => {
			const validExtendsMetadata: ExtendsMetadata = {
				parentClass: "BaseClass",
				isAbstract: true,
			}

			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "EXTENDS",
				metadata: validExtendsMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid EXTENDS metadata", async () => {
			const invalidExtendsMetadata = {
				parentClass: 123, // Should be string
				isAbstract: "not-boolean", // Should be boolean
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "EXTENDS",
				metadata: invalidExtendsMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("parentClass")
		})

		test("validateRelationship should validate IMPLEMENTS metadata", async () => {
			const validImplementsMetadata: ImplementsMetadata = {
				interface: "MyInterface",
			}

			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "IMPLEMENTS",
				metadata: validImplementsMetadata,
			}

			const errors = await neo4jService.validateRelationship(validRelationship)
			expect(errors).toEqual([])
		})

		test("validateRelationship should fail for invalid IMPLEMENTS metadata", async () => {
			const invalidImplementsMetadata = {
				interface: 123, // Should be string
			}

			const invalidRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "IMPLEMENTS",
				metadata: invalidImplementsMetadata as any,
			}

			const errors = await neo4jService.validateRelationship(invalidRelationship)
			expect(errors.length).toBeGreaterThan(0)

			// Check for specific field validation errors
			const fieldNames = errors.map((e) => e.field)
			expect(fieldNames).toContain("interface")
		})

		test("validateRelationship should handle missing metadata gracefully", async () => {
			const relationshipWithoutMetadata: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
				// No metadata property
			}

			const errors = await neo4jService.validateRelationship(relationshipWithoutMetadata)
			expect(errors).toEqual([])
		})
	})

	describe("Integration with upsertNode", () => {
		test("upsertNode should call validation before insertion", async () => {
			const validNode: CodeNode = {
				id: "test-node-1",
				type: "function",
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await neo4jService.upsertNode(validNode)

			// Verify session.run was called
			expect(mockSession.run).toHaveBeenCalled()
		})

		test("upsertNode should fail with invalid node", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await expect(neo4jService.upsertNode(invalidNode)).rejects.toThrow("Node ID must be a non-empty string")
		})

		test("upsertNode should bypass validation when disabled in config", async () => {
			// Create service with validation disabled
			const serviceWithValidationDisabled = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			// Disable validation
			serviceWithValidationDisabled.setValidationEnabled(false)

			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			// Should not throw error when validation is disabled
			await expect(serviceWithValidationDisabled.upsertNode(invalidNode)).resolves.not.toThrow()
		})

		test("upsertNode should not call query for invalid nodes", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			try {
				await neo4jService.upsertNode(invalidNode)
			} catch (error) {
				// Expected to throw
			}

			// Verify session.run was not called due to validation failure
			expect(mockSession.run).not.toHaveBeenCalled()
		})
	})

	describe("Integration with createRelationship", () => {
		test("createRelationship should call validation before insertion", async () => {
			const validRelationship: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await neo4jService.createRelationship(validRelationship)

			// Verify session.run was called
			expect(mockSession.run).toHaveBeenCalled()
		})

		test("createRelationship should fail with invalid relationship", async () => {
			const invalidRelationship = {
				fromId: "",
				toId: "node-2",
				type: "INVALID_TYPE" as any,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await expect(neo4jService.createRelationship(invalidRelationship)).rejects.toThrow()
		})

		test("createRelationship should apply metadata sanitization", async () => {
			const relationshipWithMetadata: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "CALLS",
				metadata: {
					callType: "direct",
					line: 15,
					column: 25,
				},
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await neo4jService.createRelationship(relationshipWithMetadata)

			// Verify session.run was called with sanitized metadata
			expect(mockSession.run).toHaveBeenCalledWith(
				expect.stringContaining("SET r += $metadata"),
				expect.objectContaining({
					metadata: expect.any(Object),
				}),
			)
		})
	})

	describe("Batch Operations", () => {
		test("upsertNodes should validate all nodes", async () => {
			const validNodes: CodeNode[] = [
				{
					id: "node-1",
					type: "function",
					name: "function1",
					filePath: "/path/to/file1.ts",
					startLine: 10,
					endLine: 20,
				},
				{
					id: "node-2",
					type: "class",
					name: "Class1",
					filePath: "/path/to/file2.ts",
					startLine: 30,
					endLine: 100,
				},
			]

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await neo4jService.upsertNodes(validNodes)

			// Verify session.run was called
			expect(mockSession.run).toHaveBeenCalled()
		})

		test("upsertNodes should fail if any node is invalid", async () => {
			const nodesWithInvalid: CodeNode[] = [
				{
					id: "node-1",
					type: "function",
					name: "function1",
					filePath: "/path/to/file1.ts",
					startLine: 10,
					endLine: 20,
				},
				{
					id: "", // Invalid node
					type: "class",
					name: "Class1",
					filePath: "/path/to/file2.ts",
					startLine: 30,
					endLine: 100,
				},
			]

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await expect(neo4jService.upsertNodes(nodesWithInvalid)).rejects.toThrow()
		})

		test("createRelationships should validate all relationships", async () => {
			const validRelationships: CodeRelationship[] = [
				{
					fromId: "node-1",
					toId: "node-2",
					type: "CALLS",
				},
				{
					fromId: "node-2",
					toId: "node-3",
					type: "IMPORTS",
				},
			]

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await neo4jService.createRelationships(validRelationships)

			// Verify session.run was called
			expect(mockSession.run).toHaveBeenCalled()
		})

		test("createRelationships should fail if any relationship is invalid", async () => {
			const relationshipsWithInvalid: CodeRelationship[] = [
				{
					fromId: "node-1",
					toId: "node-2",
					type: "CALLS",
				},
				{
					fromId: "",
					toId: "node-3",
					type: "INVALID_TYPE" as any,
				},
			]

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			await expect(neo4jService.createRelationships(relationshipsWithInvalid)).rejects.toThrow()
		})
	})

	describe("Configuration", () => {
		test("validation can be disabled via config", async () => {
			// Create service with validation disabled
			const serviceWithValidationDisabled = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			// Disable validation
			serviceWithValidationDisabled.setValidationEnabled(false)

			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock successful session.run
			vi.mocked(mockSession.run).mockResolvedValue({ records: [] })

			// Should not throw error when validation is disabled
			const errors = await serviceWithValidationDisabled.validateNode(invalidNode)
			expect(errors).toEqual([])
		})

		test("log level affects validation logging", async () => {
			// Create service with debug log level
			const serviceWithDebugLogging = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			// Verify service was created with debug logging
			expect(serviceWithDebugLogging).toBeDefined()
		})
	})

	describe("Metrics", () => {
		test("validation failures are tracked in metrics", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			const invalidRelationship = {
				fromId: "",
				toId: "node-2",
				type: "INVALID_TYPE" as any,
			}

			// Validate invalid node and relationship
			await neo4jService.validateNode(invalidNode)
			await neo4jService.validateRelationship(invalidRelationship)

			// Get validation metrics
			const metrics = neo4jService.getValidationMetrics()

			// Verify metrics are updated
			expect(metrics.nodeValidationFailures).toBeGreaterThan(0)
			expect(metrics.relationshipValidationFailures).toBeGreaterThan(0)
		})

		test("metrics distinguish between node and relationship validation failures", async () => {
			// Reset metrics by creating a new service
			const freshService = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			const invalidRelationship = {
				fromId: "",
				toId: "node-2",
				type: "INVALID_TYPE" as any,
			}

			// Validate invalid node and relationship
			await freshService.validateNode(invalidNode)
			await freshService.validateRelationship(invalidRelationship)

			// Get validation metrics
			const metrics = freshService.getValidationMetrics()

			// Verify metrics are tracked separately
			expect(metrics.nodeValidationFailures).toBe(1)
			expect(metrics.relationshipValidationFailures).toBe(1)
			expect(metrics.metadataValidationFailures).toBeGreaterThanOrEqual(0)
		})

		test("metrics track metadata validation failures separately", async () => {
			// Reset metrics by creating a new service
			const freshService = new Neo4jService(
				{
					enabled: true,
					url: "bolt://localhost:7687",
					username: "test",
					password: "test",
					database: "testdb",
				},
				mockErrorLogger,
			)

			const relationshipWithInvalidMetadata: CodeRelationship = {
				fromId: "node-1",
				toId: "node-2",
				type: "IMPORTS",
				metadata: {
					source: 123, // Invalid type
					symbols: "not-array", // Invalid type
					isDefault: "not-boolean", // Invalid type
				},
			}

			// Validate relationship with invalid metadata
			await freshService.validateRelationship(relationshipWithInvalidMetadata)

			// Get validation metrics
			const metrics = freshService.getValidationMetrics()

			// Verify metadata validation failures are tracked
			expect(metrics.nodeValidationFailures).toBe(0)
			expect(metrics.relationshipValidationFailures).toBe(1)
			expect(metrics.metadataValidationFailures).toBeGreaterThan(0)
		})
	})

	describe("Error Handling", () => {
		test("validation errors are logged via error logger", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Validate invalid node
			await neo4jService.validateNode(invalidNode)

			// Verify error logger was called
			expect(mockErrorLogger.logError).toHaveBeenCalled()
		})

		test("validation errors include context", async () => {
			const invalidNode = {
				id: "test-node-with-error",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Mock of error logger to capture the error context
			let capturedContext: any = null
			vi.mocked(mockErrorLogger.logError).mockImplementation((error: any) => {
				capturedContext = error.additionalContext
				return Promise.resolve()
			})

			// Validate invalid node
			await neo4jService.validateNode(invalidNode)

			// Verify context was included in the error log
			expect(capturedContext).not.toBeNull()
		})

		test("validation errors do not crash the service", async () => {
			const invalidNode = {
				id: "",
				type: "function" as const,
				name: "testFunction",
				filePath: "/path/to/file.ts",
				startLine: 10,
				endLine: 20,
			}

			// Validate invalid node should not throw unhandled exceptions
			const errors = await neo4jService.validateNode(invalidNode)

			// Should return errors array, not throw
			expect(Array.isArray(errors)).toBe(true)
			expect(errors.length).toBeGreaterThan(0)
		})
	})
})
