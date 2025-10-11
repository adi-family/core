import { hc } from 'hono/client'
import type { AppType } from '../../../backend/app'

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT ?? '5174'
const API_URL = import.meta.env.VITE_API_URL ?? `http://localhost:${SERVER_PORT}`

export const client = hc<AppType>(API_URL)
