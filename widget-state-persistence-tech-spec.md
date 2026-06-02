---
author: cursor-agent
created: 2026-06-02
---

# Widget State Persistence (`persist_state`) Tech Spec

## Summary

This spec describes the implementation of `persist_state=None|"page"|"session"` for widgets,
allowing developers to opt in to preserving widget values across conditional rendering and/or
page switches. The implementation extends the existing `bind="query-params"` pattern, which
already solves the same core problem of preserving widget values that would otherwise be
cleaned up as stale.

## Problem

Today, widget state is cleaned up when a widget is not rendered in a script run:

- **Conditional rendering:** If a widget is inside an `if` block that evaluates to `False`,
  the widget's value is deleted from session state.
- **Page switches:** In MPA apps, page script hash factors into widget identity. Switching
  pages clears widget state from the previous page.

Both behaviors are intentional (avoid stale state surprises, keep session state clean), but
sometimes developers want to preserve state across these transitions.

See the [product spec](specs/2026-01-06-query-param-binding-state-persistence/product-spec.md)
for the full problem description and API design.

## Proposal

### Background: `bind="query-params"` Execution Flow

The `persist_state` implementation extends the existing `bind="query-params"` pattern.
Understanding this flow is essential:

```python
# lib/streamlit/runtime/state/widgets.py
def register_widget(..., bind: BindOption = None, ...):
    # 1. Validate binding requires explicit key
    if bind == "query-params":
        user_key = user_key_from_element_id(element_id)
        if user_key is None:
            raise StreamlitAPIException(
                "When using bind='query-params', the widget must have a unique 'key'..."
            )

    # 2. Create metadata with bind field
    metadata = WidgetMetadata(
        element_id,
        ...,
        bind=bind,  # Stored in metadata for later checks
    )
    return register_widget_from_metadata(metadata, ctx)
```

```python
# lib/streamlit/runtime/state/session_state.py
class SessionState:
    # Durable set tracking which widget IDs have bind="query-params"
    # Survives MPA page transitions where metadata may be gone by cleanup time
    _query_param_bound_widget_ids: set[str] = field(default_factory=set)

    def register_widget(self, metadata: WidgetMetadata[T], user_key: str | None):
        widget_id = metadata.id

        # 3. Track bound widgets in durable set
        if metadata.bind == "query-params" and user_key is not None:
            self._query_param_bound_widget_ids.add(widget_id)
            # ... handle URL seeding ...
        elif metadata.bind is None and user_key is not None:
            # Widget stopped using bind - clean up
            self._query_param_bound_widget_ids.discard(widget_id)

        # ... rest of registration ...
```

```python
# lib/streamlit/runtime/state/session_state.py
def _remove_stale_widgets(self, active_widget_ids: frozenset[str]) -> None:
    ctx = get_script_run_ctx()
    wid_key_map = self._key_id_mapper.id_key_mapping

    # 4. BEFORE cleanup: capture values for bound stale widgets under user keys
    bound_preserved: dict[str, Any] = {}
    for key in self._old_state:
        if (
            is_element_id(key)
            and key in self._query_param_bound_widget_ids  # <-- check durable set
            and key in wid_key_map
            and _is_stale_widget(
                self._new_widget_state.widget_metadata.get(key),
                active_widget_ids,
                ctx.fragment_ids_this_run,
            )
        ):
            user_key = wid_key_map[key]
            bound_preserved[user_key] = self._getitem(key, user_key)

    # 5. Remove stale widget state (normal cleanup)
    self._new_widget_state.remove_stale_widgets(active_widget_ids, ctx.fragment_ids_this_run)
    self._old_state = {
        k: v for k, v in self._old_state.items()
        if not is_element_id(k) or not _is_stale_widget(...)
    }

    # 6. AFTER cleanup: re-inject preserved values under user keys
    self._old_state.update(bound_preserved)
```

Key insight: The `bound_preserved` pattern saves widget values under **user keys** before
cleanup, then re-injects them after cleanup. This allows the widget to re-register on the
next run and find its preserved value via the user key lookup path.

### New `persist_state` Parameter

Add `persist_state` to `WidgetMetadata` and track persisted widgets in a durable set,
analogous to `_query_param_bound_widget_ids`:

```python
# lib/streamlit/runtime/state/common.py
PersistStateOption: TypeAlias = Literal["page", "session"] | None

@dataclass(frozen=True)
class WidgetMetadata(Generic[T]):
    id: str
    deserializer: WidgetDeserializer[T]
    serializer: WidgetSerializer[T]
    value_type: ValueFieldName
    # ... existing fields ...
    bind: BindOption = None
    persist_state: PersistStateOption = None  # NEW
```

```python
# lib/streamlit/runtime/state/widgets.py
def register_widget(
    element_id: str,
    *,
    # ... existing params ...
    persist_state: PersistStateOption = None,  # NEW
) -> RegisterWidgetResult[T]:
    # Validate persist_state requires explicit key
    if persist_state is not None:
        user_key = user_key_from_element_id(element_id)
        if user_key is None:
            raise StreamlitAPIException(
                "When using persist_state, the widget must have a unique 'key' "
                "parameter specified."
            )

    metadata = WidgetMetadata(
        element_id,
        # ... existing fields ...
        persist_state=persist_state,
    )
    return register_widget_from_metadata(metadata, ctx)
```

### Session State Tracking

Add tracking structures and registration logic:

```python
# lib/streamlit/runtime/state/session_state.py
@dataclass(slots=True)
class SessionState:
    # ... existing fields ...
    _query_param_bound_widget_ids: set[str] = field(default_factory=set)

    # NEW: Track persisted widgets by mode
    # Maps widget_id -> persist_state value ("page" or "session")
    _persisted_widget_ids: dict[str, Literal["page", "session"]] = field(
        default_factory=dict
    )
    # NEW: Track the page_script_hash where each persisted widget was last registered
    # Only relevant for persist_state="page" widgets
    _persisted_widget_pages: dict[str, str] = field(default_factory=dict)

    def clear(self) -> None:
        # ... existing clears ...
        self._persisted_widget_ids.clear()
        self._persisted_widget_pages.clear()
```

### Registration Changes

```python
# lib/streamlit/runtime/state/session_state.py
def register_widget(self, metadata: WidgetMetadata[T], user_key: str | None):
    widget_id = metadata.id

    # ... existing query param binding logic ...

    # Handle persist_state
    if metadata.persist_state is not None and user_key is not None:
        self._persisted_widget_ids[widget_id] = metadata.persist_state
        # Track the current page for page-scoped persistence
        ctx = get_script_run_ctx()
        if ctx is not None:
            self._persisted_widget_pages[widget_id] = ctx.page_script_hash
    elif metadata.persist_state is None and user_key is not None:
        # Widget stopped using persist_state - clean up
        self._persisted_widget_ids.pop(widget_id, None)
        self._persisted_widget_pages.pop(widget_id, None)

    # ... rest of registration ...
```

### `persist_state="session"` Implementation

Preserve widget values across all stale cleanup — both conditional rendering and page switches:

```python
# lib/streamlit/runtime/state/session_state.py
def _remove_stale_widgets(self, active_widget_ids: frozenset[str]) -> None:
    ctx = get_script_run_ctx()
    if ctx is None:
        return

    wid_key_map = self._key_id_mapper.id_key_mapping

    # Capture values for both query-param-bound AND persisted stale widgets
    bound_preserved: dict[str, Any] = {}
    for key in self._old_state:
        if not is_element_id(key) or key not in wid_key_map:
            continue

        is_stale = _is_stale_widget(
            self._new_widget_state.widget_metadata.get(key),
            active_widget_ids,
            ctx.fragment_ids_this_run,
        )
        if not is_stale:
            continue

        should_preserve = False
        user_key = wid_key_map[key]

        # Existing: preserve query-param-bound widgets
        if key in self._query_param_bound_widget_ids:
            should_preserve = True

        # NEW: preserve session-scoped persisted widgets unconditionally
        if self._persisted_widget_ids.get(key) == "session":
            should_preserve = True

        # NEW: preserve page-scoped widgets only if still on same page
        if self._persisted_widget_ids.get(key) == "page":
            widget_page = self._persisted_widget_pages.get(key)
            if widget_page == ctx.page_script_hash:
                should_preserve = True
            # If page changed, don't preserve - let cleanup happen

        if should_preserve:
            try:
                bound_preserved[user_key] = self._getitem(key, user_key)
            except KeyError:
                bound_preserved[user_key] = self._old_state[key]

    # ... rest of cleanup unchanged ...
    self._old_state.update(bound_preserved)

    # Cleanup tracking dicts for widgets no longer in key_id_mapper
    self._persisted_widget_ids = {
        wid: mode for wid, mode in self._persisted_widget_ids.items()
        if wid in wid_key_map
    }
    self._persisted_widget_pages = {
        wid: page for wid, page in self._persisted_widget_pages.items()
        if wid in self._persisted_widget_ids
    }
```

### `persist_state="page"` Implementation

Page-scoped persistence preserves values only while on the same page:

- **"Current page"** is `ctx.page_script_hash` (from `pages_manager.current_page_script_hash`)
- When registering a widget with `persist_state="page"`, record its `page_script_hash`
- During stale cleanup, only preserve if the widget's recorded page matches the current page
- On page switch, page-scoped widgets from the old page are cleaned up normally

This is already handled in the code above — the key check is:
```python
if self._persisted_widget_ids.get(key) == "page":
    widget_page = self._persisted_widget_pages.get(key)
    if widget_page == ctx.page_script_hash:
        should_preserve = True
```

### Interaction with `bind="query-params"`

When both `bind="query-params"` and `persist_state` are set:

| Scenario | Behavior |
|----------|----------|
| `bind="query-params"` only | Value preserved via URL sync; URL cleared on page switch |
| `persist_state="session"` only | Value preserved across pages; no URL sync |
| `persist_state="page"` only | Value preserved on same page only; no URL sync |
| `bind="query-params"` + `persist_state="session"` | Value AND URL preserved across pages |
| `bind="query-params"` + `persist_state="page"` | Value preserved on same page; URL cleared on page switch |

Implementation: Both checks are independent in `_remove_stale_widgets`. The `should_preserve`
flag is set if **either** condition matches:

```python
# Query param binding preserves value
if key in self._query_param_bound_widget_ids:
    should_preserve = True

# persist_state also preserves value (OR logic)
if self._persisted_widget_ids.get(key) == "session":
    should_preserve = True
```

### Fragment Interaction

The existing fragment handling in `_is_stale_widget` applies to persisted widgets:

```python
def _is_stale_widget(
    metadata: WidgetMetadata[Any] | None,
    active_widget_ids: frozenset[str],
    fragment_ids_this_run: list[str] | None,
) -> bool:
    if not metadata:
        return True

    # If running fragments, don't mark widgets outside those fragments as stale
    return not (
        metadata.id in active_widget_ids
        or (fragment_ids_this_run and metadata.fragment_id not in fragment_ids_this_run)
    )
```

Persisted widgets in fragments are preserved if:
1. The widget is in `active_widget_ids` (widget was rendered this run), OR
2. The widget belongs to a fragment not currently running, OR
3. The widget is stale but marked for persistence (our new logic)

No changes needed to `_is_stale_widget` — the persistence logic wraps around it.

## Edge Cases

### Conflicting keys across pages

**Scenario:** Two pages define widgets with the same `key` but different widget types.

**Decision:** The widget ID includes the widget type, so different widget types produce
different IDs even with the same key. However, the user key is the same, creating a
conflict in `_old_state` when preserved under user keys.

**Behavior:** Last write wins. When switching from Page A (slider with `key="x"`) to
Page B (selectbox with `key="x"`), if both use `persist_state="session"`:
- Page A's slider value is preserved under `"x"` when leaving
- Page B's selectbox registers, finds `"x"` in `_old_state`
- Type mismatch causes the selectbox to use its default (deserializer receives wrong type)

**Recommendation:** Document that `persist_state="session"` with the same key across pages
requires compatible widget types. Alternatively, use unique keys per page.

### Programmatic `st.session_state[key] = value`

**Scenario:** User sets `st.session_state["my_widget"] = new_value` for a persisted widget.

**Decision:** Works as expected. The value is stored in `_new_session_state[user_key]`,
which takes precedence in `_getitem`. When the widget re-registers, it finds this value.

**No special handling needed** — the existing session state priority chain handles this:
1. `_new_session_state[user_key]` (programmatic set)
2. `_new_widget_state[widget_id]` (frontend interaction)
3. `_old_state[widget_id]` or `_old_state[user_key]` (preserved value)

### Widget type changes with same key

**Scenario:** Developer changes `st.slider("x", key="my_key")` to
`st.selectbox("y", [...], key="my_key")` while the old value is persisted.

**Decision:** The new widget's deserializer receives the old value. If incompatible, the
deserializer should handle gracefully (return default or raise). Most Streamlit deserializers
return the default value when given incompatible input.

**Behavior:** Widget resets to default on type change. This is consistent with non-persisted
widgets that use the same key.

### `key=` requirement

**Decision:** `persist_state` requires an explicit `key=` parameter.

**Rationale:**
- Auto-generated keys include position-dependent components; if the widget moves, the ID changes
- Without a stable key, the preserved value cannot be found on re-registration
- Consistent with `bind="query-params"` which has the same requirement

**Implementation:** Validation in `register_widget` (shown above).

## Behavior Summary

### `persist_state="session"`

| Scenario | Before | After |
|----------|--------|-------|
| Widget conditionally hidden (`if False:`) | Value deleted | Value preserved |
| Page switch (MPA) | Value deleted | Value preserved |
| Widget re-rendered after hiding | Uses default | Restores previous value |
| Programmatic `st.session_state[key] = v` | Works | Works (no change) |
| Browser refresh | Value lost | Value lost (session state is server-side) |
| Developer changes `key=` | N/A | New identity, value lost |

### `persist_state="page"`

| Scenario | Before | After |
|----------|--------|-------|
| Widget conditionally hidden (`if False:`) | Value deleted | Value preserved |
| Page switch (MPA) | Value deleted | Value deleted (page-scoped) |
| Return to original page | Uses default | Uses default (value was cleaned up) |
| Widget re-rendered after hiding (same page) | Uses default | Restores previous value |

### Comparison with `bind="query-params"`

| Aspect | `bind="query-params"` | `persist_state="session"` | `persist_state="page"` |
|--------|----------------------|--------------------------|------------------------|
| Survives conditional hide | Yes | Yes | Yes |
| Survives page switch | Yes (URL preserved) | Yes | No |
| Syncs to URL | Yes | No | No |
| Shareable via URL | Yes | No | No |
| Requires `key=` | Yes | Yes | Yes |

## Files Changed

| File | Summary |
|------|---------|
| `lib/streamlit/runtime/state/common.py` | Add `PersistStateOption` type alias; add `persist_state` field to `WidgetMetadata` |
| `lib/streamlit/runtime/state/widgets.py` | Add `persist_state` parameter to `register_widget`; validate requires `key=` |
| `lib/streamlit/runtime/state/session_state.py` | Add `_persisted_widget_ids` and `_persisted_widget_pages` tracking; update `register_widget` to track; update `_remove_stale_widgets` to preserve |
| `lib/streamlit/elements/*.py` | Add `persist_state` parameter to each widget signature (slider, selectbox, etc.) |
| `proto/streamlit/proto/Widget.proto` | (Optional) Add `persist_state` to widget proto if needed for frontend awareness |

## Test Plan

### Unit Tests (`lib/tests/streamlit/runtime/state/`)

| Test Case | Description |
|-----------|-------------|
| `test_persist_state_session_preserves_across_conditional` | Widget hidden by `if False:` retains value |
| `test_persist_state_session_preserves_across_page_switch` | Simulate MPA page switch, verify value retained |
| `test_persist_state_page_preserves_across_conditional` | Widget hidden on same page retains value |
| `test_persist_state_page_clears_on_page_switch` | Verify page-scoped value cleared on MPA switch |
| `test_persist_state_requires_key` | `StreamlitAPIException` if no `key=` provided |
| `test_persist_state_programmatic_set` | `st.session_state[key] = v` works with persisted widget |
| `test_persist_state_with_query_params` | Both parameters set; verify OR behavior |
| `test_persist_state_conflicting_keys_different_types` | Same key, different widget types across pages |
| `test_persist_state_fragment_interaction` | Persisted widget inside fragment preserves correctly |
| `test_persist_state_cleanup_on_key_change` | Changing `key=` clears old persisted entry |

### E2E Tests (`e2e_playwright/`)

| Test Case | Description |
|-----------|-------------|
| `test_persist_state_session_conditional_rendering` | Toggle checkbox hides/shows slider; slider value persists |
| `test_persist_state_session_mpa_navigation` | Navigate between pages; widget value preserved |
| `test_persist_state_page_conditional_rendering` | Same as session test but value persists |
| `test_persist_state_page_mpa_navigation` | Navigate away and back; value reset to default |
| `test_persist_state_with_fragments` | Persisted widget inside `@st.fragment`; verify behavior |

## Alternatives Considered

### Navigation-level flag (`st.navigation(..., persist_all_widgets=True)`)

Rejected: Too coarse-grained. Developers typically want to persist specific widgets, not all.

### Global config option (`[runner] persist_widget_state = true`)

Rejected: Per-widget control is more intuitive and flexible. Global settings create "two
operating modes" that fragment the ecosystem.

### Changing defaults (always persist keyed widgets)

Rejected: Breaking change. Existing apps may rely on current cleanup behavior to avoid
stale state bugs.

### Single combined parameter (`persist="query-params"|"page"|"session"`)

Considered in product spec. Rejected in favor of separate `bind` and `persist_state`
parameters for clearer separation of concerns.

## Checklist

| Item | Status |
|------|--------|
| Works on SiS, Cloud, etc? | Yes — uses standard session state infrastructure |
| No breaking API changes | Yes — new optional parameter, default is current behavior |
| No new dependencies | Yes |
| Metrics collected | TBD — track usage of `persist_state` parameter values |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — document `persist_state` parameter on all widgets |
