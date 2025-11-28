import * as path from "path"
import { createRequire } from "module"
const require = createRequire(import.meta.url)
const TreeSitter = require("web-tree-sitter")

async function run() {
	await TreeSitter.init()
	const parser = new TreeSitter()

	// Use hardcoded path found by 'find'
	const wasmPath = path.resolve(
		"/home/birdman/RooKnowledge/Roo-Code-Knowledge/src/services/tree-sitter/tree-sitter-typescript.wasm",
	)
	console.log(`Loading language from ${wasmPath}`)

	const lang = await TreeSitter.Language.load(wasmPath)
	parser.setLanguage(lang)

	const code = `
import * as path from 'path';

export function add(a: number, b: number): number {
    return a + b;
}

export class Calculator {
    multiply(a: number, b: number): number {
        return a * b;
    }
}
    `

	const tree = parser.parse(code)
	console.log(tree.rootNode.toString())

	// Test the query
	const queryScm = `
        (function_declaration name: (identifier) @function-name)
        (class_declaration name: (identifier) @class-name)
        (interface_declaration name: (identifier) @interface-name)
    `
	const query = lang.query(queryScm)
	const captures = query.captures(tree.rootNode)
	console.log(`Captures: ${captures.length}`)
	captures.forEach((c) => {
		console.log(`Capture: ${c.name} - ${c.node.type}`)
	})
}

run().catch(console.error)
