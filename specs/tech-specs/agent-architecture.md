# Agent Architecture

This document describes the skill and subagent architecture in `.claude/` for Streamlit development.

## Overview

The architecture consists of three types of components:

| Type | Location | Purpose |
|------|----------|---------|
| **Skills** | `.claude/skills/` | Instruction sets for specific tasks (invoked via `/skill-name`) |
| **Agents** | `.claude/agents/` | Autonomous subagents that can use multiple skills |
| **Commands** | `.claude/commands/` | Simple triggers that invoke subagents |
| **Hooks** | `.claude/hooks/` | Automatic triggers on tool events (PreToolUse, PostToolUse, Stop) |

## Architecture Diagram

```mermaid
flowchart TB
    subgraph "Orchestration Layer"
        FP_SKILL["/finalizing-pr<br/>(skill)"]
    end

    subgraph "Autonomous Agents"
        FP_AGENT["fixing-pr<br/>(agent)"]
        SLC_AGENT["simplifying-local-changes<br/>(agent)"]
        RLC_AGENT["reviewing-local-changes<br/>(agent)"]
    end

    subgraph "Task Skills"
        FSC["/fixing-streamlit-ci"]
        APRC["/addressing-pr-review-comments"]
        CC["/checking-changes"]
        CPR["/creating-pull-requests"]
    end

    subgraph "Development Skills"
        DS["/debugging-streamlit"]
        INF["/implementing-new-features"]
        DMC["/discovering-make-commands"]
    end

    subgraph "Make Commands"
        MA["make all"]
        MAF["make autofix"]
        MCH["make check"]
        MD["make debug"]
    end

    %% finalizing-pr orchestration
    FP_SKILL -->|"1. build"| MA
    FP_SKILL -->|"2. simplify"| SLC_AGENT
    FP_SKILL -->|"3. autofix"| MAF
    FP_SKILL -->|"4. validate"| CC
    FP_SKILL -->|"5. review"| RLC_AGENT
    FP_SKILL -->|"6. validate again"| CC
    FP_SKILL -->|"7. create PR"| CPR
    FP_SKILL -->|"8. fix CI & comments"| FP_AGENT

    %% fixing-pr agent uses
    FP_AGENT -->|"diagnose CI"| FSC
    FP_AGENT -->|"handle feedback"| APRC
    FP_AGENT -->|"validate"| CC

    %% simplifying-local-changes uses
    SLC_AGENT -->|"validate"| CC

    %% checking-changes wraps make check
    CC -.->|"runs"| MCH

    %% debugging skill uses make debug
    DS -.->|"runs"| MD

    %% implementing-new-features references
    INF -.->|"references"| MAF
    INF -.->|"references"| MCH
```

## Hooks System

Hooks are automatic triggers that run on specific tool events. They enforce policies and automate repetitive tasks without explicit invocation.

```mermaid
flowchart LR
    subgraph "Tool Events"
        BASH["Bash tool call"]
        EDIT["Edit/Write tool call"]
        STOP["Agent stop"]
    end

    subgraph "Hooks"
        PRE["pre_bash_redirect.py<br/>(PreToolUse)"]
        POST["post_edit_autofix.sh<br/>(PostToolUse)"]
        STOPH["stop_check.sh<br/>(Stop)"]
    end

    subgraph "Actions"
        BLOCK["Block + redirect<br/>to make run-e2e-test"]
        RUFF["ruff check --fix<br/>ruff format"]
        CHECK["make check<br/>(fast mode)"]
    end

    subgraph "Outcomes"
        ALLOW["✓ Allow"]
        DENY["✗ Block with message"]
        CONTINUE["↻ Continue fixing"]
    end

    BASH -->|"before"| PRE
    PRE -->|"pytest e2e_playwright"| BLOCK
    BLOCK --> DENY
    PRE -->|"other commands"| ALLOW

    EDIT -->|"after"| POST
    POST -->|"*.py files"| RUFF
    RUFF --> ALLOW

    STOP -->|"before stopping"| STOPH
    STOPH -->|"runs"| CHECK
    CHECK -->|"pass"| ALLOW
    CHECK -->|"fail"| CONTINUE
```

### Hook Details

| Hook | Event | Trigger | Action |
|------|-------|---------|--------|
| `pre_bash_redirect.py` | PreToolUse(Bash) | `pytest ... e2e_playwright` | Block and redirect to `make run-e2e-test` |
| `post_edit_autofix.sh` | PostToolUse(Edit\|Write) | Any `*.py` file | Auto-run `ruff check --fix` and `ruff format` |
| `stop_check.sh` | Stop | Agent finishing | Run `make check`; block if fails |

### Hook Behavior

**PreToolUse: `pre_bash_redirect.py`**
- Intercepts Bash commands before execution
- Blocks direct `pytest e2e_playwright/...` commands
- Provides feedback to use `make run-e2e-test <filename>` instead
- Enforces E2E test execution policy

**PostToolUse: `post_edit_autofix.sh`**
- Runs after Edit or Write operations complete
- Only processes Python files (`*.py`)
- Automatically formats with `ruff check --fix` then `ruff format`
- Reduces manual formatting steps

**Stop: `stop_check.sh`**
- Runs when agent is about to stop responding
- Executes `make check` in fast mode (skips slow type checks)
- If check fails: blocks stop, feeds errors back to agent to fix
- Prevents incomplete work from being considered "done"
- Has loop protection to prevent infinite fix cycles

## Component Details

### Orchestration Skill

#### `/finalizing-pr`
The main orchestration skill that prepares a branch for merge. It coordinates:
1. Build verification (`make all`)
2. Code simplification (`simplifying-local-changes` agent)
3. Auto-fixing (`make autofix`)
4. Validation (`/checking-changes`)
5. Code review (`reviewing-local-changes` agent)
6. PR creation/update (`/creating-pull-requests` patterns)
7. CI/PR maintenance (`fixing-pr` agent)

### Autonomous Agents

| Agent | Mode | Purpose | Skills Used |
|-------|------|---------|-------------|
| `fixing-pr` | Autonomous | CI fix loop: wait for CI, fix failures, address comments, push, repeat | `/fixing-streamlit-ci`, `/addressing-pr-review-comments`, `/checking-changes` |
| `simplifying-local-changes` | Autonomous | Refine code for clarity and maintainability | `/checking-changes` |
| `reviewing-local-changes` | Read-only | Code review (no edits) | None (read-only analysis) |

### Task Skills

| Skill | Purpose | Make Command |
|-------|---------|--------------|
| `/checking-changes` | Run format, lint, type, unit tests | `make check` |
| `/fixing-streamlit-ci` | Diagnose and fix CI failures | Various per failure type |
| `/addressing-pr-review-comments` | Handle PR review feedback | N/A (uses `gh` CLI) |
| `/creating-pull-requests` | Create draft PRs with proper format | `gh pr create` |

### Development Skills

| Skill | Purpose | Make Command |
|-------|---------|--------------|
| `/debugging-streamlit` | Debug with hot-reload | `make debug` |
| `/implementing-new-features` | Guide for new features | `make protobuf`, `make autofix`, `make check` |
| `/discovering-make-commands` | List available make targets | `make help` |

## Invocation Patterns

### Direct Skill Invocation
```
/checking-changes     → Runs make check
/debugging-streamlit  → Interactive debugging session
```

### Command → Agent
```
/reviewing-local-changes  → reviewing-local-changes agent
/simplifying-local-changes → simplifying-local-changes agent
/fixing-pr                 → fixing-pr agent
```

### Orchestrated Workflow
```
/finalizing-pr → runs multiple agents and skills in sequence
```

## Dependency Flow

```mermaid
flowchart LR
    subgraph "Entry Points"
        U((User))
    end

    subgraph "High-Level"
        FP["/finalizing-pr"]
    end

    subgraph "Mid-Level"
        FPA["fixing-pr agent"]
        SLA["simplifying agent"]
        RLA["reviewing agent"]
    end

    subgraph "Low-Level"
        CC["/checking-changes"]
        FSC["/fixing-streamlit-ci"]
        APRC["/addressing-pr-review-comments"]
        CPR["/creating-pull-requests"]
    end

    subgraph "Standalone"
        DS["/debugging-streamlit"]
        INF["/implementing-new-features"]
        DMC["/discovering-make-commands"]
    end

    U --> FP
    U --> FPA
    U --> SLA
    U --> RLA
    U --> DS
    U --> INF
    U --> DMC
    U --> CC

    FP --> SLA
    FP --> RLA
    FP --> FPA
    FP --> CC
    FP --> CPR

    FPA --> FSC
    FPA --> APRC
    FPA --> CC

    SLA --> CC
```

## File Structure

```
.claude/
├── settings.json                        # Permissions and hook configuration
├── skills/
│   ├── AGENTS.md                        # Skills documentation
│   ├── addressing-pr-review-comments/
│   │   └── SKILL.md
│   ├── checking-changes/
│   │   └── SKILL.md
│   ├── creating-pull-requests/
│   │   └── SKILL.md
│   ├── debugging-streamlit/
│   │   └── SKILL.md
│   ├── discovering-make-commands/
│   │   └── SKILL.md
│   ├── finalizing-pr/
│   │   └── SKILL.md                     # Orchestration skill
│   ├── fixing-streamlit-ci/
│   │   └── SKILL.md
│   └── implementing-new-features/
│       └── SKILL.md
├── agents/
│   ├── fixing-pr.md                     # Autonomous CI/PR loop
│   ├── reviewing-local-changes.md       # Read-only review
│   └── simplifying-local-changes.md     # Code simplification
├── commands/
│   ├── fixing-pr.md                     # Trigger for fixing-pr agent
│   ├── reviewing-local-changes.md       # Trigger for reviewing agent
│   └── simplifying-local-changes.md     # Trigger for simplifying agent
└── hooks/
    ├── pre_bash_redirect.py             # Block pytest e2e, redirect to make
    ├── post_edit_autofix.sh             # Auto-format Python files
    └── stop_check.sh                    # Run make check before stopping
```

## Settings Configuration

The `settings.json` file configures permissions and hooks:

```json
{
  "permissions": {
    "allow": ["Bash(make *)", "Bash(uv run pytest *)", "Bash(git *)", ...],
    "ask": ["Bash(git push *)", "Bash(git reset --hard *)", ...]
  },
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [...] }],
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [...] }],
    "Stop": [{ "hooks": [...] }]
  }
}
```

### Permission Categories

| Category | Commands | Behavior |
|----------|----------|----------|
| **Allow** | `make *`, `uv run *`, `yarn *`, `gh pr/issue/run *`, `git *` | Auto-approved |
| **Ask** | `git push`, `git reset --hard`, `git clean` | Requires user confirmation |
