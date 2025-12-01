---
status: stable
last_updated: 2025-11-05
---

# Writing Style for PRs

**Core principle: Highlight what matters. Omit the obvious.**

Don't list every change - focus on the most impactful. Don't explain what's obvious from reading the code - only explain non-obvious decisions.

## Commit Messages

**Format:**

```
<imperative verb> <what> <where>

Optional body with technical details.
```

**Rules:**

- First line: ≤50 characters
- Use imperative mood ("Add" not "Added" or "Adds")
- No periods at end of first line
- Body: ≤72 characters per line (if needed)

**Good examples:**

```
Add height parameter to plotly charts
Fix memory leak in dataframe scrolling
Refactor layout config validation logic
```

**Bad examples (too verbose):**

```
✗ Added a new height parameter feature to the plotly chart component to enable users to control chart dimensions
✗ This commit fixes the memory leak that was occurring when users scrolled through large dataframes
✗ Refactored the layout configuration validation logic to improve code quality and maintainability
```

## PR Titles

**Rules:**

- ≤80 characters
- Descriptive, not marketing ("Add X" not "Exciting new X feature!")
- Match commit message if single commit

**Good examples:**

```
Add height parameter to plotly charts
Fix dataframe memory leak on scroll
Refactor layout config validation
```

**Bad examples:**

```
✗ Exciting new feature: height parameter support for beautiful plotly charts!
✗ This PR fixes a critical memory leak issue that users were experiencing
```

## PR Descriptions

**Rules:**

- **List only impactful changes** (2-4 bullets max) - Not every file touched
- **Omit obvious details** - Don't explain what's clear from reading the code
- **Explain non-obvious decisions** - Only include implementation details that aren't obvious
- **No meta-commentary** - Skip "this PR", "we have", "I added"

**Good example (selective, highlights what matters):**

```markdown
## Describe your changes

Adds `height` parameter to `st.plotly_chart()` using `Height` type system.

**Changes Made:**

- Added `height` parameter with default `"stretch"`
- Deprecates `use_container_height` (removed after 2025-12-31)
```

**Bad example (lists every change):**

```markdown
## Describe your changes

Adds height parameter to st.plotly_chart().

**Changes Made:**

- Added `height: Height = "stretch"` parameter to st.plotly_chart signature
- Updated layout config dataclass to accept height parameter
- Added validation for height parameter values
- Updated proto message to include height field
- Added unit tests for height parameter
- Added E2E tests for height visual behavior
- Updated type hints in plotly_chart.py
- Added height to **all** exports
- Updated docstring with height parameter documentation
```

**Why bad:** Most of these are obvious (of course you added tests, updated types, etc.). Only list what's non-obvious or impactful.

**Good example (explains non-obvious decision):**

```markdown
**Implementation Note:**
When `height="content"`, extracts height from native Plotly figure if specified, falls back to `"stretch"` otherwise.
```

**Bad example (explains obvious):**

```markdown
**Implementation Note:**
The height parameter is validated to ensure only valid values are accepted. Invalid values raise an error with a helpful message.
```

**Why bad:** This is obvious - of course parameters are validated.

## Length Guidelines

**Commit message first line:** 50 chars max
**PR title:** 80 chars max
**Changes Made bullets:** 2-4 bullets max (only impactful changes)
**Total PR description:** Aim for <15 lines

## What NOT to Include

**Don't list obvious changes:**

- ✗ "Added tests" (obvious)
- ✗ "Updated type hints" (obvious)
- ✗ "Added validation" (obvious)
- ✗ "Updated documentation" (obvious)
- ✗ "Fixed linting errors" (obvious)

**Don't explain obvious behavior:**

- ✗ "Parameters are validated to ensure correctness"
- ✗ "Added error handling for edge cases"
- ✗ "Code follows existing patterns"

**DO explain non-obvious decisions:**

- ✓ "Deprecates `use_container_height` (removed after 2025-12-31)"
- ✓ "When `height="content"`, extracts from native figure if specified"
- ✓ "Uses `rem` units instead of `px` for responsive sizing"

## Selectivity Checklist

Before including a change in PR description, ask:

1. **Is this obvious?** → Omit it
2. **Is this a standard pattern?** (tests, types, validation) → Omit it
3. **Is this the most impactful change?** → Include it
4. **Does this involve a non-obvious decision?** → Include it with explanation

**Example - Feature: Add height parameter**

**What to include:**

- ✓ New parameter added (the main change)
- ✓ Deprecation of old parameter (impacts users)
- ✓ Non-obvious behavior (how "content" mode works)

**What to omit:**

- ✗ Added tests (obvious)
- ✗ Updated types (obvious)
- ✗ Added validation (obvious)
- ✗ Updated proto (implementation detail)
- ✗ Fixed linting (housekeeping)
