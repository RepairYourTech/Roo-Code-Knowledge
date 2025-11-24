import { Node } from "web-tree-sitter"
import { SymbolMetadata, ParameterInfo, ImportInfo, SymbolType, Visibility } from "../types/metadata"

// React-specific metadata types
export interface ReactComponentMetadata {
	componentType: "functional" | "class" | "hoc" | "custom_hook"
	hooks?: string[]
	props?: string[]
	state?: string[]
	eventHandlers?: string[]
	jsxElements?: string[]
	fragments?: boolean
	isExported?: boolean
	extendsComponent?: string
}

export interface ReactHookMetadata {
	hookType: "useState" | "useEffect" | "useContext" | "useReducer" | "useCallback" | "useMemo" | "useRef" | "custom"
	stateName?: string
	setterName?: string
	dependencies?: string[]
	contextName?: string
}

export interface ReactJSXMetadata {
	components: string[]
	props: Record<string, string>
	eventHandlers: Record<string, string>
	fragments: boolean
	spreadProps: boolean
}

// Next.js-specific metadata types
export interface NextJSComponentMetadata {
	componentType:
		| "page"
		| "layout"
		| "loading"
		| "error"
		| "not_found"
		| "server"
		| "client"
		| "api"
		| "route"
		| "middleware"
	routerType: "pages" | "app"
	routePattern?: string
	isDynamic?: boolean
	isCatchAll?: boolean
	isOptionalCatchAll?: boolean
	hasGetServerSideProps?: boolean
	hasGetStaticProps?: boolean
	hasGetStaticPaths?: boolean
	hasGenerateMetadata?: boolean
	hasMetadataExport?: boolean
	nextjsImports?: string[]
	nextjsHooks?: string[]
	nextjsComponents?: string[]
}

export interface NextJSRouteMetadata {
	routeType: "static" | "dynamic" | "catch_all" | "optional_catch_all" | "api"
	routePath: string
	parameters?: string[]
	httpMethods?: string[]
	isSSR?: boolean
	isSSG?: boolean
	isISR?: boolean
	revalidateTime?: number
}

export interface NextJSServerSideMetadata {
	renderingType: "ssr" | "ssg" | "isr" | "csr"
	hasDataFetching?: boolean
	dataFetchingMethod?: "getServerSideProps" | "getStaticProps" | "getStaticPaths"
	revalidateInterval?: number
	cacheStrategy?: "default" | "force-cache" | "no-store"
}

// Angular-specific metadata types
export interface AngularComponentMetadata {
	componentType: "component" | "directive" | "pipe"
	selector?: string
	templateUrl?: string
	template?: string
	styleUrls?: string[]
	styles?: string[]
	inputs?: string[]
	outputs?: string[]
	lifecycleHooks?: string[]
	hostListeners?: string[]
	hostBindings?: string[]
	viewChildren?: string[]
	contentChildren?: string[]
	providers?: string[]
	imports?: string[]
	exports?: string[]
	declarations?: string[]
	bootstrap?: string[]
	isExported?: boolean
	extends?: string
	implements?: string[]
	changeDetection?: "Default" | "OnPush"
	encapsulation?: "Emulated" | "Native" | "None" | "ShadowDom"
	preserveWhitespaces?: boolean
}

export interface AngularServiceMetadata {
	serviceType: "service" | "injectable" | "interceptor" | "guard" | "resolver"
	providedIn?: "root" | "platform" | "any" | string
	constructorDependencies?: string[]
	methods?: string[]
	properties?: string[]
	isExported?: boolean
	extends?: string
	implements?: string[]
}

export interface AngularModuleMetadata {
	moduleType: "root" | "feature" | "shared" | "routing" | "lazy"
	declarations?: string[]
	imports?: string[]
	exports?: string[]
	providers?: string[]
	bootstrap?: string[]
	schemas?: string[]
	id?: string
	isExported?: boolean
	entryComponents?: string[]
	forRoot?: boolean
	forChild?: boolean
}

export interface AngularRoutingMetadata {
	routeType: "route" | "router-outlet" | "router-link" | "router-configuration"
	path?: string
	component?: string
	loadChildren?: string
	children?: string[]
	canActivate?: string[]
	canDeactivate?: string[]
	canLoad?: string[]
	resolve?: Record<string, string>
	data?: Record<string, any>
	outlet?: string
	redirectTo?: string
	pathMatch?: "full" | "prefix"
	isLazyLoaded?: boolean
	isWildcard?: boolean
	isDynamic?: boolean
	parameters?: string[]
}

export interface AngularFormMetadata {
	formType: "template-driven" | "reactive" | "both"
	formGroup?: string
	formControls?: string[]
	formArrays?: string[]
	validators?: string[]
	asyncValidators?: string[]
	submitMethod?: string
	resetMethod?: string
	patchMethod?: string
}

export interface AngularHttpMetadata {
	httpType: "client" | "interceptor" | "service"
	methods?: string[]
	endpoints?: string[]
	interceptors?: string[]
	headers?: string[]
	params?: string[]
	responseType?: string
	timeout?: number
	retry?: number
	cache?: boolean
}

export interface AngularRxJSMetadata {
	observableType?: "subject" | "behavior-subject" | "replay-subject" | "async-subject" | "observable"
	operators?: string[]
	subscriptions?: string[]
	hot?: boolean
	cold?: boolean
	multicast?: boolean
	unsubscribe?: boolean
}

export interface AngularTestMetadata {
	testType: "unit" | "integration" | "e2e"
	testBed?: string
	fixtures?: string[]
	mockProviders?: string[]
	spyOn?: string[]
	beforeEach?: string[]
	afterEach?: string[]
	it?: string[]
	describe?: string[]
}

// Express.js-specific metadata types
export interface ExpressRouteMetadata {
	routeType: "app" | "router"
	httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "ALL" | "USE"
	routePath: string
	parameters?: string[]
	isAsync?: boolean
	middleware?: string[]
	handlerType: "function" | "arrow" | "identifier"
	handlerName?: string
}

export interface ExpressMiddlewareMetadata {
	middlewareType: "application" | "router" | "error" | "builtin"
	middlewareName?: string
	middlewarePath?: string
	isAsync?: boolean
	parameters?: string[]
	handlerType: "function" | "arrow" | "identifier"
	isErrorHandling?: boolean
}

export interface ExpressServerMetadata {
	serverType: "app" | "router"
	port?: number | string
	host?: string
	environment?: "development" | "production" | "test"
	callbackName?: string
	hasStaticFiles?: boolean
	staticPaths?: string[]
}

export interface ExpressApplicationMetadata {
	applicationType: "app" | "router"
	imports?: string[]
	middleware?: string[]
	routes?: string[]
	errorHandlers?: string[]
	hasCors?: boolean
	hasBodyParser?: boolean
	hasAuth?: boolean
	environment?: string
}

export interface ExpressComponentMetadata {
	componentType: "route_handler" | "middleware" | "error_handler" | "server" | "application"
	exportName?: string
	isExported?: boolean
	hasRequestParams?: boolean
	hasQueryParams?: boolean
	hasResponseBody?: boolean
	responseType?: "send" | "json" | "render" | "redirect" | "status" | "end" | "download" | "sendFile"
}

// FastAPI-specific metadata types
export interface FastAPIRouteMetadata {
	routeType: "app" | "router"
	httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "TRACE"
	routePath: string
	parameters?: FastAPIParameterMetadata[]
	isAsync?: boolean
	dependencies?: string[]
	responseModel?: string
	middleware?: string[]
	handlerType: "function" | "async_function" | "method"
	handlerName?: string
	endpointType?: "crud" | "auth" | "webhook" | "static" | "custom"
}

export interface FastAPIParameterMetadata {
	name: string
	type: "Path" | "Query" | "Header" | "Cookie" | "Body" | "Form" | "File" | "UploadFile"
	description?: string
	required?: boolean
	defaultValue?: string
	validation?: FastAPIValidationMetadata
}

export interface FastAPIValidationMetadata {
	minLength?: number
	maxLength?: number
	minValue?: number
	maxValue?: number
	pattern?: string
	regex?: string
	enum?: string[]
}

export interface FastAPIDependencyMetadata {
	name: string
	type: "Depends" | "Annotated" | "class" | "function"
	dependencyClass?: string
	dependencyFunction?: string
	isCached?: boolean
	scope?: "function" | "class" | "module" | "application"
}

export interface FastAPIApplicationMetadata {
	applicationType: "FastAPI" | "APIRouter"
	title?: string
	description?: string
	version?: string
	routes?: string[]
	middleware?: FastAPIMiddlewareMetadata[]
	exceptionHandlers?: FastAPIExceptionHandlerMetadata[]
	corsEnabled?: boolean
	corsConfig?: FastAPICorsMetadata
	staticFiles?: FastAPIStaticFilesMetadata
}

export interface FastAPIMiddlewareMetadata {
	name: string
	type: "custom" | "builtin" | "cors" | "auth"
	path?: string
	options?: Record<string, any>
}

export interface FastAPIExceptionHandlerMetadata {
	exceptionClass: string
	handlerFunction: string
	isAsync?: boolean
}

export interface FastAPICorsMetadata {
	allowOrigins?: string[]
	allowMethods?: string[]
	allowHeaders?: string[]
	allowCredentials?: boolean
	exposeHeaders?: string[]
	maxAge?: number
}

export interface FastAPIStaticFilesMetadata {
	path: string
	directory: string
	name?: string
}

export interface FastAPIPydanticModelMetadata {
	modelType: "BaseModel" | "Settings" | "GenericModel"
	className: string
	fields?: FastAPIFieldMetadata[]
	validators?: FastAPIValidatorMetadata[]
	config?: FastAPIConfigMetadata
	isGeneric?: boolean
	typeParameters?: string[]
}

export interface FastAPIFieldMetadata {
	name: string
	type: string
	description?: string
	required?: boolean
	defaultValue?: any
	alias?: string
	title?: string
	examples?: any[]
	jsonSchemaExtra?: Record<string, any>
	validation?: FastAPIValidationMetadata
}

export interface FastAPIValidatorMetadata {
	fieldName: string
	validatorType: "validator" | "root_validator" | "field_validator" | "model_validator"
	methodName: string
	pre?: boolean
	mode?: "before" | "after" | "wrap"
}

export interface FastAPIConfigMetadata {
	configType: "BaseSettings" | "SettingsConfigDict"
	caseSensitive?: boolean
	envPrefix?: string
	envFile?: string
	envFileEncoding?: string
	extra?: "ignore" | "forbid" | "allow"
	jsonLoads?: string
	jsonDumps?: string
	orm_mode?: boolean
}

/**
 * Extracts symbol metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns SymbolMetadata object or undefined if extraction fails
 */
export function extractSymbolMetadata(node: Node, text: string): SymbolMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text
		const lines = text.split("\n")
		const startLine = node.startPosition.row

		// Determine symbol type based on node type
		const symbolType = getSymbolType(nodeType)
		if (!symbolType) {
			return undefined
		}

		// Extract symbol name
		const name = extractSymbolName(node)
		if (!name) {
			return undefined
		}

		// Determine visibility and export status
		const { visibility, isExported } = extractVisibilityAndExport(node, lines, startLine)

		// Extract documentation
		const documentation = extractDocumentation(node, lines, startLine)

		// Extract decorators
		const decorators = extractDecorators(node)

		// Build base metadata
		const metadata: SymbolMetadata = {
			name,
			type: symbolType,
			visibility,
			isExported,
			documentation,
			decorators,
		}

		// Add type-specific metadata
		if (symbolType === "function" || symbolType === "method") {
			metadata.isAsync = isAsyncFunction(node)
			metadata.parameters = extractParameters(node)
			metadata.returnType = extractReturnType(node)
		}

		if (symbolType === "method") {
			metadata.isStatic = isStaticMethod(node)
			metadata.isAbstract = isAbstractMethod(node)
		}

		if (symbolType === "class") {
			metadata.isAbstract = isAbstractClass(node)
			metadata.extends = extractExtends(node)
			metadata.implements = extractImplements(node)
		}

		if (symbolType === "property") {
			metadata.isStatic = isStaticProperty(node)
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts import information from an import statement node
 * Supports multiple programming languages
 * @param node The import statement node
 * @returns ImportInfo object or null if extraction fails
 */
export function extractImportInfo(node: Node): ImportInfo | null {
	try {
		const nodeType = node.type

		// Handle different import statement types by language
		if (nodeType === "import_statement") {
			// JavaScript/TypeScript
			return extractJSImportInfo(node)
		} else if (nodeType === "import_from_statement") {
			// Python
			return extractPythonImportInfo(node)
		} else if (nodeType === "use_declaration") {
			// Rust
			return extractRustImportInfo(node)
		} else if (nodeType === "import_declaration") {
			// Both Go and Java/C++ use import_declaration
			// We need to differentiate based on the content
			const nodeText = node.text
			if (nodeText.includes("#include")) {
				// C++ include directive
				return extractJavaCppImportInfo(node)
			} else if (nodeText.match(/import\s+["`]/)) {
				// Go import (uses backticks or quotes for path)
				return extractGoImportInfo(node)
			} else {
				// Default to Java/C++ import
				return extractJavaCppImportInfo(node)
			}
		}

		return null
	} catch (error) {
		console.debug(`Failed to extract import info for node type ${node.type}:`, error)
		return null
	}
}

/**
 * Extracts JavaScript/TypeScript import information
 */
function extractJSImportInfo(node: Node): ImportInfo | null {
	const importText = node.text

	// Check if it's a dynamic import
	if (importText.includes("import(")) {
		return extractDynamicImport(node)
	}

	// Extract source (module path)
	const sourceNode = node.childForFieldName("source")
	if (!sourceNode) {
		return null
	}
	const source = sourceNode.text.replace(/['"]/g, "")

	// Check if default import
	const isDefault = isDefaultImport(node)

	// Extract imported symbols
	const symbols = extractImportSymbols(node)

	// Extract alias if present
	const alias = extractImportAlias(node)

	return {
		source,
		symbols,
		isDefault,
		isDynamic: false,
		alias,
	}
}

/**
 * Extracts Python import information
 */
function extractPythonImportInfo(node: Node): ImportInfo | null {
	const importText = node.text

	// Handle "from module import name" pattern
	const moduleNode = node.childForFieldName("module_name")
	const nameNode = node.childForFieldName("name")

	if (moduleNode && nameNode) {
		// from X import Y
		const source = moduleNode.text
		const symbols = [nameNode.text]

		return {
			source,
			symbols,
			isDefault: false,
			isDynamic: false,
		}
	}

	// Handle "import module" pattern
	if (nameNode && !moduleNode) {
		const source = nameNode.text
		return {
			source,
			symbols: [], // Import entire module
			isDefault: true,
			isDynamic: false,
		}
	}

	return null
}

/**
 * Extracts Rust use declaration information
 */
function extractRustImportInfo(node: Node): ImportInfo | null {
	// Rust use declarations can be complex: use std::collections::HashMap;
	const useText = node.text

	// Extract the path components
	const match = useText.match(/use\s+([^;]+);/)
	if (!match) {
		return null
	}

	const fullPath = match[1].trim()

	// Check if it's a self-use (use crate::module)
	const isSelf = fullPath.includes("self")

	// Extract the base path and symbols
	const parts = fullPath.split("::")
	let source: string
	let symbols: string[]

	if (fullPath.includes("*")) {
		// use crate::module::* - glob import
		source = parts.slice(0, -1).join("::")
		symbols = ["*"]
	} else if (parts.length > 1 && !isSelf) {
		// use crate::module::Item - specific item
		source = parts.slice(0, -1).join("::")
		symbols = [parts[parts.length - 1]]
	} else {
		// use crate - module import
		source = fullPath
		symbols = []
	}

	return {
		source,
		symbols,
		isDefault: symbols.length === 0,
		isDynamic: false,
	}
}

/**
 * Extracts Go import declaration information
 */
function extractGoImportInfo(node: Node): ImportInfo | null {
	const importText = node.text

	// Extract import path
	const match = importText.match(/import\s+["`]([^"`]+)["`]/)
	if (!match) {
		return null
	}

	const source = match[1]

	// Check for alias: import alias "path"
	const aliasMatch = importText.match(/(\w+)\s+["`]/)
	const alias = aliasMatch ? aliasMatch[1] : undefined

	return {
		source,
		symbols: [], // Go imports don't specify symbols
		isDefault: true,
		isDynamic: false,
		alias,
	}
}

/**
 * Extracts Java/C++ import information
 */
function extractJavaCppImportInfo(node: Node): ImportInfo | null {
	const importText = node.text

	// Java: import package.Class;
	// C++: #include <header> or #include "header"

	if (importText.startsWith("#include")) {
		// C++ include
		const match = importText.match(/#include\s+[<"]([^>"]+)[>"]/)
		if (!match) {
			return null
		}

		return {
			source: match[1],
			symbols: [],
			isDefault: true,
			isDynamic: false,
		}
	} else {
		// Java import
		const match = importText.match(/import\s+([^;]+);/)
		if (!match) {
			return null
		}

		const fullPath = match[1].trim()

		// Check for wildcard import: import package.*
		const isWildcard = fullPath.endsWith(".*")

		if (isWildcard) {
			const source = fullPath.slice(0, -2)
			return {
				source,
				symbols: ["*"],
				isDefault: false,
				isDynamic: false,
			}
		} else {
			// Specific class import
			const parts = fullPath.split(".")
			const source = parts.slice(0, -1).join(".")
			const symbols = [parts[parts.length - 1]]

			return {
				source,
				symbols,
				isDefault: false,
				isDynamic: false,
			}
		}
	}
}

/**
 * Maps tree-sitter node types to SymbolType
 * Supports multiple programming languages
 */
function getSymbolType(nodeType: string): SymbolType | undefined {
	const typeMap: Record<string, SymbolType> = {
		// Function/Method types
		function_declaration: "function",
		function_signature: "function",
		function_definition: "function",
		function_item: "function",
		method_definition: "method",
		method_signature: "method",
		abstract_method_signature: "method",
		method_declaration: "method",
		constructor_declaration: "method",
		macro_definition: "function", // Rust macros are function-like

		// Class/Interface/Struct types
		class_declaration: "class",
		abstract_class_declaration: "class",
		class_definition: "class", // Python
		class_specifier: "class", // C++
		struct_item: "class", // Rust
		struct_specifier: "class", // C++
		union_specifier: "class", // C++
		impl_item: "class", // Rust impl blocks
		mod_item: "class", // Rust modules
		type_declaration: "class", // Go types
		record_declaration: "class", // Java records

		// Interface types
		interface_declaration: "interface",
		trait_item: "interface", // Rust traits
		annotation_type_declaration: "interface", // Java annotations

		// Enum types
		enum_declaration: "enum",
		enum_item: "enum", // Rust
		enum_specifier: "enum", // C++

		// Type alias types
		type_alias_declaration: "type",
		type_item: "type", // Rust
		type_definition: "type", // C++

		// Property/Field types
		public_field_definition: "property",
		field_declaration: "property", // Java, C++

		// Variable types
		variable_declaration: "variable",
		lexical_declaration: "variable",
		const_item: "variable", // Rust
		static_item: "variable", // Rust
		var_declaration: "variable", // Go
		const_declaration: "variable", // Go
		declaration: "variable", // C++ generic

		// Special cases that need additional processing
		decorated_definition: "function", // Python - will be refined by checking child types
	}

	return typeMap[nodeType]
}

/**
 * Extracts the symbol name from a node
 */
function extractSymbolName(node: Node): string | undefined {
	// Try to get name from different field names
	const nameNode =
		node.childForFieldName("name") ||
		node.childForFieldName("key") ||
		node.childForFieldName("property") ||
		node.children?.find(
			(child) =>
				child &&
				(child.type === "identifier" ||
					child.type === "type_identifier" ||
					child.type === "property_identifier"),
		)

	return nameNode?.text
}

/**
 * Extracts visibility and export information
 */
function extractVisibilityAndExport(
	node: Node,
	lines: string[],
	startLine: number,
): { visibility: Visibility; isExported: boolean } {
	// Default to public
	let visibility: Visibility = "public"
	let isExported = false

	// Check if parent is an export statement
	let parent = node.parent
	while (parent) {
		if (parent.type === "export_statement") {
			isExported = true
			break
		}
		parent = parent.parent
	}

	// Check for visibility modifiers in the node text
	const nodeText = node.text
	if (nodeText.includes("private ")) {
		visibility = "private"
	} else if (nodeText.includes("protected ")) {
		visibility = "protected"
	} else if (nodeText.includes("internal ")) {
		visibility = "internal"
	}

	// Check for export keyword in the line
	const currentLine = lines[startLine]?.trim() || ""
	if (currentLine.startsWith("export ")) {
		isExported = true
	}

	return { visibility, isExported }
}

/**
 * Extracts documentation comments for a symbol
 * Supports multiple programming languages and comment styles
 */
function extractDocumentation(node: Node, lines: string[], startLine: number): string | undefined {
	const docLines: string[] = []

	// Look backwards from the node to find documentation comments
	for (let i = startLine - 1; i >= 0; i--) {
		const line = lines[i].trim()

		// Empty line - continue looking
		if (line === "") {
			continue
		}

		// Check for different language comment styles
		const isComment = isCommentLine(line)

		if (isComment) {
			docLines.unshift(line)
		} else {
			// Non-comment, non-empty line - stop looking
			break
		}
	}

	// Filter out comment markers and join
	const cleanedLines = docLines.map((line) => cleanCommentLine(line)).filter((line) => line.length > 0)

	return cleanedLines.length > 0 ? cleanedLines.join("\n") : undefined
}

/**
 * Checks if a line is a comment in any supported language
 */
function isCommentLine(line: string): boolean {
	return (
		// C-style languages (C++, Java, JavaScript, TypeScript, Rust, C#)
		line.startsWith("//") ||
		line.startsWith("/*") ||
		line.startsWith("*") ||
		line.endsWith("*/") ||
		line.startsWith("/**") ||
		// Python
		line.startsWith("#") ||
		// Shell/Perl/Ruby
		line.startsWith("#") ||
		// Haskell/Lua
		line.startsWith("--") ||
		// Lisp/Scheme
		line.startsWith(";") ||
		// SQL
		line.startsWith("--") ||
		// HTML/XML
		line.startsWith("<!--") ||
		line.endsWith("-->") ||
		// COBOL
		line.startsWith("*") ||
		// Fortran
		line.startsWith("C") ||
		// Ada
		line.startsWith("--")
	)
}

/**
 * Cleans a comment line by removing comment markers
 */
function cleanCommentLine(line: string): string {
	return (
		line
			// C-style multi-line comments
			.replace(/^\/\*\*/, "")
			.replace(/^\/\*/, "")
			.replace(/^\* /, "")
			.replace(/^\*/, "")
			.replace(/ \*\/$/, "")
			.replace(/\/\*$/, "")

			// C-style single-line comments
			.replace(/^\/\/ ?/, "")

			// Python/Shell/Perl/Ruby comments
			.replace(/^# ?/, "")

			// Haskell/Lua/SQL comments
			.replace(/^-- ?/, "")

			// Lisp/Scheme comments
			.replace(/^; ?/, "")

			// HTML/XML comments
			.replace(/^<!--/, "")
			.replace(/-->$/, "")

			// COBOL comments
			.replace(/^\* ?/, "")

			// Fortran comments
			.replace(/^C ?/, "")

			// Ada comments
			.replace(/^-- ?/, "")

			.trim()
	)
}

/**
 * Extracts decorators from a node
 */
function extractDecorators(node: Node): string[] | undefined {
	const decorators: string[] = []

	// Check for decorator children
	for (const child of node.children || []) {
		if (child && child.type === "decorator") {
			decorators.push(child.text)
		}
	}

	// Check if parent has decorators
	let parent = node.parent
	while (parent) {
		for (const child of parent.children || []) {
			if (child && child.type === "decorator") {
				decorators.push(child.text)
			}
		}
		parent = parent.parent
	}

	return decorators.length > 0 ? decorators : undefined
}

/**
 * Checks if a function is async
 */
function isAsyncFunction(node: Node): boolean {
	return node.text.includes("async ") || node.type.includes("async")
}

/**
 * Extracts function parameters
 */
function extractParameters(node: Node): ParameterInfo[] | undefined {
	const parameters: ParameterInfo[] = []

	// Find the parameter list
	const paramList =
		node.childForFieldName("parameters") ||
		node.children?.find((child) => child && child.type === "formal_parameters")

	if (!paramList) {
		return parameters
	}

	// Process each parameter
	for (const child of paramList.children || []) {
		if (
			child &&
			(child.type === "required_parameter" ||
				child.type === "optional_parameter" ||
				child.type === "rest_parameter")
		) {
			const param = extractParameterInfo(child)
			if (param) {
				parameters.push(param)
			}
		}
	}

	return parameters.length > 0 ? parameters : undefined
}

/**
 * Extracts information for a single parameter
 */
function extractParameterInfo(paramNode: Node): ParameterInfo | undefined {
	const nameNode =
		paramNode.childForFieldName("name") ||
		paramNode.children?.find(
			(child) => child && (child.type === "identifier" || child.type === "property_identifier"),
		)

	if (!nameNode) {
		return undefined
	}

	const name = nameNode.text
	const typeNode = paramNode.childForFieldName("type")
	const type = typeNode?.text
	const optional = paramNode.type === "optional_parameter"
	const isRest = paramNode.type === "rest_parameter"
	const defaultValueNode = paramNode.childForFieldName("value")
	const defaultValue = defaultValueNode?.text

	return {
		name,
		type,
		optional,
		defaultValue,
		isRest,
	}
}

/**
 * Extracts return type from a function
 */
function extractReturnType(node: Node): string | undefined {
	const returnTypeNode =
		node.childForFieldName("return_type") ||
		node.children?.find((child) => child && child.type === "type_annotation")

	return returnTypeNode?.text
}

/**
 * Checks if a method is static
 */
function isStaticMethod(node: Node): boolean {
	return node.text.includes("static ")
}

/**
 * Checks if a method is abstract
 */
function isAbstractMethod(node: Node): boolean {
	return node.type === "abstract_method_signature"
}

/**
 * Checks if a class is abstract
 */
function isAbstractClass(node: Node): boolean {
	return node.type === "abstract_class_declaration"
}

/**
 * Extracts parent class name
 */
function extractExtends(node: Node): string | undefined {
	const extendsNode =
		node.childForFieldName("heritage") || node.children?.find((child) => child && child.type === "class_heritage")

	if (!extendsNode) {
		return undefined
	}

	const extendsClause = extendsNode.children?.find((child) => child && child.type === "extends_clause")
	if (!extendsClause) {
		return undefined
	}

	const typeNode = extendsClause.children?.find((child) => child && child.type === "type_identifier")
	return typeNode?.text
}

/**
 * Extracts implemented interfaces
 */
function extractImplements(node: Node): string[] | undefined {
	const implementsNodes: string[] = []

	const heritageNode =
		node.childForFieldName("heritage") || node.children?.find((child) => child && child.type === "class_heritage")

	if (!heritageNode) {
		return undefined
	}

	for (const child of heritageNode.children || []) {
		if (child && child.type === "implements_clause") {
			for (const typeNode of child.children || []) {
				if (typeNode && typeNode.type === "type_identifier") {
					implementsNodes.push(typeNode.text)
				}
			}
		}
	}

	return implementsNodes.length > 0 ? implementsNodes : undefined
}

/**
 * Checks if a property is static
 */
function isStaticProperty(node: Node): boolean {
	return node.text.includes("static ")
}

/**
 * Checks if an import is a default import
 */
function isDefaultImport(node: Node): boolean {
	const importClause = node.childForFieldName("import_clause")
	if (!importClause) {
		return false
	}

	return importClause.children?.some((child) => child && child.type === "identifier") || false
}

/**
 * Extracts imported symbols from an import statement
 */
function extractImportSymbols(node: Node): string[] {
	const symbols: string[] = []
	const importClause = node.childForFieldName("import_clause")

	if (!importClause) {
		return symbols
	}

	// Handle named imports { foo, bar }
	const namedImports = importClause.childForFieldName("named_imports")
	if (namedImports) {
		for (const child of namedImports.children || []) {
			if (child && child.type === "import_specifier") {
				const nameNode =
					child.childForFieldName("name") || child.children?.find((c) => c && c.type === "identifier")
				if (nameNode) {
					symbols.push(nameNode.text)
				}
			}
		}
	}

	// Handle namespace imports * as foo
	const namespaceImport = importClause.childForFieldName("namespace_import")
	if (namespaceImport) {
		const nameNode = namespaceImport.childForFieldName("name")
		if (nameNode) {
			symbols.push("*")
		}
	}

	return symbols
}

/**
 * Extracts import alias
 */
function extractImportAlias(node: Node): string | undefined {
	const importClause = node.childForFieldName("import_clause")
	if (!importClause) {
		return undefined
	}

	// Check for namespace import alias
	const namespaceImport = importClause.childForFieldName("namespace_import")
	if (namespaceImport) {
		const nameNode = namespaceImport.childForFieldName("name")
		if (nameNode) {
			return nameNode.text
		}
	}

	// Check for named import aliases
	const namedImports = importClause.childForFieldName("named_imports")
	if (namedImports) {
		for (const child of namedImports.children || []) {
			if (child && child.type === "import_specifier") {
				const aliasNode = child.childForFieldName("alias")
				if (aliasNode) {
					return aliasNode.text
				}
			}
		}
	}

	return undefined
}

/**
 * Extracts dynamic import information
 */
function extractDynamicImport(node: Node): ImportInfo | null {
	const importText = node.text

	// Extract the module path from import("path")
	const match = importText.match(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)
	if (!match) {
		return null
	}

	const source = match[1]

	return {
		source,
		symbols: [], // Dynamic imports don't have explicit symbols
		isDefault: false,
		isDynamic: true,
	}
}

/**
 * Extracts React component metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ReactComponentMetadata object or undefined if not a React component
 */
export function extractReactComponentMetadata(node: Node, text: string): ReactComponentMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Determine component type
		let componentType: ReactComponentMetadata["componentType"] | undefined

		if (nodeType === "function_declaration" || nodeType === "arrow_function") {
			componentType = "functional"
		} else if (nodeType === "class_declaration") {
			componentType = "class"
		} else if (nodeType === "call_expression" && nodeText.includes("memo")) {
			componentType = "hoc"
		}

		if (!componentType) {
			return undefined
		}

		// Extract React-specific information
		const metadata: ReactComponentMetadata = {
			componentType,
			hooks: extractHooksFromNode(node),
			props: extractPropsFromNode(node),
			state: extractStateFromNode(node),
			eventHandlers: extractEventHandlersFromNode(node),
			jsxElements: extractJSXElementsFromNode(node),
			fragments: hasJSXFragments(node),
			isExported: isReactComponentExported(node),
			extendsComponent: extractExtendsComponent(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract React component metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts React hook metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @returns ReactHookMetadata object or undefined if not a React hook
 */
export function extractReactHookMetadata(node: Node): ReactHookMetadata | undefined {
	try {
		const nodeText = node.text

		// Determine hook type
		let hookType: ReactHookMetadata["hookType"] = "custom"

		if (nodeText.includes("useState")) {
			hookType = "useState"
		} else if (nodeText.includes("useEffect")) {
			hookType = "useEffect"
		} else if (nodeText.includes("useContext")) {
			hookType = "useContext"
		} else if (nodeText.includes("useReducer")) {
			hookType = "useReducer"
		} else if (nodeText.includes("useCallback")) {
			hookType = "useCallback"
		} else if (nodeText.includes("useMemo")) {
			hookType = "useMemo"
		} else if (nodeText.includes("useRef")) {
			hookType = "useRef"
		}

		// Extract hook-specific information
		const metadata: ReactHookMetadata = {
			hookType,
			stateName: extractHookStateName(node),
			setterName: extractHookSetterName(node),
			dependencies: extractHookDependencies(node),
			contextName: extractHookContextName(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract React hook metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts JSX metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @returns ReactJSXMetadata object or undefined if no JSX found
 */
export function extractJSXMetadata(node: Node): ReactJSXMetadata | undefined {
	try {
		const components = extractJSXComponentsFromNode(node)
		const props = extractJSXPropsFromNode(node)
		const eventHandlers = extractJSXEventHandlersFromNode(node)
		const fragments = hasJSXFragments(node)
		const spreadProps = hasJSXSpreadProps(node)

		if (components.length === 0 && !fragments) {
			return undefined
		}

		return {
			components,
			props,
			eventHandlers,
			fragments,
			spreadProps,
		}
	} catch (error) {
		console.debug(`Failed to extract JSX metadata for node type ${node.type}:`, error)
		return undefined
	}
}

// Helper functions for React metadata extraction

function extractHooksFromNode(node: Node): string[] {
	const hooks: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "identifier") {
				const functionName = functionNode.text
				if (functionName.startsWith("use") && functionName.length > 3) {
					hooks.push(functionName)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return hooks
}

function extractPropsFromNode(node: Node): string[] {
	const props: string[] = []

	// Look for Props interfaces or types in the scope
	const traverse = (n: Node) => {
		if (n.type === "interface_declaration" || n.type === "type_alias_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.endsWith("Props")) {
				props.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return props
}

function extractStateFromNode(node: Node): string[] {
	const state: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "variable_declarator") {
			const patternNode = n.childForFieldName("pattern")
			if (patternNode && patternNode.type === "array_pattern") {
				// useState pattern: [state, setState]
				const firstIdentifier =
					patternNode.childForFieldName("name") ||
					patternNode.children?.find((child) => child && child.type === "identifier")
				if (firstIdentifier) {
					state.push(firstIdentifier.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return state
}

function extractEventHandlersFromNode(node: Node): string[] {
	const handlers: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "jsx_attribute") {
			const nameNode = n.childForFieldName("property_name")
			if (nameNode && nameNode.text.startsWith("on") && nameNode.text.length > 2) {
				handlers.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return handlers
}

function extractJSXElementsFromNode(node: Node): string[] {
	const elements: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "jsx_element" || n.type === "jsx_self_closing_element") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				if (nameNode.type === "identifier") {
					elements.push(nameNode.text)
				} else if (nameNode.type === "member_expression") {
					const objectNode = nameNode.childForFieldName("object")
					const propertyNode = nameNode.childForFieldName("property")
					if (objectNode && propertyNode) {
						elements.push(`${objectNode.text}.${propertyNode.text}`)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(elements)] // Remove duplicates
}

function hasJSXFragments(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "jsx_fragment" || n.type === "jsx_opening_fragment") {
			return true
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function isReactComponentExported(node: Node): boolean {
	let parent = node.parent
	while (parent) {
		if (parent.type === "export_statement") {
			return true
		}
		parent = parent.parent
	}
	return false
}

function extractExtendsComponent(node: Node): string | undefined {
	if (node.type !== "class_declaration") {
		return undefined
	}

	const heritageNode = node.childForFieldName("heritage")
	if (!heritageNode) {
		return undefined
	}

	const extendsClause = heritageNode.children?.find((child) => child && child.type === "extends_clause")
	if (!extendsClause) {
		return undefined
	}

	const typeNode = extendsClause.children?.find((child) => child && child.type === "type_identifier")
	if (typeNode) {
		return typeNode.text
	}

	// Check for React.Component or React.PureComponent
	const memberExpressionNode = extendsClause.children?.find((child) => child && child.type === "member_expression")
	if (memberExpressionNode) {
		const objectNode = memberExpressionNode.childForFieldName("object")
		const propertyNode = memberExpressionNode.childForFieldName("property")
		if (objectNode && propertyNode && objectNode.text === "React") {
			return `React.${propertyNode.text}`
		}
	}

	return undefined
}

function extractHookStateName(node: Node): string | undefined {
	if (node.type === "variable_declarator") {
		const patternNode = node.childForFieldName("pattern")
		if (patternNode && patternNode.type === "array_pattern") {
			const firstIdentifier = patternNode.children?.find((child) => child && child.type === "identifier")
			return firstIdentifier?.text
		}
	}
	return undefined
}

function extractHookSetterName(node: Node): string | undefined {
	if (node.type === "variable_declarator") {
		const patternNode = node.childForFieldName("pattern")
		if (patternNode && patternNode.type === "array_pattern") {
			const identifiers = patternNode.children?.filter((child) => child && child.type === "identifier")
			return identifiers && identifiers.length > 1 ? identifiers[1]?.text : undefined
		}
	}
	return undefined
}

function extractHookDependencies(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const children = argumentsNode.children || []
				// Look for array as second argument (useEffect, useCallback, useMemo)
				if (children.length >= 2) {
					const arrayNode = children[1]
					if (arrayNode && arrayNode.type === "array") {
						const dependencies: string[] = []
						for (const child of arrayNode.children || []) {
							if (child && child.type === "identifier") {
								dependencies.push(child.text)
							}
						}
						return dependencies
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractHookContextName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "useContext") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode) {
					const firstArg = argumentsNode.children?.[0]
					if (firstArg && firstArg.type === "identifier") {
						return firstArg.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractJSXComponentsFromNode(node: Node): string[] {
	const components: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "jsx_element" || n.type === "jsx_self_closing_element") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				if (nameNode.type === "identifier" && /^[A-Z]/.test(nameNode.text)) {
					components.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(components)]
}

function extractJSXPropsFromNode(node: Node): Record<string, string> {
	const props: Record<string, string> = {}

	const traverse = (n: Node) => {
		if (n.type === "jsx_attribute") {
			const nameNode = n.childForFieldName("property_name")
			const valueNode = n.childForFieldName("value")

			if (nameNode) {
				const propName = nameNode.text
				let propValue = "boolean"

				if (valueNode) {
					if (valueNode.type === "string") {
						propValue = "string"
					} else if (valueNode.type === "jsx_expression") {
						propValue = "expression"
					}
				}

				props[propName] = propValue
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return props
}

function extractJSXEventHandlersFromNode(node: Node): Record<string, string> {
	const handlers: Record<string, string> = {}

	const traverse = (n: Node) => {
		if (n.type === "jsx_attribute") {
			const nameNode = n.childForFieldName("property_name")
			if (nameNode && nameNode.text.startsWith("on") && nameNode.text.length > 2) {
				const valueNode = n.childForFieldName("value")
				if (valueNode && valueNode.type === "jsx_expression") {
					const identifierNode = valueNode.children?.find((child) => child && child.type === "identifier")
					if (identifierNode) {
						handlers[nameNode.text] = identifierNode.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return handlers
}

function hasJSXSpreadProps(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "jsx_attribute") {
			const valueNode = n.childForFieldName("value")
			if (valueNode && valueNode.type === "jsx_expression") {
				const objectNode = valueNode.children?.find((child) => child && child.type === "object")
				if (objectNode) {
					return true
				}
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

/**
 * Extracts Next.js component metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param filePath The file path to determine routing context
 * @param text The full file content
 * @returns NextJSComponentMetadata object or undefined if not a Next.js component
 */
export function extractNextJSComponentMetadata(
	node: Node,
	filePath: string,
	text: string,
): NextJSComponentMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Determine component type and router type based on file path and node
		const { componentType, routerType } = determineNextJSComponentType(node, filePath)

		if (!componentType) {
			return undefined
		}

		// Extract Next.js-specific information
		const metadata: NextJSComponentMetadata = {
			componentType,
			routerType,
			routePattern: extractRoutePattern(filePath),
			isDynamic: isDynamicRoute(filePath),
			isCatchAll: isCatchAllRoute(filePath),
			isOptionalCatchAll: isOptionalCatchAllRoute(filePath),
			hasGetServerSideProps: hasGetServerSideProps(node),
			hasGetStaticProps: hasGetStaticProps(node),
			hasGetStaticPaths: hasGetStaticPaths(node),
			hasGenerateMetadata: hasGenerateMetadata(node),
			hasMetadataExport: hasMetadataExport(node),
			nextjsImports: extractNextJSImports(node),
			nextjsHooks: extractNextJSHooks(node),
			nextjsComponents: extractNextJSComponents(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Next.js component metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Next.js route metadata from file path and content
 * @param filePath The file path
 * @param text The full file content
 * @returns NextJSRouteMetadata object or undefined if not a Next.js route
 */
export function extractNextJSRouteMetadata(filePath: string, text: string): NextJSRouteMetadata | undefined {
	try {
		// Determine if this is a Next.js route file
		if (!isNextJSRouteFile(filePath)) {
			return undefined
		}

		const routeType = determineRouteType(filePath)
		const routePath = extractRoutePath(filePath)
		const parameters = extractRouteParameters(filePath)
		const httpMethods = extractHTTPMethods(text)
		const isSSR = text.includes("getServerSideProps")
		const isSSG = text.includes("getStaticProps")
		const isISR = text.includes("revalidate") && text.includes("getStaticProps")
		const revalidateTime = extractRevalidateTime(text)

		const metadata: NextJSRouteMetadata = {
			routeType,
			routePath,
			parameters,
			httpMethods,
			isSSR,
			isSSG,
			isISR,
			revalidateTime,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Next.js route metadata for ${filePath}:`, error)
		return undefined
	}
}

/**
 * Extracts Next.js server-side metadata from file content
 * @param text The full file content
 * @returns NextJSServerSideMetadata object or undefined if no server-side patterns found
 */
export function extractNextJSServerSideMetadata(text: string): NextJSServerSideMetadata | undefined {
	try {
		const hasDataFetching =
			text.includes("getServerSideProps") || text.includes("getStaticProps") || text.includes("getStaticPaths")

		if (!hasDataFetching) {
			return undefined
		}

		let renderingType: NextJSServerSideMetadata["renderingType"] = "csr"
		let dataFetchingMethod: NextJSServerSideMetadata["dataFetchingMethod"]
		let revalidateInterval: number | undefined
		let cacheStrategy: NextJSServerSideMetadata["cacheStrategy"] = "default"

		if (text.includes("getServerSideProps")) {
			renderingType = "ssr"
			dataFetchingMethod = "getServerSideProps"
		} else if (text.includes("getStaticProps")) {
			if (text.includes("revalidate")) {
				renderingType = "isr"
				revalidateInterval = extractRevalidateTime(text)
			} else {
				renderingType = "ssg"
			}
			dataFetchingMethod = "getStaticProps"
		}

		if (text.includes("force-cache")) {
			cacheStrategy = "force-cache"
		} else if (text.includes("no-store")) {
			cacheStrategy = "no-store"
		}

		const metadata: NextJSServerSideMetadata = {
			renderingType,
			hasDataFetching,
			dataFetchingMethod,
			revalidateInterval,
			cacheStrategy,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Next.js server-side metadata:`, error)
		return undefined
	}
}

// Helper functions for Next.js metadata extraction

function determineNextJSComponentType(
	node: Node,
	filePath: string,
): { componentType: NextJSComponentMetadata["componentType"]; routerType: NextJSComponentMetadata["routerType"] } {
	const routerType = filePath.includes("/pages/") ? "pages" : "app"
	const nodeText = node.text

	// Check for client directive first
	if (nodeText.includes("'use client'") || nodeText.includes('"use client"')) {
		return { componentType: "client", routerType }
	}

	// Check for specific component types based on file name and patterns
	if (filePath.includes("/pages/api/") || (routerType === "app" && filePath.includes("/route.ts"))) {
		return { componentType: "api", routerType }
	}

	if (routerType === "app") {
		if (filePath.includes("/layout.") || filePath.includes("/layout.")) {
			return { componentType: "layout", routerType }
		}
		if (filePath.includes("/loading.") || filePath.includes("/loading.")) {
			return { componentType: "loading", routerType }
		}
		if (filePath.includes("/error.") || filePath.includes("/error.")) {
			return { componentType: "error", routerType }
		}
		if (filePath.includes("/not-found.") || filePath.includes("/not-found.")) {
			return { componentType: "not_found", routerType }
		}
		if (filePath.includes("/route.") || filePath.includes("/route.")) {
			return { componentType: "route", routerType }
		}
	}

	// Check for server components (async functions without use client)
	if (nodeText.includes("async") && (node.type === "function_declaration" || node.type === "arrow_function")) {
		return { componentType: "server", routerType }
	}

	// Default to page for route files
	if (isNextJSRouteFile(filePath)) {
		return { componentType: "page", routerType }
	}

	// Check for middleware
	if (nodeText.includes("middleware") || filePath.includes("middleware.")) {
		return { componentType: "middleware", routerType }
	}

	return { componentType: "page", routerType }
}

function extractRoutePattern(filePath: string): string | undefined {
	// Extract route pattern from file path
	if (filePath.includes("/pages/")) {
		const pagesIndex = filePath.indexOf("/pages/")
		const routePath = filePath.substring(pagesIndex + 7) // Remove '/pages/'
		return routePath.replace(/\.(tsx?|jsx?)$/, "") // Remove extension
	}

	if (filePath.includes("/app/")) {
		const appIndex = filePath.indexOf("/app/")
		const routePath = filePath.substring(appIndex + 5) // Remove '/app/'
		return routePath.replace(/\.(tsx?|jsx?)$/, "") // Remove extension
	}

	return undefined
}

function isDynamicRoute(filePath: string): boolean {
	// Check for dynamic routes like [slug].js
	return /\[.*?\]/.test(filePath) && !isCatchAllRoute(filePath) && !isOptionalCatchAllRoute(filePath)
}

function isCatchAllRoute(filePath: string): boolean {
	// Check for catch-all routes like [...slug].js
	return /\[\.\.\..*?\]/.test(filePath)
}

function isOptionalCatchAllRoute(filePath: string): boolean {
	// Check for optional catch-all routes like [[...slug]].js
	return /\[\[\.\.\..*?\]\]/.test(filePath)
}

function hasGetServerSideProps(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "export_statement") {
			if (n.text.includes("getServerSideProps")) {
				return true
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function hasGetStaticProps(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "export_statement") {
			if (n.text.includes("getStaticProps")) {
				return true
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function hasGetStaticPaths(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "export_statement") {
			if (n.text.includes("getStaticPaths")) {
				return true
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function hasGenerateMetadata(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "export_statement") {
			if (n.text.includes("generateMetadata")) {
				return true
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function hasMetadataExport(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "export_statement") {
			if (n.text.includes("metadata")) {
				return true
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractNextJSImports(node: Node): string[] {
	const imports: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "import_statement") {
			if (
				n.text.includes("from 'next'") ||
				n.text.includes('from "next"') ||
				n.text.includes("from 'next/") ||
				n.text.includes('from "next/')
			) {
				// Extract the import names
				const importMatch = n.text.match(/import\s*{([^}]+)}\s*from\s*['"]next/)
				if (importMatch) {
					const importNames = importMatch[1].split(",").map((name) => name.trim())
					imports.push(...importNames)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(imports)] // Remove duplicates
}

function extractNextJSHooks(node: Node): string[] {
	const hooks: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "identifier") {
				const functionName = functionNode.text
				if (
					functionName.startsWith("use") &&
					["useRouter", "usePathname", "useSearchParams", "useParams"].includes(functionName)
				) {
					hooks.push(functionName)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)] // Remove duplicates
}

function extractNextJSComponents(node: Node): string[] {
	const components: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "jsx_element" || n.type === "jsx_self_closing_element") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.type === "member_expression") {
				const objectNode = nameNode.childForFieldName("object")
				const propertyNode = nameNode.childForFieldName("property")
				if (objectNode && propertyNode && objectNode.text === "next") {
					components.push(`next.${propertyNode.text}`)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(components)] // Remove duplicates
}

function isNextJSRouteFile(filePath: string): boolean {
	// Check if file is in a Next.js route directory
	return filePath.includes("/pages/") || filePath.includes("/app/")
}

function determineRouteType(filePath: string): NextJSRouteMetadata["routeType"] {
	if (filePath.includes("/pages/api/") || (filePath.includes("/app/") && filePath.includes("/route."))) {
		return "api"
	}

	if (isOptionalCatchAllRoute(filePath)) {
		return "optional_catch_all"
	}

	if (isCatchAllRoute(filePath)) {
		return "catch_all"
	}

	if (isDynamicRoute(filePath)) {
		return "dynamic"
	}

	return "static"
}

function extractRoutePath(filePath: string): string {
	let routePath = ""

	if (filePath.includes("/pages/")) {
		const pagesIndex = filePath.indexOf("/pages/")
		routePath = filePath.substring(pagesIndex + 7) // Remove '/pages/'
	} else if (filePath.includes("/app/")) {
		const appIndex = filePath.indexOf("/app/")
		routePath = filePath.substring(appIndex + 5) // Remove '/app/'
	}

	// Remove file extension
	routePath = routePath.replace(/\.(tsx?|jsx?)$/, "")

	// Handle special files
	if (routePath.endsWith("/index")) {
		return routePath.slice(0, -5) || "/"
	}

	if (routePath.endsWith("/route")) {
		return routePath.slice(0, -6) || "/"
	}

	return routePath
}

function extractRouteParameters(filePath: string): string[] {
	const parameters: string[] = []

	// Extract parameters from dynamic route patterns
	const matches = filePath.match(/\[([^\]]+)\]/g)
	if (matches) {
		for (const match of matches) {
			let param = match.slice(1, -1) // Remove brackets
			if (param.startsWith("...")) {
				param = param.slice(3) // Remove ...
			}
			parameters.push(param)
		}
	}

	return parameters
}

function extractHTTPMethods(text: string): string[] {
	const methods: string[] = []
	const httpMethodNames = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]

	for (const method of httpMethodNames) {
		if (
			text.includes(`export function ${method}(`) ||
			text.includes(`export const ${method} =`) ||
			text.includes(`export async function ${method}(`)
		) {
			methods.push(method)
		}
	}

	return methods
}

function extractRevalidateTime(text: string): number | undefined {
	const revalidateMatch = text.match(/revalidate\s*:\s*(\d+)/)
	if (revalidateMatch) {
		return parseInt(revalidateMatch[1], 10)
	}
	return undefined
}

/**
 * Extracts Angular component metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularComponentMetadata object or undefined if not an Angular component
 */
export function extractAngularComponentMetadata(node: Node, text: string): AngularComponentMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Determine component type
		let componentType: AngularComponentMetadata["componentType"] | undefined

		if (nodeType === "class_declaration") {
			// Check for decorators to determine type
			const decorators = extractDecorators(node)
			if (decorators) {
				if (decorators.some((d) => d.includes("@Component"))) {
					componentType = "component"
				} else if (decorators.some((d) => d.includes("@Directive"))) {
					componentType = "directive"
				} else if (decorators.some((d) => d.includes("@Pipe"))) {
					componentType = "pipe"
				}
			}
		}

		if (!componentType) {
			return undefined
		}

		// Extract Angular-specific information
		const metadata: AngularComponentMetadata = {
			componentType,
			selector: extractAngularSelector(node),
			templateUrl: extractAngularTemplateUrl(node),
			template: extractAngularTemplate(node),
			styleUrls: extractAngularStyleUrls(node),
			styles: extractAngularStyles(node),
			inputs: extractAngularInputs(node),
			outputs: extractAngularOutputs(node),
			lifecycleHooks: extractAngularLifecycleHooks(node),
			hostListeners: extractAngularHostListeners(node),
			hostBindings: extractAngularHostBindings(node),
			viewChildren: extractAngularViewChildren(node),
			contentChildren: extractAngularContentChildren(node),
			providers: extractAngularProviders(node),
			imports: extractAngularImports(node),
			exports: extractAngularExports(node),
			declarations: extractAngularDeclarations(node),
			bootstrap: extractAngularBootstrap(node),
			isExported: isAngularComponentExported(node),
			extends: extractAngularExtends(node),
			implements: extractAngularImplements(node),
			changeDetection: extractAngularChangeDetection(node),
			encapsulation: extractAngularEncapsulation(node),
			preserveWhitespaces: extractAngularPreserveWhitespaces(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular component metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular service metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularServiceMetadata object or undefined if not an Angular service
 */
export function extractAngularServiceMetadata(node: Node, text: string): AngularServiceMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Determine service type
		let serviceType: AngularServiceMetadata["serviceType"] | undefined

		if (nodeType === "class_declaration") {
			// Check for decorators to determine type
			const decorators = extractDecorators(node)
			if (decorators) {
				if (decorators.some((d) => d.includes("@Injectable"))) {
					serviceType = "service"
				} else if (decorators.some((d) => d.includes("@Interceptor"))) {
					serviceType = "interceptor"
				} else if (decorators.some((d) => d.includes("@CanActivate") || d.includes("@CanDeactivate"))) {
					serviceType = "guard"
				} else if (decorators.some((d) => d.includes("@Resolve"))) {
					serviceType = "resolver"
				}
			}
		}

		if (!serviceType) {
			return undefined
		}

		// Extract Angular-specific information
		const metadata: AngularServiceMetadata = {
			serviceType,
			providedIn: extractAngularProvidedIn(node),
			constructorDependencies: extractAngularConstructorDependencies(node),
			methods: extractAngularMethods(node),
			properties: extractAngularProperties(node),
			isExported: isAngularServiceExported(node),
			extends: extractAngularExtends(node),
			implements: extractAngularImplements(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular service metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular module metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularModuleMetadata object or undefined if not an Angular module
 */
export function extractAngularModuleMetadata(node: Node, text: string): AngularModuleMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Check if this is an NgModule
		if (nodeType !== "class_declaration") {
			return undefined
		}

		const decorators = extractDecorators(node)
		if (!decorators || !decorators.some((d) => d.includes("@NgModule"))) {
			return undefined
		}

		// Determine module type
		const moduleType = determineAngularModuleType(node, text)

		// Extract Angular-specific information
		const metadata: AngularModuleMetadata = {
			moduleType,
			declarations: extractAngularModuleDeclarations(node),
			imports: extractAngularModuleImports(node),
			exports: extractAngularModuleExports(node),
			providers: extractAngularModuleProviders(node),
			bootstrap: extractAngularModuleBootstrap(node),
			schemas: extractAngularModuleSchemas(node),
			id: extractAngularModuleId(node),
			isExported: isAngularModuleExported(node),
			entryComponents: extractAngularModuleEntryComponents(node),
			forRoot: hasAngularModuleForRoot(node),
			forChild: hasAngularModuleForChild(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular module metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular routing metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularRoutingMetadata object or undefined if not an Angular route
 */
export function extractAngularRoutingMetadata(node: Node, text: string): AngularRoutingMetadata | undefined {
	try {
		const nodeType = node.type
		const nodeText = node.text

		// Determine routing type
		let routeType: AngularRoutingMetadata["routeType"] | undefined

		if (nodeType === "assignment_expression" && nodeText.includes("Routes")) {
			routeType = "router-configuration"
		} else if (nodeText.includes("router-outlet")) {
			routeType = "router-outlet"
		} else if (nodeText.includes("routerLink")) {
			routeType = "router-link"
		} else if (nodeText.includes("path") && nodeText.includes("component")) {
			routeType = "route"
		}

		if (!routeType) {
			return undefined
		}

		// Extract Angular routing information
		const metadata: AngularRoutingMetadata = {
			routeType,
			path: extractAngularRoutePath(node),
			component: extractAngularRouteComponent(node),
			loadChildren: extractAngularRouteLoadChildren(node),
			children: extractAngularRouteChildren(node),
			canActivate: extractAngularRouteCanActivate(node),
			canDeactivate: extractAngularRouteCanDeactivate(node),
			canLoad: extractAngularRouteCanLoad(node),
			resolve: extractAngularRouteResolve(node),
			data: extractAngularRouteData(node),
			outlet: extractAngularRouteOutlet(node),
			redirectTo: extractAngularRouteRedirectTo(node),
			pathMatch: extractAngularRoutePathMatch(node),
			isLazyLoaded: hasAngularRouteLazyLoading(node),
			isWildcard: isAngularRouteWildcard(node),
			isDynamic: isAngularRouteDynamic(node),
			parameters: extractAngularRouteParameters(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular routing metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular form metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularFormMetadata object or undefined if no Angular forms found
 */
export function extractAngularFormMetadata(node: Node, text: string): AngularFormMetadata | undefined {
	try {
		const hasTemplateDriven = hasAngularTemplateDrivenForms(node, text)
		const hasReactiveForms = hasAngularReactiveForms(node, text)

		if (!hasTemplateDriven && !hasReactiveForms) {
			return undefined
		}

		const formType: AngularFormMetadata["formType"] =
			hasTemplateDriven && hasReactiveForms ? "both" : hasTemplateDriven ? "template-driven" : "reactive"

		// Extract Angular form information
		const metadata: AngularFormMetadata = {
			formType,
			formGroup: extractAngularFormGroup(node),
			formControls: extractAngularFormControls(node),
			formArrays: extractAngularFormArrays(node),
			validators: extractAngularValidators(node),
			asyncValidators: extractAngularAsyncValidators(node),
			submitMethod: extractAngularSubmitMethod(node),
			resetMethod: extractAngularResetMethod(node),
			patchMethod: extractAngularPatchMethod(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular form metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular HTTP metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularHttpMetadata object or undefined if no Angular HTTP found
 */
export function extractAngularHttpMetadata(node: Node, text: string): AngularHttpMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is HTTP-related
		if (!nodeText.includes("http") && !nodeText.includes("Http") && !nodeText.includes("HttpClient")) {
			return undefined
		}

		// Determine HTTP type
		let httpType: AngularHttpMetadata["httpType"] = "client"
		if (nodeText.includes("Interceptor")) {
			httpType = "interceptor"
		} else if (nodeText.includes("Service")) {
			httpType = "service"
		}

		// Extract Angular HTTP information
		const metadata: AngularHttpMetadata = {
			httpType,
			methods: extractAngularHttpMethods(node),
			endpoints: extractAngularHttpEndpoints(node),
			interceptors: extractAngularHttpInterceptors(node),
			headers: extractAngularHttpHeaders(node),
			params: extractAngularHttpParams(node),
			responseType: extractAngularHttpResponseType(node),
			timeout: extractAngularHttpTimeout(node),
			retry: extractAngularHttpRetry(node),
			cache: extractAngularHttpCache(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular HTTP metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular RxJS metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularRxJSMetadata object or undefined if no Angular RxJS found
 */
export function extractAngularRxJSMetadata(node: Node, text: string): AngularRxJSMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is RxJS-related
		if (
			!nodeText.includes("Observable") &&
			!nodeText.includes("Subject") &&
			!nodeText.includes("pipe") &&
			!nodeText.includes("subscribe")
		) {
			return undefined
		}

		// Extract Angular RxJS information
		const metadata: AngularRxJSMetadata = {
			observableType: extractAngularObservableType(node),
			operators: extractAngularRxjsOperators(node),
			subscriptions: extractAngularRxjsSubscriptions(node),
			hot: isAngularRxjsHot(node),
			cold: isAngularRxjsCold(node),
			multicast: isAngularRxjsMulticast(node),
			unsubscribe: hasAngularRxjsUnsubscribe(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular RxJS metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Angular test metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns AngularTestMetadata object or undefined if no Angular tests found
 */
export function extractAngularTestMetadata(node: Node, text: string): AngularTestMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is test-related
		if (!nodeText.includes("describe") && !nodeText.includes("it") && !nodeText.includes("TestBed")) {
			return undefined
		}

		// Determine test type
		let testType: AngularTestMetadata["testType"] = "unit"
		if (nodeText.includes("integration") || nodeText.includes("IntegrationTest")) {
			testType = "integration"
		} else if (nodeText.includes("e2e") || nodeText.includes("E2E")) {
			testType = "e2e"
		}

		// Extract Angular test information
		const metadata: AngularTestMetadata = {
			testType,
			testBed: extractAngularTestBed(node),
			fixtures: extractAngularTestFixtures(node),
			mockProviders: extractAngularTestMockProviders(node),
			spyOn: extractAngularTestSpyOn(node),
			beforeEach: extractAngularTestBeforeEach(node),
			afterEach: extractAngularTestAfterEach(node),
			it: extractAngularTestIt(node),
			describe: extractAngularTestDescribe(node),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Angular test metadata for node type ${node.type}:`, error)
		return undefined
	}
}

// Helper functions for Angular metadata extraction

function extractAngularSelector(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const selectorMatch = n.text.match(/selector\s*:\s*['"`]([^'"`]+)['"`]/)
			if (selectorMatch) {
				return selectorMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularTemplateUrl(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const templateUrlMatch = n.text.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/)
			if (templateUrlMatch) {
				return templateUrlMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularTemplate(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const templateMatch = n.text.match(/template\s*:\s*['"`]([^'"`]+)['"`]/)
			if (templateMatch) {
				return templateMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularStyleUrls(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const styleUrlsMatch = n.text.match(/styleUrls\s*:\s*\[([^\]]+)\]/)
			if (styleUrlsMatch) {
				const urls = styleUrlsMatch[1].split(",").map((url) => url.trim().replace(/['"`]/g, ""))
				return urls.filter((url) => url.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularStyles(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const stylesMatch = n.text.match(/styles\s*:\s*\[([^\]]+)\]/)
			if (stylesMatch) {
				const styles = stylesMatch[1].split(",").map((style) => style.trim().replace(/['"`]/g, ""))
				return styles.filter((style) => style.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularInputs(node: Node): string[] {
	const inputs: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@Input")) {
			const inputMatch = n.text.match(/@Input\(['"`']([^'"`']+)['"`']\)/)
			if (inputMatch) {
				inputs.push(inputMatch[1])
			} else {
				// Find the property name after decorator
				const nextSibling = n.nextSibling
				if (nextSibling && nextSibling.type === "public_field_definition") {
					const nameNode = nextSibling.childForFieldName("name")
					if (nameNode) {
						inputs.push(nameNode.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(inputs)]
}

function extractAngularOutputs(node: Node): string[] {
	const outputs: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@Output")) {
			const outputMatch = n.text.match(/@Output\(['"`']([^'"`']+)['"`']\)/)
			if (outputMatch) {
				outputs.push(outputMatch[1])
			} else {
				// Find the property name after decorator
				const nextSibling = n.nextSibling
				if (nextSibling && nextSibling.type === "public_field_definition") {
					const nameNode = nextSibling.childForFieldName("name")
					if (nameNode) {
						outputs.push(nameNode.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(outputs)]
}

function extractAngularLifecycleHooks(node: Node): string[] {
	const lifecycleHooks: string[] = []
	const hookNames = [
		"ngOnInit",
		"ngOnChanges",
		"ngDoCheck",
		"ngAfterContentInit",
		"ngAfterContentChecked",
		"ngAfterViewInit",
		"ngAfterViewChecked",
		"ngOnDestroy",
	]

	const traverse = (n: Node) => {
		if (n.type === "method_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && hookNames.includes(nameNode.text)) {
				lifecycleHooks.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(lifecycleHooks)]
}

function extractAngularHostListeners(node: Node): string[] {
	const hostListeners: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@HostListener")) {
			const listenerMatch = n.text.match(/@HostListener\(['"`']([^'"`']+)['"`']/)
			if (listenerMatch) {
				hostListeners.push(listenerMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hostListeners)]
}

function extractAngularHostBindings(node: Node): string[] {
	const hostBindings: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@HostBinding")) {
			const bindingMatch = n.text.match(/@HostBinding\(['"`']([^'"`']+)['"`']/)
			if (bindingMatch) {
				hostBindings.push(bindingMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hostBindings)]
}

function extractAngularViewChildren(node: Node): string[] {
	const viewChildren: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && (n.text.includes("@ViewChild") || n.text.includes("@ViewChildren"))) {
			const childMatch = n.text.match(/@(?:ViewChild|ViewChildren)\(['"`']([^'"`']+)['"`']/)
			if (childMatch) {
				viewChildren.push(childMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(viewChildren)]
}

function extractAngularContentChildren(node: Node): string[] {
	const contentChildren: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && (n.text.includes("@ContentChild") || n.text.includes("@ContentChildren"))) {
			const childMatch = n.text.match(/@(?:ContentChild|ContentChildren)\(['"`']([^'"`']+)['"`']/)
			if (childMatch) {
				contentChildren.push(childMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(contentChildren)]
}

function extractAngularProviders(node: Node): string[] {
	const providers: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("providers")) {
			const providersMatch = n.text.match(/providers\s*:\s*\[([^\]]+)\]/)
			if (providersMatch) {
				const providerList = providersMatch[1].split(",").map((provider) => provider.trim())
				providers.push(...providerList.filter((provider) => provider.length > 0))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(providers)]
}

function extractAngularImports(node: Node): string[] {
	const imports: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("imports")) {
			const importsMatch = n.text.match(/imports\s*:\s*\[([^\]]+)\]/)
			if (importsMatch) {
				const importList = importsMatch[1].split(",").map((imp) => imp.trim())
				imports.push(...importList.filter((imp) => imp.length > 0))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(imports)]
}

function extractAngularExports(node: Node): string[] {
	const exports: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("exports")) {
			const exportsMatch = n.text.match(/exports\s*:\s*\[([^\]]+)\]/)
			if (exportsMatch) {
				const exportList = exportsMatch[1].split(",").map((exp) => exp.trim())
				exports.push(...exportList.filter((exp) => exp.length > 0))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(exports)]
}

function extractAngularDeclarations(node: Node): string[] {
	const declarations: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("declarations")) {
			const declarationsMatch = n.text.match(/declarations\s*:\s*\[([^\]]+)\]/)
			if (declarationsMatch) {
				const declarationList = declarationsMatch[1].split(",").map((decl) => decl.trim())
				declarations.push(...declarationList.filter((decl) => decl.length > 0))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(declarations)]
}

function extractAngularBootstrap(node: Node): string[] {
	const bootstrap: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("bootstrap")) {
			const bootstrapMatch = n.text.match(/bootstrap\s*:\s*\[([^\]]+)\]/)
			if (bootstrapMatch) {
				const bootstrapList = bootstrapMatch[1].split(",").map((comp) => comp.trim())
				bootstrap.push(...bootstrapList.filter((comp) => comp.length > 0))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(bootstrap)]
}

function isAngularComponentExported(node: Node): boolean {
	let parent = node.parent
	while (parent) {
		if (parent.type === "export_statement") {
			return true
		}
		parent = parent.parent
	}
	return false
}

function extractAngularExtends(node: Node): string | undefined {
	const heritageNode = node.childForFieldName("heritage")
	if (!heritageNode) {
		return undefined
	}

	const extendsClause = heritageNode.children?.find((child) => child && child.type === "extends_clause")
	if (!extendsClause) {
		return undefined
	}

	const typeNode = extendsClause.children?.find((child) => child && child.type === "type_identifier")
	return typeNode?.text
}

function extractAngularImplements(node: Node): string[] | undefined {
	const implementsNodes: string[] = []

	const heritageNode = node.childForFieldName("heritage")
	if (!heritageNode) {
		return undefined
	}

	for (const child of heritageNode.children || []) {
		if (child && child.type === "implements_clause") {
			for (const typeNode of child.children || []) {
				if (typeNode && typeNode.type === "type_identifier") {
					implementsNodes.push(typeNode.text)
				}
			}
		}
	}

	return implementsNodes.length > 0 ? implementsNodes : undefined
}

function extractAngularChangeDetection(node: Node): AngularComponentMetadata["changeDetection"] | undefined {
	const traverse = (n: Node): AngularComponentMetadata["changeDetection"] | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const changeDetectionMatch = n.text.match(/changeDetection\s*:\s*ChangeDetectionStrategy\.(\w+)/)
			if (changeDetectionMatch) {
				return changeDetectionMatch[1] as AngularComponentMetadata["changeDetection"]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularEncapsulation(node: Node): AngularComponentMetadata["encapsulation"] | undefined {
	const traverse = (n: Node): AngularComponentMetadata["encapsulation"] | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const encapsulationMatch = n.text.match(/encapsulation\s*:\s*ViewEncapsulation\.(\w+)/)
			if (encapsulationMatch) {
				return encapsulationMatch[1] as AngularComponentMetadata["encapsulation"]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularPreserveWhitespaces(node: Node): boolean | undefined {
	const traverse = (n: Node): boolean | undefined => {
		if (n.type === "decorator" && n.text.includes("@Component")) {
			const preserveMatch = n.text.match(/preserveWhitespaces\s*:\s*(true|false)/)
			if (preserveMatch) {
				return preserveMatch[1] === "true"
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result !== undefined) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularProvidedIn(node: Node): AngularServiceMetadata["providedIn"] | undefined {
	const traverse = (n: Node): AngularServiceMetadata["providedIn"] | undefined => {
		if (n.type === "decorator" && n.text.includes("@Injectable")) {
			const providedInMatch = n.text.match(/providedIn\s*:\s*['"`']([^'"`']+)['"`']/)
			if (providedInMatch) {
				return providedInMatch[1] as AngularServiceMetadata["providedIn"]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularConstructorDependencies(node: Node): string[] {
	const dependencies: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_definition" && n.text.includes("constructor")) {
			const parametersNode = n.childForFieldName("parameters")
			if (parametersNode) {
				for (const param of parametersNode.children || []) {
					if (param && (param.type === "required_parameter" || param.type === "optional_parameter")) {
						const typeNode = param.childForFieldName("type")
						if (typeNode) {
							dependencies.push(typeNode.text)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(dependencies)]
}

function extractAngularMethods(node: Node): string[] {
	const methods: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				methods.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(methods)]
}

function extractAngularProperties(node: Node): string[] {
	const properties: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "public_field_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				properties.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(properties)]
}

function isAngularServiceExported(node: Node): boolean {
	let parent = node.parent
	while (parent) {
		if (parent.type === "export_statement") {
			return true
		}
		parent = parent.parent
	}
	return false
}

function determineAngularModuleType(node: Node, text: string): AngularModuleMetadata["moduleType"] {
	const nodeText = node.text

	// Check for root module (bootstrap property)
	if (nodeText.includes("bootstrap")) {
		return "root"
	}

	// Check for routing module
	if (nodeText.includes("RouterModule") || nodeText.includes("forRoot") || nodeText.includes("forChild")) {
		return "routing"
	}

	// Check for shared module (common imports/exports)
	if (nodeText.includes("CommonModule") && nodeText.includes("FormsModule")) {
		return "shared"
	}

	// Check for feature module (has declarations)
	if (nodeText.includes("declarations")) {
		return "feature"
	}

	// Default to lazy loaded module
	return "lazy"
}

function extractAngularModuleDeclarations(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const declarationsMatch = n.text.match(/declarations\s*:\s*\[([^\]]+)\]/)
			if (declarationsMatch) {
				const declarationList = declarationsMatch[1].split(",").map((decl) => decl.trim())
				return declarationList.filter((decl) => decl.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleImports(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const importsMatch = n.text.match(/imports\s*:\s*\[([^\]]+)\]/)
			if (importsMatch) {
				const importList = importsMatch[1].split(",").map((imp) => imp.trim())
				return importList.filter((imp) => imp.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleExports(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const exportsMatch = n.text.match(/exports\s*:\s*\[([^\]]+)\]/)
			if (exportsMatch) {
				const exportList = exportsMatch[1].split(",").map((exp) => exp.trim())
				return exportList.filter((exp) => exp.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleProviders(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const providersMatch = n.text.match(/providers\s*:\s*\[([^\]]+)\]/)
			if (providersMatch) {
				const providerList = providersMatch[1].split(",").map((provider) => provider.trim())
				return providerList.filter((provider) => provider.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleBootstrap(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const bootstrapMatch = n.text.match(/bootstrap\s*:\s*\[([^\]]+)\]/)
			if (bootstrapMatch) {
				const bootstrapList = bootstrapMatch[1].split(",").map((comp) => comp.trim())
				return bootstrapList.filter((comp) => comp.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleSchemas(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const schemasMatch = n.text.match(/schemas\s*:\s*\[([^\]]+)\]/)
			if (schemasMatch) {
				const schemaList = schemasMatch[1].split(",").map((schema) => schema.trim())
				return schemaList.filter((schema) => schema.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularModuleId(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const idMatch = n.text.match(/id\s*:\s*['"`']([^'"`']+)['"`']/)
			if (idMatch) {
				return idMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function isAngularModuleExported(node: Node): boolean {
	let parent = node.parent
	while (parent) {
		if (parent.type === "export_statement") {
			return true
		}
		parent = parent.parent
	}
	return false
}

function extractAngularModuleEntryComponents(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "decorator" && n.text.includes("@NgModule")) {
			const entryComponentsMatch = n.text.match(/entryComponents\s*:\s*\[([^\]]+)\]/)
			if (entryComponentsMatch) {
				const entryComponentList = entryComponentsMatch[1].split(",").map((comp) => comp.trim())
				return entryComponentList.filter((comp) => comp.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function hasAngularModuleForRoot(node: Node): boolean {
	return node.text.includes("forRoot")
}

function hasAngularModuleForChild(node: Node): boolean {
	return node.text.includes("forChild")
}

function extractAngularRoutePath(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "pair" && n.text.includes("path")) {
			const pathMatch = n.text.match(/path\s*:\s*['"`']([^'"`']+)['"`']/)
			if (pathMatch) {
				return pathMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteComponent(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "pair" && n.text.includes("component")) {
			const componentMatch = n.text.match(/component\s*:\s*(\w+)/)
			if (componentMatch) {
				return componentMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteLoadChildren(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "pair" && n.text.includes("loadChildren")) {
			const loadChildrenMatch = n.text.match(/loadChildren\s*:\s*['"`']([^'"`']+)['"`']/)
			if (loadChildrenMatch) {
				return loadChildrenMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteChildren(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "pair" && n.text.includes("children")) {
			const childrenMatch = n.text.match(/children\s*:\s*\[([^\]]+)\]/)
			if (childrenMatch) {
				const childrenList = childrenMatch[1].split(",").map((child) => child.trim())
				return childrenList.filter((child) => child.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteCanActivate(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "pair" && n.text.includes("canActivate")) {
			const canActivateMatch = n.text.match(/canActivate\s*:\s*\[([^\]]+)\]/)
			if (canActivateMatch) {
				const canActivateList = canActivateMatch[1].split(",").map((guard) => guard.trim())
				return canActivateList.filter((guard) => guard.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteCanDeactivate(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "pair" && n.text.includes("canDeactivate")) {
			const canDeactivateMatch = n.text.match(/canDeactivate\s*:\s*\[([^\]]+)\]/)
			if (canDeactivateMatch) {
				const canDeactivateList = canDeactivateMatch[1].split(",").map((guard) => guard.trim())
				return canDeactivateList.filter((guard) => guard.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteCanLoad(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "pair" && n.text.includes("canLoad")) {
			const canLoadMatch = n.text.match(/canLoad\s*:\s*\[([^\]]+)\]/)
			if (canLoadMatch) {
				const canLoadList = canLoadMatch[1].split(",").map((guard) => guard.trim())
				return canLoadList.filter((guard) => guard.length > 0)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteResolve(node: Node): Record<string, string> | undefined {
	const traverse = (n: Node): Record<string, string> | undefined => {
		if (n.type === "pair" && n.text.includes("resolve")) {
			const resolveMatch = n.text.match(/resolve\s*:\s*{([^}]+)}/)
			if (resolveMatch) {
				const resolveObj: Record<string, string> = {}
				const resolvePairs = resolveMatch[1].split(",")
				for (const pair of resolvePairs) {
					const [key, value] = pair.split(":").map((s) => s.trim())
					if (key && value) {
						resolveObj[key] = value
					}
				}
				return resolveObj
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteData(node: Node): Record<string, any> | undefined {
	const traverse = (n: Node): Record<string, any> | undefined => {
		if (n.type === "pair" && n.text.includes("data")) {
			const dataMatch = n.text.match(/data\s*:\s*{([^}]+)}/)
			if (dataMatch) {
				const dataObj: Record<string, any> = {}
				const dataPairs = dataMatch[1].split(",")
				for (const pair of dataPairs) {
					const [key, value] = pair.split(":").map((s) => s.trim())
					if (key && value) {
						dataObj[key] = value
					}
				}
				return dataObj
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteOutlet(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "pair" && n.text.includes("outlet")) {
			const outletMatch = n.text.match(/outlet\s*:\s*['"`']([^'"`']+)['"`']/)
			if (outletMatch) {
				return outletMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRouteRedirectTo(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "pair" && n.text.includes("redirectTo")) {
			const redirectToMatch = n.text.match(/redirectTo\s*:\s*['"`']([^'"`']+)['"`']/)
			if (redirectToMatch) {
				return redirectToMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularRoutePathMatch(node: Node): AngularRoutingMetadata["pathMatch"] | undefined {
	const traverse = (n: Node): AngularRoutingMetadata["pathMatch"] | undefined => {
		if (n.type === "pair" && n.text.includes("pathMatch")) {
			const pathMatchMatch = n.text.match(/pathMatch\s*:\s*['"`']([^'"`']+)['"`']/)
			if (pathMatchMatch) {
				return pathMatchMatch[1] as AngularRoutingMetadata["pathMatch"]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function hasAngularRouteLazyLoading(node: Node): boolean {
	return node.text.includes("loadChildren")
}

function isAngularRouteWildcard(node: Node): boolean {
	const path = extractAngularRoutePath(node)
	return path ? path.includes("**") : false
}

function isAngularRouteDynamic(node: Node): boolean {
	const path = extractAngularRoutePath(node)
	return path ? path.includes(":") : false
}

function extractAngularRouteParameters(node: Node): string[] | undefined {
	const path = extractAngularRoutePath(node)
	if (!path) {
		return undefined
	}

	const parameters: string[] = []
	const paramMatches = path.match(/:([^\/]+)/g)
	if (paramMatches) {
		for (const match of paramMatches) {
			parameters.push(match.slice(1)) // Remove colon
		}
	}

	return parameters.length > 0 ? parameters : undefined
}

function hasAngularTemplateDrivenForms(node: Node, text: string): boolean {
	return text.includes("ngModel") || text.includes("NgForm") || text.includes("FormsModule")
}

function hasAngularReactiveForms(node: Node, text: string): boolean {
	return (
		text.includes("FormGroup") ||
		text.includes("FormControl") ||
		text.includes("FormArray") ||
		text.includes("ReactiveFormsModule")
	)
}

function extractAngularFormGroup(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "variable_declarator" && n.text.includes("FormGroup")) {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				return nameNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularFormControls(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "variable_declarator" && n.text.includes("FormControl")) {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				return [nameNode.text]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularFormArrays(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "variable_declarator" && n.text.includes("FormArray")) {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				return [nameNode.text]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularValidators(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "call_expression" && n.text.includes("Validators")) {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const propertyNode = functionNode.childForFieldName("property")
				if (propertyNode) {
					return [propertyNode.text]
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularAsyncValidators(node: Node): string[] | undefined {
	const traverse = (n: Node): string[] | undefined => {
		if (n.type === "call_expression" && n.text.includes("AsyncValidators")) {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const propertyNode = functionNode.childForFieldName("property")
				if (propertyNode) {
					return [propertyNode.text]
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularSubmitMethod(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "method_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.includes("submit") || nameNode.text.includes("onSubmit"))) {
				return nameNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularResetMethod(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "method_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.includes("reset") || nameNode.text.includes("onReset"))) {
				return nameNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularPatchMethod(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "method_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.includes("patch") || nameNode.text.includes("onPatch"))) {
				return nameNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularHttpMethods(node: Node): string[] | undefined {
	const methods: string[] = []
	const httpMethods = ["get", "post", "put", "delete", "patch", "head", "options", "request"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const objectNode = functionNode.childForFieldName("object")
				const propertyNode = functionNode.childForFieldName("property")
				if (
					objectNode &&
					objectNode.text === "http" &&
					propertyNode &&
					httpMethods.includes(propertyNode.text)
				) {
					methods.push(propertyNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return methods.length > 0 ? [...new Set(methods)] : undefined
}

function extractAngularHttpEndpoints(node: Node): string[] | undefined {
	const endpoints: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "string") {
					endpoints.push(firstArg.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return endpoints.length > 0 ? [...new Set(endpoints)] : undefined
}

function extractAngularHttpInterceptors(node: Node): string[] | undefined {
	const interceptors: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_declaration" && n.text.includes("Interceptor")) {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				interceptors.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return interceptors.length > 0 ? [...new Set(interceptors)] : undefined
}

function extractAngularHttpHeaders(node: Node): string[] | undefined {
	const headers: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("HttpHeaders")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "object") {
					// Extract header keys from object
					for (const child of firstArg.children || []) {
						if (child && child.type === "pair") {
							const keyNode = child.childForFieldName("key")
							if (keyNode) {
								headers.push(keyNode.text)
							}
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return headers.length > 0 ? [...new Set(headers)] : undefined
}

function extractAngularHttpParams(node: Node): string[] | undefined {
	const params: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("HttpParams")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "object") {
					// Extract param keys from object
					for (const child of firstArg.children || []) {
						if (child && child.type === "pair") {
							const keyNode = child.childForFieldName("key")
							if (keyNode) {
								params.push(keyNode.text)
							}
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return params.length > 0 ? [...new Set(params)] : undefined
}

function extractAngularHttpResponseType(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const responseTypeMatch = n.text.match(/responseType\s*:\s*['"`']([^'"`']+)['"`']/)
				if (responseTypeMatch) {
					return responseTypeMatch[1]
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularHttpTimeout(node: Node): number | undefined {
	const traverse = (n: Node): number | undefined => {
		if (n.type === "call_expression") {
			const timeoutMatch = n.text.match(/timeout\s*:\s*(\d+)/)
			if (timeoutMatch) {
				return parseInt(timeoutMatch[1], 10)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result !== undefined) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularHttpRetry(node: Node): number | undefined {
	const traverse = (n: Node): number | undefined => {
		if (n.type === "call_expression") {
			const retryMatch = n.text.match(/retry\s*:\s*(\d+)/)
			if (retryMatch) {
				return parseInt(retryMatch[1], 10)
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result !== undefined) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularHttpCache(node: Node): boolean | undefined {
	const traverse = (n: Node): boolean | undefined => {
		if (n.type === "call_expression") {
			const cacheMatch = n.text.match(/cache\s*:\s*(true|false)/)
			if (cacheMatch) {
				return cacheMatch[1] === "true"
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result !== undefined) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularObservableType(node: Node): AngularRxJSMetadata["observableType"] | undefined {
	const nodeText = node.text

	if (nodeText.includes("Subject")) {
		if (nodeText.includes("BehaviorSubject")) {
			return "behavior-subject"
		} else if (nodeText.includes("ReplaySubject")) {
			return "replay-subject"
		} else if (nodeText.includes("AsyncSubject")) {
			return "async-subject"
		}
		return "subject"
	} else if (nodeText.includes("Observable")) {
		return "observable"
	}

	return undefined
}

function extractAngularRxjsOperators(node: Node): string[] | undefined {
	const operators: string[] = []
	const commonOperators = [
		"pipe",
		"map",
		"filter",
		"tap",
		"switchMap",
		"mergeMap",
		"concatMap",
		"exhaustMap",
		"take",
		"takeWhile",
		"skip",
		"first",
		"last",
		"debounceTime",
		"throttleTime",
		"distinctUntilChanged",
		"catchError",
	]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const propertyNode = functionNode.childForFieldName("property")
				if (propertyNode && commonOperators.includes(propertyNode.text)) {
					operators.push(propertyNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return operators.length > 0 ? [...new Set(operators)] : undefined
}

function extractAngularRxjsSubscriptions(node: Node): string[] | undefined {
	const subscriptions: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "subscribe") {
				const parent = n.parent
				if (parent && parent.type === "variable_declarator") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						subscriptions.push(nameNode.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return subscriptions.length > 0 ? [...new Set(subscriptions)] : undefined
}

function isAngularRxjsHot(node: Node): boolean {
	return node.text.includes("share") || node.text.includes("publish") || node.text.includes("multicast")
}

function isAngularRxjsCold(node: Node): boolean {
	return node.text.includes("Observable") && !isAngularRxjsHot(node)
}

function isAngularRxjsMulticast(node: Node): boolean {
	return node.text.includes("multicast") || node.text.includes("share") || node.text.includes("publish")
}

function hasAngularRxjsUnsubscribe(node: Node): boolean {
	return node.text.includes("unsubscribe") || node.text.includes("takeUntil") || node.text.includes("take(1)")
}

function extractAngularTestBed(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression" && n.text.includes("TestBed")) {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const propertyNode = functionNode.childForFieldName("property")
				if (
					propertyNode &&
					["configureTestingModule", "compileComponents", "createComponent", "inject"].includes(
						propertyNode.text,
					)
				) {
					return propertyNode.text
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractAngularTestFixtures(node: Node): string[] | undefined {
	const fixtures: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("TestBed.createComponent")) {
			const parent = n.parent
			if (parent && parent.type === "variable_declarator") {
				const nameNode = parent.childForFieldName("name")
				if (nameNode) {
					fixtures.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return fixtures.length > 0 ? [...new Set(fixtures)] : undefined
}

function extractAngularTestMockProviders(node: Node): string[] | undefined {
	const mockProviders: string[] = []

	const traverse = (n: Node) => {
		if (
			(n.type === "call_expression" && n.text.includes("provideMockStore")) ||
			n.text.includes("jasmine.createSpyObj")
		) {
			const parent = n.parent
			if (parent && parent.type === "variable_declarator") {
				const nameNode = parent.childForFieldName("name")
				if (nameNode) {
					mockProviders.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return mockProviders.length > 0 ? [...new Set(mockProviders)] : undefined
}

function extractAngularTestSpyOn(node: Node): string[] | undefined {
	const spyOn: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("spyOn")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "identifier") {
					spyOn.push(firstArg.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return spyOn.length > 0 ? [...new Set(spyOn)] : undefined
}

function extractAngularTestBeforeEach(node: Node): string[] | undefined {
	const beforeEach: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("beforeEach")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "arrow_function") {
					beforeEach.push("beforeEach")
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return beforeEach.length > 0 ? beforeEach : undefined
}

function extractAngularTestAfterEach(node: Node): string[] | undefined {
	const afterEach: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("afterEach")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "arrow_function") {
					afterEach.push("afterEach")
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return afterEach.length > 0 ? afterEach : undefined
}

function extractAngularTestIt(node: Node): string[] | undefined {
	const it: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && (n.text.includes("it") || n.text.includes("test"))) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "string") {
					it.push(firstArg.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return it.length > 0 ? it : undefined
}

function extractAngularTestDescribe(node: Node): string[] | undefined {
	const describe: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("describe")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "string") {
					describe.push(firstArg.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return describe.length > 0 ? describe : undefined
}

/**
 * Extracts Express.js route metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ExpressRouteMetadata object or undefined if not an Express.js route
 */
export function extractExpressRouteMetadata(node: Node, text: string): ExpressRouteMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is an Express.js route
		if (!isExpressRoute(nodeText)) {
			return undefined
		}

		// Determine route type and HTTP method
		const { routeType, httpMethod } = extractExpressRouteInfo(nodeText)

		// Extract route path
		const routePath = extractExpressRoutePath(node)

		// Extract route parameters
		const parameters = extractExpressRouteParameters(routePath)

		// Check if route is async
		const isAsync = extractExpressRouteAsync(node)

		// Extract middleware
		const middleware = extractExpressRouteMiddleware(node)

		// Extract handler information
		const { handlerType, handlerName } = extractExpressRouteHandler(node)

		const metadata: ExpressRouteMetadata = {
			routeType,
			httpMethod,
			routePath,
			parameters,
			isAsync,
			middleware,
			handlerType,
			handlerName,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Express.js route metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Express.js middleware metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ExpressMiddlewareMetadata object or undefined if not an Express.js middleware
 */
export function extractExpressMiddlewareMetadata(node: Node, text: string): ExpressMiddlewareMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is an Express.js middleware
		if (!isExpressMiddleware(nodeText)) {
			return undefined
		}

		// Determine middleware type
		const { middlewareType, middlewareName, middlewarePath } = extractExpressMiddlewareInfo(nodeText)

		// Check if middleware is async
		const isAsync = extractExpressRouteAsync(node)

		// Extract parameters
		const parameters = extractExpressMiddlewareParameters(node)

		// Extract handler information
		const { handlerType } = extractExpressRouteHandler(node)

		// Check if it's error handling middleware
		const isErrorHandling = extractExpressErrorHandling(node)

		const metadata: ExpressMiddlewareMetadata = {
			middlewareType,
			middlewareName,
			middlewarePath,
			isAsync,
			parameters,
			handlerType,
			isErrorHandling,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Express.js middleware metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Express.js server metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ExpressServerMetadata object or undefined if not an Express.js server
 */
export function extractExpressServerMetadata(node: Node, text: string): ExpressServerMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is an Express.js server
		if (!isExpressServer(nodeText)) {
			return undefined
		}

		// Determine server type
		const serverType = extractExpressServerType(nodeText)

		// Extract port and host
		const { port, host } = extractExpressServerConfig(node)

		// Extract environment
		const environment = extractExpressEnvironment(nodeText)

		// Extract callback name
		const callbackName = extractExpressServerCallback(node)

		// Check for static files
		const { hasStaticFiles, staticPaths } = extractExpressStaticFiles(node)

		const metadata: ExpressServerMetadata = {
			serverType,
			port,
			host,
			environment,
			callbackName,
			hasStaticFiles,
			staticPaths,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Express.js server metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Express.js application metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ExpressApplicationMetadata object or undefined if not an Express.js application
 */
export function extractExpressApplicationMetadata(node: Node, text: string): ExpressApplicationMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is an Express.js application
		if (!isExpressApplication(nodeText)) {
			return undefined
		}

		// Determine application type
		const applicationType = extractExpressApplicationType(nodeText)

		// Extract imports
		const imports = extractExpressImports(node)

		// Extract middleware
		const middleware = extractExpressAppMiddleware(node)

		// Extract routes
		const routes = extractExpressAppRoutes(node)

		// Extract error handlers
		const errorHandlers = extractExpressErrorHandlers(node)

		// Check for common middleware
		const hasCors = nodeText.includes("cors") || nodeText.includes("Cors")
		const hasBodyParser =
			nodeText.includes("bodyParser") || nodeText.includes("json") || nodeText.includes("urlencoded")
		const hasAuth = nodeText.includes("auth") || nodeText.includes("passport") || nodeText.includes("jwt")

		// Extract environment
		const environment = extractExpressEnvironment(nodeText)

		const metadata: ExpressApplicationMetadata = {
			applicationType,
			imports,
			middleware,
			routes,
			errorHandlers,
			hasCors,
			hasBodyParser,
			hasAuth,
			environment,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Express.js application metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Express.js component metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns ExpressComponentMetadata object or undefined if not an Express.js component
 */
export function extractExpressComponentMetadata(node: Node, text: string): ExpressComponentMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is an Express.js component
		if (!isExpressComponent(nodeText)) {
			return undefined
		}

		// Determine component type
		const componentType = extractExpressComponentType(nodeText)

		// Extract export name
		const exportName = extractExpressExportName(node)

		// Check if exported
		const isExported = extractExpressIsExported(node)

		// Check for request parameters
		const hasRequestParams = extractExpressHasRequestParams(node)

		// Check for query parameters
		const hasQueryParams = extractExpressHasQueryParams(node)

		// Check for response body
		const hasResponseBody = extractExpressHasResponseBody(node)

		// Extract response type
		const responseType = extractExpressResponseType(node)

		const metadata: ExpressComponentMetadata = {
			componentType,
			exportName,
			isExported,
			hasRequestParams,
			hasQueryParams,
			hasResponseBody,
			responseType,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Express.js component metadata for node type ${node.type}:`, error)
		return undefined
	}
}

// Helper functions for Express.js metadata extraction

function isExpressRoute(nodeText: string): boolean {
	const routePatterns = [
		/app\.(get|post|put|delete|patch|head|options|all)\s*\(/,
		/router\.(get|post|put|delete|patch|head|options|all)\s*\(/,
	]

	return routePatterns.some((pattern) => pattern.test(nodeText))
}

function isExpressMiddleware(nodeText: string): boolean {
	const middlewarePatterns = [/app\.use\s*\(/, /router\.use\s*\(/]

	return middlewarePatterns.some((pattern) => pattern.test(nodeText))
}

function isExpressServer(nodeText: string): boolean {
	const serverPatterns = [/express\s*\(\s*\)/, /\.listen\s*\(/]

	return serverPatterns.some((pattern) => pattern.test(nodeText))
}

function isExpressApplication(nodeText: string): boolean {
	const appPatterns = [/express\s*\(\s*\)/, /express\.Router\s*\(\s*\)/]

	return appPatterns.some((pattern) => pattern.test(nodeText))
}

function isExpressComponent(nodeText: string): boolean {
	// Check for common Express.js patterns
	return (
		isExpressRoute(nodeText) ||
		isExpressMiddleware(nodeText) ||
		isExpressServer(nodeText) ||
		nodeText.includes("req") ||
		nodeText.includes("res") ||
		nodeText.includes("next")
	)
}

function extractExpressRouteInfo(nodeText: string): {
	routeType: ExpressRouteMetadata["routeType"]
	httpMethod: ExpressRouteMetadata["httpMethod"]
} {
	let routeType: ExpressRouteMetadata["routeType"] = "app"
	let httpMethod: ExpressRouteMetadata["httpMethod"] = "GET"

	if (nodeText.includes("router.")) {
		routeType = "router"
	}

	const methodMatch = nodeText.match(/\.(get|post|put|delete|patch|head|options|all)\s*\(/)
	if (methodMatch) {
		httpMethod = methodMatch[1].toUpperCase() as ExpressRouteMetadata["httpMethod"]
	}

	return { routeType, httpMethod }
}

function extractExpressRoutePath(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
				const firstArg = argumentsNode.children[0]
				if (firstArg && firstArg.type === "string") {
					return firstArg.text.replace(/['"]/g, "")
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "/"
}

function extractExpressRouteParameters(routePath: string): string[] {
	const parameters: string[] = []

	// Extract parameters from route path like /users/:id
	const paramMatches = routePath.match(/:([^\/]+)/g)
	if (paramMatches) {
		for (const match of paramMatches) {
			parameters.push(match.slice(1)) // Remove colon
		}
	}

	return parameters
}

function extractExpressRouteAsync(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "arrow_function") {
			return n.text.includes("async")
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressRouteMiddleware(node: Node): string[] {
	const middleware: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				// Skip first argument (path) and process the rest
				const args = argumentsNode.children || []
				for (let i = 1; i < args.length - 1; i++) {
					const arg = args[i]
					if (arg && arg.type === "identifier") {
						middleware.push(arg.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(middleware)]
}

function extractExpressRouteHandler(node: Node): {
	handlerType: ExpressRouteMetadata["handlerType"]
	handlerName?: string
} {
	const traverse = (
		n: Node,
	): { handlerType: ExpressRouteMetadata["handlerType"]; handlerName?: string } | undefined => {
		if (n.type === "call_expression") {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const args = argumentsNode.children || []
				if (args.length > 0) {
					const lastArg = args[args.length - 1]

					if (lastArg) {
						if (lastArg.type === "function_declaration") {
							return { handlerType: "function" }
						} else if (lastArg.type === "arrow_function") {
							return { handlerType: "arrow" }
						} else if (lastArg.type === "identifier") {
							return { handlerType: "identifier", handlerName: lastArg.text }
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || { handlerType: "function" }
}

function extractExpressMiddlewareInfo(nodeText: string): {
	middlewareType: ExpressMiddlewareMetadata["middlewareType"]
	middlewareName?: string
	middlewarePath?: string
} {
	let middlewareType: ExpressMiddlewareMetadata["middlewareType"] = "application"
	let middlewareName: string | undefined
	let middlewarePath: string | undefined

	if (nodeText.includes("router.")) {
		middlewareType = "router"
	} else if (nodeText.includes("error") || nodeText.includes("(err,")) {
		middlewareType = "error"
	} else if (
		nodeText.includes("cors") ||
		nodeText.includes("bodyParser") ||
		nodeText.includes("json") ||
		nodeText.includes("urlencoded") ||
		nodeText.includes("morgan") ||
		nodeText.includes("helmet")
	) {
		middlewareType = "builtin"
	}

	// Extract middleware name/path
	const pathMatch = nodeText.match(/(?:app|router)\.use\s*\(\s*['"`]([^'"`]+)['"`]/)
	if (pathMatch) {
		middlewarePath = pathMatch[1]
	}

	const nameMatch = nodeText.match(/(?:app|router)\.use\s*\(\s*(\w+)/)
	if (nameMatch) {
		middlewareName = nameMatch[1]
	}

	return { middlewareType, middlewareName, middlewarePath }
}

function extractExpressMiddlewareParameters(node: Node): string[] {
	const parameters: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_declaration" || n.type === "arrow_function") {
			const parametersNode = n.childForFieldName("parameters")
			if (parametersNode) {
				for (const param of parametersNode.children || []) {
					if (param && param.type === "identifier") {
						parameters.push(param.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(parameters)]
}

function extractExpressErrorHandling(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "function_declaration" || n.type === "arrow_function") {
			const parametersNode = n.childForFieldName("parameters")
			if (parametersNode) {
				const params = parametersNode.children || []
				// Error handling middleware has 4 parameters: (err, req, res, next)
				if (params.length >= 4) {
					const firstParam = params[0]
					if (
						firstParam &&
						firstParam.type === "identifier" &&
						(firstParam.text === "err" || firstParam.text === "error")
					) {
						return true
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressServerType(nodeText: string): ExpressServerMetadata["serverType"] {
	return nodeText.includes("Router") ? "router" : "app"
}

function extractExpressServerConfig(node: Node): { port?: number | string; host?: string } {
	let port: number | string | undefined
	let host: string | undefined

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("listen")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const args = argumentsNode.children || []

				// First argument is port
				if (args.length > 0) {
					const portArg = args[0]
					if (portArg) {
						if (portArg.type === "number") {
							port = parseInt(portArg.text, 10)
						} else if (portArg.type === "identifier") {
							port = portArg.text
						} else if (portArg.type === "string") {
							port = portArg.text.replace(/['"]/g, "")
						}
					}
				}

				// Second argument might be host
				if (args.length > 1) {
					const hostArg = args[1]
					if (hostArg && hostArg.type === "string") {
						host = hostArg.text.replace(/['"]/g, "")
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return { port, host }
}

function extractExpressEnvironment(nodeText: string): ExpressServerMetadata["environment"] {
	if (nodeText.includes("development")) {
		return "development"
	} else if (nodeText.includes("production")) {
		return "production"
	} else if (nodeText.includes("test")) {
		return "test"
	}

	return undefined
}

function extractExpressServerCallback(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression" && n.text.includes("listen")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const args = argumentsNode.children || []

				// Look for callback function
				for (const arg of args) {
					if (arg && (arg.type === "function_declaration" || arg.type === "arrow_function")) {
						return "callback"
					} else if (arg && arg.type === "identifier") {
						return arg.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractExpressStaticFiles(node: Node): { hasStaticFiles: boolean; staticPaths: string[] } {
	let hasStaticFiles = false
	const staticPaths: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("static")) {
			hasStaticFiles = true

			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "string") {
					staticPaths.push(firstArg.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return { hasStaticFiles, staticPaths: [...new Set(staticPaths)] }
}

function extractExpressApplicationType(nodeText: string): ExpressApplicationMetadata["applicationType"] {
	return nodeText.includes("Router") ? "router" : "app"
}

function extractExpressImports(node: Node): string[] {
	const imports: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "import_statement") {
			if (
				n.text.includes("express") ||
				n.text.includes("cors") ||
				n.text.includes("morgan") ||
				n.text.includes("helmet") ||
				n.text.includes("body-parser") ||
				n.text.includes("passport")
			) {
				const sourceNode = n.childForFieldName("source")
				if (sourceNode) {
					imports.push(sourceNode.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(imports)]
}

function extractExpressAppMiddleware(node: Node): string[] {
	const middleware: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("use")) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const args = argumentsNode.children || []
				for (const arg of args) {
					if (arg && arg.type === "identifier") {
						middleware.push(arg.text)
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(middleware)]
}

function extractExpressAppRoutes(node: Node): string[] {
	const routes: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && isExpressRoute(n.text)) {
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const firstArg = argumentsNode.children?.[0]
				if (firstArg && firstArg.type === "string") {
					routes.push(firstArg.text.replace(/['"]/g, ""))
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(routes)]
}

function extractExpressErrorHandlers(node: Node): string[] {
	const errorHandlers: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("use")) {
			// Check if this is an error handler (has 4 parameters)
			const argumentsNode = n.childForFieldName("arguments")
			if (argumentsNode) {
				const args = argumentsNode.children || []
				if (args.length >= 1) {
					const lastArg = args[args.length - 1]
					if (lastArg && (lastArg.type === "function_declaration" || lastArg.type === "arrow_function")) {
						const parametersNode = lastArg.childForFieldName("parameters")
						if (parametersNode && parametersNode.children && parametersNode.children.length >= 4) {
							errorHandlers.push("error-handler")
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(errorHandlers)]
}

function extractExpressComponentType(nodeText: string): ExpressComponentMetadata["componentType"] {
	if (isExpressRoute(nodeText)) {
		return "route_handler"
	} else if (isExpressMiddleware(nodeText)) {
		return "middleware"
	} else if (isExpressServer(nodeText)) {
		return "server"
	} else if (isExpressApplication(nodeText)) {
		return "application"
	}

	return "route_handler" // Default
}

function extractExpressExportName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "export_statement") {
			const declaration = n.childForFieldName("declaration")
			if (declaration) {
				const nameNode = declaration.childForFieldName("name")
				if (nameNode) {
					return nameNode.text
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractExpressIsExported(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "export_statement") {
			return true
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressHasRequestParams(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "member_expression") {
			const objectNode = n.childForFieldName("object")
			const propertyNode = n.childForFieldName("property")
			if (objectNode && objectNode.text === "req" && propertyNode) {
				return propertyNode.text === "params"
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressHasQueryParams(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "member_expression") {
			const objectNode = n.childForFieldName("object")
			const propertyNode = n.childForFieldName("property")
			if (objectNode && objectNode.text === "req" && propertyNode) {
				return propertyNode.text === "query"
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressHasResponseBody(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const objectNode = functionNode.childForFieldName("object")
				if (objectNode && objectNode.text === "res") {
					return true
				}
			}
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractExpressResponseType(node: Node): ExpressComponentMetadata["responseType"] {
	const traverse = (n: Node): ExpressComponentMetadata["responseType"] | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const objectNode = functionNode.childForFieldName("object")
				const propertyNode = functionNode.childForFieldName("property")
				if (objectNode && objectNode.text === "res" && propertyNode) {
					const methodName = propertyNode.text
					if (
						["send", "json", "render", "redirect", "status", "end", "download", "sendFile"].includes(
							methodName,
						)
					) {
						return methodName as ExpressComponentMetadata["responseType"]
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "send" // Default
}

// Django-specific metadata types
export interface DjangoViewMetadata {
	viewType: "function_based" | "class_based"
	viewName?: string
	className?: string
	baseClass?: string
	requestParam?: string
	requestType?: string
	templatePath?: string
	responseType?: "render" | "json" | "http"
	formHandling?: boolean
	authDecorators?: string[]
	isAsync?: boolean
}

export interface DjangoModelMetadata {
	modelName: string
	baseClass?: string
	fields?: DjangoFieldMetadata[]
	methods?: string[]
	foreignKeys?: DjangoRelationshipMetadata[]
	manyToManyFields?: DjangoRelationshipMetadata[]
	tableName?: string
	verboseName?: string
	dbTable?: string
}

export interface DjangoFieldMetadata {
	name: string
	type: string
	options?: Record<string, any>
	isRelation?: boolean
	relatedModel?: string
	null?: boolean
	blank?: boolean
	unique?: boolean
	dbIndex?: boolean
	default?: any
}

export interface DjangoRelationshipMetadata {
	fieldName: string
	relatedModel: string
	relationshipType: "ForeignKey" | "ManyToManyField" | "OneToOneField"
	onDelete?: string
	relatedName?: string
	through?: string
}

export interface DjangoUrlMetadata {
	urlPattern: string
	viewFunction?: string
	viewClass?: string
	parameters?: string[]
	name?: string
	urlType: "path" | "re_path"
	include?: string
	namespace?: string
}

export interface DjangoOrmMetadata {
	modelName: string
	operation: string
	method?: string
	filters?: Record<string, any>
	orderBy?: string[]
	values?: string[]
	annotations?: Record<string, any>
	aggregations?: Record<string, any>
	limit?: number
	offset?: number
	distinct?: boolean
	selectRelated?: string[]
	prefetchRelated?: string[]
}

export interface DjangoMigrationMetadata {
	command: string
	app?: string
	migrationName?: string
	fake?: boolean
	fakeInitial?: boolean
	plan?: boolean
	executedMigrations?: string[]
	pendingMigrations?: string[]
}

// Flask-specific metadata types
export interface FlaskRouteMetadata {
	routePath: string
	httpMethod: string
	functionName?: string
	endpoint?: string
	rule?: string
	methods?: string[]
	provideAutomaticOptions?: boolean
	defaults?: Record<string, any>
	isAsync?: boolean
}

export interface FlaskViewMetadata {
	viewType: "function" | "class_based"
	functionName?: string
	className?: string
	templatePath?: string
	responseType?: "render" | "json" | "redirect" | "string"
	requestAccess?: string[]
	formHandling?: boolean
	isAsync?: boolean
}

export interface FlaskRequestMetadata {
	requestType: "form" | "args" | "json" | "files" | "cookies"
	properties?: string[]
	validation?: FlaskValidationMetadata
	fileUploads?: FlaskFileUploadMetadata[]
}

export interface FlaskValidationMetadata {
	field: string
	validator?: string
	message?: string
	required?: boolean
	type?: string
	minLength?: number
	maxLength?: number
	pattern?: string
}

export interface FlaskFileUploadMetadata {
	fieldName: string
	filename?: string
	contentType?: string
	length?: number
	allowedExtensions?: string[]
	maxSize?: number
}

export interface FlaskResponseMetadata {
	responseType: "render_template" | "jsonify" | "redirect" | "string" | "file"
	templatePath?: string
	data?: any
	statusCode?: number
	headers?: Record<string, string>
	mimeType?: string
}

// Testing framework extraction functions
/**
 * Extracts testing framework metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @param language The programming language
 * @returns TestingFrameworkMetadata object or undefined if no testing patterns found
 */
export function extractTestingFrameworkMetadata(
	node: Node,
	text: string,
	language: string,
):
	| TestingFrameworkMetadata
	| JavaScriptTestingMetadata
	| PythonTestingMetadata
	| JavaTestingMetadata
	| GoTestingMetadata
	| RustTestingMetadata
	| RubyTestingMetadata
	| PhpTestingMetadata
	| CSharpTestingMetadata
	| undefined {
	try {
		switch (language) {
			case "typescript":
			case "javascript":
				return extractJavaScriptTestingMetadata(node, text)
			case "python":
				return extractPythonTestingMetadata(node, text)
			case "java":
				return extractJavaTestingMetadata(node, text)
			case "go":
				return extractGoTestingMetadata(node, text)
			case "rust":
				return extractRustTestingMetadata(node, text)
			case "ruby":
				return extractRubyTestingMetadata(node, text)
			case "php":
				return extractPhpTestingMetadata(node, text)
			case "c_sharp":
				return extractCSharpTestingMetadata(node, text)
			default:
				return undefined
		}
	} catch (error) {
		console.debug(`Failed to extract testing framework metadata for ${language}:`, error)
		return undefined
	}
}

// Helper functions for testing framework extraction

function extractJavaScriptTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "describe") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
					const firstArg = argumentsNode.children[0]
					if (firstArg && firstArg.type === "string") {
						testSuites.push(firstArg.text.replace(/['"]/g, ""))
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractJavaScriptTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && (functionNode.text === "it" || functionNode.text === "test")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
					const firstArg = argumentsNode.children[0]
					if (firstArg && firstArg.type === "string") {
						testCases.push(firstArg.text.replace(/['"]/g, ""))
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractJavaScriptTestHooks(node: Node): string[] {
	const hooks: string[] = []
	const hookNames = ["beforeEach", "afterEach", "beforeAll", "afterAll", "setup", "teardown"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && hookNames.includes(functionNode.text)) {
				hooks.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)]
}

function extractJavaScriptAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = ["expect", "assert", "should", "chai.assert"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && assertionPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				assertions.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractJavaScriptMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["jest.mock", "vi.mock", "sinon.mock", "createMock"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && mockPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				mocks.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractJavaScriptSpies(node: Node): string[] {
	const spies: string[] = []
	const spyPatterns = ["jest.spyOn", "vi.spyOn", "sinon.spy"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && spyPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				spies.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(spies)]
}

function extractJavaScriptFixtures(node: Node): string[] {
	const fixtures: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "variable_declarator") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.includes("fixture") || nameNode.text.includes("mockData"))) {
				fixtures.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(fixtures)]
}

function extractJavaScriptTestData(node: Node): string[] {
	const testData: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (
				functionNode &&
				(functionNode.text.includes("test.each") || functionNode.text.includes("describe.each"))
			) {
				testData.push("data-driven-test")
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testData)]
}

function extractJavaScriptTestImports(node: Node): string[] {
	const imports: string[] = []
	const testLibraries = [
		"jest",
		"vitest",
		"mocha",
		"chai",
		"sinon",
		"@testing-library",
		"@jest/globals",
		"vitest/globals",
	]

	const traverse = (n: Node) => {
		if (n.type === "import_statement") {
			const sourceNode = n.childForFieldName("source")
			if (sourceNode && testLibraries.some((lib) => sourceNode.text.includes(lib))) {
				imports.push(sourceNode.text.replace(/['"]/g, ""))
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(imports)]
}

function extractJavaScriptTestConfiguration(text: string): JavaScriptTestingConfiguration | undefined {
	const config: JavaScriptTestingConfiguration = {}

	// Extract Jest configuration
	if (text.includes("jest.config") || text.includes("package.json")) {
		const envMatch = text.match(/testEnvironment\s*:\s*['"`]([^'"`]+)['"`]/)
		if (envMatch) {
			config.testEnvironment = envMatch[1] as JavaScriptTestingConfiguration["testEnvironment"]
		}

		const setupMatch = text.match(/setupFiles\s*:\s*\[([^\]]+)\]/)
		if (setupMatch) {
			config.setupFiles = setupMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
		}

		const timeoutMatch = text.match(/testTimeout\s*:\s*(\d+)/)
		if (timeoutMatch) {
			config.testTimeout = parseInt(timeoutMatch[1], 10)
		}
	}

	// Extract Vitest configuration
	if (text.includes("vitest.config")) {
		const envMatch = text.match(/environment\s*:\s*['"`]([^'"`]+)['"`]/)
		if (envMatch) {
			config.testEnvironment = envMatch[1] as JavaScriptTestingConfiguration["testEnvironment"]
		}
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Python testing helper functions
function extractPythonTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.endsWith("Test")) {
				testSuites.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractPythonTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.startsWith("test_")) {
				testCases.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractPythonFixtures(node: Node): string[] {
	const fixtures: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@pytest.fixture")) {
			const nextSibling = n.nextSibling
			if (nextSibling && nextSibling.type === "function_definition") {
				const nameNode = nextSibling.childForFieldName("name")
				if (nameNode) {
					fixtures.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(fixtures)]
}

function extractPythonParametrizedTests(node: Node): string[] {
	const parametrizedTests: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@pytest.mark.parametrize")) {
			const nextSibling = n.nextSibling
			if (nextSibling && nextSibling.type === "function_definition") {
				const nameNode = nextSibling.childForFieldName("name")
				if (nameNode) {
					parametrizedTests.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(parametrizedTests)]
}

function extractPythonAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = ["assert", "pytest.raises", "unittest.TestCase.assert"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && assertionPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				assertions.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractPythonMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["unittest.mock", "pytest.mock", "MagicMock"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && mockPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				mocks.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractPythonTestConfiguration(text: string): PythonTestingConfiguration | undefined {
	const config: PythonTestingConfiguration = {}

	// Extract pytest configuration
	if (text.includes("pytest.ini") || text.includes("pyproject.toml") || text.includes("setup.cfg")) {
		const addoptsMatch = text.match(/addopts\s*=\s*([^\n]+)/)
		if (addoptsMatch) {
			config.addopts = [addoptsMatch[1].trim()]
		}

		const minversionMatch = text.match(/minversion\s*=\s*(\d+\.\d+)/)
		if (minversionMatch) {
			config.minversion = minversionMatch[1]
		}
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Java testing helper functions
function extractJavaTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.endsWith("Test") || nameNode.text.endsWith("Tests"))) {
				testSuites.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractJavaTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			// Check for @Test annotation
			const decorators = extractDecorators(n)
			if (decorators && decorators.some((d) => d.includes("@Test"))) {
				const nameNode = n.childForFieldName("name")
				if (nameNode) {
					testCases.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractJavaTestHooks(node: Node): string[] {
	const hooks: string[] = []
	const hookAnnotations = ["@Before", "@After", "@BeforeClass", "@AfterClass", "@BeforeEach", "@AfterEach"]

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			const decorators = extractDecorators(n)
			if (decorators) {
				for (const decorator of decorators) {
					for (const hookAnnotation of hookAnnotations) {
						if (decorator.includes(hookAnnotation)) {
							hooks.push(hookAnnotation)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)]
}

function extractJavaAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = [
		"assertEquals",
		"assertNotEquals",
		"assertTrue",
		"assertFalse",
		"assertNull",
		"assertNotNull",
		"assertThrows",
		"assertThat",
		"Mockito",
	]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && assertionPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				assertions.push(functionNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractJavaMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["Mockito.mock", "Mockito.spy", "@Mock", "@Spy", "@InjectMocks"]

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && mockPatterns.some((pattern) => functionNode.text.includes(pattern))) {
				mocks.push(functionNode.text)
			}
		} else if (n.type === "field_declaration") {
			const decorators = extractDecorators(n)
			if (decorators && decorators.some((d) => mockPatterns.some((pattern) => d.includes(pattern)))) {
				const nameNode = n.childForFieldName("name")
				if (nameNode) {
					mocks.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractJavaTestConfiguration(text: string): JavaTestingConfiguration | undefined {
	const config: JavaTestingConfiguration = {}

	// Extract JUnit configuration
	if (text.includes("junit")) {
		const junitVersionMatch = text.match(/junit\s*:\s*['"`]([^'"`]+)['"`]/)
		if (junitVersionMatch) {
			config.junitVersion = junitVersionMatch[1]
		}

		const mockitoVersionMatch = text.match(/mockito\s*:\s*['"`]([^'"`]+)['"`]/)
		if (mockitoVersionMatch) {
			config.mockitoVersion = mockitoVersionMatch[1]
		}
	}

	// Extract TestNG configuration
	if (text.includes("testng")) {
		const testngVersionMatch = text.match(/testng\s*:\s*['"`]([^'"`]+)['"`]/)
		if (testngVersionMatch) {
			config.testngVersion = testngVersionMatch[1]
		}
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Go testing helper functions
function extractGoTestFunctions(node: Node): string[] {
	const testFunctions: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.startsWith("Test")) {
				testFunctions.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testFunctions)]
}

function extractGoBenchmarks(node: Node): string[] {
	const benchmarks: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.startsWith("Benchmark")) {
				benchmarks.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(benchmarks)]
}

function extractGoExamples(node: Node): string[] {
	const examples: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.startsWith("Example")) {
				examples.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(examples)]
}

function extractGoTableDrivenTests(node: Node): string[] {
	const tableTests: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "composite_literal" && n.text.includes("struct")) {
			// Look for table-driven test patterns
			const parent = n.parent
			if (parent && parent.type === "short_var_declaration") {
				const nameNode = parent.childForFieldName("left")
				if (nameNode && (nameNode.text.includes("tests") || nameNode.text.includes("cases"))) {
					tableTests.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(tableTests)]
}

function extractGoSubtests(node: Node): string[] {
	const subtests: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "t.Run") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
					const firstArg = argumentsNode.children[0]
					if (firstArg && firstArg.type === "string") {
						subtests.push(firstArg.text.replace(/['"]/g, ""))
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(subtests)]
}

function extractGoTestConfiguration(text: string): GoTestingConfiguration | undefined {
	const config: GoTestingConfiguration = {}

	// Extract test configuration from go.mod or build tags
	if (text.includes("+build")) {
		const buildTagsMatch = text.match(/\+build\s+([^\n]+)/)
		if (buildTagsMatch) {
			config.buildTags = buildTagsMatch[1].trim().split(/\s+/)
		}
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Rust testing helper functions
function extractRustTestFunctions(node: Node): string[] {
	const testFunctions: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_item") {
			// Check for #[test] attribute
			const attributes = n.children?.filter((child) => child && child.type === "attribute_item")
			if (attributes && attributes.some((attr) => attr && attr.text.includes("#[test]"))) {
				const nameNode = n.childForFieldName("name")
				if (nameNode) {
					testFunctions.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testFunctions)]
}

function extractRustIntegrationTests(node: Node): string[] {
	const integrationTests: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_item") {
			// Check for #[test] attribute in integration test context
			const attributes = n.children?.filter((child) => child && child.type === "attribute_item")
			if (attributes && attributes.some((attr) => attr && attr.text.includes("#[test]"))) {
				const nameNode = n.childForFieldName("name")
				if (nameNode) {
					integrationTests.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(integrationTests)]
}

function extractRustDocTests(node: Node): string[] {
	const docTests: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "line_comment" && n.text.includes("```")) {
			// Look for code blocks in comments
			const codeBlockMatch = n.text.match(/```rust\n([\s\S]*?)\n```/)
			if (codeBlockMatch) {
				docTests.push("doc-test")
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(docTests)]
}

function extractRustTestConfiguration(text: string): RustTestingConfiguration | undefined {
	const config: RustTestingConfiguration = {}

	// Extract test configuration from Cargo.toml patterns
	if (text.includes("test")) {
		const testProfileMatch = text.match(/\[profile\.test\]/)
		if (testProfileMatch) {
			config.testProfile = true
		}
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Ruby testing helper functions
function extractRubyTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call") {
			const methodNode = n.childForFieldName("method")
			if (methodNode && methodNode.text === "describe") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
					const firstArg = argumentsNode.children[0]
					if (firstArg && firstArg.type === "string") {
						testSuites.push(firstArg.text.replace(/['"]/g, ""))
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractRubyTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "call") {
			const methodNode = n.childForFieldName("method")
			if (methodNode && (methodNode.text === "it" || methodNode.text === "test")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 0) {
					const firstArg = argumentsNode.children[0]
					if (firstArg && firstArg.type === "string") {
						testCases.push(firstArg.text.replace(/['"]/g, ""))
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractRubyTestHooks(node: Node): string[] {
	const hooks: string[] = []
	const hookNames = ["before", "after", "around", "beforeEach", "afterEach", "aroundEach"]

	const traverse = (n: Node) => {
		if (n.type === "call") {
			const methodNode = n.childForFieldName("method")
			if (methodNode && hookNames.includes(methodNode.text)) {
				hooks.push(methodNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)]
}

function extractRubyAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = ["expect", "assert", "should", "must", "wont"]

	const traverse = (n: Node) => {
		if (n.type === "call") {
			const methodNode = n.childForFieldName("method")
			if (methodNode && assertionPatterns.some((pattern) => methodNode.text.includes(pattern))) {
				assertions.push(methodNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractRubyMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["allow", "expect", "double", "instance_double", "class_double"]

	const traverse = (n: Node) => {
		if (n.type === "call") {
			const methodNode = n.childForFieldName("method")
			if (methodNode && mockPatterns.some((pattern) => methodNode.text.includes(pattern))) {
				mocks.push(methodNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractRubyTestConfiguration(text: string): RubyTestingConfiguration | undefined {
	const config: RubyTestingConfiguration = {}

	// Extract RSpec configuration
	if (text.includes("RSpec.configure")) {
		config.rspecConfig = true
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// PHP testing helper functions
function extractPhpTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.endsWith("Test")) {
				testSuites.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractPhpTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.startsWith("test") || nameNode.text.includes("Test"))) {
				testCases.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractPhpTestHooks(node: Node): string[] {
	const hooks: string[] = []
	const hookNames = ["setUp", "tearDown", "setUpBeforeClass", "tearDownAfterClass"]

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && hookNames.includes(nameNode.text)) {
				hooks.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)]
}

function extractPhpAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = [
		"assertEquals",
		"assertNotEquals",
		"assertTrue",
		"assertFalse",
		"assertNull",
		"assertNotNull",
		"assertCount",
		"assertInstanceOf",
	]

	const traverse = (n: Node) => {
		if (n.type === "function_call") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && assertionPatterns.some((pattern) => nameNode.text.includes(pattern))) {
				assertions.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractPhpMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["createMock", "getMockBuilder", "getMockForAbstractClass"]

	const traverse = (n: Node) => {
		if (n.type === "function_call") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && mockPatterns.some((pattern) => nameNode.text.includes(pattern))) {
				mocks.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractPhpDataProviders(node: Node): string[] {
	const dataProviders: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && nameNode.text.includes("Provider")) {
				dataProviders.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(dataProviders)]
}

function extractPhpTestConfiguration(text: string): PhpTestingConfiguration | undefined {
	const config: PhpTestingConfiguration = {}

	// Extract PHPUnit configuration
	if (text.includes("phpunit.xml")) {
		config.phpunitConfig = true
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// C# testing helper functions
function extractCSharpTestSuites(node: Node): string[] {
	const testSuites: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_declaration") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && (nameNode.text.endsWith("Tests") || nameNode.text.endsWith("Test"))) {
				testSuites.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testSuites)]
}

function extractCSharpTestCases(node: Node): string[] {
	const testCases: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			// Check for test attributes
			const attributes = extractDecorators(n)
			if (
				attributes &&
				attributes.some(
					(d) =>
						d.includes("[Test]") ||
						d.includes("[Fact]") ||
						d.includes("[Theory]") ||
						d.includes("[TestMethod]"),
				)
			) {
				const nameNode = n.childForFieldName("name")
				if (nameNode) {
					testCases.push(nameNode.text)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(testCases)]
}

function extractCSharpTestHooks(node: Node): string[] {
	const hooks: string[] = []
	const hookAttributes = [
		"[SetUp]",
		"[TearDown]",
		"[OneTimeSetUp]",
		"[OneTimeTearDown]",
		"[TestInitialize]",
		"[TestCleanup]",
		"[ClassInitialize]",
		"[ClassCleanup]",
	]

	const traverse = (n: Node) => {
		if (n.type === "method_declaration") {
			const attributes = extractDecorators(n)
			if (attributes) {
				for (const attribute of attributes) {
					for (const hookAttribute of hookAttributes) {
						if (attribute.includes(hookAttribute)) {
							hooks.push(hookAttribute)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(hooks)]
}

function extractCSharpAssertions(node: Node): string[] {
	const assertions: string[] = []
	const assertionPatterns = ["Assert.", "Should.", "Expect"]

	const traverse = (n: Node) => {
		if (n.type === "invocation_expression") {
			const memberAccessNode = n.childForFieldName("function")
			if (memberAccessNode && assertionPatterns.some((pattern) => memberAccessNode.text.includes(pattern))) {
				assertions.push(memberAccessNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(assertions)]
}

function extractCSharpMocks(node: Node): string[] {
	const mocks: string[] = []
	const mockPatterns = ["Mock.", "Setup", "Returns", "Verify"]

	const traverse = (n: Node) => {
		if (n.type === "invocation_expression") {
			const memberAccessNode = n.childForFieldName("function")
			if (memberAccessNode && mockPatterns.some((pattern) => memberAccessNode.text.includes(pattern))) {
				mocks.push(memberAccessNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(mocks)]
}

function extractCSharpTestConfiguration(text: string): CSharpTestingConfiguration | undefined {
	const config: CSharpTestingConfiguration = {}

	// Extract test framework configuration
	if (text.includes("xunit")) {
		config.testFramework = "xunit"
	} else if (text.includes("nunit")) {
		config.testFramework = "nunit"
	} else if (text.includes("mstest")) {
		config.testFramework = "mstest"
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Placeholder implementations for language-specific extractors
function extractJavaScriptTestingMetadata(node: Node, text: string): JavaScriptTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: JavaScriptTestingMetadata["framework"] | undefined

	if (nodeText.includes("jest") || nodeText.includes("@jest/globals")) {
		framework = "jest"
	} else if (nodeText.includes("vitest") || nodeText.includes("vitest/globals")) {
		framework = "vitest"
	} else if (nodeText.includes("mocha") || nodeText.includes("describe") || nodeText.includes("it")) {
		framework = "mocha"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: JavaScriptTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e") || nodeText.includes("end-to-end")) {
		testType = nodeText.includes("e2e") || nodeText.includes("end-to-end") ? "e2e" : "integration"
	} else if (nodeText.includes("component") || nodeText.includes("mount") || nodeText.includes("render")) {
		testType = "component"
	}

	// Extract test information
	const metadata: JavaScriptTestingMetadata = {
		framework,
		testType,
		testSuites: extractJavaScriptTestSuites(node),
		testCases: extractJavaScriptTestCases(node),
		hooks: extractJavaScriptTestHooks(node),
		assertions: extractJavaScriptAssertions(node),
		mocks: extractJavaScriptMocks(node),
		spies: extractJavaScriptSpies(node),
		fixtures: extractJavaScriptFixtures(node),
		testData: extractJavaScriptTestData(node),
		imports: extractJavaScriptTestImports(node),
		configuration: extractJavaScriptTestConfiguration(text),
	}

	return metadata
}

function extractPythonTestingMetadata(node: Node, text: string): PythonTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: PythonTestingMetadata["framework"] | undefined

	if (nodeText.includes("pytest") || nodeText.includes("@pytest")) {
		framework = "pytest"
	} else if (nodeText.includes("unittest") || nodeText.includes("TestCase") || nodeText.includes("setUp")) {
		framework = "unittest"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: PythonTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e") || nodeText.includes("end_to_end")) {
		testType = nodeText.includes("e2e") || nodeText.includes("end_to_end") ? "e2e" : "integration"
	} else if (nodeText.includes("functional") || nodeText.includes("api")) {
		testType = "functional"
	}

	// Extract test information
	const metadata: PythonTestingMetadata = {
		framework,
		testType,
		testSuites: extractPythonTestSuites(node),
		testCases: extractPythonTestCases(node),
		fixtures: extractPythonFixtures(node),
		parametrizedTests: extractPythonParametrizedTests(node),
		assertions: extractPythonAssertions(node),
		mocks: extractPythonMocks(node),
		configuration: extractPythonTestConfiguration(text),
	}

	return metadata
}

function extractJavaTestingMetadata(node: Node, text: string): JavaTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: JavaTestingMetadata["framework"] | undefined

	if (nodeText.includes("@Test") || nodeText.includes("junit")) {
		framework = "junit"
	} else if (nodeText.includes("TestNG") || nodeText.includes("@Test(")) {
		framework = "testng"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: JavaTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e") || nodeText.includes("end_to_end")) {
		testType = nodeText.includes("e2e") || nodeText.includes("end_to_end") ? "e2e" : "integration"
	}

	// Extract test information
	const metadata: JavaTestingMetadata = {
		framework,
		testType,
		testSuites: extractJavaTestSuites(node),
		testCases: extractJavaTestCases(node),
		hooks: extractJavaTestHooks(node),
		assertions: extractJavaAssertions(node),
		mocks: extractJavaMocks(node),
		configuration: extractJavaTestConfiguration(text),
	}

	return metadata
}

function extractGoTestingMetadata(node: Node, text: string): GoTestingMetadata | undefined {
	const nodeText = node.text

	// Check if this is a Go test
	if (!nodeText.includes("testing") && !nodeText.includes("func Test") && !nodeText.includes("func Benchmark")) {
		return undefined
	}

	// Determine test type
	let testType: GoTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e")) {
		testType = "integration"
	} else if (nodeText.includes("Benchmark")) {
		testType = "benchmark"
	}

	// Extract test information
	const metadata: GoTestingMetadata = {
		framework: "go_testing",
		testType,
		testFunctions: extractGoTestFunctions(node),
		benchmarks: extractGoBenchmarks(node),
		examples: extractGoExamples(node),
		tableDrivenTests: extractGoTableDrivenTests(node),
		subtests: extractGoSubtests(node),
		configuration: extractGoTestConfiguration(text),
	}

	return metadata
}

function extractRustTestingMetadata(node: Node, text: string): RustTestingMetadata | undefined {
	const nodeText = node.text

	// Check if this is a Rust test
	if (!nodeText.includes("#[test]") && !nodeText.includes("#[cfg(test)]")) {
		return undefined
	}

	// Determine test type
	let testType: RustTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("tests/")) {
		testType = "integration"
	} else if (nodeText.includes("///") || nodeText.includes("```")) {
		testType = "doc"
	}

	// Extract test information
	const metadata: RustTestingMetadata = {
		framework: "rust_testing",
		testType,
		testFunctions: extractRustTestFunctions(node),
		integrationTests: extractRustIntegrationTests(node),
		docTests: extractRustDocTests(node),
		configuration: extractRustTestConfiguration(text),
	}

	return metadata
}

function extractRubyTestingMetadata(node: Node, text: string): RubyTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: RubyTestingMetadata["framework"] | undefined

	if (nodeText.includes("RSpec") || nodeText.includes("describe") || nodeText.includes("it")) {
		framework = "rspec"
	} else if (nodeText.includes("Minitest") || nodeText.includes("Test::Unit")) {
		framework = nodeText.includes("Minitest") ? "minitest" : "test_unit"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: RubyTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e") || nodeText.includes("request")) {
		testType = nodeText.includes("request") ? "request" : nodeText.includes("e2e") ? "e2e" : "integration"
	}

	// Extract test information
	const metadata: RubyTestingMetadata = {
		framework,
		testType,
		testSuites: extractRubyTestSuites(node),
		testCases: extractRubyTestCases(node),
		hooks: extractRubyTestHooks(node),
		assertions: extractRubyAssertions(node),
		mocks: extractRubyMocks(node),
		configuration: extractRubyTestConfiguration(text),
	}

	return metadata
}

function extractPhpTestingMetadata(node: Node, text: string): PhpTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: PhpTestingMetadata["framework"] | undefined

	if (nodeText.includes("PHPUnit") || nodeText.includes("@test") || nodeText.includes("TestCase")) {
		framework = "phpunit"
	} else if (nodeText.includes("Pest") || nodeText.includes("test(")) {
		framework = "pest"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: PhpTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e") || nodeText.includes("feature")) {
		testType = nodeText.includes("feature") ? "feature" : nodeText.includes("e2e") ? "e2e" : "integration"
	}

	// Extract test information
	const metadata: PhpTestingMetadata = {
		framework,
		testType,
		testSuites: extractPhpTestSuites(node),
		testCases: extractPhpTestCases(node),
		hooks: extractPhpTestHooks(node),
		assertions: extractPhpAssertions(node),
		mocks: extractPhpMocks(node),
		dataProviders: extractPhpDataProviders(node),
		configuration: extractPhpTestConfiguration(text),
	}

	return metadata
}

function extractCSharpTestingMetadata(node: Node, text: string): CSharpTestingMetadata | undefined {
	const nodeText = node.text

	// Determine testing framework
	let framework: CSharpTestingMetadata["framework"] | undefined

	if (nodeText.includes("Xunit") || nodeText.includes("[Fact]") || nodeText.includes("[Theory]")) {
		framework = "xunit"
	} else if (nodeText.includes("NUnit") || nodeText.includes("[Test]")) {
		framework = "nunit"
	} else if (nodeText.includes("MSTest") || nodeText.includes("[TestMethod]")) {
		framework = "mstest"
	}

	if (!framework) {
		return undefined
	}

	// Determine test type
	let testType: CSharpTestingMetadata["testType"] = "unit"
	if (nodeText.includes("integration") || nodeText.includes("e2e")) {
		testType = nodeText.includes("e2e") ? "e2e" : "integration"
	}

	// Extract test information
	const metadata: CSharpTestingMetadata = {
		framework,
		testType,
		testSuites: extractCSharpTestSuites(node),
		testCases: extractCSharpTestCases(node),
		hooks: extractCSharpTestHooks(node),
		assertions: extractCSharpAssertions(node),
		mocks: extractCSharpMocks(node),
		configuration: extractCSharpTestConfiguration(text),
	}

	return metadata
}

// Django metadata extraction functions
/**
 * Extracts FastAPI route metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FastAPIRouteMetadata object or undefined if not a FastAPI route
 */
export function extractFastAPIRouteMetadata(node: Node, text: string): FastAPIRouteMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a FastAPI route
		if (!isFastAPIRoute(nodeText)) {
			return undefined
		}

		// Determine route type and HTTP method
		const { routeType, httpMethod } = extractFastAPIRouteInfo(nodeText)

		// Extract route path
		const routePath = extractFastAPIRoutePath(node)

		// Extract route parameters
		const parameters = extractFastAPIRouteParameters(node)

		// Check if route is async
		const isAsync = extractFastAPIRouteAsync(node)

		// Extract dependencies
		const dependencies = extractFastAPIRouteDependencies(node)

		// Extract response model
		const responseModel = extractFastAPIResponseModel(node)

		// Extract middleware
		const middleware = extractFastAPIMiddleware(node)

		// Extract handler information
		const { handlerType, handlerName } = extractFastAPIRouteHandler(node)

		// Determine endpoint type
		const endpointType = extractFastAPIEndpointType(node, routePath)

		const metadata: FastAPIRouteMetadata = {
			routeType,
			httpMethod,
			routePath,
			parameters,
			isAsync,
			dependencies,
			responseModel,
			middleware,
			handlerType,
			handlerName,
			endpointType,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract FastAPI route metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts FastAPI dependency metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FastAPIDependencyMetadata object or undefined if not a FastAPI dependency
 */
export function extractFastAPIDependencyMetadata(node: Node, text: string): FastAPIDependencyMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a FastAPI dependency
		if (!isFastAPIDependency(nodeText)) {
			return undefined
		}

		// Extract dependency information
		const { name, type, dependencyClass, dependencyFunction, isCached, scope } = extractFastAPIDependencyInfo(node)

		const metadata: FastAPIDependencyMetadata = {
			name,
			type,
			dependencyClass,
			dependencyFunction,
			isCached,
			scope,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract FastAPI dependency metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts FastAPI application metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FastAPIApplicationMetadata object or undefined if not a FastAPI application
 */
export function extractFastAPIApplicationMetadata(node: Node, text: string): FastAPIApplicationMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a FastAPI application
		if (!isFastAPIApplication(nodeText)) {
			return undefined
		}

		// Determine application type
		const applicationType = extractFastAPIApplicationType(nodeText)

		// Extract application metadata
		const { title, description, version } = extractFastAPIApplicationInfo(node)

		// Extract routes
		const routes = extractFastAPIRoutes(node)

		// Extract middleware
		const middleware = extractFastAPIMiddlewareList(node)

		// Extract exception handlers
		const exceptionHandlers = extractFastAPIExceptionHandlers(node)

		// Check for CORS
		const { corsEnabled, corsConfig } = extractFastAPICors(node)

		// Extract static files
		const staticFiles = extractFastAPIStaticFiles(node)

		const metadata: FastAPIApplicationMetadata = {
			applicationType,
			title,
			description,
			version,
			routes,
			middleware,
			exceptionHandlers,
			corsEnabled,
			corsConfig,
			staticFiles,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract FastAPI application metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts FastAPI Pydantic model metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FastAPIPydanticModelMetadata object or undefined if not a FastAPI Pydantic model
 */
export function extractFastAPIPydanticModelMetadata(
	node: Node,
	text: string,
): FastAPIPydanticModelMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a FastAPI Pydantic model
		if (!isFastAPIPydanticModel(nodeText)) {
			return undefined
		}

		// Determine model type
		const { modelType, isGeneric, typeParameters } = extractFastAPIModelType(node)

		// Extract class name
		const className = extractFastAPIModelClassName(node)

		// Extract fields
		const fields = extractFastAPIModelFields(node)

		// Extract validators
		const validators = extractFastAPIModelValidators(node)

		// Extract config
		const config = extractFastAPIModelConfig(node)

		const metadata: FastAPIPydanticModelMetadata = {
			modelType,
			className,
			fields,
			validators,
			config,
			isGeneric,
			typeParameters,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract FastAPI Pydantic model metadata for node type ${node.type}:`, error)
		return undefined
	}
}

// Helper functions for FastAPI metadata extraction

function isFastAPIRoute(nodeText: string): boolean {
	const routePatterns = [
		/@app\.(get|post|put|delete|patch|head|options|trace)\s*\(/,
		/@router\.(get|post|put|delete|patch|head|options|trace)\s*\(/,
	]

	return routePatterns.some((pattern) => pattern.test(nodeText))
}

function isFastAPIDependency(nodeText: string): boolean {
	const dependencyPatterns = [/Depends\s*\(/, /Annotated\s*\[.*,\s*Depends/]

	return dependencyPatterns.some((pattern) => pattern.test(nodeText))
}

function isFastAPIApplication(nodeText: string): boolean {
	const appPatterns = [/FastAPI\s*\(/, /APIRouter\s*\(/]

	return appPatterns.some((pattern) => pattern.test(nodeText))
}

function isFastAPIPydanticModel(nodeText: string): boolean {
	const modelPatterns = [
		/class\s+\w+\s*\(\s*BaseModel\s*\)/,
		/class\s+\w+\s*\(\s*Settings\s*\)/,
		/class\s+\w+\s*\(\s*GenericModel\s*\)/,
	]

	return modelPatterns.some((pattern) => pattern.test(nodeText))
}

function extractFastAPIRouteInfo(nodeText: string): {
	routeType: FastAPIRouteMetadata["routeType"]
	httpMethod: FastAPIRouteMetadata["httpMethod"]
} {
	let routeType: FastAPIRouteMetadata["routeType"] = "app"
	let httpMethod: FastAPIRouteMetadata["httpMethod"] = "GET"

	if (nodeText.includes("@router.")) {
		routeType = "router"
	}

	const methodMatch = nodeText.match(/@(?:app|router)\.(get|post|put|delete|patch|head|options|trace)\s*\(/)
	if (methodMatch) {
		httpMethod = methodMatch[1].toUpperCase() as FastAPIRouteMetadata["httpMethod"]
	}

	return { routeType, httpMethod }
}

function extractFastAPIRoutePath(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && (n.text.includes("@app.") || n.text.includes("@router."))) {
			const pathMatch = n.text.match(
				/@(?:app|router)\.(?:get|post|put|delete|patch|head|options|trace)\s*\(\s*['"`]([^'"`]+)['"`]/,
			)
			if (pathMatch) {
				return pathMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "/"
}

function extractFastAPIRouteParameters(node: Node): FastAPIParameterMetadata[] {
	const parameters: FastAPIParameterMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "function_definition" || n.type === "async_function_definition") {
			const parametersNode = n.childForFieldName("parameters")
			if (parametersNode) {
				for (const param of parametersNode.children || []) {
					if (param && (param.type === "typed_parameter" || param.type === "default_parameter")) {
						const paramInfo = extractFastAPIParameterInfo(param)
						if (paramInfo) {
							parameters.push(paramInfo)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return parameters
}

function extractFastAPIParameterInfo(paramNode: Node): FastAPIParameterMetadata | undefined {
	const nameNode = paramNode.childForFieldName("name")
	if (!nameNode) {
		return undefined
	}

	const name = nameNode.text
	const typeNode = paramNode.childForFieldName("type")
	const type = typeNode?.text

	// Check for FastAPI parameter types
	let paramType: FastAPIParameterMetadata["type"] = "Query"
	let defaultValue: string | undefined
	let validation: FastAPIValidationMetadata | undefined

	if (typeNode) {
		const typeText = typeNode.text

		if (typeText.includes("Path")) {
			paramType = "Path"
		} else if (typeText.includes("Query")) {
			paramType = "Query"
		} else if (typeText.includes("Header")) {
			paramType = "Header"
		} else if (typeText.includes("Cookie")) {
			paramType = "Cookie"
		} else if (typeText.includes("Body")) {
			paramType = "Body"
		} else if (typeText.includes("Form")) {
			paramType = "Form"
		} else if (typeText.includes("File")) {
			paramType = "File"
		} else if (typeText.includes("UploadFile")) {
			paramType = "UploadFile"
		}

		// Extract validation constraints
		validation = extractFastAPIValidation(typeText)
	}

	// Check for default value
	const defaultValueNode = paramNode.childForFieldName("default")
	if (defaultValueNode) {
		defaultValue = defaultValueNode.text
	}

	const required = defaultValue === undefined

	return {
		name,
		type: paramType,
		required,
		defaultValue,
		validation,
	}
}

function extractFastAPIValidation(typeText: string): FastAPIValidationMetadata | undefined {
	const validation: FastAPIValidationMetadata = {}

	// Extract common validation constraints
	const minLengthMatch = typeText.match(/min_length\s*=\s*(\d+)/)
	if (minLengthMatch) {
		validation.minLength = parseInt(minLengthMatch[1], 10)
	}

	const maxLengthMatch = typeText.match(/max_length\s*=\s*(\d+)/)
	if (maxLengthMatch) {
		validation.maxLength = parseInt(maxLengthMatch[1], 10)
	}

	const minValueMatch = typeText.match(/ge\s*=\s*(\d+)/)
	if (minValueMatch) {
		validation.minValue = parseInt(minValueMatch[1], 10)
	}

	const maxValueMatch = typeText.match(/le\s*=\s*(\d+)/)
	if (maxValueMatch) {
		validation.maxValue = parseInt(maxValueMatch[1], 10)
	}

	const patternMatch = typeText.match(/regex\s*=\s*['"`]([^'"`]+)['"`]/)
	if (patternMatch) {
		validation.pattern = patternMatch[1]
	}

	return Object.keys(validation).length > 0 ? validation : undefined
}

function extractFastAPIRouteAsync(node: Node): boolean {
	const traverse = (n: Node): boolean => {
		if (n.type === "async_function_definition") {
			return true
		}

		for (const child of n.children || []) {
			if (child && traverse(child)) {
				return true
			}
		}

		return false
	}

	return traverse(node)
}

function extractFastAPIRouteDependencies(node: Node): string[] {
	const dependencies: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "typed_parameter" || n.type === "default_parameter") {
			const typeNode = n.childForFieldName("type")
			if (typeNode && typeNode.text.includes("Depends")) {
				// Extract dependency function/class name
				const dependsMatch = typeNode.text.match(/Depends\s*\(\s*(\w+)/)
				if (dependsMatch) {
					dependencies.push(dependsMatch[1])
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(dependencies)]
}

function extractFastAPIResponseModel(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && (n.text.includes("@app.") || n.text.includes("@router."))) {
			const responseModelMatch = n.text.match(/response_model\s*=\s*(\w+)/)
			if (responseModelMatch) {
				return responseModelMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFastAPIMiddleware(node: Node): string[] {
	const middleware: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@app.middleware")) {
			const pathMatch = n.text.match(/@app\.middleware\s*\(\s*['"`]([^'"`]+)['"`]/)
			if (pathMatch) {
				middleware.push(pathMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(middleware)]
}

function extractFastAPIRouteHandler(node: Node): {
	handlerType: FastAPIRouteMetadata["handlerType"]
	handlerName?: string
} {
	const traverse = (
		n: Node,
	): { handlerType: FastAPIRouteMetadata["handlerType"]; handlerName?: string } | undefined => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			return { handlerType: "function", handlerName: nameNode?.text }
		} else if (n.type === "async_function_definition") {
			const nameNode = n.childForFieldName("name")
			return { handlerType: "async_function", handlerName: nameNode?.text }
		} else if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			return { handlerType: "method", handlerName: nameNode?.text }
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || { handlerType: "function" }
}

function extractFastAPIEndpointType(node: Node, routePath: string): FastAPIRouteMetadata["endpointType"] {
	const nodeText = node.text

	// Determine endpoint type based on patterns
	if (routePath.includes("/auth") || routePath.includes("/login") || routePath.includes("/register")) {
		return "auth"
	} else if (routePath.includes("/webhook")) {
		return "webhook"
	} else if (routePath.includes("/static") || routePath.includes("/public")) {
		return "static"
	} else if (/(get|post|put|delete|patch)/i.test(nodeText)) {
		// Check for CRUD patterns
		if (routePath.includes("/create") || routePath.includes("/add")) {
			return "crud"
		} else if (routePath.includes("/update") || routePath.includes("/edit")) {
			return "crud"
		} else if (routePath.includes("/delete") || routePath.includes("/remove")) {
			return "crud"
		} else if (routePath.match(/\/\w+\/\d+$/)) {
			// Pattern like /users/123
			return "crud"
		}
	}

	return "custom"
}

function extractFastAPIDependencyInfo(node: Node): {
	name: string
	type: FastAPIDependencyMetadata["type"]
	dependencyClass?: string
	dependencyFunction?: string
	isCached?: boolean
	scope?: FastAPIDependencyMetadata["scope"]
} {
	const nodeText = node.text

	let type: FastAPIDependencyMetadata["type"] = "Depends"
	let dependencyClass: string | undefined
	let dependencyFunction: string | undefined
	let isCached = false
	let scope: FastAPIDependencyMetadata["scope"] = "function"

	if (nodeText.includes("Annotated")) {
		type = "Annotated"
	} else if (nodeText.includes("class")) {
		type = "class"
	} else if (nodeText.includes("def")) {
		type = "function"
	}

	// Extract dependency name
	const nameMatch = nodeText.match(/(?:def|class)\s+(\w+)/)
	const name = nameMatch ? nameMatch[1] : "unknown"

	// Extract dependency class/function
	const depMatch = nodeText.match(/Depends\s*\(\s*(\w+)/)
	if (depMatch) {
		dependencyFunction = depMatch[1]
	}

	// Check for caching
	if (nodeText.includes("lru_cache") || nodeText.includes("cached")) {
		isCached = true
	}

	// Check for scope
	if (nodeText.includes("app")) {
		scope = "application"
	} else if (nodeText.includes("router")) {
		scope = "module"
	} else if (nodeText.includes("class")) {
		scope = "class"
	}

	return {
		name,
		type,
		dependencyClass,
		dependencyFunction,
		isCached,
		scope,
	}
}

function extractFastAPIApplicationType(nodeText: string): FastAPIApplicationMetadata["applicationType"] {
	if (nodeText.includes("APIRouter")) {
		return "APIRouter"
	}
	return "FastAPI"
}

function extractFastAPIApplicationInfo(node: Node): { title?: string; description?: string; version?: string } {
	const nodeText = node.text

	const titleMatch = nodeText.match(/title\s*=\s*['"`]([^'"`]+)['"`]/)
	const descriptionMatch = nodeText.match(/description\s*=\s*['"`]([^'"`]+)['"`]/)
	const versionMatch = nodeText.match(/version\s*=\s*['"`]([^'"`]+)['"`]/)

	return {
		title: titleMatch ? titleMatch[1] : undefined,
		description: descriptionMatch ? descriptionMatch[1] : undefined,
		version: versionMatch ? versionMatch[1] : undefined,
	}
}

function extractFastAPIRoutes(node: Node): string[] {
	const routes: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && (n.text.includes("@app.") || n.text.includes("@router."))) {
			const pathMatch = n.text.match(
				/@(?:app|router)\.(?:get|post|put|delete|patch|head|options|trace)\s*\(\s*['"`]([^'"`]+)['"`]/,
			)
			if (pathMatch) {
				routes.push(pathMatch[1])
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(routes)]
}

function extractFastAPIMiddlewareList(node: Node): FastAPIMiddlewareMetadata[] {
	const middleware: FastAPIMiddlewareMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "call_expression" && n.text.includes("middleware")) {
			const pathMatch = n.text.match(/middleware\s*\(\s*['"`]([^'"`]+)['"`]/)
			if (pathMatch) {
				middleware.push({
					name: pathMatch[1],
					type: "custom",
					path: pathMatch[1],
				})
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return middleware
}

function extractFastAPIExceptionHandlers(node: Node): FastAPIExceptionHandlerMetadata[] {
	const handlers: FastAPIExceptionHandlerMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && n.text.includes("@app.exception_handler")) {
			const exceptionMatch = n.text.match(/@app\.exception_handler\s*\(\s*(\w+)/)
			if (exceptionMatch) {
				const exceptionClass = exceptionMatch[1]

				// Find the handler function
				let handlerFunction = "unknown"
				let isAsync = false

				const nextSibling = n.nextSibling
				if (nextSibling) {
					if (nextSibling.type === "async_function_definition") {
						isAsync = true
						const nameNode = nextSibling.childForFieldName("name")
						if (nameNode) {
							handlerFunction = nameNode.text
						}
					} else if (nextSibling.type === "function_definition") {
						const nameNode = nextSibling.childForFieldName("name")
						if (nameNode) {
							handlerFunction = nameNode.text
						}
					}
				}

				handlers.push({
					exceptionClass,
					handlerFunction,
					isAsync,
				})
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return handlers
}

function extractFastAPICors(node: Node): { corsEnabled: boolean; corsConfig?: FastAPICorsMetadata } {
	const nodeText = node.text
	const corsEnabled = nodeText.includes("CORSMiddleware") || nodeText.includes("cors")

	if (!corsEnabled) {
		return { corsEnabled: false }
	}

	const corsConfig: FastAPICorsMetadata = {}

	const allowOriginsMatch = nodeText.match(/allow_origins\s*=\s*\[([^\]]+)\]/)
	if (allowOriginsMatch) {
		corsConfig.allowOrigins = allowOriginsMatch[1].split(",").map((origin) => origin.trim().replace(/['"]/g, ""))
	}

	const allowMethodsMatch = nodeText.match(/allow_methods\s*=\s*\[([^\]]+)\]/)
	if (allowMethodsMatch) {
		corsConfig.allowMethods = allowMethodsMatch[1].split(",").map((method) => method.trim().replace(/['"]/g, ""))
	}

	const allowHeadersMatch = nodeText.match(/allow_headers\s*=\s*\[([^\]]+)\]/)
	if (allowHeadersMatch) {
		corsConfig.allowHeaders = allowHeadersMatch[1].split(",").map((header) => header.trim().replace(/['"]/g, ""))
	}

	const allowCredentialsMatch = nodeText.match(/allow_credentials\s*=\s*(true|false)/)
	if (allowCredentialsMatch) {
		corsConfig.allowCredentials = allowCredentialsMatch[1] === "true"
	}

	const maxAgeMatch = nodeText.match(/max_age\s*=\s*(\d+)/)
	if (maxAgeMatch) {
		corsConfig.maxAge = parseInt(maxAgeMatch[1], 10)
	}

	return { corsEnabled, corsConfig: Object.keys(corsConfig).length > 0 ? corsConfig : undefined }
}

function extractFastAPIStaticFiles(node: Node): FastAPIStaticFilesMetadata | undefined {
	const nodeText = node.text

	const staticMatch = nodeText.match(
		/StaticFiles\s*\(\s*directory\s*=\s*['"`]([^'"`]+)['"`](?:,\s*path\s*=\s*['"`]([^'"`]+)['"`])?(?:,\s*name\s*=\s*['"`]([^'"`]+)['"`])?/,
	)
	if (staticMatch) {
		return {
			path: staticMatch[2] || "/static",
			directory: staticMatch[1],
			name: staticMatch[3],
		}
	}

	return undefined
}

function extractFastAPIModelType(node: Node): {
	modelType: FastAPIPydanticModelMetadata["modelType"]
	isGeneric: boolean
	typeParameters?: string[]
} {
	const nodeText = node.text

	let modelType: FastAPIPydanticModelMetadata["modelType"] = "BaseModel"
	let isGeneric = false
	let typeParameters: string[] | undefined

	if (nodeText.includes("Settings")) {
		modelType = "Settings"
	} else if (nodeText.includes("GenericModel")) {
		modelType = "GenericModel"
		isGeneric = true

		// Extract type parameters
		const typeParamsMatch = nodeText.match(/class\s+\w+\s*\(\s*GenericModel\s*\[\s*([^\]]+)\s*\]/)
		if (typeParamsMatch) {
			typeParameters = typeParamsMatch[1].split(",").map((param) => param.trim())
		}
	}

	return {
		modelType,
		isGeneric,
		typeParameters,
	}
}

function extractFastAPIModelClassName(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				return nameNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "Unknown"
}

function extractFastAPIModelFields(node: Node): FastAPIFieldMetadata[] {
	const fields: FastAPIFieldMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "class_definition") {
			const bodyNode = n.childForFieldName("body")
			if (bodyNode) {
				for (const child of bodyNode.children || []) {
					if (child && child.type === "expression_statement") {
						const fieldInfo = extractFastAPIFieldInfo(child)
						if (fieldInfo) {
							fields.push(fieldInfo)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return fields
}

function extractFastAPIFieldInfo(fieldNode: Node): FastAPIFieldMetadata | undefined {
	// This is a simplified implementation
	// In a real implementation, you'd need to parse the field assignment more carefully
	const nodeText = fieldNode.text

	// Extract field name
	const nameMatch = nodeText.match(/(\w+)\s*=/)
	if (!nameMatch) {
		return undefined
	}

	const name = nameMatch[1]

	// Extract field type (simplified)
	const typeMatch = nodeText.match(/:\s*(\w+)/)
	const type = typeMatch ? typeMatch[1] : "any"

	// Check if field is required
	const required = !nodeText.includes("Optional") && !nodeText.includes("None")

	// Extract default value
	const defaultValueMatch = nodeText.match(/=\s*(.+)/)
	const defaultValue = defaultValueMatch ? defaultValueMatch[1].trim() : undefined

	return {
		name,
		type,
		required,
		defaultValue,
	}
}

function extractFastAPIModelValidators(node: Node): FastAPIValidatorMetadata[] {
	const validators: FastAPIValidatorMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator" && (n.text.includes("@validator") || n.text.includes("@field_validator"))) {
			const fieldNameMatch = n.text.match(/@(?:validator|field_validator)\s*\(\s*['"`]([^'"`]+)['"`]/)
			if (fieldNameMatch) {
				const fieldName = fieldNameMatch[1]

				// Determine validator type
				let validatorType: FastAPIValidatorMetadata["validatorType"] = "validator"
				if (n.text.includes("@field_validator")) {
					validatorType = "field_validator"
				} else if (n.text.includes("@root_validator")) {
					validatorType = "root_validator"
				} else if (n.text.includes("@model_validator")) {
					validatorType = "model_validator"
				}

				// Find the method name
				let methodName = "unknown"
				const nextSibling = n.nextSibling
				if (
					nextSibling &&
					(nextSibling.type === "function_definition" || nextSibling.type === "async_function_definition")
				) {
					const nameNode = nextSibling.childForFieldName("name")
					if (nameNode) {
						methodName = nameNode.text
					}
				}

				validators.push({
					fieldName,
					validatorType,
					methodName,
				})
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return validators
}

function extractFastAPIModelConfig(node: Node): FastAPIConfigMetadata | undefined {
	const nodeText = node.text

	if (!nodeText.includes("Config")) {
		return undefined
	}

	const config: FastAPIConfigMetadata = {
		configType: "BaseSettings",
	}

	const caseSensitiveMatch = nodeText.match(/case_sensitive\s*=\s*(true|false)/)
	if (caseSensitiveMatch) {
		config.caseSensitive = caseSensitiveMatch[1] === "true"
	}

	const envPrefixMatch = nodeText.match(/env_prefix\s*=\s*['"`]([^'"`]+)['"`]/)
	if (envPrefixMatch) {
		config.envPrefix = envPrefixMatch[1]
	}

	const envFileMatch = nodeText.match(/env_file\s*=\s*['"`]([^'"`]+)['"`]/)
	if (envFileMatch) {
		config.envFile = envFileMatch[1]
	}

	const extraMatch = nodeText.match(/extra\s*=\s*['"`]([^'"`]+)['"`]/)
	if (extraMatch) {
		config.extra = extraMatch[1] as FastAPIConfigMetadata["extra"]
	}

	return Object.keys(config).length > 0 ? config : undefined
}

// Testing framework metadata types
export interface TestingFrameworkMetadata {
	framework:
		| "jest"
		| "vitest"
		| "mocha"
		| "pytest"
		| "unittest"
		| "junit"
		| "testng"
		| "go_testing"
		| "rust_testing"
		| "rspec"
		| "minitest"
		| "phpunit"
		| "pest"
		| "xunit"
		| "nunit"
		| "mstest"
	testType: "unit" | "integration" | "e2e" | "benchmark" | "component"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	spies?: string[]
	fixtures?: string[]
	testData?: string[]
	configuration?: TestingConfigurationMetadata
}

export interface TestingConfigurationMetadata {
	testEnvironment?: string
	setupFiles?: string[]
	coverageConfiguration?: boolean
	testMatch?: string[]
	collectCoverageFrom?: string[]
	testTimeout?: number
	parallel?: boolean
}

export interface JavaScriptTestingMetadata {
	framework: "jest" | "vitest" | "mocha"
	testType: "unit" | "integration" | "e2e" | "component"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	spies?: string[]
	fixtures?: string[]
	testData?: string[]
	imports?: string[]
	configuration?: JavaScriptTestingConfiguration
}

export interface JavaScriptTestingConfiguration {
	testEnvironment?: "node" | "jsdom" | "happy-dom"
	setupFiles?: string[]
	coverageConfiguration?: boolean
	testMatch?: string[]
	collectCoverageFrom?: string[]
	testTimeout?: number
	parallel?: boolean
	moduleFileExtensions?: string[]
	moduleNameMapping?: Record<string, string>
	transform?: Record<string, string>
}

export interface PythonTestingMetadata {
	framework: "pytest" | "unittest"
	testType: "unit" | "integration" | "e2e" | "functional"
	testSuites?: string[]
	testCases?: string[]
	fixtures?: string[]
	parametrizedTests?: string[]
	assertions?: string[]
	mocks?: string[]
	configuration?: PythonTestingConfiguration
}

export interface PythonTestingConfiguration {
	testDiscovery?: string[]
	pythonFiles?: string[]
	pythonClasses?: string[]
	pythonFunctions?: string[]
	addopts?: string[]
	minversion?: string
	requiredPlugins?: string[]
	markers?: Record<string, string>
}

export interface JavaTestingMetadata {
	framework: "junit" | "testng"
	testType: "unit" | "integration" | "e2e"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	configuration?: JavaTestingConfiguration
}

export interface JavaTestingConfiguration {
	testIncludes?: string[]
	testExcludes?: string[]
	parallel?: boolean
	threads?: number
	verbose?: boolean
	systemProperties?: Record<string, string>
	junitVersion?: string
	mockitoVersion?: string
	testngVersion?: string
}

export interface GoTestingMetadata {
	framework: "go_testing"
	testType: "unit" | "integration" | "benchmark"
	testFunctions?: string[]
	benchmarks?: string[]
	examples?: string[]
	tableDrivenTests?: string[]
	subtests?: string[]
	configuration?: GoTestingConfiguration
}

export interface GoTestingConfiguration {
	parallel?: boolean
	short?: boolean
	verbose?: boolean
	race?: boolean
	cpu?: number
	timeout?: string
	run?: string
	bench?: string
	buildTags?: string[]
}

export interface RustTestingMetadata {
	framework: "rust_testing"
	testType: "unit" | "integration" | "doc"
	testFunctions?: string[]
	integrationTests?: string[]
	docTests?: string[]
	configuration?: RustTestingConfiguration
}

export interface RustTestingConfiguration {
	defaultTestFeatures?: string[]
	target?: string
	cargoTestArgs?: string[]
	testProfile?: boolean
}

export interface RubyTestingMetadata {
	framework: "rspec" | "minitest" | "test_unit"
	testType: "unit" | "integration" | "e2e" | "request"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	configuration?: RubyTestingConfiguration
}

export interface RubyTestingConfiguration {
	specFormat?: "documentation" | "progress"
	color?: boolean
	require?: string[]
	pattern?: string
	rspecConfig?: boolean
}

export interface PhpTestingMetadata {
	framework: "phpunit" | "pest"
	testType: "unit" | "integration" | "e2e" | "feature"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	dataProviders?: string[]
	configuration?: PhpTestingConfiguration
}

export interface PhpTestingConfiguration {
	bootstrap?: string
	configuration?: string
	coverage?: boolean
	stopOnFailure?: boolean
	verbose?: boolean
	phpunitConfig?: boolean
}

export interface CSharpTestingMetadata {
	framework: "xunit" | "nunit" | "mstest"
	testType: "unit" | "integration" | "e2e"
	testSuites?: string[]
	testCases?: string[]
	hooks?: string[]
	assertions?: string[]
	mocks?: string[]
	configuration?: CSharpTestingConfiguration
}

export interface CSharpTestingConfiguration {
	parallel?: boolean
	maxParallelThreads?: number
	workerCount?: number
	testCaseFilter?: string
	testFramework?: "xunit" | "nunit" | "mstest"
}

// Build tool configuration metadata types
export interface BuildToolConfigurationMetadata {
	toolType: BuildToolType
	toolName?: string
	toolVersion?: string
	configurationType: ConfigurationType
	filePath?: string
	environment?: string
	buildCommand?: string
	devCommand?: string
	testCommand?: string
	dependencies?: BuildToolDependency[]
	scripts?: Record<string, string>
	plugins?: BuildToolPlugin[]
	loaders?: BuildToolLoader[]
	outputPath?: string
	sourcePaths?: string[]
	optimizationLevel?: string
	targetEnvironment?: string
	enableSourceMaps?: boolean
	enableHotReload?: boolean
	enableMinification?: boolean
	customSettings?: Record<string, any>
}

export type BuildToolType =
	// JavaScript/TypeScript build tools
	| "webpack"
	| "vite"
	| "rollup"
	| "babel"
	| "eslint"
	| "prettier"
	| "typescript"
	| "jest"
	| "vitest"
	| "mocha"
	| "cypress"
	| "playwright"
	| "npm" // Added for package.json
	// Python build tools
	| "poetry"
	| "pip"
	| "setuptools"
	| "pipenv"
	| "conda"
	| "pytest"
	| "black"
	| "flake8"
	| "mypy"
	// Rust build tools
	| "cargo"
	| "rustc"
	| "clippy"
	| "rustfmt"
	// Java build tools
	| "maven"
	| "gradle"
	| "ant"
	| "sbt"
	| "junit"
	// C#/.NET build tools
	| "msbuild"
	| "nuget"
	| "dotnet"
	| "nunit"
	| "xunit"
	// PHP build tools
	| "composer"
	| "phpunit"
	| "pest"
	// Go build tools
	| "go_modules"
	| "go_build"
	| "go_test"
	// Ruby build tools
	| "bundler"
	| "rake"
	| "rspec"
	// General build tools
	| "docker"
	| "github_actions"
	| "gitlab_ci"
	| "jenkins"
	| "make"
	| "cmake"

export type ConfigurationType =
	| "javascript"
	| "typescript"
	| "json"
	| "yaml"
	| "toml"
	| "xml"
	| "ini"
	| "properties"
	| "dockerfile"
	| "makefile"
	| "cmakelists"
	| "gradle_build"
	| "maven_pom"
	| "csproj"
	| "sln"
	| "ruby_gemspec"
	| "python_setup"
	| "python_requirements"
	| "rust_cargo"
	| "go_mod"
	| "composer_json"
	| "ruby"
	| "text"

export interface BuildToolDependency {
	name: string
	version?: string
	type: "runtime" | "development" | "peer" | "optional"
	source?: string
}

export interface BuildToolPlugin {
	name: string
	version?: string
	configuration?: Record<string, any>
	enabled?: boolean
}

export interface BuildToolLoader {
	name: string
	loaderType?: string
	options?: Record<string, any>
	test?: string
	include?: string[]
	exclude?: string[]
}

/**
 * Extracts build tool configuration metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param filePath The file path to determine build tool type
 * @param text The full file content
 * @returns BuildToolConfigurationMetadata object or undefined if not a build tool configuration
 */
export function extractBuildToolConfigurationMetadata(
	node: Node,
	filePath: string,
	text: string,
): BuildToolConfigurationMetadata | undefined {
	try {
		// Determine build tool type based on file path and content
		const { toolType, configurationType } = determineBuildToolType(filePath, text)

		if (!toolType) {
			return undefined
		}

		// Extract build tool-specific information
		const metadata: BuildToolConfigurationMetadata = {
			toolType,
			toolName: extractToolName(node, toolType),
			toolVersion: extractToolVersion(node, text),
			configurationType,
			filePath,
			environment: extractBuildEnvironment(node, text),
			buildCommand: extractBuildCommand(node, text),
			devCommand: extractDevCommand(node, text),
			testCommand: extractTestCommand(node, text),
			dependencies: extractBuildDependencies(node, text),
			scripts: extractBuildScripts(node, text),
			plugins: extractBuildPlugins(node, text),
			loaders: extractBuildLoaders(node, text),
			outputPath: extractOutputPath(node, text),
			sourcePaths: extractSourcePaths(node, text),
			optimizationLevel: extractOptimizationLevel(node, text),
			targetEnvironment: extractTargetEnvironment(node, text),
			enableSourceMaps: extractSourceMapsEnabled(node, text),
			enableHotReload: extractHotReloadEnabled(node, text),
			enableMinification: extractMinificationEnabled(node, text),
			customSettings: extractCustomSettings(node, text),
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract build tool configuration metadata for node type ${node.type}:`, error)
		return undefined
	}
}

// Helper functions for build tool configuration extraction

function determineBuildToolType(
	filePath: string,
	text: string,
): { toolType: BuildToolType; configurationType: ConfigurationType } {
	const fileName = filePath.split("/").pop() || ""
	const fileExtension = fileName.split(".").pop() || ""
	const fileNameLower = fileName.toLowerCase()

	// JavaScript/TypeScript build tools
	if (fileNameLower.includes("webpack.config")) {
		return { toolType: "webpack", configurationType: "javascript" }
	} else if (fileNameLower.includes("vite.config")) {
		return { toolType: "vite", configurationType: "typescript" }
	} else if (fileNameLower.includes("rollup.config")) {
		return { toolType: "rollup", configurationType: "javascript" }
	} else if (fileNameLower.includes("babel.config") || fileNameLower.includes(".babelrc")) {
		return { toolType: "babel", configurationType: "javascript" }
	} else if (fileNameLower.includes("eslint.config") || fileNameLower.includes(".eslintrc")) {
		return { toolType: "eslint", configurationType: "javascript" }
	} else if (fileNameLower.includes("prettier.config") || fileNameLower.includes(".prettierrc")) {
		return { toolType: "prettier", configurationType: "javascript" }
	} else if (fileNameLower === "tsconfig.json") {
		return { toolType: "typescript", configurationType: "json" }
	} else if (fileNameLower === "package.json") {
		return { toolType: "npm", configurationType: "json" }
	} else if (fileNameLower.includes("jest.config") || fileNameLower === "jest.config.js") {
		return { toolType: "jest", configurationType: "javascript" }
	} else if (fileNameLower.includes("vitest.config")) {
		return { toolType: "vitest", configurationType: "typescript" }
	}

	// Python build tools
	else if (fileNameLower === "pyproject.toml") {
		return { toolType: "poetry", configurationType: "toml" }
	} else if (fileNameLower === "poetry.lock") {
		return { toolType: "poetry", configurationType: "toml" }
	} else if (fileNameLower === "requirements.txt") {
		return { toolType: "pip", configurationType: "text" as ConfigurationType }
	} else if (fileNameLower === "setup.py" || fileNameLower === "setup.cfg") {
		return { toolType: "setuptools", configurationType: "python" as ConfigurationType }
	}

	// Rust build tools
	else if (fileNameLower === "cargo.toml") {
		return { toolType: "cargo", configurationType: "toml" }
	} else if (fileNameLower === "cargo.lock") {
		return { toolType: "cargo", configurationType: "toml" }
	}

	// Java build tools
	else if (fileNameLower === "pom.xml") {
		return { toolType: "maven", configurationType: "maven_pom" }
	} else if (fileNameLower.includes("build.gradle")) {
		return { toolType: "gradle", configurationType: "gradle_build" }
	} else if (fileNameLower === "build.xml") {
		return { toolType: "ant", configurationType: "xml" }
	}

	// C#/.NET build tools
	else if (fileNameLower.endsWith(".csproj")) {
		return { toolType: "msbuild", configurationType: "csproj" }
	} else if (fileNameLower.endsWith(".sln")) {
		return { toolType: "msbuild", configurationType: "sln" }
	} else if (fileNameLower === "packages.config") {
		return { toolType: "nuget", configurationType: "xml" }
	}

	// PHP build tools
	else if (fileNameLower === "composer.json") {
		return { toolType: "composer", configurationType: "composer_json" }
	} else if (fileNameLower === "composer.lock") {
		return { toolType: "composer", configurationType: "json" as ConfigurationType }
	}

	// Go build tools
	else if (fileNameLower === "go.mod") {
		return { toolType: "go_modules", configurationType: "go_mod" }
	} else if (fileNameLower === "go.sum") {
		return { toolType: "go_modules", configurationType: "text" as ConfigurationType }
	}

	// Ruby build tools
	else if (fileNameLower === "gemfile") {
		return { toolType: "bundler", configurationType: "ruby" }
	} else if (fileNameLower === "gemfile.lock") {
		return { toolType: "bundler", configurationType: "text" as ConfigurationType }
	} else if (fileNameLower === "rakefile") {
		return { toolType: "rake", configurationType: "ruby" }
	} else if (fileNameLower.endsWith(".gemspec")) {
		return { toolType: "bundler", configurationType: "ruby_gemspec" }
	}

	// Docker and CI/CD
	else if (fileNameLower === "dockerfile") {
		return { toolType: "docker", configurationType: "dockerfile" }
	} else if (fileNameLower.includes("docker-compose")) {
		return { toolType: "docker", configurationType: "yaml" }
	} else if (fileNameLower === ".github" && filePath.includes("workflows")) {
		return { toolType: "github_actions", configurationType: "yaml" }
	} else if (fileNameLower === ".gitlab-ci.yml") {
		return { toolType: "gitlab_ci", configurationType: "yaml" }
	} else if (fileNameLower === "jenkinsfile") {
		return { toolType: "jenkins", configurationType: "text" as ConfigurationType }
	} else if (fileNameLower === "makefile") {
		return { toolType: "make", configurationType: "makefile" }
	} else if (fileNameLower === "cmakelists.txt") {
		return { toolType: "cmake", configurationType: "cmakelists" }
	}

	// Default based on file extension
	if (fileExtension === "json") {
		return { toolType: "npm" as BuildToolType, configurationType: "json" }
	} else if (fileExtension === "yaml" || fileExtension === "yml") {
		return { toolType: "docker" as BuildToolType, configurationType: "yaml" }
	} else if (fileExtension === "toml") {
		return { toolType: "cargo" as BuildToolType, configurationType: "toml" }
	} else if (fileExtension === "xml") {
		return { toolType: "maven" as BuildToolType, configurationType: "xml" }
	}

	return { toolType: "npm" as BuildToolType, configurationType: "json" } // Default fallback
}

function extractToolName(node: Node, toolType: BuildToolType): string | undefined {
	switch (toolType) {
		case "webpack":
		case "vite":
		case "rollup":
		case "babel":
		case "eslint":
		case "prettier":
		case "typescript":
		case "jest":
		case "vitest":
			return toolType
		case "poetry":
		case "pip":
		case "setuptools":
			return toolType
		case "cargo":
			return toolType
		case "maven":
		case "gradle":
		case "ant":
			return toolType
		case "msbuild":
		case "nuget":
		case "dotnet":
			return toolType
		case "composer":
			return toolType
		case "go_modules":
			return toolType
		case "bundler":
		case "rake":
			return toolType
		case "docker":
			return toolType
		default:
			return undefined
	}
}

function extractToolVersion(node: Node, text: string): string | undefined {
	// Extract version from configuration files
	const versionPatterns = [
		/["']?version["']?\s*:\s*["']([^"']+)["']/,
		/["']?toolVersion["']?\s*:\s*["']([^"']+)["']/,
		/["']?node["']?\s*:\s*["'][^"']*["']?\s*["']?\^(\d+\.\d+\.\d+)["']/,
		/<project[^>]*version\s*=\s*["']([^"']+)["']/,
		/<project[^>]*><version[^>]*>([^<]+)<\/version>/,
	]

	for (const pattern of versionPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractBuildEnvironment(node: Node, text: string): string | undefined {
	// Extract environment from configuration
	const envPatterns = [
		/["']?mode["']?\s*:\s*["']([^"']+)["']/,
		/["']?NODE_ENV["']?\s*:\s*["']([^"']+)["']/,
		/["']?environment["']?\s*:\s*["']([^"']+)["']/,
		/<profile[^>]*id["']?\s*=\s*["']([^"']+)["']/,
	]

	for (const pattern of envPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractBuildCommand(node: Node, text: string): string | undefined {
	// Extract build command from package.json scripts or similar
	const buildPatterns = [
		/["']?build["']?\s*:\s*["']([^"']+)["']/,
		/["']?compile["']?\s*:\s*["']([^"']+)["']/,
		/<exec[^>]*>([^<]+)<\/exec>/,
	]

	for (const pattern of buildPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractDevCommand(node: Node, text: string): string | undefined {
	// Extract dev command from package.json scripts or similar
	const devPatterns = [
		/["']?dev["']?\s*:\s*["']([^"']+)["']/,
		/["']?start["']?\s*:\s*["']([^"']+)["']/,
		/["']?serve["']?\s*:\s*["']([^"']+)["']/,
	]

	for (const pattern of devPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractTestCommand(node: Node, text: string): string | undefined {
	// Extract test command from package.json scripts or similar
	const testPatterns = [
		/["']?test["']?\s*:\s*["']([^"']+)["']/,
		/["']?test:script["']?\s*:\s*["']([^"']+)["']/,
		/<goal[^>]*>([^<]+)<\/goal>/,
	]

	for (const pattern of testPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractBuildDependencies(node: Node, text: string): BuildToolDependency[] {
	const dependencies: BuildToolDependency[] = []

	try {
		// Validate input parameters
		if (!text || typeof text !== "string") {
			return dependencies
		}

		// Extract dependencies from package.json, requirements.txt, etc.
		const depPatterns = [
			/["']?dependencies["']?\s*:\s*{([^}]+)}/,
			/["']?devDependencies["']?\s*:\s*{([^}]+)}/,
			/["']?peerDependencies["']?\s*:\s*{([^}]+)}/,
			/["']?optionalDependencies["']?\s*:\s*{([^}]+)}/,
		]

		for (const pattern of depPatterns) {
			try {
				const match = text.match(pattern)
				if (match) {
					// This is a simplified extraction - a real implementation would parse the JSON properly
					const depsText = match[1]
					if (!depsText) continue

					const depMatches = depsText.match(/["']([^"']+)["']?\s*:\s*["']([^"']+)["']/g)
					if (depMatches) {
						// Determine if this is a devDependencies pattern by checking the pattern source
						const isDevDep = pattern.source.includes("devDependencies")
						for (const depMatch of depMatches) {
							try {
								const depParts = depMatch.match(/["']([^"']+)["']?\s*:\s*["']([^"']+)["']/)
								if (depParts && depParts[1]) {
									dependencies.push({
										name: depParts[1],
										version: depParts[2] || undefined,
										type: isDevDep ? "development" : "runtime",
									})
								}
							} catch (depError) {
								console.warn("Failed to parse individual dependency:", depError)
							}
						}
					}
				}
			} catch (patternError) {
				console.warn("Failed to process dependency pattern:", patternError)
			}
		}
	} catch (error) {
		console.warn("Failed to extract build dependencies:", error)
	}

	return dependencies
}

function extractBuildScripts(node: Node, text: string): Record<string, string> {
	const scripts: Record<string, string> = {}

	try {
		// Validate input parameters
		if (!text || typeof text !== "string") {
			return scripts
		}

		// Extract scripts from package.json or similar
		const scriptsPattern = /["']?scripts["']?\s*:\s*{([^}]+)}/
		const match = text.match(scriptsPattern)
		if (match) {
			// This is a simplified extraction - a real implementation would parse the JSON properly
			const scriptsText = match[1]
			if (!scriptsText) return scripts

			const scriptMatches = scriptsText.match(/["']([^"']+)["']?\s*:\s*["']([^"']+)["']/g)
			if (scriptMatches) {
				for (const scriptMatch of scriptMatches) {
					try {
						const scriptParts = scriptMatch.match(/["']([^"']+)["']?\s*:\s*["']([^"']+)["']/)
						if (scriptParts && scriptParts[1] && scriptParts[2]) {
							scripts[scriptParts[1]] = scriptParts[2]
						}
					} catch (scriptError) {
						console.warn("Failed to parse individual script:", scriptError)
					}
				}
			}
		}
	} catch (error) {
		console.warn("Failed to extract build scripts:", error)
	}

	return scripts
}

function extractBuildPlugins(node: Node, text: string): BuildToolPlugin[] {
	const plugins: BuildToolPlugin[] = []

	try {
		// Validate input parameters
		if (!text || typeof text !== "string") {
			return plugins
		}

		// Extract plugins from webpack, rollup, etc.
		const pluginPatterns = [/["']?plugins["']?\s*:\s*\[([^\]]+)\]/, /["']?loaders["']?\s*:\s*\[([^\]]+)\]/]

		for (const pattern of pluginPatterns) {
			try {
				const match = text.match(pattern)
				if (match) {
					// This is a simplified extraction - a real implementation would parse the array properly
					const pluginsText = match[1]
					if (!pluginsText) continue

					const pluginMatches = pluginsText.match(/["']([^"']+)["']?/g)
					if (pluginMatches) {
						for (const pluginMatch of pluginMatches) {
							try {
								const pluginParts = pluginMatch.match(/["']([^"']+)["']?/)
								if (pluginParts && pluginParts[1]) {
									plugins.push({
										name: pluginParts[1],
										enabled: true,
									})
								}
							} catch (pluginError) {
								console.warn("Failed to parse individual plugin:", pluginError)
							}
						}
					}
				}
			} catch (patternError) {
				console.warn("Failed to process plugin pattern:", patternError)
			}
		}
	} catch (error) {
		console.warn("Failed to extract build plugins:", error)
	}

	return plugins
}

function extractBuildLoaders(node: Node, text: string): BuildToolLoader[] {
	const loaders: BuildToolLoader[] = []

	// Extract loaders from webpack, etc.
	const loaderPatterns = [
		/["']?module["']?\s*:\s*{[^}]*["']?rules["']?\s*:\s*\[([^\]]+)\]/,
		/["']?loaders["']?\s*:\s*\[([^\]]+)\]/,
	]

	for (const pattern of loaderPatterns) {
		const match = text.match(pattern)
		if (match) {
			// This is a simplified extraction - a real implementation would parse the array properly
			const loadersText = match[1]
			const loaderMatches = loadersText.match(/["']([^"']+)["']?/g)
			if (loaderMatches) {
				for (const loaderMatch of loaderMatches) {
					loaders.push({
						name: loaderMatch[1],
						loaderType: "module",
					})
				}
			}
		}
	}

	return loaders
}

function extractOutputPath(node: Node, text: string): string | undefined {
	// Extract output path from configuration
	const outputPathPatterns = [
		/["']?output["']?\s*:\s*{[^}]*["']?path["']?\s*:\s*["']([^"']+)["']/,
		/["']?distDir["']?\s*:\s*["']([^"']+)["']/,
		/["']?outDir["']?\s*:\s*["']([^"']+)["']/,
		/<outputDirectory[^>]*>([^<]+)<\/outputDirectory>/,
		/<build><outputDirectory[^>]*>([^<]+)<\/outputDirectory><\/build>/,
	]

	for (const pattern of outputPathPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractSourcePaths(node: Node, text: string): string[] {
	const sourcePaths: string[] = []

	// Extract source paths from configuration
	const sourcePathPatterns = [
		/["']?src["']?\s*:\s*\[([^\]]+)\]/,
		/["']?include["']?\s*:\s*\[([^\]]+)\]/,
		/<sourceDirectory[^>]*>([^<]+)<\/sourceDirectory>/,
		/<build><sourceDirectory[^>]*>([^<]+)<\/sourceDirectory><\/build>/,
	]

	for (const pattern of sourcePathPatterns) {
		const match = text.match(pattern)
		if (match) {
			// This is a simplified extraction - a real implementation would parse the array properly
			const pathsText = match[1]
			const pathMatches = pathsText.match(/["']([^"']+)["']?/g)
			if (pathMatches) {
				for (const pathMatch of pathMatches) {
					sourcePaths.push(pathMatch[1])
				}
			}
		}
	}

	return [...new Set(sourcePaths)]
}

function extractOptimizationLevel(node: Node, text: string): string | undefined {
	// Extract optimization level from configuration
	const optimizationPatterns = [
		/["']?optimization["']?\s*:\s*["']([^"']+)["']/,
		/["']?mode["']?\s*:\s*["']([^"']+)["']/,
		/<configuration><optimize[^>]*>([^<]+)<\/optimize><\/configuration>/,
	]

	for (const pattern of optimizationPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractTargetEnvironment(node: Node, text: string): string | undefined {
	// Extract target environment from configuration
	const targetPatterns = [
		/["']?target["']?\s*:\s*["']([^"']+)["']/,
		/["']?browserslist["']?\s*:\s*\[([^\]]+)\]/,
		/<target[^>]*>([^<]+)<\/target>/,
	]

	for (const pattern of targetPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}

function extractSourceMapsEnabled(node: Node, text: string): boolean | undefined {
	// Extract source maps setting from configuration
	const sourceMapPatterns = [
		/["']?sourceMap["']?\s*:\s*(true|false)/,
		/["']?sourcemap["']?\s*:\s*(true|false)/,
		/<configuration><sourceMap[^>]*>([^<]+)<\/sourceMap><\/configuration>/,
	]

	for (const pattern of sourceMapPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1] === "true"
		}
	}

	return undefined
}

function extractHotReloadEnabled(node: Node, text: string): boolean | undefined {
	// Extract hot reload setting from configuration
	const hotReloadPatterns = [
		/["']?hot["']?\s*:\s*(true|false)/,
		/["']?liveReload["']?\s*:\s*(true|false)/,
		/<configuration><hot[^>]*>([^<]+)<\/hot><\/configuration>/,
	]

	for (const pattern of hotReloadPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1] === "true"
		}
	}

	return undefined
}

function extractMinificationEnabled(node: Node, text: string): boolean | undefined {
	// Extract minification setting from configuration
	const minificationPatterns = [
		/["']?minify["']?\s*:\s*(true|false)/,
		/["']?minimize["']?\s*:\s*(true|false)/,
		/<configuration><minify[^>]*>([^<]+)<\/minify><\/configuration>/,
	]

	for (const pattern of minificationPatterns) {
		const match = text.match(pattern)
		if (match) {
			return match[1] === "true"
		}
	}

	return undefined
}

function extractCustomSettings(node: Node, text: string): Record<string, any> {
	const customSettings: Record<string, any> = {}

	// Extract custom settings from configuration
	// This is a simplified implementation - a real implementation would need to parse the configuration properly
	const customPatterns = [
		{ regex: /["']?resolve["']?\s*:\s*{([^}]+)}/, name: "resolve" },
		{ regex: /["']?alias["']?\s*:\s*{([^}]+)}/, name: "alias" },
		{ regex: /["']?define["']?\s*:\s*{([^}]+)}/, name: "define" },
	]

	for (const pattern of customPatterns) {
		const match = text.match(pattern.regex)
		if (match) {
			customSettings[pattern.name] = match[1]
		}
	}

	return customSettings
}

// Helper functions for Django metadata extraction

function isDjangoView(nodeText: string): boolean {
	return (
		nodeText.includes("request") ||
		nodeText.includes("render") ||
		nodeText.includes("HttpResponse") ||
		nodeText.includes("JsonResponse") ||
		nodeText.includes("View") ||
		nodeText.includes("TemplateView") ||
		nodeText.includes("ListView") ||
		nodeText.includes("DetailView")
	)
}

function extractDjangoViewType(node: Node): DjangoViewMetadata["viewType"] {
	const nodeText = node.text
	return nodeText.includes("class ") ? "class_based" : "function_based"
}

function extractDjangoViewName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoViewClassName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoViewBaseClass(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const superclassNode = n.childForFieldName("superclass")
			if (superclassNode) {
				const baseClassNode = superclassNode.childForFieldName("argument_list")
				if (baseClassNode) {
					const identifierNode = baseClassNode.childForFieldName("type")
					if (identifierNode) {
						return identifierNode.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoRequestParam(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "typed_parameter") {
			const nameNode = n.childForFieldName("name")
			if (nameNode) {
				const typeNode = n.childForFieldName("type")
				if (typeNode && typeNode.text.includes("HttpRequest")) {
					return nameNode.text
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoRequestType(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "typed_parameter") {
			const typeNode = n.childForFieldName("type")
			if (typeNode) {
				return typeNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoTemplatePath(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && (functionNode.text === "render" || functionNode.text === "render_to_response")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode) {
					const firstArg = argumentsNode.children?.[0]
					if (firstArg && firstArg.type === "string") {
						return firstArg.text.replace(/['"]/g, "")
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoResponseType(node: Node): DjangoViewMetadata["responseType"] {
	const nodeText = node.text
	if (nodeText.includes("render") || nodeText.includes("render_to_response")) {
		return "render"
	} else if (nodeText.includes("JsonResponse")) {
		return "json"
	} else if (nodeText.includes("HttpResponse")) {
		return "http"
	}
	return "render"
}

function extractDjangoFormHandling(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("request.POST") || nodeText.includes("request.GET") || nodeText.includes("request.FILES")
}

function extractDjangoAuthDecorators(node: Node): string[] {
	const decorators: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "decorator") {
			const decoratorText = n.text
			if (
				decoratorText.includes("login_required") ||
				decoratorText.includes("permission_required") ||
				decoratorText.includes("user_passes_test")
			) {
				decorators.push(decoratorText)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(decorators)]
}

function extractDjangoViewAsync(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("async def") || nodeText.includes("async ")
}

function isDjangoModel(nodeText: string): boolean {
	return (
		nodeText.includes("models.Model") ||
		nodeText.includes("CharField") ||
		nodeText.includes("IntegerField") ||
		nodeText.includes("ForeignKey") ||
		nodeText.includes("ManyToManyField")
	)
}

function extractDjangoModelName(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "Unknown"
}

function extractDjangoModelBaseClass(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const superclassNode = n.childForFieldName("superclass")
			if (superclassNode) {
				const baseClassNode = superclassNode.childForFieldName("argument_list")
				if (baseClassNode) {
					const identifierNode = baseClassNode.childForFieldName("type")
					if (identifierNode) {
						return identifierNode.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoModelFields(node: Node): DjangoFieldMetadata[] {
	const fields: DjangoFieldMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "expression_statement") {
			const assignmentNode = n.children?.find((child) => child && child.type === "assignment")
			if (assignmentNode) {
				const leftNode = assignmentNode.childForFieldName("left")
				const rightNode = assignmentNode.childForFieldName("right")

				if (leftNode && rightNode && rightNode.type === "call_expression") {
					const nameNode = leftNode.childForFieldName("name")
					const functionNode = rightNode.childForFieldName("function")

					if (nameNode && functionNode) {
						const fieldName = nameNode.text
						const fieldType = functionNode.text

						// Check if it's a Django field type
						if (fieldType.includes("Field")) {
							const field: DjangoFieldMetadata = {
								name: fieldName,
								type: fieldType,
								isRelation:
									fieldType.includes("ForeignKey") ||
									fieldType.includes("ManyToManyField") ||
									fieldType.includes("OneToOneField"),
							}

							// Extract field options
							const argumentsNode = rightNode.childForFieldName("arguments")
							if (argumentsNode) {
								field.options = extractDjangoFieldOptions(argumentsNode)
							}

							fields.push(field)
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return fields
}

function extractDjangoFieldOptions(argumentsNode: Node): Record<string, any> {
	const options: Record<string, any> = {}

	for (const child of argumentsNode.children || []) {
		if (child && child.type === "keyword_argument") {
			const nameNode = child.childForFieldName("name")
			const valueNode = child.childForFieldName("value")

			if (nameNode && valueNode) {
				options[nameNode.text] = valueNode.text
			}
		}
	}

	return options
}

function extractDjangoModelMethods(node: Node): string[] {
	const methods: string[] = []
	const methodNames = ["save", "delete", "get_absolute_url", "clean"]

	const traverse = (n: Node) => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			if (nameNode && methodNames.includes(nameNode.text)) {
				methods.push(nameNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(methods)]
}

function extractDjangoForeignKeys(node: Node): DjangoRelationshipMetadata[] {
	const relationships: DjangoRelationshipMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "expression_statement") {
			const assignmentNode = n.children?.find((child) => child && child.type === "assignment")
			if (assignmentNode) {
				const leftNode = assignmentNode.childForFieldName("left")
				const rightNode = assignmentNode.childForFieldName("right")

				if (leftNode && rightNode && rightNode.type === "call_expression") {
					const nameNode = leftNode.childForFieldName("name")
					const functionNode = rightNode.childForFieldName("function")

					if (nameNode && functionNode && functionNode.text === "ForeignKey") {
						const argumentsNode = rightNode.childForFieldName("arguments")
						let relatedModel = "Unknown"

						if (argumentsNode) {
							const firstArg = argumentsNode.children?.[0]
							if (firstArg) {
								relatedModel = firstArg.text
							}
						}

						relationships.push({
							fieldName: nameNode.text,
							relatedModel,
							relationshipType: "ForeignKey",
						})
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return relationships
}

function extractDjangoManyToManyFields(node: Node): DjangoRelationshipMetadata[] {
	const relationships: DjangoRelationshipMetadata[] = []

	const traverse = (n: Node) => {
		if (n.type === "expression_statement") {
			const assignmentNode = n.children?.find((child) => child && child.type === "assignment")
			if (assignmentNode) {
				const leftNode = assignmentNode.childForFieldName("left")
				const rightNode = assignmentNode.childForFieldName("right")

				if (leftNode && rightNode && rightNode.type === "call_expression") {
					const nameNode = leftNode.childForFieldName("name")
					const functionNode = rightNode.childForFieldName("function")

					if (nameNode && functionNode && functionNode.text === "ManyToManyField") {
						const argumentsNode = rightNode.childForFieldName("arguments")
						let relatedModel = "Unknown"

						if (argumentsNode) {
							const firstArg = argumentsNode.children?.[0]
							if (firstArg) {
								relatedModel = firstArg.text
							}
						}

						relationships.push({
							fieldName: nameNode.text,
							relatedModel,
							relationshipType: "ManyToManyField",
						})
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return relationships
}

function extractDjangoTableName(node: Node): string | undefined {
	const nodeText = node.text
	const metaMatch = nodeText.match(/class\s+Meta[\s\S]*?db_table\s*=\s*['"`]([^'"`]+)['"`]/)
	return metaMatch ? metaMatch[1] : undefined
}

function extractDjangoVerboseName(node: Node): string | undefined {
	const nodeText = node.text
	const metaMatch = nodeText.match(/class\s+Meta[\s\S]*?verbose_name\s*=\s*['"`]([^'"`]+)['"`]/)
	return metaMatch ? metaMatch[1] : undefined
}

function extractDjangoDbTable(node: Node): string | undefined {
	return extractDjangoTableName(node)
}

function isDjangoUrl(nodeText: string): boolean {
	return nodeText.includes("path(") || nodeText.includes("re_path(") || nodeText.includes("urlpatterns")
}

function extractDjangoUrlPattern(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && (functionNode.text === "path" || functionNode.text === "re_path")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode) {
					const firstArg = argumentsNode.children?.[0]
					if (firstArg && firstArg.type === "string") {
						return firstArg.text.replace(/['"]/g, "")
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "/"
}

function extractDjangoUrlViewFunction(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && (functionNode.text === "path" || functionNode.text === "re_path")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 1) {
					const secondArg = argumentsNode.children[1]
					if (secondArg && secondArg.type === "identifier") {
						return secondArg.text
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoUrlViewClass(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && (functionNode.text === "path" || functionNode.text === "re_path")) {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode && argumentsNode.children && argumentsNode.children.length > 1) {
					const secondArg = argumentsNode.children[1]
					if (secondArg && secondArg.type === "call_expression") {
						const innerFunctionNode = secondArg.childForFieldName("function")
						if (innerFunctionNode && innerFunctionNode.type === "identifier") {
							return innerFunctionNode.text
						}
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractDjangoUrlParameters(node: Node): string[] {
	const urlPattern = extractDjangoUrlPattern(node)
	if (!urlPattern) {
		return []
	}

	const parameters: string[] = []
	const paramMatches = urlPattern.match(/<([a-zA-Z_:]+)>/g)
	if (paramMatches) {
		for (const match of paramMatches) {
			const param = match.slice(1, -1) // Remove < and >
			parameters.push(param)
		}
	}

	return parameters
}

function extractDjangoUrlName(node: Node): string | undefined {
	const nodeText = node.text
	const nameMatch = nodeText.match(/name\s*=\s*['"`]([^'"`]+)['"`]/)
	return nameMatch ? nameMatch[1] : undefined
}

function extractDjangoUrlType(node: Node): DjangoUrlMetadata["urlType"] {
	const nodeText = node.text
	return nodeText.includes("re_path(") ? "re_path" : "path"
}

function extractDjangoUrlInclude(node: Node): string | undefined {
	const nodeText = node.text
	const includeMatch = nodeText.match(/include\s*\(\s*['"`]([^'"`]+)['"`]/)
	return includeMatch ? includeMatch[1] : undefined
}

function extractDjangoUrlNamespace(node: Node): string | undefined {
	const nodeText = node.text
	const namespaceMatch = nodeText.match(/namespace\s*=\s*['"`]([^'"`]+)['"`]/)
	return namespaceMatch ? namespaceMatch[1] : undefined
}

function isDjangoOrm(nodeText: string): boolean {
	return (
		nodeText.includes(".objects.") ||
		nodeText.includes(".filter(") ||
		nodeText.includes(".get(") ||
		nodeText.includes(".all(")
	)
}

function extractDjangoOrmModelName(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "member_expression") {
			const objectNode = n.childForFieldName("object")
			const propertyNode = n.childForFieldName("property")

			if (objectNode && propertyNode && propertyNode.text === "objects") {
				return objectNode.text
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "Unknown"
}

function extractDjangoOrmOperation(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.type === "member_expression") {
				const propertyNode = functionNode.childForFieldName("property")
				if (propertyNode) {
					return propertyNode.text
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "unknown"
}

function extractDjangoOrmMethod(node: Node): string | undefined {
	return extractDjangoOrmOperation(node)
}

function extractDjangoOrmFilters(node: Node): Record<string, any> | undefined {
	// This is a simplified implementation
	// In a real implementation, you'd need to parse filter arguments more carefully
	const nodeText = node.text
	const filterMatch = nodeText.match(/\.filter\s*\(\s*([^)]+)\s*\)/)
	if (filterMatch) {
		// This is a very basic parsing of filter arguments
		// A real implementation would need to handle complex expressions
		return { raw: filterMatch[1] }
	}
	return undefined
}

function extractDjangoOrmOrderBy(node: Node): string[] | undefined {
	const nodeText = node.text
	const orderByMatch = nodeText.match(/\.order_by\s*\(\s*([^)]+)\s*\)/)
	if (orderByMatch) {
		return orderByMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
	}
	return undefined
}

function extractDjangoOrmValues(node: Node): string[] | undefined {
	const nodeText = node.text
	const valuesMatch = nodeText.match(/\.values\s*\(\s*([^)]+)\s*\)/)
	if (valuesMatch) {
		return valuesMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
	}
	return undefined
}

function extractDjangoOrmAnnotations(node: Node): Record<string, any> | undefined {
	const nodeText = node.text
	const annotateMatch = nodeText.match(/\.annotate\s*\(\s*([^)]+)\s*\)/)
	if (annotateMatch) {
		// This is a very basic parsing of annotation arguments
		// A real implementation would need to handle complex expressions
		return { raw: annotateMatch[1] }
	}
	return undefined
}

function extractDjangoOrmAggregations(node: Node): Record<string, any> | undefined {
	const nodeText = node.text
	const aggregateMatch = nodeText.match(/\.aggregate\s*\(\s*([^)]+)\s*\)/)
	if (aggregateMatch) {
		// This is a very basic parsing of aggregation arguments
		// A real implementation would need to handle complex expressions
		return { raw: aggregateMatch[1] }
	}
	return undefined
}

function extractDjangoOrmLimit(node: Node): number | undefined {
	const nodeText = node.text
	const limitMatch = nodeText.match(/\[:(\d+)\]/)
	if (limitMatch) {
		return parseInt(limitMatch[1], 10)
	}
	return undefined
}

function extractDjangoOrmOffset(node: Node): number | undefined {
	const nodeText = node.text
	const offsetMatch = nodeText.match(/\[(\d+):\]/)
	if (offsetMatch) {
		return parseInt(offsetMatch[1], 10)
	}
	return undefined
}

function extractDjangoOrmDistinct(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes(".distinct(")
}

function extractDjangoOrmSelectRelated(node: Node): string[] | undefined {
	const nodeText = node.text
	const selectRelatedMatch = nodeText.match(/\.select_related\s*\(\s*([^)]+)\s*\)/)
	if (selectRelatedMatch) {
		return selectRelatedMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
	}
	return undefined
}

function extractDjangoOrmPrefetchRelated(node: Node): string[] | undefined {
	const nodeText = node.text
	const prefetchRelatedMatch = nodeText.match(/\.prefetch_related\s*\(\s*([^)]+)\s*\)/)
	if (prefetchRelatedMatch) {
		return prefetchRelatedMatch[1].split(",").map((s) => s.trim().replace(/['"]/g, ""))
	}
	return undefined
}

function isDjangoMigration(nodeText: string): boolean {
	return nodeText.includes("migrate") || nodeText.includes("makemigrations") || nodeText.includes("sqlmigrate")
}

function extractDjangoMigrationCommand(node: Node): string {
	const nodeText = node.text
	if (nodeText.includes("migrate")) {
		return "migrate"
	} else if (nodeText.includes("makemigrations")) {
		return "makemigrations"
	} else if (nodeText.includes("sqlmigrate")) {
		return "sqlmigrate"
	}
	return "unknown"
}

function extractDjangoMigrationApp(node: Node): string | undefined {
	const nodeText = node.text
	const appMatch = nodeText.match(/(\w+)\s*$/)
	return appMatch ? appMatch[1] : undefined
}

function extractDjangoMigrationName(node: Node): string | undefined {
	const nodeText = node.text
	const nameMatch = nodeText.match(/(\w+)\s+(\w+)\s*$/)
	return nameMatch ? nameMatch[2] : undefined
}

function extractDjangoMigrationFake(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("--fake")
}

function extractDjangoMigrationFakeInitial(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("--fake-initial")
}

function extractDjangoMigrationPlan(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("--plan")
}

function extractDjangoMigrationExecuted(node: Node): string[] {
	// This would need to be implemented based on the actual output format
	return []
}

function extractDjangoMigrationPending(node: Node): string[] {
	// This would need to be implemented based on the actual output format
	return []
}

// Helper functions for Flask metadata extraction

function isFlaskRoute(nodeText: string): boolean {
	return nodeText.includes("@app.route") || nodeText.includes("@route") || nodeText.includes("Flask")
}

function extractFlaskRoutePath(node: Node): string {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "decorator" && n.text.includes("route")) {
			const pathMatch = n.text.match(/route\s*\(\s*['"`]([^'"`]+)['"`]/)
			if (pathMatch) {
				return pathMatch[1]
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node) || "/"
}

function extractFlaskHttpMethod(node: Node): string {
	const nodeText = node.text
	if (nodeText.includes("methods=")) {
		const methodsMatch = nodeText.match(/methods\s*=\s*\[([^\]]+)\]/)
		if (methodsMatch) {
			const methods = methodsMatch[1].split(",").map((m) => m.trim().replace(/['"]/g, ""))
			return methods[0] || "GET"
		}
	}
	return "GET"
}

function extractFlaskRouteFunctionName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFlaskRouteEndpoint(node: Node): string | undefined {
	const nodeText = node.text
	const endpointMatch = nodeText.match(/endpoint\s*=\s*['"`]([^'"`]+)['"`]/)
	return endpointMatch ? endpointMatch[1] : undefined
}

function extractFlaskRouteRule(node: Node): string | undefined {
	const nodeText = node.text
	const ruleMatch = nodeText.match(/rule\s*=\s*['"`]([^'"`]+)['"`]/)
	return ruleMatch ? ruleMatch[1] : undefined
}

function extractFlaskRouteMethods(node: Node): string[] {
	const nodeText = node.text
	const methodsMatch = nodeText.match(/methods\s*=\s*\[([^\]]+)\]/)
	if (methodsMatch) {
		return methodsMatch[1].split(",").map((m) => m.trim().replace(/['"]/g, ""))
	}
	return ["GET"]
}

function extractFlaskRouteAutomaticOptions(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("provide_automatic_options=False")
}

function extractFlaskRouteDefaults(node: Node): Record<string, any> | undefined {
	const nodeText = node.text
	const defaultsMatch = nodeText.match(/defaults\s*=\s*{([^}]+)}/)
	if (defaultsMatch) {
		// This is a very basic parsing of defaults
		// A real implementation would need to handle complex expressions
		return { raw: defaultsMatch[1] }
	}
	return undefined
}

function extractFlaskRouteAsync(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("async def") || nodeText.includes("async ")
}

function isFlaskView(nodeText: string): boolean {
	return (
		nodeText.includes("render_template") ||
		nodeText.includes("jsonify") ||
		nodeText.includes("request") ||
		nodeText.includes("Flask")
	)
}

function extractFlaskViewType(node: Node): FlaskViewMetadata["viewType"] {
	const nodeText = node.text
	return nodeText.includes("class ") ? "class_based" : "function"
}

function extractFlaskViewFunctionName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "function_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFlaskViewClassName(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "class_definition") {
			const nameNode = n.childForFieldName("name")
			return nameNode?.text
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFlaskViewTemplatePath(node: Node): string | undefined {
	const traverse = (n: Node): string | undefined => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "render_template") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode) {
					const firstArg = argumentsNode.children?.[0]
					if (firstArg && firstArg.type === "string") {
						return firstArg.text.replace(/['"]/g, "")
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFlaskViewResponseType(node: Node): FlaskViewMetadata["responseType"] {
	const nodeText = node.text
	if (nodeText.includes("render_template")) {
		return "render"
	} else if (nodeText.includes("jsonify")) {
		return "json"
	} else if (nodeText.includes("redirect")) {
		return "redirect"
	}
	return "string"
}

function extractFlaskViewRequestAccess(node: Node): string[] {
	const properties: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "member_expression") {
			const objectNode = n.childForFieldName("object")
			const propertyNode = n.childForFieldName("property")

			if (objectNode && objectNode.text === "request" && propertyNode) {
				const propertyName = propertyNode.text
				if (["form", "args", "json", "files", "cookies"].includes(propertyName)) {
					properties.push(propertyName)
				}
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(properties)]
}

function extractFlaskViewFormHandling(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("request.form") || nodeText.includes("request.args") || nodeText.includes("request.files")
}

function extractFlaskViewAsync(node: Node): boolean {
	const nodeText = node.text
	return nodeText.includes("async def") || nodeText.includes("async ")
}

function isFlaskRequest(nodeText: string): boolean {
	return nodeText.includes("request.") || nodeText.includes("request.form") || nodeText.includes("request.args")
}

function extractFlaskRequestType(node: Node): FlaskRequestMetadata["requestType"] {
	const nodeText = node.text
	if (nodeText.includes("request.form")) {
		return "form"
	} else if (nodeText.includes("request.args")) {
		return "args"
	} else if (nodeText.includes("request.json")) {
		return "json"
	} else if (nodeText.includes("request.files")) {
		return "files"
	} else if (nodeText.includes("request.cookies")) {
		return "cookies"
	}
	return "form"
}

function extractFlaskRequestProperties(node: Node): string[] {
	const properties: string[] = []

	const traverse = (n: Node) => {
		if (n.type === "member_expression") {
			const objectNode = n.childForFieldName("object")
			const propertyNode = n.childForFieldName("property")

			if (objectNode && objectNode.text === "request" && propertyNode) {
				properties.push(propertyNode.text)
			}
		}

		for (const child of n.children || []) {
			if (child) traverse(child)
		}
	}

	traverse(node)
	return [...new Set(properties)]
}

function extractFlaskRequestValidation(node: Node): FlaskValidationMetadata | undefined {
	// This would need to be implemented based on the specific validation library used
	return undefined
}

function extractFlaskRequestFileUploads(node: Node): FlaskFileUploadMetadata[] {
	// This would need to be implemented based on the specific file handling pattern
	return []
}

function isFlaskResponse(nodeText: string): boolean {
	return nodeText.includes("render_template") || nodeText.includes("jsonify") || nodeText.includes("redirect")
}

function extractFlaskResponseType(node: Node): FlaskResponseMetadata["responseType"] {
	const nodeText = node.text
	if (nodeText.includes("render_template")) {
		return "render_template"
	} else if (nodeText.includes("jsonify")) {
		return "jsonify"
	} else if (nodeText.includes("redirect")) {
		return "redirect"
	}
	return "string"
}

function extractFlaskResponseTemplatePath(node: Node): string | undefined {
	return extractFlaskViewTemplatePath(node)
}

function extractFlaskResponseData(node: Node): any {
	const traverse = (n: Node): any => {
		if (n.type === "call_expression") {
			const functionNode = n.childForFieldName("function")
			if (functionNode && functionNode.text === "jsonify") {
				const argumentsNode = n.childForFieldName("arguments")
				if (argumentsNode) {
					const firstArg = argumentsNode.children?.[0]
					if (firstArg) {
						return { raw: firstArg.text }
					}
				}
			}
		}

		for (const child of n.children || []) {
			if (child) {
				const result = traverse(child)
				if (result) return result
			}
		}

		return undefined
	}

	return traverse(node)
}

function extractFlaskResponseStatusCode(node: Node): number | undefined {
	const nodeText = node.text
	const statusMatch = nodeText.match(/status\s*=\s*(\d+)/)
	if (statusMatch) {
		return parseInt(statusMatch[1], 10)
	}
	return undefined
}

function extractFlaskResponseHeaders(node: Node): Record<string, string> | undefined {
	const nodeText = node.text
	const headersMatch = nodeText.match(/headers\s*=\s*{([^}]+)}/)
	if (headersMatch) {
		// This is a very basic parsing of headers
		// A real implementation would need to handle complex expressions
		return { raw: headersMatch[1] }
	}
	return undefined
}

function extractFlaskResponseMimeType(node: Node): string | undefined {
	const nodeText = node.text
	const mimeTypeMatch = nodeText.match(/mimetype\s*=\s*['"`]([^'"`]+)['"`]/)
	return mimeTypeMatch ? mimeTypeMatch[1] : undefined
}

// Django metadata extraction functions

/**
 * Extracts Django view metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns DjangoViewMetadata object or undefined if not a Django view
 */
export function extractDjangoViewMetadata(node: Node, text: string): DjangoViewMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Django view
		if (!isDjangoView(nodeText)) {
			return undefined
		}

		// Determine view type
		const viewType = extractDjangoViewType(node)

		// Extract view information
		const viewName = extractDjangoViewName(node)
		const className = extractDjangoViewClassName(node)
		const baseClass = extractDjangoViewBaseClass(node)
		const requestParam = extractDjangoRequestParam(node)
		const requestType = extractDjangoRequestType(node)
		const templatePath = extractDjangoTemplatePath(node)
		const responseType = extractDjangoResponseType(node)
		const formHandling = extractDjangoFormHandling(node)
		const authDecorators = extractDjangoAuthDecorators(node)
		const isAsync = extractDjangoViewAsync(node)

		const metadata: DjangoViewMetadata = {
			viewType,
			viewName,
			className,
			baseClass,
			requestParam,
			requestType,
			templatePath,
			responseType,
			formHandling,
			authDecorators,
			isAsync,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Django view metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Django model metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns DjangoModelMetadata object or undefined if not a Django model
 */
export function extractDjangoModelMetadata(node: Node, text: string): DjangoModelMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Django model
		if (!isDjangoModel(nodeText)) {
			return undefined
		}

		// Extract model information
		const modelName = extractDjangoModelName(node)
		const baseClass = extractDjangoModelBaseClass(node)
		const fields = extractDjangoModelFields(node)
		const methods = extractDjangoModelMethods(node)
		const foreignKeys = extractDjangoForeignKeys(node)
		const manyToManyFields = extractDjangoManyToManyFields(node)
		const tableName = extractDjangoTableName(node)
		const verboseName = extractDjangoVerboseName(node)
		const dbTable = extractDjangoDbTable(node)

		const metadata: DjangoModelMetadata = {
			modelName,
			baseClass,
			fields,
			methods,
			foreignKeys,
			manyToManyFields,
			tableName,
			verboseName,
			dbTable,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Django model metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Django URL metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns DjangoUrlMetadata object or undefined if not a Django URL
 */
export function extractDjangoUrlMetadata(node: Node, text: string): DjangoUrlMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Django URL
		if (!isDjangoUrl(nodeText)) {
			return undefined
		}

		// Extract URL information
		const urlPattern = extractDjangoUrlPattern(node)
		const viewFunction = extractDjangoUrlViewFunction(node)
		const viewClass = extractDjangoUrlViewClass(node)
		const parameters = extractDjangoUrlParameters(node)
		const name = extractDjangoUrlName(node)
		const urlType = extractDjangoUrlType(node)
		const include = extractDjangoUrlInclude(node)
		const namespace = extractDjangoUrlNamespace(node)

		const metadata: DjangoUrlMetadata = {
			urlPattern,
			viewFunction,
			viewClass,
			parameters,
			name,
			urlType,
			include,
			namespace,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Django URL metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Django ORM metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns DjangoOrmMetadata object or undefined if not a Django ORM operation
 */
export function extractDjangoOrmMetadata(node: Node, text: string): DjangoOrmMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Django ORM operation
		if (!isDjangoOrm(nodeText)) {
			return undefined
		}

		// Extract ORM information
		const modelName = extractDjangoOrmModelName(node)
		const operation = extractDjangoOrmOperation(node)
		const method = extractDjangoOrmMethod(node)
		const filters = extractDjangoOrmFilters(node)
		const orderBy = extractDjangoOrmOrderBy(node)
		const values = extractDjangoOrmValues(node)
		const annotations = extractDjangoOrmAnnotations(node)
		const aggregations = extractDjangoOrmAggregations(node)
		const limit = extractDjangoOrmLimit(node)
		const offset = extractDjangoOrmOffset(node)
		const distinct = extractDjangoOrmDistinct(node)
		const selectRelated = extractDjangoOrmSelectRelated(node)
		const prefetchRelated = extractDjangoOrmPrefetchRelated(node)

		const metadata: DjangoOrmMetadata = {
			modelName,
			operation,
			method,
			filters,
			orderBy,
			values,
			annotations,
			aggregations,
			limit,
			offset,
			distinct,
			selectRelated,
			prefetchRelated,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Django ORM metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Django migration metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns DjangoMigrationMetadata object or undefined if not a Django migration
 */
export function extractDjangoMigrationMetadata(node: Node, text: string): DjangoMigrationMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Django migration
		if (!isDjangoMigration(nodeText)) {
			return undefined
		}

		// Extract migration information
		const command = extractDjangoMigrationCommand(node)
		const app = extractDjangoMigrationApp(node)
		const migrationName = extractDjangoMigrationName(node)
		const fake = extractDjangoMigrationFake(node)
		const fakeInitial = extractDjangoMigrationFakeInitial(node)
		const plan = extractDjangoMigrationPlan(node)
		const executedMigrations = extractDjangoMigrationExecuted(node)
		const pendingMigrations = extractDjangoMigrationPending(node)

		const metadata: DjangoMigrationMetadata = {
			command,
			app,
			migrationName,
			fake,
			fakeInitial,
			plan,
			executedMigrations,
			pendingMigrations,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Django migration metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Flask route metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FlaskRouteMetadata object or undefined if not a Flask route
 */
export function extractFlaskRouteMetadata(node: Node, text: string): FlaskRouteMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Flask route
		if (!isFlaskRoute(nodeText)) {
			return undefined
		}

		// Extract route information
		const routePath = extractFlaskRoutePath(node)
		const httpMethod = extractFlaskHttpMethod(node)
		const functionName = extractFlaskRouteFunctionName(node)
		const endpoint = extractFlaskRouteEndpoint(node)
		const rule = extractFlaskRouteRule(node)
		const methods = extractFlaskRouteMethods(node)
		const provideAutomaticOptions = extractFlaskRouteAutomaticOptions(node)
		const defaults = extractFlaskRouteDefaults(node)
		const isAsync = extractFlaskRouteAsync(node)

		const metadata: FlaskRouteMetadata = {
			routePath,
			httpMethod,
			functionName,
			endpoint,
			rule,
			methods,
			provideAutomaticOptions,
			defaults,
			isAsync,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Flask route metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Flask view metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FlaskViewMetadata object or undefined if not a Flask view
 */
export function extractFlaskViewMetadata(node: Node, text: string): FlaskViewMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Flask view
		if (!isFlaskView(nodeText)) {
			return undefined
		}

		// Extract view information
		const viewType = extractFlaskViewType(node)
		const functionName = extractFlaskViewFunctionName(node)
		const className = extractFlaskViewClassName(node)
		const templatePath = extractFlaskViewTemplatePath(node)
		const responseType = extractFlaskViewResponseType(node)
		const requestAccess = extractFlaskViewRequestAccess(node)
		const formHandling = extractFlaskViewFormHandling(node)
		const isAsync = extractFlaskViewAsync(node)

		const metadata: FlaskViewMetadata = {
			viewType,
			functionName,
			className,
			templatePath,
			responseType,
			requestAccess,
			formHandling,
			isAsync,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Flask view metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Flask request metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FlaskRequestMetadata object or undefined if not a Flask request
 */
export function extractFlaskRequestMetadata(node: Node, text: string): FlaskRequestMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Flask request
		if (!isFlaskRequest(nodeText)) {
			return undefined
		}

		// Extract request information
		const requestType = extractFlaskRequestType(node)
		const properties = extractFlaskRequestProperties(node)
		const validation = extractFlaskRequestValidation(node)
		const fileUploads = extractFlaskRequestFileUploads(node)

		const metadata: FlaskRequestMetadata = {
			requestType,
			properties,
			validation,
			fileUploads,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Flask request metadata for node type ${node.type}:`, error)
		return undefined
	}
}

/**
 * Extracts Flask response metadata from a tree-sitter node
 * @param node The tree-sitter node to analyze
 * @param text The full file content
 * @returns FlaskResponseMetadata object or undefined if not a Flask response
 */
export function extractFlaskResponseMetadata(node: Node, text: string): FlaskResponseMetadata | undefined {
	try {
		const nodeText = node.text

		// Check if this is a Flask response
		if (!isFlaskResponse(nodeText)) {
			return undefined
		}

		// Extract response information
		const responseType = extractFlaskResponseType(node)
		const templatePath = extractFlaskResponseTemplatePath(node)
		const data = extractFlaskResponseData(node)
		const statusCode = extractFlaskResponseStatusCode(node)
		const headers = extractFlaskResponseHeaders(node)
		const mimeType = extractFlaskResponseMimeType(node)

		const metadata: FlaskResponseMetadata = {
			responseType,
			templatePath,
			data,
			statusCode,
			headers,
			mimeType,
		}

		return metadata
	} catch (error) {
		console.debug(`Failed to extract Flask response metadata for node type ${node.type}:`, error)
		return undefined
	}
}
