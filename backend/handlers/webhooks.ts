/**
 * Webhook Handlers
 * Receive events from GitLab, Jira, and other sources
 */

import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger.ts'
import { processTaskSource } from '../services/orchestrator'
import * as taskSourceQueries from '../../db/task-sources'
import type { GitlabIssuesConfig, GithubIssuesConfig, TaskSourceJiraConfig } from '../task-sources/base'

const logger = createLogger({ namespace: 'webhooks' })

export const createWebhookHandlers = (sql: Sql) => ({
  /**
   * GitLab webhook handler
   * Handles issue events from GitLab
   */
  gitlab: async (c: Context) => {
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

        const config = ts.config as GitlabIssuesConfig
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

      // Process each matching task source
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await processTaskSource(sql, {
            taskSourceId: taskSource.id,
            runner: 'claude' // TODO: Make configurable
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to process task source ${taskSource.id}:`, error)
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
  },

  /**
   * Jira webhook handler
   * Handles issue events from Jira
   */
  jira: async (c: Context) => {
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

        const config = ts.config as TaskSourceJiraConfig
        return config.project_key === projectKey
      })

      if (matchingTaskSources.length === 0) {
        logger.warn(`No matching task sources found for Jira project ${projectKey}`)
        return c.json({ success: true, message: 'No matching task sources' })
      }

      // Process each matching task source
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await processTaskSource(sql, {
            taskSourceId: taskSource.id,
            runner: 'claude' // TODO: Make configurable
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to process task source ${taskSource.id}:`, error)
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
  },

  /**
   * GitHub webhook handler
   * Handles issue events from GitHub
   */
  github: async (c: Context) => {
    try {
      const event = c.req.header('X-GitHub-Event')
      // const signature = c.req.header('X-Hub-Signature-256')

      logger.info(`Received GitHub webhook: ${event}`)

      // TODO: Verify webhook signature if GITHUB_WEBHOOK_SECRET is configured

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

        const config = ts.config as GithubIssuesConfig
        const repo = config.repo

        return repo === repository.full_name
      })

      if (matchingTaskSources.length === 0) {
        logger.warn(`No matching task sources found for ${repository.full_name}`)
        return c.json({ success: true, message: 'No matching task sources' })
      }

      // Process each matching task source
      const results = []
      for (const taskSource of matchingTaskSources) {
        try {
          const result = await processTaskSource(sql, {
            taskSourceId: taskSource.id,
            runner: 'claude' // TODO: Make configurable
          })
          results.push({ taskSourceId: taskSource.id, ...result })
        } catch (error) {
          logger.error(`Failed to process task source ${taskSource.id}:`, error)
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
  }
})
