import * as vscode from "vscode"
import { Logger, LogLevel, createLogger, ILogger } from "./logger"

/**
 * Example usage of the Logger class
 */
export function exampleLoggerUsage() {
	// Create an output channel
	const outputChannel = vscode.window.createOutputChannel("Example Logger")

	// Create a logger instance using the factory function
	const logger = createLogger(outputChannel, LogLevel.Info)

	// Basic logging
	logger.info("Application started")
	logger.warn("This is a warning")
	logger.error("This is an error")

	// Debug and trace messages won't show because level is Info
	logger.debug("This debug message won't appear")
	logger.trace("This trace message won't appear")

	// Change log level to Debug
	logger.setLogLevel(LogLevel.Debug)
	logger.debug("Now debug messages will appear")
	logger.trace("Trace messages still won't appear")

	// Change log level to Trace
	logger.setLogLevel(LogLevel.Trace)
	logger.trace("Now all messages will appear")

	// Log with multiple arguments
	logger.info("User logged in", { userId: 123, name: "John Doe" })

	// Log an error object
	const error = new Error("Something went wrong")
	;(error as any).code = "E123"
	logger.error("An error occurred", error)

	// Create a child logger with prefix
	const childLogger = logger.child("[AUTH]")
	childLogger.info("User authentication successful")
	childLogger.error("Authentication failed")

	// Change log level and see effect on child logger
	logger.setLogLevel(LogLevel.Error)
	childLogger.info("This won't appear because level is Error")
	childLogger.error("This will appear")

	// Use log level names
	logger.setLogLevelByName("warn")
	logger.warn("Warning level by name")
	logger.info("Info won't appear")

	// Get current log level info
	console.log(`Current level: ${logger.getLogLevelName()}`)
	console.log(`Current level value: ${logger.getLogLevel()}`)

	// Clean up
	outputChannel.dispose()
}

/**
 * Example of using the Logger in a class
 */
export class ExampleService {
	private logger: ILogger

	constructor(outputChannel: vscode.OutputChannel) {
		this.logger = createLogger(outputChannel, LogLevel.Debug)
		this.logger.info("ExampleService initialized")
	}

	doSomething(): void {
		this.logger.debug("Starting doSomething method")

		try {
			// Simulate some work
			this.logger.info("Processing data...")

			// Simulate an error
			throw new Error("Processing failed")
		} catch (error) {
			this.logger.error("Error in doSomething", error)
		}

		this.logger.debug("Finished doSomething method")
	}

	getLogger(): ILogger {
		return this.logger
	}
}
