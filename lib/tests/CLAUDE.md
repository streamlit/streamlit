# Python Testing Instructions

This file provides guidance to Claude Code for Python tests.

## Quick Commands

Relevant `make` commands for this area:

- `make python-integration-tests` - Run Python integration tests. Requires `integration-requirements.txt` to be installed.
- `make python-performance-tests` - Run Python performance tests.
- `make python-tests` - Run Python unit tests.

## Related Documentation

- [Root project documentation](/CLAUDE.md)
- [Python backend documentation](/lib/streamlit/CLAUDE.md)

# Python Unit Test Guide

We use the unit tests to cover internal behavior that can work without the web / backend counterpart.
We aim for high unit test coverage (90% or higher) of our Python code in `lib/streamlit`.

## Key Principles

- Prefer pytest or pytest plugins over unittest.
- For every new test function, please add a brief docstring comment (numpydoc style).
- New tests should be fully annotated with types.
- Skip tests (via `pytest.mark.skipif`) requiring CI secrets if the environment variables are not set.

## Running tests

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

## Additional Context

For general project information and common commands, see the root CLAUDE.md file.
