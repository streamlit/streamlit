# Analyze Root Cause

## Overview

Perform deep root cause analysis of a bug using gathered context and codebase investigation.

## Purpose

This command takes comprehensive bug context and conducts systematic analysis to identify the most likely root cause of a user-reported problem. It focuses on **identifying the root cause with high confidence** rather than proposing fixes at this stage.

**Previous Step:** `gather-bug-context.md` (gathers all context)
**Next Step:** `create-fix-pr.md` (implements the fix)

---

## Prerequisites

- [ ] Bug context gathered (from `gather-bug-context.md`)
- [ ] Context document exists at `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md`
- [ ] Access to Streamlit codebase

---

## Input

**Provide the issue number you want to analyze:**

```
Example: 12345
```

**The command will:**

1. Check for existing context document
2. If not found, prompt to run `gather-bug-context.md` first
3. Read context and proceed with analysis

---

## Step 1: Load Context

### Read Gathered Context

```bash
# Check if context exists
if [ -f "agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md" ]; then
  cat agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md
else
  echo "Context not found. Please run gather-bug-context.md first."
  exit 1
fi
```

### Verify Completeness

Ensure the context document contains:

- ✅ Problem description
- ✅ Reproduction steps
- ✅ Environment details
- ✅ Error messages or symptoms
- ✅ Comments reviewed
- ✅ Related context from journals/reproduction notes

If context is incomplete, return to `gather-bug-context.md` to fill gaps.

---

## Step 2: Identify Components

Based on the context, identify the specific Streamlit components involved.

### Component Identification Checklist

**From issue content:**

- API calls mentioned (e.g., `st.dataframe`, `st.button`, `st.sidebar`)
- Features discussed (e.g., caching, state, layouts)
- File paths or module names mentioned

**From error messages:**

- Stack traces showing which modules are involved
- Error types that indicate specific subsystems

**From symptoms:**

- Rendering issues → frontend components
- State issues → session state / script runner
- Performance issues → caching / runtime

### Map to Codebase

For each component identified, locate the relevant code:

```bash
# Find component implementation
find lib/streamlit -name "*dataframe*" -type f

# Search for specific functionality
grep -r "function_name" lib/streamlit/

# Check frontend code if needed
find frontend/lib/src -name "*DataGrid*" -type f
```

Document which files and modules are likely involved.

---

## Step 3: Analyze Code Paths

For each component identified, trace the code path that's likely being triggered.

### Code Analysis Process

1. **Entry Point:** Where does the user's code interact with Streamlit?
2. **Data Flow:** How does data flow through the system?
3. **State Changes:** What state is being modified?
4. **Side Effects:** What side effects occur?
5. **Output:** How does it reach the user's app?

### Look For

- **Edge cases not handled:** Null checks, empty arrays, type assumptions
- **State management issues:** Race conditions, stale state, missing invalidation
- **Browser compatibility:** Features not supported in specific browsers
- **Version-specific behavior:** Code changed between versions
- **Configuration dependencies:** Flags or settings that affect behavior

### Document Findings

For each code path examined:

- File path and line numbers
- Key functions or classes involved
- Logic flow and decision points
- Potential problem areas identified

---

## Step 4: Formulate Hypotheses

Based on code analysis, develop multiple hypotheses for the root cause.

### Hypothesis Template

For each hypothesis:

```markdown
### Hypothesis X: [Brief description]

**Evidence Supporting:**

- [Evidence point 1]
- [Evidence point 2]

**Evidence Against:**

- [Counter-evidence 1]
- [Counter-evidence 2]

**Confidence Level:** Low / Medium / High

**How to Test:**

- [Test approach 1]
- [Test approach 2]
```

### Evaluate Hypotheses

Compare hypotheses against:

- Observed symptoms
- Error messages
- User environment
- Code logic
- Git history

Rank hypotheses by likelihood.

---

## Step 5: Review Git History

Check if recent changes might have introduced the bug.

### Search for Relevant Changes

```bash
# Find recent changes to affected files
git log --since="6 months ago" --oneline -- lib/streamlit/path/to/file.py

# Search for changes related to specific functionality
git log --since="6 months ago" --grep="dataframe\|DataFrame" --oneline

# Show full commit details
git show <commit-hash>

# Check when a specific line was last changed
git blame lib/streamlit/path/to/file.py -L <line_start>,<line_end>
```

### Look For

- Recent refactorings
- New features that might have introduced regression
- Bug fixes that might have caused new issues
- Dependency updates
- Configuration changes

### Document Findings

- Commit hashes of relevant changes
- What changed and when
- Whether changes correlate with user's Streamlit version
- Potential relationship to observed bug

---

## Debugging Process

**Before providing your final analysis**, work through your debugging process inside `<debugging_process>` tags within your thinking block.

### Thinking Block Structure

Use the following format as a guide:

```
<debugging_process>
- Key Symptoms and Behaviors:
    List out the symptoms and behaviors from the context.

- Potential Code Paths:
    Identify specific code paths that could lead to these symptoms.
    Map entry points to outputs.

- Hypotheses:
    Consider multiple hypotheses for the root cause.
    Hypothesis 1: [Description]
    Hypothesis 2: [Description]
    Hypothesis 3: [Description]

- Evidence Evaluation:
    Evaluate each hypothesis based on available evidence.
    Which hypothesis best explains all observed symptoms?
    Which has the most supporting evidence from code/git history?

- Confidence Assessment:
    How confident are we in the top hypothesis?
    What would increase confidence?
    What additional testing is needed?
</debugging_process>
```

**This is where you should:**

- Consider multiple pieces of evidence
- Explore different possibilities
- Demonstrate "ultrathinking" about what could be causing the issue
- **Do not jump to conclusions prematurely**
- Build a comprehensive understanding before synthesizing findings

**It's OK for this section to be quite long.** Thoroughness is more important than brevity.

---

## Step 6: Final Analysis Structure

Your final output should be structured as follows:

### 1. Initial Assessment

Summary of the issue and key observations from the context.

### 2. Component Identification

Which parts of Streamlit are involved and why.

### 3. Code Analysis

Specific code paths and logic examined, with file references and line numbers where appropriate.

### 4. Root Cause Determination

Most likely root cause(s) with supporting evidence:

- Why this explanation fits the symptoms
- What code logic leads to the behavior
- How it accounts for the error messages
- Why it happens in specific environments

### 5. Contributing Factors

Additional factors that may influence or exacerbate the issue.

### 6. Git History Insights

Recent changes that may have introduced the bug or provide context.

### 7. Conclusion

- Summary of findings
- Confidence level (Low/Medium/High)
- What would increase confidence
- Recommended verification steps

**Note:** Your final output should consist only of the structured analysis and should not duplicate or rehash any of the work you did in the debugging process thinking block.

---

## Step 7: Save Analysis

Save your analysis to the notes directory.

---

## Step 8: Save Analysis Document

**Analysis Document Location:**

```bash
# Save to bug analysis directory
agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md
```

### Analysis Template

````markdown
# Root Cause Analysis: Issue #<ISSUE_NUMBER>

**Issue Title:** <Title>
**Analysis Date:** <YYYY-MM-DD>
**Analyst:** <Your name or "AI Agent">
**Issue URL:** https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>
**Context Document:** `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-context.md`

---

## Summary

[1-2 paragraph executive summary of the root cause and key findings]

**Confidence Level:** [Low / Medium / High]

---

## 1. Initial Assessment

[Summary of the issue based on gathered context]

### Key Observations

- [Observation 1]
- [Observation 2]
- [Observation 3]

---

## 2. Component Identification

### Primary Components

- **Component 1:** `lib/streamlit/path/to/file.py`

  - Why involved: [Explanation]

- **Component 2:** `frontend/lib/src/path/to/file.tsx`
  - Why involved: [Explanation]

### Supporting Components

- [Other components that play a role]

---

## 3. Code Analysis

### Code Path 1: [Description]

**File:** `lib/streamlit/path/to/file.py`
**Lines:** X-Y

**Logic Flow:**

1. [Step 1 in flow]
2. [Step 2 in flow]
3. [Step 3 in flow]

**Problem Area:**
[Description of problematic logic]

**Code Reference:**

```python
[Relevant code snippet]
```
````

### Code Path 2: [Description]

[Similar structure]

---

## 4. Root Cause Determination

### Primary Root Cause

**Cause:** [Brief description]

**Explanation:**

[Detailed explanation of what's causing the bug]

**Supporting Evidence:**

1. **Symptom Match:** [How this explains the observed symptoms]
2. **Error Message Correlation:** [How this explains the error messages]
3. **Code Logic:** [How the code logic leads to this behavior]
4. **Environment Factors:** [How environment affects this]

**Why Other Hypotheses Were Rejected:**

- **Hypothesis X:** [Why this doesn't fully explain the issue]
- **Hypothesis Y:** [Why this doesn't fully explain the issue]

---

## 5. Contributing Factors

### Factor 1: [Description]

[How this factor contributes or exacerbates the issue]

### Factor 2: [Description]

[How this factor contributes or exacerbates the issue]

---

## 6. Git History Insights

### Relevant Commits

**Commit:** `<hash>` - [Date]
**Author:** [Name]
**Summary:** [Commit message]
**Relevance:** [How this relates to the bug]

### Timeline

- **[Date]:** [Event - e.g., feature added]
- **[Date]:** [Event - e.g., refactoring]
- **[Date]:** [Event - e.g., bug reported]

### Regression Analysis

[Whether this appears to be a regression, and if so, from which change]

---

## 7. Conclusion

### Summary of Findings

[Concise summary of the root cause]

### Confidence Level

**Overall Confidence:** [Low / Medium / High]

**Reasoning:**

- [Why this confidence level]

**What Would Increase Confidence:**

- [ ] [Additional test or verification]
- [ ] [Additional code review]
- [ ] [Team member confirmation]

### Recommended Verification Steps

1. [Step to verify the root cause]
2. [Step to test the hypothesis]
3. [Step to confirm the fix approach]

---

## Additional Context Referenced

- [x] Context Document: `gh-<ISSUE_NUMBER>-context.md`
- [x] GitHub Issue and Comments
- [x] Codebase Analysis: [Files examined]
- [x] Git History: [Commits reviewed]
- [ ] Team Discussion: [If applicable]

---

## Recommended Next Steps

### Immediate Actions

1. [Next action - e.g., verify hypothesis with test]
2. [Next action - e.g., discuss with team]

### Fix Implementation

**If ready to proceed:**

- Use `create-fix-pr.md` to implement the fix

**If more investigation needed:**

- [What additional investigation is needed]
- [Who to consult]

### Testing Strategy

[How to test the fix once implemented]

---

## Notes

[Any additional notes, caveats, or considerations]

---

**Status:** [Draft / Ready for Review / Confirmed]

**Last Updated:** <YYYY-MM-DD>

````

### Save Command

```bash
# Save your analysis
cat > agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md << 'EOF'
[Your formatted analysis following the template above]
EOF
````

---

## Success Criteria

Analysis is complete when you have:

- ✅ Read and understood the gathered context
- ✅ Identified all relevant components
- ✅ Analyzed code paths thoroughly
- ✅ Formulated and evaluated multiple hypotheses
- ✅ Reviewed git history for relevant changes
- ✅ Determined most likely root cause
- ✅ Assessed confidence level
- ✅ Saved analysis document

---

## Next Commands

**After completing analysis:**

- **High confidence:** Proceed to `create-fix-pr.md` to implement fix
- **Medium confidence:** Discuss with team or verify hypothesis first
- **Low confidence:** Gather more information or create test to verify
- **Share analysis** - Send to team for review
- **Create GitHub comment** - Summarize findings publicly

**If using start-bug-fix.md workflow:** Return to that command for journal update instructions and next steps.

---

## Example Workflow

```bash
# 1. Load context
cat agent-knowledge/local/notes/bug-analysis/gh-12345-context.md

# 2. Analyze codebase
# [Use this command → analyze-root-cause.md]

# 3. Save analysis
ls agent-knowledge/local/notes/bug-analysis/gh-12345-root-cause.md

# 4. Review analysis
cat agent-knowledge/local/notes/bug-analysis/gh-12345-root-cause.md

# 5. Proceed to fix
# Use → create-fix-pr.md
```

---

**Remember: The goal is to identify the root cause with confidence, not to propose a fix. Thorough analysis leads to better fixes.**
