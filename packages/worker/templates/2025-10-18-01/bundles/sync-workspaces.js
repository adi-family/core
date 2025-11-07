#!/usr/bin/env bun
// @bun

// packages/worker/templates/2025-10-18-01/worker-scripts/sync-workspaces.ts
import { exec as execCallback } from "child_process";
import { promisify } from "util";
import { readFile, mkdir } from "fs/promises";

// packages/worker/templates/2025-10-18-01/worker-scripts/shared/api-client.ts
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

// packages/worker/templates/2025-10-18-01/worker-scripts/shared/logger.ts
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

// packages/worker/templates/2025-10-18-01/worker-scripts/shared/workspace-utils.ts
function getWorkspaceName(fileSpaceName, fileSpaceId) {
  const sanitized = fileSpaceName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const idSuffix = fileSpaceId.slice(0, 8);
  return `${sanitized}-${idSuffix}`;
}

// packages/worker/templates/2025-10-18-01/worker-scripts/sync-workspaces.ts
var exec = promisify(execCallback);
var logger = createLogger({ namespace: "sync-workspaces" });
function validateEnvironment() {
  const required = ["PROJECT_ID", "API_BASE_URL", "API_TOKEN"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  logger.info("\u2713 Environment variables validated");
}
async function cleanupOrphanedGitModules() {
  logger.info("\uD83E\uDDF9 Cleaning up orphaned .git/modules entries...");
  try {
    const gitRoot = "../..";
    const templateDir = "..";
    const { stdout: templateDirName } = await exec(`cd ${templateDir} && basename $(pwd)`);
    const templateName = templateDirName.trim();
    logger.info(`   Template directory: ${templateName}`);
    const { stdout: submodulesOutput } = await exec(`cd ${gitRoot} && git config --file .gitmodules --get-regexp path 2>/dev/null || true`);
    const registeredSubmodules = new Set;
    if (submodulesOutput.trim()) {
      const lines = submodulesOutput.trim().split(`
`);
      for (const line of lines) {
        const match = line.match(/submodule\.(.+?)\.path\s+(.+)/);
        if (match && match[2]) {
          registeredSubmodules.add(match[2]);
        }
      }
    }
    logger.info(`   Found ${registeredSubmodules.size} registered submodule(s) in .gitmodules`);
    const gitModulesPath = `.git/modules/${templateName}/workspaces`;
    const { stdout: modulesDirCheck } = await exec(`cd ${gitRoot} && test -d ${gitModulesPath} && echo "exists" || echo "not found"`);
    if (modulesDirCheck.trim() === "exists") {
      const { stdout: modulesOutput } = await exec(`cd ${gitRoot} && ls -1 ${gitModulesPath} 2>/dev/null || true`);
      if (modulesOutput.trim()) {
        const moduleEntries = modulesOutput.trim().split(`
`);
        let cleanedCount = 0;
        for (const entry of moduleEntries) {
          const submodulePath = `${templateName}/workspaces/${entry}`;
          if (!registeredSubmodules.has(submodulePath)) {
            logger.info(`   \uD83D\uDDD1\uFE0F  Removing orphaned .git/modules entry: ${submodulePath}`);
            try {
              await exec(`cd ${gitRoot} && rm -rf ${gitModulesPath}/${entry}`);
              logger.info(`   \u2713 Orphaned entry removed`);
              cleanedCount++;
            } catch (error) {
              logger.warn(`   \u26A0\uFE0F  Failed to remove: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        if (cleanedCount > 0) {
          logger.info(`\u2705 Cleaned up ${cleanedCount} orphaned .git/modules entr${cleanedCount === 1 ? "y" : "ies"}`);
        } else {
          logger.info("\u2713 No orphaned .git/modules entries found");
        }
      }
    } else {
      logger.info(`   \u2139\uFE0F  No ${gitModulesPath} directory found (this is normal for fresh repos)`);
    }
  } catch (error) {
    logger.warn(`\u26A0\uFE0F  Orphaned cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function initializeSyncContext() {
  validateEnvironment();
  const projectId = process.env.PROJECT_ID;
  logger.info(`Project ID: ${projectId}`);
  const apiClient = new ApiClient(process.env.API_BASE_URL, process.env.API_TOKEN);
  return { projectId, apiClient };
}
async function fetchFileSpaces(context) {
  logger.info("\uD83D\uDCE5 Fetching file spaces from API...");
  const fileSpaces = await context.apiClient.getFileSpacesByProject(context.projectId);
  logger.info(`\u2713 Found ${fileSpaces.length} file space(s)`);
  if (fileSpaces.length === 0) {
    logger.info("\u2139\uFE0F  No file spaces to sync");
    process.exit(0);
  }
  return fileSpaces;
}
async function prepareWorkspace() {
  await mkdir("../workspaces", { recursive: true });
  logger.info("\u2713 Workspaces directory ready");
  let gitmodulesContent = "";
  try {
    gitmodulesContent = await readFile("../.gitmodules", "utf-8");
    logger.info("\u2713 Loaded existing .gitmodules");
  } catch {
    logger.info("\uD83D\uDCDD Creating new .gitmodules file");
  }
  const existingModules = new Set;
  const moduleRegex = /\[submodule "([^"]+)"\]/g;
  let match;
  while ((match = moduleRegex.exec(gitmodulesContent)) !== null) {
    if (match[1]) {
      existingModules.add(match[1]);
    }
  }
  return existingModules;
}
function constructRepoUrl(config) {
  let repoUrl = config.repo;
  if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://") && !repoUrl.startsWith("git@")) {
    const host = config.host || "https://gitlab.com";
    const cleanHost = host.replace(/\/$/, "");
    const cleanRepo = repoUrl.replace(/^\//, "");
    repoUrl = `${cleanHost}/${cleanRepo}.git`;
    logger.info(`   Constructed URL from host: ${repoUrl}`);
  }
  return repoUrl;
}
async function addAuthToUrl(repoUrl, config, apiClient, fileSpaceName) {
  if (!repoUrl.startsWith("https://")) {
    return repoUrl;
  }
  const url = new URL(repoUrl);
  if (url.username || url.password) {
    return repoUrl;
  }
  let token;
  if (config.access_token_secret_id) {
    try {
      token = await apiClient.getSecretValue(config.access_token_secret_id);
      logger.info(`   \u2713 Using per-workspace token from secret`);
    } catch (error) {
      logger.warn(`   \u26A0\uFE0F  Failed to fetch workspace token: ${error instanceof Error ? error.message : String(error)}`);
      logger.warn(`   \u26A0\uFE0F  Falling back to GITLAB_TOKEN environment variable`);
      token = process.env.GITLAB_TOKEN;
    }
  } else {
    token = process.env.GITLAB_TOKEN;
    if (token) {
      logger.info(`   \u2713 Using global GITLAB_TOKEN`);
    }
  }
  if (token) {
    url.username = "oauth2";
    url.password = token;
    logger.info(`   \u2713 Added authentication to URL`);
    return url.toString();
  }
  logger.warn(`   \u26A0\uFE0F  No authentication token available for ${fileSpaceName}`);
  return repoUrl;
}
function validateRepoUrl(repoUrl) {
  if (!repoUrl.startsWith("http://") && !repoUrl.startsWith("https://") && !repoUrl.startsWith("git@")) {
    throw new Error(`Invalid repository URL format: ${repoUrl}. Must start with http://, https://, or git@`);
  }
}
async function syncSubmodule(workspacePath, repoUrl, existingModules) {
  if (existingModules.has(workspacePath)) {
    logger.info(`   \u2713 Submodule already registered`);
    await exec(`cd .. && git config submodule.${workspacePath}.url ${repoUrl}`);
    logger.info(`   \u2713 Submodule URL updated`);
  } else {
    logger.info(`   \uD83D\uDCE6 Adding submodule...`);
    const workspaceName = workspacePath.split("/")[1];
    const { stdout: templateDirName } = await exec("cd .. && basename $(pwd)");
    const templateName = templateDirName.trim();
    const gitModulePath = `.git/modules/${templateName}/workspaces/${workspaceName}`;
    const { stdout: gitModuleCheck } = await exec(`cd ../.. && test -d ${gitModulePath} && echo "exists" || echo "not found"`);
    if (gitModuleCheck.trim() === "exists") {
      logger.info(`   \uD83E\uDDF9 Found orphaned .git/modules entry, cleaning up...`);
      await exec(`cd ../.. && rm -rf ${gitModulePath}`);
      logger.info(`   \u2713 Cleaned up orphaned entry`);
    }
    await exec(`cd .. && git submodule add ${repoUrl} ${workspacePath}`);
    logger.info(`   \u2713 Submodule added`);
  }
  await exec(`cd .. && git submodule update --init --recursive ${workspacePath}`);
  logger.info(`   \u2713 Submodule initialized and updated`);
}
async function processFileSpace(fileSpace, apiClient, existingModules) {
  if (!fileSpace.enabled || !fileSpace.config || typeof fileSpace.config !== "object" || !("repo" in fileSpace.config)) {
    logger.warn(`\u26A0\uFE0F  Skipping ${fileSpace.name}: not enabled or missing repo config`);
    return null;
  }
  const config = fileSpace.config;
  let repoUrl = constructRepoUrl(config);
  repoUrl = await addAuthToUrl(repoUrl, config, apiClient, fileSpace.name);
  const workspaceName = getWorkspaceName(fileSpace.name, fileSpace.id);
  const workspacePath = `workspaces/${workspaceName}`;
  logger.info(`
\uD83D\uDCE6 Syncing workspace: ${fileSpace.name}`);
  logger.info(`   Repository: ${repoUrl}`);
  try {
    validateRepoUrl(repoUrl);
    await syncSubmodule(workspacePath, repoUrl, existingModules);
    return workspacePath;
  } catch (error) {
    logger.error(`   \u274C Failed to sync ${fileSpace.name}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}
async function syncAllFileSpaces(fileSpaces, apiClient, existingModules) {
  const desiredSubmodules = new Set;
  for (const fileSpace of fileSpaces) {
    const workspacePath = await processFileSpace(fileSpace, apiClient, existingModules);
    if (workspacePath) {
      desiredSubmodules.add(workspacePath);
    }
  }
  return desiredSubmodules;
}
async function removeSubmodule(modulePath) {
  logger.info(`
\uD83D\uDDD1\uFE0F  Removing old submodule: ${modulePath}`);
  await exec(`cd .. && git submodule deinit -f ${modulePath}`);
  logger.info(`   \u2713 Submodule deinitialized`);
  await exec(`cd .. && git rm -f ${modulePath}`);
  logger.info(`   \u2713 Removed from git index`);
  await exec(`cd .. && rm -rf .git/modules/${modulePath}`);
  logger.info(`   \u2713 Removed .git/modules entry`);
  await exec(`cd .. && rm -rf ${modulePath}`);
  logger.info(`   \u2713 Cleaned up directory`);
  logger.info(`   \u2705 Submodule completely removed`);
}
async function removeOldSubmodules(existingModules, desiredSubmodules) {
  logger.info(`
\uD83D\uDD0D Checking for old submodules to remove...`);
  let removedCount = 0;
  for (const existingModule of existingModules) {
    if (!existingModule.startsWith("workspaces/"))
      continue;
    if (desiredSubmodules.has(existingModule))
      continue;
    try {
      await removeSubmodule(existingModule);
      removedCount++;
    } catch (error) {
      logger.warn(`   \u26A0\uFE0F  Failed to remove submodule ${existingModule}:`, error instanceof Error ? error.message : String(error));
    }
  }
  if (removedCount > 0) {
    logger.info(`
\u2705 Removed ${removedCount} old submodule(s)`);
  } else {
    logger.info(`
\u2139\uFE0F  No old submodules to remove`);
  }
}
async function cleanupOrphanedDirectories(desiredSubmodules) {
  logger.info(`
\uD83E\uDDF9 Cleaning up orphaned workspace directories...`);
  try {
    const { stdout: workspacesList } = await exec("cd .. && ls -1 workspaces 2>/dev/null || true");
    if (!workspacesList.trim())
      return;
    const physicalDirs = workspacesList.trim().split(`
`);
    let cleanedDirs = 0;
    for (const dir of physicalDirs) {
      const workspacePath = `workspaces/${dir}`;
      if (!desiredSubmodules.has(workspacePath)) {
        logger.info(`   \uD83D\uDDD1\uFE0F  Removing orphaned directory: ${workspacePath}`);
        try {
          await exec(`cd .. && rm -rf ${workspacePath}`);
          logger.info(`   \u2713 Directory removed`);
          cleanedDirs++;
        } catch (error) {
          logger.warn(`   \u26A0\uFE0F  Failed to remove directory ${workspacePath}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
    if (cleanedDirs > 0) {
      logger.info(`\u2705 Cleaned up ${cleanedDirs} orphaned workspace director${cleanedDirs === 1 ? "y" : "ies"}`);
    } else {
      logger.info(`\u2139\uFE0F  No orphaned workspace directories found`);
    }
  } catch (error) {
    logger.warn(`\u26A0\uFE0F  Failed to clean up workspace directories: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function getPushUrl() {
  if (!process.env.WORKER_REPO_TOKEN) {
    return "origin";
  }
  try {
    const { stdout: remoteUrl } = await exec("cd .. && git remote get-url origin");
    const originalUrl = remoteUrl.trim();
    logger.info(`\uD83D\uDCCD Original remote URL: ${originalUrl}`);
    if (!originalUrl.startsWith("https://")) {
      return "origin";
    }
    const url = new URL(originalUrl);
    url.username = "oauth2";
    url.password = process.env.WORKER_REPO_TOKEN;
    logger.info(`\u2713 ${originalUrl.includes("@") ? "Replaced" : "Injected"} authentication in push URL`);
    return url.toString();
  } catch {
    logger.warn("Could not get/modify remote URL, using origin");
    return "origin";
  }
}
async function getCurrentBranch() {
  const { stdout: branchName } = await exec("cd .. && git rev-parse --abbrev-ref HEAD");
  const branch = branchName.trim();
  if (branch === "HEAD") {
    const fallbackBranch = process.env.CI_COMMIT_REF_NAME || "main";
    logger.info(`\u26A0\uFE0F  Detached HEAD detected, using branch: ${fallbackBranch}`);
    return fallbackBranch;
  }
  return branch;
}
async function commitAndPushChanges() {
  try {
    const { stdout: statusOutput } = await exec("cd .. && git status --porcelain");
    if (!statusOutput.trim()) {
      logger.info(`
\u2139\uFE0F  No changes detected`);
      return;
    }
    logger.info(`
\uD83D\uDCBE Committing workspace changes...`);
    await exec("cd .. && git add .gitmodules workspaces/ 2>/dev/null || true");
    const { stdout: diffOutput } = await exec("cd .. && git diff --cached --name-only");
    if (!diffOutput.trim()) {
      logger.info("\u2139\uFE0F  No changes staged for commit");
      return;
    }
    await exec('cd .. && git commit -m "\uD83D\uDD27 Update workspace submodules"');
    logger.info("\u2713 Changes committed");
    const pushUrl = await getPushUrl();
    const branch = await getCurrentBranch();
    logger.info("\uD83D\uDCE4 Pushing changes to remote...");
    if (pushUrl === "origin") {
      await exec(`cd .. && git push origin ${branch}`);
    } else {
      await exec(`cd .. && git push ${pushUrl} HEAD:refs/heads/${branch}`);
    }
    logger.info("\u2713 Changes pushed successfully");
  } catch (error) {
    logger.warn(`\u26A0\uFE0F  Could not commit/push changes: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function main() {
  logger.info("\uD83D\uDD04 Workspace Sync Started");
  try {
    const context = initializeSyncContext();
    await cleanupOrphanedGitModules();
    const fileSpaces = await fetchFileSpaces(context);
    const existingModules = await prepareWorkspace();
    const desiredSubmodules = await syncAllFileSpaces(fileSpaces, context.apiClient, existingModules);
    await removeOldSubmodules(existingModules, desiredSubmodules);
    await cleanupOrphanedDirectories(desiredSubmodules);
    await commitAndPushChanges();
    logger.info(`
\u2705 Workspace sync completed successfully`);
    process.exit(0);
  } catch (error) {
    logger.error("\u274C Workspace sync failed:", error);
    process.exit(1);
  }
}
main();
