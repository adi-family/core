import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'force-upload-root-ci' })

async function main() {
  logger.info('Force uploading root .gitlab-ci.yml to GitLab worker repository...')

  // Get GitLab token from environment
  const gitlabToken = process.env.GITLAB_TOKEN
  if (!gitlabToken) {
    throw new Error('GITLAB_TOKEN environment variable is required')
  }

  const client = new GitLabApiClient('https://gitlab.com', gitlabToken)
  const projectId = '75530560' // artifical-developer/adi-worker-nosh

  // Read the root CI file
  const rootCiPath = join(__dirname, 'packages/worker/templates', '.gitlab-ci.yml')
  const rootCiContent = await readFile(rootCiPath, 'utf-8')

  logger.info(`Read root .gitlab-ci.yml from ${rootCiPath}`)
  logger.info(`File size: ${rootCiContent.length} bytes`)

  // Verify it contains the debug job
  if (!rootCiContent.includes('debug:routing')) {
    throw new Error('Root .gitlab-ci.yml does not contain debug:routing job!')
  }
  logger.info(`✅ File contains debug:routing job`)

  // Upload just this one file
  const commitMessage = `🔧 Force update root .gitlab-ci.yml with routing debug`
  await client.uploadFiles(
    projectId,
    [{ path: '.gitlab-ci.yml', content: rootCiContent }],
    commitMessage,
    'main'
  )

  logger.info(`✅ Successfully uploaded root .gitlab-ci.yml`)

  // Verify it was uploaded correctly
  const verifyFile = await client.getFile(projectId, '.gitlab-ci.yml', 'main')
  const verifyContent = Buffer.from(verifyFile.content, 'base64').toString('utf-8')

  if (verifyContent.includes('debug:routing')) {
    logger.info(`✅ VERIFIED: File now contains debug:routing job`)
  } else {
    logger.error(`❌ VERIFICATION FAILED: File still doesn't contain debug:routing job`)
  }
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
