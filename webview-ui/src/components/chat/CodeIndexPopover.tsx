import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Trans } from "react-i18next"
import { z } from "zod"
import {
	VSCodeButton,
	VSCodeTextField,
	VSCodeDropdown,
	VSCodeOption,
	VSCodeLink,
	VSCodeCheckbox,
} from "@vscode/webview-ui-toolkit/react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { AlertTriangle } from "lucide-react"

import { CODEBASE_INDEX_DEFAULTS } from "@roo-code/types"

import type { EmbedderProvider } from "@roo/embeddingModels"
import type { IndexingStatus } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"
import { cn } from "@src/lib/utils"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Popover,
	PopoverContent,
	Slider,
	StandardTooltip,
	Button,
} from "@src/components/ui"
import { useRooPortal } from "@src/components/ui/hooks/useRooPortal"
import { useEscapeKey } from "@src/hooks/useEscapeKey"

// Default URLs for providers
const DEFAULT_QDRANT_URL = "http://localhost:6333"
const DEFAULT_OLLAMA_URL = "http://localhost:11434"

interface CodeIndexPopoverProps {
	children: React.ReactNode
	indexingStatus: IndexingStatus
}

interface LocalCodeIndexSettings {
	// Global state settings
	codebaseIndexEnabled: boolean
	codebaseIndexQdrantUrl: string
	codebaseIndexEmbedderProvider: EmbedderProvider
	codebaseIndexEmbedderBaseUrl?: string
	codebaseIndexEmbedderModelId: string
	codebaseIndexEmbedderModelDimension?: number // Generic dimension for all providers
	codebaseIndexSearchMaxResults?: number
	codebaseIndexSearchMinScore?: number

	// Neo4j settings (following Qdrant pattern - single set of fields for both local and cloud)
	neo4jEnabled: boolean
	neo4jUri: string
	neo4jUsername: string
	neo4jPassword?: string

	// Secret settings (start empty, will be loaded separately)
	codeIndexOpenAiKey?: string
	codeIndexQdrantApiKey?: string
	codebaseIndexOpenAiCompatibleBaseUrl?: string
	codebaseIndexOpenAiCompatibleApiKey?: string
	codebaseIndexGeminiApiKey?: string
	codebaseIndexMistralApiKey?: string
	codebaseIndexVercelAiGatewayApiKey?: string
	codebaseIndexOpenRouterApiKey?: string
}

// Validation schema for codebase index settings
const createValidationSchema = (provider: EmbedderProvider, neo4jEnabled: boolean, t: any) => {
	const baseSchema = z.object({
		codebaseIndexEnabled: z.boolean(),
		codebaseIndexQdrantUrl: z
			.string()
			.min(1, t("settings:codeIndex.validation.qdrantUrlRequired"))
			.url(t("settings:codeIndex.validation.invalidQdrantUrl")),
		codeIndexQdrantApiKey: z.string().optional(),
		// Neo4j validation (only when enabled)
		neo4jEnabled: z.boolean(),
		neo4jUri: neo4jEnabled
			? z
					.string()
					.min(1, "Neo4j URI is required when Neo4j is enabled")
					.refine(
						(val) =>
							val.startsWith("bolt://") || val.startsWith("neo4j://") || val.startsWith("neo4j+s://"),
						{
							message: "Neo4j URI must start with bolt://, neo4j://, or neo4j+s://",
						},
					)
			: z.string().optional(),
		neo4jUsername: neo4jEnabled
			? z.string().min(1, "Neo4j username is required when Neo4j is enabled")
			: z.string().optional(),
		neo4jPassword: z.string().optional(),
	})

	switch (provider) {
		case "openai":
			return baseSchema.extend({
				codeIndexOpenAiKey: z.string().min(1, t("settings:codeIndex.validation.openaiApiKeyRequired")),
				codebaseIndexEmbedderModelId: z
					.string()
					.min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
			})

		case "ollama":
			return baseSchema.extend({
				codebaseIndexEmbedderBaseUrl: z
					.string()
					.min(1, t("settings:codeIndex.validation.ollamaBaseUrlRequired"))
					.url(t("settings:codeIndex.validation.invalidOllamaUrl")),
				codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelIdRequired")),
				codebaseIndexEmbedderModelDimension: z
					.number()
					.min(1, t("settings:codeIndex.validation.modelDimensionRequired"))
					.optional(),
			})

		case "openai-compatible":
			return baseSchema.extend({
				codebaseIndexOpenAiCompatibleBaseUrl: z
					.string()
					.min(1, t("settings:codeIndex.validation.baseUrlRequired"))
					.url(t("settings:codeIndex.validation.invalidBaseUrl")),
				codebaseIndexOpenAiCompatibleApiKey: z
					.string()
					.min(1, t("settings:codeIndex.validation.apiKeyRequired")),
				codebaseIndexEmbedderModelId: z.string().min(1, t("settings:codeIndex.validation.modelIdRequired")),
				codebaseIndexEmbedderModelDimension: z
					.number()
					.min(1, t("settings:codeIndex.validation.modelDimensionRequired")),
			})

		case "gemini":
			return baseSchema.extend({
				codebaseIndexGeminiApiKey: z.string().min(1, t("settings:codeIndex.validation.geminiApiKeyRequired")),
				codebaseIndexEmbedderModelId: z
					.string()
					.min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
			})

		case "mistral":
			return baseSchema.extend({
				codebaseIndexMistralApiKey: z.string().min(1, t("settings:codeIndex.validation.mistralApiKeyRequired")),
				codebaseIndexEmbedderModelId: z
					.string()
					.min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
			})

		case "vercel-ai-gateway":
			return baseSchema.extend({
				codebaseIndexVercelAiGatewayApiKey: z
					.string()
					.min(1, t("settings:codeIndex.validation.vercelAiGatewayApiKeyRequired")),
				codebaseIndexEmbedderModelId: z
					.string()
					.min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
			})

		case "openrouter":
			return baseSchema.extend({
				codebaseIndexOpenRouterApiKey: z
					.string()
					.min(1, t("settings:codeIndex.validation.openRouterApiKeyRequired")),
				codebaseIndexEmbedderModelId: z
					.string()
					.min(1, t("settings:codeIndex.validation.modelSelectionRequired")),
			})

		default:
			return baseSchema
	}
}

export const CodeIndexPopover: React.FC<CodeIndexPopoverProps> = ({
	children,
	indexingStatus: externalIndexingStatus,
}) => {
	const SECRET_PLACEHOLDER = "••••••••••••••••"
	const { t } = useAppTranslation()
	const { codebaseIndexConfig, codebaseIndexModels, cwd } = useExtensionState()
	const [open, setOpen] = useState(false)
	const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)
	const [isSetupSettingsOpen, setIsSetupSettingsOpen] = useState(false)

	const [indexingStatus, setIndexingStatus] = useState<IndexingStatus>(externalIndexingStatus)

	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
	const [saveError, setSaveError] = useState<string | null>(null)

	// Form validation state
	const [formErrors, setFormErrors] = useState<Record<string, string>>({})

	// Discard changes dialog state
	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const confirmDialogHandler = useRef<(() => void) | null>(null)

	// Default settings template
	const getDefaultSettings = (): LocalCodeIndexSettings => ({
		codebaseIndexEnabled: true,
		codebaseIndexQdrantUrl: "",
		codebaseIndexEmbedderProvider: "openai",
		codebaseIndexEmbedderBaseUrl: "",
		codebaseIndexEmbedderModelId: "",
		codebaseIndexEmbedderModelDimension: undefined,
		codebaseIndexSearchMaxResults: CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
		codebaseIndexSearchMinScore: CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
		neo4jEnabled: false,
		neo4jUri: "bolt://localhost:7687",
		neo4jUsername: "neo4j",
		neo4jPassword: "",
		codeIndexOpenAiKey: "",
		codeIndexQdrantApiKey: "",
		codebaseIndexOpenAiCompatibleBaseUrl: "",
		codebaseIndexOpenAiCompatibleApiKey: "",
		codebaseIndexGeminiApiKey: "",
		codebaseIndexMistralApiKey: "",
		codebaseIndexVercelAiGatewayApiKey: "",
		codebaseIndexOpenRouterApiKey: "",
	})

	// Initial settings state - stores the settings when popover opens
	const [initialSettings, setInitialSettings] = useState<LocalCodeIndexSettings>(getDefaultSettings())

	// Current settings state - tracks user changes
	const [currentSettings, setCurrentSettings] = useState<LocalCodeIndexSettings>(getDefaultSettings())

	// Update indexing status from parent
	useEffect(() => {
		setIndexingStatus(externalIndexingStatus)
	}, [externalIndexingStatus])

	// Track if we've initialized settings to prevent re-initialization after save
	const hasInitializedSettings = useRef(false)

	// Initialize settings from global state ONLY on first load
	useEffect(() => {
		if (codebaseIndexConfig && !hasInitializedSettings.current) {
			const settings = {
				codebaseIndexEnabled: codebaseIndexConfig.codebaseIndexEnabled ?? true,
				codebaseIndexQdrantUrl: codebaseIndexConfig.codebaseIndexQdrantUrl || "",
				codebaseIndexEmbedderProvider: codebaseIndexConfig.codebaseIndexEmbedderProvider || "openai",
				codebaseIndexEmbedderBaseUrl: codebaseIndexConfig.codebaseIndexEmbedderBaseUrl || "",
				codebaseIndexEmbedderModelId: codebaseIndexConfig.codebaseIndexEmbedderModelId || "",
				codebaseIndexEmbedderModelDimension:
					codebaseIndexConfig.codebaseIndexEmbedderModelDimension || undefined,
				codebaseIndexSearchMaxResults:
					codebaseIndexConfig.codebaseIndexSearchMaxResults ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
				codebaseIndexSearchMinScore:
					codebaseIndexConfig.codebaseIndexSearchMinScore ?? CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
				neo4jEnabled: codebaseIndexConfig.neo4jEnabled ?? false,
				neo4jUri: codebaseIndexConfig.neo4jUri || "bolt://localhost:7687",
				neo4jUsername: codebaseIndexConfig.neo4jUsername || "neo4j",
				neo4jPassword: "",
				codeIndexOpenAiKey: "",
				codeIndexQdrantApiKey: "",
				codebaseIndexOpenAiCompatibleBaseUrl: codebaseIndexConfig.codebaseIndexOpenAiCompatibleBaseUrl || "",
				codebaseIndexOpenAiCompatibleApiKey: "",
				codebaseIndexGeminiApiKey: "",
				codebaseIndexMistralApiKey: "",
				codebaseIndexVercelAiGatewayApiKey: "",
				codebaseIndexOpenRouterApiKey: "",
			}
			setInitialSettings(settings)
			setCurrentSettings(settings)
			hasInitializedSettings.current = true

			// Request secret status to check if secrets exist
			vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
		}
	}, [codebaseIndexConfig])

	// Request initial indexing status
	useEffect(() => {
		if (open) {
			vscode.postMessage({ type: "requestIndexingStatus" })
			vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
		}
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "workspaceUpdated") {
				// When workspace changes, request updated indexing status
				if (open) {
					vscode.postMessage({ type: "requestIndexingStatus" })
					vscode.postMessage({ type: "requestCodeIndexSecretStatus" })
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [open])

	// Use a ref to capture current settings for the save handler
	const currentSettingsRef = useRef(currentSettings)
	currentSettingsRef.current = currentSettings

	// Listen for indexing status updates and save responses
	useEffect(() => {
		const handleMessage = (event: MessageEvent<any>) => {
			if (event.data.type === "indexingStatusUpdate") {
				if (!event.data.values.workspacePath || event.data.values.workspacePath === cwd) {
					setIndexingStatus({
						systemStatus: event.data.values.systemStatus,
						message: event.data.values.message || "",
						processedItems: event.data.values.processedItems,
						totalItems: event.data.values.totalItems,
						currentItemUnit: event.data.values.currentItemUnit || "items",
					})
				}
			} else if (event.data.type === "codeIndexSettingsSaved") {
				if (event.data.success) {
					setSaveStatus("saved")
					const backendSettings = event.data.settings || {}

					console.log("[CodeIndexPopover] Settings saved, backend returned:", backendSettings)

					// CRITICAL: Use explicit checks for boolean values to handle false correctly
					// The ?? operator treats false as a valid value, but we need to be explicit
					const savedSettings = {
						...currentSettingsRef.current,
						codebaseIndexEnabled:
							backendSettings.codebaseIndexEnabled !== undefined
								? backendSettings.codebaseIndexEnabled
								: currentSettingsRef.current.codebaseIndexEnabled,
						codebaseIndexQdrantUrl:
							backendSettings.codebaseIndexQdrantUrl ?? currentSettingsRef.current.codebaseIndexQdrantUrl,
						codebaseIndexEmbedderProvider:
							backendSettings.codebaseIndexEmbedderProvider ??
							currentSettingsRef.current.codebaseIndexEmbedderProvider,
						codebaseIndexEmbedderBaseUrl:
							backendSettings.codebaseIndexEmbedderBaseUrl ??
							currentSettingsRef.current.codebaseIndexEmbedderBaseUrl,
						codebaseIndexEmbedderModelId:
							backendSettings.codebaseIndexEmbedderModelId ??
							currentSettingsRef.current.codebaseIndexEmbedderModelId,
						codebaseIndexEmbedderModelDimension:
							backendSettings.codebaseIndexEmbedderModelDimension ??
							currentSettingsRef.current.codebaseIndexEmbedderModelDimension,
						codebaseIndexSearchMaxResults:
							backendSettings.codebaseIndexSearchMaxResults ??
							currentSettingsRef.current.codebaseIndexSearchMaxResults,
						codebaseIndexSearchMinScore:
							backendSettings.codebaseIndexSearchMinScore ??
							currentSettingsRef.current.codebaseIndexSearchMinScore,
						codebaseIndexOpenAiCompatibleBaseUrl:
							backendSettings.codebaseIndexOpenAiCompatibleBaseUrl ??
							currentSettingsRef.current.codebaseIndexOpenAiCompatibleBaseUrl,
						neo4jEnabled:
							backendSettings.neo4jEnabled !== undefined
								? backendSettings.neo4jEnabled
								: currentSettingsRef.current.neo4jEnabled,
						neo4jUri: backendSettings.neo4jUri ?? currentSettingsRef.current.neo4jUri,
						neo4jUsername: backendSettings.neo4jUsername ?? currentSettingsRef.current.neo4jUsername,
					}

					console.log("[CodeIndexPopover] Updating UI with saved settings:", savedSettings)

					setInitialSettings(savedSettings)
					setCurrentSettings(savedSettings)

					vscode.postMessage({ type: "requestCodeIndexSecretStatus" })

					setSaveStatus("idle")
				} else {
					setSaveStatus("error")
					setSaveError(event.data.error || t("settings:codeIndex.saveError"))
					setSaveStatus("idle")
					setSaveError(null)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t, cwd])

	// Listen for secret status
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === "codeIndexSecretStatus") {
				// Update settings to show placeholders for existing secrets
				const secretStatus = event.data.values

				// Update both current and initial settings based on what secrets exist
				const updateWithSecrets = (prev: LocalCodeIndexSettings): LocalCodeIndexSettings => {
					const updated = { ...prev }

					// Only update to placeholder if the field is currently empty or already a placeholder
					// This preserves user input when they're actively editing
					if (!prev.codeIndexOpenAiKey || prev.codeIndexOpenAiKey === SECRET_PLACEHOLDER) {
						updated.codeIndexOpenAiKey = secretStatus.hasOpenAiKey ? SECRET_PLACEHOLDER : ""
					}
					if (!prev.codeIndexQdrantApiKey || prev.codeIndexQdrantApiKey === SECRET_PLACEHOLDER) {
						updated.codeIndexQdrantApiKey = secretStatus.hasQdrantApiKey ? SECRET_PLACEHOLDER : ""
					}
					if (
						!prev.codebaseIndexOpenAiCompatibleApiKey ||
						prev.codebaseIndexOpenAiCompatibleApiKey === SECRET_PLACEHOLDER
					) {
						updated.codebaseIndexOpenAiCompatibleApiKey = secretStatus.hasOpenAiCompatibleApiKey
							? SECRET_PLACEHOLDER
							: ""
					}
					if (!prev.codebaseIndexGeminiApiKey || prev.codebaseIndexGeminiApiKey === SECRET_PLACEHOLDER) {
						updated.codebaseIndexGeminiApiKey = secretStatus.hasGeminiApiKey ? SECRET_PLACEHOLDER : ""
					}
					if (!prev.codebaseIndexMistralApiKey || prev.codebaseIndexMistralApiKey === SECRET_PLACEHOLDER) {
						updated.codebaseIndexMistralApiKey = secretStatus.hasMistralApiKey ? SECRET_PLACEHOLDER : ""
					}
					if (
						!prev.codebaseIndexVercelAiGatewayApiKey ||
						prev.codebaseIndexVercelAiGatewayApiKey === SECRET_PLACEHOLDER
					) {
						updated.codebaseIndexVercelAiGatewayApiKey = secretStatus.hasVercelAiGatewayApiKey
							? SECRET_PLACEHOLDER
							: ""
					}
					if (
						!prev.codebaseIndexOpenRouterApiKey ||
						prev.codebaseIndexOpenRouterApiKey === SECRET_PLACEHOLDER
					) {
						updated.codebaseIndexOpenRouterApiKey = secretStatus.hasOpenRouterApiKey
							? SECRET_PLACEHOLDER
							: ""
					}
					if (!prev.neo4jPassword || prev.neo4jPassword === SECRET_PLACEHOLDER) {
						updated.neo4jPassword = secretStatus.hasNeo4jPassword ? SECRET_PLACEHOLDER : ""
					}

					return updated
				}

				// Only update settings if we're not in the middle of saving
				// After save is complete (saved status), we still want to update to maintain consistency
				if (saveStatus === "idle" || saveStatus === "saved") {
					setCurrentSettings(updateWithSecrets)
					setInitialSettings(updateWithSecrets)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [saveStatus])

	// Generic comparison function that detects changes between initial and current settings
	const hasUnsavedChanges = useMemo(() => {
		// Get all keys from both objects to handle any field
		const allKeys = [...Object.keys(initialSettings), ...Object.keys(currentSettings)] as Array<
			keyof LocalCodeIndexSettings
		>

		// Use a Set to ensure unique keys
		const uniqueKeys = Array.from(new Set(allKeys))

		for (const key of uniqueKeys) {
			const currentValue = currentSettings[key]
			const initialValue = initialSettings[key]

			// For secret fields, check if the value has been modified from placeholder
			if (currentValue === SECRET_PLACEHOLDER) {
				// If it's still showing placeholder, no change
				continue
			}

			// Compare values - handles all types including undefined
			if (currentValue !== initialValue) {
				return true
			}
		}

		return false
	}, [currentSettings, initialSettings])

	const updateSetting = (key: keyof LocalCodeIndexSettings, value: any) => {
		setCurrentSettings((prev) => ({ ...prev, [key]: value }))
		// Clear validation error for this field when user starts typing
		if (formErrors[key]) {
			setFormErrors((prev) => {
				const newErrors = { ...prev }
				delete newErrors[key]
				return newErrors
			})
		}
	}

	// Validation function
	const validateSettings = (): boolean => {
		const schema = createValidationSchema(
			currentSettings.codebaseIndexEmbedderProvider,
			currentSettings.neo4jEnabled,
			t,
		)

		// Prepare data for validation
		const dataToValidate: any = {}
		for (const [key, value] of Object.entries(currentSettings)) {
			// For secret fields with placeholder values, treat them as valid (they exist in backend)
			if (value === SECRET_PLACEHOLDER) {
				// Add a dummy value that will pass validation for these fields
				if (
					key === "codeIndexOpenAiKey" ||
					key === "codebaseIndexOpenAiCompatibleApiKey" ||
					key === "codebaseIndexGeminiApiKey" ||
					key === "codebaseIndexMistralApiKey" ||
					key === "codebaseIndexVercelAiGatewayApiKey" ||
					key === "codebaseIndexOpenRouterApiKey"
				) {
					dataToValidate[key] = "placeholder-valid"
				}
			} else {
				dataToValidate[key] = value
			}
		}

		try {
			// Validate using the schema
			schema.parse(dataToValidate)
			setFormErrors({})
			return true
		} catch (error) {
			if (error instanceof z.ZodError) {
				const errors: Record<string, string> = {}
				error.errors.forEach((err) => {
					if (err.path[0]) {
						errors[err.path[0] as string] = err.message
					}
				})
				setFormErrors(errors)
			}
			return false
		}
	}

	// Discard changes functionality
	const checkUnsavedChanges = useCallback(
		(then: () => void) => {
			if (hasUnsavedChanges) {
				confirmDialogHandler.current = then
				setDiscardDialogShow(true)
			} else {
				then()
			}
		},
		[hasUnsavedChanges],
	)

	const onConfirmDialogResult = useCallback(
		(confirm: boolean) => {
			if (confirm) {
				// Discard changes: Reset to initial settings
				setCurrentSettings(initialSettings)
				setFormErrors({}) // Clear any validation errors
				confirmDialogHandler.current?.() // Execute the pending action (e.g., close popover)
			}
			setDiscardDialogShow(false)
		},
		[initialSettings],
	)

	// Handle popover close with unsaved changes check
	const handlePopoverClose = useCallback(() => {
		checkUnsavedChanges(() => {
			setOpen(false)
		})
	}, [checkUnsavedChanges])

	// Use the shared ESC key handler hook - respects unsaved changes logic
	useEscapeKey(open, handlePopoverClose)

	const handleSaveSettings = () => {
		// Validate settings before saving
		if (!validateSettings()) {
			return
		}

		setSaveStatus("saving")
		setSaveError(null)

		// Prepare settings to save
		const settingsToSave: any = {}

		// Iterate through all current settings
		for (const [key, value] of Object.entries(currentSettings)) {
			// For secret fields with placeholder, don't send the placeholder
			// but also don't send an empty string - just skip the field
			// This tells the backend to keep the existing secret
			if (value === SECRET_PLACEHOLDER) {
				// Skip sending placeholder values - backend will preserve existing secrets
				continue
			}

			// Include all other fields, including empty strings (which clear secrets)
			settingsToSave[key] = value
		}

		// Always include codebaseIndexEnabled to ensure it's persisted
		settingsToSave.codebaseIndexEnabled = currentSettings.codebaseIndexEnabled

		console.log("[CodeIndexPopover] Saving settings to backend:", settingsToSave)

		// Save settings to backend
		vscode.postMessage({
			type: "saveCodeIndexSettingsAtomic",
			codeIndexSettings: settingsToSave,
		})
	}

	const progressPercentage = useMemo(
		() =>
			indexingStatus.totalItems > 0
				? Math.round((indexingStatus.processedItems / indexingStatus.totalItems) * 100)
				: 0,
		[indexingStatus.processedItems, indexingStatus.totalItems],
	)

	const transformStyleString = `translateX(-${100 - progressPercentage}%)`

	// Neo4j graph indexing progress calculation
	const neo4jProgressPercentage = useMemo(
		() =>
			(indexingStatus.neo4jTotalItems || 0) > 0
				? Math.round(((indexingStatus.neo4jProcessedItems || 0) / (indexingStatus.neo4jTotalItems || 0)) * 100)
				: 0,
		[indexingStatus.neo4jProcessedItems, indexingStatus.neo4jTotalItems],
	)

	const neo4jTransformStyleString = `translateX(-${100 - neo4jProgressPercentage}%)`

	const getAvailableModels = () => {
		if (!codebaseIndexModels) return []

		const models = codebaseIndexModels[currentSettings.codebaseIndexEmbedderProvider]
		return models ? Object.keys(models) : []
	}

	const portalContainer = useRooPortal("roo-portal")

	return (
		<>
			<Popover
				open={open}
				onOpenChange={(newOpen) => {
					if (!newOpen) {
						// User is trying to close the popover
						handlePopoverClose()
					} else {
						setOpen(newOpen)
					}
				}}>
				{children}
				<PopoverContent
					className="w-[calc(100vw-32px)] max-w-[450px] max-h-[80vh] overflow-y-auto p-0"
					align="end"
					alignOffset={0}
					side="bottom"
					sideOffset={5}
					collisionPadding={16}
					avoidCollisions={true}
					container={portalContainer}>
					<div className="p-3 border-b border-vscode-dropdown-border cursor-default">
						<div className="flex flex-row items-center gap-1 p-0 mt-0 mb-1 w-full">
							<h4 className="m-0 pb-2 flex-1">{t("settings:codeIndex.title")}</h4>
						</div>
						<p className="my-0 pr-4 text-sm w-full">
							<Trans i18nKey="settings:codeIndex.description">
								<VSCodeLink
									href={buildDocLink("features/experimental/codebase-indexing", "settings")}
									style={{ display: "inline" }}
								/>
							</Trans>
						</p>
					</div>

					<div className="p-4">
						{/* Enable/Disable Toggle */}
						<div className="mb-4">
							<div className="flex items-center gap-2">
								<VSCodeCheckbox
									checked={currentSettings.codebaseIndexEnabled}
									onChange={(e: any) => updateSetting("codebaseIndexEnabled", e.target.checked)}>
									<span className="font-medium">{t("settings:codeIndex.enableLabel")}</span>
								</VSCodeCheckbox>
								<StandardTooltip content={t("settings:codeIndex.enableDescription")}>
									<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
								</StandardTooltip>
							</div>
						</div>

						{/* Status Section */}
						<div className="space-y-2">
							<h4 className="text-sm font-medium">{t("settings:codeIndex.statusTitle")}</h4>

							{/* Overall Status Indicator */}
							<div className="text-sm text-vscode-descriptionForeground">
								<span
									className={cn("inline-block w-3 h-3 rounded-full mr-2", {
										"bg-gray-400": indexingStatus.systemStatus === "Standby",
										"bg-yellow-500 animate-pulse": indexingStatus.systemStatus === "Indexing",
										"bg-green-500": indexingStatus.systemStatus === "Indexed",
										"bg-red-500": indexingStatus.systemStatus === "Error",
									})}
								/>
								{t(`settings:codeIndex.indexingStatuses.${indexingStatus.systemStatus.toLowerCase()}`)}
								{indexingStatus.message ? ` - ${indexingStatus.message}` : ""}
							</div>

							{/* Vector Index Progress (Qdrant) */}
							{indexingStatus.systemStatus === "Indexing" && (
								<div className="mt-3 space-y-2">
									<div className="text-xs text-vscode-descriptionForeground font-medium">
										Vector Index: {indexingStatus.processedItems} / {indexingStatus.totalItems}{" "}
										{indexingStatus.currentItemUnit}
									</div>
									<ProgressPrimitive.Root
										className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
										value={progressPercentage}>
										<ProgressPrimitive.Indicator
											className="h-full w-full flex-1 bg-primary transition-transform duration-300 ease-in-out"
											style={{
												transform: transformStyleString,
											}}
										/>
									</ProgressPrimitive.Root>
								</div>
							)}

							{/* Neo4j Graph Index Progress - Only show if Neo4j is enabled */}
							{currentSettings.neo4jEnabled &&
								indexingStatus.neo4jStatus &&
								indexingStatus.neo4jStatus !== "disabled" && (
									<div className="mt-3 space-y-2">
										<div className="flex items-center gap-2">
											<span
												className={cn("inline-block w-2 h-2 rounded-full", {
													"bg-gray-400": indexingStatus.neo4jStatus === "idle",
													"bg-yellow-500 animate-pulse":
														indexingStatus.neo4jStatus === "indexing",
													"bg-green-500": indexingStatus.neo4jStatus === "indexed",
													"bg-red-500": indexingStatus.neo4jStatus === "error",
												})}
											/>
											<span className="text-xs text-vscode-descriptionForeground font-medium">
												Graph Index (Neo4j):{" "}
												{indexingStatus.neo4jStatus === "indexing" ||
												indexingStatus.neo4jStatus === "indexed"
													? `${indexingStatus.neo4jProcessedItems || 0} / ${indexingStatus.neo4jTotalItems || 0} files`
													: indexingStatus.neo4jStatus === "error"
														? "Error"
														: "Ready"}
											</span>
										</div>

										{indexingStatus.neo4jStatus === "indexing" && (
											<ProgressPrimitive.Root
												className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
												value={neo4jProgressPercentage}>
												<ProgressPrimitive.Indicator
													className="h-full w-full flex-1 bg-green-600 transition-transform duration-300 ease-in-out"
													style={{
														transform: neo4jTransformStyleString,
													}}
												/>
											</ProgressPrimitive.Root>
										)}

										{indexingStatus.neo4jStatus === "error" && indexingStatus.neo4jMessage && (
											<div className="text-xs text-vscode-errorForeground mt-1">
												⚠ {indexingStatus.neo4jMessage}
											</div>
										)}

										{indexingStatus.neo4jStatus === "indexed" && indexingStatus.neo4jMessage && (
											<div className="text-xs text-vscode-descriptionForeground mt-1">
												{indexingStatus.neo4jMessage}
											</div>
										)}
									</div>
								)}
						</div>

						{/* Setup Settings Disclosure */}
						<div className="mt-4">
							<button
								onClick={() => setIsSetupSettingsOpen(!isSetupSettingsOpen)}
								className="flex items-center text-xs text-vscode-foreground hover:text-vscode-textLink-foreground focus:outline-none"
								aria-expanded={isSetupSettingsOpen}>
								<span
									className={`codicon codicon-${isSetupSettingsOpen ? "chevron-down" : "chevron-right"} mr-1`}></span>
								<span className="text-base font-semibold">
									{t("settings:codeIndex.setupConfigLabel")}
								</span>
							</button>

							{isSetupSettingsOpen && (
								<div className="mt-4 space-y-4">
									{/* Embedder Provider Section */}
									<div className="space-y-2">
										<label className="text-sm font-medium">
											{t("settings:codeIndex.embedderProviderLabel")}
										</label>
										<Select
											value={currentSettings.codebaseIndexEmbedderProvider}
											onValueChange={(value: EmbedderProvider) => {
												updateSetting("codebaseIndexEmbedderProvider", value)
												// Clear model selection when switching providers
												updateSetting("codebaseIndexEmbedderModelId", "")
											}}>
											<SelectTrigger className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="openai">
													{t("settings:codeIndex.openaiProvider")}
												</SelectItem>
												<SelectItem value="ollama">
													{t("settings:codeIndex.ollamaProvider")}
												</SelectItem>
												<SelectItem value="openai-compatible">
													{t("settings:codeIndex.openaiCompatibleProvider")}
												</SelectItem>
												<SelectItem value="gemini">
													{t("settings:codeIndex.geminiProvider")}
												</SelectItem>
												<SelectItem value="mistral">
													{t("settings:codeIndex.mistralProvider")}
												</SelectItem>
												<SelectItem value="vercel-ai-gateway">
													{t("settings:codeIndex.vercelAiGatewayProvider")}
												</SelectItem>
												<SelectItem value="openrouter">
													{t("settings:codeIndex.openRouterProvider")}
												</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{/* Provider-specific settings */}
									{currentSettings.codebaseIndexEmbedderProvider === "openai" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.openAiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codeIndexOpenAiKey || ""}
													onInput={(e: any) =>
														updateSetting("codeIndexOpenAiKey", e.target.value)
													}
													placeholder={t("settings:codeIndex.openAiKeyPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codeIndexOpenAiKey,
													})}
												/>
												{formErrors.codeIndexOpenAiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codeIndexOpenAiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeDropdown
													value={currentSettings.codebaseIndexEmbedderModelId}
													onChange={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}>
													<VSCodeOption value="" className="p-2">
														{t("settings:codeIndex.selectModel")}
													</VSCodeOption>
													{getAvailableModels().map((modelId) => {
														const model =
															codebaseIndexModels?.[
																currentSettings.codebaseIndexEmbedderProvider
															]?.[modelId]
														return (
															<VSCodeOption key={modelId} value={modelId} className="p-2">
																{modelId}{" "}
																{model
																	? t("settings:codeIndex.modelDimensions", {
																			dimension: model.dimension,
																		})
																	: ""}
															</VSCodeOption>
														)
													})}
												</VSCodeDropdown>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "ollama" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.ollamaBaseUrlLabel")}
												</label>
												<VSCodeTextField
													value={currentSettings.codebaseIndexEmbedderBaseUrl || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexEmbedderBaseUrl", e.target.value)
													}
													onBlur={(e: any) => {
														// Set default Ollama URL if field is empty
														if (!e.target.value.trim()) {
															e.target.value = DEFAULT_OLLAMA_URL
															updateSetting(
																"codebaseIndexEmbedderBaseUrl",
																DEFAULT_OLLAMA_URL,
															)
														}
													}}
													placeholder={t("settings:codeIndex.ollamaUrlPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderBaseUrl,
													})}
												/>
												{formErrors.codebaseIndexEmbedderBaseUrl && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderBaseUrl}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeTextField
													value={currentSettings.codebaseIndexEmbedderModelId || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													placeholder={t("settings:codeIndex.modelPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}
												/>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelDimensionLabel")}
												</label>
												<VSCodeTextField
													value={
														currentSettings.codebaseIndexEmbedderModelDimension?.toString() ||
														""
													}
													onInput={(e: any) => {
														const value = e.target.value
															? parseInt(e.target.value, 10) || undefined
															: undefined
														updateSetting("codebaseIndexEmbedderModelDimension", value)
													}}
													placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
													className={cn("w-full", {
														"border-red-500":
															formErrors.codebaseIndexEmbedderModelDimension,
													})}
												/>
												{formErrors.codebaseIndexEmbedderModelDimension && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelDimension}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "openai-compatible" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.openAiCompatibleBaseUrlLabel")}
												</label>
												<VSCodeTextField
													value={currentSettings.codebaseIndexOpenAiCompatibleBaseUrl || ""}
													onInput={(e: any) =>
														updateSetting(
															"codebaseIndexOpenAiCompatibleBaseUrl",
															e.target.value,
														)
													}
													placeholder={t(
														"settings:codeIndex.openAiCompatibleBaseUrlPlaceholder",
													)}
													className={cn("w-full", {
														"border-red-500":
															formErrors.codebaseIndexOpenAiCompatibleBaseUrl,
													})}
												/>
												{formErrors.codebaseIndexOpenAiCompatibleBaseUrl && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexOpenAiCompatibleBaseUrl}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.openAiCompatibleApiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codebaseIndexOpenAiCompatibleApiKey || ""}
													onInput={(e: any) =>
														updateSetting(
															"codebaseIndexOpenAiCompatibleApiKey",
															e.target.value,
														)
													}
													placeholder={t(
														"settings:codeIndex.openAiCompatibleApiKeyPlaceholder",
													)}
													className={cn("w-full", {
														"border-red-500":
															formErrors.codebaseIndexOpenAiCompatibleApiKey,
													})}
												/>
												{formErrors.codebaseIndexOpenAiCompatibleApiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexOpenAiCompatibleApiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeTextField
													value={currentSettings.codebaseIndexEmbedderModelId || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													placeholder={t("settings:codeIndex.modelPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}
												/>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelDimensionLabel")}
												</label>
												<VSCodeTextField
													value={
														currentSettings.codebaseIndexEmbedderModelDimension?.toString() ||
														""
													}
													onInput={(e: any) => {
														const value = e.target.value
															? parseInt(e.target.value, 10) || undefined
															: undefined
														updateSetting("codebaseIndexEmbedderModelDimension", value)
													}}
													placeholder={t("settings:codeIndex.modelDimensionPlaceholder")}
													className={cn("w-full", {
														"border-red-500":
															formErrors.codebaseIndexEmbedderModelDimension,
													})}
												/>
												{formErrors.codebaseIndexEmbedderModelDimension && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelDimension}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "gemini" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.geminiApiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codebaseIndexGeminiApiKey || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexGeminiApiKey", e.target.value)
													}
													placeholder={t("settings:codeIndex.geminiApiKeyPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexGeminiApiKey,
													})}
												/>
												{formErrors.codebaseIndexGeminiApiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexGeminiApiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeDropdown
													value={currentSettings.codebaseIndexEmbedderModelId}
													onChange={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}>
													<VSCodeOption value="" className="p-2">
														{t("settings:codeIndex.selectModel")}
													</VSCodeOption>
													{getAvailableModels().map((modelId) => {
														const model =
															codebaseIndexModels?.[
																currentSettings.codebaseIndexEmbedderProvider
															]?.[modelId]
														return (
															<VSCodeOption key={modelId} value={modelId} className="p-2">
																{modelId}{" "}
																{model
																	? t("settings:codeIndex.modelDimensions", {
																			dimension: model.dimension,
																		})
																	: ""}
															</VSCodeOption>
														)
													})}
												</VSCodeDropdown>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "mistral" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.mistralApiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codebaseIndexMistralApiKey || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexMistralApiKey", e.target.value)
													}
													placeholder={t("settings:codeIndex.mistralApiKeyPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexMistralApiKey,
													})}
												/>
												{formErrors.codebaseIndexMistralApiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexMistralApiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeDropdown
													value={currentSettings.codebaseIndexEmbedderModelId}
													onChange={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}>
													<VSCodeOption value="" className="p-2">
														{t("settings:codeIndex.selectModel")}
													</VSCodeOption>
													{getAvailableModels().map((modelId) => {
														const model =
															codebaseIndexModels?.[
																currentSettings.codebaseIndexEmbedderProvider
															]?.[modelId]
														return (
															<VSCodeOption key={modelId} value={modelId} className="p-2">
																{modelId}{" "}
																{model
																	? t("settings:codeIndex.modelDimensions", {
																			dimension: model.dimension,
																		})
																	: ""}
															</VSCodeOption>
														)
													})}
												</VSCodeDropdown>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "vercel-ai-gateway" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.vercelAiGatewayApiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codebaseIndexVercelAiGatewayApiKey || ""}
													onInput={(e: any) =>
														updateSetting(
															"codebaseIndexVercelAiGatewayApiKey",
															e.target.value,
														)
													}
													placeholder={t(
														"settings:codeIndex.vercelAiGatewayApiKeyPlaceholder",
													)}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexVercelAiGatewayApiKey,
													})}
												/>
												{formErrors.codebaseIndexVercelAiGatewayApiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexVercelAiGatewayApiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeDropdown
													value={currentSettings.codebaseIndexEmbedderModelId}
													onChange={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}>
													<VSCodeOption value="" className="p-2">
														{t("settings:codeIndex.selectModel")}
													</VSCodeOption>
													{getAvailableModels().map((modelId) => {
														const model =
															codebaseIndexModels?.[
																currentSettings.codebaseIndexEmbedderProvider
															]?.[modelId]
														return (
															<VSCodeOption key={modelId} value={modelId} className="p-2">
																{modelId}{" "}
																{model
																	? t("settings:codeIndex.modelDimensions", {
																			dimension: model.dimension,
																		})
																	: ""}
															</VSCodeOption>
														)
													})}
												</VSCodeDropdown>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>
										</>
									)}

									{currentSettings.codebaseIndexEmbedderProvider === "openrouter" && (
										<>
											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.openRouterApiKeyLabel")}
												</label>
												<VSCodeTextField
													type="password"
													value={currentSettings.codebaseIndexOpenRouterApiKey || ""}
													onInput={(e: any) =>
														updateSetting("codebaseIndexOpenRouterApiKey", e.target.value)
													}
													placeholder={t("settings:codeIndex.openRouterApiKeyPlaceholder")}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexOpenRouterApiKey,
													})}
												/>
												{formErrors.codebaseIndexOpenRouterApiKey && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexOpenRouterApiKey}
													</p>
												)}
											</div>

											<div className="space-y-2">
												<label className="text-sm font-medium">
													{t("settings:codeIndex.modelLabel")}
												</label>
												<VSCodeDropdown
													value={currentSettings.codebaseIndexEmbedderModelId}
													onChange={(e: any) =>
														updateSetting("codebaseIndexEmbedderModelId", e.target.value)
													}
													className={cn("w-full", {
														"border-red-500": formErrors.codebaseIndexEmbedderModelId,
													})}>
													<VSCodeOption value="" className="p-2">
														{t("settings:codeIndex.selectModel")}
													</VSCodeOption>
													{getAvailableModels().map((modelId) => {
														const model =
															codebaseIndexModels?.[
																currentSettings.codebaseIndexEmbedderProvider
															]?.[modelId]
														return (
															<VSCodeOption key={modelId} value={modelId} className="p-2">
																{modelId}{" "}
																{model
																	? t("settings:codeIndex.modelDimensions", {
																			dimension: model.dimension,
																		})
																	: ""}
															</VSCodeOption>
														)
													})}
												</VSCodeDropdown>
												{formErrors.codebaseIndexEmbedderModelId && (
													<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
														{formErrors.codebaseIndexEmbedderModelId}
													</p>
												)}
											</div>
										</>
									)}

									{/* Qdrant Settings */}
									<div className="space-y-2">
										<label className="text-sm font-medium">
											{t("settings:codeIndex.qdrantUrlLabel")}
										</label>
										<VSCodeTextField
											value={currentSettings.codebaseIndexQdrantUrl || ""}
											onInput={(e: any) =>
												updateSetting("codebaseIndexQdrantUrl", e.target.value)
											}
											onBlur={(e: any) => {
												// Set default Qdrant URL if field is empty
												if (!e.target.value.trim()) {
													currentSettings.codebaseIndexQdrantUrl = DEFAULT_QDRANT_URL
													updateSetting("codebaseIndexQdrantUrl", DEFAULT_QDRANT_URL)
												}
											}}
											placeholder={t("settings:codeIndex.qdrantUrlPlaceholder")}
											className={cn("w-full", {
												"border-red-500": formErrors.codebaseIndexQdrantUrl,
											})}
										/>
										{formErrors.codebaseIndexQdrantUrl && (
											<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
												{formErrors.codebaseIndexQdrantUrl}
											</p>
										)}
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">
											{t("settings:codeIndex.qdrantApiKeyLabel")}
										</label>
										<VSCodeTextField
											type="password"
											value={currentSettings.codeIndexQdrantApiKey || ""}
											onInput={(e: any) => updateSetting("codeIndexQdrantApiKey", e.target.value)}
											placeholder={t("settings:codeIndex.qdrantApiKeyPlaceholder")}
											className={cn("w-full", {
												"border-red-500": formErrors.codeIndexQdrantApiKey,
											})}
										/>
										{formErrors.codeIndexQdrantApiKey && (
											<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
												{formErrors.codeIndexQdrantApiKey}
											</p>
										)}
									</div>
								</div>
							)}
						</div>

						{/* Neo4j Graph Database Section - OPTIONAL */}
						<div className="mt-4">
							<div className="space-y-3 p-3 border border-vscode-panel-border rounded">
								<div className="flex items-center justify-between">
									<h4 className="text-sm font-semibold">Graph Database (Neo4j) - OPTIONAL</h4>
								</div>

								<VSCodeCheckbox
									checked={currentSettings.neo4jEnabled}
									onChange={(e: any) => updateSetting("neo4jEnabled", e.target.checked)}>
									Enable Neo4j Graph Index
								</VSCodeCheckbox>

								<p className="text-xs text-vscode-descriptionForeground">
									Add graph-based code relationships for enhanced context understanding. Neo4j is
									optional and disabled by default.
								</p>

								{currentSettings.neo4jEnabled && (
									<div className="space-y-3 ml-6">
										<div className="space-y-2">
											<label className="text-sm font-medium">URI</label>
											<VSCodeTextField
												value={currentSettings.neo4jUri || ""}
												onInput={(e: any) => updateSetting("neo4jUri", e.target.value)}
												placeholder="bolt://localhost:7687 or neo4j+s://xxxxx.databases.neo4j.io"
												className={cn("w-full", {
													"border-red-500": formErrors.neo4jUri,
												})}
											/>
											{formErrors.neo4jUri && (
												<p className="text-xs text-vscode-errorForeground mt-1 mb-0">
													{formErrors.neo4jUri}
												</p>
											)}
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium">Username</label>
											<VSCodeTextField
												value={currentSettings.neo4jUsername || ""}
												onInput={(e: any) => updateSetting("neo4jUsername", e.target.value)}
												placeholder="neo4j"
												className="w-full"
											/>
										</div>

										<div className="space-y-2">
											<label className="text-sm font-medium">Password</label>
											<VSCodeTextField
												type="password"
												value={currentSettings.neo4jPassword || ""}
												onInput={(e: any) => updateSetting("neo4jPassword", e.target.value)}
												placeholder={
													currentSettings.neo4jPassword === SECRET_PLACEHOLDER
														? SECRET_PLACEHOLDER
														: ""
												}
												className="w-full"
											/>
										</div>

										<div className="text-xs text-vscode-descriptionForeground bg-vscode-editor-background p-2 rounded space-y-1">
											<p>
												<strong>💡 Local:</strong> bolt://localhost:7687
											</p>
											<p>
												<strong>💡 Cloud (Neo4j Aura):</strong>{" "}
												neo4j+s://xxxxx.databases.neo4j.io
											</p>
											<p className="mt-2">
												<strong>Quick Start (Docker):</strong>
											</p>
											<code className="block mt-1 p-1 bg-vscode-input-background rounded text-xs">
												docker run -p 7687:7687 -p 7474:7474 neo4j:latest
											</code>
											<p className="mt-2">
												<VSCodeLink href="https://neo4j.com/cloud/aura-free/" target="_blank">
													Get free Neo4j Aura account →
												</VSCodeLink>
											</p>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Advanced Settings Disclosure */}
						<div className="mt-4">
							<button
								onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
								className="flex items-center text-xs text-vscode-foreground hover:text-vscode-textLink-foreground focus:outline-none"
								aria-expanded={isAdvancedSettingsOpen}>
								<span
									className={`codicon codicon-${isAdvancedSettingsOpen ? "chevron-down" : "chevron-right"} mr-1`}></span>
								<span className="text-base font-semibold">
									{t("settings:codeIndex.advancedConfigLabel")}
								</span>
							</button>

							{isAdvancedSettingsOpen && (
								<div className="mt-4 space-y-4">
									{/* Search Score Threshold Slider */}
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<label className="text-sm font-medium">
												{t("settings:codeIndex.searchMinScoreLabel")}
											</label>
											<StandardTooltip
												content={t("settings:codeIndex.searchMinScoreDescription")}>
												<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
											</StandardTooltip>
										</div>
										<div className="flex items-center gap-2">
											<Slider
												min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_SCORE}
												max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_SCORE}
												step={CODEBASE_INDEX_DEFAULTS.SEARCH_SCORE_STEP}
												value={[
													currentSettings.codebaseIndexSearchMinScore ??
														CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
												]}
												onValueChange={(values) =>
													updateSetting("codebaseIndexSearchMinScore", values[0])
												}
												className="flex-1"
												data-testid="search-min-score-slider"
											/>
											<span className="w-12 text-center">
												{(
													currentSettings.codebaseIndexSearchMinScore ??
													CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE
												).toFixed(2)}
											</span>
											<VSCodeButton
												appearance="icon"
												title={t("settings:codeIndex.resetToDefault")}
												onClick={() =>
													updateSetting(
														"codebaseIndexSearchMinScore",
														CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_MIN_SCORE,
													)
												}>
												<span className="codicon codicon-discard" />
											</VSCodeButton>
										</div>
									</div>

									{/* Maximum Search Results Slider */}
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<label className="text-sm font-medium">
												{t("settings:codeIndex.searchMaxResultsLabel")}
											</label>
											<StandardTooltip
												content={t("settings:codeIndex.searchMaxResultsDescription")}>
												<span className="codicon codicon-info text-xs text-vscode-descriptionForeground cursor-help" />
											</StandardTooltip>
										</div>
										<div className="flex items-center gap-2">
											<Slider
												min={CODEBASE_INDEX_DEFAULTS.MIN_SEARCH_RESULTS}
												max={CODEBASE_INDEX_DEFAULTS.MAX_SEARCH_RESULTS}
												step={CODEBASE_INDEX_DEFAULTS.SEARCH_RESULTS_STEP}
												value={[
													currentSettings.codebaseIndexSearchMaxResults ??
														CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
												]}
												onValueChange={(values) =>
													updateSetting("codebaseIndexSearchMaxResults", values[0])
												}
												className="flex-1"
												data-testid="search-max-results-slider"
											/>
											<span className="w-12 text-center">
												{currentSettings.codebaseIndexSearchMaxResults ??
													CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS}
											</span>
											<VSCodeButton
												appearance="icon"
												title={t("settings:codeIndex.resetToDefault")}
												onClick={() =>
													updateSetting(
														"codebaseIndexSearchMaxResults",
														CODEBASE_INDEX_DEFAULTS.DEFAULT_SEARCH_RESULTS,
													)
												}>
												<span className="codicon codicon-discard" />
											</VSCodeButton>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Action Buttons */}
						<div className="flex items-center justify-between gap-2 pt-6">
							<div className="flex gap-2">
								{/* Start/Cancel Toggle Button - Only show when indexing is enabled */}
								{currentSettings.codebaseIndexEnabled && (
									<>
										{/* Show "Start Indexing" when status is Standby or Error */}
										{(indexingStatus.systemStatus === "Standby" ||
											indexingStatus.systemStatus === "Error") && (
											<Button
												onClick={() => vscode.postMessage({ type: "startIndexing" })}
												disabled={saveStatus === "saving" || hasUnsavedChanges}>
												{t("settings:codeIndex.startIndexingButton")}
											</Button>
										)}

										{/* Show "Cancel Indexing" when status is Indexing */}
										{indexingStatus.systemStatus === "Indexing" && (
											<Button
												variant="secondary"
												onClick={() => vscode.postMessage({ type: "cancelIndexing" })}>
												{t("settings:codeIndex.cancelIndexingButton") || "Cancel Indexing"}
											</Button>
										)}
									</>
								)}

								{/* Delete Index Button - Always visible regardless of status */}
								{/* This allows users to delete the index at any time */}
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button variant="destructive">
											{t("settings:codeIndex.deleteIndexButton") || "Delete Index"}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{t("settings:codeIndex.deleteIndexDialog.title") || "Delete Index Data"}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{indexingStatus.systemStatus === "Indexing"
													? t(
															"settings:codeIndex.deleteIndexDialog.descriptionWhileIndexing",
														) ||
														"This will stop the current indexing operation and delete all index data (both Qdrant and Neo4j). This action cannot be undone. Are you sure?"
													: t("settings:codeIndex.deleteIndexDialog.description") ||
														"This will delete all index data (both Qdrant and Neo4j). This action cannot be undone. Are you sure?"}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												{t("settings:codeIndex.deleteIndexDialog.cancelButton") || "Cancel"}
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
												{t("settings:codeIndex.deleteIndexDialog.confirmButton") ||
													"Delete Index"}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>

							<Button
								onClick={handleSaveSettings}
								disabled={!hasUnsavedChanges || saveStatus === "saving"}>
								{saveStatus === "saving"
									? t("settings:codeIndex.saving")
									: t("settings:codeIndex.saveSettings")}
							</Button>
						</div>

						{/* Save Status Messages */}
						{saveStatus === "error" && (
							<div className="mt-2">
								<span className="text-sm text-vscode-errorForeground block">
									{saveError || t("settings:codeIndex.saveError")}
								</span>
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>

			{/* Discard Changes Dialog */}
			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<AlertTriangle className="w-5 h-5 text-yellow-500" />
							{t("settings:unsavedChangesDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:unsavedChangesDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
							{t("settings:unsavedChangesDialog.cancelButton")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
							{t("settings:unsavedChangesDialog.discardButton")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
