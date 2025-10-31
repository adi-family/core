/**
 * Quota Management Handler
 * Provides endpoints for managing user evaluation quotas
 */

import { Hono } from 'hono'
import type { Sql } from 'postgres'
import * as quotaQueries from '@db/user-quotas'
import * as taskQueries from '@db/tasks'
import { selectAIProviderForEvaluation, checkProjectHasAnthropicProvider } from '../services/ai-provider-selector'
import { hasPlatformAnthropicConfig } from '../config'
import { reqAdminAuthed, reqAuthed } from '@backend/middleware/authz'

export const createQuotaRoutes = (sql: Sql) => {
  return new Hono()
    .get('/user/quota', async (c) => {
      const userId = await reqAuthed(c);

      try {
        const quota = await quotaQueries.getUserQuota(sql, userId)

        return c.json({
          simple: {
            used: quota.simple_evaluations_used,
            soft_limit: quota.simple_evaluations_soft_limit,
            hard_limit: quota.simple_evaluations_hard_limit,
            remaining: Math.max(0, quota.simple_evaluations_hard_limit - quota.simple_evaluations_used),
            at_soft_limit: quota.simple_evaluations_used >= quota.simple_evaluations_soft_limit,
            at_hard_limit: quota.simple_evaluations_used >= quota.simple_evaluations_hard_limit,
          },
          advanced: {
            used: quota.advanced_evaluations_used,
            soft_limit: quota.advanced_evaluations_soft_limit,
            hard_limit: quota.advanced_evaluations_hard_limit,
            remaining: Math.max(0, quota.advanced_evaluations_hard_limit - quota.advanced_evaluations_used),
            at_soft_limit: quota.advanced_evaluations_used >= quota.advanced_evaluations_soft_limit,
            at_hard_limit: quota.advanced_evaluations_used >= quota.advanced_evaluations_hard_limit,
          },
          platform_provider_available: hasPlatformAnthropicConfig(),
        })
      } catch (error: any) {
        return c.json({ error: error.message }, 500)
      }
    })

    .post('/tasks/:id/check-evaluation-quota', (async (c) => {
      const userId = await reqAuthed(c);
      const taskId = c.req.param('id')
      const body = await c.req.json()
      const evaluationType = body.evaluation_type as 'simple' | 'advanced'

      if (!evaluationType || !['simple', 'advanced'].includes(evaluationType)) {
        return c.json({ error: 'Invalid evaluation_type. Must be "simple" or "advanced"' }, 400)
      }

      try {
        const task = await taskQueries.findTaskById(sql, taskId)

        if (!task.project_id) {
          return c.json({ error: 'Task has no associated project' }, 400)
        }

        const quotaCheck = await quotaQueries.checkQuotaAvailable(sql, userId, evaluationType)
        const hasProjectProvider = await checkProjectHasAnthropicProvider(sql, task.project_id)
        const platformAvailable = hasPlatformAnthropicConfig()

        return c.json({
          can_proceed: quotaCheck.can_proceed || hasProjectProvider,
          uses_platform_token: quotaCheck.can_proceed && platformAvailable,
          quota: {
            used: quotaCheck.used,
            soft_limit: quotaCheck.soft_limit,
            hard_limit: quotaCheck.hard_limit,
            remaining: quotaCheck.remaining,
            at_soft_limit: quotaCheck.at_soft_limit,
            at_hard_limit: quotaCheck.at_hard_limit,
          },
          has_project_provider: hasProjectProvider,
          warning: quotaCheck.at_soft_limit
            ? `You are using ${quotaCheck.used}/${quotaCheck.hard_limit} free ${evaluationType} evaluations. ` +
              `Consider configuring your own Anthropic API key in project settings.`
            : undefined,
          error: quotaCheck.at_hard_limit && !hasProjectProvider
            ? `Free ${evaluationType} evaluation quota exceeded (${quotaCheck.used}/${quotaCheck.hard_limit}). ` +
              `Please configure your own Anthropic API key in project settings to continue.`
            : undefined,
        })
      } catch (error: any) {
        return c.json({ error: error.message }, 500)
      }
    }))

    .get('/tasks/:id/ai-provider-selection', (async (c) => {
      const userId = await reqAuthed(c);
      const taskId = c.req.param('id')
      const evaluationType = c.req.query('type') as 'simple' | 'advanced'

      if (!evaluationType || !['simple', 'advanced'].includes(evaluationType)) {
        return c.json({ error: 'Invalid type query parameter. Must be "simple" or "advanced"' }, 400)
      }

      const task = await taskQueries.findTaskById(sql, taskId)
      if (!task.project_id) {
        return c.json({ error: 'Task has no associated project' }, 400)
      }

      const selection = await selectAIProviderForEvaluation(
        sql,
        userId,
        task.project_id,
        evaluationType
      )

      return c.json(selection)
    }))

    .get('/admin/quotas', (async (c) => {
      await reqAdminAuthed(c, sql);
      try {
        const quotas = await quotaQueries.getAllUserQuotas(sql)

        return c.json({
          quotas: quotas.map(q => ({
            user_id: q.user_id,
            simple: {
              used: q.simple_evaluations_used,
              soft_limit: q.simple_evaluations_soft_limit,
              hard_limit: q.simple_evaluations_hard_limit,
            },
            advanced: {
              used: q.advanced_evaluations_used,
              soft_limit: q.advanced_evaluations_soft_limit,
              hard_limit: q.advanced_evaluations_hard_limit,
            },
            created_at: q.created_at,
            updated_at: q.updated_at,
          })),
        })
      } catch (error: any) {
        return c.json({ error: error.message }, 500)
      }
    }))

    .put('/admin/quotas/:userId', (async (c) => {
      await reqAdminAuthed(c, sql);
      const targetUserId = c.req.param('userId')
      const body = await c.req.json()

      const limits: {
        simple_soft?: number
        simple_hard?: number
        advanced_soft?: number
        advanced_hard?: number
      } = {}

      if (body.simple_soft_limit !== undefined) {
        limits.simple_soft = body.simple_soft_limit
      }
      if (body.simple_hard_limit !== undefined) {
        limits.simple_hard = body.simple_hard_limit
      }
      if (body.advanced_soft_limit !== undefined) {
        limits.advanced_soft = body.advanced_soft_limit
      }
      if (body.advanced_hard_limit !== undefined) {
        limits.advanced_hard = body.advanced_hard_limit
      }

      const quota = await quotaQueries.setUserQuotaLimits(sql, targetUserId, limits)

      return c.json({
        user_id: quota.user_id,
        simple: {
          used: quota.simple_evaluations_used,
          soft_limit: quota.simple_evaluations_soft_limit,
          hard_limit: quota.simple_evaluations_hard_limit,
        },
        advanced: {
          used: quota.advanced_evaluations_used,
          soft_limit: quota.advanced_evaluations_soft_limit,
          hard_limit: quota.advanced_evaluations_hard_limit,
        },
      });
    }))

    .post('/admin/quotas/:userId/reset', (async (c) => {
      await reqAdminAuthed(c, sql);
      const targetUserId = c.req.param('userId')
      const body = await c.req.json()
      const resetType = body.reset_type as 'simple' | 'advanced' | 'both'

      if (!resetType || !['simple', 'advanced', 'both'].includes(resetType)) {
        return c.json({ error: 'Invalid reset_type. Must be "simple", "advanced", or "both"' }, 400)
      }

      const dbResetType = resetType === 'both' ? 'all' : resetType
      const quota = await quotaQueries.resetUserQuotaUsage(sql, targetUserId, dbResetType)

      return c.json({
        user_id: quota.user_id,
        simple: {
          used: quota.simple_evaluations_used,
          soft_limit: quota.simple_evaluations_soft_limit,
          hard_limit: quota.simple_evaluations_hard_limit,
        },
        advanced: {
          used: quota.advanced_evaluations_used,
          soft_limit: quota.advanced_evaluations_soft_limit,
          hard_limit: quota.advanced_evaluations_hard_limit,
        },
      });
    }))
}
