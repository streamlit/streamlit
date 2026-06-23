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
    apply_edits: Callable[
        [pd.DataFrame, pd.DataFrame, DataEditorEditState],
        pd.DataFrame,
    ] | None = None,
) -> pd.DataFrame:
```

**Note on DataFrame type**: The callback signature uses `pd.DataFrame` for simplicity. `st.data_editor`
accepts and preserves return types for many dataframe-like inputs (Polars, numpy arrays, etc.),
but the callback always receives and must return `pd.DataFrame`. The implementation normalizes
inputs to pandas before invoking the callback and converts the return value back to the original
`data_format` as needed. This simplifies the callback API while preserving existing type behavior.

**Performance caveat (non-pandas inputs)**: For non-pandas inputs this forces a round-trip
conversion (e.g., Polars → pandas → Polars) on every rerun where the callback runs, which is not
visible in the callback's `pd.DataFrame` signature. This is a deliberate trade-off (a uniform,
simple callback contract over zero-copy fidelity) but it slightly conflicts with API principle #29
("Embrace the Python Ecosystem"). The cost is bounded by the editor's data size and only incurred
when edits are present. This caveat must be surfaced in the public `apply_edits` docstring (not
just here) so Polars/PyArrow users aren't surprised. A future enhancement could pass the callback
the data in its original `data_format` to avoid the round-trip; deferred to keep the initial API
minimal.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apply_edits` | `Callable[[pd.DataFrame, pd.DataFrame, DataEditorEditState], pd.DataFrame] \| None` | Callback invoked when edits are present. Receives source dataframe first, edited dataframe second, and raw edit state third. Returns new source dataframe. |

**Callback signature:**

```python
def apply_edits(
    source_df: pd.DataFrame,   # Original data passed to st.data_editor
    edited_df: pd.DataFrame,   # Data with edits already applied
    edits: DataEditorEditState,  # Raw edit state for fine-grained control
) -> pd.DataFrame:
    ...
```

**Argument order is intentional**: `source_df` comes before `edited_df` because row positions in
`edits["deleted_rows"]` and `edits["edited_rows"]` are interpreted against the pre-edit source data.
Swapping the first two arguments can delete or update the wrong backing records. Public docs and
examples must show the exact parameter names (`source_df`, `edited_df`, `edits`) prominently. If
implementation review finds this still too easy to misuse, revisit the event-object alternative in
the tech spec before shipping.

**Why `source_df` is included**: For database deletes, `deleted_rows: [3, 5]` gives row positions,
but the callback needs to map these back to primary keys. Without `source_df`, users must close
over the source dataframe, which the API should not require.

**DataEditorEditState type:**

```python
class DataEditorEditState(TypedDict):
    edited_rows: dict[int, dict[str, Any]]  # row_index -> column_name -> new_value
    added_rows: list[dict[str, Any]]        # list of new row dicts
    deleted_rows: list[int]                 # list of deleted row indices

# Note: The underlying widget state JSON serializes row indices as strings ({"0": {...}}).
# The implementation converts string keys to int before invoking the callback, so users
# can access edits with integer indexing: edits["edited_rows"][3] (not edits["edited_rows"]["3"]).
```

**Type export for callback annotation:**

`DataEditorEditState` should be exported from a stable public typing namespace. Do **not** point
users at `streamlit.elements.lib.column_types` (internal), and do **not** export it from
`streamlit.column_config`: that module is for column display/editing configuration, and its public
`__all__` does not include the internal `ColumnConfig` `TypedDict`.

Recommended implementation path: add a public `streamlit.types` namespace and export the data-editor
callback type from there:

```python
from streamlit.types import DataEditorEditState

def my_callback(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorEditState,
) -> pd.DataFrame:
    ...
```

**Note on naming**: The internal codebase uses `EditingState` for the frontend's positional edit
buffer. `DataEditorEditState` is the user-facing alias — same shape, but with int keys
(post-conversion) and documented as part of the public API. The callback always receives the
converted `DataEditorEditState`, not the raw JSON widget state.

The type is documented in `DataEditorEditState` shape (post-conversion with int keys) — static type
checkers will see `dict[int, dict[str, Any]]` for `edited_rows`, matching the runtime behavior.

### Behavior

| Aspect | Behavior |
|--------|----------|
| **When called** | On rerun when edits are present (not on every render) |
| **Input** | `source_df` + `edited_df` + `edits` |
| **Return value** | New source dataframe; becomes the baseline for *this render*, edit state cleared |
| **Baseline persistence** | The callback's return value is used for the current render only. For the baseline to persist across reruns, it must be stored externally (session state, database, or a cache that is updated/invalidated after commit). Button-only reruns with no edits will NOT invoke `apply_edits` — the `data` argument is re-evaluated as the baseline. |
| **Exception** | See "Error Handling" below |
| **No edits** | Callback not invoked; widget renders source data as-is |
| **With forms** | Not supported in the initial release; see "Forms enforcement" below |
| **Return value of `st.data_editor`** | Callback's result on success; `edited_df` on exception |
| **`st.session_state[key]`** | Cleared on success; preserved on exception |

#### How to Persist the Baseline

The callback's return value becomes the baseline **only for the current render**. If you write
`st.data_editor(st.session_state.df, ...)` and the callback returns a different dataframe, that
returned dataframe is discarded on the next non-edit rerun because `data` re-evaluates to the
stale `st.session_state.df`.

**Common footgun**: Button-only reruns (e.g., clicking a "Submit" button elsewhere in the app)
will NOT invoke `apply_edits` because there are no pending edits — the editor re-renders with
whatever `data` evaluates to.

**Solution**: Store the callback result in session state so it persists across all reruns:

```python
# Initialize with baseline data
if "df" not in st.session_state:
    st.session_state.df = load_initial_data()

def apply_edits(source_df, edited_df, edits):
    # Persist edits (e.g., validate, save to DB)
    save_to_database(edited_df)
    # Store result in session state for baseline persistence
    st.session_state.df = edited_df
    return edited_df

# Use session state as the source — it stays current across reruns
st.data_editor(
    st.session_state.df,
    key="editor",
    apply_edits=apply_edits,
)
```

For database-backed data, store the refreshed baseline in session state or invalidate/update any
cache immediately after committing edits. A TTL-only cache can serve stale pre-commit data on the
next non-edit rerun.

### Examples

**Example 1: Simple session state round-trip**

```python
# Initialize baseline data
if "df" not in st.session_state:
    st.session_state.df = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})

def accept_edits(source_df, edited_df, edits):
    # Store result for baseline persistence (see "How to Persist the Baseline" above)
    st.session_state.df = edited_df
    return edited_df

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

    # Store and return refreshed data (includes server-side defaults, timestamps)
    refreshed_df = load_from_database()
    st.session_state.db_df = refreshed_df
    return refreshed_df

if "db_df" not in st.session_state:
    st.session_state.db_df = load_from_database()

st.data_editor(
    st.session_state.db_df,
    key="editor",
    num_rows="dynamic",
    apply_edits=sync_to_database,
)
```

**Example 3: Revert/reset functionality (#6540)**

```python
if "baseline_df" not in st.session_state:
    st.session_state.baseline_df = load_initial_data()
if "working_df" not in st.session_state:
    st.session_state.working_df = st.session_state.baseline_df.copy()

def accept_edits(source_df, edited_df, edits):
    st.session_state.working_df = edited_df
    return edited_df

def revert_changes():
    st.session_state.working_df = st.session_state.baseline_df.copy()

col1, col2 = st.columns(2)
with col1:
    st.button("Revert Changes", on_click=revert_changes)

st.data_editor(
    st.session_state.working_df,
    key="editor",
    num_rows="dynamic",
    apply_edits=accept_edits,
)
```

**Example 4: Conditional persistence (explicit Save button)**

For workflows where edits accumulate across multiple interactions and are only persisted on
explicit user action (e.g., a "Save" button), store the working dataframe in session state:

```python
# Initialize working copy in session state
if "working_df" not in st.session_state:
    st.session_state.working_df = load_initial_data()

def handle_edits(source_df, edited_df, edits):
    # Update working copy with edits (but don't persist yet)
    st.session_state.working_df = edited_df
    return edited_df

def save_to_file():
    write_to_file(st.session_state.working_df)
    st.toast("Saved!")

st.button("Save to File", on_click=save_to_file)
st.data_editor(
    st.session_state.working_df,  # Source from session state
    key="editor",
    apply_edits=handle_edits,
)
```

**Why this pattern works**: Each edit invokes the callback, which updates `working_df` in session
state. Since the source (`st.session_state.working_df`) already reflects applied edits, subsequent
reruns see no new edits (edit state was cleared). The "Save" button reads from session state,
which accumulates all edits since the last save. This is the recommended pattern for "draft →
commit" workflows.

### Interaction with Existing Features

| Feature | Interaction |
|---------|-------------|
| `on_change` | `on_change` runs in WS handler *before* script rerun; `apply_edits` runs *during* rerun inside `st.data_editor`. `on_change` cannot observe post-`apply_edits` state. |
| `key` | **Required** for `apply_edits` to work correctly. See enforcement below. |
| `num_rows` | Works with all modes; most useful for `"add"`, `"delete"`, `"dynamic"` |
| `disabled` | If all editing disabled, no edits occur, callback not invoked |
| `column_config` | No interaction; column config affects editing UI, not callback |
| Forms | Not supported in the initial release; `apply_edits` inside `st.form` raises `StreamlitAPIException` |
| Fragments | Works within fragments; callback runs during fragment rerun |

**`key` requirement enforcement:**

Without `key`, the element ID is derived from full Arrow bytes, so every successful `apply_edits`
invocation changes the widget ID on the next render — discarding the callback's returned data.

If `apply_edits` is provided without `key`, raise `StreamlitAPIException` with an actionable message
(per API principle #23 "Fail Fast, Fail Helpfully"):

```python
raise StreamlitAPIException(
    "st.data_editor's apply_edits parameter requires a unique 'key' to be set. "
    "Provide a key like st.data_editor(..., key=\"my_editor\", apply_edits=...) "
    "so edit state can be preserved across reruns."
)
```

**Forms enforcement:**

The initial release should disallow `apply_edits` on `st.data_editor` inside `st.form` and raise
`StreamlitAPIException`. This preserves the existing forms contract that only
`st.form_submit_button` can define callbacks inside a form. Supporting forms later requires a
separate design for ordering relative to `st.form_submit_button(on_click=...)` and for whether
`apply_edits` is considered a widget callback or a submit-time commit hook.

### Error Handling

When the callback raises an exception, behavior depends on the exception type:

**Validation exceptions** (`ValueError`, `TypeError`):
1. Exception is caught by the widget
2. Edit state is **preserved** (user's work is not lost)
3. `st.error(str(exception))` is displayed at the widget location
4. `st.data_editor()` returns `edited_df` (the invalid data, so downstream code sees user's input)
5. Widget renders with preserved edits overlaid on original source data
6. User can fix the issue and retry (next interaction re-invokes callback)

**Control flow exceptions** (`st.rerun()`, `st.stop()`):
- Re-raised to allow normal control flow inside callbacks

**Other exceptions** (database errors, network failures, etc.):
- Propagated to Streamlit's normal exception handling
- This prevents accidentally leaking backend details (connection strings, SQL errors, stack traces)
  via `st.error(str(exception))`

**Security note**: Only validation exceptions (`ValueError`, `TypeError`) display their message
via `st.error()`. For other exceptions, the message may contain sensitive backend details — they
propagate to the standard exception UI instead. If you need to display custom error messages for
infrastructure failures, catch them explicitly and raise a `ValueError` with a safe message.

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

- **Async callbacks**: `async def apply_edits(...)` not supported in initial release. For users
  with async-only database drivers (e.g., `asyncpg`), use `asyncio.run(...)` inside the callback
  as a workaround. Native async support may be added in a future version if demand warrants.
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
