/**
 * Simple logger for worker scripts
 */

export interface Logger {
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

export function createLogger(config?: { namespace?: string }): Logger {
  const namespace = config?.namespace || 'worker'
  const prefix = `[${namespace}]`

  return {
    info: (message: string, ...args: any[]) => {
      console.log(`${prefix} INFO `, message, ...args)
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${prefix} WARN `, message, ...args)
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${prefix} ERROR`, message, ...args)
    },
  }
}
