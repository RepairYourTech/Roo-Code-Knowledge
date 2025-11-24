/**
 * Language Server Protocol (LSP) Service Implementation
 * Provides type information and language intelligence using VSCode's LSP APIs
 */

import * as vscode from "vscode"
import {
	ILSPService,
	TypeInfo,
	ParameterInfo,
	SignatureInfo,
	SymbolInfo,
	LSPQueryResult,
	WorkspaceSymbolInfo,
	TypeHierarchyItem,
} from "../interfaces/lsp-service"

/**
 * Implementation of LSP service using VSCode's language features
 */
export class LSPService implements ILSPService {
	/**
	 * Get type information for a symbol at a specific position
	 */
	async getTypeInfo(document: vscode.TextDocument, position: vscode.Position): Promise<TypeInfo | undefined> {
		try {
			// Use hover provider to get type information
			const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
				"vscode.executeHoverProvider",
				document.uri,
				position,
			)

			if (!hovers || hovers.length === 0) {
				return undefined
			}

			// Extract type information from hover content
			const hover = hovers[0]
			const typeString = this.extractTypeFromHover(hover)

			if (!typeString) {
				return undefined
			}

			return {
				type: typeString,
				isInferred: false, // VSCode doesn't provide this info directly
				documentation: this.extractDocumentationFromHover(hover),
			}
		} catch (error) {
			console.error("[LSPService] Error getting type info:", error)
			return undefined
		}
	}

	/**
	 * Get signature information for a function/method at a specific position
	 */
	async getSignatureInfo(
		document: vscode.TextDocument,
		position: vscode.Position,
	): Promise<SignatureInfo | undefined> {
		try {
			// Use signature help provider
			const signatureHelp = await vscode.commands.executeCommand<vscode.SignatureHelp>(
				"vscode.executeSignatureHelpProvider",
				document.uri,
				position,
			)

			if (!signatureHelp || signatureHelp.signatures.length === 0) {
				return undefined
			}

			const signature = signatureHelp.signatures[0]

			// Extract parameters
			const parameters: ParameterInfo[] =
				signature.parameters?.map((param) => {
					const name = typeof param.label === "string" ? param.label : String(param.label[0])

					return {
						name,
						type: this.extractTypeFromMarkdown(param.documentation),
						isOptional: false, // VSCode doesn't provide this directly
						documentation: this.markdownToString(param.documentation),
					}
				}) || []

			// Extract function name and return type from signature label
			const { name, returnType } = this.parseSignatureLabel(signature.label)

			return {
				name,
				parameters,
				returnType,
				documentation: this.markdownToString(signature.documentation),
			}
		} catch (error) {
			console.error("[LSPService] Error getting signature info:", error)
			return undefined
		}
	}

	/**
	 * Get symbol information at a specific position
	 */
	async getSymbolInfo(document: vscode.TextDocument, position: vscode.Position): Promise<SymbolInfo | undefined> {
		try {
			// Get definition to find the symbol
			const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
				"vscode.executeDefinitionProvider",
				document.uri,
				position,
			)

			if (!definitions || definitions.length === 0) {
				return undefined
			}

			const definition = definitions[0]

			// Get type info and signature info
			const typeInfo = await this.getTypeInfo(document, position)
			const signatureInfo = await this.getSignatureInfo(document, position)

			// Get the word at position for the symbol name
			const wordRange = document.getWordRangeAtPosition(position)
			const name = wordRange ? document.getText(wordRange) : ""

			return {
				name,
				kind: vscode.SymbolKind.Variable, // Default, would need document symbols to get accurate kind
				typeInfo,
				signatureInfo,
				location: definition,
			}
		} catch (error) {
			console.error("[LSPService] Error getting symbol info:", error)
			return undefined
		}
	}

	/**
	 * Get all symbols in a document
	 */
	async getDocumentSymbols(document: vscode.TextDocument): Promise<SymbolInfo[]> {
		try {
			const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				"vscode.executeDocumentSymbolProvider",
				document.uri,
			)

			if (!symbols || symbols.length === 0) {
				return []
			}

			return this.flattenDocumentSymbols(symbols, document)
		} catch (error) {
			console.error("[LSPService] Error getting document symbols:", error)
			return []
		}
	}

	/**
	 * Check if LSP is available for a given document
	 */
	async isAvailable(document: vscode.TextDocument): Promise<boolean> {
		try {
			// Try to get document symbols as a test of LSP availability
			const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				"vscode.executeDocumentSymbolProvider",
				document.uri,
			)
			return symbols !== undefined && symbols !== null
		} catch (error) {
			return false
		}
	}

	/**
	 * Query LSP for type information about a code block
	 */
	async queryCodeBlock(filePath: string, startLine: number, endLine: number): Promise<LSPQueryResult> {
		try {
			// Open the document
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath))

			// Check if LSP is available
			const available = await this.isAvailable(document)
			if (!available) {
				return {
					available: false,
					error: "LSP not available for this file",
				}
			}

			// Get the first non-whitespace position in the code block
			const position = this.findFirstSymbolPosition(document, startLine, endLine)
			if (!position) {
				return {
					available: true,
					error: "No symbols found in code block",
				}
			}

			// Get symbol information
			const symbolInfo = await this.getSymbolInfo(document, position)

			return {
				available: true,
				symbolInfo,
			}
		} catch (error) {
			return {
				available: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	/**
	 * Helper: Extract type string from hover content
	 */
	private extractTypeFromHover(hover: vscode.Hover): string | undefined {
		for (const content of hover.contents) {
			if (typeof content === "string") {
				// Look for type annotations in plain text
				const typeMatch = content.match(/:\s*([^\s]+)/)
				if (typeMatch) {
					return typeMatch[1]
				}
			} else if (content instanceof vscode.MarkdownString) {
				// Extract from markdown code blocks
				const codeMatch = content.value.match(/```[\w]*\n(.*?)\n```/s)
				if (codeMatch) {
					const code = codeMatch[1]
					// Look for type annotations
					const typeMatch = code.match(/:\s*([^\s=;,)]+)/)
					if (typeMatch) {
						return typeMatch[1].trim()
					}
				}
			}
		}
		return undefined
	}

	/**
	 * Helper: Extract documentation from hover content
	 */
	private extractDocumentationFromHover(hover: vscode.Hover): string | undefined {
		for (const content of hover.contents) {
			if (typeof content === "string") {
				return content
			} else if (content instanceof vscode.MarkdownString) {
				return content.value
			}
		}
		return undefined
	}

	/**
	 * Helper: Extract type from markdown documentation
	 */
	private extractTypeFromMarkdown(documentation: string | vscode.MarkdownString | undefined): string {
		if (!documentation) {
			return "any"
		}

		const text = typeof documentation === "string" ? documentation : documentation.value
		const typeMatch = text.match(/:\s*([^\s=;,)]+)/)
		return typeMatch ? typeMatch[1].trim() : "any"
	}

	/**
	 * Helper: Convert markdown to plain string
	 */
	private markdownToString(documentation: string | vscode.MarkdownString | undefined): string | undefined {
		if (!documentation) {
			return undefined
		}
		return typeof documentation === "string" ? documentation : documentation.value
	}

	/**
	 * Helper: Parse signature label to extract function name and return type
	 */
	private parseSignatureLabel(label: string): { name: string; returnType: string } {
		// Try to match: functionName(...): returnType
		const match = label.match(/(\w+)\s*\([^)]*\)\s*:\s*(.+)/)
		if (match) {
			return {
				name: match[1],
				returnType: match[2].trim(),
			}
		}

		// Fallback: just extract function name
		const nameMatch = label.match(/(\w+)\s*\(/)
		return {
			name: nameMatch ? nameMatch[1] : "unknown",
			returnType: "void",
		}
	}

	/**
	 * Helper: Flatten nested document symbols
	 */
	private flattenDocumentSymbols(symbols: vscode.DocumentSymbol[], document: vscode.TextDocument): SymbolInfo[] {
		const result: SymbolInfo[] = []

		const flatten = (symbol: vscode.DocumentSymbol, containerName?: string) => {
			const location = new vscode.Location(document.uri, symbol.range)

			result.push({
				name: symbol.name,
				kind: symbol.kind,
				location,
				containerName,
			})

			// Recursively flatten children
			if (symbol.children) {
				for (const child of symbol.children) {
					flatten(child, symbol.name)
				}
			}
		}

		for (const symbol of symbols) {
			flatten(symbol)
		}

		return result
	}

	/**
	 * Helper: Find the first symbol position in a code block
	 */
	private findFirstSymbolPosition(
		document: vscode.TextDocument,
		startLine: number,
		endLine: number,
	): vscode.Position | undefined {
		// Convert to 0-based line numbers
		const start = Math.max(0, startLine - 1)
		const end = Math.min(document.lineCount - 1, endLine - 1)

		for (let line = start; line <= end; line++) {
			const lineText = document.lineAt(line).text
			// Find first non-whitespace, non-comment character
			const match = lineText.match(/^\s*([a-zA-Z_$])/)
			if (match) {
				const character = lineText.indexOf(match[1])
				return new vscode.Position(line, character)
			}
		}

		return undefined
	}

	/**
	 * Search for symbols across the entire workspace
	 */
	async searchWorkspaceSymbols(query: string): Promise<WorkspaceSymbolInfo[]> {
		try {
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				"vscode.executeWorkspaceSymbolProvider",
				query,
			)

			if (!symbols || symbols.length === 0) {
				return []
			}

			// Convert to WorkspaceSymbolInfo and enrich with type information
			const results: WorkspaceSymbolInfo[] = []

			for (const symbol of symbols) {
				// Get language from file extension
				const language = this.getLanguageFromPath(symbol.location.uri.fsPath)

				// Try to get type information for the symbol
				let typeInfo: TypeInfo | undefined
				let signatureInfo: SignatureInfo | undefined

				try {
					const document = await vscode.workspace.openTextDocument(symbol.location.uri)
					const position = symbol.location.range.start

					// Only get type info if LSP is available for this document
					if (await this.isAvailable(document)) {
						typeInfo = await this.getTypeInfo(document, position)
						signatureInfo = await this.getSignatureInfo(document, position)
					}
				} catch (error) {
					// Ignore errors for individual symbols, continue processing
				}

				results.push({
					name: symbol.name,
					kind: symbol.kind,
					location: symbol.location,
					containerName: symbol.containerName,
					typeInfo,
					signatureInfo,
					score: this.calculateSymbolRelevance(symbol.name, query),
					language,
				})
			}

			// Sort by relevance score
			return results.sort((a, b) => (b.score || 0) - (a.score || 0))
		} catch (error) {
			console.error("[LSPService] Error searching workspace symbols:", error)
			return []
		}
	}

	/**
	 * Find all references to a symbol at a specific position
	 */
	async findReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		includeDeclaration = true,
	): Promise<vscode.Location[]> {
		try {
			const references = await vscode.commands.executeCommand<vscode.Location[]>(
				"vscode.executeReferenceProvider",
				document.uri,
				position,
				{ includeDeclaration },
			)

			return references || []
		} catch (error) {
			console.error("[LSPService] Error finding references:", error)
			return []
		}
	}

	/**
	 * Find definitions of a symbol at a specific position
	 */
	async findDefinitions(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
		try {
			const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
				"vscode.executeDefinitionProvider",
				document.uri,
				position,
			)

			return definitions || []
		} catch (error) {
			console.error("[LSPService] Error finding definitions:", error)
			return []
		}
	}

	/**
	 * Find implementations of a symbol at a specific position
	 */
	async findImplementations(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
		try {
			const implementations = await vscode.commands.executeCommand<vscode.Location[]>(
				"vscode.executeImplementationProvider",
				document.uri,
				position,
			)

			return implementations || []
		} catch (error) {
			console.error("[LSPService] Error finding implementations:", error)
			return []
		}
	}

	/**
	 * Search for symbols by type across the workspace
	 */
	async searchByType(typeQuery: string, symbolKind?: vscode.SymbolKind): Promise<WorkspaceSymbolInfo[]> {
		try {
			// First, get all workspace symbols
			const allSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				"vscode.executeWorkspaceSymbolProvider",
				"", // Empty query to get all symbols
			)

			if (!allSymbols || allSymbols.length === 0) {
				return []
			}

			const results: WorkspaceSymbolInfo[] = []

			for (const symbol of allSymbols) {
				// Filter by symbol kind if specified
				if (symbolKind && symbol.kind !== symbolKind) {
					continue
				}

				// Try to get type information for the symbol
				let typeInfo: TypeInfo | undefined
				let signatureInfo: SignatureInfo | undefined

				try {
					const document = await vscode.workspace.openTextDocument(symbol.location.uri)
					const position = symbol.location.range.start

					if (await this.isAvailable(document)) {
						typeInfo = await this.getTypeInfo(document, position)
						signatureInfo = await this.getSignatureInfo(document, position)
					}
				} catch (error) {
					// Ignore errors for individual symbols
				}

				// Check if the type matches the query
				if (this.typeMatchesQuery(typeInfo, signatureInfo, typeQuery)) {
					const language = this.getLanguageFromPath(symbol.location.uri.fsPath)

					results.push({
						name: symbol.name,
						kind: symbol.kind,
						location: symbol.location,
						containerName: symbol.containerName,
						typeInfo,
						signatureInfo,
						score: this.calculateTypeMatchScore(typeInfo, signatureInfo, typeQuery),
						language,
					})
				}
			}

			// Sort by match score
			return results.sort((a, b) => (b.score || 0) - (a.score || 0))
		} catch (error) {
			console.error("[LSPService] Error searching by type:", error)
			return []
		}
	}

	/**
	 * Get type hierarchy for a symbol at a specific position
	 */
	async getTypeHierarchy(
		document: vscode.TextDocument,
		position: vscode.Position,
		direction: "supertypes" | "subtypes",
	): Promise<TypeHierarchyItem[]> {
		try {
			// Try to get type hierarchy if the language server supports it
			// Note: Not all language servers implement this
			const hierarchy = await vscode.commands.executeCommand<any[]>(
				"vscode.executeTypeHierarchyProvider",
				document.uri,
				position,
				direction,
			)

			if (!hierarchy || hierarchy.length === 0) {
				return []
			}

			return hierarchy.map((item) => ({
				name: item.name,
				kind: item.kind,
				location: item.location,
				typeInfo: item.typeInfo,
				parents: item.parents || [],
				children: item.children || [],
			}))
		} catch (error) {
			console.error("[LSPService] Error getting type hierarchy:", error)
			return []
		}
	}

	/**
	 * Check if a language server is available for a given language
	 */
	async isLanguageServerAvailable(language: string): Promise<boolean> {
		try {
			// Try to find a file with the given language
			const files = await vscode.workspace.findFiles(`**/*.${this.getFileExtension(language)}`)

			if (files.length === 0) {
				return false
			}

			// Check if LSP is available for the first file found
			const document = await vscode.workspace.openTextDocument(files[0])
			return await this.isAvailable(document)
		} catch (error) {
			console.error(`[LSPService] Error checking language server availability for ${language}:`, error)
			return false
		}
	}

	/**
	 * Helper: Get programming language from file path
	 */
	private getLanguageFromPath(filePath: string): string | undefined {
		const extension = filePath.split(".").pop()?.toLowerCase()

		const extensionMap: Record<string, string> = {
			ts: "typescript",
			tsx: "typescript",
			js: "javascript",
			jsx: "javascript",
			py: "python",
			java: "java",
			cpp: "cpp",
			c: "c",
			cs: "csharp",
			go: "go",
			rs: "rust",
			php: "php",
			rb: "ruby",
			swift: "swift",
			kt: "kotlin",
			scala: "scala",
			vue: "vue",
			svelte: "svelte",
		}

		return extensionMap[extension || ""] || extension
	}

	/**
	 * Helper: Get file extension from language
	 */
	private getFileExtension(language: string): string {
		const languageMap: Record<string, string> = {
			typescript: "ts",
			javascript: "js",
			python: "py",
			java: "java",
			cpp: "cpp",
			c: "c",
			csharp: "cs",
			go: "go",
			rust: "rs",
			php: "php",
			ruby: "rb",
			swift: "swift",
			kotlin: "kt",
			scala: "scala",
			vue: "vue",
			svelte: "svelte",
		}

		return languageMap[language.toLowerCase()] || language
	}

	/**
	 * Helper: Calculate relevance score for symbol search
	 */
	private calculateSymbolRelevance(symbolName: string, query: string): number {
		const lowerSymbol = symbolName.toLowerCase()
		const lowerQuery = query.toLowerCase()

		// Exact match gets highest score
		if (lowerSymbol === lowerQuery) {
			return 1.0
		}

		// Prefix match gets high score
		if (lowerSymbol.startsWith(lowerQuery)) {
			return 0.8
		}

		// Contains match gets medium score
		if (lowerSymbol.includes(lowerQuery)) {
			return 0.6
		}

		// CamelCase matching
		if (this.camelCaseMatch(lowerSymbol, lowerQuery)) {
			return 0.7
		}

		// Default score
		return 0.3
	}

	/**
	 * Helper: Check if symbol matches query using CamelCase pattern
	 */
	private camelCaseMatch(symbol: string, query: string): boolean {
		const symbolParts = symbol.split(/(?=[A-Z])/).map((p) => p.toLowerCase())
		const queryParts = query.split(/(?=[A-Z])/).map((p) => p.toLowerCase())

		if (queryParts.length > symbolParts.length) {
			return false
		}

		return queryParts.every((part, index) => symbolParts[index]?.startsWith(part))
	}

	/**
	 * Helper: Check if type matches the query
	 */
	private typeMatchesQuery(
		typeInfo: TypeInfo | undefined,
		signatureInfo: SignatureInfo | undefined,
		query: string,
	): boolean {
		const lowerQuery = query.toLowerCase()

		// Check type info
		if (typeInfo && typeInfo.type.toLowerCase().includes(lowerQuery)) {
			return true
		}

		// Check return type in signature info
		if (signatureInfo && signatureInfo.returnType.toLowerCase().includes(lowerQuery)) {
			return true
		}

		// Check parameter types in signature info
		if (signatureInfo) {
			return signatureInfo.parameters.some((param) => param.type.toLowerCase().includes(lowerQuery))
		}

		return false
	}

	/**
	 * Helper: Calculate type match score
	 */
	private calculateTypeMatchScore(
		typeInfo: TypeInfo | undefined,
		signatureInfo: SignatureInfo | undefined,
		query: string,
	): number {
		const lowerQuery = query.toLowerCase()
		let score = 0

		// Score for type info match
		if (typeInfo) {
			const typeLower = typeInfo.type.toLowerCase()
			if (typeLower === lowerQuery) {
				score += 1.0
			} else if (typeLower.includes(lowerQuery)) {
				score += 0.7
			}
		}

		// Score for return type match
		if (signatureInfo) {
			const returnLower = signatureInfo.returnType.toLowerCase()
			if (returnLower === lowerQuery) {
				score += 0.9
			} else if (returnLower.includes(lowerQuery)) {
				score += 0.6
			}

			// Score for parameter type matches
			for (const param of signatureInfo.parameters) {
				const paramLower = param.type.toLowerCase()
				if (paramLower === lowerQuery) {
					score += 0.5
				} else if (paramLower.includes(lowerQuery)) {
					score += 0.3
				}
			}
		}

		return Math.min(score, 1.0) // Cap at 1.0
	}
}
