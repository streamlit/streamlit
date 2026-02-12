---
name: fixing-streamlit-ci
description: Analyze and fix failed GitHub Actions CI jobs for the current branch/PR. Use when CI checks fail, PR checks show failures, or you need to diagnose lint/type/test errors and verify fixes locally.
---

# Fix CI Failures

Diagnose and fix failed GitHub Actions CI jobs for the current branch/PR using [`gh` CLI](https://cli.github.com/manual/) and `git` commands.

## When to Use

- CI checks have failed on a PR
- You need to understand why a workflow failed
- You want to apply fixes and verify locally

## Workflow

Copy this checklist to track progress:

```
- [ ] Verify authentication
- [ ] Gather context & find failed jobs
- [ ] Download & analyze logs
- [ ] Present diagnosis to user
- [ ] Apply fix & verify locally
- [ ] Push & recheck CI
```

### 1. Verify Authentication

```bash
gh auth status
```

If authentication fails, prompt user to run `gh auth login` with appropriate scopes.

### 2. Gather PR Context

```bash
# Get PR for current branch
gh pr view --json number,title,url,headRefName

# Get PR description and metadata
gh pr view --json title,body,labels,author

# List changed files
gh pr diff --name-only

# All changes
gh pr diff
```

### 3. Check CI Status

```bash
# List all checks (shows pass/fail status)
gh pr checks

# Get detailed check info
gh pr checks --json name,state,conclusion,detailsUrl,startedAt,completedAt

# List only failed runs
gh run list --branch $(git branch --show-current) --status failure --limit 10

# Check if CI is still running
gh run list --branch $(git branch --show-current) --status in_progress
```

### 4. Find Failed Jobs

```bash
# View run details (get RUN_ID from previous step)
gh run view {RUN_ID}

# List failed jobs with IDs
gh run view {RUN_ID} --json jobs --jq '.jobs[] | select(.conclusion == "failure") | {id: .databaseId, name: .name}'

# List failed jobs with their failed steps
gh run view {RUN_ID} --json jobs --jq '.jobs[] | select(.conclusion == "failure") | {name: .name, steps: [.steps[] | select(.conclusion == "failure") | .name]}'
```

### 5. Download & Analyze Logs

**Primary method:**

```bash
# Get failed logs (last 250 lines usually contains the error)
gh run view {RUN_ID} --log-failed 2>&1 | tail -250

# Target a specific failed job by ID
gh run view {RUN_ID} --job {JOB_ID} --log-failed 2>&1 | tail -100
```

**Fallback for pending logs:**

```bash
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
gh api "/repos/${REPO}/actions/jobs/{JOB_ID}/logs"
```

**Smart log extraction (examples):**

```bash
# Context around failure markers
gh run view {RUN_ID} --log-failed 2>&1 | grep -B 5 -A 10 -iE "error|fail|exception|traceback|panic|fatal" | head -100

# Python tests - pytest summary
gh run view {RUN_ID} --log-failed 2>&1 | grep -E -A 50 "FAILED|ERROR|short test summary"

# TypeScript/ESLint errors
gh run view {RUN_ID} --log-failed 2>&1 | grep -E -B 2 -A 5 "error TS|error  "

# E2E snapshot mismatches
gh run view {RUN_ID} --log-failed 2>&1 | grep -E -B 2 -A 5 "Missing snapshot for|Snapshot mismatch for"
```

### 6. Analyze Failure

Identify:
- **Error type**: Lint, type check, test failure, build error
- **Root cause**: First/primary error (not cascading failures)
- **Affected files**: Which files need changes
- **Error message**: Exact error text

**Common CI failure categories:**

| Category | Workflow | Make Command | Auto-fix |
|----------|----------|--------------|----------|
| Python lint | `python-tests.yml` | `make python-lint` | ✅ `make autofix` |
| Python types | `python-tests.yml` | `make python-types` | ❌ Manual |
| Python tests | `python-tests.yml` | `make python-tests` | ❌ Manual |
| Frontend lint | `js-tests.yml` | `make frontend-lint` | ✅ `make autofix` |
| Frontend types | `js-tests.yml` | `make frontend-types` | ❌ Manual |
| Frontend tests | `js-tests.yml` | `make frontend-tests` | ❌ Manual |
| E2E tests | `playwright.yml` | `make run-e2e-test <file>` | ❌ Manual |
| E2E snapshots | `playwright.yml` | `make run-e2e-test <file>` | ✅ `make update-snapshots` |
| NOTICES | `js-tests.yml` | `make update-notices` | ✅ `make update-notices` |
| Min constraints | `python-tests.yml` | `make update-min-deps` | ✅ `make update-min-deps` |
| Pre-commit | `enforce-pre-commit.yml` | `uv run pre-commit run --all-files` | ✅ Mostly auto-fix |
| Relative imports | `ensure-relative-imports.yml` | Check script output | ❌ Manual |
| **PR Labels** | `require-labels.yml` | N/A | ⏭️ **Ignore** |

> 💡 **Quick win:** Run `make autofix` first for lint/formatting failures.

### 7. Present Diagnosis

**For multiple failures**, list all and let user choose:

```
CI Failure Analysis for PR #{NUMBER}: {TITLE}
═══════════════════════════════════════════════════════════════

Found {N} failed jobs/checks:

─────────────────────────────────────────────────────────────────

1. [LINT] Python Unit Tests → Run Linters
   Workflow: python-tests.yml (GitHub Actions)
   Error:    Ruff formatting error in lib/streamlit/elements/foo.py
   Auto-fix: ✅ `make autofix`

2. [TYPE] Javascript Unit Tests → Run type checks
   Workflow: js-tests.yml (GitHub Actions)
   Error:    TS2322: Type 'string' is not assignable to type 'number'
   File:     frontend/lib/src/components/Bar.tsx:42
   Auto-fix: ❌ Manual fix required

─────────────────────────────────────────────────────────────────

Which failures would you like me to address?
Options: "1" | "1,2" | "1-2" | "all" | "only auto-fixable"
```

**For single failure**, show detailed analysis:

```
─────────────────────────────────────────────────────────────────
Analyzing: [TYPE] Javascript Unit Tests → Run type checks
─────────────────────────────────────────────────────────────────

Category: TYPE
Workflow: js-tests.yml
Job:      js-unit-tests (ID: 12345678)
Step:     Run type checks

Error snippet:
  frontend/lib/src/components/Bar.tsx:42:5
  error TS2322: Type 'string' is not assignable to type 'number'.

Proposed Fix:
  Change type annotation or fix the value type

─────────────────────────────────────────────────────────────────

Would you like me to:
  [1] Apply the fix automatically
  [2] Show the proposed changes first
  [3] Run local verification only
  [4] Skip this and move to next failure
```

### 8. Apply Fix & Verify Locally

After user approval, apply fix and run verification:

```bash
# Run all checks (lint, types, tests) on changed files
make check

# Python tests (specific)
uv run pytest lib/tests/path/to/test_file.py::test_name -v

# Frontend tests (specific)
cd frontend && yarn test path/to/test.test.tsx

# E2E tests
make run-e2e-test {test_file.py}

# E2E snapshots
make update-snapshots
```

### 9. Summary & Push

```bash
git status --short
git diff --stat
```

Report what failed, what changed, and local verification result.

```bash
git add -A
git commit -m "fix: resolve CI failure in {workflow/step}"
git push
```

### 10. Recheck CI Status

```bash
gh pr checks --watch
# Or re-run failed jobs
gh run rerun {RUN_ID} --failed
```

## Rules

- **Focus on root cause**: First error, not cascading failures
- **Minimal fixes**: Smallest change that fixes the issue
- **Don't skip tests**: Never disable tests to "fix" CI
- **Verify locally**: Always run appropriate local command
- **Preserve intent**: Understand what code was trying to do

## Error Handling

| Issue | Solution |
|-------|----------|
| Auth failed | `gh auth login` with workflow/repo scopes |
| No PR for branch | `gh run list` to check workflow runs |
| CI still running | `gh pr checks --watch` |
| Logs pending | Retry with job logs API |
| No failed checks | All passing ✅ |
| Rate limited | Wait and retry |
| Flaky test | Re-run: `gh run rerun {RUN_ID} --failed` |
