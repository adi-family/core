import {getTelegramConfigFromEnv} from "./telegram";
import {sql} from './db';
import {getAllEnabledProjects} from './queries';
import {type RunnerType} from './runners';
import {createProjectProcessor} from './projects/factory';
import type {ProcessorContext} from './projects/base';
import chalk from 'chalk';
import * as path from 'path';
import 'dotenv/config';

const SLEEP_INTERVAL_MS = 600000; // 10 minutes

if (!process.env.APPS_DIR) {
  throw new Error('APPS_DIR environment variable is required');
}

const APPS_DIR = process.env.APPS_DIR.startsWith('/')
  ? process.env.APPS_DIR
  : path.join(process.cwd(), process.env.APPS_DIR);

// Get runner types from environment, default to 'claude'
// Can be comma-separated list: "claude,codex,gemini"
const RUNNER_TYPES_STR = process.env.RUNNER_TYPES || process.env.RUNNER_TYPE || 'claude';
const RUNNER_TYPES: RunnerType[] = RUNNER_TYPES_STR.split(',').map(r => r.trim() as RunnerType);

// Validate all runner types
for (const runnerType of RUNNER_TYPES) {
  if (!['claude', 'codex', 'gemini'].includes(runnerType)) {
    throw new Error(`Invalid RUNNER_TYPE: ${runnerType}. Must be one of: claude, codex, gemini`);
  }
}

console.log(chalk.blue.bold(`Available runners: ${RUNNER_TYPES.join(', ')}`));

// Round-robin runner selection
let currentRunnerIndex = 0;
const selectRunner = (): RunnerType => {
  const runner = RUNNER_TYPES[currentRunnerIndex];
  currentRunnerIndex = (currentRunnerIndex + 1) % RUNNER_TYPES.length;
  return runner;
};


async function run() {
  const telegramConfig = getTelegramConfigFromEnv();
  const workerId = `${process.pid}-${Date.now()}`;

  console.log(chalk.blue.bold(`Worker ID: ${workerId}`));

  while (true) {
    console.log(chalk.cyan.bold(`\n=== Starting new iteration at ${new Date().toISOString()} ===\n`));

    const projects = await getAllEnabledProjects(sql);

    for (const project of projects) {
      console.log(chalk.magenta.bold(`\nProcessing project: ${project.name} (${project.type})\n`));

      const context: ProcessorContext = {
        sql,
        project,
        telegramConfig,
        workerId,
        selectRunner,
        appsDir: APPS_DIR
      };

      const processor = createProjectProcessor(context);

      for await (const issue of processor.getIssues()) {
        try {
          await processor.processIssue(issue);
        } catch (error) {
          console.error(chalk.red(`[${project.name}] Error processing issue ${issue.id()}:`), error);
        }
      }
    }

    console.log(chalk.cyan.bold(`\n=== Iteration complete. Sleeping for ${SLEEP_INTERVAL_MS / 1000} seconds ===\n`));
    await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL_MS));
  }
}

await run();
