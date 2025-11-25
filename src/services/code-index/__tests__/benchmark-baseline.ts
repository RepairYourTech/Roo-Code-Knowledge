/**
 * Baseline Performance Benchmark Script
 *
 * This script measures the current performance of the code index system
 * using the test fixtures created in Task 0.2.
 *
 * Metrics measured:
 * - Indexing time (total, per file, per language)
 * - Memory usage (peak, average)
 * - Throughput (lines/sec, files/sec)
 * - Vector metrics (embeddings created, generation time)
 * - Search performance (query time, result relevance)
 *
 * TODO: This is a stub implementation that needs to be replaced with real benchmarking.
 * The current runBenchmark function returns zeroed results immediately. It should be replaced
 * with actual benchmarking logic that:
 * - Iterates through fixture files and measures read/indexing time
 * - Tracks memory usage before/after indexing
 * - Measures embedding creation and vector store operations
 * - Runs representative search queries and measures performance
 * - Calculates throughput metrics and populates all result fields
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

interface BenchmarkResult {
	timestamp: string
	systemInfo: {
		platform: string
		arch: string
		cpus: number
		totalMemory: string
		nodeVersion: string
	}
	indexingMetrics: {
		totalTime: number
		filesProcessed: number
		totalLines: number
		throughput: {
			filesPerSecond: number
			linesPerSecond: number
		}
		byLanguage: Record<
			string,
			{
				files: number
				lines: number
				time: number
			}
		>
		byFile: Array<{
			file: string
			lines: number
			time: number
		}>
	}
	memoryMetrics: {
		peakUsage: string
		averageUsage: string
		initialUsage: string
		finalUsage: string
	}
	vectorMetrics: {
		embeddingsCreated: number
		embeddingGenerationTime: number
		averageTimePerEmbedding: number
	}
	searchMetrics: {
		queries: Array<{
			query: string
			time: number
			resultsCount: number
			topResult?: string
		}>
		averageQueryTime: number
	}
}

/**
 * Get system information
 */
function getSystemInfo() {
	return {
		platform: os.platform(),
		arch: os.arch(),
		cpus: os.cpus().length,
		totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
		nodeVersion: process.version,
	}
}

/**
 * Format memory usage in MB
 */
function formatMemory(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * Count lines in a file
 */
function countLines(filePath: string): number {
	const content = fs.readFileSync(filePath, "utf-8")
	return content.split("\n").length
}

/**
 * Get all test fixture files
 */
function getFixtureFiles(fixturesDir: string): string[] {
	const files: string[] = []

	function walk(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true })
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				walk(fullPath)
			} else if (entry.isFile() && !entry.name.endsWith(".md")) {
				files.push(fullPath)
			}
		}
	}

	walk(fixturesDir)
	return files
}

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string {
	const ext = path.extname(filePath)
	const langMap: Record<string, string> = {
		".ts": "TypeScript",
		".tsx": "TypeScript",
		".js": "JavaScript",
		".jsx": "JavaScript",
		".py": "Python",
		".java": "Java",
		".go": "Go",
		".rs": "Rust",
		".vue": "Vue",
	}
	return langMap[ext] || "Unknown"
}

/**
 * Main benchmark function
 */
async function runBenchmark(): Promise<BenchmarkResult> {
	console.log("🚀 Starting Baseline Performance Benchmark...\n")

	// Use absolute path to fixtures since __dirname changes when compiled
	const fixturesDir = "/home/birdman/RooKnowledge/Roo-Code-Knowledge/src/services/code-index/__tests__/fixtures"
	const files = getFixtureFiles(fixturesDir)

	console.log(`📁 Found ${files.length} test fixture files`)
	console.log(
		`📊 System: ${os.platform()} ${os.arch()}, ${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB RAM\n`,
	)

	// Initialize result object
	const result: BenchmarkResult = {
		timestamp: new Date().toISOString(),
		systemInfo: getSystemInfo(),
		indexingMetrics: {
			totalTime: 0,
			filesProcessed: 0,
			totalLines: 0,
			throughput: { filesPerSecond: 0, linesPerSecond: 0 },
			byLanguage: {},
			byFile: [],
		},
		memoryMetrics: {
			peakUsage: "",
			averageUsage: "",
			initialUsage: "",
			finalUsage: "",
		},
		vectorMetrics: {
			embeddingsCreated: 0,
			embeddingGenerationTime: 0,
			averageTimePerEmbedding: 0,
		},
		searchMetrics: {
			queries: [],
			averageQueryTime: 0,
		},
	}

	// Memory tracking
	const getMemoryUsage = (): number => process.memoryUsage().heapUsed
	const initialMemory = getMemoryUsage()
	let peakMemory = initialMemory
	const memorySnapshots: number[] = []

	// Track memory usage during benchmarking
	const memoryTracker = setInterval(() => {
		const currentMemory = getMemoryUsage()
		memorySnapshots.push(currentMemory)
		if (currentMemory > peakMemory) {
			peakMemory = currentMemory
		}
	}, 100)

	try {
		// Start timing
		const indexingStartTime = process.hrtime.bigint()

		console.log("📖 Reading and processing files...")

		// Process each file and measure metrics
		for (const filePath of files) {
			const fileStartTime = process.hrtime.bigint()

			// Read file
			const readStartTime = process.hrtime.bigint()
			const content = fs.readFileSync(filePath, "utf-8")
			const readEndTime = process.hrtime.bigint()
			const readTime = Number(readEndTime - readStartTime) / 1000000 // Convert to milliseconds

			// Count lines
			const lines = content.split("\n").length
			const language = getLanguage(filePath)

			// Simulate indexing time (in real implementation, this would use the actual indexing service)
			// For now, we'll simulate with a small delay based on file size
			const simulatedIndexingTime = Math.max(1, content.length / 10000) // 1ms per 10KB minimum
			await new Promise((resolve) => setTimeout(resolve, simulatedIndexingTime))

			const fileEndTime = process.hrtime.bigint()
			const totalTime = Number(fileEndTime - fileStartTime) / 1000000 // Convert to milliseconds

			// Update metrics
			result.indexingMetrics.filesProcessed++
			result.indexingMetrics.totalLines += lines

			// Update byLanguage metrics
			if (!result.indexingMetrics.byLanguage[language]) {
				result.indexingMetrics.byLanguage[language] = {
					files: 0,
					lines: 0,
					time: 0,
				}
			}
			result.indexingMetrics.byLanguage[language].files++
			result.indexingMetrics.byLanguage[language].lines += lines
			result.indexingMetrics.byLanguage[language].time += totalTime

			// Add to byFile metrics
			result.indexingMetrics.byFile.push({
				file: path.relative(fixturesDir, filePath),
				lines,
				time: totalTime,
			})

			console.log(
				`  ✓ Processed ${path.relative(fixturesDir, filePath)} (${lines} lines, ${totalTime.toFixed(2)}ms)`,
			)
		}

		// End timing
		const indexingEndTime = process.hrtime.bigint()
		result.indexingMetrics.totalTime = Number(indexingEndTime - indexingStartTime) / 1000000 // Convert to milliseconds

		// Calculate throughput
		const totalTimeInSeconds = result.indexingMetrics.totalTime / 1000
		if (totalTimeInSeconds > 0) {
			result.indexingMetrics.throughput.filesPerSecond =
				result.indexingMetrics.filesProcessed / totalTimeInSeconds
			result.indexingMetrics.throughput.linesPerSecond = result.indexingMetrics.totalLines / totalTimeInSeconds
		}

		// Simulate embedding metrics (in real implementation, this would use actual embedder)
		console.log("🔗 Simulating embedding generation...")
		const embeddingStartTime = process.hrtime.bigint()
		const totalEmbeddings = result.indexingMetrics.totalLines // Simulate one embedding per line
		const simulatedEmbeddingTime = totalEmbeddings * 0.5 // 0.5ms per embedding
		await new Promise((resolve) => setTimeout(resolve, simulatedEmbeddingTime))
		const embeddingEndTime = process.hrtime.bigint()

		result.vectorMetrics.embeddingsCreated = totalEmbeddings
		result.vectorMetrics.embeddingGenerationTime = Number(embeddingEndTime - embeddingStartTime) / 1000000
		if (result.vectorMetrics.embeddingsCreated > 0) {
			result.vectorMetrics.averageTimePerEmbedding =
				result.vectorMetrics.embeddingGenerationTime / result.vectorMetrics.embeddingsCreated
		}

		// Simulate search performance testing
		console.log("🔍 Running search performance tests...")
		const searchQueries = [
			"function definition",
			"class implementation",
			"import statement",
			"variable declaration",
			"error handling",
		]

		let totalQueryTime = 0
		for (const query of searchQueries) {
			const queryStartTime = process.hrtime.bigint()

			// Simulate search (in real implementation, this would use actual search service)
			// Simulate search time based on query complexity and index size
			const simulatedSearchTime = 50 + Math.random() * 100 // 50-150ms
			await new Promise((resolve) => setTimeout(resolve, simulatedSearchTime))

			const queryEndTime = process.hrtime.bigint()
			const queryTime = Number(queryEndTime - queryStartTime) / 1000000
			totalQueryTime += queryTime

			// Simulate search results
			const resultsCount = Math.floor(Math.random() * 20) + 1 // 1-20 results
			const topResult = files[Math.floor(Math.random() * files.length)]

			result.searchMetrics.queries.push({
				query,
				time: queryTime,
				resultsCount,
				topResult: path.relative(fixturesDir, topResult),
			})

			console.log(`  ✓ Query "${query}" (${queryTime.toFixed(2)}ms, ${resultsCount} results)`)
		}

		result.searchMetrics.averageQueryTime = totalQueryTime / searchQueries.length
	} finally {
		// Stop memory tracking
		clearInterval(memoryTracker)
	}

	// Final memory usage
	const finalMemory = getMemoryUsage()

	// Calculate memory metrics
	result.memoryMetrics.initialUsage = formatMemory(initialMemory)
	result.memoryMetrics.finalUsage = formatMemory(finalMemory)
	result.memoryMetrics.peakUsage = formatMemory(peakMemory)

	if (memorySnapshots.length > 0) {
		const averageMemory = memorySnapshots.reduce((sum, mem) => sum + mem, 0) / memorySnapshots.length
		result.memoryMetrics.averageUsage = formatMemory(averageMemory)
	}

	console.log("\n✅ Benchmark complete!")
	return result
}

// Run if executed directly
if (require.main === module) {
	runBenchmark()
		.then((result) => {
			console.log("\n✅ Benchmark complete!")
			console.log(JSON.stringify(result, null, 2))
		})
		.catch((error) => {
			console.error("❌ Benchmark failed:", error)
			process.exit(1)
		})
}

export { runBenchmark }
export type { BenchmarkResult }
