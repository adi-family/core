/**
 * Logger Interface
 * Provides structured logging with colors, prefixes, and log levels
 * Works in both Node.js and browser environments
 */

// Conditionally import chalk only in Node.js environment
// Check if we're in Node.js by looking for process.versions.node
const isBrowser = !(
  typeof process !== 'undefined' &&
  process.versions &&
  process.versions.node
)

// Lazy load chalk - use require in Node.js environment
interface ChalkInstance {
  gray: (text: string) => string
  cyan: (text: string) => string
  magenta: (text: string) => string
  blue: (text: string) => string
  yellow: (text: string) => string
  red: (text: string) => string
  green: (text: string) => string
  dim: (text: string) => string
}

let chalk: ChalkInstance | null = null
if (!isBrowser) {
  try {
    // Use require for synchronous import in Node.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    chalk = require('chalk') as ChalkInstance
  } catch {
    // Chalk not available, fallback to no colors
    chalk = null
  }
}

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS',
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  namespace?: string
  showTimestamp?: boolean
  minLevel?: LogLevel
}

/**
 * Logger instance interface
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  success(message: string, ...args: unknown[]): void
  child(namespace: string): ILogger
}

/**
 * Log level hierarchy for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.SUCCESS]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
}

/**
 * Color utilities for browser environment
 */
const browserColors = {
  gray: 'color: #999',
  cyan: 'color: #00CED1',
  magenta: 'color: #FF00FF',
  blue: 'color: #0000FF',
  yellow: 'color: #FFA500',
  red: 'color: #FF0000',
  green: 'color: #00FF00',
  dim: 'color: #666',
  reset: 'color: inherit',
}

/**
 * Logger implementation
 */
class Logger implements ILogger {
  private config: Required<LoggerConfig>

  constructor(config: LoggerConfig = {}) {
    this.config = {
      namespace: config.namespace ?? '',
      showTimestamp: config.showTimestamp ?? true,
      minLevel: config.minLevel ?? LogLevel.DEBUG,
    }
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    if (!this.config.showTimestamp) return ''
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const timestamp = `[${hours}:${minutes}:${seconds}]`

    if (isBrowser) {
      return timestamp
    }
    return chalk?.gray(timestamp) ?? timestamp
  }

  /**
   * Format namespace
   */
  private formatNamespace(): string {
    if (!this.config.namespace) return ''
    const namespace = `[${this.config.namespace}]`

    if (isBrowser) {
      return namespace
    }
    return chalk?.cyan(namespace) ?? namespace
  }

  /**
   * Get browser styles for log level
   */
  private getBrowserStyles(level: LogLevel): string[] {
    const styles: string[] = []

    if (this.config.showTimestamp) {
      styles.push(browserColors.gray)
    }

    if (this.config.namespace) {
      styles.push(browserColors.cyan)
    }

    switch (level) {
      case LogLevel.DEBUG:
        styles.push(browserColors.magenta)
        styles.push(browserColors.dim)
        break
      case LogLevel.INFO:
        styles.push(browserColors.blue)
        styles.push(browserColors.reset)
        break
      case LogLevel.WARN:
        styles.push(browserColors.yellow)
        styles.push(browserColors.yellow)
        break
      case LogLevel.ERROR:
        styles.push(browserColors.red)
        styles.push(browserColors.red)
        break
      case LogLevel.SUCCESS:
        styles.push(browserColors.green)
        styles.push(browserColors.green)
        break
      default:
        styles.push(browserColors.reset)
        styles.push(browserColors.reset)
    }

    return styles
  }

  /**
   * Format log prefix for browser
   */
  private formatBrowserPrefix(level: LogLevel): string {
    const parts: string[] = []

    if (this.config.showTimestamp) {
      parts.push(`%c${this.formatTimestamp()}`)
    }

    if (this.config.namespace) {
      parts.push(`%c${this.formatNamespace()}`)
    }

    parts.push(`%c${this.getLevelBadgeText(level)}`)

    return parts.join(' ')
  }

  /**
   * Format log prefix for Node.js
   */
  private formatNodePrefix(level: LogLevel): string {
    const parts: string[] = []

    if (this.config.showTimestamp) {
      parts.push(this.formatTimestamp())
    }

    if (this.config.namespace) {
      parts.push(this.formatNamespace())
    }

    parts.push(this.formatLevelBadge(level))

    return parts.join(' ')
  }

  /**
   * Get level badge text without colors
   */
  private getLevelBadgeText(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG'
      case LogLevel.INFO:
        return 'INFO '
      case LogLevel.WARN:
        return 'WARN '
      case LogLevel.ERROR:
        return 'ERROR'
      case LogLevel.SUCCESS:
        return 'SUCCESS'
      default:
        return level
    }
  }

  /**
   * Format level badge with color for Node.js
   */
  private formatLevelBadge(level: LogLevel): string {
    if (!chalk) return this.getLevelBadgeText(level)

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.magenta('DEBUG')
      case LogLevel.INFO:
        return chalk.blue('INFO ')
      case LogLevel.WARN:
        return chalk.yellow('WARN ')
      case LogLevel.ERROR:
        return chalk.red('ERROR')
      case LogLevel.SUCCESS:
        return chalk.green('SUCCESS')
      default:
        return level
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel]
    )
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return

    if (isBrowser) {
      this.logBrowser(level, message, ...args)
    } else {
      this.logNode(level, message, ...args)
    }
  }

  /**
   * Log method for browser
   */
  private logBrowser(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): void {
    const prefix = this.formatBrowserPrefix(level)
    const styles = this.getBrowserStyles(level)
    const messageStyle = styles[styles.length - 1]

    if (level === LogLevel.ERROR) {
      console.error(`${prefix} %c${message}`, ...styles, messageStyle, ...args)
    } else {
      console.log(`${prefix} %c${message}`, ...styles, messageStyle, ...args)
    }
  }

  /**
   * Log method for Node.js
   */
  private logNode(level: LogLevel, message: string, ...args: unknown[]): void {
    const prefix = this.formatNodePrefix(level)
    const formattedMessage = this.formatMessage(level, message)

    if (level === LogLevel.ERROR) {
      console.error(prefix, formattedMessage, ...args)
    } else {
      console.log(prefix, formattedMessage, ...args)
    }
  }

  /**
   * Format message with color based on level for Node.js
   */
  private formatMessage(level: LogLevel, message: string): string {
    if (!chalk) return message

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.dim(message)
      case LogLevel.INFO:
        return message
      case LogLevel.WARN:
        return chalk.yellow(message)
      case LogLevel.ERROR:
        return chalk.red(message)
      case LogLevel.SUCCESS:
        return chalk.green(message)
      default:
        return message
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args)
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args)
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args)
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args)
  }

  /**
   * Log success message
   */
  success(message: string, ...args: unknown[]): void {
    this.log(LogLevel.SUCCESS, message, ...args)
  }

  /**
   * Create child logger with nested namespace
   */
  child(namespace: string): ILogger {
    const childNamespace = this.config.namespace
      ? `${this.config.namespace}:${namespace}`
      : namespace

    return new Logger({
      namespace: childNamespace,
      showTimestamp: this.config.showTimestamp,
      minLevel: this.config.minLevel,
    })
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): ILogger {
  return new Logger(config)
}

/**
 * Default logger instance
 */
export const logger = createLogger()
