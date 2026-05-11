---
author: lukasmasuch
created: 2026-05-11
---

# `streamlit skills` CLI Command

## Summary

Add a `streamlit skills` CLI command that installs Streamlit's bundled AI-agent
skills from the active Streamlit environment. The initial version focuses on
project-local installation so agents working in the current project get
version-matched Streamlit guidance.

Global installation should be a follow-up once Streamlit also bundles the
`finding-streamlit-skills` meta skill. That later mode can install Claude Code
discovery instructions for users who work across many Streamlit projects.

## Problem

Streamlit already bundles agent skills under `streamlit/.agents/skills/`, but
users have no first-party way to expose those skills to local coding agents after
installing Streamlit.

The existing solution is [library-skills](https://library-skills.io/)
(`uvx library-skills --claude`), which scans installed packages for skills. That
is useful for broad discovery, but it is heavier than the common Streamlit-only
case:

- Users need to discover and trust a separate tool.
- The scan covers all installed dependencies when the user only wants Streamlit
  guidance.
- The Streamlit skill can drift from the active `streamlit` binary if users copy
  files manually from docs or examples.

A first-party command gives users one simple setup step:

```bash
streamlit skills --yes
```

**Related:**

- [library-skills GitHub](https://github.com/tiangolo/library-skills)
- [library-skills SPEC](https://github.com/lukasmasuch/library-skills/blob/main/SPEC.md)

## Proposal

### CLI Interface

```bash
# Interactive project install by default
streamlit skills

# Non-interactive project install
streamlit skills --yes

# Future follow-up after finding-streamlit-skills is bundled
streamlit skills --global --yes
```

`--yes` skips prompts and confirms project installation. `--global` should not be
enabled until `finding-streamlit-skills` is bundled.

### Interactive Flow

**Step 1: Choose install mode**

```text
$ streamlit skills

Streamlit Skills Installer  (magenta, bold)

Install mode:
  [p] Project (recommended) - skills available in this project only
       ↑cyan    ↑green

Choice [p]:
```

Accepted input is case-insensitive:

- `Enter`, `p`, `project` -> project install

**Step 2: Confirm installation**

```text
Installing to project: /home/user/myproject  (bright blue path)

Skills to install:
  • developing-with-streamlit  (magenta bullet, cyan name)

Target directories:
  • .agents/skills/   (magenta bullet, cyan path)
  • .claude/skills/

Proceed with installation? [Y/n]:
```

Accepted input:

- `Enter`, `y`, `yes` -> proceed
- `n`, `no` -> cancel without changes

**Step 3: Result**

```text
✓ Installed:  (green, bold)
  → .agents/skills/developing-with-streamlit   (green arrow, cyan path)
  → .claude/skills/developing-with-streamlit

✨ Successfully installed to /home/user/myproject  (green bold + bright blue path)

Note: Installed skills are symlinks to your local Streamlit environment.
      They generally should not be committed to git.
      (muted gray styling)
```

Additional result states use colored indicators:
- `● Up to date:` (blue, bold) for already-installed skills
- `⚠ Skipped due to conflicts:` (yellow, bold) for conflicts

If generated links point into a local environment, the result should mention that
these are local developer files and generally should not be committed.

### Install Modes

| Mode | What's installed | Where | Use case |
|------|------------------|-------|----------|
| **Project** (default) | Direct Streamlit skills, excluding discovery/meta skills | `<project>/.agents/skills/` and, when Claude Code is detected, `<project>/.claude/skills/` | Most users; version-matched skills for the current project |
| **Global** (future) | `finding-streamlit-skills` meta skill | `~/.claude/skills/` | Claude Code users who want discovery instructions available in every project |

**Project install:** Installs the direct skills from the invoked `streamlit`
binary. It should prefer symlinks so skills stay in sync when Streamlit is
upgraded in place. If symlinks are not supported on the platform, the
implementation may fall back to copying and should tell the user that rerunning
`streamlit skills` is needed after upgrading Streamlit.

**Global install (future):** Installs only the `finding-streamlit-skills` meta
skill. That skill should teach the agent how to locate the bundled Streamlit
skills in the active Python environment instead of copying a full skill into the
user's home directory. This mode requires Claude Code (`~/.claude` must exist).

### Behavior Details

- **Version matching:** Skills come from the invoked `streamlit` binary, so the
  installed project skill matches the user's active Streamlit version.
- **Project root detection:** Install at the current directory if it already has
  `.agents/` or `.claude/`; otherwise install at the nearest git root; otherwise
  install at the current directory.
- **Agent detection:** Project install always targets `.agents/skills/`. It also
  targets `.claude/skills/` when `~/.claude` exists. Other agent-specific target
  directories are out of scope for v1.
- **Idempotent:** Safe to run multiple times. Existing matching installs report
  "up to date"; broken Streamlit-owned links are repaired; regular files,
  regular directories, or links that appear user-managed are skipped with a clear
  conflict message.
- **Non-interactive usage:** Automation should pass `--yes`. If prompts cannot
  be shown, the command should fail with an actionable message rather than
  hanging.
- **Git hygiene:** The command should not edit `.gitignore` automatically, but
  the CLI output and docs should make clear whether generated files are local
  environment links or copied skill files.

## Follow-Up Work

- Add `finding-streamlit-skills` under `lib/streamlit/.agents/skills/`, then
  enable `streamlit skills --global --yes`.
- Should project installs support `.codex/skills`, `.cursor/skills`, `.gemini/skills`,
  and other harness-specific directories? Recommendation: not in v1. The generic
  `.agents/skills/` target plus Claude compatibility keeps the first version
  small, and runtime metrics can still detect additional harnesses later.
- Should the command add a `--project-dir` option? Recommendation: defer until
  users report monorepo friction. The root-detection heuristic covers the common
  local project case without adding another option.

## Out of Scope

- Multi-package scanning. Use `uvx library-skills --claude` for that.
- Uninstall/list commands. Users can delete generated skill directories manually
  in v1.
- Installing into every known agent harness directory.
- Editing `.gitignore` or committing skills into a repository.

## Checklist

| Item                      | Status |
|---------------------------|--------|
| Works on SiS, Cloud, etc? | Yes - CLI-only, no runtime impact |
| No breaking API changes   | Yes - new command only |
| No new dependencies       | Yes - Click already exists, otherwise stdlib |
| Metrics collected         | Existing runtime metrics already detect installed skills; no new CLI telemetry proposed |
| Security/legal impact     | Low - local filesystem writes only; must avoid overwriting user-managed files |
| Docs changes needed       | Yes - CLI reference plus a short setup note for bundled agent skills |
