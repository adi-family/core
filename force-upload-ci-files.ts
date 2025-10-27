import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { readFile, readdir } from 'fs/promises'
import { join, relative } from 'path'
import { createLogger } from './packages/utils/logger'

const logger = createLogger({ namespace: 'force-upload-ci' })

async function getAllFiles(dirPath: string, baseDir: string = dirPath): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath, baseDir)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      files.push(relative(baseDir, fullPath))
    }
  }

  return files
}

async function main() {
  logger.info('Force uploading CI files to GitLab worker repository...')

  // Get GitLab token from environment
  const gitlabToken = process.env.GITLAB_TOKEN
  if (!gitlabToken) {
    throw new Error('GITLAB_TOKEN environment variable is required')
  }

  const client = new GitLabApiClient('https://gitlab.com', gitlabToken)

  const version = '2025-10-18-01'
  const projectId = '75530560' // artifical-developer/adi-worker-nosh
  const versionDir = join(__dirname, 'packages/worker/templates', version)

  // Get all files recursively from version directory
  const allFiles = await getAllFiles(versionDir)

  // Prepare all files for batch upload
  const filesToUpload: Array<{ path: string; content: string }> = []

  for (const file of allFiles) {
    const localPath = join(versionDir, file)
    const remotePath = `${version}/${file}`
    const content = await readFile(localPath, 'utf-8')

    filesToUpload.push({
      path: remotePath,
      content,
    })

    logger.info(`  📄 Prepared ${remotePath}`)
  }

  // Also upload root .gitlab-ci.yml that routes to versioned config
  const rootCiPath = join(__dirname, 'packages/worker/templates', '.gitlab-ci.yml')
  const rootCiContent = await readFile(rootCiPath, 'utf-8')
  filesToUpload.push({
    path: '.gitlab-ci.yml',
    content: rootCiContent,
  })
  logger.info(`  📄 Prepared .gitlab-ci.yml (root router)`)

  // Upload all files in a single batch commit
  const commitMessage = `🔧 Force update CI files for version ${version} - fix implementation pipeline routing`
  await client.uploadFiles(projectId, filesToUpload, commitMessage, 'main')

  logger.info(`✅ Successfully uploaded ${allFiles.length} files for version ${version}`)
}

main().catch((error) => {
  console.error('❌ Upload failed:', error)
  process.exit(1)
})
