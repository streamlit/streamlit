---
name: developing-with-streamlit
description: "Use for ALL Streamlit tasks: creating, editing, debugging, beautifying, styling, theming, optimizing, or deploying Streamlit apps. Also custom components, st.components.v2, HTML/JS/CSS work. Discovers and loads version-matched reference docs from the user's installed Streamlit (>=1.57). Triggers: streamlit, st., dashboard, app.py, beautify, style, CSS, color, background, theme, button, widget styling, custom component, st.components, CCv2, session state, performance, cache, fragment, slow rerun, deploy."
allowed-tools: Bash(python3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" *) Bash(python "${CLAUDE_SKILL_DIR}/scripts/discover.py" *) Bash(py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" *)
---

# Developing with Streamlit

Streamlit (>=1.57) ships detailed reference documentation for building Streamlit apps inside its pip package. The bundled skill is a routing `SKILL.md` plus a `references/` folder of topic-specific reference docs (dashboards, themes, layouts, session state, custom components, etc.).

## 1. Run the discovery script

macOS and Linux:

```
python3 "<skill-dir>/scripts/discover.py" --project-dir "<project-dir>"
```

Windows (if `py` is missing, use `python` instead of `py -3`):

```
py -3 "<skill-dir>/scripts/discover.py" --project-dir "<project-dir>"
```

- Replace `<skill-dir>` with the absolute path of the directory containing this file, and `<project-dir>` with the absolute path of the user's project (usually the current working directory). Keep the quotes. In Claude Code, `<skill-dir>` is `${CLAUDE_SKILL_DIR}` and `<project-dir>` is `${CLAUDE_PROJECT_DIR}`.- If the Streamlit app lives in a subdirectory with its own virtual environment, pass that subdirectory as `--project-dir`.
- If no launcher works (on macOS without developer tools, `python3` offers to install them instead), or the script fails with a `SyntaxError` (a very old Python), run it with the project's own interpreter, such as `.venv/bin/python` or `.venv/Scripts/python.exe`.

The script is safe to run without asking. It reads files and asks each interpreter it finds where it would import Streamlit from, so it runs the project's own Python, as running the app would; the only other tool it runs is `poetry env info --path`, read-only. It never imports Streamlit or installs packages, never creates or changes environments, and writes no files of its own.

It checks the project's environments (`.venv`, `venv`, uv, conda, pixi, Poetry, Pipenv, PDM, pyenv) before the active environment and the Pythons on `PATH`, and usually finishes in under a second (always within about 10 seconds). It prints either:

- **A path on stdout** (exit 0) — the bundled `SKILL.md`. Read it; it points into `references/`.
- **An `ERROR:` block on stderr** (non-zero exit) — what happened, why, the next steps, and every environment it checked. Do not install or upgrade packages unless the user asked for it or agrees.

To check an environment the script does not find on its own, pass its interpreter with `--python <path>`.

## 2. If the script cannot run

Read the bundled skill directly from the project's virtual environment:

- Windows: `<project>/.venv/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
- macOS and Linux: `<project>/.venv/lib/python3.*/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` (glob for the `python3.*` part; search tools can skip ignored directories like `.venv` by default)

## 3. Fallback

If no bundled skill is available, use the complete Streamlit documentation, formatted for LLMs (latest release, not matched to the installed version): https://docs.streamlit.io/llms-full.txt
