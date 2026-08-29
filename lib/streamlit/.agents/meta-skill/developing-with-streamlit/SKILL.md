---
name: developing-with-streamlit
description: "Use for ALL Streamlit tasks: creating, editing, debugging, beautifying, styling, theming, optimizing, or deploying Streamlit apps. Also custom components, st.components.v2, HTML/JS/CSS work. Discovers and loads version-matched reference docs from the user's installed Streamlit (>=1.57). Triggers: streamlit, st., dashboard, app.py, beautify, style, CSS, color, background, theme, button, widget styling, custom component, st.components, CCv2, session state, performance, cache, fragment, slow rerun, deploy."
license: Apache-2.0
allowed-tools: Read Glob Bash(py -3 ${CLAUDE_SKILL_DIR}/scripts/discover.py *) Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/discover.py *) Bash(python ${CLAUDE_SKILL_DIR}/scripts/discover.py *)
---

# Developing with Streamlit

Streamlit (>=1.57) ships detailed reference documentation for building Streamlit apps inside its pip package. The bundled skill is a routing `SKILL.md` plus a `references/` folder of topic-specific reference docs (dashboards, themes, layouts, session state, custom components, etc.).

## Usage

Run the discovery script with the user's project directory. Quote paths. If `${CLAUDE_PROJECT_DIR}` is left unexpanded (shown as a literal), the script warns and uses the project cwd.

Windows (try first):

```text
py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

POSIX (and Windows fallback):

```text
python3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
python "${CLAUDE_SKILL_DIR}/scripts/discover.py" --project-dir "${CLAUDE_PROJECT_DIR}"
```

- Exit 0: stdout is one path — the bundled `SKILL.md`. **Read** that path; it points into `references/`.
- Non-zero: follow [Manual discovery](#manual-discovery). Do not install or change packages unless the user asked.

`${CLAUDE_SKILL_DIR}` is this skill's directory (the folder that contains this file). Passing `--project-dir` matters because the script resolves `.venv` / `venv`, lockfiles, and environment prefixes relative to it.

## Manual discovery

Read-only. Stop at the first existing file. **One physical line** each.

### 1. Project interpreter

Windows PowerShell:

```powershell
& ".\.venv\Scripts\python.exe" -c "import importlib.util, pathlib, sys; sys.path=[p for p in sys.path if p and pathlib.Path(p).resolve()!=pathlib.Path('.').resolve()]; s=importlib.util.find_spec('streamlit'); p=(pathlib.Path(s.origin).resolve().parent/'.agents'/'skills'/'developing-with-streamlit'/'SKILL.md') if (s and s.origin and s.submodule_search_locations and pathlib.Path(s.origin).name=='__init__.py') else None; print(p if p is not None and p.is_file() else '')"
```

POSIX:

```bash
".venv/bin/python" -c "import importlib.util, pathlib, sys; sys.path=[p for p in sys.path if p and pathlib.Path(p).resolve()!=pathlib.Path('.').resolve()]; s=importlib.util.find_spec('streamlit'); p=(pathlib.Path(s.origin).resolve().parent/'.agents'/'skills'/'developing-with-streamlit'/'SKILL.md') if (s and s.origin and s.submodule_search_locations and pathlib.Path(s.origin).name=='__init__.py') else None; print(p if p is not None and p.is_file() else '')"
```

Empty print / missing venv → step 2. `py -3` only if the venv interpreter is missing. Optional: `"<that-python>" -m pip show streamlit` and append `/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` to `Location:`.

### 2. Glob (project and parent only)

Do not glob `$HOME` — it is slow, can pick the wrong install, and many agent globs skip gitignored `.venv`. Prefer a hit under the project `.venv`/`venv`. Search tools may need to include ignored files.

- `**/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
- `**/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`

### 3. Docs fallback

https://docs.streamlit.io/llms-full.txt

Do not change dependencies unless the user asked.
