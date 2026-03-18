---
name: fixing-flaky-e2e-tests
description: Diagnose and fix flaky Playwright e2e tests. Use when tests fail intermittently, show timeout errors, have snapshot mismatches, or exhibit browser-specific failures.
---

# Fixing flaky E2E tests

Diagnose and fix flaky Playwright E2E tests in `e2e_playwright/`.

## When to use

- Tests fail intermittently (pass sometimes, fail others)
- Timeout errors (`TimeoutError: wait_until timed out`)
- Snapshot mismatches with pixel differences
- Browser-specific failures (firefox, webkit, chromium)
- User asks to fix top flaky tests from CI

## Finding top flaky tests

Run the script to identify the most flaky tests from recent CI runs:

```bash
uv run scripts/fetch_flaky_tests.py
```

Options:
- `--days N`: Look back N days (default: 4)
- `--top N`: Return top N flaky tests (default: 10)
- `--min-reruns N`: Minimum total reruns to include (default: 2)
- `--json`: Output as JSON for programmatic use

The script downloads `playwright_test_stats` artifacts from successful `playwright.yml` runs and aggregates tests that required reruns.

### Filtering tests to fix

Skip tests already marked with `@pytest.mark.flaky`---these are known flaky tests being tracked separately.

```bash
# Check if a test file has the flaky marker
grep -l "pytest.mark.flaky" e2e_playwright/<test_file>.py
```

## Investigation workflow

### 1. Reproduce the flakiness locally (REQUIRED)

**IMPORTANT**: Only attempt to fix tests that fail locally. If you cannot reproduce the flakiness after 25 runs, do NOT attempt a fix—the test may be flaky due to CI environment factors that cannot be addressed locally.

Run the test up to 25 times with the affected browser(s). The loop breaks on first failure and captures full output:

```bash
for i in {1..25}; do
  result=$(make run-e2e-test e2e_playwright/test_file.py::test_name -- --browser firefox 2>&1)
  if echo "$result" | grep -q "FAILED"; then
    echo "=== FAILURE ON RUN $i ==="
    echo "$result"
    break
  fi
  echo "Run $i: PASSED"
done
```

If all 25 runs pass, skip this test and move to the next one.

### 2. Check test artifacts

After failure, examine:
- `e2e_playwright/test-results/` - traces, screenshots, videos
- `e2e_playwright/test-results/snapshot-updates/` - actual vs expected snapshots

**For persistent snapshot flakiness**: If a test keeps failing due to snapshot mismatches, compare the actual vs expected images in `e2e_playwright/test-results/snapshot-updates/`. Look for:
- Pixel-level differences (use an image diff tool or overlay)
- Subtle layout shifts, font rendering variations, or timing artifacts
- Browser-specific rendering quirks (especially Firefox subpixel issues)

This helps identify whether the flakiness is due to timing (content not loaded), animation state, or browser rendering differences.

## Common causes and fixes

### Timing issues (most common)

**Symptom**: Screenshots taken before element fully renders, animations not complete.

**Fix**: Add explicit waits before interactions or screenshots:

```python
# Before
element.click()
assert_snapshot(element, name="snapshot")

# After
element.click()
expect(element).to_be_visible()  # Wait for visibility
assert_snapshot(element, name="snapshot")
```

For popups/modals/calendars that animate:

```python
calendar = page.locator('[data-baseweb="calendar"]').first
expect(calendar).to_be_visible()  # Wait for animation to complete
assert_snapshot(calendar, name="calendar-snapshot")
```

### Browser retry causing extra events

**Symptom**: Assertion expects exact count but gets more (e.g., `assert 44 == 41`).

**Fix**: Use `>=` instead of `==` when browsers may retry failed operations:

```python
# Before
assert error_count == expected_count

# After - browsers may retry failed image loads
assert error_count >= expected_count
```

### Timeout too short

**Symptom**: `TimeoutError` on slower browsers.

**Fix**: Increase timeout for operations that can be slow:

```python
# Before
wait_until(app, lambda: check_condition(), timeout=10000)

# After
wait_until(app, lambda: check_condition(), timeout=20000)
```

### Snapshot mismatch due to timing

**Symptom**: `Snapshot mismatch for ... (X pixels difference)`.

**Causes**:
- Element still animating when screenshot taken
- Font rendering not complete
- Async content not loaded

**Fix**: Ensure element is stable before screenshot:

```python
element = page.locator(".my-element")
expect(element).to_be_visible()
# For elements with animations, wait for specific CSS state:
expect(element).to_have_css("opacity", "1")
assert_snapshot(element, name="snapshot")
```

## Browser-specific considerations

| Browser | Common Issues |
|---------|---------------|
| **Firefox** | Slower console logging, may retry failed requests, subpixel rendering differences |
| **Webkit** | May have timing differences with layout |
| **Chromium** | Generally most reliable, use as baseline |

### Firefox subpixel rendering flakiness

**Symptom**: Firefox screenshots flake with 1-pixel differences due to subpixel rendering variations.

**Fix**: Add a one-liner markdown element above the element being tested. This shifts the subpixel position to a more stable value:

```python
# In the test app (.py file)
st.markdown("---")  # Stabilizes subpixel rendering for elements below
st.date_input("Pick a date")
```

This is a workaround for Firefox's subpixel rendering behavior and can reduce snapshot flakiness when other timing fixes don't help.

If you've exhausted timing fixes and the flakiness persists only on a specific browser due to known browser limitations (not test bugs), `skip_browser` may be appropriate as a **last resort**:

```python
# Only use after confirming this is a browser-level limitation, not a fixable timing issue
@pytest.mark.skip_browser("webkit", reason="Webkit has known layout timing issues with this element")
def test_problematic_on_webkit(app: Page):
    ...
```

**Important:** Using `skip_browser` requires justification. Prefer fixing the underlying timing issue first. See "Rules" section for guidance on when skipping is acceptable.

## Verification

After applying fix, verify with multiple runs:

```bash
# Run 10+ times to ensure stability
for i in {1..10}; do
  make run-e2e-test e2e_playwright/test_file.py::test_name -- --browser firefox 2>&1 | grep -E "(PASSED|FAILED)"
done
```

Target: **10/10 passes** before considering fix complete.

## Key utilities

From `e2e_playwright.conftest`:
- `wait_for_app_run(page)` - Wait for Streamlit script execution
- `wait_for_app_loaded(page)` - Wait for initial app load
- `wait_until(page, fn, timeout)` - Poll until condition is true

From `e2e_playwright.shared.app_utils`:
- `expect_no_skeletons(element)` - Wait for loading skeletons to disappear
- `reset_focus(page)` - Click outside to trigger blur events
- `reset_hovering(locator)` - Move mouse away from element

## Complete workflow

1. **Fetch flaky tests**: `uv run scripts/fetch_flaky_tests.py --top 10`

2. **Filter out marked tests**: Skip tests with `@pytest.mark.flaky`

3. **For each remaining test**:
   - Read the test code to understand what it's testing
   - Reproduce the flakiness locally (up to 25 runs)
   - **Skip if not reproducible**: If 25 runs all pass, move to the next test
   - Identify the root cause (timing, browser-specific, etc.)
   - Apply the minimal fix
   - Verify with 10+ runs on affected browser(s)

4. **Run checks**: `make check` before committing

## Rules

- **Reproduce locally first**: Only fix tests you can reproduce locally (up to 25 runs)
- **Minimal fixes**: Smallest change that fixes the issue
- **Don't disable tests without justification**: Never skip tests just to "fix" flakiness. `skip_browser` is acceptable only when:
  1. You've exhausted all timing/wait fixes
  2. The flakiness is due to a documented browser limitation (not a test bug)
  3. You include a clear `reason` explaining why
- **Verify thoroughly**: Run 10+ times on affected browser after fix
- **Preserve test intent**: Understand what the test is validating
- **Document cause**: Add comments explaining why waits/timeouts are needed
