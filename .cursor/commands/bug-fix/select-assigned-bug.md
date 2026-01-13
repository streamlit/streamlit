# Select Assigned Bug

## Overview

Fetch bugs assigned to you from GitHub and select one to work on using the bug fix pipeline.

## Purpose

This command helps you:

- See all bugs currently assigned to you
- View key details (priority, labels, age, etc.)
- Choose which bug to work on next
- Launch the bug fix pipeline for the selected bug

**Next Step:** After selecting a bug, proceed to `start-bug-fix.md` with the issue number

---

## Prerequisites

- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] Access to `streamlit/streamlit` repository
- [ ] GitHub username configured

**Verify access:**

```bash
# Check authentication
gh auth status

# Verify you can access the repo
gh repo view streamlit/streamlit
```

---

## Step 1: Get Your GitHub Username

**Option A: Get from gh CLI**

```bash
# Get your authenticated username
gh api user --jq '.login'
```

**Option B: Provide manually**

```
Example: your-github-username
```

Save this for the next step:

```bash
GITHUB_USER="your-username"
```

---

## Step 2: Fetch Assigned Bugs

### List All Assigned Bugs

```bash
# Get all open bugs assigned to you
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --state open \
  --limit 50 \
  --json number,title,labels,createdAt,updatedAt,url

# For human-readable format
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --state open
```

### Filter by Priority (Optional)

If you want to focus on high-priority bugs:

```bash
# High priority bugs (P0, P1)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --search "label:priority:P0 OR label:priority:P1" \
  --state open

# Medium priority (P2)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "priority:P2" \
  --state open

# All bugs without priority assigned
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --state open \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(select(.name | startswith("priority:"))) | length == 0)'
```

### Filter by Status (Optional)

Focus on bugs at specific stages:

```bash
# Confirmed bugs ready to fix
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "status:confirmed" \
  --state open

# Bugs needing triage/investigation
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "status:needs-triage" \
  --state open

# Bugs awaiting user response (maybe follow up?)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "status:awaiting-user-response" \
  --state open
```

---

## Step 3: Review Bug Details

For each bug that interests you, get more details:

### Quick View

```bash
# View bug in terminal
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit

# View with comments
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --comments

# Open in browser for full context
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --web
```

### Get Structured Data

```bash
# Get complete details as JSON
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit \
  --json number,title,body,comments,labels,createdAt,updatedAt,url

# Extract specific information
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json labels --jq '.labels[].name'
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json createdAt --jq '.createdAt'
```

---

## Step 4: Prioritize Your Selection

Use these criteria to choose which bug to work on:

### Priority Matrix

| Factor          | High Priority         | Medium Priority       | Low Priority                    |
| --------------- | --------------------- | --------------------- | ------------------------------- |
| **Severity**    | P0, P1 labels         | P2, P3 labels         | P4 or unlabeled                 |
| **User Impact** | Many upvotes/comments | Some engagement       | Low engagement                  |
| **Status**      | `status:confirmed`    | `status:needs-triage` | `status:awaiting-user-response` |
| **Age**         | > 6 months old        | 1-6 months old        | < 1 month old                   |
| **Complexity**  | Clear root cause      | Needs investigation   | Very complex/unclear            |
| **Weekly Goal** | Matches your goal     | Related to goal       | Unrelated                       |

### Recommended Selection Strategy

**Option 1: Impact-Driven (Common)**

- Choose highest priority (P0 > P1 > P2)
- Consider user impact (upvotes/comments)
- Prefer confirmed bugs (less investigation needed)

**Option 2: Learning-Driven**

- Choose bugs in areas you want to learn
- Pick moderate complexity (not too easy, not impossible)
- Consider interesting technical challenges

**Option 3: Goal-Driven**

- Choose bugs that align with weekly goals
- Consider team priorities or sprint commitments
- Pick bugs that advance current work

**Option 4: Quick Wins**

- Choose bugs with clear reproduction
- Pick bugs with known root cause
- Focus on fast fixes for momentum

---

## Step 5: Check Existing Work

Before committing to a bug, check if analysis already exists:

```bash
# Check for context document
ls agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md 2>/dev/null

# Check for root cause analysis
ls agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md 2>/dev/null

# Search rotation journals for previous work
grep -r "gh-<ISSUE_NUMBER>" agent-knowledge/local/journals/active/rotations/

# Search weekly journals
grep -r "gh-<ISSUE_NUMBER>" agent-knowledge/local/journals/active/weekly/
```

**If existing work found:**

- Review the documents
- Check completion status
- Decide whether to continue or pick different bug

---

## Step 6: Make Your Selection

Once you've reviewed the options, note your selection:

```
Selected Bug: #<ISSUE_NUMBER>
Title: [Brief title]
Priority: [P0/P1/P2/P3/P4]
Why: [Reason for selecting this bug]
```

**Add to your weekly journal's goals (optional but recommended):**

```markdown
## Goals & Progress

**Weekly Goals:**

1. 🚧 Fix gh-<ISSUE_NUMBER> - [Brief description]
   - Context gathering
   - Root cause analysis
   - Implementation
```

---

## Step 7: Launch Bug Fix Pipeline

**Now proceed to `start-bug-fix.md` with your selected issue number.**

The bug fix pipeline will guide you through:

1. Gathering comprehensive context
2. Analyzing root cause
3. Implementing the fix
4. Creating PR

---

## Example Workflow

### Example 1: Selecting from Multiple Assigned Bugs

```bash
# 1. List your assigned bugs
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --state open

# Output shows:
# 12345  st.dataframe crashes with large datasets     priority:P1, feature:st.dataframe
# 12678  Button callback fires twice in some cases    priority:P2, feature:st.button
# 12890  Sidebar width not respected on mobile        priority:P3, area:layout

# 2. Review details of interesting bugs
gh issue view 12345 --repo streamlit/streamlit --comments
gh issue view 12678 --repo streamlit/streamlit --comments

# 3. Check for existing work
ls agent-knowledge/local/notes/bug-analysis/gh-12345-* 2>/dev/null
grep -r "gh-12345" agent-knowledge/local/journals/active/

# 4. Make decision
# Choose gh-12345 because:
# - Highest priority (P1)
# - Clear reproduction steps
# - High user impact
# - Aligns with dataframe work goal

# 5. Add to weekly goals
# Edit weekly journal:
# 1. 🚧 Fix gh-12345 (dataframe crash) - High priority P1 bug

# 6. Launch pipeline
# Use: start-bug-fix.md with issue 12345
```

---

### Example 2: Finding Bugs When None Assigned

If you don't have bugs assigned, you can find good candidates:

```bash
# Find high-priority unassigned bugs
gh issue list --repo streamlit/streamlit \
  --label "type:bug" \
  --label "priority:P1" \
  --no-assignee \
  --state open \
  --limit 20

# Find confirmed bugs without assignee
gh issue list --repo streamlit/streamlit \
  --label "type:bug" \
  --label "status:confirmed" \
  --no-assignee \
  --state open \
  --limit 20

# Find bugs in your area of expertise
gh issue list --repo streamlit/streamlit \
  --label "type:bug" \
  --label "feature:st.dataframe" \
  --no-assignee \
  --state open
```

**Then:**

1. Self-assign the bug: `gh issue edit <NUMBER> --add-assignee "@me" --repo streamlit/streamlit`
2. Proceed with selection process above

---

## Tips for Selection

### Do's ✅

1. **Review comments** - Often contain critical context
2. **Check priority** - Align with team priorities
3. **Verify reproduction** - Ensure bug is reproducible
4. **Check for duplicates** - May already be fixed in other issues
5. **Consider complexity** - Match your available time
6. **Align with goals** - Support your weekly objectives
7. **Check existing work** - Avoid duplicating effort

### Don'ts ❌

1. **Don't rush** - Take time to choose the right bug
2. **Don't ignore priority** - P0/P1 bugs need attention
3. **Don't skip comments** - Critical info often there
4. **Don't overcommit** - Start with one bug at a time
5. **Don't guess** - If unclear, read the full issue
6. **Don't forget goals** - Consider weekly objectives

---

## Decision Matrix

Use this to help choose between multiple bugs:

```
Bug #1 (P1, confirmed, 10 comments, 3 months old):
  Score: Priority (5) + Impact (4) + Clarity (5) + Age (3) = 17/20

Bug #2 (P2, needs-triage, 2 comments, 1 week old):
  Score: Priority (3) + Impact (2) + Clarity (2) + Age (1) = 8/20

Bug #3 (P1, confirmed, 3 comments, 1 year old):
  Score: Priority (5) + Impact (3) + Clarity (4) + Age (5) = 17/20

Choose: Bug #1 or #3 (tied) - Review both, pick most interesting
```

**Scoring Guide:**

- **Priority:** P0=5, P1=5, P2=3, P3=2, P4=1, None=1
- **Impact:** Many users=5, Several=4, Some=3, Few=2, One=1
- **Clarity:** Clear repro=5, Needs work=3, Very unclear=1
- **Age:** >1yr=5, 6-12mo=4, 3-6mo=3, 1-3mo=2, <1mo=1

---

## Output

This command produces a **decision** and **context** for the pipeline:

**Decision Made:**

```
Selected Bug: gh-<ISSUE_NUMBER>
Title: [Title]
Priority: [Level]
Reason: [Why this bug]
```

**Next Action:**

```
Proceed to: start-bug-fix.md
With issue: gh-<ISSUE_NUMBER>
```

---

## Integration with Pipeline

After selecting a bug:

### Option A: Full Pipeline (Recommended)

```
1. select-assigned-bug.md          [YOU ARE HERE]
   ↓ (choose issue #12345)

2. start-bug-fix.md                [GO HERE NEXT]
   ↓ (orchestrates full workflow)
   → gather-bug-context.md
   → analyze-root-cause.md
   → create-fix-pr.md
```

### Option B: Direct to Command

If you want to skip the orchestrator:

```
1. select-assigned-bug.md
   ↓ (choose issue #12345)

2. gather-bug-context.md           [Jump straight to gathering]
   ↓
3. [Manual journal updates + next steps]
```

---

## Quick Reference

### Common Commands

```bash
# List all your assigned bugs
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --state open

# List with priority filter
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --label "priority:P1" --state open

# View bug details
gh issue view <NUMBER> --repo streamlit/streamlit --comments

# Check for existing analysis
ls agent-knowledge/local/notes/bug-analysis/gh-<NUMBER>-* 2>/dev/null

# Open in browser
gh issue view <NUMBER> --repo streamlit/streamlit --web
```

### Selection Checklist

Before finalizing your selection:

- [ ] Read full issue description
- [ ] Read all comments
- [ ] Check priority level
- [ ] Verify reproduction steps exist
- [ ] Check for existing analysis
- [ ] Consider time required
- [ ] Align with weekly goals
- [ ] Confirm assignment (assign to yourself if needed)

---

## Example Output

### Example Session

```bash
# List assigned bugs
$ gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --state open

# Output:
Showing 3 of 3 open issues in streamlit/streamlit that match your search

#12345  st.dataframe crashes with large datasets          priority:P1, feature:st.dataframe
        about 3 months ago

#12678  Button callback fires twice on fast clicks        priority:P2, feature:st.button
        about 1 month ago

#12890  Sidebar width not respected on mobile devices     priority:P3, area:layout
        about 1 week ago

# Review details
$ gh issue view 12345 --repo streamlit/streamlit --comments

# Decision made:
Selected: gh-12345
Reason: P1 priority, clear impact, aligns with dataframe expertise

# Add to weekly goals
# [Edit weekly journal to add goal: Fix gh-12345]

# Launch pipeline
$ # Next: start-bug-fix.md with issue 12345
```

---

## Advanced Filtering

### By Component/Feature

```bash
# Bugs in specific component
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "feature:st.dataframe" \
  --state open

# Bugs in specific area
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "area:layout" \
  --state open
```

### By Status

```bash
# Only confirmed bugs (ready to fix)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "status:confirmed" \
  --state open

# Bugs needing reproduction
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --label "status:needs-triage" \
  --state open
```

### By Age

```bash
# Older bugs (>6 months)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --search "created:<$(date -v-6m +%Y-%m-%d)" \
  --state open

# Recent bugs (<1 month)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --search "created:>$(date -v-1m +%Y-%m-%d)" \
  --state open
```

### Sorted by Activity

```bash
# Recently updated (active discussions)
gh issue list --repo streamlit/streamlit \
  --assignee "@me" \
  --label "type:bug" \
  --state open \
  --json number,title,updatedAt \
  --jq 'sort_by(.updatedAt) | reverse | .[] | "#\(.number) \(.title) (updated: \(.updatedAt))"'
```

---

## Selection Strategies

### Strategy 1: Highest Priority First

```bash
# Get all assigned bugs
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --state open

# Filter to P0/P1 only
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --search "label:priority:P0 OR label:priority:P1" --state open

# Review and pick one
# Prioritize: P0 > P1 > P2 > P3 > P4
```

### Strategy 2: Quick Wins

```bash
# Find confirmed bugs (less investigation)
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --label "status:confirmed" --state open

# Check for reproduction apps
# Look for issues with reproduction in st-issues repo
# Pick one with clear repro → faster to fix
```

### Strategy 3: Learning Focus

```bash
# Find bugs in components you want to learn
gh issue list --repo streamlit/streamlit --assignee "@me" --label "type:bug" --label "feature:st.NEW_COMPONENT" --state open

# Pick bugs that teach you something new
# Moderate complexity preferred
```

### Strategy 4: Weekly Goal Alignment

```bash
# Review your weekly goals first
cat agent-knowledge/local/journals/active/weekly/*-week.md | grep "Goals & Progress" -A 10

# Find bugs that support those goals
# Example: If goal is "Improve dataframe performance"
#   → Pick dataframe-related bugs
```

---

## Dealing with No Assigned Bugs

If you don't have bugs assigned:

### Find and Self-Assign

```bash
# Find unassigned P1 bugs
gh issue list --repo streamlit/streamlit \
  --label "type:bug" \
  --label "priority:P1" \
  --no-assignee \
  --state open \
  --limit 10

# Pick one and assign to yourself
gh issue edit <NUMBER> --add-assignee "@me" --repo streamlit/streamlit

# Proceed with selection
```

### Ask Team for Assignment

```
# Post in Slack or team channel:
"Looking for bugs to work on this week. Any P1/P2 bugs
that need attention? My areas: [list your expertise]"
```

---

## Success Criteria

You've successfully completed bug selection when:

- ✅ Reviewed all assigned bugs (or filtered subset)
- ✅ Read full details of candidate bugs
- ✅ Checked for existing work/analysis
- ✅ Made informed selection decision
- ✅ Bug is assigned to you
- ✅ Ready to launch bug fix pipeline

---

## Next Commands

**After selecting a bug:**

- **Recommended:** `start-bug-fix.md` - Full guided pipeline with journal tracking
- **Alternative:** `gather-bug-context.md` - Jump straight to gathering (no orchestration)

**If no bugs to work on:**

- Review unassigned bugs and self-assign
- Check with team for priorities
- Work on features or other tasks

---

## Tips

**Before Selecting:**

- Check your calendar - do you have time for deep work?
- Review your weekly goals - does this align?
- Consider your energy level - match complexity to capacity
- Check team priorities - any urgent bugs?

**When Deciding:**

- Don't overthink - pick something reasonable
- Start with one bug - don't queue multiple
- Trust the pipeline - it will guide you through
- Remember you can change course if needed

**After Selecting:**

- Update weekly goals if not already included
- Commit to seeing it through
- Use the pipeline - don't skip steps
- Document as you go

---

**Ready to pick a bug? Run the commands above and make your selection!**

**Once you've chosen:** → `start-bug-fix.md` with your issue number
