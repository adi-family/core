/**
 * CI Repository Manager
 * Source-agnostic service for creating and managing worker repositories
 */

import { GitLabApiClient } from '../shared/gitlab-api-client'
import { readFile, readdir } from 'fs/promises'
import { join, relative } from 'path'
import { encrypt, decrypt } from '../shared/crypto-utils'
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
   * Create a worker repository in GitLab (or use existing if already created)
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

    // Get user information
    const user = await client.getCurrentUser()
    const namespaceId = user.namespace_id

    // Build expected project path
    const projectPath = config.customPath.split('/').pop() || config.customPath
    const fullPath = `${config.user}/${projectPath}`

    // Check if project already exists
    const existingProject = await client.findProjectByPath(fullPath)

    if (existingProject) {
      logger.info(`✓ Found existing GitLab project: ${existingProject.path_with_namespace}`)

      // Enable external pipeline variables for existing projects too
      // This ensures projects created before this feature was added get the correct settings
      try {
        await client.enableExternalPipelineVariables(existingProject.id.toString())
        logger.info(`✓ Enabled external pipeline variables for existing project ${existingProject.path_with_namespace}`)
      } catch (error) {
        logger.warn(`⚠️  Failed to enable external pipeline variables for existing project: ${error instanceof Error ? error.message : String(error)}`)
      }

      return {
        type: 'gitlab',
        project_id: existingProject.id.toString(),
        project_path: existingProject.path_with_namespace,
        host: config.host,
        user: config.user,
        access_token_encrypted: encrypt(config.accessToken),
      }
    }

    // Create GitLab project if it doesn't exist
    const project = await client.createProject({
      name: `adi-worker-${config.projectName}`,
      path: projectPath,
      namespace_id: namespaceId,
      visibility: 'private',
      description: `ADI Worker Repository for ${config.projectName}`,
    })

    logger.info(`✓ Created GitLab project: ${project.path_with_namespace}`)

    // Enable external pipeline variables for the newly created project
    try {
      await client.enableExternalPipelineVariables(project.id.toString())
      logger.info(`✓ Enabled external pipeline variables for project ${project.path_with_namespace}`)
    } catch (error) {
      logger.warn(`⚠️  Failed to enable external pipeline variables: ${error instanceof Error ? error.message : String(error)}`)
    }

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

    // Check if CI files for this version already exist by checking for a key file
    const markerFilePath = `${versionPath}/worker-scripts/evaluation-pipeline.ts`
    try {
      await client.getFile(projectId, markerFilePath, 'main')
      logger.info(`✓ CI files for version ${versionPath} already exist, skipping upload`)
      return
    } catch {
      // Marker file doesn't exist, proceed with upload
      logger.info(`📤 Uploading CI files for version ${versionPath}...`)
    }

    // Get all files recursively from version directory
    const allFiles = await this.getAllFiles(versionDir)

    // Prepare all files for batch upload
    const filesToUpload: Array<{ path: string; content: string }> = []

    for (const file of allFiles) {
      const localPath = join(versionDir, file)
      const remotePath = `${versionPath}/${file}`
      const content = await readFile(localPath, 'utf-8')

      filesToUpload.push({
        path: remotePath,
        content,
      })

      logger.info(`  📄 Prepared ${remotePath}`)
    }

    // Upload all files in a single batch commit
    const commitMessage = `📦 Upload CI files for version ${versionPath} (${allFiles.length} files)`
    await client.uploadFiles(projectId, filesToUpload, commitMessage, 'main')

    logger.info(`✅ Successfully uploaded ${allFiles.length} files for version ${versionPath} in a single commit`)
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
