# Pull requests

Quick reference for Streamlit PR conventions. See [`.github/pull_request_template.md`](../.github/pull_request_template.md) for the canonical PR template.

## Main branch

The main branch of this repository is `develop`.

## Branch naming

**Format:** `{type}/{brief-description}` in kebab-case.

**Types:** `feature`, `fix`, `refactor`, `chore`, `docs`

**Examples:**

```
feature/add-height-parameter-plotly-charts
fix/dataframe-memory-leak-large-datasets
refactor/element-width-height-logic
chore/update-react-dependencies
```

**Guidelines:** Descriptive and specific (3-8 words), avoid ticket/issue numbers (use the PR description for that).

## Commit messages

**Format:**

```
<imperative verb> <what> <where>
```

**Rules:**

- First line ≤50 characters, imperative mood ("Add" not "Added"), no trailing period
- Optional body: ≤72 characters per line

**Examples:**

```
Add height parameter to plotly charts
Fix memory leak in dataframe scrolling
Refactor layout config validation logic
```

## PR titles

**Format:** `[type] Description of change` (≤63 characters, to fit squash-merge commit subjects)

Types: `[feature]`, `[fix]`, `[refactor]`, `[chore]`, `[docs]`

**Examples:**

```
[feature] Add height parameter to plotly charts
[fix] Extra padding on button
[refactor] Layout config validation logic
```

## Describing changes

**Core principle: Highlight what matters. Omit the obvious.**

Before including something in the PR description, ask:

1. **Is it obvious from the code?** (tests, types, validation, linting) → Omit
2. **Is it the most impactful change?** → Include
3. **Does it involve a non-obvious decision?** → Include with explanation

Keep it to 2-4 bullets. No meta-commentary ("This PR...", "I added...") — state what changed directly.

**Good:**

> Adds `height` parameter to `st.plotly_chart()` using `Height` type system.
>
> - Added `height` parameter with default `"stretch"`
> - Deprecates `use_container_height` (removed after 2025-12-31)

**Bad:**

> - Added `height` parameter to signature
> - Updated layout config dataclass
> - Added validation for height values
> - Added unit tests
> - Updated type hints

Most of these are obvious. Only the parameter addition and deprecation are impactful/non-obvious.

## Labels

All PRs require two labels:

| Category | Options |
|----------|---------|
| Impact | `impact:users` (affects user behavior) **or** `impact:internal` |
| Change type | `change:feature` · `change:bugfix` · `change:chore` · `change:refactor` · `change:docs` · `change:spec` · `change:other` |

**Note:** PRs labeled `change:spec` (for spec/design documents only) are exempt from the `impact:*` requirement. Do not use `change:spec` for PRs with code changes.

## Testing plan

**Where tests live:**

| Test type | Pattern |
|-----------|---------|
| Python unit tests | `lib/tests/**/*.py` |
| Frontend unit tests | `frontend/**/*.test.ts` or `*.test.tsx` |
| E2E tests | `e2e_playwright/**/*_test.py` |

**Fill the PR template checklist** based on which test files changed. If no tests were added, explain why (e.g., "Documentation-only changes, no behavior modifications").

**Describe testing** by listing the test files and what they cover:

```markdown
- `lib/tests/streamlit/elements/plotly_chart_test.py` — Tests height parameter
- `e2e_playwright/st_plotly_chart_test.py` — Visual regression tests for height
```
