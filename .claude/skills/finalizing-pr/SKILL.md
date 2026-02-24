---
name: finalizing-pr
description: Finalizes branch changes for merging by simplifying code, running checks, reviewing changes, and creating a PR if needed. Use when ready to merge changes into the target branch.
---

# Finalizing PR

Prepares the current branch for merge by running quality checks, simplifying code, and creating a PR if one doesn't exist.

## Workflow

Follow these steps in order:

> **Note:** For small changes (documentation tweaks, test-only tweaks, one-liners, or other mini-changes), you can skip steps 1, 2, 5, 6, and 7.

### 1. Build and install

Run `make all` in a subagent to ensure the build and installation are up-to-date. Wait for completion before proceeding.

```bash
make all
```

### 2. Simplify changes

Run the `simplifying-local-changes` subagent to clean up and simplify the code changes. Wait for completion before proceeding.

### 3. Run autofix

Run autofix in a subagent to fix formatting and linting issues. Wait for completion before proceeding.

```bash
make autofix
```

### 4. Run checks (first pass)

Run the /checking-changes skill in a subagent (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 5. Review changes

Run the `reviewing-local-changes` subagent to review the changes. Wait for completion and read the review output.

### 6. Address review feedback

Review the recommendations from step 5. For each recommendation:

- If valid and improves code quality: implement the change
- If not applicable or would over-engineer: skip with brief reasoning

### 7. Run checks (second pass)

Run the /checking-changes skill in a subagent (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 8. Create or update PR

> **Note:** If currently on `develop`, create a new branch first following the naming conventions in `wiki/pull-requests.md`.

Check if a PR exists for the current branch:

```bash
gh pr view --json number,title,url
```

**If no PR exists**, create one following the guidelines in `wiki/pull-requests.md`. Add appropriate labels (`impact:*` and `change:*`) and fill in the body based on `.github/pull_request_template.md` (skip the video/screenshot section):

```bash
gh pr create --push --base develop --title "[type] Description" --body "$(cat <<'EOF'
## Describe your changes

- Change 1
- Change 2

## Testing Plan

- [x] Unit Tests (JS and/or Python)
EOF
)" --label "impact:users,change:feature"
```

**If PR exists**, check if description needs updating based on current changes.

### 9. Fix CI issues and address PR review comments

Run the `fixing-pr` subagent to automatically wait for CI, fix any failures, address PR review comments, validate changes, and push. Wait for completion before proceeding.

### 10. Trigger final AI review

Apply the `ai-review` label to trigger the final AI code review:

```bash
gh pr edit --add-label "ai-review"
```
