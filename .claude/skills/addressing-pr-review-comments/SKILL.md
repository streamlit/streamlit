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

**Include:** Unresolved threads, `issue`/`todo`/`chore` comments, maintainer feedback, `CHANGES_REQUESTED` reviews

**Exclude:** Resolved threads, `praise`/`thought`/`note` comments, PR author's own comments

**Critical analysis:** Before categorizing a comment or suggesting a response, thoroughly investigate the code and context:
- **Read the code:** Carefully read the relevant code sections mentioned in the comment, including surrounding logic.
- **Challenge assumptions:** Do not take the reviewer's comment or the original code's correctness for granted. Question both.
- **Seek the truth:** Determine the most correct outcome—whether that means siding with the reviewer, defending the code, or proposing a new solution.
- **Verify bot comments:** Bot suggestions may be false positives. Always validate the issue exists before acting.

**Action types** (per [conventional comments](https://conventionalcomments.org)): `issue` / `todo` / `chore` (must fix) · `suggestion` (consider) · `nitpick` (optional) · `question` (clarify) · `praise` / `thought` / `note` (skip)

### 4. Present options

```
Found {N} unresolved comments on PR #{NUMBER}: {TITLE}
Review Decision: {APPROVED|CHANGES_REQUESTED|REVIEW_REQUIRED}

Actionable Items:
─────────────────────────────────────────────────────────

1. [issue] {file_path}:{line}
   @{reviewer}: "{comment text}"
   Action: {what will be done}

2. [todo] {file_path}:{line}
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

6. [question] {file_path}:{line}
   @{reviewer}: "{comment text}"
   Action: Clarify with user

Skipped: {N} items (praise/thought/note)
─────────────────────────────────────────────────────────

Which items should I address?
Options: "1-5" | "all" | "1,2,3" | "skip 4,5"
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

✅ #1 [issue]: Fixed null check in utils.py
   Reply: "Added null check as suggested. Good catch!"

✅ #2 [nitpick]: Renamed variable to snake_case
   Reply: "Fixed, thanks for the consistency note."

✅ #3 [todo]: Added docstring to function
   Reply: "Added comprehensive docstring."

⏭️ #4 [question]: Skipped - requires your input
   Question: "Should this handle the edge case of empty lists?"

🤖 #5 [suggestion] (bot): Skipped - false positive
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
