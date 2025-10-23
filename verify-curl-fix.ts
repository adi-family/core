import { sql } from './packages/db/client'
import { evaluateTask } from './packages/micros-task-eval/service'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'verify' })

async function main() {
  logger.info('🧪 Testing pipeline with fetch instead of curl...')

  // Test with one of the failed tasks
  const taskId = 'd08d100c-12ea-48b2-be8d-32f9cfe6e109'

  logger.info(`Testing with task: ${taskId}`)

  try {
    const result = await evaluateTask(sql, { taskId })

    if (result.errors.length > 0) {
      logger.error('❌ Evaluation failed with errors:')
      result.errors.forEach(err => logger.error(`  - ${err}`))
    } else {
      logger.info('✅ Pipeline triggered successfully!')
      logger.info(`🔗 ${result.pipelineUrl}`)
    }

    process.exit(0)
  } catch (error) {
    logger.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main()
