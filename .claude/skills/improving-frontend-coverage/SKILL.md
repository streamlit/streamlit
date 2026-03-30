---
name: improving-frontend-coverage
description: Runs frontend unit tests with coverage, analyzes coverage reports, and implements meaningful tests to increase coverage by ~0.2%. Use when you want to systematically improve frontend test coverage with high-value test cases.
context: fork
---

# Improving frontend coverage

Systematically increase frontend unit test coverage by running tests, analyzing coverage gaps, and implementing meaningful tests that add real value.

Target coverage improvement is 0.2%.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Complete all phases from baseline measurement to target coverage without human intervention. Keep iterating (phases 3-5) until reaching the 0.2% coverage improvement target.

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

Run the full frontend test suite with coverage via the `make frontend-tests` command. This takes ~5 minutes and generates coverage reports in `frontend/coverage/`:

- `coverage-summary.json` - Machine-readable summary
- `index.html` - Interactive HTML report
- Text summary printed to console

### Phase 2: Analyze coverage report

Read and parse the coverage summary:

```bash
cat frontend/coverage/coverage-summary.json
```

The JSON structure looks like:

```json
{
  "total": {
    "lines": { "total": N, "covered": N, "skipped": N, "pct": N },
    "statements": { ... },
    "functions": { ... },
    "branches": { ... }
  },
  "path/to/file.tsx": {
    "lines": { "total": N, "covered": N, "skipped": N, "pct": N },
    ...
  }
}
```

Key metrics to focus on:

- **Lines**: Percentage of executable lines covered
- **Branches**: Percentage of conditional branches covered (if/else, ternary, etc.)
- **Functions**: Percentage of functions that have been called

### Phase 3: Prioritize coverage opportunities

Select files to improve based on these criteria (in priority order):

1. **High impact, low coverage**: Large files (high total lines) with below-average coverage
2. **Core components**: Files in `lib/src/components/` that handle user interactions
3. **Utility functions**: Pure functions in `utils/src/` that are easy to test
4. **Recently modified**: Files with recent changes that may have untested code paths

**Exclude from consideration:**

- Files with >97% coverage (diminishing returns)
- Auto-generated files (protobuf, vendor)
- Type-only files (`.d.ts`, `.interface.ts`)
- Test files themselves

To calculate target: Increasing coverage by 0.2% requires covering approximately:

```
additional_lines = total_lines * 0.002
```

### Phase 4: Implement tests

For each selected file, follow this process:

1. **Read the source file** to understand the component/function
2. **Read existing tests** (if any) to understand current coverage
3. **Identify untested code paths**:
   - Uncovered branches (if/else paths)
   - Error handling code
   - Edge cases (null, undefined, empty arrays)
   - Event handlers
   - Conditional rendering

4. **Write tests** following these principles:
   - **Add value**: Test behavior users care about, not implementation details
   - **Cover edge cases**: Empty states, error states, boundary conditions
   - **Test accessibility**: Verify ARIA attributes, keyboard navigation
   - **Use RTL best practices**: Query by role/label, not implementation

5. **Before implementing each test**, verify it adds value:
   - Does this test catch real bugs or regressions?
   - Is this testing user-facing behavior, not implementation details?
   - Would this test provide confidence when refactoring?
   - Skip tests that only increase coverage numbers without adding real value

### Phase 5: Verify and iterate

**Iteration loop** - Keep implementing tests until the coverage target is reached:

1. **Run new tests** to ensure they pass:

```bash
(cd frontend && yarn test path/to/Component.test.tsx)
```

2. **Run full coverage** to measure progress:

```bash
make frontend-tests
```

3. **Compare coverage against baseline**:
   - Record the new total line coverage percentage
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

- Conditional rendering logic (different states, loading, error, empty)
- User interaction handlers (clicks, keyboard, focus)
- Prop variations that change behavior
- Error boundaries and error handling
- Accessibility requirements (roles, labels, keyboard nav)
- Edge cases (null props, empty arrays, max values)

**DO NOT write tests for:**

- Simple pass-through props that don't affect behavior
- Styling/CSS (unless it affects functionality)
- Third-party library internals
- Implementation details (internal state names, private methods)
- Code that's already well-covered

## Example analysis

Given a coverage report showing:

```
lib/src/components/widgets/Button/Button.tsx: 65% lines, 50% branches
```

Investigate by reading the file and identifying:

1. What branches are at 50%? Check for if/else, ternary operators
2. Look for error handling, loading states, disabled states
3. Check event handlers - are all click/hover/focus paths tested?

Then write tests that cover the missing paths while adding value.

## Notes

- Focus on quality over quantity - meaningful tests > coverage numbers
- If a test doesn't add value (testing obvious behavior), skip it
- Use the /checking-changes skill after implementing tests to verify everything works
- Coverage reports are in `frontend/coverage/` - check the HTML report for visual analysis
