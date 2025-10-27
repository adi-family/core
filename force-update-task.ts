import { sql } from './packages/db/client.ts'
import { updatePipelineStatus } from './packages/micros-task-ops/monitoring/pipeline-monitor.ts'

const TASK_ID = 'b1393070-b148-4fe2-9fac-bbab9cf997e3'

try {
  console.log(`Finding pipeline execution for task ${TASK_ID}...`)

  // Find the pipeline execution for this task
  const result = await sql`
    SELECT pe.id, pe.status, pe.pipeline_id, s.runner, t.ai_implementation_status
    FROM pipeline_executions pe
    JOIN sessions s ON pe.session_id = s.id
    JOIN tasks t ON s.task_id = t.id
    WHERE t.id = ${TASK_ID}
      AND s.runner IN ('claude', 'implementation')
    ORDER BY pe.created_at DESC
    LIMIT 1
  `

  if (result.length === 0) {
    console.log('❌ No pipeline execution found for this task')
    process.exit(1)
  }

  const execution = result[0]
  console.log('Found execution:', {
    id: execution.id,
    status: execution.status,
    pipeline_id: execution.pipeline_id,
    runner: execution.runner,
    ai_implementation_status: execution.ai_implementation_status
  })

  if (execution.pipeline_id) {
    console.log('\nForcing pipeline status update...')
    await updatePipelineStatus(execution.id, sql)
    console.log('✅ Pipeline status updated')
  } else {
    console.log('⚠️  No pipeline_id found - cannot update from GitLab')
  }

  // Check updated status
  const updated = await sql`
    SELECT ai_implementation_status
    FROM tasks
    WHERE id = ${TASK_ID}
  `
  console.log('\nUpdated task status:', updated[0])

} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
} finally {
  await sql.end()
  process.exit(0)
}
