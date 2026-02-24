---
author: sfc-gh-lwilby
created: 2026-01-14
---

# Dynamic Tabs, Expander, and Popover (Lazy Execution)

## Summary

Enable `st.tabs`, `st.expander`, and `st.popover` to execute content lazily (only for the active tab, when expanded, or when popover is open) instead of always executing on every rerun. This addresses a fundamental performance problem where all tab content runs regardless of which tab is visible, causing slower performance in apps with expensive operations across multiple tabs. Enabling state tracking also unlocks programmatic control as a side benefit.

## Problem

### Current Behavior

Currently, `st.tabs`, `st.expander`, and `st.popover` always execute their content, even when not visible:

```python
tab1, tab2, tab3 = st.tabs(["Data", "Charts", "ML Model"])

with tab1:
    load_large_dataset()  # ALWAYS runs, even if user is viewing tab2

with tab2:
    create_expensive_charts()  # ALWAYS runs, even if user is viewing tab1
```

This ensures instant visibility when tabs are switched, but significantly slows apps when tabs contain expensive computations.

**Current workarounds:** Users resort to `st.selectbox`, `st.radio`, or `st.segmented_control` instead of tabs to control execution, losing the visual organization benefits of tabs.

### User Requests

**Primary GitHub Issues:**

- [#6004](https://github.com/streamlit/streamlit/issues/6004) - Dynamic tabs (230 👍)
- [#2399](https://github.com/streamlit/streamlit/issues/2399) - st.expander expanded/collapsed state (93 👍)

**Related - Addressed by programmatic control:**

- [#6370](https://github.com/streamlit/streamlit/issues/6370) - Can't close st.expander after users open it themselves
- [#8265](https://github.com/streamlit/streamlit/issues/8265) - [Coming soon] Add open/close parameter to st.popover

**Related (but not directly addressed by lazy execution):**

- [#8239](https://github.com/streamlit/streamlit/issues/8239) - st.tabs & expander frontend state/mount handling (79 👍) - addresses broader state management issues

---

## Proposal

### API Design

Add `on_change` parameter and `.open` attribute following the pattern established for chart/dataframe selections.

#### Lazy Execution with `.open` Attribute

**For `st.tabs`:**

```python
tabs = st.tabs(["Data", "Charts", "ML"], on_change="rerun")

# Only execute content for the active tab
if tabs[0].open:
    with tabs[0]:
        load_large_dataset()  # Only runs when this tab is active

if tabs[1].open:
    with tabs[1]:
        create_expensive_charts()  # Only runs when this tab is active
```

**Alternative naming:** The following alternative property names were considered for checking if a tab is active: `.active`, `.selected`, `.visible`, and `.state`. `.open` was selected because it works naturally across tabs, expander, and popover with a simple boolean check. While `.active` is more precise for tabs, consistency across all three elements was prioritized.

**For `st.expander`:**

```python
exp = st.expander("Show details", on_change="rerun")

if exp.open:  # Only when expanded
    with exp:
        expensive_operation()
```

**For `st.popover`:**

```python
pop = st.popover("Options", on_change="rerun")

if pop.open:  # Only when popover is open
    with pop:
        expensive_operation()
```

#### Programmatic Control via Session State

When a `key` is provided and `on_change="rerun"` or a callback, the element's state can be controlled programmatically via `st.session_state`:

**For `st.tabs`:**

```python
tabs = st.tabs(["Data", "Charts", "ML"], on_change="rerun", key="my_tabs")

# Control which tab is active
def goto_charts():
    st.session_state.my_tabs = "Charts"

st.button("Go to Charts", on_click=goto_charts)

# Conditional execution based on active tab
if tabs[0].open:
    with tabs[0]:
        load_large_dataset()
```

**For `st.expander`:**

```python
# Auto-expand expander when warnings are detected
exp = st.expander("⚠️ Warnings", on_change="rerun", key="warnings", expanded=False)

# Auto-expand if warnings are found
warnings = check_data_quality()
if warnings and not st.session_state.get("warnings", False):
    st.session_state.warnings = True  # Auto-expand

if exp.open:
    with exp:
        display_warnings(warnings)
```

**For `st.popover`:**

```python
# Auto-open popover when validation fails
pop = st.popover("⚠️ Validation Errors", on_change="rerun", key="errors")

# Check for errors and auto-open popover if needed
if has_validation_errors() and not st.session_state.get("errors", False):
    st.session_state.errors = True

if pop.open:
    with pop:
        show_error_details()
```

#### Potential Future Extension: Direct State Updates via `.update()`

Similar to `st.status`, which provides a `.update()` method to modify its state after creation, we could extend `st.tabs`, `st.expander`, and `st.popover` with similar functionality. This would allow updating the open state imperatively within the same script run, without requiring session state manipulation or reruns.

**Potential API for `st.expander`:**

```python
import time
import streamlit as st

# Create expander
exp = st.expander("Processing status", expanded=False)

with exp:
    data = load_expensive_data()
    exp.update(open=True)
    st.dataframe(data)
```

**Potential API for `st.tabs`:**

```python
import streamlit as st

tabs = st.tabs(["Input", "Results"])

with tabs[0]:
    if st.button("Run Analysis"):
        results = run_analysis()
        st.session_state.results = results
        tabs[0].update(open=True)

with tabs[1]:
    if "results" in st.session_state:
        st.write(st.session_state.results)
```

**Note:** `st.tabs` currently returns a Sequence of DeltaGenerator, so the proposal here is update the individual tab to be active. If we wanted to do tabs.update(active="Results") we would need to change the return value of `st.tabs` while also preserving the Sequence functionality (e.g. `tab1, tab2 = st.tabs(["one", "two"])`).

**Potential API for `st.popover`:**

```python
import streamlit as st

# Create popover that auto-closes after form submission
pop = st.popover("Filter Options")

with pop:
    filter_value = st.selectbox("Select filter", ["All", "Active", "Archived"])
    if st.button("Apply Filters"):
        st.session_state.current_filter = filter_value
        pop.update(open=False)  # Auto-close after applying

# Display filtered data based on selection
if "current_filter" in st.session_state:
    st.write(f"Showing: {st.session_state.current_filter}")
```

**Alternative naming:** Ideally, the `.update()` method would use the same parameter names as the initial state parameters for each element. However, since `st.expander` uses `expanded` and `st.tabs` uses `default` (and `st.popover` doesn't currently have an initial state parameter), matching initial state parameters would create inconsistency across three dimensions: (1) between elements (expander vs tabs vs popover), (2) between operations (setting initial state vs checking state via `.open` vs updating state via `.update()`), and (3) semantically (`expanded` doesn't naturally fit `st.tabs` where "active" or "selected" is more intuitive, and `default` is awkward for runtime updates). Therefore, we chose `open` as a unified parameter name. This provides consistency for both the `.open` property and `.update()` method across all three elements. The trade-off is that initial state parameters remain element-specific (`expanded` for expander, `default` for tabs), but these are already established in the existing API.

### Parameters

#### New parameter: `on_change`

- **Type:** `Literal["ignore", "rerun"] | WidgetCallback`
- **Default:** `"ignore"` (current behavior - always execute all content, no state tracking)
- **Values:**
  - `"ignore"`: Current behavior, always execute all content, no state tracking
  - `"rerun"`: Trigger full app rerun when tab changes/expander toggles, enables state tracking
  - `callback`: _(Future addition for API consistency with widgets)_ Function to call before rerun
    - Note: elements defined in the callbacks will render top-level consistent with other widgets that already support callbacks.

#### New parameter: `key`

- **Type:** `str | int | None`
- **Default:** `None`
- **Purpose:** Makes state accessible via `st.session_state[key]` for programmatic control. Not required for callbacks to work (widgets auto-generate internal IDs), but needed to access/control state programmatically. Consistent with all other Streamlit widgets that accept `str | int` keys.
- **State value:** `str` (label of active tab) for tabs, `bool` for expander and popover

#### New attribute: `.open` (on DeltaGenerator)

Each returned `DeltaGenerator` (tab, expander, or popover) has a new `.open` property:

- **Type:** `bool | None`
- **Returns:**
  - `True` if tab is active, expander is expanded, or popover is open
  - `False` if tab is not active, expander is collapsed, or popover is closed
  - `None` if `on_change` is `"ignore"` (state not tracked) OR if called on non-tab/expander/popover elements

**Implementation:** The property is added to the `DeltaGenerator` class and checks `st.session_state[widget_id]` to determine current state.

**For tabs specifically:** Session state stores the active tab's **label** (as a string), and `.open` checks if this tab's label matches the stored value.

**Implementation Note:** We will investigate creating dedicated `DeltaGenerator` subclasses for these elements (e.g., `ExpanderContainer`, `TabContainer`, `PopoverContainer`) similar to what we do for `Dialog` and `StatusContainer`. This would keep the `.open` property and potential future `.update()` method scoped only to the appropriate container types, providing better type safety and API clarity. The alternative approach of adding `.open` to the base `DeltaGenerator` class would make the property available on all Streamlit elements (returning `None` for non-applicable elements), which is less ideal from an API design perspective.

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

**When `on_change` is `"rerun"`:**

1. Element registers as a widget (tracks state in session_state)
2. `.open` attribute returns current state (`True`/`False`)
3. User must explicitly check `.open` to get lazy execution
4. Switching tabs/toggling expander/opening popover triggers app rerun (if `on_change="rerun"` or callback)

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

**Why opt-in is important:** When `on_change` is set, tabs/expander/popover register as widgets, which means:

- ❌ They cannot be created inside `@st.cache_data` decorated functions (widgets are not allowed in cached functions)
- ❌ They cannot be created in external containers from inside a `@st.fragment` (fragments can't create widgets in external containers)
- This is why `on_change="ignore"` is the default - to avoid breaking existing apps that use tabs/expander/popover in these contexts

### Examples

**Example apps demonstrating the proposed API** (see [prototype PR #13277](https://github.com/streamlit/streamlit/pull/13277)):

1. **Lazy Execution Demo:** [`e2e_playwright/dynamic_containers/dynamic_expander_test.py`](https://github.com/streamlit/streamlit/pull/13277/files#diff-dynamic_expander_test.py)

   - Shows tabs, expander, and popover with `on_change="rerun"`
   - Demonstrates `.open` attribute usage
   - Programmatic control via session state

2. **Database Query Dashboard:** [`e2e_playwright/dynamic_containers/database_query_app_option1b.py`](https://github.com/streamlit/streamlit/pull/13277/files#diff-database_query_app_option1b.py)

   - Real-world example: Multiple database queries in tabs
   - Only active tab's query executes
   - Shows 70-80% performance improvement by simulating expensive database queries

---

## Alternatives Considered

Several alternative API designs were evaluated before selecting the proposed approach:

<details>
<summary>Boolean Evaluation of Delta Generator</summary>

**Approach:** Make the delta generator itself evaluate to `True` when open/active.

```python
exp = st.expander("Show details", on_change="rerun")
if exp:  # True if open
    with exp:
        st.write("Expander is open")

tab1, tab2 = st.tabs(["A", "B"], on_change="rerun")
if tab1:  # True if active
    with tab1:
        st.write("Tab A active")
elif tab2:
    with tab2:
        st.write("Tab B active")
```

**Pros:**

- ✅ Clean and readable
- ✅ Minimal changes to existing patterns
- ✅ Concise syntax

**Cons:**

- ❌ "Magic" behavior - delta generators normally don't have truthiness semantics
- ❌ Not explicit about what's being checked
- ❌ Could be confusing when delta generator is falsy

**Why not selected:** The implicit truthiness check feels too magical and could lead to confusion about what's actually being evaluated.

</details>

<details>
<summary>Session State Value</summary>

**Approach:** Use session state exclusively to track open/closed state.

```python
st.tabs(["A", "B"], key="tabs", on_change="rerun")
if st.session_state.tabs == "A":
    st.write("Tab A content")
elif st.session_state.tabs == "B":
    st.write("Tab B content")

st.expander("Details", key="exp", on_change="rerun")
if st.session_state.exp:
    st.write("Expander content")
```

**Pros:**

- ✅ Consistent with existing widget patterns
- ✅ Familiar to users who understand session state

**Cons:**

- ❌ Verbose - requires explicit key parameter every time
- ❌ Requires understanding of keys and session state (higher learning curve)
- ❌ Less intuitive than accessing state directly from the element
- ❌ Disconnects the state check from the element definition

**Why not selected:** Too verbose and requires extra boilerplate (keys) for a common use case.

</details>

<details>
<summary>Function Argument</summary>

**Approach:** Pass functions as arguments that get called only when the tab/expander is visible.

```python
def show_expander(exp):
    exp.write("Heavy content")

st.expander("Show details", func=show_expander)

def show_tab_a(tab):
    tab.write("Tab A content")

def show_tab_b(tab):
    tab.write("Tab B content")

st.tabs({"A": show_tab_a, "B": show_tab_b})
```

**Pros:**

- ✅ Automatic lazy execution (no manual `if` checks needed)
- ✅ Clean separation of tab/expander content
- ✅ Could potentially auto-fragment for better performance
- ✅ Aligns with lazy-loading patterns like deferred `st.download_button`

**Cons:**

- ❌ **Auto-fragmentation impractical** - Would impose fragment restrictions:
  - Cannot use `st.sidebar` directly
  - Widgets cannot write to external containers (breaks shared output area pattern)
  - Elements accumulate/duplicate in external containers (duplication bug #12762)
  - Unlike `st.dialog` (isolated modals), tabs are part of main app flow where these patterns are common
- ❌ Not incrementally adoptable - requires refactoring existing code into functions
- ❌ Implicit execution - less clear when code runs
- ❌ No clear pattern in Streamlit (between widgets with `on_change` and decorators like `@st.fragment`)
- ❌ Programmatic control would still require adding `key` parameter and using session state

**Why not selected:** Would require refactoring existing code, and auto-fragmentation (the main performance benefit) is impractical due to common usage patterns that fragments don't support. Without auto-fragmentation, it offers no performance advantage over the selected approach.

</details>

<details>
<summary>Function Decorator</summary>

**Approach:** Use a decorator pattern similar to `@st.fragment` and `@st.dialog`.

```python
@st.expander("Show details")
def show_expander():
    st.write("Heavy content")

show_expander()
```

**Pros:**

- ✅ Consistent with `@st.fragment` and `@st.dialog` decorators
- ✅ Clean, Pythonic pattern

**Cons:**

- ❌ **Unclear how this works for `st.tabs`** with multiple functions
- ❌ Should content automatically be a fragment? If so, inherits all fragment limitations (see Option 2)
- ❌ Creates two ways to use `st.expander`/`st.tabs`/`st.popover` - confusing for users
- ❌ Not incrementally adoptable - requires refactoring to functions
- ❌ Less flexible than context manager pattern

**Why not selected:** Doesn't scale well to multi-tab scenarios, would create confusing dual APIs for the same elements, and inherits fragment limitations if auto-fragmented.

</details>

## Design Rationale

**Selected Approach:** `.open` attribute + `on_change` parameter

**SteerCo Decision (Oct 15, 2024):** Strong support for this approach - described as "easier to grow into" and "feels more at home with Streamlit APIs"

**Key reasons:**

1. ✅ **Consistency:** Matches `on_change` pattern established for chart/dataframe/map selections
2. ✅ **Explicitness:** `if tabs[i].open:` clearly shows execution flow
3. ✅ **Incremental adoption:** Can be added to existing code without refactoring
4. ✅ **Programmatic control:** Well-defined via session state (established pattern)
5. ✅ **No forced limitations:** Users can optionally use `@st.fragment` when needed (not forced)
6. ✅ **Intuitive:** State is accessible directly from the element itself

**Trade-off:** Full app rerun on tab switch/expander toggle (acceptable - avoids fragment restrictions that would break `st.sidebar`, external containers, etc.). Users can still optimize performance by wrapping tab/expander content in `@st.fragment` as needed.

---

## Checklist

| Item                       | ✅ or comment                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Yes - uses session_state and widget callbacks (supported everywhere)                                                                                                                                     |
| No breaking API changes    | ✅ Yes - new parameters are optional, existing code works unchanged                                                                                                                                         |
| No new dependencies        | ✅ Yes - uses existing infrastructure                                                                                                                                                                       |
| Metrics collected          | ✅ Yes                                                                                                                                                                                                      |
| Any security/legal impact? | ✅ No - uses existing session_state mechanism                                                                                                                                                               |
| Any docs changes needed?   | ✅ Yes - Explain trade-off: instant switching (static) vs lazy loading (dynamic), document programmatic control pattern, show performance optimization use cases, cookbook recipe for expensive tab content |
| Any other risks?           | None identified                                                                                                                                                                                             |

---

## References

- **Prototype PR:** [#13277](https://github.com/streamlit/streamlit/pull/13277)
- **Related PRs:** [#13233 - st.Tab class spec](https://github.com/streamlit/streamlit/pull/13233)
- **GitHub Issues:**
  - [#6004](https://github.com/streamlit/streamlit/issues/6004) - Dynamic tabs (230 👍)
  - [#2399](https://github.com/streamlit/streamlit/issues/2399) - st.expander expanded/collapsed state (93 👍)
  - [#8239](https://github.com/streamlit/streamlit/issues/8239) - st.tabs & expander frontend state/mount handling (79 👍)
