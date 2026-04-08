---
name: improving-frontend-coverage
description: Runs frontend unit tests with coverage, analyzes coverage reports, and implements meaningful tests to increase coverage by ~0.2%. Use when you want to systematically improve frontend test coverage with high-value test cases.
---

# Improving frontend coverage

Increase frontend unit test coverage by ~0.2% through meaningful tests that add real value.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Keep iterating (analyze → implement → verify) until the 0.2% coverage target is reached. If you encounter ambiguities about what to test, make a reasonable choice and proceed.

## Workflow

**Step 1: Run tests with coverage**

```bash
COVERAGE_JSON=1 make frontend-tests  # ~5 min
```

Reports generated in `frontend/coverage/`:
- `coverage-summary.json` - Per-file percentages (lines, branches, functions)
- `coverage-final.json` - Line-level data with uncovered line numbers (hit count 0 in `s`, `f`, `b` maps)

**Step 2: Analyze and prioritize**

Read `coverage-summary.json` to find files with:
1. Large size + below-average coverage (high impact)
2. Core components in `lib/src/components/`
3. Utility functions in `utils/src/`

Skip: >97% coverage, auto-generated, `.d.ts`, test files.

**Step 3: Implement tests (in subagent)**

Launch a subagent to implement tests for each prioritized file. Provide the subagent with:
- The target file path and its uncovered lines from `coverage-final.json`
- Instructions to read the source, existing tests, and write new tests
- The test selection guidelines below

The subagent should:
1. Read source and existing tests to understand gaps
2. Write tests for: conditional rendering, event handlers, error states, edge cases, accessibility
3. Follow RTL best practices: query by role/label, test behavior not implementation
4. Run the new tests to verify they pass: `cd frontend && yarn test path/to/Component.test.tsx`

**Step 4: Verify and iterate**

```bash
cd frontend && yarn test path/to/Component.test.tsx  # Run new tests
COVERAGE_JSON=1 make frontend-tests                   # Measure progress
```

**Repeat steps 2-4 until coverage improves by ≥0.2%**, then run `make check`.

**Step 5: Simplify, review, and address feedback**

Once all tests pass and coverage target is met:

1. Run the `simplifying-local-changes` subagent to clean up and simplify the code changes. Wait for completion.
2. Run the `reviewing-local-changes` subagent to review the changes. Wait for completion and read the review output.
3. Address the review feedback: for each recommendation, implement it if valid and improves code quality; skip with brief reasoning if not applicable or would over-engineer.
4. Run /checking-changes to verify everything still passes after changes.

## Test selection

**DO test:** Conditional rendering, user interactions, prop variations, error handling, accessibility, edge cases (null, empty, max values).

**DON'T test:** Pass-through props, styling, library internals, implementation details, already well-covered code.

**Coverage exclusions:** Use `/* istanbul ignore next */` sparingly for code that genuinely doesn't need testing. Always include a reason (e.g., `/* istanbul ignore next -- defensive */`):
- Browser-specific branches that can't run in jsdom (`/* istanbul ignore next -- browser-only */`)
- Defensive fallbacks that should never execute (`/* istanbul ignore next -- defensive */`)
- Framework-required boilerplate (`/* istanbul ignore next -- exhaustive */`)

## Notes

- Quality > coverage numbers - skip tests that don't catch real bugs
- Test files: co-located as `<Component>.test.tsx`
- Use `/checking-changes` after implementing tests
