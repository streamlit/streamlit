# Evaluate Contributor PRs

## Mission

Systematically review all open pull requests from community contributors, assess their current status, and categorize them by what action is needed next and from whom (reviewer, PM, contributor).

**Type:** Pure command - can run standalone or as part of a review workflow.

**Scope:** This command focuses on community PR management and helping identify where attention is needed to move PRs forward.

## Prerequisites

- GitHub CLI (`gh`) is installed and authenticated
- Python 3.8+ (no additional libraries required)
- Access to `streamlit/streamlit` repository

## Overview

This command will:

1. Fetch all open PRs from community contributors (non-team members)
2. Analyze each PR's current state:
   - CI status (passing, failing, pending)
   - Review status (approved, changes requested, pending)
   - Recent activity and staleness
   - Unresolved review comments
   - Questions from maintainers/PMs
3. Categorize PRs by action needed:
   - **Action: Contributor** - Needs changes, fixes, or responses
   - **Action: Reviewer** - Needs initial review or re-review
   - **Action: PM** - Needs product decision or guidance
   - **Action: Merge** - Approved and ready to merge
   - **Action: Stale** - Needs follow-up or closure

## Workflow

### Step 1: Fetch Contributor PRs

Run the helper script to fetch all open community PRs:

```bash
# Scripts are located in st-issues repository
cd /path/to/st-issues
python app/fetch_contributor_prs_simple.py
```

**Note:** The script uses `gh api` commands which work reliably in subprocess environments. If you encounter issues, make sure you've authenticated with `gh auth login`.

**Location:** The contributor PR scripts are now maintained in the `st-issues` repository at `/app/fetch_contributor_prs.py` and `/app/fetch_contributor_prs_simple.py`.

This will output a summary of all open contributor PRs with their current status.

### Step 2: Analyze Each PR

For each PR, the analysis will include:

#### 2.1: CI Status

- **✅ Passing:** All CI checks passed
- **❌ Failing:** One or more CI checks failed
- **⏳ Pending:** CI checks still running
- **⚠️ No CI:** No CI checks found (unusual)

#### 2.2: Review Status

- **✅ Approved:** At least one approval, no changes requested
- **❌ Changes Requested:** Reviewer requested changes
- **💭 Review Comments:** Has review comments but no formal approval/rejection
- **⏳ Awaiting Review:** No reviews yet
- **🔄 Re-review Needed:** Changes pushed after last review

#### 2.3: Activity Status

- **Last updated:** Days since last commit or comment
- **Staleness:**
  - Fresh: < 7 days
  - Active: 7-14 days
  - Aging: 14-30 days
  - Stale: > 30 days

#### 2.4: Review Thread Analysis

Look for:

- Unresolved conversations
- Questions from maintainers
- Contributor responses to feedback
- Merge conflicts

### Step 3: Categorization

Based on the analysis, categorize each PR:

#### Action: Contributor 🔴

**Reasons:**

- CI checks failing
- Changes requested by reviewer
- Merge conflicts present
- Questions from maintainers unanswered
- Requested changes not yet addressed

**Next Steps:**

- Wait for contributor to address feedback
- Consider gentle reminder if > 14 days stale

---

#### Action: Reviewer 🟡

**Reasons:**

- No review yet (awaiting initial review)
- Contributor has addressed feedback (needs re-review)
- CI passing but no approval yet
- Only minor comments, no formal approval

**Next Steps:**

- Assign reviewer if not assigned
- Ping assigned reviewer if stale
- Conduct review

---

#### Action: PM 🟣

**Reasons:**

- Needs product decision
- Feature scope unclear
- Design questions raised
- Breaking change discussion needed
- Labeled with `status:needs-product-approval`

**Next Steps:**

- PM to provide guidance
- Team discussion needed

---

#### Action: Merge 🟢

**Reasons:**

- CI passing
- Approved by reviewer
- No unresolved conversations
- No merge conflicts
- All requested changes addressed

**Next Steps:**

- Merge the PR
- Thank the contributor

---

#### Action: Stale 🔵

**Reasons:**

- No activity > 30 days
- Contributor hasn't responded to feedback
- Unclear if PR is still being worked on

**Next Steps:**

- Ping contributor for status
- Consider closing if no response after reminder
- Offer to help if contributor is stuck

### Step 4: Generate Report

The script will generate a markdown report with:

1. **Summary Statistics**

   - Total open contributor PRs
   - Count by category
   - Average PR age
   - Oldest PR

2. **PRs by Category**

   - Grouped lists with key details
   - Links to each PR
   - Brief status summary

3. **Priority PRs**

   - PRs ready to merge
   - PRs awaiting review (fresh)
   - PRs with failing CI (fresh)

4. **Recommendations**
   - Which PRs need immediate attention
   - Reviewer assignments needed
   - Stale PRs to follow up on

## Output

The script creates a report file:

```
streamlit/work-tmp/contributor-prs-report-YYYY-MM-DD.md
```

Example report structure:

```markdown
# Contributor PRs Evaluation Report

**Date:** YYYY-MM-DD
**Total Open Contributor PRs:** 42

## Summary Statistics

- 🟢 Ready to Merge: 3
- 🟡 Awaiting Review: 12
- 🔴 Awaiting Contributor: 15
- 🟣 Awaiting PM: 4
- 🔵 Stale (>30 days): 8

**Average PR Age:** 23 days
**Oldest PR:** #12345 (87 days)

## Priority: Ready to Merge 🟢

### PR #12345: Add support for custom themes

- **Author:** @contributor-name
- **Status:** ✅ CI Passing | ✅ Approved
- **Age:** 12 days
- **Reviewer:** @reviewer-name
- **Summary:** All checks passed, approved, ready to merge
- **Action:** Merge immediately

[View PR](https://github.com/streamlit/streamlit/pull/12345)

---

## Awaiting Review 🟡

### PR #12346: Fix dataframe rendering bug

- **Author:** @contributor-name
- **Status:** ✅ CI Passing | ⏳ Awaiting Review
- **Age:** 5 days
- **Summary:** Fresh PR, CI passing, needs initial review
- **Action:** Assign reviewer

[View PR](https://github.com/streamlit/streamlit/pull/12346)

---

## Awaiting Contributor 🔴

### PR #12347: Add new widget component

- **Author:** @contributor-name
- **Status:** ❌ CI Failing | ❌ Changes Requested
- **Age:** 18 days
- **Reviewer:** @reviewer-name
- **Summary:** CI failing (lint errors), changes requested 10 days ago
- **Action:** Wait for contributor or send reminder

[View PR](https://github.com/streamlit/streamlit/pull/12347)

---

## Awaiting PM 🟣

### PR #12348: Breaking change to st.cache API

- **Author:** @contributor-name
- **Status:** ✅ CI Passing | 💭 Needs Discussion
- **Age:** 25 days
- **Summary:** Proposes breaking change, needs PM review and team discussion
- **Action:** PM to evaluate proposal

[View PR](https://github.com/streamlit/streamlit/pull/12348)

---

## Stale PRs 🔵

### PR #12349: Documentation update

- **Author:** @contributor-name
- **Status:** ⏳ Pending | ⏳ Awaiting Review
- **Age:** 45 days
- **Summary:** No activity for 45 days, no review yet
- **Action:** Ping contributor and reviewer

[View PR](https://github.com/streamlit/streamlit/pull/12349)

---

## Recommendations

### Immediate Actions

1. **Merge Ready PRs:** #12345, #12350, #12351 (3 PRs ready to merge)
2. **Assign Reviewers:** #12346, #12352 (2 PRs awaiting assignment)
3. **PM Decisions:** #12348, #12353 (2 PRs need PM input)

### This Week

1. **Re-review:** 5 PRs where contributor addressed feedback
2. **Send Reminders:** 8 stale PRs with no recent activity
3. **Consider Closing:** 2 PRs stale >60 days with no contributor response

### Reviewer Load

- @reviewer1: 5 open PRs assigned
- @reviewer2: 3 open PRs assigned
- @reviewer3: 2 open PRs assigned
```

## Using the Script

### Basic Usage

```bash
# From st-issues repo root
python app/fetch_contributor_prs_simple.py
```

### Options

```bash
# Save to specific file
python app/fetch_contributor_prs_simple.py --output my-report.md
```

## Interpretation Guidelines

### When to Prioritize

**High Priority:**

- Ready to merge (quick win for contributor)
- Fresh PRs awaiting review (< 7 days)
- Contributors who responded to feedback (needs re-review)
- Important bug fixes with failing CI

**Medium Priority:**

- Stale PRs with recent activity
- PRs needing PM decisions
- Enhancement PRs awaiting review

**Low Priority:**

- Very stale PRs with no activity
- Large feature PRs needing extensive discussion
- PRs with major design questions

### When to Follow Up

- **7 days:** No initial review yet → ping reviewer
- **14 days:** Contributor hasn't addressed feedback → send reminder
- **30 days:** No activity → ask for status update
- **60 days:** Still no activity → consider closing with offer to reopen

## Best Practices

### For Reviewing PRs

1. **Be welcoming:** Remember these are community contributions
2. **Be specific:** Provide clear, actionable feedback
3. **Be timely:** Try to review within 7 days
4. **Be helpful:** Offer to help if contributor is stuck

### For Managing Stale PRs

1. **Don't close too quickly:** Give contributors time to respond
2. **Offer help:** Maybe they're stuck on something
3. **Be understanding:** Life happens, people get busy
4. **Keep door open:** Make it easy to reopen if they return

### For Communication

1. **Always thank contributors** for their time and effort
2. **Explain delays** if review will take longer than usual
3. **Provide context** for why changes are requested
4. **Celebrate merges** when PRs are merged

## Integration with Triage Workflow

This command can be used:

- **Standalone:** Regular PR review sessions
- **Weekly:** As part of community engagement rotation
- **Before sprint planning:** To identify quick wins
- **Monthly:** For comprehensive stale PR cleanup

## Automation Opportunities

Consider setting up:

1. **Weekly reports:** Automated PR status summary
2. **Stale PR reminders:** Auto-comment on PRs > 30 days
3. **Review assignment:** Auto-assign based on area labels
4. **CI failure notifications:** Alert contributors when CI fails

## Notes

- The script uses the GitHub API and respects rate limits
- Results are cached for 5 minutes to avoid excessive API calls
- Team member PRs are filtered out automatically
- Bot PRs (Dependabot, etc.) are excluded

## Example Session

```bash
# Step 1: Generate report (from st-issues repo)
cd /path/to/st-issues
python app/fetch_contributor_prs_simple.py

# Step 2: Review report
cat /path/to/streamlit/work-tmp/contributor-prs-report-2026-01-08.md

# Step 3: Take actions
# - Merge ready PRs
# - Assign reviewers
# - Send follow-up comments
# - Request PM input

# Step 4: Update tracking (if using rotation journal)
# Document actions taken in rotation journal
```

## Related Commands

- `analyze-issue.md` - Similar analysis for issues
- `github-comment-guidelines.md` - Guidelines for PR comments
- `start-triage.md` - Full triage workflow orchestrator

---

**This command helps ensure community contributions get the attention they deserve and move through the review process efficiently.**
