const path = require("path")
const fs = require("fs")

// Simulate the file discovery process
async function testFileDiscovery() {
	const workspacePath = __dirname
	console.log(`Testing file discovery in: ${workspacePath}`)

	// Get all TypeScript and JavaScript files recursively
	function findFiles(dir, extensions, results = []) {
		const files = fs.readdirSync(dir)

		for (const file of files) {
			const fullPath = path.join(dir, file)
			const stat = fs.statSync(fullPath)

			if (stat.isDirectory()) {
				// Skip certain directories
				if (!["node_modules", ".git", "dist", "out", "coverage"].includes(file)) {
					findFiles(fullPath, extensions, results)
				}
			} else if (stat.isFile()) {
				const ext = path.extname(file)
				if (extensions.includes(ext)) {
					results.push(fullPath)
				}
			}
		}

		return results
	}

	// Test with common code file extensions
	const codeExtensions = [".ts", ".js", ".tsx", ".jsx", ".py", ".rs", ".go", ".c", ".cpp", ".java", ".php"]
	const allCodeFiles = findFiles(workspacePath, codeExtensions)

	console.log(`\nFound ${allCodeFiles.length} code files total:`)

	// Group by extension
	const byExt = {}
	for (const file of allCodeFiles) {
		const ext = path.extname(file)
		if (!byExt[ext]) byExt[ext] = []
		byExt[ext].push(file)
	}

	for (const [ext, files] of Object.entries(byExt)) {
		console.log(`\n${ext} (${files.length} files):`)
		files.slice(0, 10).forEach((f) => console.log(`  ${f.replace(workspacePath, ".")}`))
		if (files.length > 10) console.log(`  ... and ${files.length - 10} more`)
	}

	// Check for specific directories that might be filtered
	console.log("\n\nChecking files in key directories:")
	const keyDirs = ["src", "packages", "apps"]

	for (const dir of keyDirs) {
		const dirPath = path.join(workspacePath, dir)
		if (fs.existsSync(dirPath)) {
			const dirFiles = findFiles(dirPath, codeExtensions)
			console.log(`\n${dir}/ (${dirFiles.length} code files):`)
			dirFiles.slice(0, 5).forEach((f) => console.log(`  ${f.replace(workspacePath, ".")}`))
			if (dirFiles.length > 5) console.log(`  ... and ${dirFiles.length - 5} more`)
		}
	}

	// Check what would be filtered by DIRS_TO_IGNORE
	console.log("\n\nDirectories that would be ignored by DIRS_TO_IGNORE:")
	const dirsToIgnore = [
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

	function findDirs(dir, results = []) {
		const items = fs.readdirSync(dir)
		for (const item of items) {
			const fullPath = path.join(dir, item)
			const stat = fs.statSync(fullPath)
			if (stat.isDirectory()) {
				if (dirsToIgnore.includes(item)) {
					results.push(fullPath.replace(workspacePath, "."))
				} else {
					findDirs(fullPath, results)
				}
			}
		}
		return results
	}

	const ignoredDirs = findDirs(workspacePath)
	if (ignoredDirs.length > 0) {
		ignoredDirs.forEach((d) => console.log(`  ${d}`))
	} else {
		console.log("  None of the ignored directories found in workspace")
	}
}

testFileDiscovery().catch(console.error)
