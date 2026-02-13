---
applyTo: "lib/streamlit/**/*.py"
---

# Streamlit Lib Python Guide

Tips and guidelines specific to the development of the Streamlit Python library,
not applicable to scripts and e2e tests.

## Logging

If something needs to be logged, please use our logger - that returns a default
Python logger - with an appropriate logging level:

```python
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)
```

## Unit Tests

We use the unit tests to cover internal behavior that can work without the web / backend
counterpart and the e2e tests to test the entire system. We aim for high unit test
coverage (90% or higher) of our Python code in `lib/streamlit`.

- Under `lib/tests/streamlit`, add a new test file
- Preferably in the mirrored directory structure as the non-test files.
- Naming: `my_example_test.py`
- Anti-regression checks: Where practical, go beyond the happy path by covering a plausible failure mode or edge case (invalid input, boundary condition, absent side effect). Do **not** add assertions that are logically implied by an earlier assertion — e.g., if you assert `x is True`, asserting `x is not False` is a tautology and adds no value. See `lib/tests/AGENTS.md` for detailed guidance and examples.

### Typing Tests

We have typing tests in `lib/tests/streamlit/typing` for our public API to catch
typing errors in parameters or return types by using mypy and `assert_type`.

- **These are NOT pytest tests** — they are checked by mypy only, never executed at runtime.
- All assertions and imports go inside `if TYPE_CHECKING:` blocks.
- Do **not** use `def test_*()` functions or `import streamlit as st`.
- Import from Mixin classes directly (e.g. `LayoutsMixin().expander`).
- Always include `from __future__ import annotations` at the top.
- Check other typing tests in the `lib/tests/streamlit/typing` directory for inspiration
  (e.g. `radio_types.py`, `button_types.py`).

## Theming and Layout

- **Theming and layout calculations must be done in the frontend, not the Python backend.**
- Do not use `get_option("theme.primaryColor")` or similar theme options in backend code. This is unreliable because themes can be configured in multiple ways and the backend may not have access to the actual active theme.
- Pixel-based or rem-based calculations (sizing, spacing, responsive layouts) must be handled on the frontend side where the rendering context is available.
- The backend should pass semantic data to the frontend; let the frontend handle all visual presentation logic.
