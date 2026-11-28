# Triage Pipeline Architecture

## Design Philosophy

The triage pipeline follows a **pure commands + orchestrator** pattern, separating workflow logic from tracking logic. This enables maximum flexibility while providing guided workflows for common use cases.

## Components

### Pure Workflow Commands

These commands are **tool-agnostic, reusable, and have no side effects** (except saving their output documents):

#### `gather-issues.md`

- **Purpose:** Find and list all issues with `status:needs-triage` label
- **Input:** GitHub CLI access
- **Process:** Fetch issues, create initial issue list
- **Output:** List of issues needing triage (displayed)
- **Side Effects:** None (just displays output)
- **Reusable:** ✅ Yes - can be used standalone, with any tracking system

#### `analyze-issue.md`

- **Purpose:** Deep analysis of a single issue, assess reproducibility, create technical notes
- **Input:** Issue number
- **Process:** Fetch issue details, classify, assess reproducibility, identify missing info
- **Output:** `st-issues/issues/gh-XXXXX/NOTES.md`
- **Side Effects:** None (just saves output document)
- **Reusable:** ✅ Yes - can be used standalone, with any tracking system

#### `create-playwright-test.md`

- **Purpose:** Create automated playwright test to reproduce bug
- **Input:** Issue number + NOTES.md from analysis
- **Process:** Create app.py + app_test.py, run test, interpret results
- **Output:** Test files in temp directory, copied to st-issues
- **Side Effects:** None (just saves output files)
- **Reusable:** ✅ Yes - can be used standalone

#### `create-repro-app.md`

- **Purpose:** Create visual app for manual verification, commit/push to deploy
- **Input:** Issue number + analysis
- **Process:** Create user-friendly app, validate, commit and push
- **Output:** `st-issues/issues/gh-XXXXX/app.py` (deployed)
- **Side Effects:** Git commit/push to st-issues (necessary for deployment)
- **Reusable:** ✅ Yes - can be used standalone

#### `confirm-bug.md`

- **Purpose:** Post bug confirmation comment with reproduction link
- **Input:** Issue number + deployed app URL
- **Process:** Draft comment, get approval, post, update labels
- **Output:** GitHub comment posted, labels updated
- **Side Effects:** GitHub comment and label changes (requires approval)
- **Reusable:** ✅ Yes - can be used standalone

#### `request-more-info.md`

- **Purpose:** Request missing details from reporter
- **Input:** Issue number + analysis identifying missing info
- **Process:** Draft request, get approval, post, update labels
- **Output:** GitHub comment posted, labels updated
- **Side Effects:** GitHub comment and label changes (requires approval)
- **Reusable:** ✅ Yes - can be used standalone

#### `request-team-decision.md`

- **Purpose:** Ask team if behavior is expected or a bug
- **Input:** Issue number + ambiguous analysis
- **Process:** Draft balanced request, get approval, post, update labels
- **Output:** GitHub comment posted, labels updated
- **Side Effects:** GitHub comment and label changes (requires approval)
- **Reusable:** ✅ Yes - can be used standalone

#### `report-cannot-reproduce.md`

- **Purpose:** Document inability to reproduce issue
- **Input:** Issue number + reproduction attempt documentation
- **Process:** Draft report, get approval, post, update labels
- **Output:** GitHub comment posted, labels updated
- **Side Effects:** GitHub comment and label changes (requires approval)
- **Reusable:** ✅ Yes - can be used standalone

#### `prioritize-bug.md`

- **Purpose:** Assign P0-P4 priority labels to confirmed bugs
- **Input:** Issue number + confirmation status
- **Process:** Evaluate against priority criteria, apply label
- **Output:** Priority label applied
- **Side Effects:** GitHub label changes
- **Reusable:** ✅ Yes - can be used standalone

#### `add-feature-labels.md`

- **Purpose:** Add feature:_ or area:_ labels to issues
- **Input:** Issue number + analysis
- **Process:** Match to existing labels, apply
- **Output:** Feature/area labels applied
- **Side Effects:** GitHub label changes
- **Reusable:** ✅ Yes - can be used standalone

### Reference Guides

These documents provide guidance but don't execute workflow steps:

#### `expected-vs-bug-assessment.md`

- **Purpose:** Framework for distinguishing bugs from expected behavior
- **Usage:** Reference during analysis and reproduction
- **Reusable:** ✅ Yes - standalone reference

#### `github-comment-guidelines.md`

- **Purpose:** Best practices for GitHub comments
- **Usage:** Reference when drafting any GitHub comment
- **Reusable:** ✅ Yes - standalone reference

### Orchestrator

The orchestrator provides **guided workflow with integrated tracking**:

#### `start-triage.md`

- **Purpose:** Guide through complete triage workflow with rotation journal tracking
- **Input:** Starting scenario (fresh start, resume, specific task)
- **Process:**
  - Step 0: Check prerequisites, prepare rotation journal
  - Step 1: Run `gather-issues.md` → ✋ Checkpoint: Update journal
  - Step 2: For each issue, run `analyze-issue.md` → ✋ Checkpoint: Update journal
  - Step 3: Run reproduction commands → ✋ Checkpoint: Update journal
  - Step 4: Run appropriate confirmation command → ✋ Checkpoint: Update journal
  - Step 5: Run classification commands → ✋ Checkpoint: Update journal
- **Output:** Guided workflow execution + rotation journal entries
- **Side Effects:** Updates rotation journal at checkpoints
- **Reusable:** Template for creating other orchestrators

## Key Principles

### 1. Separation of Concerns

**Workflow ≠ Tracking**

- Workflow commands focus ONLY on their core task
- Tracking is handled separately by orchestrator
- Clean boundaries enable flexibility

### 2. Single Responsibility

Each command has ONE clear purpose:

- `gather-issues.md` → Find issues
- `analyze-issue.md` → Analyze single issue
- `create-playwright-test.md` → Create automated test
- `create-repro-app.md` → Create visual app
- `confirm-bug.md` → Post confirmation
- `start-triage.md` → Orchestrate + track

### 3. Composability

Commands are building blocks that can be composed:

```
# Full pipeline with rotation journal
start-triage.md

# Quick issue analysis (no tracking)
analyze-issue.md (standalone)

# Just find issues
gather-issues.md (standalone)

# Custom workflow
analyze-issue.md + create-repro-app.md (no tracking)

# Future: Integration with bug-fix pipeline
analyze-issue.md → gather-bug-context.md → analyze-root-cause.md
```

### 4. Reusability

Commands are reusable across contexts:

| Command                     | Standalone | Rotation Journal | Bug Fix Pipeline | Research |
| --------------------------- | ---------- | ---------------- | ---------------- | -------- |
| `gather-issues.md`          | ✅         | ✅               | ❌               | ✅       |
| `analyze-issue.md`          | ✅         | ✅               | ✅               | ✅       |
| `create-playwright-test.md` | ✅         | ✅               | ✅               | ✅       |
| `create-repro-app.md`       | ✅         | ✅               | ✅               | ✅       |
| `confirm-bug.md`            | ✅         | ✅               | ❌               | ❌       |
| `start-triage.md`           | ❌         | ✅               | ❌               | ❌       |

### 5. Clear Checkpoints

Orchestrator provides explicit pause points:

```
▶ Run command
↓
📄 Output created
↓
✋ PAUSE: Review output, update journal
↓
▶ Next command
```

## Use Cases

### Use Case 1: Full Triage Pipeline (Most Common)

**Goal:** Systematic issue triage with complete rotation journal tracking

**Workflow:** Use `start-triage.md`

- Guided through each step
- Journal updates at checkpoints
- Complete audit trail

**When:** Interrupt rotation shifts

---

### Use Case 2: Quick Issue Analysis

**Goal:** Just need to analyze one issue, no full pipeline

**Workflow:** Use `analyze-issue.md` standalone

- No journal updates
- Just NOTES.md created
- Share with team or use for investigation

**When:** Quick checks, team discussions, researching related issues

---

### Use Case 3: Reproduce Specific Bug

**Goal:** Create reproduction for a known bug

**Workflow:** Use `create-playwright-test.md` and/or `create-repro-app.md` standalone

- No journal tracking
- Just reproduction files created
- Can be used during bug fixing

**When:** Bug fix workflow, verifying fixes

---

### Use Case 4: Add Labels to Backlog

**Goal:** Classify issues without full triage

**Workflow:** Use `add-feature-labels.md` and/or `prioritize-bug.md` standalone

- No full analysis required
- Just label application
- Quick cleanup tasks

**When:** Backlog grooming, sprint planning

---

### Use Case 5: Integration with Bug Fix Pipeline

**Goal:** Use triage analysis to inform bug fixing

**Workflow:** Run `analyze-issue.md` → then run bug-fix commands

- Triage analysis feeds into bug fix context
- NOTES.md can be referenced by `gather-bug-context.md`
- Seamless handoff between pipelines

**When:** Moving from triage to fix

---

## File Organization

```
.cursor/commands/triage/
├── README.md                           # Pipeline overview
├── ARCHITECTURE.md                     # This file - design documentation
│
├── Orchestrator
├── start-triage.md                     # Entry point / orchestrator
│
├── Phase 1: Discovery & Analysis
├── gather-issues.md                    # Find issues needing triage
├── analyze-issue.md                    # Analyze single issue
│
├── Phase 2: Reproduction
├── create-playwright-test.md           # Automated tests
├── create-repro-app.md                 # Visual app + deployment
│
├── Phase 3: Confirmation (choose one)
├── confirm-bug.md                      # Confirm bug
├── request-more-info.md                # Request info
├── request-team-decision.md            # Ask team
├── report-cannot-reproduce.md          # Cannot reproduce
│
├── Phase 4: Classification
├── prioritize-bug.md                   # Assign priority
├── add-feature-labels.md               # Add labels
│
└── Reference Guides
    ├── expected-vs-bug-assessment.md   # Assessment framework
    └── github-comment-guidelines.md    # Comment best practices
```

## Creating New Orchestrators

Want to create a workflow for a different context? Follow this pattern:

### Template Structure

```markdown
# Start [Workflow Name]

## Overview

[Purpose and context]

## [Workflow Name] Pipeline

[Visual diagram with checkpoints]

## Prerequisites

[What's needed]

## Step-by-Step Process

#### ✋ Step 0: Prepare [Tracking System]

[Setup instructions]

#### ▶ Step 1: [Command 1]

**Run:** [command-name.md]
**Output:** [output file]

#### ✋ Checkpoint 1: Update [Tracking System]

[Tracking update instructions]

#### ▶ Step 2: [Command 2]

...

## [Tracking System] Integration

[How tracking works]

## Tips for Success

[Context-specific tips]
```

## Benefits of This Architecture

### For Users

✅ **Flexibility** - Use commands however you need
✅ **Clarity** - Know what each command does
✅ **Guidance** - Orchestrator provides step-by-step workflow
✅ **Choice** - Full pipeline or à la carte

### For Developers

✅ **Modularity** - Easy to maintain and test
✅ **Extensibility** - Easy to add new commands
✅ **Reusability** - Commands work in any context
✅ **Composability** - Mix and match as needed

### For the Codebase

✅ **Clean boundaries** - Clear separation of concerns
✅ **Single responsibility** - Each file does one thing
✅ **DRY** - No duplication of workflow logic
✅ **Open/Closed** - Open for extension, closed for modification

## File Responsibilities

| File                         | Responsibility      | Side Effects             |
| ---------------------------- | ------------------- | ------------------------ |
| `gather-issues.md`           | Find issues         | None                     |
| `analyze-issue.md`           | Analyze issue       | Creates NOTES.md         |
| `create-playwright-test.md`  | Create test         | Creates test files       |
| `create-repro-app.md`        | Create app          | Git commit/push          |
| `confirm-bug.md`             | Post confirmation   | GitHub comment/labels    |
| `request-more-info.md`       | Request info        | GitHub comment/labels    |
| `request-team-decision.md`   | Ask team            | GitHub comment/labels    |
| `report-cannot-reproduce.md` | Report no-repro     | GitHub comment/labels    |
| `prioritize-bug.md`          | Add priority        | GitHub labels            |
| `add-feature-labels.md`      | Add feature labels  | GitHub labels            |
| `start-triage.md`            | Orchestrate + track | Updates rotation journal |
| `README.md`                  | Document pipeline   | None                     |

## Integration Points

### With Journals

- Rotation journal (`agent-knowledge/local/journals/active/rotations/`)
- Updated by orchestrator at checkpoints
- Commands don't know about journals

### With Notes

- Issue analysis notes (`st-issues/issues/gh-XXXXX/NOTES.md`)
- Created by workflow commands
- Consumed by orchestrator for tracking

### With Bug Fix Pipeline

- Analysis from `analyze-issue.md` feeds into `gather-bug-context.md`
- Reproduction files useful for both pipelines
- Seamless transition from triage to fixing

## Testing Strategy

### Testing Commands Individually

```bash
# Test gather-issues.md standalone
# Should work without any journal

# Test analyze-issue.md standalone
# Should work with just issue number, no journal

# Test create-repro-app.md standalone
# Should work with just issue analysis, no journal

# Test start-triage.md with journal
# Should coordinate all commands + update journal
```

### Verification Checklist

- [ ] Commands can run standalone (no journal errors)
- [ ] Orchestrator includes all journal instructions
- [ ] Checkpoints are clear and explicit
- [ ] Output documents created correctly
- [ ] Journal entries formatted properly
- [ ] Commands can be reused in other contexts

---

**This architecture enables maximum flexibility while providing guided workflows for common use cases.**
