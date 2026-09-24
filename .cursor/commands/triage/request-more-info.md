# Request More Information

## Mission

Request additional details from the issue reporter when there's insufficient information to reproduce the issue.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Reference:** For comment guidelines and approval workflow, see `github-comment-guidelines.md`

## Prerequisites

- Issue analyzed via `analyze-issue.md`
- Determined that critical information is missing
- Specific details identified that would enable reproduction

**When to use:**

- No code example and vague description
- Cannot determine expected behavior
- Missing critical version information (for regressions)
- Steps are unclear or incomplete

## Workflow

### Step 1: Draft Information Request

Create a clear, helpful request identifying exactly what's missing:

**Comment Template:**

````markdown
Thank you for reporting this issue! To help us reproduce and fix this, could you please provide additional information?

**Missing Details:**

- [ ] <Specific detail needed, e.g., "Minimal code example that reproduces the issue">
- [ ] <e.g., "Streamlit version (`streamlit version`)">
- [ ] <e.g., "Python version (`python --version`)">
- [ ] <e.g., "Complete error message or stack trace">

**Example Format:**

```python
import streamlit as st

# Your minimal reproducible example here
```

**Environment Information:**

- Streamlit version:
- Python version:
- Operating System:
- Browser (if applicable):

This will help us create a reproduction and investigate the issue. Thank you!
````

**Important:** See `github-comment-guidelines.md` for best practices on information requests.

### Step 2: Get Team Approval

**⚠️ CRITICAL:** All GitHub comments require team approval before posting.

Present the draft comment to a team member for review:

- Show the complete comment text
- Wait for explicit "approved" confirmation
- Only proceed after approval

### Step 3: Post Request (After Approval)

Once approved:

```bash
ISSUE_AUTHOR=$(gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json author --jq '.author.login')

gh issue comment <ISSUE_NUMBER> --repo streamlit/streamlit --body "<Your approved information request>"
```

### Step 4: Update Labels

```bash
# Remove needs-triage, add awaiting-user-response
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit \
  --remove-label "status:needs-triage" \
  --add-label "status:awaiting-user-response"
```

## Completion Checklist

- [ ] Information request drafted with specific missing details
- [ ] Team member approved request
- [ ] Comment posted to GitHub
- [ ] Label updated to `status:awaiting-user-response`

## Output Summary

```markdown
## Information Request Summary for Issue #<ISSUE_NUMBER>

**Comment Posted:** ✅
**Labels Updated:** ✅ (status:awaiting-user-response)
**Missing Details Requested:**

- <Detail 1>
- <Detail 2>

**Next Steps:**

- Monitor for reporter response
- Resume reproduction after info provided
```

## Tips for Effective Information Requests

1. **Be specific:** Don't just say "need more info" - list exactly what's missing
2. **Provide examples:** Show template for code, environment info
3. **Explain why:** Help reporter understand why details matter
4. **Be encouraging:** Frame as collaboration, not interrogation
5. **Lower barriers:** Make it easy to provide info (templates, examples)

## Notes

- Most reporters want to help - make it easy for them
- Specific requests get better responses than vague ones
- Provide code templates to guide reporters
- Be patient - reporters may not be familiar with bug reporting

**Next:** Monitor issue for reporter response, then resume triage workflow when info is provided
