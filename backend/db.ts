import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5436/postgres'

export const sql = postgres(DATABASE_URL)
