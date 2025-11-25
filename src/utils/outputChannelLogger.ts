import * as vscode from "vscode"

export type LogFunction = (...args: unknown[]) => void

/**
 * Creates a logging function that writes to a VSCode output channel
 * Based on the outputChannelLog implementation from src/extension/api.ts
 */
export function createOutputChannelLogger(outputChannel: vscode.OutputChannel): LogFunction {
	return (...args: unknown[]) => {
		for (const arg of args) {
			if (arg === null) {
				outputChannel.appendLine("null")
			} else if (arg === undefined) {
				outputChannel.appendLine("undefined")
			} else if (typeof arg === "string") {
				outputChannel.appendLine(arg)
			} else if (arg instanceof Error) {
				// Enhanced error serialization with full context preservation
				const errorInfo: Record<string, any> = {
					name: arg.name,
					message: arg.message,
					stack: arg.stack,
				}

				// Include additional error properties if they exist
				if ("code" in arg) errorInfo.code = (arg as any).code
				if ("status" in arg) errorInfo.status = (arg as any).status
				if ("statusCode" in arg) errorInfo.statusCode = (arg as any).statusCode
				if ("statusText" in arg) errorInfo.statusText = (arg as any).statusText
				if ("response" in arg) errorInfo.response = (arg as any).response
				if ("config" in arg) errorInfo.config = (arg as any).config
				if ("request" in arg) errorInfo.request = (arg as any).request
				if ("cause" in arg) errorInfo.cause = (arg as any).cause

				// Add any custom enumerable properties
				for (const key of Object.getOwnPropertyNames(arg)) {
					if (!["name", "message", "stack"].includes(key)) {
						try {
							const value = (arg as any)[key]
							if (value !== undefined) {
								errorInfo[key] = value
							}
						} catch (accessError) {
							// Skip properties that can't be accessed
							errorInfo[key] =
								`[Access Error: ${accessError instanceof Error ? accessError.message : String(accessError)}]`
						}
					}
				}

				outputChannel.appendLine(`Error: ${JSON.stringify(errorInfo, null, 2)}`)
			} else {
				try {
					outputChannel.appendLine(
						JSON.stringify(
							arg,
							(key, value) => {
								if (typeof value === "bigint") return `BigInt(${value})`
								if (typeof value === "function") return `Function: ${value.name || "anonymous"}`
								if (typeof value === "symbol") return value.toString()
								if (value instanceof Error) {
									// Handle nested errors with enhanced serialization
									return {
										name: value.name,
										message: value.message,
										stack: value.stack,
										// Preserve additional error properties
										...((value as any).code && { code: (value as any).code }),
										...((value as any).status && { status: (value as any).status }),
										...((value as any).statusCode && { statusCode: (value as any).statusCode }),
									}
								}
								return value
							},
							2,
						),
					)
				} catch (error) {
					// Enhanced error reporting for serialization failures
					const errorDetails =
						error instanceof Error
							? {
									message: error.message,
									stack: error.stack,
									name: error.name,
								}
							: String(error)

					outputChannel.appendLine(`[Non-serializable object: ${Object.prototype.toString.call(arg)}]`)
					outputChannel.appendLine(`[Serialization error: ${JSON.stringify(errorDetails, null, 2)}]`)

					// Try to provide basic object information as fallback
					try {
						const basicInfo = {
							type: typeof arg,
							constructor: arg?.constructor?.name,
							toString: arg?.toString?.(),
							keys: Object.keys(arg || {}),
							length: (arg as any)?.length,
						}
						outputChannel.appendLine(`[Fallback object info: ${JSON.stringify(basicInfo, null, 2)}]`)
					} catch (fallbackError) {
						outputChannel.appendLine(
							`[Fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}]`,
						)
					}
				}
			}
		}
	}
}

/**
 * Creates a logging function that logs to both the output channel and console
 * Following the pattern from src/extension/api.ts
 */
export function createDualLogger(outputChannelLog: LogFunction): LogFunction {
	return (...args: unknown[]) => {
		outputChannelLog(...args)
		console.log(...args)
	}
}
