import type { Sql } from 'postgres'
import type { FileSpace, CreateFileSpaceInput, UpdateFileSpaceInput } from '@types'
import { filterPresentColumns, get } from './utils'
import { NotFoundException } from '../utils/exceptions'

export const findAllFileSpaces = async (sql: Sql): Promise<FileSpace[]> => {
  return get(sql<FileSpace[]>`SELECT * FROM file_spaces ORDER BY created_at DESC`)
}

export const findFileSpaceById = async (sql: Sql, id: string): Promise<FileSpace> => {
  const fileSpaces = await get(sql<FileSpace[]>`SELECT * FROM file_spaces WHERE id = ${id}`)
  const [fileSpace] = fileSpaces
  if (!fileSpace) {
    throw new NotFoundException('File space not found')
  }
  return fileSpace
}

export const findFileSpacesByProjectId = async (sql: Sql, projectId: string): Promise<FileSpace[]> => {
  return get(sql<FileSpace[]>`SELECT * FROM file_spaces WHERE project_id = ${projectId} ORDER BY created_at DESC`)
}

export const findFileSpacesByProjectIds = async (sql: Sql, projectIds: string[]): Promise<Map<string, FileSpace[]>> => {
  if (projectIds.length === 0) {
    return new Map()
  }

  const fileSpaces = await get(sql<FileSpace[]>`
    SELECT * FROM file_spaces
    WHERE project_id = ANY(${projectIds}) AND enabled = true
    ORDER BY created_at ASC
  `)

  const grouped = new Map<string, FileSpace[]>()
  for (const fs of fileSpaces) {
    const existing = grouped.get(fs.project_id) || []
    existing.push(fs)
    grouped.set(fs.project_id, existing)
  }

  return grouped
}

export const findFileSpacesByTaskId = async (sql: Sql, taskId: string): Promise<FileSpace[]> => {
  // Get all file spaces for the task's project (project-level file spaces)
  return get(sql<FileSpace[]>`
    SELECT fs.*
    FROM file_spaces fs
    INNER JOIN tasks t ON t.project_id = fs.project_id
    WHERE t.id = ${taskId}
    ORDER BY fs.created_at DESC
  `)
}

const createFileSpaceCols = ['project_id', 'name', 'type', 'config', 'enabled', 'default_branch'] as const
export const createFileSpace = async (sql: Sql, input: CreateFileSpaceInput): Promise<FileSpace> => {
  const presentCols = filterPresentColumns(input, createFileSpaceCols)

  const [fileSpace] = await get(sql<FileSpace[]>`
    INSERT INTO file_spaces ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!fileSpace) {
    throw new Error('Failed to create file space')
  }
  return fileSpace
}

const updateFileSpaceCols = ['project_id', 'name', 'type', 'config', 'enabled', 'default_branch'] as const
export const updateFileSpace = async (sql: Sql, id: string, input: UpdateFileSpaceInput): Promise<FileSpace> => {
  const presentCols = filterPresentColumns(input, updateFileSpaceCols)

  const fileSpaces = await get(sql<FileSpace[]>`
    UPDATE file_spaces
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [fileSpace] = fileSpaces
  if (!fileSpace) {
    throw new NotFoundException('File space not found')
  }
  return fileSpace
}

export const deleteFileSpace = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM file_spaces WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('File space not found')
  }
}
