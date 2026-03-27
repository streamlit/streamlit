---
name: updating-internal-docs
description: Review internal documentation (*.md files) against the current codebase state and propose updates for outdated or incorrect information.
---

# Updating Internal Documentation

Review internal documentation files against the actual codebase state and propose fixes for outdated, incorrect, or missing information.

## When to use

- After significant codebase changes (new features, refactors, tooling updates)
- When documentation drift is suspected
- After updating make targets, folder structure, dependencies, skills, or workflows

## Key files to check

Priority files (most likely to contain codebase-specific instructions):

- `**/AGENTS.md` - AI agent instructions
- `**/README.md` - Package/directory documentation
- `.claude/skills/*/SKILL.md` - Skill definitions
- `.claude/agents/*.md` - Subagent definitions
- `wiki/**/*.md` - Developer wiki
- `CONTRIBUTING.md` - Contributor guide

**Files to skip** (synced copies, updated separately):

- `.github/copilot-instructions.md`
- `.github/instructions/*.md`
- `.cursor/rules/*.mdc`

## Verification checklist

- [ ] Make commands exist and work (`make help`)
- [ ] File and folder paths exist
- [ ] Tool/dependency references are valid
- [ ] Tool version numbers match config files (see below)
- [ ] Testing instructions are correct
- [ ] Code examples match actual patterns
- [ ] Links resolve (internal and external)
- [ ] Skill/agent cross-references use current names
- [ ] `.github/workflows/AGENTS.md` reflects actual workflow files
- [ ] `CONTRIBUTING.md` skill/agent overview matches `.claude/skills/*/` and `.claude/agents/`

### Quick verification commands

```bash
# Check path exists: test -e path && echo ok || echo missing
# Check URL reachable: curl -sI -o /dev/null -w "%{http_code}" <url>
```

### Tool version sources

| Tool | Config file |
|------|-------------|
| TypeScript, React, Vite, Vitest, ESLint, oxfmt, Emotion | `frontend/package.json` |
| Yarn | `frontend/package.json` (`packageManager` field) |
| Python, Ruff, mypy, pytest | `pyproject.toml` |
| Node.js | `.nvmrc` |

## Issue types

| Type | Description |
|------|-------------|
| OUTDATED | Info no longer accurate (old make targets, renamed files) |
| INCORRECT | Factually wrong (wrong paths, invalid commands) |
| VERSION_MISMATCH | Documented version differs from actual |
| MISSING | Important info not documented |
| BROKEN_LINK | Links to non-existent resources |
| INCONSISTENT | Conflicts with other docs |

## Workflow

1. **Enumerate**: Find all markdown documentation files
2. **Verify**: Cross-reference documented commands, paths, and examples against the codebase
3. **Report**: Present findings grouped by priority
4. **Fix**: Apply changes after user approval

### Presenting findings

List all issues and let the user choose which to fix:

```
Documentation Review: {SCOPE}
═══════════════════════════════════════════════════════════════

Found {N} issues across {M} files:

1. [OUTDATED] AGENTS.md:42
   Current:  `make python-check`
   Actual:   Command renamed to `make python-lint`

2. [INCORRECT] wiki/testing.md:15
   Current:  Tests in `lib/tests/unit/`
   Actual:   Path is `lib/tests/streamlit/`

3. [BROKEN_LINK] CONTRIBUTING.md:88
   Current:  Link to `./docs/setup.md`
   Actual:   File does not exist

Which issues should I fix?
Recommended: "all"
Options: "1" | "1,2,3" | "all" | "skip 3"
```

## Rules

- **Verify before proposing**: Always check the codebase before suggesting a fix
- **Minimal changes**: Only change what's actually wrong
- **Test commands**: Run commands before documenting them
- **Keep style consistent**: Match existing documentation style

## After completing review

1. Present all findings to user
2. Get approval before making changes
3. Apply fixes incrementally
4. Run `/checking-changes` to validate

**Example summary:**

```
Fixed 3 of 4 issues:

- #1 [OUTDATED]: Updated make command in AGENTS.md
- #2 [INCORRECT]: Fixed test path in wiki/testing.md
- #3 [BROKEN_LINK]: Removed dead link in CONTRIBUTING.md
- #4 [INCONSISTENT]: Skipped - requires manual verification

Files modified:
  AGENTS.md         |  2 +-
  wiki/testing.md   |  4 ++--
  CONTRIBUTING.md   |  1 -
```
