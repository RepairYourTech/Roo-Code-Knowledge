import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import * as vscode from "vscode"
import { Node } from "web-tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { getWasmDirectory } from "../../tree-sitter/get-wasm-directory"
import { MetricsCollector } from "../utils/metrics-collector"
import { parseMarkdown } from "../../tree-sitter/markdownParser"
import { ICodeParser, CodeBlock, ILSPService, LSPTypeInfo, CallInfo, TestMetadata, TestTarget } from "../interfaces"
import { scannerExtensions, shouldUseFallbackChunking } from "../shared/supported-extensions"
import {
	MAX_BLOCK_CHARS,
	MIN_BLOCK_CHARS,
	MIN_FALLBACK_CHUNK_CHARS,
	MIN_CHUNK_REMAINDER_CHARS,
	MAX_CHARS_TOLERANCE_FACTOR,
	SEMANTIC_MAX_CHARS,
	ABSOLUTE_MAX_CHARS,
	ENABLE_DETAILED_AST_LOGGING,
	MAX_AST_LOG_DEPTH,
	MAX_CONTENT_PREVIEW_CHARS,
	ENABLE_EMERGENCY_FALLBACK,
	MIN_EMERGENCY_FALLBACK_CHARS,
} from "../constants"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
import {
	extractSymbolMetadata,
	extractImportInfo,
	extractReactComponentMetadata,
	extractReactHookMetadata,
	extractJSXMetadata,
} from "./metadata-extractor"
import { ImportInfo } from "../types/metadata"
import { logger } from "../../shared/logger"

/**
 * Implementation of the code parser interface
 */
export class CodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()
	private lspService?: ILSPService
	private metricsCollector?: MetricsCollector
	// Markdown files are now supported using the custom markdown parser
	// which extracts headers and sections for semantic indexing

	constructor(lspService?: ILSPService, metricsCollector?: MetricsCollector) {
		this.lspService = lspService
		this.metricsCollector = metricsCollector
	}

	/**
	 * Sets the metrics collector for recording parser metrics
	 * @param collector The metrics collector instance
	 */
	public setMetricsCollector(collector: MetricsCollector): void {
		this.metricsCollector = collector
	}

	/**
	 * Parses a code file into code blocks
	 * @param filePath Path to the file to parse
	 * @param options Optional parsing options
	 * @returns Promise resolving to array of code blocks
	 */
	async parseFile(
		filePath: string,
		options?: {
			content?: string
			fileHash?: string
			enrichWithLSP?: boolean
		},
	): Promise<CodeBlock[]> {
		// Get file extension
		const ext = path.extname(filePath).toLowerCase()

		// Skip if not a supported language
		if (!this.isSupportedLanguage(ext)) {
			return []
		}

		// Get file content
		let content: string
		let fileHash: string

		if (options?.content) {
			content = options.content
			fileHash = options.fileHash || this.createFileHash(content)
		} else {
			try {
				content = await readFile(filePath, "utf8")
				fileHash = this.createFileHash(content)
			} catch (error) {
				logger.error(
					`Error reading file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
					"CodeParser",
				)
				TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
					error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
					stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
					location: "parseFile",
				})
				return []
			}
		}

		// Parse the file
		let blocks = await this.parseContent(filePath, content, fileHash)

		// Enrich with LSP information if requested
		if (options?.enrichWithLSP && this.lspService) {
			blocks = await this.enrichBlocksWithLSP(blocks)
		}

		return blocks
	}

	/**
	 * Checks if a language is supported
	 * @param extension File extension
	 * @returns Boolean indicating if the language is supported
	 */
	private isSupportedLanguage(extension: string): boolean {
		return scannerExtensions.includes(extension)
	}

	/**
	 * Creates a hash for a file
	 * @param content File content
	 * @returns Hash string
	 */
	private createFileHash(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Extract semantic identifier from CSS and markdown nodes
	 * @param node The tree-sitter node
	 * @param fileExt File extension (e.g., 'css', 'md')
	 * @returns Semantic identifier or null
	 */
	private extractSemanticIdentifier(node: Node, fileExt: string): string | null {
		// CSS specific extractions
		if (fileExt === "css") {
			// CSS declarations: extract property name (e.g., "color", "margin")
			if (node.type === "declaration") {
				const propertyNode = node.childForFieldName("property")
				if (propertyNode) {
					return propertyNode.text
				}
			}

			// CSS keyframes: extract animation name
			if (node.type === "keyframes_statement") {
				const nameNode = node.children.find((c) => c?.type === "keyframes_name")
				if (nameNode) {
					return nameNode.text
				}
			}

			// CSS rules: extract selector text (first selector)
			if (node.type === "rule_set") {
				const selectorsNode =
					node.childForFieldName("selectors") || node.children.find((c) => c?.type === "selectors")
				if (selectorsNode && selectorsNode.children.length > 0) {
					// Get first selector text, limit length
					const selectorText = selectorsNode.children[0]?.text || ""
					if (selectorText) {
						return selectorText.length > 50 ? selectorText.slice(0, 50) + "..." : selectorText
					}
				}
			}
		}

		// Markdown specific extractions
		if (fileExt === "md" || fileExt === "markdown") {
			// Markdown content: extract first 30 chars
			if (node.type === "markdown_content" || node.type.startsWith("markdown_")) {
				const text = node.text.trim()
				if (text) {
					// Replace newlines/tabs with spaces, limit length
					const cleanText = text.replace(/[\n\t]+/g, " ").trim()
					return cleanText.length > 30 ? cleanText.slice(0, 30) + "..." : cleanText
				}
			}
		}

		// JavaScript/TypeScript specific extractions
		if (fileExt === "js" || fileExt === "jsx" || fileExt === "ts" || fileExt === "tsx") {
			// Anonymous function expressions
			if (node.type === "function" || node.type === "function_expression") {
				// Try to get parent variable name
				const parent = node.parent
				if (parent?.type === "variable_declarator") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						return nameNode.text
					}
				}
				return "anonymous_function"
			}

			// Arrow functions
			if (node.type === "arrow_function") {
				// Try to get parent variable/property name
				const parent = node.parent
				if (parent?.type === "variable_declarator") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						return nameNode.text
					}
				}
				if (parent?.type === "pair") {
					const keyNode = parent.childForFieldName("key")
					if (keyNode) {
						return keyNode.text
					}
				}
				return "arrow_function"
			}

			// Import statements: extract module name
			if (node.type === "import_statement") {
				const sourceNode = node.childForFieldName("source")
				if (sourceNode) {
					// Remove quotes and extract filename
					const modulePath = sourceNode.text.replace(/['"]/g, "")
					const moduleName = modulePath.split("/").pop() || modulePath
					return `import_${moduleName}`
				}
				return "import"
			}

			// Export statements
			if (node.type === "export_statement") {
				const declarationNode = node.childForFieldName("declaration")
				if (declarationNode) {
					const nameNode = declarationNode.childForFieldName("name")
					if (nameNode) {
						return `export_${nameNode.text}`
					}
				}
				const valueNode = node.childForFieldName("value")
				if (valueNode) {
					return "default_export"
				}
				return "export"
			}
		}

		// Python specific extractions
		if (fileExt === "py") {
			// Lambda functions
			if (node.type === "lambda") {
				// Try to get parent variable name
				const parent = node.parent
				if (parent?.type === "assignment") {
					const leftNode = parent.childForFieldName("left")
					if (leftNode) {
						return leftNode.text
					}
				}
				return "lambda"
			}

			// Import statements
			if (node.type === "import_statement" || node.type === "import_from_statement") {
				const nameNode = node.childForFieldName("name") || node.children.find((c) => c?.type === "dotted_name")
				if (nameNode) {
					return `import_${nameNode.text}`
				}
				return "import"
			}

			// Decorators
			if (node.type === "decorator") {
				const nameNode = node.children.find((c) => c?.type === "identifier")
				if (nameNode) {
					return `@${nameNode.text}`
				}
				return "decorator"
			}
		}

		// Java specific extractions
		if (fileExt === "java") {
			// Lambda expressions
			if (node.type === "lambda_expression") {
				// Try to get parent variable/parameter name
				const parent = node.parent
				if (parent?.type === "variable_declarator") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						return nameNode.text
					}
				}
				return "lambda"
			}

			// Anonymous classes
			if (node.type === "object_creation_expression") {
				const typeNode = node.childForFieldName("type")
				if (typeNode && node.children.some((c) => c?.type === "class_body")) {
					return `anonymous_${typeNode.text}`
				}
			}

			// Import statements
			if (node.type === "import_declaration") {
				const nameNode = node.children.find((c) => c?.type === "scoped_identifier" || c?.type === "identifier")
				if (nameNode) {
					const parts = nameNode.text.split(".")
					return `import_${parts[parts.length - 1]}`
				}
				return "import"
			}
		}

		// C# specific extractions
		if (fileExt === "cs") {
			// Lambda expressions
			if (node.type === "lambda_expression") {
				const parent = node.parent
				if (parent?.type === "variable_declarator") {
					const nameNode = parent.childForFieldName("name")
					if (nameNode) {
						return nameNode.text
					}
				}
				return "lambda"
			}

			// Anonymous objects
			if (node.type === "anonymous_object_creation_expression") {
				return "anonymous_object"
			}
		}

		// Generic fallback for common anonymous patterns across languages
		const anonymousPatterns = ["anonymous_function", "anonymous_class", "closure", "block"]

		if (anonymousPatterns.some((pattern) => node.type.includes(pattern))) {
			return node.type.replace(/_/g, " ")
		}

		return null
	}

	/**
	 * Parses file content into code blocks
	 * @param filePath Path to the file
	 * @param content File content
	 * @param fileHash File hash
	 * @returns Array of code blocks
	 */
	private async parseContent(filePath: string, content: string, fileHash: string): Promise<CodeBlock[]> {
		const ext = path.extname(filePath).slice(1).toLowerCase()
		const seenSegmentHashes = new Set<string>()

		// Handle markdown files specially
		if (ext === "md" || ext === "markdown") {
			return this.parseMarkdownContent(filePath, content, fileHash, seenSegmentHashes)
		}

		// Check if this extension should use fallback chunking
		if (shouldUseFallbackChunking(`.${ext}`)) {
			return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
		}

		// Check if we already have the parser loaded
		logger.debug(`Checking parser availability for extension: ${ext} (file: ${filePath})`, "CodeParser")
		if (!this.loadedParsers[ext]) {
			const pendingLoad = this.pendingLoads.get(ext)
			if (pendingLoad) {
				logger.debug(`Found pending load for ${ext}, waiting for completion...`, "CodeParser")
				try {
					await pendingLoad
					logger.debug(`Pending load completed for ${ext}`, "CodeParser")
				} catch (error) {
					logger.error(
						`Error in pending parser load for ${filePath} (extension: ${ext}): ${error instanceof Error ? error.message : String(error)}`,
						"CodeParser",
					)
					logger.error(
						`Error details: ${error instanceof Error ? error.message : String(error)}`,
						"CodeParser",
					)
					logger.error(
						`Stack trace: ${error instanceof Error ? error.stack || "No stack available" : "No stack available"}`,
						"CodeParser",
					)
					logger.error(`This was a retry attempt for extension ${ext}`, "CodeParser")
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
						stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
						location: "parseContent:loadParser",
					})
					logger.warn(`Parser load failed for ${ext}, falling back to chunking`, "CodeParser")
					return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
				}
			} else {
				logger.debug(`Loading parser for extension: ${ext} (file: ${filePath})`, "CodeParser")

				// Get WASM directory with explicit error handling
				let wasmDir: string
				try {
					logger.debug("Calling getWasmDirectory()...", "CodeParser")
					wasmDir = getWasmDirectory()
					logger.debug(`getWasmDirectory() returned: ${wasmDir}`, "CodeParser")

					// Verify directory exists
					try {
						const fs = require("fs")
						if (!fs.existsSync(wasmDir)) {
							logger.error(`[CodeParser] WASM directory does not exist: ${wasmDir}`, "CodeParser")
						} else {
							const files = fs.readdirSync(wasmDir)
							logger.debug(
								`[CodeParser] WASM directory contents (${files.length} files): ${files.slice(0, 5).join(", ")}${files.length > 5 ? "..." : ""}`,
								"CodeParser",
							)
							if (!files.includes("tree-sitter.wasm")) {
								logger.error(`[CodeParser] tree-sitter.wasm missing from ${wasmDir}`, "CodeParser")
							}
						}
					} catch (fsError) {
						logger.warn(`[CodeParser] Failed to verify WASM directory: ${fsError}`, "CodeParser")
					}
				} catch (error) {
					const errorMsg = `getWasmDirectory() failed: ${error instanceof Error ? error.message : String(error)}`
					logger.error(errorMsg, "CodeParser")
					logger.error(`Stack: ${error instanceof Error ? error.stack : "N/A"}`, "CodeParser")
					// Return empty array - graceful degradation
					logger.warn(`WASM directory unavailable, falling back to chunking for ${filePath}`, "CodeParser")
					return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
				}

				const loadPromise = loadRequiredLanguageParsers([filePath], wasmDir, this.metricsCollector)
				this.pendingLoads.set(ext, loadPromise)
				try {
					const newParsers = await loadPromise
					if (newParsers) {
						const parserKeys = Object.keys(newParsers)
						logger.debug(`Successfully loaded parsers for ${ext}: ${parserKeys.join(", ")}`, "CodeParser")

						// Check if we got an empty parser map (graceful degradation case)
						if (parserKeys.length === 0) {
							logger.warn(
								`Graceful degradation: No parsers available for ${ext} due to missing WASM files. Will attempt fallback chunking if needed.`,
								"CodeParser",
							)
							// Don't add to loadedParsers since it's empty, but continue processing
						} else {
							// Log parser details for non-empty parsers
							const parser = newParsers[ext]
							if (parser) {
								logger.debug(`Parser details for ${ext}:`, "CodeParser")
								logger.debug(`  - Language name: ${parser.language?.name || "Unknown"}`, "CodeParser")
								logger.debug(`  - Parser object exists: ${!!parser.parser}`, "CodeParser")
								logger.debug(`  - Query object exists: ${!!parser.query}`, "CodeParser")
								logger.debug(
									`  - Query captures count: ${parser.query ? "Available" : "N/A"}`,
									"CodeParser",
								)
							}
							this.loadedParsers = { ...this.loadedParsers, ...newParsers }
						}
					} else {
						logger.warn(
							`loadRequiredLanguageParsers returned nothing for ${ext} (file: ${filePath})`,
							"CodeParser",
						)
					}
				} catch (error) {
					logger.error(
						`Error loading language parser for ${filePath} (extension: ${ext}): ${error instanceof Error ? error.message : String(error)}`,
						"CodeParser",
					)
					logger.error(
						`Error details: ${error instanceof Error ? error.message : String(error)}`,
						"CodeParser",
					)
					logger.error(
						`Stack trace: ${error instanceof Error ? error.stack || "No stack available" : "No stack available"}`,
						"CodeParser",
					)
					logger.error(`This was a first attempt for extension ${ext}`, "CodeParser")
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
						stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
						location: "parseContent:loadParser",
					})
					logger.warn(`Parser loading failed for ${ext}, falling back to chunking`, "CodeParser")
					return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
				} finally {
					this.pendingLoads.delete(ext)
				}
			}
		}

		const language = this.loadedParsers[ext]
		if (!language) {
			logger.warn(`No parser available for file extension: ${ext} (file: ${filePath})`, "CodeParser")
			logger.debug(
				`Available parsers in loadedParsers: ${Object.keys(this.loadedParsers).join(", ")}`,
				"CodeParser",
			)
			logger.warn(`No WASM parser for ${ext}, forcing fallback chunking`, "CodeParser")
			this.metricsCollector?.recordParserMetric(ext, "fallback")
			return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
		}

		logger.debug(`Attempting to parse ${filePath} with ${ext} parser`, "CodeParser")
		this.metricsCollector?.recordParserMetric(ext, "parseAttempt")
		let tree
		try {
			tree = language.parser.parse(content)
			if (tree) {
				logger.debug(`Successfully parsed ${filePath} with ${ext} parser`, "CodeParser")
				logger.debug(`Tree details for ${filePath}:`, "CodeParser")
				logger.debug(`  - Root node type: ${tree.rootNode?.type || "Unknown"}`, "CodeParser")
				logger.debug(`  - Number of children: ${tree.rootNode?.children?.length || 0}`, "CodeParser")
				logger.debug(`  - Tree is null: ${tree === null}`, "CodeParser")
			} else {
				logger.warn(`Parser returned null tree for ${filePath}`, "CodeParser")
			}

			// AST structure diagnostics
			if (ENABLE_DETAILED_AST_LOGGING && tree && tree.rootNode) {
				// Log the first 10 child node types of the root
				const rootChildren = tree.rootNode.children.slice(0, 10)
				logger.debug(
					`Root node children types: ${rootChildren
						.filter((c) => c !== null)
						.map((c) => c!.type)
						.join(", ")}`,
					"CodeParser",
				)

				// Log tree's text length vs content length to detect parsing issues
				const treeTextLength = tree.rootNode.text.length
				const contentLength = content.length
				logger.debug(
					`Tree text length: ${treeTextLength}, Content length: ${contentLength}, Match: ${treeTextLength === contentLength}`,
					"CodeParser",
				)

				// Add recursive function to log AST structure up to MAX_AST_LOG_DEPTH levels deep (only in debug mode)
				const logASTStructure = (node: Node, depth: number, maxDepth: number) => {
					if (depth > maxDepth) return

					const indent = "  ".repeat(depth)
					const nodeInfo = `${indent}${node.type} (${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column})`
					logger.debug(nodeInfo, "CodeParser")

					// Log first few children to avoid too much output
					const childrenToLog = node.children.slice(0, 5)
					childrenToLog.forEach((child) => {
						if (child) {
							logASTStructure(child, depth + 1, maxDepth)
						}
					})

					if (node.children.length > 5) {
						logger.debug(`${indent}  ... and ${node.children.length - 5} more children`, "CodeParser")
					}
				}

				// Log AST structure up to MAX_AST_LOG_DEPTH levels deep
				logger.debug(`AST structure for ${filePath} (up to ${MAX_AST_LOG_DEPTH} levels):`, "CodeParser")
				logASTStructure(tree.rootNode, 0, MAX_AST_LOG_DEPTH)
			}
		} catch (e) {
			logger.error(
				`Error parsing ${filePath} with ${ext} parser: ${e instanceof Error ? e.message : String(e)}`,
				"CodeParser",
			)
			logger.error(
				`Full error stack trace: ${e instanceof Error ? e.stack || "No stack available" : "No stack available"}`,
				"CodeParser",
			)
			this.metricsCollector?.recordParserMetric(ext, "parseFailed")
			logger.warn(`Tree parsing failed for ${filePath}, falling back to chunking`, "CodeParser")
			this.metricsCollector?.recordParserMetric(ext, "fallback")
			return this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
		}

		// We don't need to get the query string from languageQueries since it's already loaded
		// in the language object
		logger.debug(`Executing query for ${ext} on ${filePath}`, "CodeParser")

		// Query execution diagnostics
		let captures: any[] = []
		if (tree && language.query) {
			try {
				// Log the query pattern count
				logger.debug(`Query has ${language.query.patternCount} patterns`, "CodeParser")

				// Log the query capture names
				if (language.query.captureNames && language.query.captureNames.length > 0) {
					logger.debug(`Query capture names: ${language.query.captureNames.join(", ")}`, "CodeParser")
				} else {
					logger.debug(`Query has no capture names defined`, "CodeParser")
				}

				// Execute the query with try-catch to detect runtime errors
				captures = language.query.captures(tree.rootNode)
				logger.debug(`Query captures for ${filePath}: ${captures.length}`, "CodeParser")
			} catch (error) {
				logger.error(
					`Query execution error for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
					"CodeParser",
				)
				captures = []
			}
		} else {
			logger.debug(`Skipping query execution - tree: ${!!tree}, query: ${!!language?.query}`, "CodeParser")
			captures = []
		}

		// Log capture results details
		if (captures.length > 0) {
			logger.debug(`First few capture types for ${filePath}:`, "CodeParser")
			const firstFewCaptures = captures.slice(0, 5)
			firstFewCaptures.forEach((capture, index) => {
				logger.debug(
					`  - Capture ${index + 1}: ${capture.name} (node type: ${capture.node?.type || "Unknown"})`,
					"CodeParser",
				)
			})
			this.metricsCollector?.recordParserMetric(ext, "parseSuccess")
			this.metricsCollector?.recordParserMetric(ext, "captures", captures.length)
		} else {
			this.metricsCollector?.recordParserMetric(ext, "parseFailed")
		}

		// Check if captures are empty
		if (captures.length === 0) {
			logger.debug(`No captures for ${filePath}, recording diagnostics`, "CodeParser")
			logger.debug(`File details for ${filePath}:`, "CodeParser")
			logger.debug(`  - File size: ${content.length} characters`, "CodeParser")
			logger.debug(`  - Content length: ${content.length} characters`, "CodeParser")
			logger.debug(`  - MIN_BLOCK_CHARS threshold: ${MIN_BLOCK_CHARS}`, "CodeParser")

			// Enhanced diagnostics for empty captures
			// Log the first MAX_CONTENT_PREVIEW_CHARS characters of file content (sanitized)
			const contentPreview = content
				.slice(0, MAX_CONTENT_PREVIEW_CHARS)
				.replace(/[\r\n\t]/g, " ")
				.trim()
			logger.debug(
				`  - Content preview (first ${MAX_CONTENT_PREVIEW_CHARS} chars): "${contentPreview}"`,
				"CodeParser",
			)

			// Log the tree structure summary (node types present)
			if (tree && tree.rootNode) {
				const nodeTypeCounts = new Map<string, number>()
				const collectNodeTypesWithCounts = (node: Node) => {
					nodeTypeCounts.set(node.type, (nodeTypeCounts.get(node.type) || 0) + 1)
					node.children.forEach((child) => {
						if (child) collectNodeTypesWithCounts(child)
					})
				}
				collectNodeTypesWithCounts(tree.rootNode)

				// Sort by count descending
				const sortedNodeTypes = Array.from(nodeTypeCounts.entries())
					.sort((a, b) => b[1] - a[1])
					.slice(0, 20) // Top 20 most common

				logger.debug(
					`Top node types in AST: ${sortedNodeTypes.map(([type, count]) => `${type}(${count})`).join(", ")}`,
					"CodeParser",
				)
			}

			// Log why fallback chunking is being triggered
			logger.debug(`  - Reason for fallback: No query captures found`, "CodeParser")

			// Add comparison: Expected node types in query vs Found node types in tree
			if (language.query && language.query.captureNames && tree && tree.rootNode) {
				const expectedNodeTypes = language.query.captureNames.filter((name) => !name.startsWith("@")).join(", ")
				const actualNodeTypes = new Set<string>()
				const collectActualTypes = (node: Node) => {
					actualNodeTypes.add(node.type)
					node.children.forEach((child) => {
						if (child) collectActualTypes(child)
					})
				}
				collectActualTypes(tree.rootNode)
				const actualNodeTypesList = Array.from(actualNodeTypes).sort()

				logger.debug(`  - Expected node types in query: [${expectedNodeTypes}]`, "CodeParser")
				logger.debug(`  - Found node types in tree: [${actualNodeTypesList.join(", ")}]`, "CodeParser")
			}

			// Query pattern analysis
			if (language.query) {
				// Extract node type patterns from query string (simplified regex approach)
				const queryString = language.query.toString() || ""
				const nodeTypePattern = /\((\w+)/g
				const queryNodeTypes = new Set<string>()
				let match
				while ((match = nodeTypePattern.exec(queryString)) !== null) {
					queryNodeTypes.add(match[1])
				}

				logger.debug(
					`Query expects these node types: ${Array.from(queryNodeTypes).slice(0, 20).join(", ")}`,
					"CodeParser",
				)
			}

			// Record telemetry for empty captures to help refine fallback behavior
			TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
				error: `No captures found for file: ${filePath} (extension: ${ext}, content length: ${content.length})`,
				location: "parseContent:emptyCaptures",
				filePath,
				extension: ext,
				contentLength: content.length,
				minBlockChars: MIN_BLOCK_CHARS,
				shouldUseFallback: shouldUseFallbackChunking(`.${ext}`),
				contentLargeEnough: content.length >= MIN_BLOCK_CHARS,
			})

			// Note: We don't trigger fallback chunking immediately for empty captures anymore
			// Instead, we let the method continue to handle empty captures in the later phase
			// This ensures consistent control flow and allows the emergency fallback logic to apply
		}

		const results: CodeBlock[] = []

		// Phase 3: Extract file-level imports once
		const fileImports = this.extractFileImports(tree)

		// Phase 10, Task 2: Detect if this is a test file
		const testMetadata = this.detectTestFile(filePath, tree, ext)

		// Process captures if not empty
		// Filter and prioritize captures to ensure specific patterns take precedence over emergency patterns
		const filteredCaptures = this.prioritizeCaptures(captures)
		const queue: Node[] = Array.from(filteredCaptures).map((capture: any) => capture.node)

		// Handle empty captures case - record diagnostics but continue processing
		// This allows later phases to handle fallback behavior as designed
		if (queue.length === 0 && captures.length === 0) {
			logger.debug(`Empty captures queue for ${filePath}`, "CodeParser")
			// Continue processing - the empty queue will skip the while loop
			// and the method will apply fallback chunking or emergency fallback later
		}

		// Track MIN_BLOCK_CHARS filtering statistics
		let minBlockFilteredCount = 0
		let smallestFilteredSize = Infinity

		while (queue.length > 0) {
			const currentNode = queue.shift()!
			// const lineSpan = currentNode.endPosition.row - currentNode.startPosition.row + 1 // Removed as per lint error

			// Check if the node meets the minimum character requirement
			if (currentNode.text.length >= MIN_BLOCK_CHARS) {
				// Phase 3: Smart chunking based on semantic boundaries
				const isSemanticUnit = this.isSemanticUnit(currentNode)

				// If it's a semantic unit (function/class), apply special rules
				if (isSemanticUnit) {
					// Rule 1 & 2: Never split functions/methods, keep classes together when possible
					if (currentNode.text.length <= SEMANTIC_MAX_CHARS) {
						// Keep entire semantic unit (even if >MAX_BLOCK_CHARS)
						// This is the key change: we allow larger chunks for semantic completeness
						// Will be handled in the "create a block" section below
					} else if (currentNode.text.length <= ABSOLUTE_MAX_CHARS) {
						// Between SEMANTIC_MAX and ABSOLUTE_MAX: still keep together
						// Will be handled in the "create a block" section below
					} else {
						// >ABSOLUTE_MAX_CHARS: Need to split, but intelligently
						// Implement splitAtLogicalBoundaries() for very large functions
						try {
							const logicalChunks = this.splitAtLogicalBoundaries(
								currentNode,
								filePath,
								fileHash,
								seenSegmentHashes,
								content,
								fileImports,
								testMetadata,
							)
							if (logicalChunks.length > 0) {
								results.push(...logicalChunks)
								continue // Skip the "create a block" section
							}
						} catch (error) {
							logger.debug(
								`Failed to split at logical boundaries for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
								"CodeParser",
							)
							// Fall back to processing children if logical splitting fails
						}

						// Fallback: process children or use line-based chunking
						if (currentNode.children.filter((child) => child !== null).length > 0) {
							queue.push(...currentNode.children.filter((child) => child !== null))
						} else {
							const chunkedBlocks = this._chunkLeafNodeByLines(
								currentNode,
								filePath,
								fileHash,
								seenSegmentHashes,
							)
							results.push(...chunkedBlocks)
						}
						continue // Skip the "create a block" section
					}
				} else {
					// Not a semantic unit: apply standard size limits
					if (currentNode.text.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR) {
						if (currentNode.children.filter((child) => child !== null).length > 0) {
							// If it has children, process them instead
							queue.push(...currentNode.children.filter((child) => child !== null))
						} else {
							// If it's a leaf node, chunk it
							const chunkedBlocks = this._chunkLeafNodeByLines(
								currentNode,
								filePath,
								fileHash,
								seenSegmentHashes,
							)
							results.push(...chunkedBlocks)
						}
						continue // Skip the "create a block" section
					}
				}

				// Create a block (for nodes that passed the size checks above)
				{
					// Phase 3: Include comments with code (Rule 3)
					const { content: contentWithComments, startLine: adjustedStartLine } = this.includeComments(
						currentNode,
						content,
					)

					const identifier =
						currentNode.childForFieldName("name")?.text ||
						currentNode.children.find((c) => c?.type === "identifier")?.text ||
						this.extractSemanticIdentifier(currentNode, ext) ||
						null
					const type = currentNode.type
					const start_line = adjustedStartLine // Use adjusted start line (includes comments)
					const end_line = currentNode.endPosition.row + 1
					const contentToUse = contentWithComments // Use content with comments
					const contentPreview = contentToUse.slice(0, MAX_CONTENT_PREVIEW_CHARS)
					const segmentHash = createHash("sha256")
						.update(`${filePath}-${start_line}-${end_line}-${contentToUse.length}-${contentPreview}`)
						.digest("hex")

					if (!seenSegmentHashes.has(segmentHash)) {
						seenSegmentHashes.add(segmentHash)

						// Phase 2: Extract enhanced metadata for TypeScript/JavaScript
						let symbolMetadata = undefined
						let documentation = undefined
						let reactComponentMetadata = undefined
						let reactHookMetadata = undefined
						let jsxMetadata = undefined

						if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
							try {
								// CRITICAL FIX: Pass full file content, not just currentNode.text
								// extractDocumentation() uses node.startPosition.row to index into fileContent.split("\n")
								// If we pass currentNode.text, line indexing is incorrect (e.g., node at line 50
								// would try to access lines[50] in an array that only has as many lines as the node)
								symbolMetadata = extractSymbolMetadata(currentNode, content) || undefined
								documentation = symbolMetadata?.documentation

								// Extract React-specific metadata for TSX/TS files
								if (ext === "tsx" || ext === "ts") {
									reactComponentMetadata =
										extractReactComponentMetadata(currentNode, content) || undefined
									reactHookMetadata = extractReactHookMetadata(currentNode) || undefined
									jsxMetadata = extractJSXMetadata(currentNode) || undefined
								}
							} catch (error) {
								// Silently fail metadata extraction - don't break indexing
								logger.debug(
									`Failed to extract metadata for ${filePath}:${start_line}: ${error instanceof Error ? error.message : String(error)}`,
									"CodeParser",
								)
							}
						}

						// Phase 10: Extract function calls
						let calls: CallInfo[] | undefined = undefined
						try {
							const extractedCalls = this.extractCalls(currentNode, filePath)
							calls = extractedCalls.length > 0 ? extractedCalls : undefined
						} catch (error) {
							// Log call extraction failures instead of silently failing
							// This helps identify parsing issues while continuing processing
							logger.warn(
								`Failed to extract calls for ${filePath}:${start_line}: ${error instanceof Error ? error.message : String(error)}`,
								"CodeParser",
							)
							// Continue processing without calls - don't break indexing
						}

						results.push({
							file_path: filePath,
							identifier,
							type,
							start_line,
							end_line,
							content: contentToUse, // Content with comments
							segmentHash,
							fileHash,
							symbolMetadata,
							documentation,
							imports: fileImports.length > 0 ? fileImports : undefined, // Phase 3: Include imports (Rule 4)
							calls, // Phase 10: Include function calls
							testMetadata, // Phase 10, Task 2: Include test metadata
							// React-specific metadata
							reactComponentMetadata,
							reactHookMetadata,
							jsxMetadata,
						})
					}
				}
			} else {
				// Track MIN_BLOCK_CHARS filtering diagnostics
				minBlockFilteredCount++
				if (currentNode.text.length < smallestFilteredSize) {
					smallestFilteredSize = currentNode.text.length
				}
				logger.debug(
					`Filtered node below MIN_BLOCK_CHARS: type=${currentNode.type}, size=${currentNode.text.length} chars, threshold=${MIN_BLOCK_CHARS}`,
					"CodeParser",
				)
			}
			// Nodes smaller than minBlockChars are ignored
		}

		// Track MIN_BLOCK_CHARS filtering statistics
		if (minBlockFilteredCount > 0) {
			logger.debug(
				`MIN_BLOCK_CHARS filtering summary for ${filePath}: filtered ${minBlockFilteredCount} nodes, smallest=${smallestFilteredSize} chars, threshold=${MIN_BLOCK_CHARS}`,
				"CodeParser",
			)
		}

		// Fallback chunking: If no blocks were created from captures and content is sufficient, use fallback chunking
		if (results.length === 0 && content.length >= MIN_BLOCK_CHARS) {
			logger.debug(
				`Applying fallback chunking for ${filePath} due to empty captures (content length: ${content.length}, threshold: ${MIN_BLOCK_CHARS})`,
				"CodeParser",
			)
			this.metricsCollector?.recordParserMetric(ext, "fallback")
			const fallbackResults = this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
			results.push(...fallbackResults)
		}

		// Emergency fallback: If no blocks were created and file has content, create one block for entire file
		if (results.length === 0 && content.trim().length > 0) {
			// Check if emergency fallback is enabled and content meets minimum threshold
			if (!ENABLE_EMERGENCY_FALLBACK || content.length < MIN_EMERGENCY_FALLBACK_CHARS) {
				logger.debug(
					`Emergency fallback skipped for ${filePath}: ENABLE_EMERGENCY_FALLBACK=${ENABLE_EMERGENCY_FALLBACK}, content.length=${content.length}, MIN_EMERGENCY_FALLBACK_CHARS=${MIN_EMERGENCY_FALLBACK_CHARS}`,
					"CodeParser",
				)
				return results
			}

			logger.warn(
				`Emergency fallback at parseContent level: No blocks created for ${filePath} (${content.length} chars). Creating single block.`,
				"CodeParser",
			)

			const segmentHash = createHash("sha256")
				.update(`${filePath}-emergency-parseContent-${content.length}`)
				.digest("hex")

			if (!seenSegmentHashes.has(segmentHash)) {
				seenSegmentHashes.add(segmentHash)
				results.push({
					file_path: filePath,
					identifier: null,
					type: "emergency_fallback_full_file",
					start_line: 1,
					end_line: content.split("\n").length,
					content: content,
					segmentHash,
					fileHash,
				})
				logger.info(`Emergency fallback created 1 block for ${filePath} at parseContent level`, "CodeParser")
			}
		}

		return results
	}

	/**
	 * Common helper function to chunk text by lines, avoiding tiny remainders.
	 */
	private _chunkTextByLines(
		lines: string[],
		filePath: string,
		fileHash: string,
		chunkType: string,
		seenSegmentHashes: Set<string>,
		baseStartLine: number = 1, // 1-based start line of the *first* line in the `lines` array
		minBlockChars: number = MIN_BLOCK_CHARS, // Allow overriding the minimum threshold
	): CodeBlock[] {
		const chunks: CodeBlock[] = []
		let currentChunkLines: string[] = []
		let currentChunkLength = 0
		let chunkStartLineIndex = 0 // 0-based index within the `lines` array
		const effectiveMaxChars = MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR

		// Track MIN_BLOCK_CHARS filtering for validation
		let filteredChunksCount = 0
		let smallestFilteredChunkSize = Infinity

		const finalizeChunk = (endLineIndex: number) => {
			if (currentChunkLength >= minBlockChars && currentChunkLines.length > 0) {
				const chunkContent = currentChunkLines.join("\n")
				const startLine = baseStartLine + chunkStartLineIndex
				const endLine = baseStartLine + endLineIndex
				const contentPreview = chunkContent.slice(0, 100)
				const segmentHash = createHash("sha256")
					.update(`${filePath}-${startLine}-${endLine}-${chunkContent.length}-${contentPreview}`)
					.digest("hex")

				if (!seenSegmentHashes.has(segmentHash)) {
					seenSegmentHashes.add(segmentHash)
					chunks.push({
						file_path: filePath,
						identifier: null,
						type: chunkType,
						start_line: startLine,
						end_line: endLine,
						content: chunkContent,
						segmentHash,
						fileHash,
					})
					logger.debug(
						`Created chunk: lines ${startLine}-${endLine}, length: ${chunkContent.length} chars`,
						"CodeParser",
					)
				}
			} else {
				// Track filtered chunks for validation
				if (currentChunkLines.length > 0) {
					filteredChunksCount++
					if (currentChunkLength < smallestFilteredChunkSize) {
						smallestFilteredChunkSize = currentChunkLength
					}
				}
				logger.debug(
					`Skipping chunk: length ${currentChunkLength} chars below threshold ${minBlockChars}`,
					"CodeParser",
				)
			}
			currentChunkLines = []
			currentChunkLength = 0
			chunkStartLineIndex = endLineIndex + 1
		}

		const createSegmentBlock = (segment: string, originalLineNumber: number, startCharIndex: number) => {
			const segmentPreview = segment.slice(0, 100)
			const segmentHash = createHash("sha256")
				.update(
					`${filePath}-${originalLineNumber}-${originalLineNumber}-${startCharIndex}-${segment.length}-${segmentPreview}`,
				)
				.digest("hex")

			if (!seenSegmentHashes.has(segmentHash)) {
				seenSegmentHashes.add(segmentHash)
				chunks.push({
					file_path: filePath,
					identifier: null,
					type: `${chunkType}_segment`,
					start_line: originalLineNumber,
					end_line: originalLineNumber,
					content: segment,
					segmentHash,
					fileHash,
				})
			}
		}

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const lineLength = line.length + (i < lines.length - 1 ? 1 : 0) // +1 for newline, except last line
			const originalLineNumber = baseStartLine + i

			// Handle oversized lines (longer than effectiveMaxChars)
			if (lineLength > effectiveMaxChars) {
				// Finalize any existing normal chunk before processing the oversized line
				if (currentChunkLines.length > 0) {
					finalizeChunk(i - 1)
				}

				// Split the oversized line into segments
				let remainingLineContent = line
				let currentSegmentStartChar = 0
				while (remainingLineContent.length > 0) {
					const segment = remainingLineContent.substring(0, MAX_BLOCK_CHARS)
					remainingLineContent = remainingLineContent.substring(MAX_BLOCK_CHARS)
					createSegmentBlock(segment, originalLineNumber, currentSegmentStartChar)
					currentSegmentStartChar += MAX_BLOCK_CHARS
				}
				// Update chunkStartLineIndex to continue processing from the next line
				chunkStartLineIndex = i + 1
				continue
			}

			// Handle normally sized lines
			if (currentChunkLength > 0 && currentChunkLength + lineLength > effectiveMaxChars) {
				// Re-balancing Logic
				let splitIndex = i - 1
				let remainderLength = 0
				for (let j = i; j < lines.length; j++) {
					remainderLength += lines[j].length + (j < lines.length - 1 ? 1 : 0)
				}

				if (
					currentChunkLength >= minBlockChars &&
					remainderLength < MIN_CHUNK_REMAINDER_CHARS &&
					currentChunkLines.length > 1
				) {
					for (let k = i - 2; k >= chunkStartLineIndex; k--) {
						const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
						const potentialChunkLength = potentialChunkLines.join("\n").length + 1
						const potentialNextChunkLines = lines.slice(k + 1)
						const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1

						if (
							potentialChunkLength >= minBlockChars &&
							potentialNextChunkLength >= MIN_CHUNK_REMAINDER_CHARS
						) {
							splitIndex = k
							break
						}
					}
				}

				finalizeChunk(splitIndex)

				if (i >= chunkStartLineIndex) {
					currentChunkLines.push(line)
					currentChunkLength += lineLength
				} else {
					i = chunkStartLineIndex - 1
					continue
				}
			} else {
				currentChunkLines.push(line)
				currentChunkLength += lineLength
			}
		}

		// Process the last remaining chunk
		if (currentChunkLines.length > 0) {
			// Only finalize if it meets minimum character requirements
			if (currentChunkLength >= minBlockChars) {
				logger.debug(
					`Finalizing last chunk: length ${currentChunkLength} chars meets threshold ${minBlockChars}`,
					"CodeParser",
				)
				finalizeChunk(lines.length - 1)
			} else {
				logger.debug(
					`Skipping final chunk: length ${currentChunkLength} chars below threshold ${minBlockChars}`,
					"CodeParser",
				)
			}
		}

		logger.debug(`Chunking summary: created ${chunks.length} chunks from ${lines.length} lines`, "CodeParser")

		// Log MIN_BLOCK_CHARS filtering validation
		if (filteredChunksCount > 0) {
			const thresholdName =
				minBlockChars === MIN_FALLBACK_CHUNK_CHARS ? "MIN_FALLBACK_CHUNK_CHARS" : "MIN_BLOCK_CHARS"
			logger.warn(
				`${thresholdName} filtering: ${filteredChunksCount} chunks filtered out (smallest: ${smallestFilteredChunkSize} chars, threshold: ${minBlockChars})`,
				"CodeParser",
			)
			if (filteredChunksCount > 5) {
				logger.warn(
					`High number of filtered chunks (${filteredChunksCount}) - consider lowering ${thresholdName} threshold from ${minBlockChars}`,
					"CodeParser",
				)
			}
		}

		return chunks
	}

	private _performFallbackChunking(
		filePath: string,
		content: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const ext = path.extname(filePath).slice(1).toLowerCase()

		// Diagnostics for why fallback was triggered
		logger.debug(`Starting fallback chunking for ${filePath}`, "CodeParser")

		// Log if it's due to empty captures
		const isDueToEmptyCaptures = true // This method is called when captures are empty
		if (isDueToEmptyCaptures) {
			logger.debug(`Fallback reason: Empty query captures`, "CodeParser")
		}

		// Log if it's due to unsupported extension
		const isUnsupportedExtension = shouldUseFallbackChunking(`.${ext}`)
		if (isUnsupportedExtension) {
			logger.debug(`Fallback reason: Unsupported extension ${ext}`, "CodeParser")
		}

		// Log content details and expected chunk count
		const lineCount = content.split("\n").length
		const expectedChunkCount = Math.ceil(content.length / MIN_FALLBACK_CHUNK_CHARS)
		logger.debug(
			`File details: content length=${content.length}, lines=${lineCount}, MIN_FALLBACK_CHUNK_CHARS=${MIN_FALLBACK_CHUNK_CHARS}`,
			"CodeParser",
		)
		logger.debug(
			`Expected chunk count: ~${expectedChunkCount} chunks (content length / MIN_FALLBACK_CHUNK_CHARS)`,
			"CodeParser",
		)

		const lines = content.split("\n")
		const chunks = this._chunkTextByLines(
			lines,
			filePath,
			fileHash,
			"fallback_chunk",
			seenSegmentHashes,
			1,
			MIN_FALLBACK_CHUNK_CHARS, // Use the constant instead of hardcoded value
		)

		logger.debug(`Fallback chunking completed: created ${chunks.length} blocks for ${filePath}`, "CodeParser")
		if (chunks.length === 0) {
			logger.warn(
				`No blocks created by fallback chunking for ${filePath} (content length: ${content.length})`,
				"CodeParser",
			)
		} else {
			logger.debug(
				`First block sample: ${chunks[0].content.slice(0, MAX_CONTENT_PREVIEW_CHARS)}...`,
				"CodeParser",
			)
		}

		// Emergency fallback: If fallback chunking returns 0 blocks, create a single block for the entire file
		if (chunks.length === 0 && content.trim().length > 0) {
			// Check if emergency fallback is enabled and content meets minimum threshold
			if (!ENABLE_EMERGENCY_FALLBACK || content.length < MIN_EMERGENCY_FALLBACK_CHARS) {
				logger.debug(
					`Emergency fallback skipped for ${filePath}: ENABLE_EMERGENCY_FALLBACK=${ENABLE_EMERGENCY_FALLBACK}, content.length=${content.length}, MIN_EMERGENCY_FALLBACK_CHARS=${MIN_EMERGENCY_FALLBACK_CHARS}`,
					"CodeParser",
				)
				return chunks
			}

			logger.warn(`Emergency fallback: Creating single block for entire file ${filePath}`, "CodeParser")
			const segmentHash = createHash("sha256").update(`${filePath}-emergency-${content.length}`).digest("hex")

			if (!seenSegmentHashes.has(segmentHash)) {
				seenSegmentHashes.add(segmentHash)
				chunks.push({
					file_path: filePath,
					identifier: null,
					type: "emergency_fallback",
					start_line: 1,
					end_line: lines.length,
					content: content,
					segmentHash,
					fileHash,
				})
				logger.info(`Emergency fallback created 1 block for ${filePath}`, "CodeParser")
			}
		}

		return chunks
	}

	private _chunkLeafNodeByLines(
		node: Node,
		filePath: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const lines = node.text.split("\n")
		const baseStartLine = node.startPosition.row + 1
		return this._chunkTextByLines(
			lines,
			filePath,
			fileHash,
			node.type, // Use the node's type
			seenSegmentHashes,
			baseStartLine,
		)
	}

	/**
	 * Helper method to process markdown content sections with consistent chunking logic
	 */
	private processMarkdownSection(
		lines: string[],
		filePath: string,
		fileHash: string,
		type: string,
		seenSegmentHashes: Set<string>,
		startLine: number,
		identifier: string | null = null,
	): CodeBlock[] {
		const content = lines.join("\n")

		if (content.trim().length < MIN_BLOCK_CHARS) {
			return []
		}

		// Check if content needs chunking (either total size or individual line size)
		const needsChunking =
			content.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR ||
			lines.some((line) => line.length > MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR)

		if (needsChunking) {
			// Apply chunking for large content or oversized lines
			const chunks = this._chunkTextByLines(lines, filePath, fileHash, type, seenSegmentHashes, startLine)
			// Preserve identifier in all chunks if provided
			if (identifier) {
				chunks.forEach((chunk) => {
					chunk.identifier = identifier
				})
			}
			return chunks
		}

		// Create a single block for normal-sized content with no oversized lines
		const endLine = startLine + lines.length - 1
		const contentPreview = content.slice(0, 100)
		const segmentHash = createHash("sha256")
			.update(`${filePath}-${startLine}-${endLine}-${content.length}-${contentPreview}`)
			.digest("hex")

		if (!seenSegmentHashes.has(segmentHash)) {
			seenSegmentHashes.add(segmentHash)
			return [
				{
					file_path: filePath,
					identifier,
					type,
					start_line: startLine,
					end_line: endLine,
					content,
					segmentHash,
					fileHash,
				},
			]
		}

		return []
	}

	private parseMarkdownContent(
		filePath: string,
		content: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const lines = content.split("\n")
		const markdownCaptures = parseMarkdown(content) || []

		if (markdownCaptures.length === 0) {
			// No headers found, process entire content
			return this.processMarkdownSection(lines, filePath, fileHash, "markdown_content", seenSegmentHashes, 1)
		}

		const results: CodeBlock[] = []
		let lastProcessedLine = 0

		// Process content before the first header
		if (markdownCaptures.length > 0) {
			const firstHeaderLine = markdownCaptures[0].node.startPosition.row
			if (firstHeaderLine > 0) {
				const preHeaderLines = lines.slice(0, firstHeaderLine)
				const preHeaderBlocks = this.processMarkdownSection(
					preHeaderLines,
					filePath,
					fileHash,
					"markdown_content",
					seenSegmentHashes,
					1,
				)
				results.push(...preHeaderBlocks)
			}
		}

		// Process markdown captures (headers and sections)
		for (let i = 0; i < markdownCaptures.length; i += 2) {
			const nameCapture = markdownCaptures[i]
			// Ensure we don't go out of bounds when accessing the next capture
			if (i + 1 >= markdownCaptures.length) break
			const definitionCapture = markdownCaptures[i + 1]

			if (!definitionCapture) continue

			const startLine = definitionCapture.node.startPosition.row + 1
			const endLine = definitionCapture.node.endPosition.row + 1
			const sectionLines = lines.slice(startLine - 1, endLine)

			// Extract header level for type classification
			const headerMatch = nameCapture.name.match(/\.h(\d)$/)
			const headerLevel = headerMatch ? parseInt(headerMatch[1]) : 1
			const headerText = nameCapture.node.text

			const sectionBlocks = this.processMarkdownSection(
				sectionLines,
				filePath,
				fileHash,
				`markdown_header_h${headerLevel}`,
				seenSegmentHashes,
				startLine,
				headerText,
			)
			results.push(...sectionBlocks)

			lastProcessedLine = endLine
		}

		// Process any remaining content after the last header section
		if (lastProcessedLine < lines.length) {
			const remainingLines = lines.slice(lastProcessedLine)
			const remainingBlocks = this.processMarkdownSection(
				remainingLines,
				filePath,
				fileHash,
				"markdown_content",
				seenSegmentHashes,
				lastProcessedLine + 1,
			)
			results.push(...remainingBlocks)
		}

		return results
	}

	/**
	 * Phase 3: Semantic boundary detection helpers
	 */

	/**
	 * Checks if a node is a semantic unit that should not be split mid-way
	 */
	private isSemanticUnit(node: Node): boolean {
		return this.isFunctionNode(node) || this.isClassNode(node)
	}

	/**
	 * Checks if a node is a function or method
	 */
	private isFunctionNode(node: Node): boolean {
		const functionTypes = [
			"function_declaration",
			"method_definition",
			"arrow_function",
			"function_expression",
			"function", // Generic function type
		]
		return functionTypes.includes(node.type)
	}

	/**
	 * Checks if a node is a class, interface, or type declaration
	 */
	private isClassNode(node: Node): boolean {
		const classTypes = [
			"class_declaration",
			"interface_declaration",
			"type_alias_declaration",
			"class", // Generic class type
		]
		return classTypes.includes(node.type)
	}

	/**
	 * Prioritizes captures to ensure specific patterns take precedence over emergency patterns
	 * Emergency patterns (prefixed with "emergency.") are only used when no specific patterns match
	 * @param captures Array of query captures
	 * @returns Filtered and prioritized captures
	 */
	private prioritizeCaptures(captures: any[]): any[] {
		// Separate emergency and specific captures
		const emergencyCaptures: any[] = []
		const specificCaptures: any[] = []

		captures.forEach((capture) => {
			if (capture.name && capture.name.startsWith("definition.emergency.")) {
				emergencyCaptures.push(capture)
			} else {
				specificCaptures.push(capture)
			}
		})

		// If we have specific captures, only use those
		if (specificCaptures.length > 0) {
			return specificCaptures
		}

		// If no specific captures, use emergency captures as last resort
		return emergencyCaptures
	}

	/**
	 * Includes preceding comments with a node's content
	 * Looks backwards from the node to find JSDoc, single-line, and multi-line comments
	 */
	private includeComments(node: Node, fileContent: string): { content: string; startLine: number } {
		const nodeStartLine = node.startPosition.row
		const nodeEndLine = node.endPosition.row
		const lines = fileContent.split("\n")

		// Look backwards for comments
		let commentStartLine = nodeStartLine
		for (let i = nodeStartLine - 1; i >= 0; i--) {
			const line = lines[i].trim()

			// Empty line - continue looking
			if (line === "") {
				continue
			}

			// Comment line - include it
			if (
				line.startsWith("//") ||
				line.startsWith("/*") ||
				line.startsWith("*") ||
				line.endsWith("*/") ||
				line.startsWith("/**")
			) {
				commentStartLine = i
			} else {
				// Non-comment, non-empty line - stop looking
				break
			}
		}

		// Extract content from comment start to node end
		const contentLines = lines.slice(commentStartLine, nodeEndLine + 1)
		const content = contentLines.join("\n")

		return {
			content,
			startLine: commentStartLine + 1, // Convert to 1-based
		}
	}

	/**
	 * Extracts all import statements from a file
	 * Returns import metadata to be included in all chunks from this file
	 */
	private extractFileImports(tree: any): ImportInfo[] {
		const imports: ImportInfo[] = []

		// Query for import statements
		const importQuery = `(import_statement) @import`

		try {
			const matches = tree.rootNode.descendantsOfType("import_statement")

			for (const importNode of matches) {
				const importInfo = extractImportInfo(importNode)
				if (importInfo) {
					imports.push(importInfo)
				}
			}
		} catch (error) {
			// Silently fail - import extraction is optional
			logger.debug(
				`Failed to extract imports: ${error instanceof Error ? error.message : String(error)}`,
				"CodeParser",
			)
		}

		return imports
	}

	/**
	 * Enriches a code block with LSP type information
	 * Phase 6: Query LSP for accurate type information
	 */
	private async enrichWithLSPInfo(block: CodeBlock): Promise<LSPTypeInfo | undefined> {
		if (!this.lspService) {
			return undefined
		}

		try {
			// Query LSP for the code block
			const result = await this.lspService.queryCodeBlock(block.file_path, block.start_line, block.end_line)

			if (!result.available || !result.symbolInfo) {
				return {
					lspAvailable: false,
				}
			}

			return {
				typeInfo: result.symbolInfo.typeInfo,
				signatureInfo: result.symbolInfo.signatureInfo,
				lspAvailable: true,
			}
		} catch (error) {
			logger.debug(
				`Failed to enrich with LSP info: ${error instanceof Error ? error.message : String(error)}`,
				"CodeParser",
			)
			return {
				lspAvailable: false,
			}
		}
	}

	/**
	 * Enriches code blocks with LSP type information
	 * Phase 6: Batch enrichment for better performance
	 */
	private async enrichBlocksWithLSP(blocks: CodeBlock[]): Promise<CodeBlock[]> {
		if (!this.lspService || blocks.length === 0) {
			return blocks
		}

		// Enrich each block with LSP information
		const enrichedBlocks = await Promise.all(
			blocks.map(async (block) => {
				const lspTypeInfo = await this.enrichWithLSPInfo(block)
				return {
					...block,
					lspTypeInfo,
				}
			}),
		)

		return enrichedBlocks
	}

	/**
	 * Extract function calls from a code block's AST node
	 * Phase 10: CALLS relationship extraction
	 */
	private extractCalls(node: Node, filePath: string): CallInfo[] {
		const calls: CallInfo[] = []

		// Get file extension to determine language
		const ext = path.extname(filePath).slice(1).toLowerCase()

		// Find all call expression nodes in the AST
		const callNodes = this.findCallExpressions(node, ext)

		for (const callNode of callNodes) {
			const callInfo = this.parseCallExpression(callNode, ext)
			if (callInfo) {
				calls.push(callInfo)
			}
		}

		return calls
	}

	/**
	 * Find all call expression nodes in the AST
	 */
	private findCallExpressions(node: Node, language: string): Node[] {
		const calls: Node[] = []

		// Language-specific node type names for call expressions
		const callNodeTypes: Record<string, string[]> = {
			ts: ["call_expression", "new_expression"],
			tsx: ["call_expression", "new_expression"],
			js: ["call_expression", "new_expression"],
			jsx: ["call_expression", "new_expression"],
			py: ["call"],
			rs: ["call_expression"],
			go: ["call_expression"],
			java: ["method_invocation", "object_creation_expression"],
			c: ["call_expression"],
			cpp: ["call_expression"],
			cs: ["invocation_expression", "object_creation_expression"],
		}

		const targetTypes = callNodeTypes[language] || ["call_expression"]

		// Recursively traverse the AST
		const traverse = (n: Node) => {
			if (targetTypes.includes(n.type)) {
				calls.push(n)
			}
			for (const child of n.children || []) {
				if (child) {
					traverse(child)
				}
			}
		}

		traverse(node)
		return calls
	}

	/**
	 * Parse a call expression node into CallInfo
	 */
	private parseCallExpression(callNode: Node, language: string): CallInfo | null {
		// Language-specific parsing logic
		if (["ts", "tsx", "js", "jsx"].includes(language)) {
			return this.parseJSCallExpression(callNode)
		}

		if (language === "py") {
			return this.parsePythonCallExpression(callNode)
		}

		// Parse call expressions for other supported languages
		if (language === "rs") {
			return this.parseRustCallExpression(callNode)
		}

		if (language === "go") {
			return this.parseGoCallExpression(callNode)
		}

		if (language === "java") {
			return this.parseJavaCallExpression(callNode)
		}

		if (["cpp", "c", "cc", "cxx", "hpp", "h"].includes(language)) {
			return this.parseCppCallExpression(callNode)
		}

		// For unsupported languages, return null
		return null
	}

	/**
	 * Parse a JavaScript/TypeScript call expression
	 * Enhanced to handle method calls, property access, and chained calls
	 */
	private parseJSCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		// Handle new expressions (constructor calls)
		if (callNode.type === "new_expression") {
			const constructorNode = callNode.childForFieldName("constructor")
			if (constructorNode) {
				const calleeName = constructorNode.text
				return {
					calleeName,
					callType: "constructor",
					line,
					column,
				}
			}
			return null
		}

		// Handle regular call expressions
		const functionNode = callNode.childForFieldName("function")
		if (!functionNode) {
			return null
		}

		// Simple function call: foo()
		if (functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		// Enhanced method call handling: obj.method(), obj.prop.method(), function().method()
		if (functionNode.type === "member_expression") {
			const objectNode = functionNode.childForFieldName("object")
			const propertyNode = functionNode.childForFieldName("property")

			if (objectNode && propertyNode) {
				const objectName = objectNode.text
				const methodName = propertyNode.text

				// Handle chained property access: obj.prop.method()
				if (objectNode.type === "member_expression") {
					const nestedObject = objectNode.childForFieldName("object")
					const nestedProperty = objectNode.childForFieldName("property")

					if (nestedObject && nestedProperty) {
						// This is a chained call like obj.prop.method()
						const baseObject = nestedObject.text
						const intermediateProp = nestedProperty.text

						return {
							calleeName: methodName,
							callType: "chained_method",
							line,
							column,
							receiver: `${baseObject}.${intermediateProp}`,
							qualifier: undefined,
						}
					}
				}

				// Handle function result method calls: function().method()
				if (objectNode.type === "call_expression") {
					return {
						calleeName: methodName,
						callType: "method",
						line,
						column,
						receiver: "(function_result)",
						qualifier: undefined,
					}
				}

				// Heuristic: If object starts with uppercase, it's likely a static method
				// This is not perfect but works for common cases like Math.max(), Array.from()
				const isStatic = /^[A-Z]/.test(objectName)

				return {
					calleeName: methodName,
					callType: isStatic ? "static_method" : "method",
					line,
					column,
					receiver: isStatic ? undefined : objectName,
					qualifier: isStatic ? objectName : undefined,
				}
			}
		}

		// Handle optional chaining calls: obj?.method()
		if (functionNode.type === "chain_expression") {
			const memberNode = functionNode.childForFieldName("expression")
			if (memberNode && memberNode.type === "member_expression") {
				const objectNode = memberNode.childForFieldName("object")
				const propertyNode = memberNode.childForFieldName("property")

				if (objectNode && propertyNode) {
					const objectName = objectNode.text
					const methodName = propertyNode.text

					return {
						calleeName: methodName,
						callType: "optional_method",
						line,
						column,
						receiver: objectName,
						qualifier: undefined,
					}
				}
			}
		}

		return null
	}

	/**
	 * Parse a Python call expression
	 */
	private parsePythonCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		const functionNode = callNode.childForFieldName("function")
		if (!functionNode) {
			return null
		}

		// Simple function call: foo()
		if (functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		// Method call: obj.method() or Class.static_method()
		if (functionNode.type === "attribute") {
			const objectNode = functionNode.childForFieldName("object")
			const attributeNode = functionNode.childForFieldName("attribute")

			if (objectNode && attributeNode) {
				const objectName = objectNode.text
				const methodName = attributeNode.text

				// Heuristic: If object starts with uppercase, it's likely a static method
				const isStatic = /^[A-Z]/.test(objectName)

				return {
					calleeName: methodName,
					callType: isStatic ? "static_method" : "method",
					line,
					column,
					receiver: isStatic ? undefined : objectName,
					qualifier: isStatic ? objectName : undefined,
				}
			}
		}

		return null
	}

	/**
	 * Parse a Rust call expression
	 */
	private parseRustCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		const functionNode = callNode.childForFieldName("function")
		if (!functionNode) {
			return null
		}

		// Simple function call: foo()
		if (functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		// Method call: obj.method() or Type::static_method()
		if (functionNode.type === "field_expression") {
			const objectNode = functionNode.childForFieldName("value")
			const fieldNode = functionNode.childForFieldName("field")

			if (objectNode && fieldNode) {
				const objectName = objectNode.text
				const methodName = fieldNode.text

				// Check if it's a static method (Type::method) or instance method (obj.method)
				const isStatic = objectNode.type === "type_identifier" || objectNode.type === "generic_type"

				return {
					calleeName: methodName,
					callType: isStatic ? "static_method" : "method",
					line,
					column,
					receiver: isStatic ? undefined : objectName,
					qualifier: isStatic ? objectName : undefined,
				}
			}
		}

		// Macro call: macro!()
		if (functionNode.type === "macro_invocation") {
			const macroNode = functionNode.childForFieldName("macro")
			if (macroNode && macroNode.type === "identifier") {
				return {
					calleeName: macroNode.text,
					callType: "function",
					line,
					column,
				}
			}
		}

		return null
	}

	/**
	 * Parse a Go call expression
	 */
	private parseGoCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		const functionNode = callNode.childForFieldName("function")
		if (!functionNode) {
			return null
		}

		// Simple function call: foo()
		if (functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		// Method call: obj.method() or Type.method()
		if (functionNode.type === "selector_expression") {
			const operandNode = functionNode.childForFieldName("operand")
			const fieldNode = functionNode.childForFieldName("field")

			if (operandNode && fieldNode) {
				const operandName = operandNode.text
				const methodName = fieldNode.text

				// Check if it's a static method (Type.method) or instance method (obj.method)
				const isStatic = /^[A-Z]/.test(operandName)

				return {
					calleeName: methodName,
					callType: isStatic ? "static_method" : "method",
					line,
					column,
					receiver: isStatic ? undefined : operandName,
					qualifier: isStatic ? operandName : undefined,
				}
			}
		}

		// Package function call: package.Function()
		if (functionNode.type === "qualified_type") {
			const packageNode = functionNode.childForFieldName("package")
			const nameNode = functionNode.childForFieldName("name")

			if (packageNode && nameNode) {
				return {
					calleeName: nameNode.text,
					callType: "function",
					line,
					column,
					qualifier: packageNode.text,
				}
			}
		}

		return null
	}

	/**
	 * Parse a Java call expression
	 */
	private parseJavaCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		// Handle method invocations
		if (callNode.type === "method_invocation") {
			const objectNode = callNode.childForFieldName("object")
			const nameNode = callNode.childForFieldName("name")

			if (nameNode) {
				const methodName = nameNode.text

				// Static method call: Class.method()
				if (objectNode && objectNode.type === "identifier") {
					const isStatic = /^[A-Z]/.test(objectNode.text)
					return {
						calleeName: methodName,
						callType: isStatic ? "static_method" : "method",
						line,
						column,
						receiver: isStatic ? undefined : objectNode.text,
						qualifier: isStatic ? objectNode.text : undefined,
					}
				}

				// Method call without explicit object (this.method() or local method)
				return {
					calleeName: methodName,
					callType: "method",
					line,
					column,
				}
			}
		}

		// Handle object creation expressions (constructor calls)
		if (callNode.type === "object_creation_expression") {
			const typeNode = callNode.childForFieldName("type")
			if (typeNode) {
				return {
					calleeName: typeNode.text,
					callType: "constructor",
					line,
					column,
				}
			}
		}

		// Handle regular call expressions
		const functionNode = callNode.childForFieldName("function")
		if (functionNode && functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		return null
	}

	/**
	 * Parse a C++ call expression
	 */
	private parseCppCallExpression(callNode: Node): CallInfo | null {
		const line = callNode.startPosition.row + 1 // Convert to 1-based
		const column = callNode.startPosition.column

		const functionNode = callNode.childForFieldName("function")
		if (!functionNode) {
			return null
		}

		// Simple function call: foo()
		if (functionNode.type === "identifier") {
			return {
				calleeName: functionNode.text,
				callType: "function",
				line,
				column,
			}
		}

		// Method call: obj->method() or obj.method()
		if (functionNode.type === "field_expression") {
			const objectNode = functionNode.childForFieldName("argument")
			const fieldNode = functionNode.childForFieldName("field")

			if (objectNode && fieldNode) {
				const objectName = objectNode.text
				const methodName = fieldNode.text

				return {
					calleeName: methodName,
					callType: "method",
					line,
					column,
					receiver: objectName,
				}
			}
		}

		// Template function call: foo<T>()
		if (functionNode.type === "template_function") {
			const nameNode = functionNode.childForFieldName("name")
			if (nameNode && nameNode.type === "identifier") {
				return {
					calleeName: nameNode.text,
					callType: "function",
					line,
					column,
				}
			}
		}

		// Namespace qualified call: std::foo()
		if (functionNode.type === "qualified_identifier") {
			const scopeNode = functionNode.childForFieldName("scope")
			const nameNode = functionNode.childForFieldName("name")

			if (scopeNode && nameNode) {
				return {
					calleeName: nameNode.text,
					callType: "function",
					line,
					column,
					qualifier: scopeNode.text,
				}
			}
		}

		// Constructor call: new MyClass()
		const parentNode = callNode.parent
		if (parentNode && parentNode.type === "new_expression") {
			const typeNode = parentNode.childForFieldName("type")
			if (typeNode) {
				return {
					calleeName: typeNode.text,
					callType: "constructor",
					line,
					column,
				}
			}
		}

		return null
	}

	/**
	 * Phase 10, Task 2: Detect if a file is a test file
	 * Uses multi-layered detection: file path, imports, and AST content
	 */
	private detectTestFile(filePath: string, tree: any, ext: string): TestMetadata | undefined {
		// Layer 1: File path pattern matching (30% weight)
		const pathScore = this.scoreTestFilePath(filePath, ext)

		// Layer 2: Import analysis (40% weight)
		const importScore = this.scoreTestImports(tree, ext)

		// Layer 3: AST content analysis (30% weight)
		const contentScore = this.scoreTestContent(tree, ext)

		// Combine scores
		const totalScore = pathScore * 0.3 + importScore * 0.4 + contentScore * 0.3

		if (totalScore < 0.5) {
			return undefined // Not a test file
		}

		return {
			isTest: true,
			testFramework: this.detectTestFramework(tree, ext),
			testType: this.inferTestType(filePath),
			testTargets: [], // Will be populated later
		}
	}

	/**
	 * Score test file path patterns by language
	 */
	private scoreTestFilePath(filePath: string, ext: string): number {
		const fileName = path.basename(filePath)
		const dirPath = path.dirname(filePath)

		const patterns = this.getTestFilePatterns(ext)

		for (const pattern of patterns) {
			if (pattern.test(fileName) || pattern.test(dirPath)) {
				return 0.8
			}
		}

		return 0.0
	}

	/**
	 * Get test file patterns by language/extension
	 */
	private getTestFilePatterns(ext: string): RegExp[] {
		const patterns: Record<string, RegExp[]> = {
			ts: [/\.test\.tsx?$/, /\.spec\.tsx?$/, /__tests__/, /\/tests?\//, /\/spec\//],
			tsx: [/\.test\.tsx?$/, /\.spec\.tsx?$/, /__tests__/, /\/tests?\//, /\/spec\//],
			js: [/\.test\.jsx?$/, /\.spec\.jsx?$/, /__tests__/, /\/tests?\//, /\/spec\//],
			jsx: [/\.test\.jsx?$/, /\.spec\.jsx?$/, /__tests__/, /\/tests?\//, /\/spec\//],
			py: [/^test_.*\.py$/, /.*_test\.py$/, /\/tests?\//, /\/test\//],
			go: [/_test\.go$/],
			rs: [/\.rs$/], // Rust tests are in same files with #[test]
			java: [/Test\.java$/, /Tests\.java$/, /\/test\//, /src\/test\//],
			cs: [/Tests?\.cs$/, /\/Tests?\//],
			rb: [/_spec\.rb$/, /^test_.*\.rb$/, /.*_test\.rb$/, /\/spec\//, /\/test\//],
			php: [/Test\.php$/, /\.test\.php$/, /\/tests?\//],
			swift: [/Tests\.swift$/, /\/Tests\//],
		}

		return patterns[ext] || []
	}

	/**
	 * Score test imports (detect test framework imports)
	 */
	private scoreTestImports(tree: any, ext: string): number {
		const rootNode = tree.rootNode
		const imports = this.extractImportSources(rootNode)

		const frameworkMap: Record<string, string[]> = {
			ts: ["vitest", "jest", "@jest/globals", "mocha", "jasmine", "ava", "tape", "@testing-library"],
			tsx: ["vitest", "jest", "@jest/globals", "mocha", "jasmine", "ava", "tape", "@testing-library"],
			js: ["vitest", "jest", "mocha", "jasmine", "ava", "tape"],
			jsx: ["vitest", "jest", "mocha", "jasmine", "ava", "tape"],
			py: ["pytest", "unittest", "nose2", "nose"],
			go: ["testing", "github.com/stretchr/testify", "github.com/onsi/ginkgo", "github.com/onsi/gomega"],
			java: ["org.junit.jupiter", "org.junit", "org.testng"],
			cs: ["NUnit.Framework", "Xunit", "Microsoft.VisualStudio.TestTools.UnitTesting"],
			rb: ["rspec", "minitest"],
			php: ["PHPUnit", "Pest"],
			swift: ["XCTest"],
		}

		const frameworks = frameworkMap[ext] || []

		for (const importSource of imports) {
			for (const framework of frameworks) {
				if (importSource.includes(framework)) {
					return 0.9
				}
			}
		}

		return 0.0
	}

	/**
	 * Extract import sources from AST
	 */
	private extractImportSources(node: any): string[] {
		const sources: string[] = []

		const findImports = (n: any) => {
			if (!n) return

			if (n.type === "import_statement" || n.type === "import_from_statement") {
				const sourceNode = n.childForFieldName("source")
				if (sourceNode) {
					sources.push(sourceNode.text.replace(/['"]/g, ""))
				}
			}

			for (const child of n.children || []) {
				findImports(child)
			}
		}

		findImports(node)
		return sources
	}

	/**
	 * Score test content (detect test-specific function calls)
	 */
	private scoreTestContent(tree: any, ext: string): number {
		const rootNode = tree.rootNode
		const testPatterns: Record<string, string[]> = {
			ts: ["describe", "it", "test", "expect", "beforeEach", "afterEach"],
			tsx: ["describe", "it", "test", "expect", "beforeEach", "afterEach"],
			js: ["describe", "it", "test", "expect", "beforeEach", "afterEach"],
			jsx: ["describe", "it", "test", "expect", "beforeEach", "afterEach"],
			py: ["def test_", "class Test", "@pytest", "@patch"],
			go: ["func Test", "func Benchmark"],
			rs: ["#[test]", "#[cfg(test)]"],
			java: ["@Test", "@Before", "@After"],
			cs: ["[Test]", "[Fact]", "[Theory]", "[TestMethod]"],
			rb: ["describe", "it", "context", "def test_"],
			php: ["public function test", "class.*Test extends"],
			swift: ["func test", "class.*Tests.*XCTestCase"],
		}

		const patterns = testPatterns[ext] || []
		const text = rootNode.text

		for (const pattern of patterns) {
			if (text.includes(pattern)) {
				return 0.8
			}
		}

		return 0.0
	}

	/**
	 * Detect test framework from imports and content
	 */
	private detectTestFramework(tree: any, ext: string): string | undefined {
		const rootNode = tree.rootNode
		const imports = this.extractImportSources(rootNode)

		const frameworkMap: Record<string, Record<string, string>> = {
			ts: {
				vitest: "vitest",
				jest: "jest",
				"@jest/globals": "jest",
				mocha: "mocha",
				jasmine: "jasmine",
				ava: "ava",
				tape: "tape",
			},
			tsx: {
				vitest: "vitest",
				jest: "jest",
				"@jest/globals": "jest",
				mocha: "mocha",
				jasmine: "jasmine",
			},
			js: { vitest: "vitest", jest: "jest", mocha: "mocha", jasmine: "jasmine", ava: "ava", tape: "tape" },
			jsx: { vitest: "vitest", jest: "jest", mocha: "mocha", jasmine: "jasmine" },
			py: { pytest: "pytest", unittest: "unittest", nose2: "nose2", nose: "nose" },
			go: {
				testing: "go-testing",
				"github.com/stretchr/testify": "testify",
				"github.com/onsi/ginkgo": "ginkgo",
			},
			java: { "org.junit.jupiter": "junit5", "org.junit": "junit4", "org.testng": "testng" },
			cs: {
				"NUnit.Framework": "nunit",
				Xunit: "xunit",
				"Microsoft.VisualStudio.TestTools.UnitTesting": "mstest",
			},
			rb: { rspec: "rspec", minitest: "minitest" },
			php: { PHPUnit: "phpunit", Pest: "pest" },
			swift: { XCTest: "xctest" },
		}

		const languageFrameworks = frameworkMap[ext] || {}

		for (const importSource of imports) {
			for (const [pattern, framework] of Object.entries(languageFrameworks)) {
				if (importSource.includes(pattern)) {
					return framework
				}
			}
		}

		return undefined
	}

	/**
	 * Infer test type from file path
	 */
	private inferTestType(filePath: string): TestMetadata["testType"] {
		const lowerPath = filePath.toLowerCase()

		if (lowerPath.includes("e2e") || lowerPath.includes("end-to-end")) {
			return "e2e"
		}
		if (lowerPath.includes("integration") || lowerPath.includes("int.test")) {
			return "integration"
		}
		if (lowerPath.includes("snapshot") || lowerPath.includes(".snap")) {
			return "snapshot"
		}
		if (lowerPath.includes("benchmark") || lowerPath.includes("perf") || lowerPath.includes("performance")) {
			return "benchmark"
		}
		if (lowerPath.includes("unit")) {
			return "unit"
		}

		// Default to unit test if in test directory
		return "unit"
	}

	/**
	 * Extract test targets from imports (highest confidence method)
	 */
	private extractTargetsFromImports(testBlock: CodeBlock, allBlocks: CodeBlock[]): TestTarget[] {
		const targets: TestTarget[] = []

		if (!testBlock.imports) {
			return targets
		}

		for (const importInfo of testBlock.imports) {
			// Skip test framework imports
			if (this.isTestFrameworkImport(importInfo.source)) {
				continue
			}

			// Find source file blocks
			const sourceBlocks = allBlocks.filter(
				(block) => block.file_path.includes(importInfo.source) && !block.testMetadata?.isTest,
			)

			for (const sourceBlock of sourceBlocks) {
				// Check if imported symbols match block identifiers
				for (const symbol of importInfo.symbols) {
					if (sourceBlock.identifier === symbol) {
						targets.push({
							targetIdentifier: symbol,
							targetFilePath: sourceBlock.file_path,
							confidence: 90,
							detectionMethod: "import",
						})
					}
				}
			}
		}

		return targets
	}

	/**
	 * Check if an import is from a test framework
	 */
	private isTestFrameworkImport(source: string): boolean {
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
			"testing", // Go
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

		return testFrameworks.some((framework) => source.toLowerCase().includes(framework))
	}

	/**
	 * Splits a large function or semantic unit at logical boundaries to create meaningful chunks.
	 * This function analyzes the AST to identify natural breaking points that preserve semantic coherence.
	 *
	 * @param node The large AST node to split (typically a function or class)
	 * @param filePath Path to the source file
	 * @param fileHash Hash of the entire file
	 * @param seenSegmentHashes Set of already seen segment hashes to avoid duplicates
	 * @param fileContent Full file content (needed for context extraction)
	 * @param fileImports File-level import information to include in chunks
	 * @param testMetadata Test metadata if this is a test file
	 * @returns Array of CodeBlock chunks split at logical boundaries
	 */
	private splitAtLogicalBoundaries(
		node: Node,
		filePath: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
		fileContent: string,
		fileImports: ImportInfo[],
		testMetadata?: TestMetadata,
	): CodeBlock[] {
		const ext = path.extname(filePath).slice(1).toLowerCase()
		const chunks: CodeBlock[] = []

		try {
			// Identify logical boundaries within the node
			const boundaries = this.identifyLogicalBoundaries(node, ext)

			if (boundaries.length === 0) {
				// No logical boundaries found, fall back to line-based chunking
				return this._chunkLeafNodeByLines(node, filePath, fileHash, seenSegmentHashes)
			}

			// Create chunks based on identified boundaries
			const nodeLines = fileContent.split("\n")
			const startLine = node.startPosition.row
			const endLine = node.endPosition.row

			// Group boundaries into balanced chunks
			const chunkGroups = this.groupBoundariesIntoChunks(
				boundaries,
				nodeLines,
				startLine,
				endLine,
				SEMANTIC_MAX_CHARS,
			)

			// Create CodeBlock objects for each chunk group
			for (const group of chunkGroups) {
				const chunk = this.createChunkFromBoundaryGroup(
					group,
					node,
					filePath,
					fileHash,
					fileContent,
					fileImports,
					testMetadata,
					seenSegmentHashes,
					ext,
				)
				if (chunk) {
					chunks.push(chunk)
				}
			}

			return chunks
		} catch (error) {
			logger.debug(
				`Error in splitAtLogicalBoundaries for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
				"CodeParser",
			)
			// Fall back to line-based chunking on error
			return this._chunkLeafNodeByLines(node, filePath, fileHash, seenSegmentHashes)
		}
	}

	/**
	 * Identifies logical boundaries within a large AST node where it can be meaningfully split.
	 * These boundaries represent natural breaking points that preserve semantic coherence.
	 *
	 * @param node The AST node to analyze
	 * @param language The programming language extension
	 * @returns Array of boundary objects with position and type information
	 */
	private identifyLogicalBoundaries(node: Node, language: string): LogicalBoundary[] {
		const boundaries: LogicalBoundary[] = []

		// Get language-specific boundary patterns
		const patterns = this.getLanguageBoundaryPatterns(language)

		// Traverse the AST to find boundary nodes
		const traverse = (currentNode: Node, depth: number = 0) => {
			// Skip the root node itself
			if (currentNode.id === node.id) {
				for (const child of currentNode.children) {
					if (child) traverse(child, depth + 1)
				}
				return
			}

			// Check if current node represents a logical boundary
			const boundaryType = this.getBoundaryType(currentNode, patterns)
			if (boundaryType) {
				boundaries.push({
					node: currentNode,
					type: boundaryType,
					startLine: currentNode.startPosition.row,
					endLine: currentNode.endPosition.row,
					depth,
					text: currentNode.text,
					priority: this.getBoundaryPriority(boundaryType, depth),
				})
			}

			// Continue traversing children
			for (const child of currentNode.children) {
				if (child) traverse(child, depth + 1)
			}
		}

		traverse(node)

		// Sort boundaries by position and priority
		return boundaries.sort((a, b) => {
			if (a.startLine !== b.startLine) {
				return a.startLine - b.startLine
			}
			// If same line, prioritize by boundary type priority
			return b.priority - a.priority
		})
	}

	/**
	 * Gets language-specific boundary patterns for logical splitting.
	 * Different languages have different constructs that make good splitting points.
	 *
	 * @param language The programming language extension
	 * @returns Object containing boundary patterns for the language
	 */
	private getLanguageBoundaryPatterns(language: string): LanguageBoundaryPatterns {
		const commonPatterns: LanguageBoundaryPatterns = {
			controlFlow: [
				"if_statement",
				"else_clause",
				"switch_statement",
				"case",
				"for_statement",
				"while_statement",
				"do_statement",
			],
			functions: ["function_declaration", "function_expression", "arrow_function", "method_definition"],
			classes: ["class_declaration", "class_expression", "interface_declaration", "struct_item"],
			blocks: ["block", "statement_block"],
			comments: ["comment", "block_comment", "line_comment"],
		}

		// Language-specific adjustments
		switch (language) {
			case "py":
				return {
					...commonPatterns,
					controlFlow: [
						...commonPatterns.controlFlow,
						"if_statement",
						"elif_clause",
						"else_clause",
						"for_statement",
						"while_statement",
						"try_statement",
						"except_clause",
						"finally_clause",
						"with_statement",
					],
					functions: ["function_definition", "lambda_function"],
					classes: ["class_definition"],
				}

			case "rs":
				return {
					...commonPatterns,
					controlFlow: [
						...commonPatterns.controlFlow,
						"match_expression",
						"match_arm",
						"if_expression",
						"if_let_expression",
						"loop_expression",
						"while_expression",
						"for_expression",
						"unsafe_block",
					],
					functions: ["function_item", "closure_expression"],
					classes: ["struct_item", "enum_item", "impl_item", "trait_item"],
				}

			case "go":
				return {
					...commonPatterns,
					controlFlow: [
						...commonPatterns.controlFlow,
						"if_statement",
						"else_clause",
						"switch_statement",
						"case_clause",
						"default_clause",
						"for_statement",
						"range_clause",
						"select_statement",
						"communication_clause",
						"go_statement",
						"defer_statement",
					],
					functions: ["function_declaration"],
					classes: ["struct_type", "interface_type"],
				}

			case "java":
			case "cs":
				return {
					...commonPatterns,
					controlFlow: [
						...commonPatterns.controlFlow,
						"if_statement",
						"else_statement",
						"switch_statement",
						"switch_expression",
						"for_statement",
						"enhanced_for_statement",
						"while_statement",
						"do_statement",
						"try_statement",
						"catch_clause",
						"finally_clause",
					],
					functions: ["method_declaration", "constructor_declaration"],
					classes: ["class_declaration", "interface_declaration", "enum_declaration", "record_declaration"],
				}

			case "cpp":
			case "c":
			case "cc":
			case "cxx":
			case "hpp":
			case "h":
				return {
					...commonPatterns,
					controlFlow: [
						...commonPatterns.controlFlow,
						"if_statement",
						"else_clause",
						"switch_statement",
						"case_label",
						"default_label",
						"for_statement",
						"range_based_for_statement",
						"while_statement",
						"do_statement",
						"try_statement",
						"catch_clause",
						"finally_clause",
					],
					functions: ["function_definition", "declaration"],
					classes: ["class_specifier", "struct_specifier", "union_specifier", "enum_specifier"],
				}

			default:
				// Default to TypeScript/JavaScript patterns
				return commonPatterns
		}
	}

	/**
	 * Determines the boundary type for a given node based on language patterns.
	 *
	 * @param node The AST node to classify
	 * @param patterns Language-specific boundary patterns
	 * @returns Boundary type or null if not a boundary
	 */
	private getBoundaryType(node: Node, patterns: LanguageBoundaryPatterns): BoundaryType | null {
		const nodeType = node.type

		// Check each boundary category
		if (patterns.controlFlow.includes(nodeType)) {
			return "control_flow"
		}
		if (patterns.functions.includes(nodeType)) {
			return "function"
		}
		if (patterns.classes.includes(nodeType)) {
			return "class"
		}
		if (patterns.blocks.includes(nodeType)) {
			return "block"
		}
		if (patterns.comments.includes(nodeType)) {
			return "comment"
		}

		return null
	}

	/**
	 * Gets the priority score for a boundary type and depth.
	 * Higher priority boundaries are preferred for splitting.
	 *
	 * @param boundaryType The type of boundary
	 * @param depth The nesting depth of the boundary
	 * @returns Priority score (higher = preferred for splitting)
	 */
	private getBoundaryPriority(boundaryType: BoundaryType, depth: number): number {
		const basePriorities: Record<BoundaryType, number> = {
			control_flow: 100,
			function: 90,
			class: 80,
			block: 60,
			comment: 40,
		}

		// Adjust priority based on depth (prefer boundaries at reasonable depths)
		const depthAdjustment = depth <= 3 ? 0 : (depth - 3) * -10

		return basePriorities[boundaryType] + depthAdjustment
	}

	/**
	 * Groups identified boundaries into balanced chunks that respect size limits.
	 * This algorithm tries to create chunks of roughly equal size while respecting logical boundaries.
	 *
	 * @param boundaries Array of identified boundaries
	 * @param nodeLines Array of all lines in the node
	 * @param startLine Starting line number of the node
	 * @param endLine Ending line number of the node
	 * @param maxChunkSize Maximum desired chunk size in characters
	 * @returns Array of chunk groups with their boundaries
	 */
	private groupBoundariesIntoChunks(
		boundaries: LogicalBoundary[],
		nodeLines: string[],
		startLine: number,
		endLine: number,
		maxChunkSize: number,
	): BoundaryChunkGroup[] {
		const chunks: BoundaryChunkGroup[] = []

		if (boundaries.length === 0) {
			// No boundaries, create single chunk
			chunks.push({
				boundaries: [],
				startLine,
				endLine,
				estimatedSize: nodeLines.slice(startLine, endLine + 1).join("\n").length,
			})
			return chunks
		}

		let currentChunk: BoundaryChunkGroup = {
			boundaries: [],
			startLine: startLine,
			endLine: startLine,
			estimatedSize: 0,
		}

		let lastBoundaryLine = startLine

		for (let i = 0; i < boundaries.length; i++) {
			const boundary = boundaries[i]
			const nextBoundary = boundaries[i + 1]

			// Calculate size if we include this boundary
			const linesToInclude = nodeLines.slice(lastBoundaryLine, boundary.endLine + 1)
			const sizeWithBoundary = linesToInclude.join("\n").length

			// Check if adding this boundary would exceed the limit
			if (currentChunk.estimatedSize + sizeWithBoundary > maxChunkSize && currentChunk.boundaries.length > 0) {
				// Current chunk is full, finalize it
				currentChunk.endLine = boundary.startLine - 1
				chunks.push(currentChunk)

				// Start new chunk with this boundary
				currentChunk = {
					boundaries: [boundary],
					startLine: boundary.startLine,
					endLine: boundary.endLine,
					estimatedSize: sizeWithBoundary,
				}
				lastBoundaryLine = boundary.endLine + 1
			} else {
				// Add boundary to current chunk
				currentChunk.boundaries.push(boundary)
				currentChunk.endLine = boundary.endLine
				currentChunk.estimatedSize += sizeWithBoundary
				lastBoundaryLine = boundary.endLine + 1
			}

			// Handle the last boundary
			if (i === boundaries.length - 1) {
				// Include any remaining lines after the last boundary
				const remainingLines = nodeLines.slice(lastBoundaryLine, endLine + 1)
				if (remainingLines.length > 0) {
					currentChunk.estimatedSize += remainingLines.join("\n").length
					currentChunk.endLine = endLine
				}
				chunks.push(currentChunk)
			}
		}

		return chunks
	}

	/**
	 * Creates a CodeBlock from a boundary chunk group.
	 * This method extracts the content, metadata, and context for a chunk.
	 *
	 * @param group The boundary chunk group
	 * @param originalNode The original large node being split
	 * @param filePath Path to the source file
	 * @param fileHash Hash of the entire file
	 * @param fileContent Full file content
	 * @param fileImports File-level import information
	 * @param testMetadata Test metadata if applicable
	 * @param seenSegmentHashes Set of seen hashes to avoid duplicates
	 * @param language The programming language extension
	 * @returns CodeBlock or null if creation fails
	 */
	private createChunkFromBoundaryGroup(
		group: BoundaryChunkGroup,
		originalNode: Node,
		filePath: string,
		fileHash: string,
		fileContent: string,
		fileImports: ImportInfo[],
		testMetadata: TestMetadata | undefined,
		seenSegmentHashes: Set<string>,
		language: string,
	): CodeBlock | null {
		try {
			const lines = fileContent.split("\n")
			const chunkLines = lines.slice(group.startLine, group.endLine + 1)
			const chunkContent = chunkLines.join("\n")

			// Skip if too small
			if (chunkContent.length < MIN_BLOCK_CHARS) {
				return null
			}

			// Create segment hash
			const contentPreview = chunkContent.slice(0, 100)
			const segmentHash = createHash("sha256")
				.update(
					`${filePath}-${group.startLine + 1}-${group.endLine + 1}-${chunkContent.length}-${contentPreview}`,
				)
				.digest("hex")

			// Skip if already seen
			if (seenSegmentHashes.has(segmentHash)) {
				return null
			}
			seenSegmentHashes.add(segmentHash)

			// Extract metadata for the chunk
			let symbolMetadata = undefined
			let documentation = undefined
			let calls: CallInfo[] | undefined = undefined

			// For TypeScript/JavaScript, try to extract enhanced metadata
			if (["ts", "tsx", "js", "jsx"].includes(language)) {
				try {
					// Create a temporary node for metadata extraction
					const tempContent = chunkContent
					const parser = this.loadedParsers[language]?.parser
					if (parser) {
						const tempTree = parser.parse(tempContent)
						if (tempTree) {
							const tempNode = tempTree.rootNode.descendantForIndex(0)
							if (tempNode) {
								symbolMetadata = extractSymbolMetadata(tempNode, tempContent) || undefined
								documentation = symbolMetadata?.documentation
							}
						}
					}
				} catch (error) {
					// Silently fail metadata extraction
					logger.debug(
						`Failed to extract metadata for chunk ${filePath}:${group.startLine + 1}: ${error instanceof Error ? error.message : String(error)}`,
						"CodeParser",
					)
				}
			}

			// Extract function calls from the chunk
			try {
				const parser = this.loadedParsers[language]?.parser
				if (parser) {
					const tempTree = parser.parse(chunkContent)
					if (tempTree) {
						const extractedCalls = this.extractCalls(tempTree.rootNode, filePath)
						calls = extractedCalls.length > 0 ? extractedCalls : undefined
					}
				}
			} catch (error) {
				// Silently fail call extraction
				logger.debug(
					`Failed to extract calls for chunk ${filePath}:${group.startLine + 1}: ${error instanceof Error ? error.message : String(error)}`,
					"CodeParser",
				)
			}

			// Determine chunk type and identifier
			const chunkType = this.determineChunkType(group, originalNode)
			const identifier = this.determineChunkIdentifier(group, originalNode)

			return {
				file_path: filePath,
				identifier,
				type: chunkType,
				start_line: group.startLine + 1, // Convert to 1-based
				end_line: group.endLine + 1, // Convert to 1-based
				content: chunkContent,
				segmentHash,
				fileHash,
				symbolMetadata,
				documentation,
				imports: fileImports.length > 0 ? fileImports : undefined,
				calls,
				testMetadata,
			}
		} catch (error) {
			logger.debug(
				`Failed to create chunk from boundary group for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
				"CodeParser",
			)
			return null
		}
	}

	/**
	 * Determines the appropriate type for a chunk based on its boundaries.
	 *
	 * @param group The boundary chunk group
	 * @param originalNode The original node being split
	 * @returns String representing the chunk type
	 */
	private determineChunkType(group: BoundaryChunkGroup, originalNode: Node): string {
		// If the chunk contains function boundaries, mark it as such
		if (group.boundaries.some((b) => b.type === "function")) {
			return "function_chunk"
		}

		// If the chunk contains class boundaries, mark it as such
		if (group.boundaries.some((b) => b.type === "class")) {
			return "class_chunk"
		}

		// If the chunk contains control flow boundaries, mark it as such
		if (group.boundaries.some((b) => b.type === "control_flow")) {
			return "control_flow_chunk"
		}

		// Default to the original node type with _chunk suffix
		return `${originalNode.type}_chunk`
	}

	/**
	 * Determines an appropriate identifier for a chunk.
	 *
	 * @param group The boundary chunk group
	 * @param originalNode The original node being split
	 * @returns String identifier or null
	 */
	private determineChunkIdentifier(group: BoundaryChunkGroup, originalNode: Node): string | null {
		// Try to use the original node's identifier with a suffix
		const originalIdentifier =
			originalNode.childForFieldName("name")?.text ||
			originalNode.children.find((c) => c?.type === "identifier")?.text

		if (originalIdentifier) {
			// Add a suffix to distinguish chunks
			const chunkIndex = group.startLine - originalNode.startPosition.row
			return `${originalIdentifier}_chunk_${Math.floor(chunkIndex / 10) + 1}`
		}

		// Try to find a meaningful identifier from the first boundary
		if (group.boundaries.length > 0) {
			const firstBoundary = group.boundaries[0]
			const boundaryIdentifier =
				firstBoundary.node.childForFieldName("name")?.text ||
				firstBoundary.node.children.find((c) => c?.type === "identifier")?.text

			if (boundaryIdentifier) {
				return boundaryIdentifier
			}
		}

		return null
	}
}

// Export a singleton instance for convenience
export const codeParser = new CodeParser(undefined, undefined)

/**
 * Set the metrics collector for the singleton parser instance
 */
export function setParserMetricsCollector(collector: MetricsCollector): void {
	;(codeParser as any).metricsCollector = collector
}

// Type definitions for the logical boundary system

/**
 * Represents a logical boundary within a code node where it can be split
 */
interface LogicalBoundary {
	node: Node
	type: BoundaryType
	startLine: number
	endLine: number
	depth: number
	text: string
	priority: number
}

/**
 * Types of logical boundaries for code splitting
 */
type BoundaryType = "control_flow" | "function" | "class" | "block" | "comment"

/**
 * Language-specific boundary patterns
 */
interface LanguageBoundaryPatterns {
	controlFlow: string[]
	functions: string[]
	classes: string[]
	blocks: string[]
	comments: string[]
}

/**
 * Represents a group of boundaries that form a logical chunk
 */
interface BoundaryChunkGroup {
	boundaries: LogicalBoundary[]
	startLine: number
	endLine: number
	estimatedSize: number
}
