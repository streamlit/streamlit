---
name: addressing-pr-review-comments
description: Address all valid review comments on a PR for the current branch in the streamlit/streamlit repo. Use when a PR has received reviewer feedback that needs to be addressed, including code changes, style fixes, and documentation updates.
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
- [ ] 6. Show summary and next steps
```

### 1. Verify authentication

```bash
gh auth status
```

If auth fails, prompt user to run `gh auth login`.

### 2. Fetch PR data

```bash
# PR details for current branch (extract PR number from here)
gh pr view --json number,title,url,state,author,headRefName,baseRefName,reviewDecision,reviews,comments

# Inline review comments with file/line info (--paginate fetches all pages)
gh api --paginate repos/streamlit/streamlit/pulls/{PR_NUMBER}/comments

# General PR discussion comments (--paginate fetches all pages)
gh api --paginate repos/streamlit/streamlit/issues/{PR_NUMBER}/comments
```

Get unresolved review threads via GraphQL:

```bash
gh api graphql -f query="
{
  repository(owner: \"streamlit\", name: \"streamlit\") {
    pullRequest(number: {PR_NUMBER}) {
      reviewThreads(first: 100) {
        nodes {
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

**Tip:** Save outputs to `work-tmp/reviews/pr-{PR_NUMBER}-review-threads.json` for later reference if the data falls out of context.

### 3. Analyze comments

**Include:** Unresolved threads, file/line references, maintainer feedback, `CHANGES_REQUESTED` reviews

**Exclude:** Resolved threads, PR author's own comments, praise/acknowledgments, questions that don't require a response

**Critical analysis:** Before categorizing a comment or suggesting a response, thoroughly investigate the code and context:
- **Read the code:** Carefully read the relevant code sections mentioned in the comment, including surrounding logic.
- **Challenge assumptions:** Do not take the reviewer's comment or the original code's correctness for granted. Question both.
- **Seek the truth:** Determine the most correct outcome—whether that means siding with the reviewer, defending the code, or proposing a new solution.
- **Verify bot comments:** Bot suggestions may be false positives. Always validate the issue exists before acting.

**Categories:** `CODE`, `STYLE`, `DOCS`, `TEST`, `QUESTION`

**Response types:** For each comment, determine the appropriate response:
- **Acknowledge and Fix:** Legitimate problem that needs to be fixed.
- **Clarify Intent:** Code is correct but reviewer needs clarification on purpose or logic.
- **Suggestion for Improvement:** Better implementation suggested, even if current code works.
- **Nitpick/Style:** Minor stylistic or formatting preference.
- **Request for Tests:** Missing or insufficient test coverage.
- **Design Discussion:** Higher-level question about overall approach or design.
- **Positive Feedback:** Praise for the implementation (skip, no action needed).
- **Out of Scope:** Valid but relates to code outside the scope of current changes.

### 4. Present options

```
Found {N} unresolved comments on PR #{NUMBER}: {TITLE}
Review Decision: {APPROVED|CHANGES_REQUESTED|REVIEW_REQUIRED}

Actionable Items:
─────────────────────────────────────────────────────────

1. [CODE] {file_path}:{line_number}
   Reviewer: @{username}
   Comment: "{comment text}"
   Suggested fix: {describe what needs to be done}

2. [STYLE] {file_path}:{line_number}
   Reviewer: @{username}
   Comment: "{comment text}"
   Suggested fix: {describe what needs to be done}

3. [QUESTION] (conversation comment)
   Reviewer: @{username}
   Comment: "{comment text}"
   Requires: Clarification from user

─────────────────────────────────────────────────────────

Which items should I address?
Options: "1" | "1,3" | "1-5" | "all" | "skip 2"
```

### 5. Apply fixes

For each selected item:
1. Read the affected file
2. Assess complexity - flag high-complexity fixes to user instead of applying
3. Apply minimal fix
4. Prepare brief reply text for the PR comment

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

Addressed 3 of 5 comments:

✅ Comment #1 [CODE]: Fixed null check in utils.py
   Reply: "Added null check as suggested. Good catch!"

✅ Comment #2 [STYLE]: Renamed variable to snake_case
   Reply: "Fixed, thanks for the consistency note."

✅ Comment #3 [DOCS]: Added docstring to function
   Reply: "Added comprehensive docstring."

⏭️ Comment #4 [QUESTION]: Skipped - requires your input
   Question: "Should this handle the edge case of empty lists?"

🤖 Comment #5 [CODE] (bot): Skipped - false positive
   Bot suggested: "Variable may be undefined"
   Reason: Variable is always initialized in the preceding block

─────────────────────────────────────────────────────────

Files modified:
  lib/streamlit/utils.py | 15 +++++++++------

Next steps:
  git add -A
  git commit -m "fix: address PR review comments"
  git push
```

## Rules

- **Minimal fixes**: Address exactly what was requested
- **Flag complexity**: If a fix requires significant refactoring, flag it to user first
- **Verify bot comments**: Always validate before acting
- **Preserve intent**: Don't change unrelated code
- **Reply suggestions**: Provide brief, professional reply text for each addressed comment
- **Skip**: Resolved threads, info-only comments, praise, incorrect bot suggestions

## Error handling

| Issue | Solution |
|-------|----------|
| Auth failed | `gh auth login` |
| No PR for branch | `gh pr list --head $(git branch --show-current)` |
| No comments | "No actionable comments found" |
| File not found | Comment may reference deleted/moved file |
| Rate limited | Wait and retry |
| Uncommitted changes | Warn user first |
