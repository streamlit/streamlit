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

## Playwright Verification Script Template

Use this for `$OUT_DIR/gh-<N>/verify_gh_<N>.py` — a standalone script that runs against the app under test (released wheel or `make debug` session).

```python
"""Playwright verification for GitHub Issue #<N>."""
import os
import sys

from playwright.sync_api import sync_playwright, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    # Import helpers as needed:
    # get_text_input, get_button, click_button, get_checkbox,
    # get_selectbox, get_multiselect, expect_markdown,
)


def main() -> int:
    app_url = os.environ.get("STREAMLIT_APP_URL", "http://localhost:8600")
    out_dir = os.environ.get("OUT_DIR", "work-tmp/debug")
    screenshot_path = f"{out_dir}/gh-<N>/repro_gh_<N>.png"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        page.goto(app_url)
        wait_for_app_loaded(page)

        # --- Interact to trigger the bug ---
        # Example: fill a text input and click a button
        # text_input = get_text_input(page, "Label")
        # text_input.locator("input").fill("value")
        # click_button(page, "Submit")
        # wait_for_app_run(page)

        # --- Capture evidence ---
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved: {screenshot_path}")

        # --- Verify expected behavior ---
        # Write assertions that FAIL when the bug exists:
        # expect(page.get_by_text("expected output")).to_be_visible()
        #
        # Or check for the buggy state:
        # buggy_element = page.locator(".error-state")
        # if buggy_element.count() > 0:
        #     print("BUG CONFIRMED: error state element found")
        #     return 1

        browser.close()

    print("Verification complete — no bug detected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Running the script

```bash
# Ensure the app under test is running first, then:
OUT_DIR="${OUT_DIR:-work-tmp/debug}" \
STREAMLIT_APP_URL="${STREAMLIT_APP_URL:-http://localhost:8600}" \
PYTHONPATH=. uv run python "$OUT_DIR/gh-<N>/verify_gh_<N>.py"
```

Exit code 0 = no bug detected, exit code 1 = bug confirmed.

### Available Playwright utilities

**Element locators** (`e2e_playwright.shared.app_utils`):
- `get_text_input(page, label)`, `get_button(page, label)`, `click_button(page, label)`
- `get_checkbox(page, label)`, `get_selectbox(page, label)`, `get_multiselect(page, label)`
- `expect_markdown(page, text)`, `get_dataframe(page)`

**Synchronization** (`e2e_playwright.conftest`):
- `wait_for_app_loaded(page)` — wait for initial load
- `wait_for_app_run(page)` — wait for script execution after an interaction
- `wait_until(page, fn, timeout)` — poll until condition is true

**Screenshot helpers:**
```python
# Full page
page.screenshot(path="path.png", full_page=True)

# Specific element
element = page.get_by_test_id("stDataFrame")
element.screenshot(path="element.png")
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
- **Priority:** <P0 / P1 / P2 / P3 / Won't Fix> — <brief justification, per the priority guidelines>
- **Fix complexity:** <Small / Medium / Large> — <brief description of what a fix involves>
```

### Guidelines for NOTES.md

- **Be specific** — include version numbers, file paths, and line references
- **Show evidence** — paste relevant traces, DOM state, or assertion output
- **Explain the "why"** — root cause matters more than symptoms
- **Keep it scannable** — use headings, tables, and code blocks
- **Include fix direction** — even a one-liner hint helps future fixers
- **Recommend a priority per `wiki/issue-prioritization.md`** — read that doc first, then pick P0–P3 (or Won't Fix) using its criteria (not an ad-hoc judgment) and give a one-sentence rationale
