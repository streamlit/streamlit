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
- [ ] 8. Request a final AI review after a changes-requested AI review
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

The snapshot autofix workflow (`snapshot-autofix.yml`) opens a pull request that **targets this PR's branch** after `update-snapshots` is applied. Those PRs use a head branch named `snapshots/<pr-number>-<run-id>`, author `app/github-actions`, and only change files under `e2e_playwright/__snapshots__/`.

After CI is idle, merge every open PR that matches all of the following. A `snapshots/<pr-number>-` branch name is not enough on its own:

- base is the current branch
- head ref starts with `snapshots/<pr-number>-`
- `isCrossRepository` is false
- author login is `app/github-actions`
- every changed file is under `e2e_playwright/__snapshots__/`

Pass each listed PR number to `gh pr merge`. Never run `gh pr merge` with an empty selector: with no number, that command selects the PR for the current branch.

```bash
PR_NUM=$(gh pr view --json number -q .number)
BRANCH=$(git branch --show-current)
MERGED=0

SNAPSHOT_PRS=$(gh pr list --base "$BRANCH" --state open --json number,headRefName \
  --jq '.[] | select(.headRefName | startswith("snapshots/'"$PR_NUM"'-")) | .number')

for SNAPSHOT_PR in $SNAPSHOT_PRS; do
  [ -z "$SNAPSHOT_PR" ] && continue
  META=$(gh pr view "$SNAPSHOT_PR" --json author,isCrossRepository,mergeStateStatus)
  AUTHOR=$(echo "$META" | jq -r '.author.login')
  CROSS=$(echo "$META" | jq -r '.isCrossRepository')
  STATE=$(echo "$META" | jq -r '.mergeStateStatus')
  if [ "$STATE" = "UNKNOWN" ]; then
    sleep 5
    STATE=$(gh pr view "$SNAPSHOT_PR" --json mergeStateStatus -q .mergeStateStatus)
  fi
  # gh pr view --json files is capped at 100 paths. Page the files API instead.
  PATHS=$(gh api --paginate "repos/{owner}/{repo}/pulls/${SNAPSHOT_PR}/files" --jq '.[].filename')
  if [ -z "$PATHS" ] || echo "$PATHS" | grep -qv '^e2e_playwright/__snapshots__/'; then
    ONLY_SNAPSHOTS=false
  else
    ONLY_SNAPSHOTS=true
  fi
  if [ "$CROSS" != "false" ] || [ "$AUTHOR" != "app/github-actions" ] || [ "$ONLY_SNAPSHOTS" != "true" ]; then
    continue
  fi
  if [ "$STATE" = "DIRTY" ]; then
    # Do not merge a conflicting snapshot PR. Close it so a later update-snapshots run can recreate it.
    gh pr close "$SNAPSHOT_PR" --delete-branch --comment "Closing this conflicting snapshot PR so a later update-snapshots run can regenerate it."
    continue
  fi
  if [ "$STATE" = "BLOCKED" ] || [ "$STATE" = "BEHIND" ]; then
    gh pr merge "$SNAPSHOT_PR" --squash --admin --delete-branch
  else
    # Pending checks do not block a squash merge onto a feature branch. Do not wait for them.
    gh pr merge "$SNAPSHOT_PR" --squash --delete-branch
  fi
  # --delete-branch can make gh pr merge exit non-zero after a successful squash.
  # Count the PR as merged only when GitHub reports state MERGED.
  if [ "$(gh pr view "$SNAPSHOT_PR" --json state -q .state)" = "MERGED" ]; then
    FILE_COUNT=$(gh pr view "$SNAPSHOT_PR" --json changedFiles -q .changedFiles)
    gh pr comment "$PR_NUM" --body "Merged snapshot PR #${SNAPSHOT_PR} (${FILE_COUNT} snapshot file(s))."
    MERGED=1
  else
    echo "merge failed for #$SNAPSHOT_PR" >&2
  fi
done

if [ "$MERGED" -eq 1 ]; then
  git pull --ff-only origin "$BRANCH"
fi
```

If any snapshot PR's state is `MERGED`, return to step 2. That return counts toward the 5-iteration limit. The merge pushes to this branch, so CI has to run again. Do not add `update-snapshots` again while a matching snapshot PR is still open. A snapshot PR closed above does not count as open.

If a merge attempt does not leave the PR `MERGED`, do not comment that it merged and do not return to step 2 because of that attempt. Skip that PR for the rest of this run so a failing merge cannot tight-loop while CI is idle.

Skip this step when no open snapshot PR targets the current branch. If `git pull` is not a fast-forward, stop and report that conflict on this branch.

### 4. Fix CI failures

Check for failures with `gh pr checks` and `gh run list --status failure`.

**If failures exist:** Run the /fixing-streamlit-ci skill to diagnose and fix.

**Fix strategy:**

- **Code-fixable issues** (lint, types, tests): Apply fixes directly
- **Snapshot mismatches**: Do NOT fix manually. Apply the label, then return to step 2. Do not push again in this iteration. `snapshot-autofix.yml` removes `update-snapshots` in its first step and cancels an in-progress run when this branch is pushed, so a later push in the same iteration drops the snapshot PR before it is opened:
  ```
  gh pr edit --add-label "update-snapshots"
  ```
- **PR Labels workflow failure**: Ignore - this is a policy check, not a code issue. Do not treat a `require-labels` failure caused by `do-not-merge` as a reason to exit while step 8 has requested a final review that has not finished.

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

### 8. Request a final AI review after a changes-requested AI review

Apply `ai-final-review` only after this iteration pushed commits that address the latest AI review, and only when that review's verdict is `CHANGES_REQUESTED` and the label is not already present.

`do-not-merge` alone is not the signal. `ai-qa-testing.yml` adds it on QA FAIL and does not remove it on PASS, and people add it by hand. An `APPROVED` `ai-final-review` removes `do-not-merge` and can auto-approve the PR, which would clear a hold this loop did not create.

Set `AI_REVIEW_VERDICT` from the `## Verdict` line of the latest review whose `user.login` is `github-actions[bot]` and whose body contains `<!-- streamlit-ai-review`. Read that line only. A mention of the same words elsewhere in the body does not count. Treat `**CHANGES REQUESTED**` and `**CHANGES_REQUESTED**` as `CHANGES_REQUESTED`. Set `PUSHED_REVIEW_FIXES` to `true` only when this iteration pushed commits that address that review. A CI-only push does not qualify.

```bash
# The review has to include the commits that address the review comments.
# Adding the label before the push reviews the commit that is already blocked.
PR_NUM=$(gh pr view --json number -q .number)
VERDICT_LINE=$(gh api --paginate "repos/streamlit/streamlit/pulls/${PR_NUM}/reviews" \
  | jq -rs '[.[][] | select(.user.login == "github-actions[bot]" and (.body | contains("<!-- streamlit-ai-review")))] | sort_by(.submitted_at) | last | .body' \
  | awk 'found && NF { print; exit } /^## Verdict/ { found=1 }')
case "$VERDICT_LINE" in
  *'**CHANGES REQUESTED**'*|*'**CHANGES_REQUESTED**'*) AI_REVIEW_VERDICT=CHANGES_REQUESTED ;;
  *'**APPROVED**'*) AI_REVIEW_VERDICT=APPROVED ;;
  *) AI_REVIEW_VERDICT=OTHER ;;
esac

LABELS=$(gh pr view --json labels -q '.labels[].name')
if [ "$PUSHED_REVIEW_FIXES" = "true" ] && [ "$AI_REVIEW_VERDICT" = "CHANGES_REQUESTED" ] && ! echo "$LABELS" | grep -qx 'ai-final-review'; then
  gh pr edit --add-label "ai-final-review"
fi
```

Skip this step when:

- the latest AI review verdict is not `CHANGES_REQUESTED`
- the PR already has `ai-final-review`
- this iteration did not push commits that address that review (CI-only fixes, or nothing to push)

After adding the label, return to step 2. Do not exit because `require-labels` is failing while `do-not-merge` is still present.

### 9. Repeat until CI passes

Return to step 2 and wait for CI to complete again.

**Exit conditions:**
- All CI checks pass
- No fixable failures remain (only policy/label checks failing). Do not use this exit while an `ai-final-review` requested in this run has not finished, or while `do-not-merge` is still present only because that review has not removed it
- Maximum 5 iterations reached

## Rules

- **Focus on root cause**: Fix the primary error, not cascading failures
- **Minimal fixes**: Smallest change that resolves the issue
- **Don't skip tests**: Never disable tests to "fix" CI
- **Verify locally**: Always run `make check` before pushing
- **Snapshot mismatches**: Always use the `update-snapshots` label, never fix snapshot files manually. Return to step 2 before any further push, then merge the snapshot PR the workflow opens against this branch.
- **Snapshot PR conflicts**: Do not merge a conflicting snapshot PR. Close it, delete its branch, and continue. That does not block a later `update-snapshots` label.
- **Blocked PRs**: Apply `ai-final-review` only after pushing commits that address a `CHANGES_REQUESTED` AI review, and only if `ai-final-review` is not already on the PR. Do not add it because `do-not-merge` is present.
- **Limit iterations**: Stop after 5 fix-push-wait cycles to avoid infinite loops

## Error handling

| Issue | Solution |
|-------|----------|
| No PR for branch | Stop and inform user to create PR first |
| Auth failed | Stop and report to user — interactive auth not available in autonomous mode |
| CI stuck | If CI hasn't completed after 30 minutes, stop and report to user |
| Unfixable failure | Report to user and stop |
| Merge conflicts on this branch | Stop and inform user. A `git pull` that is not fast-forward is this case. A `DIRTY` snapshot PR is not: close that PR and continue |
| Rate limited | Check `gh api rate_limit` for reset time, wait until resolved, then retry |
