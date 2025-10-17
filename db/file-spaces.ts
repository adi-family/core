import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { FileSpace, CreateFileSpaceInput, UpdateFileSpaceInput, Result } from '../backend/types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllFileSpaces = async (sql: Sql): Promise<FileSpace[]> => {
  return get(sql<FileSpace[]>`SELECT * FROM file_spaces ORDER BY created_at DESC`)
}

export const findFileSpaceById = async (sql: Sql, id: string): Promise<Result<FileSpace>> => {
  const fileSpaces = await get(sql<FileSpace[]>`SELECT * FROM file_spaces WHERE id = ${id}`)
  const [fileSpace] = fileSpaces
  return fileSpace
    ? { ok: true, data: fileSpace }
    : { ok: false, error: 'File space not found' }
}

export const findFileSpacesByProjectId = async (sql: Sql, projectId: string): Promise<FileSpace[]> => {
  return get(sql<FileSpace[]>`SELECT * FROM file_spaces WHERE project_id = ${projectId} ORDER BY created_at DESC`)
}

const createFileSpaceCols = ['project_id', 'name', 'type', 'config', 'enabled'] as const
export const createFileSpace = async (sql: Sql, input: CreateFileSpaceInput): Promise<FileSpace> => {
  const [fileSpace] = await get(sql<FileSpace[]>`
    INSERT INTO file_spaces ${sql(input, createFileSpaceCols)}
    RETURNING *
  `)
  if (!fileSpace) {
    throw new Error('Failed to create file space')
  }
  return fileSpace
}

const updateFileSpaceCols = ['project_id', 'name', 'type', 'config', 'enabled'] as const
export const updateFileSpace = async (sql: Sql, id: string, input: UpdateFileSpaceInput): Promise<Result<FileSpace>> => {
  const fileSpaces = await get(sql<FileSpace[]>`
    UPDATE file_spaces
    SET ${sql(input, updateFileSpaceCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [fileSpace] = fileSpaces
  return fileSpace
    ? { ok: true, data: fileSpace }
    : { ok: false, error: 'File space not found' }
}

export const deleteFileSpace = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM file_spaces WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'File space not found' }
}
