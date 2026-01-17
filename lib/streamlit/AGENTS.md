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
- Anti-regression checks: When adding/modifying unit tests, include at least one negative assertion when practical (the inverse condition, invalid input, or a forbidden side effect) alongside the positive assertion. For example, if you assert a flag becomes `True`, also assert a mutually exclusive flag remains `False` (see `lib/tests/AGENTS.md` for more examples).

### Typing Tests

We also have typing tests in `lib/tests/streamlit/typing` for our public API to catch
typing errors in parameters or return types by using mypy and `assert_type`.
Check other typing tests in the `lib/tests/streamlit/typing` directory for inspiration.
