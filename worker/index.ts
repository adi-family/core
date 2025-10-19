import {sql} from '../db/client';
import {getAllEnabledProjects, getFileSpacesByProjectId, getTaskSourcesByProjectId} from './queries';
import {type RunnerType} from './runners';
import type {ProcessorContext} from './projects/base';
import {GenericProjectProcessor} from './projects/generic';
import {createFileSpace} from './file-spaces/factory';
import type {FileSpace} from './file-spaces/base';
import {createTaskSource} from './task-sources/factory';
import type {TaskSource} from './task-sources/base';
import { startPipelineMonitor, stopPipelineMonitor } from './pipeline-monitor';
import { createLogger } from '../utils/logger';
import * as path from 'path';
import 'dotenv/config';

const logger = createLogger({ namespace: 'worker' });

const SLEEP_INTERVAL_MS = 600000;

if (!process.env.APPS_DIR) {
  throw new Error('APPS_DIR environment variable is required');
}

if (process.env.APPS_DIR.trim() === '') {
  throw new Error('APPS_DIR cannot be empty');
}

function resolveAppsDir(appsDir: string): string {
  if (appsDir.startsWith('/')) {
    return appsDir;
  }
  return path.join(process.cwd(), appsDir);
}

const APPS_DIR = resolveAppsDir(process.env.APPS_DIR);

let RUNNER_TYPES_STR = 'claude';
if (process.env.RUNNER_TYPES) {
  RUNNER_TYPES_STR = process.env.RUNNER_TYPES;
} else if (process.env.RUNNER_TYPE) {
  RUNNER_TYPES_STR = process.env.RUNNER_TYPE;
}

const RUNNER_TYPES: RunnerType[] = RUNNER_TYPES_STR
  .split(',')
  .map(r => r.trim())
  .filter(r => r.length > 0);

if (RUNNER_TYPES.length === 0) {
  throw new Error('At least one RUNNER_TYPE must be specified');
}

logger.info(`Available runners: ${RUNNER_TYPES.join(', ')}`);

let currentRunnerIndex = 0;
const selectRunner = (): RunnerType => {
  const runner = RUNNER_TYPES[currentRunnerIndex];
  if (!runner) {
    throw new Error('No runners available');
  }
  currentRunnerIndex = (currentRunnerIndex + 1) % RUNNER_TYPES.length;
  return runner;
};


async function run() {
  const workerId = `${process.pid}-${Date.now()}`;

  logger.info(`Worker ID: ${workerId}`);

  // Start pipeline monitor for stale pipeline detection
  logger.info('Starting pipeline monitor...');
  const monitorIntervalId = startPipelineMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.warn('\nShutting down...');
    stopPipelineMonitor(monitorIntervalId);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.warn('\nShutting down...');
    stopPipelineMonitor(monitorIntervalId);
    process.exit(0);
  });

  while (true) {
    logger.info(`\n=== Starting new iteration at ${new Date().toISOString()} ===\n`);

    const projects = await getAllEnabledProjects(sql);

    for (const project of projects) {
      logger.info(`\nProcessing project: ${project.name}\n`);

      const fileSpacesData = await getFileSpacesByProjectId(sql, project.id);
      const taskSourcesData = await getTaskSourcesByProjectId(sql, project.id);

      if (fileSpacesData.length === 0) {
        logger.warn(`No file spaces found for project ${project.name}, skipping`);
        continue;
      }

      if (taskSourcesData.length === 0) {
        logger.warn(`No task sources found for project ${project.name}, skipping`);
        continue;
      }

      const fileSpaces = fileSpacesData.map(fs => createFileSpace(fs as FileSpace));

      logger.info(`File spaces: ${fileSpaces.length}`);
      logger.info(`Task sources: ${taskSourcesData.length}`);

      for (const taskSourceData of taskSourcesData) {
        const taskSource = createTaskSource(taskSourceData as TaskSource);

        logger.info(`Processing task source: ${taskSourceData.name} (${taskSourceData.type})`);

        const context: ProcessorContext = {
          sql,
          project,
          fileSpaces,
          taskSource,
          workerId,
          selectRunner,
          appsDir: APPS_DIR
        };

        const processor = new GenericProjectProcessor(context);

        try {
          await processor.processIssues();
        } catch (error) {
          logger.error(`[${project.name}] Error processing task source ${taskSourceData.name}:`, error);
        }
      }
    }

    logger.info(`\n=== Iteration complete. Sleeping for ${SLEEP_INTERVAL_MS / 1000} seconds ===\n`);
    await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL_MS));
  }
}

await run();
