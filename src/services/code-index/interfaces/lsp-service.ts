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

	/**
	 * Search for symbols across the entire workspace
	 * @param query The search query for symbols
	 * @returns Array of workspace symbols matching the query
	 */
	searchWorkspaceSymbols(query: string): Promise<WorkspaceSymbolInfo[]>

	/**
	 * Find all references to a symbol at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @param includeDeclaration Whether to include the declaration in results
	 * @returns Array of locations where the symbol is referenced
	 */
	findReferences(
		document: vscode.TextDocument,
		position: vscode.Position,
		includeDeclaration?: boolean,
	): Promise<vscode.Location[]>

	/**
	 * Find definitions of a symbol at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @returns Array of locations where the symbol is defined
	 */
	findDefinitions(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]>

	/**
	 * Find implementations of a symbol at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @returns Array of locations where the symbol is implemented
	 */
	findImplementations(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]>

	/**
	 * Search for symbols by type across the workspace
	 * @param typeQuery The type to search for (e.g., "Promise<User>", "string[]")
	 * @param symbolKind Optional filter for symbol kind (function, class, etc.)
	 * @returns Array of symbols with the specified type
	 */
	searchByType(typeQuery: string, symbolKind?: vscode.SymbolKind): Promise<WorkspaceSymbolInfo[]>

	/**
	 * Get type hierarchy for a symbol at a specific position
	 * @param document The document containing the symbol
	 * @param position The position of the symbol
	 * @param direction Direction of hierarchy (supertypes or subtypes)
	 * @returns Type hierarchy information
	 */
	getTypeHierarchy(
		document: vscode.TextDocument,
		position: vscode.Position,
		direction: "supertypes" | "subtypes",
	): Promise<TypeHierarchyItem[]>

	/**
	 * Check if a language server is available for a given language
	 * @param language The programming language to check
	 * @returns True if a language server is available
	 */
	isLanguageServerAvailable(language: string): Promise<boolean>
}

/**
 * Extended symbol information for workspace-wide search results
 */
export interface WorkspaceSymbolInfo {
	/** Symbol name */
	name: string
	/** Symbol kind (function, class, variable, etc.) */
	kind: vscode.SymbolKind
	/** Location of the symbol */
	location: vscode.Location
	/** Container name (e.g., class name for a method) */
	containerName?: string
	/** Type information if available */
	typeInfo?: TypeInfo
	/** Signature information for functions/methods */
	signatureInfo?: SignatureInfo
	/** Relevance score for the search result */
	score?: number
	/** Language of the file containing the symbol */
	language?: string
}

/**
 * Type hierarchy item for type relationship navigation
 */
export interface TypeHierarchyItem {
	/** Name of the type */
	name: string
	/** Kind of the type (class, interface, etc.) */
	kind: vscode.SymbolKind
	/** Location where the type is defined */
	location: vscode.Location
	/** Type information */
	typeInfo?: TypeInfo
	/** Parent types in hierarchy */
	parents?: TypeHierarchyItem[]
	/** Child types in hierarchy */
	children?: TypeHierarchyItem[]
}
