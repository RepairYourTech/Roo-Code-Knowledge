import { defineConfig } from "vitest/config"
import path from "path"
import { resolveVerbosity } from "./utils/vitest-verbosity"

const { silent, reporters, onConsoleLog } = resolveVerbosity()

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		watch: false,
		reporters,
		silent,
		testTimeout: 20_000,
		hookTimeout: 20_000,
		onConsoleLog,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			thresholds: {
				global: {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80,
				},
				"./services/tree-sitter/wasm-loader-with-retry.ts": {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80,
				},
				"./services/tree-sitter/parser-availability-checker.ts": {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80,
				},
				"./services/tree-sitter/wasm-diagnostics.ts": {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80,
				},
			},
		},
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, "./__mocks__/vscode.js"),
		},
	},
})
