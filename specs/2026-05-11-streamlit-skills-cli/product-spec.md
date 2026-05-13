---
author: lukasmasuch
created: 2026-05-11
---

# `streamlit skills` CLI Command

## Summary

Add a `streamlit skills` CLI command that installs Streamlit's AI-agent skills.
Two installation modes are supported:

- **Project (default):** Installs bundled skills from the active Streamlit
  environment via symlinks, giving version-matched guidance for the current project.
- **Global:** Fetches the `developing-with-streamlit` meta skill from the
  [`streamlit/agent-skills`](https://github.com/streamlit/agent-skills) GitHub
  repository and installs it to the user's global agent skills directories
  (`~/.agents/skills/` and `~/.claude/skills/` if Claude Code is detected).
  This meta skill includes a discovery script that dynamically locates
  project-specific bundled skills at runtime.

## Problem

Streamlit already bundles agent skills under `streamlit/.agents/skills/`, but
users have no first-party way to expose those skills to local coding agents after
installing Streamlit.

The existing solution is [library-skills](https://library-skills.io/)
(`uvx library-skills`), which scans installed packages for skills. That
is useful for broad discovery, but it is heavier than the common Streamlit-only
case:

- Users need to discover and trust a separate tool.
- The scan covers all installed dependencies when the user only wants Streamlit
  guidance.
- The Streamlit skill can drift from the active `streamlit` binary if users copy
  files manually from docs or examples.

A first-party command gives users one simple setup step:

```bash
streamlit skills
```

Alternatively, users can install the meta skill via
[`npx skills`](https://github.com/vercel/skills), a cross-agent installer that
supports Claude Code, Cursor, Copilot, Gemini CLI, Codex, and others:

```bash
npx skills add streamlit/agent-skills -s developing-with-streamlit -g
```

The `streamlit skills` command provides a Streamlit-native experience without
requiring Node.js, and ensures version-matched skills for project installs.

**Related:**

- [streamlit/agent-skills GitHub](https://github.com/streamlit/agent-skills) - Source for global meta skill
- [npx skills (vercel/skills)](https://github.com/vercel/skills) - Cross-agent skill installer
- [library-skills GitHub](https://github.com/tiangolo/library-skills)
- [library-skills SPEC](https://github.com/tiangolo/library-skills/blob/main/SPEC.md)

## Proposal

### CLI Interface

```bash
# Interactive project install by default
streamlit skills

# Non-interactive project install
streamlit skills --yes

# Global install (fetches from GitHub)
streamlit skills --global --yes
```

`--yes` skips prompts and confirms installation. `--global` installs the meta
skill from GitHub to the user's global agent skills directories instead of
project-local bundled skills.

### Alternatives Considered

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Symlink vs copy** | Hybrid (symlink default, copy fallback) | Auto-updates on upgrade; fallback for Windows |
| **Project root detection** | Heuristic: existing dir > git root > cwd | Respects existing setup, finds repo root |
| **Target directories** | `.agents/skills/` + `.claude/skills/` if detected | Works for Claude and other agents |
| **Command naming** | `streamlit skills` | Clear, matches library-skills naming |
| **Global install source** | Fetch from GitHub | Decoupled from releases, allows fast iteration |

### Interactive Flow

```text
$ streamlit skills

Streamlit Skills Installer

Install mode:
  [p] Project (recommended) - skills available in this project only
  [g] Global - discovery skill available in all projects (requires network)

Choice [p]: _
```

After mode selection, show confirmation with target directories and source (for global).
On completion, show installed paths with status indicators:
- `✓ Installed:` (green) for new installs
- `● Up to date:` (blue) for existing matching installs
- `⚠ Skipped:` (yellow) for conflicts

Input handling:
- `Enter`/`p`/`project` → project install; `g`/`global` → global install
- `y`/`yes`/`Enter` → confirm; `n`/`no` → cancel
- `Ctrl+C` → abort with "Aborted." (exit 1)
- Invalid input → re-prompt

### Project Install (Default)

Creates symlinks from project agent skills directories to bundled skills in the
active Streamlit installation, ensuring version-matched guidance.

**Targets:**
- `<project>/.agents/skills/developing-with-streamlit/` (always)
- `<project>/.claude/skills/developing-with-streamlit/` (when `~/.claude` exists)

**Project root detection:** Existing `.agents/` or `.claude/` dir → git root → cwd.

**Symlink behavior:**
- Symlinks preferred (auto-updates on Streamlit upgrade)
- Copy fallback for platforms without symlink support (stores version marker for
  staleness detection)
- A symlink is Streamlit-owned if it resolves inside the `streamlit` package
  directory; others are user-managed and skipped with conflict warning

---

### Global Install

Fetches the `developing-with-streamlit` meta skill from
[`streamlit/agent-skills`](https://github.com/streamlit/agent-skills) and copies
it to user home directories. The meta skill's `discover.py` script dynamically
locates each project's bundled skills at runtime.

**Requires:** Network access to GitHub

**Targets:**
- `~/.agents/skills/developing-with-streamlit/` (always)
- `~/.claude/skills/developing-with-streamlit/` (when `~/.claude` exists)

**What gets installed:**
```
developing-with-streamlit/
├── SKILL.md           # Meta skill instructions
└── scripts/
    └── discover.py    # Locates project's bundled skills
```

**Benefits:**
- Version-matched skills for each project automatically
- No re-run needed when Streamlit is upgraded
- Works across projects with different Streamlit versions

**GitHub fetch:** Downloads from `main` branch via raw URLs or GitHub API.
On network failure, exits with clear error message.

---

### Common Behavior

- **Idempotent:** Safe to run multiple times; reports "up to date" for existing
  installs, repairs broken links, skips user-managed files with conflict warning
- **Non-interactive:** Pass `--yes` for automation; fails with actionable message
  if prompts unavailable
- **Git hygiene:** Does not edit `.gitignore`; CLI output clarifies whether files
  are symlinks (don't commit) or copies

## Follow-Up Work

- Support for other agent directories (`.codex/skills`, `.cursor/skills`, etc.) —
  defer to v2 based on metrics/demand
- `--project-dir` option for monorepos — defer until users report friction

## Out of Scope

- Multi-package scanning. Use `uvx library-skills` for that.
- Uninstall/list commands. Users can delete generated skill directories manually
  in v1.
- Installing into every known agent harness directory.
- Editing `.gitignore` or committing skills into a repository.

## Checklist

| Item                       | ✅ or comment                                                                            |
|----------------------------|------------------------------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | Yes - CLI-only, no runtime impact                                                        |
| No breaking API changes    | Yes - new command only                                                                   |
| No new dependencies        | Yes - Click already exists, otherwise stdlib                                             |
| Metrics collected          | Existing runtime metrics already detect installed skills; no new CLI telemetry proposed  |
| Any security/legal impact? | Low - local filesystem writes only; must avoid overwriting user-managed files            |
| Any docs changes needed?   | Yes - CLI reference plus a short setup note for bundled agent skills                     |
