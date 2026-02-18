---
name: simplifying-local-changes
description: Simplify and refine code for clarity, consistency, and maintainability while preserving all functionality. Focuses on changes in the current branch.
model: inherit
memory: local
---

# Simplifying Changes

You are refining code for clarity, consistency, and maintainability. Focus on changes in the current branch (compared to the base branch) unless instructed otherwise.

## Context

- **Repository**: streamlit/streamlit
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`

## Determining Changes

First, identify the base branch and gather the changes:

```bash
# Determine base branch: use PR's target branch if available, otherwise fall back to develop
BASE_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo "develop")
echo "Base branch: $BASE_BRANCH"

# Fetch the base branch to ensure accurate comparison
git fetch origin "$BASE_BRANCH"

# List all changed files (committed, staged, and unstaged) compared to base
git diff --name-only "origin/$BASE_BRANCH...HEAD"  # committed changes on the branch
git diff --name-only HEAD                          # uncommitted changes (staged + unstaged)

# Full diff of all changes compared to base (committed + uncommitted)
git diff "origin/$BASE_BRANCH"
```

## Core Principles

1. **Preserve functionality**: Never change what the code does, only how it does it
2. **Follow project conventions**: Match existing patterns in neighboring files
3. **Avoid over-simplification**: Don't sacrifice readability or create overly clever code
4. **Keep scope focused**: Simplify only files changed in the current branch unless directed otherwise

## Process

1. Determine the base branch and identify changed files (see above)
2. Analyze changed code for improvement opportunities
3. Apply simplifications while preserving behavior
4. Verify functionality remains unchanged
5. Run `make check` or the `/checking-changes` skill to validate changes

## Simplification Guidelines

### General

- Eliminate redundant code and dead branches
- Improve naming for clarity (variables, functions, parameters)
- Consolidate duplicate logic only when it improves readability
- Avoid nested ternary operators; prefer `if/else` or `switch/case`
- Do not add features, refactor unrelated code, or make improvements beyond what was asked

### Comments

- Remove comments where the code is self-explanatory
- Add brief comments for complex or non-obvious logic
- Add brief docstrings to functions summarizing their purpose; omit if self-explanatory
- Remove comments that refer to previous behavior; comments should describe current state
- Every comment should add genuine value and be accurate

### Python

- Follow PEP8 naming conventions (e.g., `snake_case` for functions/variables, `UPPER_CASE` for constants)
- Prefix module-level items with `_` if only used internally
- Prefer keyword arguments; use positional only for required values that frame the API
- Ensure `from __future__ import annotations` is present
- Add `Final` type annotation to constants that should not change at runtime

### Python Unit Tests

For tests in `lib/tests/`, consolidate repetitive tests using `pytest.mark.parametrize`:

```python
@pytest.mark.parametrize(
    ("input_value", "expected"),
    [
        ("test", "TEST"),
        ("hello", "HELLO"),
        ("", ""),
    ],
    ids=["basic", "word", "empty"],
)
def test_uppercase(input_value: str, expected: str) -> None:
    """Test that uppercase converts strings correctly."""
    assert uppercase(input_value) == expected
```

Guidelines:
- Use `ids=[...]` for readable test names
- Use `pytest.param(..., marks=...)` for case-specific marks (e.g., `xfail`, `skip`)
- Include edge cases and boundary conditions
- Add a brief numpydoc-style docstring to parameterized tests
- Avoid tautological assertions (e.g., asserting both `x is True` and `x is not False`)
- Prefer targeted negatives over exhaustive matrices; one high-signal check per behavior

### TypeScript/React

- Omit trivially inferred types (e.g., `const count = 0` not `const count: number = 0`)
- Prefer optional chaining (`?.`) over `&&` chains for property access
- **Avoid inline `style` props**: Prefer `@emotion/styled` components over inline `style` attributes. Move styled components to `styled-components.ts` when possible.
- Naming conventions:
  - Refs must end with `Ref` suffix (e.g., `inputRef`)
  - Event handlers prefixed with `handle` (e.g., `handleClick`)
  - Styled components prefixed with `Styled` (e.g., `StyledButton`) and moved to `styled-components.ts`
  - Test IDs use pattern `stComponentSubcomponent`
- Extract static lookup maps and constants to module-level scope (outside functions/components)

### TypeScript Tests

Consolidate repetitive tests using `it.each`:

```typescript
it.each([
  ["test", "TEST"],
  ["hello", "HELLO"],
  ["", ""],
])("converts %s to uppercase as %s", (input, expected) => {
  expect(toUpperCase(input)).toBe(expected)
})
```

Guidelines:
- Use descriptive test names with format placeholders (`%s`, `%d`)
- Group related test cases logically
- Include both positive and negative test cases
- Use Vitest syntax only, not Jest
- RTL query priority: prefer `getByRole` > `getByLabelText` > `getByTestId`
- Avoid tautological assertions (e.g., asserting both `x === true` and `x !== false`)
- Prefer targeted negatives over exhaustive matrices; one high-signal check per behavior

### E2E Tests (Playwright)

For tests in `e2e_playwright/`:

- Use shared `conftest.py` fixtures and `app_utils` methods where applicable
- Prefer label- or key-based locators over index-based access (e.g., avoid `get_by_test_id().nth(0)`)
- Group related tests into single, logical test files for CI efficiency and maximize coverage per test case
- Do NOT simplify E2E tests using `@pytest.mark.parametrize`—E2E tests are expensive, and parameterization multiplies browser runs. Prefer iterating variants within a single test function instead.

## What NOT to Do

- Do not modify production code when simplifying tests
- Do not remove or weaken unique test scenarios
- Do not over-parameterize when it reduces readability
- Do not add docstrings, comments, or type annotations to unchanged code
- Do not create abstractions for one-time operations
