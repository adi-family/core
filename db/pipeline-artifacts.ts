import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { PipelineArtifact, CreatePipelineArtifactInput, Result } from '../types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllPipelineArtifacts = async (sql: Sql): Promise<PipelineArtifact[]> => {
  return get(sql<PipelineArtifact[]>`SELECT * FROM pipeline_artifacts ORDER BY created_at DESC`)
}

export const findPipelineArtifactById = async (sql: Sql, id: string): Promise<Result<PipelineArtifact>> => {
  const artifacts = await get(sql<PipelineArtifact[]>`SELECT * FROM pipeline_artifacts WHERE id = ${id}`)
  const [artifact] = artifacts
  return artifact
    ? { ok: true, data: artifact }
    : { ok: false, error: 'Pipeline artifact not found' }
}

export const findPipelineArtifactsByExecutionId = async (sql: Sql, executionId: string): Promise<PipelineArtifact[]> => {
  return get(sql<PipelineArtifact[]>`
    SELECT * FROM pipeline_artifacts
    WHERE pipeline_execution_id = ${executionId}
    ORDER BY created_at DESC
  `)
}

const createPipelineArtifactCols = ['pipeline_execution_id', 'artifact_type', 'reference_url', 'metadata'] as const
export const createPipelineArtifact = async (sql: Sql, input: CreatePipelineArtifactInput): Promise<PipelineArtifact> => {
  const data = {
    ...input,
    metadata: input.metadata || null
  }
  const [artifact] = await get(sql<PipelineArtifact[]>`
    INSERT INTO pipeline_artifacts ${sql(data, createPipelineArtifactCols)}
    RETURNING *
  `)
  if (!artifact) {
    throw new Error('Failed to create pipeline artifact')
  }
  return artifact
}

export const deletePipelineArtifact = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM pipeline_artifacts WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Pipeline artifact not found' }
}
