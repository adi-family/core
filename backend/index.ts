import { app } from './app'

if (!process.env.PORT) {
  throw new Error('PORT environment variable is required')
}

const port = Number(process.env.PORT)

export const server = {
  port,
  fetch: app.fetch,
}

console.log(`Server running on http://localhost:${port}`)
