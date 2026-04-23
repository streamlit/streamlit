# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with skills in this repository.

## Overview

This directory contains Agent Skills for developing the Streamlit library. Skills are instruction sets that enhance AI coding assistants' capabilities for specific tasks in the Streamlit codebase.

These skills are for **Streamlit library development** (backend, frontend, protobufs), not for building Streamlit applications.

## Skill structure

Each skill is a directory containing a required `SKILL.md` file and optional supporting directories:

```
skills/
└── skill-name/
    ├── SKILL.md          # Required: Instructions for the AI agent
    ├── scripts/          # Optional: Executable code
    ├── references/       # Optional: Additional documentation
    └── assets/           # Optional: Static resources
```

### SKILL.md format

The `SKILL.md` file must include YAML frontmatter and markdown instructions:

```yaml
---
name: skill-name
description: Clear description of what this skill does and when to use it.
---

# Skill Name

Instructions for the AI agent...
```

### Required frontmatter fields

| Field | Description | Constraints |
|-------|-------------|-------------|
| `name` | Unique skill identifier | Lowercase letters, numbers, and hyphens only; max 64 chars |
| `description` | What the skill does and when to use it | Non-empty; max 1024 chars; include keywords |

## Naming conventions

| Item | Convention | Example |
|------|------------|---------|
| Skill directory | lowercase-with-hyphens (gerund form preferred) | `debugging-streamlit` |
| Skill file | Always `SKILL.md` | `SKILL.md` |
| Frontmatter name | Matches directory name | `name: debugging-streamlit` |

Use **gerund form** (verb + -ing) for skill names:
- `checking-changes`
- `debugging-streamlit`
- `finalizing-pr`

Avoid vague names (`helper`, `utils`) or reserved words (`anthropic-*`, `claude-*`).

## Best practices

For comprehensive guidance on writing effective skills, see the official [Agent Skills Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md).

Key points:

- **Be concise** - The context window is shared
- **Write specific descriptions** - Include what the skill does AND when to use it
- **Use third person** in descriptions (e.g., "Validates code changes" not "I validate code changes")
- **Keep file references one level deep** from SKILL.md
- **Use sentence casing** for titles and headers - Capitalize only the first word and proper nouns (e.g., "Creating a new skill" not "Creating a New Skill")
- **Verify all links are publicly accessible** - Ensure URLs point to existing, publicly available resources
- **Prefer `make` targets** - Skills should use existing `make` commands when available
- **Use `uv run`** - Any Python commands should use `uv run` (e.g., `uv run pytest`)

## Creating a new skill

1. Create a new directory in `.claude/skills/` with a descriptive name
2. Add a `SKILL.md` file with the required frontmatter
3. Write clear, actionable instructions for the AI agent

## Contributing

When adding or modifying skills:

1. Follow the existing skill structure
2. Ensure the skill is focused on a specific, well-defined task
3. Include practical examples and commands
4. Read the [best practices for skill writing](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices.md)
5. Review the skill against the best practices you just read
6. **Update the overview table in `CONTRIBUTING.md`** under "AI Agent Skills and Subagents" to include the new or modified skill/subagent with a brief description of when to use it
