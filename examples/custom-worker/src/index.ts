/**
 * Example Custom Worker
 * Demonstrates how to build a custom worker using the ADI Worker SDK
 */

import { WorkerClient, type TaskHandler, type WorkerTaskMessage } from '@adi-simple/worker-sdk'

// Task handlers
const handler: TaskHandler = {
  async onEvaluate(task: WorkerTaskMessage): Promise<unknown> {
    console.log(`\n[EVALUATE] Processing task ${task.taskId}`)
    console.log(`Task title: ${task.context.task.title}`)
    console.log(`Project: ${task.context.project.name}`)

    // Simulate task evaluation
    await simulateWork(2000)

    // Return evaluation result
    return {
      canImplement: true,
      estimatedComplexity: 'medium',
      requiredSkills: ['typescript', 'nodejs'],
      estimatedTime: '2 hours',
      notes: 'Task appears to be implementable with current AI capabilities'
    }
  },

  async onImplement(task: WorkerTaskMessage): Promise<unknown> {
    console.log(`\n[IMPLEMENT] Processing task ${task.taskId}`)
    console.log(`Task title: ${task.context.task.title}`)
    console.log(`Project: ${task.context.project.name}`)

    // Simulate task implementation
    await simulateWork(5000)

    // Return implementation result
    return {
      status: 'completed',
      filesModified: ['src/example.ts', 'README.md'],
      summary: 'Successfully implemented the requested feature',
      testsPassed: true
    }
  },

  async onCancel(sessionId: string): Promise<void> {
    console.log(`\n[CANCEL] Cancelling session ${sessionId}`)
    // Implement cancellation logic
  }
}

// Helper function to simulate work
function simulateWork(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Main
async function main() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost'
  const workerName = process.env.WORKER_NAME || 'custom-worker-example'
  const concurrency = parseInt(process.env.MAX_CONCURRENCY || '5', 10)

  console.log('===========================================')
  console.log('  Custom Worker Example')
  console.log('===========================================')
  console.log(`Worker Name: ${workerName}`)
  console.log(`RabbitMQ URL: ${rabbitmqUrl}`)
  console.log(`Max Concurrency: ${concurrency}`)
  console.log('===========================================\n')

  const client = new WorkerClient({
    rabbitmqUrl,
    workerName,
    concurrency
  })

  try {
    // Connect to RabbitMQ
    await client.connect()

    // Start listening for tasks
    await client.listen(handler)

    console.log(`✓ Worker is running and ready to process tasks\n`)

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`)
      console.log(`Active tasks: ${client.getActiveTaskCount()}`)
      await client.close()
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    console.error('Failed to start worker:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
