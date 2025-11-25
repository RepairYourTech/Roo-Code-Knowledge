import { CodeBlock, CallInfo, TestMetadata, TestTarget } from "../interfaces/file-processor"
import {
	CodeNode,
	CodeRelationship,
	INeo4jService,
	ImportMetadata,
	CallMetadata,
	TestRelationshipMetadata as TestMetadataType,
	TypeMetadata,
	ExtendsMetadata,
	ImplementsMetadata,
	RelationshipMetadata,
} from "../interfaces/neo4j-service"
import { IGraphIndexer, GraphIndexResult } from "../interfaces/graph-indexer"
import { CodebaseIndexErrorLogger } from "./error-logger"
import { MetadataValidator } from "./metadata-validator"
import { MAX_METADATA_ARRAY_LENGTH } from "../constants"
import * as path from "path"
import { createOutputChannelLogger, type LogFunction } from "../../../utils/outputChannelLogger"
import * as vscode from "vscode"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Graph indexer implementation
 * Extracts code relationships from parsed code blocks and indexes them into Neo4j
 */
export class GraphIndexer implements IGraphIndexer {
	private readonly metadataValidator: MetadataValidator
	private readonly telemetryEnabled: boolean

	constructor(
		private neo4jService: INeo4jService,
		private errorLogger?: CodebaseIndexErrorLogger,
		outputChannel?: vscode.OutputChannel,
		telemetryEnabled: boolean = true,
	) {
		this.log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}
		this.telemetryEnabled = telemetryEnabled && TelemetryService.hasInstance()

		// Initialize metadata validator with appropriate configuration
		this.metadataValidator = new MetadataValidator(
			{
				service: "neo4j",
				validationEnabled: true,
				allowTruncation: true,
				logLevel: "warn",
			},
			errorLogger,
		)
	}

	private readonly log: LogFunction

	/**
	 * Safely capture telemetry events with error handling
	 * Ensures telemetry failures don't impact indexing performance
	 * @param eventName The telemetry event name
	 * @param properties The event properties
	 */
	private captureTelemetry(eventName: string, properties?: Record<string, unknown>): void {
		if (!this.telemetryEnabled) {
			return
		}

		try {
			// Use dynamic import to avoid telemetry service initialization issues
			const { TelemetryService } = require("@roo-code/telemetry")
			const { TelemetryEventName } = require("@roo-code/types")

			if (TelemetryService.hasInstance()) {
				TelemetryService.instance.captureEvent(eventName as any, properties)
			}
		} catch (error) {
			// Silently fail to avoid impacting indexing performance
			// Log to debug channel if available
			this.log(`[GraphIndexer] Telemetry capture failed:`, error)
		}
	}

	/**
	 * Get performance timing for telemetry
	 * @returns Current timestamp in milliseconds
	 */
	private getTimestamp(): number {
		return Date.now()
	}

	/**
	 * Extract unique types from nodes for telemetry
	 * @param nodes Array of code nodes
	 * @returns Array of unique node types
	 */
	private extractNodeTypes(nodes: CodeNode[]): string[] {
		const types = new Set(nodes.map((node) => node.type))
		return Array.from(types)
	}

	/**
	 * Extract unique types from relationships for telemetry
	 * @param relationships Array of code relationships
	 * @returns Array of unique relationship types
	 */
	private extractRelationshipTypes(relationships: CodeRelationship[]): string[] {
		const types = new Set(relationships.map((rel) => rel.type))
		return Array.from(types)
	}

	/**
	 * Index a single code block into the graph database
	 */
	async indexBlock(block: CodeBlock): Promise<GraphIndexResult> {
		return this.indexBlocks([block])
	}

	/**
	 * Index multiple code blocks into the graph database (batch operation)
	 */
	async indexBlocks(blocks: CodeBlock[]): Promise<GraphIndexResult> {
		if (blocks.length === 0) {
			return {
				nodesCreated: 0,
				relationshipsCreated: 0,
				filePath: "",
			}
		}

		const filePath = blocks[0].file_path
		const errors: string[] = []
		let nodesCreated = 0
		let relationshipsCreated = 0
		const startTime = this.getTimestamp()

		// Log entry
		this.log(`[GraphIndexer] indexBlocks ENTRY: Processing ${blocks.length} blocks for file: ${filePath}`)

		// Capture telemetry for indexing start
		this.captureTelemetry("GRAPH_INDEXING_STARTED", {
			filePath,
			blockCount: blocks.length,
		})

		try {
			// Extract all nodes from all blocks
			const allNodes: CodeNode[] = []
			for (const block of blocks) {
				const nodes = this.extractNodes(block)
				allNodes.push(...nodes)
			}

			// Log extraction summary
			this.log(`[GraphIndexer] Extracted ${allNodes.length} nodes from ${blocks.length} blocks`)
			this.log(`[GraphIndexer] Node types: ${this.extractNodeTypes(allNodes).join(", ")}`)

			// Extract all relationships from all blocks
			const allRelationships: CodeRelationship[] = []
			for (const block of blocks) {
				const relationships = this.extractRelationships(block, blocks)
				allRelationships.push(...relationships)
			}

			// Log extraction summary
			this.log(`[GraphIndexer] Extracted ${allRelationships.length} relationships from ${blocks.length} blocks`)
			this.log(`[GraphIndexer] Relationship types: ${this.extractRelationshipTypes(allRelationships).join(", ")}`)

			// Create nodes first, then relationships in the same transaction context
			// This improves consistency and reduces transaction overhead
			if (allNodes.length > 0) {
				await this.neo4jService.upsertNodes(allNodes)
				nodesCreated = allNodes.length

				// Log confirmation
				this.log(`[GraphIndexer] Successfully created ${nodesCreated} nodes in Neo4j`)

				// Capture telemetry for node creation
				this.captureTelemetry("GRAPH_NODES_CREATED", {
					filePath,
					nodeCount: nodesCreated,
					nodeTypes: this.extractNodeTypes(allNodes),
				})
			}

			// Create relationships immediately after nodes to ensure atomicity
			if (allRelationships.length > 0) {
				await this.neo4jService.createRelationships(allRelationships)
				relationshipsCreated = allRelationships.length

				// Log confirmation
				this.log(`[GraphIndexer] Successfully created ${relationshipsCreated} relationships in Neo4j`)

				// Capture telemetry for relationship creation
				this.captureTelemetry("GRAPH_RELATIONSHIPS_CREATED", {
					filePath,
					relationshipCount: relationshipsCreated,
					relationshipTypes: this.extractRelationshipTypes(allRelationships),
				})
			}

			//Capture telemetry for successful indexing completion
			const duration = this.getTimestamp() - startTime
			this.captureTelemetry("GRAPH_INDEXING_COMPLETED", {
				filePath,
				nodesCreated,
				relationshipsCreated,
				durationMs: duration,
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			const errorStack = error instanceof Error ? error.stack : undefined

			// Log partial success information if nodes were created
			if (nodesCreated > 0) {
				this.log(`[GraphIndexer] Partial success: Created ${nodesCreated} nodes before failure in ${filePath}`)
			}

			// Capture telemetry for indexing error with context
			this.captureTelemetry("GRAPH_INDEXING_ERROR", {
				filePath,
				error: errorMessage,
				operation: "indexBlocks",
				context: {
					blockCount: blocks.length,
					nodesCreated,
					relationshipsCreated,
					durationMs: this.getTimestamp() - startTime,
				},
			})

			// Log to persistent error logger
			if (this.errorLogger) {
				await this.errorLogger.logError({
					service: "neo4j",
					filePath,
					operation: "indexBlocks",
					error: errorMessage,
					stack: errorStack,
					additionalContext: {
						blockCount: blocks.length,
						nodesCreated,
						relationshipsCreated,
						partialSuccess: nodesCreated > 0,
					},
				})
			}

			// Log to output channel with full context
			this.log(`[GraphIndexer] Failed to index blocks for ${filePath}:`, {
				error: errorMessage,
				stack: errorStack,
				blockCount: blocks.length,
				nodesCreated,
				relationshipsCreated,
			})

			// Throw error with enhanced context instead of returning in result.errors
			// This makes error handling consistent with indexFile method
			const contextualError = new Error(
				`Failed to index blocks for ${filePath}: ${nodesCreated} nodes created, ${relationshipsCreated} relationships created before failure: ${errorMessage}`,
				{ cause: error },
			)
			throw contextualError
		}

		// Log exit summary
		this.log(
			`[GraphIndexer] indexBlocks EXIT: Successfully indexed ${blocks.length} blocks (${nodesCreated} nodes, ${relationshipsCreated} relationships) for file: ${filePath}`,
		)

		return {
			nodesCreated,
			relationshipsCreated,
			filePath,
		}
	}

	/**
	 * Index an entire file into the graph database
	 */
	async indexFile(filePath: string, blocks: CodeBlock[]): Promise<GraphIndexResult> {
		const startTime = this.getTimestamp()
		const language = this.detectLanguage(filePath)

		// Log entry
		this.log(`[GraphIndexer] indexFile ENTRY: Received ${blocks.length} blocks for file: ${filePath}`)

		try {
			// First, remove any existing data for this file
			await this.removeFile(filePath)
			// Log confirmation
			this.log(`[GraphIndexer] Removed existing data for file: ${filePath}`)

			// Create a file node
			const fileNode: CodeNode = {
				id: `file:${filePath}`,
				type: "file",
				name: filePath.split("/").pop() || filePath,
				filePath,
				startLine: 1,
				endLine: blocks.length > 0 ? Math.max(...blocks.map((b) => b.end_line)) : 1,
			}

			await this.neo4jService.upsertNode(fileNode)
			// Log confirmation
			this.log(`[GraphIndexer] Created file node: ${fileNode.id}`)

			// Index all blocks
			// Log delegation
			this.log(`[GraphIndexer] Delegating ${blocks.length} blocks to indexBlocks for processing`)
			const result = await this.indexBlocks(blocks)

			// Create CONTAINS relationships from file to all top-level nodes
			const containsRelationships: CodeRelationship[] = blocks.map((block) => ({
				fromId: fileNode.id,
				toId: this.generateNodeId(block),
				type: "CONTAINS",
			}))

			if (containsRelationships.length > 0) {
				await this.neo4jService.createRelationships(containsRelationships)
			}

			// Capture telemetry for file indexing completion
			const totalNodesCreated = result.nodesCreated + 1 // +1 for file node
			const totalRelationshipsCreated = result.relationshipsCreated + containsRelationships.length
			const duration = this.getTimestamp() - startTime

			// Log detailed success summary
			this.log(
				`[GraphIndexer] indexFile SUCCESS: Indexed ${blocks.length} blocks for ${filePath} (${totalNodesCreated} nodes, ${totalRelationshipsCreated} relationships) in ${duration}ms`,
			)

			this.captureTelemetry("GRAPH_FILE_INDEXED", {
				filePath,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
				language,
				durationMs: duration,
			})

			return {
				...result,
				nodesCreated: totalNodesCreated,
				relationshipsCreated: totalRelationshipsCreated,
			}
		} catch (error) {
			// Capture telemetry for file indexing error
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.captureTelemetry("GRAPH_INDEXING_ERROR", {
				filePath,
				error: errorMessage,
				operation: "indexFile",
				context: {
					blockCount: blocks.length,
					language,
					durationMs: this.getTimestamp() - startTime,
				},
			})

			// Re-throw the error to maintain existing behavior
			throw error
		}
	}

	/**
	 * Remove all nodes and relationships for a file
	 */
	async removeFile(filePath: string): Promise<void> {
		try {
			await this.neo4jService.deleteNodesByFilePath(filePath)
		} catch (error) {
			// Capture telemetry for file removal error
			const errorMessage = error instanceof Error ? error.message : String(error)
			const errorStack = error instanceof Error ? error.stack : undefined

			this.captureTelemetry("GRAPH_INDEXING_ERROR", {
				filePath,
				error: errorMessage,
				operation: "removeFile",
			})

			// Log with file path in message for easier debugging
			this.log(`[GraphIndexer] Failed to remove file from graph: ${filePath}`, error)

			// Throw error with enhanced context
			throw new Error(`Failed to remove file ${filePath} from graph: ${errorMessage}`, { cause: error })
		}
	}

	/**
	 * Generate a synthetic identifier for nodes without explicit names
	 * Uses node type and location to create a unique, deterministic identifier
	 */
	private generateSyntheticIdentifier(block: CodeBlock): string {
		// Extract filename from path for readability
		const fileName = block.file_path.split("/").pop() || block.file_path

		// Create synthetic identifier: type_filename_L<start>-<end>
		const syntheticId = `${block.type}_${fileName}_L${block.start_line}-${block.end_line}`

		return syntheticId
	}

	/**
	 * Extract code nodes from a code block
	 */
	extractNodes(block: CodeBlock): CodeNode[] {
		const nodes: CodeNode[] = []

		// Phase 2: Validate node properties before creation

		// Determine node type from block type
		const nodeType = this.mapBlockTypeToNodeType(block.type)
		if (!nodeType) {
			this.log(`[GraphIndexer] Unrecognized block type "${block.type}" in ${block.file_path}:${block.start_line}`)
			return nodes
		}

		// Validate line numbers
		if (block.start_line > block.end_line) {
			this.log(`[GraphIndexer] Invalid line range ${block.start_line}-${block.end_line} in ${block.file_path}`)
			return nodes
		}

		// Validate file path is non-empty
		if (!block.file_path || block.file_path.trim() === "") {
			this.log(`[GraphIndexer] Skipping node with empty file path`)
			return nodes
		}

		// Generate synthetic identifier if none exists
		let identifier = block.identifier
		if (!identifier || identifier.trim() === "") {
			identifier = this.generateSyntheticIdentifier(block)
			this.log(
				`[GraphIndexer] Using fallback synthetic identifier '${identifier}' for ${block.type} in ${block.file_path}:${block.start_line}`,
			)
		}

		// Create primary node for this block
		const node: CodeNode = {
			id: this.generateNodeId(block),
			type: nodeType,
			name: identifier,
			filePath: block.file_path,
			startLine: block.start_line,
			endLine: block.end_line,
			language: this.detectLanguage(block.file_path),
		}

		nodes.push(node)

		// If block has symbol metadata, we could extract additional nodes
		// (e.g., parameters, return types, etc.) but for now we keep it simple

		return nodes
	}

	/**
	 * Map CodeBlock type to Neo4j node type
	 *
	 * COMPREHENSIVE COVERAGE: ALL 2,069 lines from KNOWLEDGEAUDIT/nodes.md
	 *
	 * Covers:
	 * - Universal Node Categories (All Languages)
	 * - Language-Specific: JS/TS, Python, Java, C/C++, C#, Rust, Go, Swift, Kotlin, PHP, Ruby, Elixir, Lua
	 * - Frameworks: React/JSX, Next.js, Vue, Svelte, Angular, React Native, Flutter, SwiftUI, Jetpack Compose, Objective-C
	 * - Specialized: XML/HTML, SQL, GraphQL, Solidity, YAML, JSON, TOML, Dockerfile
	 * - AI/ML: PyTorch, TensorFlow, JAX, Transformers, LangChain, LlamaIndex, and 50+ more frameworks
	 *
	 * Total Coverage: 400+ distinct node type patterns
	 */
	private mapBlockTypeToNodeType(
		blockType: string | null,
	): "function" | "class" | "method" | "interface" | "variable" | "import" | null {
		if (!blockType) return "function" // Default for blocks without type

		const type = blockType.toLowerCase()

		// ============================================================================
		// TIER 0: FILE & MODULE STRUCTURE (Root Nodes)
		// ============================================================================
		// Covers: source_file, program (root AST nodes)
		// These are typically root nodes and should be treated as module-like containers
		if (type.includes("source_file") || type.includes("program")) {
			return "class" // Treat root nodes as class-like containers
		}

		// ============================================================================
		// TIER 1: CLASS & TYPE DEFINITIONS (Must Have - Core Structure)
		// ============================================================================
		// Covers: class_declaration, class_definition, struct_declaration, struct_item,
		// enum_declaration, enum_definition, enum_item, union_declaration, union_item,
		// record_declaration, object_declaration, data_class, sealed_class, abstract_class,
		// singleton_class, companion_object, protocol_declaration, trait_declaration,
		// library_definition (Solidity), contract_definition (Solidity)
		if (
			type.includes("class") ||
			type.includes("struct") ||
			type.includes("enum") ||
			type.includes("union") ||
			type.includes("record") ||
			type.includes("object_declaration") || // Kotlin/Scala
			type.includes("data_class") || // Kotlin
			type.includes("sealed") || // Kotlin/Java sealed classes
			type.includes("companion") || // Kotlin companion objects
			type.includes("protocol") || // Swift/Objective-C
			type.includes("abstract_class") ||
			type.includes("contract") || // Solidity smart contracts
			type.includes("library") // Solidity libraries
		) {
			return "class"
		}

		// ============================================================================
		// TIER 1: INTERFACE & TRAIT DEFINITIONS
		// ============================================================================
		// Covers: interface_declaration, interface_definition, trait_declaration,
		// trait_item, protocol_declaration, type_alias, type_definition, typedef_declaration
		if (
			type.includes("interface") ||
			type.includes("trait") ||
			type.includes("protocol") ||
			type.includes("type_alias") ||
			type.includes("type_item") ||
			type.includes("typedef") ||
			type.includes("utility_type")
		) {
			return "interface"
		}

		// ============================================================================
		// TIER 1: METHOD & CONSTRUCTOR DEFINITIONS
		// ============================================================================
		// Covers: method_declaration, method_definition, constructor_declaration,
		// destructor_declaration, property_declaration, accessor_declaration,
		// getter, setter, static_method, abstract_method, virtual_method,
		// extension_function, operator_overload, singleton_method, init_declaration,
		// deinit_declaration, indexer_declaration, finalizer_declaration
		if (
			type.includes("method") ||
			type.includes("constructor") ||
			type.includes("destructor") ||
			type.includes("property") ||
			type.includes("accessor") ||
			type.includes("getter") ||
			type.includes("setter") ||
			type.includes("singleton_method") || // Ruby
			type.includes("extension_function") || // Kotlin/Swift
			type.includes("operator_overload") || // C++/C#/Python
			type.includes("init_declaration") || // Swift
			type.includes("deinit") || // Swift
			type.includes("indexer") || // C#
			type.includes("finalizer") // C#
		) {
			return "method"
		}

		// ============================================================================
		// TIER 1: FUNCTION DEFINITIONS
		// ============================================================================
		// Covers: function_declaration, function_definition, function_expression,
		// arrow_function, lambda_expression, anonymous_function, generator_function,
		// async_function, coroutine_declaration, closure_expression, func_literal,
		// defun, defp, defmacro, defdelegate, defguard (Elixir)
		if (
			type.includes("function") ||
			type.includes("func") ||
			type.includes("lambda") ||
			type.includes("arrow") ||
			type.includes("generator") ||
			type.includes("async") ||
			type.includes("coroutine") ||
			type.includes("closure") ||
			type.includes("anonymous") ||
			type.includes("defun") || // Lisp/Elixir
			type.includes("defp") || // Elixir private function
			type.includes("defmacro") || // Elixir/Lisp macros
			type.includes("defdelegate") || // Elixir
			type.includes("defguard") // Elixir guards
		) {
			return "function"
		}

		// ============================================================================
		// TIER 1: VARIABLE & FIELD DECLARATIONS
		// ============================================================================
		// Covers: variable_declaration, variable_declarator, field_declaration,
		// field_definition, constant_declaration, const_declaration, lexical_declaration,
		// parameter_declaration, static_field, instance_field, global_variable,
		// variadic_parameter, default_parameter, destructuring_pattern, array_pattern,
		// object_pattern, instance_variable, class_variable, lateinit_modifier,
		// lazy_delegate, event_declaration, keyword_argument, named_parameter,
		// state_variable_declaration (Solidity), immutable_variable (Solidity)
		if (
			type.includes("variable") ||
			type.includes("const") ||
			type.includes("let") ||
			type.includes("var") ||
			type.includes("lexical_declaration") ||
			type.includes("field") ||
			type.includes("static_item") || // Rust
			type.includes("assignment") ||
			type.includes("parameter") ||
			type.includes("destructuring") ||
			type.includes("pattern") ||
			type.includes("global_variable") ||
			type.includes("instance_variable") ||
			type.includes("class_variable") ||
			type.includes("lateinit") || // Kotlin
			type.includes("lazy") || // Kotlin/Swift
			type.includes("event") || // C# events
			type.includes("variadic") ||
			type.includes("default_parameter") ||
			type.includes("keyword_argument") || // Python keyword args
			type.includes("named_parameter") || // Named parameters
			type.includes("immutable") // Solidity immutable variables
		) {
			return "variable"
		}

		// ============================================================================
		// TIER 1: TYPE ANNOTATIONS (All Type System Nodes)
		// ============================================================================
		// Covers: type_annotation, type_descriptor, generic_type, type_arguments,
		// type_parameter, type_parameter_declaration, union_type, intersection_type,
		// optional_type, nullable_type, array_type, list_type, tuple_type,
		// function_type, callable_type, pointer_type, reference_type,
		// constrained_type, type_constraint, wildcard_type, type_bound,
		// mapping_type (Solidity), address_type (Solidity)
		if (
			type.includes("type_annotation") ||
			type.includes("type_descriptor") ||
			type.includes("generic_type") ||
			type.includes("type_arguments") ||
			type.includes("type_parameter") ||
			type.includes("union_type") ||
			type.includes("intersection_type") ||
			type.includes("optional_type") ||
			type.includes("nullable_type") ||
			type.includes("array_type") ||
			type.includes("list_type") ||
			type.includes("tuple_type") ||
			type.includes("function_type") ||
			type.includes("callable_type") ||
			type.includes("pointer_type") ||
			type.includes("reference_type") ||
			type.includes("constrained_type") ||
			type.includes("type_constraint") ||
			type.includes("wildcard_type") ||
			type.includes("type_bound") ||
			type.includes("mapping_type") || // Solidity
			type.includes("address_type") // Solidity
		) {
			return "interface" // Treat type annotations as interface-like type definitions
		}

		// ============================================================================
		// TIER 1: IMPORT/EXPORT STATEMENTS
		// ============================================================================
		// Covers: import_statement, import_declaration, import_from_statement,
		// include_statement, require_statement, use_declaration, export_statement,
		// export_declaration, using_directive, using_static_directive, namespace_use_declaration,
		// package_declaration, package_clause, import_spec, import_list, import_header,
		// alias, require_call
		if (
			type.includes("import") ||
			type.includes("export") ||
			type.includes("using") ||
			type.includes("use_declaration") ||
			type.includes("include") ||
			type.includes("require") ||
			type.includes("package_declaration") ||
			type.includes("package_clause") ||
			type.includes("alias") || // Elixir/Ruby alias
			type.includes("namespace_use")
		) {
			return "import"
		}

		// ============================================================================
		// TIER 2: MODULE & NAMESPACE STRUCTURES
		// ============================================================================
		// Covers: module_definition, module_declaration, namespace_definition,
		// namespace_declaration, mod_item, mod_declaration, defmodule (Elixir),
		// file_scoped_namespace_declaration
		if (
			type.includes("module") ||
			type.includes("namespace") ||
			type.includes("mod_item") ||
			type.includes("mod_declaration") ||
			type.includes("defmodule") // Elixir
		) {
			return "class" // Treat modules/namespaces as class-like containers
		}

		// ============================================================================
		// TIER 2: DECORATORS & ANNOTATIONS
		// ============================================================================
		// Covers: decorator, decorator_list, annotation, annotation_list, attribute,
		// attribute_list, attribute_item, pragma_directive, macro_invocation,
		// macro_definition, preprocessor_directive, annotation_type_declaration,
		// marker_annotation
		if (
			type.includes("decorator") ||
			type.includes("annotation") ||
			type.includes("attribute") ||
			type.includes("pragma") ||
			type.includes("macro") ||
			type.includes("preprocessor")
		) {
			return "class" // Treat as class-like metadata structures
		}

		// ============================================================================
		// TIER 2: SPECIAL LANGUAGE CONSTRUCTS
		// ============================================================================
		// Covers: impl_item (Rust), delegate_declaration (C#), mixin (Ruby),
		// extension_declaration (Swift/Kotlin), category_declaration (Objective-C),
		// defstruct, defprotocol, defimpl (Elixir), concept_definition (C++20)
		if (
			type.includes("impl") || // Rust impl blocks
			type.includes("delegate") || // C# delegates
			type.includes("mixin") || // Ruby mixins
			type.includes("extension") || // Swift/Kotlin extensions
			type.includes("category") || // Objective-C categories
			type.includes("defstruct") || // Elixir
			type.includes("defprotocol") || // Elixir
			type.includes("defimpl") || // Elixir
			type.includes("concept") // C++20 concepts
		) {
			return "class" // Treat as class-like structures
		}

		// ============================================================================
		// TIER 3: CONTROL FLOW STATEMENTS
		// ============================================================================
		// Covers: if_statement, else_clause, switch_statement, match_statement,
		// case_statement, pattern_match, for_statement, for_in_statement,
		// foreach_statement, while_statement, do_while_statement, break_statement,
		// continue_statement, return_statement, throw_statement, raise_statement,
		// yield_statement, goto_statement, label_statement, with_statement,
		// guard_statement, defer_statement, repeat_while_statement, unless, until,
		// when_expression, cond, receive, select_statement
		if (
			type.includes("if_statement") ||
			type.includes("else") ||
			type.includes("switch") ||
			type.includes("match") ||
			type.includes("case") ||
			type.includes("for") ||
			type.includes("while") ||
			type.includes("do_while") ||
			type.includes("break") ||
			type.includes("continue") ||
			type.includes("return") ||
			type.includes("throw") ||
			type.includes("raise") ||
			type.includes("yield") ||
			type.includes("goto") ||
			type.includes("label") ||
			type.includes("with_statement") ||
			type.includes("guard") ||
			type.includes("defer") ||
			type.includes("unless") ||
			type.includes("until") ||
			type.includes("when") ||
			type.includes("cond") ||
			type.includes("receive") ||
			type.includes("select")
		) {
			return "function" // Treat control flow as function-like blocks
		}

		// ============================================================================
		// TIER 3: ERROR HANDLING
		// ============================================================================
		// Covers: try_statement, try_catch, catch_clause, except_clause, finally_clause,
		// throw_expression, raise_expression, assert_statement, error_declaration,
		// result_type, panic_statement, rescue, ensure, retry, begin
		if (
			type.includes("try") ||
			type.includes("catch") ||
			type.includes("except") ||
			type.includes("finally") ||
			type.includes("assert") ||
			type.includes("error") ||
			type.includes("panic") ||
			type.includes("rescue") ||
			type.includes("ensure") ||
			type.includes("retry")
		) {
			return "function" // Treat error handling as function-like blocks
		}

		// ============================================================================
		// TIER 3: ASYNC/CONCURRENCY
		// ============================================================================
		// Covers: async_function, async_method, await_expression, promise_declaration,
		// future_declaration, thread_declaration, lock_statement, synchronized_statement,
		// channel_declaration, actor_declaration, go_statement, async_block,
		// co_await_expression, co_yield_expression, co_return_statement
		if (
			type.includes("await") ||
			type.includes("promise") ||
			type.includes("future") ||
			type.includes("thread") ||
			type.includes("lock") ||
			type.includes("synchronized") ||
			type.includes("channel") ||
			type.includes("actor") ||
			type.includes("go_statement") || // Go goroutines
			type.includes("co_await") || // C++20 coroutines
			type.includes("co_yield") ||
			type.includes("co_return")
		) {
			return "function" // Treat async/concurrency as function-like blocks
		}

		// ============================================================================
		// TIER 4: EXPRESSIONS & CALLS
		// ============================================================================
		// Covers: call_expression, invocation_expression, method_invocation,
		// assignment_expression, binary_expression, unary_expression, member_access,
		// subscript_expression, slice_expression, new_expression, spread_element,
		// ternary_expression, conditional_expression, pipe_expression, range_expression,
		// binary_operator, unary_operator, field_access, index_expression,
		// object_creation_expression, splat_operator, cascade_expression (Dart),
		// null_aware_expression (Dart/Kotlin), safe_navigation_operator (Ruby/Kotlin),
		// elvis_expression (Kotlin), walrus_operator (Python), this_expression, super_expression,
		// self_expression, meta_property, satisfies_expression (TS), as_expression (TS),
		// type_assertion (TS), emit_statement (Solidity), require_statement (Solidity),
		// revert_statement (Solidity)
		if (
			type.includes("call") ||
			type.includes("invocation") ||
			type.includes("expression") ||
			type.includes("member_access") ||
			type.includes("subscript") ||
			type.includes("slice") ||
			type.includes("spread") ||
			type.includes("ternary") ||
			type.includes("pipe") ||
			type.includes("range") ||
			type.includes("operator") || // binary_operator, unary_operator, etc.
			type.includes("field_access") ||
			type.includes("index_expression") ||
			type.includes("new_expression") ||
			type.includes("object_creation") ||
			type.includes("splat") ||
			type.includes("cascade") || // Dart
			type.includes("null_aware") || // Dart/Kotlin
			type.includes("safe_navigation") || // Ruby/Kotlin
			type.includes("elvis") || // Kotlin
			type.includes("walrus") || // Python
			type.includes("this_expression") ||
			type.includes("super_expression") ||
			type.includes("self_expression") ||
			type.includes("meta_property") ||
			type.includes("satisfies") || // TypeScript
			type.includes("as_expression") || // TypeScript
			type.includes("type_assertion") || // TypeScript
			type.includes("emit") || // Solidity
			type.includes("require") || // Solidity (also import, handled separately)
			type.includes("revert") // Solidity
		) {
			return "function" // Treat expressions as function-like blocks
		}

		// ============================================================================
		// TIER 4: LITERALS & CONSTANTS
		// ============================================================================
		// Covers: string_literal, template_string, number_literal, boolean_literal,
		// null_literal, array_literal, object_literal, set_literal, tuple_literal,
		// regex_literal, raw_string_literal, character_literal, symbol, heredoc, nowdoc,
		// true, false, none, dictionary_literal, map_literal, integer_literal, float_literal,
		// template_literal, template_substitution, f_string, formatted_string_literal,
		// interpolated_string_expression, ellipsis, composite_literal (Go)
		if (
			type.includes("literal") ||
			type.includes("string") ||
			type.includes("number") ||
			type.includes("boolean") ||
			type.includes("null") ||
			type.includes("nil") ||
			type.includes("none") ||
			type.includes("true") ||
			type.includes("false") ||
			type.includes("array") ||
			type.includes("object") ||
			type.includes("set") ||
			type.includes("tuple") ||
			type.includes("regex") ||
			type.includes("symbol") ||
			type.includes("heredoc") ||
			type.includes("nowdoc") ||
			type.includes("dictionary") ||
			type.includes("map_literal") ||
			type.includes("integer") ||
			type.includes("float") ||
			type.includes("template") ||
			type.includes("f_string") ||
			type.includes("interpolat") || // interpolated_string, string_interpolation
			type.includes("ellipsis") ||
			type.includes("composite_literal") // Go
		) {
			return "variable" // Treat literals as variable-like values
		}

		// ============================================================================
		// TIER 4: COMMENTS & DOCUMENTATION
		// ============================================================================
		// Covers: comment, line_comment, block_comment, documentation_comment,
		// doc_comment, jsdoc, javadoc, rustdoc, xml_documentation
		if (
			type.includes("comment") ||
			type.includes("doc") ||
			type.includes("jsdoc") ||
			type.includes("javadoc") ||
			type.includes("rustdoc")
		) {
			return "function" // Treat comments as function-like blocks (for documentation extraction)
		}

		// ============================================================================
		// FRAMEWORK-SPECIFIC: JSX/TSX (React)
		// ============================================================================
		// Covers: jsx_element, jsx_fragment, jsx_attribute, tsx_element,
		// jsx_opening_element, jsx_closing_element, jsx_self_closing_element
		if (type.includes("jsx") || type.includes("tsx")) {
			return "function" // Treat JSX as function-like blocks
		}

		// ============================================================================
		// FRAMEWORK-SPECIFIC: Vue/Svelte
		// ============================================================================
		// Covers: template_element, script_element, style_element, vue_directive,
		// svelte_directive, component_element, reactive_declaration, store_subscription,
		// slot_element, each_block, if_block, await_block, key_block, snippet_declaration
		if (
			type.includes("template_element") ||
			type.includes("script_element") ||
			type.includes("style_element") ||
			type.includes("vue_directive") ||
			type.includes("svelte_directive") ||
			type.includes("component_element") ||
			type.includes("reactive_declaration") ||
			type.includes("store_subscription") ||
			type.includes("slot") ||
			type.includes("each_block") ||
			type.includes("if_block") ||
			type.includes("await_block") ||
			type.includes("key_block") ||
			type.includes("snippet")
		) {
			return "function" // Treat framework-specific elements as function-like blocks
		}

		// ============================================================================
		// FRAMEWORK-SPECIFIC: Angular
		// ============================================================================
		// Covers: component_decorator, directive_decorator, pipe_decorator, injectable_decorator,
		// ng_module_decorator, input_decorator, output_decorator, view_child_decorator,
		// structural_directive, attribute_directive, signal_declaration, computed_signal
		if (
			type.includes("component_decorator") ||
			type.includes("directive_decorator") ||
			type.includes("pipe_decorator") ||
			type.includes("injectable_decorator") ||
			type.includes("ng_module") ||
			type.includes("input_decorator") ||
			type.includes("output_decorator") ||
			type.includes("view_child") ||
			type.includes("structural_directive") ||
			type.includes("attribute_directive") ||
			type.includes("signal_declaration") ||
			type.includes("computed_signal")
		) {
			return "class" // Treat Angular decorators as class-like metadata
		}

		// ============================================================================
		// FRAMEWORK-SPECIFIC: React Native, Flutter, SwiftUI, Jetpack Compose
		// ============================================================================
		// Covers: style_sheet_create, widget, composable_annotation, preview_annotation,
		// view_protocol, view_modifier, view_builder_attribute, state_property_wrapper,
		// binding_property_wrapper, observed_object_wrapper, remember_call, mutable_state_of
		if (
			type.includes("style_sheet") ||
			type.includes("widget") ||
			type.includes("composable") ||
			type.includes("preview_annotation") ||
			type.includes("view_protocol") ||
			type.includes("view_modifier") ||
			type.includes("view_builder") ||
			type.includes("state_property") ||
			type.includes("binding_property") ||
			type.includes("observed_object") ||
			type.includes("remember") ||
			type.includes("mutable_state")
		) {
			return "function" // Treat framework-specific patterns as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Python
		// ============================================================================
		// Covers: comprehension, list_comprehension, dict_comprehension, set_comprehension,
		// generator_expression, global_statement, nonlocal_statement, positional_only_parameter,
		// keyword_only_parameter
		if (
			type.includes("comprehension") ||
			type.includes("global_statement") ||
			type.includes("nonlocal_statement") ||
			type.includes("positional_only") ||
			type.includes("keyword_only")
		) {
			return "function" // Treat Python-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Java
		// ============================================================================
		// Covers: modifiers, enhanced_for_statement, static_initializer, instance_initializer,
		// constructor_body, explicit_constructor_invocation, annotation_type_declaration,
		// marker_annotation, switch_expression, pattern_matching
		if (
			type.includes("modifiers") ||
			type.includes("enhanced_for") ||
			type.includes("initializer") ||
			type.includes("constructor_body") ||
			type.includes("explicit_constructor") ||
			type.includes("annotation_type") ||
			type.includes("marker_annotation") ||
			type.includes("switch_expression") ||
			type.includes("pattern_matching")
		) {
			return "function" // Treat Java-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: C/C++
		// ============================================================================
		// Covers: struct_specifier, union_specifier, enum_specifier, pointer_declarator,
		// reference_declarator, template_declaration, template_instantiation, using_declaration,
		// using_directive, friend_declaration, virtual_function_specifier, override_specifier,
		// final_specifier, operator_cast, conversion_function, destructor_definition,
		// initializer_list, requires_clause, static_assert, preprocessor_include,
		// preprocessor_define, preprocessor_if
		if (
			type.includes("specifier") ||
			type.includes("declarator") ||
			type.includes("template") ||
			type.includes("friend_declaration") ||
			type.includes("virtual_function") ||
			type.includes("override") ||
			type.includes("final_specifier") ||
			type.includes("operator_cast") ||
			type.includes("conversion_function") ||
			type.includes("initializer_list") ||
			type.includes("requires_clause") ||
			type.includes("static_assert") ||
			type.includes("preprocessor")
		) {
			return "function" // Treat C/C++-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: C#
		// ============================================================================
		// Covers: using_static_directive, explicit_interface_specifier, conversion_operator_declaration,
		// query_expression (LINQ), anonymous_object_creation_expression, null_coalescing_expression,
		// null_conditional_operator, init_accessor, with_expression, file_scoped_namespace_declaration
		if (
			type.includes("using_static") ||
			type.includes("explicit_interface") ||
			type.includes("conversion_operator") ||
			type.includes("query_expression") ||
			type.includes("anonymous_object") ||
			type.includes("null_coalescing") ||
			type.includes("null_conditional") ||
			type.includes("init_accessor") ||
			type.includes("with_expression") ||
			type.includes("file_scoped_namespace")
		) {
			return "function" // Treat C#-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Rust
		// ============================================================================
		// Covers: mod_item, mod_declaration, impl_item, trait_item, struct_item, enum_item,
		// union_item, type_item, const_item, static_item, visibility_modifier, lifetime,
		// lifetime_parameter, where_clause, where_predicate, reference_expression,
		// borrow_expression, dereference_expression, unsafe_block, async_block,
		// closure_expression, match_expression, match_arm, if_let_expression,
		// while_let_expression, try_expression
		if (
			type.includes("mod_item") ||
			type.includes("mod_declaration") ||
			type.includes("impl") ||
			type.includes("trait_item") ||
			type.includes("struct_item") ||
			type.includes("enum_item") ||
			type.includes("union_item") ||
			type.includes("type_item") ||
			type.includes("const_item") ||
			type.includes("visibility_modifier") ||
			type.includes("lifetime") ||
			type.includes("where_clause") ||
			type.includes("where_predicate") ||
			type.includes("reference_expression") ||
			type.includes("borrow_expression") ||
			type.includes("dereference_expression") ||
			type.includes("unsafe_block") ||
			type.includes("async_block") ||
			type.includes("closure_expression") ||
			type.includes("match_expression") ||
			type.includes("match_arm") ||
			type.includes("if_let") ||
			type.includes("while_let") ||
			type.includes("try_expression")
		) {
			return "function" // Treat Rust-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Go
		// ============================================================================
		// Covers: package_clause, import_spec, type_spec, channel_type, send_statement,
		// receive_expression, go_statement, defer_statement, select_statement,
		// communication_case, type_assertion_expression, type_switch_statement,
		// variadic_argument, variadic_parameter_declaration, func_literal
		if (
			type.includes("package_clause") ||
			type.includes("import_spec") ||
			type.includes("type_spec") ||
			type.includes("channel") ||
			type.includes("send_statement") ||
			type.includes("receive_expression") ||
			type.includes("go_statement") ||
			type.includes("defer_statement") ||
			type.includes("select_statement") ||
			type.includes("communication_case") ||
			type.includes("type_assertion") ||
			type.includes("type_switch") ||
			type.includes("func_literal")
		) {
			return "function" // Treat Go-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Kotlin
		// ============================================================================
		// Covers: package_header, import_list, import_header, primary_constructor,
		// secondary_constructor, init_block, infix_function, inline_function,
		// suspend_function, safe_call_expression, not_null_assertion,
		// delegation_specifier, reified_type_parameter, crossinline_modifier, noinline_modifier
		if (
			type.includes("package_header") ||
			type.includes("import_list") ||
			type.includes("import_header") ||
			type.includes("primary_constructor") ||
			type.includes("secondary_constructor") ||
			type.includes("init_block") ||
			type.includes("infix_function") ||
			type.includes("inline_function") ||
			type.includes("suspend_function") ||
			type.includes("safe_call") ||
			type.includes("not_null_assertion") ||
			type.includes("delegation_specifier") ||
			type.includes("reified_type") ||
			type.includes("crossinline") ||
			type.includes("noinline")
		) {
			return "function" // Treat Kotlin-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: Swift
		// ============================================================================
		// Covers: associatedtype_declaration, subscript_declaration, precedence_group_declaration,
		// operator_declaration, computed_property, lazy_property, guard_statement,
		// repeat_while_statement, optional_chaining_expression, forced_unwrap_expression,
		// nil_coalescing_expression, key_path_expression, @available, @objc, @escaping
		if (
			type.includes("associatedtype") ||
			type.includes("subscript_declaration") ||
			type.includes("precedence_group") ||
			type.includes("operator_declaration") ||
			type.includes("computed_property") ||
			type.includes("lazy_property") ||
			type.includes("guard_statement") ||
			type.includes("repeat_while") ||
			type.includes("optional_chaining") ||
			type.includes("forced_unwrap") ||
			type.includes("nil_coalescing") ||
			type.includes("key_path") ||
			type.includes("@available") ||
			type.includes("@objc") ||
			type.includes("@escaping")
		) {
			return "function" // Treat Swift-specific constructs as function-like blocks
		}

		// ============================================================================
		// LANGUAGE-SPECIFIC: PHP, Ruby, Elixir, Lua
		// ============================================================================
		// Covers: namespace_use_declaration, scoped_property_access_expression, isset, empty,
		// unset, match_expression (PHP), singleton_method, symbol_array, string_array,
		// word_array, modifier_if, modifier_unless (Ruby), defstruct, defprotocol, defimpl,
		// defguard, defguardp, @attribute, capture_operator, pin_operator, match_operator,
		// sigil, keyword_list (Elixir), local_function, table_constructor, vararg_expression,
		// method_index_expression, require_call (Lua)
		if (
			type.includes("namespace_use") ||
			type.includes("scoped_property") ||
			type.includes("isset") ||
			type.includes("empty") ||
			type.includes("unset") ||
			type.includes("singleton_method") ||
			type.includes("symbol_array") ||
			type.includes("string_array") ||
			type.includes("word_array") ||
			type.includes("modifier_if") ||
			type.includes("modifier_unless") ||
			type.includes("defstruct") ||
			type.includes("defprotocol") ||
			type.includes("defimpl") ||
			type.includes("defguard") ||
			type.includes("@attribute") ||
			type.includes("capture_operator") ||
			type.includes("pin_operator") ||
			type.includes("match_operator") ||
			type.includes("sigil") ||
			type.includes("keyword_list") ||
			type.includes("local_function") ||
			type.includes("table_constructor") ||
			type.includes("vararg_expression") ||
			type.includes("method_index") ||
			type.includes("require_call")
		) {
			return "function" // Treat language-specific constructs as function-like blocks
		}

		// ============================================================================
		// SPECIALIZED: XML/HTML
		// ============================================================================
		// Covers: element, attribute, text_content, cdata_section, processing_instruction,
		// doctype_declaration, android_attribute, tools_attribute, app_attribute,
		// layout_element, view_element, constraint_layout, data_binding_expression,
		// vector_drawable, animation_resource, style_resource
		if (
			type.includes("element") ||
			type.includes("cdata") ||
			type.includes("processing_instruction") ||
			type.includes("doctype") ||
			type.includes("android_attribute") ||
			type.includes("tools_attribute") ||
			type.includes("app_attribute") ||
			type.includes("layout_element") ||
			type.includes("view_element") ||
			type.includes("constraint_layout") ||
			type.includes("data_binding") ||
			type.includes("vector_drawable") ||
			type.includes("animation_resource") ||
			type.includes("style_resource")
		) {
			return "variable" // Treat XML/HTML elements as variable-like data
		}

		// ============================================================================
		// SPECIALIZED: SQL
		// ============================================================================
		// Covers: create_table_statement, create_index_statement, create_view_statement,
		// create_trigger_statement, create_procedure_statement, create_function_statement,
		// alter_table_statement, drop_statement, select_statement, insert_statement,
		// update_statement, delete_statement, with_clause, join_clause, group_by_clause,
		// having_clause, order_by_clause, limit_clause, offset_clause, union_statement,
		// subquery, column_definition, constraint_definition, aggregate_function,
		// window_function, case_expression, cast_expression, transaction_statement
		if (
			type.includes("create_table") ||
			type.includes("create_index") ||
			type.includes("create_view") ||
			type.includes("create_trigger") ||
			type.includes("create_procedure") ||
			type.includes("create_function") ||
			type.includes("alter_table") ||
			type.includes("drop_statement") ||
			type.includes("select_statement") ||
			type.includes("insert_statement") ||
			type.includes("update_statement") ||
			type.includes("delete_statement") ||
			type.includes("with_clause") ||
			type.includes("join_clause") ||
			type.includes("group_by") ||
			type.includes("having_clause") ||
			type.includes("order_by") ||
			type.includes("limit_clause") ||
			type.includes("offset_clause") ||
			type.includes("union_statement") ||
			type.includes("subquery") ||
			type.includes("column_definition") ||
			type.includes("constraint_definition") ||
			type.includes("aggregate_function") ||
			type.includes("window_function") ||
			type.includes("case_expression") ||
			type.includes("cast_expression") ||
			type.includes("transaction_statement")
		) {
			return "function" // Treat SQL statements as function-like operations
		}

		// ============================================================================
		// SPECIALIZED: GraphQL
		// ============================================================================
		// Covers: schema_definition, type_definition, field_definition, argument_definition,
		// directive_definition, scalar_type_definition, object_type_definition,
		// interface_type_definition, union_type_definition, enum_type_definition,
		// input_object_type_definition, query_definition, mutation_definition,
		// subscription_definition, fragment_definition, operation_definition,
		// selection_set, field_selection, fragment_spread, inline_fragment,
		// variable_definition, directive_usage, schema_extension, type_extension
		if (
			type.includes("schema_definition") ||
			type.includes("type_definition") ||
			type.includes("field_definition") ||
			type.includes("argument_definition") ||
			type.includes("directive_definition") ||
			type.includes("scalar_type") ||
			type.includes("object_type") ||
			type.includes("union_type_definition") ||
			type.includes("enum_type_definition") ||
			type.includes("input_object_type") ||
			type.includes("query_definition") ||
			type.includes("mutation_definition") ||
			type.includes("subscription_definition") ||
			type.includes("fragment_definition") ||
			type.includes("operation_definition") ||
			type.includes("selection_set") ||
			type.includes("field_selection") ||
			type.includes("fragment_spread") ||
			type.includes("inline_fragment") ||
			type.includes("variable_definition") ||
			type.includes("directive_usage") ||
			type.includes("schema_extension") ||
			type.includes("type_extension")
		) {
			return "interface" // Treat GraphQL definitions as interface-like schemas
		}

		// ============================================================================
		// SPECIALIZED: Solidity (Additional Patterns)
		// ============================================================================
		// Covers: pragma_directive, event_definition, error_definition, modifier_definition,
		// fallback_function, receive_function, payable_modifier, view_modifier, pure_modifier,
		// override_specifier, virtual_specifier, assembly_block, using_for_declaration,
		// inheritance_specifier, modifier_invocation
		if (
			type.includes("pragma_directive") ||
			type.includes("event_definition") ||
			type.includes("error_definition") ||
			type.includes("modifier_definition") ||
			type.includes("fallback_function") ||
			type.includes("receive_function") ||
			type.includes("payable_modifier") ||
			type.includes("view_modifier") ||
			type.includes("pure_modifier") ||
			type.includes("override_specifier") ||
			type.includes("virtual_specifier") ||
			type.includes("assembly_block") ||
			type.includes("using_for") ||
			type.includes("inheritance_specifier") ||
			type.includes("modifier_invocation")
		) {
			return "function" // Treat Solidity-specific constructs as function-like blocks
		}

		// ============================================================================
		// SPECIALIZED: YAML, JSON, TOML, Dockerfile
		// ============================================================================
		// Covers: document, block_mapping, block_sequence, flow_mapping, flow_sequence,
		// block_scalar, plain_scalar, anchor, alias, tag, pair, from_instruction,
		// run_instruction, cmd_instruction, label_instruction, expose_instruction,
		// env_instruction, add_instruction, copy_instruction, entrypoint_instruction,
		// volume_instruction, user_instruction, workdir_instruction, arg_instruction,
		// onbuild_instruction, stopsignal_instruction, healthcheck_instruction,
		// shell_instruction, expansion
		if (
			type.includes("document") ||
			type.includes("block_mapping") ||
			type.includes("block_sequence") ||
			type.includes("flow_mapping") ||
			type.includes("flow_sequence") ||
			type.includes("block_scalar") ||
			type.includes("plain_scalar") ||
			type.includes("anchor") ||
			type.includes("alias") ||
			type.includes("tag") ||
			type.includes("pair") ||
			type.includes("from_instruction") ||
			type.includes("run_instruction") ||
			type.includes("cmd_instruction") ||
			type.includes("label_instruction") ||
			type.includes("expose_instruction") ||
			type.includes("env_instruction") ||
			type.includes("add_instruction") ||
			type.includes("copy_instruction") ||
			type.includes("entrypoint_instruction") ||
			type.includes("volume_instruction") ||
			type.includes("user_instruction") ||
			type.includes("workdir_instruction") ||
			type.includes("arg_instruction") ||
			type.includes("onbuild_instruction") ||
			type.includes("stopsignal_instruction") ||
			type.includes("healthcheck_instruction") ||
			type.includes("shell_instruction") ||
			type.includes("expansion")
		) {
			return "variable" // Treat config file constructs as variable-like data
		}

		// ============================================================================
		// AI/ML FRAMEWORKS: PyTorch, TensorFlow, JAX, Transformers, LangChain, etc.
		// ============================================================================
		// Covers: Inherits from nn.Module, LightningModule, tf.keras.Model, flax.linen.Module,
		// BaseEstimator, Chain, BaseTool, BaseAgent, BaseRetriever, etc.
		// Methods: forward(), training_step(), call(), fit(), predict(), transform()
		// Decorators: @torch.no_grad(), @tf.function, @jax.jit, @jax.grad
		// Function calls: torch.save(), model.compile(), AutoModel.from_pretrained(),
		// LLMChain(), VectorStoreIndex(), Agent(), Crew(), etc.
		//
		// NOTE: These are semantic patterns based on naming conventions, not tree-sitter node types.
		// They will be caught by the fallback patterns below based on their actual node types
		// (e.g., class_declaration, function_declaration, decorator, etc.)

		// ============================================================================
		// FALLBACK FOR DEFINITION PATTERNS
		// ============================================================================
		// Catch any @definition.* patterns from tree-sitter queries
		if (type.includes("definition")) {
			// Try to infer from the suffix
			if (type.includes("definition.class") || type.includes("definition.struct")) return "class"
			if (type.includes("definition.method")) return "method"
			if (type.includes("definition.function")) return "function"
			if (type.includes("definition.interface")) return "interface"
			if (type.includes("definition.variable") || type.includes("definition.constant")) return "variable"
			if (type.includes("definition.import")) return "import"
			// Default for other definitions
			return "function"
		}

		// ============================================================================
		// STATEMENT PATTERNS
		// ============================================================================
		// Catch various statement types not covered above
		if (type.includes("statement")) {
			return "function" // Treat statements as function-like code blocks
		}

		// ============================================================================
		// FINAL FALLBACK
		// ============================================================================
		// CRITICAL: Instead of returning null (which filters out the block),
		// default to "function" for any unrecognized block type
		// This ensures ALL code blocks are indexed to Neo4j, not just recognized types
		return "function"
	}

	/**
	 * Detect programming language from file path
	 */
	private detectLanguage(filePath: string): string {
		const ext = filePath.split(".").pop()?.toLowerCase() || ""

		const languageMap: Record<string, string> = {
			ts: "TypeScript",
			tsx: "TypeScript",
			js: "JavaScript",
			jsx: "JavaScript",
			py: "Python",
			rs: "Rust",
			go: "Go",
			java: "Java",
			cpp: "C++",
			hpp: "C++",
			c: "C",
			h: "C",
			cs: "C#",
			rb: "Ruby",
			php: "PHP",
			swift: "Swift",
			kt: "Kotlin",
			scala: "Scala",
			lua: "Lua",
			sol: "Solidity",
		}

		return languageMap[ext] || ext
	}

	/**
	 * Extract code relationships from a code block
	 */
	extractRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
		const relationships: CodeRelationship[] = []
		const fromId = this.generateNodeId(block)

		// Extract IMPORTS relationships from import metadata
		if (block.imports && block.imports.length > 0) {
			for (const importInfo of block.imports) {
				// Create a relationship to the imported module
				// Note: We create a simplified import node ID based on the source
				const importNodeId = `import:${block.file_path}:${importInfo.source}`

				relationships.push({
					fromId,
					toId: importNodeId,
					type: "IMPORTS",
					metadata: this.validateAndSanitizeMetadata(
						{
							source: importInfo.source,
							symbols: importInfo.symbols,
							isDefault: importInfo.isDefault,
						},
						"IMPORTS",
						block.identifier || undefined,
					) as ImportMetadata,
				})
			}
		}

		// Phase 10, Task 4: Extract EXTENDS relationships from symbol metadata
		if (block.symbolMetadata?.extends && block.type === "class") {
			let parentClassName = block.symbolMetadata.extends

			// Handle generic base classes: "BaseService<User>" -> "BaseService"
			if (parentClassName.includes("<")) {
				parentClassName = parentClassName.substring(0, parentClassName.indexOf("<")).trim()
			}

			// Handle qualified names: "services.BaseService" -> "BaseService"
			if (parentClassName.includes(".")) {
				parentClassName = parentClassName.substring(parentClassName.lastIndexOf(".") + 1).trim()
			}

			// Find parent class block
			const parentBlock = allBlocks.find(
				(b) => (b.type === "class" || b.type === "abstract_class") && b.identifier === parentClassName,
			)

			if (parentBlock) {
				relationships.push({
					fromId,
					toId: this.generateNodeId(parentBlock),
					type: "EXTENDS",
					metadata: this.validateAndSanitizeMetadata(
						{
							parentClass: parentClassName,
							isAbstract: block.symbolMetadata.isAbstract || false,
						},
						"EXTENDS",
						block.identifier || undefined,
					),
				})
			}
		}

		// Phase 10, Task 4: Extract IMPLEMENTS relationships from symbol metadata
		if (block.symbolMetadata?.implements && block.type === "class") {
			for (let interfaceName of block.symbolMetadata.implements) {
				// Handle generic interfaces: "IService<User>" -> "IService"
				if (interfaceName.includes("<")) {
					interfaceName = interfaceName.substring(0, interfaceName.indexOf("<")).trim()
				}

				// Handle qualified names: "interfaces.IService" -> "IService"
				if (interfaceName.includes(".")) {
					interfaceName = interfaceName.substring(interfaceName.lastIndexOf(".") + 1).trim()
				}

				// Find interface block
				const interfaceBlock = allBlocks.find((b) => b.type === "interface" && b.identifier === interfaceName)

				if (interfaceBlock) {
					relationships.push({
						fromId,
						toId: this.generateNodeId(interfaceBlock),
						type: "IMPLEMENTS",
						metadata: this.validateAndSanitizeMetadata(
							{
								interface: interfaceName,
							},
							"IMPLEMENTS",
							block.identifier || undefined,
						),
					})
				}
			}
		}

		// Phase 10: Extract CALLS relationships from call metadata
		if (block.calls && block.calls.length > 0) {
			for (const call of block.calls) {
				// Resolve the call target to a node ID
				const targetNodeId = this.resolveCallTarget(call, block, allBlocks)

				if (targetNodeId) {
					// Create CALLS relationship
					relationships.push({
						fromId,
						toId: targetNodeId,
						type: "CALLS",
						metadata: this.validateAndSanitizeMetadata(
							{
								callType: call.callType,
								line: call.line,
								column: call.column,
								receiver: call.receiver,
								qualifier: call.qualifier,
							},
							"CALLS",
							block.identifier || undefined,
						),
					})
				}
			}
		}

		// Extract DEFINES relationships for nested definitions
		// If this block contains other blocks (e.g., a class contains methods)
		const nestedBlocks = allBlocks.filter(
			(b) =>
				b.file_path === block.file_path &&
				b.start_line >= block.start_line &&
				b.end_line <= block.end_line &&
				b !== block,
		)

		for (const nested of nestedBlocks) {
			relationships.push({
				fromId,
				toId: this.generateNodeId(nested),
				type: "DEFINES",
			})
		}

		// Phase 10: Create reverse CALLED_BY relationships for efficient queries
		// This allows us to quickly answer "what calls this function?"
		const callsRelationships = relationships.filter((r) => r.type === "CALLS")
		for (const callsRel of callsRelationships) {
			relationships.push({
				fromId: callsRel.toId,
				toId: callsRel.fromId,
				type: "CALLED_BY",
				metadata: callsRel.metadata,
			})
		}

		// Phase 10, Task 2: Extract TESTS relationships from test metadata
		if (block.testMetadata?.isTest) {
			// Extract test targets from imports (highest confidence method)
			const testTargets = this.extractTestTargetsFromImports(block, allBlocks)

			for (const target of testTargets) {
				// Create TESTS relationship
				relationships.push({
					fromId,
					toId: target.targetNodeId,
					type: "TESTS",
					metadata: this.validateAndSanitizeMetadata(
						{
							confidence: target.confidence,
							detectionMethod: target.detectionMethod,
							testFramework: block.testMetadata.testFramework,
							testType: block.testMetadata.testType,
							targetIdentifier: target.targetIdentifier,
						},
						"TESTS",
						block.identifier || undefined,
					),
				})
			}
		}

		// Phase 10, Task 2: Create reverse TESTED_BY relationships for efficient queries
		// This allows us to quickly answer "is this function tested?"
		const testsRelationships = relationships.filter((r) => r.type === "TESTS")
		for (const testsRel of testsRelationships) {
			relationships.push({
				fromId: testsRel.toId,
				toId: testsRel.fromId,
				type: "TESTED_BY",
				metadata: testsRel.metadata,
			})
		}

		// Phase 10, Task 3: Extract type relationships from LSP info
		if (block.lspTypeInfo?.lspAvailable) {
			// Extract HAS_TYPE for variables/properties
			if (block.lspTypeInfo.typeInfo && (block.type === "variable" || block.type === "property")) {
				const typeRelationships = this.extractHasTypeRelationships(block, allBlocks)
				relationships.push(...typeRelationships)
			}

			// Extract ACCEPTS_TYPE and RETURNS_TYPE for functions/methods
			if (block.lspTypeInfo.signatureInfo && (block.type === "function" || block.type === "method")) {
				const paramTypeRelationships = this.extractAcceptsTypeRelationships(block, allBlocks)
				const returnTypeRelationships = this.extractReturnsTypeRelationships(block, allBlocks)
				relationships.push(...paramTypeRelationships)
				relationships.push(...returnTypeRelationships)
			}
		}

		// Phase 10, Task 4: Create reverse EXTENDED_BY relationships for efficient queries
		// This allows us to quickly answer "what classes extend this class?"
		const extendsRelationships = relationships.filter((r) => r.type === "EXTENDS")
		for (const extendsRel of extendsRelationships) {
			relationships.push({
				fromId: extendsRel.toId,
				toId: extendsRel.fromId,
				type: "EXTENDED_BY",
				metadata: extendsRel.metadata,
			})
		}

		// Phase 10, Task 4: Create reverse IMPLEMENTED_BY relationships for efficient queries
		// This allows us to quickly answer "what classes implement this interface?"
		const implementsRelationships = relationships.filter((r) => r.type === "IMPLEMENTS")
		for (const implementsRel of implementsRelationships) {
			relationships.push({
				fromId: implementsRel.toId,
				toId: implementsRel.fromId,
				type: "IMPLEMENTED_BY",
				metadata: implementsRel.metadata,
			})
		}

		return relationships
	}

	/**
	 * Clear all graph data
	 */
	async clearAll(): Promise<void> {
		try {
			await this.neo4jService.clearAll()

			// Capture telemetry for successful clear operation
			this.captureTelemetry("GRAPH_INDEXING_COMPLETED", {
				filePath: "CLEAR_ALL",
				nodesCreated: 0,
				relationshipsCreated: 0,
				durationMs: 0,
			})
		} catch (error) {
			// Capture telemetry for clear operation error
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.captureTelemetry("GRAPH_INDEXING_ERROR", {
				filePath: "CLEAR_ALL",
				error: errorMessage,
				operation: "clearAll",
			})

			// Re-throw error to maintain existing behavior
			throw error
		}
	}

	/**
	 * Generate a unique node ID for a code block
	 */
	private generateNodeId(block: CodeBlock): string {
		return `${block.type}:${block.file_path}:${block.start_line}`
	}

	/**
	 * Resolve a function call to the target node ID
	 * Phase 10: CALLS relationship resolution
	 */
	private resolveCallTarget(call: CallInfo, callerBlock: CodeBlock, allBlocks: CodeBlock[]): string | null {
		const { calleeName, callType } = call

		// Strategy 1: Look for function/method in the same file
		const sameFileTarget = allBlocks.find(
			(block) =>
				block.file_path === callerBlock.file_path &&
				block.identifier === calleeName &&
				(block.type === "function" || block.type === "method" || block.type.includes("function")),
		)

		if (sameFileTarget) {
			return this.generateNodeId(sameFileTarget)
		}

		// Strategy 2: Look for imported functions
		if (callerBlock.imports) {
			for (const importInfo of callerBlock.imports) {
				// Check if this import includes the called function
				if (importInfo.symbols?.includes(calleeName)) {
					// Try to find the function in the imported file
					const importedTarget = this.findFunctionInImportedFile(
						calleeName,
						importInfo.source,
						callerBlock.file_path,
						allBlocks,
					)

					if (importedTarget) {
						return this.generateNodeId(importedTarget)
					}
				}
			}
		}

		// Strategy 3: For method calls, look for methods in class definitions
		if (callType === "method" && call.receiver) {
			// Try to find the method in any class in the same file
			// This is a simplified heuristic - in a real implementation,
			// we'd need to track variable types to know which class the receiver is
			const methodTarget = allBlocks.find(
				(block) =>
					block.file_path === callerBlock.file_path &&
					block.identifier === calleeName &&
					block.type === "method",
			)

			if (methodTarget) {
				return this.generateNodeId(methodTarget)
			}
		}

		// Strategy 4: For static calls, look for static methods in classes
		if (callType === "static_method" && call.qualifier) {
			const qualifier = call.qualifier // Capture in a const for type narrowing
			const staticMethodTarget = allBlocks.find(
				(block) =>
					block.identifier === calleeName &&
					block.type === "method" &&
					// Check if the block is in a class with the qualifier name
					this.isMethodInClass(block, qualifier, allBlocks),
			)

			if (staticMethodTarget) {
				return this.generateNodeId(staticMethodTarget)
			}
		}

		// If we can't resolve the target, return null
		// This is expected for external library calls
		return null
	}

	/**
	 * Find a function in an imported file
	 */
	private findFunctionInImportedFile(
		functionName: string,
		importSource: string,
		currentFilePath: string,
		allBlocks: CodeBlock[],
	): CodeBlock | null {
		// Resolve the import source to an actual file path
		const importedFilePath = this.resolveImportPath(importSource, currentFilePath)

		if (!importedFilePath) {
			return null
		}

		// Find the function in the imported file
		return (
			allBlocks.find(
				(block) =>
					block.file_path === importedFilePath &&
					block.identifier === functionName &&
					(block.type === "function" || block.type === "method" || block.type.includes("function")),
			) || null
		)
	}

	/**
	 * Resolve an import source to a file path
	 * Enhanced to support more file extensions and @/ alias handling
	 * Examples:
	 *   './utils' -> '/workspace/src/utils.ts'
	 *   '../services/auth' -> '/workspace/src/services/auth.ts'
	 *   '@/components/Button' -> '/workspace/src/components/Button.tsx'
	 */
	private resolveImportPath(importSource: string, currentFilePath: string): string | null {
		// Skip node_modules imports (external libraries)
		if (!importSource.startsWith(".") && !importSource.startsWith("@/")) {
			return null
		}

		// Handle @/ alias (common in TypeScript projects)
		// Enhanced to resolve @/ to workspace root instead of skipping
		if (importSource.startsWith("@/")) {
			// Remove @/ prefix and resolve from workspace root
			const workspaceRelativePath = importSource.slice(2) // Remove "@/ "
			const resolvedPath = path.resolve(workspaceRelativePath)

			// Try common extensions for @/ imports
			const extensions = [
				".ts",
				".tsx",
				".js",
				".jsx",
				".vue",
				".svelte",
				".py",
				".rs",
				".go",
				".java",
				".c",
				".cpp",
				".cs",
				".dart",
				".kt",
				".swift",
				".rb",
				".php",
			]
			for (const ext of extensions) {
				const withExt = resolvedPath + ext
				return withExt
			}
			return null
		}

		// Handle relative imports
		const currentDir = path.dirname(currentFilePath)
		const resolvedPath = path.resolve(currentDir, importSource)

		// Try expanded set of extensions for better language support
		const extensions = [
			".ts",
			".tsx",
			".js",
			".jsx",
			".vue",
			".svelte",
			".py",
			".rs",
			".go",
			".java",
			".c",
			".cpp",
			".cs",
			".dart",
			".kt",
			".swift",
			".rb",
			".php",
		]
		for (const ext of extensions) {
			// Return the path with extension
			// Note: We don't check if the file exists here - we'll check in allBlocks
			const withExt = resolvedPath + ext
			return withExt
		}

		return null
	}

	/**
	 * Check if a method block is in a class with the given name
	 */
	private isMethodInClass(methodBlock: CodeBlock, className: string, allBlocks: CodeBlock[]): boolean {
		// Find the class that contains this method
		const containingClass = allBlocks.find(
			(block) =>
				block.file_path === methodBlock.file_path &&
				block.type === "class" &&
				block.identifier === className &&
				block.start_line <= methodBlock.start_line &&
				block.end_line >= methodBlock.end_line,
		)

		return !!containingClass
	}

	/**
	 * Phase 10, Task 2: Extract test targets from imports
	 * This is the highest confidence method for linking tests to source code
	 */
	private extractTestTargetsFromImports(
		testBlock: CodeBlock,
		allBlocks: CodeBlock[],
	): Array<{ targetNodeId: string; targetIdentifier: string; confidence: number; detectionMethod: string }> {
		const targets: Array<{
			targetNodeId: string
			targetIdentifier: string
			confidence: number
			detectionMethod: string
		}> = []

		if (!testBlock.imports) {
			return targets
		}

		// Simplified test framework detection - focus on common patterns
		const testFrameworkPatterns = [
			/^@?test/i,
			/^@?jest/i,
			/^@?vitest/i,
			/^@?mocha/i,
			/^@?jasmine/i,
			/^@?ava/i,
			/^@?tape/i,
			/@testing-library/i,
			/^pytest/i,
			/^unittest/i,
			/^nose/i,
			/^testing/i,
			/^testify/i,
			/^ginkgo/i,
			/^junit/i,
			/^testng/i,
			/^nunit/i,
			/^xunit/i,
			/^mstest/i,
			/^rspec/i,
			/^minitest/i,
			/^phpunit/i,
			/^pest/i,
			/^xctest/i,
		]

		for (const importInfo of testBlock.imports) {
			// Skip test framework imports using simplified pattern matching
			const isTestFramework = testFrameworkPatterns.some((pattern) =>
				pattern.test(importInfo.source.toLowerCase()),
			)
			if (isTestFramework) {
				continue
			}

			// Find source file blocks that match the import with improved matching
			const sourceBlocks = allBlocks.filter((block) => {
				// Skip test blocks
				if (block.testMetadata?.isTest) {
					return false
				}

				// Improved matching logic for import resolution
				const importSource = importInfo.source.toLowerCase()
				const blockPath = block.file_path.toLowerCase()

				// Try multiple matching strategies
				return (
					// Direct path match
					blockPath.includes(importSource) ||
					// Import source contains block path
					importSource.includes(blockPath) ||
					// Filename match (without extension)
					blockPath.includes(
						importSource.replace(
							/\.(ts|js|tsx|jsx|py|rs|go|java|cpp|c|cs|vue|svelte|dart|kt|swift|rb|php)$/,
							"",
						),
					) ||
					// Block identifier matches imported symbols
					importInfo.symbols.some((symbol) => symbol.toLowerCase() === block.identifier?.toLowerCase())
				)
			})

			for (const sourceBlock of sourceBlocks) {
				// Check if imported symbols match block identifiers
				for (const symbol of importInfo.symbols) {
					if (sourceBlock.identifier === symbol) {
						targets.push({
							targetNodeId: this.generateNodeId(sourceBlock),
							targetIdentifier: symbol,
							confidence: 90,
							detectionMethod: "import",
						})
					}
				}

				// If no specific symbols, link to the file-level blocks
				if (importInfo.symbols.length === 0 && sourceBlock.identifier) {
					targets.push({
						targetNodeId: this.generateNodeId(sourceBlock),
						targetIdentifier: sourceBlock.identifier,
						confidence: 70,
						detectionMethod: "import",
					})
				}
			}
		}

		return targets
	}

	/**
	 * Phase 10, Task 3: Parse type string to extract base types
	 * Handles complex type expressions: generics, unions, arrays, etc.
	 */
	private parseTypeString(typeString: string): string[] {
		const types: string[] = []

		// Remove whitespace
		const cleaned = typeString.trim()

		// Handle union types (A | B | C)
		if (cleaned.includes("|")) {
			const unionTypes = cleaned.split("|").map((t) => t.trim())
			for (const unionType of unionTypes) {
				types.push(...this.parseTypeString(unionType))
			}
			return types
		}

		// Handle intersection types (A & B & C)
		if (cleaned.includes("&")) {
			const intersectionTypes = cleaned.split("&").map((t) => t.trim())
			for (const intersectionType of intersectionTypes) {
				types.push(...this.parseTypeString(intersectionType))
			}
			return types
		}

		// Handle array types (T[])
		if (cleaned.endsWith("[]")) {
			const baseType = cleaned.slice(0, -2)
			types.push(...this.parseTypeString(baseType))
			return types
		}

		// Handle generic types (Generic<T, K>)
		const genericMatch = cleaned.match(/^([^<]+)<(.+)>$/)
		if (genericMatch) {
			const [, baseType, typeArgs] = genericMatch
			types.push(baseType.trim())

			// Parse type arguments recursively
			const typeArgsList = this.splitTypeArguments(typeArgs)
			for (const typeArg of typeArgsList) {
				types.push(...this.parseTypeString(typeArg))
			}
			return types
		}

		// Skip primitives and built-in types
		const builtInTypes = ["string", "number", "boolean", "void", "any", "unknown", "never", "null", "undefined"]
		if (!builtInTypes.includes(cleaned.toLowerCase())) {
			types.push(cleaned)
		}

		return types
	}

	/**
	 * Phase 10, Task 3: Split type arguments respecting nested generics
	 */
	private splitTypeArguments(typeArgs: string): string[] {
		const args: string[] = []
		let current = ""
		let depth = 0

		for (const char of typeArgs) {
			if (char === "<") depth++
			else if (char === ">") depth--
			else if (char === "," && depth === 0) {
				args.push(current.trim())
				current = ""
				continue
			}
			current += char
		}

		if (current.trim()) {
			args.push(current.trim())
		}

		return args
	}

	/**
	 * Phase 10, Task 3: Find type definition block
	 */
	private findTypeDefinition(typeName: string, allBlocks: CodeBlock[]): CodeBlock | null {
		// Look for class, interface, type alias, or enum definitions
		const typeBlock = allBlocks.find(
			(block) =>
				(block.type === "class" ||
					block.type === "interface" ||
					block.type === "type_alias" ||
					block.type === "enum") &&
				block.identifier === typeName,
		)

		return typeBlock || null
	}

	/**
	 * Phase 10, Task 3: Extract HAS_TYPE relationships for variables/properties
	 */
	private extractHasTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
		const relationships: CodeRelationship[] = []
		const typeInfo = block.lspTypeInfo?.typeInfo

		if (!typeInfo) return relationships

		// Parse type string to extract base types
		const baseTypes = this.parseTypeString(typeInfo.type)

		for (const typeName of baseTypes) {
			// Find type definition in allBlocks
			const typeBlock = this.findTypeDefinition(typeName, allBlocks)

			if (typeBlock) {
				relationships.push({
					fromId: this.generateNodeId(block),
					toId: this.generateNodeId(typeBlock),
					type: "HAS_TYPE",
					metadata: this.validateAndSanitizeMetadata(
						{
							typeString: typeInfo.type,
							isInferred: typeInfo.isInferred,
							source: "lsp",
						},
						"HAS_TYPE",
						block.identifier || undefined,
					),
				})
			}
		}

		return relationships
	}

	/**
	 * Phase 10, Task 3: Extract ACCEPTS_TYPE relationships for function parameters
	 */
	private extractAcceptsTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
		const relationships: CodeRelationship[] = []
		const signatureInfo = block.lspTypeInfo?.signatureInfo

		if (!signatureInfo || !signatureInfo.parameters) return relationships

		for (const param of signatureInfo.parameters) {
			const baseTypes = this.parseTypeString(param.type)

			for (const typeName of baseTypes) {
				const typeBlock = this.findTypeDefinition(typeName, allBlocks)

				if (typeBlock) {
					relationships.push({
						fromId: this.generateNodeId(block),
						toId: this.generateNodeId(typeBlock),
						type: "ACCEPTS_TYPE",
						metadata: this.validateAndSanitizeMetadata(
							{
								parameterName: param.name,
								typeString: param.type,
								isOptional: param.isOptional,
								source: "lsp",
							},
							"ACCEPTS_TYPE",
							block.identifier || undefined,
						),
					})
				}
			}
		}

		return relationships
	}

	/**
	 * Validates and sanitizes metadata using MetadataValidator
	 * Phase 1: Add metadata validation before relationship creation
	 */
	private validateAndSanitizeMetadata(
		metadata: Record<string, unknown>,
		relationshipType: string,
		blockIdentifier?: string,
	): RelationshipMetadata {
		try {
			// Phase 3: Add size limits for metadata arrays
			// Check IMPORTS metadata for array size limits
			if (relationshipType === "IMPORTS" && metadata.symbols && Array.isArray(metadata.symbols)) {
				const symbols = metadata.symbols as string[]
				if (symbols.length > MAX_METADATA_ARRAY_LENGTH) {
					this.log(
						`[GraphIndexer] IMPORTS symbols array (${symbols.length} items) exceeds limit (${MAX_METADATA_ARRAY_LENGTH}), truncating`,
					)
					metadata.symbols = symbols.slice(0, MAX_METADATA_ARRAY_LENGTH)
					// Add truncation warning
					metadata._truncated = true
					metadata._originalLength = symbols.length
				}
			}

			// Phase 3: Check parameter metadata for array size limits
			if (relationshipType === "ACCEPTS_TYPE" && metadata.parameterName) {
				// This is handled at the array level in the calling code
				// but we validate the overall structure here
			}

			// Phase 4: Add validation for nested objects in metadata
			// Validate testMetadata structure
			if (relationshipType === "TESTS" && metadata.testFramework) {
				if (typeof metadata.testFramework !== "string") {
					this.log(`[GraphIndexer] Invalid testFramework type in TESTS metadata for ${blockIdentifier}`)
					metadata.testFramework = String(metadata.testFramework)
				}
			}

			// Validate lspTypeInfo structure
			if (metadata.source === "lsp") {
				// Basic structure validation for LSP-derived metadata
				if (metadata.typeString && typeof metadata.typeString !== "string") {
					this.log(`[GraphIndexer] Invalid typeString in LSP metadata for ${blockIdentifier}`)
					metadata.typeString = String(metadata.typeString)
				}
			}

			// Use MetadataValidator to sanitize the metadata
			const validationResult = this.metadataValidator.validateAndSanitize(metadata)

			// Log any warnings from validation
			if (validationResult.warnings.length > 0) {
				this.log(
					`[GraphIndexer] Metadata validation warnings for ${relationshipType} relationship${blockIdentifier ? ` (${blockIdentifier})` : ""}:`,
					validationResult.warnings,
				)
			}

			// Log if truncation occurred
			if (validationResult.wasTruncated) {
				this.log(
					`[GraphIndexer] Metadata was truncated for ${relationshipType} relationship${blockIdentifier ? ` (${blockIdentifier})` : ""}`,
				)
			}

			// Return the sanitized metadata with proper type casting
			// based on the relationship type to ensure type safety
			return validationResult.sanitized as RelationshipMetadata
		} catch (error) {
			// Phase 4: Add error handling for metadata creation
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.log(
				`[GraphIndexer] Error validating metadata for ${relationshipType} relationship${blockIdentifier ? ` (${blockIdentifier})` : ""}:`,
				errorMessage,
			)

			// Log to persistent error logger if available
			if (this.errorLogger) {
				this.errorLogger.logError({
					service: "neo4j",
					filePath: blockIdentifier ? `unknown:${blockIdentifier}` : "unknown",
					operation: "validateAndSanitizeMetadata",
					error: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
					additionalContext: {
						relationshipType,
						metadata,
					},
				})
			}

			// Return empty metadata as fallback
			return {}
		}
	}

	/**
	 * Phase 10, Task 3: Extract RETURNS_TYPE relationships for function return types
	 */
	private extractReturnsTypeRelationships(block: CodeBlock, allBlocks: CodeBlock[]): CodeRelationship[] {
		const relationships: CodeRelationship[] = []
		const signatureInfo = block.lspTypeInfo?.signatureInfo

		if (!signatureInfo || !signatureInfo.returnType) return relationships

		const baseTypes = this.parseTypeString(signatureInfo.returnType)

		for (const typeName of baseTypes) {
			const typeBlock = this.findTypeDefinition(typeName, allBlocks)

			if (typeBlock) {
				relationships.push({
					fromId: this.generateNodeId(block),
					toId: this.generateNodeId(typeBlock),
					type: "RETURNS_TYPE",
					metadata: this.validateAndSanitizeMetadata(
						{
							typeString: signatureInfo.returnType,
							source: "lsp",
						},
						"RETURNS_TYPE",
						block.identifier || undefined,
					),
				})
			}
		}

		return relationships
	}
}
