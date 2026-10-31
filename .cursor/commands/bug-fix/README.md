# Bug Fix Pipeline Commands

This directory contains commands for the systematic bug investigation and fix workflow.

## Overview

The bug fix pipeline provides a structured approach to fixing bugs from initial investigation through PR creation.

## Pipeline Stages

### 1. Start Bug Fix

**Command:** `start-bug-fix.md`
**Purpose:** Entry point - helps you navigate the pipeline

**Use when:**

- Beginning bug fix work
- Need guidance on which command to run
- Want overview of the complete workflow

---

### 2. Gather Context

**Command:** `gather-bug-context.md`
**Purpose:** Compile comprehensive bug context from multiple sources

**Gathers:**

- GitHub issue details and comments
- Rotation journal mentions
- Reproduction notes from st-issues
- Related issues
- Environment details

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`

**Use when:**

- Starting fresh with a new bug
- Need comprehensive context
- Preparing for analysis

---

### 3. Analyze Root Cause

**Command:** `analyze-root-cause.md`
**Purpose:** Deep root cause analysis using gathered context

**Analyzes:**

- Component identification
- Code path tracing
- Hypothesis evaluation
- Git history review
- Confidence assessment

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md`

**Use when:**

- Context has been gathered
- Need systematic analysis
- Multiple hypotheses to evaluate
- Want documented root cause

---

### 4. Propose Fix Approach

**Command:** `propose-fix-approach.md`
**Purpose:** Design comprehensive fix implementation proposal

**Type:** Pure workflow tool

**Designs:**

- Fix strategy with alternatives
- Implementation plan
- Testing strategy
- Risk assessment
- Documentation plan

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-fix-proposal.md`

**Use when:**

- Root cause is understood (medium to high confidence)
- Ready to design solution before implementing
- Complex fix needing planning
- Want team review before coding

---

### Optional: Create Reproduction App

**Command:** `create-reproduction-app.md`
**Purpose:** Create visual, interactive demonstration of the bug

**Type:** Pure workflow tool (optional utility)

**Creates:**

- Visual Streamlit app showing the bug
- Deployed to issues.streamlit.app
- Interactive demonstration for team
- Complements automated tests

**Output:** `st-issues/issues/gh-XXXXX/app.py` (deployed app)

**Use when:**

- Bug is visual or needs demonstration
- Want team to see the issue interactively
- Complex interaction hard to describe
- Useful for collaboration and documentation

**Can be used:**

- Standalone (just create reproduction)
- After context gathering (early in investigation)
- After root cause analysis (demonstrate findings)
- Anytime visual demonstration is helpful

---

## Quick Start

**Most common workflow:**

```bash
# 0. (Optional) Select a bug from assigned issues
.cursor/commands/bug-fix/select-assigned-bug.md

# 1. Start the pipeline with selected/assigned issue
.cursor/commands/bug-fix/start-bug-fix.md

# 2. Gather context (pure command, run via orchestrator)
.cursor/commands/bug-fix/gather-bug-context.md

# 3. Analyze root cause (pure command, run via orchestrator)
.cursor/commands/bug-fix/analyze-root-cause.md

# 4. Propose fix approach (pure command, run via orchestrator)
.cursor/commands/bug-fix/propose-fix-approach.md

# Optional: Create visual reproduction app (pure command, use anytime)
.cursor/commands/bug-fix/create-reproduction-app.md

# 5. Implement fix and create PR
# (Follow proposal, use standard PR creation workflow)
```

**Simplified (if you already know which bug to work on):**

```bash
# Just run the orchestrator with issue number
.cursor/commands/bug-fix/start-bug-fix.md
```

## Output Location

All bug fix outputs are saved to:

```
agent-knowledge/local/notes/bug-analysis/
├── gh-XXXXX-context.md          # From gather-bug-context.md
└── gh-XXXXX-root-cause.md       # From analyze-root-cause.md
```

These files are **gitignored** (personal work files).

## Workflow Patterns

### Pattern 1: Complete Pipeline (Most Common)

```
Issue #12345 → gather-bug-context.md
             ↓
             analyze-root-cause.md
             ↓
             create-fix-pr.md
             ↓
             GitHub PR
```

**When:** Starting fresh with a new bug

---

### Pattern 2: Skip to Analysis

```
Issue #12345 + existing context → analyze-root-cause.md
                                ↓
                                create-fix-pr.md
                                ↓
                                GitHub PR
```

**When:** Context already gathered (e.g., from rotation journal)

---

### Pattern 3: Quick Fix

```
Issue #12345 + known root cause → create-fix-pr.md
                                 ↓
                                 GitHub PR
```

**When:** Root cause obvious from triage

---

## Checkpoints

The pipeline includes natural checkpoints for review:

**After Context Gathering:**

- Review: "Do we have enough information?"
- Decision: Proceed to analysis OR gather more info

**After Root Cause Analysis:**

- Review: "Are we confident in the root cause?"
- Decision: Proceed to fix OR investigate more

**After Fix Implementation:**

- Review: "Does the fix address the root cause?"
- Decision: Create PR OR refine approach

## Integration with Journals

Document bug fix work in your journals:

**Rotation Journal** (`agent-knowledge/local/journals/active/rotations/`):

- Track bugs triaged during interrupt rotation
- Document context gathering and analysis
- Note when handed off or fixed

**Weekly Journal** (`agent-knowledge/local/journals/active/weekly/`):

- Track bugs worked on during regular development
- Document in "Bugs" section
- Link to context/analysis documents

## Best Practices

### 1. Always Start with Context

Don't skip `gather-bug-context.md` even if you think you understand the bug. Hidden details in comments often change understanding.

### 2. Document Your Thinking

Use the analysis command's thinking block structure to work through hypotheses systematically.

### 3. Track Confidence Levels

Be honest about confidence in root cause. "Medium" confidence means more investigation may be needed.

### 4. Link Documents

Reference context and analysis documents in:

- Rotation/weekly journals
- GitHub comments
- PR descriptions

### 5. Clean Up After Fix

After PR is merged:

- Archive or delete old context/analysis documents
- Update journal with "completed" status
- Move learnings to team documentation if valuable

## Command Dependencies

```
start-bug-fix.md
  ↓ (guides to)

gather-bug-context.md
  ↓ (requires)
  - GitHub CLI authenticated
  - Issue number
  ↓ (produces)
  - gh-XXXXX-context.md

analyze-root-cause.md
  ↓ (requires)
  - gh-XXXXX-context.md (from previous step)
  ↓ (produces)
  - gh-XXXXX-root-cause.md

create-fix-pr.md [Future]
  ↓ (requires)
  - gh-XXXXX-context.md
  - gh-XXXXX-root-cause.md (optional but recommended)
  ↓ (produces)
  - GitHub PR
```

## Related Resources

**Process Guides:**

- `agent-knowledge/processes/issue-management/github-cli.local.md` - GitHub CLI reference
- `agent-knowledge/local/journals/README.md` - Journal system guide
- `agent-knowledge/local/notes/README.md` - Notes directory guide

**Other Commands:**

- `.cursor-experimental/commands/interrupt/` - Interrupt rotation workflows
- `.cursor/commands/pr-create.md` - General PR creation

**Output Locations:**

- `agent-knowledge/local/notes/bug-analysis/` - Bug analysis outputs
- `agent-knowledge/local/journals/active/` - Journal entries

---

## Getting Help

**Questions about:**

- **Which command to run?** → Start with `start-bug-fix.md`
- **GitHub CLI usage?** → See `agent-knowledge/processes/issue-management/github-cli.local.md`
- **Where to save outputs?** → See `agent-knowledge/local/notes/README.md`
- **Journal integration?** → See `agent-knowledge/local/journals/README.md`

---

**For detailed workflow guidance, start with `start-bug-fix.md`**
