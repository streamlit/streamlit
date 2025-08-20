# Python Backend Instructions

This file provides guidance to Claude Code for the Python backend code in lib/streamlit/.

## Table of Contents

- [Key Principles](#key-principles)
- [Docstrings](#docstrings)
- [Typing](#typing)
- [Logging](#logging)
- [Unit Tests](#unit-tests)
- [Typing Tests](#typing-tests)


## Quick Commands

Relevant `make` commands for this area:

- `make autofix` - Autofix linting and formatting errors.
- `make python-format` - Format Python files.
- `make python-lint` - Lint and check formatting of Python files.
- `make python-types` - Run the Python type checker.

## Related Documentation

- [Root project documentation](/CLAUDE.md)
- [Protobuf documentation](/proto/CLAUDE.md)
- [Frontend documentation](/frontend/CLAUDE.md)
- [Python testing documentation](/lib/tests/CLAUDE.md)

# Python Guide

- Supported Python versions: 3.9 - 3.13
- Linter: Ruff 0.x
- Formatter: Ruff 0.x
- Type Checker: mypy 1.x
- Testing: pytest 8.x

## Key Principles

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

## Docstrings

- Use Numpydoc style.
- Docstrings are meant for users of a function, not developers who may be edit the internals of that function in the future. If you want to talk to future developers, use comments.
- All modules that we expect users to interact with must have top-level docstrings. If a user is not meant to interact with a module, docstrings are optional.

## Typing

- Add typing annotations to every new function, method or class member.
- Use `typing_extensions` for back-porting newer typing features.
- Use future annotations via `from __future__ import annotations`.

---

# Streamlit Lib Python Guide

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

## Typing Tests

We also have typing tests in `lib/tests/streamlit/typing` for our public API to catch
typing errors in parameters or return types by using mypy and `assert_type`.
Check other typing tests in the `lib/tests/streamlit/typing` directory for inspiration.

## Additional Context

For general project information and common commands, see the root CLAUDE.md file.
