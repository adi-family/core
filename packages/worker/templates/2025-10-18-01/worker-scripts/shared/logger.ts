/**
 * Simple logger for worker scripts
 */

export interface Logger {
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
}

export function createLogger(config?: { namespace?: string }): Logger {
  const namespace = config?.namespace || 'worker'
  const prefix = `[${namespace}]`

  return {
    info: (message: string, ...args: unknown[]) => {
      console.log(`${prefix} INFO `, message, ...args)
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(`${prefix} WARN `, message, ...args)
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`${prefix} ERROR`, message, ...args)
    },
  }
}
