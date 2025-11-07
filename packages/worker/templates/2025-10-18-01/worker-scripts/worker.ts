#!/usr/bin/env bun
/**
 * ADI Worker - Single Binary Entry Point
 * Routes commands to appropriate pipeline implementations
 */

const COMMANDS = {
  'claude': './claude-pipeline',
  'evaluation': './evaluation-pipeline',
  'codex': './codex-pipeline',
  'gemini': './gemini-pipeline',
  'upload-results': './upload-results',
  'upload-evaluation': './upload-evaluation-results',
  'push': './push-to-file-spaces',
  'sync': './sync-workspaces',
} as const

type Command = keyof typeof COMMANDS

function showHelp() {
  console.log(`
🔨 ADI Worker - Single Binary Pipeline Runner

Usage:
  worker <command> [options]

Commands:
  claude              Run Claude implementation pipeline
  evaluation          Run task evaluation pipeline
  codex               Run Codex implementation pipeline
  gemini              Run Gemini implementation pipeline
  upload-results      Upload implementation results
  upload-evaluation   Upload evaluation results
  push                Push changes to file spaces
  sync                Sync workspace repositories

Examples:
  worker claude
  worker evaluation
  worker sync

Environment Variables:
  See individual pipeline documentation for required env vars
`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    process.exit(0)
  }

  if (!(command in COMMANDS)) {
    console.error(`❌ Unknown command: ${command}`)
    console.error(`   Run 'worker help' to see available commands`)
    process.exit(1)
  }

  // Dynamic import the pipeline module
  const pipelinePath = COMMANDS[command as Command]

  try {
    console.log(`🚀 Running ${command} pipeline...`)
    await import(pipelinePath)
  } catch (error) {
    console.error(`❌ Failed to run ${command} pipeline:`, error)
    process.exit(1)
  }
}

main()
