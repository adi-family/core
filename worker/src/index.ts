import {query} from '@anthropic-ai/claude-agent-sdk';
import {initTrafficLight} from "./cache";
import {getGitlabIssueList} from "./gitlab";
import {getTelegramConfigFromEnv, sendTelegramMessage} from "./telegram";
import {sql} from './db';
import {createTask, createSession, createMessage, updateTaskStatus} from './queries';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import 'dotenv/config';

const REPOS = ['nakit-yok/backend', 'nakit-yok/frontend'];
const SLEEP_INTERVAL_MS = 600000; // 10 minutes

if (!process.env.APPS_DIR) {
  throw new Error('APPS_DIR environment variable is required');
}

const APPS_DIR = process.env.APPS_DIR.startsWith('/')
  ? process.env.APPS_DIR
  : path.join(process.cwd(), process.env.APPS_DIR);

function setupIssueWorkspace(issueId: string, repo: string): string {
  const workspaceDir = path.join(APPS_DIR, `gitlab-${issueId}`);
  const branchName = `issue/gitlab-${issueId}`;

  // Create workspace directory if it doesn't exist
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });

    console.log(chalk.yellow(`Cloning repository ${repo} into ${workspaceDir}...`));
    execSync(`glab repo clone ${repo} ${workspaceDir}`, { stdio: 'inherit' });
  }

  // Check if branch exists
  const branchExists = execSync(
    `git -C ${workspaceDir} rev-parse --verify ${branchName} 2>/dev/null || echo ""`,
    { encoding: 'utf-8' }
  ).trim() !== '';

  if (branchExists) {
    console.log(chalk.green(`Checking out existing branch ${branchName}...`));
    execSync(`git -C ${workspaceDir} checkout ${branchName}`, { stdio: 'inherit' });
  } else {
    console.log(chalk.green(`Creating and checking out new branch ${branchName}...`));
    execSync(`git -C ${workspaceDir} checkout -b ${branchName}`, { stdio: 'inherit' });
  }

  return workspaceDir;
}

function generateTelegramMessage(issue: any, result: string, cost: number, iterations: number): string {
  const branchName = `issue/gitlab-${issue.id()}`;
  const issueUrl = `https://gitlab.com/nakit-yok/backend/-/issues/${issue.id()}`;

  return `✅ <b>Issue Completed</b>

<a href="${issueUrl}">${issue.title()}</a>

Branch: <code>${branchName}</code>
Iterations: ${iterations} | Cost: $${cost.toFixed(4)}

<b>Result:</b>
${result}`;
}

async function processIssue(issue: any, repo: string, telegramConfig: any, signaler: any) {
  console.log(chalk.blue.bold(`[${repo}] New or updated issue:`), issue.title());

  // Create task record
  const task = await createTask(sql, {
    title: issue.title(),
    description: `GitLab Issue #${issue.id()} from ${repo}`,
    status: 'processing',
    source_gitlab_issue: {
      id: issue.id(),
      iid: issue.iid ? issue.iid() : null,
      repo,
      title: issue.title(),
      updated_at: issue.updatedAt()
    }
  });
  console.log(chalk.green(`Created task ${task.id} for issue ${issue.id()}`));

  // Create session record
  const session = await createSession(sql, {
    task_id: task.id,
    runner: 'claude-agent-sdk'
  });
  console.log(chalk.green(`Created session ${session.id}`));

  const workspaceDir = setupIssueWorkspace(issue.id(), repo);
  const branchName = `issue/gitlab-${issue.id()}`;

  const iterator = query({
      prompt: `You are working on GitLab issue #${issue.id()}: ${issue.title()}

CRITICAL FIRST STEP:
- Your FIRST action must be: \`glab issue view ${issue.id()}\`
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context

IMPORTANT INSTRUCTIONS:
- Do ONLY what is explicitly asked in the issue - no extra features, improvements, or refactoring
- You are currently on branch "${branchName}" - all your work should be done on this branch
- Avoid installing dependencies (npm install) unless absolutely required for the task
- Use npm for package management (no other package managers)
- Use glab CLI for GitLab operations (issues, MRs, etc.) - it's already configured and available
- Be concise in your responses - focus on actions, not explanations

COMMUNICATION REQUIREMENTS:
- Post progress updates as comments to the issue using: \`glab issue note ${issue.id()} --message "your update"\`
- Write comments when starting significant steps (e.g., "Starting implementation", "Running tests", etc.)
- Keep comments brief and informative

COMPLETION REQUIREMENTS (you MUST complete ALL of these):
1. Implement the required changes
2. Commit your changes with a clear commit message
3. Push the branch to remote: \`git push origin ${branchName}\`
4. Create a Merge Request using: \`glab mr create --fill --source-branch ${branchName} --target-branch main\`
5. After creating the MR, link it to the issue by commenting: \`glab issue note ${issue.id()} --message "MR created: [link to MR]"\`
6. The iteration is NOT finished until the MR is created and linked to the issue
7. In your final result, return a simple summary of what was done (1-2 sentences max)`,
    options: {
      permissionMode: 'bypassPermissions',
      env: process.env,
      executable: 'bun',
      cwd: workspaceDir,
      stderr: data => {
        // Append to file
      },
      allowedTools: ['Bash(npm: *)', 'Bash(glab: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob'],
    },
  });

  let iterations = 0;
  let finalCost = 0;
  for await (const chunk of iterator) {
    iterations++;

    // Store all chunks as messages
    await createMessage(sql, {
      session_id: session.id,
      data: chunk
    });

    if (chunk.type === 'result') {
      finalCost = chunk.total_cost_usd;
      const resultText = ('result' in chunk ? chunk?.result : undefined) || 'No result available';

      // Update task status
      await updateTaskStatus(sql, task.id, 'completed');

      // Signal completion with task_id
      await signaler.signal(issue.uniqueId(), new Date(), task.id);

      // Generate and send Telegram notification
      try {
        console.log(chalk.yellow('Sending Telegram notification...'));
        const message = generateTelegramMessage(issue, resultText, finalCost, iterations);
        await sendTelegramMessage(telegramConfig, { text: message });
        console.log(chalk.green('Telegram notification sent!'));
      } catch (error) {
        console.error(chalk.red('Failed to send Telegram notification:'), error);
      }
    }
  }
}

async function run() {
  const telegramConfig = getTelegramConfigFromEnv();
  const workerId = `${process.pid}-${Date.now()}`;

  console.log(chalk.blue.bold(`Worker ID: ${workerId}`));

  while (true) {
    console.log(chalk.cyan.bold(`\n=== Starting new iteration at ${new Date().toISOString()} ===\n`));

    for (const repo of REPOS) {
      console.log(chalk.magenta.bold(`\nChecking repository: ${repo}\n`));

      const signaler = initTrafficLight(repo);
      const issues = getGitlabIssueList(repo);

      for (const issue of issues) {
        if (await signaler.isSignaledBefore(issue.uniqueId(), issue.updatedAt())) {
          console.log(chalk.gray(`[${repo}] Skipping already processed issue: ${issue.title()}`));
          continue;
        }

        // Try to acquire distributed lock
        if (!(await signaler.tryAcquireLock(issue.uniqueId(), workerId, 3600))) {
          console.log(chalk.yellow(`[${repo}] Issue ${issue.id()} is being processed by another worker`));
          continue;
        }

        try {
          await processIssue(issue, repo, telegramConfig, signaler);
        } catch (error) {
          console.error(chalk.red(`[${repo}] Error processing issue ${issue.id()}:`), error);
          await signaler.releaseLock(issue.uniqueId());
          throw error;
        }
      }
    }

    console.log(chalk.cyan.bold(`\n=== Iteration complete. Sleeping for ${SLEEP_INTERVAL_MS / 1000} seconds ===\n`));
    await new Promise(resolve => setTimeout(resolve, SLEEP_INTERVAL_MS));
  }
}

await run();
