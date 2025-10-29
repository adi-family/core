#!/usr/bin/env bun
import { publishTaskEval } from '@adi/queue/publisher'

const taskId = '24ba9402-41f5-4027-9bfc-8bfffe8a4988'

await publishTaskEval({ taskId })
console.log(`Published eval for task: ${taskId}`)

process.exit(0)
