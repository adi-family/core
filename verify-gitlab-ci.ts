import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'verify-ci' })

async function main() {
  const gitlabToken = process.env.GITLAB_TOKEN
  if (!gitlabToken) {
    throw new Error('GITLAB_TOKEN environment variable is required')
  }

  const projectId = process.argv[2] || '75530560' // Default to adi-worker-nosh
  const client = new GitLabApiClient('https://gitlab.com', gitlabToken)

  logger.info(`Checking .gitlab-ci.yml in project ${projectId}...`)

  try {
    const file = await client.getFile(projectId, '.gitlab-ci.yml', 'main')
    logger.info(`✅ .gitlab-ci.yml exists in repository`)
    logger.info(`File size: ${file.content.length} bytes`)

    // Check if it's the routing file
    const content = Buffer.from(file.content, 'base64').toString('utf-8')
    if (content.includes('debug:routing')) {
      logger.info(`✅ File contains debug:routing job - this is the correct routing file`)
    } else {
      logger.warn(`⚠️  File does NOT contain debug:routing job - might be the old file`)
    }

    if (content.includes('RUNNER_TYPE')) {
      logger.info(`✅ File contains RUNNER_TYPE routing logic`)
    }
  } catch (error) {
    logger.error(`❌ .gitlab-ci.yml NOT found or error reading it:`, error)
  }
}

main().catch((error) => {
  console.error('❌ Verification failed:', error)
  process.exit(1)
})
