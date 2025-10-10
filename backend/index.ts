import { app } from './app'

if (!process.env.SERVER_PORT) {
  throw new Error('SERVER_PORT environment variable is required')
}

const port = Number(process.env.SERVER_PORT)

export const server = {
  port,
  fetch: app.fetch,
}

console.log(`Server running on http://localhost:${port}`)
