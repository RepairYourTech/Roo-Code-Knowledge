import * as vscode from "vscode"
import delay from "delay"

import type { CommandId } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Package } from "../shared/package"
import { getCommand } from "../utils/commands"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { focusPanel } from "../utils/focusPanel"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"
import { CodeIndexManager } from "../services/code-index/manager"
import { importSettingsWithFeedback } from "../core/config/importExport"
import { MdmService } from "../services/mdm/MdmService"
import { t } from "../i18n"

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible Roo Code instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions): Record<CommandId, any> => ({
	activationCompleted: () => {},
	cloudButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("cloud")

		visibleProvider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	},
	plusButtonClicked: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("plus")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.refreshWorkspace()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		// Send focusInput action immediately after chatButtonClicked
		// This ensures the focus happens after the view has switched
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	mcpButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("mcp")

		visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
	},
	promptsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("prompts")

		visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
	},
	popoutButtonClicked: () => {
		TelemetryService.instance.captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel })
	},
	openInNewTab: () => openClineInNewTab({ context, outputChannel }),
	settingsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		// Also explicitly post the visibility message to trigger scroll reliably
		visibleProvider.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
	},
	historyButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	marketplaceButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) return
		visibleProvider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
	showHumanRelayDialog: (params: { requestId: string; promptText: string }) => {
		const panel = getPanel()

		if (panel) {
			panel?.webview.postMessage({
				type: "showHumanRelayDialog",
				requestId: params.requestId,
				promptText: params.promptText,
			})
		}
	},
	registerHumanRelayCallback: registerHumanRelayCallback,
	unregisterHumanRelayCallback: unregisterHumanRelayCallback,
	handleHumanRelayResponse: handleHumanRelayResponse,
	newTask: handleNewTask,
	setCustomStoragePath: async () => {
		const { promptForCustomStoragePath } = await import("../utils/storage")
		await promptForCustomStoragePath()
	},
	importSettings: async (filePath?: string) => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: visibleProvider.providerSettingsManager,
				contextProxy: visibleProvider.contextProxy,
				customModesManager: visibleProvider.customModesManager,
				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			// Send focus input message only for sidebar panels
			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	toggleAutoApprove: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({
			type: "action",
			action: "toggleAutoApprove",
		})
	},
	testQdrantConnection: async () => {
		try {
			const manager = CodeIndexManager.getInstance(context)

			if (!manager || !manager.outputChannel) {
				vscode.window.showErrorMessage(
					"Diagnostics require an open workspace and initialized code index manager.",
				)
				return
			}

			const outputCh = manager.outputChannel

			if (!manager.isFeatureConfigured) {
				vscode.window.showErrorMessage(
					"Code indexing is not configured. Please configure Qdrant settings first.",
				)
				return
			}

			outputCh.appendLine("[Diagnostic] Testing Qdrant connection...")

			// Get ServiceFactory from manager to create vector store
			const serviceFactory = manager.serviceFactory
			if (!serviceFactory) {
				vscode.window.showErrorMessage(
					"Code indexing is not initialized. Please initialize code indexing first.",
				)
				return
			}

			const startTime = Date.now()

			try {
				const vectorStore = serviceFactory.createVectorStore()
				await vectorStore.initialize()

				const latency = Date.now() - startTime
				// getConnectionInfo is a diagnostic method on QdrantVectorStore, not in IVectorStore
				const connInfo = (vectorStore as any).getConnectionInfo()

				outputCh.appendLine(`[Diagnostic] Qdrant connection successful!`)
				outputCh.appendLine(`  URL: ${connInfo.url}`)
				outputCh.appendLine(`  Collection: ${connInfo.collectionName}`)
				outputCh.appendLine(`  Vector Size: ${connInfo.vectorSize}`)
				outputCh.appendLine(`  Workspace: ${connInfo.workspacePath}`)
				outputCh.appendLine(`  Latency: ${latency}ms`)

				const action = await vscode.window.showInformationMessage(
					`Qdrant connection successful! Latency: ${latency}ms`,
					"Show Output",
				)
				if (action === "Show Output") {
					outputCh.show()
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				outputCh.appendLine(`[Diagnostic] Qdrant connection failed: ${errorMsg}`)
				if (error instanceof Error && error.stack) {
					outputCh.appendLine(`Stack trace: ${error.stack}`)
				}

				const action = await vscode.window.showErrorMessage(
					`Qdrant connection failed: ${errorMsg}`,
					"Show Output",
				)
				if (action === "Show Output") {
					outputCh.show()
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to run Qdrant diagnostic: ${errorMsg}`)
		}
	},
	testNeo4jConnection: async () => {
		try {
			const manager = CodeIndexManager.getInstance(context)

			if (!manager || !manager.outputChannel) {
				vscode.window.showErrorMessage(
					"Diagnostics require an open workspace and initialized code index manager.",
				)
				return
			}

			const outputCh = manager.outputChannel

			if (!manager.isFeatureConfigured) {
				vscode.window.showErrorMessage("Code indexing is not configured. Please configure settings first.")
				return
			}

			// Get ServiceFactory from manager
			const serviceFactory = manager.serviceFactory
			if (!serviceFactory) {
				vscode.window.showErrorMessage(
					"Code indexing is not initialized. Please initialize code indexing first.",
				)
				return
			}

			const configMgr = serviceFactory.config
			if (!configMgr.isNeo4jEnabled) {
				vscode.window.showInformationMessage(
					"Neo4j graph indexing is disabled. Enable it in settings to use this diagnostic.",
				)
				return
			}

			outputCh.appendLine("[Diagnostic] Testing Neo4j connection...")

			const startTime = Date.now()
			let neo4jService: any = null

			try {
				neo4jService = serviceFactory.createNeo4jService()
				if (!neo4jService) {
					outputCh.appendLine(
						"[Diagnostic] Neo4j service could not be created. Neo4j is disabled or misconfigured.",
					)
					vscode.window
						.showErrorMessage(
							"Neo4j service could not be created. Please check Neo4j settings and ensure it's enabled.",
							"Show Output",
						)
						.then((action) => {
							if (action === "Show Output") {
								outputCh.show()
							}
						})
					return
				}

				await neo4jService.initialize()
				const isConnected = neo4jService.isConnected()

				if (!isConnected) {
					throw new Error("Neo4j service initialized but connection verification failed")
				}

				const latency = Date.now() - startTime
				const connInfo = neo4jService.getConnectionInfo()
				const stats = await neo4jService.getStats()

				outputCh.appendLine(`[Diagnostic] Neo4j connection successful!`)
				outputCh.appendLine(`  URL: ${connInfo.url}`)
				outputCh.appendLine(`  Database: ${connInfo.database}`)
				outputCh.appendLine(`  Username: ${connInfo.username}`)
				outputCh.appendLine(`  Connected: ${connInfo.isConnected}`)
				outputCh.appendLine(`  Latency: ${latency}ms`)
				outputCh.appendLine(`  Nodes: ${stats.nodeCount}`)
				outputCh.appendLine(`  Relationships: ${stats.relationshipCount}`)
				outputCh.appendLine(`  Files: ${stats.fileCount}`)

				const action = await vscode.window.showInformationMessage(
					`Neo4j connection successful! Latency: ${latency}ms, Nodes: ${stats.nodeCount}`,
					"Show Output",
				)
				if (action === "Show Output") {
					outputCh.show()
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				outputCh.appendLine(`[Diagnostic] Neo4j connection failed: ${errorMsg}`)
				if (error instanceof Error && error.stack) {
					outputCh.appendLine(`Stack trace: ${error.stack}`)
				}

				const action = await vscode.window.showErrorMessage(
					`Neo4j connection failed: ${errorMsg}`,
					"Show Output",
				)
				if (action === "Show Output") {
					outputCh.show()
				}
			} finally {
				// Clean up Neo4j connection
				if (neo4jService) {
					try {
						await neo4jService.close()
					} catch (closeError) {
						outputCh.appendLine(`[Diagnostic] Error closing Neo4j connection: ${closeError}`)
					}
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to run Neo4j diagnostic: ${errorMsg}`)
		}
	},
	testEmbeddingProvider: async () => {
		try {
			const manager = CodeIndexManager.getInstance(context)

			if (!manager || !manager.outputChannel) {
				vscode.window.showErrorMessage(
					"Diagnostics require an open workspace and initialized code index manager.",
				)
				return
			}

			const outputCh = manager.outputChannel

			if (!manager.isFeatureConfigured) {
				vscode.window.showErrorMessage(
					"Code indexing is not configured. Please configure embedding provider settings first.",
				)
				return
			}

			outputCh.appendLine("[Diagnostic] Testing embedding provider connection...")

			// Get ServiceFactory from manager
			const serviceFactory = manager.serviceFactory
			if (!serviceFactory) {
				vscode.window.showErrorMessage(
					"Code indexing is not initialized. Please initialize code indexing first.",
				)
				return
			}

			const startTime = Date.now()

			try {
				const embedder = serviceFactory.createEmbedder()

				// Get provider info if available
				let providerInfo: any = {}
				if (typeof (embedder as any).getProviderInfo === "function") {
					providerInfo = (embedder as any).getProviderInfo()
				}

				const validationResult = await embedder.validateConfiguration()
				const latency = Date.now() - startTime

				if (validationResult.valid) {
					outputCh.appendLine(`[Diagnostic] Embedding provider validation successful!`)
					outputCh.appendLine(`  Provider: ${providerInfo.provider || "unknown"}`)
					outputCh.appendLine(`  Model: ${providerInfo.modelId || "unknown"}`)
					if (providerInfo.baseUrl) {
						outputCh.appendLine(`  Base URL: ${providerInfo.baseUrl}`)
					}
					if (providerInfo.maxItemTokens) {
						outputCh.appendLine(`  Max Item Tokens: ${providerInfo.maxItemTokens}`)
					}
					if (providerInfo.maxBatchItems) {
						outputCh.appendLine(`  Max Batch Items: ${providerInfo.maxBatchItems}`)
					}
					outputCh.appendLine(`  Latency: ${latency}ms`)

					const action = await vscode.window.showInformationMessage(
						`Embedding provider (${providerInfo.provider || "unknown"}) connection successful! Latency: ${latency}ms`,
						"Show Output",
					)
					if (action === "Show Output") {
						outputCh.show()
					}
				} else {
					const errorMsg = validationResult.error || "Validation failed"
					outputCh.appendLine(`[Diagnostic] Embedding provider validation failed: ${errorMsg}`)

					const action = await vscode.window.showErrorMessage(
						`Embedding provider validation failed: ${errorMsg}`,
						"Show Output",
					)
					if (action === "Show Output") {
						outputCh.show()
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				outputCh.appendLine(`[Diagnostic] Embedding provider test failed: ${errorMsg}`)
				if (error instanceof Error && error.stack) {
					outputCh.appendLine(`Stack trace: ${error.stack}`)
				}

				// Simplified error handling - rely on validateConfiguration and provider implementations
				// for specific auth/network hints
				const action = await vscode.window.showErrorMessage(
					`Embedding provider test failed: ${errorMsg}`,
					"Show Output",
				)
				if (action === "Show Output") {
					outputCh.show()
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to run embedding provider diagnostic: ${errorMsg}`)
		}
	},
	dumpIndexingDiagnostics: async () => {
		try {
			const manager = CodeIndexManager.getInstance(context)

			if (!manager) {
				vscode.window.showErrorMessage("Code index manager not initialized")
				return
			}

			if (!manager.outputChannel) {
				vscode.window.showErrorMessage("Code index manager output channel not available")
				return
			}

			// Get comprehensive diagnostic snapshot
			const diagnosticSnapshot = manager.getDiagnosticSnapshot()

			// Format as JSON with indentation
			const formattedDiagnostics = JSON.stringify(diagnosticSnapshot, null, 2)

			// Write to output channel
			manager.outputChannel.appendLine("=== INDEXING DIAGNOSTICS ===")
			manager.outputChannel.appendLine(formattedDiagnostics)
			manager.outputChannel.appendLine("=== END DIAGNOSTICS ===")

			// Write to file in workspace root
			try {
				const workspaceFolders = vscode.workspace.workspaceFolders
				if (!workspaceFolders || workspaceFolders.length === 0) {
					vscode.window.showErrorMessage("No workspace folder available for diagnostics file")
					return
				}

				const workspacePath = workspaceFolders[0].uri.fsPath
				const timestamp = new Date().toISOString().replace(/[:.]/g, "-")

				// Ensure .roo directory exists
				const rooDirUri = vscode.Uri.joinPath(vscode.Uri.file(workspacePath), ".roo")
				await vscode.workspace.fs.createDirectory(rooDirUri)

				// Build diagnostic file path by joining rooDirUri with the file name
				const diagnosticFileName = `indexing-diagnostics-${timestamp}.json`
				const diagnosticFilePath = vscode.Uri.joinPath(rooDirUri, diagnosticFileName)

				// Write diagnostics to file
				const diagnosticContent = JSON.stringify(diagnosticSnapshot, null, 2)
				await vscode.workspace.fs.writeFile(diagnosticFilePath, Buffer.from(diagnosticContent, "utf8"))

				// Show notification with options
				const action = await vscode.window.showInformationMessage(
					"Indexing diagnostics saved to file",
					"Show Output",
					"Open File",
				)

				if (action === "Show Output") {
					manager.outputChannel.show()
				} else if (action === "Open File") {
					const document = await vscode.workspace.openTextDocument(diagnosticFilePath)
					await vscode.window.showTextDocument(document)
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				manager.outputChannel.appendLine(`Failed to save diagnostics: ${errorMessage}`)

				if (manager.outputChannel) {
					vscode.window.showErrorMessage(`Failed to save diagnostics: ${errorMessage}`, "Show Output")
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to run diagnostics: ${errorMessage}`)
		}
	},
	downloadTreeSitterWasms: async () => {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: "Downloading Tree-sitter WASM files...",
				cancellable: false,
			},
			async (progressToken) => {
				try {
					// Import the new download module
					const { downloadTreeSitterWasms } = await import("../services/tree-sitter/download-wasms")

					// Get the extension path from context
					const extensionPath = context.extensionUri.fsPath

					// Execute the download using the new module
					const result = await downloadTreeSitterWasms({
						extensionPath,
						progressToken,
						outputChannel,
					})

					if (result.success) {
						// Show success message with details
						const message = `Successfully downloaded ${result.successCount}/${result.totalExpected} Tree-sitter WASM files (${(result.totalSize / 1024 / 1024).toFixed(2)} MB). Restart the extension or reload the window for changes to take effect.`
						await vscode.window.showInformationMessage(message)
						outputChannel.appendLine(`[DownloadTreeSitterWasms] Success: ${message}`)
					} else {
						// Show partial success message
						const message = `Downloaded ${result.successCount}/${result.totalExpected} files. Some parsing functionality may be limited. Check output channel for details.`
						await vscode.window.showWarningMessage(message)
						outputChannel.appendLine(`[DownloadTreeSitterWasms] Partial success: ${message}`)
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)

					// Log error to output channel
					outputChannel.appendLine(`[DownloadTreeSitterWasms] Error: ${errorMessage}`)
					if (error instanceof Error && error.stack) {
						outputChannel.appendLine(`Stack trace: ${error.stack}`)
					}

					// Show error message to user
					await vscode.window.showErrorMessage(
						`Failed to download Tree-sitter WASM files: ${errorMessage}. Please check the output channel for more details.`,
					)
				}
			},
		)
	},
})

export const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const contextProxy = await ContextProxy.getInstance(context)
	const codeIndexManager = CodeIndexManager.getInstance(context)

	// Get the existing MDM service instance to ensure consistent policy enforcement
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch (error) {
		// MDM service not initialized, which is fine - extension can work without it
		mdmService = undefined
	}

	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy, mdmService)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	// Add listener for visibility changes to notify webview
	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" }) // Use the same message type as in SettingsView.tsx
			}
		},
		null, // First null is for `thisArgs`
		context.subscriptions, // Register listener for disposal
	)

	// Handle panel closing events.
	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions, // Also register dispose listener
	)

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	return tabProvider
}
