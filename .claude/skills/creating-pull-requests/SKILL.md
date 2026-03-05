---
name: creating-pull-requests
description: Creates a draft pull request on GitHub with proper labels, branch naming, and description formatting. Use when changes are ready to be submitted as a PR to the streamlit/streamlit repository.
---

# Create pull request

Create a draft PR on GitHub with appropriate labels after user approval.

**Critical constraints:**

- MUST wait for user approval before running `gh pr create`
- MUST show complete PR content in chat before creating
- MUST follow the writing and labeling rules below

## Step 1: Choose mode

**Always ask the user first:**

> How would you like to proceed with creating the PR?
>
> 1. **Already Ready**: I have a feature branch with all changes committed and pushed
> 2. **Automated**: Handle branch creation, committing, and pushing automatically

Wait for user response before proceeding.

## Step 2: Execute git workflow

### Mode A: Already ready

Validate readiness:

```bash
git branch --show-current
git status
git branch -r | grep $(git branch --show-current)
```

Confirm with user, then proceed to Step 3.

### Mode B: Automated

Assumes user has already staged changes with `git add`.

```bash
git status
git checkout develop
git checkout -b {type}/{descriptive-name}
git commit -m "{imperative-verb} {what} {where}"
git push --set-upstream origin $(git branch --show-current)
```

**Branch naming:** `{type}/{brief-description}` in kebab-case.
Types: `feature`, `fix`, `refactor`, `chore`, `docs`.
Examples: `feature/add-height-plotly-charts`, `fix/dataframe-memory-leak-scrolling`.

**Commit message:** `<imperative verb> <what> <where>`, ≤50 chars, no period.
Examples: `Add height parameter to plotly charts`, `Fix memory leak in dataframe scrolling`.

## Step 3: Compose and create PR

### 3.1 Determine labels

All PRs require these labels:

| Category | Options |
|----------|---------|
| Impact | `impact:users` (affects user behavior) OR `impact:internal` (no user behavior change) |
| Change type | `change:feature`, `change:bugfix`, `change:chore`, `change:refactor`, `change:docs`, `change:spec`, `change:other` |

**Note:** PRs labeled `change:spec` (for spec/design documents only) are exempt from the `impact:*` requirement. Do not use `change:spec` for PRs with code changes.

### 3.2 Generate PR title

Format: `[type] Description of change`, ≤63 chars (fits squash-merge commit subjects).

Examples: `[feature] Add height parameter to plotly charts`, `[fix] Extra padding on button`.

### 3.3 Compose PR description

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

### 3.4 Write PR for user review

Write complete PR details to `work-tmp/pr_description.md`:

```markdown
---
title: [PR title from 3.2]
labels: impact:{users|internal}, change:{type}
---

[PR description from 3.3]
```

Ask user: "I've written the PR details to `work-tmp/pr_description.md`. You can edit the title, labels, or description directly in that file. Reply 'yes' when ready to create the PR, or provide feedback for changes."

### 3.5 Create PR (after user approval only)

Read `work-tmp/pr_description.md` to get the (potentially edited) title, labels, and description:

```bash
# Parse frontmatter from the reviewed file
title=$(grep '^title:' work-tmp/pr_description.md | sed 's/^title: //')
labels=$(grep '^labels:' work-tmp/pr_description.md | sed 's/^labels: //' | sed 's/, /,/g')

# Extract body (everything after the closing --- of frontmatter)
awk '/^---$/{if(++count==2) flag=1; next} flag' work-tmp/pr_description.md > work-tmp/pr_body.md

# Create PR using parsed values
gh pr create \
  --title "$title" \
  --body-file work-tmp/pr_body.md \
  --base develop \
  --label "$labels" \
  --draft

# Clean up temporary files
rm work-tmp/pr_description.md work-tmp/pr_body.md
```

## Reference

For full details on writing principles, labeling, branch naming, and testing plans, see the [Pull requests wiki](../../../wiki/pull-requests.md).
