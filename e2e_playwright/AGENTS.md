# Streamlit E2E Tests

We use playwright with pytest to e2e test Streamlit library. E2E tests verify the complete Streamlit system (frontend, backend, communication, state, visual appearance) from a user's perspective (black-box). They complement Python/JS unit tests, which are faster and focus on internal logic, input/output validation, and specific message sequences. Use E2E tests when testing behavior that requires the full stack or visual verification, especially for new elements or significant changes to existing ones.

## Test Structure

- Located in `e2e_playwright/`
- Each test consists of two files:
  - `*.py`: Streamlit app script that's being tested
  - `*_test.py`: Playwright pytest file that runs the app and tests it
- If the test is specific to a Streamlit element, prefix the filename with `st_<element_name>`
- Tests can use screenshot comparisons for visual verification
- Screenshots are stored in `e2e_playwright/__snapshots__/<os>/`
- Other test results are stored in `e2e_playwright/test_results/`

## Key Fixtures and Utilities

Import from `conftest.py`:

- `app: Page` - Light mode app fixture
- `themed_app: Page` - Light & dark mode app fixture
- `assert_snapshot` - Screenshot testing fixture. Ensure element is stable before calling.
- `wait_for_app_run(app)` - Wait for app run to finish
- `wait_for_app_loaded(app)` - Wait for initial app load
- `rerun_app(app)` - Trigger app rerun and wait
- `wait_until(app, fn)` - Run test function until True or timeout

## Best Practices

- As a guiding principle, tests should resemble how users interact with the UI.
- Use `expect` for auto-wait assertions, not `assert` (reduces flakiness)
- If `expect` is insufficient, use the `wait_until` utility. Never use `wait_for_timeout`.
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
- e2e tests are expensive, please test every aspect only one time.
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

- Single test: `make run-e2e-test e2e_playwright/name_of_the_test.py`
- Debug test (needs manual interactions): `make debug-e2e-test e2e_playwright/name_of_the_test.py`
- If frontend logic was changed, it will require running `make frontend-fast` to update the frontend.
- You can ignore missing or mismatched snapshot errors. These need to be updated manually.
