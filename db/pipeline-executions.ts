import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { PipelineExecution, CreatePipelineExecutionInput, UpdatePipelineExecutionInput, Result } from '../types/index.js'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllPipelineExecutions = async (sql: Sql): Promise<PipelineExecution[]> => {
  return get(sql<PipelineExecution[]>`SELECT * FROM pipeline_executions ORDER BY created_at DESC`)
}

export const findPipelineExecutionById = async (sql: Sql, id: string): Promise<Result<PipelineExecution>> => {
  const executions = await get(sql<PipelineExecution[]>`SELECT * FROM pipeline_executions WHERE id = ${id}`)
  const [execution] = executions
  return execution
    ? { ok: true, data: execution }
    : { ok: false, error: 'Pipeline execution not found' }
}

export const findPipelineExecutionsBySessionId = async (sql: Sql, sessionId: string): Promise<PipelineExecution[]> => {
  return get(sql<PipelineExecution[]>`
    SELECT * FROM pipeline_executions
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
  `)
}

export const findStalePipelineExecutions = async (sql: Sql, timeoutMinutes: number): Promise<PipelineExecution[]> => {
  return get(sql<PipelineExecution[]>`
    SELECT * FROM pipeline_executions
    WHERE status IN ('pending', 'running')
    AND last_status_update < NOW() - INTERVAL '${sql.unsafe(timeoutMinutes.toString())} minutes'
    ORDER BY last_status_update ASC
  `)
}

export const createPipelineExecution = async (sql: Sql, input: CreatePipelineExecutionInput): Promise<PipelineExecution> => {
  const pipelineId = input.pipeline_id || ''
  const lastStatusUpdate = new Date()

  const [execution] = await get(sql<PipelineExecution[]>`
    INSERT INTO pipeline_executions (session_id, worker_repository_id, pipeline_id, status, last_status_update)
    VALUES (${input.session_id}, ${input.worker_repository_id}, ${pipelineId}, ${input.status}, ${lastStatusUpdate})
    RETURNING *
  `)
  if (!execution) {
    throw new Error('Failed to create pipeline execution')
  }
  return execution
}

export const updatePipelineExecution = async (sql: Sql, id: string, input: UpdatePipelineExecutionInput): Promise<Result<PipelineExecution>> => {
  const lastStatusUpdate = input.last_status_update || new Date()
  const updatedAt = new Date()

  let executions: PipelineExecution[]

  if (input.pipeline_id !== undefined && input.status !== undefined) {
    executions = await get(sql<PipelineExecution[]>`
      UPDATE pipeline_executions
      SET pipeline_id = ${input.pipeline_id}, status = ${input.status},
          last_status_update = ${lastStatusUpdate}, updated_at = ${updatedAt}
      WHERE id = ${id}
      RETURNING *
    `)
  } else if (input.pipeline_id !== undefined) {
    executions = await get(sql<PipelineExecution[]>`
      UPDATE pipeline_executions
      SET pipeline_id = ${input.pipeline_id},
          last_status_update = ${lastStatusUpdate}, updated_at = ${updatedAt}
      WHERE id = ${id}
      RETURNING *
    `)
  } else if (input.status !== undefined) {
    executions = await get(sql<PipelineExecution[]>`
      UPDATE pipeline_executions
      SET status = ${input.status},
          last_status_update = ${lastStatusUpdate}, updated_at = ${updatedAt}
      WHERE id = ${id}
      RETURNING *
    `)
  } else {
    executions = await get(sql<PipelineExecution[]>`
      UPDATE pipeline_executions
      SET last_status_update = ${lastStatusUpdate}, updated_at = ${updatedAt}
      WHERE id = ${id}
      RETURNING *
    `)
  }

  const [execution] = executions
  return execution
    ? { ok: true, data: execution }
    : { ok: false, error: 'Pipeline execution not found' }
}

export const deletePipelineExecution = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM pipeline_executions WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Pipeline execution not found' }
}
