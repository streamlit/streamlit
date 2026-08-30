# Start Bug Fix Pipeline

## Overview

Start the systematic bug investigation and fix pipeline. This command guides you through the complete workflow from gathering context to creating a fix PR.

## Purpose

This is the **entry point** for the bug fix workflow. It helps you:

- Understand the complete pipeline
- Choose the right starting point
- Navigate through the workflow steps
- Track your progress

## Bug Fix Pipeline

The bug fix workflow consists of three main stages with journal tracking integrated:

```
┌──────────────────────────────────────────────────────────────┐
│                    BUG FIX PIPELINE                          │
│              (with Weekly Journal Tracking)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. GATHER CONTEXT                                           │
│     ▶ gather-bug-context.md                                  │
│     ↓                                                        │
│     • Fetch GitHub issue details                             │
│     • Search rotation journals                               │
│     • Check reproduction notes                               │
│     • Find related issues                                    │
│     • Compile environment details                            │
│     ↓                                                        │
│     📄 Output: gh-XXXXX-context.md                          │
│     ✋ PAUSE: Update weekly journal (see below)              │
│                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  2. ANALYZE ROOT CAUSE                                       │
│     ▶ analyze-root-cause.md                                  │
│     ↓                                                        │
│     • Load gathered context                                  │
│     • Identify components                                    │
│     • Analyze code paths                                     │
│     • Evaluate hypotheses                                    │
│     • Review git history                                     │
│     • Determine root cause                                   │
│     ↓                                                        │
│     📄 Output: gh-XXXXX-root-cause.md                       │
│     ✋ PAUSE: Update weekly journal (see below)              │
│                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  3. PROPOSE FIX                                              │
│     ▶ propose-fix-approach.md                                │
│     ↓                                                        │
│     • Design fix strategy                                    │
│     • Consider alternatives                                  │
│     • Plan implementation                                    │
│     • Plan testing strategy                                  │
│     • Assess risks                                           │
│     ↓                                                        │
│     📄 Output: gh-XXXXX-fix-proposal.md                     │
│     ✋ PAUSE: Update weekly journal (see below)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Note:** The individual commands (`gather-bug-context.md`, `analyze-root-cause.md`) are **pure workflow tools** that don't update journals. Journal tracking is handled by THIS orchestrator command.

---

## Prerequisites

Before starting, ensure you have:

- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] Access to `streamlit/streamlit` repository
- [ ] Access to `st-issues` repository (optional, for reproduction notes)
- [ ] Issue number or URL you want to investigate

**Check GitHub CLI:**

```bash
# Verify gh is installed
gh --version

# Verify authentication
gh auth status

# If not authenticated
gh auth login
```

---

## Getting Started

### Step 1: Identify the Issue

**Option A: You have an issue number**

```
Issue #12345
```

**Option B: You need to find the issue**

```bash
# Search for issues by keyword
gh issue list --repo streamlit/streamlit --search "keyword" --limit 20

# Search for specific labels
gh issue list --repo streamlit/streamlit --label "status:confirmed" --label "type:bug" --limit 20

# Open in browser to browse
gh issue list --repo streamlit/streamlit --web
```

**Once you have an issue number, note it down:**

```
Working on: Issue #______
```

---

### Step 2: Choose Your Starting Point

Depending on your situation, start at the appropriate step:

#### Scenario A: Starting Fresh (Most Common)

**You have:** Issue number
**You need:** Everything

**Start here:** `gather-bug-context.md`

This will:

- Fetch all issue details
- Search for related context
- Create comprehensive context document
- Prepare you for analysis

**Next after this:** `analyze-root-cause.md`

---

#### Scenario B: Context Already Gathered

**You have:**

- Issue number
- Context document already exists at `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`

**You need:** Root cause analysis

**Start here:** `analyze-root-cause.md`

This will:

- Read the existing context
- Perform deep analysis
- Determine root cause
- Create analysis document

**Next after this:** Create fix PR (future command)

---

#### Scenario C: Root Cause Already Known

**You have:**

- Issue number
- Clear understanding of root cause
- Context and/or analysis documents

**You need:** Implement the fix

**Start here:** `propose-fix-approach.md`

**After proposal:** Implement the fix following your documented approach

---

## Detailed Workflow with Journal Tracking

### Step-by-Step Process

This section provides the complete workflow with journal update instructions at each stage.

#### ✋ Step 0: Prepare Your Weekly Journal

Before starting, ensure you have a weekly journal:

```bash
# Find or create current week's journal
JOURNAL=$(ls -t agent-knowledge/local/journals/active/weekly/*-week.md 2>/dev/null | head -1)

if [ -z "$JOURNAL" ]; then
  # No journal exists - create from template
  cp agent-knowledge/local/journals/templates/weekly-template.md \
     agent-knowledge/local/journals/active/weekly/$(date -v-$(($(date +%u)-1))d +%Y-%m-%d)-week.md
fi
```

---

#### ▶ Step 1: Gather Context

**Run:** `gather-bug-context.md` with issue number

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`

---

#### ✋ Checkpoint 1: Update Journal After Context Gathering

**Open your weekly journal** and add entry to "Bugs" section:

```markdown
### gh-<ISSUE_NUMBER> - [Bug Title]

**[YYYY-MM-DD] Investigation Started:**

- **Issue:** [Brief problem description from context]
- **Context Document:** `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md`
- **Key Findings:**
  - [Finding 1 from context gathering]
  - [Finding 2 from context gathering]
- **Components:** `feature:st.xxx`, `area:xxx` [from labels/analysis]
- **Environment:** Streamlit vX.X.X, Python X.X, [OS]

**Outstanding:**

- [ ] Root cause analysis (analyze-root-cause.md)

**GitHub Issue:** [#XXXXX](https://github.com/streamlit/streamlit/issues/XXXXX)
```

**Update metadata:**

- **Quick Stats → Bugs:** Increment "Bugs investigated" count
- **Daily Activity Log:** Add today's entry:

```markdown
### [Day], [Date]

**Focus:** Bug investigation

**Completed:**

- Gathered context for gh-<ISSUE_NUMBER> ([1-line description])
- Compiled comprehensive analysis from GitHub, journals, reproduction notes

**Tomorrow:** Root cause analysis for gh-<ISSUE_NUMBER>
```

---

#### ▶ Step 2: Analyze Root Cause

**Run:** `analyze-root-cause.md` with issue number

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md`

---

#### ✋ Checkpoint 2: Update Journal After Analysis

**Open your weekly journal** and update the existing bug entry:

```markdown
### gh-<ISSUE_NUMBER> - [Bug Title]

[Previous Investigation Started section...]

**[YYYY-MM-DD] Root Cause Analysis:**

- **Root Cause:** [Brief description of the root cause identified]
- **Confidence:** [Low / Medium / High]
- **Analysis Document:** `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md`
- **Affected Components:** [Specific files/modules]
- **Key Findings:**
  - [Finding 1 from analysis]
  - [Finding 2 from analysis]

**Outstanding:**

- [ ] Propose fix approach (propose-fix-approach.md)
- [ ] Additional investigation: [specific areas] [if confidence < High]

**GitHub Issue:** [#XXXXX](https://github.com/streamlit/streamlit/issues/XXXXX)
```

**Update metadata:**

- **Quick Stats → Bugs:** Change "Bugs investigated" to "Bugs analyzed" or increment count
- **Goals & Progress:** Update relevant goal if applicable (e.g., "🚧 Fix gh-12345" → show progress)
- **Daily Activity Log:** Add today's entry:

```markdown
### [Day], [Date]

**Focus:** Root cause analysis

**Completed:**

- Completed root cause analysis for gh-<ISSUE_NUMBER>
- Confidence level: [Low/Medium/High]
- Root cause: [1-line summary]

**Tomorrow:** [Implement fix OR Further investigation OR Discuss with team]
```

---

#### ▶ Step 3: Propose Fix Approach

**Run:** `propose-fix-approach.md` with issue number

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-fix-proposal.md`

---

#### ✋ Checkpoint 3: Update Journal After Proposal

**Open your weekly journal** and update the bug entry:

```markdown
### gh-<ISSUE_NUMBER> - [Bug Title]

[Previous sections...]

**[YYYY-MM-DD] Fix Proposal:**

- **Approach:** [Primary fix strategy]
- **Complexity:** [Simple / Moderate / Complex]
- **Proposal Document:** `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-fix-proposal.md`
- **Breaking Changes:** [Yes / No]
- **Alternatives Considered:** [Number of alternatives]
- **Testing Plan:** [Unit + E2E + Manual]

**Outstanding:**

- [ ] Team review of proposal (if complex or breaking)
- [ ] Implement fix following proposal
- [ ] Create tests as planned
- [ ] Create PR

**GitHub Issue:** [#XXXXX](https://github.com/streamlit/streamlit/issues/XXXXX)
```

**Update metadata:**

- **Goals & Progress:** Update relevant goal (e.g., "🚧 Fix gh-12345 - Proposal ready")
- **Daily Activity Log:** Add entry:

```markdown
### [Day], [Date]

**Focus:** Fix design

**Completed:**

- Created fix proposal for gh-<ISSUE_NUMBER>
- Approach: [1-line summary]
- Complexity: [Simple/Moderate/Complex]
- Alternatives considered: [Number]

**Tomorrow:** [Team review OR Start implementation]
```

---

## Workflow Decision Tree

```
Do you have the issue number?
├─ No  → Search for issue (see Step 1 above)
└─ Yes → Continue

Does context document exist for this issue?
│        (agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md)
│
├─ No  → START: gather-bug-context.md
│         ↓
│         THEN: analyze-root-cause.md
│         ↓
│         THEN: propose-fix-approach.md
│         ↓
│         THEN: Implementation
│
└─ Yes → Does analysis document exist?
          │      (agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md)
          │
          ├─ No  → START: analyze-root-cause.md
          │         ↓
          │         THEN: propose-fix-approach.md
          │         ↓
          │         THEN: Implementation
          │
          └─ Yes → Does proposal document exist?
                    │      (agent-knowledge/local/notes/bug-analysis/gh-XXXXX-fix-proposal.md)
                    │
                    ├─ No  → START: propose-fix-approach.md
                    │         ↓
                    │         THEN: Implementation
                    │
                    └─ Yes → START: Implementation (proposal ready)
```

---

## Command Reference

### 1. Gather Bug Context

**File:** `gather-bug-context.md`

**Purpose:** Compile comprehensive context from multiple sources

**Input:** Issue number

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`

**Time:** 10-20 minutes (depending on issue complexity)

**When to use:**

- Starting fresh with a new bug
- Need to update context for an old issue
- Want to share comprehensive context with team

---

### 2. Analyze Root Cause

**File:** `analyze-root-cause.md`

**Purpose:** Deep root cause analysis using gathered context

**Input:**

- Issue number
- Context document (from step 1)

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md`

**Time:** 30-60 minutes (depending on complexity)

**When to use:**

- After gathering context
- Need systematic analysis approach
- Want documented root cause determination
- Multiple hypotheses need evaluation

---

### 3. Propose Fix Approach

**File:** `propose-fix-approach.md`

**Purpose:** Design comprehensive fix implementation proposal

**Input:**

- Issue number
- Root cause analysis document

**Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-fix-proposal.md`

**Time:** 30-60 minutes

**When to use:**

- Root cause is understood (medium to high confidence)
- Ready to design solution
- Want to plan before implementing
- Complex fix needing team review

---

## Weekly Journal Integration

**Important:** This bug fix pipeline is for **regular development work** tracked in weekly journals. For interrupt rotation work, use `.cursor-experimental/commands/interrupt/` instead.

### Architecture

**Pure Workflow Commands:**

- `gather-bug-context.md` - Gathers context, saves document (no journal logic)
- `analyze-root-cause.md` - Analyzes root cause, saves document (no journal logic)

**Orchestrator (this command):**

- Provides complete workflow with journal checkpoints
- Journal update instructions BETWEEN command steps
- Can be adapted for different tracking systems

**Benefits:**

- ✅ Commands are reusable (can be used standalone or with other systems)
- ✅ Journal logic centralized in one place
- ✅ Easy to create alternative orchestrators (e.g., for rotation work)
- ✅ Clear separation: workflow vs. tracking

### How Tracking Works

This orchestrator command (`start-bug-fix.md`) provides:

1. **Checkpoint 1 (after gather-bug-context.md):**

   - Instructions to create bug entry
   - Update Quick Stats and Daily Log

2. **Checkpoint 2 (after analyze-root-cause.md):**

   - Instructions to update bug entry with root cause
   - Update metadata and logs

3. **Checkpoint 3 (after propose-fix-approach.md):**
   - Instructions to update bug entry with proposal
   - Planning metadata updates

See "Detailed Workflow with Journal Tracking" section above for complete instructions.

### Weekly Journal Entry Format

Your weekly journal will track the bug investigation like this (complete example):

```markdown
### gh-XXXXX - [Bug Title]

**[YYYY-MM-DD] Investigation Started:**

- **Issue:** [Brief problem description]
- **Context:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`
- **Key Findings:**
  - [Finding 1]
  - [Finding 2]
- **Components:** `feature:st.xxx`, `area:xxx`

**[YYYY-MM-DD] Root Cause Analysis:**

- **Root Cause:** [Brief description]
- **Confidence:** High
- **Analysis:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md`
- **Key Findings:**
  - [Finding 1]
  - [Finding 2]

**Outstanding:**

- [ ] Propose fix approach (propose-fix-approach.md)

**GitHub Issue:** [#XXXXX](https://github.com/streamlit/streamlit/issues/XXXXX)
```

## Progress Tracking

Track your progress through the pipeline:

```markdown
Issue #**\_\_**: [Brief description]

- [ ] Context gathered (gather-bug-context.md)
      → Output: agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md

- [ ] Root cause analyzed (analyze-root-cause.md)
      → Output: agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md

- [ ] Fix proposal created (propose-fix-approach.md)
      → Output: agent-knowledge/local/notes/bug-analysis/gh-XXXXX-fix-proposal.md

- [ ] Fix implemented and PR created
      → Output: GitHub PR #**\_\_**

- [ ] PR reviewed and merged
      → Merged on: YYYY-MM-DD
```

**Where it's tracked:**

- **Weekly Journal:** `agent-knowledge/local/journals/active/weekly/YYYY-MM-DD-week.md`

**Note:** Commands include steps to update your weekly journal - just follow the instructions in each command!

---

## Output Locations

All bug fix outputs are saved to `agent-knowledge/local/notes/bug-analysis/`:

```
agent-knowledge/local/notes/bug-analysis/
├── gh-12345-context.md          # From gather-bug-context.md
├── gh-12345-root-cause.md       # From analyze-root-cause.md
├── gh-12678-context.md
├── gh-12678-root-cause.md
└── [etc.]
```

These files are **gitignored** (personal work files).

---

## Tips for Success

### Before You Start

1. **Set aside time:** Bug fixing is deep work, minimize interruptions
2. **Read the issue thoroughly:** Don't rush through comments
3. **Check for duplicates:** Issue might be related to others
4. **Verify reproduction:** Make sure the bug is reproducible
5. **Use weekly journal:** This pipeline is for regular development work, not rotation

### During the Process

1. **Take notes:** Document your thinking as you go (tracked in weekly journal)
2. **Test hypotheses:** Don't assume, verify
3. **Check git history:** Often reveals important context
4. **Ask for help:** Reach out to team if stuck
5. **Update journal:** Follow the journal update steps in each command

### After Analysis

1. **Review your work:** Read through analysis fresh
2. **Check confidence level:** Be honest about certainty
3. **Document unknowns:** Note what you're unsure about
4. **Share with team:** Get feedback on root cause before fixing
5. **Verify journal entry:** Ensure all details captured in weekly journal

---

## Common Scenarios

### Scenario: Bug in Triage, Need Analysis

**Situation:** You're on interrupt rotation, found a confirmed bug during triage

**Workflow:**

1. `gather-bug-context.md` - Compile all triage findings
2. `analyze-root-cause.md` - Deep dive into root cause
3. Update rotation journal with findings
4. Decide: Fix now or hand off to team?

---

### Scenario: Bug Assigned to You

**Situation:** Team assigned you a bug to fix

**Workflow:**

1. Check if context/analysis already exists
2. If not, run `gather-bug-context.md`
3. Run `analyze-root-cause.md` if needed
4. Proceed to fix implementation

---

### Scenario: Bug Reported by User, Unclear Details

**Situation:** User report is vague, needs investigation

**Workflow:**

1. `gather-bug-context.md` - Will help identify missing info
2. If context insufficient → Request more info from user
3. Once reproducible → `analyze-root-cause.md`
4. Then implement fix

---

### Scenario: Regression Bug After Deploy

**Situation:** Bug appeared after recent release

**Workflow:**

1. `gather-bug-context.md` - Focus on git history
2. `analyze-root-cause.md` - Compare to previous version
3. Git bisect if needed (manual)
4. Quick fix + PR

---

## Checkpoints & Reviews

Use these checkpoints to verify quality:

**After Context Gathering:**

- [ ] All comments reviewed (not just issue body)
- [ ] Rotation journals searched
- [ ] Reproduction notes checked (if applicable)
- [ ] Related issues identified
- [ ] Environment details documented
- [ ] Context document complete and organized

**After Root Cause Analysis:**

- [ ] Multiple hypotheses considered
- [ ] Code paths traced thoroughly
- [ ] Git history reviewed
- [ ] Confidence level assessed honestly
- [ ] Next steps clear
- [ ] Analysis document complete

**Before Creating Fix:**

- [ ] Root cause understood with high confidence
- [ ] Fix approach validated
- [ ] Edge cases considered
- [ ] Testing strategy planned

---

## Related Resources

**Commands:**

- `gather-bug-context.md` - Step 1: Gather context (pure tool)
- `analyze-root-cause.md` - Step 2: Analyze root cause (pure tool)
- `propose-fix-approach.md` - Step 3: Design fix (pure tool)
- `create-reproduction-app.md` - Optional: Visual reproduction (pure tool)

**Reference Guides:**

- `agent-knowledge/processes/issue-management/github-cli.local.md` - GitHub CLI reference
- `agent-knowledge/local/journals/README.md` - Journal system guide
- `agent-knowledge/local/notes/README.md` - Notes directory guide

**Journals for Tracking:**

- `agent-knowledge/local/journals/active/rotations/` - Rotation journals
- `agent-knowledge/local/journals/active/weekly/` - Weekly journals

---

## Quick Start

**Ready to begin? Follow these steps:**

1. **Identify issue number:** #**\_\_**

2. **Check for existing work:**

   ```bash
   ls agent-knowledge/local/notes/bug-analysis/gh-______-*
   ```

3. **Start at appropriate step:**

   - No files found → `gather-bug-context.md`
   - Only context exists → `analyze-root-cause.md`
   - Both exist → Review and proceed to fix

4. **Track in journal:**

   - Add entry to rotation or weekly journal
   - Note current stage of pipeline

5. **Execute command:**
   - Use Cursor commands or follow markdown guide

---

## Get Help

**Stuck or need guidance?**

- **For workflow questions:** See `.cursor/commands/bug-fix/README.md`
- **For GitHub CLI help:** See `agent-knowledge/processes/issue-management/github-cli.local.md`
- **For journal questions:** See `agent-knowledge/local/journals/README.md`
- **For team help:** Post in Slack or discuss in standup

---

**Ready? Let's fix some bugs! 🐛 → 🎉**

**Next:** Choose your starting point from the workflow decision tree above and execute the appropriate command.
