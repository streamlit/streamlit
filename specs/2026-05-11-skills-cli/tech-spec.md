---
author: lukasmasuch
created: 2026-05-11
---

# `streamlit skills` CLI Command - Technical Design

## Summary

Add a Click subcommand in `lib/streamlit/web/cli.py` that installs bundled
Streamlit agent skills from the active Streamlit package. The initial
implementation should be small, filesystem-focused, and non-destructive:
discover the packaged skills, compute project targets, install links or copies,
and report results clearly.

See `product-spec.md` for the user-facing behavior and motivation.

## Current State

- Streamlit's CLI entry point is `streamlit.web.cli:main`, defined in
  `lib/streamlit/web/cli.py`.
- Bundled skills currently live under `lib/streamlit/.agents/skills/`.
- `lib/pyproject.toml` already includes package-data globs for bundled skill
  markdown files and app/theme template files.
- Runtime metrics already detect installed skills in known harness locations via
  `lib/streamlit/runtime/metrics_util.py`.
- The source tree currently has `developing-with-streamlit`.
- Global install is a follow-up because it requires a future bundled
  `finding-streamlit-skills` directory.

## Proposal

### Command Shape

Add the command near the other top-level CLI commands in
`lib/streamlit/web/cli.py`:

```python
@main.command("skills")
@click.option("-y", "--yes", is_flag=True, help="Skip confirmation prompts.")
def main_skills(yes: bool) -> None:
    """Install Streamlit AI-agent skills."""
```

Keep helper functions private to `cli.py` for v1. If this grows into multiple
commands such as `list` or `uninstall`, move the implementation to a dedicated
`streamlit/web/skills.py` module.

Do not expose `--global` until `finding-streamlit-skills` is bundled. Adding that
flag later is backwards-compatible.

### Source Discovery

Resolve bundled skills from the active Streamlit package:

```python
package_dir = Path(streamlit.__file__).parent
source_skills_dir = package_dir / ".agents" / "skills"
```

Validation rules:

- Raise `click.ClickException` if `source_skills_dir` is missing.
- A project-installable skill is a child directory containing `SKILL.md`.
- Exclude `finding-streamlit-skills` from project installs because it is a
  discovery/meta skill, not direct Streamlit development guidance.
- Sort skill names before showing or installing them for stable output.

### Project Root Detection

Use a stdlib ancestor walk instead of shelling out to `git`:

1. If `cwd/.agents` or `cwd/.claude` exists, use `cwd`.
2. Otherwise, walk up from `cwd` and use the nearest ancestor with a `.git`
   entry. `.git` may be either a directory or a file for worktrees.
3. Otherwise, use `cwd`.

This matches the product behavior without requiring the `git` executable.

### Target Selection

Project install targets:

- Always install to `<project>/.agents/skills/`.
- Also install to `<project>/.claude/skills/` when `~/.claude` exists.

Do not target `.codex/skills`, `.cursor/skills`, `.gemini/skills`, or other
harness-specific directories in v1. Runtime metrics can detect those locations,
but the installer should stay conservative until their install conventions are
confirmed.

### Install Semantics

Project mode should prefer symlinks:

- Compute a relative symlink target with `os.path.relpath(source, link.parent)`.
- Fall back to an absolute target only when relative paths cannot be computed
  (for example, Windows cross-drive paths).
- Use `target_is_directory=True` when creating directory symlinks.
- If symlink creation is unsupported, either fall back to copying or raise a
  clear error. If copying is used, output should say that users must rerun
  `streamlit skills` after upgrading Streamlit.

Conflict policy:

| Existing target | Behavior |
|-----------------|----------|
| Missing | Install link or copy |
| Symlink to the same source | Report `up to date` |
| Broken symlink that appears to be a previous Streamlit skill install | Replace it |
| Symlink to another Streamlit package copy of the same skill | Replace it |
| Symlink to an unrelated location | Skip and report conflict |
| Regular file or directory | Skip and report conflict |

The installer should not delete arbitrary user-managed files or directories.
A symlink can be treated as Streamlit-owned when it resolves under the current
`source_skills_dir` or its raw link target contains `.agents/skills/<skill-name>`
from a previous Streamlit environment. Otherwise, leave it alone and report a
conflict.

### Reporting

Report results per target path, not only per skill name. A skill can be newly
installed in `.agents/skills/` and already up to date in `.claude/skills/`; the
output should make that mixed state visible.

Use Click's `secho()` and `style()` for colored output:

```text
✓ Installed:  (green, bold)
  → .agents/skills/developing-with-streamlit  (green arrow, cyan path)

● Up to date:  (blue, bold)
  → .claude/skills/developing-with-streamlit  (blue arrow, cyan path)

⚠ Skipped due to conflicts:  (yellow, bold)
  → .agents/skills/developing-with-streamlit  (yellow arrow)
```

Color scheme:
- **Headers**: Bold with status-appropriate color (green=success, blue=info, yellow=warning)
- **Paths**: Cyan for visibility
- **Arrows**: Match header color for visual grouping
- **Notes**: Muted gray (`bright_black`) for de-emphasized information

Exit with code 0 when at least one selected target is installed, repaired, or up
to date. Exit non-zero when no selected target can be installed because of
conflicts or missing prerequisites.

### Packaging

The existing package-data glob in `lib/pyproject.toml` includes
`.agents/**/*.md`, so markdown skills under `lib/streamlit/.agents/skills/` are
included in the wheel. If future skill assets use additional extensions, update
package data explicitly instead of assuming hidden directories are fully
included.

Before enabling global mode in a follow-up, add:

```text
lib/streamlit/.agents/skills/finding-streamlit-skills/SKILL.md
```

Global mode should then copy that directory to `~/.claude/skills/` rather than
symlink it into the user's home directory. It should update an existing copy only
when its `SKILL.md` declares the expected `name: finding-streamlit-skills`, and
skip unrelated files or directories.

### Tests

Add focused unit tests in `lib/tests/streamlit/web/cli_test.py` using
`CliRunner.isolated_filesystem()` and temporary `HOME` directories.

Cover:

- `streamlit skills --yes` installs project skills into `.agents/skills/`.
- Claude detection adds `.claude/skills/` when `~/.claude` exists.
- Project root detection prefers an existing local `.agents` or `.claude`
  directory over a parent git root.
- Re-running the command reports up-to-date results.
- Existing regular files/directories are skipped, not overwritten.
- Broken Streamlit-owned symlinks are repaired.

Suggested targeted check:

```bash
uv run pytest lib/tests/streamlit/web/cli_test.py -k skills
```

Run `make check` before finalizing the PR.

## Alternatives Considered

### Copy Project Skills Instead of Symlinking

Copying is more portable and avoids committing symlinks that point into a local
environment, but copied skills drift from the installed Streamlit version until
the user reruns the command. Symlinks better express that the skill belongs to
the active Streamlit package.

The proposed compromise is to prefer symlinks and allow copy fallback when the
platform does not support them.

### Reuse `library-skills`

Delegating to `library-skills` would reduce custom installer logic, but it adds
another dependency/tool boundary and preserves the all-packages scan that this
feature is meant to avoid.

## Risks

- Symlinks into virtual environments are local developer artifacts and can be
  confusing if committed. CLI output and docs should call this out.
- Runtime metrics already know about more harnesses than the installer targets.
  Keep this intentional difference documented so reviewers do not assume missing
  installer support is accidental.

## Future Global Mode

Once `finding-streamlit-skills` is bundled, add:

```python
@click.option(
    "--global",
    "global_install",
    is_flag=True,
    help="Install the Claude Code discovery skill globally.",
)
```

Global mode should:

- Install only `finding-streamlit-skills` to `~/.claude/skills/`.
- Fail clearly when `~/.claude` is absent.
- Fail clearly if the meta skill is not bundled.
- Copy the meta skill rather than symlink it.
- Use focused tests for absent Claude Code, absent bundled meta skill, successful
  copy, idempotent rerun, and conflict handling.
