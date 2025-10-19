import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/secrets'
import { z } from 'zod'

const idParamSchema = z.object({
  id: z.string()
})

const projectIdParamSchema = z.object({
  projectId: z.string()
})

const createSecretSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional()
})

const updateSecretSchema = z.object({
  value: z.string().optional(),
  description: z.string().optional()
})

export const createSecretRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const secrets = await queries.findAllSecrets(sql)
      return c.json(secrets)
    })
    .get('/by-project/:projectId', zValidator('param', projectIdParamSchema), async (c) => {
      const { projectId } = c.req.valid('param')
      const secrets = await queries.findSecretsByProjectId(sql, projectId)
      return c.json(secrets)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findSecretById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createSecretSchema), async (c) => {
      const body = c.req.valid('json')
      const secret = await queries.createSecret(sql, body)
      return c.json(secret, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateSecretSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const result = await queries.updateSecret(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteSecret(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
