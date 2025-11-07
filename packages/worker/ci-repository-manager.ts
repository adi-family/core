/**
 * CI Repository Manager
 * Source-agnostic service for creating and managing worker repositories
 */

import { GitLabApiClient } from '../shared/gitlab-api-client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { encrypt, decrypt } from '../shared/crypto-utils'
import { createLogger } from '../utils/logger'
import { assertNever } from "@utils/assert-never.ts"
import { getAllFiles } from '@utils/file-system'

const logger = createLogger({ namespace: 'ci-repository-manager' })

export interface WorkerRepositorySourceGitlab {
  type: 'gitlab'
  project_id?: string
  project_path?: string
  host: string
  user: string
  access_token_encrypted: string
}

export type WorkerRepositorySource = WorkerRepositorySourceGitlab;

interface CreateGitlabWorkerRepositoryConfig {
  projectName: string
  sourceType: 'gitlab'
  host: string
  accessToken: string
  user: string
  customPath: string
}

export type CreateWorkerRepositoryConfig = CreateGitlabWorkerRepositoryConfig;

export interface UploadCIFilesConfigGitlab {
  source: WorkerRepositorySourceGitlab
  version: string
  templateBasePath?: string
  force?: boolean // Skip marker file check and force upload
}

export type UploadCIFilesConfig = UploadCIFilesConfigGitlab;

interface CreateProjectConfig {
  name: string,
  path: string,
  fullPath: string;
  namespace_id: number;
  visibility: 'private';
  description: string;
}

export class CIRepositoryManager {
  private templateBasePath: string

  constructor(templateBasePath?: string) {
    this.templateBasePath =
      templateBasePath || join(__dirname, 'templates')
  }

  private async upsertProject(client: GitLabApiClient, config: CreateProjectConfig) {
    const existingProject = await client.findProjectByPath(config.fullPath);
    if (existingProject) {
      return existingProject;
    }

    return client.createProject({
      name: config.name,
      path: config.path,
      namespace_id: config.namespace_id,
      visibility: config.visibility,
      description: config.description,
    })
  }

  private async createGitlabWorkerRepository(config: CreateWorkerRepositoryConfig): Promise<WorkerRepositorySource> {
    const client = new GitLabApiClient(config.host, config.accessToken)

    // Get user information
    const user = await client.getCurrentUser()
    const namespaceId = user.namespace_id

    const projectPath = config.customPath.split('/').pop() || config.customPath
    const fullPath = `${config.user}/${projectPath}`

    const project = await this.upsertProject(client, {
      fullPath,
      name: projectPath,
      path: projectPath,
      namespace_id: namespaceId,
      visibility: 'private',
      description: `ADI Worker Repository for ${config.projectName}`,
    })

    logger.info(`✓ Created GitLab project: ${project.path_with_namespace}`)

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

  async createWorkerRepository(
    config: CreateWorkerRepositoryConfig
  ): Promise<WorkerRepositorySource> {
    switch (config.sourceType) {
      case 'gitlab':
        return this.createGitlabWorkerRepository(config);
      default:
        assertNever(config.sourceType);
    }
  }

  private async uploadCIFilesGitlab(config: UploadCIFilesConfigGitlab): Promise<number> {
    const client = new GitLabApiClient(
      config.source.host,
      decrypt(config.source.access_token_encrypted)
    )

    const projectId = config.source.project_id!
    const versionPath = config.version
    const basePath = config.templateBasePath || this.templateBasePath
    const versionDir = join(basePath, versionPath)

    // Check if bundles exist (now inside template directory)
    const bundlesDir = join(basePath, versionPath, 'bundles')
    if (!existsSync(bundlesDir)) {
      throw new Error(`❌ Bundles not found at ${bundlesDir}. Run: bun run build:bundles`)
    }

    const markerFilePath = `${versionPath}/bundles/evaluation-pipeline.js`
    if (!config.force) {
      try {
        await client.getFile(projectId, markerFilePath, 'main')
        logger.info(`✓ CI files for version ${versionPath} already exist, skipping upload`)
        return 0
      } catch {
        logger.info(`📤 Uploading CI files for version ${versionPath}...`)
      }
    } else {
      logger.info(`📤 Force uploading CI files for version ${versionPath}...`)
    }

    const filesToUpload: Array<{ path: string; content: string }> = []

    // 1. Upload GitLab CI configuration files
    const ciConfigs = [
      '.gitlab-ci.yml',
      '.gitlab-ci-evaluation.yml',
      '.gitlab-ci-claude.yml',
      '.gitlab-ci-gemini.yml',
      '.gitlab-ci-codex.yml',
      '.gitlab-ci-workspace-sync.yml',
    ]

    for (const configFile of ciConfigs) {
      const configPath = join(versionDir, configFile)
      try {
        const content = await readFile(configPath, 'utf-8')
        filesToUpload.push({
          path: `${versionPath}/${configFile}`,
          content,
        })
        logger.info(`  📄 Prepared ${versionPath}/${configFile}`)
      } catch {
        logger.warn(`  ⚠️  ${configFile} not found, skipping`)
      }
    }

    // 2. Upload bundled JavaScript files
    const bundleFiles = await getAllFiles(bundlesDir)
    for (const bundleFile of bundleFiles) {
      const bundlePath = join(bundlesDir, bundleFile)
      const content = await readFile(bundlePath, 'utf-8')
      filesToUpload.push({
        path: `${versionPath}/bundles/${bundleFile}`,
        content,
      })
      logger.info(`  📦 Prepared ${versionPath}/bundles/${bundleFile}`)
    }

    // 3. Upload shell scripts (still needed for workspace cloning)
    const scriptsDir = join(versionDir, 'worker-scripts')
    if (existsSync(scriptsDir)) {
      const scriptFiles = await getAllFiles(scriptsDir)
      const shellScripts = scriptFiles.filter(f => f.endsWith('.sh'))

      for (const scriptFile of shellScripts) {
        const scriptPath = join(scriptsDir, scriptFile)
        const content = await readFile(scriptPath, 'utf-8')
        filesToUpload.push({
          path: `${versionPath}/worker-scripts/${scriptFile}`,
          content,
        })
        logger.info(`  📜 Prepared ${versionPath}/worker-scripts/${scriptFile}`)
      }
    }

    // Also upload root .gitlab-ci.yml that routes to versioned config
    const rootCiPath = join(basePath, '.gitlab-ci.yml')
    try {
      const rootCiContent = await readFile(rootCiPath, 'utf-8')
      filesToUpload.push({
        path: '.gitlab-ci.yml',
        content: rootCiContent,
      })
      logger.info(`  📄 Prepared .gitlab-ci.yml (root router)`)
    } catch {
      logger.warn(`⚠️  Root .gitlab-ci.yml not found at ${rootCiPath}, skipping`)
    }

    // Upload all files in a single batch commit
    const commitMessage = config.force
      ? `📦 Admin refresh: Update ${filesToUpload.length} files for version ${versionPath} (bundled)`
      : `📦 Upload CI files for version ${versionPath} (${filesToUpload.length} files, bundled)`
    await client.uploadFiles(projectId, filesToUpload, commitMessage, 'main')

    logger.info(`✅ Successfully uploaded ${filesToUpload.length} files for version ${versionPath} in a single commit`)
    logger.info(`   ${bundleFiles.length} bundles, ${ciConfigs.length} CI configs`)
    return filesToUpload.length
  }

  async uploadCIFiles(config: UploadCIFilesConfig): Promise<number> {
    switch (config.source.type) {
      case "gitlab":
        return this.uploadCIFilesGitlab(config)
      default:
        assertNever(config.source.type);
    }
  }

  /**
   * Update worker repository to a new version
   */
  async updateVersion(
    source: WorkerRepositorySource,
    version: string
  ): Promise<void> {
    logger.debug(`🔄 Updating worker repository to version ${version}...`)
    await this.uploadCIFiles({ source, version })
    logger.debug(`✅ Worker repository updated to version ${version}`)
  }
}
