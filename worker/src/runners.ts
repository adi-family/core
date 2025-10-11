import {query as claudeQuery} from '@anthropic-ai/claude-agent-sdk';
import {exec} from 'child_process';
import {promisify} from 'util';

const execAsync = promisify(exec);

export type RunnerType = 'claude' | 'codex' | 'gemini';

export type RunnerChunk = {
  type: string;
  total_cost_usd?: number;
  result?: string;
  [key: string]: unknown;
};

export type RunnerOptions = {
  permissionMode?: 'bypassPermissions' | 'ask';
  env?: Record<string, string | undefined>;
  executable?: string;
  cwd?: string;
  stderr?: (data: string) => void;
  allowedTools?: string[];
};

export type Runner = {
  query: (prompt: string, options: RunnerOptions) => AsyncIterable<RunnerChunk>;
};

const claudeRunner: Runner = {
  query: async function* (prompt: string, options: RunnerOptions): AsyncIterable<RunnerChunk> {
    const iterator = claudeQuery({
      prompt,
      options: {
        permissionMode: options.permissionMode || 'bypassPermissions',
        env: options.env,
        executable: options.executable,
        cwd: options.cwd,
        stderr: options.stderr,
        allowedTools: options.allowedTools,
      },
    });

    for await (const chunk of iterator) {
      yield chunk as RunnerChunk;
    }
  },
};

const codexRunner: Runner = {
  query: async function* (prompt: string, options: RunnerOptions): AsyncIterable<RunnerChunk> {
    const cwd = options.cwd || process.cwd();
    const env = {...process.env, ...options.env};

    // Build codex command with appropriate flags
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
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

      if (options.stderr && stderr) {
        options.stderr(stderr);
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
  query: async function* (prompt: string, options: RunnerOptions): AsyncIterable<RunnerChunk> {
    const cwd = options.cwd || process.cwd();
    const env = {...process.env, ...options.env};

    // Build gemini command with appropriate flags
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
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

      if (options.stderr && stderr) {
        options.stderr(stderr);
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
