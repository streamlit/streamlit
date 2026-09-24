# Analyze Issue Details

## Mission

Perform a deep analysis of a GitHub issue, gather all relevant details, assess reproducibility, and create technical notes. Determine if enough information exists to proceed with reproduction, or if more details are needed from the reporter.

**Type:** Pure command - can run standalone or as part of the orchestrated pipeline.

**Scope:** This command focuses on technical analysis and reproducibility assessment. Priority assignment happens separately via `prioritize-bug.md`. Feature/area labels are added via `add-feature-labels.md`.

## Prerequisites

- GitHub CLI (`gh`) is installed and authenticated
- Issue number to analyze
- Access to both `streamlit/streamlit` and `streamlit/st-issues` repositories

## Workflow

### Step 1: Gather Issue Details

Fetch all information about the issue:

```bash
gh issue view <ISSUE_NUMBER> --repo streamlit/streamlit --json number,title,body,comments,labels,createdAt,updatedAt,author,milestone
```

### Step 2: Initial Classification

Using the fetched details, determine how to classify this issue.

#### Filter Out Non-Reproducible Issues

**Skip reproduction and note recommendation if:**

- ❌ **Feature requests** (not bugs)

  - Recommendation: Relabel as `type:enhancement`

- ❌ **Questions** (should be on forum/Discord)

  - Recommendation: Redirect to community forum

- ❌ **Already has reproduction**

  - Check for st-issues link in body
  - Check if folder exists: `st-issues/issues/gh-<NUMBER>/`

- ❌ **Duplicate of existing issue**
  - Search for similar/related issues

**Proceed with analysis for:**

- ✅ Bug reports
- ✅ Unexpected behavior reports
- ✅ Regressions
- ✅ Error/exception reports
- ✅ Any issue labeled with bug-related labels

### Step 3: Perform Technical Analysis

Analyze the issue across multiple dimensions:

#### 3.1: Issue Classification

**Type:**

- Bug (unexpected behavior)
- Regression (worked before, broken now)
- Error/Exception (crashes or exceptions)
- Performance (slow, memory leak)
- Visual/UI Issue (styling, layout)

**Affected Component:**

- Widget (specific widget name)
- Layout (columns, containers, sidebar)
- State (session_state, caching)
- Data Display (dataframe, chart)
- Navigation (pages, fragments)
- Configuration (config options)

**Reproducibility Assessment:**

- Easily Reproducible: Clear steps, code provided
- Likely Reproducible: Good description, can infer code
- Needs More Info: Missing critical details
- Cannot Reproduce: Too vague or insufficient information

#### 3.2: Context Extraction

Extract and document:

1. **Code Examples:** Any code snippets from issue body or comments
2. **Steps to Reproduce:** Explicit or implied steps
3. **Expected Behavior:** What should happen
4. **Actual Behavior:** What actually happens
5. **Environment:**
   - Streamlit version
   - Python version
   - Operating system
   - Browser (if relevant)
6. **Error Messages:** Stack traces or error text
7. **Related Issues:** Links to similar issues
8. **Workarounds:** Any known workarounds from comments

### Step 4: Create NOTES.md in st-issues

Create a folder and NOTES.md file for technical documentation:

```bash
# From st-issues repo
mkdir -p issues/gh-<ISSUE_NUMBER>
```

**NOTES.md Template:**

```markdown
# Issue #<ISSUE_NUMBER> Analysis

**Issue URL:** https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>
**Analysis Date:** YYYY-MM-DD
**Analyst:** AI Agent

## Issue Summary

**Title:** <Issue Title>

**Type:** [Bug/Regression/Error/Performance/Visual]

**Component:** [Widget name/Area]

**Severity:** [High/Medium/Low]

**Reported Version:** <Streamlit version if mentioned>

## Problem Description

<Brief description of the issue in your own words>

## Reproduction Details

### Code Examples

<Copy relevant code snippets from the issue>

### Steps to Reproduce

1. <Step 1>
2. <Step 2>
3. <Step 3>

### Expected Behavior

<What should happen>

### Actual Behavior

<What actually happens>

## Environment

- **Streamlit:** <version or "not specified">
- **Python:** <version or "not specified">
- **OS:** <operating system or "not specified">
- **Browser:** <browser or "not specified">

## Error Messages

<Copy any error messages or stack traces>

## Analysis

### Root Cause Hypothesis

<Your analysis of what might be causing the issue>

### Related Code Areas

<If known, reference relevant parts of streamlit codebase>

### Related Issues

<Links to similar or duplicate issues>

## Reproducibility Assessment

**Can Reproduce:** [Yes/Likely/Needs More Info/No]

**Confidence:** [High/Medium/Low]

**Reasoning:** <Why you think this can/cannot be reproduced>

## Expected vs Bug Assessment

**Reference:** See `expected-vs-bug-assessment.md` for detailed decision framework.

**Assessment:** [Bug / Expected Behavior / Needs Team Decision]

**Confidence:** [High / Medium / Low]

**Reasoning:**

1. <Key factor from assessment>
2. <Reference to pattern in guide if applicable>

**Team Consultation Needed:** [Yes / No]

## Missing Information

<List any critical information that's missing, if applicable>

## Playwright Test Recommendation

**Should Attempt Playwright Test:** [Yes - DEFAULT / Skip only if purely visual/subjective]

**Reasoning:**

- <Why playwright test will or won't provide value>
- Note: Even if test doesn't reveal bug, the attempt provides useful information to team

**Test Approach:**
<Describe how you would test this - what interactions to verify>

## Workarounds

<Any known workarounds from the issue thread or your analysis>

## Next Steps

- [ ] **DEFAULT:** Create playwright test (use `create-playwright-test.md`) - Always attempt unless clearly visual/subjective
- [ ] Create visual repro app (use `create-repro-app.md`)
- [ ] Request more information (if needed)

## Notes for Future AI Agents

<Any insights, gotchas, or learnings that would help other agents>
```

### Step 5: Assess Information Completeness

Determine if enough information exists to proceed:

**Sufficient Information:**

- Has code example OR clear description
- Expected vs actual behavior is clear
- Can infer reasonable reproduction steps
- Environment details present (or irrelevant)

**Insufficient Information - Request More Details:**

- No code example and vague description
- Cannot determine expected behavior
- Missing critical version information (for regressions)
- Steps are unclear or incomplete

## Decision Framework

### When You Can Proceed with Reproduction

✅ **Proceed if:**

- Code example provided
- OR description is clear enough to infer code
- Expected vs actual behavior is documented
- Can create a minimal reproduction

✅ **Proceed with assumptions if:**

- Most details present, minor gaps can be inferred
- Similar issues provide context
- Document your assumptions in NOTES.md

### When to Request More Information

❌ **Request info if:**

- No code and vague description ("widget doesn't work")
- Cannot determine what the bug actually is
- Missing critical version info for regression
- Multiple possible interpretations

❌ **Request info AND skip reproduction if:**

- Reporter provided no useful details
- Issue appears to be user error but unclear
- Need fundamental clarification before proceeding

## Output Summary

At the end of analysis, provide a summary:

```markdown
## Analysis Summary for Issue #<ISSUE_NUMBER>

**Issue:** <Title>

**Type:** <Bug type>

**Assessment:** [Can Reproduce / Needs More Info / Not a Bug]

**Files Created:**

- ✅ `st-issues/issues/gh-<ISSUE_NUMBER>/NOTES.md`

**Next Command:**

- **DEFAULT:** Use `create-playwright-test.md` (always attempt playwright test first)
- **Only if needs more info:** Use `request-more-info.md`
- **Only if clearly visual/subjective:** Skip to `create-repro-app.md`
- **If not a bug:** Note recommendation for team

**Key Insights:**

- <Important finding 1>
- <Important finding 2>

**Playwright Attempt Recommended:** [Yes - DEFAULT / Skip only if purely visual]
**Reasoning:** <Why playwright will/won't provide value>
```

## Best Practices

1. **Be thorough but concise:** NOTES.md should be comprehensive but readable
2. **Document assumptions:** If you infer anything, document it clearly
3. **Link related issues:** Reference similar bugs for context
4. **Think about testing:** Consider early how you'd test this
5. **Preserve original details:** Quote relevant parts of the issue
6. **Stay objective:** Don't assume intent, stick to facts
7. **Identify patterns:** Note if this is similar to known issues

## Notes

- Focus on analysis and reproducibility; priority assignment happens in `prioritize-bug.md`
- NOTES.md is for technical details; GitHub comments should be user-friendly
- For non-bug issues (feature requests, questions), note recommendations for team action
- If uncertain, prefer requesting more information over guessing

**Next:**

- **Default:** `create-playwright-test.md` (attempt playwright test - provides valuable info even if it doesn't reveal bug)
- **Only skip playwright if:** Clearly visual/subjective issue (colors, animations, "looks wrong")
- If skipping playwright, go directly to `create-repro-app.md`
