import { z, type ZodTypeAny, type ZodError } from 'zod'
import { createLogger } from '../logger'

const isProd = process.env.NODE_ENV === 'production'

export abstract class ConfigBase {
  protected abstract namespace: string
  private _logger: ReturnType<typeof createLogger> | undefined

  protected get logger() {
    if (!this._logger) {
      this._logger = createLogger({ namespace: this.namespace })
    }
    return this._logger
  }

  protected required<T extends ZodTypeAny>(name: string, schema: T, value: unknown): z.infer<T> {
    const trimmed = typeof value === 'string' ? value.trim() : value
    const parsed = schema.safeParse(trimmed)
    if (!parsed.success || trimmed === '' || trimmed == null) {
      const detail = parsed.success ? 'empty' : (parsed.error as ZodError).message
      const msg = `missing or invalid ${name}: ${detail}`
      if (isProd) throw new Error(msg)
      this.logger.warn(`${msg} (dev mode)`)
      throw new Error(msg)
    }
    return parsed.data
  }

  protected group<T extends ZodTypeAny>(name: string, schema: T, values: unknown): z.infer<T> {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const msg = `[env] invalid group ${name}: ${parsed.error.message}`
      if (isProd) throw new Error(msg)
      this.logger.warn(`${msg} (dev mode)`)
      throw new Error(msg)
    }
    return parsed.data
  }
}

