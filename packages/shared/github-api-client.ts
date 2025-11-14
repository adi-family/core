/**
 * GitHub API Client
 * Handles GitHub repository management, file operations, and workflow triggers
 * Uses native fetch API for API interactions (no external dependencies)
 */

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    id: number
  }
  html_url: string
  description: string | null
  clone_url: string
  ssh_url: string
  default_branch: string
  visibility: 'public' | 'private' | 'internal'
}

export interface GitHubRepositoryCreateInput {
  name: string
  description?: string
  private?: boolean
  auto_init?: boolean
}

export interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: { name: string; color: string }[]
  html_url: string
  created_at: string
  updated_at: string
  user: {
    login: string
    id: number
  }
}

export interface GitHubPullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  head: {
    ref: string
    sha: string
  }
  base: {
    ref: string
    sha: string
  }
  created_at: string
  updated_at: string
}

export interface GitHubPullRequestCreateInput {
  title: string
  head: string
  base: string
  body?: string
}

export interface GitHubFileContent {
  name: string
  path: string
  sha: string
  size: number
  content: string
  encoding: string
}

export interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
  html_url: string
}

export interface GitHubReference {
  ref: string
  node_id: string
  url: string
  object: {
    type: string
    sha: string
    url: string
  }
}

export interface GitHubWorkflowRun {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null
  html_url: string
  created_at: string
  updated_at: string
}

export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
}

export interface GitHubTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha?: string
  content?: string
}

export interface GitHubTree {
  sha: string
  url: string
  tree: GitHubTreeEntry[]
}

export class GitHubApiClient {
  private host: string
  private token: string
  private tokenType: 'oauth' | 'pat'
  private defaultTimeout: number

  constructor(
    token: string,
    host = 'https://api.github.com',
    tokenType: 'oauth' | 'pat' = 'pat',
    defaultTimeout = 30000
  ) {
    // Remove trailing slash and /api/v3 if present
    this.host = host.replace(/\/$/, '').replace(/\/api\/v3$/, '')
    this.token = token
    this.tokenType = tokenType
    this.defaultTimeout = defaultTimeout
  }

  /**
   * Make a GitHub API request with configurable timeout
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    timeoutMs?: number
  ): Promise<T> {
    const url = `${this.host}${endpoint}`
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json'
    }

    console.log(`[GitHubApiClient] Using ${this.tokenType} token type for ${method} ${endpoint}`)
    console.log(`[GitHubApiClient] Request URL: ${url}`)

    const timeout = timeoutMs ?? this.defaultTimeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[GitHubApiClient] Request failed: ${response.status} ${response.statusText}`)
        console.error(`[GitHubApiClient] Response body: ${errorText}`)
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T
      }

      return response.json() as Promise<T>
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GitHub API request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('GET', '/user')
  }

  /**
   * Get token scopes from response headers
   */
  async getTokenScopes(): Promise<string[]> {
    const url = `${this.host}/user`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    const scopes = response.headers.get('X-OAuth-Scopes')
    return scopes ? scopes.split(',').map(s => s.trim()) : []
  }

  /**
   * Create a new repository
   */
  async createRepository(input: GitHubRepositoryCreateInput): Promise<GitHubRepository> {
    return this.request<GitHubRepository>('POST', '/user/repos', {
      name: input.name,
      description: input.description,
      private: input.private ?? true,
      auto_init: input.auto_init ?? false,
    })
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>('GET', `/repos/${owner}/${repo}`)
  }

  /**
   * Get file content from repository
   */
  async getFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<GitHubFileContent> {
    const endpoint = ref
      ? `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`
      : `/repos/${owner}/${repo}/contents/${path}`

    const file = await this.request<GitHubFileContent>('GET', endpoint)

    // Decode base64 content
    if (file.encoding === 'base64') {
      file.content = Buffer.from(file.content, 'base64').toString('utf-8')
    }

    return file
  }

  /**
   * Upload or update a single file
   */
  async uploadFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    sha?: string
  ): Promise<void> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`
    const body: any = {
      message,
      content: Buffer.from(content).toString('base64'),
    }

    if (branch) {
      body.branch = branch
    }

    if (sha) {
      body.sha = sha
    }

    await this.request('PUT', endpoint, body)
  }

  /**
   * Get current commit SHA for a branch or ref
   */
  async getCommitSha(owner: string, repo: string, ref: string): Promise<string> {
    const refData = await this.request<GitHubReference>(
      'GET',
      `/repos/${owner}/${repo}/git/ref/heads/${ref}`
    )
    return refData.object.sha
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch: string
  ): Promise<void> {
    // Get the SHA of the source branch
    const sha = await this.getCommitSha(owner, repo, fromBranch)

    // Create new reference
    await this.request('POST', `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    })
  }

  /**
   * Create a tree (for batch file operations)
   */
  async createTree(
    owner: string,
    repo: string,
    tree: GitHubTreeEntry[],
    baseTree?: string
  ): Promise<GitHubTree> {
    const body: any = { tree }
    if (baseTree) {
      body.base_tree = baseTree
    }

    return this.request<GitHubTree>('POST', `/repos/${owner}/${repo}/git/trees`, body)
  }

  /**
   * Create a commit
   */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[]
  ): Promise<GitHubCommit> {
    return this.request<GitHubCommit>('POST', `/repos/${owner}/${repo}/git/commits`, {
      message,
      tree,
      parents,
    })
  }

  /**
   * Update a reference (e.g., move a branch to a new commit)
   */
  async updateReference(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
    force = false
  ): Promise<void> {
    await this.request('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${ref}`, {
      sha,
      force,
    })
  }

  /**
   * Upload multiple files in a single commit using Git Trees API
   */
  async uploadFiles(
    owner: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string,
    branch?: string
  ): Promise<GitHubCommit> {
    const targetBranch = branch || 'main'

    // Get the current commit SHA of the branch
    const currentSha = await this.getCommitSha(owner, repo, targetBranch)

    // Create tree entries for all files
    const treeEntries: GitHubTreeEntry[] = files.map(file => ({
      path: file.path,
      mode: '100644',
      type: 'blob' as const,
      content: file.content,
    }))

    // Create a new tree
    const tree = await this.createTree(owner, repo, treeEntries, currentSha)

    // Create a new commit
    const commit = await this.createCommit(owner, repo, message, tree.sha, [currentSha])

    // Update the branch reference
    await this.updateReference(owner, repo, targetBranch, commit.sha)

    return commit
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<GitHubPullRequest> {
    return this.request<GitHubPullRequest>('POST', `/repos/${owner}/${repo}/pulls`, {
      title,
      head,
      base,
      body,
    })
  }

  /**
   * List issues with optional filters
   */
  async listIssues(
    owner: string,
    repo: string,
    options?: {
      state?: 'open' | 'closed' | 'all'
      labels?: string[]
      since?: string
      page?: number
      per_page?: number
    }
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams()

    if (options?.state) {
      params.append('state', options.state)
    }
    if (options?.labels && options.labels.length > 0) {
      params.append('labels', options.labels.join(','))
    }
    if (options?.since) {
      params.append('since', options.since)
    }
    if (options?.page) {
      params.append('page', String(options.page))
    }
    if (options?.per_page) {
      params.append('per_page', String(options.per_page))
    }

    const endpoint = `/repos/${owner}/${repo}/issues${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<GitHubIssue[]>('GET', endpoint)
  }

  /**
   * Get a single issue
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>('GET', `/repos/${owner}/${repo}/issues/${issueNumber}`)
  }

  /**
   * Trigger a workflow
   */
  async triggerWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    await this.request('POST', `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
      ref,
      inputs,
    })
  }

  /**
   * Get workflow run details
   */
  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<GitHubWorkflowRun> {
    return this.request<GitHubWorkflowRun>('GET', `/repos/${owner}/${repo}/actions/runs/${runId}`)
  }

  /**
   * List workflow runs for a repository
   */
  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: {
      branch?: string
      status?: string
      per_page?: number
      page?: number
    }
  ): Promise<{ workflow_runs: GitHubWorkflowRun[] }> {
    const params = new URLSearchParams()

    if (options?.branch) {
      params.append('branch', options.branch)
    }
    if (options?.status) {
      params.append('status', options.status)
    }
    if (options?.per_page) {
      params.append('per_page', String(options.per_page))
    }
    if (options?.page) {
      params.append('page', String(options.page))
    }

    const endpoint = `/repos/${owner}/${repo}/actions/runs${params.toString() ? `?${params.toString()}` : ''}`
    return this.request<{ workflow_runs: GitHubWorkflowRun[] }>('GET', endpoint)
  }

  /**
   * Find a repository by path (owner/repo format)
   */
  async findRepositoryByPath(path: string): Promise<GitHubRepository | null> {
    const [owner, repo] = path.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid repository path format: ${path}. Expected format: owner/repo`)
    }

    try {
      return await this.getRepository(owner, repo)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * Get file content as string (convenience method)
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    const file = await this.getFile(owner, repo, path, ref)
    return file.content
  }
}
