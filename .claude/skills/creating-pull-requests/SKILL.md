---
name: creating-pull-requests
description: Creates a draft pull request on GitHub with proper labels, branch naming, and description formatting. Use when changes are ready to be submitted as a PR to the streamlit/streamlit repository.
---

# Create pull request

Create a draft PR on GitHub with appropriate labels.

**Critical constraints:**

- MUST show PR content in chat for visibility before creating
- MUST follow the writing and labeling rules below

## Step 1: Detect git state and prepare branch

Auto-detect the current state and act accordingly:

```bash
git branch --show-current
git status
git log --oneline -5
git branch -vv
```

**If already on a feature branch with changes committed and pushed:**
Verify the branch tracks a remote and is up to date (check the `git branch -vv` output above) and proceed to Step 2.

**If changes need committing/pushing:**

```bash
git checkout develop && git pull origin develop  # ensure branching from latest develop
git checkout -b {type}/{descriptive-name}   # if not already on a feature branch
git add <files>
git commit -m "{imperative-verb} {what} {where}"
git push --set-upstream origin $(git branch --show-current)
```

**Branch naming:** `{type}/{brief-description}` in kebab-case.
Types: `feature`, `fix`, `refactor`, `chore`, `docs`.
Examples: `feature/add-height-plotly-charts`, `fix/dataframe-memory-leak-scrolling`.

**Commit message:** `<imperative verb> <what> <where>`, ≤50 chars, no period.
Examples: `Add height parameter to plotly charts`, `Fix memory leak in dataframe scrolling`.

## Step 2: Compose and create PR

### 2.1 Determine labels

All PRs require these labels:

| Category | Options |
|----------|---------|
| Impact | `impact:users` (affects user behavior) OR `impact:internal` (no user behavior change) |
| Change type | `change:feature`, `change:bugfix`, `change:chore`, `change:refactor`, `change:docs`, `change:spec`, `change:other` |

**Note:** PRs labeled `change:spec` (for spec/design documents only) are exempt from the `impact:*` requirement. Do not use `change:spec` for PRs with code changes.

### 2.2 Generate PR title

Format: `[type] Description of change`, ≤63 chars (fits squash-merge commit subjects).

Examples: `[feature] Add height parameter to plotly charts`, `[fix] Extra padding on button`.

### 2.3 Compose PR description

Read `.github/pull_request_template.md` for the required sections, then fill them in.

**Writing rules:**

- Highlight what matters. Omit the obvious.
- 2-4 bullets maximum for listing changes.
- No meta-commentary ("This PR...", "We have...", "I added..."). State what changed directly.
- Don't list: added tests, updated types, added validation, fixed linting (all obvious).
- DO explain non-obvious decisions (deprecations, unit choices, fallback behavior).

**Good:**
> Adds `height` parameter to `st.plotly_chart()` using `Height` type system.
> - Deprecates `use_container_height` (removed after 2025-12-31)

**Bad (lists every change):**
> - Added `height` parameter to signature
> - Updated layout config dataclass
> - Added validation for height values
> - Added unit tests

**Testing section** — detect from changed files:

| Pattern | Test type |
|---------|-----------|
| `lib/tests/**/*.py` | Python unit tests |
| `frontend/**/*.test.{ts,tsx}` | Frontend unit tests |
| `e2e_playwright/**/*_test.py` | E2E tests |

Check the matching boxes in the PR template. If no test files changed, explain why. Leave "manual testing" unchecked (user fills in).

### 2.4 Create PR

Show the complete PR title, labels, and description in chat for visibility, then create the PR directly. Substitute the actual title, description, and labels generated in steps 2.1–2.3:

```bash
gh pr create \
  --title "[feature] Add height parameter to plotly charts" \
  --body "$(cat <<'EOF'
## Summary

Adds `height` parameter to `st.plotly_chart()` using `Height` type system.
- Deprecates `use_container_height` (removed after 2025-12-31)

## Testing

- [x] Python unit tests
- [x] E2E tests
EOF
)" \
  --base develop \
  --label "impact:users,change:feature" \
  --draft
```

## Reference

For full details on writing principles, labeling, branch naming, and testing plans, see the [Pull requests wiki](../../../wiki/pull-requests.md).
