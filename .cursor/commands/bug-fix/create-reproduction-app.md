# Create Reproduction App

## Overview

Design and create a user-friendly Streamlit app that visually demonstrates a bug for manual verification and team collaboration.

## Purpose

This command helps you create a visual, interactive demonstration of a bug that:

- Makes the bug obvious and easy to see
- Provides contrast (bug vs expected behavior)
- Can be shared with team members
- Serves as documentation of the issue
- Complements automated tests

**This is a pure tool** - creates the reproduction app, no journal updates. Use standalone or as part of the bug fix pipeline.

---

## Prerequisites

- [ ] Issue number or bug description
- [ ] Understanding of reproduction steps
- [ ] Access to `streamlit/st-issues` repository (for deployment)

**Optional but helpful:**

- Context document from `gather-bug-context.md`
- Root cause analysis from `analyze-root-cause.md`

---

## Input

**Provide the issue number:**

```
Example: 12345
```

**And reproduction details:**

- Steps to reproduce
- Expected vs actual behavior
- Environment details (Streamlit version, OS, browser if relevant)

---

## When to Create a Reproduction App

**Always create for:**

- ✅ Visual/styling issues needing human judgment
- ✅ Layout problems (alignment, spacing, responsive behavior)
- ✅ Issues that are obvious when you see them
- ✅ Animation or transition issues
- ✅ Browser-specific rendering problems
- ✅ Complex interactions hard to describe in text

**Complements automated tests:**

- Automated tests prove it programmatically
- Visual app lets humans see and interact
- Both together provide complete verification

---

## Step 1: Design the Reproduction App

Plan the app to clearly demonstrate the issue:

**App Goals:**

1. **Immediately runnable** - No setup required, all code self-contained
2. **Bug is obvious** - Visual indicators make the problem clear
3. **Shows contrast** - Include working vs broken examples when possible
4. **Well documented** - Comments and `st.write()` explain what's happening
5. **Includes workarounds** - Show workaround if one exists
6. **Links to issue** - Direct link back to GitHub issue

---

## Step 2: Create app.py

Create the visual reproduction app in the st-issues repository:

```bash
# From st-issues repo
mkdir -p issues/gh-<ISSUE_NUMBER>
cd issues/gh-<ISSUE_NUMBER>
```

### Visual Reproduction App Template

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

# IMPORTANT: Keep comparison simple - use sequential layout
# Avoid columns/containers in core reproduction

st.subheader("Buggy Behavior")
# Code that demonstrates the bug
st.write("Run the code that triggers the bug")
# Add st.error() to highlight the problem

st.divider()

st.subheader("Expected Behavior")
# Code that shows what should happen (if possible)
st.write("Show what should happen instead")
# Add st.success() to show correct behavior

# === WORKAROUND (if exists) ===
st.divider()

st.header("✅ Workaround")

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

---

## Step 3: Add Visual Indicators

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
st.write("🐛 **Broken Example:**")
# buggy code

st.divider()

st.write("✅ **Expected Example:**")
# what should happen
```

---

## Step 4: Include Contrasting Cases

Show both buggy and working scenarios when possible.

**⚠️ Important:** Avoid using columns, containers, expanders in comparisons as they may interfere with reproducing the bug. Keep it simple and sequential.

### Pattern: Sequential Comparison (Recommended)

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

### Pattern: Before/After States

```python
st.write("**Step 1:** Initial state (works correctly)")
# Show initial working state

st.button("Trigger Bug", key="trigger")

st.write("**Step 2:** After interaction (bug appears)")
# Show buggy state after interaction
st.error("❌ Notice: The value disappeared when it shouldn't have")
```

---

## Step 5: Add Requirements if Needed

If your app requires specific packages:

```bash
# In st-issues/issues/gh-<ISSUE_NUMBER>/
cat > requirements.txt << 'EOF'
pandas==2.0.0
numpy>=1.24.0
plotly>=5.0.0
EOF
```

Only include packages NOT in Streamlit's base environment.

---

## Step 6: Validate the App

Before pushing, perform automated validation:

```bash
# From st-issues repo
cd issues/gh-<ISSUE_NUMBER>

# Check Python syntax
python -m py_compile app.py

# Manual review checklist:
# - All placeholders filled in (<ISSUE_NUMBER>, <TITLE>, etc.)
# - Links are correct
# - Issue number matches throughout
# - No syntax errors
```

---

## Step 7: Deploy to st-issues

**⚠️ CRITICAL:** The app must be pushed to st-issues to trigger deployment.

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

# Push to trigger deployment
git push origin main
```

**After pushing:**

- Deployment typically takes 2-5 minutes
- App will be available at: `https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>`
- Refresh issues.streamlit.app to see the new issue in the explorer

---

## App Design Best Practices

### Do's ✅

1. **Keep it minimal** - Only code necessary to show the bug
2. **Keep it simple** - Avoid layout elements (columns, containers) that might affect reproduction
3. **Make it obvious** - Use visual indicators (`st.error`, `st.success`, `st.warning`)
4. **Show contrast** - Bug vs expected, or bug vs workaround (sequentially)
5. **Add instructions** - Tell users exactly what to look for
6. **Link everything** - Link to issue, related issues, documentation
7. **Include environment** - Show versions and configuration
8. **Self-contained** - No external files or setup required
9. **Validate syntax** - Always check with `py_compile` before pushing

### Don'ts ❌

1. **Don't overcomplicate** - If 10 lines reproduces it, don't use 100
2. **Don't use elaborate layouts** - Avoid columns, containers, expanders in core reproduction
3. **Don't assume knowledge** - Explain what the bug is
4. **Don't hide the bug** - Make it impossible to miss
5. **Don't forget dependencies** - Include `requirements.txt` if needed
6. **Don't use real data** - Use fake/example data only
7. **Don't reproduce multiple issues** - One issue per app
8. **Don't skip documentation** - Always include docstring and comments

---

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

---

## Success Criteria

Reproduction app is complete when:

- ✅ App demonstrates the bug clearly
- ✅ Visual indicators highlight the issue
- ✅ Reproduction steps are documented
- ✅ Comparison shows bug vs expected (if applicable)
- ✅ Workaround included (if exists)
- ✅ Environment info displayed
- ✅ Links to GitHub issue included
- ✅ Syntax validated (no errors)
- ✅ App deployed to st-issues

---

## Output

### Files Created

```
st-issues/issues/gh-<ISSUE_NUMBER>/
├── app.py                  # Visual reproduction app
└── requirements.txt        # (if needed) Package dependencies
```

### Deployment

**URL:** `https://issues.streamlit.app/?issue=gh-<ISSUE_NUMBER>`

**Available:** 2-5 minutes after pushing to st-issues

---

## Next Steps

**After creating reproduction app:**

**If used standalone:**

- Share app URL with team
- Post to GitHub issue (if appropriate)
- Use for manual verification

**If part of bug fix workflow:**

- Return to `start-bug-fix.md` for journal update instructions
- Continue with analysis or proposal steps
- Reference app in root cause analysis or fix proposal

**For team collaboration:**

- Share deployed app URL
- Discuss observations
- Verify bug is reproducible
- Get feedback on approach

---

## Integration with Bug Fix Pipeline

This command can be used at various points:

### Option 1: After Context Gathering

```
gather-bug-context.md
  ↓
create-reproduction-app.md  ← Create visual repro
  ↓
analyze-root-cause.md
```

**When:** Bug is visual or needs demonstration

### Option 2: After Root Cause Analysis

```
analyze-root-cause.md
  ↓
create-reproduction-app.md  ← Demonstrate root cause
  ↓
propose-fix-approach.md
```

**When:** Need to show team the issue before proposing fix

### Option 3: Standalone

```
create-reproduction-app.md  ← Just create visual demo
```

**When:** Quick reproduction needed for discussion

---

## Example Usage

### Example: Creating Repro for Layout Bug

```bash
# Issue #12345: st.columns misaligned on mobile

# 1. Create directory
mkdir -p st-issues/issues/gh-12345
cd st-issues/issues/gh-12345

# 2. Create app.py
# (Use template above, customize for layout bug)

# 3. Validate
python -m py_compile app.py

# 4. Commit and push
git add .
git commit -m "Add reproduction for issue #12345: st.columns mobile layout"
git push origin main

# 5. Wait for deployment
# App available at: https://issues.streamlit.app/?issue=gh-12345
```

---

## Tips

**For Visual Bugs:**

- Include screenshots in comments (if helpful)
- Use visual indicators (error/success/warning)
- Show multiple scenarios (different screen sizes, states)
- Make differences obvious

**For State Bugs:**

- Show before/after states
- Include interaction triggers (buttons, inputs)
- Display session state when relevant
- Mark unexpected behavior clearly

**For Error Bugs:**

- Use try/except to catch and display errors
- Show error messages prominently
- Include stack traces in expander
- Explain why error is unexpected

**For Performance Bugs:**

- Include timing information
- Show what's slow
- Compare fast vs slow scenarios
- Use st.write() to explain performance issue

---

**A good reproduction app = easier debugging + better team collaboration + clearer issue resolution!**
