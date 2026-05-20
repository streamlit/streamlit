# Widget State Persistence Research

This document analyzes the current state of widget state persistence in Streamlit, user pain points, and potential API solutions. The canonical issue is [#6074](https://github.com/streamlit/streamlit/issues/6074).

## Current Behavior

### How Widget State Works Today

When a widget with a `key` parameter is rendered, its value is stored in `st.session_state` and can be accessed via `st.session_state[key]`. However, **widget state is only preserved while the widget is actively rendered**.

The cleanup mechanism is in `lib/streamlit/runtime/state/session_state.py`:

```python
def _remove_stale_widgets(self, active_widget_ids: frozenset[str]) -> None:
    """Remove widget state for stale widgets."""
    # ...
    self._new_widget_state.remove_stale_widgets(
        active_widget_ids,
        ctx.fragment_ids_this_run,
    )
    # Remove entries from _old_state corresponding to stale widgets.
    self._old_state = {
        k: v
        for k, v in self._old_state.items()
        if (
            not is_element_id(k)
            or not _is_stale_widget(
                self._new_widget_state.widget_metadata.get(k),
                active_widget_ids,
                ctx.fragment_ids_this_run,
            )
        )
    }
```

A widget is considered "stale" when its ID is not in `active_widget_ids` for the current script run.

### What Happens on Page Transitions

In multi-page apps (MPA), when a user switches pages:

1. The new page script runs
2. Widgets from the previous page are not rendered
3. Their widget IDs are not in `active_widget_ids`
4. They are marked as stale and their state is deleted from session_state

This was a deliberate design decision documented in [#5813](https://github.com/streamlit/streamlit/issues/5813#issuecomment-1338155093):

> "MPA are 'separate' apps. Values set by session state are preserved, but values set by widget state (in session state) will disappear in the next run after the widget is removed."

### The Pain Point

Users expect that:
1. Assigning a `key` to a widget means its value will persist in `st.session_state`
2. The state should survive when the widget is conditionally hidden
3. The state should survive page transitions in MPAs

The documentation is ambiguous about this:
- Session State API reference says "Every widget with a key is automatically added to Session State"
- Multipage Apps docs say "Pages share the same st.session_state"

The actual behavior creates a "third mode" of state that is "persistent, but only sometimes" - confusing to users.

## User Impact

### Summary of User Complaints

From the GitHub issues:

1. **Confusion and frustration**: "There is a thread about 'why am I losing my widget state?' every other day" on the Streamlit forum (@matkozak, #5813)

2. **Code littered with workarounds**: Users create callback functions solely to copy "fake" widget state to "real" persistent state

3. **Multi-page app pain**: Organizations with 20+ multipage apps find the default behavior useless (@OSalama, #6074)

4. **Complex workarounds required**: Users implement "shadow key" patterns that are fragile and add complexity

### Common Use Cases

1. **Multi-step forms**: User fills out filters/settings on Page 1, views results on Page 2, returns to Page 1 expecting their selections to persist

2. **Dashboard with dependent filters**: Page A has category selection, Page B filters by that category

3. **Conditional widget visibility**: A toggle shows/hides an advanced options section; users expect those options to persist when hidden

4. **Tab-based interfaces**: Each tab has widgets; switching tabs should not reset the other tabs' state

### Current Workarounds

**1. Shadow Keys Pattern** (from @devxpy, #5620):
```python
key = "foo"
shadow_key = "_foo"

if key in st.session_state and shadow_key not in st.session_state:
    st.session_state[shadow_key] = st.session_state[key]

value = st.text_input("Set the value", key=shadow_key)
st.session_state[key] = value
```

**2. Callback-Based Persistence**:
```python
def persist_value():
    st.session_state["_persisted_foo"] = st.session_state["foo"]

st.text_input("Foo", key="foo", on_change=persist_value)
```

**3. Session State Update Hack**:
```python
# At the start of each page
st.session_state.update(st.session_state)
```

**4. Custom Wrapper Libraries**: Community packages like `streamlit-qs`, `multipage_streamlit` that wrap widgets.

## Codebase State

### Relevant Code Locations

| File | Purpose |
|------|---------|
| `lib/streamlit/runtime/state/session_state.py` | Core session state logic, stale widget cleanup |
| `lib/streamlit/runtime/state/common.py` | `WidgetMetadata`, `BindOption` type definitions |
| `lib/streamlit/runtime/state/widgets.py` | Widget registration, bind validation |
| `lib/streamlit/runtime/state/query_params.py` | Query param binding infrastructure |
| `lib/streamlit/navigation/page.py` | MPA page handling |

### Existing Partial Solutions

#### 1. `bind="query-params"` (Implemented)

The `bind="query-params"` parameter is **fully implemented** across most widgets. It syncs widget state to URL query parameters, effectively persisting state across page navigations via the URL.

```python
st.text_input("Name", key="name", bind="query-params")
# URL becomes: ?name=John
```

**Widgets with bind support:**
- `st.text_input`, `st.text_area`
- `st.number_input`
- `st.selectbox`, `st.radio`, `st.multiselect`
- `st.checkbox`, `st.toggle`
- `st.slider`, `st.select_slider`
- `st.date_input`, `st.time_input`, `st.datetime_input`
- `st.color_picker`
- `st.pills`, `st.segmented_control`
- `st.pagination`

The implementation preserves bound values across page transitions by storing them under the user key in `_old_state`:

```python
# From session_state.py _remove_stale_widgets
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

# Re-add preserved query-param-bound values under user keys.
self._old_state.update(bound_preserved)
```

#### 2. Layout Container State Persistence (Implemented)

For `st.tabs`, `st.expander`, and `st.popover`, frontend-side state persistence was implemented via the `WidgetStateManager.elementStates` store. This preserves which tab is active or whether an expander is open across reruns caused by conditional rendering above them.

See `specs/2026-02-26-layout-container-state-persistence/tech-spec.md`.

### What's NOT Implemented

The `persist_state` parameter proposed in `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md` is **NOT implemented**:

```python
# Proposed but NOT YET AVAILABLE:
st.widget(..., persist_state=None|"page"|"session")
```

This would allow widgets to persist their state:
- `persist_state="page"`: Keep state if not rendered, delete on page switch
- `persist_state="session"`: Keep state for the entire session (even if not rendered or across pages)

## Prior Art / Proposals

### 1. Existing Spec: Query Param Binding & State Persistence

**Location**: `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md`

**Proposed API**:
```python
st.widget(..., bind="query-params")
st.widget(..., persist_state=None|"page"|"session")
```

**Status**: `bind="query-params"` is implemented; `persist_state` is not.

### 2. Navigation-Level Preservation

From @jrieke in #5813:
> "One idea here could also be to do something like `st.navigation(..., preserve_state=True)` to keep all values in session state preserved across page changes."

### 3. Community Proposals

**@MathCatsAnd** suggested a `persist` keyword argument:
- `persist='key'`: Exclude the key from cleanup when widget unmounts
- `persist='widget'`: Preserve entire widget state (front and back end) for re-association

**@OSalama** built a Streamlit proxy object that intercepts widget calls and persists values to a separate dictionary.

### 4. Alternatives Considered in Spec

| Option | Description | Status |
|--------|-------------|--------|
| Separate params: `bind` + `persist_state` | Two parameters for clarity | Proposed |
| Combined param: `persist=["query-params", "session"]` | Single parameter with list values | Considered, rejected for complexity |
| `st.query_params.bind("key")` | Method-based binding | Considered, rejected as "magical" |
| `key="?foo"` magic prefix | Clever but not discoverable | Rejected |

## Potential API Solutions

### Option 1: Per-Widget `persist_state` Parameter

**From the existing spec, the recommended approach:**

```python
# Persist state when widget is not rendered (same page)
st.text_input("Name", key="name", persist_state="page")

# Persist state across all pages and conditional rendering
st.selectbox("Category", options, key="category", persist_state="session")
```

**Implementation**:
- Add `persist_state` to `WidgetMetadata`
- In `_remove_stale_widgets`, check metadata before removing
- `"page"` widgets survive not-rendered but clear on page change
- `"session"` widgets never get cleaned up based on staleness

**Pros**:
- Very explicit - each widget declares its persistence scope
- Follows existing `bind` parameter pattern
- Progressive disclosure: most widgets don't need it
- Clear separation of concerns from query params

**Cons**:
- Adds another parameter to every widget
- Requires touching all widget implementations

**Implementation Complexity**: Medium
- Backend changes to `SessionState._remove_stale_widgets`
- Add `persist_state` to all widget signatures
- Update `WidgetMetadata` dataclass

---

### Option 2: Navigation-Level `preserve_state`

```python
# All widgets on pages managed by this navigation preserve state
pg = st.navigation([page1, page2], preserve_state=True)

# Or more granular:
pg = st.navigation([page1, page2], preserve_state="widgets")  # Only widgets
pg = st.navigation([page1, page2], preserve_state="all")      # Everything
```

**Implementation**:
- Add `preserve_state` to `st.navigation`
- Store flag in context
- `_remove_stale_widgets` checks context flag before cleanup

**Pros**:
- Single opt-in covers all widgets in the app
- No changes to individual widget APIs
- Matches user mental model of "pages share state"
- Low migration distance

**Cons**:
- All-or-nothing: can't selectively persist
- Doesn't help with conditional rendering within a page
- May cause stale state surprises (the original reason for cleanup)

**Implementation Complexity**: Low
- Add parameter to `st.navigation`
- Modify cleanup logic to check context flag

---

### Option 3: Explicit State Declaration with `st.persist`

```python
# Declare persistent keys upfront
st.persist("name", "category", "filters")

# Widgets with these keys now persist
st.text_input("Name", key="name")
st.selectbox("Category", options, key="category")
```

**Implementation**:
- New `st.persist(*keys)` command
- Stores persistent key set in session context
- Cleanup skips keys in the persistent set

**Pros**:
- Explicit declaration of intent
- Can be called once per app, not per widget
- Separates persistence policy from widget definition
- Works for both widget and non-widget state

**Cons**:
- New concept to learn
- Disconnect between declaration and usage
- Easy to forget to update when adding widgets

**Implementation Complexity**: Low-Medium
- New command implementation
- Modify cleanup to check persistent set

---

### Option 4: Global Configuration

```toml
# .streamlit/config.toml
[runner]
preserve_widget_state = true
# or
preserve_widget_state = "session"  # "page" | "session" | false
```

**Implementation**:
- Add config option
- Cleanup logic checks config

**Pros**:
- Zero code changes for existing apps
- Environment-specific (dev vs prod)

**Cons**:
- Binary choice, no granularity
- Hidden behavior - hard to understand code
- Doesn't help with selective persistence
- Violates "explicit over implicit" principle

**Implementation Complexity**: Low

---

### Option 5: Hybrid - Default Change + Per-Widget Override

```python
# Change default: widgets with keys now persist by default
# Explicit cleanup when needed:
st.text_input("Temp Value", key="temp", persist_state="none")

# Or explicit short-lived scope:
st.text_input("Search", key="search", persist_state="run")
```

**This would be a breaking change** but could be introduced with:
1. A deprecation period
2. A config flag to opt into new behavior
3. An `st.experimental_persist_state_default(True)` command

**Pros**:
- Matches user expectations
- No boilerplate for common case

**Cons**:
- Breaking change
- May cause stale state bugs in existing apps
- Long migration path

**Implementation Complexity**: Medium-High (mostly due to migration)

## Recommendation

### Primary Recommendation: Option 1 (Per-Widget `persist_state`)

This aligns with the existing spec and follows Streamlit design principles:

1. **Explicit Over Implicit**: Each widget declares its persistence scope
2. **Progressive Disclosure**: Default behavior unchanged; opt-in for persistence
3. **Consistency**: Follows the pattern established by `bind`
4. **Minimal Migration Distance**: Existing apps continue to work unchanged

**Suggested Implementation Order**:

1. **Phase 1**: Implement `persist_state="session"` only
   - Simplest case: skip stale cleanup entirely for these widgets
   - Covers the primary MPA use case
   - Can ship quickly for user feedback

2. **Phase 2**: Add `persist_state="page"` if needed
   - More nuanced: track page transitions
   - May not be needed if `"session"` solves most problems

**Example Usage**:
```python
# streamlit_app.py (entrypoint)
import streamlit as st

pg = st.navigation([
    st.Page("filters.py", title="Filters"),
    st.Page("results.py", title="Results"),
])
pg.run()

# filters.py
import streamlit as st

# This selection persists when viewing results page
category = st.selectbox(
    "Category",
    ["A", "B", "C"],
    key="category",
    persist_state="session"
)
st.write(f"Selected: {category}")

# results.py
import streamlit as st

# Can access the persisted value
category = st.session_state.get("category", "A")
st.write(f"Results for category: {category}")
```

### Secondary Recommendation: Consider Option 2 as a Complement

For users who want blanket persistence across their MPA without modifying every widget, adding `preserve_state=True` to `st.navigation` would be a useful convenience:

```python
pg = st.navigation([page1, page2], preserve_state=True)
```

This could be implemented as syntactic sugar that internally sets `persist_state="session"` on all widgets rendered during the navigation context.

### What to Avoid

- **Breaking changes to default behavior**: Too disruptive, long migration
- **"Clever" API designs**: `key="?persist:foo"` or similar - hard to discover
- **Global config only**: Not granular enough, violates explicit > implicit

## Open Questions

1. **Should `persist_state="session"` require `key`?** 
   - Probably yes, for the same reason `bind="query-params"` does

2. **Interaction with `bind="query-params"`?**
   - If both are set, should URL take precedence?
   - The spec suggests they can be combined: persist locally AND sync to URL

3. **What happens when widget arguments change?**
   - Current behavior: widget is recreated with new identity
   - Should this clear persisted state? Probably yes.

4. **Fragment behavior?**
   - Widgets in fragments already have special handling
   - Need to ensure `persist_state` interacts correctly

5. **Session boundaries?**
   - `persist_state="session"` clearly means browser session
   - No cross-session persistence (that would be `bind="localstorage"` future work)

## References

- [#6074](https://github.com/streamlit/streamlit/issues/6074) - Canonical issue
- [#5813](https://github.com/streamlit/streamlit/issues/5813) - Adrien's summary
- [#4458](https://github.com/streamlit/streamlit/issues/4458) - Original persist proposal
- [#9325](https://github.com/streamlit/streamlit/issues/9325) - Query params binding discussion
- `specs/2026-01-06-query-param-binding-state-persistence/product-spec.md` - Existing spec
- `specs/2026-02-26-layout-container-state-persistence/tech-spec.md` - Layout container precedent
- [Streamlit Forum Discussion](https://discuss.streamlit.io/t/keyed-widget-state-persistence-discussion-possible-fixes/37359) - Community discussion
