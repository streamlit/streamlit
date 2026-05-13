---
author: lukasmasuch
created: 2026-05-13
---

# `apply_edits` callback for st.data_editor

## Summary

Add an `apply_edits` callback parameter to `st.data_editor` that gives users explicit control
over when and how edits are committed. The callback receives the edited dataframe and raw edit
state, handles persistence (e.g., database writes), and returns the new source dataframe. This
enables clean patterns for database-backed editing, validation, and conditional edit handling
(e.g., revert during an active commit interaction).

## Problem

### User Requests

- [#7749](https://github.com/streamlit/streamlit/issues/7749#issuecomment-1824545998) — Users
  report "disappearing inputs" when using `st.data_editor` with session state.
  Phase 1 ([schema-based identity](https://github.com/streamlit/streamlit/pull/10269))
  solves this for `num_rows="fixed"`, but dynamic row operations still need explicit handling.

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

Phase 1 ([schema-based identity for fixed-row editors](https://github.com/streamlit/streamlit/pull/10269))
solves the computed-column case but doesn't
address row operations (`num_rows="add"`, `"delete"`, `"dynamic"`). For these modes, automatic
detection of "committed" edits is complex and error-prone. An explicit callback gives users
control and unlocks additional use cases.

**Positioning**: `apply_edits` is the robust/advanced API for complex editing scenarios (database
sync, validation, programmatic reset). For the simple session-state round-trip, automatic commit
detection may be added later as a convenience path.

## Alternatives Considered

### Option 1: `apply_edits` callback with return value ✅ PREFERRED

```python
def apply_edits(source_df, edited_df, edits) -> pd.DataFrame:
    return edited_df  # or transformed/validated/refreshed data
```

- **Pros**: Explicit control over commit timing; enables validation, DB refresh, revert
- **Cons**: New callback pattern (returns value, no `args`/`kwargs`)

### Option 2: Boolean-returning callback (`on_commit`)

```python
def on_commit(edited_df, edits) -> bool:
    return True  # accept edits
```

- **Pros**: Simpler signature
- **Cons**: No way to transform data or return DB-refreshed values; users must coordinate
  source data separately

### Option 3: Auto-commit detection via identity

```python
# Detect "committed" when st.session_state.df is edited_df
st.session_state.df = st.data_editor(st.session_state.df, ...)
```

- **Pros**: Zero additional API surface
- **Cons**: Fragile identity checks; doesn't support DB refresh, validation, or revert

### Why no `args`/`kwargs`?

Unlike `on_change` (fire-and-forget side effects), `apply_edits` requires specific inputs
(source, edited, edits) to make decisions. Adding `args`/`kwargs` would complicate the
signature without clear benefit. Users needing additional context can close over variables.

**Note on Principle 11 ("Patterns Are Sacred")**: The existing `args`/`kwargs` parameters on
`st.data_editor` apply to `on_change`, not to `apply_edits`. Since `apply_edits` has a different
calling convention (it receives structured arguments and returns a value), sharing `args`/`kwargs`
would be confusing — users would need to understand which callback receives which extra args.
If demand arises, we could add `apply_edits_args`/`apply_edits_kwargs` in the future, but this
is deferred to keep the initial API minimal per Principle 4 ("Start Minimal, Ship Fast").

## Proposal

### API

Add a new optional parameter `apply_edits` to `st.data_editor`:

```python
def data_editor(
    data: DataTypes,
    *,
    # ... existing parameters ...
    apply_edits: Callable[[pd.DataFrame, pd.DataFrame, DataEditorEdits], pd.DataFrame] | None = None,
) -> pd.DataFrame:
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apply_edits` | `Callable[[pd.DataFrame, pd.DataFrame, DataEditorEdits], pd.DataFrame] \| None` | Callback invoked when edits are committed. Receives source dataframe, edited dataframe, and raw edit state. Returns new source dataframe. |

**Callback signature:**

```python
def apply_edits(
    source_df: pd.DataFrame,   # Original data passed to st.data_editor
    edited_df: pd.DataFrame,   # Data with edits already applied
    edits: DataEditorEdits,    # Raw edit state for fine-grained control
) -> pd.DataFrame:
    ...
```

**Why `source_df` is included**: For database deletes, `deleted_rows: [3, 5]` gives row positions,
but the callback needs to map these back to primary keys. Without `source_df`, users must close
over the source dataframe, which the API should not require.

**DataTypes scope**: The callback always receives and returns `pd.DataFrame`, regardless of the
input `data` type. Non-DataFrame inputs (list, dict, ndarray, etc.) are converted to DataFrame
before the callback is invoked. If the callback returns a DataFrame but the original `data` was
a different type, the return value is used as-is (no back-conversion).

**Type-preserving overload note**: `st.data_editor` currently preserves input type for
`EditableData` inputs (returning the same type as the input). When `apply_edits` is set, the
return type is always `pd.DataFrame` because the callback returns `pd.DataFrame`. This means
users who need type preservation should either (a) not use `apply_edits`, or (b) handle
reconversion manually if needed. The `@overload` signatures should reflect this: when
`apply_edits` is provided, return type is `pd.DataFrame`. This is an explicit API contract
for this feature, not a breaking change — existing code without `apply_edits` is unaffected.

**DataEditorEdits type:**

This is a new public type, distinct from the internal `EditingState` TypedDict used for
widget serialization. The name `DataEditorEdits` is chosen to be explicit and avoid confusion.

**Import path**: `DataEditorEdits` is exposed as `st.DataEditorEdits` (flat namespace per
Principle 21). Users can import it for type annotations:

```python
from streamlit import DataEditorEdits

def my_callback(source_df: pd.DataFrame, edited_df: pd.DataFrame, edits: DataEditorEdits) -> pd.DataFrame:
    ...
```

```python
class DataEditorEdits(TypedDict):
    edited_rows: dict[int, dict[str, Any]]  # row_index -> column_name -> new_value
    added_rows: list[dict[str, Any]]        # list of new row dicts
    deleted_rows: list[int]                 # list of deleted row indices
```

**Note on `Any` for cell values**: The public `DataEditorEdits` widens cell values to `Any` for
forward compatibility with richer cell types (e.g., datetime, complex objects) that may be
supported in the future. The internal `EditingState` at `lib/streamlit/elements/widgets/data_editor.py`
constrains values to `str | int | float | bool | None` for the current implementation, but the
public type intentionally leaves room for expansion without breaking user type annotations.

### Behavior

| Aspect | Behavior |
|--------|----------|
| **When called** | On rerun when edits are **committed** (user leaves cell/presses Enter, not during typing) |
| **Input** | `source_df` + `edited_df` + `edits` |
| **Return value** | New source dataframe; becomes the baseline, edit state cleared |
| **Exception** | See "Error Handling" below |
| **No edits** | Callback not invoked; widget renders source data as-is |
| **With forms** | Callback invoked on form submit, not on each cell edit |
| **Return value of `st.data_editor`** | Callback's result on success; `edited_df` on exception |
| **`st.session_state[key]`** | Cleared on success; preserved on exception. "Cleared" means the edit state (`edited_rows`, `added_rows`, `deleted_rows`) is reset to empty dicts/lists — the key itself remains in session state with an empty `DataEditorEdits` value, i.e., `st.session_state[key] == {"edited_rows": {}, "added_rows": [], "deleted_rows": []}`. Code checking `if st.session_state[key]["edited_rows"]:` will see `False` after a successful commit. |
| **When `apply_edits=None`** | No behavior change from current `st.data_editor`; `st.session_state[key]` continues to expose the `EditingState` dict as documented today |

**What counts as "edits present"**: The callback is invoked only when `edited_rows`, `added_rows`,
or `deleted_rows` is non-empty. Column resizes, sort state, and UI-only interactions do not count
as edits and do not trigger the callback.

**Commit trigger clarification**: The callback fires when edits transition from "pending in UI"
to "committed to widget state" — i.e., when `on_change` would fire. This means:
- Cell edit: callback fires when user leaves the cell or presses Enter
- Row add/delete: callback fires immediately on the action
- Forms: callback fires on form submit (edits are batched)

This is consistent with existing `on_change` semantics.

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

    # Map deleted row positions to primary keys using source_df.
    # NOTE: `edits["deleted_rows"]` contains positional indices into source_df
    # as passed to st.data_editor (independent of any UI sort/filter state).
    # Always use `.iloc[]` (positional) rather than `.loc[]` (label-based),
    # as this works correctly regardless of the DataFrame's index type
    # (default RangeIndex, non-monotonic, MultiIndex, etc.).
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

st.data_editor(
    load_from_database(),
    key="editor",
    num_rows="dynamic",
    apply_edits=sync_to_database,
)
```

**Example 3: Revert/reset functionality (#6540)**

This pattern demonstrates revert behavior when edits are in-flight. The callback is invoked
when the user commits an edit (e.g., leaves a cell), and if `revert_requested` is set at that
moment, the callback returns the original source data instead of the edited data.

**Important limitation**: This pattern only works when edits are being committed in the same
interaction. Clicking "Revert" after edits have already been committed (in a previous rerun)
does NOT trigger `apply_edits` — there's no new edit-commit transition. For "revert anytime"
behavior, users should use a different pattern (e.g., using `st.session_state` to track the
source data and using `st.rerun()` to reset, or using forms to batch all edits until explicit
submit).

```python
def handle_edits(source_df, edited_df, edits):
    if st.session_state.get("revert_requested"):
        st.session_state.revert_requested = False
        return source_df  # Reject edits, return original
    return edited_df  # Accept edits

st.button("Revert Changes", on_click=lambda: st.session_state.update(revert_requested=True))
st.data_editor(df, key="editor", num_rows="dynamic", apply_edits=handle_edits)
```

**Example 4: Conditional persistence**

Similar to Example 3, this demonstrates conditional save behavior at edit-commit time.
The callback checks `save_requested` when edits are being committed.

**Important limitation**: Same as Example 3 — clicking "Save" after edits are already committed
does NOT trigger `apply_edits`. For explicit save-on-button workflows, consider using forms
(where edits batch until form submit) or a different state management pattern.

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
| `on_change` | Both execute in the same rerun: `on_change` fires first (before script body), then `apply_edits` when the script reaches the `st.data_editor(...)` call. **Important**: If `on_change` mutates `st.session_state[key]`, those mutations are **not** reflected in the `edits` / `edited_df` seen by `apply_edits` — the callback receives the edit state as committed by the frontend, not any Python-side mutations. Mutating session state in `on_change` while using `apply_edits` is an anti-pattern; use one or the other. |
| `key` | **Required** when `apply_edits` is set. If `key` is omitted (or `None`) with `apply_edits` provided, `st.data_editor` raises `StreamlitAPIException("`apply_edits` requires a `key` argument")` at widget construction time. This ensures the commit-clear contract works correctly across reruns. |
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

**Distinguishing success vs. exception returns**: Callers who need to know whether the returned
dataframe came from a successful commit or an exception can check `st.session_state[key]`:
- On success: `st.session_state[key]` is cleared (empty edit state)
- On exception: `st.session_state[key]` is preserved (non-empty edit state)

```python
result = st.data_editor(df, key="editor", apply_edits=validate_and_save)
if st.session_state.editor.get("edited_rows") or st.session_state.editor.get("added_rows") or st.session_state.editor.get("deleted_rows"):
    st.warning("Validation failed — edits not committed")
```

**Example with retry flow**:

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

**Side-effect leakage warning**: If the callback performs partial writes before raising
(e.g., deletes some rows then fails on validation), those side effects are not rolled back.
Users performing database operations should use transactions:

```python
def sync_to_database(source_df, edited_df, edits):
    with db.transaction():  # Rollback on exception
        for row_idx in edits["deleted_rows"]:
            delete_from_db(source_df.iloc[row_idx]["id"])
        # Validate after mutations are staged but before commit
        if edited_df["amount"].sum() > 10000:
            raise ValueError("Total exceeds limit")  # Transaction rolls back
    return load_from_database()
```

### Out of Scope (Future Work)

- **Async callbacks**: `async def apply_edits(...)` not supported in initial release. If an
  `async` callable is passed, `st.data_editor` raises `StreamlitAPIException("apply_edits does
  not support async callbacks")` at widget construction time. This follows Principle 23 ("Fail
  Fast, Fail Helpfully") — users see a clear error rather than cryptic "coroutine was never
  awaited" warnings.
- **Partial success**: All-or-nothing semantics; no per-row error handling
- **Conflict resolution UI**: If the callback returns data that differs from the editor's source
  while the user is mid-edit in a new cell, the callback's return value replaces the source
  and the in-progress edit continues — no merge UI is provided
- **Automatic retry**: On exception, user must manually trigger next edit to retry
- **Automatic commit detection**: For simple `st.session_state.df = st.data_editor(...)` patterns,
  automatic detection of committed edits may be added as a convenience path in the future

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ — standard callback execution |
| No breaking API changes | ✅ — new optional parameter only |
| No new dependencies | ✅ |
| New proto fields | ✅ — see below |
| Metrics collected | ✅ — track `apply_edits` usage vs. without |
| Any security/legal impact? | ✅ None — callback runs user code like `on_change` |
| Any docs changes needed? | ✅ — document `apply_edits` parameter and patterns |

**Proto changes**: Add an `edit_state_version` counter (preferred over boolean) to `Arrow.proto`.
When `apply_edits` succeeds, the backend increments this counter to signal the frontend to clear
its local edit buffer. The counter is more robust than a boolean — it lets the frontend
distinguish multiple successful commits between message deliveries (e.g., if network latency
causes messages to arrive out of order). The frontend keys its `EditingState` cache on this
field, ensuring stale edits don't persist after a successful commit.

**Wire compatibility note**: `edit_state_version` should be an optional proto field defaulting to
0, ensuring mixed-version frontend/backend deployments (rolling upgrades, cached frontends) remain
wire-compatible. Tech spec will detail the wire-level mechanism.
