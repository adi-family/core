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
    return result;
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

// templates/2025-10-18-01/worker-scripts/upload-evaluation-results.ts
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

// templates/2025-10-18-01/worker-scripts/upload-evaluation-results.ts
var logger = createLogger({ namespace: "upload-evaluation" });
var RESULTS_DIR = "2025-10-18-01/results";
async function fileExists(path) {
  return Bun.file(path).exists();
}
async function main() {
  const executionId = process.env.PIPELINE_EXECUTION_ID;
  const sessionId = process.env.SESSION_ID;
  const apiClient = new ApiClient(process.env.API_BASE_URL, process.env.API_TOKEN);
  logger.info("\uD83D\uDCE4 Upload Evaluation Results Started");
  logger.info(`Execution ID: ${executionId}`);
  logger.info(`Session ID: ${sessionId}`);
  try {
    logger.info("\uD83D\uDCE5 Fetching session...");
    const session = await apiClient.getSession(sessionId);
    if (!session.task_id) {
      throw new Error("Session has no associated task");
    }
    logger.info("\uD83D\uDCE5 Fetching task...");
    const task = await apiClient.getTask(session.task_id);
    logger.info(`\u2713 Task loaded: ${task.title}`);
    logger.info("\u2139\uFE0F  Simple evaluation already handled by microservice before CI");
    const agenticUsageFile = `${RESULTS_DIR}/agentic-usage.json`;
    if (await fileExists(agenticUsageFile)) {
      try {
        const usageText = await readFile(agenticUsageFile, "utf-8");
        const usage = JSON.parse(usageText);
        await apiClient.saveApiUsage(executionId, sessionId, task.id, usage);
        logger.info("\u2713 Agentic evaluation usage metrics uploaded");
      } catch (usageError) {
        logger.error("Failed to upload agentic eval usage:", usageError);
      }
    }
    const agenticVerdictExists = await fileExists(`${RESULTS_DIR}/agentic-verdict.json`);
    const reportExists = await fileExists(`${RESULTS_DIR}/evaluation-report.md`);
    if (agenticVerdictExists && reportExists) {
      const agenticVerdictText = await readFile(`${RESULTS_DIR}/agentic-verdict.json`, "utf-8");
      const agenticVerdict = JSON.parse(agenticVerdictText);
      logger.info("\u2713 Agentic verdict loaded");
      const reportText = await readFile(`${RESULTS_DIR}/evaluation-report.md`, "utf-8");
      logger.info("\u2713 Evaluation report loaded");
      const agenticResult = {
        ...agenticVerdict,
        report: reportText
      };
      await apiClient.updateTaskEvaluationAgentic(task.id, agenticResult);
      logger.info("\u2713 Task agentic evaluation updated");
      await apiClient.createPipelineArtifact(executionId, {
        artifact_type: "text",
        reference_url: "#",
        metadata: {
          title: `Evaluation: ${task.title}`,
          task_id: task.id,
          evaluation_content: reportText,
          can_implement: agenticVerdict.can_implement,
          confidence: agenticVerdict.confidence,
          evaluated_at: new Date().toISOString()
        }
      });
      logger.info("\u2713 Created pipeline artifact");
      await apiClient.updateTaskEvaluationStatus(task.id, "completed");
      logger.info("\u2713 Task evaluation status: completed");
      const evaluationResult = agenticVerdict.can_implement ? "ready" : "needs_clarification";
      await apiClient.updateTaskEvaluationResult(task.id, evaluationResult);
      logger.info(`\u2713 Task evaluation result: ${evaluationResult}`);
    } else {
      logger.error("\u274C Agentic evaluation did not complete - marking evaluation as failed");
      await apiClient.updateTaskEvaluationStatus(task.id, "failed");
    }
    logger.info("\u2705 Upload evaluation results completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("\u274C Upload evaluation results failed:", error);
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
  main as uploadEvaluationResults
};
