---
author: lukasmasuch
created: 2026-05-13
---

# `apply_edits` callback for st.data_editor

## Summary

Add an `apply_edits` callback parameter to `st.data_editor` that gives users explicit control
over when and how edits are committed. The callback receives the edited dataframe and raw edit
state, handles persistence (e.g., database writes), and returns the new source dataframe. This
enables clean patterns for database-backed editing, validation, and programmatic reset/revert.

## Problem

### User Requests

- [#7749](https://github.com/streamlit/streamlit/issues/7749) — Users report "disappearing inputs"
  when using `st.data_editor` with session state. Phase 1 (schema-based identity) solves this for
  `num_rows="fixed"`, but dynamic row operations still need explicit handling.

- [#6540](https://github.com/streamlit/streamlit/issues/6540) — Users want to programmatically
  revert deleted rows or reset the editor to fresh data. Currently, setting session state manually
  is disallowed and changing source data doesn't properly update the editor.

### Current Pain Points

**Database-backed editing is awkward:**

```python
# Current pattern: manual round-trip with race conditions
if "df" not in st.session_state:
    st.session_state.df = load_from_postgres()

edited_df = st.data_editor(st.session_state.df, key="editor", num_rows="dynamic")

# Fragile change detection
if edited_df is not st.session_state.df:
    save_to_postgres(edited_df)
    st.session_state.df = load_from_postgres()  # Refresh
    st.rerun()  # Hope edits don't get lost
```

Problems with this pattern:
- Detecting "has anything changed" is unreliable
- The refresh/rerun dance can lose in-flight edits
- No validation hook before persistence
- Multiple reruns needed for the UI to stabilize
- No way to programmatically revert changes

### Why Phase 1 Alone Is Insufficient

Phase 1 (schema-based identity for fixed-row editors) solves the computed-column case but doesn't
address row operations (`num_rows="add"`, `"delete"`, `"dynamic"`). For these modes, automatic
detection of "committed" edits is complex and error-prone. An explicit callback gives users
control and unlocks additional use cases.

**Positioning**: `apply_edits` is the robust/advanced API for complex editing scenarios (database
sync, validation, programmatic reset). For the simple session-state round-trip, automatic commit
detection may be added later as a convenience path.

## Proposal

### API

Add a new optional parameter `apply_edits` to `st.data_editor`:

```python
def data_editor(
    data: DataTypes,
    *,
    # ... existing parameters ...
    apply_edits: Callable[[pd.DataFrame, pd.DataFrame, EditState], pd.DataFrame] | None = None,
) -> pd.DataFrame:
```

**Note on DataFrame type**: The callback signature uses `pd.DataFrame` for simplicity. `st.data_editor`
accepts and preserves return types for many dataframe-like inputs (Polars, numpy arrays, etc.),
but the callback always receives and must return `pd.DataFrame`. The implementation normalizes
inputs to pandas before invoking the callback and converts the return value back to the original
`data_format` as needed. This simplifies the callback API while preserving existing type behavior.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apply_edits` | `Callable[[pd.DataFrame, pd.DataFrame, EditState], pd.DataFrame] \| None` | Callback invoked when edits are present. Receives source dataframe, edited dataframe, and raw edit state. Returns new source dataframe. |

**Callback signature:**

```python
def apply_edits(
    source_df: pd.DataFrame,   # Original data passed to st.data_editor
    edited_df: pd.DataFrame,   # Data with edits already applied
    edits: EditState,          # Raw edit state for fine-grained control
) -> pd.DataFrame:
    ...
```

**Why `source_df` is included**: For database deletes, `deleted_rows: [3, 5]` gives row positions,
but the callback needs to map these back to primary keys. Without `source_df`, users must close
over the source dataframe, which the API should not require.

**EditState type:**

```python
class EditState(TypedDict):
    edited_rows: dict[int, dict[str, Any]]  # row_index -> column_name -> new_value
    added_rows: list[dict[str, Any]]        # list of new row dicts
    deleted_rows: list[int]                 # list of deleted row indices

# Note: The underlying widget state JSON serializes row indices as strings ({"0": {...}}).
# The implementation converts string keys to int before invoking the callback, so users
# can access edits with integer indexing: edits["edited_rows"][3] (not edits["edited_rows"]["3"]).
```

### Behavior

| Aspect | Behavior |
|--------|----------|
| **When called** | On rerun when edits are present (not on every render) |
| **Input** | `source_df` + `edited_df` + `edits` |
| **Return value** | New source dataframe; becomes the baseline for *this render*, edit state cleared |
| **Baseline persistence** | The callback's return value is used for the current render only. For the baseline to persist across reruns, it must be stored externally (session state, database, cache). Button-only reruns with no edits will NOT invoke `apply_edits` — the `data` argument is re-evaluated as the baseline. |
| **Exception** | See "Error Handling" below |
| **No edits** | Callback not invoked; widget renders source data as-is |
| **With forms** | Callback invoked on form submit, not on each cell edit |
| **Return value of `st.data_editor`** | Callback's result on success; `edited_df` on exception |
| **`st.session_state[key]`** | Cleared on success; preserved on exception |

### Examples

**Example 1: Simple session state round-trip**

```python
def accept_edits(source_df, edited_df, edits):
    return edited_df  # Accept all edits as-is

st.data_editor(
    st.session_state.df,
    key="editor",
    num_rows="dynamic",
    apply_edits=accept_edits,
)
```

**Example 2: Database sync with validation**

```python
def sync_to_database(source_df, edited_df, edits):
    # Validate
    if edited_df["amount"].sum() > 10000:
        raise ValueError("Total amount cannot exceed $10,000")

    # Map deleted row positions to primary keys using source_df
    for row_idx in edits["deleted_rows"]:
        pk = source_df.iloc[row_idx]["id"]
        delete_from_db(pk)

    # Persist edits (map positions to PKs)
    for row_idx, changes in edits["edited_rows"].items():
        pk = source_df.iloc[row_idx]["id"]
        update_in_db(pk, changes)

    for row in edits["added_rows"]:
        insert_row_in_db(row)

    # Return refreshed data (includes server-side defaults, timestamps)
    return load_from_database()

# Cache the initial load to avoid double DB read on each rerun
# (data argument is evaluated even when callback isn't invoked)
@st.cache_data(ttl=60)
def get_initial_data():
    return load_from_database()

st.data_editor(
    get_initial_data(),
    key="editor",
    num_rows="dynamic",
    apply_edits=sync_to_database,
)
```

**Example 3: Revert/reset functionality (#6540)**

```python
def handle_edits(source_df, edited_df, edits):
    if st.session_state.get("revert_requested"):
        st.session_state.revert_requested = False
        return source_df  # Reject edits, return original
    return edited_df  # Accept edits

col1, col2 = st.columns(2)
with col1:
    st.button("Revert Changes", on_click=lambda: st.session_state.update(revert_requested=True))

st.data_editor(df, key="editor", num_rows="dynamic", apply_edits=handle_edits)
```

**Example 4: Conditional persistence**

```python
def maybe_save(source_df, edited_df, edits):
    if st.session_state.get("save_requested"):
        st.session_state.save_requested = False
        save_to_file(edited_df)
        st.toast("Saved!")
    return edited_df

st.button("Save", on_click=lambda: st.session_state.update(save_requested=True))
st.data_editor(df, key="editor", apply_edits=maybe_save)
```

### Interaction with Existing Features

| Feature | Interaction |
|---------|-------------|
| `on_change` | `on_change` runs in WS handler *before* script rerun; `apply_edits` runs *during* rerun inside `st.data_editor`. `on_change` cannot observe post-`apply_edits` state. |
| `key` | **Required** for `apply_edits` to work correctly. Without `key`, the element ID is derived from full Arrow bytes, so every successful `apply_edits` invocation changes the widget ID on the next render — discarding the callback's returned data. **Enforcement**: If `apply_edits` is provided without `key`, raise `StreamlitAPIException("apply_edits requires a key parameter for stable widget identity")`. |
| `num_rows` | Works with all modes; most useful for `"add"`, `"delete"`, `"dynamic"` |
| `disabled` | If all editing disabled, no edits occur, callback not invoked |
| `column_config` | No interaction; column config affects editing UI, not callback |
| Forms | Callback invoked on form submit only, edits batched until then |
| Fragments | Works within fragments; callback runs during fragment rerun |

### Error Handling

When the callback raises an exception:
1. Exception is caught by the widget
2. Edit state is **preserved** (user's work is not lost)
3. `st.error(str(exception))` is displayed
4. `st.data_editor()` returns `edited_df` (the invalid data, so downstream code sees user's input)
5. Widget renders with preserved edits overlaid on original source data
6. User can fix the issue and retry (next interaction re-invokes callback)

```python
def validate_and_save(source_df, edited_df, edits):
    if edited_df["email"].str.contains("@").sum() != len(edited_df):
        raise ValueError("All rows must have valid email addresses")
    return edited_df

# If validation fails:
# - st.error("All rows must have valid email addresses") is shown
# - st.data_editor() returns edited_df (invalid data, but user's input)
# - Edit state preserved for retry
result = st.data_editor(df, key="editor", apply_edits=validate_and_save)
```

### Out of Scope (Future Work)

- **Async callbacks**: `async def apply_edits(...)` not supported in initial release
- **Partial success**: All-or-nothing semantics; no per-row error handling
- **Conflict resolution UI**: If callback returns data that conflicts with pending edits, no
  merge UI is provided — callback's return value wins
- **Automatic retry**: On exception, user must manually trigger next edit to retry
- **Automatic commit detection**: For simple `st.session_state.df = st.data_editor(...)` patterns,
  automatic detection of committed edits may be added as a convenience path in the future

## Checklist

| Item | ✅ or comment |
|------|--------|
| Works on SiS, Cloud, etc? | Yes — standard callback execution |
| No breaking API changes | Yes — new optional parameter only |
| No new dependencies | Yes |
| New proto fields | Yes — `editing_state` field to signal frontend state clear |
| Metrics collected | Track `apply_edits` usage vs. without |
| Any security/legal impact? | None — callback runs user code like `on_change` |
| Any docs changes needed? | Yes — document `apply_edits` parameter and patterns |
