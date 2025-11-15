# Custom Worker Support

ADI Simple supports custom worker microservices that can execute task evaluation and implementation independently of GitLab CI.

## Overview

Custom workers are standalone services that:
- Execute task evaluation and implementation
- Communicate via RabbitMQ message queues
- Run as Docker containers or standalone processes
- Scale independently with Kubernetes or Docker Swarm
- Provide custom execution environments

## Architecture

```
┌──────────┐     Publish      ┌───────────┐     Consume    ┌────────────────┐
│ Backend  │ ────────────────>│ RabbitMQ  │───────────────>│ Custom Workers │
└──────────┘                  │           │                │  (N instances) │
      ↑                       │worker-    │                └────────────────┘
      │                       │tasks      │                        │
      │       Consume         │queue      │        Publish         │
      └───────────────────────│           │<───────────────────────┘
                              │worker-    │
                              │responses  │
                              └───────────┘
```

## Configuration

### Project-Level Settings

Each project can configure its default worker type:

```typescript
{
  "default_worker_type": "custom-microservice",  // or "gitlab-ci"
  "allow_worker_override": true
}
```

### Per-Task Override

When triggering evaluation or implementation, you can override the worker type:

```typescript
POST /api/projects/:projectId/tasks/:taskId/evaluate
{
  "workerPreference": {
    "type": "custom-microservice"
  }
}
```

## Database Schema

### Projects Table

```sql
ALTER TABLE projects
ADD COLUMN default_worker_type TEXT DEFAULT 'custom-microservice';
ADD COLUMN allow_worker_override BOOLEAN DEFAULT true;
```

### Sessions Table

```sql
ALTER TABLE sessions
ADD COLUMN worker_type_override TEXT;
ADD COLUMN executed_by_worker_type TEXT;
```

## Message Queue Protocol

### Worker Tasks Queue

Queue: `worker-tasks`

Message format:
```typescript
{
  taskId: string
  sessionId: string
  projectId: string
  taskType: 'evaluation' | 'implementation'
  context: {
    task: Task
    project: Project
    aiProvider: AIProviderConfig
    workspace?: WorkspaceConfig
  }
  timeout: number
  attempt: number
  correlationId: string
  replyTo: string
}
```

### Worker Responses Queue

Queue: `worker-responses`

Message format:
```typescript
{
  correlationId: string
  sessionId: string
  status: 'success' | 'error' | 'timeout'
  result?: {
    evaluation?: any
    implementation?: any
    artifacts?: any[]
  }
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata: {
    executionTimeMs: number
    workerVersion: string
  }
}
```

## Building a Custom Worker

### Using the Worker SDK

```typescript
import { WorkerClient, TaskHandler } from '@adi-simple/worker-sdk'

const handler: TaskHandler = {
  async onEvaluate(task) {
    // Your evaluation logic
    return {
      canImplement: true,
      estimatedComplexity: 'medium'
    }
  },

  async onImplement(task) {
    // Your implementation logic
    return {
      status: 'completed',
      filesModified: ['src/file.ts']
    }
  }
}

const client = new WorkerClient({
  rabbitmqUrl: process.env.RABBITMQ_URL,
  workerName: 'my-custom-worker',
  concurrency: 5
})

await client.connect()
await client.listen(handler)
```

### Deployment with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### Deployment with Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: custom-worker
  template:
    metadata:
      labels:
        app: custom-worker
    spec:
      containers:
      - name: worker
        image: custom-worker:latest
        env:
        - name: RABBITMQ_URL
          value: "amqp://rabbitmq:5672"
        - name: MAX_CONCURRENCY
          value: "5"
```

## Environment Variables

### Backend
- `DEFAULT_WORKER_TYPE` - Default worker type for new projects

### Worker Dispatcher
- `RABBITMQ_URL` - RabbitMQ connection URL
- `DATABASE_URL` - PostgreSQL connection URL

### Custom Workers
- `RABBITMQ_URL` - RabbitMQ connection URL
- `WORKER_NAME` - Worker instance name
- `MAX_CONCURRENCY` - Maximum concurrent tasks

## Monitoring

### Worker Status

Workers automatically report their status through RabbitMQ connection state. Monitor:
- Queue depth (`worker-tasks` queue)
- Consumer count (number of active workers)
- Message processing rate
- Dead letter queue (`worker-tasks.dlq`)

### Metrics to Track

- Execution time per task type
- Success/failure rates
- Queue depth and lag
- Worker availability

## Migration from GitLab Workers

1. Deploy custom workers alongside GitLab workers
2. Set project `default_worker_type` to `custom-microservice`
3. Monitor performance and success rates
4. Gradually migrate all projects

## Troubleshooting

### Worker not receiving tasks

1. Check RabbitMQ connection
2. Verify queue names match
3. Check worker is consuming from correct queue
4. Verify project `default_worker_type` setting

### Tasks timing out

1. Increase timeout in task message
2. Scale up worker instances
3. Increase worker concurrency
4. Check worker logs for errors

### Messages going to DLQ

1. Check worker error logs
2. Verify message format is correct
3. Ensure worker can handle the task type
4. Check for network issues

## Example Worker

See `examples/custom-worker` for a complete example implementation.

## API Reference

### Worker SDK

#### WorkerClient

- `connect()` - Connect to RabbitMQ
- `listen(handler)` - Start listening for tasks
- `updateProgress(sessionId, progress)` - Report progress
- `close()` - Disconnect gracefully

#### TaskHandler Interface

- `onEvaluate(task)` - Handle evaluation tasks
- `onImplement(task)` - Handle implementation tasks
- `onCancel(sessionId)` - Handle cancellation (optional)

## Best Practices

1. **Graceful Shutdown**: Always handle SIGTERM/SIGINT
2. **Error Handling**: Send error responses for failed tasks
3. **Idempotency**: Handle duplicate messages gracefully
4. **Logging**: Log all important events with correlation IDs
5. **Monitoring**: Track execution time and success rates
6. **Scaling**: Use Kubernetes HPA for auto-scaling
7. **Testing**: Test with various task types and edge cases

## Security

- RabbitMQ connection should use authentication
- Workers should validate task messages
- Sensitive data should be encrypted
- Workers should run in isolated networks
- Use least-privilege principles

## Performance

- Set appropriate concurrency based on worker resources
- Use prefetch to control message consumption rate
- Monitor queue depth and scale workers accordingly
- Optimize task processing time
- Use connection pooling for database access
