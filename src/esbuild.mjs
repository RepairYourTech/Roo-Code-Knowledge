import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import process from "node:process"
import * as console from "node:console"

import { copyPaths, copyWasms, copyLocales, setupLocaleWatcher } from "@roo-code/build"

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
					await copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons"],
							["../webview-ui/audio", "webview-ui/audio"],
						],
						srcDir,
						buildDir,
					)
				})
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				console.log("[copyWasms] Plugin registered")
				build.onEnd(async () => {
					console.log("[copyWasms] Plugin executing - copying WASM files")
					try {
						const success = await copyWasms(srcDir, distDir)
						if (!success) {
							console.warn("[copyWasms] Completed with errors for optional WASM sources")
						} else {
							console.log("[copyWasms] Completed successfully")
						}
					} catch (error) {
						console.error("[copyWasms] Failed to copy required WASM files:", error instanceof Error ? error.message : "Unknown error")
						// Re-throw the error to fail the build
						throw error
					}
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
		if (fs.existsSync(servicesDir)) {
			const wasmFiles = fs.readdirSync(servicesDir).filter(file => file.endsWith('.wasm'))
			console.log(`[build-verification] Found ${wasmFiles.length} WASM files in ${servicesDir}`)
			wasmFiles.forEach(file => {
				const filePath = path.join(servicesDir, file)
				const stats = fs.statSync(filePath)
				console.log(`[build-verification] ${file} (${stats.size} bytes)`)
			})
		} else {
			console.warn(`[build-verification] WASM directory not found: ${servicesDir}`)
		}
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
