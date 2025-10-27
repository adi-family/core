import { sql } from './packages/db/client.ts'
import * as taskQueries from './packages/db/tasks.ts'

const TASK_ID = 'b1393070-b148-4fe2-9fac-bbab9cf997e3'

try {
  console.log(`Updating task ${TASK_ID} status to 'done'...`)

  const result = await taskQueries.updateTask(sql, TASK_ID, { status: 'done' })

  if (result.ok) {
    console.log('✅ Task status updated successfully')
    console.log('Updated task:', {
      id: result.data.id,
      status: result.data.status,
      ai_implementation_status: result.data.ai_implementation_status
    })
  } else {
    console.error('❌ Failed to update task:', result.error)
    process.exit(1)
  }

} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
} finally {
  await sql.end()
  process.exit(0)
}
