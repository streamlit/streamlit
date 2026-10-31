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
  (`~/.agents/skills/`, and `~/.claude/skills/` when Claude Code is detected).
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
- [library-skills](https://github.com/tiangolo/library-skills) - Cross-package skill discovery tool

## Proposal

### CLI Interface

```bash
# Interactive project install (default)
streamlit skills

# Interactive global install (fetches from GitHub)
streamlit skills --global

# Non-interactive project install
streamlit skills --yes

# Non-interactive global install
streamlit skills --global --yes
```

`--yes` skips prompts and confirms installation. `--global` installs the meta
skill from GitHub to the user's global agent skills directories instead of
project-local bundled skills.

### Alternatives Considered

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Symlink vs copy** | Symlink only (global install fallback) | Auto-updates on upgrade; global fallback for no-symlink environments |
| **Project root detection** | Heuristic: existing dir > git root > cwd | Respects existing setup, finds repo root |
| **Target directories** | `.agents/skills/` + `.claude/skills/` if detected | Works for Claude and other agents |
| **Command naming** | `streamlit skills` | Clear, matches library-skills naming |
| **Global install source** | Fetch from GitHub, pinned to versioned tag | Decoupled from Streamlit releases, reproducible, explicit control over breaking changes |

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
- `<project>/.claude/skills/developing-with-streamlit/` (when Claude Code is detected)

**Project root detection:** Existing `.agents/` or `.claude/` dir → git root → cwd.

**Symlink behavior:**
- Symlinks preferred (auto-updates on Streamlit upgrade)
- A symlink is Streamlit-owned if it resolves inside the `streamlit` package
  directory; others are user-managed and skipped with conflict warning

**Environments without symlink support (e.g., Windows without Developer Mode):**
- Skip project install entirely and fall back to global install
- Show informational message explaining the fallback and how to enable symlinks
- Rationale: Copying bundled skills defeats the version-matching benefit (copies become
  stale on upgrade), and the global meta skill's `discover.py` provides equivalent
  functionality by locating project-specific skills at runtime

---

### Global Install

Fetches the `developing-with-streamlit` meta skill from
[`streamlit/agent-skills`](https://github.com/streamlit/agent-skills) and copies
it to user home directories. The meta skill's `discover.py` script dynamically
locates each project's bundled skills at runtime.

**Requires:** Network access to GitHub

**Targets:**
- `~/.agents/skills/developing-with-streamlit/` (always)
- `~/.claude/skills/developing-with-streamlit/` (when Claude Code is detected)

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

**GitHub fetch:** Downloads from a versioned tag (e.g., `v1`) via raw URLs or GitHub API.
On network failure, exits with clear error message.

**Versioning strategy:** The CLI pins to a major version tag (`v1`, `v2`, etc.) that is
updated in-place for non-breaking changes. Breaking changes in the skill itself ship as
a new major tag (e.g., `v2`), independent of Streamlit releases. This allows skill
improvements without Streamlit releases while providing explicit control over when
breaking changes roll out to users.

---

### Common Behavior

- **Claude Code detection:** Whether to install to `.claude/skills/` (both
  project-local and global) is decided by any of three signals: `~/.claude`,
  `~/.claude.json`, or a `claude` executable on `PATH`. Any one is enough,
  because the failure is asymmetric - Claude Code never reads `.agents/skills/`,
  so a missed detection costs the user the whole skill while a false positive
  costs a few unused symlinks. `~/.claude` alone is not sufficient: it is
  created lazily, so a freshly installed CLI has none yet. False positives
  (a leftover dir after uninstall) and false negatives (a `CLAUDE_CONFIG_DIR`
  pointing elsewhere with the CLI off `PATH`) are still accepted to keep
  detection simple.
- **Install completeness:** A skill present in only some of a scope's target
  directories counts as *not* installed, so the startup recommendation and the
  in-app nudge both prompt again and the re-run fills in the missing agent
  directory. Completeness is judged per scope and either scope satisfying it is
  enough, so a deliberate global-only install is not flagged in every project. An
  install that cannot be inspected at all - every target directory raises, e.g.
  on permissions - does not prompt: neither surface can tell, and the install
  they would recommend hits the same error. The startup recommendation reaches
  that by treating it as installed; the in-app nudge withholds under its own
  `check_unreadable` reason, so the two stay distinguishable in telemetry.
- **Who gets prompted:** The in-app nudge requires an agent harness to be
  present, judged by *either* detector - the home-directory harness list or the
  broader Claude Code detection above. Either is enough on purpose: a user
  detected broadly enough to be given a `.claude/skills` target is not reported
  as fully installed, so the startup recommendation prints for them. Gating
  the nudge on the narrower signal left that user nagged by the surface that
  cannot fix it and hidden from the one-click repair that can.
- **Idempotent:** Safe to run multiple times; reports "up to date" for existing
  installs, repairs broken links, skips user-managed files with conflict warning,
  and updates global skill if the versioned tag has changed on GitHub
- **Non-interactive:** Pass `--yes` for automation; fails with actionable message
  if prompts unavailable
- **Git hygiene:** Does not edit `.gitignore`; CLI output clarifies whether files
  are symlinks (don't commit) or copies and includes a recommended `.gitignore`
  snippet:
  ```
  # Streamlit agent skills (environment-specific symlinks)
  .agents/skills/developing-with-streamlit
  .claude/skills/developing-with-streamlit
  ```

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
| Any security/legal impact? | Low - local filesystem writes only; global install pins to versioned tag for reproducibility |
| Any docs changes needed?   | Yes - CLI reference plus a short setup note for bundled agent skills                     |
