---
name: addressing-pr-review-comments
description: Address all valid review comments on a PR for the current branch in the streamlit/streamlit repo. Use when a PR has received reviewer feedback that needs to be addressed, including code changes, style fixes, and documentation updates.
---

# Address PR Comments

Address actionable review comments on the PR for the current branch using `gh` CLI.

## Workflow Checklist

Copy and track progress:

```
- [ ] 1. Verify auth: gh auth status
- [ ] 2. Fetch PR data and comments
- [ ] 3. Analyze and categorize comments
- [ ] 4. Present options to user
- [ ] 5. Apply selected fixes
- [ ] 6. Show summary and next steps
```

### 1. Verify Authentication

```bash
gh auth status
```

If auth fails, prompt user to run `gh auth login`.

### 2. Fetch PR Data

```bash
# PR details for current branch (extract PR number from here)
gh pr view --json number,title,url,state,author,headRefName,baseRefName,reviewDecision,reviews,comments

# Inline review comments with file/line info
gh api repos/streamlit/streamlit/pulls/{PR_NUMBER}/comments

# General PR discussion comments
gh api repos/streamlit/streamlit/issues/{PR_NUMBER}/comments
```

Get unresolved review threads via GraphQL:

```bash
gh api graphql -f query="
{
  repository(owner: \"streamlit\", name: \"streamlit\") {
    pullRequest(number: $PR_NUMBER) {
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

### 3. Analyze Comments

**Include:** Unresolved threads, file/line references, maintainer feedback, `CHANGES_REQUESTED` reviews

**Exclude:** Resolved threads, PR author's own comments, praise/acknowledgments, questions that don't require a response

**Bot comments:** Verify the issue exists in code before acting. Skip false positives and note them in summary. Human reviewer comments carry more weight.

**Categories:** `CODE`, `STYLE`, `DOCS`, `TEST`, `QUESTION`

### 4. Present Options

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

### 5. Apply Fixes

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

## Error Handling

| Issue | Solution |
|-------|----------|
| Auth failed | `gh auth login` |
| No PR for branch | `gh pr list --head $(git branch --show-current)` |
| No comments | "No actionable comments found" |
| File not found | Comment may reference deleted/moved file |
| Rate limited | Wait and retry |
| Uncommitted changes | Warn user first |
