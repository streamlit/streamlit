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
- Include a negative / anti-regression assertion when practical: Don't only test that the “right” behavior happens; also test that a plausible “wrong” behavior does **not** happen.
  - Examples:
    - If you assert a flag becomes `True`, also assert a mutually exclusive flag remains `False`.
    - If you expect a function to return a value, also assert it doesn't return a plausible-but-wrong value.
    - If you expect success, also cover one relevant failure mode (invalid input, boundary condition, or raised exception) when practical.
- Prefer targeted negatives over exhaustive matrices: Add one high-signal negative check per behavior; don't balloon test cases without a regression history.

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
