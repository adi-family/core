import { GitLabApiClient } from '../shared/gitlab-api-client'
import { readFile, writeFile, mkdir, rm } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { encrypt, decrypt } from '../shared/crypto-utils'
import { createLogger } from '../utils/logger'
import { assertNever } from "@utils/assert-never.ts"
import { getAllFiles } from '@utils/file-system'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const logger = createLogger({ namespace: 'ci-repository-manager' })

/**
 * Git execution options with proper PATH and shell configuration
 * Ensures git is found in the system PATH (including Homebrew paths)
 */
const gitExecOptions = (cwd: string, extraEnv?: Record<string, string>) => ({
  cwd,
  stdio: 'pipe' as const,
  shell: '/bin/bash',
  env: {
    ...process.env,
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin',
    ...extraEnv,
  }
})

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
  force?: boolean
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

    logger.info(`Created GitLab project: ${project.path_with_namespace}`)

    try {
      await client.enableExternalPipelineVariables(project.id.toString())
      logger.info(`Enabled external pipeline variables for project ${project.path_with_namespace}`)
    } catch (error) {
      logger.warn(`Failed to enable external pipeline variables: ${error instanceof Error ? error.message : String(error)}`)
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

  /**
   * Upload a single file using git directly (bypasses API/nginx timeouts)
   */
  private async uploadFileViaGit(
    repoUrl: string,
    accessToken: string,
    file: { path: string; content: string; encoding?: 'text' | 'base64' },
    commitMessage: string,
    branch = 'main'
  ): Promise<void> {
    const tmpDir = join(tmpdir(), `gitlab-upload-${Date.now()}`)

    try {
      // Create temp directory
      await mkdir(tmpDir, { recursive: true })

      // Clone repository (shallow clone, single branch)
      const repoUrlWithToken = repoUrl.replace('https://', `https://oauth2:${accessToken}@`)

      // Configure git to handle large files better
      execSync(`git clone --depth 1 --single-branch --branch ${branch} "${repoUrlWithToken}" .`,
        gitExecOptions(tmpDir, {
          GIT_HTTP_MAX_REQUEST_BUFFER: '524288000', // 500MB buffer
        })
      )

      // Configure git settings for large files
      execSync('git config http.postBuffer 524288000', gitExecOptions(tmpDir)) // 500MB
      execSync('git config http.lowSpeedLimit 0', gitExecOptions(tmpDir))
      execSync('git config http.lowSpeedTime 999999', gitExecOptions(tmpDir))

      const filePath = join(tmpDir, file.path)
      const fileDir = join(filePath, '..')

      // Create directory if needed
      await mkdir(fileDir, { recursive: true })

      // Write file content
      if (file.encoding === 'base64') {
        await writeFile(filePath, Buffer.from(file.content, 'base64'))
      } else {
        await writeFile(filePath, file.content, 'utf-8')
      }

      // Git add file
      execSync(`git add "${file.path}"`, gitExecOptions(tmpDir))

      // Check if there are changes to commit
      const status = execSync('git status --porcelain', {
        ...gitExecOptions(tmpDir),
        encoding: 'utf-8'
      })
      if (!status.trim()) {
        logger.info(`✓ File ${file.path} already up to date`)
        return
      }

      // Commit
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, gitExecOptions(tmpDir))

      // Push with retry logic
      let pushAttempts = 0
      const maxAttempts = 3
      while (pushAttempts < maxAttempts) {
        try {
          execSync(`git push origin ${branch}`,
            gitExecOptions(tmpDir, {
              GIT_HTTP_MAX_REQUEST_BUFFER: '524288000',
            })
          )
          break
        } catch (error) {
          // Check if error is "Everything up-to-date" - this is not a real failure
          const stderr = error instanceof Error && 'stderr' in error
            ? String((error as any).stderr)
            : ''

          if (stderr.includes('Everything up-to-date')) {
            logger.info('Repository already up-to-date, ignoring push error')
            break
          }

          pushAttempts++
          if (pushAttempts >= maxAttempts) {
            throw error
          }
          logger.warn(`Push attempt ${pushAttempts} failed, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s before retry
        }
      }
    } finally {
      // Clean up temp directory
      try {
        await rm(tmpDir, { recursive: true, force: true })
      } catch (error) {
        logger.warn(`Failed to clean up temp directory: ${error instanceof Error ? error.message : String(error)}`)
      }
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

    // Check if binary exists
    const binariesDir = join(basePath, versionPath, 'binaries')

    if (!existsSync(binariesDir)) {
      throw new Error(`❌ Binary not found at ${binariesDir}. Run: bun run build:binaries`)
    }

    const markerFilePath = `${versionPath}/binaries/worker.js`
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

    const configFiles: { path: string; content: string; encoding?: 'text' | 'base64' }[] = []
    const binaryFilesToUpload: { path: string; content: string; encoding: 'base64'; size: number }[] = []

    // 1. Prepare GitLab CI configuration files
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
        configFiles.push({
          path: `${versionPath}/${configFile}`,
          content,
        })
        logger.info(`  📄 Prepared ${versionPath}/${configFile}`)
      } catch {
        logger.warn(`  ⚠️  ${configFile} not found, skipping`)
      }
    }

    // 2. Prepare compiled binaries
    const binaryFiles = await getAllFiles(binariesDir)
    for (const binaryFile of binaryFiles) {
      const binaryPath = join(binariesDir, binaryFile)
      const content = await readFile(binaryPath)
      const size = content.length
      binaryFilesToUpload.push({
        path: `${versionPath}/binaries/${binaryFile}`,
        content: content.toString('base64'),
        encoding: 'base64',
        size,
      })
      const sizeMB = (size / (1024 * 1024)).toFixed(2)
      logger.info(`  🔨 Prepared ${versionPath}/binaries/${binaryFile} (${sizeMB}MB)`)
    }

    // Also upload root .gitlab-ci.yml that routes to versioned config
    const rootCiPath = join(basePath, '.gitlab-ci.yml')
    try {
      const rootCiContent = await readFile(rootCiPath, 'utf-8')
      configFiles.push({
        path: '.gitlab-ci.yml',
        content: rootCiContent,
      })
      logger.info(`  📄 Prepared .gitlab-ci.yml (root router)`)
    } catch {
      logger.warn(`⚠️  Root .gitlab-ci.yml not found at ${rootCiPath}, skipping`)
    }

    let totalFilesUploaded = 0

    // Upload CI configuration files in a batch (they're small)
    if (configFiles.length > 0) {
      const configCommitMessage = config.force
        ? `📝 Admin refresh: Update ${configFiles.length} CI config files for version ${versionPath}`
        : `📝 Upload CI config files for version ${versionPath} (${configFiles.length} files)`

      logger.info(`📦 Uploading ${configFiles.length} CI config files in batch...`)
      await client.uploadFiles(projectId, configFiles, configCommitMessage, 'main')
      logger.info(`✅ Successfully uploaded ${configFiles.length} CI config files`)
      totalFilesUploaded += configFiles.length
    }

    // Upload binaries via git one at a time (avoids git HTTP backend limits)
    if (binaryFilesToUpload.length > 0) {
      const totalBinarySize = binaryFilesToUpload.reduce((sum, b) => sum + b.size, 0)
      const totalSizeMB = (totalBinarySize / (1024 * 1024)).toFixed(2)

      logger.info(`📦 Uploading ${binaryFilesToUpload.length} binaries via git (${totalSizeMB}MB total)...`)
      logger.info(`   Uploading one at a time to avoid git HTTP backend limits`)

      // Get project details to construct repo URL
      const project = await client.getProject(projectId)
      const accessToken = decrypt(config.source.access_token_encrypted)

      // Upload binaries one at a time to avoid 502 errors
      for (let i = 0; i < binaryFilesToUpload.length; i++) {
        const binary = binaryFilesToUpload[i]!
        const sizeMB = (binary.size / (1024 * 1024)).toFixed(2)

        const binaryCommitMessage = config.force
          ? `🔨 Admin refresh: Update binary ${binary.path} (${sizeMB}MB)`
          : `🔨 Upload binary ${binary.path} (${sizeMB}MB)`

        logger.info(`📦 [${i + 1}/${binaryFilesToUpload.length}] Uploading ${binary.path} (${sizeMB}MB)...`)

        await this.uploadFileViaGit(
          project.http_url_to_repo,
          accessToken,
          binary,
          binaryCommitMessage,
          'main'
        )

        logger.info(`✅ [${i + 1}/${binaryFilesToUpload.length}] Successfully uploaded ${binary.path}`)
        totalFilesUploaded++
      }

      logger.info(`✅ Successfully uploaded all ${binaryFilesToUpload.length} binaries (${totalSizeMB}MB total)`)
    }

    logger.info(`✅ Upload complete: ${totalFilesUploaded} total files (${binaryFilesToUpload.length} binaries, ${configFiles.length} configs)`)
    return totalFilesUploaded
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
