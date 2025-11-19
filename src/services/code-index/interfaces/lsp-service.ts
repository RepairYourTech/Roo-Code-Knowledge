/**
 * Interface for Language Server Protocol (LSP) service
 * Provides type information and language intelligence
 */

import * as vscode from "vscode"

/**
 * Type information extracted from LSP
 */
export interface TypeInfo {
	/** The type string (e.g., "string", "Promise<User>", "number[]") */
	type: string
	/** Whether this is an inferred type or explicitly declared */
	isInferred: boolean
	/** Documentation/description of the type */
	documentation?: string
}

/**
 * Parameter information from LSP
 */
export interface ParameterInfo {
	/** Parameter name */
	name: string
	/** Parameter type */
	type: string
	/** Whether parameter is optional */
	isOptional: boolean
	/** Default value if any */
	defaultValue?: string
	/** Documentation for the parameter */
	documentation?: string
}

/**
 * Function/method signature information from LSP
 */
export interface SignatureInfo {
	/** Function/method name */
	name: string
	/** Parameter information */
	parameters: ParameterInfo[]
	/** Return type */
	returnType: string
	/** Documentation for the function */
	documentation?: string
	/** Type parameters (generics) */
	typeParameters?: string[]
}

/**
 * Symbol information from LSP
 */
export interface SymbolInfo {
	/** Symbol name */
	name: string
	/** Symbol kind (function, class, variable, etc.) */
	kind: vscode.SymbolKind
	/** Type information */
	typeInfo?: TypeInfo
	/** Signature information (for functions/methods) */
	signatureInfo?: SignatureInfo
	/** Location of the symbol */
	location: vscode.Location
	/** Container name (e.g., class name for a method) */
	containerName?: string
}

/**
 * LSP query result
 */
export interface LSPQueryResult {
	/** Whether LSP information was available */
	available: boolean
	/** Symbol information if available */
	symbolInfo?: SymbolInfo
	/** Error message if LSP query failed */
	error?: string
}

/**
 * Interface for LSP service operations
 */
export interface ILSPService {
	/**
	 * Get type information for a symbol at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @returns Type information or undefined if not available
	 */
	getTypeInfo(document: vscode.TextDocument, position: vscode.Position): Promise<TypeInfo | undefined>

	/**
	 * Get signature information for a function/method at a specific position
	 * @param document The document containing the function
	 * @param position The position within the function
	 * @returns Signature information or undefined if not available
	 */
	getSignatureInfo(document: vscode.TextDocument, position: vscode.Position): Promise<SignatureInfo | undefined>

	/**
	 * Get symbol information at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @returns Symbol information or undefined if not available
	 */
	getSymbolInfo(document: vscode.TextDocument, position: vscode.Position): Promise<SymbolInfo | undefined>

	/**
	 * Get all symbols in a document
	 * @param document The document to get symbols from
	 * @returns Array of symbol information
	 */
	getDocumentSymbols(document: vscode.TextDocument): Promise<SymbolInfo[]>

	/**
	 * Check if LSP is available for a given document
	 * @param document The document to check
	 * @returns True if LSP is available, false otherwise
	 */
	isAvailable(document: vscode.TextDocument): Promise<boolean>

	/**
	 * Query LSP for type information about a code block
	 * @param filePath Path to the file
	 * @param startLine Start line of the code block
	 * @param endLine End line of the code block
	 * @returns LSP query result
	 */
	queryCodeBlock(filePath: string, startLine: number, endLine: number): Promise<LSPQueryResult>
}
