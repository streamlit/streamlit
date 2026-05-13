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

- [streamlit/agent-skills GitHub](https://github.com/streamlit/agent-skills) - Source for global meta skill
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
skill from GitHub to `~/.claude/skills/` instead of project-local bundled skills.

### Alternatives Considered

**Symlink vs copy installation**

| Option                    | Pros                                          | Cons                                         |
|---------------------------|-----------------------------------------------|----------------------------------------------|
| **Symlinks** (preferred)  | Auto-updates when Streamlit upgrades; no duplication | Not supported on all platforms (some Windows configs) |
| **Copy**                  | Works everywhere                              | Drifts from installed Streamlit; needs re-run after upgrades |
| **Hybrid** (chosen)       | Best of both: symlink by default, copy fallback | Slightly more complex implementation         |

Decision: Use symlinks by default with copy fallback. This keeps skills in sync for
most users while supporting platforms where symlinks fail.

**Project root detection**

| Option                                     | Pros                                    | Cons                                              |
|--------------------------------------------|-----------------------------------------|---------------------------------------------------|
| **Always current directory**               | Predictable                             | Wrong for monorepos or nested project structures  |
| **Git root only**                          | Clean, well-defined                     | Fails for non-git projects                        |
| **Heuristic** (chosen): existing dir > git root > cwd | Respects existing setup; finds repo root | Slightly magic; may surprise in edge cases        |

Decision: Use heuristic approach. Check for existing `.agents/` or `.claude/`
directories first, then fall back to git root, then current directory. This matches
user intent in the common case.

**Target directories**

| Option                                               | Pros                                     | Cons                                           |
|------------------------------------------------------|------------------------------------------|------------------------------------------------|
| **Generic `.agents/skills/` only**                   | Simple, agent-agnostic                   | Claude Code users must configure discovery     |
| **Claude Code only (`.claude/skills/`)**             | Works out of the box for Claude          | Excludes other agents                          |
| **Both** (chosen): `.agents/skills/` + `.claude/skills/` when Claude detected | Works for Claude and other agents | Two directories to manage                      |

Decision: Always install to `.agents/skills/` (generic) and also to `.claude/skills/`
when `~/.claude` exists. This gives Claude users immediate access while keeping the
generic location for other agents.

**Command naming**

| Option               | Pros                                    | Cons                                        |
|----------------------|-----------------------------------------|---------------------------------------------|
| `streamlit skills`   | Clear, matches library-skills naming    | New subcommand namespace                    |
| `streamlit install-skills` | Action-oriented                    | Verbose; "install" may imply pip            |
| `streamlit agents`   | Groups future agent commands            | Less specific to skills                     |

Decision: Use `streamlit skills` for clarity and alignment with library-skills.

**Global install source**

| Option                          | Pros                                          | Cons                                              |
|---------------------------------|-----------------------------------------------|---------------------------------------------------|
| **Fetch from GitHub** (chosen)  | Always latest discovery logic; decoupled from Streamlit releases | Requires network; potential version drift         |
| **Bundle in Streamlit**         | Works offline; version-matched                | Duplicates content; discovery script updates lag behind |
| **Symlink to cloned repo**      | Single source of truth                        | Requires separate clone; complex setup            |

Decision: Fetch from `streamlit/agent-skills` GitHub repository. The meta skill
is lightweight (discovery script + instructions), and decoupling it from Streamlit
releases allows faster iteration on the discovery logic. Network requirement is
acceptable since global install is a one-time setup operation.

### Interactive Flow

**Step 1: Choose install mode**

```text
$ streamlit skills

Streamlit Skills Installer  (magenta, bold)

Install mode:
  [p] Project (recommended) - skills available in this project only
  [g] Global - discovery skill available in all projects (requires network)
       ↑cyan    ↑green

Choice [p]:
```

Accepted input is case-insensitive:

- `Enter`, `p`, `project` -> project install
- `g`, `global` -> global install
- Invalid input -> re-prompt with "Invalid choice, please enter 'p', 'g', or press Enter"
- `Ctrl+C` or EOF -> cancel gracefully with "Aborted." message (exit 1)

**Step 2: Confirm installation**

For project install:

```text
Installing to project: /home/user/myproject  (bright blue path)

Skills to install:
  • developing-with-streamlit  (magenta bullet, cyan name)

Target directories:
  • .agents/skills/   (magenta bullet, cyan path)
  • .claude/skills/

Proceed with installation? [Y/n]:
```

For global install:

```text
Installing globally  (bright blue)

Skills to install:
  • developing-with-streamlit  (magenta bullet, cyan name)

Source: github.com/streamlit/agent-skills  (muted gray)

Target directories:
  • ~/.agents/skills/   (magenta bullet, cyan path)
  • ~/.claude/skills/   (if Claude Code detected)

Proceed with installation? [Y/n]:
```

Accepted input:

- `Enter`, `y`, `yes` -> proceed
- `n`, `no` -> cancel without changes

**Step 3: Result**

For project install:

```text
✓ Installed:  (green, bold)
  → .agents/skills/developing-with-streamlit   (green arrow, cyan path)
  → .claude/skills/developing-with-streamlit

✨ Successfully installed to /home/user/myproject  (green bold + bright blue path)

Note: Installed skills are symlinks to your local Streamlit environment.
      They generally should not be committed to git.
      (muted gray styling)
```

For global install:

```text
✓ Installed:  (green, bold)
  → ~/.agents/skills/developing-with-streamlit   (green arrow, cyan path)
  → ~/.claude/skills/developing-with-streamlit   (if Claude Code detected)

✨ Successfully installed globally  (green bold)

The discovery skill will automatically find project-specific Streamlit skills
when you work in any Streamlit project.
(muted gray styling)
```

Additional result states use colored indicators:
- `● Up to date:` (blue, bold) for already-installed skills
- `⚠ Skipped due to conflicts:` (yellow, bold) for conflicts

If generated links point into a local environment, the result should mention that
these are local developer files and generally should not be committed.

### Install Modes

| Mode | What's installed | Where | Source |
|------|------------------|-------|--------|
| **Project** (default) | Direct Streamlit skills (`developing-with-streamlit`) | `<project>/.agents/skills/` and `.claude/skills/` | Bundled in active Streamlit binary |
| **Global** | Meta skill with discovery script | `~/.agents/skills/` and `~/.claude/skills/` | Fetched from GitHub `streamlit/agent-skills` |

**Project install:** Installs the direct skills from the invoked `streamlit`
binary. It should prefer symlinks so skills stay in sync when Streamlit is
upgraded in place. If symlinks are not supported on the platform, the
implementation may fall back to copying and should tell the user that rerunning
`streamlit skills` is needed after upgrading Streamlit.

**Copy fallback version tracking:** When copying (instead of symlinking), the
implementation should store a version marker (e.g., `.streamlit-skills-version`
file containing the Streamlit version string) in each target directory. On
subsequent runs, compare this marker against the current Streamlit version to
detect "up to date" vs "needs refresh" states. If the marker is missing or
mismatched, overwrite Streamlit-owned copies.

**Global install:** Fetches the `developing-with-streamlit` meta skill from the
[`streamlit/agent-skills`](https://github.com/streamlit/agent-skills) repository
and copies it to the user's global agent skills directories. This mode requires:

- Network access to GitHub

Target directories:
- `~/.agents/skills/developing-with-streamlit/` (always)
- `~/.claude/skills/developing-with-streamlit/` (when `~/.claude` exists)

**What gets installed (global):**

```
~/.agents/skills/developing-with-streamlit/
├── SKILL.md           # Meta skill instructions
└── scripts/
    └── discover.py    # Discovery script

~/.claude/skills/developing-with-streamlit/  (if ~/.claude exists)
├── SKILL.md
└── scripts/
    └── discover.py
```

The discovery script (`discover.py`) dynamically locates the project's Streamlit
installation at runtime and returns the path to the bundled skills. This means:

- Agents get version-matched skills for each project automatically
- No need to re-run `streamlit skills --global` when Streamlit is upgraded
- Works across multiple projects with different Streamlit versions

**GitHub fetch details:**

- Repository: `https://github.com/streamlit/agent-skills`
- Branch: `main`
- Files to download:
  - `developing-with-streamlit/SKILL.md`
  - `developing-with-streamlit/scripts/discover.py`
- The command should use raw GitHub URLs or the GitHub API to fetch files
- On network failure, exit with a clear error message and non-zero status

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
- **Streamlit-owned symlink detection:** A symlink is considered Streamlit-owned
  if its target path resolves inside the active `streamlit` package directory
  (i.e., where `import streamlit; streamlit.__file__` points). Symlinks pointing
  elsewhere are treated as user-managed and skipped with a conflict warning.
- **Non-interactive usage:** Automation should pass `--yes`. If prompts cannot
  be shown, the command should fail with an actionable message rather than
  hanging.
- **Git hygiene:** The command should not edit `.gitignore` automatically, but
  the CLI output and docs should make clear whether generated files are local
  environment links or copied skill files.

## Follow-Up Work

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

| Item                       | ✅ or comment                                                                            |
|----------------------------|------------------------------------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | Yes - CLI-only, no runtime impact                                                        |
| No breaking API changes    | Yes - new command only                                                                   |
| No new dependencies        | Yes - Click already exists, otherwise stdlib                                             |
| Metrics collected          | Existing runtime metrics already detect installed skills; no new CLI telemetry proposed  |
| Any security/legal impact? | Low - local filesystem writes only; must avoid overwriting user-managed files            |
| Any docs changes needed?   | Yes - CLI reference plus a short setup note for bundled agent skills                     |
