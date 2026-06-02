# Widget State Persistence Research

**Research Date:** June 2026  
**Canonical Issue:** [#6074](https://github.com/streamlit/streamlit/issues/6074)  
**Related Issues:** [#5813](https://github.com/streamlit/streamlit/issues/5813), [#4458](https://github.com/streamlit/streamlit/issues/4458), [#7338](https://github.com/streamlit/streamlit/issues/7338)

---

## Current Behavior

### How Widget State Works Today

Streamlit maintains widget state in `st.session_state` through a multi-layered system:

1. **Widget Registration**: When a widget is rendered, it registers with `SessionState.register_widget()` which:
   - Creates a `WidgetMetadata` object containing deserializer, serializer, callbacks, etc.
   - Maps the user-provided `key` to an internal widget ID via `KeyIdMapper`
   - Stores the widget's value in `_new_widget_state`

2. **Widget Identity**: A widget's identity is computed via `compute_element_id()` which hashes:
   - The element type (e.g., `"text_input"`)
   - All widget parameters (label, default value, options, etc.)
   - The active script hash (page identifier in MPA)
   - The user-provided key (if any)

3. **State Storage**: Widget state lives in three places within `SessionState`:
   - `_new_widget_state`: Values from the current run (from frontend interactions)
   - `_new_session_state`: Values set programmatically via `st.session_state[key] = value`
   - `_old_state`: Compacted state from previous runs

### What Happens on Page Transitions (MPA)

When a user navigates between pages in a multi-page app:

1. The entrypoint script reruns with a different `active_script_hash`
2. Widgets on the previous page are not rendered in the new run
3. At the end of the script run, `on_script_finished()` calls `_remove_stale_widgets()`
4. Any widget whose ID is not in `active_widget_ids` is marked as stale
5. Stale widget state is removed from `_new_widget_state` and `_old_state`
6. The `key → widget_id` mapping is also cleaned up

### The Exact Pain Point

The core issue is this: **even with an explicit `key=`, widget state is deleted when the widget is not rendered**.

```python
# Page 1
name = st.text_input("Name", key="user_name")  # User types "Alice"

# User navigates to Page 2, then back to Page 1
# The text_input shows "" (empty), not "Alice"
```

This happens because:
1. On Page 2, the `text_input` with `key="user_name"` is not rendered
2. The stale widget cleanup removes `user_name` from session state
3. When returning to Page 1, the widget gets its default value (empty string)

### Code Path for Stale Widget Cleanup

```python
# lib/streamlit/runtime/state/session_state.py

def _is_stale_widget(
    metadata: WidgetMetadata[Any] | None,
    active_widget_ids: frozenset[str],
    fragment_ids_this_run: list[str] | None,
) -> bool:
    if not metadata:
        return True
    # Widget is stale if not in active set AND not preserved by fragment logic
    return not (
        metadata.id in active_widget_ids
        or (fragment_ids_this_run and metadata.fragment_id not in fragment_ids_this_run)
    )

def _remove_stale_widgets(self, active_widget_ids: frozenset[str]) -> None:
    """Remove widget state for widgets whose ids aren't in `active_widget_ids`."""
    # ... removes from _new_widget_state and _old_state
```

---

## User Impact

### Summary of Complaints from Issues

From **#6074** (canonical, 180+ upvotes):
- "@kmcgrady: MPA demonstrates this problem by switching pages effectively removes widgets from session_state"
- "@matkozak: passing `key` to the widget is an explicit attempt to save the widget state... it does not actually do that"
- "@jelledijkstra97: this behaviour makes it pretty much impossible to use it when working with a lot of filter settings"
- "@OSalama: My organization has over 20 multipage Streamlit apps, and none of them find the current default useful"

From **#5813** (Adrien's summary):
- "@kmcgrady: We identified [per-page scope] as the model... I will leave this issue open to get feedback"
- "@jrieke: One idea here could be `st.navigation(..., preserve_state=True)` to keep all values preserved across page changes"

From **#4458** (original persist request):
- "@whitphx: Even though I introduced a multi page-like example... my interest was only the state of unrendered components in a single page"
- Multiple users requesting a `persist=` flag on widgets

### Common Use Cases Affected

1. **Multi-step forms across pages**: User fills Page 1 form, goes to Page 2, returns to find Page 1 form reset
2. **Shared filters**: Filter widgets on multiple pages should share state
3. **Conditional rendering**: Widgets inside `if` blocks lose state when condition toggles
4. **Tab-based layouts**: Before recent fixes, switching tabs could reset widget values
5. **Complex dashboards**: Multiple interdependent widgets across pages/tabs

### Current Workarounds (Community Patterns)

**Shadow Keys Pattern** (most common):
```python
key = "foo"
shadow_key = "_foo"

if key in st.session_state and shadow_key not in st.session_state:
    st.session_state[shadow_key] = st.session_state[key]

value = st.text_input("Set foo", key=shadow_key)
st.session_state[key] = value
```

**Session State Update Hack**:
```python
# At the start of each page
st.session_state.update(st.session_state)
```

**Manual Callback Persistence**:
```python
def save_state():
    st.session_state["_persisted_name"] = st.session_state["name"]

st.text_input("Name", key="name", on_change=save_state)
```

---

## Codebase State

### Existing Infrastructure: `bind="query-params"`

The `bind="query-params"` feature was implemented in early 2026 and provides a template for state persistence. It:

1. **Binds widget values to URL query parameters** so they survive page refresh
2. **Preserves values across MPA page transitions** via special handling in `_remove_stale_widgets`:

```python
# session_state.py lines 912-956
# Before cleanup, capture values for bound stale widgets
bound_preserved: dict[str, Any] = {}
for key in self._old_state:
    if (
        is_element_id(key)
        and key in self._query_param_bound_widget_ids
        and key in wid_key_map
        and _is_stale_widget(...)
    ):
        user_key = wid_key_map[key]
        bound_preserved[user_key] = self._getitem(key, user_key)

# ... cleanup happens ...

# Re-add preserved query-param-bound values under user keys
self._old_state.update(bound_preserved)
```

This same pattern could be extended for `persist_state`.

### Layout Container State Persistence

A tech spec (`specs/2026-02-26-layout-container-state-persistence/tech-spec.md`) was implemented for `st.tabs`, `st.expander`, and `st.popover`. Key insights:

- Uses **frontend-only state** via `WidgetStateManager.elementStates`
- Stable identity via `Block.id` computed with `compute_and_register_element_id`
- Does NOT register as a widget (avoids `session_state[key]` pollution)
- State resets on page refresh (intentional)

### What's NOT Yet Implemented

The `persist_state=None|"page"|"session"` parameter proposed in the spec (`specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`) has **not been implemented**. The spec proposes:

```python
st.widget(..., persist_state=None|"page"|"session")
```

Where:
- `None`: Current behavior (delete when not rendered)
- `"page"`: Persist if not rendered, delete on page switch
- `"session"`: Persist for entire session (even across pages)

---

## Prior Art / Proposals

### 1. Product Spec: Query Param Binding & State Persistence

**Location:** `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`

**Proposed API:**
```python
st.widget(..., bind="query-params")
st.widget(..., persist_state=None|"page"|"session")
```

**Status:** `bind="query-params"` is implemented; `persist_state` is not.

### 2. Tech Spec: Layout Container State Persistence

**Location:** `specs/2026-02-26-layout-container-state-persistence/tech-spec.md`

**Approach:** Frontend-only state storage using `elementStates`, triggered by providing `key=`.

**Status:** Implemented for `st.tabs`, `st.expander`, `st.popover`.

### 3. Community Proposals

**@jrieke's Navigation Preserve State:**
```python
st.navigation(..., preserve_state=True)
```
Keep all values in session state preserved across page changes.

**@MathCatsAnd's Widget-Level Persist Flag:**
```python
st.text_input(..., persist='key')  # Exclude key from cleanup
st.text_input(..., persist='widget')  # Preserve full widget state
```

**@devxpy's View:** Make persistence the default, provide explicit clear method:
```python
st.session_state.pop(key, None)  # or st.session_state.clear()
```

---

## Potential API Solutions

### Option 1: Per-Widget `persist_state` Parameter (Recommended)

```python
# Default: current behavior
name = st.text_input("Name", key="user_name")

# Persist across conditional rendering, but reset on page switch
name = st.text_input("Name", key="user_name", persist_state="page")

# Persist across pages and conditional rendering
name = st.text_input("Name", key="user_name", persist_state="session")
```

**Pros:**
- Very explicit and discoverable
- Progressive disclosure (opt-in)
- Matches the existing spec proposal
- Can be combined with `bind="query-params"` for URL persistence
- Consistent with Streamlit's pattern of widget-level control

**Cons:**
- Adds a new parameter to every widget (API surface growth)
- Users must opt-in for each widget individually
- Migration: existing apps don't automatically benefit

**Implementation Complexity:** Medium
- Extend `WidgetMetadata` with `persist_state` field
- Modify `_remove_stale_widgets` to check persistence mode
- Add tracking for `"page"` vs `"session"` scoped widgets

---

### Option 2: Navigation-Level `preserve_state` Flag

```python
pg = st.navigation([
    st.Page("page1.py"),
    st.Page("page2.py"),
], preserve_state=True)  # All widget state persists
```

**Pros:**
- Single flag for entire app
- No changes to individual widgets
- Easy migration path

**Cons:**
- All-or-nothing (no granular control)
- Doesn't help single-page apps with conditional widgets
- May lead to stale state surprises
- Conflicts with "pages as isolated mini-apps" model

**Implementation Complexity:** Low
- Skip stale widget cleanup when `preserve_state=True`
- Pass flag through navigation context

---

### Option 3: Global Config Option

```toml
# .streamlit/config.toml
[runner]
persistWidgetState = true
```

```python
# Or programmatically
st.set_option("runner.persistWidgetState", True)
```

**Pros:**
- Zero code changes for existing apps
- Easy to enable/disable globally

**Cons:**
- No granular control
- "Magic" behavior change
- Hard to understand app behavior from code alone
- Can't mix approaches in same app

**Implementation Complexity:** Low
- Read config in `_remove_stale_widgets`
- Skip cleanup when enabled

---

### Option 4: Change the Default Behavior

Make widget state persist by default (with explicit `key=`), add `persist_state=False` to opt-out:

```python
# Old default (current): state deleted when not rendered
# New default: state persists if key is provided
name = st.text_input("Name", key="user_name")  # Now persists!

# Explicit opt-out
temp = st.text_input("Temp", key="temp", persist_state=False)
```

**Pros:**
- Matches user expectations better
- Existing apps with keys get persistence for free
- Reduces boilerplate

**Cons:**
- **Breaking change** for apps relying on cleanup
- May cause unexpected stale state bugs
- Migration distance is high
- Goes against "explicit over implicit" principle

**Implementation Complexity:** Medium
- Change default in `_is_stale_widget` logic
- Deprecation/migration path needed

---

### Option 5: Hybrid Approach (Most Flexible)

Combine per-widget control with a navigation-level default:

```python
# Set default for all widgets in this navigation
pg = st.navigation([...], default_persist_state="session")

# Individual widgets can override
name = st.text_input("Name", key="user_name")  # Uses "session"
temp = st.text_input("Temp", key="temp", persist_state=None)  # Explicit no-persist
```

**Pros:**
- Best of both worlds: global convenience + granular control
- Progressive disclosure
- Easy migration (set global default, then refine)

**Cons:**
- More complex mental model
- Two places to check for persistence behavior
- Implementation is more involved

**Implementation Complexity:** Medium-High
- Implement Option 1 first
- Add `default_persist_state` to navigation
- Inherit default when widget doesn't specify

---

## Recommendation

**Primary Recommendation: Option 1 (Per-Widget `persist_state`)**

This aligns with:
1. The existing product spec at `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`
2. Streamlit's API design principles:
   - **Explicit over implicit**: Users opt-in to persistence
   - **Progressive disclosure**: Simple case stays simple
   - **Sensible defaults**: Current behavior doesn't change
   - **Minimize migration distance**: Existing apps continue to work

**Implementation Strategy:**

1. **Phase 1**: Implement `persist_state="session"` first
   - Most requested behavior
   - Simpler than `"page"` (no page-tracking needed)
   - Can reuse `_query_param_bound_widget_ids` pattern

2. **Phase 2**: Add `persist_state="page"` if there's demand
   - Requires tracking which widgets belong to which page
   - More complex cleanup logic

3. **Phase 3 (Optional)**: Consider Option 5 hybrid if users want navigation-level defaults

**Secondary Consideration: Option 2 for Quick Win**

If the team wants a faster solution for MPA specifically, `st.navigation(..., preserve_state=True)` could be implemented as a simpler stopgap. However, this doesn't address single-page conditional rendering issues.

---

## Implementation Notes

### Key Code Locations

| Component | File | Purpose |
|-----------|------|---------|
| Stale widget cleanup | `lib/streamlit/runtime/state/session_state.py:_remove_stale_widgets` | Main cleanup logic |
| Widget metadata | `lib/streamlit/runtime/state/common.py:WidgetMetadata` | Add `persist_state` field |
| Widget registration | `lib/streamlit/runtime/state/widgets.py` | Validation for `persist_state` |
| Query param binding | `lib/streamlit/runtime/state/query_params.py` | Pattern for bound widgets |

### Existing Infrastructure to Leverage

1. **`_query_param_bound_widget_ids`**: Already tracks widgets that should survive cleanup
2. **`bound_preserved` pattern**: Shows how to preserve values under user keys
3. **`compute_and_register_element_id`**: Stable identity computation
4. **`KeyIdMapper`**: Key → widget ID mapping

### Edge Cases to Consider

1. **Conflicting keys across pages**: What if two pages have `key="name"` with different widget types?
2. **Programmatic state changes**: Should `st.session_state["key"] = value` work for persisted widgets?
3. **Type changes**: Widget type changes (selectbox → text_input) with same key
4. **Fragment interaction**: How does persistence interact with `@st.fragment`?
5. **Cache interaction**: Widgets inside `@st.cache_data` functions

---

## Appendix: Issue Thread Highlights

### From @kmcgrady (Streamlit team, #6074)

> "MPA are 'separate' apps. Values set by session state are preserved, but values set by widget state will disappear in the next run after the widget is removed."

### From @matkozak (#6074)

> "The fact that the saving is conditional on the widget being there and that fact is not very explicitly sign-posted in the description of the `key` parameter is very confusing to newcomers."

### From @sfc-gh-jcarroll (Streamlit team, #6074)

> "Yes, if the widget arguments change, we will always re-create the widget and clear any prior values/state. I don't think there's any consideration to change that behavior."

### From @AnOctopus (Streamlit team, #7338)

> "Both [widgets on other pages persist] and [widgets on other pages reset] are perfect for some apps but would break others... A proper fix will require a notion of widget persistence."
