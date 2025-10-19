# Environment Variables and Configuration

This document describes all environment variables used by the ADI worker system and the required GitLab token scopes.

## Environment Variables

### Database Configuration

#### `DATABASE_URL` (Required)
- **Description**: PostgreSQL connection string
- **Format**: `postgres://user:password@host:port/database?sslmode=disable`
- **Example**: `postgres://postgres:postgres@localhost:5436/postgres?sslmode=disable`
- **Used by**: Backend, Worker, Migrations
- **Notes**: For production, use SSL mode (`sslmode=require`)

### Worker Configuration

#### `APPS_DIR` (Required)
- **Description**: Directory for workspace clones (repositories)
- **Default**: `.apps`
- **Example**: `.apps` or `/var/worker/apps`
- **Used by**: Worker
- **Notes**: This directory will contain cloned repositories. It's gitignored and should have sufficient disk space.

#### `RUNNER_TYPES` (Optional)
- **Description**: Comma-separated list of AI runner types to support
- **Default**: `claude`
- **Options**: `claude`, `codex`, `gemini`
- **Example**: `claude,codex,gemini`
- **Used by**: Worker
- **Notes**: Tasks are distributed round-robin across configured runners

#### `USE_PIPELINE_EXECUTION` (Optional)
- **Description**: Enable GitLab pipeline execution mode
- **Default**: `false`
- **Options**: `true`, `false`
- **Example**: `true`
- **Used by**: Worker
- **Notes**: When enabled, tasks are executed via GitLab CI pipelines instead of local execution

### Security Configuration

#### `ENCRYPTION_KEY` (Required for Pipeline Mode)
- **Description**: Encryption key for securing tokens in database
- **Format**: String (minimum 32 characters recommended)
- **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0`
- **Used by**: Worker, Backend
- **Generation**: `openssl rand -hex 32`
- **Notes**:
  - Must be consistent across all services
  - Used for AES-256-GCM encryption with PBKDF2 key derivation
  - Never change this after encrypting data, or you'll lose access to encrypted tokens

#### `API_TOKEN` (Required for Pipeline Mode)
- **Description**: Authentication token for pipeline API endpoints
- **Format**: String (recommend 32+ characters)
- **Example**: `9a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3a2b1c0`
- **Used by**: Backend, Pipeline Scripts
- **Generation**: `openssl rand -hex 32`
- **Notes**:
  - Used by GitLab pipelines to authenticate API requests
  - Must match in backend `.env` and GitLab CI/CD variables

### GitLab Configuration

#### `GITLAB_HOST` (Optional)
- **Description**: GitLab instance URL
- **Default**: `https://gitlab.com`
- **Example**: `https://gitlab.the-ihor.com`
- **Used by**: Worker
- **Notes**: For self-hosted GitLab instances

#### `GITLAB_TOKEN` (Required for GitLab Integration)
- **Description**: GitLab personal access token or project access token
- **Format**: String (GitLab token format)
- **Example**: `glpat-xxxxxxxxxxxxxxxxxxxx`
- **Used by**: Worker
- **Scopes Required**: See [GitLab Token Scopes](#gitlab-token-scopes) below
- **Notes**:
  - Can use personal or project access tokens
  - Must have sufficient permissions to create repositories, trigger pipelines, and read issues

### AI Agent API Keys

#### `ANTHROPIC_API_KEY` (Required for Claude Runner)
- **Description**: Anthropic API key for Claude Code
- **Format**: String (Anthropic key format)
- **Example**: `sk-ant-xxxxxxxxxxxxxxxxxxxx`
- **Used by**: Worker, Pipeline Scripts
- **Notes**: Required when using the `claude` runner type

#### `OPENAI_API_KEY` (Optional - for Codex Runner)
- **Description**: OpenAI API key for Codex
- **Format**: String (OpenAI key format)
- **Example**: `sk-xxxxxxxxxxxxxxxxxxxx`
- **Used by**: Worker, Pipeline Scripts
- **Notes**: Required when using the `codex` runner type

#### `GOOGLE_API_KEY` (Optional - for Gemini Runner)
- **Description**: Google API key for Gemini
- **Format**: String (Google key format)
- **Example**: `AIzaxxxxxxxxxxxxxxxxxxxx`
- **Used by**: Worker, Pipeline Scripts
- **Notes**:
  - Required when using the `gemini` runner type
  - Alternative: use `npx @google/gemini-cli login` for authentication

### Pipeline Monitoring Configuration

#### `PIPELINE_STATUS_TIMEOUT_MINUTES` (Optional)
- **Description**: Maximum time to wait for pipeline completion before marking as stale
- **Default**: `30`
- **Unit**: Minutes
- **Example**: `30`
- **Used by**: Worker (Pipeline Monitor)
- **Notes**: Pipelines older than this without status updates are marked as stale

#### `PIPELINE_POLL_INTERVAL_MS` (Optional)
- **Description**: Interval for checking pipeline statuses
- **Default**: `600000` (10 minutes)
- **Unit**: Milliseconds
- **Example**: `600000` (10 min), `300000` (5 min)
- **Used by**: Worker (Pipeline Monitor)
- **Notes**: Balance between responsiveness and API rate limits

### GitLab CI/CD Pipeline Variables

These variables must be configured in the GitLab worker repository's CI/CD settings (Settings → CI/CD → Variables):

#### `API_BASE_URL` (Required)
- **Description**: Base URL of the ADI backend API
- **Example**: `http://your-server:3000` or `https://api.your-domain.com`
- **Masked**: No
- **Protected**: Yes
- **Notes**: Used by pipeline scripts to communicate with backend

#### `API_TOKEN` (Required)
- **Description**: Authentication token (same as backend `API_TOKEN`)
- **Example**: `9a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q2r1s0t9u8v7w6x5y4z3a2b1c0`
- **Masked**: Yes
- **Protected**: Yes
- **Notes**: Must match the `API_TOKEN` in backend `.env`

#### `ANTHROPIC_API_KEY` (Required for Claude)
- **Description**: Anthropic API key
- **Example**: `sk-ant-xxxxxxxxxxxxxxxxxxxx`
- **Masked**: Yes
- **Protected**: Yes

#### `OPENAI_API_KEY` (Optional - for Codex)
- **Description**: OpenAI API key
- **Example**: `sk-xxxxxxxxxxxxxxxxxxxx`
- **Masked**: Yes
- **Protected**: Yes

#### `GOOGLE_API_KEY` (Optional - for Gemini)
- **Description**: Google API key
- **Example**: `AIzaxxxxxxxxxxxxxxxxxxxx`
- **Masked**: Yes
- **Protected**: Yes

#### `DATABASE_URL` (Optional)
- **Description**: Database connection string (if pipelines need direct DB access)
- **Example**: `postgres://postgres:postgres@db-server:5432/postgres`
- **Masked**: Yes
- **Protected**: Yes
- **Notes**: Only needed if pipeline scripts require direct database access

## GitLab Token Scopes

When creating a GitLab personal access token or project access token for the `GITLAB_TOKEN` environment variable, the following scopes are required:

### Required Scopes

#### `api`
- **Purpose**: Full API access
- **Used for**:
  - Creating worker repositories
  - Uploading files to repositories
  - Triggering CI/CD pipelines
  - Reading pipeline status
  - Creating merge requests

#### `read_repository`
- **Purpose**: Read repository code
- **Used for**:
  - Accessing repository information
  - Validating repository configuration

#### `write_repository`
- **Purpose**: Write to repository
- **Used for**:
  - Creating new repositories
  - Uploading CI configuration files
  - Uploading worker scripts

### Optional Scopes (Recommended)

#### `read_api`
- **Purpose**: Read-only API access
- **Used for**:
  - Reading project information
  - Reading issue data

### Creating a Personal Access Token

1. Go to GitLab → User Settings → Access Tokens
2. Fill in the details:
   - **Name**: `ADI Worker Token`
   - **Expiration date**: Set appropriate expiration (or no expiration for production)
   - **Scopes**: Select `api`, `read_repository`, `write_repository`
3. Click "Create personal access token"
4. Copy the token immediately (it won't be shown again)
5. Save it as `GITLAB_TOKEN` in your `.env` file

### Creating a Project Access Token

For more restricted access (recommended for production):

1. Go to Project → Settings → Access Tokens
2. Fill in the details:
   - **Name**: `ADI Worker Token`
   - **Role**: Maintainer or Owner
   - **Scopes**: Select `api`, `read_repository`, `write_repository`
3. Click "Create project access token"
4. Copy the token and save it as `GITLAB_TOKEN`

## Environment Variable Priority

Variables are loaded in the following order (later sources override earlier ones):

1. System environment variables
2. `.env` file (if present)
3. GitLab CI/CD variables (in pipeline context)

## Security Best Practices

### Local Development

1. Use `.env` file for local configuration
2. Never commit `.env` to version control
3. Use `.env.example` as a template
4. Rotate tokens regularly

### Production

1. Use environment variables from orchestration platform (Kubernetes secrets, Docker secrets, etc.)
2. Enable SSL/TLS for database connections (`sslmode=require`)
3. Use strong, unique values for `ENCRYPTION_KEY` and `API_TOKEN`
4. Set GitLab CI/CD variables as "Masked" and "Protected"
5. Limit token scopes to minimum required
6. Set token expiration dates
7. Monitor token usage
8. Rotate tokens regularly (e.g., every 90 days)

### Token Rotation

When rotating `ENCRYPTION_KEY`:

1. **Do NOT rotate `ENCRYPTION_KEY` on existing deployments** - encrypted data will become inaccessible
2. If rotation is necessary:
   - Create a migration script to re-encrypt all tokens with new key
   - Test thoroughly before deployment
   - Maintain backup of database

When rotating `API_TOKEN`:

1. Update token in backend `.env`
2. Update token in GitLab CI/CD variables
3. Restart backend service
4. No data migration required

## Validation

To validate your environment configuration:

```bash
# Check required variables are set
./scripts/validate-env.sh

# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Test GitLab API access
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" "$GITLAB_HOST/api/v4/user"

# Test Anthropic API
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages

# Test backend API
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/projects
```

## Example Configurations

### Development (`.env`)

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5436/postgres?sslmode=disable
APPS_DIR=.apps
RUNNER_TYPES=claude
USE_PIPELINE_EXECUTION=true
ENCRYPTION_KEY=dev-key-not-for-production-32chars-min
API_TOKEN=dev-token-not-for-production
GITLAB_HOST=https://gitlab.the-ihor.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
PIPELINE_STATUS_TIMEOUT_MINUTES=30
PIPELINE_POLL_INTERVAL_MS=600000
```

### Production (Environment Variables)

```bash
DATABASE_URL=postgres://prod_user:strong_password@db-server:5432/adi_prod?sslmode=require
APPS_DIR=/var/adi/apps
RUNNER_TYPES=claude,codex,gemini
USE_PIPELINE_EXECUTION=true
ENCRYPTION_KEY=<64-char-secure-random-string>
API_TOKEN=<64-char-secure-random-string>
GITLAB_HOST=https://gitlab.company.com
GITLAB_TOKEN=<gitlab-token>
ANTHROPIC_API_KEY=<anthropic-key>
OPENAI_API_KEY=<openai-key>
GOOGLE_API_KEY=<google-key>
PIPELINE_STATUS_TIMEOUT_MINUTES=60
PIPELINE_POLL_INTERVAL_MS=300000
```
