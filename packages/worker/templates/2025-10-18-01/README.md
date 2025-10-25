# ADI Worker Repository Template

Version: 2025-10-18-01

This repository contains GitLab CI pipelines for running AI agents (Claude, Codex, Gemini) on tasks.

## Structure

```
.
├── .gitlab-ci-claude.yml    # GitLab CI for Claude Code
├── .gitlab-ci-codex.yml     # GitLab CI for OpenAI Codex
├── .gitlab-ci-gemini.yml    # GitLab CI for Google Gemini
├── worker-scripts/          # TypeScript pipeline scripts
│   ├── claude-pipeline.ts   # Claude execution logic
│   ├── codex-pipeline.ts    # Codex execution logic
│   ├── gemini-pipeline.ts   # Gemini execution logic
│   ├── upload-results.ts    # Results upload to API
│   ├── shared/              # Shared utilities
│   │   ├── api-client.ts    # API client for backend
│   │   ├── traffic-check.ts # Pre-execution checks
│   │   ├── completion-check.ts  # Task completion validation
│   │   └── clarification-check.ts  # Detect clarification needs
│   └── package.json         # Dependencies
└── README.md
```

## GitLab CI/CD Variables

Configure these in GitLab → Settings → CI/CD → Variables:

- `API_BASE_URL` - Backend API URL (e.g., https://api.adi.com)
- `API_TOKEN` - Backend authentication token (masked/protected)
- `ANTHROPIC_API_KEY` - Claude API key (masked/protected)
- `OPENAI_API_KEY` - Codex API key (masked/protected)
- `GOOGLE_API_KEY` - Gemini API key (masked/protected)

## Pipeline Trigger

Pipelines are triggered via GitLab API with these variables:

- `SESSION_ID` - UUID of session to process
- `PIPELINE_EXECUTION_ID` - UUID of pipeline_executions record
- `CI_RUNNER` - Runner type to use (e.g., `evaluation`, `claude`, `codex`, `gemini`)

## How It Works

1. **Prepare Stage**: Install dependencies with Bun
2. **Execute Stage**:
   - Update pipeline status to "running"
   - Fetch session/task/file-space from API
   - Run traffic check
   - Execute AI agent
   - Run completion/clarification checks
   - Update status to "success" or "failed"
3. **Report Stage**:
   - Create merge request (if applicable)
   - Upload artifacts (MR URLs) to API
   - Update task status

## Development

All pipeline scripts are written in TypeScript and run with Bun for fast execution and native TypeScript support.

To test locally:
```bash
cd worker-scripts
bun install
bun run claude-pipeline.ts
```

## Version History

- `2025-10-18-01` - Initial version with Bun + TypeScript support
