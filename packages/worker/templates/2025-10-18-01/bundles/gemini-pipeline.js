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

// templates/2025-10-18-01/worker-scripts/shared/completion-check.ts
async function runCompletionCheck(results) {
  if (results.exitCode !== 0) {
    return {
      isComplete: false,
      reason: "Agent exited with non-zero code",
      confidence: 1
    };
  }
  if (results.errors && results.errors.length > 0) {
    return {
      isComplete: false,
      reason: `Agent reported ${results.errors.length} error(s)`,
      confidence: 0.9
    };
  }
  return {
    isComplete: true,
    confidence: 0.8
  };
}

// templates/2025-10-18-01/worker-scripts/shared/clarification-check.ts
async function runClarificationCheck(_results) {
  return { needsClarification: false };
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

// templates/2025-10-18-01/worker-scripts/shared/env-validator.ts
var logger = createLogger({ namespace: "env-validator" });
function validateEnvironment(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  logger.info("\u2713 Environment variables validated");
  return required.reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});
}

// templates/2025-10-18-01/worker-scripts/gemini-pipeline.ts
import { mkdir } from "fs/promises";
var logger2 = createLogger({ namespace: "gemini-pipeline" });
async function main() {
  logger2.info("\uD83E\uDD16 Gemini Pipeline Started");
  try {
    const {
      SESSION_ID,
      API_BASE_URL,
      API_TOKEN,
      PIPELINE_EXECUTION_ID
    } = validateEnvironment([
      "SESSION_ID",
      "PIPELINE_EXECUTION_ID",
      "API_BASE_URL",
      "API_TOKEN"
    ]);
    logger2.info(`Session ID: ${SESSION_ID}`);
    logger2.info(`Execution ID: ${PIPELINE_EXECUTION_ID}`);
    const apiClient = new ApiClient(API_BASE_URL, API_TOKEN);
    logger2.info("\uD83D\uDCE5 Fetching session from API...");
    const session = await apiClient.getSession(SESSION_ID);
    logger2.info(`\u2713 Session loaded: runner=${session.runner}`);
    if (!session.task_id) {
      throw new Error("Session has no associated task");
    }
    logger2.info("\uD83D\uDCE5 Fetching task from API...");
    const task = await apiClient.getTask(session.task_id);
    logger2.info(`\u2713 Task loaded: ${task.title}`);
    let fileSpace = null;
    logger2.info("\uD83D\uDCE5 Fetching task file spaces from API...");
    const fileSpaces = await apiClient.getFileSpacesByTask(task.id);
    if (fileSpaces.length > 0) {
      const firstFileSpace = fileSpaces[0];
      if (firstFileSpace) {
        fileSpace = firstFileSpace;
        logger2.info(`\u2713 File space loaded: ${fileSpace.name} (${fileSpace.type})`);
      }
    } else {
      logger2.info("\u2139\uFE0F  No file space configured for this task");
    }
    await mkdir("../results", { recursive: true });
    logger2.info("\uD83D\uDD27 Running Gemini agent...");
    logger2.info(`Task: ${task.title}`);
    logger2.info(`Description: ${task.description || "N/A"}`);
    const agentResults = {
      exitCode: 0,
      output: "Gemini agent completed successfully (placeholder)",
      changes: {},
      errors: []
    };
    logger2.info("\u2705 Running completion check...");
    const completionCheck = await runCompletionCheck(agentResults);
    if (!completionCheck.isComplete) {
      logger2.warn(`\u26A0\uFE0F  Completion check failed: ${completionCheck.reason}`);
    } else {
      logger2.info("\u2713 Completion check passed");
    }
    logger2.info("\u2753 Running clarification check...");
    const clarificationCheck = await runClarificationCheck(agentResults);
    if (clarificationCheck.needsClarification) {
      logger2.warn(`\u26A0\uFE0F  Clarification needed: ${clarificationCheck.reason}`);
    } else {
      logger2.info("\u2713 No clarification needed");
    }
    await Bun.write("../results/output.json", JSON.stringify({
      session,
      task,
      fileSpace,
      agentResults,
      completionCheck,
      clarificationCheck
    }, null, 2));
    logger2.info("\u2705 Gemini pipeline completed successfully");
    process.exit(0);
  } catch (error) {
    logger2.error("\u274C Gemini pipeline failed:", error);
    await Bun.write("../results/error.json", JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, null, 2));
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
  main as geminiPipeline
};
