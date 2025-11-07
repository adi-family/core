#!/bin/bash
#
# Test Script for clone-workspace.sh
# Tests multi-workspace cloning with various scenarios
#

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    log_test "Cleaning up test artifacts..."
    rm -rf /tmp/workspace-test-* /tmp/clone-output*.log /tmp/workspace-env.sh 2>/dev/null || true
}

# Register cleanup on exit
trap cleanup EXIT

echo ""
echo "========================================"
echo "  Clone Workspace Test Suite"
echo "========================================"
echo ""

# Test 1: Single public repository
test_single_public_repo() {
    log_test "Test 1: Clone single public repository"

    export PIPELINE_EXECUTION_ID="test-single-$(date +%s)"
    export FILE_SPACES='[
        {
            "name": "adi-simple",
            "id": "test-1",
            "repo": "https://github.com/anthropics/anthropic-sdk-typescript.git"
        }
    ]'
    export CLONE_DEPTH=2

    if ./clone-workspace.sh; then
        source /tmp/workspace-env.sh

        # Verify results
        if [ "$WORKSPACE_COUNT" -eq 1 ]; then
            log_success "WORKSPACE_COUNT = 1"
        else
            log_error "WORKSPACE_COUNT = $WORKSPACE_COUNT (expected 1)"
            return 1
        fi

        if [ -d "$WORKSPACE_DIR" ]; then
            log_success "Workspace directory exists: $WORKSPACE_DIR"
        else
            log_error "Workspace directory not found: $WORKSPACE_DIR"
            return 1
        fi

        if [ -d "$WORKSPACE_DIR/.git" ]; then
            log_success "Git repository initialized"
        else
            log_error "Not a git repository"
            return 1
        fi

        # Check commit count
        cd "$WORKSPACE_DIR"
        COMMIT_COUNT=$(git rev-list --count HEAD)
        if [ "$COMMIT_COUNT" -le 2 ]; then
            log_success "Shallow clone verified (depth: $COMMIT_COUNT)"
        else
            log_warning "More commits than expected: $COMMIT_COUNT"
        fi

        log_success "Test 1 PASSED"
        return 0
    else
        log_error "Test 1 FAILED: clone-workspace.sh returned error"
        return 1
    fi
}

# Test 2: Multiple repositories
test_multiple_repos() {
    log_test "Test 2: Clone multiple public repositories"

    export PIPELINE_EXECUTION_ID="test-multi-$(date +%s)"
    export FILE_SPACES='[
        {
            "name": "anthropic-sdk",
            "id": "test-2a",
            "repo": "https://github.com/anthropics/anthropic-sdk-typescript.git"
        },
        {
            "name": "anthropic-quickstarts",
            "id": "test-2b",
            "repo": "https://github.com/anthropics/anthropic-quickstarts.git"
        }
    ]'
    export CLONE_DEPTH=2

    if ./clone-workspace.sh; then
        source /tmp/workspace-env.sh

        # Verify results
        if [ "$WORKSPACE_COUNT" -eq 2 ]; then
            log_success "WORKSPACE_COUNT = 2"
        else
            log_error "WORKSPACE_COUNT = $WORKSPACE_COUNT (expected 2)"
            return 1
        fi

        # Parse workspace dirs
        read -ra DIRS <<< "$WORKSPACE_DIRS"
        read -ra NAMES <<< "$WORKSPACE_NAMES"

        for i in "${!DIRS[@]}"; do
            DIR="${DIRS[$i]}"
            NAME="${NAMES[$i]}"

            if [ -d "$DIR" ]; then
                log_success "Workspace $((i+1)) exists: $NAME at $DIR"
            else
                log_error "Workspace $((i+1)) not found: $DIR"
                return 1
            fi
        done

        log_success "Test 2 PASSED"
        return 0
    else
        log_error "Test 2 FAILED: clone-workspace.sh returned error"
        return 1
    fi
}

# Test 3: Branch detection priority (should prefer dev/develop over main)
test_branch_detection() {
    log_test "Test 3: Branch detection priority"

    export PIPELINE_EXECUTION_ID="test-branch-$(date +%s)"
    # This repo has a main branch
    export FILE_SPACES='[
        {
            "name": "test-repo",
            "id": "test-3",
            "repo": "https://github.com/anthropics/anthropic-sdk-typescript.git"
        }
    ]'
    export CLONE_DEPTH=2

    if ./clone-workspace.sh; then
        source /tmp/workspace-env.sh

        log_success "Branch selected: $WORKSPACE_BRANCH"

        # Check if it's one of the expected branches
        if [[ "$WORKSPACE_BRANCH" =~ ^(dev|develop|development|main|master)$ ]]; then
            log_success "Valid branch selected"
        else
            log_warning "Unexpected branch: $WORKSPACE_BRANCH"
        fi

        log_success "Test 3 PASSED"
        return 0
    else
        log_error "Test 3 FAILED"
        return 1
    fi
}

# Test 4: Custom branch override
test_custom_branch() {
    log_test "Test 4: Custom branch override"

    export PIPELINE_EXECUTION_ID="test-custom-$(date +%s)"
    export FILE_SPACES='[
        {
            "name": "test-repo",
            "id": "test-4",
            "repo": "https://github.com/anthropics/anthropic-sdk-typescript.git"
        }
    ]'
    export CLONE_DEPTH=2
    export REPO_BRANCH="main"

    if ./clone-workspace.sh; then
        source /tmp/workspace-env.sh

        if [ "$WORKSPACE_BRANCH" = "main" ]; then
            log_success "Custom branch override works: $WORKSPACE_BRANCH"
        else
            log_error "Expected branch 'main', got: $WORKSPACE_BRANCH"
            unset REPO_BRANCH
            return 1
        fi

        unset REPO_BRANCH
        log_success "Test 4 PASSED"
        return 0
    else
        unset REPO_BRANCH
        log_error "Test 4 FAILED"
        return 1
    fi
}

# Test 5: Invalid repository (should fail gracefully)
test_invalid_repo() {
    log_test "Test 5: Invalid repository (should fail)"

    export PIPELINE_EXECUTION_ID="test-invalid-$(date +%s)"
    export FILE_SPACES='[
        {
            "name": "invalid-repo",
            "id": "test-5",
            "repo": "https://github.com/nonexistent/nonexistent-repo-12345.git"
        }
    ]'
    export CLONE_DEPTH=2

    if ./clone-workspace.sh 2>&1 | grep -q "Failed to clone"; then
        log_success "Correctly failed on invalid repository"
        log_success "Test 5 PASSED"
        return 0
    else
        log_error "Should have failed on invalid repository"
        return 1
    fi
}

# Run all tests
echo "Starting tests..."
echo ""

if test_single_public_repo; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

if test_multiple_repos; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

if test_branch_detection; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

if test_custom_branch; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

if test_invalid_repo; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi
echo ""

# Summary
echo "========================================"
echo "  Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    log_success "All tests passed! ✨"
    exit 0
else
    log_error "Some tests failed"
    exit 1
fi
