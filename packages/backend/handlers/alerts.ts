import { Hono } from 'hono'
import type { Sql } from 'postgres'
import * as userAccessQueries from '../../db/user-access'
import * as projectQueries from '../../db/projects'
import { reqAuthed } from '../middleware/authz'

export const createAlertRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const userId = await reqAuthed(c)

      const alerts: Array<{
        type: 'missing_api_keys'
        severity: 'warning'
        message: string
        providers: string[]
        projects: Array<{ id: string; name: string; missingProviders: string[] }>
      }> = []

      try {
        const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
        if (accessibleProjectIds.length === 0) {
          return c.json({ alerts })
        }

        const allMissingProviders = new Set<string>()
        const projectsWithMissingKeys: Array<{ id: string; name: string; missingProviders: string[] }> = []

        for (const projectId of accessibleProjectIds) {
          let project
          try {
            project = await projectQueries.findProjectById(sql, projectId)
          } catch {
            continue
          }

          const configs = await projectQueries.getProjectAIProviderConfigs(sql, projectId)

          const providers = ['anthropic', 'openai', 'google'] as const
          const missingForThisProject: string[] = []

          if (!configs) {
            for (const provider of providers) {
              allMissingProviders.add(provider)
              missingForThisProject.push(provider)
            }
          } else {
            for (const provider of providers) {
              if (!configs[provider]) {
                allMissingProviders.add(provider)
                missingForThisProject.push(provider)
              }
            }
          }

          if (missingForThisProject.length > 0) {
            projectsWithMissingKeys.push({
              id: projectId,
              name: project.name,
              missingProviders: missingForThisProject,
            })
          }
        }

        const projectsMissingAllKeys = projectsWithMissingKeys.filter(
          project => project.missingProviders.length === 3
        )

        if (projectsMissingAllKeys.length > 0) {
          const providerNames = ['Anthropic', 'OpenAI', 'Google']

          alerts.push({
            type: 'missing_api_keys',
            severity: 'warning',
            message: `The following projects are missing API keys for: ${providerNames.join(', ')}`,
            providers: ['anthropic', 'openai', 'google'],
            projects: projectsMissingAllKeys,
          })
        }

        return c.json({ alerts })
      } catch (error) {
        console.error('Error fetching alerts:', error)
        return c.json({ alerts: [] })
      }
    })
}
