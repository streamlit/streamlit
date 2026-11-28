# Bug Fix Pipeline Architecture

## Design Philosophy

The bug fix pipeline follows a **pure commands + orchestrator** pattern, separating workflow logic from tracking logic.

## Components

### Pure Workflow Commands

These commands are **tool-agnostic, reusable, and have no side effects** (except saving their output document):

#### `gather-bug-context.md`

- **Purpose:** Compile comprehensive bug context from multiple sources
- **Input:** Issue number
- **Process:** Fetch GitHub details, search journals, check reproduction notes, find related issues
- **Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-context.md`
- **Side Effects:** None (just saves output document)
- **Reusable:** ✅ Yes - can be used standalone, with any tracking system, or for exploration

#### `analyze-root-cause.md`

- **Purpose:** Perform deep root cause analysis
- **Input:** Issue number + context document
- **Process:** Identify components, analyze code paths, evaluate hypotheses, review git history
- **Output:** `agent-knowledge/local/notes/bug-analysis/gh-XXXXX-root-cause.md`
- **Side Effects:** None (just saves output document)
- **Reusable:** ✅ Yes - can be used standalone, with any tracking system, or for research

### Orchestrator

The orchestrator provides **guided workflow with integrated tracking**:

#### `start-bug-fix.md`

- **Purpose:** Guide through complete bug fix workflow with weekly journal tracking
- **Input:** Issue number
- **Process:**
  - Step 0: Prepare weekly journal
  - Step 1: Run `gather-bug-context.md` → ✋ Checkpoint 1: Update journal
  - Step 2: Run `analyze-root-cause.md` → ✋ Checkpoint 2: Update journal
  - Step 3: Run `create-fix-pr.md` → ✋ Checkpoint 3: Update journal
- **Output:** Guided workflow execution + weekly journal entries
- **Side Effects:** Updates weekly journal at checkpoints
- **Reusable:** Template for creating other orchestrators (rotation, research, etc.)

## Key Principles

### 1. Separation of Concerns

**Workflow ≠ Tracking**

- Workflow commands focus ONLY on their core task
- Tracking is handled separately by orchestrator
- Clean boundaries enable flexibility

### 2. Single Responsibility

Each command has ONE clear purpose:

- `gather-bug-context.md` → Gather context
- `analyze-root-cause.md` → Analyze root cause
- `start-bug-fix.md` → Orchestrate + track

### 3. Composability

Commands are building blocks that can be composed:

```
# Full pipeline with journal
start-bug-fix.md

# Quick context gathering
gather-bug-context.md (standalone)

# Research analysis
gather-bug-context.md + analyze-root-cause.md (no tracking)

# Custom workflow
gather-bug-context.md + [your tracking] + analyze-root-cause.md

# Future: Rotation workflow
start-bug-fix-rotation.md (same commands, different tracking)
```

### 4. Reusability

Commands are reusable across contexts:

| Command                 | Standalone | Weekly Journal | Rotation Journal | Research |
| ----------------------- | ---------- | -------------- | ---------------- | -------- |
| `gather-bug-context.md` | ✅         | ✅             | ✅               | ✅       |
| `analyze-root-cause.md` | ✅         | ✅             | ✅               | ✅       |
| `start-bug-fix.md`      | ❌         | ✅             | ❌               | ❌       |

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

### Use Case 1: Full Pipeline (Most Common)

**Goal:** Systematic bug fix with complete tracking

**Workflow:** Use `start-bug-fix.md`

- Guided through each step
- Journal updates at checkpoints
- Complete audit trail

**When:** Regular development bug fixing

---

### Use Case 2: Quick Investigation

**Goal:** Just need context, no full analysis

**Workflow:** Use `gather-bug-context.md` standalone

- No journal updates
- Just context document
- Share with team or review later

**When:** Triaging, quick checks, team discussions

---

### Use Case 3: Research Analysis

**Goal:** Analyze bug for learning, not fixing

**Workflow:** Use both commands standalone

- `gather-bug-context.md` → context
- `analyze-root-cause.md` → analysis
- No journal tracking

**When:** Studying codebase, research, training

---

### Use Case 4: Interrupt Rotation (Future)

**Goal:** Bug analysis during rotation with rotation journal

**Workflow:** Create `start-bug-fix-rotation.md`

- Reuses same gather and analyze commands
- Different journal update instructions (rotation journal)
- Different tracking format

**When:** On interrupt rotation shift

---

### Use Case 5: Team Collaboration

**Goal:** Share context/analysis with team

**Workflow:** Run commands, share output documents

- Generate documents without journal
- Share via Slack, GitHub, etc.
- Team can review without accessing your journal

**When:** Complex bugs needing team input

---

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

### Examples of Future Orchestrators

**start-bug-fix-rotation.md:**

- Same workflow commands
- Rotation journal tracking
- Issues Processed section format
- Pending Actions updates

**start-quick-triage.md:**

- Uses `gather-bug-context.md` only
- No analysis step
- Lightweight journal tracking
- For fast triage work

**start-research-dive.md:**

- Uses both commands
- No journal tracking
- Focus on learning
- For codebase exploration

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

| File                    | Responsibility      | Side Effects           |
| ----------------------- | ------------------- | ---------------------- |
| `gather-bug-context.md` | Gather context      | None                   |
| `analyze-root-cause.md` | Analyze root cause  | None                   |
| `start-bug-fix.md`      | Orchestrate + track | Updates weekly journal |
| `README.md`             | Document pipeline   | None                   |

## Integration Points

### With Journals

- Weekly journal (`agent-knowledge/local/journals/active/weekly/`)
- Updated by orchestrator at checkpoints
- Commands don't know about journals

### With Notes

- Bug analysis notes (`agent-knowledge/local/notes/bug-analysis/`)
- Created by workflow commands
- Consumed by orchestrator for tracking

### With Other Workflows

- Interrupt rotation (`.cursor-experimental/commands/interrupt/`)
- Can reuse workflow commands with different orchestrator
- Same tools, different tracking

## Testing Strategy

### Testing Commands Individually

```bash
# Test gather-bug-context.md standalone
# Should work without any journal

# Test analyze-root-cause.md standalone
# Should work with just context document, no journal

# Test start-bug-fix.md with journal
# Should coordinate both + update journal
```

### Verification Checklist

- [ ] Commands can run standalone (no journal errors)
- [ ] Orchestrator includes all journal instructions
- [ ] Checkpoints are clear and explicit
- [ ] Output documents created correctly
- [ ] Journal entries formatted properly
- [ ] Commands can be reused in other contexts

## Future Enhancements

1. **Create rotation orchestrator** - Reuse commands with rotation journal
2. **Create lightweight orchestrators** - For quick workflows
3. **Add more pure commands** - verify-fix.md, create-test.md, etc.
4. **Plugin system** - Allow custom tracking plugins
5. **Template generator** - Auto-create orchestrators for different contexts

---

**This architecture enables maximum flexibility while providing guided workflows for common use cases.**
