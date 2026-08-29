---
author: lukasmasuch
created: 2026-08-29
---

# Defensive Streamlit agent-skill discovery

## Summary

Harden the **meta-skill** that `streamlit skills` installs so agents find this
**project's** bundled Streamlit skill (`<streamlit>/.agents/skills/developing-with-streamlit/SKILL.md`).
Failures are unobservable in production, so discovery must not return a confidently wrong
path.

Scope is **`streamlit skills` only** (project default, `--global`, Windows no-symlink
fallback to global). Third-party installers are out of band. No `st.*` API changes.

## Problem

`streamlit skills` copies from the **local wheel** (no GitHub fetch; see #15933):

| Mode | Installed | `discover.py` |
|---|---|---|
| **Project** (default) | Symlinks to bundled **content** skills | Unused |
| **Global** (`--global`) | Meta-skill → `~/.agents/skills/` (and `~/.claude/skills/` if present) | Required |
| **Windows, no Developer Mode** | Same global copy (symlink fallback) | Required |

Today `discover.py` picks **one** interpreter and stops. Wrong or noisy answers:

| Failure | Result |
|---|---|
| Stale `$VIRTUAL_ENV` without Streamlit, project `.venv` has it | Project venv never probed. The only vendored test forces `VIRTUAL_ENV` because `sys.executable` is ignored (`skills_test.py`). |
| Probe stdout banners | `Path(stdout.strip())` → silent "predates skills" |
| Windows conda `%CONDA_PREFIX%\python.exe` | Not checked (`bin/python` / `Scripts/python.exe` only) |
| `python3` Store stub (`WindowsApps`) | Misreported as "not installed"; no `py -3` |
| `text=True` on cp1252 | Crash on non-ASCII user paths |
| `uv run` without `--no-sync` | May create/sync a venv |
| First candidate missing Streamlit | Install advice even when another candidate would work |
| Skill files on disk, subprocess required | Sandbox / stub / broken import → fail |
| Uncaught exception | Traceback, no docs fallback |
| Local `streamlit.py` on `sys.path[0]` | `find_spec` / `import` both resolve the demo file |

The meta `SKILL.md` is a one-line `python <SKILL_DIR>/...` with no fallback. Its
`allowed-tools` pre-approves `python`/`python3` only and does not match the body.

Python CI is Ubuntu-only; discovery coverage is one forced happy path.

**Same name, two skills:** project mode puts the **content** skill at
`.agents/skills/developing-with-streamlit`; global puts the **meta** skill at
`~/.agents/skills/developing-with-streamlit`. Assumed: project-local wins over user-global.
Not renaming in this work.

## Goals

1. Return a usable bundled `SKILL.md` from this **project** when one exists, without
   importing Streamlit and without installing/syncing packages.
2. Never treat a missing/old/wrong candidate as terminal if a later one would work.
3. On total failure: stable error, attempt log, docs URL, and a short manual ladder in
   `SKILL.md`.
4. Prove the Windows layouts on a real `windows-latest` runner (narrow job).

## Out of scope

- Hatch, pixi, pyenv-virtualenv, direnv, `UV_PROJECT_ENVIRONMENT` (use `--python` or the
  manual ladder).
- Changing symlink install / the Windows global fallback in `skills.py`.
- `npx skills` / GitHub `agent-skills` lockstep.
- Cursor/Codex/Gemini-only frontmatter.
- Full Windows Python test matrix.
- Renaming the meta-skill.
- Content-skill POSIX `grep`/`lsof` cleanup — **follow-up PR** (orthogonal; dropping
  `lsof` also changes “list all Streamlit ports” behavior).

## Locked decisions

| Topic | Decision |
|---|---|
| Probe order | **Per candidate:** filesystem then subprocess, then the next candidate. Not “all filesystem, then all subprocess” (that lets a low-priority conda prefix beat an editable `$VIRTUAL_ENV`). |
| Project vs `$VIRTUAL_ENV` | **Project-local `.venv` / `venv` first** (this skill is for the app). `$VIRTUAL_ENV` next. Both having modern Streamlit must not prefer a leftover activated env. Override: `--python`. |
| Unusable Streamlit | `TOO_OLD` / `INCOMPLETE` / `LAYOUT_CHANGED` are **recorded**, not terminal. Only a usable `SKILL.md` short-circuits. |
| “Read-only” | Means **no intentional install/sync**. Filesystem + direct `python -c` by default. `poetry run` / `uv run --no-sync` only if no prefix worked. Python may still run `.pth` / `sitecustomize`. |
| `--project-dir` | Expand `~` / env vars; light MSYS `/c/...` → `C:\...`. If still not a directory → **`ERROR[INVALID_ARGS]`**, do not fall back to cwd. |
| `--python` | Keep. Exclusive. The hatch/pixi/“use this env” escape hatch. |
| `allowed-tools` | `Read`, `Glob`, and **script-anchored** `Bash(${CLAUDE_SKILL_DIR}/scripts/discover.py *)`. **Not** `Bash(python *)`. Accept a one-time prompt. No `PowerShell(...)` twin. |
| Agent branching | Exit 0 → Read the stdout path. Non-zero → manual ladder. IDs are for humans and tests. |
| `compatibility` | **Omit.** Hosts may hide the skill. |
| Extra dir names | `.venv` always; `venv` only if `pyvenv.cfg` exists. **Not** `env/`. |
| Version vs missing files | Metadata version `< 1.57` → `TOO_OLD`. Version `>= 1.57` (or unknown) but files missing → `INCOMPLETE`. `.agents/skills/` present, expected file missing → `LAYOUT_CHANGED`. |

## Proposal

### 1. Per-candidate discovery

Walk candidates in this order. For each **env prefix**, try filesystem lookup; on miss,
if there is an interpreter, run the subprocess probe. Continue until a **usable**
`SKILL.md` is found or the list (or wall clock) is exhausted.

1. `--python` — exclusive; do not continue on failure
2. `<project>/.venv`, then `<project>/venv` if `pyvenv.cfg` exists
3. Same on parent, then git root (skip duplicates)
4. `$VIRTUAL_ENV`
5. `$CONDA_PREFIX`
6. `sys.executable` if not already listed (`launcher`)
7. `pipenv` / `poetry` / `pdm` / `uv run --no-sync --quiet python` when the CLI is on
   `PATH` and the lockfile/`Pipfile` exists at `project_dir` or an ancestor up to git root
8. Windows: `py -3`
9. System: Windows `python` then `python3`; POSIX `python3` then `python`. Skip
   `WindowsApps` stubs (and 0-byte aliases)

`find_venv_python(root)`:

| Platform | Paths |
|---|---|
| Windows | `<root>\python.exe` (conda), `<root>\Scripts\python.exe` |
| POSIX | `<root>/bin/python`, `<root>/bin/python3` |

**Filesystem (per prefix):**

| Layout | Path |
|---|---|
| Windows | `<prefix>\Lib\site-packages\streamlit` |
| POSIX | `<prefix>/lib/python*/site-packages/streamlit` (if several, prefer one that already has the skill file; else `pyvenv.cfg` `version_info`) |

Editable installs (`.pth`) are a filesystem miss; the subprocess `find_spec` step handles
them.

**Wall clock:** 60s global budget. Stop enumerating when hit; attempt log marks the rest
`not tried`. Per-candidate timeouts: ~15s direct, ~30s manager wrappers.

### 2. Subprocess probe

Never `import streamlit`. Child uses `python -P` (not `-I`: `-I` implies `-E` and drops
`PYTHONUTF8`). Strip `''` from `sys.path` before `find_spec`. Require a real package:

- `spec.submodule_search_locations` is set (not a lone `streamlit.py`)
- `Path(spec.origin).name == "__init__.py"` and parent name is `streamlit`
- That path is **not** under `project_dir` (reject local shadowing)

Print `STREAMLIT_PKG=<package-dir>` (last such line wins). Parent ignores banners.
Empty/garbage stdout → record `PROBE_FAILED`, continue.

Child env: `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`. Parent `encoding="utf-8"`;
`errors="replace"` only as a decode guard. Reconfigure **this** script’s stdout to UTF-8
**without** replacing characters (must not corrupt the success path).

Catch `TimeoutExpired`, `FileNotFoundError`, `PermissionError`, `OSError`, `ValueError`,
`UnicodeError`. `main()` converts anything else to `ERROR[INTERNAL]` (no traceback).

Custom argparse so invalid flags print `ERROR[INVALID_ARGS]`, not argparse’s default
usage block as the first line.

### 3. Outcomes, exit codes, precedence

Shared helper classifies a package dir (filesystem or probe). Usable `SKILL.md` → print
**exactly one** absolute path on stdout, exit 0.

Read `importlib.metadata.version("streamlit")` from that install when possible (in the
child, or from `dist-info` next to the package). Do not infer “too old” from missing
files alone.

| ID | Exit | Meaning |
|---|---|---|
| (success) | 0 | Usable `SKILL.md`; stdout is that path only |
| `ERROR[NO_STREAMLIT]` | 1 | Every candidate lacked Streamlit |
| `ERROR[STREAMLIT_TOO_OLD]` | 2 | Best leftover: version `< 1.57` |
| `ERROR[NO_PROJECT_PYTHON]` | 3 | Nothing started (`sys.executable` should make this rare) |
| `ERROR[SKILLS_LAYOUT_CHANGED]` | 4 | `.agents/skills/` exists, expected file missing |
| `ERROR[INVALID_ARGS]` | 5 | Bad `--python` / `--project-dir` / unknown flag |
| `ERROR[INTERNAL]` | 6 | Unexpected exception |
| `ERROR[STREAMLIT_INCOMPLETE]` | 7 | Version `>= 1.57` or unknown, skill files missing |
| `ERROR[PROBE_FAILED]` | 1 | Used only in the attempt log for a candidate; overall exit follows the table below if nothing usable was found |

**Non-success precedence** (after all candidates, highest listed wins):

`LAYOUT_CHANGED` > `INCOMPLETE` > `TOO_OLD` > `NO_STREAMLIT` / `PROBE_FAILED` >
`NO_PROJECT_PYTHON`

Every non-zero stderr block **ends** with `https://docs.streamlit.io/llms-full.txt`.
Non-`INVALID_ARGS` failures also include an attempt log (`tried` / `not tried`).

Install/upgrade advice is **last**, only if no candidate had a modern complete skill.
Quote paths. No `source .venv/bin/activate`. Prefer `uv add` / `uv pip` when `uv.lock`
is present.

### 4. CLI

```text
python scripts/discover.py --project-dir <DIR> [--python <EXECUTABLE>]
```

`--project-dir` defaults to cwd when omitted. When passed and invalid after expansion →
exit 5.

### 5. Meta-skill `SKILL.md`

Stay in the six spec fields: `name`, `description`, `license`, `metadata`,
`allowed-tools` (no `compatibility`). Description: third person, triggers in this field,
≤1024 chars. `license: Apache-2.0`.

```yaml
allowed-tools: Read Glob Bash(${CLAUDE_SKILL_DIR}/scripts/discover.py *)
```

A permission prompt is acceptable; the manual ladder covers a declined prompt. Do not
pre-approve arbitrary `python`.

Body (once; Windows `py -3` first, POSIX `python3`):

```text
py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

If variables appear unexpanded, replace with this `SKILL.md`’s directory and the project
root. Quote paths. Git Bash: Windows path (`pwd -W`), not `/c/Users/...`. Do not
activate a venv to discover.

Exit 0 → Read the single stdout path. Non-zero → §5.1. Do not invent Streamlit APIs
meanwhile.

#### 5.1 Manual discovery

Short, read-only. Stop at the first existing file.

1. Interpreter that runs the app: `.venv\Scripts\python.exe` / `.venv/bin/python`.
   **Windows PowerShell:**

   ```powershell
   & ".\.venv\Scripts\python.exe" -c "import importlib.util, pathlib, sys; sys.path = [p for p in sys.path if p]; s = importlib.util.find_spec('streamlit');
   assert s and s.origin and s.submodule_search_locations; p = pathlib.Path(s.origin).resolve().parent / '.agents' / 'skills' / 'developing-with-streamlit' / 'SKILL.md'; print(p if p.is_file() else '')"
   ```

   `py -3` is only if that venv python is missing; it is not a substitute for a quoted
   venv path. If `find_spec` is `None` or origin is `streamlit.py`, go to step 2.

   Optional: `pip show streamlit` / `uv pip show streamlit` → append
   `/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` to `Location:` (the
   location is `site-packages`, not the package dir). Skip if pip is absent.

2. Glob project, parent, and home:

   - `**/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
   - `**/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`

   Prefer a hit under the project `.venv`/`venv`.

3. `https://docs.streamlit.io/llms-full.txt`. Do not change dependencies.

### 6. Tests and CI

New `lib/tests/streamlit/web/meta_skill_discover_test.py` (`.agents/*` is
coverage-excluded). Load `discover.py` by path.

Must include: per-candidate order (editable `$VIRTUAL_ENV` not beaten by conda
filesystem); project `.venv` beats `$VIRTUAL_ENV` when both have a skill; non-terminal
`TOO_OLD`; local `streamlit.py` rejected; success stdout is **exactly one line**;
sentinel last-wins; Store stub skip; conda `python.exe` at prefix; invalid
`--project-dir` → exit 5; `--python` exclusive; wall-clock marks `not tried`; fake
`.venv` e2e without a real wheel.

Vendored happy path: succeed via `sys.executable` **without** injecting `VIRTUAL_ENV`.

**Windows job (PR2):** `windows-latest`, one CPython, `python -m pytest` on this file
(no `make`, no frontend). Path filter: `lib/streamlit/.agents/**`, this test file,
`lib/streamlit/web/skills.py`, packaging / `MANIFEST` / `pyproject` package-data.
Call `python -m venv` / `pytest` directly.

Two smokes, not one:

1. **Stage 1:** plant `Lib\site-packages\streamlit\.agents\...` — proves filesystem hit.
2. **Stage 2:** skill files **only** importable via that venv’s `python.exe` (not planted
   where stage 1 would see them, e.g. editable-style / only on that interpreter’s
   `sys.path`). Assert discovery used `.venv\Scripts\python.exe`. Success stdout still
   exposes no interpreter; the fixture encoding is how we know which stage ran.

Space in the project path; skip `py -3` if missing. Optional `continue-on-error` only
while the job is new.

### 7. PR split

| PR | Work |
|---|---|
| **1** | `discover.py` + meta `SKILL.md` + Ubuntu tests |
| **2** | Narrow `windows-latest` job |
| **3** (optional) | Content-skill POSIX cleanup |

## Files (PR1)

| File | Change |
|---|---|
| `lib/streamlit/.agents/meta-skill/developing-with-streamlit/scripts/discover.py` | Per-candidate discovery |
| `lib/streamlit/.agents/meta-skill/developing-with-streamlit/SKILL.md` | Launchers + §5.1 |
| `lib/tests/streamlit/web/meta_skill_discover_test.py` | Guardrail tests |
| `lib/tests/streamlit/web/skills_test.py` | Drop forced `VIRTUAL_ENV` |

## Alternatives considered

**All-filesystem then all-subprocess.** Rejected: conda-on-disk beats editable
`$VIRTUAL_ENV`. Per-candidate keeps filesystem-before-spawn without reordering priority.

**Keep `$VIRTUAL_ENV` first.** Rejected when both have a usable skill: agent shells leak
stale activations. `--python` covers an intentional non-project env.

**Filesystem-only auto discovery.** Rejected: editable installs and Poetry cache envs
need `find_spec`. Manager CLIs stay last-resort and `--no-sync`.

**`Bash(python *)`.** Rejected: arbitrary code, global install. Script-anchored grant +
prompt is enough.

**Infer too-old from missing `.agents/skills/`.** Rejected: stripped modern wheels look
the same. Use distribution metadata.

**Fall back invalid `--project-dir` to cwd.** Rejected: silently scans the wrong tree.

## Checklist

| Item | Notes |
|---|---|
| Works on SiS, Cloud, etc? | N/A — local agent tooling |
| No breaking API changes | No `st.*`. Success stdout still one path |
| No new dependencies | stdlib |
| Metrics collected | No |
| Security/legal | No auto-install. No `Bash(python *)` |
| Docs | Meta `SKILL.md` only in PR1 |
| Dual-repo | Not required |
| Windows CI | PR2, narrow job |
