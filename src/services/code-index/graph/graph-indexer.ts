import { CodeBlock, CallInfo, TestMetadata, TestTarget } from "../interfaces/file-processor"
import { CodeNode, CodeRelationship, INeo4jService } from "../interfaces/neo4j-service"
import { IGraphIndexer, GraphIndexResult } from "../interfaces/graph-indexer"
import * as path from "path"

/**
 * Graph indexer implementation
 * Extracts code relationships from parsed code blocks and indexes them into Neo4j
 */
export class GraphIndexer implements IGraphIndexer {
	constructor(private neo4jService: INeo4jService) {}

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
				errors: [],
			}
		}

		const filePath = blocks[0].file_path
		const errors: string[] = []
		let nodesCreated = 0
		let relationshipsCreated = 0

		try {
			// Extract all nodes from all blocks
			const allNodes: CodeNode[] = []
			for (const block of blocks) {
				const nodes = this.extractNodes(block)
				allNodes.push(...nodes)
			}

			// Create nodes in batch
			if (allNodes.length > 0) {
				await this.neo4jService.upsertNodes(allNodes)
				nodesCreated = allNodes.length
			}

			// Extract all relationships from all blocks
			const allRelationships: CodeRelationship[] = []
			for (const block of blocks) {
				const relationships = this.extractRelationships(block, blocks)
				allRelationships.push(...relationships)
			}

			// Create relationships in batch
			if (allRelationships.length > 0) {
				await this.neo4jService.createRelationships(allRelationships)
				relationshipsCreated = allRelationships.length
			}

			// TODO: Add telemetry events when they are defined in @roo-code/types
			// TelemetryService.instance?.captureEvent(TelemetryEventName.CodeIndexGraphIndexed, {
			// 	filePath,
			// 	nodesCreated,
			// 	relationshipsCreated,
			// })
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			errors.push(errorMessage)

			// TODO: Add telemetry events when they are defined in @roo-code/types
			// TelemetryService.instance?.captureEvent(TelemetryEventName.CodeIndexGraphIndexError, {
			// 	filePath,
			// 	error: errorMessage,
			// })
		}

		return {
			nodesCreated,
			relationshipsCreated,
			filePath,
			errors: errors.length > 0 ? errors : undefined,
		}
	}

	/**
	 * Index an entire file into the graph database
	 */
	async indexFile(filePath: string, blocks: CodeBlock[]): Promise<GraphIndexResult> {
		// First, remove any existing data for this file
		await this.removeFile(filePath)

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

		// Index all blocks
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

		return {
			...result,
			nodesCreated: result.nodesCreated + 1, // +1 for file node
			relationshipsCreated: result.relationshipsCreated + containsRelationships.length,
		}
	}

	/**
	 * Remove all nodes and relationships for a file
	 */
	async removeFile(filePath: string): Promise<void> {
		await this.neo4jService.deleteNodesByFilePath(filePath)
	}

	/**
	 * Extract code nodes from a code block
	 */
	extractNodes(block: CodeBlock): CodeNode[] {
		const nodes: CodeNode[] = []

		// Determine node type from block type
		const nodeType = this.mapBlockTypeToNodeType(block.type)
		if (!nodeType) {
			return nodes
		}

		// Create primary node for this block
		const node: CodeNode = {
			id: this.generateNodeId(block),
			type: nodeType,
			name: block.identifier || "anonymous",
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
	 */
	private mapBlockTypeToNodeType(
		blockType: string | null,
	): "function" | "class" | "method" | "interface" | "variable" | "import" | null {
		if (!blockType) return null

		const type = blockType.toLowerCase()

		// Map common tree-sitter node types to our node types
		if (type.includes("function") || type.includes("func")) {
			return "function"
		}
		if (type.includes("class")) {
			return "class"
		}
		if (type.includes("method")) {
			return "method"
		}
		if (type.includes("interface") || type.includes("trait")) {
			return "interface"
		}
		if (type.includes("variable") || type.includes("const") || type.includes("let")) {
			return "variable"
		}
		if (type.includes("import")) {
			return "import"
		}

		// Default to function for other definition types
		if (type.includes("definition")) {
			return "function"
		}

		return null
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
					metadata: {
						source: importInfo.source,
						symbols: importInfo.symbols,
						isDefault: importInfo.isDefault,
					},
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
					metadata: {
						parentClass: parentClassName,
						isAbstract: block.symbolMetadata.isAbstract || false,
					},
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
						metadata: {
							interface: interfaceName,
						},
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
						metadata: {
							callType: call.callType,
							line: call.line,
							column: call.column,
							receiver: call.receiver,
							qualifier: call.qualifier,
						},
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
					metadata: {
						confidence: target.confidence,
						detectionMethod: target.detectionMethod,
						testFramework: block.testMetadata.testFramework,
						testType: block.testMetadata.testType,
						targetIdentifier: target.targetIdentifier,
					},
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
		await this.neo4jService.clearAll()
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
	 * Examples:
	 *   './utils' -> '/workspace/src/utils.ts'
	 *   '../services/auth' -> '/workspace/src/services/auth.ts'
	 */
	private resolveImportPath(importSource: string, currentFilePath: string): string | null {
		// Skip node_modules imports (external libraries)
		if (!importSource.startsWith(".") && !importSource.startsWith("@/")) {
			return null
		}

		// Handle @/ alias (common in TypeScript projects)
		// For now, we skip these as they require workspace configuration
		if (importSource.startsWith("@/")) {
			return null
		}

		// Handle relative imports
		const currentDir = path.dirname(currentFilePath)
		const resolvedPath = path.resolve(currentDir, importSource)

		// Try common extensions
		const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".cs"]
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

		// Test framework imports to skip
		const testFrameworks = [
			"vitest",
			"jest",
			"@jest",
			"mocha",
			"jasmine",
			"ava",
			"tape",
			"@testing-library",
			"pytest",
			"unittest",
			"nose",
			"testing",
			"testify",
			"ginkgo",
			"junit",
			"testng",
			"nunit",
			"xunit",
			"mstest",
			"rspec",
			"minitest",
			"phpunit",
			"pest",
			"xctest",
		]

		for (const importInfo of testBlock.imports) {
			// Skip test framework imports
			if (testFrameworks.some((framework) => importInfo.source.toLowerCase().includes(framework))) {
				continue
			}

			// Find source file blocks that match the import
			const sourceBlocks = allBlocks.filter((block) => {
				// Skip test blocks
				if (block.testMetadata?.isTest) {
					return false
				}

				// Check if the block's file path matches the import source
				// This is a simplified check - in a real implementation, we'd need proper path resolution
				return block.file_path.includes(importInfo.source) || importInfo.source.includes(block.file_path)
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
					metadata: {
						typeString: typeInfo.type,
						isInferred: typeInfo.isInferred,
						source: "lsp",
					},
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
						metadata: {
							parameterName: param.name,
							typeString: param.type,
							isOptional: param.isOptional,
							source: "lsp",
						},
					})
				}
			}
		}

		return relationships
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
					metadata: {
						typeString: signatureInfo.returnType,
						source: "lsp",
					},
				})
			}
		}

		return relationships
	}
}
