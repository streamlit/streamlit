---
author: lukasmasuch
created: 2026-05-13
---

# Dynamic Data Updates for st.data_editor

## Summary

When users provide a `key` to `st.data_editor` and rerun the app with modified data (e.g.,
computed columns, session state round-trips), their cell edits disappear because the full
serialized data is included in the element ID computation. This spec proposes switching to
**schema-based identity** when `key` is provided: the element ID incorporates column structure
and types but not cell values, allowing data value changes while preserving editing state.

This change enables the common "spreadsheet with computed columns" and "edit-and-save" patterns
without requiring users to manage edit state manually.

The spec also explores an **`apply_edits` callback** as an additional feature for database-backed
editing — this provides explicit control over persistence and refresh, complementing the automatic
session-state handling.

## Problem

### Current Behavior

`st.data_editor` computes its element ID by including the full serialized Arrow data in the hash
(`lib/streamlit/elements/widgets/data_editor.py:1109-1123`):

```python
element_id = compute_and_register_element_id(
    "data_editor",
    user_key=key,
    key_as_main_identity=False,  # <- All kwargs including data are in ID
    dg=self.dg,
    data=arrow_bytes,            # <- Full serialized data in hash
    # ...other params
)
```

Any change to data values - even computed columns that don't affect user-edited cells - changes
the element ID, causing the frontend `EditingState` to be discarded:

```python
# Pattern that doesn't work today:
if "df" not in st.session_state:
    st.session_state.df = pd.DataFrame({"A": [1, 2, 3], "B": [0, 0, 0]})

st.session_state.df = st.data_editor(st.session_state.df, key="editor")
st.session_state.df["B"] = st.session_state.df["A"] ** 2  # Computed column

# User edits column A -> rerun -> computed column B changes the data hash
# -> new element ID -> all edits lost
```

### User Requests

- [#7749](https://github.com/streamlit/streamlit/issues/7749) - "Laggy/one loop behind"
  `data_editor` when editing with session state: users report inputs "disappearing" and needing
  to type twice for changes to register.

- [#6540](https://github.com/streamlit/streamlit/issues/6540) - "Allow editing session state value
  to programmatically set state of `st.data_editor`": users want to revert deleted rows or reset
  the editor to a fresh dataframe. Currently, setting session state manually is disallowed and
  changing the source data doesn't re-render the editor properly.

### Contrast with Other Widgets

Other widgets use `key_as_main_identity` to allow dynamic changes while preserving state:

| Widget | `key_as_main_identity` | Behavior |
|--------|----------------------|----------|
| `st.selectbox` | `{"accept_new_options"}` | Options can change dynamically |
| `st.slider` | `{"min_value", "max_value", "step"}` | Only range changes reset state |
| `st.dataframe` (with selection) | `{"selection_mode", "is_selection_activated"}` | Data can change, selections persist |
| `st.data_editor` | `False` (current) | Any data change resets state |

## Architecture Constraints

Understanding these constraints is critical for the proposed solution:

1. **Positional Edit Tracking**: `EditingState` tracks edits by row position (integer index), not
   row identity. `edited_rows` is a map of `row_position -> column_name -> value`.

2. **Frontend Reset Trigger**: `useWidgetState.ts:247-250` resets `EditingState` when
   `originalNumRows` changes - this is the existing mechanism for detecting incompatible state.

3. **Backend Edit Application**: `_apply_dataframe_edits` applies edits blindly using row
   positions. No validation that edits still apply to the "same" rows.

4. **Widget State Format**: JSON string with `{edited_rows, added_rows, deleted_rows}`. No
   metadata about the original data structure.

5. **st.dataframe Precedent**: Already uses `key_as_main_identity={"selection_mode",
   "is_selection_activated"}` for selections, demonstrating the pattern works for this component
   family.

## Proposal

### Phased Implementation

The feature is implemented in phases to deliver value incrementally while managing complexity.
Each phase is independently shippable.

---

### Phase 1: Schema-Based Identity for Fixed-Row Editors Only

**Goal**: Enable dynamic data value changes while preserving cell edits when `key` is provided
and row count is fixed.

**Scope**: `num_rows="fixed"` only. Add/delete/dynamic modes remain unchanged until Phase 2.

**Why fixed-row only in Phase 1**:

- Fixed-row edit deltas are cell edits only, so stable row positions make the change safe.
- Add/delete/dynamic modes need to distinguish pending row operations from operations already
  written back to the source dataframe. Without explicit metadata, we risk:
  - Double-application of committed additions/deletions if the ID stays stable
  - Dropped interactions if the ID changes on row count (frontend may still display old proto)
  - Backend-side corruption because frontend resets run too late to protect the current rerun

#### 1.1 Backend Changes

**Compute Data Editor Signature** (`lib/streamlit/elements/widgets/data_editor.py`)

Add a function to compute an editing-compatibility signature that changes when old edit deltas
are no longer safe to apply.

**Signature should include**:

- Data format used for return conversion (`data_format`)
- Column names in order (after `_fix_column_headers`)
- Index column names and index kind
- Arrow field names, logical types, and nullability for index and data columns
- `DataframeSchema` data kinds used for parsing edited values
- Row count (for `num_rows="fixed"`)
- `disabled` when it disables all editing

**Signature limitations and Phase 1 scope**:

Phase 1 intentionally scopes to cases where **row identity and edit-affecting config stay stable**:
- **Row reordering**: Same-row-count reorders will preserve stale edits onto different logical rows.
  Phase 1 does not detect row reorders. Developers must avoid reordering source data for keyed
  fixed-row editors, or use `apply_edits` (Phase 2) for full control.
- **Partial `disabled` changes**: Changing which columns are disabled doesn't reset edit state.
  Edits on previously-editable columns remain even if that column becomes disabled.

These edge cases are acceptable for Phase 1's scope (computed columns, session state round-trip).
Phase 3 (row identity via meaningful index) could address row reordering if needed.

**Signature should exclude**:

- Cell values
- `width`, `height`, `use_container_width` (cosmetic)
- `row_height`, `placeholder` (cosmetic)
- `column_order` (only affects initial visibility; users can show hidden columns via UI)
- `column_config_mapping` (developer's responsibility to not make incompatible changes;
  `DataframeSchema` already captures parsing-relevant types)

**Note on `column_config` exclusion**: While `column_config` can override the displayed/parsed
type at the UI level (e.g., retyping an integer column as `DatetimeColumn`), the signature
relies on `DataframeSchema` which captures Arrow/pandas types. If a developer changes
`column_config` in a way that alters how the frontend parses or renders a cell, stored edit
deltas may be typed against the old config. This is documented as developer responsibility:
avoid type-changing `column_config` updates in the same widget key. A future enhancement could
include a hash of type-affecting `column_config` fields in the signature.

```python
def _compute_data_editor_signature(
    data_df: pd.DataFrame,
    data_format: dataframe_util.DataFormat,
    arrow_schema: pa.Schema,
    dataframe_schema: DataframeSchema,
    disabled: bool | Iterable[str | int],
    num_rows: str,
) -> str:
    """Compute an editing-compatibility signature (not full data hash).

    The signature changes when old edit deltas are no longer safe to apply.
    """
    h = util.create_fast_hasher()

    # Data format for return conversion
    h.update(f"format:{data_format.name}".encode("utf-8"))

    # Column names in order (after _fix_column_headers)
    for col in data_df.columns:
        h.update(f"col:{col}".encode("utf-8"))

    # Index type and names
    h.update(f"index_type:{type(data_df.index).__name__}".encode("utf-8"))
    if hasattr(data_df.index, 'names'):
        for name in data_df.index.names:
            h.update(f"index_name:{name}".encode("utf-8"))

    # Arrow field types with nullability
    for field in arrow_schema:
        h.update(f"arrow:{field.name}:{field.type}:{field.nullable}".encode("utf-8"))

    # DataframeSchema data kinds for parsing
    for col_name, data_kind in dataframe_schema.items():
        h.update(f"kind:{col_name}:{data_kind}".encode("utf-8"))

    # Row count only for fixed mode
    if num_rows == "fixed":
        h.update(f"rows:{len(data_df)}".encode("utf-8"))

    # Disabled state when it disables all editing
    if disabled is True:
        h.update(b"disabled:all")

    return h.hexdigest()
```

**Use Signature in Element ID**

```python
data_signature = _compute_data_editor_signature(
    data_df=data_df,
    data_format=data_format,
    arrow_schema=arrow_table.schema,
    dataframe_schema=dataframe_schema,
    disabled=disabled,
    num_rows=num_rows,
)

element_id = compute_and_register_element_id(
    "data_editor",
    user_key=key,
    # When key is provided AND num_rows="fixed": identity based on signature, not data values
    key_as_main_identity={"data_signature", "num_rows"}
    if key is not None and num_rows == "fixed"
    else False,
    dg=self.dg,
    data=arrow_bytes,  # Still passed for unkeyed editors
    data_signature=data_signature,
    num_rows=num_rows,
    width=width,
    height=height,
    # ...other params
)
```

`data=arrow_bytes` stays in kwargs so unkeyed editors retain today's identity. For keyed
fixed-row editors, `key_as_main_identity` filters it out.

#### 1.2 Frontend Changes: Edit Reconciliation

**Problem**: When a user edits a cell, that edit is stored in `EditingState` and "shadows" the
underlying Arrow data. Even if the user edits the cell back to its original value, or if the
source data updates to match the edit, the edit remains stored — blocking future source data
updates from reaching that cell.

Example:
1. Source: A1 = 10
2. User edits A1 → 20 (stored in EditingState)
3. Source updates A1 → 20 (matches edit, but edit still shadows)
4. Source updates A1 → 30
5. Cell shows 20 (stale edit), not 30!

**Solution**: Two-pronged cleanup that clears edits when they match source data:

**1. At edit time** (`onCellEdited`, `onPaste`): Compare new value against source. If they
match, clear the edit instead of storing it — the cell reverts to reading from source.

```typescript
// In onCellEdited handler
const sourceCell = getCellContent([col, row])
const sourceValue = column.getCellValue(sourceCell)
const editValue = column.getCellValue(newCell)

if (valuesEqual(sourceValue, editValue, column)) {
  // Edit matches source — clear instead of store
  editingState.clearCell(col, row)
} else {
  editingState.setCell(col, row, newCell)
}
```

**2. On data change**: When Arrow data updates, iterate stored edits and clear any that now
match the new source values.

```typescript
// In useEffect triggered by data change
useEffect(() => {
  let cleared = false
  editingState.forEachEditedCell((col, row, editCell) => {
    const column = columns[col]
    const sourceCell = getCellContent([col, row])
    const sourceValue = column.getCellValue(sourceCell)
    const editValue = column.getCellValue(editCell)

    if (valuesEqual(sourceValue, editValue, column)) {
      editingState.clearCell(col, row)
      cleared = true
    }
  })
  if (cleared) {
    // Trigger re-render to show updated source values
    updateNumRows()
  }
}, [data])  // Or use a stable data hash/version
```

**Performance note**: The reconciliation iterates every stored edit and calls `getCellContent` for
each (which reads from the Arrow-backed table). For editors with many edited cells (e.g., bulk
paste), this runs on every data update. Consider:
- Skip reconciliation when data hash/version is unchanged (since `useEffect([data])` fires on
  identity changes even when bytes are equivalent)
- Batch reconciliation for large edit sets if profiling shows issues

**Value comparison** (`valuesEqual`):

Using `column.getCellValue()` normalizes both values to the column's native type, handling
type coercion (e.g., `"5"` vs `5`). Additional considerations:

- **Null/undefined**: Treat as equivalent
- **Floats**: Use epsilon comparison or same serialization path if precision issues arise
- **Objects/arrays**: Deep equality or JSON serialization

```typescript
function valuesEqual(a: unknown, b: unknown, column: BaseColumn): boolean {
  // Null equivalence
  if (a == null && b == null) return true
  if (a == null || b == null) return false

  // Delegate to column-specific comparison for complex types (dates, lists, objects)
  // Each BaseColumn subclass can override valuesEqual() for type-appropriate comparison
  if (column.valuesEqual) {
    return column.valuesEqual(a, b)
  }

  // Fallback for primitives (strings, numbers, booleans)
  return a === b
}
```

**Note**: The `BaseColumn.valuesEqual()` method should be implemented per column type:
- **DateColumn/TimeColumn**: Compare timestamps or ISO strings
- **ListColumn**: Deep array comparison
- **ObjectColumn**: JSON.stringify comparison or deep equality
- **NumberColumn**: Consider epsilon for floats if needed

**Scope**: Only applies to `edited_rows` (cell edits). Added rows have no source to compare
against; deleted rows are tracked separately.

**Benefit**: Edits that are no longer meaningful are automatically cleared, allowing source
data to flow through to cells that haven't been *meaningfully* edited. This complements
schema-based identity — together they enable true dynamic data updates.

#### 1.3 Behavior Summary

**Expected Phase 1 behavior (with `key` and `num_rows="fixed"`)**:

| Scenario | Behavior |
|----------|----------|
| Keyed fixed editor, values change only | Preserve edit state |
| Keyed fixed editor, source value matches edit | Clear that edit (source flows through) |
| Keyed fixed editor, user edits cell back to source value | Clear that edit |
| Keyed fixed editor, schema/type/row count changes | Reset all edit state |
| Keyed fixed editor, cosmetic sizing changes | Preserve edit state |
| Unkeyed editor, values change | Existing reset behavior (unchanged) |
| `num_rows` is `add`, `delete`, or `dynamic` | Use `apply_edits` callback (Phase 2) |

Documentation should note that `key` is required for dynamic input data preservation.

---

### Phase 2: Callback-Based Edit Handling (`apply_edits`)

**Goal**: Provide an advanced API for explicit edit commit control, especially for database-backed
workflows, validation, and programmatic reset.

**Positioning**: `apply_edits` is the robust/advanced API for complex editing scenarios. For the
simple session-state round-trip pattern, automatic commit detection (see "Alternative Approach")
may be added later as a convenience path. The callback should not be required for basic use cases.

**Why a callback approach**: Phase 1's schema-based identity works for fixed-row editors because
cell edits are position-stable. For row operations (add/delete), detecting when operations have
been "committed" to the source data is complex and error-prone. A callback gives users explicit
control and solves additional use cases (database sync, validation, programmatic reset).

#### 2.1 Proto Field for Frontend State Clear

**The problem**: Backend mutation of widget state (e.g., `_clear_edit_state(widget_state)`) won't
clear the browser's `EditingState` or `WidgetStateManager` value. The frontend and backend can
have divergent edit state.

**Solution**: Add a proto field to signal the frontend to clear/replace its local edit buffer:

```protobuf
message Dataframe {
  // ... existing fields (1-12) ...

  // When present, frontend replaces its local EditingState with this value.
  // Empty string means "clear all edits". Backend sets this after successful
  // apply_edits callback.
  optional string editing_state = 13;
}
```

After a successful `apply_edits` callback:
1. Backend sets `proto.editing_state = ""` (or normalized state JSON)
2. Frontend checks `element.editingState` on render
3. If present, frontend replaces `editingStateRef.current` and syncs to `WidgetStateManager`

This ensures the frontend edit overlay is cleared in the same render that displays the callback's
returned dataframe.

#### 2.2 Proposed API

**Recommended signature** — include `source_df` for database delete support:

```python
def apply_edits(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: EditState,
) -> pd.DataFrame:
    """Called when user edits trigger a rerun.

    Args:
        source_df: The original dataframe passed to st.data_editor (before edits).
        edited_df: The dataframe with edits already applied (convenience).
        edits: Raw edit state {"edited_rows": {...}, "added_rows": [...], "deleted_rows": [...]}.

    Returns:
        The new source dataframe. Edit state is cleared; this becomes the new baseline.
    """
```

**Why `source_df` is needed**: For database deletes, `deleted_rows: [3, 5]` gives row positions,
but the callback needs to map these back to primary keys. Without `source_df`, users must close
over the source dataframe, which the API should not require.

**Example with database deletes:**

```python
def sync_to_postgres(source_df, edited_df, edits):
    # Map deleted row positions to primary keys
    for row_idx in edits["deleted_rows"]:
        pk = source_df.iloc[row_idx]["id"]
        delete_from_db(pk)

    # Persist edits and additions
    for row_idx, changes in edits["edited_rows"].items():
        pk = source_df.iloc[row_idx]["id"]
        update_in_db(pk, changes)

    for row in edits["added_rows"]:
        insert_in_db(row)

    return load_from_postgres()

st.data_editor(
    load_from_postgres(),
    key="editor",
    num_rows="dynamic",
    apply_edits=sync_to_postgres,
)
```

**Alternative: Event object** (more extensible):

```python
@dataclass
class DataEditorEditEvent:
    source_df: pd.DataFrame
    edited_df: pd.DataFrame
    edits: EditState

def apply_edits(event: DataEditorEditEvent) -> pd.DataFrame:
    ...
```

The event object is more extensible for future additions but adds a new type to learn. The 3-arg
signature is recommended for simplicity.

#### 2.3 Semantics

| Aspect | Behavior |
|--------|----------|
| When called | On rerun when edits are present (not on every render) |
| Input | `source_df` + `edited_df` + `edits` |
| Return value | New source dataframe; becomes the baseline, edit state cleared |
| Exception | See "Failure Behavior" below |
| No edits | Callback not invoked; widget renders source data as-is |
| With forms | Callback invoked on form submit, not on each cell edit |

#### 2.4 Failure Behavior

When the callback raises an exception, the behavior must be precisely defined:

**Option A: Validation-style UX (recommended for `apply_edits`)**

1. Exception is caught by the widget
2. Edit state is **preserved** (user's work is not lost)
3. `st.error(str(exception))` is displayed
4. `st.data_editor()` returns `edited_df` (the invalid data, so downstream code sees user's input)
5. Widget renders with preserved edits overlaid on original source data
6. User can fix the issue; next interaction re-invokes callback

**Option B: Let exception propagate**

1. Exception propagates up, halting the script
2. Edit state is preserved (widget state not cleared)
3. User sees standard Streamlit exception UI
4. `st.data_editor()` return value is never reached

**Recommendation**: Option A for `apply_edits` specifically, since the callback is meant for
validation workflows. Document that exceptions are caught and shown as errors. Users who want
propagation can re-raise after logging or use a wrapper.

```python
def validate_and_save(source_df, edited_df, edits):
    if edited_df["amount"].sum() > 10000:
        raise ValueError("Total amount cannot exceed $10,000")
    # Callback catches this, shows error, preserves edits
    return edited_df

# If validation fails:
# - st.error("Total amount cannot exceed $10,000") is shown
# - st.data_editor() returns edited_df (the invalid data)
# - Edit state is preserved for retry
result = st.data_editor(df, key="editor", apply_edits=validate_and_save)
```

#### 2.5 Implementation Caveats

**"No one-rerun-behind lag" requires careful marshalling order:**

The claim that "the callback runs during the same rerun" is only true if:

1. The callback result is serialized into the **current** proto (not queued for next run)
2. The frontend receives `editing_state` clear signal in the **same** ForwardMsg
3. The frontend clears the old edit overlay **before** rendering the new data

This requires the implementation to:
- Call `apply_edits` before serializing Arrow data to proto
- Set `proto.editing_state = ""` after successful callback
- Serialize the callback's returned dataframe (not the original source)

If any step is out of order, the user may see a flash of stale state or require an extra rerun.

#### 2.6 How It Solves the Problems

1. **Explicit commit boundary**: The callback marks when edits are committed. No hashing or
   row-count heuristics.

2. **Validation hook**: Exceptions preserve edit state and show errors. User can fix and retry.

3. **Database sync**: `source_df` enables mapping row positions to primary keys for deletes.

4. **Programmatic reset (#6540)**:

   ```python
   def handle_edits(source_df, edited_df, edits):
       if st.session_state.get("revert_requested"):
           st.session_state.revert_requested = False
           return source_df  # Reject edits, return original
       return edited_df  # Accept edits

   st.button("Revert", on_click=lambda: st.session_state.update(revert_requested=True))
   st.data_editor(df, key="editor", apply_edits=handle_edits)
   ```

5. **External refresh**: Callback can return freshly-loaded data with server-side changes.

#### 2.7 Compatibility with Other Features

| Feature | Compatible | Notes |
|---------|------------|-------|
| `on_change` | ✅ | `on_change` runs in WS handler *before* script rerun; `apply_edits` runs *during* rerun inside `st.data_editor`. This means `on_change` cannot observe post-`apply_edits` state. |
| `num_rows` modes | ✅ | Callback receives all pending ops |
| `column_config` | ✅ | Doesn't affect callback |
| `disabled` | ✅ | No edits = callback not invoked |
| `column_order` | ✅ | Doesn't affect callback |
| Forms | ✅ | Callback invoked on form submit only |
| Fragments | ⚠️ | Should work, needs testing |

**Return value**: `st.data_editor()` returns the callback's result (the new source dataframe),
or `edited_df` if the callback raised an exception.

**`st.session_state[key]`**: Edit state is cleared after successful callback (edits are "committed").
On exception, edit state is preserved.

#### 2.8 Implementation Sketch

```python
# In data_editor.py

def _data_editor(..., apply_edits: Callable | None = None):
    # ... existing setup ...

    # Deserialize edit state
    edit_state = _deserialize_edit_state(widget_state.value)
    callback_failed = False
    edited_df = None  # Initialize outside conditional for proper scoping

    if apply_edits is not None and _has_pending_edits(edit_state):
        # Apply edits to get edited_df
        edited_df = _apply_dataframe_edits(data_df.copy(), edit_state, ...)

        try:
            # User callback handles persistence, returns new source
            # Pass source_df, edited_df, and raw edits
            new_source_df = apply_edits(data_df, edited_df, edit_state)

            # Success: use returned dataframe as new source
            data_df = new_source_df
            arrow_bytes = _serialize_to_arrow(data_df)

            # Signal frontend to clear edit state
            proto.editing_state = ""

        except Exception as e:
            # Preserve edit state, surface error
            # Note: st.error() places the message at the widget's location in script flow.
            # Alternative: show error inline in the widget UI (similar to input validation).
            # Decision point: validation failures vs infrastructure/persistence failures may
            # warrant different UX. For initial implementation, st.error() is simpler.
            st.error(f"Failed to apply edits: {e}")
            callback_failed = True
            # Return edited_df so downstream code sees user's input
            # Do NOT set proto.editing_state — preserve edits for retry

    # Serialize proto with (possibly updated) arrow_bytes
    # ...

    # Return value depends on callback outcome
    if callback_failed:
        return edited_df  # Invalid data, but user's input
    return data_df
```

#### 2.9 Open Questions

1. **Naming**: `apply_edits`, `on_commit`, `on_apply`, `persist`, `sync`? Existing widget callbacks
   use the `on_*` pattern (`on_change`, `on_click`). `on_commit` or `on_apply` may align better with
   established conventions. However, `apply_edits` reads as imperative (what it does) vs. `on_*`
   which reads as reactive (when it fires). **Recommendation**: Prefer `on_commit` for consistency
   with the `on_*` pattern, or `apply_edits` if the imperative name is clearer for this use case.

2. **Async support**: Should the callback support `async def`? Database operations are often async.

3. **Batching**: For `num_rows="dynamic"`, should adds/deletes be applied incrementally or batched?
   The current design batches (callback sees all pending ops at once).

4. **Partial success**: What if some rows persist but others fail? Current design is all-or-nothing
   (raise to reject all). Fine-grained error handling would need richer return type.

5. **Caching**: The callback has side effects and should NOT be cached. Need to document clearly.

#### 2.10 Relationship to Existing Callbacks

| Callback | Purpose | Timing |
|----------|---------|--------|
| `on_change` | React to any edit (existing) | After edit, before rerun completes |
| `apply_edits` (proposed) | Persist edits, return new source | During rerun, replaces source data |

`on_change` is for side effects (logging, validation feedback). `apply_edits` is for the
persistence/refresh cycle. They can coexist — `on_change` fires first, then `apply_edits`.

#### 2.11 Behavior Summary

**`num_rows="add"`, `"delete"`, `"dynamic"` (with `key` and `apply_edits`)**:

| Scenario | Behavior |
|----------|----------|
| User adds/deletes rows, callback persists | Callback returns new source, edit state cleared |
| Callback raises exception | Edit state preserved, error shown, user can retry |
| Callback returns original data | Effectively "revert" — edits discarded |
| No `apply_edits` provided | Fall back to existing behavior (edits may be lost on data change) |

---

### Phase 3: External Data Changes (Future)

**Goal**: Handle cases where source data changes independently (database reloads, concurrent
edits, filtering/sorting in the source).

**Scope**: Out of scope for initial implementation. This phase would require:

- Row identity (via meaningful DataFrame index or computed row hash)
- Value-based conflict detection (`{original, edited}` per cell)
- More complex reconciliation logic

**Recommendation**: Defer until Phase 1-2 ship and gather user feedback. The simple "row operations
committed" detection in Phase 1-2 handles the most common use cases.

---

### Alternative Approach: Automatic Commit Detection

This section documents an alternative to Phase 2's `apply_edits` callback — automatic detection
of when row operations have been committed to the source dataframe. This approach is more complex
and has edge cases, but could be implemented if users strongly prefer not to use a callback.

**When to consider this approach**: If the `apply_edits` callback proves too invasive for simple
session-state round-trip patterns, this automatic detection could be added as a fallback.

#### Backend Identity Change

Extend `key_as_main_identity` to cover add/delete/dynamic modes:

```python
element_id = compute_and_register_element_id(
    "data_editor",
    user_key=key,
    key_as_main_identity={"data_signature", "num_rows"}
    if key is not None  # Remove "and num_rows == 'fixed'" condition
    else False,
    # ...
)
```

#### Widget State JSON v2

Extend the widget state format:

```json
{
  "edited_rows": {},
  "added_rows": [],
  "deleted_rows": [],
  "base_num_rows": 3,
  "base_data_hash": "abc123",
  "last_applied_data_hash": "def456",
  "editing_state_version": 2
}
```

- `base_data_hash`: Hash of source data when editing started
- `last_applied_data_hash`: Hash of the dataframe returned by `st.data_editor` after applying edits

#### State Sync Challenge

**The core problem**: `register_widget` returns a deep copy of widget state, so mutating backend
state won't clear the browser's `EditingState` buffer.

**Option A: Add proto fields (recommended for reliability)**

```protobuf
// Note: If Phase 2 is implemented first, editing_state = 13 is taken.
// These fields would use 14-16 instead.
optional string source_data_hash = 14;
optional string applied_data_hash = 15;
optional string editing_state_v2 = 16;  // Backend-normalized state
```

**Option B: Frontend-only normalization (simpler but less reliable)**

Frontend computes hash and normalizes on its own — can diverge from backend logic.

#### Backend Normalization

```python
def _normalize_editing_state(editing_state, source_data_hash, current_num_rows):
    base_hash = editing_state.get("base_data_hash")
    last_applied_hash = editing_state.get("last_applied_data_hash")

    if base_hash is None:
        return editing_state, False  # Legacy state

    if base_hash == source_data_hash:
        return editing_state, False  # Source unchanged

    if last_applied_hash == source_data_hash:
        # Write-back committed — clear all pending operations
        return {"edited_rows": {}, "added_rows": [], "deleted_rows": [], ...}, True

    # External change — clear row ops, keep in-bounds cell edits
    return _clear_row_operations(editing_state, current_num_rows), True
```

#### Why `apply_edits` is Preferred

| Aspect | `apply_edits` | Automatic Detection |
|--------|--------------|---------------------|
| Commit boundary | Explicit (callback) | Implicit (hash matching) |
| State sync | Callback clears state | Requires proto fields or frontend sync |
| Edge cases | None — user controls | Hash collisions, timing issues |
| Database support | Native — callback persists | Requires separate write-back code |
| Validation | Built-in (raise to reject) | Not supported |
| Complexity | Low | Medium-high |

---

## Testing Strategy

### Phase 1 Tests

**Unit Tests** (`lib/tests/streamlit/elements/data_editor_test.py`):

1. Keyed fixed editor keeps the same ID when only cell values change
2. Keyed fixed editor changes ID when columns, data kinds, or row count changes
3. Keyed fixed editor keeps the same ID when column_order or column_config changes
4. Unkeyed editor still changes ID when values change
5. `_compute_data_editor_signature` stability: same structure → same hash
6. `_compute_data_editor_signature` sensitivity to: column names, Arrow types, index type,
   row count (fixed only), disabled state

**Frontend Unit Tests** (`frontend/lib/src/components/widgets/DataFrame`):

1. `onCellEdited`: editing cell to match source value clears edit instead of storing
2. `onCellEdited`: editing cell to different value stores edit normally
3. Edit reconciliation on data change: edit matching new source value is cleared
4. Edit reconciliation on data change: edit not matching source value is preserved
5. `valuesEqual`: handles null/undefined equivalence
6. `valuesEqual`: handles type coercion via `getCellValue` (e.g., "5" vs 5)

**E2E Tests** (`e2e_playwright/st_data_editor_dynamic_data_test.py`):

1. **#7749 repro with `key="editor"`**: Editing `In` column does not disappear
2. Downstream `st.write` reflects the edited dataframe
3. Document/assert that derived values inside the editor may require one more rerun
4. **Fixed mode - value changes preserve edits**: Edit cell, modify computed column, verify
   edit persists
5. **Fixed mode - row count change resets**: Edit cell, add row externally, verify reset
6. **Fixed mode - column change resets**: Edit cell, add column, verify reset
7. **Edit reconciliation - user reverts**: Edit cell to X, edit back to original, verify
   cell shows source value (not stored as edit)
8. **Edit reconciliation - source catches up**: Edit cell to X, source updates to X, source
   updates to Y, verify cell shows Y (edit was cleared when source matched)

### Phase 2 Tests

**Unit Tests**:

1. `apply_edits` callback invoked when edits present
2. `apply_edits` callback not invoked when no edits
3. `apply_edits` return value becomes new source dataframe
4. `apply_edits` exception preserves edit state and shows error
5. Edit state cleared after successful `apply_edits` callback
6. `apply_edits` receives both `edited_df` and raw `edits` dict

**Frontend Unit Tests**:

1. Widget returns callback's result dataframe
2. `st.session_state[key]` cleared after callback success

**E2E Tests**:

1. Database sync pattern: callback persists and returns refreshed data
2. Validation pattern: callback raises, edits preserved, error shown
3. Revert pattern: callback returns original data, edits discarded
4. Form integration: callback invoked on form submit only

---

## Backward Compatibility

### Behavioral Changes

- When `key` is **not** provided, behavior is unchanged (full data in element ID).
- When `key` **is** provided, behavior changes from "reset on any data change" to "reset only on
  schema change". While this is generally an improvement, apps that rely on edit state being
  wiped when the source dataframe mutates (e.g., to clear stale edits after a server-side refresh)
  will observe new behavior.

### Migration Path

Existing apps that provide `key` will automatically benefit from edit state preservation. For
apps that rely on the current "reset on data change" behavior:

1. **Remove `key`**: Without a key, the widget retains current behavior (reset on any data change)
2. **Switch to `apply_edits`**: Use the Phase 2 callback for explicit control over when edits reset
3. **Programmatic clear**: Clear `st.session_state[key]` to force edit state reset when needed

---

## Alternatives Considered

These alternatives were considered and rejected for the core dynamic data changes feature.
Note: Automatic commit detection (see "Alternative Approach" section) is documented as a fallback
if the `apply_edits` callback proves insufficient for some use cases.

### Option A: Full Reconciliation with Row Identity

Track row identity via DataFrame index or row content hash. Apply edits by identity instead
of position.

**Rejected because**: Much higher complexity, requires meaningful index from users, introduces
ambiguity when rows have duplicate content, and doesn't solve the common use case (round-trip
to session state) better than the proposed approach.

### Option B: `persist_edits` Parameter

Add a new parameter to opt into the behavior: `st.data_editor(df, key="x", persist_edits=True)`.

**Rejected because**: Other widgets don't have this - providing `key` is already the signal for
"I want persistent identity." Adding a parameter creates unnecessary API surface and doesn't
match established patterns.

### Option C: Store Full Edited DataFrame in Widget State

Send the entire edited DataFrame from frontend to backend instead of just deltas.

**Rejected because**: Massive increase in message size, doesn't solve the identity problem, and
would require significant frontend/proto changes.

---

## Checklist

| Item | ✅ or comment |
|------|--------|
| Works on SiS, Cloud, etc? | Yes — uses standard `compute_and_register_element_id` |
| Breaking API changes | None — new behavior only when `key` is provided |
| No new dependencies | Yes |
| New proto fields | Phase 1: None. Phase 2: Yes — `editing_state` for frontend clear signal |
| Metrics collected | Consider tracking keyed vs unkeyed data_editor usage |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — document `key` for edit persistence, `apply_edits` for row operations |
| E2E test coverage | Required for each `num_rows` mode |
| Unit test coverage | Required for signature computation and `apply_edits` logic |
