# Issue Triage Pipeline

## Overview

This directory contains the complete issue triage workflow for Streamlit. These commands help AI agents and team members systematically analyze, classify, reproduce, prioritize, and confirm GitHub issues.

**🚀 Start Here:** `start-triage.md` - Entry point that checks prerequisites and guides through the workflow

**Architecture:** See `ARCHITECTURE.md` for design principles and how commands can be used standalone or composed

## Pipeline Phases

```
PHASE 1: DISCOVERY & ANALYSIS
┌─────────────────────────────────────────────────────────────┐
│  1. gather-issues.md                                        │
│     Find all issues with status:needs-triage                │
│     Output: List of issues to process                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. analyze-issue.md                                        │
│     Deep analysis, classification, assessment               │
│     Output: st-issues/issues/gh-XXXXX/NOTES.md              │
└─────────────────────┬───────────────────────────────────────┘
                      │
      ┌───────────────┼───────────────┬──────────────────────┐
      │               │               │                      │
      │               │        Feature Request        Question/Duplicate
      │               │               │                      │
      │               │               ▼                      ▼
      │               │      (Recommend close/relabel)  (Recommend redirect)
      │               │       [Team Action]              [Team Action]
      │               │
      │               ▼ Needs More Info
      │        ┌─────────────────────────┐
      │        │ request-more-info.md    │
      │        │ → status:awaiting-user  │
      │        └─────────────────────────┘
      │
      ▼ Reproducible Bug

PHASE 2: REPRODUCTION
┌─────────────────────────────────────────────────────────────┐
│  3. create-playwright-test.md (DEFAULT - always attempt)    │
│     Create automated playwright test                        │
│     Output: app.py + app_test.py + test results            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. create-repro-app.md                                     │
│     Create visual app, commit, push (triggers deployment)   │
│     Output: app.py deployed to issues.streamlit.app         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ After deployment (2-5 min) & team verification

PHASE 3: CONFIRMATION (choose based on outcome)
      │
      ├── Bug Confirmed ──────┐
      ├── Cannot Reproduce ────┼──────┐
      └── Unclear Behavior ────┼──────┼──────┐
                               │      │      │
┌─────────────────────────┐   │      │      │
│ confirm-bug.md          │◄──┘      │      │
│ Post confirmation       │          │      │
│ → status:confirmed      │          │      │
└────────┬────────────────┘          │      │
         │                           │      │
┌─────────────────────────┐          │      │
│ report-cannot-          │◄─────────┘      │
│   reproduce.md          │                 │
│ → status:awaiting-user  │                 │
└─────────────────────────┘                 │
                                            │
┌─────────────────────────┐                 │
│ request-team-           │◄────────────────┘
│   decision.md           │
│ → status:awaiting-team  │
└─────────────────────────┘

PHASE 4: CLASSIFICATION (confirmed bugs only)
         │
         ▼ From confirm-bug.md
┌──────────────────────────────┐  ┌───────────────────────────┐
│ prioritize-bug.md            │  │ add-feature-labels.md     │
│ Assign P0-P4 priority        │  │ Add feature/area labels   │
│ → priority:P{0-4}            │  │ → feature:* / area:*      │
└──────────────────────────────┘  └───────────────────────────┘
```

## Quick Start

### For AI Agents

**Starting Point:**

```bash
# Always start here - checks prerequisites, guides workflow
→ start-triage.md
```

**Phase 1: Discovery & Analysis**

```bash
# 1. Find issues to triage
→ gather-issues.md

# 2. Analyze each issue
→ analyze-issue.md
```

**Phase 2: Reproduction (for reproducible bugs)**

```bash
# 3. Create playwright test (DEFAULT - always attempt unless purely visual)
→ create-playwright-test.md

# 4. Create visual repro app
→ create-repro-app.md
```

**Phase 3: Confirmation (choose appropriate command)**

```bash
# If bug confirmed
→ confirm-bug.md

# If need more information
→ request-more-info.md

# If behavior unclear (need team decision)
→ request-team-decision.md

# If cannot reproduce
→ report-cannot-reproduce.md
```

**Phase 4: Classification (for confirmed bugs only)**

```bash
# Assign priority
→ prioritize-bug.md

# Add feature/area labels
→ add-feature-labels.md
```

### For Team Members

Review agent work at key checkpoints:

**Required Approvals (before agent posts):**

- **After Step 2:** Approve if agent proposes requesting more information or classifying as non-bug
- **After Step 3:** Approve if agent determines behavior is expected (not a bug)
- **After Step 4:** Manually verify deployed reproduction app
- **Before Step 5:** Approve all GitHub comments before posting (CRITICAL)

**Post-Action Reviews (agents can act, document for review):**

- **After Step 6:** Review priority labels in journal (agents add directly, team adjusts if needed)
- **After Step 7:** Review feature/area labels in journal (agents add directly, team adjusts if needed)

**Note:** Labels are easily reversible, so agents add them directly. Comments are permanent, so they require approval.

## Command Details

### Orchestrator

#### `start-triage.md`

**Purpose:** Entry point - guides through complete triage workflow with optional journal tracking

**Prerequisites:**

- GitHub CLI installed and authenticated
- Access to streamlit/streamlit repository

**Use when:**

- Beginning triage work
- Need guidance on which command to run
- Want guided workflow with journal tracking

---

### Phase 1: Discovery & Analysis

#### `gather-issues.md`

**Purpose:** Find and list all issues with `status:needs-triage`

**Type:** Pure command (can run standalone)

**Output:** List of issues needing triage (displayed)

**Next Command:** `analyze-issue.md` for each issue

---

#### `analyze-issue.md`

**Purpose:** Deep analysis of issue, assess reproducibility, create technical notes

**Type:** Pure command (can run standalone)

**Input:** GitHub issue number

**Output:** `st-issues/issues/gh-XXXXX/NOTES.md`

**Next Command:**

- **DEFAULT:** `create-playwright-test.md` (always attempt for reproducible bugs)
- **Only if needs more info:** `request-more-info.md`

---

### Phase 2: Reproduction

#### `create-playwright-test.md`

**Purpose:** Create automated playwright test to reproduce bug

**Type:** Pure command (can run standalone)

**Default Approach:** Always attempt for reproducible bugs (skip only if purely visual/subjective)

**Output:**

- Test files in temp directory
- Copied to `st-issues/issues/gh-XXXXX/`
- Test execution results

**Next Command:** `create-repro-app.md`

---

#### `create-repro-app.md`

**Purpose:** Create visual app, commit, push, and deploy for manual verification

**Type:** Pure command (can run standalone)

**Output:**

- `st-issues/issues/gh-XXXXX/app.py` (visual app)
- App deployed to issues.streamlit.app

**Next Command:** Appropriate Phase 3 command after team verification

---

### Phase 3: Confirmation

#### `confirm-bug.md`

**Purpose:** Post bug confirmation with reproduction link

**Type:** Pure command (can run standalone)

**Prerequisites:**

- Reproduction app deployed and verified by team
- Bug confirmed (not expected behavior)

**Output:**

- Confirmation comment posted
- Label updated to `status:confirmed`

**Next:** `prioritize-bug.md` and `add-feature-labels.md`

---

#### `request-more-info.md`

**Purpose:** Request missing details from reporter

**Type:** Pure command (can run standalone)

**Prerequisites:**

- Analysis determined insufficient information
- Specific missing details identified

**Output:**

- Information request posted
- Label updated to `status:awaiting-user-response`

---

#### `request-team-decision.md`

**Purpose:** Ask team if behavior is expected or a bug

**Type:** Pure command (can run standalone)

**Prerequisites:**

- Reproduction created
- Assessed as "Needs Team Decision" via `expected-vs-bug-assessment.md`

**Output:**

- Clarification request posted
- Label updated to `status:awaiting-team-response`

---

#### `report-cannot-reproduce.md`

**Purpose:** Document inability to reproduce issue

**Type:** Pure command (can run standalone)

**Prerequisites:**

- Reproduction attempted
- Could not observe reported behavior

**Output:**

- Cannot-reproduce comment posted
- Label updated to `status:awaiting-user-response`

---

### Phase 4: Classification

#### `prioritize-bug.md`

**Purpose:** Assign P0-P4 priority labels to confirmed bugs

**Type:** Pure command (can run standalone)

**Prerequisites:**

- Issue confirmed via `confirm-bug.md`
- Issue has `status:confirmed` and `type:bug` labels

**Output:** Priority label (P0-P4) applied

---

#### `add-feature-labels.md`

**Purpose:** Add feature:_ or area:_ labels to issues

**Type:** Pure command (can run standalone)

**Prerequisites:** Issue analyzed (can run at any point after analysis)

**Output:** Feature/area labels applied (at least one required per issue)

---

### Reference Guides

#### `expected-vs-bug-assessment.md`

**Purpose:** Framework for distinguishing bugs from expected behavior

**Usage:** Reference during `analyze-issue.md` and reproduction

---

#### `github-comment-guidelines.md`

**Purpose:** Best practices for GitHub comments and approval workflow

**Usage:** Reference when drafting any GitHub comment

---

## Using Commands Standalone

All pure commands can be used independently without the orchestrator:

```bash
# Just analyze one issue (no journal tracking)
→ analyze-issue.md (with issue number)

# Just create a reproduction (no journal tracking)
→ create-repro-app.md (with issue number)

# Just add labels to backlog issues
→ add-feature-labels.md (with issue number)
```

This is useful for:

- Quick investigations
- Bug fix workflow integration
- Team discussions
- Ad-hoc tasks

See `ARCHITECTURE.md` for more details on standalone usage patterns.

## Rotation Journal Integration

When using the full pipeline via `start-triage.md`, work is tracked in the rotation journal:

**Location:** `agent-knowledge/local/journals/active/rotations/YYYY-MM-DD-rotation.md`

**See:** `agent-knowledge/local/journals/README.md` for journal management

## st-issues Repository Structure

```
st-issues/issues/
└── gh-<ISSUE_NUMBER>/
    ├── app.py              # Visual reproduction app (deployed)
    ├── app_test.py         # Playwright test (reference)
    ├── requirements.txt    # Dependencies (if needed)
    └── NOTES.md           # Technical analysis and findings
```

## Key Principles

### Separation of Concerns

Each command has ONE clear purpose. Tracking is separate from workflow.

### Clear Inputs/Outputs

Every command specifies what it needs and what it produces.

### Documentation First

All findings go in NOTES.md. GitHub comments stay user-friendly.

### Automation Where Possible

Agents can fully automate Phases 1-4. GitHub comments require team approval.

## Best Practices

### For AI Agents

- Follow commands in order (or use standalone as needed)
- Document everything in NOTES.md
- Keep GitHub comments concise
- Request review when uncertain
- If using orchestrator, update journal after each step

### For Team Members

- Review agent analysis before information requests
- Verify deployed apps before confirmation
- Approve comments before posting
- Provide clear decisions on ambiguous cases

## Common Workflows

### Happy Path (Bug Confirmed)

```
gather-issues → analyze-issue → create-playwright-test → create-repro-app → confirm-bug
```

**Timeline:** ~30-60 minutes per issue

### Needs More Information

```
gather-issues → analyze-issue → request-more-info
```

**Timeline:** ~15-30 minutes per issue

### Ambiguous Case

```
gather-issues → analyze-issue → create-playwright-test → create-repro-app → request-team-decision
```

**Timeline:** Depends on team availability

## Troubleshooting

### "I don't know which command to run"

**Always start with `start-triage.md`** - it will direct you to the appropriate next step.

### "Issue is too vague to analyze"

Run `analyze-issue.md` fully - it will help you determine if information request is needed.

### "Not sure if suitable for playwright"

**Default: Attempt playwright anyway.** The test attempt provides valuable information even if it doesn't reveal the bug.

### "Can't reproduce the bug"

This is a valid outcome - use `report-cannot-reproduce.md` to document your attempt.

### "Behavior might be expected"

Use `request-team-decision.md` to ask the team for a decision.

## Related Resources

**Within Triage Pipeline:**

- **Architecture:** `ARCHITECTURE.md` (design principles)
- **Assessment Guide:** `expected-vs-bug-assessment.md`
- **Comment Guidelines:** `github-comment-guidelines.md`

**Other Pipelines:**

- **Bug Fix:** `.cursor/commands/bug-fix/` (fixing confirmed bugs)
- **Planning:** `.cursor/commands/planning/` (journals and planning)

**Shared Resources:**

- **Playwright Guide:** `e2e_playwright/AGENTS.md` in main repo
- **Journal Management:** `agent-knowledge/local/journals/README.md`

---

**For detailed workflow guidance, start with `start-triage.md`**
