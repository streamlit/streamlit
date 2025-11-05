---
applyTo: "lib/tests/**/*.py"
---

# Python Unit Test Guide

We use the unit tests to cover internal behavior that can work without the web / backend counterpart.
We aim for high unit test coverage (90% or higher) of our Python code in `lib/streamlit`.

## Key Principles

- Prefer pytest or pytest plugins over unittest.
- For every new test function, please add a brief docstring comment (numpydoc style).
- New tests should be fully annotated with types.
- Skip tests (via `pytest.mark.skipif`) requiring CI secrets if the environment variables are not set.
- Parameterized Tests: Use `@parameterized.expand` whenever it is possible to combine overlapping tests with varying inputs.

## Running tests

- Run all with (execute from repo root):

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
