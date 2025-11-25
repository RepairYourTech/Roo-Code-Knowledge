const fs = require("fs")
const path = require("path")

// Test file size limits
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

function checkFileSizes(dir, maxSize) {
	let largeFiles = []
	let totalFiles = 0
	let totalSize = 0

	function scanDir(currentDir) {
		const items = fs.readdirSync(currentDir)

		for (const item of items) {
			const fullPath = path.join(currentDir, item)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				// Skip ignored directories
				if (!["node_modules", ".git", "dist", "out", ".next", "coverage"].includes(item)) {
					scanDir(fullPath)
				}
			} else if (stat.isFile()) {
				// Check only code files
				const ext = path.extname(item)
				if (
					[
						".ts",
						".js",
						".tsx",
						".jsx",
						".py",
						".rs",
						".go",
						".c",
						".cpp",
						".java",
						".php",
						".md",
						".markdown",
					].includes(ext)
				) {
					totalFiles++
					totalSize += stat.size

					if (stat.size > maxSize) {
						largeFiles.push({
							path: fullPath,
							size: stat.size,
							sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
						})
					}
				}
			}
		}
	}

	scanDir(dir)

	return { largeFiles, totalFiles, totalSize }
}

const workspacePath = __dirname
console.log(`Checking file sizes in: ${workspacePath}`)
console.log(`Max file size: ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(2)}MB\n`)

const result = checkFileSizes(workspacePath, MAX_FILE_SIZE_BYTES)

console.log(`\nTotal code files: ${result.totalFiles}`)
console.log(`Total size: ${(result.totalSize / (1024 * 1024)).toFixed(2)}MB`)
console.log(`Average file size: ${(result.totalSize / result.totalFiles / 1024).toFixed(2)}KB`)

if (result.largeFiles.length > 0) {
	console.log(`\nFiles exceeding size limit (${result.largeFiles.length}):`)
	result.largeFiles.forEach((file) => {
		console.log(`  ${file.path.replace(workspacePath, ".")} - ${file.sizeMB}MB`)
	})
} else {
	console.log("\nNo files exceed the size limit")
}

// Check for empty or very small files that might be skipped
function checkSmallFiles(dir, minSize = 10) {
	let smallFiles = []

	function scanDir(currentDir) {
		const items = fs.readdirSync(currentDir)

		for (const item of items) {
			const fullPath = path.join(currentDir, item)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				if (!["node_modules", ".git", "dist", "out", ".next", "coverage"].includes(item)) {
					scanDir(fullPath)
				}
			} else if (stat.isFile()) {
				const ext = path.extname(item)
				if ([".ts", ".js", ".tsx", ".jsx", ".py", ".rs", ".go", ".c", ".cpp", ".java", ".php"].includes(ext)) {
					if (stat.size < minSize) {
						smallFiles.push({
							path: fullPath,
							size: stat.size,
						})
					}
				}
			}
		}
	}

	scanDir(dir)
	return smallFiles
}

const smallFiles = checkSmallFiles(workspacePath)
if (smallFiles.length > 0) {
	console.log(`\nVery small files (<${10} bytes) that might be skipped (${smallFiles.length}):`)
	smallFiles.slice(0, 10).forEach((file) => {
		console.log(`  ${file.path.replace(workspacePath, ".")} - ${file.size} bytes`)
	})
	if (smallFiles.length > 10) {
		console.log(`  ... and ${smallFiles.length - 10} more`)
	}
}
