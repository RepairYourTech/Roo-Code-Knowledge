const path = require("path")
const fs = require("fs")

// Simulate the complete filtering pipeline
const workspacePath = __dirname

// Constants from the codebase
const DIRS_TO_IGNORE = [
	"node_modules",
	"__pycache__",
	"env",
	"venv",
	"target/dependency",
	"build/dependencies",
	"dist",
	"out",
	"bundle",
	"vendor",
	"tmp",
	"temp",
	"deps",
	"pkg",
	"Pods",
	".git",
	".idea",
	".vs",
	".vscode-test",
	".history",
	".cache",
	".next",
	".nuxt",
	".gradle",
	".terraform",
	".yarn",
	".pnpm-store",
	".svn",
	".hg",
]

const scannerExtensions = [
	".tla",
	".js",
	".jsx",
	".ts",
	".vue",
	".tsx",
	".py",
	".rs",
	".go",
	".c",
	".h",
	".cpp",
	".hpp",
	".cs",
	".rb",
	".java",
	".php",
	".swift",
	".sol",
	".kt",
	".kts",
	".ex",
	".exs",
	".el",
	".html",
	".htm",
	".md",
	".markdown",
	".json",
	".css",
	".rdl",
	".ml",
	".mli",
	".lua",
	".scala",
	".toml",
	".zig",
	".elm",
	".ejs",
	".erb",
	".vb",
]

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 // 1MB

// Helper functions from the codebase
function isPathInIgnoredDirectory(filePath) {
	const normalizedPath = filePath.replace(/\\/g, "/")
	const pathParts = normalizedPath.split("/")

	for (const part of pathParts) {
		if (!part) continue
		if (DIRS_TO_IGNORE.includes(part)) {
			return true
		}
	}

	for (const dir of DIRS_TO_IGNORE) {
		if (normalizedPath.includes(`/${dir}/`)) {
			return true
		}
	}

	return false
}

function generateRelativeFilePath(filePath, basePath) {
	return path.relative(basePath, filePath).replace(/\\/g, "/")
}

// Read .gitignore patterns
function readGitignorePatterns(dirPath) {
	const gitignorePath = path.join(dirPath, ".gitignore")
	if (!fs.existsSync(gitignorePath)) return []

	const content = fs.readFileSync(gitignorePath, "utf8")
	return content
		.split("\n")
		.filter((line) => line.trim() && !line.startsWith("#"))
		.map((line) => line.trim())
}

// Simple ignore check (basic implementation)
function isIgnoredByGitignore(relativePath, patterns) {
	for (const pattern of patterns) {
		if (pattern === relativePath || relativePath.startsWith(pattern)) {
			return true
		}
	}
	return false
}

// Main test function
function testFilteringPipeline() {
	console.log("=== File Discovery and Filtering Pipeline Test ===\n")

	// Step 1: Discover all files
	console.log("Step 1: Discovering all files...")
	let allFiles = []

	function scanDir(dir, relativeTo = workspacePath) {
		const items = fs.readdirSync(dir)

		for (const item of items) {
			const fullPath = path.join(dir, item)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				scanDir(fullPath, relativeTo)
			} else if (stat.isFile()) {
				allFiles.push({
					path: fullPath,
					relativePath: generateRelativeFilePath(fullPath, relativeTo),
					size: stat.size,
					ext: path.extname(item).toLowerCase(),
				})
			}
		}
	}

	scanDir(workspacePath)
	console.log(`  Discovered ${allFiles.length} total files`)

	// Step 2: Filter directories (get only files)
	console.log("\nStep 2: Filtering out directories...")
	const filePaths = allFiles.filter((f) => !f.path.endsWith("/"))
	console.log(`  ${filePaths.length} files after directory filtering`)

	// Step 3: Apply .rooignore filtering
	console.log("\nStep 3: Applying .rooignore filtering...")
	const rooignorePath = path.join(workspacePath, ".rooignore")
	let rooignorePatterns = []
	if (fs.existsSync(rooignorePath)) {
		const content = fs.readFileSync(rooignorePath, "utf8")
		rooignorePatterns = content.split("\n").filter((p) => p.trim())
	}

	const allowedPaths = filePaths.filter((f) => {
		for (const pattern of rooignorePatterns) {
			if (f.relativePath.includes(pattern)) {
				return false
			}
		}
		return true
	})
	console.log(`  ${allowedPaths.length} files after .rooignore filtering`)

	// Step 4: Apply extension and directory filtering
	console.log("\nStep 4: Applying extension and directory filtering...")
	const supportedPaths = allowedPaths.filter((f) => {
		// Check if in ignored directory
		if (isPathInIgnoredDirectory(f.path)) {
			return false
		}

		// Check extension
		return scannerExtensions.includes(f.ext)
	})
	console.log(`  ${supportedPaths.length} files after extension and directory filtering`)

	// Step 5: Apply file size filtering
	console.log("\nStep 5: Applying file size filtering...")
	const finalPaths = supportedPaths.filter((f) => f.size <= MAX_FILE_SIZE_BYTES)
	console.log(`  ${finalPaths.length} files after size filtering`)

	// Summary by extension
	console.log("\n=== Final File Count by Extension ===")
	const byExt = {}
	for (const f of finalPaths) {
		if (!byExt[f.ext]) byExt[f.ext] = []
		byExt[f.ext].push(f)
	}

	for (const [ext, files] of Object.entries(byExt).sort((a, b) => b[1].length - a[1].length)) {
		console.log(`${ext}: ${files.length} files`)
		if (ext === ".ts" || ext === ".js" || ext === ".tsx" || ext === ".jsx") {
			files.slice(0, 5).forEach((f) => console.log(`  ${f.relativePath}`))
			if (files.length > 5) console.log(`  ... and ${files.length - 5} more`)
		}
	}

	// Check what was filtered out at each step
	console.log("\n=== Filtering Analysis ===")

	// Files filtered by directory
	const dirFiltered = filePaths.filter((f) => isPathInIgnoredDirectory(f.path))
	if (dirFiltered.length > 0) {
		console.log(`\nFiles filtered by directory (${dirFiltered.length}):`)
		const dirs = {}
		for (const f of dirFiltered) {
			const dir = path.dirname(f.relativePath).split("/")[0]
			if (!dirs[dir]) dirs[dir] = 0
			dirs[dir]++
		}
		for (const [dir, count] of Object.entries(dirs)) {
			console.log(`  ${dir}/: ${count} files`)
		}
	}

	// Files filtered by extension
	const extFiltered = allowedPaths.filter(
		(f) => !isPathInIgnoredDirectory(f.path) && !scannerExtensions.includes(f.ext),
	)
	if (extFiltered.length > 0) {
		console.log(`\nFiles filtered by extension (${extFiltered.length}):`)
		const exts = {}
		for (const f of extFiltered) {
			if (!exts[f.ext]) exts[f.ext] = 0
			exts[f.ext]++
		}
		for (const [ext, count] of Object.entries(exts).sort((a, b) => b[1] - a[1])) {
			console.log(`  ${ext}: ${count} files`)
		}
	}

	// Files filtered by size
	const sizeFiltered = supportedPaths.filter((f) => f.size > MAX_FILE_SIZE_BYTES)
	if (sizeFiltered.length > 0) {
		console.log(`\nFiles filtered by size (${sizeFiltered.length}):`)
		sizeFiltered.forEach((f) => {
			console.log(`  ${f.relativePath}: ${(f.size / (1024 * 1024)).toFixed(2)}MB`)
		})
	}

	return {
		totalFiles: allFiles.length,
		afterDirFilter: filePaths.length,
		afterRooignore: allowedPaths.length,
		afterExtension: supportedPaths.length,
		afterSize: finalPaths.length,
	}
}

// Run the test
const results = testFilteringPipeline()

console.log("\n=== Summary ===")
console.log(`Total files discovered: ${results.totalFiles}`)
console.log(`After directory filtering: ${results.afterDirFilter}`)
console.log(`After .rooignore filtering: ${results.afterRooignore}`)
console.log(`After extension filtering: ${results.afterExtension}`)
console.log(`After size filtering: ${results.afterSize}`)
console.log(`Final files that would be indexed: ${results.afterSize}`)
