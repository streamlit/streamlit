---
author: lukasmasuch
created: 2026-08-29
---

# Defensive Streamlit agent-skill discovery

## Summary

Harden the **meta-skill** that `streamlit skills` installs so agents find this
**project's** bundled Streamlit skill
(`<streamlit>/.agents/skills/developing-with-streamlit/SKILL.md`).
Failures are unobservable, so discovery must not return a confidently wrong path.

Scope is **`streamlit skills` only** (project default, `--global`, Windows no-symlink
fallback). Third-party installers are out of band. No `st.*` API changes.

## Problem

`streamlit skills` copies from the **local wheel** (no GitHub fetch; see
[#15933](https://github.com/streamlit/streamlit/issues/15933)):

| Mode | Installed | `discover.py` |
|---|---|---|
| **Project** (default) | Symlinks to bundled **content** skills | Unused |
| **Global** (`--global`) | Meta-skill → `~/.agents/skills/` (and `~/.claude/skills/` if present) | Required |
| **Windows, no Developer Mode** | Same global copy | Required |

Today the script picks **one** interpreter and stops. Known wrong answers: stale
`$VIRTUAL_ENV` hides the project `.venv`; probe stdout banners become a fake path;
Windows conda `%CONDA_PREFIX%\python.exe` is missed; `python3` is often a Store stub;
`uv run` may sync; a local `streamlit.py` shadows `find_spec`; uncaught exceptions
print a traceback. The only vendored test forces `VIRTUAL_ENV` because
`sys.executable` is ignored. CI is Ubuntu-only.

**Same name, two skills:** project content skill at `.agents/skills/developing-with-streamlit`
vs global meta-skill at `~/.agents/skills/developing-with-streamlit`. Assumed:
project-local wins. Not renaming here.

## Goals

1. Return a usable bundled `SKILL.md` for this **project** when one exists, without
   importing Streamlit and without installing or synchronizing dependencies.
2. Keep searching after a miss, old install, or failed probe; only a usable skill
   short-circuits.
3. On total failure: one error, attempt log, docs URL, manual ladder. Never execute
   install advice unless the user asked.
4. Validate Windows layouts in CI **in the same change** as the script (or earlier).

## Out of scope

- Hatch, pixi, pyenv-virtualenv, direnv, `UV_PROJECT_ENVIRONMENT` (`--python` or manual
  ladder).
- Changing symlink install / Windows global fallback in `skills.py`.
- `npx skills` / GitHub `agent-skills` lockstep.
- Cursor/Codex/Gemini-only frontmatter.
- Full Windows Python matrix.
- Renaming the meta-skill.
- Content-skill POSIX `grep`/`lsof` — **follow-up PR**.
- Distinguishing `TOO_OLD` vs `INCOMPLETE` via `dist-info` (v1: one “found Streamlit,
  no usable skill” outcome).

## Locked decisions

| Topic | Decision |
|---|---|
| Probe order | **Per candidate:** filesystem then subprocess, then the next candidate. |
| Project vs `$VIRTUAL_ENV` | **Project `.venv`/`venv` first.** Agent shells often have `$VIRTUAL_ENV` pointing at the *agent*, not the app. `--python` if the user really wants the activated env. `--verbose` prints the winner on stderr so a wrong pick is diagnosable. |
| Unusable Streamlit | Recorded, not terminal. After all candidates, report the outcome of the **highest-priority candidate that was actually inspected** (severity only *within* that candidate). |
| Dependency guarantee | **No dependency installation or synchronization.** Manager CLIs (`uv run --no-sync`, `poetry run`, …) may still *create* an empty env; they run only if no prefix worked. Direct `python -c` may run `.pth` / `sitecustomize`. |
| `--project-dir` | Expand `~` / env vars; light MSYS `/c/...` → `C:\...`. Unexpanded `${...}` or a path that does not exist → **WARNING on stderr, use cwd**. Hard `ERROR[INVALID_ARGS]` only for a bad `--python` or unknown flags. |
| `--python` | Keep. Exclusive. |
| `--verbose` | Winning tag + interpreter on **stderr**. Stdout stays one path. |
| `allowed-tools` | `Read`, `Glob`, plus launcher-anchored grants that **match the body** (`py -3` / `python3` / `python` + script path + `*`). Not `Bash(python *)`. Prompt is OK. |
| Shadowing | Reject a lone `streamlit.py` (no `submodule_search_locations`, origin not `__init__.py`). **Do not** reject every path under `project_dir` (breaks in-tree / editable Streamlit). |
| Child flags | **No `python -P`** (3.11+ only; Streamlit supports 3.10). Sanitize `sys.path` in the snippet. Drop inherited `PYTHONPATH` / `PYTHONHOME`. |
| Store stubs | Only the App Execution Alias dir (`%LOCALAPPDATA%\Microsoft\WindowsApps\`). Do not reject every path containing `WindowsApps` (real Store Python lives elsewhere). |
| Agent branching | Exit 0 → Read stdout path. Non-zero → manual ladder. |
| Extra dirs | `.venv` always; `venv` only with `pyvenv.cfg`. Not `env/`. |
| Git walk | Cap at **20** ancestors (same as `_MAX_REPO_ROOT_WALK_DEPTH` in `skills.py`). |
| Frontmatter | `name`, `description`, `license`, `allowed-tools`. No `compatibility`, no unused `metadata`. |
| Windows CI | **Same PR as the script** (or land first). PR1 is not behavior-only. |

## Proposal

### 1. Per-candidate discovery

For each candidate: filesystem lookup, then subprocess if needed. Stop only on a
**usable** `SKILL.md`, or when the subprocess-time budget is exhausted.

1. `--python` — exclusive
2. `<project>/.venv`, then `<project>/venv` if `pyvenv.cfg` exists
3. Same on parent, then git root (≤20 levels, skip duplicates)
4. `$VIRTUAL_ENV`
5. `$CONDA_PREFIX`
6. `sys.executable` if not already listed — **best-effort version** (often the agent’s
   Python, not the app’s)
7. `pipenv` / `poetry` / `pdm` / `uv run --no-sync --quiet python` only if the CLI is on
   `PATH` and the lockfile/`Pipfile` exists at `project_dir` or an ancestor
8. Windows: `py -3`
9. System: Windows `python` then `python3`; POSIX `python3` then `python`

`find_venv_python`: Windows `<root>\python.exe` (conda) and `<root>\Scripts\python.exe`;
POSIX `<root>/bin/python` and `python3`.

Filesystem: `<prefix>\Lib\site-packages\streamlit` (Windows),
`<prefix>/lib/python*/site-packages/streamlit` (POSIX; if several, prefer one that
already has the skill file). Editable installs are a filesystem miss.

**Budget:** charge **subprocess time only** (filesystem is free). Global 60s.
Direct probe timeout ~10s; manager wrappers ~30s. Attempt log marks the rest
`not tried`.

### 2. Subprocess probe

Never `import streamlit`. No `-P` / `-I`. Child snippet (3.10-safe):

- Remove `''` and any `sys.path` entry that resolves to cwd
- `find_spec("streamlit")`
- Accept only a package: `submodule_search_locations` set, origin file is
  `streamlit/__init__.py`
- Print `STREAMLIT_PKG=<package-dir>` (parent parses the **last** such line)

Child env: `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`, and **omit** `PYTHONPATH` /
`PYTHONHOME`. Parent `encoding="utf-8"`; `errors="replace"` only as a decode guard.
Reconfigure this process’s **stdout and stderr** to UTF-8 without replacing characters.

Catch `TimeoutExpired`, `FileNotFoundError`, `PermissionError`, `OSError`,
`ValueError`, `UnicodeError`. Anything else → `ERROR[INTERNAL]`. Custom argparse:
invalid flags start with `ERROR[INVALID_ARGS]`.

### 3. Outcomes

Usable `SKILL.md` → **exactly one** path on stdout, exit 0. If `--verbose`, stderr
also has `discovered via: <tag> <interpreter>`.

Do not infer version from missing files. v1: Streamlit found but no usable bundled
skill → one outcome (exit 2), message “upgrade or reinstall, or use the docs.”
`.agents/skills/` present but the expected file missing → exit 4 (`LAYOUT_CHANGED`).

| ID | Exit | When |
|---|---|---|
| (success) | 0 | Usable `SKILL.md` |
| `ERROR[NO_STREAMLIT]` | 1 | At least one candidate was inspected; none had Streamlit |
| `ERROR[NO_USABLE_SKILL]` | 2 | Highest-priority inspected candidate had Streamlit but no usable bundled skill |
| `ERROR[NO_PROJECT_PYTHON]` | 3 | Nothing started |
| `ERROR[SKILLS_LAYOUT_CHANGED]` | 4 | Highest-priority inspected candidate has `.agents/skills/` without the expected file |
| `ERROR[INVALID_ARGS]` | 5 | Bad `--python` or unknown flag |
| `ERROR[INTERNAL]` | 6 | Unexpected exception |
| `ERROR[PROBE_FAILED]` | 7 | Candidates were attempted but **none** were successfully inspected (timeouts, stubs, garbage stdout). Message: could not inspect any interpreter — **not** “Streamlit is not installed.” |

**Final error** = outcome of the **highest-priority inspected** candidate. Severity is
not compared across candidates (a low-priority `LAYOUT_CHANGED` must not hide a
project-venv `NO_STREAMLIT`). If nothing was inspected → `PROBE_FAILED` or
`NO_PROJECT_PYTHON`.

Every non-zero stderr block ends with
https://docs.streamlit.io/llms-full.txt.

Install advice is last, quoted, and **must not be run unless the user approves**.
No `source activate`. Prefer `uv add` / `uv pip` when `uv.lock` is present.

### 4. CLI

```text
python scripts/discover.py --project-dir <DIR> [--python <EXECUTABLE>] [--verbose]
```

### 5. Meta-skill `SKILL.md`

```yaml
allowed-tools: Read Glob Bash(py -3 ${CLAUDE_SKILL_DIR}/scripts/discover.py *) Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/discover.py *) Bash(python ${CLAUDE_SKILL_DIR}/scripts/discover.py *)
```

These prefixes match the body (interpreter + script). They do not grant arbitrary
`python -c`. A prompt is OK if substitution fails.

Body — Windows first, POSIX second; quote paths; if `${CLAUDE_PROJECT_DIR}` is
literal, use the project cwd (script warns and does the same):

```text
py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
python3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

Exit 0 → Read the stdout path. Non-zero → §5.1.

#### 5.1 Manual discovery

Read-only. Stop at the first existing file. **One physical line** each.

Windows PowerShell:

```powershell
& ".\.venv\Scripts\python.exe" -c "import importlib.util, pathlib, sys; sys.path=[p for p in sys.path if p and pathlib.Path(p).resolve()!=pathlib.Path('.').resolve()]; s=importlib.util.find_spec('streamlit'); p=(pathlib.Path(s.origin).resolve().parent/'.agents'/'skills'/'developing-with-streamlit'/'SKILL.md') if (s and s.origin and s.submodule_search_locations and pathlib.Path(s.origin).name=='__init__.py') else None; print(p if p is not None and p.is_file() else '')"
```

POSIX:

```bash
".venv/bin/python" -c "import importlib.util, pathlib, sys; sys.path=[p for p in sys.path if p and pathlib.Path(p).resolve()!=pathlib.Path('.').resolve()]; s=importlib.util.find_spec('streamlit'); p=(pathlib.Path(s.origin).resolve().parent/'.agents'/'skills'/'developing-with-streamlit'/'SKILL.md') if (s and s.origin and s.submodule_search_locations and pathlib.Path(s.origin).name=='__init__.py') else None; print(p if p is not None and p.is_file() else '')"
```

Empty print / missing venv → step 2. `py -3` only if the venv interpreter is missing.
Optional: `"<that-python>" -m pip show streamlit` and append
`/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` to `Location:`.

2. Glob **project and parent only** (not `$HOME` — slow, wrong install, and many
   agent globs skip gitignored `.venv`):

   - `**/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
   - `**/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`

   Prefer a hit under the project `.venv`/`venv`. Search tools may need to include
   ignored files.

3. `https://docs.streamlit.io/llms-full.txt`. Do not change dependencies unless the
   user asked.

### 6. Tests and CI

`lib/tests/streamlit/web/meta_skill_discover_test.py`. Required cases: per-candidate
order; project `.venv` beats `$VIRTUAL_ENV`; non-terminal unusable skill; lone
`streamlit.py` rejected **and** in-tree `lib/streamlit` accepted; success stdout is
one line; sentinel last-wins; Store-alias skip; conda `python.exe`; unexpanded
`--project-dir` → cwd + warning; `--python` exclusive; wall-clock `not tried`;
overall `PROBE_FAILED` when every probe fails; fake `.venv` e2e.

Vendored happy path: `sys.executable`, no forced `VIRTUAL_ENV`.

**Windows job in this PR:** `windows-latest`, `actions/setup-python` (3.12), then
`python -m pip install pytest` and `python -m pip install -e lib` (or the repo’s
existing editable install if that already pulls pytest). Run
`python -m pytest lib/tests/streamlit/web/meta_skill_discover_test.py`. No `make`,
no frontend. Path filter: `.agents/**`, this test, `web/skills.py`, packaging
files.

Smokes:

1. **Filesystem:** plant `Lib\site-packages\streamlit\.agents\...`.
2. **Subprocess:** do **not** plant under `Lib\site-packages`. Add a `.pth` in the
   venv that points at a directory containing only that interpreter’s Streamlit
   tree. Stage 1 must miss; stage 2 must hit via `.venv\Scripts\python.exe`.

Also: space in the project path; skip `py -3` if missing.

### 7. PRs

| PR | Work |
|---|---|
| **1** | `discover.py` + meta `SKILL.md` + Ubuntu tests + **Windows discovery job** |
| **2** (optional) | Content-skill POSIX cleanup |

## Files (PR1)

| File | Change |
|---|---|
| `.../meta-skill/.../scripts/discover.py` | Per-candidate discovery |
| `.../meta-skill/.../SKILL.md` | Launchers + manual ladder |
| `lib/tests/streamlit/web/meta_skill_discover_test.py` | Guardrails |
| `lib/tests/streamlit/web/skills_test.py` | Drop forced `VIRTUAL_ENV` |
| `.github/workflows/` | Narrow `windows-latest` discovery job |

## Alternatives considered

**`python -P`.** Rejected: 3.11+ only. In-snippet `sys.path` cleanup covers 3.10.

**Reject every path under `project_dir`.** Rejected: Streamlit’s own editable checkout
is `lib/streamlit`. Structural package checks are enough.

**`Bash(${CLAUDE_SKILL_DIR}/scripts/discover.py *)` alone.** Never matches
`py -3 …/discover.py`. Grant the interpreter + script prefix instead.

**Severity across candidates.** Rejected: a random conda `LAYOUT_CHANGED` must not
outrank the project venv’s `NO_STREAMLIT`.

**Hard-fail invalid `--project-dir`.** Too harsh when `${CLAUDE_PROJECT_DIR}` is
literal. Warn + cwd; hard-fail only `--python`.

**`TOO_OLD` vs `INCOMPLETE` + exit 7.** Deferred. Agent behavior is the same; no
telemetry. v1 uses one “no usable skill” exit.

**Filesystem-only auto discovery.** Editable / Poetry cache still need `find_spec`.

**Glob `$HOME`.** Slow and picks the wrong install.

## Checklist

| Item | Notes |
|---|---|
| Works on SiS, Cloud, etc? | N/A |
| No breaking API changes | Success stdout still one path |
| No new dependencies | stdlib (CI installs pytest on the Windows runner) |
| Metrics collected | No; `--verbose` is the debug hook |
| Security/legal | No auto-install. No `Bash(python *)`. Install advice needs user approval |
| Docs | Meta `SKILL.md` |
| Dual-repo | Not required |
| Windows CI | Required in PR1 |
