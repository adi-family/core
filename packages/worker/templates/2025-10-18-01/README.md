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

## Authentication

This worker template uses **project-specific API keys** for authentication with the backend API.

### API Key System

- **Auto-generated**: Each project automatically gets a dedicated API key for pipeline execution
- **Project-scoped**: Keys are tied to specific projects and only grant access to that project's resources
- **Secure**: Keys are stored hashed (SHA-256) in the database and transmitted securely to pipelines
- **Cached**: Keys are cached for 24 hours to improve performance, then automatically rotated
- **No manual setup required**: The system automatically creates and manages pipeline API keys

### Environment Variables

The `API_TOKEN` environment variable is automatically injected by the pipeline executor with the project-specific API key. You do **not** need to configure it manually.

**Automatically injected variables:**
- `API_BASE_URL` - Backend API URL
- `API_TOKEN` - Project-specific API key (auto-generated)
- `SESSION_ID` - Session UUID
- `PIPELINE_EXECUTION_ID` - Pipeline execution UUID
- `PROJECT_ID` - Project UUID

**AI Provider API keys** (if configured):
- `ANTHROPIC_API_KEY` - Claude API key (from project or platform config)
- `OPENAI_API_KEY` - OpenAI API key (from project config)
- `GOOGLE_API_KEY` - Google Gemini API key (from project config)

### Permissions

Pipeline API keys have the following permissions:
- `pipeline_execute`: Execute pipelines
- `read_project`: Read project information
- `read_tasks`: Read task details
- `write_tasks`: Update task status and results

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
