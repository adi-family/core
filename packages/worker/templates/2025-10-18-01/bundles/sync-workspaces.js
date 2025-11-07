#!/usr/bin/env bun
// @bun

// templates/2025-10-18-01/worker-scripts/shared/workspace-cloner.ts
var {$ } = globalThis.Bun;
import { mkdir, writeFile } from "fs/promises";

class WorkspaceCloner {
  baseDir;
  cloneDepth;
  constructor() {
    const pipelineId = process.env.PIPELINE_EXECUTION_ID || "default";
    this.baseDir = `/tmp/workspace-${pipelineId}`;
    this.cloneDepth = parseInt(process.env.CLONE_DEPTH || "4", 10);
  }
  async cloneWorkspaces() {
    console.log("\uD83D\uDD04 Starting workspace clone...");
    console.log(`\uD83D\uDCC1 Base directory: ${this.baseDir}`);
    console.log(`\uD83D\uDCCA Clone depth: ${this.cloneDepth} commits`);
    const fileSpacesJson = process.env.FILE_SPACES;
    if (!fileSpacesJson) {
      throw new Error("FILE_SPACES environment variable is required");
    }
    if (!process.env.PIPELINE_EXECUTION_ID) {
      throw new Error("PIPELINE_EXECUTION_ID environment variable is required");
    }
    let fileSpaces;
    try {
      fileSpaces = JSON.parse(fileSpacesJson);
    } catch (error) {
      throw new Error(`Failed to parse FILE_SPACES JSON: ${error}`);
    }
    console.log(`\uD83D\uDCE6 Found ${fileSpaces.length} file space(s) to clone
`);
    await mkdir(this.baseDir, { recursive: true });
    const workspaces = [];
    for (let i = 0;i < fileSpaces.length; i++) {
      const fileSpace = fileSpaces[i];
      if (!fileSpace)
        continue;
      console.log(`
\uD83D\uDCE6 Cloning workspace ${i + 1}/${fileSpaces.length}...`);
      try {
        const workspace = await this.cloneWorkspace(fileSpace);
        workspaces.push(workspace);
        console.log(`\u2705 Successfully cloned: ${workspace.name}`);
      } catch (error) {
        console.error(`\u274C Failed to clone ${fileSpace.name}:`, error);
        console.log("\u26A0\uFE0F  Continuing with remaining workspaces...");
      }
    }
    if (workspaces.length === 0) {
      throw new Error("No workspaces were cloned successfully");
    }
    console.log(`
\u2705 Summary: ${workspaces.length}/${fileSpaces.length} workspace(s) cloned successfully`);
    await this.exportEnvironment(workspaces);
    return {
      workspaces,
      primaryWorkspace: workspaces[0] || null,
      totalCount: fileSpaces.length,
      successCount: workspaces.length
    };
  }
  async cloneWorkspace(fileSpace) {
    console.log(`  Name: ${fileSpace.name}`);
    console.log(`  ID: ${fileSpace.id}`);
    console.log(`  Repository: ${fileSpace.repo}`);
    const sanitizedName = fileSpace.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const idPrefix = fileSpace.id.substring(0, 8);
    const dirName = `${sanitizedName}-${idPrefix}`;
    const workspaceDir = `${this.baseDir}/${dirName}`;
    console.log(`  Directory: ${dirName}`);
    let cloneUrl = fileSpace.repo;
    if (fileSpace.token && cloneUrl.startsWith("https://")) {
      const url = new URL(cloneUrl);
      cloneUrl = `https://oauth2:${fileSpace.token}@${url.host}${url.pathname}`;
      console.log("  \u2713 Added authentication to clone URL");
    }
    let targetBranch;
    if (fileSpace.branch) {
      console.log(`  Using specified branch: ${fileSpace.branch}`);
      targetBranch = fileSpace.branch;
    } else {
      console.log("  Detecting available branches...");
      targetBranch = await this.detectBranch(cloneUrl);
      console.log(`  \u2713 Selected branch: ${targetBranch}`);
    }
    await mkdir(workspaceDir, { recursive: true });
    console.log(`  Cloning into: ${workspaceDir}`);
    try {
      await $`git clone --branch ${targetBranch} --depth ${this.cloneDepth} --single-branch ${cloneUrl} ${workspaceDir}`.quiet();
    } catch (error) {
      throw new Error(`Git clone failed: ${error}`);
    }
    const commitCount = await $`git -C ${workspaceDir} rev-list --count HEAD`.text();
    const latestCommit = await $`git -C ${workspaceDir} log -1 --format=%h - %s`.text();
    console.log(`  Statistics:`);
    console.log(`    Branch: ${targetBranch}`);
    console.log(`    Commits: ${commitCount.trim()}`);
    console.log(`    Latest: ${latestCommit.trim()}`);
    return {
      dir: workspaceDir,
      name: fileSpace.name,
      branch: targetBranch,
      id: fileSpace.id
    };
  }
  async detectBranch(cloneUrl) {
    try {
      const result = await $`git ls-remote --heads ${cloneUrl}`.text();
      if (!result.trim()) {
        throw new Error("Repository returned no branches (empty repository or access issue)");
      }
      const branches = result.split(`
`).map((line) => line.split("refs/heads/")[1]).filter((b) => Boolean(b)).map((b) => b.trim());
      const priorityBranches = ["dev", "develop", "development", "main", "master"];
      for (const preferred of priorityBranches) {
        if (branches.includes(preferred)) {
          return preferred;
        }
      }
      const firstBranch = branches[0];
      if (firstBranch) {
        console.log(`  \u26A0\uFE0F  No preferred branch found, using: ${firstBranch}`);
        return firstBranch;
      }
      throw new Error("No branches found in repository");
    } catch (error) {
      throw new Error(`Failed to detect branch: ${error}`);
    }
  }
  async exportEnvironment(workspaces) {
    const envContent = `
export WORKSPACE_COUNT=${workspaces.length}
export WORKSPACE_DIRS='${workspaces.map((w) => w.dir).join(" ")}'
export WORKSPACE_NAMES='${workspaces.map((w) => w.name).join(" ")}'
export WORKSPACE_BRANCHES='${workspaces.map((w) => w.branch).join(" ")}'

# Primary workspace (first one) for backwards compatibility
export WORKSPACE_DIR='${workspaces[0]?.dir || ""}'
export WORKSPACE_NAME='${workspaces[0]?.name || ""}'
export WORKSPACE_BRANCH='${workspaces[0]?.branch || ""}'
`.trim();
    const envFile = "/tmp/workspace-env.sh";
    await writeFile(envFile, `${envContent}
`);
    console.log(`\u2705 Environment file created: ${envFile}`);
  }
  static getWorkspacesFromEnv() {
    const dirs = process.env.WORKSPACE_DIRS?.split(" ") || [];
    const names = process.env.WORKSPACE_NAMES?.split(" ") || [];
    const branches = process.env.WORKSPACE_BRANCHES?.split(" ") || [];
    if (dirs.length === 0) {
      return null;
    }
    return dirs.map((dir, i) => ({
      dir,
      name: names[i] || "",
      branch: branches[i] || "",
      id: ""
    }));
  }
}
async function cloneWorkspaces() {
  const cloner = new WorkspaceCloner;
  return await cloner.cloneWorkspaces();
}
if (false) {}

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

// templates/2025-10-18-01/worker-scripts/sync-workspaces.ts
var logger = createLogger({ namespace: "sync-workspaces" });
async function main() {
  logger.info("\uD83D\uDD04 Workspace Sync Started");
  try {
    const result = await cloneWorkspaces();
    logger.info(`\u2705 Successfully cloned ${result.successCount}/${result.totalCount} workspace(s)`);
    process.exit(0);
  } catch (error) {
    logger.error("\u274C Workspace sync failed:", error);
    process.exit(1);
  }
}
if (!process.env.__WORKER_BINARY__ && import.meta.main) {
  main();
}
export {
  main as syncWorkspaces
};
