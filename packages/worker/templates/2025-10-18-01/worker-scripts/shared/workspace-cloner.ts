/**
 * Workspace Cloner - TypeScript replacement for clone-workspace.sh
 * Handles cloning of file space repositories for worker pipelines
 */

import { $ } from 'bun'
import { mkdir, writeFile } from 'fs/promises'

interface FileSpace {
  id: string
  name: string
  repo: string
  token?: string
  branch?: string
}

interface ClonedWorkspace {
  dir: string
  name: string
  branch: string
  id: string
}

interface CloneResult {
  workspaces: ClonedWorkspace[]
  primaryWorkspace: ClonedWorkspace | null
  totalCount: number
  successCount: number
}

export class WorkspaceCloner {
  private baseDir: string
  private cloneDepth: number

  constructor() {
    const pipelineId = process.env.PIPELINE_EXECUTION_ID || 'default'
    this.baseDir = `/tmp/workspace-${pipelineId}`
    this.cloneDepth = parseInt(process.env.CLONE_DEPTH || '4', 10)
  }

  /**
   * Main entry point - clones all file spaces from FILE_SPACES env var
   */
  async cloneWorkspaces(): Promise<CloneResult> {
    console.log('🔄 Starting workspace clone...')
    console.log(`📁 Base directory: ${this.baseDir}`)
    console.log(`📊 Clone depth: ${this.cloneDepth} commits`)

    // Validate environment
    const fileSpacesJson = process.env.FILE_SPACES
    if (!fileSpacesJson) {
      throw new Error('FILE_SPACES environment variable is required')
    }

    if (!process.env.PIPELINE_EXECUTION_ID) {
      throw new Error('PIPELINE_EXECUTION_ID environment variable is required')
    }

    // Parse file spaces
    let fileSpaces: FileSpace[]
    try {
      fileSpaces = JSON.parse(fileSpacesJson)
    } catch (error) {
      throw new Error(`Failed to parse FILE_SPACES JSON: ${error}`)
    }

    console.log(`📦 Found ${fileSpaces.length} file space(s) to clone\n`)

    // Create base directory
    await mkdir(this.baseDir, { recursive: true })

    // Clone each workspace
    const workspaces: ClonedWorkspace[] = []
    for (let i = 0; i < fileSpaces.length; i++) {
      const fileSpace = fileSpaces[i]
      if (!fileSpace) continue

      console.log(`\n📦 Cloning workspace ${i + 1}/${fileSpaces.length}...`)

      try {
        const workspace = await this.cloneWorkspace(fileSpace)
        workspaces.push(workspace)
        console.log(`✅ Successfully cloned: ${workspace.name}`)
      } catch (error) {
        console.error(`❌ Failed to clone ${fileSpace.name}:`, error)
        console.log('⚠️  Continuing with remaining workspaces...')
      }
    }

    if (workspaces.length === 0) {
      throw new Error('No workspaces were cloned successfully')
    }

    console.log(`\n✅ Summary: ${workspaces.length}/${fileSpaces.length} workspace(s) cloned successfully`)

    // Export environment variables for backwards compatibility
    await this.exportEnvironment(workspaces)

    return {
      workspaces,
      primaryWorkspace: workspaces[0] || null,
      totalCount: fileSpaces.length,
      successCount: workspaces.length,
    }
  }

  /**
   * Clone a single workspace
   */
  private async cloneWorkspace(fileSpace: FileSpace): Promise<ClonedWorkspace> {
    console.log(`  Name: ${fileSpace.name}`)
    console.log(`  ID: ${fileSpace.id}`)
    console.log(`  Repository: ${fileSpace.repo}`)

    // Generate workspace directory name
    const sanitizedName = fileSpace.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const idPrefix = fileSpace.id.substring(0, 8)
    const dirName = `${sanitizedName}-${idPrefix}`
    const workspaceDir = `${this.baseDir}/${dirName}`

    console.log(`  Directory: ${dirName}`)

    // Prepare clone URL with authentication
    let cloneUrl = fileSpace.repo
    if (fileSpace.token && cloneUrl.startsWith('https://')) {
      const url = new URL(cloneUrl)
      cloneUrl = `https://oauth2:${fileSpace.token}@${url.host}${url.pathname}`
      console.log('  ✓ Added authentication to clone URL')
    }

    // Determine target branch
    let targetBranch: string
    if (fileSpace.branch) {
      console.log(`  Using specified branch: ${fileSpace.branch}`)
      targetBranch = fileSpace.branch
    } else {
      console.log('  Detecting available branches...')
      targetBranch = await this.detectBranch(cloneUrl)
      console.log(`  ✓ Selected branch: ${targetBranch}`)
    }

    // Create workspace directory
    await mkdir(workspaceDir, { recursive: true })

    // Clone repository
    console.log(`  Cloning into: ${workspaceDir}`)
    try {
      await $`git clone --branch ${targetBranch} --depth ${this.cloneDepth} --single-branch ${cloneUrl} ${workspaceDir}`.quiet()
    } catch (error) {
      throw new Error(`Git clone failed: ${error}`)
    }

    // Get clone statistics
    const commitCount = await $`git -C ${workspaceDir} rev-list --count HEAD`.text()
    const latestCommit = await $`git -C ${workspaceDir} log -1 --format=%h - %s`.text()

    console.log(`  Statistics:`)
    console.log(`    Branch: ${targetBranch}`)
    console.log(`    Commits: ${commitCount.trim()}`)
    console.log(`    Latest: ${latestCommit.trim()}`)

    return {
      dir: workspaceDir,
      name: fileSpace.name,
      branch: targetBranch,
      id: fileSpace.id,
    }
  }

  /**
   * Smart branch detection - tries dev/develop/development → main/master
   */
  private async detectBranch(cloneUrl: string): Promise<string> {
    try {
      const result = await $`git ls-remote --heads ${cloneUrl}`.text()

      if (!result.trim()) {
        throw new Error('Repository returned no branches (empty repository or access issue)')
      }

      // Extract branch names
      const branches = result
        .split('\n')
        .map(line => line.split('refs/heads/')[1])
        .filter((b): b is string => Boolean(b))
        .map(b => b.trim())

      // Priority order: dev, develop, development, main, master
      const priorityBranches = ['dev', 'develop', 'development', 'main', 'master']

      for (const preferred of priorityBranches) {
        if (branches.includes(preferred)) {
          return preferred
        }
      }

      // Fallback: use first available branch
      const firstBranch = branches[0]
      if (firstBranch) {
        console.log(`  ⚠️  No preferred branch found, using: ${firstBranch}`)
        return firstBranch
      }

      throw new Error('No branches found in repository')
    } catch (error) {
      throw new Error(`Failed to detect branch: ${error}`)
    }
  }

  /**
   * Export environment variables for backwards compatibility with shell scripts
   */
  private async exportEnvironment(workspaces: ClonedWorkspace[]): Promise<void> {
    const envContent = `
export WORKSPACE_COUNT=${workspaces.length}
export WORKSPACE_DIRS='${workspaces.map(w => w.dir).join(' ')}'
export WORKSPACE_NAMES='${workspaces.map(w => w.name).join(' ')}'
export WORKSPACE_BRANCHES='${workspaces.map(w => w.branch).join(' ')}'

# Primary workspace (first one) for backwards compatibility
export WORKSPACE_DIR='${workspaces[0]?.dir || ''}'
export WORKSPACE_NAME='${workspaces[0]?.name || ''}'
export WORKSPACE_BRANCH='${workspaces[0]?.branch || ''}'
`.trim()

    const envFile = '/tmp/workspace-env.sh'
    await writeFile(envFile, `${envContent}\n`)
    console.log(`✅ Environment file created: ${envFile}`)
  }

  /**
   * Get cloned workspaces from environment (if already cloned)
   */
  static getWorkspacesFromEnv(): ClonedWorkspace[] | null {
    const dirs = process.env.WORKSPACE_DIRS?.split(' ') || []
    const names = process.env.WORKSPACE_NAMES?.split(' ') || []
    const branches = process.env.WORKSPACE_BRANCHES?.split(' ') || []

    if (dirs.length === 0) {
      return null
    }

    return dirs.map((dir, i) => ({
      dir,
      name: names[i] || '',
      branch: branches[i] || '',
      id: '',
    }))
  }
}

/**
 * CLI entry point - can be called from worker binary or standalone
 */
export async function cloneWorkspaces(): Promise<CloneResult> {
  const cloner = new WorkspaceCloner()
  return await cloner.cloneWorkspaces()
}

// Allow running as standalone script
if (import.meta.main) {
  cloneWorkspaces()
    .then(result => {
      console.log(`\n🎉 Done! ${result.successCount}/${result.totalCount} workspaces cloned`)
      process.exit(0)
    })
    .catch(error => {
      console.error('\n❌ Workspace cloning failed:', error)
      process.exit(1)
    })
}
