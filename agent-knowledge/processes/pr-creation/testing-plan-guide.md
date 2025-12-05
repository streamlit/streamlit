---
status: experimental
last_updated: 2025-11-05
---

# How to Fill In the Testing Plan

Guide for documenting tests in PR descriptions.

## Detect Test Changes in Git Diff

Check for modified/added test files:

**Python unit tests:**

- Pattern: `lib/tests/**/*.py`
- Example: `lib/tests/streamlit/elements/plotly_chart_test.py`

**Frontend unit tests:**

- Pattern: `frontend/**/*.test.ts` or `frontend/**/*.test.tsx`
- Example: `frontend/lib/src/components/elements/PlotlyChart/PlotlyChart.test.tsx`

**E2E tests:**

- Pattern: `e2e_playwright/**/*_test.py`
- Example: `e2e_playwright/st_plotly_chart_test.py`

## Fill In PR Template Checklist

Based on files changed:

```markdown
- [x] Unit Tests (JS and/or Python) - If lib/tests/ or frontend/\*_/_.test.\* files changed
- [x] E2E Tests - If e2e_playwright/ files changed
- [ ] Manual testing completed - Leave unchecked (user will complete if applicable)
- [x] Explanation of why no additional tests are needed - If no test files changed
```

## Describe Testing in PR

**If tests were added/modified:**

List the test files and what they cover:

```markdown
**Testing:**

- `lib/tests/streamlit/elements/plotly_chart_test.py` - Tests height parameter functionality
- `e2e_playwright/st_plotly_chart_test.py` - Visual regression tests for height behavior
```

**If no tests needed:**

Explain why:

```markdown
**No Additional Tests:**
Documentation-only changes, no behavior modifications.
```

## Detection Logic for AI Agents

```python
# Pseudo-code for detecting test types from git diff
has_python_tests = any("lib/tests/" in file for file in changed_files)
has_frontend_tests = any(file.endswith(('.test.ts', '.test.tsx')) for file in changed_files)
has_e2e_tests = any("e2e_playwright/" in file for file in changed_files)

# Check boxes based on what can be detected
checklist = {
    "unit_tests": has_python_tests or has_frontend_tests,
    "e2e_tests": has_e2e_tests,
    "manual_testing": False,  # Always leave unchecked - user fills in
    "no_tests_needed": not (has_python_tests or has_frontend_tests or has_e2e_tests),
}
```
