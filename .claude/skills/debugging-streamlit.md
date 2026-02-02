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

All debug output goes to `work-tmp/debug/`:

| File | Content |
|------|---------|
| `work-tmp/debug/backend.log` | Python `print()` statements, Streamlit logs, errors |
| `work-tmp/debug/frontend.log` | Browser `console.log()`, React errors, Vite output |

Logs are cleared on each `make debug` run but persist after exit for post-mortem analysis.

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

Frontend `console.log()` output appears in `work-tmp/debug/frontend.log`.

## Workflow

1. Create or use a test script in `work-tmp/debug/` (e.g., `work-tmp/debug/test_feature.py`)
2. Run `make debug work-tmp/debug/test_feature.py`
3. Monitor logs: `tail -f work-tmp/debug/backend.log` or `tail -f work-tmp/debug/frontend.log`
4. Edit code - changes apply automatically via hot-reload
5. Check logs for debug output

## Temporary Playwright Scripts for Screenshots & Testing

For advanced debugging with screenshots or automated UI interaction.

### Quick: Playwright CLI

For simple screenshots and interactions, use `@playwright/cli` (available in frontend devDependencies):

```bash
cd frontend
yarn playwright-cli open http://localhost:3000
yarn playwright-cli screenshot --filename ../work-tmp/debug/screenshot.png --full-page
yarn playwright-cli close
```

See https://github.com/microsoft/playwright-cli for more commands (`snapshot`, `click`, `fill`, etc.).

### Custom Scripts

For complex interactions, create temporary Playwright scripts in `work-tmp/debug/`:

```python
# work-tmp/debug/debug_screenshot.py
"""Temporary Playwright script for debugging - run against make debug."""
from playwright.sync_api import sync_playwright, expect

from e2e_playwright.shared.app_utils import get_text_input, click_button
from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Connect to app started with `make debug`
        page.goto("http://localhost:3000")
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

Ensure `make debug <app.py>` is running first (start it in a background task if needed). Wait for the server to be ready on port 3000, then run the Playwright script:

```bash
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
- Frontend: Check `work-tmp/debug/frontend.log` for Vite errors. TypeScript errors can break HMR.

**Playwright script fails to connect:**
- Verify `make debug` is running and healthy
- Check http://localhost:3000 is accessible in browser
- Ensure `wait_for_app_loaded(page)` is called after `page.goto()`

## Cleanup

After debugging is complete, remove temporary scripts and screenshots from `work-tmp/debug/`.
