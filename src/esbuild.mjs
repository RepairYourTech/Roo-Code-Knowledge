import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import process from "node:process"
import * as console from "node:console"

import { copyWasms, copyLocales, setupLocaleWatcher } from "@roo-code/build"
import { copyPaths as copyPathsWithDestinations } from "../packages/build/src/esbuild.ts"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = true // Always generate source maps for error handling

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(async () => {
					copyPathsWithDestinations(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
						],
						srcDir,
						buildDir,
					)
				})
			},
		},
		{
			name: "copyStaticWasms",
			setup(build) {
				build.onEnd(() => {
					console.log("[copyStaticWasms] Plugin executing - copying static WASM files")
					
					// Source and destination paths
					const treeSitterSrcDir = path.join(srcDir, "wasms", "tree-sitter")
					const treeSitterDestDir = path.join(distDir, "services", "tree-sitter")
					const tiktokenSrcPath = path.join(srcDir, "wasms", "tiktoken", "tiktoken_bg.wasm")
					const tiktokenDestPath = path.join(distDir, "tiktoken_bg.wasm")
					
					// Create destination directories
					fs.mkdirSync(treeSitterDestDir, { recursive: true })
					
					// Copy tree-sitter WASMs (required)
					if (!fs.existsSync(treeSitterSrcDir)) {
						throw new Error(`Tree-sitter WASM source directory not found: ${treeSitterSrcDir}. ` +
							`Please run 'pnpm regenerate-wasms' to download required WASM files.`)
					}
					
					const treeSitterFiles = fs.readdirSync(treeSitterSrcDir).filter(file => file.endsWith('.wasm'))
					if (treeSitterFiles.length === 0) {
						throw new Error(`No tree-sitter WASM files found in: ${treeSitterSrcDir}. ` +
							`Please run 'pnpm regenerate-wasms' to download required WASM files.`)
					}
					
					console.log(`[copyStaticWasms] Copying ${treeSitterFiles.length} tree-sitter WASM files...`)
					for (const file of treeSitterFiles) {
						const srcPath = path.join(treeSitterSrcDir, file)
						const destPath = path.join(treeSitterDestDir, file)
						
						// Verify source file exists and has content
						if (!fs.existsSync(srcPath)) {
							throw new Error(`Required tree-sitter WASM file not found: ${srcPath}`)
						}
						
						const srcStats = fs.statSync(srcPath)
						if (srcStats.size < 1024) {
							throw new Error(`Required tree-sitter WASM file too small (likely corrupted): ${srcPath} (${srcStats.size} bytes)`)
						}
						
						// Copy file
						fs.copyFileSync(srcPath, destPath)
						
						// Verify copy
						const destStats = fs.statSync(destPath)
						if (destStats.size !== srcStats.size) {
							throw new Error(`Copy verification failed for ${file}: source size ${srcStats.size} bytes, destination size ${destStats.size} bytes`)
						}
						
						const sizeKB = Math.round(destStats.size / 1024)
						console.log(`[copyStaticWasms] Copied ${file} (${sizeKB} KB)`)
					}
					
					// Copy tiktoken WASM (optional)
					if (fs.existsSync(tiktokenSrcPath)) {
						const srcStats = fs.statSync(tiktokenSrcPath)
						if (srcStats.size < 1024) {
							console.warn(`[copyStaticWasms] Skipping tiktoken WASM (too small, likely corrupted): ${tiktokenSrcPath} (${srcStats.size} bytes)`)
						} else {
							fs.copyFileSync(tiktokenSrcPath, tiktokenDestPath)
							const destStats = fs.statSync(tiktokenDestPath)
							if (destStats.size !== srcStats.size) {
								console.warn(`[copyStaticWasms] Tiktoken copy verification failed: source size ${srcStats.size} bytes, destination size ${destStats.size} bytes`)
							} else {
								const sizeKB = Math.round(destStats.size / 1024)
								console.log(`[copyStaticWasms] Copied tiktoken_bg.wasm (${sizeKB} KB)`)
							}
						}
					} else {
						console.log(`[copyStaticWasms] Optional tiktoken WASM not found at: ${tiktokenSrcPath}`)
					}
					
					console.log("[copyStaticWasms] Completed successfully")
				})
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(async () => {
					await copyLocales(srcDir, distDir)
				})
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						if (location && location.file) {
							console.error(`    ${location.file}:${location.line}:${location.column}:`)
						}
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["extension.ts"],
		outfile: "dist/extension.js",
		external: ["vscode"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	const [extensionCtx, workerCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch()])
		await copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild()])
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose()])
		
		// Verify WASM files were copied after build
		const servicesDir = path.join(distDir, "services", "tree-sitter")
		let totalSize = 0
		let wasmFiles = []
		
		if (fs.existsSync(servicesDir)) {
			wasmFiles = fs.readdirSync(servicesDir).filter(file => file.endsWith('.wasm'))
			console.log(`[build-verification] Found ${wasmFiles.length} WASM files in ${servicesDir}`)
			wasmFiles.forEach(file => {
				const filePath = path.join(servicesDir, file)
				const stats = fs.statSync(filePath)
				totalSize += stats.size
				console.log(`[build-verification] ${file} (${stats.size} bytes)`)
			})
		} else {
			console.warn(`[build-verification] WASM directory not found: ${servicesDir}`)
		}
		
		// Check for critical files
		const criticalFiles = [
			{ path: path.join(servicesDir, "tree-sitter.wasm"), name: "tree-sitter.wasm", minSize: 170000, maxSize: 210000 },
			{ path: path.join(servicesDir, "tree-sitter-javascript.wasm"), name: "tree-sitter-javascript.wasm", minSize: 100000 },
			{ path: path.join(servicesDir, "tree-sitter-typescript.wasm"), name: "tree-sitter-typescript.wasm", minSize: 100000 },
			{ path: path.join(servicesDir, "tree-sitter-python.wasm"), name: "tree-sitter-python.wasm", minSize: 100000 },
			{ path: path.join(distDir, "tiktoken_bg.wasm"), name: "tiktoken_bg.wasm", minSize: 5000000, maxSize: 6000000 },
		]
		
		let allCriticalFilesPresent = true
		for (const file of criticalFiles) {
			if (fs.existsSync(file.path)) {
				const stats = fs.statSync(file.path)
				const sizeKB = Math.round(stats.size / 1024)
				
				if (stats.size < 1024) {
					console.error(`[build-verification] ❌ Critical file too small: ${file.name} (${sizeKB} KB, likely corrupted)`)
					allCriticalFilesPresent = false
				} else if (file.minSize && stats.size < file.minSize) {
					console.error(`[build-verification] ❌ Critical file too small: ${file.name} (${sizeKB} KB, expected at least ${Math.round(file.minSize / 1024)} KB)`)
					allCriticalFilesPresent = false
				} else if (file.maxSize && stats.size > file.maxSize) {
					console.error(`[build-verification] ❌ Critical file too large: ${file.name} (${sizeKB} KB, expected at most ${Math.round(file.maxSize / 1024)} KB)`)
					allCriticalFilesPresent = false
				} else {
					console.log(`[build-verification] ✅ Critical file verified: ${file.name} (${sizeKB} KB)`)
				}
			} else {
				console.error(`[build-verification] ❌ Required critical file missing: ${file.name}`)
				allCriticalFilesPresent = false
			}
		}
		
		if (allCriticalFilesPresent) {
			const totalSizeMB = totalSize / (1024 * 1024)
			console.log(`[build-verification] ✅ All critical WASM files present (${wasmFiles.length} total, ${totalSizeMB.toFixed(2)} MB)`)
		} else {
			const totalSizeMB = totalSize / (1024 * 1024)
			console.error(`[build-verification] ❌ Build failed: Missing or invalid critical WASM files (${wasmFiles.length} found, ${totalSizeMB.toFixed(2)} MB)`)
			process.exit(1)
		}
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
