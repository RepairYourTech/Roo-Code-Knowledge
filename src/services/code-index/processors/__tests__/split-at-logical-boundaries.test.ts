import { CodeParser } from "../parser"
import * as path from "path"
import { readFile } from "fs/promises"

describe("splitAtLogicalBoundaries", () => {
	let parser: CodeParser

	beforeEach(() => {
		parser = new CodeParser()
	})

	it("should split large TypeScript functions at logical boundaries", async () => {
		// Create a large TypeScript function with multiple control flow structures
		const largeFunctionContent = `
/**
 * A large function for testing logical boundary splitting
 */
export function processLargeDataSet(data: any[]): Promise<ProcessedResult[]> {
	const results: ProcessedResult[] = []
	
	// First major section: data validation
	if (!data || data.length === 0) {
		throw new Error("No data provided")
	}
	
	// Second major section: data preprocessing
	for (let i = 0; i < data.length; i++) {
		const item = data[i]
		
		// Validate each item
		if (!item.id || !item.value) {
			continue
		}
		
		// Process based on type
		switch (item.type) {
			case 'type1':
				results.push(processType1(item))
				break
			case 'type2':
				results.push(processType2(item))
				break
			case 'type3':
				if (item.special) {
					results.push(processSpecialType3(item))
				} else {
					results.push(processType3(item))
				}
				break
			default:
				console.warn(\`Unknown type: \${item.type}\`)
		}
	}
	
	// Third major section: post-processing
	const finalResults = results.filter(r => r.isValid)
	
	// Fourth major section: sorting and formatting
	return finalResults
		.sort((a, b) => a.priority - b.priority)
		.map(r => ({
			...r,
			processedAt: new Date().toISOString()
		}))
}

interface ProcessedResult {
	id: string
	value: any
	isValid: boolean
	priority: number
}

function processType1(item: any): ProcessedResult {
	return {
		id: item.id,
		value: item.value * 2,
		isValid: true,
		priority: 1
	}
}

function processType2(item: any): ProcessedResult {
	return {
		id: item.id,
		value: item.value + 10,
		isValid: item.value > 0,
		priority: 2
	}
}

function processType3(item: any): ProcessedResult {
	return {
		id: item.id,
		value: item.value.toString().toUpperCase(),
		isValid: true,
		priority: 3
	}
}

function processSpecialType3(item: any): ProcessedResult {
	return {
		id: item.id,
		value: \`SPECIAL: \${item.value}\`,
		isValid: true,
		priority: 0
	}
}
`

		// Write the content to a temporary file for testing
		const testFilePath = path.join(__dirname, "test-large-function.ts")
		await writeFile(testFilePath, largeFunctionContent, "utf8")

		try {
			// Parse the file
			const blocks = await parser.parseFile(testFilePath, {
				content: largeFunctionContent,
				fileHash: "test-hash",
			})

			// Verify that we got multiple chunks (the function should be split)
			expect(blocks.length).toBeGreaterThan(1)

			// Verify that chunks contain expected content
			const functionChunks = blocks.filter(
				(block) => block.type.includes("function_chunk") || block.type.includes("control_flow_chunk"),
			)
			expect(functionChunks.length).toBeGreaterThan(0)

			// Verify that chunks are reasonably sized
			functionChunks.forEach((chunk) => {
				expect(chunk.content.length).toBeLessThanOrEqual(5000) // ABSOLUTE_MAX_CHARS
				expect(chunk.content.length).toBeGreaterThanOrEqual(50) // MIN_BLOCK_CHARS
			})

			// Verify that chunks maintain semantic coherence
			const chunksWithControlFlow = functionChunks.filter(
				(chunk) =>
					chunk.content.includes("if") || chunk.content.includes("for") || chunk.content.includes("switch"),
			)
			expect(chunksWithControlFlow.length).toBeGreaterThan(0)
		} finally {
			// Clean up test file
			await unlink(testFilePath).catch(() => {}) // Ignore errors
		}
	})

	it("should handle Python functions with logical boundaries", async () => {
		const pythonFunctionContent = `
def process_large_dataset(data):
    """
    A large Python function for testing logical boundary splitting
    """
    results = []
    
    # First major section: data validation
    if not data or len(data) == 0:
        raise ValueError("No data provided")
    
    # Second major section: data preprocessing
    for i, item in enumerate(data):
        # Validate each item
        if not item.get('id') or not item.get('value'):
            continue
        
        # Process based on type
        if item['type'] == 'type1':
            results.append(process_type1(item))
        elif item['type'] == 'type2':
            results.append(process_type2(item))
        elif item['type'] == 'type3':
            if item.get('special'):
                results.append(process_special_type3(item))
            else:
                results.append(process_type3(item))
        else:
            print(f"Unknown type: {item['type']}")
    
    # Third major section: post-processing
    final_results = [r for r in results if r['is_valid']]
    
    # Fourth major section: sorting and formatting
    return sorted(final_results, key=lambda x: x['priority'])

def process_type1(item):
    return {
        'id': item['id'],
        'value': item['value'] * 2,
        'is_valid': True,
        'priority': 1
    }

def process_type2(item):
    return {
        'id': item['id'],
        'value': item['value'] + 10,
        'is_valid': item['value'] > 0,
        'priority': 2
    }
`

		const testFilePath = path.join(__dirname, "test-large-function.py")
		await writeFile(testFilePath, pythonFunctionContent, "utf8")

		try {
			const blocks = await parser.parseFile(testFilePath, {
				content: pythonFunctionContent,
				fileHash: "test-hash",
			})

			// Verify that we got multiple chunks
			expect(blocks.length).toBeGreaterThan(1)

			// Verify Python-specific patterns
			const functionChunks = blocks.filter(
				(block) => block.type.includes("function_chunk") || block.type.includes("control_flow_chunk"),
			)
			expect(functionChunks.length).toBeGreaterThan(0)
		} finally {
			await unlink(testFilePath).catch(() => {})
		}
	})

	it("should fall back to line-based chunking when no logical boundaries found", async () => {
		// Create a large block of code without clear logical boundaries
		const largeContent = `
// Large block of statements without clear boundaries
const result1 = someVeryLongFunctionCall("parameter1", "parameter2", "parameter3")
const result2 = anotherLongFunctionCall(result1, { option1: true, option2: false, option3: "value" })
const result3 = yetAnotherFunction(result2, [item1, item2, item3, item4, item5])
const result4 = finalFunction(result3, "last parameter")
`.repeat(100) // Repeat to make it large

		const testFilePath = path.join(__dirname, "test-large-content.ts")
		await writeFile(testFilePath, largeContent, "utf8")

		try {
			const blocks = await parser.parseFile(testFilePath, {
				content: largeContent,
				fileHash: "test-hash",
			})

			// Should still create chunks, but using fallback method
			expect(blocks.length).toBeGreaterThan(0)
		} finally {
			await unlink(testFilePath).catch(() => {})
		}
	})
})

// Helper functions for file operations
import { writeFile, unlink } from "fs/promises"
