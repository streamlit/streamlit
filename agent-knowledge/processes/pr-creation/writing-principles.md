---
status: stable
last_updated: 2025-12-02
---

# Writing Principles for PRs

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
```

## PR Titles

**Format:**

```
[type] lowercase description of change
```

**Rules:**

- Start with change type in brackets: `[feature]`, `[fix]`, `[refactor]`, `[chore]`, `[docs]`
- ≤80 characters total
- Lowercase after the bracket
- Descriptive, not marketing
- Match commit message content if single commit

**Good examples:**

```
[feature] add height parameter to plotly charts
[fix] extra padding on button
[refactor] layout config validation logic
[chore] update dependencies
[docs] clarify st.cache_data usage
```

**Bad examples:**

```
✗ Exciting new feature: height parameter support for beautiful plotly charts!
✗ This PR fixes a critical memory leak issue that users were experiencing
✗ Add height parameter (missing [type] prefix)
```

## General Content Principles

**What NOT to include:**

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

## No Meta-Commentary

Skip phrases like:

- "This PR..."
- "We have..."
- "I added..."

Just state what changed directly.
