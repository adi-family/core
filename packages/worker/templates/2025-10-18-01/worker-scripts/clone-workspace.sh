#!/bin/bash
#
# Smart Workspace Cloning Script
# Clones multiple repositories with intelligent branch detection and shallow cloning
#
# Usage:
#   ./clone-workspace.sh
#
# Required environment variables:
#   FILE_SPACES       - JSON array of file space configurations
#   PIPELINE_EXECUTION_ID - Unique ID for this execution (for temp directory naming)
#
# Optional environment variables:
#   CLONE_DEPTH       - Clone depth (default: 4)
#   REPO_BRANCH       - Specific branch to clone (overrides auto-detection for all repos)
#
# FILE_SPACES JSON format:
#   [
#     {
#       "name": "workspace-name",
#       "id": "workspace-id",
#       "repo": "https://github.com/user/repo.git",
#       "host": "https://github.com",
#       "token": "optional-access-token"
#     }
#   ]
#
# Outputs:
#   WORKSPACE_DIRS    - Newline-separated list of cloned workspace paths
#   WORKSPACE_NAMES   - Newline-separated list of workspace names
#

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Validate required environment variables
if [ -z "$FILE_SPACES" ]; then
    log_error "FILE_SPACES environment variable is required"
    exit 1
fi

if [ -z "$PIPELINE_EXECUTION_ID" ]; then
    log_error "PIPELINE_EXECUTION_ID environment variable is required"
    exit 1
fi

# Configuration
CLONE_DEPTH="${CLONE_DEPTH:-4}"
BASE_DIR="/tmp/workspace-${PIPELINE_EXECUTION_ID}"

log_info "Starting smart multi-workspace clone..."
log_info "Clone depth: $CLONE_DEPTH commits"

# Create base workspace directory
mkdir -p "$BASE_DIR"
log_success "Created base directory: $BASE_DIR"

# Arrays to track results
WORKSPACE_DIRS=()
WORKSPACE_NAMES=()
WORKSPACE_BRANCHES=()

# Parse FILE_SPACES JSON and clone each repository
FILE_SPACE_COUNT=$(echo "$FILE_SPACES" | bun -e "console.log(JSON.parse(await Bun.stdin.text()).length)")
log_info "Found $FILE_SPACE_COUNT file space(s) to clone"

for i in $(seq 0 $((FILE_SPACE_COUNT - 1))); do
    log_info "\n📦 Cloning workspace $((i + 1))/$FILE_SPACE_COUNT..."

    # Extract file space details using bun
    WORKSPACE_NAME=$(echo "$FILE_SPACES" | bun -e "const data = JSON.parse(await Bun.stdin.text()); console.log(data[$i].name)")
    WORKSPACE_ID=$(echo "$FILE_SPACES" | bun -e "const data = JSON.parse(await Bun.stdin.text()); console.log(data[$i].id)")
    REPO_URL=$(echo "$FILE_SPACES" | bun -e "const data = JSON.parse(await Bun.stdin.text()); console.log(data[$i].repo)")
    REPO_TOKEN=$(echo "$FILE_SPACES" | bun -e "const data = JSON.parse(await Bun.stdin.text()); console.log(data[$i].token || '')")

    log_info "Name: $WORKSPACE_NAME"
    log_info "Repository: $REPO_URL"

    # Inject authentication token if provided
    CLONE_URL="$REPO_URL"
    if [ -n "$REPO_TOKEN" ]; then
        if [[ "$REPO_URL" =~ ^https:// ]]; then
            # Extract host and path from URL
            REPO_HOST=$(echo "$REPO_URL" | sed -E 's|https://([^/]+).*|\1|')
            REPO_PATH=$(echo "$REPO_URL" | sed -E 's|https://[^/]+/(.*)|\1|')
            CLONE_URL="https://oauth2:${REPO_TOKEN}@${REPO_HOST}/${REPO_PATH}"
            log_success "Added authentication to clone URL"
        fi
    fi

    # If user specified a branch, use it directly
    if [ -n "$REPO_BRANCH" ]; then
        log_info "Using user-specified branch: $REPO_BRANCH"
        TARGET_BRANCH="$REPO_BRANCH"
    else
        # Smart branch detection: try dev/develop/development → main/master
        log_info "Detecting available branches..."

        # List remote branches
        AVAILABLE_BRANCHES=$(git ls-remote --heads "$CLONE_URL" 2>/dev/null | sed 's|.*refs/heads/||' || echo "")

        if [ -z "$AVAILABLE_BRANCHES" ]; then
            log_warning "Could not list remote branches"
            log_info "Defaulting to 'main' branch"
            TARGET_BRANCH="main"
        else
            # Priority order: dev, develop, development, main, master
            TARGET_BRANCH=""
            for BRANCH in dev develop development main master; do
                if echo "$AVAILABLE_BRANCHES" | grep -q "^${BRANCH}$"; then
                    TARGET_BRANCH="$BRANCH"
                    break
                fi
            done

            if [ -z "$TARGET_BRANCH" ]; then
                # Fallback: use the first available branch
                TARGET_BRANCH=$(echo "$AVAILABLE_BRANCHES" | head -n 1)
                log_warning "None of the preferred branches found, using: $TARGET_BRANCH"
            else
                log_success "Selected branch: $TARGET_BRANCH"
            fi
        fi
    fi

    # Clone the repository
    WORKSPACE_DIR="${BASE_DIR}/workspace-${i}"
    mkdir -p "$WORKSPACE_DIR"

    log_info "Cloning into: $WORKSPACE_DIR"

    if git clone \
        --branch "$TARGET_BRANCH" \
        --depth "$CLONE_DEPTH" \
        --single-branch \
        "$CLONE_URL" \
        "$WORKSPACE_DIR" 2>&1 | tee "/tmp/clone-output-${i}.log"; then

        log_success "Repository cloned successfully"

        # Show clone statistics
        cd "$WORKSPACE_DIR"
        COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "0")
        LATEST_COMMIT=$(git log -1 --format="%h - %s" 2>/dev/null || echo "unknown")

        log_info "Statistics:"
        log_info "  Branch: $TARGET_BRANCH"
        log_info "  Commits: $COMMIT_COUNT"
        log_info "  Latest: $LATEST_COMMIT"

        # Track this workspace
        WORKSPACE_DIRS+=("$WORKSPACE_DIR")
        WORKSPACE_NAMES+=("$WORKSPACE_NAME")
        WORKSPACE_BRANCHES+=("$TARGET_BRANCH")

        log_success "Workspace ready: $WORKSPACE_DIR"
    else
        log_error "Failed to clone workspace $WORKSPACE_NAME"

        # Show last few lines of clone output for debugging
        if [ -f "/tmp/clone-output-${i}.log" ]; then
            log_error "Clone output (last 10 lines):"
            tail -n 10 "/tmp/clone-output-${i}.log"
        fi

        log_warning "Continuing with remaining workspaces..."
    fi
done

# Export results
if [ ${#WORKSPACE_DIRS[@]} -eq 0 ]; then
    log_error "No workspaces were cloned successfully"
    exit 1
fi

log_info "\n✅ Summary: ${#WORKSPACE_DIRS[@]}/$FILE_SPACE_COUNT workspace(s) cloned successfully"

# Create environment file with all workspace paths
{
    echo "export WORKSPACE_COUNT=${#WORKSPACE_DIRS[@]}"
    echo "export WORKSPACE_DIRS='${WORKSPACE_DIRS[*]}'"
    echo "export WORKSPACE_NAMES='${WORKSPACE_NAMES[*]}'"
    echo "export WORKSPACE_BRANCHES='${WORKSPACE_BRANCHES[*]}'"

    # For backwards compatibility, export first workspace as primary
    echo "export WORKSPACE_DIR='${WORKSPACE_DIRS[0]}'"
    echo "export WORKSPACE_NAME='${WORKSPACE_NAMES[0]}'"
    echo "export WORKSPACE_BRANCH='${WORKSPACE_BRANCHES[0]}'"
} > /tmp/workspace-env.sh

log_success "Environment file created: /tmp/workspace-env.sh"
log_info "To use in your scripts, source /tmp/workspace-env.sh"
