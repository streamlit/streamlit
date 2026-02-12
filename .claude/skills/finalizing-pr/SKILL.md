---
name: finalizing-pr
description: Finalizes branch changes for merging by simplifying code, running checks, reviewing changes, and creating a PR if needed. Use when ready to merge changes into the target branch.
---

# Finalizing PR

Prepares the current branch for merge by running quality checks, simplifying code, and creating a PR if one doesn't exist.

## Workflow

Follow these steps in order:

### 1. Build and install

Run `make all` to ensure the build and installation are up-to-date:

```bash
make all
```

### 2. Simplify changes

Run the `simplifying-local-changes` subagent to clean up and simplify the code changes. Wait for completion before proceeding.

### 3. Run autofix

Run autofix to fix formatting and linting issues:

```bash
make autofix
```

### 4. Run checks (first pass)

Run the `checking-changes` skill (uses `make check`) to validate the changes. Fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 5. Review changes

Run the `reviewing-local-changes` subagent to review the changes. Wait for completion and read the review output.

### 6. Address review feedback

Review the recommendations from step 5. For each recommendation:

- If valid and improves code quality: implement the change
- If not applicable or would over-engineer: skip with brief reasoning

### 7. Run checks (second pass)

Run the `checking-changes` skill (uses `make check`) to validate the changes. Fix any issues found before proceeding. Don't run other checks besides `make check` in this step.

### 8. Create or update PR

Check if a PR exists for the current branch:

```bash
gh pr view --json number,title,url 2>/dev/null || echo "NO_PR"
```

**If no PR exists**, create one following these guidelines:

#### PR title format

```
[type] Description of change
```

Types: `[feat]`, `[fix]`, `[refactor]`, `[chore]`, `[docs]`

#### PR body

Use the template from `.github/pull_request_template.md` (you don't need to add something to the screenshot or video section):

```markdown
## Describe your changes

[2-4 bullets max, focus on impactful changes, omit obvious details]

## GitHub Issue Link (if applicable)

[Link to related issue or remove section]

## Testing Plan

- [ ] Explanation of why no additional tests are needed
- [ ] Unit Tests (JS and/or Python)
- [ ] E2E Tests
- [ ] Any manual testing needed?
```

#### Required labels

Add these labels when creating the PR:

- One impact label: `impact:users` or `impact:internal`
- One change type: `change:feature`, `change:bugfix`, `change:refactor`, `change:chore`, `change:docs`, or `change:other`

#### Create PR command

```bash
gh pr create --base develop --title "[type] Description" --body "$(cat <<'EOF'
## Describe your changes

- Change 1
- Change 2

## Testing Plan

- [x] Unit Tests (JS and/or Python)
EOF
)" --label "impact:users,change:feature"
```

**If PR exists**, check if description needs updating based on current changes.

#### PR creation - best practice

For detailed guidance, see:

- `agent-knowledge/processes/pr-creation/writing-principles.md` - PR title and content style
- `agent-knowledge/processes/pr-creation/describe-changes-guide.md` - What to include/omit
- `agent-knowledge/processes/pr-creation/testing-plan-guide.md` - Testing documentation
- `agent-knowledge/processes/pr-creation/labeling-guide.md` - Required labels
