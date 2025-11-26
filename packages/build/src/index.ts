import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
import chokidar, { FSWatcher } from "chokidar"

/**
 * Copies files from source to destination with optional flag support
 * @param paths - Array of file paths to copy
 * @param srcDir - Source directory base path
 * @param buildDir - Build directory base path
 * @param optional - If true, doesn't throw when files are missing
 */
export async function copyPaths(
	paths: string[],
	srcDir: string,
	buildDir: string,
	optional: boolean = false,
): Promise<void> {
	console.log(`[copyPaths] Starting to copy ${paths.length} files from ${srcDir} to ${buildDir}`)

	for (const relativePath of paths) {
		const srcPath = path.join(srcDir, relativePath)
		const destPath = path.join(buildDir, relativePath)
		const destDir = path.dirname(destPath)

		try {
			// Ensure destination directory exists
			await fs.mkdir(destDir, { recursive: true })

			// Copy the file
			await fs.copyFile(srcPath, destPath)
			console.log(`[copyPaths] Copied: ${relativePath}`)
		} catch (error) {
			if (optional) {
				console.log(`[copyPaths] Optional file not found: ${relativePath}`)
				continue
			}
			throw new Error(`Failed to copy ${relativePath}: ${error}`)
		}
	}

	console.log(`[copyPaths] Completed copying ${paths.length} files`)
}

/**
 * Copies WASM files from src/services/tree-sitter/ to dist/services/tree-sitter/
 * @param srcDir - Source directory path
 * @param distDir - Distribution directory path
 * @returns boolean indicating success
 */
export async function copyWasms(srcDir: string, distDir: string): Promise<boolean> {
	const wasmSrcDir = path.join(srcDir, "services", "tree-sitter")
	const wasmDistDir = path.join(distDir, "services", "tree-sitter")

	console.log(`[copyWasms] Starting WASM copy from ${wasmSrcDir} to ${wasmDistDir}`)

	try {
		// Check if source directory exists
		try {
			await fs.access(wasmSrcDir)
		} catch {
			console.log(`[copyWasms] Source directory does not exist: ${wasmSrcDir}`)
			return false
		}

		// Read the source directory
		const entries = await fs.readdir(wasmSrcDir, { withFileTypes: true })
		const wasmFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".wasm"))

		if (wasmFiles.length === 0) {
			console.log(`[copyWasms] No WASM files found in ${wasmSrcDir}`)
			return false
		}

		// Create destination directory
		await fs.mkdir(wasmDistDir, { recursive: true })

		// Copy each WASM file
		for (const wasmFile of wasmFiles) {
			const srcPath = path.join(wasmSrcDir, wasmFile.name)
			const destPath = path.join(wasmDistDir, wasmFile.name)

			await fs.copyFile(srcPath, destPath)

			// Get file size for logging
			const stats = await fs.stat(srcPath)
			const sizeKB = (stats.size / 1024).toFixed(2)

			console.log(`[copyWasms] Copied ${wasmFile.name} (${sizeKB} KB)`)
		}

		console.log(`[copyWasms] Successfully copied ${wasmFiles.length} WASM files`)
		return true
	} catch (error) {
		console.error(`[copyWasms] Error copying WASM files:`, error)
		return false
	}
}

/**
 * Copies locale files from ../locales/ to dist/locales/
 * @param srcDir - Source directory path
 * @param distDir - Distribution directory path
 */
export async function copyLocales(srcDir: string, distDir: string): Promise<void> {
	const localesSrcDir = path.join(srcDir, "..", "locales")
	const localesDistDir = path.join(distDir, "locales")

	console.log(`[copyLocales] Starting locale copy from ${localesSrcDir} to ${localesDistDir}`)

	try {
		// Check if source directory exists
		try {
			await fs.access(localesSrcDir)
		} catch {
			console.log(`[copyLocales] Source directory does not exist: ${localesSrcDir}`)
			return
		}

		// Create destination directory
		await fs.mkdir(localesDistDir, { recursive: true })

		// Read the source directory
		const entries = await fs.readdir(localesSrcDir, { withFileTypes: true })

		let copiedCount = 0
		for (const entry of entries) {
			if (entry.isFile()) {
				const srcPath = path.join(localesSrcDir, entry.name)
				const destPath = path.join(localesDistDir, entry.name)

				await fs.copyFile(srcPath, destPath)
				console.log(`[copyLocales] Copied: ${entry.name}`)
				copiedCount++
			}
		}

		console.log(`[copyLocales] Successfully copied ${copiedCount} locale files`)
	} catch (error) {
		console.error(`[copyLocales] Error copying locale files:`, error)
		throw error
	}
}

/**
 * Sets up file watcher for locale files using chokidar
 * @param srcDir - Source directory path
 * @param distDir - Distribution directory path
 * @returns chokidar.FSWatcher instance
 */
export function setupLocaleWatcher(srcDir: string, distDir: string): FSWatcher {
	const localesSrcDir = path.join(srcDir, "..", "locales")
	const localesDistDir = path.join(distDir, "locales")

	console.log(`[setupLocaleWatcher] Setting up watcher for ${localesSrcDir}`)

	const watcher = chokidar.watch(localesSrcDir, {
		ignored: /(^|[\/\\\\])\../, // ignore dotfiles
		persistent: true,
		ignoreInitial: true,
	})

	watcher.on("change", async (filePath: string) => {
		const fileName = path.basename(filePath)
		const destPath = path.join(localesDistDir, fileName)

		try {
			await fs.mkdir(localesDistDir, { recursive: true })
			await fs.copyFile(filePath, destPath)
			console.log(`[setupLocaleWatcher] Updated: ${fileName}`)
		} catch (error) {
			console.error(`[setupLocaleWatcher] Error updating ${fileName}:`, error)
		}
	})

	watcher.on("add", async (filePath: string) => {
		const fileName = path.basename(filePath)
		const destPath = path.join(localesDistDir, fileName)

		try {
			await fs.mkdir(localesDistDir, { recursive: true })
			await fs.copyFile(filePath, destPath)
			console.log(`[setupLocaleWatcher] Added: ${fileName}`)
		} catch (error) {
			console.error(`[setupLocaleWatcher] Error adding ${fileName}:`, error)
		}
	})

	console.log(`[setupLocaleWatcher] Watcher setup complete`)
	return watcher
}

/**
 * Returns current git commit SHA
 * @returns git commit SHA string
 */
export function getGitSha(): string {
	try {
		const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
		console.log(`[getGitSha] Retrieved git SHA: ${sha}`)
		return sha
	} catch (error) {
		console.error(`[getGitSha] Error getting git SHA:`, error)
		return "unknown"
	}
}

/**
 * Generates modified package.json for nightly builds
 * @param options - Configuration options
 * @param options.packageJson - The original package.json object
 * @param options.overrideJson - Object with overrides to apply
 * @param options.substitution - Version suffix string (default: '-nightly')
 * @returns Modified package.json object
 */
export function generatePackageJson(options: {
	packageJson: Record<string, any>
	overrideJson?: Record<string, any>
	substitution?: string | string[]
}): Record<string, any> {
	const { packageJson, overrideJson, substitution = "-nightly" } = options

	console.log(`[generatePackageJson] Generating modified package.json with substitution: ${substitution}`)

	try {
		// Start with the original package.json
		const modifiedPackageJson = { ...packageJson }

		// Apply overrides if provided
		if (overrideJson) {
			Object.assign(modifiedPackageJson, overrideJson)
			console.log(`[generatePackageJson] Applied overrides: ${JSON.stringify(overrideJson)}`)
		}

		// Modify version if present
		if (modifiedPackageJson.version) {
			// Handle substitution that might be an array [from, to] for string replacement
			if (Array.isArray(substitution) && substitution.length === 2) {
				const [from, to] = substitution
				modifiedPackageJson.version = modifiedPackageJson.version.replace(from, to)
				console.log(
					`[generatePackageJson] Updated version from ${from} to ${to}: ${modifiedPackageJson.version}`,
				)
			} else {
				modifiedPackageJson.version = `${modifiedPackageJson.version}${substitution}`
				console.log(`[generatePackageJson] Updated version to: ${modifiedPackageJson.version}`)
			}
		}

		console.log(`[generatePackageJson] Successfully generated modified package.json`)
		return modifiedPackageJson
	} catch (error) {
		console.error(`[generatePackageJson] Error generating package.json:`, error)
		throw error
	}
}
