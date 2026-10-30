---
name: fixing-pr
description: Automatically fix CI failures, resolve merge conflicts with the base branch, and address PR review comments for the current branch. Use when a PR needs CI fixes, conflict resolution against its base branch, review feedback handling, and validation before merge.
model: inherit
memory: user
skills:
  - fixing-streamlit-ci
  - addressing-pr-review-comments
  - checking-changes
---

# Fixing PR

Automates the PR maintenance loop: update the branch when merge conflicts block it, wait for CI, fix failures, address review comments, validate, push, and repeat until CI passes.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Go from current state to passing CI without human intervention. Make decisions without asking for human input. Note any open questions or ambiguities in a PR conversation comment (under the Conversation tab) rather than blocking on them. Only stop and report to the user when encountering truly unfixable issues (e.g., a merge conflict with no clear resolution, missing PR).

## Context

- **Repository**: streamlit/streamlit
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`

## Workflow

```
- [ ] 1. Detect PR for current branch
- [ ] 2. Update the branch when conflicts block the merge
- [ ] 3. Wait for CI workflows to complete
- [ ] 4. Merge snapshot update PRs targeting this PR
- [ ] 5. Fix CI failures
- [ ] 6. Address PR review comments
- [ ] 7. Validate changes locally
- [ ] 8. Push changes
- [ ] 9. Request a final AI review if this iteration addressed one
- [ ] 10. Repeat until CI passes
```

### 1. Detect PR

Use `gh pr view` to get PR details for the current branch, including `baseRefName`, `mergeable`, and `mergeStateStatus`. If no PR exists, stop and inform the user to create one first.

### 2. Update the branch when conflicts block the merge

Refetch `mergeable` and `mergeStateStatus` while either is `UNKNOWN`. GitHub has not finished computing mergeability, so do not treat `UNKNOWN` as clear.

When `mergeable` is `CONFLICTING`, or `mergeStateStatus` is `DIRTY`, the pull request cannot merge into its base branch. Update the head branch with that base and resolve every conflict before doing anything else:

- Fetch the base branch and merge it into the PR head
- Resolve each conflict so the result keeps this PR's intended change and the incoming changes from the base
- Validate the resolution with the /checking-changes skill (`make check`), then commit, push, and return to step 3

`make check` before that push wins over pushing the resolution immediately.

Do this even when checks are also failing. A base-branch conflict wins over an in-flight `update-snapshots` run: this push cancels that run. If snapshots still mismatch after the next CI wait, step 5 adds the label again.

A conflicting snapshot PR that targets this branch is not this conflict. Leave it for step 4, which skips that snapshot PR and continues.

Stop only when a conflict has no clear resolution. Name the files and what is unclear.

### 3. Wait for CI to complete

Poll CI status every 3 minutes until all workflows finish:

- Use `gh run list --branch <branch> --status in_progress` and `--status queued` to check
- Sleep 180 seconds between checks
- Continue when both return empty results

### 4. Merge snapshot update PRs

Squash-merge open snapshot-autofix PRs that target this branch (`snapshots/<pr-number>-<run-id>-<attempt>`), without waiting for their checks. After a merge, pull that commit and return to step 3. If one conflicts, skip it and continue.

### 5. Fix CI failures

Check for failures with `gh pr checks` and `gh run list --status failure`.

**If failures exist:** Run the /fixing-streamlit-ci skill to diagnose and fix.

**Fix strategy:**

- **Code-fixable issues** (lint, types, tests): Apply fixes directly
- **Snapshot mismatches**: Do NOT fix manually. Apply the label, then return to step 3 and let step 4 merge the snapshot PR once it exists. Do not push again in this iteration, or the snapshot workflow is cancelled before it opens that PR:
  ```
  gh pr edit --add-label "update-snapshots"
  ```
- **PR Labels workflow failure**: Ignore - this is a policy check, not a code issue

**If no failures:** Proceed to step 6.

### 6. Address PR review comments

Run the /addressing-pr-review-comments skill to handle feedback from reviewers and bots.

For each review comment:
1. Evaluate if the feedback is relevant and actionable
2. Implement changes for valid suggestions that pass the skill's proportionality check. Declining a rare, low-impact case whose fix would add disproportionate complexity is a valid outcome
3. Post brief replies **directly on each review comment thread** (not as a combined PR comment) explaining what was done or why feedback was declined
4. **Respond to ALL unresolved comments**, even those that don't require code changes (e.g., thoughts, observations, questions). Acknowledge these with a brief reply to keep the conversation flowing. Note: This overrides the skill's default exclusion of `thought`/`note` comment types.
5. **Resolve addressed bot comment threads** after replying using `gh api`. Only auto-resolve comments from bots (github-actions, copilot, cursor, greptile, graphite). Do NOT auto-resolve human contributor comments - let reviewers resolve those themselves. Also do NOT resolve threads deferred to human input (per the Exception below).

**Exception:** Don't auto-address review comments that require significant product, design, architecture decisions, or significant refactorings. Instead, reply on the comment thread pointing this out and mention that it will need human input.

### 7. Validate changes locally

Run the /checking-changes skill (uses `make check`) to validate the changes. Wait for completion, then fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 8. Push changes

If there are uncommitted changes, commit with a descriptive message and push.

### 9. Request a final AI review if this iteration addressed one

If this iteration pushed commits that address the previous review, and the PR is blocked by `do-not-merge`, add `ai-final-review` after that push. Skip this when the label is already present, or when this iteration did not push review fixes.

```bash
gh pr edit --add-label "ai-final-review"
```

Then return to step 3 so that review runs on the new commits.

### 10. Repeat until CI passes

Return to step 3 and wait for CI to complete again. After each push, if the merge is blocked by conflicts again, return to step 2 before waiting.

Before a successful exit, refetch mergeability even when this iteration pushed nothing. The base branch can move during the CI wait, and a conflicted PR can stay green because GitHub keeps a stale merge ref. Refetch while `mergeable` or `mergeStateStatus` is `UNKNOWN`. If `mergeable` is `CONFLICTING` or `mergeStateStatus` is `DIRTY`, return to step 2.

**Exit conditions:**
- All CI checks pass, and the PR is not `CONFLICTING` or `DIRTY`
- No fixable failures remain (only policy/label checks failing), and the PR is not `CONFLICTING` or `DIRTY`
- Maximum 5 iterations reached

## Rules

- **Focus on root cause**: Fix the primary error, not cascading failures
- **Minimal fixes**: Smallest change that resolves the issue
- **Proportionate review fixes**: Do not add state, abstractions, or long special-case branches for rare or theoretical cases just to satisfy a review. Each added branch also invites new comments in the next review round
- **Don't skip tests**: Never disable tests to "fix" CI
- **Verify locally**: Always run `make check` before pushing
- **Snapshot mismatches**: Always use the `update-snapshots` label, never fix snapshot files manually. Merge the snapshot PR the workflow opens against this branch. Skip a conflicting snapshot PR and continue.
- **Conflicts with the base branch**: Merge the base into this branch and resolve every conflict. Keep this PR's intended change together with the incoming base changes. Run `make check` before pushing the resolution. Recheck mergeability before a green-CI exit, including when this iteration pushed nothing. Stop only when a conflict has no clear resolution.
- **Blocked PRs**: After pushing review fixes, add `ai-final-review` when `do-not-merge` is present and `ai-final-review` is not
- **Limit iterations**: Stop after 5 fix-push-wait cycles to avoid infinite loops

## Error handling

| Issue | Solution |
|-------|----------|
| No PR for branch | Stop and inform user to create PR first |
| Auth failed | Stop and report to user — interactive auth not available in autonomous mode |
| CI stuck | If CI hasn't completed after 30 minutes, stop and report to user |
| Unfixable failure | Report to user and stop |
| Merge conflicts with the base branch | Merge the base into this branch, resolve every conflict, run `make check`, then push. Recheck mergeability before a green-CI exit. Stop only when a conflict has no clear resolution |
| Conflicting snapshot PR | Skip that snapshot PR and continue |
| Rate limited | Check `gh api rate_limit` for reset time, wait until resolved, then retry |
