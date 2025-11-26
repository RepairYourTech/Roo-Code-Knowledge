import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"
import { glob } from "glob"
import * as mkdirp from "mkdirp"

import { ViewsContainer, Views, Menus, Configuration, Keybindings, contributesSchema } from "./types.js"

function copyDir(srcDir: string, dstDir: string, count: number): number {
	const entries = fs.readdirSync(srcDir, { withFileTypes: true })

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name)
		const dstPath = path.join(dstDir, entry.name)

		if (entry.isDirectory()) {
			fs.mkdirSync(dstPath, { recursive: true })
			count = copyDir(srcPath, dstPath, count)
		} else {
			count = count + 1
			fs.copyFileSync(srcPath, dstPath)
		}
	}

	return count
}

function rmDir(dirPath: string, maxRetries: number = 5): void {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			fs.rmSync(dirPath, { recursive: true, force: true })
			return
		} catch (error) {
			const isLastAttempt = attempt === maxRetries

			const isRetryableError =
				error instanceof Error &&
				"code" in error &&
				(error.code === "ENOTEMPTY" ||
					error.code === "EBUSY" ||
					error.code === "EPERM" ||
					error.code === "EACCES")

			if (isLastAttempt) {
				// On the last attempt, try alternative cleanup methods.
				try {
					console.warn(`[rmDir] Final attempt using alternative cleanup for ${dirPath}`)

					// Try to clear readonly flags on Windows.
					if (process.platform === "win32") {
						try {
							execSync(`attrib -R "${dirPath}\\*.*" /S /D`, { stdio: "ignore" })
						} catch {
							// Ignore attrib errors.
						}
					}
					fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
					return
				} catch (finalError) {
					console.error(`[rmDir] Failed to remove ${dirPath} after ${maxRetries} attempts:`, finalError)
					throw finalError
				}
			}

			if (!isRetryableError) {
				throw error // Re-throw if it's not a retryable error.
			}

			// Wait with exponential backoff before retrying, with longer delays for Windows.
			const baseDelay = process.platform === "win32" ? 200 : 100
			const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 2000) // Cap at 2s
			console.warn(`[rmDir] Attempt ${attempt} failed for ${dirPath}, retrying in ${delay}ms...`)

			// Synchronous sleep for simplicity in build scripts.
			const start = Date.now()

			while (Date.now() - start < delay) {
				/* Busy wait */
			}
		}
	}
}

type CopyPathOptions = {
	optional?: boolean
}

export function copyPaths(copyPaths: [string, string, CopyPathOptions?][], srcDir: string, dstDir: string) {
	copyPaths.forEach(([srcRelPath, dstRelPath, options = {}]) => {
		try {
			const stats = fs.lstatSync(path.join(srcDir, srcRelPath))

			if (stats.isDirectory()) {
				if (fs.existsSync(path.join(dstDir, dstRelPath))) {
					rmDir(path.join(dstDir, dstRelPath))
				}

				fs.mkdirSync(path.join(dstDir, dstRelPath), { recursive: true })

				const count = copyDir(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath), 0)
				console.log(`[copyPaths] Copied ${count} files from ${srcRelPath} to ${dstRelPath}`)
			} else {
				fs.copyFileSync(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath))
				console.log(`[copyPaths] Copied ${srcRelPath} to ${dstRelPath}`)
			}
		} catch (error) {
			if (options.optional) {
				console.warn(`[copyPaths] Optional file not found: ${srcRelPath}`)
			} else {
				throw error
			}
		}
	})
}
interface WasmSource {
	/** Directory name in node_modules */
	dirName: string
	/** Glob pattern to find WASM files relative to the directory */
	pattern: string
	/** Destination directory (relative to distDir) */
	destination: string
	/** Whether this WASM source is optional (logs error and continues) or required (throws) */
	isOptional?: boolean
}

export function copyWasms(srcDir: string, distDir: string): boolean {
	const nodeModulesDir = path.join(srcDir, "node_modules")
	let hasErrors = false

	// Define WASM sources to copy
	const wasmSources: WasmSource[] = [
		{
			dirName: "tree-sitter-wasms",
			pattern: "out/*.wasm",
			destination: "services/tree-sitter",
			isOptional: false, // tree-sitter-wasms is required for core functionality
		},
		{
			dirName: "web-tree-sitter",
			pattern: "tree-sitter.wasm",
			destination: "services/tree-sitter",
			isOptional: true, // web-tree-sitter can be optional as a fallback
		},
		{
			dirName: "tiktoken",
			pattern: "tiktoken_bg.wasm",
			destination: "", // root of dist directory
			isOptional: true, // tiktoken is optional for tokenization functionality
		},
	]

	for (const source of wasmSources) {
		const sourceDir = path.join(nodeModulesDir, source.dirName)

		if (!fs.existsSync(sourceDir)) {
			const message = `[copyWasms] Source directory not found: ${sourceDir}`
			if (source.isOptional) {
				console.error(message)
				continue
			} else {
				const error = new Error(
					`${message}. This directory is required for the build to succeed. Please ensure the ${source.dirName} package is installed.`,
				)
				throw error
			}
		}

		// Create destination directory if needed
		const destDir = path.join(distDir, source.destination)
		const existed = fs.existsSync(destDir)
		mkdirp.sync(destDir)
		if (!existed) {
			console.log(`[copyWasms] Created directory: ${destDir}`)
		}

		try {
			const wasmFiles = glob.sync(source.pattern, { cwd: sourceDir })

			if (wasmFiles.length === 0) {
				const message = `[copyWasms] No WASM files found in ${sourceDir} matching pattern "${source.pattern}"`
				if (source.isOptional) {
					console.warn(message)
					continue
				} else {
					throw new Error(`${message}. This may indicate a corrupted installation of ${source.dirName}.`)
				}
			}

			for (const wasmFile of wasmFiles) {
				const srcPath = path.join(sourceDir, wasmFile)
				const destPath = path.join(destDir, path.basename(wasmFile))

				// Check if file already exists from a previous source
				if (fs.existsSync(destPath)) {
					console.warn(`[copyWasms] Warning: Overwriting existing file at ${destPath}`)
				}

				try {
					fs.copyFileSync(srcPath, destPath)
					console.log(`[copyWasms] Copied: ${srcPath} -> ${destPath}`)

					// Verify the file was copied successfully
					if (fs.existsSync(destPath)) {
						const srcStats = fs.statSync(srcPath)
						const destStats = fs.statSync(destPath)
						if (srcStats.size === destStats.size) {
							console.log(`[copyWasms] Verified: ${destPath} (${destStats.size} bytes)`)
						} else {
							const errorMessage = `[copyWasms] Verification failed: Size mismatch for ${destPath} (expected: ${srcStats.size}, actual: ${destStats.size})`
							if (source.isOptional) {
								console.error(errorMessage)
								hasErrors = true
							} else {
								throw new Error(errorMessage)
							}
						}
					} else {
						const errorMessage = `[copyWasms] Verification failed: File not found at ${destPath} after copy`
						if (source.isOptional) {
							console.error(errorMessage)
							hasErrors = true
						} else {
							throw new Error(errorMessage)
						}
					}
				} catch (error) {
					const errorMessage = `[copyWasms] Failed to copy ${srcPath} to ${destPath}: ${error instanceof Error ? error.message : "Unknown error"}`
					if (source.isOptional) {
						console.error(errorMessage)
						hasErrors = true
					} else {
						throw new Error(errorMessage)
					}
				}
			}

			console.log(`[copyWasms] Copied ${wasmFiles.length} WASM files from ${source.dirName}`)
		} catch (error) {
			if (error instanceof Error) {
				throw error
			}
			const errorMessage = `[copyWasms] Unexpected error processing ${source.dirName}: ${error}`
			if (source.isOptional) {
				console.error(errorMessage)
				hasErrors = true
			} else {
				throw new Error(errorMessage)
			}
		}
	}

	return !hasErrors // Return success status
}

export function copyLocales(srcDir: string, distDir: string): void {
	const srcLocaleDir = path.join(srcDir, "i18n", "locales")
	const destDir = path.join(distDir, "i18n", "locales")

	if (!fs.existsSync(srcLocaleDir)) {
		console.warn(`[copyLocales] Source locale directory does not exist: ${srcLocaleDir}`)
		return
	}

	// Create destination directory
	mkdirp.sync(destDir)
	console.log(`[copyLocales] Created directory: ${destDir}`)

	// Copy locale files preserving directory structure
	const count = copyDir(srcLocaleDir, destDir, 0)
	console.log(`[copyLocales] Copied ${count} locale files from ${srcLocaleDir} to ${destDir}`)
}

export function setupLocaleWatcher(srcDir: string, distDir: string): void {
	const localesDir = path.join(srcDir, "i18n", "locales")

	if (!fs.existsSync(localesDir)) {
		console.warn(
			`[setupLocaleWatcher] Cannot set up watcher: Source locales directory does not exist: ${localesDir}`,
		)
		return
	}

	console.log(`[setupLocaleWatcher] Setting up watcher for locale files in ${localesDir}`)

	let debounceTimer: NodeJS.Timeout | null = null

	const debouncedCopy = () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer)
		}

		// Wait 300ms after last change before copying.
		debounceTimer = setTimeout(() => {
			console.log("[setupLocaleWatcher] Locale files changed, copying...")
			copyLocales(srcDir, distDir)
		}, 300)
	}

	try {
		fs.watch(localesDir, { recursive: true }, (_eventType, filename) => {
			if (filename && (filename.endsWith(".json") || filename.endsWith(".md"))) {
				console.log(`[setupLocaleWatcher] Locale file ${filename} changed, triggering copy...`)
				debouncedCopy()
			}
		})
		console.log("[setupLocaleWatcher] Watcher for locale files is set up")
	} catch (error) {
		console.error(
			`[setupLocaleWatcher] Error setting up watcher for ${localesDir}:`,
			error instanceof Error ? error.message : "Unknown error",
		)
	}
}

export function generatePackageJson({
	packageJson: { contributes, ...packageJson },
	overrideJson,
	substitution,
}: {
	packageJson: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
	overrideJson: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
	substitution: [string, string]
}) {
	const { viewsContainers, views, commands, menus, submenus, keybindings, configuration } =
		contributesSchema.parse(contributes)
	const [from, to] = substitution

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result: Record<string, any> = {
		...packageJson,
		...overrideJson,
		contributes: {
			viewsContainers: transformArrayRecord<ViewsContainer>(viewsContainers, from, to, ["id"]),
			views: transformArrayRecord<Views>(views, from, to, ["id"]),
			commands: transformArray(commands, from, to, "command"),
			menus: transformArrayRecord<Menus>(menus, from, to, ["command", "submenu", "when"]),
			submenus: transformArray(submenus, from, to, "id"),
			configuration: {
				title: configuration.title,
				properties: transformRecord<Configuration["properties"]>(configuration.properties, from, to),
			},
		},
	}

	// Only add keybindings if they exist
	if (keybindings) {
		result.contributes.keybindings = transformArray<Keybindings>(keybindings, from, to, "command")
	}

	return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformArrayRecord<T>(obj: Record<string, any[]>, from: string, to: string, props: string[]): T {
	return Object.entries(obj).reduce(
		(acc, [key, ary]) => ({
			...acc,
			[key.replaceAll(from, to)]: ary.map((item) => {
				const transformedItem = { ...item }

				for (const prop of props) {
					if (prop in item && typeof item[prop] === "string") {
						transformedItem[prop] = item[prop].replaceAll(from, to)
					}
				}

				return transformedItem
			}),
		}),
		{} as T,
	)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformArray<T>(arr: any[], from: string, to: string, idProp: string): T[] {
	return arr.map(({ [idProp]: id, ...rest }) => ({
		[idProp]: id.replaceAll(from, to),
		...rest,
	}))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformRecord<T>(obj: Record<string, any>, from: string, to: string): T {
	return Object.entries(obj).reduce(
		(acc, [key, value]) => ({
			...acc,
			[key.replaceAll(from, to)]: value,
		}),
		{} as T,
	)
}
