/**
 * Show failed task implementations
 * Usage: bun show-failed-impls.ts
 */

import { sql } from './packages/db/client.ts'

const tasks = await sql`
  SELECT
    t.id,
    t.title,
    t.ai_implementation_status,
    t.ai_implementation_session_id,
    t.updated_at,
    s.runner,
    s.created_at as session_created_at
  FROM tasks t
  LEFT JOIN sessions s ON t.ai_implementation_session_id = s.id
  WHERE t.ai_implementation_status = 'failed'
  ORDER BY t.updated_at DESC
  LIMIT 20
`

console.log(`\n📊 Failed Implementations (${tasks.length})\n`)

for (const task of tasks) {
  console.log('━'.repeat(80))
  console.log(`Task ID: ${task.id}`)
  console.log(`Title: ${task.title}`)
  console.log(`Status: ${task.ai_implementation_status}`)
  console.log(`Session ID: ${task.ai_implementation_session_id || 'N/A'}`)
  console.log(`Runner: ${task.runner || 'N/A'}`)
  console.log(`Session Created: ${task.session_created_at || 'N/A'}`)
  console.log(`Updated: ${task.updated_at}`)
  console.log('')
}

console.log('━'.repeat(80))
console.log(`\nTotal: ${tasks.length} failed implementations\n`)

await sql.end()
