# Start Triage

## Overview

This is the **orchestrator** for the issue triage workflow. It guides you through the complete pipeline with optional rotation journal tracking at checkpoints.

**For standalone command usage without tracking, run individual commands directly:**

- `gather-issues.md` - Find issues
- `analyze-issue.md` - Analyze single issue
- See `ARCHITECTURE.md` for all standalone options

## Triage Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRIAGE PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ✋ Step 0: Prerequisites & Journal Setup                                   │
│      ↓                                                                      │
│  ▶ Step 1: gather-issues.md          → ✋ Checkpoint: Update journal        │
│      ↓                                                                      │
│  ▶ Step 2: analyze-issue.md          → ✋ Checkpoint: Update journal        │
│      ↓                                                                      │
│  ▶ Step 3: create-playwright-test.md → ✋ Checkpoint: Update journal        │
│      ↓                                                                      │
│  ▶ Step 4: create-repro-app.md       → ✋ Checkpoint: Update journal        │
│      ↓                                                                      │
│  ▶ Step 5: Confirmation command      → ✋ Checkpoint: Update journal        │
│      ↓                                                                      │
│  ▶ Step 6: Classification commands   → ✋ Checkpoint: Update journal        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. GitHub CLI Access

```bash
# Check if gh is installed
gh --version

# Check if authenticated
gh auth status

# If not authenticated
gh auth login
```

### 2. Repository Access

```bash
# Verify access to streamlit repo
gh repo view streamlit/streamlit

# Ensure st-issues repo is cloned and up-to-date
cd /path/to/st-issues
git pull origin main
```

### 3. (Optional) Rotation Journal

If tracking work in a rotation journal:

**Journal:** See `agent-knowledge/local/journals/README.md` for journal management instructions.

Quick check:

- Current date: YYYY-MM-DD
- Find Monday of current week
- Check if rotation started this week or last week (rotations are 2 weeks)
- Look for journal: `agent-knowledge/local/journals/active/rotations/YYYY-MM-DD-rotation.md`

**If journal doesn't exist:**

- See journal README for instructions on creating from template
- Use Monday's date when the current rotation started

**If journal exists:**

- Open it to see current status
- Check "Pending Actions" to see what needs work

## Starting Scenarios

### Scenario A: Fresh Start (New Rotation)

**You should:**

1. Create new rotation journal if starting a new 2-week rotation
2. Begin with `gather-issues.md` to find all issues
3. Work through issues systematically

**Go to:** Step 1 below

---

### Scenario B: Resuming Work (Mid-Rotation)

**You should:**

1. Open current rotation journal
2. Review "Pending Actions" section
3. Continue from where previous work left off

**Go to:** Appropriate step based on journal pending actions

---

### Scenario C: Specific Task (No Full Pipeline)

**You were asked to:**

- "Analyze issue #12345" → Run `analyze-issue.md` directly
- "Add labels to issues" → Run `add-feature-labels.md` directly
- "Reproduce issue #12345" → Run `analyze-issue.md` then `create-repro-app.md`

**Go to:** Run the specific command standalone (no orchestrator needed)

---

## Step-by-Step Process

### ✋ Step 0: Prepare (Optional Journal Setup)

**If tracking in rotation journal:**

1. Identify or create rotation journal
2. Note today's date for entries

**If NOT tracking (standalone usage):**

- Skip journal updates at checkpoints
- Run commands and review outputs directly

---

### ▶ Step 1: Find Issues to Triage

**Run:** `gather-issues.md`

**Output:** List of issues with `status:needs-triage`

**Review:**

- How many issues need triage?
- Any high-priority issues to address first?

### ✋ Checkpoint 1: Update Journal (Optional)

If using rotation journal, add issues to journal:

```markdown
## Issues Identified: YYYY-MM-DD

- #<NUMBER> - <Title>
- #<NUMBER> - <Title>
- #<NUMBER> - <Title>

**Total:** <N> issues needing triage
```

---

### ▶ Step 2: Analyze First Issue

**Run:** `analyze-issue.md` with issue number

**Output:** `st-issues/issues/gh-XXXXX/NOTES.md`

**Review:**

- Is there enough information to reproduce?
- Is this a bug, feature request, or question?
- What's the reproducibility assessment?

### ✋ Checkpoint 2: Update Journal (Optional)

If using rotation journal:

```markdown
### gh-<NUMBER> - <Title>

**[YYYY-MM-DD] Analysis Complete:**

- **Type:** [Bug/Feature Request/Question]
- **Reproducibility:** [High/Medium/Low/Needs More Info]
- **Notes:** `st-issues/issues/gh-<NUMBER>/NOTES.md`

**Next:** [Playwright test / Request info / Skip reproduction]
```

**Decision Point:**

- **If Bug + Reproducible:** Continue to Step 3
- **If Needs More Info:** Jump to `request-more-info.md`
- **If Feature Request/Question:** Note recommendation, move to next issue

---

### ▶ Step 3: Create Playwright Test (Default)

**Run:** `create-playwright-test.md`

**Output:**

- Test files created
- Test execution results
- NOTES.md updated with results

**Review:**

- Did the test confirm the bug?
- Did it show expected behavior (cannot reproduce)?
- Was the behavior ambiguous?

### ✋ Checkpoint 3: Update Journal (Optional)

If using rotation journal:

```markdown
**[YYYY-MM-DD] Playwright Test:**

- **Result:** [Bug Confirmed / Cannot Reproduce / Ambiguous]
- **Test File:** `st-issues/issues/gh-<NUMBER>/app_test.py`

**Next:** [Create visual app / Request team decision / Report cannot reproduce]
```

---

### ▶ Step 4: Create Visual Reproduction App

**Run:** `create-repro-app.md`

**Output:**

- `st-issues/issues/gh-XXXXX/app.py` (committed and pushed)
- App deployed to issues.streamlit.app

**Wait:** 2-5 minutes for deployment

**Team Verification:** A team member should manually verify the deployed app works correctly.

### ✋ Checkpoint 4: Update Journal (Optional)

If using rotation journal:

```markdown
**[YYYY-MM-DD] Visual App Deployed:**

- **App URL:** https://issues.streamlit.app/?issue=gh-<NUMBER>
- **Deployed:** YYYY-MM-DD HH:MM

**Pending:** Team verification before posting to GitHub
```

---

### ▶ Step 5: Post to GitHub (Choose One)

Based on findings, run the appropriate command:

| Outcome            | Command                      | Result                   |
| ------------------ | ---------------------------- | ------------------------ |
| Bug Confirmed      | `confirm-bug.md`             | → `status:confirmed`     |
| Cannot Reproduce   | `report-cannot-reproduce.md` | → `status:awaiting-user` |
| Needs More Info    | `request-more-info.md`       | → `status:awaiting-user` |
| Unclear (Ask Team) | `request-team-decision.md`   | → `status:awaiting-team` |

**⚠️ CRITICAL:** All GitHub comments require team approval before posting!

### ✋ Checkpoint 5: Update Journal (Optional)

If using rotation journal:

```markdown
**[YYYY-MM-DD] Posted to GitHub:**

- **Action:** [Confirmed / Requested Info / Asked Team / Reported Cannot Reproduce]
- **Status:** [status:confirmed / status:awaiting-user / status:awaiting-team]
- **Comment:** Posted with team approval

**Next:** [Classification / Monitor for response / Await team decision]
```

---

### ▶ Step 6: Classification (Confirmed Bugs Only)

For confirmed bugs, run both classification commands:

**Run:** `prioritize-bug.md` - Assign P0-P4 priority

**Run:** `add-feature-labels.md` - Add feature/area labels

**Note:** These can run in parallel. Agents add labels directly (easily reversible).

### ✋ Checkpoint 6: Update Journal (Optional)

If using rotation journal:

```markdown
**[YYYY-MM-DD] Classified:**

- **Priority:** P<N> - <Reasoning>
- **Labels:** feature:<name>, area:<name>

**Status:** Complete ✅
```

---

## Repeat for Next Issue

After completing one issue:

1. Return to Step 2 with next issue from the list
2. Or run `gather-issues.md` again if list is exhausted
3. Continue until all issues processed or shift ends

---

## Quick Reference

### Commands by Phase

**Phase 1:** `gather-issues.md`, `analyze-issue.md`

**Phase 2:** `create-playwright-test.md`, `create-repro-app.md`

**Phase 3:** `confirm-bug.md`, `request-more-info.md`, `request-team-decision.md`, `report-cannot-reproduce.md`

**Phase 4:** `prioritize-bug.md`, `add-feature-labels.md`

### Reference Guides

- `expected-vs-bug-assessment.md` - Distinguish bugs from expected behavior
- `github-comment-guidelines.md` - Comment best practices

### Common Decisions

| Situation                   | Next Step                                       |
| --------------------------- | ----------------------------------------------- |
| Issue has code + clear desc | → `create-playwright-test.md`                   |
| Missing critical info       | → `request-more-info.md`                        |
| Cannot reproduce            | → `report-cannot-reproduce.md`                  |
| Behavior might be expected  | → `request-team-decision.md`                    |
| Bug confirmed + deployed    | → `confirm-bug.md`                              |
| Confirmed bug needs labels  | → `prioritize-bug.md` + `add-feature-labels.md` |

---

## Critical Reminders

### ⚠️ For AI Agents

**Always Required:**

- ✅ Get team approval before posting ANY GitHub comment
- ✅ Check prerequisites before each command

**Agents Can Do Directly:**

- ✅ Add feature/area labels (document reasoning)
- ✅ Add priority labels (document reasoning)
- ✅ Create reproduction apps
- ✅ Run playwright tests

**Requires Team Approval:**

- ⚠️ Post any GitHub comment
- ⚠️ Close or classify issues as non-bugs
- ⚠️ Create new labels

---

## Notes

- This orchestrator is optional - commands can run standalone
- Journal tracking is optional - skip checkpoints if not needed
- When in doubt, check `README.md` for workflow details
- For architecture details, see `ARCHITECTURE.md`

**Workflow Documentation:** See `README.md` for complete pipeline details
