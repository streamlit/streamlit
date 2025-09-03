# Streamlit Library Development Rules

## Streamlit Repo Overview

### Folder Structure

- `lib/`: All backend code and assets.
- `lib/streamlit/`: The main Streamlit library package.
- `lib/streamlit/elements/`: Backend code of elements and widgets.
- `lib/tests`: Python unit tests.
- `frontend/`: All frontend code and assets.
- `frontend/app/`: Streamlit application UI.
- `frontend/lib/`: Shared TS library that contains elements, widgets, and layouts.
- `frontend/utils/`: Shared utils.
- `frontend/connection/`: WebSocket connection handling logic.
- `proto/`: Protobuf definitions for client-server communication.
- `e2e_playwright/`: E2E tests using playwright.
- `scripts/`: Utility scripts for development and CI/CD.
- `component-lib/`: Library for building custom components.

### `make` commands

Selection of `make` commands executable from root relevant for development:

help                       Show all available commands.
protobuf                   Recompile Protobufs for Python and the frontend.
python-lint                Lint and check formatting of Python files.
python-tests               Run all Python unit tests.
python-types               Run the Python type checker.
frontend-fast              Build the frontend.
frontend-dev               Start the frontend development server.
frontend-lint              Lint and check formatting of frontend files.
frontend-types             Run the frontend type checker.
frontend-format            Format frontend files.
frontend-tests             Run all frontend unit tests.
autofix                    Autofix linting and formatting errors.
debug-e2e-test             Run e2e test in debug mode, via: `make debug-e2e-test st_command_test.py`.
run-e2e-test               Run e2e test, via: `make run-e2e-test st_command_test.py`.

---

## Protobuf

### Protobuf Compatibility

Always keep Streamlit's protobuf messages backwards compatible. New versions of the protobuf messages must work with
old versions of Streamlit. Thereby, we can assume that the backend and frontend version are the same. All changes
that would not work with an older Streamlit version are incompatible and should be avoided as much as possible.

Typical incompatible changes are:

- Removing a field → instead add a `// DEPRECATED` comment and mark is as `[deprecated=true]`
- Renaming a field → instead deprecate it and introduce a new field with a *new* number
- Changing the number of a field -> all field numbers must be kept as is.
- Adding or removing the `optional` keyword -> deprecate field and add a new one.
- Changing the type of a field in an incompatible way → see the @Protobuf docs for message types for more details.

### Compile Protobuf

If you ever modify our protobufs, you'll need to run the command below to compile the
protos into libraries that can be used in Python and JS:

```bash
make protobuf
```

---

## Python Development Guide

- Supported Python versions: 3.9 - 3.13
- Linter: Ruff 0.x
- Formatter: Ruff 0.x
- Type Checker: mypy 1.x
- Testing: pytest 8.x

### Key Principles

- PEP 8 Compliance: Adhere to PEP 8 guidelines for code style, with Ruff as the primary linter and formatter.
- Elegance and Readability: Strive for elegant and Pythonic code that is easy to understand and maintain.
- Zen of Python: Keep the Zen of Python in mind when making design decisions.
- Avoid inheritance (prefer composition).
- Avoid methods (prefer non-class functions, or static).
- Name functions and variables in such a way that you don't need comments to explain the code.
- Python folder and filenames should all be snake_cased regardless of what they contain.
- Prefer importing entire modules instead of single functions: `from streamlit import mymodule` over `from streamlit.mymodule import internal_function`
- Prefer keyword arguments, use positional values only for required values that frame the API. The enhancing arguments, should be keyword-only.
- Capitalize comments, use proper grammar and punctuation, and no cursing.
- Inside a module, anything that is declared at the root level MUST be prefixed with a _ if it's only used inside that module (anything private).
- Prioritize new features in Python 3.9+.

### Docstrings

- Use Numpydoc style.
- Docstrings are meant for users of a function, not developers who may be edit the internals of that function in the future. If you want to talk to future developers, use comments.
- All modules that we expect users to interact with must have top-level docstrings. If a user is not meant to interact with a module, docstrings are optional.

### Typing

- Add typing annotations to every new function, method or class member.
- Use `typing_extensions` for back-porting newer typing features.
- Use future annotations via `from __future__ import annotations`.

---

## Streamlit Lib Python Guide

Tips and guidelines specific to the development of the Streamlit Python library,
not applicable scripts and e2e tests.

### Logging

If something needs to be logged, please use our logger - that returns a default
Python logger - with an appropriate logging level:

```python
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)
```

### Unit Tests

We use the unit tests to cover internal behavior that can work without the web / backend
counterpart and the e2e tests to test the entire system. We aim for high unit test
coverage (90% or higher) of our Python code in `lib/streamlit`.

- Under `lib/tests/streamlit`, add a new test file
- Preferably in the mirrored directory structure as the non-test files.
- Naming: `my_example_test.py`

#### Typing Tests

We also have typing tests in `lib/tests/streamlit/typing` for our public API to catch
typing errors in parameters or return types by using mypy and `assert_type`.
Check other typing tests in the `lib/tests/streamlit/typing` directory for inspiration.

---

## Python Unit Test Guide

We use the unit tests to cover internal behavior that can work without the web / backend counterpart.
We aim for high unit test coverage (90% or higher) of our Python code in `lib/streamlit`.

### Key Principles

- Prefer pytest or pytest plugins over unittest.
- For every new test function, please add a brief docstring comment (numpydoc style).
- New tests should be fully annotated with types.
- Skip tests (via `pytest.mark.skipif`) requiring CI secrets if the environment variables are not set.

### Running tests

- Run all with:

```bash
make python-tests
```

- Run a specific test file with:

```bash
PYTHONPATH=lib pytest lib/tests/streamlit/my_example_test.py
```

- Run a specific test inside a test file with:

```bash
PYTHONPATH=lib pytest lib/tests/streamlit/my_example_test.py -k test_that_something_works
```

---

## TypeScript Development Guide

- TypeScript: v5
- Linter: eslint v9
- Formatter: prettier v3
- Framework: React v18
- Styling: @emotion/styled v11
- Build tool: vite v6
- Package manager: yarn v4 with workspaces

### Key TypeScript Principles

- Prefer functional, declarative programming.
- Prefer iteration and modularization over duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading).
- Use the Receive an Object, Return an Object (RORO) pattern.
- Ensure functions have explicit return types.

### Key Frontend Principles

- Leverage all of best practices of React 18.
- Write performant frontend code.
- Ensure referential stability by leveraging React Hooks.
- Prefix event handlers with "handle" (eg: handleClick, handleSubmit).
- Favor leveraging @emotion/styled instead of inline styles.
- Leverage object style notation in Emotion.
- All styled components begin with the word `Styled` to indicate it's a styled component.
- Utilize props in styled components to display elements that may have some interactivity.
  - Avoid the need to target other components.
- When using BaseWeb, be sure to import our theme via `useEmotionTheme` and use those values in overrides.
- Use the following pattern for naming custom CSS classes and test IDs: `stComponentSubcomponent`, for example: `stTextInputIcon`.

### Yarn Workspaces

- Project Structure: Monorepo managed with Yarn Workspaces.
- Packages: `app, connection, lib, protobuf, typescript-config, utils`
- Package-specific scripts are executed within their respective directories.

### TypeScript Test Guide

- Test Framework: Vitest
- UI Testing Library: React Testing Library (RTL)

#### Key Principles

- Coverage: Implement both unit and integration tests (using RTL where applicable).
- Robustness: Test edge cases and error handling scenarios.
- Accessibility: Validate component accessibility compliance.
- Parameterized Tests: Use `it.each` for repeated tests with varying inputs.
- Framework Exclusivity: Only use Vitest syntax; do not use Jest.

#### Running Tests

- Yarn test commands must be run from the `<GIT_ROOT>/frontend` directory.

- Run All Tests: `yarn test`
- Run Specific File: `yarn test lib/src/components/path/component.test.tsx`
- Run Specific Test: `yarn test -t "the test name" lib/src/components/path/component.test.tsx`

#### React Testing Library best practices

Cheat sheet for queries from RTL:

|            | No Match | 1 Match | 1+ Match | Await? |
| ---------- | -------- | ------- | -------- | ------ |
| getBy      | throw    | return  | throw    | No     |
| findBy     | throw    | return  | throw    | Yes    |
| queryBy    | null     | return  | throw    | No     |
| getAllBy   | throw    | array   | array    | No     |
| findAllBy  | throw    | array   | array    | Yes    |
| queryAllBy | []       | array   | array    | No     |

- Utilizing any query that throws if not found AND asserting using `toBeInTheDocument` is redundant and must be avoided. Prefer `toBeVisible` instead.
- User interactions should utilize the `userEvent` library.
- Tests should be written in a way that asserts user behavior, not implementation details.

##### Query Priority Order

Based on the Guiding Principles, your test should resemble how users interact with your code (component, page, etc.) as much as possible. With this in mind, we recommend this order of priority:

1. Queries Accessible to Everyone Queries that reflect the experience of visual/mouse users as well as those that use assistive technology.

   - getByRole, getByLabelText, getByPlaceholderText, getByText, getByDisplayValue

2. Semantic Queries HTML5 and ARIA compliant selectors. Note that the user experience of interacting with these attributes varies greatly across browsers and assistive technology.

   - getByAltText, getByTitle

3. Test IDs

   - getByTestId - The user cannot see (or hear) these, so this is only recommended for cases where you can't match by role or text or it doesn't make sense (e.g. the text is dynamic).

---

## Streamlit E2E Tests

We use playwright with pytest to e2e test Streamlit library. E2E tests verify the complete Streamlit system (frontend, backend, communication, state, visual appearance) from a user's perspective (black-box). They complement Python/JS unit tests, which are faster and focus on internal logic, input/output validation, and specific message sequences. Use E2E tests when testing behavior that requires the full stack or visual verification, especially for new elements or significant changes to existing ones.

### Test Structure

- Located in `e2e_playwright/`
- Each test consists of two files:
  - `*.py`: Streamlit app script that's being tested
  - `*_test.py`: Playwright pytest file that runs the app and tests it
- If the test is specific to a Streamlit element, prefix the filename with `st_<element_name>`
- Tests can use screenshot comparisons for visual verification
- Screenshots are stored in `e2e_playwright/__snapshots__/<os>/`
- Other tests results are stored in `e2e_playwright/test_results/`

### Key Fixtures and Utilities

Import from from `conftest.py`:

- `app: Page` - Light mode app fixture
- `themed_app: Page` - Light & dark mode app fixture
- `assert_snapshot` - Screenshot testing fixture. Ensure element is stable before calling.
- `wait_for_app_run(app)` - Wait for app run to finish
- `wait_for_app_loaded(app)` - Wait for initial app load
- `rerun_app(app)` - Trigger app rerun and wait
- `wait_until(app, fn)` - Run test function until True or timeout

### Best Practices

- Use `expect` for assertions, not `assert` (reduces flakiness)
- Use `get_by_test_id` to locate elements preferentially. Use `.locator` only when necessary.
- If `expect` is insufficient, use the `wait_until` utility. Never use `wait_for_timeout`.
- Group related tests into single, logical test files (e.g., by widget or feature) for CI efficiency.
- Minimize screenshot surface area; screenshot specific elements, not the whole page unless necessary.
- Ensure elements screenshotted are under 640px height to avoid clipping by the header.
- Naming convention for command-related snapshots: `st_command-test_description`
- Take a look at other tests in `e2e_playwright/` as inspiration.
- e2e tests are expensive, please test every aspect only one time.

### Writing Tests & Common Scenarios

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

### Running tests

- Single test: `make run-e2e-test e2e_playwright/name_of_the_test.py`
- Debug test: `make debug-e2e-test e2e_playwright/name_of_the_test.py`
- If frontend logic was changed, it will require running `make frontend-fast` to update the frontend.
- Use `make update-snapshots` script to retrieve updated snapshots from GitHub workflow.
