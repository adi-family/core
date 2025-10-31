import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/api-keys'
import { createApiKeySchema, updateApiKeySchema, apiKeyIdParamSchema, projectIdParamSchema } from '../schemas'
import { createFluentACL } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'

/**
 * API Keys handler routes
 * Manages API keys for project-level authentication
 */
export const createApiKeyRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    // List all API keys for a project
    .get('/projects/:projectId/api-keys', zValidator('param', projectIdParamSchema), async (c) => {
      const { projectId } = c.req.valid('param')

      // Check user has at least viewer access to the project
      await acl.project(projectId).viewer.gte.throw(c)

      const apiKeys = await queries.findApiKeysByProjectId(sql, projectId)

      // Remove sensitive hash from response
      const sanitized = apiKeys.map(key => {
        const { key_hash, ...rest } = key
        return rest
      })

      return c.json(sanitized)
    })

    // Get a specific API key
    .get('/api-keys/:apiKeyId', zValidator('param', apiKeyIdParamSchema), async (c) => {
      const { apiKeyId } = c.req.valid('param')

      const apiKey = await queries.findApiKeyById(sql, apiKeyId)

      // Check user has access to the project
      await acl.project(apiKey.project_id).viewer.gte.throw(c)

      // Remove sensitive hash from response
      const { key_hash, ...sanitized } = apiKey

      return c.json(sanitized)
    })

    // Create a new API key
    .post('/api-keys', zValidator('json', createApiKeySchema), async (c) => {
      const body = c.req.valid('json')

      // Check user has admin access to the project
      const userId = await acl.project(body.project_id).admin.gte.throw(c)

      const apiKeyWithSecret = await queries.createApiKey(sql, body, userId)

      // Remove sensitive hash from response but include the plain text key (only time it's shown)
      const { key_hash, ...response } = apiKeyWithSecret

      return c.json(response, 201)
    })

    // Update an API key
    .patch('/api-keys/:apiKeyId', zValidator('param', apiKeyIdParamSchema), zValidator('json', updateApiKeySchema), async (c) => {
      const { apiKeyId } = c.req.valid('param')
      const body = c.req.valid('json')

      const existingKey = await queries.findApiKeyById(sql, apiKeyId)

      // Check user has admin access to the project
      await acl.project(existingKey.project_id).admin.gte.throw(c)

      const apiKey = await queries.updateApiKey(sql, apiKeyId, body)

      // Remove sensitive hash from response
      const { key_hash, ...sanitized } = apiKey

      return c.json(sanitized)
    })

    // Revoke an API key
    .post('/api-keys/:apiKeyId/revoke', zValidator('param', apiKeyIdParamSchema), async (c) => {
      const { apiKeyId } = c.req.valid('param')

      const existingKey = await queries.findApiKeyById(sql, apiKeyId)

      // Check user has admin access to the project
      await acl.project(existingKey.project_id).admin.gte.throw(c)

      const apiKey = await queries.revokeApiKey(sql, apiKeyId)

      // Remove sensitive hash from response
      const { key_hash, ...sanitized } = apiKey

      return c.json(sanitized)
    })

    // Delete an API key (hard delete)
    .delete('/api-keys/:apiKeyId', zValidator('param', apiKeyIdParamSchema), async (c) => {
      const { apiKeyId } = c.req.valid('param')

      const existingKey = await queries.findApiKeyById(sql, apiKeyId)

      // Check user has admin access to the project
      await acl.project(existingKey.project_id).admin.gte.throw(c)

      await queries.deleteApiKey(sql, apiKeyId)

      return c.json({ success: true })
    })
}
