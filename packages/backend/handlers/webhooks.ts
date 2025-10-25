/**
 * Webhook Handlers
 * Receive events from GitLab, Jira, and other sources
 */

import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger.ts'
import { syncTaskSource } from '../services/orchestrator'
import * as taskSourceQueries from '../../db/task-sources'

const logger = createLogger({ namespace: 'webhooks' })

export const createWebhookRoutes = (sql: Sql) => {
  return new Hono()
    /**
     * GitLab webhook handler
     * Handles issue events from GitLab
     */
    .post('/gitlab', async (c) => {
    try {
      const event = c.req.header('X-Gitlab-Event')
      const token = c.req.header('X-Gitlab-Token')

      logger.info(`Received GitLab webhook: ${event}`)

      // Verify webhook token if configured
      const webhookSecret = process.env.GITLAB_WEBHOOK_SECRET
      if (webhookSecret && token !== webhookSecret) {
        logger.warn('Invalid GitLab webhook token')
        return c.json({ error: 'Unauthorized' }, 401)
      }

      // Only process issue events
      if (event !== 'Issue Hook') {
        logger.info(`Ignoring non-issue event: ${event}`)
        return c.json({ success: true, message: 'Event ignored' })
      }

      const payload = await c.req.json()
      const issue = payload.object_attributes
      const project = payload.project

      logger.info(`GitLab issue event: ${issue.action} - ${project.path_with_namespace}#${issue.iid}`)

      // Find matching task sources for this GitLab project
      const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
      const matchingTaskSources = allTaskSources.filter(ts => {
        if (ts.type !== 'gitlab_issues' || !ts.enabled) {
          return false
        }

        const config = ts.config
        const host = config.host || 'https://gitlab.com'
        const repo = config.repo

        return (
          host === (project.web_url?.split(project.path_with_namespace)[0]?.replace(/\/$/, '') || 'https://gitlab.com') &&
          repo === project.path_with_namespace
        )
      })

      if (matchingTaskSources.length === 0) {
        logger.warn(`No matching task sources found for ${project.path_with_namespace}`)
        return c.json({ success: true, message: 'No matching task sources' })
      }

      // Sync each matching task source (publish to RabbitMQ)
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await syncTaskSource(sql, {
            taskSourceId: taskSource.id
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to sync task source ${taskSource.id}:`, error)
          results.push({
            taskSourceId: taskSource.id,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      return c.json({ success: true, results })
    } catch (error) {
      logger.error('GitLab webhook error:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
    }
    })
    /**
     * Jira webhook handler
     * Handles issue events from Jira
     */
    .post('/jira', async (c) => {
    try {
      const payload = await c.req.json()
      const webhookEvent = payload.webhookEvent

      logger.info(`Received Jira webhook: ${webhookEvent}`)

      // Only process issue events
      if (!webhookEvent?.startsWith('jira:issue_')) {
        logger.info(`Ignoring non-issue event: ${webhookEvent}`)
        return c.json({ success: true, message: 'Event ignored' })
      }

      const issue = payload.issue
      const projectKey = issue.fields.project.key

      logger.info(`Jira issue event: ${webhookEvent} - ${projectKey}-${issue.key}`)

      // Find matching task sources for this Jira project
      const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
      const matchingTaskSources = allTaskSources.filter(ts => {
        if (ts.type !== 'jira' || !ts.enabled) {
          return false
        }

        const config = ts.config
        return config.project_key === projectKey
      })

      if (matchingTaskSources.length === 0) {
        logger.warn(`No matching task sources found for Jira project ${projectKey}`)
        return c.json({ success: true, message: 'No matching task sources' })
      }

      // Sync each matching task source (publish to RabbitMQ)
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await syncTaskSource(sql, {
            taskSourceId: taskSource.id
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to sync task source ${taskSource.id}:`, error)
          results.push({
            taskSourceId: taskSource.id,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      return c.json({ success: true, results })
    } catch (error) {
      logger.error('Jira webhook error:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
    }
    })
    /**
     * GitHub webhook handler
     * Handles issue events from GitHub
     */
    .post('/github', async (c) => {
    try {
      const event = c.req.header('X-GitHub-Event')
      const signature = c.req.header('X-Hub-Signature-256')

      logger.info(`Received GitHub webhook: ${event}`)

      // Verify webhook signature if GITHUB_WEBHOOK_SECRET is configured
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
      if (webhookSecret && signature) {
        const crypto = await import('crypto')
        const body = await c.req.text()
        const hmac = crypto.createHmac('sha256', webhookSecret)
        const digest = 'sha256=' + hmac.update(body).digest('hex')

        if (signature !== digest) {
          logger.warn('GitHub webhook signature verification failed')
          return c.json({ error: 'Invalid signature' }, 401)
        }
        logger.debug('GitHub webhook signature verified')

        // Re-parse JSON since we consumed the body for signature verification
        const payload = JSON.parse(body)
        c.req.bodyCache.json = payload
      } else if (webhookSecret && !signature) {
        logger.warn('GitHub webhook secret configured but no signature provided')
        return c.json({ error: 'Signature required' }, 401)
      }

      // Only process issue events
      if (event !== 'issues') {
        logger.info(`Ignoring non-issue event: ${event}`)
        return c.json({ success: true, message: 'Event ignored' })
      }

      const payload = await c.req.json()
      const issue = payload.issue
      const repository = payload.repository

      logger.info(`GitHub issue event: ${payload.action} - ${repository.full_name}#${issue.number}`)

      // Find matching task sources for this GitHub repo
      const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
      const matchingTaskSources = allTaskSources.filter(ts => {
        if (ts.type !== 'github_issues' || !ts.enabled) {
          return false
        }

        const config = ts.config
        const repo = config.repo

        return repo === repository.full_name
      })

      if (matchingTaskSources.length === 0) {
        logger.warn(`No matching task sources found for ${repository.full_name}`)
        return c.json({ success: true, message: 'No matching task sources' })
      }

      // Sync each matching task source (publish to RabbitMQ)
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await syncTaskSource(sql, {
            taskSourceId: taskSource.id
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to sync task source ${taskSource.id}:`, error)
          results.push({
            taskSourceId: taskSource.id,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      return c.json({ success: true, results })
    } catch (error) {
      logger.error('GitHub webhook error:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
    }
    })
}
