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
- [ ] 3. Merge snapshot update PRs targeting this PR
- [ ] 4. Fix CI failures
- [ ] 5. Address PR review comments
- [ ] 6. Validate changes locally
- [ ] 7. Push changes
- [ ] 8. Request a final AI review if the PR is blocked
- [ ] 9. Repeat until CI passes
```

### 1. Detect PR

Use `gh pr view` to get PR details for the current branch. If no PR exists, stop and inform the user to create one first.

### 2. Wait for CI to complete

Poll CI status every 3 minutes until all workflows finish:

- Use `gh run list --branch <branch> --status in_progress` and `--status queued` to check
- Sleep 180 seconds between checks
- Continue when both return empty results

### 3. Merge snapshot update PRs

The snapshot autofix workflow (`snapshot-autofix.yml`) opens a pull request that **targets this PR's branch** after `update-snapshots` is applied. Those PRs use a head branch named `snapshots/<pr-number>-<run-id>`.

After CI is idle, merge every open snapshot PR whose base is the current branch:

```bash
PR_NUM=$(gh pr view --json number -q .number)
BRANCH=$(git branch --show-current)

gh pr list --base "$BRANCH" --state open --json number,headRefName \
  --jq '.[] | select(.headRefName | startswith("snapshots/'"$PR_NUM"'-")) | .number'
```

For each matching PR:

```bash
# Snapshot PR checks are not required. Merge immediately, even if they are still running.
gh pr merge "$SNAPSHOT_PR" --squash --admin --delete-branch
git pull --ff-only origin "$BRANCH"
```

If any snapshot PR was merged, return to step 2. The merge pushes to this branch, so CI has to run again. Do not add `update-snapshots` again while a matching snapshot PR is still open.

Skip this step when no open snapshot PR targets the current branch. If a snapshot PR has merge conflicts, skip it and continue. Do not merge that PR, and do not stop to ask the user.

### 4. Fix CI failures

Check for failures with `gh pr checks` and `gh run list --status failure`.

**If failures exist:** Run the /fixing-streamlit-ci skill to diagnose and fix.

**Fix strategy:**

- **Code-fixable issues** (lint, types, tests): Apply fixes directly
- **Snapshot mismatches**: Do NOT fix manually. Apply the label instead. The next pass through step 3 merges the snapshot PR once that workflow has opened it:
  ```
  gh pr edit --add-label "update-snapshots"
  ```
- **PR Labels workflow failure**: Ignore - this is a policy check, not a code issue

**If no failures:** Proceed to step 5.

### 5. Address PR review comments

Run the /addressing-pr-review-comments skill to handle feedback from reviewers and bots.

For each review comment:
1. Evaluate if the feedback is relevant and actionable
2. Implement changes for valid suggestions
3. Post brief replies **directly on each review comment thread** (not as a combined PR comment) explaining what was done or why feedback was declined
4. **Respond to ALL unresolved comments**, even those that don't require code changes (e.g., thoughts, observations, questions). Acknowledge these with a brief reply to keep the conversation flowing. Note: This overrides the skill's default exclusion of `thought`/`note` comment types.
5. **Resolve addressed bot comment threads** after replying using `gh api`. Only auto-resolve comments from bots (github-actions, copilot, cursor, greptile, graphite). Do NOT auto-resolve human contributor comments - let reviewers resolve those themselves. Also do NOT resolve threads deferred to human input (per the Exception below).

**Exception:** Don't auto-address review comments that require significant product, design, architecture decisions, or significant refactorings. Instead, reply on the comment thread pointing this out and mention that it will need human input.

### 6. Validate changes locally

Run the /checking-changes skill (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 7. Push changes

If there are uncommitted changes, commit with a descriptive message and push.

### 8. Request a final AI review if the PR is blocked

If this iteration **pushed commits that address the previous review** and the PR is blocked by the `do-not-merge` label, apply `ai-final-review` only after that push succeeds:

```bash
# Run only after the review-based commits are on the remote.
# Adding the label first would start the review on the already-blocked commit.
# Add the label only when it is not already present.
LABELS=$(gh pr view --json labels -q '.labels[].name')
if echo "$LABELS" | grep -qx 'do-not-merge' && ! echo "$LABELS" | grep -qx 'ai-final-review'; then
  gh pr edit --add-label "ai-final-review"
fi
```

Skip this step when:

- the PR does not have `do-not-merge`
- the PR already has `ai-final-review`
- this iteration did not push changes based on the previous review (CI-only fixes, or nothing to push)

### 9. Repeat until CI passes

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
- **Snapshot mismatches**: Always use the `update-snapshots` label, never fix snapshot files manually. Merge the snapshot PR the workflow opens against this branch.
- **Snapshot PR conflicts**: Skip that PR and continue. Do not merge it, and do not stop to ask the user.
- **Blocked PRs**: Apply `ai-final-review` only after pushing the commits that address the previous review, only when `do-not-merge` is present, and only if `ai-final-review` is not already on the PR
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
