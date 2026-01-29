---
applyTo: "e2e_playwright/**/*.py"
---

# Streamlit E2E Tests

We use playwright with pytest to e2e test Streamlit library. E2E tests verify the complete Streamlit system (frontend, backend, communication, state, visual appearance) from a user's perspective (black-box). They complement Python/JS unit tests, which are faster and focus on internal logic, input/output validation, and specific message sequences. Use E2E tests when testing behavior that requires the full stack or visual verification, especially for new elements or significant changes to existing ones.

## Test Structure

- Located in `e2e_playwright/`
- Each test consists of two files:
  - `*.py`: Streamlit app script that's being tested
  - `*_test.py`: Playwright pytest file that runs the app and tests it
- If the test is specific to a Streamlit element, prefix the filename with `st_<element_name>`
- Tests can use screenshot comparisons for visual verification
- All screenshots are stored in `e2e_playwright/__snapshots__/<os>/`
- Other e2e test results are stored in `e2e_playwright/test_results/` which includes:
  - `e2e_playwright/test_results/<test_name>/`: Video and traces related to the failed test.
  - `e2e_playwright/test_results/snapshot-tests-failures/<os>/<test_script>/<test_name>/`: Expected, actual, and diff screenshots of the failed snapshot test.
  - `e2e_playwright/test_results/snapshot-updates/<os>/<test_script>/<test_name>/`: All updated screenshots of the failed test.

## Key Fixtures and Utilities

Import from `conftest.py`:

- `app: Page` - Light mode app fixture
- `themed_app: Page` - Light & dark mode app fixture
- `app_target: AppTarget` - App interaction wrapper (supports iframe-hosted external apps)
- `app_base_url: str` - Base URL for app navigation (external or localhost)
- `build_app_url(...)` - URL builder to compose paths/query/fragment from `app_base_url`
- `assert_snapshot` - Screenshot testing fixture. Ensure element is stable before calling.
- `wait_for_app_run(app)` - Wait for app run to finish
- `wait_for_app_loaded(app)` - Wait for initial app load
- `rerun_app(app)` - Trigger app rerun and wait
- `wait_until(app, fn)` - Run test function until True or timeout

## External Test Mode

- When writing `@pytest.mark.external_test` tests, prefer `app_target` over a bare `Page`/`FrameLocator`. It abstracts whether the app DOM is at the top-level (`Page`) or inside a host page (`FrameLocator`).
- The `external_test` marker supports a small set of keyword arguments. See `e2e_playwright/conftest.py` (and `pytest --markers`) for the canonical list and behavior.
- External modes are configured via CLI/env and may affect what fixtures mean:
  - `--external-app-url` / `STREAMLIT_E2E_EXTERNAL_APP_URL`: run against an externally hosted Streamlit app (no local server).
  - `--external-host-url` / `STREAMLIT_E2E_EXTERNAL_HOST_URL`: run against a host page that embeds the app in an iframe (no local server).
  - `--external-iframe-selector` / `STREAMLIT_E2E_EXTERNAL_IFRAME_SELECTOR`: iframe selector inside the host page (defaults to `iframe`).
- Deciding whether a test should be marked `external_test` is **manual for now**. Only add the marker when the test is explicitly intended to run against an externally hosted app/host page.
- As a rule of thumb, a test is a good candidate for `external_test` if it:
  - can run without starting the local app server (it should not depend on the test module's `*.py` script being launched by the harness),
  - uses stable selectors and the `app_target`/`app_base_url` abstractions (so it works both for top-level and iframe-hosted apps),
  - avoids relying on local-only infrastructure like request routing/interception (`iframed_app`) or filesystem-coupled assumptions.

## Best Practices

- Imports should be at the top-level of the test file. Only use imports inside test functions when there is a specific reason.
- As a guiding principle, tests should resemble how users interact with the UI.
- Use `expect` for auto-wait assertions, not `assert` (reduces flakiness)
- If `expect` is insufficient, use the `wait_until` utility. Never use `wait_for_timeout`.
- Add at least one “must NOT happen” check per scenario when practical: Alongside the positive UI outcome, assert the absence of a likely regression (e.g., no duplicate element appears, a tooltip is not shown until hover, a widget remains non-interactive when `disabled=True`, no unexpected rerun/state change, etc.).
- Keep negatives high-signal: E2E is expensive—prefer one targeted negative assertion per scenario over large negative matrices.
- Prefer label- or key-based locators over index-based access (e.g. `get_by_test_id().nth(0)`). The recommended order of priority is:
  1. get elements by label (see `app_utils` methods, e.g. `get_text_input`).
  2. elements that don't support `label` but support `key`: get elements by a unique key (`get_element_by_key`).
  3. If the element doesn't support key or label, you can wrap it with an `st.container(key="my_key")` to better target it via `get_element_by_key`. E.g. `get_element_by_key("my_key").get_by_test_id("stComponent")`.
- Prefer stable locators like `get_by_test_id`, `get_by_text` or `get_by_role` over CSS / XPath selectors via `.locator`.
- Group related tests into single, logical test files (e.g., by widget or feature) for CI efficiency.
- Minimize screenshot surface area; screenshot specific elements, not the whole page unless necessary.
- Use descriptive test names.
- Ensure elements screenshotted are under 640px height to avoid clipping by the header.
- Naming convention for command-related snapshots: `st_command-test_description`
- Take a look at other tests in `e2e_playwright/` as inspiration.
- Important: E2E tests are expensive, please test every aspect only one time. Prefer adding new tests to existing e2e test files if they fit the scope, instead of creating new test scripts.
- Make use of shared `app_utils` methods (import from `e2e_playwright.shared.app_utils`) if applicable.
- Make sure that the tests mix different ways of interactions (e.g. fill and type for input fields) for increased coverage.

## Writing Tests & Common Scenarios

When adding or modifying tests for an element, ensure the following are covered:

- **Visuals:** Snapshot tests for both normal and `disabled` states.
- **Interactivity:** Test user interactions and verify the resulting app state or output (e.g., checking text written via `st.write`, potentially using helpers like `expect_markdown` from `shared/app_utils.py`).
- **Common Contexts:** Verify behavior within:
  - A `@st.fragment`.
  - An `st.form`.
- **Core Behavior:**
  - State persistence (widget value is retained) if the element is temporarily unmounted and remounted.
  - The element cannot be interacted with when `disabled=True`.
  - If the element uses the `help` parameter, verify the tooltip appears correctly on hover.
  - If the element uses the `key` parameter, verify a corresponding CSS class or attribute is set.
  - If the element is a widget, make sure to test that the identity is kept stable when `key` is provided.
- **Custom Config:** Use module-scoped fixtures with `@pytest.mark.early` for tests requiring specific Streamlit configuration options.

## Running tests

- Single test file: `make run-e2e-test e2e_playwright/name_of_the_test.py`
- Single test: `make run-e2e-test e2e_playwright/name_of_the_test.py::test_name`
- Pass any pytest arguments via `PYTEST_ADDOPTS`, e.g. `PYTEST_ADDOPTS='-k test_name -vvv' make run-e2e-test e2e_playwright/name_of_the_test.py`
- Debug test (needs manual interactions): `make debug-e2e-test e2e_playwright/name_of_the_test.py`
- If frontend logic was changed, it will require running `make frontend-fast` to update the frontend.
- You can ignore missing or mismatched snapshot errors. These need to be updated manually.
