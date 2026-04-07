---
name: improving-python-coverage
description: Runs Python unit tests with coverage, analyzes coverage reports, and implements meaningful tests to increase coverage by ~0.2%. Use when you want to systematically improve Python test coverage with high-value test cases.
---

# Improving Python coverage

Increase Python unit test coverage by ~0.2% through meaningful tests that add real value.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Keep iterating (analyze → implement → verify) until the 0.2% coverage target is reached. If you encounter ambiguities about what to test, make a reasonable choice and proceed.

## Workflow

**Step 1: Run tests with coverage**

```bash
make python-tests  # ~3 min, creates .coverage file
```

Generate JSON report for analysis:

```bash
uv run coverage json -o coverage.json
```

The JSON contains per-file `missing_lines` arrays showing uncovered line numbers.

**Step 2: Analyze and prioritize**

Read `coverage.json` to find files with:
1. Large size + below-average `percent_covered` (high impact)
2. Core modules in `lib/streamlit/elements/` or `lib/streamlit/runtime/`
3. Pure utility functions

Skip: >97% coverage, `proto/*`, `vendor/*`, `static/*`, test files.

**Step 3: Implement tests (in subagent)**

Launch a subagent to implement tests for each prioritized file. Provide the subagent with:
- The target file path and its `missing_lines` from coverage
- Instructions to read the source, existing tests, and write new tests
- The test selection guidelines below

The subagent should:
1. Read source and existing tests at `lib/tests/streamlit/<path>/<module>_test.py`
2. Write tests for: conditional branches, error handling, edge cases, exception paths
3. Follow `lib/tests/AGENTS.md`: prefer pytest-style standalone functions over `unittest.TestCase` classes, use `@pytest.mark.parametrize` to consolidate tests that only differ in inputs/expected outputs, add numpydoc docstrings and type annotations
4. Run the new tests to verify they pass: `uv run pytest lib/tests/streamlit/path/to/module_test.py -v`

**Step 4: Verify and iterate**

```bash
uv run pytest lib/tests/streamlit/path/to/module_test.py -v  # Run new tests
make python-tests                                             # Measure progress
```

**Repeat steps 2-4 until coverage improves by ≥0.2%**, then run `make check`.

**Step 5: Simplify, review, and address feedback**

Once all tests pass and coverage target is met:

1. Run the `simplifying-local-changes` subagent to clean up and simplify the code changes. Wait for completion.
2. Run the `reviewing-local-changes` subagent to review the changes. Wait for completion and read the review output.
3. Address the review feedback: for each recommendation, implement it if valid and improves code quality; skip with brief reasoning if not applicable or would over-engineer.
4. Run /checking-changes to verify everything still passes after changes.

## Test selection

**DO test:** Conditional logic, error handling, edge cases (None, empty, zero, max), public API functions, complex branches.

**DON'T test:** Simple accessors, protobufs, implementation details, already well-covered code.

**Coverage exclusions:** Use `# pragma: no cover` sparingly for code that genuinely doesn't need testing. Always include a reason (e.g., `# pragma: no cover - defensive`):
- Platform-specific branches that can't run in CI (`# pragma: no cover - platform-specific`)
- Defensive code that should never execute (`# pragma: no cover - defensive`)
- Abstract method stubs or protocol definitions (`# pragma: no cover - abstract`)

**Integration dependencies:** Packages listed under `[dependency-groups] integration` in `pyproject.toml` (e.g., `pydantic`, `sympy`, `polars`, `sqlalchemy`) are only installed for integration tests, not regular unit tests. When writing tests that use these packages:
- Import them **inside the test function**, not at module top-level
- Add `@pytest.mark.require_integration` marker to the test
- This ensures tests gracefully skip when run outside the integration test environment

## Test file location

`lib/tests/streamlit/<package>/<module>_test.py` mirrors `lib/streamlit/<package>/<module>.py`

## Notes

- Quality > coverage numbers - skip tests that don't catch real bugs
- Target is 95%+ coverage per `lib/tests/AGENTS.md`
- Use `/checking-changes` after implementing tests
- Some code paths involving external libraries (e.g., database connectors, optional dependencies) are already covered by integration tests marked with `pytest.mark.require_integration`. These integration tests are **not** included in the coverage numbers from `make python-tests`. When analyzing missing lines, check whether the uncovered code is exercised by integration tests before adding unit tests or `# pragma: no cover` annotations.
- **Local vs CI coverage differences:** Code that is version-specific (Python version, library version) or uses integration dependencies may appear uncovered locally but is tested and covered in CI. Examples:
  - Python version-specific branches (e.g., `if sys.version_info >= (3, 14)`) run only on matching CI jobs
  - Library version-specific code (e.g., pandas 2.x vs 3.x behavior) is covered across CI matrix
  - Integration dependency tests (`@pytest.mark.require_integration`) run in separate CI jobs with those packages installed

  Before adding tests or `# pragma: no cover` for such code, verify whether it's already exercised in CI.
