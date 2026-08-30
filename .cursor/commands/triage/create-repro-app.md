# Create Reproduction App

## Mission

Design and create a user-friendly Streamlit app that demonstrates the reported bug for manual verification by the Streamlit team and issue reporters. This visual app complements playwright tests by providing an interactive demonstration of the issue.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**⚠️ IMPORTANT:** This command includes committing and pushing to st-issues to trigger deployment. The app won't be accessible until you push to the repository.

## Prerequisites

- (Recommended) Playwright test has been created via `create-playwright-test.md`
- Access to `streamlit/st-issues` repository

## When to Create a Visual Repro App

**Always create for:**

- ✅ Visual/styling issues that need human judgment
- ✅ Layout problems (alignment, spacing, responsive behavior)
- ✅ Issues that are obvious when you see them
- ✅ Animation or transition issues
- ✅ Browser-specific rendering problems
- ✅ Any issue where manual verification is valuable

**Complements playwright test:**

- Both playwright test AND visual app provide different verification methods
- Playwright proves it programmatically
- Visual app lets humans see and interact with the bug

## Workflow

### Step 1: Design the Reproduction App

Plan the app to clearly demonstrate the issue:

**App Goals:**

1. **Immediately runnable:** No setup required, all code self-contained
2. **Bug is obvious:** Visual indicators make the problem clear
3. **Shows contrast:** Include working vs broken examples when possible
4. **Well documented:** Comments and st.write() explain what's happening
5. **Includes workarounds:** Show workaround if one exists
6. **Links to issue:** Direct link back to GitHub issue

### Step 2: Create app.py in st-issues

If you already have `app.py` from playwright testing, update it for visual clarity. Otherwise, create from scratch:

```bash
# From st-issues repo
mkdir -p issues/gh-<ISSUE_NUMBER>
cd issues/gh-<ISSUE_NUMBER>
```

**Visual Reproduction App Template:**

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

Reported Version: <Streamlit version from issue>
"""

import streamlit as st

# === HEADER ===
st.title(f"Issue #{<ISSUE_NUMBER>}: <Short Title>")

st.info("🔗 [View original issue](https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>)")

# === ISSUE OVERVIEW ===
st.header("Issue Overview")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Expected Behavior")
    st.write("<What should happen>")

with col2:
    st.subheader("Actual Behavior (Bug)")
    st.error("<What actually happens - highlight this is the bug>")

st.divider()

# === REPRODUCTION ===
st.header("🐛 Bug Demonstration")

st.write("""
Instructions for testing:
1. <Step 1>
2. <Step 2>
3. <Observe the bug>
""")

# Your minimal reproduction code here
# Use st.error() or st.warning() to highlight the problematic behavior

# === COMPARISON (if applicable) ===
st.divider()

st.header("📊 Comparison: Bug vs Expected")

# IMPORTANT: Keep comparison simple - don't use columns, containers, or other
# layout elements that might interfere with reproducing the bug!

st.subheader("Buggy Behavior")
# Code that demonstrates the bug
st.write("Run the code that triggers the bug")
# Add st.error() to highlight the problem

st.divider()

st.subheader("Expected Behavior")
# Code that shows what should happen (if possible to demonstrate)
st.write("Show what should happen instead")
# Add st.success() to show correct behavior

# === WORKAROUND (if exists) ===
st.divider()

st.header("✅ Workaround")

# IMPORTANT: Don't use st.expander or other containers for workarounds
# as they may affect the reproduction behavior!

st.write("<Description of workaround>")

st.code("""
# Workaround code example
<code>
""", language="python")

# Demonstrate workaround working
st.write("Workaround in action:")
# <working code>

# === ENVIRONMENT INFO ===
st.divider()

st.header("Environment Info")

st.code(f"""
Streamlit version: {st.__version__}
Python version: <version if relevant>
OS: <if relevant>
Browser: <if relevant>
""")

# === TECHNICAL DETAILS ===
st.divider()

st.header("Technical Details")

st.write("""
**Affected Component:** <Widget/Feature name>

**Regression:** [Yes/No - worked in version X.Y.Z]

**Related Issues:** <Links to related issues if any>
""")

with st.expander("View Error Messages/Stack Traces", expanded=False):
    if "<error messages exist>":
        st.code("""
<Error message or stack trace>
""")
    else:
        st.write("No error messages - bug is visual/behavioral")
```

### Step 3: Add Visual Indicators

Make the bug impossible to miss:

**Use Streamlit components to highlight issues:**

```python
# Highlight problematic behavior
st.error("❌ BUG: Widget value is empty when it should show 'Default Value'")

# Show expected behavior
st.success("✅ EXPECTED: Widget should display 'Default Value' here")

# Call attention to specific elements
st.warning("⚠️ Notice: The dialog starts scrolled to the bottom instead of top")

# Mark broken functionality
# IMPORTANT: Don't use containers/columns in core examples - they may affect reproduction
st.write("🐛 **Broken Example:**")
# buggy code

st.divider()

st.write("✅ **Expected Example:**")
# what should happen
```

### Step 4: Include Contrasting Cases

Show both buggy and working scenarios when possible.

**⚠️ Important:** Avoid using columns, containers, expanders, or other layout elements in comparisons as they may interfere with reproducing the bug. Keep it simple and linear.

**Pattern: Sequential Comparison (Recommended)**

```python
st.subheader("Comparison: Bug vs Workaround")

st.write("**Without Fix (Bug):**")
# Code that exhibits the bug
# Add st.error() to point out the problem

st.divider()

st.write("**With Workaround:**")
# Code with workaround applied
# Add st.success() to show it working
```

**Pattern: Before/After States**

```python
st.write("**Step 1:** Initial state (works correctly)")
# Show initial working state

st.button("Trigger Bug", key="trigger")

st.write("**Step 2:** After interaction (bug appears)")
# Show buggy state after interaction
st.error("❌ Notice: The value disappeared when it shouldn't have")
```

### Step 5: Add Requirements if Needed

If your app requires specific packages:

```bash
# In st-issues/issues/gh-<ISSUE_NUMBER>/
cat > requirements.txt << 'EOF'
pandas==2.0.0
numpy>=1.24.0
plotly>=5.0.0
EOF
```

Only include packages NOT in streamlit's base environment.

### Step 6: Validate the App

Before pushing, perform automated validation:

```bash
# From st-issues repo
cd issues/gh-<ISSUE_NUMBER>

# Check Python syntax
python -m py_compile app.py

# Check for common issues
# - Missing imports
# - Syntax errors
# - Invalid issue number in URLs
```

**Note for AI Agents:** You cannot run the streamlit app locally with a browser. Focus on:

- ✅ Syntax validation (py_compile)
- ✅ Code review for obvious issues
- ✅ Verify all placeholders are filled in
- ✅ Check links are correct

**Note for Team Members:** Manual verification happens after deployment before posting confirmation via `confirm-bug.md`.

### Step 7: Update NOTES.md

Add app details to NOTES.md:

```markdown
## Visual Reproduction App

**File:** `app.py`

**Created:** YYYY-MM-DD

**Purpose:** Visual demonstration of issue #<ISSUE_NUMBER> for manual verification

**App Features:**

- ✅ Demonstrates bug clearly with visual indicators
- ✅ Includes side-by-side comparison of bug vs expected behavior
- ✅ Shows workaround (if applicable)
- ✅ Links to original issue
- ✅ Self-contained and immediately runnable

**Testing Notes:**
<Any specific things to look for when testing the app>

**Deploy URL:** https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>
(Available after deployment)
```

### Step 8: Commit and Push to st-issues

**⚠️ CRITICAL:** The app must be pushed to trigger deployment to issues.streamlit.app

```bash
# From st-issues repo
cd /path/to/st-issues

# Verify you're in the right repo
git remote -v  # Should show streamlit/st-issues

# Stage all files for the issue
git add issues/gh-<ISSUE_NUMBER>/

# Verify what will be committed
git status

# Commit with descriptive message
git commit -m "Add reproduction for issue #<ISSUE_NUMBER>: <Brief Title>"

# Or if playwright test is included:
# git commit -m "Add reproduction with playwright test for issue #<ISSUE_NUMBER>: <Brief Title>"

# Push to trigger deployment
git push origin main
```

**After pushing:**

- Deployment typically takes 2-5 minutes
- App will be available at: https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>
- Refresh the issues.streamlit.app page to see the new issue in the explorer

**⚠️ Team Verification Required:** A team member must manually verify the deployed app before posting confirmation to GitHub.

## App Design Best Practices

### Do's ✅

1. **Keep it minimal:** Only code necessary to show the bug
2. **Keep it simple:** Avoid layout elements (columns, containers) that might affect reproduction
3. **Make it obvious:** Use visual indicators (st.error, st.success, st.warning)
4. **Show contrast:** Bug vs expected, or bug vs workaround (sequentially, not side-by-side)
5. **Add instructions:** Tell users exactly what to look for
6. **Link everything:** Link to issue, related issues, documentation
7. **Include environment:** Show versions and configuration
8. **Self-contained:** No external files or setup required
9. **Validate syntax:** Always check with py_compile before pushing

### Don'ts ❌

1. **Don't overcomplicate:** If 10 lines reproduces it, don't use 100
2. **Don't use elaborate layouts:** Avoid columns, containers, expanders in the core reproduction as they may affect the bug behavior
3. **Don't assume knowledge:** Explain what the bug is
4. **Don't hide the bug:** Make it impossible to miss
5. **Don't forget dependencies:** Include requirements.txt if needed
6. **Don't use real data:** Use fake/example data only
7. **Don't reproduce multiple issues:** One issue per app
8. **Don't skip documentation:** Always include docstring and comments

## Common App Patterns

### Pattern 1: Widget State Issue

```python
st.header("Widget State Bug")

st.write("**Test:** Enter text, click button, observe value")

if "counter" not in st.session_state:
    st.session_state.counter = 0

text_value = st.text_input("Enter text", key="text")

if st.button("Trigger Rerun"):
    st.session_state.counter += 1

st.write(f"Rerun count: {st.session_state.counter}")

# Highlight the bug
if not text_value and st.session_state.counter > 0:
    st.error("❌ BUG: Text value disappeared after rerun!")
else:
    st.success(f"✅ Text value: {text_value}")
```

### Pattern 2: Visual/Layout Issue

```python
st.header("Layout Bug")

st.write("**Expected:** Elements should be aligned horizontally")
st.write("**Actual:** Elements stack vertically (bug)")

st.error("❌ Notice the misalignment below:")

# Code that demonstrates layout bug
col1, col2, col3 = st.columns(3)
# ... buggy layout code
```

### Pattern 3: Error/Exception Issue

```python
st.header("Error Reproduction")

st.write("Click the button to trigger the error:")

if st.button("Trigger Error"):
    try:
        # Code that causes the error
        st.error("❌ Error will appear below:")
        # ... buggy code ...
    except Exception as e:
        st.exception(e)
        st.write("**This is the bug** - this error should not occur")
```

## Output Summary

At completion:

```markdown
## Visual Reproduction App Summary for Issue #<ISSUE_NUMBER>

**App Created:** ✅
**Validated:** ✅ (syntax checked)
**Committed:** ✅
**Pushed:** ✅

**Files in st-issues:**

- `issues/gh-<ISSUE_NUMBER>/app.py` (visual reproduction)
- `issues/gh-<ISSUE_NUMBER>/app_test.py` (playwright test, if created)
- `issues/gh-<ISSUE_NUMBER>/NOTES.md` (updated with app details)
- `issues/gh-<ISSUE_NUMBER>/requirements.txt` (if needed)

**Deployment:**

- URL: https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>
- Status: Pending (2-5 minutes after push)

**Next Steps:**

1. ⏱️ Wait 2-5 minutes for automatic deployment
2. 👁️ Team member manually verifies deployed app
3. 💬 Post to GitHub using appropriate command:
   - `confirm-bug.md` (if bug confirmed)
   - `request-team-decision.md` (if unclear)
   - `report-cannot-reproduce.md` (if cannot reproduce)
```

## Notes

- **MUST commit and push** to st-issues for deployment to happen (see Step 8)
- Visual apps should be self-explanatory - anyone should understand the bug without context
- Avoid elaborate layouts (columns, containers, expanders) in core reproduction - they may interfere with the bug
- Always validate syntax before pushing; team verifies in browser after deployment
- App will be publicly accessible at issues.streamlit.app
- Deployment is automatic but takes 2-5 minutes after push

**Next:** Appropriate Phase 3 command after team verification
