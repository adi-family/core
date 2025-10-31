/**
 * Webhook Handlers
 * Receive events from GitLab, Jira, and other sources
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger.ts'
import { syncTaskSource } from '../services/orchestrator'
import * as taskSourceQueries from '@db/task-sources'
import crypto from 'crypto'
import { GITLAB_WEBHOOK_SECRET, GITHUB_WEBHOOK_SECRET } from '../config'

const logger = createLogger({ namespace: 'webhooks' })

/**
 * Sync multiple task sources and return results
 */
async function syncMatchingTaskSources(sql: Sql, taskSources: any[]): Promise<any[]> {
  const results = []
  for (const taskSource of taskSources) {
    try {
      const result = await syncTaskSource(sql, { taskSourceId: taskSource.id })
      results.push({ taskSourceId: taskSource.id, ...result })
    } catch (error) {
      logger.error(`Failed to sync task source ${taskSource.id}:`, error)
      results.push({
        taskSourceId: taskSource.id,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return results
}

/**
 * Find task sources matching a filter
 */
async function findMatchingTaskSources(
  sql: Sql,
  type: string,
  matcher: (taskSource: any) => boolean
): Promise<any[]> {
  const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
  return allTaskSources.filter(ts => {
    if (ts.type !== type || !ts.enabled) return false
    return matcher(ts)
  })
}

/**
 * Handle GitLab webhook
 */
async function handleGitLabWebhook(c: Context, sql: Sql) {
  const event = c.req.header('X-Gitlab-Event')
  const token = c.req.header('X-Gitlab-Token')

  logger.info(`Received GitLab webhook: ${event}`)

  if (GITLAB_WEBHOOK_SECRET && token !== GITLAB_WEBHOOK_SECRET) {
    logger.warn('Invalid GitLab webhook token')
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (event !== 'Issue Hook') {
    logger.info(`Ignoring non-issue event: ${event}`)
    return c.json({ success: true, message: 'Event ignored' })
  }

  const payload = await c.req.json()
  const issue = payload.object_attributes
  const project = payload.project

  logger.info(`GitLab issue event: ${issue.action} - ${project.path_with_namespace}#${issue.iid}`)

  const matchingTaskSources = await findMatchingTaskSources(sql, 'gitlab_issues', (ts) => {
    const config = ts.config
    const host = config.host || 'https://gitlab.com'
    const repo = config.repo
    const projectHost = project.web_url?.split(project.path_with_namespace)[0]?.replace(/\/$/, '') || 'https://gitlab.com'

    return host === projectHost && repo === project.path_with_namespace
  })

  if (matchingTaskSources.length === 0) {
    logger.warn(`No matching task sources found for ${project.path_with_namespace}`)
    return c.json({ success: true, message: 'No matching task sources' })
  }

  const results = await syncMatchingTaskSources(sql, matchingTaskSources)
  return c.json({ success: true, results })
}

/**
 * Handle Jira webhook
 */
async function handleJiraWebhook(c: Context, sql: Sql) {
  const payload = await c.req.json()
  const webhookEvent = payload.webhookEvent

  logger.info(`Received Jira webhook: ${webhookEvent}`)

  if (!webhookEvent?.startsWith('jira:issue_')) {
    logger.info(`Ignoring non-issue event: ${webhookEvent}`)
    return c.json({ success: true, message: 'Event ignored' })
  }

  const issue = payload.issue
  const projectKey = issue.fields.project.key

  logger.info(`Jira issue event: ${webhookEvent} - ${projectKey}-${issue.key}`)

  const matchingTaskSources = await findMatchingTaskSources(sql, 'jira', (ts) => {
    return ts.config.project_key === projectKey
  })

  if (matchingTaskSources.length === 0) {
    logger.warn(`No matching task sources found for Jira project ${projectKey}`)
    return c.json({ success: true, message: 'No matching task sources' })
  }

  const results = await syncMatchingTaskSources(sql, matchingTaskSources)
  return c.json({ success: true, results })
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(body: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET!)
  const digest = 'sha256=' + hmac.update(body).digest('hex')
  return signature === digest
}

/**
 * Handle GitHub webhook
 */
async function handleGitHubWebhook(c: Context, sql: Sql) {
  const event = c.req.header('X-GitHub-Event')
  const signature = c.req.header('X-Hub-Signature-256')

  logger.info(`Received GitHub webhook: ${event}`)

  if (GITHUB_WEBHOOK_SECRET) {
    if (!signature) {
      logger.warn('GitHub webhook secret configured but no signature provided')
      return c.json({ error: 'Signature required' }, 401)
    }

    const body = await c.req.text()
    if (!verifyGitHubSignature(body, signature)) {
      logger.warn('GitHub webhook signature verification failed')
      return c.json({ error: 'Invalid signature' }, 401)
    }

    logger.debug('GitHub webhook signature verified')
    c.req.bodyCache.json = JSON.parse(body)
  }

  if (event !== 'issues') {
    logger.info(`Ignoring non-issue event: ${event}`)
    return c.json({ success: true, message: 'Event ignored' })
  }

  const payload = await c.req.json()
  const issue = payload.issue
  const repository = payload.repository

  logger.info(`GitHub issue event: ${payload.action} - ${repository.full_name}#${issue.number}`)

  const matchingTaskSources = await findMatchingTaskSources(sql, 'github_issues', (ts) => {
    return ts.config.repo === repository.full_name
  })

  if (matchingTaskSources.length === 0) {
    logger.warn(`No matching task sources found for ${repository.full_name}`)
    return c.json({ success: true, message: 'No matching task sources' })
  }

  const results = await syncMatchingTaskSources(sql, matchingTaskSources)
  return c.json({ success: true, results })
}

/**
 * Wrap webhook handler with error handling
 */
function wrapWebhookHandler(
  handler: (c: Context, sql: Sql) => Promise<any>,
  name: string
) {
  return async (c: Context, sql: Sql) => {
    try {
      return await handler(c, sql)
    } catch (error) {
      logger.error(`${name} webhook error:`, error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
    }
  }
}

/**
 * Create webhook routes
 */
export const createWebhookRoutes = (sql: Sql) => {
  const gitlabHandler = wrapWebhookHandler(handleGitLabWebhook, 'GitLab')
  const jiraHandler = wrapWebhookHandler(handleJiraWebhook, 'Jira')
  const githubHandler = wrapWebhookHandler(handleGitHubWebhook, 'GitHub')

  return new Hono()
    .post('/gitlab', (c) => gitlabHandler(c, sql))
    .post('/jira', (c) => jiraHandler(c, sql))
    .post('/github', (c) => githubHandler(c, sql))
}
