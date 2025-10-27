import { sql } from './packages/db/client.ts'
import { checkStalePipelines } from './packages/micros-task-ops/monitoring/pipeline-monitor.ts'

try {
  console.log('Checking and updating pipeline statuses...')
  await checkStalePipelines({ sql })
  console.log('✅ Pipeline statuses updated successfully')
} catch (error) {
  console.error('❌ Error:', error)
  process.exit(1)
} finally {
  await sql.end()
  process.exit(0)
}
