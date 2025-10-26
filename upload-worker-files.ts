import { CIRepositoryManager } from './packages/worker/ci-repository-manager'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'upload-worker' })

async function main() {
  logger.info('Uploading updated worker files to GitLab...')

  // Get GitLab token from environment
  const gitlabToken = process.env.GITLAB_TOKEN
  if (!gitlabToken) {
    throw new Error('GITLAB_TOKEN environment variable is required')
  }

  // Use a fake encrypted token and directly access the GitLab API
  const { GitLabApiClient } = await import('./packages/shared/gitlab-api-client')
  const client = new GitLabApiClient('https://gitlab.com', gitlabToken)

  const version = '2025-10-18-01'
  const projectId = '75530560'

  const { CIFilesUploader } = await import('./packages/worker/ci-files-uploader')
  const uploader = new CIFilesUploader(client, projectId)

  await uploader.uploadDirectory(version, `./packages/worker/templates/${version}`)

  logger.info('✅ Worker files uploaded successfully!')
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
