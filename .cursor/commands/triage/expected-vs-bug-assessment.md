# Expected Behavior vs Bug Assessment Guide

## Purpose

This guide helps AI agents and team members distinguish between genuine bugs and expected Streamlit behavior that users may find surprising or confusing. Use this when:

- Analyzing issues in `analyze-issue.md`
- Interpreting playwright test results in `create-playwright-test.md`
- Creating reproduction apps in `create-repro-app.md`
- Deciding which confirmation command to use

## Decision Framework

### Is This a Bug?

Ask these questions in order:

**1. Does the behavior match the documentation?**

**How to check:**

For AI agents, search the documentation repository directly:

1. **Clone/access the docs repo:**

   ```bash
   # If not already cloned
   git clone https://github.com/streamlit/docs.git
   ```

2. **Search docs for the feature:**

   ```bash
   # Search for API documentation
   grep -r "st.multiselect" docs/content/library/api-reference/

   # Search for concepts/guides
   grep -r "widget state" docs/content/library/
   ```

3. **Check docstrings in streamlit repo:**

   - Location: `lib/streamlit/elements/` and widget files
   - Read the function's docstring for documented behavior

   ```bash
   # Example: Check multiselect documentation
   grep -A 50 "def multiselect" lib/streamlit/elements/widgets/multiselect.py
   ```

4. **Check key concept docs:**
   - Execution model: `docs/content/library/advanced-features/execution-flow`
   - Widget semantics: `docs/content/library/advanced-features/widget-semantics`
   - Session state: `docs/content/library/api-reference/session-state`
   - Caching: `docs/content/library/advanced-features/caching`

**Online reference (for humans):** https://docs.streamlit.io/library/api-reference

**Decision:**

- YES (clearly documented) → Likely expected behavior
- NO (contradicts docs) → Bug
- UNCLEAR (not documented) → Continue to next question

---

**2. Does the behavior match common user expectations?**

**How AI agents can evaluate this:**

- **Pattern recognition:** Do multiple users report the same issue? (Check related issues)
- **Other frameworks:** Would this surprise users coming from React, HTML forms, or other UI frameworks?
- **Basic UX principles:** Does data disappear unexpectedly? Do interactions not respond? Does UI behave inconsistently?
- **Python conventions:** Does it violate standard Python behavior (dict semantics, context managers, etc.)?

**When to mark "Needs Team Decision":**

- Expectation is subjective or unclear
- Behavior is surprising but might be necessary
- Users seem split on whether it's a problem

**Decision:**

- YES (matches expectations) → Likely expected behavior
- NO (surprising/confusing) → Continue

---

**3. Is this behavior intentional by design?**

**How to evaluate:**

- Check for design rationale in code comments
- Look for related issues explaining the design decision
- Consider: Is this a necessary trade-off for Streamlit's execution model?
- Check changelog for intentional feature additions

**Decision:**

- YES (clearly intentional) → Expected behavior, may need better docs
- NO (seems unintentional) → Continue
- UNKNOWN → Mark "Needs Team Decision"

---

**4. Does this behavior cause actual harm or prevent valid use cases?**

**Evaluate:**

- Does it break a common, valid use case?
- Does it cause data loss or corruption?
- Does it make a feature unusable?
- Or is it just cosmetic/inconvenient?

**Decision:**

- NO (edge case, cosmetic, or workaround exists) → Expected behavior
- YES (breaks valid usage) → Likely a bug

---

**5. Is this a regression (worked differently before)?**

**How to check:**

- Look for "worked in version X" in issue description
- Test in previous Streamlit versions if possible
- Check changelog and release notes

**Decision:**

- YES → Bug (unless noted as intentional breaking change)
- NO → Continue

---

**6. Does this violate the principle of least surprise?**

**Principle of least surprise:** Software should behave as users expect based on:

- Feature names and descriptions (if called `default`, it should set defaults)
- Common conventions from similar tools
- General programming patterns
- The way related features work

**Examples:**

- ✅ Surprising: Parameter called `disabled=True` but widget still clickable
- ✅ Surprising: Widget value changes without user interaction
- ❌ Not surprising: Need to initialize session_state before using it (like any dict)

**Decision:**

- YES (violates expectations) → Likely a bug or UX issue
- NO (behavior is reasonable given context) → Expected behavior

## Common Patterns

### ✅ Expected Behavior (Not Bugs)

**Note:** These are common patterns where users report "bugs" but the behavior is actually by design.

#### 1. Widget Value Persistence

**Pattern:** "Widget value disappears or resets unexpectedly"

**Expected:** Widget values persist by default UNLESS the widget's identity changes or it's conditionally unmounted.

**Why:** Streamlit tracks widgets by (type, label, key). Changing these creates a new widget.

**How to Handle:**

- Check if widget is conditionally unmounted (if statement wrapping it)
- Check if widget's label/position changes between reruns
- Explain that values persist by default but identity must be stable
- Show how to use explicit `key` parameter for guaranteed persistence

---

#### 2. Widget Identity and Keys

**Pattern:** "Widget state is lost when options/label changes"

**Expected:** Widgets are identified by (type, label, key). Changing any of these creates a NEW widget.

**Why:** Streamlit needs stable identity to persist state across reruns.

**How to Handle:**

- Explain widget identity computation
- Show how to use stable keys and session state for default values

---

#### 3. Execution Order Dependencies

**Pattern:** "Widget B doesn't see Widget A's value on first run"

**Expected:** First script run executes before any user interaction. Widgets have default values only.

**Why:** Code executes top-to-bottom before user can interact.

**How to Handle:**

- Explain script execution order
- Show how to provide default values or initial state

---

#### 4. Fragment Rerun Scope

**Pattern:** "Widget in fragment doesn't trigger full app rerun"

**Expected:** Fragments have isolated RERUN scope, not state isolation. Widgets in fragments only rerun the fragment, not the whole app.

**Why:** Fragment isolation is by design for performance - allows partial reruns.

**How to Handle:**

- Explain that fragments control WHEN code reruns, not widget accessibility
- Show how widgets in fragments need `key` and session_state to communicate with main app

---

#### 5. Form Submit Behavior

**Pattern:** "Widget callback doesn't fire when it's in a form"

**Expected:** Widgets in forms don't trigger callbacks until form is submitted.

**Why:** Forms batch interactions together.

**How to Handle:**

- Explain form batching behavior
- Show correct pattern using form submit button

---

#### 6. Rendering Order

**Pattern:** "Elements appear in unexpected order"

**Expected:** Streamlit renders elements in the order code executes, which may differ from declaration order with context managers.

**Why:** Script execution is linear, top-to-bottom. Context managers (with blocks) control scope.

**Correct pattern:**

```python
container = st.container()
# Later in code:
with container:  # Re-enter context to add content
    st.write("This goes in the container")
```

**How to Handle:**

- Check if code is within the correct context manager
- Explain Python context manager scope (with blocks)
- Show how to use container/column references correctly

---

#### 7. Browser/Client-Side Limitations

**Pattern:** "Camera/file upload doesn't work in certain scenarios"

**Expected:** Some features require HTTPS, user permissions, or browser support.

**Why:** Browser security and API availability.

**How to Handle:**

- Explain browser requirements
- Document necessary setup (HTTPS, permissions)

---

#### 8. Session State Initialization

**Pattern:** "Session state value is None on first access"

**Expected:** Session state is empty until explicitly initialized.

**Why:** Streamlit doesn't pre-populate state automatically.

**How to Handle:**

- Explain session state initialization pattern
- Show proper `if "key" not in st.session_state:` pattern

---

### 🐛 Actual Bugs (Unexpected Behavior)

#### 1. Crashes and Exceptions

**Bug:** Application crashes, unhandled exceptions, error traces

**Never Expected:** Code should not crash with valid inputs

#### 2. Data Loss or Corruption

**Bug:** User data is lost, modified incorrectly, or corrupted

**Never Expected:** Data integrity must be maintained

#### 3. Inconsistent Behavior

**Bug:** Same code produces different results in similar conditions

**Never Expected:** Behavior should be deterministic

#### 4. Documentation Violations

**Bug:** Behavior contradicts documented API or examples

**Always a Bug:** Docs are the contract with users

#### 5. Regressions

**Bug:** Behavior changed from previous version without announcement

**Always a Bug:** (unless intentional breaking change in major version)

#### 6. Visual Corruption

**Bug:** UI elements overlap, disappear, or render incorrectly

**Never Expected:** UI should be functional and readable

#### 7. Performance Degradation

**Bug:** Severe slowness or hangs with reasonable inputs

**Never Expected:** App should be responsive with normal usage

#### 8. Security Issues

**Bug:** Exposed secrets, XSS, injection vulnerabilities

**Always Critical Bug:** Security is non-negotiable

---

## Ambiguous Cases Requiring Team Decision

### When to Ask the Team

If unsure, ask the team when:

1. **Documented but Surprising:**

   - Behavior matches docs but violates user expectations
   - May indicate documentation or UX problem

2. **Undocumented Behavior:**

   - Not mentioned in docs either way
   - Unclear if intentional or oversight

3. **Edge Cases:**

   - Unusual combination of features
   - Behavior seems wrong but might be necessary

4. **Performance Boundaries:**

   - "How slow is too slow?"
   - "How big should this handle?"

5. **API Design Questions:**
   - "Should this parameter combination be allowed?"
   - "Is this the intended usage pattern?"

### How to Present Ambiguous Cases

When requesting team clarification, provide:

```markdown
## Behavior Assessment Needed: Issue #<NUMBER>

**Reported Behavior:**
<What user reports>

**Current Behavior:**
<What actually happens>

**Why It Might Be Expected:**

- <Reason 1 with reference to design/docs>
- <Reason 2>

**Why It Might Be a Bug:**

- <Reason 1 with reference to user expectation/harm>
- <Reason 2>

**Documentation Status:**

- [Documented / Not Documented / Contradicts Docs]

**User Impact:**

- [High/Medium/Low] - <explanation>

**Recommendation:**
<Your assessment>

**Question for Team:**
Should we:

1. Confirm as expected behavior and improve documentation?
2. Confirm as bug and track for fix?
3. Gather more information?

@<relevant-team-member>
```

## Red Flags for "Not a Bug"

These signals suggest expected behavior:

🚩 **Pattern Emerges:** Multiple similar reports, all showing same misunderstanding
🚩 **Works as Coded:** Behavior is direct consequence of documented design
🚩 **Educational Gap:** Issue resolves with explanation of how Streamlit works
🚩 **Framework Limitation:** Inherent to Python/browser/async execution
🚩 **Documented Limitation:** Explicitly called out in docs
🚩 **Design Trade-off:** Behavior is necessary consequence of design choice

## Red Flags for "Actual Bug"

These signals suggest genuine bug:

🚨 **Crashes or Errors:** Unhandled exceptions with valid input
🚨 **Data Integrity:** Lost, corrupted, or wrong data
🚨 **Regression:** Worked before, broken now
🚨 **Contradicts Docs:** Behavior doesn't match documented API
🚨 **Inconsistent:** Same code, different results
🚨 **Breaking Use Case:** Prevents valid, common usage
🚨 **Security Concern:** Exposes data, XSS, injection

## Assessment Workflow

### Step 1: Gather Context

- [ ] Read full issue description
- [ ] Check documentation for feature
- [ ] Review related issues
- [ ] Test current behavior
- [ ] Check if regression (compare versions)

### Step 2: Apply Decision Framework

Work through the decision tree at the top of this document.

### Step 3: Document Assessment

In NOTES.md, add:

```markdown
## Expected vs Bug Assessment

**Assessment:** [Expected Behavior / Bug / Needs Team Decision]

**Confidence:** [High / Medium / Low]

**Reasoning:**

1. <Key factor 1>
2. <Key factor 2>
3. <Key factor 3>

**Pattern Match:**
<Reference to pattern in this guide>

**Team Consultation Needed:** [Yes / No]
<If yes, explain what question needs answering>
```

## Common Mistakes to Avoid

**Note:** After completing your assessment, return to the command you were running which will guide the next steps.

### ❌ Don't

1. **Assume user error without investigation:** Some reports seem like misunderstandings but reveal real bugs
2. **Dismiss edge cases immediately:** Edge cases can indicate systemic issues
3. **Rely only on documentation:** Docs may be outdated or incomplete
4. **Ignore user expectations:** Even if "correct," surprising behavior is a UX issue
5. **Make unilateral decisions:** When in doubt, ask the team

### ✅ Do

1. **Test thoroughly:** Reproduce exactly what user describes
2. **Check multiple versions:** Confirm if regression
3. **Review similar issues:** Look for patterns
4. **Consider user perspective:** Why would they expect different behavior?
5. **Document reasoning:** Explain your assessment clearly
6. **Ask for help:** Team knows design decisions and history

## References

- **Streamlit Docs:** https://docs.streamlit.io
- **API Reference:** https://docs.streamlit.io/library/api-reference
- **Caching and State:** https://docs.streamlit.io/library/advanced-features/caching
- **Execution Model:** https://docs.streamlit.io/library/advanced-features/execution-flow
- **Widget Behavior:** https://docs.streamlit.io/library/advanced-features/widget-semantics
