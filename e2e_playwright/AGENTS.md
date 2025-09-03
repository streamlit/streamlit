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
- Other tests results are stored in `e2e_playwright/test_results/`

## Key Fixtures and Utilities

Import from from `conftest.py`:

- `app: Page` - Light mode app fixture
- `themed_app: Page` - Light & dark mode app fixture
- `assert_snapshot` - Screenshot testing fixture. Ensure element is stable before calling.
- `wait_for_app_run(app)` - Wait for app run to finish
- `wait_for_app_loaded(app)` - Wait for initial app load
- `rerun_app(app)` - Trigger app rerun and wait
- `wait_until(app, fn)` - Run test function until True or timeout

## Best Practices

- Use `expect` for assertions, not `assert` (reduces flakiness)
- Use `get_by_test_id` to locate elements preferentially. Use `.locator` only when necessary.
- If `expect` is insufficient, use the `wait_until` utility. Never use `wait_for_timeout`.
- Group related tests into single, logical test files (e.g., by widget or feature) for CI efficiency.
- Minimize screenshot surface area; screenshot specific elements, not the whole page unless necessary.
- Ensure elements screenshotted are under 640px height to avoid clipping by the header.
- Naming convention for command-related snapshots: `st_command-test_description`
- Take a look at other tests in `e2e_playwright/` as inspiration.
- e2e tests are expensive, please test every aspect only one time.

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
- **Custom Config:** Use module-scoped fixtures with `@pytest.mark.early` for tests requiring specific Streamlit configuration options.

## Running tests

- Single test: `make run-e2e-test e2e_playwright/name_of_the_test.py`
- Debug test: `make debug-e2e-test e2e_playwright/name_of_the_test.py`
- If frontend logic was changed, it will require running `make frontend-fast` to update the frontend.
- Use `make update-snapshots` script to retrieve updated snapshots from GitHub workflow.
