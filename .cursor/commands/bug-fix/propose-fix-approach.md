# Propose Fix Approach

## Overview

Design a comprehensive fix implementation proposal based on root cause analysis.

## Purpose

This command helps you plan the fix before implementing it. It takes the root cause analysis and designs a complete solution approach including:

- Fix strategy and alternatives
- Implementation plan
- Testing approach
- Potential risks and mitigations
- Verification strategy

**Previous Step:** `analyze-root-cause.md` (determines root cause)
**Next Step:** Implementation (based on approved proposal)

---

## Prerequisites

- [ ] Root cause analysis completed
- [ ] Analysis document exists at `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md`
- [ ] High or medium confidence in root cause
- [ ] Understanding of affected components

---

## Input

**Provide the issue number:**

```
Example: 12345
```

**The command will:**

1. Load root cause analysis document
2. Review root cause findings
3. Design fix approach
4. Document implementation plan
5. Identify risks and testing strategy

---

## Step 1: Review Root Cause Analysis

Load and review the root cause analysis to understand what needs to be fixed.

### Read Analysis Document

```bash
# Load the analysis
cat agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md
```

### Extract Key Information

From the root cause analysis, identify:

**Root Cause:**

- What's causing the bug?
- Which components are affected?
- What code paths are involved?

**Confidence Level:**

- High → Proceed with fix design
- Medium → Consider additional verification first
- Low → May need more investigation before proposing fix

**Constraints:**

- Backward compatibility requirements
- Performance implications
- API surface changes
- Breaking change considerations

---

## Step 2: Design Fix Strategy

Develop the primary fix approach and consider alternatives.

### Primary Fix Approach

**Describe the main solution:**

- **What to change:** Which files, functions, classes
- **How to change it:** High-level approach
- **Why this approach:** Rationale for this solution
- **Complexity:** Simple, Moderate, or Complex

### Alternative Approaches

Consider at least 2-3 alternative approaches:

**Alternative 1:**

- Description
- Pros
- Cons
- Why not chosen (or why it might be better)

**Alternative 2:**

- Description
- Pros
- Cons
- Why not chosen

**Alternative 3:** (if applicable)

- Description
- Pros
- Cons
- Why not chosen

### Comparison Matrix

| Approach | Complexity | Backward Compat | Performance | Maintainability | Recommended |
| -------- | ---------- | --------------- | ----------- | --------------- | ----------- |
| Primary  | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ✅          |
| Alt 1    | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ❌          |
| Alt 2    | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ❌          |

---

## Step 3: Create Implementation Plan

Break down the fix into concrete implementation steps.

### Files to Modify

**Backend (Python):**

- `lib/streamlit/path/to/file.py`
  - Function: `function_name()`
  - Change: [What needs to change]
  - Lines: Approximately X-Y

**Frontend (TypeScript):**

- `frontend/lib/src/path/to/file.tsx`
  - Component: `ComponentName`
  - Change: [What needs to change]
  - Lines: Approximately X-Y

**Protobuf (if needed):**

- `proto/streamlit/proto/SomeProto.proto`
  - Field/Message: [What to add/modify]
  - Breaking: Yes/No

**Other:**

- [Any other files]

### Implementation Steps

Ordered list of implementation steps:

1. **[Backend/Frontend/Proto] - [Task]**

   - Detail what to do
   - Expected outcome

2. **[Component] - [Task]**

   - Detail what to do
   - Expected outcome

3. **[Integration] - [Task]**
   - Detail what to do
   - Expected outcome

### Backward Compatibility

**Breaking changes:**

- [ ] Yes - [Describe breaking changes]
- [ ] No - Fully backward compatible

**If breaking:**

- Migration path: [How users upgrade]
- Deprecation strategy: [Timeline and warnings]
- Documentation updates: [What needs updating]

**If non-breaking:**

- How compatibility is maintained: [Explanation]

---

## Step 4: Design Testing Strategy

Plan comprehensive testing to verify the fix.

### Unit Tests (Python)

**New tests to add:**

- Test file: `tests/streamlit/path/to/test_file.py`
- Test cases:
  1. Test that [specific behavior] works
  2. Test edge case: [edge case]
  3. Test regression: [what should still work]

**Test approach:**

```python
# Example test structure
def test_fix_for_issue_XXXXX():
    """Test that gh-XXXXX is fixed."""
    # Setup
    # Exercise
    # Verify
    # Teardown
```

### Frontend Tests (if applicable)

**Test file:** `frontend/lib/src/path/to/file.test.tsx`

**Test cases:**

1. Component renders correctly with fix
2. User interaction works as expected
3. Edge cases handled

### E2E Tests (Playwright)

**Test file:** `e2e_playwright/test_issue_XXXXX.py`

**Scenarios:**

1. Original reproduction case (should pass after fix)
2. Related edge cases
3. Regression scenarios (existing functionality still works)

### Manual Testing

**Test scenarios to verify manually:**

1. [Scenario 1 - the reported issue]
2. [Scenario 2 - edge case]
3. [Scenario 3 - related functionality]

**Environments to test:**

- OS: [Windows/Mac/Linux if relevant]
- Browsers: [Chrome/Firefox/Safari if relevant]
- Python versions: [if relevant]

---

## Step 5: Identify Risks & Mitigations

Consider what could go wrong and how to prevent it.

### Potential Risks

**Risk 1: [Description]**

- Likelihood: Low / Medium / High
- Impact: Low / Medium / High
- Mitigation: [How to prevent or handle]

**Risk 2: [Description]**

- Likelihood: Low / Medium / High
- Impact: Low / Medium / High
- Mitigation: [How to prevent or handle]

### Rollback Strategy

**If the fix causes problems:**

- Can be reverted: Yes / No
- Revert complexity: Simple / Complex
- User impact of revert: [Description]

### Performance Considerations

- Expected performance impact: None / Improvement / Degradation
- Benchmarking needed: Yes / No
- Performance tests: [What to measure]

---

## Step 6: Plan Documentation Updates

Identify what documentation needs updating.

### Code Documentation

- [ ] Docstrings updated
- [ ] Inline comments added
- [ ] Type hints updated
- [ ] README changes needed

### User-Facing Documentation

- [ ] API documentation
- [ ] Migration guide (if breaking)
- [ ] Release notes entry
- [ ] Examples updated

### Changelog

**Entry for changelog:**

```
- **Fix:** [Brief description of fix] ([#XXXXX](link), [#PR](link))
  - Fixes issue where [problem description]
  - [Any user-facing impact or migration needed]
```

---

## Step 7: Save Fix Proposal

Save your complete fix proposal to the notes directory.

**Proposal Document Location:**

```bash
agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-fix-proposal.md
```

### Proposal Template

````markdown
# Fix Proposal: Issue #<ISSUE_NUMBER>

**Issue Title:** <Title>
**Proposal Date:** <YYYY-MM-DD>
**Author:** <Your name or "AI Agent">
**Issue URL:** https://github.com/streamlit/streamlit/issues/<ISSUE_NUMBER>
**Root Cause Analysis:** `agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-root-cause.md`

---

## Summary

[1-2 paragraph executive summary of the proposed fix]

**Approach:** [Brief description]
**Complexity:** [Simple / Moderate / Complex]
**Breaking Changes:** [Yes / No]
**Estimated Effort:** [Hours or days]

---

## 1. Root Cause Review

**Root Cause:** [Brief recap from analysis]

**Affected Components:**

- [Component 1]
- [Component 2]

**Confidence:** [Level from analysis]

---

## 2. Fix Strategy

### Primary Approach

**Description:**

[Detailed description of the main fix approach]

**Rationale:**

[Why this approach is recommended]

**Complexity:** [Simple / Moderate / Complex]

**Benefits:**

- [Benefit 1]
- [Benefit 2]

**Drawbacks:**

- [Drawback 1]
- [Drawback 2]

---

### Alternative Approaches Considered

#### Alternative 1: [Name]

**Description:** [How this would work]

**Pros:**

- [Pro 1]
- [Pro 2]

**Cons:**

- [Con 1]
- [Con 2]

**Why not chosen:** [Reason]

#### Alternative 2: [Name]

[Similar structure]

---

### Approach Comparison

| Approach | Complexity | Backward Compat | Performance | Maintainability | Recommended |
| -------- | ---------- | --------------- | ----------- | --------------- | ----------- |
| Primary  | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ✅          |
| Alt 1    | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ❌          |
| Alt 2    | [Level]    | ✅/❌           | ✅/❌       | ✅/❌           | ❌          |

---

## 3. Implementation Plan

### Files to Modify

#### Backend Changes

**File:** `lib/streamlit/path/to/file.py`

- **Function:** `function_name()`
- **Change:** [Specific change]
- **Lines:** ~X-Y
- **Complexity:** [Level]

#### Frontend Changes (if applicable)

**File:** `frontend/lib/src/path/to/file.tsx`

- **Component:** `ComponentName`
- **Change:** [Specific change]
- **Lines:** ~X-Y
- **Complexity:** [Level]

#### Protobuf Changes (if applicable)

**File:** `proto/streamlit/proto/SomeProto.proto`

- **Change:** [What to add/modify]
- **Breaking:** Yes / No

---

### Implementation Steps

1. **[Component] - [Task]**

   - Action: [What to do]
   - Expected result: [Outcome]
   - Verification: [How to verify]

2. **[Component] - [Task]**

   - Action: [What to do]
   - Expected result: [Outcome]
   - Verification: [How to verify]

3. **[Integration] - [Task]**
   - Action: [What to do]
   - Expected result: [Outcome]
   - Verification: [How to verify]

---

### Backward Compatibility

**Breaking Changes:** [Yes / No]

**If Yes:**

- [ ] Breaking change: [Description]
- [ ] Migration path: [How users upgrade]
- [ ] Deprecation warnings: [What to add]
- [ ] Documentation: [What to update]
- [ ] Version bump: [Major / Minor]

**If No:**

- Compatibility maintained by: [Explanation]
- Existing behavior preserved: [How]

---

## 4. Testing Strategy

### Unit Tests

**Test File:** `tests/streamlit/path/to/test_file.py`

**Test Cases:**

1. **test*fix_for_issue*<ISSUE_NUMBER>\_main_scenario**

   - Setup: [Initial state]
   - Action: [What to do]
   - Assert: [Expected outcome]

2. **test*fix_for_issue*<ISSUE_NUMBER>\_edge_case_1**

   - Setup: [Edge case setup]
   - Action: [What to do]
   - Assert: [Expected outcome]

3. **test_regression_existing_functionality**
   - Setup: [Normal usage]
   - Action: [Existing functionality]
   - Assert: [Still works]

**Test Code Example:**

```python
def test_fix_for_issue_<ISSUE_NUMBER>():
    """Test that gh-<ISSUE_NUMBER> is fixed."""
    # [Test implementation]
```

---

### Frontend Tests (if applicable)

**Test File:** `frontend/lib/src/path/to/file.test.tsx`

**Test Cases:**

1. [Test case 1]
2. [Test case 2]

---

### E2E Tests

**Test File:** `e2e_playwright/test_issue_<ISSUE_NUMBER>.py`

**Scenarios:**

1. **Original reproduction** (from issue report)
2. **Edge cases** discovered during analysis
3. **Regression scenarios** (existing functionality)

**Test Structure:**

```python
def test_issue_<ISSUE_NUMBER>(app: Page):
    """E2E test for gh-<ISSUE_NUMBER> fix."""
    # Setup app
    # Reproduce original issue
    # Verify fix works
```

---

### Manual Testing Checklist

**Test in these scenarios:**

- [ ] Original issue reproduction case
- [ ] Edge case 1: [Description]
- [ ] Edge case 2: [Description]
- [ ] Regression: Existing functionality
- [ ] Performance: No degradation

**Test environments (if relevant):**

- [ ] OS: Windows / macOS / Linux
- [ ] Browsers: Chrome / Firefox / Safari
- [ ] Python versions: [Versions to test]

---

## 5. Risk Assessment

### Potential Risks

#### Risk 1: [Risk Description]

- **Likelihood:** Low / Medium / High
- **Impact:** Low / Medium / High
- **Severity:** [Likelihood × Impact]
- **Mitigation:** [How to prevent or minimize]
- **Detection:** [How to detect if it occurs]

#### Risk 2: [Risk Description]

[Similar structure]

---

### Rollback Plan

**Can be reverted:** Yes / No

**Rollback approach:**

- [How to revert if needed]
- [User impact of rollback]
- [Time to rollback]

**Monitoring:**

- [What to monitor after deployment]
- [Signals that rollback is needed]

---

### Performance Impact

**Expected impact:** None / Improvement / Degradation

**Analysis:**

- [How this affects performance]
- [Benchmarks to run]
- [Acceptable thresholds]

**Mitigation (if degradation):**

- [How to minimize impact]
- [Alternative approaches if unacceptable]

---

## Step 6: Plan Documentation

### Code Documentation

**Docstrings to update:**

- `function_name()` in `file.py`
  - Update: [What to document]

**Comments to add:**

- In `file.py` around line X
  - Purpose: [Explain the fix]

**Type hints:**

- [Any type hint updates needed]

---

### User-Facing Documentation

**API documentation:**

- [ ] No changes needed
- [ ] Update API reference: [What to document]
- [ ] Add examples: [New examples needed]

**Migration guide (if breaking):**

- [ ] Not breaking
- [ ] Add migration section: [What users need to do]

**Release notes:**

```
### Bug Fixes

- **[Component]:** Fixed issue where [problem]. ([#XXXXX](link))
  - [User-facing impact or change]
  - [Migration needed, if any]
```

---

## Step 7: Create Fix Proposal Document

Save the complete proposal for review.

**Proposal Document Location:**

```bash
agent-knowledge/local/notes/bug-analysis/gh-<ISSUE_NUMBER>-fix-proposal.md
```

### Complete Template

Use the structure above to create a comprehensive proposal that includes:

- Summary and approach
- Root cause review
- Fix strategy with alternatives
- Implementation plan
- Testing strategy
- Risk assessment
- Documentation plan

---

## Step 8: Review and Validate

Before proceeding to implementation, review the proposal:

### Self-Review Checklist

- [ ] Fix addresses the root cause identified
- [ ] Approach is sound and well-reasoned
- [ ] Alternatives considered and documented
- [ ] Implementation steps are clear
- [ ] Testing strategy is comprehensive
- [ ] Risks identified and mitigated
- [ ] Documentation plan is complete
- [ ] Backward compatibility addressed

### Team Review (Recommended for Complex Fixes)

**For complex or risky fixes:**

1. Share proposal with team
2. Get feedback on approach
3. Discuss alternatives
4. Validate assumptions
5. Get approval before implementing

**How to share:**

- Post in Slack with link to proposal document
- Create GitHub issue comment with summary
- Discuss in team meeting
- Request specific reviewer feedback

---

## Success Criteria

Proposal is complete when you have:

- ✅ Reviewed root cause analysis thoroughly
- ✅ Designed primary fix approach
- ✅ Considered and documented alternatives
- ✅ Created detailed implementation plan
- ✅ Planned comprehensive testing
- ✅ Identified risks and mitigations
- ✅ Planned documentation updates
- ✅ Saved proposal document
- ✅ Self-reviewed for completeness

---

## Next Steps

**After completing proposal:**

**High confidence + simple fix:**

- Proceed directly to implementation
- Create PR following the proposal

**Complex fix or medium confidence:**

- Share proposal with team
- Get feedback and approval
- Refine based on feedback
- Then implement

**Risks identified:**

- Discuss with team first
- Consider proof-of-concept
- Validate approach before full implementation

**If using start-bug-fix.md workflow:** Return to that command for journal update instructions and next steps.

---

## Example Proposal

See inline template above for complete structure. Key sections:

1. **Summary** - Executive summary of the fix
2. **Fix Strategy** - Primary approach + alternatives
3. **Implementation Plan** - Step-by-step with file changes
4. **Testing Strategy** - Unit, frontend, E2E, manual tests
5. **Risk Assessment** - Potential issues and mitigations
6. **Documentation** - Code and user-facing docs

---

## Tips

**When Designing Fix:**

- Start simple - prefer minimal changes
- Consider existing patterns in codebase
- Maintain consistency with Streamlit API design
- Think about edge cases
- Plan for failure scenarios

**When Considering Alternatives:**

- Don't dismiss ideas too quickly
- Document why you chose one over another
- Consider future maintainability
- Think about performance implications

**When Planning Tests:**

- Cover the reported issue
- Cover edge cases discovered
- Ensure regression coverage
- Plan manual testing for UX issues

**When Assessing Risks:**

- Be realistic about what could go wrong
- Plan mitigations for likely risks
- Have rollback strategy ready
- Consider monitoring and detection

---

**A good proposal = faster implementation + fewer surprises + better review process!**
````
