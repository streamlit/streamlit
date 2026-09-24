# Report Cannot Reproduce

## Mission

Inform the issue reporter that you attempted to reproduce the issue but could not observe the reported behavior in the current version.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Reference:** For comment guidelines and approval workflow, see `github-comment-guidelines.md`

## Prerequisites

- Issue analyzed via `analyze-issue.md`
- Reproduction attempted (via `create-playwright-test.md` or `create-repro-app.md`)
- Could not reproduce the reported behavior
- Reproduction attempt documented in NOTES.md

**Possible reasons for cannot reproduce:**

- Issue already fixed in current version
- Environment-specific (OS, browser, Python version)
- Missing critical information
- Issue description inaccurate or unclear

## Workflow

### Step 1: Draft Cannot-Reproduce Comment

Create a helpful, empathetic response:

**Comment Template:**

```markdown
Thank you for reporting this issue. I attempted to reproduce it but could not observe the reported behavior in the current version.

**Reproduction Attempt:**

I created a test app based on your description:

<Brief description of what you tried - 2-3 sentences>

**Result:**

The behavior appears to be working as expected in Streamlit <version>.

**Possible Reasons:**

- ✅ The issue may have been fixed in a recent version
- 🔧 The issue might be environment-specific
- 📋 Additional information may be needed to reproduce

**Could you please:**

1. Update to the latest Streamlit version: `pip install --upgrade streamlit`
2. Try to reproduce again
3. Let us know if the issue persists

If you can still reproduce it, please provide:

- Exact Streamlit version where it occurs
- Complete minimal code example
- Any error messages

Thank you!
```

**Important:** See `github-comment-guidelines.md` for cannot-reproduce best practices.

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
# Remove needs-triage, add awaiting-user-response
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit \
  --remove-label "status:needs-triage" \
  --add-label "status:awaiting-user-response"
```

## Completion Checklist

- [ ] Cannot-reproduce comment drafted
- [ ] Reproduction attempt documented in NOTES.md
- [ ] Team member approved comment
- [ ] Comment posted to GitHub
- [ ] Label updated to `status:awaiting-user-response`

## Output Summary

```markdown
## Cannot Reproduce Summary for Issue #<ISSUE_NUMBER>

**Comment Posted:** ✅
**Labels Updated:** ✅ (status:awaiting-user-response)
**Tested Version:** Streamlit <version>
**Reproduction Attempt:** Documented in NOTES.md

**Next Steps:**

- Monitor for reporter response
- Close if no response or resolved
```

## Tips for Cannot-Reproduce Comments

1. **Be empathetic:** Don't imply user error - many factors can cause this
2. **Document your attempt:** Show you took it seriously
3. **Suggest concrete steps:** Version upgrade, provide more details
4. **Leave door open:** Invite them to provide more information
5. **Offer value:** Even if you can't reproduce, try to help

## Common Scenarios

### Issue Already Fixed

```markdown
Good news - this appears to have been fixed in version X.Y.Z!

Could you update to the latest version and confirm it's resolved?
```

### Environment-Specific

```markdown
This might be environment-specific. Could you provide:

- Operating system and version
- Browser and version (if applicable)
- Python version

This will help us understand the conditions needed to reproduce.
```

### Missing Critical Details

```markdown
I'd like to help, but I need a bit more information:

- [Specific detail]
- [Specific detail]

Once you provide these, I'll create a reproduction and investigate.
```

## Notes

- "Cannot reproduce" doesn't mean "not a bug" - might be environment-specific
- Always be helpful and empathetic
- Document your reproduction attempt thoroughly in NOTES.md
- If reporter provides more info, restart from `analyze-issue.md`

**Next:** Monitor issue for reporter response
