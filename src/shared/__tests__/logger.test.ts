import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { Logger, LogLevel, createLogger, parseLogLevel, isValidLogLevel, LogLevelName } from "../logger"

describe("Logger", () => {
	let mockOutputChannel: vscode.OutputChannel
	let logger: Logger

	beforeEach(() => {
		mockOutputChannel = {
			name: "Test Channel",
			appendLine: vi.fn(),
			append: vi.fn(),
			replace: vi.fn(),
			clear: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			show: vi.fn(),
		}
		logger = new Logger(mockOutputChannel, LogLevel.Info)
	})

	describe("constructor", () => {
		it("should create a logger with default Info level", () => {
			const defaultLogger = new Logger(mockOutputChannel)
			expect(defaultLogger.getLogLevel()).toBe(LogLevel.Info)
		})

		it("should create a logger with specified level", () => {
			const errorLogger = new Logger(mockOutputChannel, LogLevel.Error)
			expect(errorLogger.getLogLevel()).toBe(LogLevel.Error)
		})
	})

	describe("log level management", () => {
		it("should set and get log level", () => {
			logger.setLogLevel(LogLevel.Debug)
			expect(logger.getLogLevel()).toBe(LogLevel.Debug)
		})

		it("should set log level by name", () => {
			logger.setLogLevelByName("warn")
			expect(logger.getLogLevel()).toBe(LogLevel.Warn)
		})

		it("should get log level name", () => {
			logger.setLogLevel(LogLevel.Trace)
			expect(logger.getLogLevelName()).toBe("trace")
		})
	})

	describe("log filtering", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should log error messages when level is Info", () => {
			logger.error("Test error")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[ERROR] Test error"))
		})

		it("should log warn messages when level is Info", () => {
			logger.warn("Test warning")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[WARN] Test warning"))
		})

		it("should log info messages when level is Info", () => {
			logger.info("Test info")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[INFO] Test info"))
		})

		it("should not log debug messages when level is Info", () => {
			logger.debug("Test debug")
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
		})

		it("should not log trace messages when level is Info", () => {
			logger.trace("Test trace")
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
		})

		it("should log all messages when level is Trace", () => {
			logger.setLogLevel(LogLevel.Trace)

			logger.error("Error")
			logger.warn("Warning")
			logger.info("Info")
			logger.debug("Debug")
			logger.trace("Trace")

			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(5)
		})

		it("should not log any messages when level is Off", () => {
			logger.setLogLevel(LogLevel.Off)

			logger.error("Error")
			logger.warn("Warning")
			logger.info("Info")
			logger.debug("Debug")
			logger.trace("Trace")

			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()
		})

		it("should only log error messages when level is Error", () => {
			logger.setLogLevel(LogLevel.Error)

			logger.error("Error")
			logger.warn("Warning")
			logger.info("Info")
			logger.debug("Debug")
			logger.trace("Trace")

			expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1)
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[ERROR] Error"))
		})
	})

	describe("message formatting", () => {
		beforeEach(() => {
			vi.clearAllMocks()
		})

		it("should include timestamp and level prefix", () => {
			logger.info("Test message")
			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
				expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\] Test message$/),
			)
		})

		it("should handle multiple arguments", () => {
			logger.info("Message", { data: "test" }, 123)
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
			// The serialization logic is handled by createOutputChannelLogger
		})

		it("should handle Error objects", () => {
			const error = new Error("Test error")
			logger.error(error)
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})
	})

	describe("child logger", () => {
		it("should create a child logger with prefix", () => {
			const childLogger = logger.child("[CHILD]")
			childLogger.info("Child message")

			expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("[CHILD]"))
		})

		it("should share log level with parent", () => {
			const childLogger = logger.child("[CHILD]")
			logger.setLogLevel(LogLevel.Error)

			childLogger.info("Should not log")
			expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()

			childLogger.error("Should log")
			expect(mockOutputChannel.appendLine).toHaveBeenCalled()
		})
	})
})

describe("createLogger factory function", () => {
	it("should create a Logger instance", () => {
		const mockOutputChannel = {
			name: "Test Channel",
			appendLine: vi.fn(),
			append: vi.fn(),
			replace: vi.fn(),
			clear: vi.fn(),
			hide: vi.fn(),
			dispose: vi.fn(),
			show: vi.fn(),
		}

		const logger = createLogger(mockOutputChannel, LogLevel.Debug)
		expect(logger).toBeInstanceOf(Logger)
		expect(logger.getLogLevel()).toBe(LogLevel.Debug)
	})
})

describe("utility functions", () => {
	describe("parseLogLevel", () => {
		it("should parse valid log level strings", () => {
			expect(parseLogLevel("error")).toBe(LogLevel.Error)
			expect(parseLogLevel("WARN")).toBe(LogLevel.Warn)
			expect(parseLogLevel("Info")).toBe(LogLevel.Info)
			expect(parseLogLevel("debug")).toBe(LogLevel.Debug)
			expect(parseLogLevel("trace")).toBe(LogLevel.Trace)
			expect(parseLogLevel("off")).toBe(LogLevel.Off)
		})

		it("should return Info for invalid strings", () => {
			expect(parseLogLevel("invalid")).toBe(LogLevel.Info)
			expect(parseLogLevel("")).toBe(LogLevel.Info)
		})
	})

	describe("isValidLogLevel", () => {
		it("should return true for valid log levels", () => {
			expect(isValidLogLevel(LogLevel.Off)).toBe(true)
			expect(isValidLogLevel(LogLevel.Error)).toBe(true)
			expect(isValidLogLevel(LogLevel.Warn)).toBe(true)
			expect(isValidLogLevel(LogLevel.Info)).toBe(true)
			expect(isValidLogLevel(LogLevel.Debug)).toBe(true)
			expect(isValidLogLevel(LogLevel.Trace)).toBe(true)
		})

		it("should return false for invalid log levels", () => {
			expect(isValidLogLevel(-1)).toBe(false)
			expect(isValidLogLevel(6)).toBe(false)
			expect(isValidLogLevel(999)).toBe(false)
		})
	})
})
