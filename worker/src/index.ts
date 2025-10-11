import {getTelegramConfigFromEnv} from "./telegram";
import {sql} from './db';
import {getAllEnabledProjects, getFileSpacesByProjectId, getTaskSourcesByProjectId} from './queries';
import {type RunnerType} from './runners';
import {createProjectProcessor} from './projects/factory';
import type {ProcessorContext} from './projects/base';
import {GenericProjectProcessor} from './projects/generic';
import {createFileSpace} from './file-spaces/factory';
import {createTaskSource} from './task-sources/factory';
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

      if (project.type === 'parent') {
        console.log(chalk.gray(`Skipping parent project ${project.name} - parent projects are aggregators only`));
        continue;
      }

      const fileSpacesData = await getFileSpacesByProjectId(sql, project.id);
      const taskSourcesData = await getTaskSourcesByProjectId(sql, project.id);

      if (fileSpacesData.length === 0) {
        console.log(chalk.yellow(`No file spaces found for project ${project.name}, skipping`));
        continue;
      }

      if (taskSourcesData.length === 0) {
        console.log(chalk.yellow(`No task sources found for project ${project.name}, skipping`));
        continue;
      }

      const fileSpaces = fileSpacesData.map(fs => createFileSpace(fs as any));

      console.log(chalk.blue(`File spaces: ${fileSpaces.length}`));
      console.log(chalk.blue(`Task sources: ${taskSourcesData.length}`));

      for (const taskSourceData of taskSourcesData) {
        const taskSource = createTaskSource(taskSourceData as any);

        console.log(chalk.cyan(`Processing task source: ${taskSourceData.name} (${taskSourceData.type})`));

        const context: ProcessorContext = {
          sql,
          project,
          fileSpaces,
          taskSource,
          telegramConfig,
          workerId,
          selectRunner,
          appsDir: APPS_DIR
        };

        const processor = new GenericProjectProcessor(context);

        try {
          await processor.processIssues();
        } catch (error) {
          console.error(chalk.red(`[${project.name}] Error processing task source ${taskSourceData.name}:`), error);
        }
      }
    }

    console.log(chalk.cyan.bold(`\n=== Iteration complete. Sleeping for ${SLEEP_INTERVAL_MS / 1000} seconds ===\n`));
    await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL_MS));
  }
}

await run();
