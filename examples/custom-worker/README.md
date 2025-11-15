# Custom Worker Example

This is an example custom worker that demonstrates how to use the ADI Worker SDK to build custom task execution workers.

## Features

- Connects to RabbitMQ and consumes tasks from the `worker-tasks` queue
- Handles both evaluation and implementation tasks
- Sends results back via the `worker-responses` queue
- Supports graceful shutdown
- Configurable concurrency

## Configuration

Environment variables:

- `RABBITMQ_URL` - RabbitMQ connection URL (default: `amqp://localhost`)
- `WORKER_NAME` - Worker instance name (default: `custom-worker-example`)
- `MAX_CONCURRENCY` - Maximum concurrent tasks (default: `5`)

## Usage

### Development

```bash
npm install
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t custom-worker .
docker run -e RABBITMQ_URL=amqp://rabbitmq:5672 custom-worker
```

## How It Works

1. **Connect**: Worker connects to RabbitMQ
2. **Listen**: Worker starts consuming from `worker-tasks` queue
3. **Process**: When a task arrives, worker routes to appropriate handler (evaluate/implement)
4. **Respond**: Worker sends result to `worker-responses` queue
5. **Acknowledge**: Worker acknowledges the message to remove it from queue

## Extending

To create your own custom worker:

1. Copy this example
2. Implement the `TaskHandler` interface:
   - `onEvaluate(task)` - Handle evaluation tasks
   - `onImplement(task)` - Handle implementation tasks
   - `onCancel(sessionId)` - Handle cancellation (optional)
3. Add your custom logic (AI integration, code analysis, etc.)
4. Deploy as a microservice

## Architecture

```
┌─────────────┐       ┌───────────┐       ┌──────────────┐
│   Backend   │──────>│ RabbitMQ  │──────>│ Custom Worker│
└─────────────┘       │           │       │  (this code) │
                      │worker-    │       └──────────────┘
                      │tasks      │              │
                      │queue      │              │
                      │           │<─────────────┘
                      │worker-    │
                      │responses  │
                      └───────────┘
```
