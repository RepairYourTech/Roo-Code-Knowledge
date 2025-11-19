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
}
