import {query as claudeQuery} from '@anthropic-ai/claude-agent-sdk';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

export type RunnerType = 'claude' | 'codex' | 'gemini';

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

export type Runner = {
  query: (ctx: QueryContext) => AsyncIterable<RunnerChunk>;
};

const claudeRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    // Design by Contract: Validate preconditions
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
};

const codexRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    const cwd = ctx.options.cwd || process.cwd();
    const env = {...process.env, ...ctx.options.env};

    // Build codex command with appropriate flags
    const escapedPrompt = ctx.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = [
      'npx @openai/codex exec',
      `"${escapedPrompt}"`,
      `-C "${cwd}"`,
      '--full-auto', // Automatic execution with workspace-write sandbox
      '--dangerously-bypass-approvals-and-sandbox', // For automation (use with caution)
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
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (ctx.options.stderr && stderr) {
        ctx.options.stderr(stderr);
      }

      // Yield progress chunk
      yield {
        type: 'progress',
        content: stdout,
      } as RunnerChunk;

      // Yield final result
      yield {
        type: 'result',
        result: stdout,
        total_cost_usd: 0, // Codex doesn't provide cost info through CLI
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
};

const geminiRunner: Runner = {
  query: async function* (ctx: QueryContext): AsyncIterable<RunnerChunk> {
    const cwd = ctx.options.cwd || process.cwd();
    const env = {...process.env, ...ctx.options.env};

    // Build gemini command with appropriate flags
    const escapedPrompt = ctx.prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = [
      'npx @google/gemini-cli',
      `"${escapedPrompt}"`,
      '--yolo', // Auto-approve all actions
      `--include-directories "${cwd}"`,
      '--output-format json', // Request JSON output if available
    ].join(' ');

    yield {
      type: 'status',
      status: 'starting',
      runner: 'gemini',
    } as RunnerChunk;

    try {
      const {stdout, stderr} = await execAsync(command, {
        env: {...env, PWD: cwd}, // Set PWD for gemini
        cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (ctx.options.stderr && stderr) {
        ctx.options.stderr(stderr);
      }

      // Try to parse as JSON first, fall back to text
      let result = stdout;
      try {
        const jsonResult = JSON.parse(stdout);
        result = jsonResult.response || jsonResult.content || stdout;
      } catch {
        // Not JSON, use raw output
      }

      // Yield progress chunk
      yield {
        type: 'progress',
        content: result,
      } as RunnerChunk;

      // Yield final result
      yield {
        type: 'result',
        result,
        total_cost_usd: 0, // Gemini free tier doesn't provide cost info
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
