import type { Sql } from 'postgres'
import type { PipelineArtifact, CreatePipelineArtifactInput } from '@types'
import { get, findOneById, deleteById } from './utils'
import { NotFoundException } from '../utils/exceptions'

export const findAllPipelineArtifacts = async (sql: Sql): Promise<PipelineArtifact[]> => {
  return get(sql<PipelineArtifact[]>`SELECT * FROM pipeline_artifacts ORDER BY created_at DESC`)
}

export const findPipelineArtifactById = async (sql: Sql, id: string): Promise<PipelineArtifact> => {
  return findOneById<PipelineArtifact>(sql, 'pipeline_artifacts', id, 'Pipeline artifact')
}

export const findPipelineArtifactsByExecutionId = async (sql: Sql, executionId: string): Promise<PipelineArtifact[]> => {
  return get(sql<PipelineArtifact[]>`
    SELECT * FROM pipeline_artifacts
    WHERE pipeline_execution_id = ${executionId}
    ORDER BY created_at DESC
  `)
}

export const findPipelineArtifactsByTaskId = async (sql: Sql, taskId: string): Promise<PipelineArtifact[]> => {
  return get(sql<PipelineArtifact[]>`
    SELECT pa.*
    FROM pipeline_artifacts pa
    INNER JOIN pipeline_executions pe ON pa.pipeline_execution_id = pe.id
    INNER JOIN sessions s ON pe.session_id = s.id
    WHERE s.task_id = ${taskId}
    ORDER BY pa.created_at DESC
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

export const deletePipelineArtifact = async (sql: Sql, id: string): Promise<void> => {
  return deleteById(sql, 'pipeline_artifacts', id, 'Pipeline artifact')
}
