export enum LogLevel {
	TRACE = 0,
	DEBUG = 1,
	INFO = 2,
	WARN = 3,
	ERROR = 4,
	NONE = 5,
}

interface LogEntry {
	level: LogLevel
	message: string
	timestamp: Date
	context?: string
}

export class Logger {
	private static instance: Logger
	private logLevel: LogLevel = LogLevel.INFO
	private logHistory: LogEntry[] = []
	private maxHistorySize: number = 1000

	private constructor() {}

	public static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger()
		}
		return Logger.instance
	}

	/**
	 * Set the minimum log level. Messages below this level will be ignored.
	 * @param level The minimum log level to output
	 */
	public setLogLevel(level: LogLevel): void {
		this.logLevel = level
	}

	/**
	 * Get the current log level
	 */
	public getLogLevel(): LogLevel {
		return this.logLevel
	}

	/**
	 * Configure logger based on environment variables
	 */
	public configureFromEnvironment(): void {
		// Default to INFO in production, DEBUG in development
		const isProduction = process.env.NODE_ENV === "production"

		// Check for explicit log level setting
		const envLevel = process.env.ROO_CODE_LOG_LEVEL
		if (envLevel) {
			switch (envLevel.toLowerCase()) {
				case "trace":
					this.logLevel = LogLevel.TRACE
					break
				case "debug":
					this.logLevel = LogLevel.DEBUG
					break
				case "info":
					this.logLevel = LogLevel.INFO
					break
				case "warn":
					this.logLevel = LogLevel.WARN
					break
				case "error":
					this.logLevel = LogLevel.ERROR
					break
				case "none":
					this.logLevel = LogLevel.NONE
					break
				default:
					this.logLevel = isProduction ? LogLevel.INFO : LogLevel.DEBUG
			}
		} else {
			this.logLevel = isProduction ? LogLevel.INFO : LogLevel.DEBUG
		}
	}

	/**
	 * Log a trace message (most verbose)
	 */
	public trace(message: string, context?: string): void {
		this.log(LogLevel.TRACE, message, context)
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, context?: string): void {
		this.log(LogLevel.DEBUG, message, context)
	}

	/**
	 * Log an info message
	 */
	public info(message: string, context?: string): void {
		this.log(LogLevel.INFO, message, context)
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, context?: string): void {
		this.log(LogLevel.WARN, message, context)
	}

	/**
	 * Log an error message
	 */
	public error(message: string, context?: string): void {
		this.log(LogLevel.ERROR, message, context)
	}

	/**
	 * Internal logging method
	 */
	private log(level: LogLevel, message: string, context?: string): void {
		if (level < this.logLevel) {
			return
		}

		const logEntry: LogEntry = {
			level,
			message,
			timestamp: new Date(),
			context,
		}

		// Add to history
		this.logHistory.push(logEntry)
		if (this.logHistory.length > this.maxHistorySize) {
			this.logHistory.shift()
		}

		// Output to console based on level
		const levelName = LogLevel[level]
		const timestamp = logEntry.timestamp.toISOString()
		const contextStr = context ? `[${context}] ` : ""
		const formattedMessage = `${timestamp} ${levelName} ${contextStr}${message}`

		switch (level) {
			case LogLevel.TRACE:
			case LogLevel.DEBUG:
				console.debug(formattedMessage)
				break
			case LogLevel.INFO:
				console.log(formattedMessage)
				break
			case LogLevel.WARN:
				console.warn(formattedMessage)
				break
			case LogLevel.ERROR:
				console.error(formattedMessage)
				break
		}
	}

	/**
	 * Get recent log entries
	 */
	public getRecentLogs(count: number = 100): LogEntry[] {
		return this.logHistory.slice(-count)
	}

	/**
	 * Clear log history
	 */
	public clearHistory(): void {
		this.logHistory = []
	}
}

// Export a singleton instance for convenience
export const logger = Logger.getInstance()

// Initialize logger with environment configuration
logger.configureFromEnvironment()
