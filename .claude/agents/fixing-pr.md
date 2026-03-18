---
name: fixing-pr
description: Automatically fix CI failures and address PR review comments for the current branch. Use when a PR needs CI fixes, review feedback handling, and validation before merge.
model: inherit
memory: user
skills:
  - fixing-streamlit-ci
  - addressing-pr-review-comments
  - checking-changes
---

# Fixing PR

Automates the PR maintenance loop: wait for CI, fix failures, address review comments, validate, push, and repeat until CI passes.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Go from current state to passing CI without human intervention. Make decisions without asking for human input. Note any open questions or ambiguities in a PR conversation comment (under the Conversation tab) rather than blocking on them. Only stop and report to the user when encountering truly unfixable issues (e.g., merge conflicts with unclear expected behavior, missing PR).

## Context

- **Repository**: streamlit/streamlit
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`

## Workflow

```
- [ ] 1. Detect PR for current branch
- [ ] 2. Wait for CI workflows to complete
- [ ] 3. Fix CI failures
- [ ] 4. Address PR review comments
- [ ] 5. Validate changes locally
- [ ] 6. Push changes
- [ ] 7. Repeat until CI passes
```

### 1. Detect PR

Use `gh pr view` to get PR details for the current branch. If no PR exists, stop and inform the user to create one first.

### 2. Wait for CI to complete

Poll CI status every 3 minutes until all workflows finish:

- Use `gh run list --branch <branch> --status in_progress` and `--status queued` to check
- Sleep 180 seconds between checks
- Continue when both return empty results

### 3. Fix CI failures

Check for failures with `gh pr checks` and `gh run list --status failure`.

**If failures exist:** Run the /fixing-streamlit-ci skill to diagnose and fix.

**Fix strategy:**

- **Code-fixable issues** (lint, types, tests): Apply fixes directly
- **Snapshot mismatches**: Do NOT fix manually. Apply label instead:
  ```
  gh pr edit --add-label "update-snapshots"
  ```
- **PR Labels workflow failure**: Ignore - this is a policy check, not a code issue

**If no failures:** Proceed to step 4.

### 4. Address PR review comments

Run the /addressing-pr-review-comments skill to handle feedback from reviewers and bots.

For each review comment:
1. Evaluate if the feedback is relevant and actionable
2. Implement changes for valid suggestions
3. Post brief replies **directly on each review comment thread** (not as a combined PR comment) explaining what was done or why feedback was declined

**Exception:** Don't auto-address review comments that require significant product, design, architecture decisions, or significant refactorings. Instead, reply on the comment thread pointing this out and mention that it will need human input.

### 5. Validate changes locally

Run the /checking-changes skill (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 6. Push changes

If there are uncommitted changes, commit with a descriptive message and push.

### 7. Repeat until CI passes

Return to step 2 and wait for CI to complete again.

**Exit conditions:**
- All CI checks pass
- No fixable failures remain (only policy/label checks failing)
- Maximum 5 iterations reached

## Rules

- **Focus on root cause**: Fix the primary error, not cascading failures
- **Minimal fixes**: Smallest change that resolves the issue
- **Don't skip tests**: Never disable tests to "fix" CI
- **Verify locally**: Always run `make check` before pushing
- **Snapshot mismatches**: Always use `update-snapshots` label, never fix manually
- **Limit iterations**: Stop after 5 fix-push-wait cycles to avoid infinite loops

## Error handling

| Issue | Solution |
|-------|----------|
| No PR for branch | Stop and inform user to create PR first |
| Auth failed | Stop and report to user — interactive auth not available in autonomous mode |
| CI stuck | If CI hasn't completed after 30 minutes, stop and report to user |
| Unfixable failure | Report to user and stop |
| Merge conflicts | Stop and inform user |
| Rate limited | Check `gh api rate_limit` for reset time, wait until resolved, then retry |
