# Agent Definitions

This directory contains custom subagent definitions for Claude Code (and Cursor, which reads from this directory).

## File Format

Each agent is a Markdown file with YAML frontmatter. See the [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents) and [Cursor rules docs](https://docs.cursor.com/context/rules) for full details.

```markdown
---
name: agent-name           # Required: lowercase with hyphens
description: When to use   # Required: helps agents decide when to delegate
model: inherit             # Required: always use inherit
tools: Read, Grep, Glob    # Optional: restrict tools (inherits all if omitted)
disallowedTools: Write     # Optional: deny specific tools
skills:                    # Optional: preload skills into context
  - skill-name
memory: user               # Optional: user, project, or local
---

System prompt / instructions here...
```

## Best Practices

- **Focused scope**: Each agent should excel at one specific task
- **Clear descriptions**: Agents use this to decide when to delegate
- **Minimal tools**: Grant only necessary permissions
- **Actionable prompts**: Tell the agent what to do, not just what it is
- **Always use `model: inherit`**: Let the parent session control the model choice

## Cross-Platform Compatibility

These agents are the **single source of truth** for agent instructions:

| Platform | How it uses these agents |
|----------|--------------------------|
| Claude Code | Native support — reads `.claude/agents/` directly as subagents |
| Cursor | Uses `.cursor/rules/agents.mdc` (generated from this file) for context when editing agent files. Note: Cursor rules provide editing context only — Cursor does not execute these as subagents like Claude Code does. |
| Codex | `.codex/agents/*.toml` files reference these via `developer_instructions` |

**When adding a new agent:**
1. Create the agent file in this directory
2. Add the new file to `.claude/.gitignore` (allowlist pattern: `!agents/<name>.md`)
3. Create a matching command in `.claude/commands/` and add it to `.claude/.gitignore`
4. Add a Codex config in `.codex/agents/` and update `.codex/config.toml`
5. Run `uv run scripts/generate_agent_rules.py` to regenerate Cursor/Copilot rules

**When modifying an existing agent:**
1. Update the agent file — Codex picks up changes via `developer_instructions` reference
2. Note: Codex agent descriptions in `.codex/agents/*.toml` must be updated manually (they don't auto-sync from the Claude agent file)

## Slash Command Support

Each agent should have a corresponding command file in `.claude/commands/` to enable `/agent-name` invocation:

```markdown
---
description: Brief description of what the command does
---

Run the agent-name subagent to [do the task].
```

Example for `fixing-pr`:
```markdown
---
description: Fix CI failures and address PR review comments
---

Run the fixing-pr subagent to fix CI failures and address PR review comments for the current branch.
```

## Agent Inventory

| Agent | Purpose |
|-------|---------|
| `fixing-pr` | Fix CI failures and address PR review comments |
| `qa-testing-feature` | QA test features using Playwright |
| `reviewing-local-changes` | Code review for quality, security, best practices |
| `simplifying-local-changes` | Simplify and refine code changes |
