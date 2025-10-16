import {query as claudeQuery} from '@anthropic-ai/claude-agent-sdk';
import {exec} from 'child_process';
import {promisify} from 'util';
import type {TaskSourceIssue} from './task-sources/base';

const execAsync = promisify(exec);

export type RunnerType = string;

export type StatusChunk = {
  type: 'status';
  status?: string;
  runner?: string;
};

export type ProgressChunk = {
  type: 'progress';
  content: string;
};

export type ResultChunk = {
  type: 'result';
  result: string;
  total_cost_usd: number;
};

export type ErrorChunk = {
  type: 'error';
  error: string;
};

export type RunnerChunk = StatusChunk | ProgressChunk | ResultChunk | ErrorChunk;

export type RunnerOptions = {
  permissionMode?: 'bypassPermissions' | 'ask';
  env?: Record<string, string | undefined>;
  executable?: 'bun' | 'deno' | 'node';
  cwd?: string;
  stderr?: (data: string) => void;
  allowedTools?: string[];
};

export type QueryContext = {
  prompt: string;
  options: RunnerOptions;
};

export type RunContext = {
  issue: TaskSourceIssue;
  branchName: string;
  taskDir: string;
  fileSpaceInfos: Array<{name: string; path: string}>;
  issueViewCommand: string | null;
  options: RunnerOptions;
};

export type Runner = {
  query: (ctx: QueryContext) => AsyncIterable<RunnerChunk>;
  run: (ctx: RunContext) => AsyncIterable<RunnerChunk>;
};

const claudeRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    if (!ctx.prompt || ctx.prompt.trim() === '') {
      throw new Error('Runner query requires non-empty prompt');
    }
    if (ctx.options.executable) {
      const validExecutables = ['bun', 'deno', 'node'];
      if (!validExecutables.includes(ctx.options.executable)) {
        throw new Error(`Invalid executable: ${ctx.options.executable}. Must be one of: ${validExecutables.join(', ')}`);
      }
    }

    const permissionMode = ctx.options.permissionMode
      ? ctx.options.permissionMode
      : 'bypassPermissions';

    const iterator = claudeQuery({
      prompt: ctx.prompt,
      options: {
        permissionMode,
        env: ctx.options.env,
        executable: ctx.options.executable,
        cwd: ctx.options.cwd,
        stderr: ctx.options.stderr,
        allowedTools: ctx.options.allowedTools,
      } as Parameters<typeof claudeQuery>[0]['options'],
    });

    for await (const chunk of iterator) {
      yield chunk as RunnerChunk;
    }
  },

  run: async function* (ctx: RunContext): AsyncIterable<RunnerChunk> {
    const repoInfo = ctx.fileSpaceInfos.length > 1
      ? `\n\nREPOSITORIES:
You have access to ${ctx.fileSpaceInfos.length} repositories:
${ctx.fileSpaceInfos.map((info, idx) => `${idx + 1}. ${info.path}`).join('\n')}

All repositories are on branch "${ctx.branchName}".`
      : '';

    const prompt = `You are working on issue #${ctx.issue.id}: ${ctx.issue.title}

CRITICAL FIRST STEP:
${ctx.issueViewCommand ? `- Your FIRST action must be: \`${ctx.issueViewCommand}\`` : '- Fetch and read the complete issue details'}
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context
${repoInfo}

IMPORTANT INSTRUCTIONS:
- Do ONLY what is explicitly asked in the issue - no extra features, improvements, or refactoring
- You are currently on branch "${ctx.branchName}" - all your work should be done on this branch
- Avoid installing dependencies (npm install) unless absolutely required for the task
- Use npm for package management (no other package managers)
- Be concise in your responses - focus on actions, not explanations

COMPLETION REQUIREMENTS (you MUST complete ALL of these):
1. Implement the required changes
2. Commit your changes with a clear commit message
3. Push the branch to remote: \`git push origin ${ctx.branchName}\`
4. In your final result, return a simple summary of what was done (1-2 sentences max)`;

    yield* this.query({
      prompt,
      options: {
        permissionMode: 'bypassPermissions',
        env: process.env as Record<string, string>,
        executable: 'bun',
        cwd: ctx.options.cwd,
        stderr: ctx.options.stderr,
        allowedTools: ['Bash(npm: *)', 'Bash(glab: *)', 'Bash(gh: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob']
      }
    });
  },
};

const codexRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    const cwd = ctx.options.cwd || process.cwd();
    const env = {...process.env, ...ctx.options.env};

    const escapedPrompt = ctx.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = [
      'npx @openai/codex exec',
      `"${escapedPrompt}"`,
      `-C "${cwd}"`,
      '--full-auto',
      '--dangerously-bypass-approvals-and-sandbox',
    ].join(' ');

    yield {
      type: 'status',
      status: 'starting',
      runner: 'codex',
    } as RunnerChunk;

    try {
      const {stdout, stderr} = await execAsync(command, {
        env,
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (ctx.options.stderr && stderr) {
        ctx.options.stderr(stderr);
      }

      yield {
        type: 'progress',
        content: stdout,
      } as RunnerChunk;

      yield {
        type: 'result',
        result: stdout,
        total_cost_usd: 0,
      } as RunnerChunk;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield {
        type: 'error',
        error: errorMessage,
      } as RunnerChunk;
      throw error;
    }
  },

  run: async function* (ctx: RunContext): AsyncIterable<RunnerChunk> {
    const prompt = `Work on issue #${ctx.issue.id}: ${ctx.issue.title}
${ctx.issueViewCommand ? `First, run: ${ctx.issueViewCommand}` : 'Fetch the issue details'}
Branch: ${ctx.branchName}
${ctx.fileSpaceInfos.length > 1 ? `Repositories: ${ctx.fileSpaceInfos.map(info => info.path).join(', ')}` : ''}

Complete the task, commit, and push to ${ctx.branchName}.`;

    yield* this.query({
      prompt,
      options: ctx.options
    });
  },
};

const geminiRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    const cwd = ctx.options.cwd || process.cwd();
    const env = {...process.env, ...ctx.options.env};

    const escapedPrompt = ctx.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = [
      'npx @google/gemini-cli',
      `"${escapedPrompt}"`,
      '--yolo',
      `--include-directories "${cwd}"`,
      '--output-format json',
    ].join(' ');

    yield {
      type: 'status',
      status: 'starting',
      runner: 'gemini',
    } as RunnerChunk;

    try {
      const {stdout, stderr} = await execAsync(command, {
        env: {...env, PWD: cwd},
        cwd,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (ctx.options.stderr && stderr) {
        ctx.options.stderr(stderr);
      }

      let result = stdout;
      try {
        const jsonResult = JSON.parse(stdout);
        result = jsonResult.response || jsonResult.content || stdout;
      } catch {
        // If JSON parsing fails, use stdout as-is
      }

      yield {
        type: 'progress',
        content: result,
      } as RunnerChunk;

      yield {
        type: 'result',
        result,
        total_cost_usd: 0,
      } as RunnerChunk;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield {
        type: 'error',
        error: errorMessage,
      } as RunnerChunk;
      throw error;
    }
  },

  run: async function* (ctx: RunContext): AsyncIterable<RunnerChunk> {
    const prompt = `Issue #${ctx.issue.id}: ${ctx.issue.title}
${ctx.issueViewCommand ? `View: ${ctx.issueViewCommand}` : ''}
Branch: ${ctx.branchName}
${ctx.fileSpaceInfos.length > 1 ? `Repos: ${ctx.fileSpaceInfos.map(info => info.path).join(', ')}` : ''}

Implement, commit, push to ${ctx.branchName}.`;

    yield* this.query({
      prompt,
      options: ctx.options
    });
  },
};

export const createRunner = (type: RunnerType): Runner => {
  if (type === 'claude') {
    return claudeRunner;
  }
  if (type === 'codex') {
    return codexRunner;
  }
  if (type === 'gemini') {
    return geminiRunner;
  }
  throw new Error(`Unknown runner type: ${type}`);
};
