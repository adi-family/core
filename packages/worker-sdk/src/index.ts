// RabbitMQ-based worker client (for adi-runner worker type)
export { WorkerClient } from './client'
export type { WorkerConfig, TaskHandler } from './client'

// HTTP-based SDK worker client (for sdk worker type)
export { SdkWorkerClient, registerSdkWorker } from './http-client'
export type { SdkWorkerClientConfig, TaskWithContext } from './http-client'

// Re-export types
export type {
  WorkerTaskMessage,
  WorkerResponseMessage,
  SdkWorker,
  SdkWorkerTask,
  SdkWorkerTaskContext,
  SdkWorkerMessage,
  SdkWorkerStatus,
  SdkWorkerCapabilities
} from '@adi-simple/types'
