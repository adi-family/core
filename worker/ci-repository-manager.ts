/**
 * CI Repository Manager
 * Source-agnostic service for creating and managing worker repositories
 */

import { GitLabApiClient } from './gitlab-api-client'
import { readFile, readdir } from 'fs/promises'
import { join, relative } from 'path'
import { encrypt, decrypt } from './crypto-utils'
import { createLogger } from '../utils/logger'

const logger = createLogger({ namespace: 'ci-repository-manager' })

export interface WorkerRepositorySource {
  type: 'gitlab'
  project_id?: string
  project_path?: string
  host: string
  user: string
  access_token_encrypted: string
}

export interface CreateWorkerRepositoryConfig {
  projectName: string
  sourceType: 'gitlab'
  host: string
  accessToken: string
  user: string
  customPath: string
}

export interface UploadCIFilesConfig {
  source: WorkerRepositorySource
  version: string
  templateBasePath?: string
}

export class CIRepositoryManager {
  private templateBasePath: string

  constructor(templateBasePath?: string) {
    this.templateBasePath =
      templateBasePath || join(__dirname, 'templates')
  }

  /**
   * Create a worker repository in GitLab
   */
  async createWorkerRepository(
    config: CreateWorkerRepositoryConfig
  ): Promise<WorkerRepositorySource> {
    if (config.sourceType !== 'gitlab') {
      throw new Error(
        `Unsupported source type: ${config.sourceType}. Only 'gitlab' is currently supported.`
      )
    }

    const client = new GitLabApiClient(config.host, config.accessToken)

    // Get user's namespace ID
    const namespaceId = await client.getCurrentUserNamespaceId()

    // Create GitLab project
    const project = await client.createProject({
      name: `adi-worker-${config.projectName}`,
      path: config.customPath.split('/').pop() || config.customPath,
      namespace_id: namespaceId,
      visibility: 'private',
      description: `ADI Worker Repository for ${config.projectName}`,
    })

    logger.info(`✓ Created GitLab project: ${project.path_with_namespace}`)

    return {
      type: 'gitlab',
      project_id: project.id.toString(),
      project_path: project.path_with_namespace,
      host: config.host,
      user: config.user,
      access_token_encrypted: encrypt(config.accessToken),
    }
  }

  /**
   * Recursively get all files in a directory
   */
  private async getAllFiles(dirPath: string, baseDir: string = dirPath): Promise<string[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath, baseDir)
        files.push(...subFiles)
      } else if (entry.isFile()) {
        files.push(relative(baseDir, fullPath))
      }
    }

    return files
  }

  /**
   * Upload CI files to worker repository
   */
  async uploadCIFiles(config: UploadCIFilesConfig): Promise<void> {
    if (config.source.type !== 'gitlab') {
      throw new Error(
        `Unsupported source type: ${config.source.type}`
      )
    }

    const client = new GitLabApiClient(
      config.source.host,
      decrypt(config.source.access_token_encrypted)
    )

    const projectId = config.source.project_id!
    const versionPath = config.version
    const basePath = config.templateBasePath || this.templateBasePath
    const versionDir = join(basePath, versionPath)

    logger.info(`📤 Uploading CI files for version ${versionPath}...`)

    // Get all files recursively from version directory
    const allFiles = await this.getAllFiles(versionDir)

    for (const file of allFiles) {
      const localPath = join(versionDir, file)
      const remotePath = `${versionPath}/${file}`
      const content = await readFile(localPath, 'utf-8')

      // Determine commit message based on file type
      let commitMessage = `Add ${file}`
      if (file.endsWith('.yml')) {
        commitMessage = `Add CI configuration: ${file}`
      } else if (file.includes('worker-scripts')) {
        commitMessage = `Add worker script: ${file}`
      } else if (file === 'README.md') {
        commitMessage = 'Add README documentation'
      }

      await client.uploadFile(
        projectId,
        remotePath,
        content,
        commitMessage,
        'main'
      )

      logger.info(`  ✓ Uploaded ${remotePath}`)
    }

    logger.info(`✅ Successfully uploaded ${allFiles.length} files for version ${versionPath}`)
  }

  /**
   * Update worker repository to a new version
   */
  async updateVersion(
    source: WorkerRepositorySource,
    newVersion: string
  ): Promise<void> {
    logger.info(`🔄 Updating worker repository to version ${newVersion}...`)

    await this.uploadCIFiles({
      source,
      version: newVersion,
    })

    logger.info(`✅ Worker repository updated to version ${newVersion}`)
  }
}
