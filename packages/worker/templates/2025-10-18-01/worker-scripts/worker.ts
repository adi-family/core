#!/usr/bin/env bun
/**
 * ADI Worker - Single Binary Entry Point
 * Routes commands to appropriate pipeline implementations
 */

// Prevent pipeline modules from auto-executing when imported
process.env.__WORKER_BINARY__ = 'true'

type Command = 'claude' | 'evaluation' | 'codex' | 'gemini' | 'upload-results' | 'upload-evaluation' | 'push' | 'sync'

const COMMAND_MODULES = {
  'claude': () => import('./claude-pipeline').then(m => m.claudePipeline),
  'evaluation': () => import('./evaluation-pipeline').then(m => m.evaluationPipeline),
  'codex': () => import('./codex-pipeline').then(m => m.codexPipeline),
  'gemini': () => import('./gemini-pipeline').then(m => m.geminiPipeline),
  'upload-results': () => import('./upload-results').then(m => m.uploadResults),
  'upload-evaluation': () => import('./upload-evaluation-results').then(m => m.uploadEvaluationResults),
  'push': () => import('./push-to-file-spaces').then(m => m.pushToFileSpaces),
  'sync': () => import('./sync-workspaces').then(m => m.syncWorkspaces),
} as const

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

  if (!(command in COMMAND_MODULES)) {
    console.error(`❌ Unknown command: ${command}`)
    console.error(`   Run 'worker help' to see available commands`)
    process.exit(1)
  }

  try {
    console.log(`🚀 Running ${command} pipeline...`)
    const pipelineFunc = await COMMAND_MODULES[command as Command]()
    await pipelineFunc()
  } catch (error) {
    console.error(`❌ Failed to run ${command} pipeline:`, error)
    process.exit(1)
  }
}

main()
