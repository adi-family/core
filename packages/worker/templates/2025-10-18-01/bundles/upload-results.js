#!/usr/bin/env bun
// @bun

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

// templates/2025-10-18-01/worker-scripts/upload-results.ts
import { readFile } from "fs/promises";

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

// templates/2025-10-18-01/worker-scripts/upload-results.ts
var logger = createLogger({ namespace: "upload-results" });
async function fileExists(path) {
  return Bun.file(path).exists();
}
async function main() {
  const executionId = process.env.PIPELINE_EXECUTION_ID;
  const sessionId = process.env.SESSION_ID;
  const apiClient = new ApiClient(process.env.API_BASE_URL, process.env.API_TOKEN);
  logger.info("\uD83D\uDCE4 Upload Results Started");
  logger.info(`Execution ID: ${executionId}`);
  try {
    logger.info("\uD83D\uDCE5 Reading results from execute stage...");
    const resultsText = await readFile("../results/output.json", "utf-8");
    const results = JSON.parse(resultsText);
    logger.info("\u2713 Results loaded");
    if (await fileExists("../results/implementation-usage.json")) {
      try {
        const usageText = await readFile("../results/implementation-usage.json", "utf-8");
        const usage = JSON.parse(usageText);
        await apiClient.saveApiUsage(executionId, sessionId, results.task.id, usage);
        logger.info("\u2713 Implementation usage metrics uploaded");
      } catch (usageError) {
        logger.error("Failed to upload implementation usage:", usageError);
      }
    }
    logger.info("\uD83D\uDCDD Creating pipeline artifacts...");
    const pushResult = results.pushResult;
    if (pushResult && pushResult.mergeRequests && pushResult.mergeRequests.length > 0) {
      for (const mr of pushResult.mergeRequests) {
        await apiClient.createPipelineArtifact(executionId, {
          artifact_type: "merge_request",
          reference_url: mr.mrUrl,
          metadata: {
            title: results.task.title,
            description: results.task.description,
            branch: mr.branchName,
            file_space_id: mr.fileSpaceId,
            file_space_name: mr.fileSpaceName,
            mr_iid: mr.mrIid,
            completed: results.completionCheck.isComplete,
            needs_clarification: results.clarificationCheck.needsClarification
          }
        });
        logger.info(`\u2713 Created artifact: merge_request \u2192 ${mr.mrUrl}`);
      }
    } else if (results.agentResults.exitCode === 0) {
      await apiClient.createPipelineArtifact(executionId, {
        artifact_type: "issue",
        reference_url: "#",
        metadata: {
          title: results.task.title,
          completed: results.completionCheck.isComplete,
          needs_clarification: results.clarificationCheck.needsClarification,
          exit_code: results.agentResults.exitCode,
          push_errors: pushResult?.errors || []
        }
      });
      logger.info(`\u2713 Created artifact: execution result`);
    } else {
      logger.info("\u2139\uFE0F  No artifacts created (agent execution failed)");
    }
    logger.info("\uD83D\uDCDD Updating task status...");
    const newStatus = results.completionCheck.isComplete ? "completed" : "needs_clarification";
    await apiClient.updateTaskStatus(results.task.id, newStatus);
    logger.info(`\u2713 Task status updated to: ${newStatus}`);
    logger.info("\u2705 Upload results completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("\u274C Upload results failed:", error);
    process.exit(1);
  }
}
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`;
  if (isMainModule) {
    main();
  }
}
export {
  main as uploadResults
};
