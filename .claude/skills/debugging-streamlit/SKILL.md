---
name: debugging-streamlit
description: Debug Streamlit frontend and backend changes using make debug with hot-reload. Use when testing code changes, investigating bugs, checking UI behavior, or needing screenshots of the running app.
---

# Debugging Streamlit Apps

## Quick Start

```bash
make debug my_app.py
```

This starts both backend (Streamlit/Python) and frontend (Vite/React) with hot-reload. The app URL is printed on startup (default `http://localhost:3001`; `3000` is reserved for manual `make frontend-dev`; it may use `3002+` if other debug sessions are running). Avoid pinning `VITE_PORT` unless you have a specific hard requirement (last resort).

**Hot-reload behavior:**
- **Frontend**: Changes to `frontend/` code are applied within seconds.
- **Backend**: Only changes to the **app script** trigger a rerun. Changes to the Streamlit library itself (`lib/streamlit/`) require restarting `make debug`.

## Log Files

Each `make debug` run writes logs to a per-session directory under `work-tmp/debug/` and updates `work-tmp/debug/latest/` to point at the most recent session.
Because `latest/*` is a symlink, **it can move** if multiple debug sessions are starting/stopping concurrently—prefer using the session directory path printed by `make debug` when you need stable log references.
You can find the exact session directory in the `make debug` startup output under the `Log files` section.

| File | Content |
|------|---------|
| `work-tmp/debug/latest/backend.log` | Python `print()` statements, Streamlit logs, errors |
| `work-tmp/debug/latest/frontend.log` | Browser `console.log()`, React errors, Vite output |

Logs are cleared at the start of each session and persist after exit for post-mortem analysis.

**Log size warning:** Logs can grow large during extended debugging sessions. Instead of reading entire log files, use `rg` to search for specific patterns:

```bash
# Search for specific debug messages
rg "DEBUG:" work-tmp/debug/latest/backend.log

# Search for errors (case-insensitive)
rg -i "error|exception|traceback" work-tmp/debug/latest/backend.log

# Search with context (3 lines before/after)
rg -C 3 "my_function" work-tmp/debug/latest/backend.log

# Search frontend logs for specific component
rg "MyComponent" work-tmp/debug/latest/frontend.log
```

Use this directory for all debugging artifacts (scripts, screenshots, etc.) to keep them organized.

## Adding Debug Output

**Backend (Python):**
```python
print(f"DEBUG: session_state = {st.session_state}")
```

**Frontend (TypeScript/React):**
```typescript
console.log("DEBUG: props =", props)
```

Frontend `console.log()` output appears in `work-tmp/debug/latest/frontend.log` (or the current session's `frontend.log` file).

## Workflow

1. Create or use a test script in `work-tmp/debug/` (e.g., `work-tmp/debug/test_feature.py`)
2. Run `make debug work-tmp/debug/test_feature.py`
3. **Verify startup**: Check `work-tmp/debug/latest/backend.log` for `Error`/`Exception` and `work-tmp/debug/latest/frontend.log` for console errors to ensure both servers started correctly
4. Access the printed App URL in your browser (default `http://localhost:3001`, but it may be `3002+`)
5. **Verify script execution**: Check `work-tmp/debug/latest/backend.log` again for any errors after the first app access
6. Monitor logs by inspecting `work-tmp/debug/latest/backend.log` and `work-tmp/debug/latest/frontend.log`
7. Edit code - changes apply automatically via hot-reload
8. Check logs for debug output

**Quick error check:**
```bash
# Backend errors
rg -i "error|exception" work-tmp/debug/latest/backend.log

# Frontend console errors
rg -i "error" work-tmp/debug/latest/frontend.log
```

## Temporary Playwright Scripts for Screenshots & Testing

For advanced debugging with screenshots or automated UI interaction.

### Quick: Playwright CLI

For simple screenshots and interactions, use `@playwright/cli` (available in frontend devDependencies):

```bash
cd frontend
STREAMLIT_APP_URL=http://localhost:3001
yarn playwright-cli open "$STREAMLIT_APP_URL"
yarn playwright-cli screenshot --filename ../work-tmp/debug/screenshot.png --full-page
yarn playwright-cli close
```

See https://github.com/microsoft/playwright-cli for more commands (`snapshot`, `click`, `fill`, etc.).

### Custom Scripts

For complex interactions, create temporary Playwright scripts in `work-tmp/debug/`:

```python
# work-tmp/debug/debug_screenshot.py
"""Temporary Playwright script for debugging - run against make debug."""
import os
from playwright.sync_api import sync_playwright, expect

from e2e_playwright.shared.app_utils import get_text_input, click_button
from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run


def main():
    app_url = os.environ.get("STREAMLIT_APP_URL", "http://localhost:3001")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Connect to app started with `make debug`
        page.goto(app_url)
        wait_for_app_loaded(page)

        # Interact with the app
        text_input = get_text_input(page, "Name")
        text_input.fill("Test User")
        click_button(page, "Submit")
        wait_for_app_run(page)

        # Verify and screenshot
        expect(page.get_by_text("Hello, Test User")).to_be_visible()
        page.screenshot(path="work-tmp/debug/debug_screenshot.png", full_page=True)
        print("Screenshot saved to work-tmp/debug/debug_screenshot.png")

        browser.close()


if __name__ == "__main__":
    main()
```

### Running Temporary Scripts

Ensure `make debug <app.py>` is running first (start it in a background task if needed). If your `make debug` session is using a non-default port, set `STREAMLIT_APP_URL` accordingly, then run the Playwright script:

```bash
STREAMLIT_APP_URL=http://localhost:3001 \
PYTHONPATH=. uv run python work-tmp/debug/debug_screenshot.py
```

This uses the uv-managed environment with all dependencies (playwright, etc.) and makes `e2e_playwright` importable without path manipulation.

### Available Utilities from e2e_playwright

**Element Locators & Interactions** (`e2e_playwright.shared.app_utils`):
Provides helpers like `get_text_input()`, `get_button()`, `click_button()`, `get_checkbox()`, etc.

**Synchronization** (`e2e_playwright.conftest`):
- `wait_for_app_loaded(page)` - wait for initial load
- `wait_for_app_run(page)` - wait for script execution after interaction
- `wait_until(page, fn, timeout)` - poll until condition is true

**Playwright API Reference**: https://playwright.dev/python/docs/api/class-playwright

### Screenshot Best Practices

```python
# Full page screenshot
page.screenshot(path="work-tmp/debug/full.png", full_page=True)

# Element screenshot
element = page.get_by_test_id("stDataFrame")
element.screenshot(path="work-tmp/debug/dataframe.png")
```

## Troubleshooting

**Port already in use / multiple sessions:**
- `make debug` will automatically pick a free frontend port (typically in the `3001-3100` range) so multiple debug sessions can run simultaneously.
- Frontend port `3000` is reserved for manual `make frontend-dev` sessions.
- If you have a hard requirement for a specific frontend port, you can pin it with `VITE_PORT=3002 make debug <app.py>` (last resort).

**Hot-reload not working:**
- Backend: Only the app script is watched. Changes to `lib/streamlit/` require restarting `make debug`.
- Frontend: Check `work-tmp/debug/latest/frontend.log` for Vite errors. TypeScript errors can break HMR.

**Playwright script fails to connect:**
- Verify `make debug` is running and healthy
- Check the printed App URL is accessible in the browser
- Ensure `wait_for_app_loaded(page)` is called after `page.goto()`

## Cleanup

After debugging is complete, remove temporary scripts and screenshots from `work-tmp/debug/`.
