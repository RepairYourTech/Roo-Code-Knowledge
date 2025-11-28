import { describe, it, expect, beforeEach, vi } from "vitest"
import { formatDiagnosticReport } from "../wasm-diagnostics"

describe("wasm-diagnostics", () => {
	describe("formatDiagnosticReport", () => {
		it("should format a diagnostic report as human-readable text", () => {
			const mockReport = {
				wasmDirectory: "/mock/wasm/dir",
				wasmDirectoryExists: true,
				criticalFiles: [
					{
						filename: "tree-sitter.wasm",
						exists: true,
						size: 2048,
						isValid: true,
						path: "/mock/wasm/dir/tree-sitter.wasm",
					},
					{
						filename: "tree-sitter-javascript.wasm",
						exists: false,
						size: 0,
						isValid: false,
						path: "/mock/wasm/dir/tree-sitter-javascript.wasm",
					},
				],
				optionalFiles: [],
				missingCriticalFiles: ["tree-sitter-javascript.wasm"],
				totalFiles: 1,
				totalSize: 2048,
				webTreeSitterVersion: "0.20.0",
				treeSitterWasmsVersion: "1.0.0",
				recommendations: ["Missing critical WASM files: tree-sitter-javascript.wasm. Run download command."],
				isHealthy: false,
				recoverySuggestions: [
					{
						action: "Download missing WASM files",
						command: "Roo-Cline: Download Tree-sitter WASM Files",
						priority: 1,
						description: "Download the missing tree-sitter-javascript.wasm file",
					},
				],
				canAutoRecover: true,
				estimatedRecoveryTime: 30,
			}

			const formatted = formatDiagnosticReport(mockReport)

			expect(formatted).toContain("=== Tree-sitter WASM Diagnostics ===")
			expect(formatted).toContain("WASM Directory:")
			expect(formatted).toContain("/mock/wasm/dir")
			expect(formatted).toContain("Critical Files:")
			expect(formatted).toContain("✅ tree-sitter.wasm (2.0KB)")
			expect(formatted).toContain("❌ tree-sitter-javascript.wasm")
			expect(formatted).toContain("Overall Health: ❌ Issues detected")
			expect(formatted).toContain("Recommendations:")
		})

		it("should format a healthy report correctly", () => {
			const mockReport = {
				wasmDirectory: "/mock/wasm/dir",
				wasmDirectoryExists: true,
				criticalFiles: [
					{
						filename: "tree-sitter.wasm",
						exists: true,
						size: 2048,
						isValid: true,
						path: "/mock/wasm/dir/tree-sitter.wasm",
					},
					{
						filename: "tree-sitter-javascript.wasm",
						exists: true,
						size: 2048,
						isValid: true,
						path: "/mock/wasm/dir/tree-sitter-javascript.wasm",
					},
				],
				optionalFiles: [
					{
						filename: "tree-sitter-python.wasm",
						exists: true,
						size: 2048,
						isValid: true,
						path: "/mock/wasm/dir/tree-sitter-python.wasm",
					},
				],
				missingCriticalFiles: [],
				totalFiles: 3,
				totalSize: 6144,
				webTreeSitterVersion: "0.20.0",
				treeSitterWasmsVersion: "1.0.0",
				recommendations: [],
				isHealthy: true,
				recoverySuggestions: [],
				canAutoRecover: false,
				estimatedRecoveryTime: 0,
			}

			const formatted = formatDiagnosticReport(mockReport)

			expect(formatted).toContain("=== Tree-sitter WASM Diagnostics ===")
			expect(formatted).toContain("WASM Directory:")
			expect(formatted).toContain("/mock/wasm/dir")
			expect(formatted).toContain("Critical Files:")
			expect(formatted).toContain("✅ tree-sitter.wasm (2.0KB)")
			expect(formatted).toContain("✅ tree-sitter-javascript.wasm (2.0KB)")
			expect(formatted).toContain("Optional Files: 1 of 1 present")
			expect(formatted).toContain("Overall Health: ✅ Healthy")
			expect(formatted).toContain("✅ No issues detected!")
		})

		it("should handle missing directory correctly", () => {
			const mockReport = {
				wasmDirectory: "/mock/wasm/dir",
				wasmDirectoryExists: false,
				criticalFiles: [],
				optionalFiles: [],
				missingCriticalFiles: [
					"tree-sitter.wasm",
					"tree-sitter-javascript.wasm",
					"tree-sitter-typescript.wasm",
					"tree-sitter-python.wasm",
				],
				totalFiles: 0,
				totalSize: 0,
				webTreeSitterVersion: null,
				treeSitterWasmsVersion: null,
				recommendations: [
					"WASM directory not found. Run 'Roo-Cline: Download Tree-sitter WASM Files' command.",
				],
				isHealthy: false,
				recoverySuggestions: [
					{
						action: "Create WASM directory and download files",
						command: "Roo-Cline: Download Tree-sitter WASM Files",
						priority: 1,
						description: "Create the WASM directory and download all required files",
					},
				],
				canAutoRecover: true,
				estimatedRecoveryTime: 60,
			}

			const formatted = formatDiagnosticReport(mockReport)

			expect(formatted).toContain("=== Tree-sitter WASM Diagnostics ===")
			expect(formatted).toContain("WASM Directory:")
			expect(formatted).toContain("/mock/wasm/dir")
			expect(formatted).toContain("Exists: ❌")
			expect(formatted).toContain("Overall Health: ❌ Issues detected")
			expect(formatted).toContain("Recommendations:")
			expect(formatted).toContain(
				"WASM directory not found. Run 'Roo-Cline: Download Tree-sitter WASM Files' command.",
			)
		})

		it("should show package versions correctly", () => {
			const mockReport = {
				wasmDirectory: "/mock/wasm/dir",
				wasmDirectoryExists: true,
				criticalFiles: [],
				optionalFiles: [],
				missingCriticalFiles: [],
				totalFiles: 0,
				totalSize: 0,
				webTreeSitterVersion: "0.20.0",
				treeSitterWasmsVersion: "1.0.0",
				recommendations: [],
				isHealthy: false,
				recoverySuggestions: [],
				canAutoRecover: false,
				estimatedRecoveryTime: 0,
			}

			const formatted = formatDiagnosticReport(mockReport)

			expect(formatted).toContain("Package Versions:")
			expect(formatted).toContain("web-tree-sitter: 0.20.0")
			expect(formatted).toContain("tree-sitter-wasms: 1.0.0")
		})

		it("should show missing package versions", () => {
			const mockReport = {
				wasmDirectory: "/mock/wasm/dir",
				wasmDirectoryExists: true,
				criticalFiles: [],
				optionalFiles: [],
				missingCriticalFiles: [],
				totalFiles: 0,
				totalSize: 0,
				webTreeSitterVersion: null,
				treeSitterWasmsVersion: null,
				recommendations: ["web-tree-sitter package not installed. Run 'pnpm install'."],
				isHealthy: false,
				recoverySuggestions: [
					{
						action: "Install missing packages",
						command: "pnpm install",
						priority: 1,
						description: "Install web-tree-sitter and tree-sitter-wasms packages",
					},
				],
				canAutoRecover: true,
				estimatedRecoveryTime: 120,
			}

			const formatted = formatDiagnosticReport(mockReport)

			expect(formatted).toContain("Package Versions:")
			expect(formatted).toContain("web-tree-sitter: ❌ Not found")
			expect(formatted).toContain("tree-sitter-wasms: ❌ Not found")
		})
	})
})
