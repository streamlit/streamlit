---
name: addressing-pr-review-comments
description: Address all valid review comments on a PR for the current branch in the streamlit/streamlit repo. Covers both inline review comments and general PR (issue) comments. Use when a PR has reviewer feedback to address, including code changes, style fixes, and documentation updates.
---

# Address PR Comments

Address actionable review comments on the PR for the current branch using `gh` CLI.

## Workflow checklist

Copy and track progress:

```
- [ ] 1. Verify auth: gh auth status
- [ ] 2. Fetch PR data and comments
- [ ] 3. Analyze and categorize comments
- [ ] 4. Present options to user
- [ ] 5. Apply selected fixes
- [ ] 6. Show summary, next steps, and offer to post replies
```

### 1. Verify authentication

```bash
gh auth status
```

If auth fails, prompt user to run `gh auth login`.

### 2. Fetch PR data

You must fetch both inline review comments and general PR (issue) comments. Use both when building the list of feedback to address. General comments have no file or line. Treat them as PR-level feedback.

```bash
# PR details for current branch (extract PR number from here)
gh pr view --json number,title,url,state,author,headRefName,baseRefName,reviewDecision,reviews,comments

# Inline review comments with file/line info (--paginate fetches all pages)
gh api --paginate repos/streamlit/streamlit/pulls/{PR_NUMBER}/comments

# General PR discussion comments (--paginate fetches all pages)
gh api --paginate repos/streamlit/streamlit/issues/{PR_NUMBER}/comments
```

Get unresolved review threads via GraphQL (inline only; used for file/path/line). The query returns the first comment of each thread for display when listing threads; full comment bodies are already fetched via the REST `pulls/{PR_NUMBER}/comments` and `issues/{PR_NUMBER}/comments` APIs above. Note: `reviewThreads(first: 100)` returns at most 100 threads; for PRs with more unresolved threads, use cursor-based pagination (`pageInfo.hasNextPage` / `endCursor`) or rely on the REST comments list.

```bash
gh api graphql -f query="
{
  repository(owner: \"streamlit\", name: \"streamlit\") {
    pullRequest(number: {PR_NUMBER}) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          path
          line
          comments(first: 1) {
            nodes { author { login } body }
          }
        }
      }
    }
  }
}" --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)]'
```

Issue comments (from `issues/{PR_NUMBER}/comments`) do not have a "resolved" flag. Consider all issue comments when building the actionable list, including the PR author's. Author comments can add useful context.

**Tip:** Save outputs for later reference if the data falls out of context: `work-tmp/reviews/pr-{PR_NUMBER}-review-threads.json` for inline threads, and `work-tmp/reviews/pr-{PR_NUMBER}-issue-comments.json` for general PR comments.

### 3. Analyze comments

**Include:** Unresolved threads (inline), general PR comments from `issues/{PR}/comments`, `issue`/`todo`/`chore` comments, maintainer feedback, `CHANGES_REQUESTED` reviews. Include the PR author's comments when present. They can help clarify the problem space.

**Exclude:** Resolved threads, `praise`/`thought`/`note` comments (unless the caller explicitly requests responding to ALL comments, in which case acknowledge these with a brief reply)

**Skip status-only automated comments.** Ignore comments that are only status or check notifications with no actionable feedback. Examples: Snyk ("Snyk checks have passed. No issues have been found so far.") and comments from `.github/workflows/pr-preview.yml` that only say the PR is building or the preview is ready.

**Include substantive bot feedback.** Include automated comments that contain actual review feedback. For example, AI review comments from the `github-actions` bot. Treat them like other review comments and validate before acting. Bot suggestions can be false positives.

**General PR comments:** Analyze general PR comments (from `issues/{PR}/comments`) the same way as inline comments. Same include/exclude rules and conventional-comment types (`issue` / `todo` / `chore` / `suggestion` / etc.).

**Critical analysis:** Before categorizing a comment or suggesting a response, thoroughly investigate the code and context:

- **Read the code:** Carefully read the relevant code sections mentioned in the comment, including surrounding logic.
- **Challenge assumptions:** Do not take the reviewer's comment or the original code's correctness for granted. Question both.
- **Seek the truth:** Determine the most correct outcome—whether that means siding with the reviewer, defending the code, or proposing a new solution.
- **Verify bot comments:** Bot suggestions may be false positives. Always validate the issue exists before acting.
- **General comments without file/line:** If a comment does not reference a file or line, infer scope from the text (e.g. "add a test" points to a test file, "update the doc" to docs). If scope is unclear, list possible locations when presenting options.

**Action types** (per [conventional comments](https://conventionalcomments.org)): `issue` / `todo` / `chore` (must fix) · `suggestion` (consider) · `nitpick` (optional) · `question` (clarify) · `praise` / `thought` / `note` (skip)

### 4. Present options

The list below combines actionable inline comments and general PR comments. For general comments use "(general)" or "PR-level" instead of `{file_path}:{line}`.

```
Found {N} actionable comments ({X} inline, {Y} general) on PR #{NUMBER}: {TITLE}
Review Decision: {APPROVED|CHANGES_REQUESTED|REVIEW_REQUIRED}

Actionable Items:
─────────────────────────────────────────────────────────

1. [issue] {file_path}:{line}
   @{reviewer}: "{comment text}"
   Action: {what will be done}

2. [todo] (general)
   @{reviewer}: "{comment text}"
   Action: {what will be done}

3. [chore] (general)
   @{reviewer}: "{comment text}"
   Action: {what will be done}

4. [suggestion] {file_path}:{line}
   @{reviewer}: "{comment text}"
   Action: {what will be done} (optional)

5. [nitpick] {file_path}:{line}
   @{reviewer}: "{comment text}"
   Action: {what will be done} (optional)

6. [question] (general)
   @{reviewer}: "{comment text}"
   Action: Clarify with user

Skipped: {N} items (praise/thought/note)
─────────────────────────────────────────────────────────

Which items should I address?
Recommended: "1,2,3" (required items)
Options: "1-5" | "all" | "1,2,3" | "skip 4,5"
```

### 5. Apply fixes

For each selected item:

1. Read the affected file (for general comments, infer from comment content; see below)
2. Assess complexity - flag high-complexity fixes to user instead of applying
3. Apply minimal fix
4. Prepare brief reply text for the PR comment

For general (non-inline) comments there is no path or line on the comment. Infer the affected file from the comment content, or treat as PR-level (e.g. "update README", "add a test"). If the target is unclear, list options and let the user choose before applying.

**High-complexity fixes:** If a fix requires large refactors, new abstractions, or risky changes disproportionate to the comment, stop and present the trade-off to the user. Let them decide whether to proceed, push back, or find a simpler approach.

### 6. Summary

```bash
git status --short
git diff --stat
```

Report:

- Changes per comment with suggested reply text
- Remaining unaddressed comments
- Skipped items (questions, bot false positives)
- Next steps: `git add`, `git commit -m "fix: address PR review comments"`, `git push`

**Example summary:**

```
─────────────────────────────────────────────────────────
Summary of Changes
─────────────────────────────────────────────────────────

Addressed 4 of 6 comments:

✅ #1 [issue]: Fixed null check in utils.py
   Reply: "Added null check as suggested. Good catch!"

✅ #2 [chore] (general): Updated README as requested
   Reply: "Done, README updated."

✅ #3 [nitpick]: Renamed variable to snake_case
   Reply: "Fixed, thanks for the consistency note."

✅ #4 [todo]: Added docstring to function
   Reply: "Added comprehensive docstring."

⏭️ #5 [question]: Skipped - requires your input
   Question: "Should this handle the edge case of empty lists?"

🤖 #6 [suggestion] (bot): Skipped - false positive
   Bot suggested: "Variable may be undefined"
   Reason: Variable is always initialized in the preceding block

─────────────────────────────────────────────────────────

Files modified:
  lib/streamlit/utils.py | 15 +++++++++------

Next steps:
  git add -A
  git commit -m "fix: address PR review comments"
  git push

─────────────────────────────────────────────────────────
Post Replies to PR Comments? (optional, after push)

Options: "all" | "bots" (skip humans) | "1,2,3" | "skip"
```

To post a reply to a review comment:

```bash
# For inline review comments (use the comment ID from the API response)
gh api repos/streamlit/streamlit/pulls/{PR_NUMBER}/comments/{COMMENT_ID}/replies \
  -f body="Your reply text here"

# For general PR discussion comments
gh api repos/streamlit/streamlit/issues/{PR_NUMBER}/comments \
  -f body="@{reviewer} Re: {brief context} - {reply text}"
```

To resolve an inline review thread after addressing it (use the thread `id` from the GraphQL query above):

```bash
gh api graphql -f query='mutation { resolveReviewThread(input: { threadId: "<THREAD_NODE_ID>" }) { thread { isResolved } } }'
```

Note: Only inline review threads can be resolved. General PR (issue) comments do not have a resolvable state. Do not resolve threads that were deferred to human input - let the reviewer resolve those once satisfied.

## Rules

- **Both sources**: Consider both inline review comments and general PR comments when building the list of feedback to address.
- **Minimal fixes**: Address exactly what was requested
- **Flag complexity**: If a fix requires significant refactoring, flag it to user first
- **Verify bot comments**: Always validate before acting
- **Preserve intent**: Don't change unrelated code
- **Reply suggestions**: Provide brief, professional reply text for each addressed comment
- **Skip**: Resolved threads, info-only comments, praise, incorrect bot suggestions, and status-only automated comments (e.g. Snyk "checks passed", pr-preview build status).

## Error handling

| Issue | Solution |
|-------|----------|
| Auth failed | `gh auth login` |
| No PR for branch | `gh pr list --head $(git branch --show-current)` |
| No comments | "No actionable comments found" |
| File not found | Comment may reference deleted/moved file |
| Rate limited | Wait and retry |
| Uncommitted changes | Warn user first |
