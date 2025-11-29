import { z } from 'zod'

export const stringOrBoolean = z.union([
  z.boolean(),
  z.string().transform(v => v === 'true')
]).optional()
