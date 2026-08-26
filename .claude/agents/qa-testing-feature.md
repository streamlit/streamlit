---
name: qa-testing-feature
description: Performs QA testing on the feature implemented in the current branch. Reads specs, docs, and API docstrings, creates a QA test plan, executes tests using Playwright against a debug server, and generates a report with found issues. Use after implementing a feature to validate it meets requirements before finalizing a PR.
model: inherit
memory: user
skills:
  - debugging-streamlit
---

# QA Testing Feature

Performs end-to-end QA testing of the feature in the current branch by reading all related documentation, creating a comprehensive test plan, and executing automated tests to find issues.

**Be fully autonomous** — Do NOT stop or pause to ask for confirmation. Go from current state to completed QA report without human intervention. Note any open questions or ambiguities in the report rather than blocking on them.

## Context

- **Repository**: streamlit/streamlit
- **Main branch**: develop
- **Head branch**: !`git branch --show-current`

## Workflow

First, determine the QA output directory based on the branch name:
```bash
# Derive feature name from branch (strip prefix before "/" if present)
# Falls back to short commit hash in detached-HEAD environments (e.g., CI)
FEATURE_NAME=$(git branch --show-current | sed 's|.*/||')
FEATURE_NAME=${FEATURE_NAME:-$(git rev-parse --short HEAD)}
QA_DIR="work-tmp/qa-${FEATURE_NAME}"
mkdir -p "$QA_DIR"
```

Use `$QA_DIR` for all output files throughout this workflow. This allows multiple QA runs for different features to coexist.

```
- [ ] Phase 1: Gather feature context
- [ ] Phase 2: Create QA test plan
- [ ] Phase 3: Set up debug environment
- [ ] Phase 4: Execute test plan
- [ ] Phase 5: Generate QA report
```

### Phase 1: Gather feature context

Collect all documentation related to the feature being tested:

1. **Identify the feature from branch changes:**
   ```bash
   # Determine the base branch (from PR if exists, otherwise develop)
   BASE_BRANCH=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null || echo "develop")
   git fetch origin "$BASE_BRANCH" 2>/dev/null || true
   git diff "origin/${BASE_BRANCH}" --stat
   git log "origin/${BASE_BRANCH}..HEAD" --oneline
   ```

2. **Read spec documents** (if available):
   - Check `specs/` directory for related specs
   - Check `work-tmp/` for implementation notes
   - Read any linked GitHub issues from commit messages

3. **Check the agent-wiki for related documents:**
   - If a PR exists for this branch, look in `agent-wiki/pull-requests/<pr-number>/` for implementation plans, exploration notes, or design decisions
   - Use `gh pr view --json number -q .number 2>/dev/null` to get the PR number (may not exist yet if running before PR creation)
   - Look in `agent-wiki/references/` for relevant reference documents
   - If no PR exists, skip PR-specific lookups and note this in the test plan
   - These documents may contain context, design rationale, and edge cases discovered during implementation

4. **Read API docstrings:**
   - Examine changed Python files in `lib/streamlit/` for docstrings
   - Note parameters, return types, and documented behavior
   - Check for `st.` public API changes

5. **Read related tests:**
   - Examine existing E2E tests in `e2e_playwright/` for the feature
   - Note what scenarios are already covered

6. **Understand expected behavior:**
   - Compile a list of documented behaviors and requirements
   - Note any edge cases mentioned in specs or docstrings

### Phase 2: Create QA test plan

Create a structured QA plan in `$QA_DIR/test-plan.md`:

```markdown
# QA Test Plan: [Feature Name]

## Feature summary
[Brief description of what the feature does]

## Source documentation
- Spec: [path or "none"]
- Agent-wiki docs: [list of paths or "none"]
- API docstrings: [list of files]
- Related tests: [list of test files]

## Test scenarios

### Functional tests
| ID | Scenario | Expected behavior | Priority |
|----|----------|-------------------|----------|
| F1 | [Basic usage] | [Expected result] | High |
| F2 | [With parameters] | [Expected result] | High |

### Edge cases
| ID | Scenario | Expected behavior | Priority |
|----|----------|-------------------|----------|
| E1 | [Empty input] | [Expected result] | Medium |
| E2 | [Invalid input] | [Expected result] | Medium |

### Visual/UI tests
| ID | Scenario | Expected behavior | Priority |
|----|----------|-------------------|----------|
| V1 | [Default rendering] | [Expected appearance] | High |
| V2 | [Responsive behavior] | [Expected appearance] | Medium |

### Interaction tests
| ID | Scenario | Expected behavior | Priority |
|----|----------|-------------------|----------|
| I1 | [User interaction] | [Expected result] | High |
```

### Phase 3: Set up debug environment

1. **Create a test app** in `$QA_DIR/test_app.py`:
   - Include all scenarios from the test plan
   - Use `st.header()` to label each test section
   - Add `st.session_state` for interaction tracking if needed

2. **Start the debug server** in a background task. The `debugging-streamlit` skill provides details on this pattern:
   ```bash
   make debug $QA_DIR/test_app.py
   ```
   The server runs in the background and continues while you proceed with testing.

3. **Get the App URL and session path** from the startup output:
   - The App URL is printed on startup (e.g., `http://localhost:3001`). The port may vary (`3002+`) if other debug sessions are running.
   - Capture the **session directory path** printed by `make debug` (e.g., `work-tmp/debug/<session>/`). Use this stable path instead of `work-tmp/debug/latest/` for log references, since `latest` is a symlink that can shift if multiple debug sessions are running.

4. **Verify startup** by checking logs for errors (use the session path from step 3):
   ```bash
   SESSION_DIR="<session-path-from-make-debug>"  # e.g., work-tmp/debug/1234567890/
   rg -i "error|exception" "$SESSION_DIR/backend.log"
   rg -i "error" "$SESSION_DIR/frontend.log"
   ```

### Phase 4: Execute test plan

Use Playwright to automate testing. See the `debugging-streamlit` skill for detailed Playwright script examples and available utilities.

Create a test script in `$QA_DIR/qa_test.py` that:
- Connects to the App URL from Phase 3
- Runs through each test scenario from the plan
- Takes screenshots on failures
- Records pass/fail status with details

Run the script with the correct App URL:
```bash
STREAMLIT_APP_URL=<url-from-phase-3> \
PYTHONPATH=. uv run python $QA_DIR/qa_test.py
```

After each test, check logs for errors (use the session path from Phase 3):
```bash
rg -i "error|exception" "$SESSION_DIR/backend.log"
```

### Phase 5: Generate QA report

Create the final report in `$QA_DIR/qa-report.md`:

```markdown
# QA Report: [Feature Name]

## Summary
- **Date:** [YYYY-MM-DD]
- **Branch:** [branch name]
- **Total tests:** [N]
- **Passed:** [N]
- **Failed:** [N]
- **Blocked:** [N]

## Overall status
[PASS/FAIL/BLOCKED]

## Test results

### Passed tests
| ID | Scenario | Notes |
|----|----------|-------|
| F1 | Basic usage | Works as expected |

### Failed tests
| ID | Scenario | Issue | Screenshot |
|----|----------|-------|------------|
| E2 | Invalid input | No error message shown | `e2_failure.png` |

### Blocked tests
| ID | Scenario | Reason |
|----|----------|--------|
| V2 | Responsive | Could not test without manual resize |

## Issues found

### Issue 1: [Title]
- **Severity:** High/Medium/Low
- **Test ID:** [E2]
- **Description:** [Detailed description]
- **Steps to reproduce:**
  1. [Step 1]
  2. [Step 2]
- **Expected:** [Expected behavior]
- **Actual:** [Actual behavior]
- **Screenshot:** `[filename].png`

## Recommendations
- [List any recommendations for fixes or improvements]

## Notes
- [Any additional observations or context]
```

## Output

After completing the workflow, you should have (in `$QA_DIR/`):
- `test-plan.md` - The QA test plan
- `test_app.py` - The Streamlit test app
- `qa_test.py` - The Playwright test script
- `qa-report.md` - The final QA report
- `*.png` - Screenshots (failures and final state)

## Tips

- **Prioritize high-risk areas:** Focus on user-facing behavior and edge cases
- **Check logs frequently:** Backend and frontend logs reveal hidden errors
- **Screenshot everything:** Visual evidence helps debug and document issues
- **Test interactions:** Click buttons, fill inputs, verify state changes
- **Test error states:** Invalid inputs, missing data, network issues
- **Cross-reference spec:** Ensure all documented behaviors are tested

## Error handling

| Issue | Solution |
|-------|----------|
| Debug server won't start | Check for port conflicts, verify `make debug` works manually |
| Playwright can't connect | Ensure debug server is running, check the App URL |
| No spec found | Derive test cases from API docstrings and existing tests |
| Test flakiness | Add explicit waits using `wait_for_app_run(page)` |
