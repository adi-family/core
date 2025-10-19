import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/file-spaces'
import { idParamSchema, createFileSpaceSchema, updateFileSpaceSchema, projectIdQuerySchema } from '../schemas'

export const createFileSpaceRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')

      if (project_id) {
        const fileSpaces = await queries.findFileSpacesByProjectId(sql, project_id)
        return c.json(fileSpaces)
      }

      const fileSpaces = await queries.findAllFileSpaces(sql)
      return c.json(fileSpaces)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findFileSpaceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createFileSpaceSchema), async (c) => {
      const body = c.req.valid('json')
      const fileSpace = await queries.createFileSpace(sql, body)
      return c.json(fileSpace, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateFileSpaceSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const result = await queries.updateFileSpace(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteFileSpace(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
