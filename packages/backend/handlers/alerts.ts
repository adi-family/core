import { Hono } from 'hono'
import type { Sql } from 'postgres'
import * as userAccessQueries from '../../db/user-access'
import * as projectQueries from '../../db/projects'
import { getClerkUserId } from '../middleware/clerk'

export const createAlertRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const alerts: Array<{
        type: 'missing_api_keys'
        severity: 'warning'
        message: string
        providers: string[]
        projects: Array<{ id: string; name: string; missingProviders: string[] }>
      }> = []

      try {
        // Get all projects the user has access to
        const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

        if (accessibleProjectIds.length === 0) {
          return c.json({ alerts })
        }

        // Check each project for missing AI provider configs
        const allMissingProviders = new Set<string>()
        const projectsWithMissingKeys: Array<{ id: string; name: string; missingProviders: string[] }> = []

        for (const projectId of accessibleProjectIds) {
          // Get project details
          const projectResult = await projectQueries.findProjectById(sql, projectId)
          if (!projectResult.ok) {
            continue
          }

          const aiProvidersResult = await projectQueries.getProjectAIProviderConfigs(sql, projectId)

          if (!aiProvidersResult.ok) {
            continue
          }

          const configs = aiProvidersResult.data

          // Check for missing providers
          const providers = ['anthropic', 'openai', 'google'] as const
          const missingForThisProject: string[] = []

          if (!configs) {
            // No configs at all means all providers are missing
            for (const provider of providers) {
              allMissingProviders.add(provider)
              missingForThisProject.push(provider)
            }
          } else {
            // Check which specific providers are missing
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
              name: projectResult.data.name,
              missingProviders: missingForThisProject,
            })
          }
        }

        // Only show projects that are missing ALL API keys
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
