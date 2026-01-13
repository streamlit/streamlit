# GitHub Comment Guidelines

## Purpose

Shared reference guide for posting comments to GitHub issues during the triage workflow. This guide covers best practices, approval requirements, GitHub CLI commands, and label conventions.

## Approval Workflow for AI Agents

**⚠️ CRITICAL:** Before posting ANY comment to GitHub, you MUST:

1. **Draft** the complete comment text
2. **Present** draft to a team member for review
3. **Wait** for explicit "approved" confirmation
4. **Only after approval**, execute the `gh issue comment` command

This ensures all public communications are reviewed and appropriate before posting.

## Best Practices

### For AI Agents

**Never post without approval:**

- All comments must be drafted first
- Team member reviews for tone, accuracy, completeness
- Wait for explicit "approved" confirmation
- Only then execute gh commands

### For All Comments

1. **Be friendly and appreciative:** Thank reporters for their contributions
2. **Be clear and concise:** Get to the point quickly
3. **Provide value:** Workarounds, reproduction links, or next steps
4. **User-focused language:** Avoid technical jargon when possible
5. **Include links:** Make it easy to access reproductions
6. **Set expectations:** Let them know what happens next
7. **Draft first, post after approval:** Never post without team review

### Keep Comments Concise

**⚠️ CRITICAL:** Users experience information overload with lengthy comments. Keep comments brief and focused.

**Trust users to view details themselves:**

- ❌ **Don't summarize linked issues** - Users can click to read them
- ❌ **Don't describe app contents** - Users can open the app to see
- ❌ **Don't repeat label information** - Users can see labels on the issue
- ❌ **Don't explain fix implementation** - Users don't need internal technical details
- ✅ **Do provide workarounds** - This is actionable information users need immediately

**Examples of unnecessary information:**

```markdown
❌ AVOID:
Status: Confirmed (status:confirmed, priority:P3)
Same symptoms: Images/plots display very small initially...
Root cause: Width calculation issue in v1.50.0...

✅ BETTER:
This is a duplicate of #12678. See that issue for the current workaround.
```

```markdown
❌ AVOID:
🔍 Diagnostic App
We've created a diagnostic app for you to test:
🔗 Test it here: https://issues.streamlit.app/?issue=gh-12792

The app includes:

- 4 different test cases (single-line, multiline, SQL, longer code)
- Step-by-step diagnostic instructions
- Browser console error checking guide
- Manual copy-paste verification test

✅ BETTER:
We've created a diagnostic app to help investigate:
🔗 https://issues.streamlit.app/?issue=gh-12792
```

**Rule of thumb:** If the information is visible elsewhere (labels, linked issues, apps) or describes internal implementation, omit it.

### For Confirmation Comments

✅ **Do:**

- Include working workaround if available (most valuable for users)
- Keep it brief - focus only on actionable information
- Keep technical details in NOTES.md
- Use the Streamlit badge for visual appeal
- Provide direct link as backup
- Thank the reporter

❌ **Don't:**

- Speculate on fix timeline
- Include code review findings (save for NOTES.md)
- Use Streamlit-specific jargon (e.g., "widget identity", "rerun scope", "fragment isolation")
- Provide lengthy root cause explanations (one sentence maximum if needed for workaround)
- Describe what's in the diagnostic app (users can view it)
- Discuss internal fix approaches or implementation plans
- Post without team approval

### For Information Requests

✅ **Do:**

- Be specific about what's needed
- Provide templates/examples
- Explain why information is needed
- Be patient and helpful

❌ **Don't:**

- Ask for information already provided
- Make reporters feel bad
- Be vague about requirements

### For Team Clarification Requests

✅ **Do:**

- Present both sides objectively
- Tag relevant team members
- Include reproduction for context
- Document ambiguity clearly

❌ **Don't:**

- Make unilateral decisions
- Dismiss user concerns
- Lean toward one interpretation without evidence

### For Cannot-Reproduce Responses

✅ **Do:**

- Document your reproduction attempt
- Suggest concrete next steps
- Offer to help further
- Be empathetic

❌ **Don't:**

- Imply user error
- Close issue immediately
- Give up too quickly

## GitHub CLI Commands

**Essential commands:**

```bash
# Get issue author for tagging
gh issue view <NUMBER> --repo streamlit/streamlit --json author --jq '.author.login'

# Post comment to issue
gh issue comment <NUMBER> --repo streamlit/streamlit --body "Comment text"

# Update labels - remove one, add one
gh issue edit <NUMBER> --repo streamlit/streamlit \
  --remove-label "status:needs-triage" \
  --add-label "status:confirmed"

# Add label (without removing)
gh issue edit <NUMBER> --repo streamlit/streamlit --add-label "label-name"

# Remove label
gh issue edit <NUMBER> --repo streamlit/streamlit --remove-label "label-name"

# View current labels
gh issue view <NUMBER> --repo streamlit/streamlit --json labels --jq '.labels[].name'
```

## Label Reference

### Status Labels

- `status:needs-triage` → Initial state for new issues
- `status:confirmed` → Bug reproduced and confirmed
- `status:awaiting-user-response` → Waiting for issue reporter
- `status:awaiting-team-response` → Waiting for team decision

### When to Use Which

**Use `status:confirmed`:**

- Bug reproduced with app
- Behavior clearly wrong
- Team verified deployed app

**Use `status:awaiting-user-response`:**

- Need more information from reporter
- Cannot reproduce, need confirmation
- Waiting for reporter to test fix/workaround

**Use `status:awaiting-team-response`:**

- Behavior might be expected (not a bug)
- Need team decision on approach
- Ambiguous case requiring expertise

## Comment Templates

### Streamlit Badge

Use this for reproduction app links:

```markdown
[![Open in Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>)

**Direct link:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>
```

### Tagging Issue Author

Always thank and tag the reporter:

```markdown
Thank you for reporting this issue, @<ISSUE_AUTHOR>! 🙏
```

Get author with:

```bash
ISSUE_AUTHOR=$(gh issue view <NUMBER> --repo streamlit/streamlit --json author --jq '.author.login')
```

### Workaround Format

If a workaround exists:

````markdown
### Workaround

<Brief explanation of the workaround>

```python
# Workaround code example
<code>
```

<Additional explanation if needed>
````

If no workaround, omit this section entirely.

## Common Pitfalls

❌ **Don't:**

- Post without approval
- Use technical jargon ("widget identity", "rerun scope", "fragment isolation")
- Make promises about fix timeline
- Include code review details publicly
- Provide lengthy root cause explanations
- Describe app contents (users can view apps themselves)
- Summarize linked issues or duplicate labels (users can see these)
- Explain internal fix implementation details
- Be dismissive of reporter's experience

✅ **Do:**

- Wait for approval
- Use simple language
- Focus on workarounds and next steps
- Keep technical analysis in NOTES.md
- Be empathetic and helpful
- Acknowledge the reporter's frustration
- Trust users to click links and view apps/issues themselves
- Keep comments brief - aim for 2-4 short paragraphs maximum
