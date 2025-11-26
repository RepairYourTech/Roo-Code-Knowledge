import * as vscode from "vscode"
import { createOutputChannelLogger, type LogFunction } from "../utils/outputChannelLogger"

/**
 * Log levels in order of severity (lowest to highest)
 */
export enum LogLevel {
	Off = 0,
	Error = 1,
	Warn = 2,
	Info = 3,
	Debug = 4,
	Trace = 5,
}

/**
 * Type representing the names of log levels
 */
export type LogLevelName = "off" | "error" | "warn" | "info" | "debug" | "trace"

/**
 * Map of log level names to their numeric values
 */
export const LogLevelMap: Record<LogLevelName, LogLevel> = {
	off: LogLevel.Off,
	error: LogLevel.Error,
	warn: LogLevel.Warn,
	info: LogLevel.Info,
	debug: LogLevel.Debug,
	trace: LogLevel.Trace,
}

/**
 * Map of log level values to their names
 */
export const LogLevelNameMap: Record<LogLevel, LogLevelName> = {
	[LogLevel.Off]: "off",
	[LogLevel.Error]: "error",
	[LogLevel.Warn]: "warn",
	[LogLevel.Info]: "info",
	[LogLevel.Debug]: "debug",
	[LogLevel.Trace]: "trace",
}

/**
 * Map of log level values to their display prefixes
 */
export const LogLevelPrefixMap: Record<LogLevel, string> = {
	[LogLevel.Off]: "",
	[LogLevel.Error]: "[ERROR]",
	[LogLevel.Warn]: "[WARN]",
	[LogLevel.Info]: "[INFO]",
	[LogLevel.Debug]: "[DEBUG]",
	[LogLevel.Trace]: "[TRACE]",
}

/**
 * Logger interface defining the public API
 */
export interface ILogger {
	/** Logs an error message */
	error(...args: unknown[]): void
	/** Logs a warning message */
	warn(...args: unknown[]): void
	/** Logs an info message */
	info(...args: unknown[]): void
	/** Logs a debug message */
	debug(...args: unknown[]): void
	/** Logs a trace message */
	trace(...args: unknown[]): void
	/** Sets the current log level */
	setLogLevel(level: LogLevel): void
	/** Gets the current log level */
	getLogLevel(): LogLevel
	/** Sets the log level by name */
	setLogLevelByName(levelName: LogLevelName): void
	/** Gets the current log level name */
	getLogLevelName(): LogLevelName
	/** Creates a child logger with a specific prefix */
	child(prefix: string): ILogger
}

/**
 * A comprehensive logger class with log level filtering capabilities
 */
export class Logger implements ILogger {
	private currentLevel: LogLevel
	private outputChannelLogger: LogFunction

	/**
	 * Creates a new Logger instance
	 * @param outputChannel The VSCode output channel to write logs to
	 * @param initialLevel The initial log level (default: Info)
	 */
	constructor(outputChannel: vscode.OutputChannel, initialLevel: LogLevel = LogLevel.Info) {
		this.currentLevel = initialLevel
		this.outputChannelLogger = createOutputChannelLogger(outputChannel)
	}

	/**
	 * Sets the current log level
	 * @param level The new log level
	 */
	setLogLevel(level: LogLevel): void {
		this.currentLevel = level
	}

	/**
	 * Gets the current log level
	 * @returns The current log level
	 */
	getLogLevel(): LogLevel {
		return this.currentLevel
	}

	/**
	 * Sets the log level by name
	 * @param levelName The name of the log level
	 */
	setLogLevelByName(levelName: LogLevelName): void {
		this.currentLevel = LogLevelMap[levelName]
	}

	/**
	 * Gets the current log level name
	 * @returns The current log level name
	 */
	getLogLevelName(): LogLevelName {
		return LogLevelNameMap[this.currentLevel]
	}

	/**
	 * Checks if a given log level should be logged based on the current level
	 * @param level The level to check
	 * @returns True if the level should be logged, false otherwise
	 */
	private shouldLog(level: LogLevel): boolean {
		return this.currentLevel >= level && this.currentLevel !== LogLevel.Off
	}

	/**
	 * Internal method to log a message with a specific level
	 * @param level The log level
	 * @param args The arguments to log
	 */
	private logWithLevel(level: LogLevel, ...args: unknown[]): void {
		if (!this.shouldLog(level)) {
			return
		}

		const prefix = LogLevelPrefixMap[level]
		const timestamp = new Date().toISOString()

		// Create a single formatted message with timestamp and prefix
		const formattedMessage = `${timestamp} ${prefix} ${args
			.map((arg) => (typeof arg === "string" ? arg : this.serializeArgument(arg)))
			.join(" ")}`

		this.outputChannelLogger(formattedMessage)
	}

	/**
	 * Serializes an argument for logging
	 * @param arg The argument to serialize
	 * @returns The serialized string
	 */
	private serializeArgument(arg: unknown): string {
		if (arg === null) {
			return "null"
		} else if (arg === undefined) {
			return "undefined"
		} else if (typeof arg === "string") {
			return arg
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

			return `Error: ${JSON.stringify(errorInfo, null, 2)}`
		} else {
			try {
				return JSON.stringify(
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

				return `[Non-serializable object: ${Object.prototype.toString.call(arg)}] [Serialization error: ${JSON.stringify(errorDetails, null, 2)}]`
			}
		}
	}

	/**
	 * Logs an error message
	 * @param args The arguments to log
	 */
	error(...args: unknown[]): void {
		this.logWithLevel(LogLevel.Error, ...args)
	}

	/**
	 * Logs a warning message
	 * @param args The arguments to log
	 */
	warn(...args: unknown[]): void {
		this.logWithLevel(LogLevel.Warn, ...args)
	}

	/**
	 * Logs an info message
	 * @param args The arguments to log
	 */
	info(...args: unknown[]): void {
		this.logWithLevel(LogLevel.Info, ...args)
	}

	/**
	 * Logs a debug message
	 * @param args The arguments to log
	 */
	debug(...args: unknown[]): void {
		this.logWithLevel(LogLevel.Debug, ...args)
	}

	/**
	 * Logs a trace message
	 * @param args The arguments to log
	 */
	trace(...args: unknown[]): void {
		this.logWithLevel(LogLevel.Trace, ...args)
	}

	/**
	 * Creates a child logger with a specific prefix
	 * @param prefix The prefix to add to all log messages
	 * @returns A child logger that delegates to the parent with prefixing
	 */
	child(prefix: string): ILogger {
		// Create a thin wrapper that delegates to parent logger with prefixing
		return {
			error: (...args: unknown[]) => this.error(prefix, ...args),
			warn: (...args: unknown[]) => this.warn(prefix, ...args),
			info: (...args: unknown[]) => this.info(prefix, ...args),
			debug: (...args: unknown[]) => this.debug(prefix, ...args),
			trace: (...args: unknown[]) => this.trace(prefix, ...args),
			setLogLevel: (level: LogLevel) => this.setLogLevel(level),
			getLogLevel: () => this.getLogLevel(),
			getLogLevelName: () => this.getLogLevelName(),
			setLogLevelByName: (levelName: LogLevelName) => this.setLogLevelByName(levelName),
			child: (childPrefix: string) => this.child(`${prefix} ${childPrefix}`),
		}
	}
}

/**
 * Factory function to create a Logger instance
 * @param outputChannel The VScode output channel to write logs to
 * @param initialLevel The initial log level (default: Info)
 * @returns A new Logger instance
 */
export function createLogger(outputChannel: vscode.OutputChannel, initialLevel: LogLevel = LogLevel.Info): ILogger {
	return new Logger(outputChannel, initialLevel)
}

/**
 * Utility function to parse a log level from a string
 * @param levelString The string to parse
 * @returns The corresponding LogLevel, or Info if invalid
 */
export function parseLogLevel(levelString: string): LogLevel {
	const normalized = levelString.toLowerCase().trim()
	return LogLevelMap[normalized as LogLevelName] ?? LogLevel.Info
}

/**
 * Utility function to check if a log level is valid
 * @param level The level to check
 * @returns True if the level is valid, false otherwise
 */
export function isValidLogLevel(level: number): level is LogLevel {
	return Object.values(LogLevel).includes(level as LogLevel)
}
