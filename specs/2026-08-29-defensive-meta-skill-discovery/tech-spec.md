---
author: lukasmasuch
created: 2026-08-29
---

# Defensive Streamlit agent-skill discovery

## Summary

Harden the **meta-skill** that `streamlit skills` installs
(`lib/streamlit/.agents/meta-skill/developing-with-streamlit`) so coding agents reliably
find the version-matched bundled skill inside the project's installed Streamlit.

The delivery path this spec optimizes for is **`streamlit skills` only** (project
default, `--global`, and the Windows no-symlink fallback to global). Third-party
installers (`npx skills add streamlit/agent-skills`, `gh skill`, …) are out of band.

Failures are not observable in production, so discovery must be **read-only,
multi-candidate, and explicit**: filesystem before subprocess, never a single guess,
never an unhandled traceback, never a polluted stdout path treated as a Streamlit
install.

This is a contract change for `scripts/discover.py` and the meta `SKILL.md`, plus a small
cross-platform cleanup of the bundled content skill. No Streamlit user-facing API
changes.

## Problem

Users install skills with **`streamlit skills`**, which copies from the **local wheel**
(no GitHub fetch):

| Mode | What gets installed | Role of `discover.py` |
|---|---|---|
| **Project** (default) | Symlinks to bundled **content** skills in the active Streamlit package | Not used — the agent reads the content `SKILL.md` directly |
| **Global** (`--global`) | Copy of the vendored **meta-skill** into `~/.agents/skills/` (and `~/.claude/skills/` when present) | Required — the agent must locate this project's Streamlit at runtime |
| **Windows without Developer Mode** | Project install cannot symlink, so the CLI falls back to the same global copy | Required — same as `--global` |

This spec is about making that CLI path reliable. The meta-skill's `discover.py` locates
`<streamlit>/.agents/skills/developing-with-streamlit/SKILL.md` for the **project's**
interpreter. On Windows, the no-symlink fallback means `discover.py` is often the only
bridge to the docs.

Today the script **picks one interpreter and stops**. That produces confidently wrong
answers rather than errors:

| Failure | What the agent sees |
|---|---|
| Stale `$VIRTUAL_ENV` without current Streamlit, project `.venv` has it | `ERROR: predates bundled skills` or `not installed` — project venv never probed. Reproduced; the sole vendored test in `skills_test.py` works around this by **forcing** `VIRTUAL_ENV` because `sys.executable` is ignored. |
| Banner/noise on probe stdout (`pipenv`/`poetry`/`conda`/`sitecustomize`) | `Path(stdout.strip())` concatenates noise + path → silent "predates skills" / wrong directory |
| Windows conda (`%CONDA_PREFIX%\python.exe`) | `find_venv_python` only checks `bin/python` and `Scripts/python.exe` — conda branch never hits |
| `python3` → Microsoft Store stub (`WindowsApps`) | "Failed to import streamlit" plus Store marketing text; no `py -3` candidate |
| Non-ASCII user path + `text=True` (cp1252) | `UnicodeEncodeError` / decode crash, not an `ERROR:` block |
| `uv run --quiet python` | May **create/sync** a venv (not read-only); 30s timeout looks like an import hang |
| Missing Streamlit on the **first** candidate | Install/upgrade advice, even when another candidate would have worked |
| Skill files on disk but subprocess/import required | Sandbox, Store stub, broken transitive dep, or slow interpreter → fail even though `site-packages/streamlit/.agents/skills/` is readable |
| Unexpected exception | Raw traceback, no `ERROR:` block, no docs fallback |

The meta `SKILL.md` is a one-line Usage block (`python <SKILL_DIR>/...`) with no fallback,
no quoting, no Windows launcher, and no resolution of `<SKILL_DIR>`. `allowed-tools`
pre-approves `python` / `python3` only and does not match the body (`<SKILL_DIR>` vs
`${CLAUDE_SKILL_DIR}`), so on Claude Code the grant often never fires — and it nudges
Windows agents toward the Store stub.

The **content** skill still tells agents to use POSIX `grep \| head` and `lsof \| awk`
(`lib/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`). Those fail on
Windows PowerShell, which is the majority audience for this skill.

Python CI (`python-tests.yml`) is Ubuntu-only. Discovery coverage in this repo is one
forced happy path.

## Goals

1. **Filesystem first, then interpreters.** For known env prefixes, look for the
   Streamlit package on disk (`Lib/site-packages` / `lib/python*/site-packages`) **before**
   spawning Python. Then enumerate interpreters until one yields a usable bundled
   `SKILL.md`. A bad `$VIRTUAL_ENV` must not hide the project `.venv`.
2. **Read-only.** Discovery must not install packages, create venvs, or sync lockfiles.
3. **Do not import Streamlit.** Locate the package with `importlib.util.find_spec` in
   any subprocess probe. Never `import streamlit`.
4. **Windows-first layouts.** Conda prefix `python.exe`, `py -3`, skip Store stubs, UTF-8
   I/O, quoted paths, MSYS `/c/...` project dirs.
5. **Failures are identified.** Stable `ERROR[<ID>]` plus every candidate attempted.
   Unhandled tracebacks are bugs: a top-level guard converts them to `ERROR[INTERNAL]`
   (exit 6) and always ends with the docs fallback URL.
6. **Agents can proceed without the script.** The meta `SKILL.md` includes a short,
   ordered, read-only **manual discovery** section (see §5.1). Agents follow it when
   `discover.py` cannot run or returns a non-zero exit. No "pip install streamlit"
   unless the user asked or every candidate truly lacks Streamlit.
7. **Windows CI, not just Ubuntu unit tests.** A focused `windows-latest` job runs the
   discovery tests and an end-to-end `discover.py` smoke (see §7). Failures are not
   observable in the field; Windows is the majority audience.

## Out of scope

- Renaming the meta-skill to avoid sharing `name: developing-with-streamlit` with the
  content skill (untested interaction; project-over-global resolution is assumed).
- Auto-detecting Hatch, pixi, pyenv-virtualenv, direnv, or `UV_PROJECT_ENVIRONMENT`.
  Covered by `--python` and the manual ladder.
- Changing project-mode symlink install or the Windows "no Developer Mode → global"
  fallback in `lib/streamlit/web/skills.py` (keep that fallback; make global discovery
  trustworthy instead).
- Third-party skill installers (`npx skills`, `gh skill`, library-skills) and keeping
  [`streamlit/agent-skills`](https://github.com/streamlit/agent-skills) in lockstep.
  Source of truth is the copy vendored in the Streamlit wheel that `streamlit skills`
  installs.
- Cursor `paths` / `globs`, Codex `agents/openai.yaml`, Gemini-specific frontmatter,
  `context: fork`, `disable-model-invocation`.
- Production telemetry for skill failures (still not measurable).
- Running the entire Streamlit Python test suite on Windows.

## Proposal

Ship as one unit (script + meta `SKILL.md` always travel together) **in the Streamlit
package**. `streamlit skills --global` already copies that vendored tree from local disk
(`_install_global_skills` in `lib/streamlit/web/skills.py`); there is no network step and
no dependency on the GitHub `agent-skills` repo for this work.

### 1. Two-stage discovery (filesystem, then interpreter)

**Option A (preferred): filesystem-first, then subprocess.** For each known env
**prefix** (same order as below), look for the Streamlit package on disk. If
`.../streamlit/.agents/skills/developing-with-streamlit/SKILL.md` exists, print that path
and exit 0 — no Python spawn, no import, no timeout. This is the highest-value change:
it works when the agent sandbox blocks subprocesses, when `python` is a Store stub, when
a transitive import would crash, and when the venv is unactivated.

**Option B: only harden the existing subprocess path.** Reject as the sole approach.
Too many failure modes never reach a working interpreter.

Stage 1 and stage 2 **share one reporter** (`report_skill(streamlit_pkg: Path) -> int`)
so exit 0 / 2 / 4 cannot drift. Stage 1 reuses stage 2's prefix order.

**Stage 1 — filesystem probe** of env prefixes:

`$VIRTUAL_ENV` → `<project>/{.venv,venv,env}` → parent of those names → git-root of
those names → `$CONDA_PREFIX`

For each prefix, look for a `streamlit` directory in:

| Layout | Path |
|---|---|
| Windows venv / conda | `<prefix>\Lib\site-packages\streamlit` |
| POSIX venv / conda | `<prefix>/lib/python*/site-packages/streamlit` (if several, prefer one that already has the skill file; else parse `pyvenv.cfg` `version_info` when present) |
| Some conda | `<prefix>/lib/site-packages/streamlit` |

`--python` skips stage 1 for other prefixes: resolve that interpreter's prefix
(`pyvenv.cfg` / parent of `Scripts` or `bin`) and probe only that tree, still exclusive
on failure.

**Editable installs** (`.pth` / `streamlit` not under that `site-packages`) are a
deliberate stage-1 miss. Stage 2 `find_spec` still finds them.

**Stage 2 — interpreter probe** for poetry/pdm/pipenv/uv, non-standard layouts, and
editable installs. `detect_interpreter` is a **generator** of `(cmd, tag)`. Deduplicate
by resolved executable. Skip missing, not executable, or Windows Store stubs
(`WindowsApps` in the path, or a 0-byte / alias stub).

**Keep today's priority, but fall through on failure** (do not reorder `$VIRTUAL_ENV`
below `.venv`). An activated env that actually has Streamlit still wins; a stale one no
longer poisons discovery.

Try order (first **successful probe** wins):

1. `--python <executable>` — **exclusive**. If this probe fails, stop and report that
   failure (the caller opted in). Do not fall through.
2. `$VIRTUAL_ENV` (`virtual-env`)
3. `<project>/.venv`, then `venv`, then `env` (`venv-local`)
4. Same names on `<project>/..` (`venv-parent`)
5. Same names at git root, when that root is not already (3) or (4) (`venv-git-root`)
6. `$CONDA_PREFIX` (`conda`)
7. `sys.executable` if not already listed (`launcher`) — so
   `.venv\Scripts\python.exe discover.py` works without pinning `VIRTUAL_ENV`.
   **Never** emit `ERROR[NO_PROJECT_PYTHON]` while this process is a working Python:
   `sys.executable` is a last-resort candidate even if earlier tags missed.
8. `pipenv run python` / `poetry run python` / `pdm run python` / `uv run --no-sync --quiet python`
   only when the CLI is on `PATH` **and** the matching lockfile/`Pipfile` exists at
   `project_dir` **or** an ancestor up to the git root (`pipenv` / `poetry` / `pdm` / `uv`)
9. Windows: `py -3` (`py-launcher`)
10. System: **Windows** `python` then `python3`; **POSIX** `python3` then `python`.
    On Windows, `python3` is often the Store stub — do not prefer it.

`find_venv_python(root)` must check **platform-native** locations and ignore the other
OS's leftovers (e.g. a POSIX `bin/python` copied onto Windows):

| Platform | Paths (first existing file wins) |
|---|---|
| Windows | `<root>\python.exe` (conda/micromamba), `<root>\Scripts\python.exe`, `<root>\Scripts\python3.exe` |
| POSIX | `<root>/bin/python`, `<root>/bin/python3` |

On Windows, rewrite `--project-dir` / `VIRTUAL_ENV` / `CONDA_PREFIX` that look like
MSYS/Git Bash (`/c/Users/...`, `/cygdrive/c/...`) to `C:\Users\...` before `is_dir()` /
`is_file()` checks.

`--project-dir` runs `expanduser` + `expandvars`. If it is still not a directory, **warn
on stderr and use cwd** rather than exiting 5 — agents pass `~/...` constantly. Only
`--python` pointing at a missing file is a hard `ERROR[INVALID_ARGS]`.

Manager wrappers are last-resort among project tools, and **must not mutate the env**:
`uv run --no-sync` (not bare `uv run`). Prefer a discovered `python.exe` over `uv run`
whenever `.venv` exists (already true if local venv is tried first).

### 2. Subprocess probe (stage 2)

Do **not** `import streamlit`. Child snippet (conceptual):

```python
import importlib.util
import pathlib
import sys

spec = importlib.util.find_spec("streamlit")
if spec is None or not spec.origin:
    sys.stderr.write("STREAMLIT_MISSING\n")
    raise SystemExit(1)
root = pathlib.Path(spec.origin).resolve().parent
print(f"STREAMLIT_PKG={root}", flush=True)
```

Parent parses **only** a `STREAMLIT_PKG=` line, **scanning from the end** (last match
wins) so wrapper/sitecustomize banners cannot corrupt the path. Empty / malformed stdout
is `ERROR[PROBE_FAILED]`, never `Path("")` resolving to cwd.

Child env: `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1`. Parent
`subprocess.run(..., text=True, encoding="utf-8", errors="replace")`. Reconfigure the
script's own stdout/stderr to UTF-8 when possible so printed paths survive Windows
code pages.

Timeouts: ~20s for a direct executable; ~45s for manager wrappers (still no sync). Catch
`TimeoutExpired`, `FileNotFoundError`, `PermissionError`, `OSError`, `ValueError`,
`UnicodeError`, and filesystem errors around `iterdir()` (exit 4 listing). Convert all
to `ERROR[<ID>]`.

`main()` is wrapped so **any other exception** becomes `ERROR[INTERNAL]` (exit 6) plus
the docs URL — never a traceback to the agent.

Shared reporter, given a package root:

- `<root>/.agents/skills/developing-with-streamlit/SKILL.md` exists → print that
  **absolute path only** on stdout, exit 0 (agent happy-path unchanged).
- `.agents/skills/` exists but the expected file does not → exit 4, list entries.
- Streamlit found, no `.agents/skills/` → exit 2 (pre-1.57).

### 3. Error contract

Stderr starts with a stable identifier, then human text. Agents match the id; humans
read the rest.

| ID | When |
|---|---|
| `ERROR[NO_PROJECT_PYTHON]` | No candidate started (should be rare: `sys.executable` is always a last resort) |
| `ERROR[NO_STREAMLIT]` | Every candidate started; none had Streamlit |
| `ERROR[STREAMLIT_TOO_OLD]` | Best candidate found Streamlit but no bundled skills |
| `ERROR[SKILLS_LAYOUT_CHANGED]` | `.agents/skills/` present, expected `SKILL.md` missing |
| `ERROR[PROBE_FAILED]` | Candidate ran; stdout unparseable, timeout, permission, decode |
| `ERROR[INVALID_ARGS]` | `--python` missing/not a file; unknown CLI args |
| `ERROR[INTERNAL]` | Unexpected exception (exit 6). Never a traceback |

**Every** non-zero stderr block **ends** with:

```text
If you cannot resolve a local skill, read:
  https://docs.streamlit.io/llms-full.txt
```

Do not omit this on `INVALID_ARGS` or `INTERNAL`. The agent always has a next step.

On any non-zero exit except `INVALID_ARGS`, also print an **attempt log**:

```text
Tried:
  - virtual-env  C:\stale\venv\Scripts\python.exe  no streamlit
  - venv-local   C:\proj\.venv\Scripts\python.exe  STREAMLIT_TOO_OLD  (1.56)
  - launcher     C:\proj\.venv\Scripts\python.exe  (skipped, duplicate)
  - py-launcher  py -3                             store-stub skipped
```

**Install/upgrade advice is last, not first.** Only emit `uv add` / `conda install` /
quoted `python -m pip install` after **all** candidates were tried and none had a modern
Streamlit. If `$VIRTUAL_ENV` failed but the project venv was not usable either, say
"re-run with `--python` pointing at the interpreter that runs the app" before suggesting
installs. Never lead with "upgrade Streamlit" when the path was a parse error.

Quote every path in advice (`shlex.quote` on POSIX; double quotes on Windows). Drop
`source .venv/bin/activate`. If `pyvenv.cfg` contains a `uv =` line or `uv.lock` is
present, advise `uv add streamlit` / `uv pip install streamlit`, not
`python -m pip` (uv venvs have no pip).

### 4. CLI

```text
python scripts/discover.py --project-dir <DIR> [--python <EXECUTABLE>]
```

`--project-dir` still defaults to cwd. `--python` is the deterministic override.

Success stdout remains a single absolute path to the bundled `SKILL.md` (plus optional
trailing newline). Do not print JSON to stdout — agents already mishandle mixed stdout;
keep the probe sentinel internal.

### 5. Meta-skill `SKILL.md`

Low-freedom instructions. Agents must not improvise a fourth discovery method.

**Frontmatter** (stay inside the Agent Skills spec's six fields so claude.ai /
`package_skill.py` do not hard-error):

- `name` / `description` — keep triggers **in `description`** (portable). Rewrite
  description in third person; stay ≤1024 chars.
- `license: Apache-2.0`
- `compatibility:` local filesystem and a Python 3 interpreter; normal discovery is
  offline. Do **not** write "requires Streamlit ≥1.57" in a way that causes hosts to
  **skip** the skill — the whole point of the meta-skill is to find or fall back.
- `allowed-tools` — keep the experimental field (Claude Code / Codex; other hosts
  ignore it). It is a one-turn **pre-approval**, not a sandbox.

  **Do not rely on `${CLAUDE_SKILL_DIR}` inside `allowed-tools`.** Substitution in that
  field is unreliable (reported Claude Code bug: the grant never matches, so the agent
  is re-prompted anyway). The **body** may still use `${CLAUDE_SKILL_DIR}` /
  `${CLAUDE_PROJECT_DIR}` (substitution in markdown works). In frontmatter, list
  launcher prefixes that match without a skill-dir variable, plus `Read` and `Glob`:

  `Read Glob Bash(py -3 *) Bash(python *) Bash(python3 *)` and a `PowerShell(...)`
  twin if the host has that tool.

  Add a `py` variant for Windows. A one-time approval may still appear; that is
  acceptable. Do **not** grant unrestricted `Bash(*)`.

Documented command (Claude substitutes these in the **markdown body**; other hosts
leave them literal — tell the agent to replace unexpanded vars). Windows first:

```text
py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

POSIX:

```bash
python3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

Body, in order:

1. **Mandatory:** resolve the bundled skill (or `llms-full.txt`) before writing Streamlit
   code from memory.
2. Skill dir = directory of this `SKILL.md` (`scripts/discover.py` lives next to it).
   Well-known roots: `~/.agents/skills/`, `~/.claude/skills/`, `~/.cursor/skills/`,
   `~/.codex/skills/`, `.github/skills/`. Quote all paths (Windows homes have spaces).
   Git Bash: pass a Windows project path (`pwd -W` / `cygpath -w`), not `/c/Users/...`.
3. Launcher order: **Windows** `py -3`, then `python` (not `python3` first).
   **POSIX** `python3`, then `python`. Any 3.10+ interpreter may *start* the script;
   the script re-detects the project interpreter. Do not `activate` a venv just to
   discover.
4. Exit 0 → last non-empty stdout line is a file → **Read it**.
   Non-zero → read stderr, honor `ERROR[<ID>]`, then go to §5.1 (do not improvise).

Do not add Cursor/Codex/Gemini-only files. They do not improve Python discovery.

#### 5.1 Manual discovery (required section)

This is a first-class part of the meta-skill, not an appendix. Keep it **short**
(about half a page). Agents with no shell, a declined permission prompt, a Store-stub
`python`, or a sandbox must still reach the bundled docs.

Tone: imperative, ordered, **read-only**. Do not tell the agent to install or upgrade
Streamlit here.

**Goal:** find and **Read**
`<streamlit-package>/.agents/skills/developing-with-streamlit/SKILL.md`.

Try in this order; stop at the first path that exists:

1. **Project interpreter, no import of the app.** Identify the Python that runs the
   user's app (do not activate anything):
   - `.venv\Scripts\python.exe` or `venv\Scripts\python.exe` (Windows)
   - `.venv/bin/python` (macOS/Linux)
   - `py -3` if those are missing
   Then run (quoted):

   ```text
   "<that-python>" -c "import importlib.util, pathlib; s = importlib.util.find_spec('streamlit'); p = pathlib.Path(s.origin).resolve().parent / '.agents' / 'skills' / 'developing-with-streamlit' / 'SKILL.md'; print(p)"
   ```

   Read the printed path if the file exists.

   Optional equivalent: `pip show streamlit` or `uv pip show streamlit` and append
   `/.agents/skills/developing-with-streamlit/SKILL.md` to `Location:`. Skip if pip
   is missing (typical uv venv).

2. **Filesystem search (no Python required).** Glob or search the project (and parent)
   for either of:
   - `**/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
   - `**/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
     (Windows venvs)

   Prefer a hit under the project's `.venv` / `venv` over a user-level install. Read
   that `SKILL.md`.

3. **Online fallback only.** If neither step finds a file,
   `https://docs.streamlit.io/llms-full.txt`. Do not modify the environment.

If step 1 prints `None` / crashes, continue to step 2; do not invent Streamlit APIs
from training data while these steps are unfinished.

### 6. Content skill POSIX commands

In `lib/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`:

- Replace the `grep -rl ... | head` scan with agent-tool-neutral steps (Glob/Grep for
  `import streamlit` / `from streamlit`, or a one-liner using the project interpreter).
- Replace `lsof | grep | awk` with: check the app's configured port (default 8501) via
  whatever the agent has (open `http://localhost:8501`, or a short Python
  `socket` connect). Do not require Unix process tools.

### 7. Tests and CI

Failures in the field are invisible, so tests have to cover the cases we already
reproduced. Split coverage:

**Ubuntu (existing `python-tests.yml` plus a dedicated file
`lib/tests/streamlit/web/meta_skill_discover_test.py`).** Load `discover.py` via
`importlib.util.spec_from_file_location`. `.agents/*` is excluded from coverage; these
tests are guardrails, not coverage-driven. Respect repo ruff `select = ["ALL"]`
(`S603`/`T201` on the script already have local noqa).

Layouts that are just path math (conda prefix files, Store-stub skip, banner parse,
`~` expansion, `--no-sync`, uv `pyvenv.cfg` advice, **filesystem probe hit**) can run
here, including **simulated** Windows paths on Linux. One end-to-end subprocess run
against a **fake** `.venv` (planted `site-packages/streamlit/.agents/.../SKILL.md`, no
real Streamlit wheel required) plus the existing vendored happy path.

Minimum cases:

- Filesystem probe hit (POSIX `lib/python*/site-packages` and Windows `Lib/site-packages`)
- Stage 1 miss + stage 2 `find_spec` hit (editable-style layout)
- Stale `$VIRTUAL_ENV` (no / old Streamlit) **falls through** to project `.venv`
- `--python` exclusive override
- `sys.executable` used when no venv markers exist; `NO_PROJECT_PYTHON` not emitted
- Banner on probe stdout: last `STREAMLIT_PKG=` wins
- Empty / garbage stdout → `ERROR[PROBE_FAILED]`, not cwd
- Unexpected exception → `ERROR[INTERNAL]` (exit 6), no traceback, docs URL present
- `~` expansion on `--project-dir`
- Conda-shaped prefix: `python.exe` at root and `bin/python`
- Store-stub path skipped
- `uv run` invocation includes `--no-sync` (do not require uv in CI)
- uv-managed `pyvenv.cfg` → install advice is not `python -m pip`
- `iterdir` `OSError` on exit 4 does not traceback
- Exit 2 (no skills dir) and exit 4 (restructured layout)
- Happy path: vendored script still resolves bundled content `SKILL.md`

The existing `TestVendoredMetaSkillDiscovery` happy path stays, but should succeed
via `sys.executable` **without** injecting `VIRTUAL_ENV`.

**Windows CI (required, narrow).** Do **not** run the full Python unit matrix on
`windows-latest`. Add a small job (new workflow or a single job next to
`python-tests.yml`) whose only job is discovery:

| | |
|---|---|
| Runner | `windows-latest` |
| Python | One CPython from `actions/setup-python` (3.12 is enough; not the full version matrix) |
| Shell | PowerShell for the smoke (this is what Windows agents use). Pytest can use the default. |
| Install | `pip install -e lib` (or the repo's existing editable install) so the vendored meta-skill and bundled content skill are present. No Playwright, no frontend build. |
| Tests | The discovery pytest file **on Windows**, plus one **process-level smoke**: create `.venv` with `python -m venv`, plant `Lib\site-packages\streamlit\.agents\...` (filesystem stage, no real wheel required) **and** a second smoke that runs `discover.py` without `VIRTUAL_ENV` and asserts `.venv\Scripts\python.exe`. |
| Windows-only asserts | `Scripts\python.exe` resolution; conda-style `<prefix>\python.exe`; quoted path with a space in the project dir; UTF-8 user-dir smoke if cheap. Skip `py -3` if the launcher is absent on the runner. |
| Triggers | Same as unit tests (`pull_request` / `push` to `develop`), optionally path-filtered to `lib/streamlit/.agents/**` and the discovery test file so unrelated PRs do not pay for a Windows runner. |
| Time | Target a few minutes. Fail the PR if the smoke cannot import `discover.py` or resolve the bundled skill. |

Ubuntu tests are not a substitute for this job: `subprocess`, `PATHEXT`, `python.exe` vs
`python`, default text encoding, and venv layout only show up on a real Windows runner.

### 8. Files to change

| File | Change |
|---|---|
| `lib/streamlit/.agents/meta-skill/developing-with-streamlit/scripts/discover.py` | Two-stage discovery, error IDs, `--python`, UTF-8, Windows layouts |
| `lib/streamlit/.agents/meta-skill/developing-with-streamlit/SKILL.md` | Frontmatter, launchers, §5.1 manual discovery |
| `lib/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` | Replace POSIX `grep`/`lsof` with agent-tool-neutral steps |
| `lib/tests/streamlit/web/meta_skill_discover_test.py` | New guardrail tests (coverage-excluded `.agents/*`) |
| `lib/tests/streamlit/web/skills_test.py` | Happy path without forced `VIRTUAL_ENV` |
| `.github/workflows/` | Narrow `windows-latest` discovery job |

`streamlit skills --global` copies the vendored meta-skill as-is; no installer changes
unless a test for that copy path needs updating.

## Alternatives considered

**Filesystem-first vs subprocess-only.** Subprocess-only is less code but fails in
sandboxes, with Store stubs, and with broken transitive deps even when the skill files
are on disk. Filesystem-first is the preferred stage 1; stage 2 remains for editable
installs and manager wrappers. Do not ship stage 2 without stage 1.

**JSON on stdout for agents.** More structure, worse agent compliance. Sentinel stays
inside the child probe; agent-facing success remains one path.

**`import streamlit` kept for version accuracy.** Reject: optional-dep import failures,
local `streamlit.py` shadowing, stdout noise, Windows Defender timeouts. Filesystem
layout is the version signal we need (`/.agents/skills/` ⇒ ≥1.57).

**`allowed-tools` with `${CLAUDE_SKILL_DIR}` in the rule.** Official docs say substitution
works in frontmatter; in practice it often does not, so the grant never matches. Prefer
launcher prefixes (`py -3`, `python`, `python3`) plus `Read`/`Glob`, and accept a
one-time approval. Do not drop the field entirely (it still helps when the prefix
matches).

**Defer tests (script + SKILL.md only).** Reject. Failures are unmeasurable; tests are
the mitigation. `.agents/*` is coverage-excluded, so the new test file is required
guardrail, not a coverage chase.

**`compatibility: Requires Streamlit >= 1.57`.** Hosts that honor the field may hide the
skill exactly when discovery is needed.

## Checklist

| Item | Notes |
|---|---|
| Works on SiS, Cloud, etc? | N/A — local agent tooling only |
| No breaking API changes | No `st.*` API. Agent success stdout still a path. Error stderr format changes (additive IDs) |
| No new dependencies | stdlib only |
| Metrics collected | No — failures remain unobservable; tests are the mitigation |
| Security/legal | Discovery stays read-only; do not auto-install packages. `allowed-tools` stays narrowly scoped (global install) |
| Docs | Meta + content `SKILL.md` only, including the §5.1 manual discovery section; optional note in `streamlit skills` CLI help if it describes discovery |
| Dual-repo | Not required. `streamlit skills` installs the wheel-vendored copy; GitHub `agent-skills` is out of band |
| Windows CI | Required: narrow `windows-latest` discovery job + smoke (`discover.py` against `.venv\Scripts\python.exe`). Not the full Python matrix |
