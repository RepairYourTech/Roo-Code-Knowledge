import { readFile } from "fs/promises"
import { createHash } from "crypto"
import * as path from "path"
import * as vscode from "vscode"
import { Node } from "web-tree-sitter"
import { LanguageParser, loadRequiredLanguageParsers } from "../../tree-sitter/languageParser"
import { parseMarkdown } from "../../tree-sitter/markdownParser"
import { ICodeParser, CodeBlock, ILSPService, LSPTypeInfo, CallInfo, TestMetadata, TestTarget } from "../interfaces"
import { scannerExtensions, shouldUseFallbackChunking } from "../shared/supported-extensions"
import {
	MAX_BLOCK_CHARS,
	MIN_BLOCK_CHARS,
	MIN_CHUNK_REMAINDER_CHARS,
	MAX_CHARS_TOLERANCE_FACTOR,
	SEMANTIC_MAX_CHARS,
	ABSOLUTE_MAX_CHARS,
} from "../constants"
import { TelemetryService } from "@roo-code/telemetry"
import { TelemetryEventName } from "@roo-code/types"
import { sanitizeErrorMessage } from "../shared/validation-helpers"
// TODO: Phase 2 - metadata-extractor.ts not yet implemented
// import { extractSymbolMetadata, extractImportInfo } from "./metadata-extractor"
import { ImportInfo } from "../types/metadata"

// Stub functions until metadata-extractor is implemented
function extractSymbolMetadata(_node: any, _text: string): any {
	return undefined
}

function extractImportInfo(_node: any): ImportInfo | null {
	return null
}

/**
 * Implementation of the code parser interface
 */
export class CodeParser implements ICodeParser {
	private loadedParsers: LanguageParser = {}
	private pendingLoads: Map<string, Promise<LanguageParser>> = new Map()
	private lspService?: ILSPService
	// Markdown files are now supported using the custom markdown parser
	// which extracts headers and sections for semantic indexing

	constructor(lspService?: ILSPService) {
		this.lspService = lspService
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
				console.error(`Error reading file ${filePath}:`, error)
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
		if (!this.loadedParsers[ext]) {
			const pendingLoad = this.pendingLoads.get(ext)
			if (pendingLoad) {
				try {
					await pendingLoad
				} catch (error) {
					console.error(`Error in pending parser load for ${filePath}:`, error)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
						stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
						location: "parseContent:loadParser",
					})
					return []
				}
			} else {
				const loadPromise = loadRequiredLanguageParsers([filePath])
				this.pendingLoads.set(ext, loadPromise)
				try {
					const newParsers = await loadPromise
					if (newParsers) {
						this.loadedParsers = { ...this.loadedParsers, ...newParsers }
					}
				} catch (error) {
					console.error(`Error loading language parser for ${filePath}:`, error)
					TelemetryService.instance.captureEvent(TelemetryEventName.CODE_INDEX_ERROR, {
						error: sanitizeErrorMessage(error instanceof Error ? error.message : String(error)),
						stack: error instanceof Error ? sanitizeErrorMessage(error.stack || "") : undefined,
						location: "parseContent:loadParser",
					})
					return []
				} finally {
					this.pendingLoads.delete(ext)
				}
			}
		}

		const language = this.loadedParsers[ext]
		if (!language) {
			console.warn(`No parser available for file extension: ${ext}`)
			return []
		}

		const tree = language.parser.parse(content)

		// We don't need to get the query string from languageQueries since it's already loaded
		// in the language object
		const captures = tree ? language.query.captures(tree.rootNode) : []

		// Check if captures are empty
		if (captures.length === 0) {
			if (content.length >= MIN_BLOCK_CHARS) {
				// Perform fallback chunking if content is large enough
				const blocks = this._performFallbackChunking(filePath, content, fileHash, seenSegmentHashes)
				return blocks
			} else {
				// Return empty if content is too small for fallback
				return []
			}
		}

		const results: CodeBlock[] = []

		// Phase 3: Extract file-level imports once
		const fileImports = this.extractFileImports(tree)

		// Phase 10, Task 2: Detect if this is a test file
		const testMetadata = this.detectTestFile(filePath, tree, ext)

		// Process captures if not empty
		const queue: Node[] = Array.from(captures).map((capture) => capture.node)

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
						// For now, fall back to processing children
						// TODO: Implement splitAtLogicalBoundaries() for very large functions
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
						null
					const type = currentNode.type
					const start_line = adjustedStartLine // Use adjusted start line (includes comments)
					const end_line = currentNode.endPosition.row + 1
					const contentToUse = contentWithComments // Use content with comments
					const contentPreview = contentToUse.slice(0, 100)
					const segmentHash = createHash("sha256")
						.update(`${filePath}-${start_line}-${end_line}-${contentToUse.length}-${contentPreview}`)
						.digest("hex")

					if (!seenSegmentHashes.has(segmentHash)) {
						seenSegmentHashes.add(segmentHash)

						// Phase 2: Extract enhanced metadata for TypeScript/JavaScript
						let symbolMetadata = undefined
						let documentation = undefined
						if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
							try {
								symbolMetadata = extractSymbolMetadata(currentNode, currentNode.text) || undefined
								documentation = symbolMetadata?.documentation
							} catch (error) {
								// Silently fail metadata extraction - don't break indexing
								console.debug(`Failed to extract metadata for ${filePath}:${start_line}`, error)
							}
						}

						// Phase 10: Extract function calls
						let calls: CallInfo[] | undefined = undefined
						try {
							const extractedCalls = this.extractCalls(currentNode, filePath)
							calls = extractedCalls.length > 0 ? extractedCalls : undefined
						} catch (error) {
							// Silently fail call extraction - don't break indexing
							console.debug(`Failed to extract calls for ${filePath}:${start_line}`, error)
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
						})
					}
				}
			}
			// Nodes smaller than minBlockChars are ignored
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
	): CodeBlock[] {
		const chunks: CodeBlock[] = []
		let currentChunkLines: string[] = []
		let currentChunkLength = 0
		let chunkStartLineIndex = 0 // 0-based index within the `lines` array
		const effectiveMaxChars = MAX_BLOCK_CHARS * MAX_CHARS_TOLERANCE_FACTOR

		const finalizeChunk = (endLineIndex: number) => {
			if (currentChunkLength >= MIN_BLOCK_CHARS && currentChunkLines.length > 0) {
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
				}
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
					currentChunkLength >= MIN_BLOCK_CHARS &&
					remainderLength < MIN_CHUNK_REMAINDER_CHARS &&
					currentChunkLines.length > 1
				) {
					for (let k = i - 2; k >= chunkStartLineIndex; k--) {
						const potentialChunkLines = lines.slice(chunkStartLineIndex, k + 1)
						const potentialChunkLength = potentialChunkLines.join("\n").length + 1
						const potentialNextChunkLines = lines.slice(k + 1)
						const potentialNextChunkLength = potentialNextChunkLines.join("\n").length + 1

						if (
							potentialChunkLength >= MIN_BLOCK_CHARS &&
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
			finalizeChunk(lines.length - 1)
		}

		return chunks
	}

	private _performFallbackChunking(
		filePath: string,
		content: string,
		fileHash: string,
		seenSegmentHashes: Set<string>,
	): CodeBlock[] {
		const lines = content.split("\n")
		return this._chunkTextByLines(lines, filePath, fileHash, "fallback_chunk", seenSegmentHashes)
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
			console.debug("Failed to extract imports:", error)
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
			console.debug(`[CodeParser] Failed to enrich with LSP info: ${error}`)
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

		// For other languages, return null for now
		// TODO: Implement parsers for Rust, Go, Java, C++, etc.
		return null
	}

	/**
	 * Parse a JavaScript/TypeScript call expression
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

		// Method call: obj.method() or Class.staticMethod()
		if (functionNode.type === "member_expression") {
			const objectNode = functionNode.childForFieldName("object")
			const propertyNode = functionNode.childForFieldName("property")

			if (objectNode && propertyNode) {
				const objectName = objectNode.text
				const methodName = propertyNode.text

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
}

// Export a singleton instance for convenience
export const codeParser = new CodeParser()
