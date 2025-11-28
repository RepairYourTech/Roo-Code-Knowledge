import { Parser, Query, Tree, QueryCapture, Language } from "web-tree-sitter"

export interface QueryExecutionResult {
	captures: QueryCapture[]
	tier: number
}

/**
 * Executes a query with progressive fallback strategy.
 *
 * Tier 1: Comprehensive Query (Full language support)
 * Tier 2: Simplified Query (Basic definitions only)
 * Tier 3: Emergency Query (Identifiers and strings)
 */
export function executeQueryWithFallback(
	language: Language,
	comprehensiveQuery: Query,
	tree: Tree,
	languageName: string,
): QueryExecutionResult {
	// Tier 1: Comprehensive Query
	try {
		const captures = comprehensiveQuery.captures(tree.rootNode)
		if (captures.length > 0) {
			return { captures, tier: 1 }
		}
	} catch (e) {
		console.warn(`Tier 1 query failed for ${languageName}:`, e)
	}

	// Tier 2: Simplified Query
	try {
		const simplifiedSource = getSimplifiedQuery(languageName)
		if (simplifiedSource) {
			const simplifiedQuery = language.query(simplifiedSource)
			const captures = simplifiedQuery.captures(tree.rootNode)
			if (captures.length > 0) {
				return { captures, tier: 2 }
			}
		}
	} catch (e) {
		console.warn(`Tier 2 query failed for ${languageName}:`, e)
	}

	// Tier 3: Emergency Query
	try {
		const emergencySource = getEmergencyQuery(languageName)
		const emergencyQuery = language.query(emergencySource)
		const captures = emergencyQuery.captures(tree.rootNode)
		return { captures, tier: 3 }
	} catch (e) {
		console.error(`Tier 3 query failed for ${languageName}:`, e)
		return { captures: [], tier: 3 }
	}
}

/**
 * Returns a simplified query for the given language containing only
 * the most essential patterns (functions, classes, imports).
 */
export function getSimplifiedQuery(language: string): string | null {
	switch (language) {
		case "typescript":
		case "javascript":
		case "tsx":
		case "jsx":
			return `
        (function_declaration) @definition.function
        (function_expression) @definition.function
        (arrow_function) @definition.function
        (class_declaration) @definition.class
        (method_definition) @definition.method
        (import_statement) @import
        (export_statement) @export
      `

		case "python":
			return `
        (function_definition) @definition.function
        (class_definition) @definition.class
        (import_statement) @import
        (import_from_statement) @import
      `

		case "rust":
			return `
        (function_item) @definition.function
        (struct_item) @definition.struct
        (impl_item) @definition.impl
        (trait_item) @definition.trait
        (use_declaration) @import
      `

		case "java":
			return `
        (class_declaration) @definition.class
        (method_declaration) @definition.method
        (constructor_declaration) @definition.method
        (import_declaration) @import
      `

		case "go":
			return `
        (function_declaration) @definition.function
        (method_declaration) @definition.method
        (type_declaration) @definition.type
        (import_declaration) @import
      `

		case "cpp":
			return `
        (function_definition) @definition.function
        (class_specifier) @definition.class
        (struct_specifier) @definition.struct
        (using_declaration) @import
      `

		case "c":
			return `
        (function_definition) @definition.function
        (struct_specifier) @definition.struct
        (enum_specifier) @definition.enum
      `

		case "c_sharp":
			return `
        (class_declaration) @definition.class
        (method_declaration) @definition.method
        (interface_declaration) @definition.interface
        (using_directive) @import
      `

		case "ruby":
			return `
        (method) @definition.method
        (class) @definition.class
        (module) @definition.module
      `

		case "php":
			return `
        (function_definition) @definition.function
        (class_declaration) @definition.class
        (method_declaration) @definition.method
        (namespace_use_declaration) @import
      `

		case "swift":
			return `
        (function_declaration) @definition.function
        (class_declaration) @definition.class
        (struct_declaration) @definition.struct
        (import_declaration) @import
      `

		case "kotlin":
			return `
        (function_declaration) @definition.function
        (class_declaration) @definition.class
        (object_declaration) @definition.object
        (import_header) @import
      `

		case "lua":
			return `
        (function_definition) @definition.function
        (function_declaration) @definition.function
      `

		case "ocaml":
			return `
        (value_definition) @definition.function
        (type_definition) @definition.type
        (module_definition) @definition.module
      `

		case "scala":
			return `
        (function_definition) @definition.function
        (class_definition) @definition.class
        (object_definition) @definition.object
        (trait_definition) @definition.trait
        (import_declaration) @import
      `

		case "solidity":
			return `
        (function_definition) @definition.function
        (contract_declaration) @definition.contract
        (interface_declaration) @definition.interface
        (import_directive) @import
      `

		case "elixir":
			return `
        (def) @definition.function
        (defmodule) @definition.module
      `

		case "elm":
			return `
        (value_declaration) @definition.function
        (type_declaration) @definition.type
        (import_clause) @import
      `

		default:
			return null
	}
}

/**
 * Returns the emergency query for the given language.
 * This matches identifiers, strings, and comments to ensure *something* is captured.
 */
export function getEmergencyQuery(language: string): string {
	// Generic fallback that works for most languages
	return `
    (identifier) @name
    (string) @string
    (comment) @comment
  `
}
