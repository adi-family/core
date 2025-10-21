/**
 * Pre-compiled Hono RPC Client Types
 * This file pre-calculates the AppType at compile time to improve IDE performance
 */

import { app } from './app'
import { hc } from 'hono/client'

// Pre-calculate the type at compile time
const _client = hc<typeof app>('')
export type Client = typeof _client

export const hcWithType = (...args: Parameters<typeof hc<typeof app>>): Client =>
  hc<typeof app>(...args)
