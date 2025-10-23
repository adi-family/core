import { sql } from './packages/db/client'

async function main() {
  const tasks = await sql`
    SELECT id, title, ai_evaluation_status
    FROM tasks
    WHERE ai_evaluation_status = 'failed'
    LIMIT 1
  `

  if (tasks.length > 0) {
    console.log(`Found failed task: ${tasks[0].id}`)
    console.log(`Title: ${tasks[0].title}`)
  } else {
    console.log('No failed tasks found')
  }

  process.exit(0)
}

main()
