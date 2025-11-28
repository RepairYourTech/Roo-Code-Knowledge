import { Anthropic } from "@anthropic-ai/sdk"
import { Tiktoken, init } from "tiktoken/lite/init"
import o200kBase from "tiktoken/encoders/o200k_base"
import * as fs from "fs"
import * as path from "path"

const TOKEN_FUDGE_FACTOR = 1.5

let encoder: Tiktoken | null = null

export async function tiktoken(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
	if (content.length === 0) {
		return 0
	}

	let totalTokens = 0

	// Lazily create and cache the encoder if it doesn't exist.
	if (!encoder) {
		// Manually load the WASM file to avoid network requests and ensure it works in the packaged extension
		const wasmPath = await findWasmPath()
		if (wasmPath) {
			const wasmBuffer = fs.readFileSync(wasmPath)
			await init((imports) => WebAssembly.instantiate(wasmBuffer, imports))
		}
		encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
	}

	// Process each content block using the cached encoder.
	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""

			if (text.length > 0) {
				const tokens = encoder.encode(text, undefined, [])
				totalTokens += tokens.length
			}
		} else if (block.type === "image") {
			// For images, calculate based on data size.
			const imageSource = block.source

			if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
				const base64Data = imageSource.data as string
				totalTokens += Math.ceil(Math.sqrt(base64Data.length))
			} else {
				totalTokens += 300 // Conservative estimate for unknown images
			}
		}
	}

	// Add a fudge factor to account for the fact that tiktoken is not always
	// accurate.
	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}

async function findWasmPath(): Promise<string | null> {
	// Check possible locations for the WASM file
	// 1. In the same directory as the script (dist/tiktoken_bg.wasm) - likely location in VSIX if bundled implicitly
	// 2. In src/wasms/tiktoken (source location)
	// 3. In dist/wasms/tiktoken (if copied during build)
	// 4. Relative to the current file (development)

	const possiblePaths = [
		// Direct sibling (likely in VSIX dist folder)
		path.join(__dirname, "tiktoken_bg.wasm"),
		// For extension.js (in dist/) -> ../wasms/tiktoken/tiktoken_bg.wasm
		path.join(__dirname, "..", "wasms", "tiktoken", "tiktoken_bg.wasm"),
		// For workers (in dist/workers/) -> ../../wasms/tiktoken/tiktoken_bg.wasm
		path.join(__dirname, "..", "..", "wasms", "tiktoken", "tiktoken_bg.wasm"),
		// Development/Node modules fallback
		path.join(__dirname, "..", "node_modules", "tiktoken", "tiktoken_bg.wasm"),
		path.join(process.cwd(), "node_modules", "tiktoken", "tiktoken_bg.wasm"),
	]

	for (const p of possiblePaths) {
		if (fs.existsSync(p)) {
			// console.log("Found tiktoken_bg.wasm at:", p)
			return p
		}
	}

	console.error("Could not find tiktoken_bg.wasm in any of the expected locations:", possiblePaths)
	return null
}
