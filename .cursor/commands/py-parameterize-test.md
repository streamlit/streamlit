# Parameterize Tests

## Overview

Convert repetitive `pytest` tests into parameterized tests using `pytest.mark.parametrize` to reduce duplication and improve maintainability, without changing behavior or reducing test coverage.

## Success Criteria

- Coverage is maintained or increased.
- All tests pass via `pytest`.
- Each new or updated test includes a brief numpydoc-style docstring.
- Provide meaningful `ids` for parameter sets to aid readability.
- Preserve existing markers and fixtures; use `pytest.param(..., marks=...)` for case-specific marks (e.g., `xfail`, `skip`).

## What to do

1. Discover candidates

   - Identify tests that only vary input values, expected outputs, or expected exceptions.
   - Include existing edge and boundary cases; do not remove unique scenarios.

2. Design parameters

   - Choose clear argument names and create tuples for each case.
   - Use `pytest.param` when individual cases require marks.
   - Add `ids=[...]` for stable, human-readable case names.

3. Implement

   - Replace duplicated tests with a single parameterized test.
   - Keep the assertion logic equivalent; do not change runtime behavior.
   - Deduplicate or promote fixtures only if they are reused (2+ call sites); otherwise keep them local.

4. Validate
   - Run `pytest` on applicable files and ensure all tests pass.
   - If grouping introduces ambiguity or flakiness, split or adjust the parameterization.

## Do not

- Modify production (non-test) code.
- Remove or weaken unique test scenarios.
- Over-parameterize when it reduces readability or obscures intent.

## Checklist

[ ] Parameterizable tests consolidated with `pytest.mark.parametrize`.
[ ] All tests pass (`pytest`).
[ ] Coverage maintained or increased.
[ ] Brief numpydoc docstring on new/updated tests.
[ ] Meaningful `ids` added; per-case marks preserved with `pytest.param`.
