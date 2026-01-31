---
name: debugging-streamlit
description: Debug Streamlit frontend and backend changes using make debug with hot-reload. Use when testing code changes, investigating bugs, checking UI behavior, or needing screenshots of the running app.
---

# Debugging Streamlit Apps

## Quick Start

```bash
make debug my_app.py
```

This starts both backend (Streamlit/Python) and frontend (Vite/React) with hot-reload. The app is available at http://localhost:3000.

**Hot-reload behavior:**
- **Frontend**: Changes to `frontend/` code are applied within seconds.
- **Backend**: Only changes to the **app script** trigger a rerun. Changes to the Streamlit library itself (`lib/streamlit/`) require restarting `make debug`.

## Log Files

All debug output goes to `work-tmp/`:

| File | Content |
|------|---------|
| `work-tmp/debug-backend.log` | Python `print()` statements, Streamlit logs, errors |
| `work-tmp/debug-frontend.log` | Browser `console.log()`, React errors, Vite output |

Logs are cleared on each `make debug` run but persist after exit for post-mortem analysis.

## Adding Debug Output

**Backend (Python):**
```python
print(f"DEBUG: widget value = {value}")
print(f"DEBUG: session_state = {st.session_state}")
```

**Frontend (TypeScript/React):**
```typescript
console.log("DEBUG: props =", props)
console.log("DEBUG: state =", state)
```

Frontend `console.log()` output appears in `work-tmp/debug-frontend.log`.

## Workflow

1. Create or use a test script in `work-tmp/` (e.g., `work-tmp/test_feature.py`)
2. Run `make debug work-tmp/test_feature.py`
3. Monitor logs: `tail -f work-tmp/debug-backend.log` or `tail -f work-tmp/debug-frontend.log`
4. Edit code - changes apply automatically via hot-reload
5. Check logs for debug output

## Temporary Playwright Scripts for Screenshots & Testing

For advanced debugging with screenshots or automated UI interaction, create temporary Playwright scripts.

### Setup

Create a script in `work-tmp/` that imports e2e_playwright utilities directly:

```python
# work-tmp/debug_screenshot.py
"""Temporary Playwright script for debugging - run against make debug."""
from playwright.sync_api import sync_playwright, expect

from e2e_playwright.shared.app_utils import (
    get_text_input,
    get_button,
    click_button,
    get_markdown,
)
from e2e_playwright.conftest import (
    wait_for_app_loaded,
    wait_for_app_run,
)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Connect to app started with `make debug`
        page.goto("http://localhost:3000")
        wait_for_app_loaded(page)

        # Interact with the app
        # Example: click_button(page, "Submit")

        # Take screenshot
        page.screenshot(path="work-tmp/debug/debug_screenshot.png", full_page=True)
        print(f"Screenshot saved to work-tmp/debug/debug_screenshot.png")

        # Element-specific screenshot
        # element = get_button(page, "My Button")
        # element.screenshot(path="work-tmp/debug/button.png")

        browser.close()


if __name__ == "__main__":
    main()
```

### Running Temporary Scripts

With `make debug <app.py>` running in another terminal, run scripts from the repo root using `uv run` with `PYTHONPATH=.`:

```bash
PYTHONPATH=. uv run python work-tmp/debug_screenshot.py
```

This uses the uv-managed environment with all dependencies (playwright, etc.) and makes `e2e_playwright` importable without path manipulation.

### Available Utilities from e2e_playwright

**Element Locators** (`e2e_playwright.shared.app_utils`):
- `get_text_input(page, label)`, `get_text_area(page, label)`
- `get_button(page, label)`, `get_checkbox(page, label)`
- `get_selectbox(page, label)`, `get_multiselect(page, label)`
- `get_slider(page, label)`, `get_number_input(page, label)`
- `get_markdown(page)`, `get_expander(page, label)`
- `get_element_by_key(page, key)` - locate by `st.key` parameter

**Interaction Helpers**:
- `click_button(page, label)`, `click_checkbox(page, label)`
- `select_selectbox_option(page, locator, option)`
- `fill_number_input(page, locator, value)`

**Synchronization** (`e2e_playwright.conftest`):
- `wait_for_app_loaded(page)` - wait for initial load
- `wait_for_app_run(page)` - wait for script execution after interaction
- `wait_until(page, fn, timeout)` - poll until condition is true

**React Stability** (`e2e_playwright.shared.react18_utils`):
- `wait_for_react_stability(page)` - wait for React DOM mutations to settle

### Screenshot Best Practices

```python
# Full page screenshot
page.screenshot(path="work-tmp/debug/full.png", full_page=True)

# Element screenshot
element = page.get_by_test_id("stDataFrame")
element.screenshot(path="work-tmp/debug/dataframe.png")

# Wait for stability before screenshot (for dynamic content)
from e2e_playwright.shared.react18_utils import wait_for_react_stability
wait_for_react_stability(page)
page.screenshot(path="work-tmp/debug/stable.png")

# Capture viewport only (excludes scrollable content)
page.screenshot(path="work-tmp/debug/viewport.png", full_page=False)
```

### Example: Debug Form Interaction

```python
# work-tmp/debug_form.py
from playwright.sync_api import sync_playwright, expect

from e2e_playwright.shared.app_utils import get_text_input, get_button, click_button
from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        page.goto("http://localhost:3000")
        wait_for_app_loaded(page)

        # Fill a text input
        text_input = get_text_input(page, "Name")
        text_input.fill("Test User")

        # Click submit and wait for rerun
        click_button(page, "Submit")
        wait_for_app_run(page)

        # Verify result
        expect(page.get_by_text("Hello, Test User")).to_be_visible()

        # Screenshot the result
        page.screenshot(path="work-tmp/debug/form_result.png")
        print("Test passed! Screenshot saved.")

        browser.close()


if __name__ == "__main__":
    main()
```

Run with: `PYTHONPATH=. uv run python work-tmp/debug_form.py`

## Troubleshooting

**Port already in use:**
```bash
# Check what's using the ports
lsof -ti:3000  # Vite dev server
lsof -ti:8501  # Streamlit backend
```

If ports are in use, **ask the user first** before killing processes. They may have other debug sessions or applications running intentionally. Only after user confirmation:
```bash
# Kill processes (only after user confirms)
kill $(lsof -ti:3000) $(lsof -ti:8501)
```

**Hot-reload not working:**
- Backend: Only the app script is watched. Changes to `lib/streamlit/` require restarting `make debug`.
- Frontend: Check `work-tmp/debug-frontend.log` for Vite errors.

**Playwright script fails to connect:**
- Verify `make debug` is running and healthy
- Check http://localhost:3000 is accessible in browser
- Ensure `wait_for_app_loaded(page)` is called after `page.goto()`
