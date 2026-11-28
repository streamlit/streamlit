# Request Team Decision

## Mission

Request team decision when behavior might be expected (not a bug) and requires expert judgment to determine if it should be changed.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Reference:**

- Comment guidelines: `github-comment-guidelines.md`
- Assessment framework: `expected-vs-bug-assessment.md`

## Prerequisites

- Issue analyzed via `analyze-issue.md`
- Reproduction created (via `create-repro-app.md`)
- Assessed via `expected-vs-bug-assessment.md` as "Needs Team Decision"
- Both arguments (expected vs bug) documented in NOTES.md

**When to use:**

- Behavior matches docs but violates user expectations
- Undocumented behavior (unclear if intentional)
- Edge case that seems wrong but might be necessary
- API design question about parameter combinations

## Workflow

### Step 1: Draft Clarification Request

Create a balanced request presenting both perspectives:

**Comment Template:**

```markdown
Thank you for reporting this. I've created a reproduction to investigate this behavior:

[![Open in Streamlit](https://static.streamlit.io/badges/streamlit_badge_black_white.svg)](https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>)

**Direct link:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>

### Analysis

<Explain what you found - neutral tone>

**Observed Behavior:**
<What actually happens>

**Question for the Team:**

Is this behavior expected or should it be changed?

<Explain why it's ambiguous>

**Arguments for Expected:**

- <Reason 1 with reference to design/implementation>
- <Reason 2>

**Arguments for Bug:**

- <Reason 1 with reference to user expectation/harm>
- <Reason 2>

@<relevant-team-member> Could you provide guidance on whether this is working as intended?
```

**Team Member Reference:**

- Product/behavior: @jrieke
- Documentation: @sfc-gh-dmatthews
- Dataframe/data_editor: @lukasmasuch
- Components: @sfc-gh-bnisco
- Layouts/containers: @sfc-gh-lwilby
- Navigation/multi-page/auth: @kmcgrady
- Top nav bar: @sfc-gh-nbellante
- Theming: @mayagbarnes
- Other areas: Check git history for SME

**Important:** See `github-comment-guidelines.md` for team clarification best practices.

### Step 2: Get Team Approval

**⚠️ CRITICAL:** All GitHub comments require team approval before posting.

Present the draft comment to a team member for review:

- Show the complete comment text
- Wait for explicit "approved" confirmation
- Only proceed after approval

### Step 3: Post Clarification Request (After Approval)

Once approved:

```bash
gh issue comment <ISSUE_NUMBER> --repo streamlit/streamlit --body "<Your approved clarification request>"
```

### Step 4: Update Labels

```bash
# Remove needs-triage, add awaiting-team-response
gh issue edit <ISSUE_NUMBER> --repo streamlit/streamlit \
  --remove-label "status:needs-triage" \
  --add-label "status:awaiting-team-response"
```

## Completion Checklist

- [ ] Clarification request drafted objectively
- [ ] Both perspectives documented (expected vs bug)
- [ ] Team member approved request
- [ ] Comment posted to GitHub
- [ ] Label updated to `status:awaiting-team-response`

## Output Summary

```markdown
## Team Decision Request Summary for Issue #<ISSUE_NUMBER>

**Comment Posted:** ✅
**Labels Updated:** ✅ (status:awaiting-team-response)
**Question:** Is behavior expected or a bug?
**Tagged:** @<team-member>

**App URL:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>

**Next Steps:**

- Await team decision
- If confirmed as bug → use `confirm-bug.md`
- If expected behavior → close or explain to reporter
```

## Team Member Reference

When requesting clarification, tag relevant subject matter experts:

### Product & Behavior Questions

- **@jrieke** - PM, product decisions, behavior expectations, UX questions

### Documentation

- **@sfc-gh-dmatthews** - Documentation lead, doc improvements, API clarity

### Area Subject Matter Experts

**Data Display:**

- **@lukasmasuch** - st.dataframe, st.data_editor, data components

**Custom Components:**

- **@sfc-gh-bnisco** - Component API, component development, component issues

**Layout & Containers:**

- **@sfc-gh-lwilby** - st.container, layouts, width/height parameters, flexbox features

**Navigation & Multi-page:**

- **@kmcgrady** - st.navigation, multi-page apps, page navigation, auth

**Top Nav Bar & Audio Input:**

- **@sfc-gh-nbellante** - Top nav bar component, st.audio_input

**Theming:**

- **@mayagbarnes** - Theme system, colors, styling, CSS

**General Approach:**

1. **First check if area has known SME** (listed above)
2. **If not listed**, check recent commits: `git log --format="%an" lib/streamlit/elements/<component>.py | head -5`
3. **For product/behavior questions** → @jrieke
4. **For documentation questions** → @sfc-gh-dmatthews
5. **For technical implementation** → Use area SME or check git history

## Tips for Effective Clarification Requests

1. **Be objective:** Present both sides fairly without bias
2. **Show your work:** Link to reproduction app
3. **Reference docs/code:** Point to documentation or implementation
4. **Tag appropriately:** Use team member reference above
5. **Make it easy:** Clear question, clear options for response
6. **Acknowledge user:** Validate their confusion/frustration

## Notes

- Don't make the decision yourself - this is why you're asking the team
- The reproduction app should show the ambiguous behavior clearly
- Document your analysis in NOTES.md (see `expected-vs-bug-assessment.md` template)
- After team decides, either confirm as bug or explain expected behavior to reporter

**Next After Team Decides:**

- If confirmed as bug → `confirm-bug.md` (with team's reasoning)
- If expected behavior → Close or explain with documentation references
