# Gather Bug Context

## Overview

Compile comprehensive context about a bug from multiple sources to prepare for root cause analysis or fix implementation.

## Purpose

This command gathers and consolidates all available information about a bug issue:

- GitHub issue details and comments
- Rotation journal mentions
- Reproduction notes from st-issues repo
- Related issues and patterns
- Environment and version details

**Next Step:** After gathering context, use `analyze-root-cause.md` or `create-fix-pr.md`

---

## Prerequisites

- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] Access to `streamlit/streamlit` repository
- [ ] Access to `st-issues` repository (if checking reproduction notes)

---

## Input

**Provide the issue number you want to gather context for:**

```
Example: 12345
```

If you don't have an issue number, you can search:

```bash
# Search for issues by keyword
gh issue list --repo streamlit/streamlit --search "keyword" --limit 20
```

---

## Step 1: Fetch GitHub Issue Details

**Reference:** See `agent-knowledge/processes/issue-management/github-cli.local.md` for complete GitHub CLI reference.

### Get Full Issue Details

```bash
# Fetch complete issue with all comments
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json number,title,body,comments,labels,author,url,createdAt,updatedAt

# For human-readable format
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --comments

# Open in browser to review
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --web
```

### Extract Key Information

From the issue, identify and document:

**Problem Description:**

- What is broken or unexpected?
- What should happen vs what actually happens?

**Steps to Reproduce:**

- Are they complete and clear?
- Can you follow them?

**Environment Details:**

- Streamlit version
- Python version
- Operating system
- Browser (if relevant)
- Deployment platform (if relevant)

**Error Messages:**

- Stack traces
- Console errors
- Warning messages

**Visual Evidence:**

- Screenshots
- Videos
- Code examples

---

## Step 2: Search Rotation Journals

Check if this issue has been triaged or discussed in rotation journals.

### Search for Issue Mentions

```bash
# Search all rotation journals for the issue number
grep -r "gh-<ISSUE_NUMBER>" agent-knowledge/local/journals/active/rotations/

# Search by issue title keywords
grep -ri "keyword" agent-knowledge/local/journals/active/rotations/*.md

# Show context around matches
grep -r -C 5 "gh-<ISSUE_NUMBER>" agent-knowledge/local/journals/active/rotations/
```

### Look For

- **Feature Labels Added:** Components identified as affected
- **Bug Prioritization:** Impact assessment and rationale
- **Issue Reproduction:** Reproduction outcomes and observations
- **Observations & Notes:** Patterns or insights related to the issue
- **Workarounds:** Solutions users have found

### Document Findings

Note any rotation journal entries that mention this issue:

- Journal filename and date
- What was discovered
- Components identified
- Priority/impact assessment

---

## Step 3: Check Reproduction Notes (st-issues)

If the issue has been reproduced, there may be technical notes.

### Check for Reproduction Files

```bash
# Navigate to st-issues repo
cd ~/dev/st-issues  # or wherever you have st-issues cloned

# Check if reproduction exists for this issue
ls -la issues/gh-<ISSUE_NUMBER>/

# If exists, review the files
cat issues/gh-<ISSUE_NUMBER>/app.py        # Reproduction app
cat issues/gh-<ISSUE_NUMBER>/NOTES.md      # Technical analysis (if exists)
```

### What to Extract

**From NOTES.md (if exists):**

- Technical analysis and code review findings
- Root cause speculation from reproduction work
- Testing protocols used
- Behavior analysis (expected vs actual)
- Edge cases discovered
- Potential contributing factors

**From app.py:**

- Exact conditions that trigger the bug
- Minimal reproduction case
- Code patterns involved

### Document Findings

- Link to reproduction app
- Summary of technical findings
- Key observations from reproduction work

---

## Step 4: Find Related Issues

Search for similar issues or patterns.

### Search Strategies

```bash
# Search rotation journals for similar component mentions
grep -r "feature:st.dataframe" agent-knowledge/local/journals/active/rotations/

# Look for similar symptoms
grep -ri "rendering\|performance\|crash" agent-knowledge/local/journals/active/rotations/

# Search GitHub for related issues
gh issue list --repo streamlit/streamlit --search "is:issue dataframe rendering" --limit 20

# Search for issues with same labels
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json labels --jq '.labels[].name' | while read label; do
  gh issue list --repo streamlit/streamlit --label "$label" --limit 5
done
```

### Document Related Issues

- Issue numbers and titles of related bugs
- Common patterns or symptoms
- Whether they're fixed, open, or closed
- Links between issues

---

## Step 5: Check Comments for Additional Context

**Critical:** Don't skip comments! They often contain vital information.

### What to Look For in Comments

- **Additional reproduction steps:** Users providing more details
- **Workarounds:** Solutions that users have found
- **Environment variations:** Different OS/browser/version combinations
- **Related components:** Other features affected
- **Team responses:** Maintainer questions or insights
- **Duplicate mentions:** Links to similar issues
- **User impact:** How many users are affected

### Extract Key Points

Document important findings from comments:

- New information not in original issue
- Confirmed behaviors across different environments
- Workarounds that work
- Questions from team that need answering

---

## Step 6: Compile Context Document

Save all gathered information to a structured document.

---

## Step 7: Save Context Document

**Context Document Location:**

```bash
# Create notes directory if it doesn't exist
mkdir -p agent-knowledge/local/notes/bug-analysis

# Save context document
agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md
```

### Context Document Template

```markdown
# Bug Context: Issue #<ISSUE_NUMBER>

**Issue Title:** <Title>
**Context Gathered:** <YYYY-MM-DD>
**Issue URL:** https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>

---

## Summary

[1-2 paragraph summary of the bug and key findings]

---

## GitHub Issue Details

### Problem Description

[What is broken or unexpected]

### Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. [etc.]

### Expected Behavior

[What should happen]

### Actual Behavior

[What actually happens]

### Environment

- **Streamlit Version:** X.X.X
- **Python Version:** X.X.X
- **Operating System:** [OS details]
- **Browser:** [Browser if relevant]
- **Deployment:** [Platform if relevant]

### Error Messages
```

[Stack traces or error output]

````

### Code Example

```python
[User's reproduction code]
````

---

## Rotation Journal Mentions

**Found in:**

- `YYYY-MM-DD-rotation.md` - [Summary of what was found]

**Key Findings:**

- [Finding 1]
- [Finding 2]

**Components Identified:**

- `feature:st.xxx`
- `area:xxx`

**Priority Assessment:**

- [Priority level and rationale from triage]

---

## Reproduction Notes

**Reproduction App:** `st-issues/issues/gh-<ISSUE_NUMBER>/app.py`
**Deployed at:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>

**Technical Findings:**

- [Finding from NOTES.md or reproduction work]

**Observed Behavior:**

- [What was observed during reproduction]

**Edge Cases:**

- [Edge cases discovered]

---

## Related Issues

1. **#XXXXX** - [Title] - [Status] - [Relationship to this issue]
2. **#XXXXX** - [Title] - [Status] - [Relationship to this issue]

**Common Patterns:**

- [Pattern 1]
- [Pattern 2]

---

## Comments Analysis

**Key Points from Discussion:**

- [Important point 1]
- [Important point 2]

**Workarounds Found:**

- [Workaround 1]
- [Workaround 2]

**Additional Context:**

- [Context point 1]
- [Context point 2]

---

## Context Sources Checked

- [x] GitHub Issue and Comments
- [x] Rotation Journals: [list journals checked]
- [x] Reproduction Notes: [link if applicable, or "None found"]
- [x] Related Issues: [count found]

---

## Ready for Analysis

This context document is ready for:

- Root cause analysis (`analyze-root-cause.md`)
- Fix implementation (`create-fix-pr.md`)
- Team discussion or handoff

---

**Next Steps:**

1. Review this context for completeness
2. Proceed to `analyze-root-cause.md` for deep analysis
3. Or proceed to `create-fix-pr.md` if root cause is already clear

````

### Quick Save Command

Use this template to create the context document:

```bash
# Save the context document
cat > agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md << 'EOF'
[Your compiled context following the template above]
EOF
````

---

## Success Criteria

Before moving to analysis, ensure you have:

- ✅ Complete issue description and all comments reviewed
- ✅ Rotation journals searched
- ✅ Reproduction notes checked (if applicable)
- ✅ Related issues identified
- ✅ Environment details documented
- ✅ Context document saved to `agent-knowledge/local/notes/bug-analysis/`

---

## Next Commands

**After gathering context:**

- **`analyze-root-cause.md`** - Perform deep root cause analysis
- **`create-fix-pr.md`** - Skip analysis and go straight to fix (if cause is clear)
- **Share context** - Send document to team for discussion
- **Wait for more info** - If context is incomplete

**If using start-bug-fix.md workflow:** Return to that command for journal update instructions and next steps.

---

## Example Workflow

```bash
# 1. Gather context
# Use this command → gather-bug-context.md

# 2. Verify saved
ls agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md

# 3. Review context
cat agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md

# 4. Proceed to analysis
# Use → analyze-root-cause.md
```

---

**Always gather comprehensive context before attempting root cause analysis or fixes. Thorough context gathering saves time and leads to better solutions.**
