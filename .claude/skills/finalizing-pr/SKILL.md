---
name: finalizing-pr
description: Finalizes branch changes for merging by simplifying code, running checks, reviewing changes, and creating a PR if needed. Use when ready to merge changes into the target branch.
---

# Finalizing PR

Prepares the current branch for merge by running quality checks, simplifying code, and creating a PR if one doesn't exist.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Go from current state to merge-ready PR without human intervention. Note any open questions or ambiguities in a PR conversation comment (under the Conversation tab) rather than blocking on them.

## Workflow

Follow these steps in order. **Run all subagents in foreground** (not background) unless otherwise specified—wait for each to complete before proceeding.

> **Note:** For small changes (documentation tweaks, test-only tweaks, one-liners, or other mini-changes), you can skip steps 1, 2, 3, 6, 7, and 8.

### 1. Build and install

Run `make all` in a subagent to ensure the build and installation are up-to-date. Wait for completion before proceeding.

```bash
make all
```

### 2. Update internal docs

Run the `/updating-internal-docs` skill in a background subagent to auto-fix internal documentation issues. Instruct it to apply all recommended fixes to internal docs issues related to the local changes.

### 3. Simplify changes

Run the `simplifying-local-changes` subagent to clean up and simplify the code changes. Wait for completion before proceeding.

### 4. Run autofix

Run autofix in a subagent to fix formatting and linting issues. Wait for completion before proceeding.

```bash
make autofix
```

### 5. Run checks (first pass)

Run the /checking-changes skill in a subagent (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 6. Review changes

Run the `reviewing-local-changes` subagent to review the changes. Wait for completion and read the review output.

### 7. Address review feedback

Review the recommendations from step 6. For each recommendation:

- If valid and improves code quality: implement the change
- If not applicable or would over-engineer: skip with brief reasoning

### 8. Run checks (second pass)

Run the /checking-changes skill in a subagent with `E2E_CHECK=true make check` to also run changed e2e tests. Wait for completion, then fix any issues found before proceeding. Snapshot mismatches can be ignored (they require manual updates).

### 9. Create or update PR

> **Note:** If currently on `develop`, create a new branch first following the naming conventions in `wiki/pull-requests.md`.

Check if a PR exists for the current branch:

```bash
gh pr view --json number,title,url
```

**If no PR exists**, create one following the guidelines in `wiki/pull-requests.md` (please read!). Add appropriate labels and fill in the body based on `.github/pull_request_template.md` (skip the video/screenshot section).

**Link related issues:** Add `- Closes #12345` to the PR description for any known GitHub issues this PR resolves.

**Required labels:**

| Category | Options |
|----------|---------|
| Impact | `impact:users` (affects user behavior) OR `impact:internal` (no user behavior change) |
| Change type | `change:feature`, `change:bugfix`, `change:chore`, `change:refactor`, `change:docs`, `change:spec`, `change:other` |

Note: PRs labeled `change:spec` (for spec/design documents only) are exempt from Impact label requirements.

```bash
# Push branch to origin first (required for gh pr create in non-interactive mode)
git push -u origin HEAD

# Create the PR
gh pr create --base develop --title "[type] Description" --body "$(cat <<'EOF'
## Describe your changes

- Change 1
- Change 2

## GitHub Issue Link (if applicable)

- Closes #12345

## Testing Plan

- [x] Unit Tests (JS and/or Python)
EOF
)" --label "impact:users,change:feature"
```

**If PR exists**, check if description needs updating based on current changes.

### 10. Trigger AI review

Apply the `ai-review` label to trigger the AI code review:

```bash
gh pr edit --add-label "ai-review"
```

### 11. Upload intermediate files

If relevant intermediate files exist (specs, plans, implementation notes in `work-tmp/` or untracked in `specs/`), run the `/sharing-pr-agent-artifacts` skill to push them to the wiki and comment on the PR with links.

### 12. Fix CI issues and address PR review comments

Run the `fixing-pr` subagent to automatically wait for CI, fix any failures, address PR review comments, validate changes, and push. Wait for completion before proceeding.

### 13. Post agent metrics

Post the agent metrics to the PR body:

```bash
uv run python scripts/log_agent_metrics.py --post
```

### 14. Trigger final AI review

Apply the `ai-review` label to trigger the final AI code review:

```bash
gh pr edit --add-label "ai-review"
```
