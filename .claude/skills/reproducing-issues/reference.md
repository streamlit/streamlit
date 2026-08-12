# Reference: Templates for Issue Reproduction

## Minimal Repro App Template

Use this for `$OUT_DIR/gh-<N>/repro_gh_<N>.py` — the minimal app you run (via a released wheel or `make debug`) to reproduce the bug.

```python
"""
Reproduction for GitHub Issue #<N>
https://github.com/streamlit/streamlit/issues/<N>

Expected: <what should happen>
Actual:   <what the bug is>
"""
import streamlit as st

st.header("Issue #<N>: <Short Title>")

# --- Reproduction code ---
# Paste or adapt the reporter's code snippet here.
# Keep it minimal — only what's needed to trigger the bug.

# --- Expected vs Actual markers (optional) ---
# Use st.write() to annotate what the user should observe.
```

Keep it as small as possible. If the reporter's snippet is 10 lines, don't make it 50.

## Playwright Verification Script

Write the verification script to `$OUT_DIR/gh-<N>/verify_gh_<N>.py`. It follows the same
Playwright patterns as the [debugging-streamlit](../debugging-streamlit/SKILL.md) skill —
see that skill for the full script template, the `e2e_playwright` helpers
(`get_text_input`, `click_button`, `wait_for_app_loaded`, `wait_for_app_run`, …), and
screenshot tips. The script runs in the repo's env (via `PYTHONPATH=. uv run`), so it can
import those helpers even when the app under test is a separately-installed released wheel.

Layer these reproduction-specific requirements on top of that template:

- **Screenshot** evidence into `$OUT_DIR/gh-<N>/` (e.g. `repro_gh_<N>.png`).
- **Assert** expected vs. actual so the assertion **FAILS when the bug exists**.
- **Exit code**: `0` = no bug detected, `1` = bug confirmed — so a caller can read the
  verdict from the exit status.

Run it once the app under test is up:

```bash
OUT_DIR="${OUT_DIR:-work-tmp/debug}" \
STREAMLIT_APP_URL="${STREAMLIT_APP_URL:-http://localhost:8600}" \
PYTHONPATH=. uv run python "$OUT_DIR/gh-<N>/verify_gh_<N>.py"
```

## st-issues App Template

Use this for `$OUT_DIR/gh-<N>/app.py` — the polished app that will be published to st-issues (deployed to issues.streamlit.app).

```python
"""
Reproduction for GitHub Issue #<N>
Title: <Issue Title>
URL: https://github.com/streamlit/streamlit/issues/<N>

Expected: <what should happen>
Actual:   <what the bug is>
Reported version: <version from issue>
"""
import streamlit as st

st.title("Issue #<N>: <Short Title>")
st.info("🔗 [View original issue](https://github.com/streamlit/streamlit/issues/<N>)")

# --- Issue Overview ---
st.header("Issue Overview")
st.write("**Expected:** <what should happen>")
st.error("**Actual (Bug):** <what actually happens>")

st.divider()

# --- Bug Demonstration ---
st.header("Bug Demonstration")
st.write("""
**Steps:**
1. <Step 1>
2. <Step 2>
3. Observe the bug
""")

# <Minimal reproduction code here>

st.divider()

# --- Workaround (if exists) ---
st.header("Workaround")
st.write("<Description of workaround, or 'No known workaround'>")
# st.code("# workaround code", language="python")

st.divider()

# --- Environment ---
st.header("Environment")
st.code(f"Streamlit version: {st.__version__}")
```

### Design principles for st-issues apps

- **Self-contained** — no external files, no setup
- **Bug is obvious** — use `st.error()` to highlight the problem, `st.success()` for expected
- **Keep layouts simple** — avoid columns/containers/expanders in the core reproduction (they may interfere with the bug)
- **Link to issue** — always include the GitHub link
- **One bug per app** — don't combine multiple issues

## NOTES.md Template

Use this for `$OUT_DIR/gh-<N>/NOTES.md` — structured investigation notes for maintainers and future triagers.

```markdown
# gh-<N>: <Short Title>

## Summary

<1-2 sentence description of the reported behavior and what was found.>

## Finding

**<Bug confirmed / Cannot reproduce / Working as intended>.** <Brief statement
of what was verified and on which version.>

## Reproduction

<How the bug was reproduced — version tested, method (Playwright, AppTest,
manual), and key observations. Include tables, DOM traces, or log excerpts
when they clarify the finding.>

## Root Cause

<What causes the bug at the code level. Include relevant file paths and
function names. If the root cause is unknown, say so and note what was
investigated.>

## Classification

- **Type:** <Bug / Not a bug — working as intended / Feature request>
- **Status:** <Confirmed on X.Y.Z / Cannot reproduce / Reproduced; behavior explained>
- **Areas:** <frontend|backend>, <component or module name>
- **Priority:** <P0 / P1 / P2 / P3 / P4> — <brief justification, per the priority guidelines>
- **Fix complexity:** <Small / Medium / Large> — <brief description of what a fix involves>
```

### Guidelines for NOTES.md

- **Be specific** — include version numbers, file paths, and line references
- **Show evidence** — paste relevant traces, DOM state, or assertion output
- **Explain the "why"** — root cause matters more than symptoms
- **Keep it scannable** — use headings, tables, and code blocks
- **Include fix direction** — even a one-liner hint helps future fixers
- **Recommend a priority per `wiki/issue-prioritization.md`** — read that doc first, then pick P0–P4 using its criteria (not an ad-hoc judgment) and give a one-sentence rationale
