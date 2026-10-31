# Create Playwright Test

## Mission

Create an automated playwright test to programmatically reproduce and verify a GitHub issue. The test should demonstrate the bug, validate the reproduction, and provide technical documentation for developers.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Default Approach:** Always attempt playwright testing for reproducible bugs. Even if the test doesn't reveal a bug, the attempt provides valuable information to the team about the issue's behavior.

## Prerequisites

- Issue has been analyzed via `analyze-issue.md`
- NOTES.md exists in `st-issues/issues/gh-<ISSUE_NUMBER>/`
- Issue is suitable for playwright testing (widget state, interactions, DOM verification)
- Access to streamlit repository with playwright infrastructure
- **Reference:** See `e2e_playwright/AGENTS.md` for complete playwright testing guidelines

## When to Use Playwright Testing

**🎯 Default Approach: Always Attempt Playwright First**

Playwright testing provides valuable information to the team even if the test doesn't reveal a bug. It documents:

- Expected behavior programmatically
- Actual behavior observed
- Specific interaction patterns
- Test approach for developers

**✅ Especially Valuable For:**

- Widget state behavior (persistence, reruns, session state)
- Widget interactions (clicks, inputs, selections, form submissions)
- DOM structure issues (missing elements, incorrect classes)
- Conditional rendering (elements appearing/disappearing)
- Error/warning display verification
- Multi-widget interactions and cascades
- Fragment behavior (state isolation, rerun behavior)
- Form behavior (submission, validation)
- Config-driven behavior affecting visible UI

**⚠️ Skip Playwright ONLY If Purely Visual/Subjective:**

- Visual/styling issues (colors, spacing, fonts) - requires human judgment
- Animation/transition smoothness - subjective assessment
- "Looks wrong" issues - needs visual inspection

**Note:** If unsure whether to use playwright, attempt it anyway. The worst case is the test doesn't reveal the bug, but you still gain insights to document for the team.

## Workflow

### Step 1: Create Test Files in Streamlit Repo

Create the reproduction app and test in the streamlit repository:

```bash
# From streamlit repo root
mkdir -p .cursor/commands/triage/temp/gh-<ISSUE_NUMBER>
cd .cursor/commands/triage/temp/gh-<ISSUE_NUMBER>
```

### Step 2: Design the Reproduction App

Create `app.py` with the minimal code to reproduce the issue:

**App Template:**

```python
"""
Reproduction for GitHub Issue #<ISSUE_NUMBER>
Title: <ISSUE_TITLE>
Issue URL: https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>

Description:
<Brief description of what this app reproduces>

Expected Behavior:
<What should happen>

Actual Behavior:
<What actually happens - the bug>
"""

import streamlit as st

st.title("Issue #<ISSUE_NUMBER>: <Short Title>")

st.info("🔗 [View original issue](https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>)")

st.header("Reproduction")

# Your minimal reproduction code here
# Focus on demonstrating the bug clearly

st.divider()

st.header("Environment Info")
st.code(f"""
Streamlit version: {st.__version__}
Python version: <version if relevant>
""")

st.header("Expected vs Actual")
st.write("**Expected:** <description>")
st.write("**Actual:** <description of bug>")
```

### Step 3: Create the Playwright Test

Create `app_test.py` to automate verification of the bug:

**Test Template:**

```python
"""
Playwright test for GitHub Issue #<ISSUE_NUMBER>
This test automates verification of the bug reproduction.

Expected: <What should happen>
Actual: <What the bug causes - test should demonstrate this>
"""

from playwright.sync_api import Page, expect
import re

# Import streamlit's playwright utilities
from e2e_playwright.conftest import wait_for_app_run, wait_for_app_loaded
from e2e_playwright.shared.app_utils import (
    get_text_input,
    get_multiselect,
    get_selectbox,
    expect_markdown,
    # Add other utilities as needed - see e2e_playwright/shared/app_utils.py
)


def test_issue_<ISSUE_NUMBER>_reproduction(app: Page):
    """
    Test that reproduces and verifies issue #<ISSUE_NUMBER>.

    This test should FAIL when the bug exists and PASS when fixed.
    """
    # App is already loaded and ready (fixture handles this)

    # === REPRODUCE THE BUG ===
    # Example: Interact with widgets to trigger the bug
    # Use helpers from app_utils for cleaner, more stable tests

    # Example 1: Widget state issue
    # text_input = get_text_input(app, "Input Label")
    # text_input.locator("input").fill("test value")
    #
    # # Trigger rerun
    # app.get_by_role("button", name="Submit").click()
    # wait_for_app_run(app)
    #
    # # BUG: Value should persist but doesn't
    # expect(text_input.locator("input")).to_have_value("test value")

    # === VERIFICATION ===
    # Add assertions that fail when bug exists, pass when fixed
    # Use expect() with auto-wait, not assert statements

    pass  # Replace with actual test implementation


def test_issue_<ISSUE_NUMBER>_workaround(app: Page):
    """
    Optional: Test that verifies a workaround fixes the issue.
    Only include if a workaround exists.
    """
    pass  # Implement workaround test if applicable
```

### Step 4: Run the Playwright Test

Execute the test using streamlit's make commands:

```bash
# From streamlit repo root
cd /path/to/streamlit

# Copy test files to e2e_playwright (temporary)
cp .cursor/commands/triage/temp/gh-<ISSUE_NUMBER>/app.py e2e_playwright/gh_<ISSUE_NUMBER>_repro.py
cp .cursor/commands/triage/temp/gh-<ISSUE_NUMBER>/app_test.py e2e_playwright/gh_<ISSUE_NUMBER>_repro_test.py

# Run the test
make run-e2e-test gh_<ISSUE_NUMBER>_repro_test.py

# If test needs debugging or manual interaction
# make debug-e2e-test gh_<ISSUE_NUMBER>_repro_test.py

# Cleanup
rm e2e_playwright/gh_<ISSUE_NUMBER>_repro.py e2e_playwright/gh_<ISSUE_NUMBER>_repro_test.py
```

**Important:** Per repo policy, always use `make run-e2e-test`, never run `pytest` directly on e2e_playwright files.

### Step 5: Interpret Test Results

Analyze the test execution:

**✅ Test FAILED (Bug Confirmed):**

- The test failure demonstrates the bug exists
- This is GOOD - it means you successfully reproduced the issue
- The test will PASS once developers fix the bug
- Document the failure and what it proves

**❌ Test PASSED (Bug Not Reproduced):**

- Either the bug doesn't exist in current version
- OR the test isn't triggering the bug condition
- OR the issue description was inaccurate
- OR behavior is actually expected (not a bug)
- Review and iterate on the test

**⚠️ Test ERROR (Test Issue):**

- Test has implementation problems
- Fix test code and rerun
- Check imports, selectors, timing

**🤔 Test Shows Expected Behavior:**

- Test works but behavior might not be a bug
- **Reference:** See `expected-vs-bug-assessment.md` for decision framework
- Document assessment in NOTES.md
- May need team clarification

### Step 6: Update NOTES.md in st-issues

Add playwright test results to the existing NOTES.md:

```markdown
## Playwright Test Results

**Test File:** `app_test.py`

**Test Execution Date:** YYYY-MM-DD

**Environment:**

- Streamlit: <version>
- Python: <version>
- Playwright: <version>

### Test: `test_issue_<ISSUE_NUMBER>_reproduction`

**Result:** [PASSED/FAILED/ERROR]

**Expected Behavior:**
<What should happen>

**Actual Behavior (Bug):**
<What the test demonstrates is happening>

**Test Output:**
```

<Copy relevant test output, error messages>

```

**Conclusion:**
[Bug Confirmed / Cannot Reproduce / Test Needs Adjustment]

**Reasoning:**
<Explain what the test results mean>

### Test: `test_issue_<ISSUE_NUMBER>_workaround` (if applicable)

**Result:** [PASSED/FAILED]

**Workaround Tested:**
<Description of workaround>

**Conclusion:**
<Whether workaround works>

## Learnings for Future AI Agents

**Key Insights:**
- <Technical insight about the bug>
- <What triggers the bug>
- <Related behavior observed>

**Testing Approach:**
- <What worked in testing this>
- <What didn't work>
- <Advice for similar issues>

**Root Cause Hypothesis:**
<Your analysis of what's causing the bug based on test behavior>
```

### Step 7: Copy Files to st-issues

Once the test is validated, copy ALL files to st-issues:

```bash
# From st-issues repo
mkdir -p issues/gh-<ISSUE_NUMBER>

# Copy all files from streamlit repo temp directory
cp /path/to/streamlit/.cursor/commands/triage/temp/gh-<ISSUE_NUMBER>/* issues/gh-<ISSUE_NUMBER>/

# Verify files copied
ls -la issues/gh-<ISSUE_NUMBER>/
# Should see: app.py, app_test.py, NOTES.md, (requirements.txt if applicable)
```

**Why copy the test to st-issues:**

- Provides reference for developers fixing the bug
- Documents expected behavior programmatically
- Can be run against deployed app or future versions
- Preserves validation logic alongside reproduction

### Step 8: Assess Bug Status

Based on test results, classify the issue. **Reference:** Use `expected-vs-bug-assessment.md` for detailed decision framework.

**Bug Confirmed:**

- Test successfully reproduced the bug
- Behavior clearly wrong/unexpected
- Test demonstrates expected vs actual
- Matches "Actual Bug" patterns in assessment guide

**Cannot Reproduce:**

- Test shows expected behavior
- Issue may be fixed already
- OR issue description inaccurate
- OR environment-specific

**Possible User Error:**

- Behavior matches documentation
- "Bug" is actually expected behavior
- Requires team decision
- See ambiguous cases in assessment guide

**Expected Behavior (Not a Bug):**

- Test shows system working as designed
- Reporter misunderstood how feature works
- Matches "Expected Behavior" patterns in assessment guide
- Needs documentation improvement

## Output Summary

At completion, provide:

```markdown
## Playwright Test Summary for Issue #<ISSUE_NUMBER>

**Test Created:** ✅
**Test Executed:** ✅
**Result:** [Bug Confirmed / Cannot Reproduce / Needs Review]

**Files in st-issues:**

- `issues/gh-<ISSUE_NUMBER>/app.py`
- `issues/gh-<ISSUE_NUMBER>/app_test.py`
- `issues/gh-<ISSUE_NUMBER>/NOTES.md` (updated with test results)

**Next Steps:**

- Use `create-repro-app.md` to create visual repro app [if bug confirmed]
- Use appropriate command to post update:
  - `confirm-bug.md` [if bug confirmed]
  - `request-team-decision.md` [if behavior unclear]
  - `report-cannot-reproduce.md` [if cannot reproduce]

**Key Technical Findings:**

- <Finding 1>
- <Finding 2>
```

## Best Practices

1. **Test the bug, not just the app:** Test should FAIL when bug exists, PASS when fixed
2. **Use streamlit's utilities:** Import helpers from `e2e_playwright/shared/app_utils.py`
3. **Wait properly:** Use `wait_for_app_run()` after interactions that trigger reruns
4. **Stable selectors:** Use `get_by_test_id`, role, or text over CSS selectors
5. **Document clearly:** Comments should explain expected vs actual behavior
6. **Keep it minimal:** Only include code necessary to reproduce the bug
7. **Test workarounds:** If a workaround exists, test it separately
8. **Iterate quickly:** Use `make debug-e2e-test` to see browser and debug

## Notes

- Visual/subjective issues need manual verification apps instead of playwright
- Tests should be deterministic - same result every run
- Document any flakiness or environment dependencies
- The test serves as developer documentation, not just validation

**Next:** `create-repro-app.md` for visual verification
