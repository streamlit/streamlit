---
name: improving-python-coverage
description: Runs Python unit tests with coverage, analyzes coverage reports, and implements meaningful tests to increase coverage by ~0.2%. Use when you want to systematically improve Python test coverage with high-value test cases.
context: fork
---

# Improving Python coverage

Systematically increase Python unit test coverage by running tests, analyzing coverage gaps, and implementing meaningful tests that add real value.

Target coverage improvement is 0.2%.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Complete all phases from baseline measurement to target coverage without human intervention.

## Workflow

Copy this checklist and track your progress:

```
Baseline coverage: XX.XX%
Target coverage: XX.XX% (+0.2%)

Progress:
- [ ] Phase 1: Run tests with coverage (record baseline)
- [ ] Phase 2: Analyze coverage report
- [ ] Phase 3: Prioritize coverage opportunities
- [ ] Phase 4: Implement tests
- [ ] Phase 5: Verify and iterate (repeat 3-5 until target reached)
```

### Phase 1: Run tests with coverage

Run the full Python test suite with coverage via the `make python-tests` command. This takes ~3 minutes and generates coverage data in the current working directory:

- `.coverage` - Coverage data file used by `coverage` commands
- `htmlcov/index.html` - Interactive HTML report
- Text summary printed to the console by pytest-cov

### Phase 2: Analyze coverage report

Generate a JSON coverage report for analysis (run from the repo root after `make python-tests`):

```bash
uv run coverage json -o coverage.json
```

Then read and parse the coverage data:

```bash
cat coverage.json
```

The JSON structure looks like:

```json
{
  "meta": { ... },
  "totals": {
    "covered_lines": N,
    "num_statements": N,
    "percent_covered": N,
    "missing_lines": N,
    "num_branches": N,
    "covered_branches": N
  },
  "files": {
    "lib/streamlit/path/to/file.py": {
      "executed_lines": [...],
      "missing_lines": [...],
      "excluded_lines": [...],
      "summary": {
        "covered_lines": N,
        "num_statements": N,
        "percent_covered": N
      }
    }
  }
}
```

Key metrics to focus on:

- **percent_covered**: Overall percentage of lines covered
- **missing_lines**: Specific line numbers not covered (useful for targeting)
- **num_statements**: Total executable statements

### Phase 3: Prioritize coverage opportunities

Select files to improve based on these criteria (in priority order):

1. **High impact, low coverage**: Large files (high num_statements) with below-average coverage
2. **Core modules**: Files in `lib/streamlit/elements/` and `lib/streamlit/runtime/`
3. **Utility functions**: Pure functions in `lib/streamlit/` that are easy to test
4. **Recently modified**: Files with recent changes that may have untested code paths

**Exclude from consideration:**

- Files with >97% coverage (diminishing returns)
- Auto-generated files (`streamlit/proto/*`)
- Vendored files (`streamlit/vendor/*`)
- Static files (`streamlit/static/*`)
- Test files themselves

To calculate target: Increasing coverage by 0.2% requires covering approximately:

```
additional_lines = num_statements * 0.002
```

### Phase 4: Implement tests

For each selected file, follow this process:

1. **Read the source file** to understand the module/function
2. **Read existing tests** (if any) at `lib/tests/streamlit/<path>/<module>_test.py`
3. **Identify untested code paths** using `missing_lines` from coverage:
   - Uncovered branches (if/else paths)
   - Error handling code
   - Edge cases (None, empty collections, boundary values)
   - Exception raising paths

4. **Write tests** following these principles (from `lib/tests/AGENTS.md`):
   - **Use pytest**: Prefer standalone pytest functions over unittest classes
   - **Add docstrings**: Brief numpydoc-style docstring for each test function
   - **Add type annotations**: All new test functions must be typed
   - **Use parametrize**: Use `@pytest.mark.parametrize` for varying inputs
   - **Anti-regression assertions**: Cover failure modes and edge cases

5. **Before implementing each test**, verify it adds value:
   - Does this test catch real bugs or regressions?
   - Is this testing behavior, not implementation details?
   - Would this test provide confidence when refactoring?
   - Skip tests that only increase coverage numbers without adding real value

### Phase 5: Verify and iterate

**Iteration loop** - Keep implementing tests until the coverage target is reached:

1. **Run new tests** to ensure they pass:

```bash
uv run pytest -c lib/pyproject.toml lib/tests/streamlit/path/to/module_test.py -v
```

2. **Run full coverage** to measure progress:

```bash
make python-tests
```

3. **Compare coverage against baseline**:
   - Record the new total coverage percentage
   - Calculate improvement: `new_coverage - baseline_coverage`
   - **If improvement < 0.2%**: Return to Phase 3 to select more files and implement additional tests
   - **If improvement >= 0.2%**: Target reached, proceed to step 4

4. **Run checks** before committing:

```bash
make check
```

**Iteration tracking** - Update this as you iterate:

```
Iteration 1: baseline XX.XX% -> XX.XX% (+0.XX%)
Iteration 2: XX.XX% -> XX.XX% (+0.XX%)
...
Final: XX.XX% -> XX.XX% (+0.XX% total)
```

## Test selection guidelines

**DO write tests for:**

- Conditional logic (different code paths based on input)
- Error handling and exception raising
- Edge cases (None, empty list, zero, max values)
- Public API functions that users interact with
- Complex business logic with multiple branches
- Boundary conditions

**DO NOT write tests for:**

- Simple property accessors with no logic
- Auto-generated code (protobufs)
- Implementation details (private methods unless complex)
- Code that's already well-covered
- Trivial pass-through functions

## Test file conventions

Tests should be located at `lib/tests/streamlit/<package>/<module>_test.py` mirroring `lib/streamlit/<package>/<module>.py`.

Example:

- Source: `lib/streamlit/elements/button.py`
- Test: `lib/tests/streamlit/elements/button_test.py`

## Example analysis

Given a coverage report showing:

```
lib/streamlit/elements/slider.py: 72% covered, missing lines: [45, 46, 89-95, 120]
```

Investigate by:

1. Reading lines 45-46, 89-95, 120 in the source file
2. Understanding what conditions lead to those code paths
3. Writing tests that exercise those specific paths

## Notes

- Focus on quality over quantity - meaningful tests > coverage numbers
- If a test doesn't add value (testing obvious behavior), skip it
- Run `/checking-changes` after implementing tests to verify everything works
- Coverage reports are in `htmlcov/` - check the HTML report for visual analysis
