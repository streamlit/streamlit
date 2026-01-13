# Confirm Bug

## Mission

Post a confirmation comment to GitHub issue with link to reproduction app after the bug has been successfully reproduced and verified.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Reference:** For comment guidelines and approval workflow, see `github-comment-guidelines.md`

## Prerequisites

✅ **All of these must be complete:**

- Reproduction app created (via `create-repro-app.md`)
- App pushed to st-issues repository
- App deployed to issues.streamlit.app
- **Team member has manually verified the deployed app works correctly**
- Bug is confirmed (not expected behavior)

**If any prerequisite not met:**

- App not created → Use `create-repro-app.md` first
- Cannot reproduce → Use `report-cannot-reproduce.md`
- Need more info → Use `request-more-info.md`
- Unclear if bug → Use `request-team-decision.md`

## Workflow

### Step 1: Prepare Confirmation Comment

Get the issue author's username:

```bash
ISSUE_AUTHOR=$(gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json author --jq '.author.login')
```

**Comment Template:**

````markdown
Thank you for reporting this issue, @<ISSUE_AUTHOR>! 🙏

### 🔬 Reproduction App Available

I've created a reproduction app for this issue:

[![Open in Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>)

**Direct link:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>

The issue has been confirmed.

### Workaround

<Include workaround here if one exists, otherwise remove this section>

```python
# Workaround code
<code>
```

<Explanation of workaround>
````

**Important:** See `github-comment-guidelines.md` for comment best practices.

### Step 2: Get Team Approval

**⚠️ CRITICAL:** All GitHub comments require team approval before posting.

Present the draft comment to a team member for review:

- Show the complete comment text
- Wait for explicit "approved" confirmation
- Only proceed after approval

### Step 3: Post Comment (After Approval)

Once approved:

```bash
gh issue comment <ISSUE_NUMBER> --repo streamlit/streamlit --body "<Your approved comment>"
```

### Step 4: Update Labels

```bash
# Remove needs-triage, add confirmed
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit \
  --remove-label "status:needs-triage" \
  --add-label "status:confirmed"
```

## Completion Checklist

- [ ] Confirmation comment drafted
- [ ] Team member approved comment
- [ ] Comment posted to GitHub
- [ ] Label updated to `status:confirmed`

## Output Summary

```markdown
## Bug Confirmation Summary for Issue #<ISSUE_NUMBER>

**Comment Posted:** ✅
**Labels Updated:** ✅ (status:confirmed)
**Workaround Included:** [Yes/No]

**App URL:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>

**Next Steps:**

- Use `prioritize-bug.md` to assign priority
- Use `add-feature-labels.md` to add feature/area labels
```

## Notes

- Only confirm bugs that are truly incorrect behavior (see `expected-vs-bug-assessment.md`)
- Workarounds are the most valuable information for users
- Keep comment user-friendly; technical details go in NOTES.md

**Next:** `prioritize-bug.md` and `add-feature-labels.md`
