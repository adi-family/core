#!/usr/bin/env bun
// @bun

// templates/2025-10-18-01/worker-scripts/push-to-file-spaces.ts
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";

// templates/2025-10-18-01/worker-scripts/shared/api-client.ts
class ApiClient {
  baseUrl;
  token;
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  async fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}
${errorText}`);
    }
    return await response.json();
  }
  async getSession(sessionId) {
    return this.fetch(`/api/sessions/${sessionId}`);
  }
  async getTask(taskId) {
    return this.fetch(`/api/tasks/${taskId}`);
  }
  async getFileSpace(fileSpaceId) {
    return this.fetch(`/api/file-spaces/${fileSpaceId}`);
  }
  async getFileSpacesByProject(projectId) {
    return this.fetch(`/api/file-spaces?project_id=${projectId}`);
  }
  async getFileSpacesByTask(taskId) {
    return this.fetch(`/api/tasks/${taskId}/file-spaces`);
  }
  async getSecretValue(secretId) {
    const result = await this.fetch(`/api/secrets/${secretId}/value`);
    return result.value;
  }
  async createPipelineArtifact(executionId, data) {
    await this.fetch(`/pipeline-executions/${executionId}/artifacts`, {
      method: "POST",
      body: JSON.stringify({
        pipeline_execution_id: executionId,
        ...data
      })
    });
  }
  async updateTaskStatus(taskId, status) {
    await this.fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  }
  async updateTaskEvaluationStatus(taskId, evaluationStatus) {
    await this.fetch(`/api/tasks/${taskId}/evaluation-status`, {
      method: "POST",
      body: JSON.stringify({ status: evaluationStatus })
    });
  }
  async updateTaskEvaluationResult(taskId, result) {
    await this.fetch(`/api/tasks/${taskId}/evaluation-result`, {
      method: "PATCH",
      body: JSON.stringify({ result })
    });
  }
  async updateTaskEvaluationSimple(taskId, simpleResult) {
    await this.fetch(`/api/tasks/${taskId}/evaluation-simple`, {
      method: "PATCH",
      body: JSON.stringify({ simpleResult })
    });
  }
  async updateTaskEvaluationAgentic(taskId, agenticResult) {
    await this.fetch(`/api/tasks/${taskId}/evaluation-agentic`, {
      method: "PATCH",
      body: JSON.stringify({ agenticResult })
    });
  }
  async updateTaskImplementationStatus(taskId, status) {
    await this.fetch(`/api/tasks/${taskId}/implementation-status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  }
  async saveApiUsage(executionId, sessionId, taskId, usage) {
    await this.fetch(`/pipeline-executions/${executionId}/usage`, {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        task_id: taskId,
        ...usage
      })
    });
  }
}

// templates/2025-10-18-01/worker-scripts/shared/logger.ts
function createLogger(config) {
  const namespace = config?.namespace || "worker";
  const prefix = `[${namespace}]`;
  return {
    info: (message, ...args) => {
      console.log(`${prefix} INFO `, message, ...args);
    },
    warn: (message, ...args) => {
      console.warn(`${prefix} WARN `, message, ...args);
    },
    error: (message, ...args) => {
      console.error(`${prefix} ERROR`, message, ...args);
    }
  };
}

// ../shared/gitlab-api-client.ts
class GitLabApiClient {
  host;
  token;
  tokenType;
  defaultTimeout;
  constructor(host, token, tokenType = "pat", defaultTimeout = 30000) {
    this.host = host.replace(/\/$/, "");
    this.token = token;
    this.tokenType = tokenType;
    this.defaultTimeout = defaultTimeout;
  }
  async request(method, endpoint, body, timeoutMs) {
    const url = `${this.host}/api/v4${endpoint}`;
    const headers = {
      "Content-Type": "application/json"
    };
    if (this.tokenType === "oauth") {
      headers["Authorization"] = `Bearer ${this.token}`;
    } else {
      headers["PRIVATE-TOKEN"] = this.token;
    }
    const timeout = timeoutMs ?? this.defaultTimeout;
    const controller = new AbortController;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const options = {
      method,
      headers,
      signal: controller.signal
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`GitLab API request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
  async createProject(input) {
    return this.request("POST", "/projects", {
      name: input.name,
      path: input.path,
      namespace_id: input.namespace_id,
      visibility: input.visibility,
      description: input.description
    });
  }
  async enableExternalPipelineVariables(projectId) {
    await this.request("PUT", `/projects/${encodeURIComponent(projectId)}`, {
      ci_pipeline_variables_minimum_override_role: "developer"
    });
  }
  async enableCICD(projectId) {
    await this.request("PUT", `/projects/${encodeURIComponent(projectId)}`, {
      builds_access_level: "enabled",
      jobs_enabled: true
    });
  }
  async getProject(projectId) {
    return this.request("GET", `/projects/${encodeURIComponent(projectId)}`);
  }
  async createFile(projectId, filePath, input, timeoutMs) {
    const contentSize = input.content.length;
    const contentSizeMB = contentSize / (1024 * 1024);
    const autoTimeout = Math.min(Math.max(120000 + contentSizeMB / 10 * 60000, 120000), 900000);
    const timeout = timeoutMs ?? autoTimeout;
    await this.request("POST", `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}`, {
      branch: input.branch,
      content: input.content,
      commit_message: input.commit_message,
      encoding: input.encoding || "text"
    }, timeout);
  }
  async updateFile(projectId, filePath, input, timeoutMs) {
    const contentSize = input.content.length;
    const contentSizeMB = contentSize / (1024 * 1024);
    const autoTimeout = Math.min(Math.max(120000 + contentSizeMB / 10 * 60000, 120000), 900000);
    const timeout = timeoutMs ?? autoTimeout;
    await this.request("PUT", `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}`, {
      branch: input.branch,
      content: input.content,
      commit_message: input.commit_message,
      encoding: input.encoding || "text"
    }, timeout);
  }
  async uploadFile(projectId, filePath, content, commitMessage, branch = "main") {
    const input = {
      branch,
      content,
      commit_message: commitMessage,
      encoding: "text"
    };
    try {
      await this.createFile(projectId, filePath, input);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already exists")) {
        await this.updateFile(projectId, filePath, input);
      } else {
        throw error;
      }
    }
  }
  async triggerPipeline(projectId, input) {
    return this.request("POST", `/projects/${encodeURIComponent(projectId)}/pipeline`, {
      ref: input.ref,
      variables: Object.entries(input.variables).map(([key, value]) => ({
        key,
        value,
        variable_type: "env_var"
      }))
    });
  }
  async getPipeline(projectId, pipelineId) {
    return this.request("GET", `/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`);
  }
  async getCurrentUser() {
    return this.request("GET", "/user");
  }
  async getCurrentUserNamespaceId() {
    const user = await this.getCurrentUser();
    return user.namespace_id;
  }
  async getPersonalAccessTokenInfo() {
    return this.request("GET", "/personal_access_tokens/self");
  }
  async findProjectByPath(path) {
    try {
      return await this.request("GET", `/projects/${encodeURIComponent(path)}`);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("404") || error.message.includes("Not Found"))) {
        return null;
      }
      throw error;
    }
  }
  async getFile(projectId, filePath, ref = "main") {
    const file = await this.request("GET", `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`);
    if (file.encoding === "base64") {
      file.content = Buffer.from(file.content, "base64").toString("utf-8");
    }
    return file;
  }
  async getCommitSha(projectId, branch = "main") {
    const commits = await this.request("GET", `/projects/${encodeURIComponent(projectId)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`);
    if (commits.length === 0) {
      throw new Error(`No commits found for branch: ${branch}`);
    }
    const firstCommit = commits[0];
    if (!firstCommit) {
      throw new Error(`No commits found for branch: ${branch}`);
    }
    return firstCommit.id;
  }
  async searchCode(_projectId, _query, _ref) {
    console.warn("searchCode not yet implemented");
    return [];
  }
  async getTree(_projectId, _path = "", _ref = "main") {
    console.warn("getTree not yet implemented");
    return [];
  }
  async getFileContent(projectId, filePath, ref = "main") {
    const file = await this.getFile(projectId, filePath, ref);
    return file.content;
  }
  async batchCommit(projectId, input, timeoutMs) {
    const timeout = timeoutMs ?? 300000;
    return this.request("POST", `/projects/${encodeURIComponent(projectId)}/repository/commits`, {
      branch: input.branch,
      commit_message: input.commitMessage,
      actions: input.actions.map((action) => ({
        action: action.action,
        file_path: action.filePath,
        content: action.content,
        encoding: action.encoding,
        previous_path: action.previousPath,
        execute_filemode: action.executeFilemode
      })),
      author_email: input.authorEmail,
      author_name: input.authorName
    }, timeout);
  }
  async uploadFiles(projectId, files, commitMessage, branch = "main", timeoutMs) {
    const totalSize = files.reduce((sum, file) => sum + file.content.length, 0);
    const totalSizeMB = totalSize / (1024 * 1024);
    const autoTimeout = Math.min(Math.max(300000 + totalSizeMB * 60000, 300000), 900000);
    const timeout = timeoutMs ?? autoTimeout;
    const actions = await Promise.all(files.map(async (file) => {
      const encoding = file.encoding || "text";
      try {
        await this.getFile(projectId, file.path, branch);
        return {
          action: "update",
          filePath: file.path,
          content: file.content,
          encoding
        };
      } catch {
        return {
          action: "create",
          filePath: file.path,
          content: file.content,
          encoding
        };
      }
    }));
    return this.batchCommit(projectId, {
      branch,
      commitMessage,
      actions
    }, timeout);
  }
  async createMergeRequest(projectId, input) {
    return this.request("POST", `/projects/${encodeURIComponent(projectId)}/merge_requests`, {
      source_branch: input.source_branch,
      target_branch: input.target_branch,
      title: input.title,
      description: input.description,
      remove_source_branch: input.remove_source_branch
    });
  }
  get client() {
    return {
      MergeRequests: {
        create: async (projectId, sourceBranch, targetBranch, title, options) => {
          return this.createMergeRequest(projectId, {
            source_branch: sourceBranch,
            target_branch: targetBranch,
            title,
            description: options?.description,
            remove_source_branch: options?.removeSourceBranch
          });
        }
      },
      Projects: {
        create: async (input) => this.createProject(input),
        edit: async (projectId, options) => this.request("PUT", `/projects/${encodeURIComponent(projectId)}`, options),
        show: async (path) => this.findProjectByPath(path)
      },
      RepositoryFiles: {
        create: async (projectId, filePath, branch, content, commitMessage, options) => this.createFile(projectId, filePath, {
          branch,
          content,
          commit_message: commitMessage,
          encoding: options?.encoding
        }),
        edit: async (projectId, filePath, branch, content, commitMessage, options) => this.updateFile(projectId, filePath, {
          branch,
          content,
          commit_message: commitMessage,
          encoding: options?.encoding
        }),
        show: async (projectId, filePath, ref) => this.getFile(projectId, filePath, ref)
      },
      Pipelines: {
        create: async (projectId, ref, _options) => this.triggerPipeline(projectId, { ref, variables: {} }),
        show: async (projectId, pipelineId) => this.getPipeline(projectId, String(pipelineId))
      },
      Users: {
        showCurrentUser: async () => this.getCurrentUser()
      },
      Commits: {
        all: async (projectId, options) => this.request("GET", `/projects/${encodeURIComponent(projectId)}/repository/commits?ref_name=${encodeURIComponent(options.refName)}&per_page=${options.perPage}`),
        create: async (projectId, branch, commitMessage, actions, options) => this.batchCommit(projectId, {
          branch,
          commitMessage,
          actions,
          authorEmail: options?.authorEmail,
          authorName: options?.authorName
        }, options?.timeoutMs)
      }
    };
  }
}

// templates/2025-10-18-01/worker-scripts/shared/workspace-utils.ts
function getWorkspaceName(fileSpaceName, fileSpaceId) {
  const sanitized = fileSpaceName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const idSuffix = fileSpaceId.slice(0, 8);
  return `${sanitized}-${idSuffix}`;
}

// templates/2025-10-18-01/worker-scripts/push-to-file-spaces.ts
var exec = promisify(execCallback);
var logger = createLogger({ namespace: "push-to-file-spaces" });
async function hasChanges(workspacePath) {
  try {
    const { stdout } = await exec(`cd ${workspacePath} && git status --porcelain`);
    return stdout.trim().length > 0;
  } catch (error) {
    logger.error(`Failed to check git status in ${workspacePath}:`, error);
    return false;
  }
}
function getGitLabClient(fileSpace, token) {
  if (!fileSpace.config || typeof fileSpace.config !== "object") {
    return null;
  }
  const config = fileSpace.config;
  let host = config.host || "https://gitlab.com";
  if (!host.startsWith("http://") && !host.startsWith("https://")) {
    host = `https://${host}`;
  }
  host = host.replace(/\/$/, "");
  if (!token) {
    logger.warn("Token not provided, cannot create GitLab client");
    return null;
  }
  return new GitLabApiClient(host, token, "pat");
}
function getProjectPath(fileSpace) {
  if (!fileSpace.config || typeof fileSpace.config !== "object" || !("repo" in fileSpace.config)) {
    return null;
  }
  const config = fileSpace.config;
  let repo = config.repo;
  if (repo.startsWith("http://") || repo.startsWith("https://")) {
    try {
      const url = new URL(repo);
      const path = url.pathname.replace(/^\//, "").replace(/\.git$/, "");
      return path;
    } catch {
      return null;
    }
  }
  repo = repo.replace(/^\//, "").replace(/\.git$/, "");
  return repo;
}
async function pushWorkspaceToFileSpace(workspacePath, fileSpace, taskId, taskTitle, taskDescription, gitlabToken) {
  const workspaceName = workspacePath.split("/").pop() || "unknown";
  logger.info(`
\uD83D\uDCE6 Processing workspace: ${workspaceName}`);
  logger.info(`   File space: ${fileSpace.name}`);
  logger.info(`   Path: ${workspacePath}`);
  const changesExist = await hasChanges(workspacePath);
  if (!changesExist) {
    logger.info(`   \u2139\uFE0F  No changes detected, skipping`);
    throw new Error("No changes to push");
  }
  logger.info(`   \u2713 Changes detected`);
  const { stdout: currentBranch } = await exec(`cd ${workspacePath} && git branch --show-current`);
  let branchName = currentBranch.trim();
  if (!branchName || branchName === "main" || branchName === "master" || branchName === "HEAD") {
    branchName = `adi/task-${taskId}`;
    logger.info(`   \uD83C\uDF3F Creating task branch: ${branchName}`);
    await exec(`cd ${workspacePath} && git checkout -b ${branchName}`);
    logger.info(`   \u2713 Branch created`);
  } else {
    logger.info(`   \u2713 Using existing branch: ${branchName}`);
  }
  const { stdout: absPath } = await exec(`cd ${workspacePath} && pwd`);
  const absoluteWorkspacePath = absPath.trim();
  logger.info(`   \uD83D\uDCCD Absolute path: ${absoluteWorkspacePath}`);
  try {
    await exec(`cd "${absoluteWorkspacePath}" && git rev-parse --git-dir`);
    logger.info(`   \u2713 Git repository verified`);
  } catch (error) {
    throw new Error(`Workspace is not a valid git repository: ${error instanceof Error ? error.message : String(error)}`);
  }
  await exec(`cd "${absoluteWorkspacePath}" && git config user.email "ci@adi-pipeline.dev"`);
  await exec(`cd "${absoluteWorkspacePath}" && git config user.name "ADI Pipeline"`);
  logger.info(`   \uD83D\uDCE6 Staging changes...`);
  await exec(`cd "${absoluteWorkspacePath}" && git add -A`);
  const commitMessage = `\uD83E\uDD16 ${taskTitle}

${taskDescription || ""}

Implemented by ADI Pipeline
Task ID: ${taskId}`;
  logger.info(`   \uD83D\uDCBE Creating commit...`);
  await exec(`cd "${absoluteWorkspacePath}" && git commit -m "${commitMessage.replace(/"/g, "\\\"")}"`);
  logger.info(`   \u2713 Commit created`);
  const { stdout: remoteUrl } = await exec(`cd "${absoluteWorkspacePath}" && git remote get-url origin`);
  let pushUrl = remoteUrl.trim();
  if (pushUrl.startsWith("https://") && gitlabToken) {
    const url = new URL(pushUrl);
    url.username = "oauth2";
    url.password = gitlabToken;
    pushUrl = url.toString();
    logger.info(`   \u2713 Authentication injected`);
  }
  logger.info(`   \uD83D\uDCE4 Pushing branch to remote (force)...`);
  await exec(`cd "${absoluteWorkspacePath}" && git push -f origin ${branchName}`);
  logger.info(`   \u2713 Branch pushed`);
  logger.info(`   \uD83D\uDD0D Detecting default branch...`);
  let defaultBranch = "main";
  try {
    const { stdout } = await exec(`cd "${absoluteWorkspacePath}" && git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`);
    defaultBranch = stdout.trim();
    logger.info(`   \u2713 Default branch: ${defaultBranch}`);
  } catch {
    logger.warn(`   \u26A0\uFE0F  Could not detect via symbolic-ref, trying common branch names...`);
    const fallbackBranches = ["develop", "dev", "development", "main", "master"];
    for (const branch of fallbackBranches) {
      try {
        await exec(`cd "${absoluteWorkspacePath}" && git rev-parse --verify origin/${branch}`);
        defaultBranch = branch;
        logger.info(`   \u2713 Default branch (fallback): ${defaultBranch}`);
        break;
      } catch {}
    }
    if (!fallbackBranches.includes(defaultBranch)) {
      logger.warn(`   \u26A0\uFE0F  No common branches found, using final fallback: ${defaultBranch}`);
    }
  }
  logger.info(`   \uD83D\uDD00 Creating merge request...`);
  const gitlabClient = getGitLabClient(fileSpace, gitlabToken);
  if (!gitlabClient) {
    throw new Error("Could not create GitLab client - missing token or host");
  }
  const projectPath = getProjectPath(fileSpace);
  if (!projectPath) {
    throw new Error("Could not extract project path from file space config");
  }
  logger.info(`   \uD83D\uDCCD Project path: ${projectPath}`);
  let mrDescription = `${taskDescription || "Automated task implementation"}

`;
  mrDescription += `## Task Details

`;
  mrDescription += `**Task ID**: ${taskId}
`;
  mrDescription += `**Title**: ${taskTitle}

`;
  mrDescription += `---
`;
  mrDescription += `\uD83E\uDD16 Automated by ADI Pipeline
`;
  let mr;
  let _mrAlreadyExists = false;
  try {
    mr = await gitlabClient["client"].MergeRequests.create(projectPath, branchName, defaultBranch, taskTitle, {
      description: mrDescription,
      removeSourceBranch: true
    });
    logger.info(`   \u2713 Merge request created: !${mr.iid}`);
    logger.info(`   \uD83D\uDD17 URL: ${mr.web_url}`);
  } catch (error) {
    if (error?.cause?.response?.statusCode === 409 || error?.message?.includes("409") || error?.message?.includes("already exists")) {
      const mrMatch = error.message?.match(/!(\d+)/);
      const existingMrNumber = mrMatch ? mrMatch[1] : "unknown";
      logger.info(`   \u2139\uFE0F  Merge request already exists: !${existingMrNumber}, skipping creation`);
      _mrAlreadyExists = true;
      mr = {
        iid: existingMrNumber,
        web_url: `${gitlabClient["host"]}/${projectPath}/-/merge_requests/${existingMrNumber}`
      };
    } else {
      throw error;
    }
  }
  return {
    fileSpaceId: fileSpace.id,
    fileSpaceName: fileSpace.name,
    workspacePath,
    branchName,
    mrUrl: mr.web_url,
    mrIid: mr.iid,
    hasChanges: true
  };
}
async function main() {
  logger.info("\uD83D\uDE80 Push to File Spaces Started");
  const result = {
    mergeRequests: [],
    errors: []
  };
  try {
    const requiredVars = ["SESSION_ID", "API_BASE_URL", "API_TOKEN"];
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    const sessionId = process.env.SESSION_ID;
    logger.info(`Session ID: ${sessionId}`);
    const apiClient = new ApiClient(process.env.API_BASE_URL, process.env.API_TOKEN);
    logger.info("\uD83D\uDCE5 Fetching session...");
    const session = await apiClient.getSession(sessionId);
    if (!session.task_id) {
      throw new Error("Session has no associated task");
    }
    logger.info("\uD83D\uDCE5 Fetching task...");
    const task = await apiClient.getTask(session.task_id);
    logger.info(`\u2713 Task loaded: ${task.title}`);
    if (!task.project_id) {
      throw new Error("Task has no associated project");
    }
    logger.info("\uD83D\uDCE5 Fetching file spaces for project...");
    const fileSpaces = await apiClient.getFileSpacesByProject(task.project_id);
    logger.info(`\u2713 Found ${fileSpaces.length} file space(s)`);
    if (fileSpaces.length === 0) {
      logger.info("\u2139\uFE0F  No file spaces configured for this project");
      return result;
    }
    const workspacesDir = process.env.PIPELINE_EXECUTION_ID ? `/tmp/workspace-${process.env.PIPELINE_EXECUTION_ID}` : "../workspaces";
    const entries = await readdir(workspacesDir, { withFileTypes: true });
    const workspaces = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => ({
      name: entry.name,
      path: `${workspacesDir}/${entry.name}`
    }));
    logger.info(`\uD83D\uDCE6 Found ${workspaces.length} workspace(s)`);
    for (const fileSpace of fileSpaces) {
      if (!fileSpace.enabled) {
        logger.info(`\u23ED\uFE0F  Skipping disabled file space: ${fileSpace.name}`);
        continue;
      }
      let gitlabToken = null;
      if (fileSpace.config && fileSpace.config.access_token_secret_id) {
        try {
          logger.info(`\uD83D\uDD11 Retrieving token for file space: ${fileSpace.name}`);
          gitlabToken = await apiClient.getSecretValue(fileSpace.config.access_token_secret_id);
          logger.info(`\u2713 Token retrieved successfully`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(`\u274C Failed to retrieve token for ${fileSpace.name}: ${errorMsg}`);
          result.errors.push({
            fileSpaceId: fileSpace.id,
            error: `Failed to retrieve access token: ${errorMsg}`
          });
          continue;
        }
      }
      if (!gitlabToken) {
        logger.error(`\u274C No access token configured for file space: ${fileSpace.name}`);
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: "No access token configured (access_token_secret_id missing)"
        });
        continue;
      }
      const workspaceName = getWorkspaceName(fileSpace.name, fileSpace.id);
      const workspace = workspaces.find((ws) => ws.name === workspaceName);
      if (!workspace) {
        logger.warn(`\u26A0\uFE0F  No workspace found for file space: ${fileSpace.name}`);
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: "No matching workspace directory found"
        });
        continue;
      }
      try {
        const mrResult = await pushWorkspaceToFileSpace(workspace.path, fileSpace, task.id, task.title, task.description, gitlabToken);
        result.mergeRequests.push(mrResult);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`\u274C Failed to push ${fileSpace.name}: ${errorMsg}`);
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: errorMsg
        });
      }
    }
    logger.info(`
\u2705 Push to file spaces completed`);
    logger.info(`   Created ${result.mergeRequests.length} merge request(s)`);
    logger.info(`   Encountered ${result.errors.length} error(s)`);
    return result;
  } catch (error) {
    logger.error("\u274C Push to file spaces failed:", error);
    throw error;
  }
}
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`;
  if (isMainModule) {
    main().then(() => process.exit(0)).catch((error) => {
      logger.error("Fatal error:", error);
      process.exit(1);
    });
  }
}
export {
  main as pushToFileSpaces
};
