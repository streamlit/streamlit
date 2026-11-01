---
name: developing-with-streamlit
description: "**[REQUIRED]** Use for ALL Streamlit tasks: creating, editing, debugging, beautifying, styling, theming, optimizing, or deploying Streamlit apps. Also custom components, st.components.v2, HTML/JS/CSS work. Use it before writing or changing Streamlit code: it finds the reference docs bundled with the user's installed Streamlit (>=1.57), matched to that version. Triggers: streamlit, st., dashboard, app.py, beautify, style, CSS, color, background, theme, button, widget styling, custom component, st.components, CCv2, session state, performance, cache, fragment, slow rerun, deploy."
allowed-tools: Bash(python3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" *) Bash(python "${CLAUDE_SKILL_DIR}/scripts/discover.py" *) Bash(py -3 "${CLAUDE_SKILL_DIR}/scripts/discover.py" *)
---

# Developing with Streamlit

Streamlit (>=1.57) ships detailed reference documentation for building Streamlit apps inside its pip package. The bundled skill is a routing `SKILL.md` plus a `references/` folder of topic-specific reference docs (dashboards, themes, layouts, session state, custom components, etc.). Find it (step 1) and read it (step 2) before writing or changing Streamlit code.

## 1. Run the discovery script

macOS and Linux:

```
python3 "<skill-dir>/scripts/discover.py" --project-dir "<project-dir>"
```

Windows (if `py` is missing, use `python` instead of `py -3`):

```
py -3 "<skill-dir>/scripts/discover.py" --project-dir "<project-dir>"
```

- Replace `<skill-dir>` with the absolute path of the directory containing this file, and `<project-dir>` with the absolute path of the user's project (usually the current working directory). Keep the quotes. In Claude Code, `<skill-dir>` is `${CLAUDE_SKILL_DIR}` and `<project-dir>` is `${CLAUDE_PROJECT_DIR}`.
- If the Streamlit app lives in a subdirectory with its own virtual environment, pass that subdirectory as `--project-dir`.
- If no launcher works (on macOS without developer tools, `python3` offers to install them instead), or the script fails with a `SyntaxError` or `ImportError` (a very old Python), run it with the project's own interpreter, such as `.venv/bin/python` or `.venv/Scripts/python.exe`.

The script is safe to run without asking. It reads files and asks each interpreter it finds where it would import Streamlit from, so it runs the project's own Python, as running the app would; the only other tool it runs is `poetry env info --path`, read-only. It never imports Streamlit or installs packages, never creates or changes environments, and writes no files of its own.

It checks the project's environments first (`$UV_PROJECT_ENVIRONMENT`, `.venv`, `venv`, conda, pixi, Pipenv, Poetry), then the active environment and the Pythons on `PATH`. It usually finishes in under a second, stops within about 10 seconds, and prints either:

- **A path on stdout** (exit 0) — the bundled `SKILL.md`. Continue with step 2.
- **An `ERROR:` block on stderr** (non-zero exit) — what happened, why, the next steps, and every environment it checked. Do not install or upgrade packages unless the user asked for it or agrees.

If you already know which Python runs the app (for example, from the command used to run it), pass it with `--python <path>`. Then only that interpreter is checked, so the docs match the app's environment exactly. The same flag reaches environments the script does not find on its own.

## 2. Read the bundled skill and its references

1. Read the whole `SKILL.md` at the printed path, and follow it.
2. Read every reference its routing table lists for the task before you edit. Its links, such as `references/theme.md`, are relative to the folder of that `SKILL.md`, not to this file.
3. These docs match the user's installed Streamlit. Where they differ from what you remember about Streamlit, follow the docs.

Reuse the path for the rest of the session; run the script again only if the project's environment changes.

## 3. If the script cannot run

Read the bundled skill directly from the environment that runs the app, then continue with step 2. It is `streamlit/.agents/skills/developing-with-streamlit/SKILL.md` inside that environment's `site-packages` folder; for the project's virtual environment:

- Windows: `<project>/.venv/Lib/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md`
- macOS and Linux: `<project>/.venv/lib/python3.*/site-packages/streamlit/.agents/skills/developing-with-streamlit/SKILL.md` (glob for the `python3.*` part; search tools can skip ignored directories like `.venv` by default)

## 4. Fallback

If no bundled skill is available, use the online Streamlit documentation (latest release, not matched to the installed version). Find the pages for the task in the index at https://docs.streamlit.io/llms.txt and fetch those. https://docs.streamlit.io/llms-full.txt has every page in one file, but at about 2 MB it is too large for most fetch tools.
