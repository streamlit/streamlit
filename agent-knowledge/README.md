# Agent Knowledge Base

This directory contains documentation and guides designed for AI agents working on the Streamlit codebase.

## Purpose

Tool-agnostic knowledge base for AI-assisted development. Works with any AI tool (Cursor, Cline, Aider, etc.) and any task type (commands, pipelines, ad-hoc prompts).

## Quick Start

📖 **[See INDEX.md for a catalog of available resources](INDEX.md)**

## How to Use

1. **Starting a task?** Check [INDEX.md](INDEX.md) for relevant resources
2. **Creating a PR?** Use `.github/pull_request_template.md` and see [wiki/creating-prs.md](../wiki/creating-prs.md)
3. **Need help with a specific workflow?** Browse the [processes/](processes/) directory

## Contributing

### Local Experimentation

Keep files local while developing by using these patterns (automatically ignored by git):

- `*.local.md` - Individual local files (e.g., `draft-guide.local.md`, `notes.local.md`)
- `local/` - Directory for local experiments and work in progress

### Adding Shared Resources

To add a resource for the team:

1. Create the resource following existing patterns (if any exist)
2. Add YAML frontmatter to set team expectations:
   ```yaml
   ---
   status: stable | experimental
   last_updated: YYYY-MM-DD
   ---
   ```
   - `status: experimental` - Workflow being developed, team feedback welcome
   - `status: stable` - Established, reviewed workflow
3. Update INDEX.md to make it discoverable

## Relationship to Other Agent Resources

| Resource                    | When Loaded                 | Scope                   | Tool Support    |
| --------------------------- | --------------------------- | ----------------------- | --------------- |
| **AGENTS.md**               | Every prompt (always-on)    | Succinct, universal     | All tools       |
| **agent-knowledge/** (here) | On-demand (when referenced) | Detailed, task-specific | All tools       |
| **.cursor/commands/**       | Executed by user            | Executable workflows    | Cursor-specific |

**Key Distinctions:**

- **AGENTS.md**: Always injected → must be brief
- **agent-knowledge/**: Referenced on-demand → can be comprehensive
- **.cursor/commands/**: Executable workflows → tool-specific
