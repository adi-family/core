import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { readFile } from 'fs/promises'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'upload-ci' })

async function main() {
  logger.info('Uploading main GitLab CI files...')

  const gitlabToken = process.env.GITLAB_TOKEN
  if (!gitlabToken) {
    throw new Error('GITLAB_TOKEN environment variable is required')
  }

  const client = new GitLabApiClient('https://gitlab.com', gitlabToken)
  const projectId = '75530560' // artifical-developer/adi-worker-nosh
  const version = '2025-10-18-01'

  const filesToUpload = [
    '.gitlab-ci.yml',
    '.gitlab-ci-claude.yml',
    '.gitlab-ci-evaluation.yml',
    '.gitlab-ci-codex.yml',
    '.gitlab-ci-gemini.yml',
  ]

  const files: Array<{ path: string; content: string }> = []

  for (const fileName of filesToUpload) {
    const localPath = `./packages/worker/templates/${version}/${fileName}`
    const content = await readFile(localPath, 'utf-8')

    files.push({
      path: `${version}/${fileName}`,
      content,
    })

    logger.info(`  📄 Prepared ${fileName}`)
  }

  logger.info(`Uploading ${files.length} files...`)

  const commitMessage = `🔧 Force update CI configuration files - fix implementation pipeline routing`
  await client.uploadFiles(projectId, files, commitMessage, 'main')

  logger.info(`✅ Successfully uploaded ${files.length} CI files`)
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
