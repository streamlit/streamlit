---
Author(s): @sfc-gh-lwilby
Status: Draft
Related SEP: https://github.com/streamlit/streamlit-enhancement-proposals/pull/3
---

# Dynamic Tabs, Expander, and Popover (Lazy Execution)

## Summary

Enable `st.tabs`, `st.expander`, and `st.popover` to execute content lazily (only for the active tab, when expanded, or when popover is open) instead of always executing on every rerun. This addresses a fundamental performance problem where all tab content runs regardless of which tab is visible, causing slower performance in apps with expensive operations across multiple tabs. Enabling state tracking may also unlocks programmatic control as a side benefit (depending on technical implementation decisions).

**API Approach:** [Option 1b from SEP PR #3](https://github.com/streamlit/streamlit-enhancement-proposals/pull/3) - Add `on_change` parameter and `.open` attribute to enable state tracking and conditional execution.

## Problem

### Current Behavior

Currently, `st.tabs` and `st.expander` always execute their content, even when not visible:

```python
tab1, tab2, tab3 = st.tabs(["Data", "Charts", "ML Model"])

with tab1:
    load_large_dataset()  # ALWAYS runs, even if user is viewing tab2

with tab2:
    create_expensive_charts()  # ALWAYS runs, even if user is viewing tab3

with tab3:
    run_ml_inference()  # ALWAYS runs, even if user is viewing tab1
```

This ensures instant visibility when tabs are switched, but significantly slows apps when tabs contain expensive computations.

### User Requests

**Primary GitHub Issues:**

- [#6004](https://github.com/streamlit/streamlit/issues/6004) - Dynamic tabs (230 👍)
- [#2399](https://github.com/streamlit/streamlit/issues/2399) - st.expander expanded/collapsed state (93 👍)

**Related (but not directly addressed by lazy execution):**

- [#8239](https://github.com/streamlit/streamlit/issues/8239) - st.tabs & expander frontend state/mount handling (79 👍) - addresses broader state management issues

### Real-World Examples

1. **ML/Data Science:** Multiple models, each requiring expensive inference - ALL run even though user views one
2. **API Dashboards:** All API calls execute every rerun (rate limits, costs, 1.5+ seconds)
3. **Database Tools:** All queries run simultaneously (5-10 seconds for multiple queries)
4. **Complex Visualizations:** All viz rendered even though only one visible (Plotly 3D, network graphs, etc.)

**Current workarounds:** Users resort to `st.selectbox`, `st.radio` or `st.segmented_control` instead of tabs to control execution, losing the visual organization benefits of tabs.

**Side benefit:** Enabling state tracking can unlock programmatic control (setting active tab/expander via session state), which could enable new use cases like multi-step workflows (Next/Back buttons) and conditional tab switching (e.g., auto-advance when validation passes).

---

## Proposal

### API Design (Option 1b)

Add `on_change` parameter and `.open` attribute following the pattern established for chart/dataframe selections.

#### For `st.tabs`:

```python
tabs = st.tabs(["Data", "Charts", "ML"], on_change="rerun", key="my_tabs")

# Only execute content for the active tab
if tabs[0].open:
    with tabs[0]:
        load_large_dataset()  # Only runs when this tab is active

if tabs[1].open:
    with tabs[1]:
        create_expensive_charts()  # Only runs when this tab is active

# Programmatic control
def goto_charts():
    st.session_state.my_tabs = "Charts"

st.button("Go to Charts", on_click=goto_charts)
```

#### For `st.expander`:

```python
exp = st.expander("Show details", on_change="rerun", key="details")

if exp.open:  # Only when expanded
    with exp:
        expensive_operation()

# Programmatic control
def open_details():
    st.session_state.details = True

st.button("Show Details", on_click=open_details)
```

#### For `st.popover`:

```python
pop = st.popover("Options", on_change="rerun", key="options")

if pop.open:  # Only when popover is open
    with pop:
        expensive_operation()
```

### Parameters

#### New parameter: `on_change`

- **Type:** `Literal["ignore", "rerun"] | WidgetCallback`
- **Default:** `"ignore"` (current behavior - always execute all content, no state tracking)
- **Values:**
  - `"ignore"`: Current behavior, always execute all content, no state tracking
  - `"rerun"`: Trigger full app rerun when tab changes/expander toggles, enables state tracking
  - `callback`: _(Future addition for API consistency with widgets)_ Function to call before rerun
    - Note: Callbacks could theoretically be used to define tab/expander content (combining Option 2 with Option 1b), but this would be unintuitive (callbacks typically run side effects, not define content) and would face fragment limitations if auto-wrapped. Better to let users explicitly use `@st.fragment` where needed.

#### New parameter: `key` (for tabs)

- **Type:** `str | None`
- **Default:** `None`
- **Purpose:** Required if using `on_change` with callback, makes state accessible via `st.session_state[key]`
- **State value:** `str` (label of active tab) for tabs, `bool` for expander

#### New attribute: `.open` (on DeltaGenerator)

Each returned `DeltaGenerator` (tab or expander) has a new `.open` property:

- **Type:** `bool | None`
- **Returns:**
  - `True` if tab is active or expander is expanded
  - `False` if tab is not active or expander is collapsed
  - `None` if `on_change` is `"ignore"` (state not tracked) OR if called on non-tab/expander/popover elements

**Implementation:** The property is added to the `DeltaGenerator` class and checks `st.session_state[widget_id]` to determine current state.

**For tabs specifically:** Session state stores the active tab's **label** (as a string), and `.open` checks if this tab's label matches the stored value.

**Important caveat:** Since `.open` is added to `DeltaGenerator` (which is shared by all Streamlit elements), all elements will have this property. For elements that are not tabs/expanders/popovers, `.open` will always return `None`. This is an acceptable API trade-off for implementation simplicity.

**Usage:**

```python
tabs = st.tabs(["A", "B", "C"], key="my_tabs", on_change="rerun")

# Each tab has .open property
tabs[0].open  # True if "A" is active, False otherwise
tabs[1].open  # True if "B" is active, False otherwise

# Also accessible via session state
st.session_state.my_tabs  # Returns "A", "B", or "C" (active tab label)

# Note: Other elements also have .open but it returns None
button = st.button("Click")
button.open  # Always None (not a tab/expander/popover)
```

### Behavior

**When `on_change` is set:**

1. Element registers as a widget (tracks state in session_state)
2. `.open` attribute returns current state (`True`/`False`)
3. User must explicitly check `.open` to get lazy execution
4. Switching tabs/toggling expander triggers app rerun (if `on_change="rerun"` or callback)

**When `on_change` is `"ignore"` (default):**

1. Element behaves as current (no state tracking)
2. `.open` returns `None`
3. All content always executes (backward compatible)

**Explicit opt-in pattern:**

```python
tabs = st.tabs([...], on_change="rerun")  # Enable state tracking

if tabs[0].open:  # Developer must add this check
    with tabs[0]:
        expensive_code()  # Only runs when check is True
```

**Why opt-in is important:** When `on_change` is set, tabs/expander register as widgets, which means they:

- ❌ Cannot be used inside `@st.cache_data` decorated functions
- ❌ Cannot be used inside `@st.fragment` (fragments can't contain widgets that write outside their scope)
- This is why `on_change=None` is the default - to avoid breaking existing apps that use tabs in these contexts

### Examples

**Full example apps demonstrating Option 1b:**

1. **Lazy Execution Demo:** `e2e_playwright/dynamic_containers/dynamic_expander_test.py`

   - Shows tabs and expander with `on_change="rerun"`
   - Demonstrates `.open` attribute usage
   - Programmatic control via session state

2. **Database Query Dashboard:** `e2e_playwright/dynamic_containers/database_query_app_option1b.py`

   - Real-world example: Multiple database queries in tabs
   - Only active tab's query executes
   - Shows 70-80% performance improvement by simulating expensive database queries

3. **Multi-Step Wizard:** `e2e_playwright/dynamic_containers/wizard_pipeline_app_option1b.py`
   - Sequential workflow with Next/Back buttons
   - Programmatic navigation between steps
   - Demonstrates validation and conditional logic

**Comparison apps (Option 2):**

_Note: Option 2 API is not implemented. These apps demonstrate what the code would look like with the function argument approach for comparison purposes._

- `e2e_playwright/dynamic_containers/database_query_app_option2.py`
- `e2e_playwright/dynamic_containers/wizard_pipeline_app_option2.py`

---

### Design Rationale: Why Option 1b?

#### Alternative Considered: Option 2 (Function Argument)

From [SEP PR #3](https://github.com/streamlit/streamlit-enhancement-proposals/pull/3), an alternative approach was considered:

**Option 2:** Pass functions as arguments: `st.tabs({"A": func_a, "B": func_b}, args=(data,))`

**Why not selected:**

1. **Auto-fragmentation impractical** - Option 2's main performance advantage would be auto-wrapping functions in fragments (like `st.dialog`), but this imposes some restrictions:

   - ❌ Cannot use `st.sidebar` directly
   - ❌ Widgets cannot write to external containers (breaks shared output area pattern)
   - ❌ Elements accumulate/duplicate in external containers (duplication bug #12762)
   - Note: Unlike `st.dialog` (isolated modals), tabs are part of main app flow where these patterns are likely

2. **Not incrementally adoptable** - Requires refactoring existing code to functions

3. **Implicit execution** - Less clear when code runs

4. Programmatic control can still be implemented, but would likely still involve registering the element as a widget and adding a key and using session state to update the widget state (an established pattern with other elements). This control mechanism is more in sync with option 1b conceptually.

**Strengths:** Automatic execution, clean `args`/`kwargs`, less overhead. Automatic performance gain from fragments if we do auto-fragmentation.

#### Why Option 1b Was Selected

**SteerCo Decision (Oct 15, 2024):** Strong support for Option 1b - "easier to grow into" and "feels more at home with Streamlit APIs"

**Key reasons:**

1. ✅ **Consistency:** Matches `on_change` pattern (widgets, selections)
2. ✅ **Explicitness:** `if tabs[i].open:` shows execution flow
3. ✅ **Incremental adoption:** Add without refactoring
4. ✅ **Programmatic control:** Well-defined via session state
5. ✅ **No forced limitations:** Users can optionally use `@st.fragment` (not forced)

**Trade-off:** Full app rerun on tab switch (acceptable - avoids fragment restrictions that would break `st.sidebar`, external containers, etc.). Users can still control this with the st.fragment decorator applied as needed to tab/expander content.

---

## Checklist

- [x] **Will this work on all deployment platforms?** Yes - uses session_state and widget callbacks (supported everywhere)
- [x] **No breaking API changes?** Yes - new parameters are optional, existing code works unchanged
- [x] **No new dependencies?** Yes - uses existing infrastructure
- [x] **Metrics collected?** Yes
- [x] **Any security or legal implications?** No - uses existing session_state mechanism
- [x] **Anything to keep in mind for docs?**
  - Explain trade-off: instant switching (static) vs lazy loading (dynamic)
  - Document programmatic control pattern
  - Show performance optimization use cases
  - Cookbook recipe for expensive tab content
- [] **Any other risks?**

---

## References

- **SEP:** [PR #3 - Dynamic tabs/expander/popover](https://github.com/streamlit/streamlit-enhancement-proposals/pull/3)
- **Prototype PR:** [#13277](https://github.com/streamlit/streamlit/pull/13277)
- **Related PRs:** [#13233 - st.Tab class spec](https://github.com/streamlit/streamlit/pull/13233)
- **GitHub Issues:** [#6004](https://github.com/streamlit/streamlit/issues/6004) (230 👍), [#2399](https://github.com/streamlit/streamlit/issues/2399) (93 👍), [#8239](https://github.com/streamlit/streamlit/issues/8239) (79 👍)
