---
author: lukasmasuch
created: 2026-05-13
---

# Dynamic Data Updates for st.data_editor

## Summary

Phase 1 was implemented in
[#15884](https://github.com/streamlit/streamlit/pull/15884). Keyed `st.data_editor` widgets with
`num_rows="fixed"` now use **schema-based identity**: the element ID incorporates editing-relevant
structure but not cell values, allowing value changes while preserving compatible edit state.
The frontend also removes stored edits once they match the current source value.

Phase 2 remains a proposal. It adds an **`apply_edits` callback** for database-backed editing,
validation, explicit persistence, and row-operation workflows. Phase 3 remains future work for
concurrent or independently changing external data.

The user-facing API for that callback is covered in the companion product spec:
[`../2026-05-13-data-editor-apply-edits/product-spec.md`](../2026-05-13-data-editor-apply-edits/product-spec.md).

## Problem

### Pre-Phase-1 Behavior and Remaining Gap

Before Phase 1, `st.data_editor` always computed its element ID from the full serialized Arrow
data:

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
# Pattern that failed before Phase 1:
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
  the editor to a fresh dataframe. Direct assignment to the widget's session-state value remains
  disallowed, and changing the source does not provide an explicit clear/commit operation for
  pending edits.

Phase 1 fixes this pattern for keyed fixed-row editors. Unkeyed editors and keyed editors with
`num_rows="add"`, `"delete"`, or `"dynamic"` retain full-data identity, so row-operation
workflows remain the Phase 2 gap.

### Contrast with Other Widgets

Other widgets use `key_as_main_identity` to allow dynamic changes while preserving state:

| Widget | `key_as_main_identity` | Behavior |
|--------|----------------------|----------|
| `st.selectbox` | `{"accept_new_options"}` | Options can change dynamically |
| `st.slider` | `{"min_value", "max_value", "step"}` | Only range changes reset state |
| `st.dataframe` (with selection) | `{"selection_mode", "is_selection_activated"}` | Data can change, selections persist |
| `st.data_editor` (keyed, fixed rows) | `{"data_signature", "num_rows"}` | Value-only changes preserve compatible edits |
| `st.data_editor` (unkeyed or non-fixed rows) | `False` | Any data change resets state |

## Architecture Constraints

Understanding these constraints is critical for the proposed solution:

1. **Positional Edit Tracking**: `EditingState` tracks edits by row position (integer index), not
   row identity. `edited_rows` is a map of `row_position -> column_name -> value`.

2. **Frontend Reset Trigger**: `useWidgetState` resets `EditingState` when `originalNumRows`
   changes. Phase 1 additionally changes element identity for incompatible schemas.

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

### Phase 1: Schema-Based Identity for Fixed-Row Editors Only (Implemented)

**Result**: Dynamic data value changes preserve compatible cell edits when `key` is provided and
row count is fixed.

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

Phase 1 added `_compute_data_editor_signature`, which changes when old edit deltas are no longer
safe to apply.

**The implemented signature includes**:

- Data format used for return conversion (`data_format`)
- Column names in order (after `_fix_column_headers`)
- Index column names and index kind
- Arrow field names, logical types, and nullability for index and data columns
- `DataframeSchema` data kinds used for parsing edited values
- Row count
- The top-level `disabled` argument
- Resolved disabled columns, including `column_config` and columns automatically disabled because
  their values are Arrow-incompatible

**Signature limitations and Phase 1 scope**:

Phase 1 intentionally scopes to cases where **row identity and edit-affecting config stay stable**.
Because the new behavior is automatic for keyed fixed-row editors, the following safeguards prevent
silent data corruption:

**Same-row-count reorder detection** (safety mechanism):

When the index is not the canonical default `RangeIndex`, the implementation hashes its values.
This detects row reorders even when row count is unchanged:

```python
# In _compute_data_editor_signature:
if not isinstance(data_df.index, pd.RangeIndex) or (
    data_df.index.start != 0
    or data_df.index.stop != len(data_df.index)
    or data_df.index.step != 1
):
    h.update(b"index_values:")
    try:
        h.update(
            pd.util.hash_pandas_object(data_df.index, index=False)
            .to_numpy()
            .tobytes()
        )
    except TypeError:
        h.update(str(data_df.index.tolist()).encode("utf-8"))
    h.update(b"\0")
```

**Rationale**: Apps that re-sort or refetch rows (a common pattern, per #7749) will silently replay
edits onto the wrong logical records without this detection. Only the canonical default
`RangeIndex(start=0, step=1)` is considered identity-stable since it typically means "row positions
are the identity." Other `RangeIndex` variants, such as `RangeIndex(step=-1)` from `df.iloc[::-1]`,
represent real row reorders and must be hashed. A meaningful index (e.g., primary keys,
timestamps, categorical labels) signals that row position may change while logical identity is
stable — exactly the scenario where stale positional edits are dangerous.

**RangeIndex limitation**: For dataframes with the canonical default `RangeIndex(start=0, step=1)`,
a same-length refetch could theoretically replay stale positional edits onto different logical
rows. Phase 1 accepts this limitation because: (1) users with meaningful row identity typically
have a meaningful index, and (2) the alternative (treating default RangeIndex editors as unsafe)
would regress the common case of stable positional data. Apps that refetch RangeIndex data and
want safety should use `apply_edits` (Phase 2) or set a meaningful index on their dataframe.

**Disabled-column changes**:

Changing which columns are disabled resets edit state. The implementation normalizes
`disabled=False` and `disabled=[]` to the same signature and separately incorporates resolved
disabled columns from `column_config` and automatic Arrow compatibility handling:

```python
# Disabled state handling
if disabled is True:
    add_to_signature("disabled", "all")
elif disabled is False:
    add_to_signature("disabled", "none")
else:
    disabled_names = tuple(sorted(disabled, key=repr))
    add_to_signature("disabled", disabled_names or "none")

add_to_signature("disabled_columns", tuple(sorted(disabled_columns, key=repr)))
```

These safeguards ensure the new behavior is safe by default. Apps with canonical default
`RangeIndex` and stable row positions will benefit from edit preservation. Apps that reorder rows
with meaningful indices or non-default `RangeIndex` variants will see edit state reset (safe
fallback). Phase 3 (row identity via meaningful index) could enable smarter edit remapping if
needed.

**Required docstring callout**: The `key` parameter docstring in `st.data_editor` MUST include a
warning about the row-positioning semantics. Suggested wording:

> **Note**: When `key` is provided with `num_rows="fixed"`, edits are tracked by row *position*.
> If rows may be reordered, use a meaningful index so Streamlit can detect the reorder and clear
> stale edits; edits are not remapped by index. To retain the previous reset-on-change behavior,
> omit the `key` parameter. For full control over edit application, see the `apply_edits` parameter
> (available in Phase 2).

**Note**: The reference to `apply_edits` in the docstring should be gated behind Phase 2 shipping.
If Phase 1 ships standalone, use this simpler wording instead:

> **Note**: When `key` is provided with `num_rows="fixed"`, edits are tracked by row *position*.
> If rows may be reordered, use a meaningful index so Streamlit can detect the reorder and clear
> stale edits; edits are not remapped by index. To retain the previous reset-on-change behavior,
> omit the `key` parameter.

This ensures users discover the behavior at the point of use (IDE autocomplete, help tooltip)
rather than only in documentation.

**The implemented signature excludes**:

- Cell values
- `width`, `height`, `use_container_width` (cosmetic)
- `row_height`, `placeholder` (cosmetic)
- `column_order` (only affects initial visibility; users can show hidden columns via UI)
- Cosmetic `column_config` fields such as labels and formatting

Resolved disabled columns are the exception to the `column_config` exclusion because they affect
which pending edits remain valid. Other type-changing `column_config` updates are the developer's
responsibility; `DataframeSchema` captures the source Arrow/pandas parsing kinds but not every
frontend rendering option.

The merged helper encodes each `(label, value)` component with `repr()` and a NUL terminator. This
prevents ambiguous boundaries between adjacent names or values and keeps the full meaningful-index
hash instead of truncating it.

**Use Signature in Element ID**

```python
use_signature_identity = key is not None and num_rows == "fixed"
key_as_main_identity = (
    {"data_signature", "num_rows"} if use_signature_identity else False
)
signature_kwargs = {}

if use_signature_identity:
    disabled_columns = [
        column
        for column, config in column_config_mapping.items()
        if config.get("disabled") is True
    ]
    signature_kwargs["data_signature"] = _compute_data_editor_signature(
        data_df=data_df,
        data_format=data_format,
        arrow_schema=arrow_table.schema,
        dataframe_schema=dataframe_schema,
        disabled=disabled,
        disabled_columns=disabled_columns,
        include_row_count=True,
    )

element_id = compute_and_register_element_id(
    "data_editor",
    user_key=key,
    key_as_main_identity=key_as_main_identity,
    dg=self.dg,
    data=arrow_bytes,
    num_rows=num_rows,
    **signature_kwargs,
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

**Implemented solution**: Two-pronged cleanup clears edits when they match source data.

Phase 1 added two `EditingState` helpers:

- `clearCell(col, row)` removes a stored edit for an existing source row and prunes an empty row
  map. It intentionally does nothing for added rows, which have no source cell.
- `forEachEditedCell(callback)` snapshots and iterates edited cells for existing source rows so the
  callback can safely remove entries during iteration.

**1. At edit time** (`onCellEdited`, `onPaste`): If an existing edit is changed back to its current
source value, clear the edit instead of storing another overlay. Added rows are excluded.

```typescript
// In onCellEdited handler
if (
  !editingState.current.isAddedRow(originalRow) &&
  editingState.current.getCell(originalCol, originalRow) !== undefined &&
  valuesEqual(getSourceCellValue(column, originalRow), newValue, column)
) {
  editingState.current.clearCell(originalCol, originalRow)
} else {
  editingState.current.setCell(originalCol, originalRow, newCell)
}
```

**2. On data change**: `useEditReconciliation` uses `useExecuteWhenChanged` to walk stored edits
when the Arrow-backed `data` object changes. It also reruns when editing is re-enabled or when edit
state is hydrated from `WidgetStateManager` after a remount.

```typescript
useExecuteWhenChanged(
  () => {
    if (!isEditingEnabled) return

    let hasClearedCells = false
    editingState.current.forEachEditedCell((col, row, editCell) => {
      const column = columnsByIndex.get(col)
      if (!column || row < 0 || row >= data.dimensions.numDataRows) return

      const sourceValue = getSourceCellValue(column, row)
      const editValue = column.getCellValue(editCell)

      if (valuesEqual(sourceValue, editValue, column)) {
        editingState.current.clearCell(col, row)
        hasClearedCells = true
      }
    })

    if (hasClearedCells) syncEditState()
  },
  [data, isEditingEnabled, editStateHydrationCount]
)
```

**Performance note**: The reconciliation iterates every stored edit, reads its source value from
the Arrow-backed table through `getSourceCellValue`, and normalizes the edit with
`column.getCellValue`. This runs when the `Quiver` data reference changes, not when the schema
signature changes: value-only changes deliberately keep the schema signature stable and are
exactly when source catch-up reconciliation is needed. No explicit repaint is required because
reconciliation occurs during render and the new `data` already refreshes the grid.

**Value comparison** (`valuesEqual`):

Using `column.getCellValue()` normalizes both values to the column's native type, handling
type coercion (e.g., `"5"` vs `5`). Additional considerations:

- **Null/undefined**: Treat as equivalent
- **Floats**: Use epsilon comparison or same serialization path if precision issues arise
- **Objects/arrays**: Deep equality or JSON serialization

```typescript
function valuesEqual(a: unknown, b: unknown, column: BaseColumn): boolean {
  if (isNullOrUndefined(a) && isNullOrUndefined(b)) return true
  if (isNullOrUndefined(a) || isNullOrUndefined(b)) return false

  if (column.valuesEqual) {
    try {
      return column.valuesEqual(a, b)
    } catch {
      return Object.is(a, b)
    }
  }

  return Object.is(a, b)
}
```

Column-specific comparators are implemented for datetime, JSON, list, multiselect, and number
columns. Comparator failures fall back to `Object.is` so reconciliation cannot break the editor.

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
| `num_rows` is `add`, `delete`, or `dynamic` | Existing full-data identity remains; Phase 2 proposes `apply_edits` |

Documentation should note that dynamic input preservation requires `key` and, in Phase 1,
`num_rows="fixed"`.

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

**Required identity change for `apply_edits`**:

Phase 2 must extend signature-based identity to every keyed editor that provides `apply_edits`,
regardless of `num_rows`. Otherwise a successful callback that changes the source Arrow bytes
(for example, returning a freshly loaded database dataframe) remounts the widget on the next
rerun, and the user's first edit after the commit can be dropped.

For the integrated Phase 1 + Phase 2 implementation:

```python
use_signature_identity = key is not None and (
    num_rows == "fixed" or apply_edits is not None
)

signature_kwargs = {}
if use_signature_identity:
    # Without apply_edits, row count and meaningful index values remain safety
    # signals. With apply_edits, the callback owns row-operation commits, so
    # either changing after a successful commit must not remount the widget.
    include_row_count = num_rows == "fixed" and apply_edits is None
    include_index_values = apply_edits is None

    disabled_columns = [
        column
        for column, config in column_config_mapping.items()
        if config.get("disabled") is True
    ]

    signature_kwargs["data_signature"] = _compute_data_editor_signature(
        data_df=data_df,
        data_format=data_format,
        arrow_schema=arrow_table.schema,
        dataframe_schema=dataframe_schema,
        disabled=disabled,
        disabled_columns=disabled_columns,
        include_row_count=include_row_count,
        include_index_values=include_index_values,
    )

element_id = compute_and_register_element_id(
    "data_editor",
    user_key=key,
    key_as_main_identity={"data_signature", "num_rows"}
    if use_signature_identity
    else False,
    dg=self.dg,
    data=arrow_bytes,  # Still passed for unkeyed editors and keyed dynamic editors without apply_edits
    **signature_kwargs,
    num_rows=num_rows,
    # ...other params
)
```

This keeps Phase 1 scoped to automatic fixed-row preservation while making Phase 2 safe for
`num_rows="add"`, `"delete"`, and `"dynamic"`. Including `num_rows` in the identity preserves a
reset when the developer changes editing mode. Excluding row count **and meaningful index values**
for `apply_edits` prevents committed add/delete operations or a refreshed indexed baseline from
changing identity and dropping the first subsequent edit.

Phase 2 therefore adds an `include_index_values` argument to the Phase 1 signature helper. This is
an intentional safety trade-off: while edits are pending, the `data` argument must remain the last
committed baseline. Independently reordering, replacing, or refreshing rows while pending edits
exist is out of scope because edit deltas are positional and contain no original row identity or
source version. Apps requiring optimistic concurrency must validate a database version inside the
callback and reject conflicts; automatic reconciliation belongs to Phase 3.

#### 2.1 Proto Fields for Frontend State Clear

**The problem**: Backend mutation of widget state (e.g., `_clear_edit_state(widget_state)`) won't
clear the browser's `EditingState` or `WidgetStateManager` value. The frontend and backend can
have divergent edit state.

**Solution**: Add proto fields to signal the frontend to clear/replace its local edit buffer:

```protobuf
message Dataframe {
  // ... existing fields (1-13) ...

  // Explicit EditingState control signal from backend to frontend.
  //
  // Semantics (mirroring the Dataframe.selection_state pattern):
  // - ABSENT: Frontend keeps its current EditingState unchanged. This is the
  //   default for most renders where the backend is not actively controlling state.
  // - EMPTY STRING (""): Clear all edits. Backend sets this after successful
  //   apply_edits callback to signal that edits have been committed.
  // - NON-EMPTY JSON STRING: Replace EditingState with this normalized value.
  //   Format: {"edited_rows": {...}, "added_rows": [...], "deleted_rows": [...]}
  //   Use case: Backend-driven partial state reset (future extension).
  // - editing_state_nonce: Unique per backend state-control signal. Frontend
  //   applies editing_state once per nonce so repeated values such as "" still
  //   trigger on consecutive commits, but ordinary React rerenders do not
  //   repeatedly clear user edits made after the signal was applied.
  //
  // Example usage in apply_edits flow:
  // - User edits -> rerun -> callback succeeds -> backend sets editing_state = ""
  //   and editing_state_nonce = "..."
  // - Frontend receives proto, sees a new nonce, replaces local state
  // - Frontend renders clean (no edit overlay)
  optional string editing_state = 14;
  optional string editing_state_nonce = 15;
}
```

After a successful `apply_edits` callback:
1. Backend sets `proto.editing_state = ""` (clear signal) and a fresh
   `proto.editing_state_nonce`
2. Frontend checks whether `element.editingStateNonce` differs from the last applied nonce for
   this element
3. If the nonce is new, frontend replaces `editingStateRef.current` with parsed value (or empty
   state for "")
4. Frontend records the nonce as applied and syncs the empty state to `WidgetStateManager` with
   `{fromUi: false}` so the programmatic clear does not trigger another rerun
5. Backend enqueues the dataframe with `has_one_shot_effect=True`, matching other server-driven
   widget state updates and preventing payload-reference reuse

This ensures the frontend edit overlay is cleared in the same render that displays the callback's
returned dataframe. It also ensures two consecutive successful commits both clear state, even
though both carry `editing_state = ""`, without applying the same clear signal on every render.

**Backend widget-state reset**:

The frontend signal is necessary but not sufficient. `register_widget` returns a deep copy of the
current widget value, so mutating `widget_state.value` after registration does not update the
backend `SessionState` value exposed through `st.session_state[key]`. After a successful callback,
the implementation must explicitly set the backend widget state to the empty edit state using a
session-state API (or add a dedicated internal helper if the existing API is too indirect). Do not
rely on mutating the `RegisterWidgetResult`.

Implementation requirement:

```python
assert key is not None  # apply_edits enforces keyed editors
empty_edit_state = serde.deserialize(None)
ctx.session_state.reset_state_value(key, empty_edit_state)
```

`reset_state_value` already supports widget-backed keys without triggering the public
"state value cannot be modified" error. The observable contract is that
`st.session_state[key]` reflects an empty edit state after a successful `apply_edits` callback and
preserves the previous edits when the callback raises `DataEditorValidationError`.

#### 2.2 Proposed API

**Recommended signature** — include `source_df` for database delete support:

```python
def apply_edits(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorEditState,
) -> pd.DataFrame:
    """Called when user edits trigger a rerun.

    Args:
        source_df: The original dataframe passed to st.data_editor (before edits).
        edited_df: The dataframe with edits already applied (convenience).
        edits: Normalized edit state
            {"edited_rows": {...}, "added_rows": [...], "deleted_rows": [...]}.

    Returns:
        The new source dataframe. Edit state is cleared; this becomes the new baseline.
    """
```

**Argument order**: `source_df` intentionally comes before `edited_df` because positional edit
metadata (`edited_rows`, `deleted_rows`) is resolved against the pre-edit source dataframe. Public
docs and implementation examples must use the names `source_df`, `edited_df`, and `edits`
prominently. If the implementation review finds adjacent dataframe arguments too easy to misuse,
switch to the event-object alternative below before shipping.

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
    edits: DataEditorEditState

def apply_edits(event: DataEditorEditEvent) -> pd.DataFrame:
    ...
```

The event object is more extensible for future additions but adds a new type to learn. The 3-arg
signature is recommended for simplicity.

**Callback return contract**:

- The callback must return a `pd.DataFrame`; any other return type raises an actionable
  `StreamlitAPIException`.
- The returned dataframe may change values, row count, and index values, but it must preserve the
  source's editing-compatible schema: column order, index kind/names, Arrow field types and
  nullability, and parsing data kinds. A schema-changing return raises `StreamlitAPIException`
  instead of rendering one schema under an element ID computed for another.
- The implementation reruns dataframe normalization, Arrow conversion, schema detection, and
  column-config compatibility checks on the callback result before serializing the current proto.
- `st.data_editor` converts the final pandas dataframe back to the original `data_format` for both
  success and `DataEditorValidationError` return paths, preserving the existing return-type
  contract.
- `pandas.Styler` input is not supported with `apply_edits` in the initial release because styles
  are computed from the pre-callback dataframe and can become invalid after row changes.

The schema restriction still permits the intended database refresh use case: server-generated IDs,
timestamps, normalized values, and committed row additions/deletions can all be returned in the
existing columns.

#### 2.3 Semantics

| Aspect | Behavior |
|--------|----------|
| When called | On rerun when edits are present (not on every render) |
| Input | `source_df` + `edited_df` + `edits` |
| Return value | New pandas source dataframe with a compatible schema; becomes the baseline for this render, edit state cleared |
| Exception | See "Failure Behavior" below |
| No edits | Callback not invoked; widget renders source data as-is |
| With forms | Not supported in the initial release; see compatibility table |

#### 2.4 Failure Behavior

When the callback raises an exception, the behavior must be precisely defined. The public contract
is opt-in: only `DataEditorValidationError` is caught and displayed inline. All other exceptions
follow Streamlit's normal exception path.

**Validation-style UX (`DataEditorValidationError`)**

1. Catch `DataEditorValidationError` (expected failures the user can fix)
2. Edit state is **preserved** (user's work is not lost)
3. `st.error(str(exception))` is displayed
4. `st.data_editor()` returns `edited_df` (the invalid data, so downstream code sees user's input)
5. Widget renders with preserved edits overlaid on original source data
6. User can fix the issue; next interaction re-invokes callback

**Other exceptions**

1. Exception propagates up, halting the script
2. Edit state is preserved (widget state not cleared)
3. User sees standard Streamlit exception UI
4. `st.data_editor()` return value is never reached

**Exception handling hierarchy:**

1. **Always re-raise**: `ScriptControlException` subclasses (`RerunException`, `StopException`)
   so `st.rerun()` / `st.stop()` retain their normal inline control-flow behavior
2. **Catch and display**: `DataEditorValidationError` — show `st.error()` and preserve edit state
   for retry
3. **Propagate everything else**: `ValueError`, `TypeError`, system exceptions
   (`KeyboardInterrupt`, `SystemExit`), database errors, network failures, and infrastructure
   failures

**Security consideration**: Do NOT call `st.error(str(exception))` blindly — exception messages
from database drivers, file I/O, network code, or third-party validators can leak backend details
(connection strings, SQL errors, stack traces, or user input). Recommended pattern:

```python
class DataEditorValidationError(ValueError):
    """User-fixable validation error — safe to display."""
    pass

# In the implementation:
try:
    new_source_df = apply_edits(data_df, edited_df, edit_state)
except ScriptControlException:
    raise  # Let st.rerun() / st.stop() work
except DataEditorValidationError as e:
    # Safe to display — raised intentionally by user code
    st.error(str(e))
    callback_failed = True
except Exception:
    # Infrastructure failure — propagate to normal exception handling
    # This preserves app-wide error redaction and monitoring
    raise
```

**Why the opt-in approach is safer**: A broad `except (ValueError, TypeError)` is wider than it
looks. Third-party validators (pydantic, pandera, marshmallow, etc.) commonly raise `ValueError`
subclasses whose messages embed the offending input data or internal stack fragments. Catching
them and calling `st.error(str(e))` would surface those details to end users. Standardizing on an
explicit `DataEditorValidationError` opt-in means only messages the developer intentionally marked
as user-facing are displayed, while everything else follows Streamlit's normal exception path with
its redaction/logging.

```python
from streamlit.errors import DataEditorValidationError

def validate_and_save(source_df, edited_df, edits):
    if edited_df["amount"].sum() > 10000:
        raise DataEditorValidationError("Total amount cannot exceed $10,000")
    # Callback catches this specific exception, shows error, preserves edits
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
- Split the current pipeline into pre-registration identity preparation and post-callback output
  marshalling
- Call `apply_edits` before serializing the Arrow data placed in the proto
- Validate and normalize the callback result, then rebuild its Arrow table and schema
- Set `proto.editing_state = ""` and a fresh `proto.editing_state_nonce` after successful callback
- Reset backend widget state to the empty edit state after successful callback
- Serialize the callback's returned dataframe (not the original source)
- Enqueue the dataframe with `has_one_shot_effect=True`

If any step is out of order, the user may see a flash of stale state or require an extra rerun.

#### 2.6 How It Solves the Problems

1. **Explicit commit boundary**: The callback, rather than data hashes or row-count heuristics,
   determines when pending edits are committed and can be cleared.

2. **Validation hook**: `DataEditorValidationError` preserves edit state and shows a safe inline
   error. The user can fix the data and retry; unexpected exceptions retain normal handling.

3. **Database sync**: `source_df` enables mapping row positions to primary keys for deletes.

4. **Programmatic reset (#6540)**: Store the accepted working dataframe in session state, and reset
   that session state value back to the last committed baseline when the user clicks Revert.
   Button-only reruns do not invoke `apply_edits` when no edits are pending.

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

   st.button("Revert", on_click=revert_changes)
   st.data_editor(
       st.session_state.working_df,
       key="editor",
       apply_edits=accept_edits,
   )
   ```

5. **Controlled refresh**: Callback can return freshly-loaded values and rows with server-side
   changes while preserving the editing-compatible schema. Independent refreshes while edits are
   pending are a Phase 3 concern.

#### 2.7 Compatibility with Other Features

| Feature | Compatible | Notes |
|---------|------------|-------|
| `on_change` | No (initial release) | Reject combining it with `apply_edits`. `on_change` runs before the script body and can mutate the source before positional edits are applied, making `source_df` ambiguous. |
| `num_rows` modes | Yes | Callback receives all pending ops |
| `column_config` | Yes | The callback receives normalized data only; config is reapplied when validating and rendering its result. |
| `disabled` | Yes | No edits = callback not invoked |
| `column_order` | Yes | Doesn't affect callback |
| `pandas.Styler` | No (initial release) | Styles are based on the pre-callback dataframe and may be invalid after row changes. |
| Forms | No (initial release) | Preserve the existing forms rule that only `st.form_submit_button` may define callbacks. Providing `apply_edits` inside a form should raise `StreamlitAPIException` until a separate forms-ordering design is approved. |
| Fragments | Yes | See details below |

**`on_change` enforcement:**

If both `on_change` and `apply_edits` are provided, raise `StreamlitAPIException`. `apply_edits`
already supplies the edit-handling hook and runs with the normalized source, edited dataframe, and
edit delta. Supporting both later requires a defined ordering and a guarantee that `on_change`
cannot invalidate the baseline before positional edits are applied.

**Fragment compatibility details:**

`apply_edits` works within fragments because:

1. **Fragment reruns**: When a user edits a cell in a `st.data_editor` inside a fragment, only
   that fragment reruns (not the full app). The `apply_edits` callback executes during the
   fragment rerun, same as it would in a full rerun.

2. **Proto `editing_state` signal**: The `editing_state = ""` clear signal and
   `editing_state_nonce` are included in the fragment's delta response. Streamlit's fragment delta
   merge preserves per-element proto fields, so the clear signal reaches the frontend correctly.

3. **Parent vs fragment origin**: The callback doesn't distinguish whether the edit originated
   from a parent rerun or a fragment rerun — it receives the same `edit_state` from the widget
   state manager in both cases.

**Testing requirement**: Implementation PR must include E2E tests for:
- `apply_edits` callback inside a fragment (edit → callback → state cleared)
- Fragment rerun doesn't lose edit state from sibling fragments
- Parent rerun after fragment edit correctly sees committed state

**Return value**: `st.data_editor()` converts the callback's result back to the original input
format. If the callback raises `DataEditorValidationError`, it converts and returns `edited_df` in
that same format.

**`st.session_state[key]`**: Edit state is cleared after successful callback (edits are "committed").
On `DataEditorValidationError`, edit state is preserved. Other exceptions propagate before
`st.data_editor()` returns.

#### 2.8 Implementation Sketch

```python
# In data_editor.py
from uuid import uuid4

from streamlit.errors import DataEditorValidationError
from streamlit.runtime.scriptrunner_utils.exceptions import ScriptControlException

def _data_editor(..., apply_edits: Callable | None = None):
    # Normalize the input and compute the source schema/signature used to
    # register the widget. Proto Arrow bytes are marshalled later.
    # ... source setup and register_widget(...) ...

    # register_widget already returns the deserialized, normalized state.
    edit_state = widget_state.value
    callback_failed = False
    has_one_shot_effect = False

    if apply_edits is not None and _has_pending_edits(edit_state):
        edited_df = data_df.copy()
        _apply_dataframe_edits(edited_df, edit_state, dataframe_schema)

        try:
            callback_result = apply_edits(
                data_df.copy(), edited_df.copy(), deepcopy(edit_state)
            )
            if not isinstance(callback_result, pd.DataFrame):
                raise StreamlitAPIException(
                    "st.data_editor's apply_edits callback must return a pandas DataFrame."
                )

            # Re-run header fixing, Arrow/schema derivation, and column-config
            # compatibility checks. Reject an editing-incompatible schema.
            data_df, arrow_table, dataframe_schema = _prepare_callback_result(
                callback_result,
                expected_signature=source_compatibility_signature,
                column_config_mapping=column_config_mapping,
            )

            # Signal frontend to clear edit state
            proto.editing_state = ""
            proto.editing_state_nonce = uuid4().hex
            has_one_shot_effect = True

            empty_edit_state = serde.deserialize(None)
            ctx.session_state.reset_state_value(key, empty_edit_state)

        except ScriptControlException:
            # Re-raise st.rerun() / st.stop() — these are control flow, not errors
            raise
        except DataEditorValidationError as e:
            # Explicit user-facing validation error: display and preserve edits for retry
            self.dg.error(str(e))
            callback_failed = True
        except Exception:
            raise

    # When apply_edits is None and there are edits, apply them as existing behavior
    elif apply_edits is None and _has_pending_edits(edit_state):
        edited_df = data_df.copy()
        _apply_dataframe_edits(edited_df, edit_state, ...)
        data_df = edited_df  # Existing pre-Phase-2 behavior
    else:
        edited_df = None  # No edits to apply

    # Marshal the final dataframe into the current proto after callback handling.
    proto.arrow_data.data = dataframe_util.convert_arrow_table_to_arrow_bytes(
        arrow_table
    )
    self.dg._enqueue(
        "dataframe",
        proto,
        layout_config=layout_config,
        has_one_shot_effect=has_one_shot_effect,
    )

    result_df = edited_df if callback_failed else data_df
    return dataframe_util.convert_pandas_df_to_data_format(result_df, data_format)
```

**Note**: `_prepare_callback_result` is illustrative. The implementation may factor the existing
input-normalization pipeline differently, but it must validate the returned type and compatibility
before serializing it. When `apply_edits is None`, the existing `_apply_dataframe_edits` path and
return conversion remain unchanged.

#### 2.9 Open Questions

1. **Naming**: Under API review. `apply_edits` remains the working name. The product spec's
   [Naming section](../2026-05-13-data-editor-apply-edits/product-spec.md#naming) compares
   `commit_edits`, `apply_edits_func`, `commit_func`, `resolve_edits`, `process_edits`,
   `on_apply_edits`, and `on_commit`. Do not overload `on_change`: this function has different
   arguments and timing, and Streamlit consumes its return value as the new source dataframe.

2. **Async support**: Should the callback support `async def`? Database operations are often async.
   **Recommendation**: Defer to future work. Initial implementation uses sync callbacks only.

3. **Batching**: For `num_rows="dynamic"`, should adds/deletes be applied incrementally or batched?
   The current design batches (callback sees all pending ops at once). **Recommendation**: Keep
   batched semantics — simpler mental model and atomic persistence.

4. **Partial success**: What if some rows persist but others fail? Current design is all-or-nothing
   (raise to reject all). **Recommendation**: Keep all-or-nothing for MVP. Fine-grained error
   handling would need richer return type and is out of scope.

5. **Caching**: The callback has side effects and should NOT be cached. **Recommendation**: Document
   clearly in docstring that `apply_edits` callbacks should not be wrapped in `@st.cache_*`.

#### 2.10 Relationship to Existing Callbacks

| Callback | Purpose | Timing |
|----------|---------|--------|
| `on_change` | React to any edit (existing; mutually exclusive with `apply_edits`) | In `on_script_will_rerun()`, before script body execution |
| `apply_edits` (proposed) | Persist edits, return new source | During rerun, replaces source data |

`on_change` is for side effects on the existing widget-state contract. `apply_edits` is for the
persistence/refresh cycle and is mutually exclusive with `on_change` in the initial release. This
avoids applying positional edits to a source that an earlier callback may already have mutated.

#### 2.11 Behavior Summary

**`num_rows="add"`, `"delete"`, `"dynamic"` (with `key` and `apply_edits`)**:

| Scenario | Behavior |
|----------|----------|
| User adds/deletes rows, callback persists | Callback returns new source, edit state cleared |
| Callback raises `DataEditorValidationError` | Edit state preserved, error shown, user can retry |
| Callback raises any other exception | Exception propagates through normal Streamlit handling |
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

**Recommendation**: Defer until Phase 2 ships and gather user feedback. Its explicit callback
handles the most common commit workflows without inferring whether independently changed source
data has already incorporated positional edits.

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
// Phase 2 uses editing_state = 14 and editing_state_nonce = 15.
optional string source_data_hash = 16;
optional string applied_data_hash = 17;
optional string editing_state_v2 = 18;  // Backend-normalized state
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
| Edge cases | Explicit commit control; independent external changes remain out of scope | Hash collisions, timing issues |
| Database support | Native — callback persists | Requires separate write-back code |
| Validation | Built-in (raise to reject) | Not supported |
| Complexity | Low | Medium-high |

---

## Testing Strategy

### Phase 1 Tests

Implemented in [#15884](https://github.com/streamlit/streamlit/pull/15884).

**Unit Tests** (`lib/tests/streamlit/elements/data_editor_test.py`):

1. Keyed fixed editor keeps the same ID when only cell values change
2. Keyed fixed editor changes ID when columns, data kinds, or row count changes
3. Keyed fixed editor keeps the same ID when cosmetic `column_order` or `column_config` changes
4. Unkeyed editor still changes ID when values change
5. `_compute_data_editor_signature` stability: same structure → same hash
6. `_compute_data_editor_signature` sensitivity to: column names, Arrow types, index type,
   row count, disabled state, and resolved disabled columns
7. `_compute_data_editor_signature` hashes non-default `RangeIndex` values, including
   `RangeIndex(step=-1)`, so same-length reorders reset edit state

**Frontend Unit Tests** (`frontend/lib/src/components/widgets/DataFrame`):

1. `onCellEdited`: editing cell to match source value clears edit instead of storing
2. `onCellEdited`: editing cell to different value stores edit normally
3. Edit reconciliation on data change: edit matching new source value is cleared
4. Edit reconciliation on data change: edit not matching source value is preserved
5. `valuesEqual`: handles null/undefined equivalence
6. `valuesEqual`: handles type coercion via `getCellValue` (e.g., "5" vs 5)

**E2E Tests** (`e2e_playwright/st_data_editor_editing_test.py`):

1. Keyed fixed editor preserves pending edits across source value changes
2. A source row-count change resets the editor
3. An edit is cleared when the source catches up, allowing a later source value to flow through

Schema, disabled-column, and edit-back-to-source cases are covered by backend or frontend unit
tests where they can be asserted without brittle canvas interactions.

### Phase 2 Tests

**Unit Tests**:

1. `apply_edits` callback invoked when edits present
2. `apply_edits` callback not invoked when no edits
3. `apply_edits` return value becomes new source dataframe
4. `DataEditorValidationError` preserves edit state and shows error
5. Plain `ValueError`/`TypeError` propagates through normal exception handling
6. Edit state cleared after successful `apply_edits` callback in backend session state
7. Keyed `apply_edits` editors keep the same element ID when callback changes cell values
8. Keyed `apply_edits` editors keep the same element ID when callback changes row count or
   meaningful index values
9. Dynamic editors without `apply_edits` keep existing identity behavior
10. `apply_edits` receives both `edited_df` and the normalized `edits` dict
11. `ScriptControlException` (st.rerun/st.stop) propagates correctly from callback
12. `source_df` passed to callback is a copy (ordinary dataframe assignments don't affect the
    original)
13. Non-DataFrame callback returns raise `StreamlitAPIException`
14. Editing-incompatible callback schemas raise `StreamlitAPIException`
15. Combining `on_change` with `apply_edits` raises `StreamlitAPIException`
16. `pandas.Styler` with `apply_edits` raises `StreamlitAPIException`
17. Success and validation-error results are converted back to the original `data_format`
18. The backend marks a successful clear-signal delta with `has_one_shot_effect=True`

**Frontend Unit Tests** (`frontend/lib/src/components/widgets/DataFrame`):

1. `editing_state=""` with a new `editing_state_nonce` clears `EditingState`
2. Two consecutive clear signals with different nonces both clear state, even though both values
   are `""`
3. Re-render with the same `editing_state_nonce` does not clear edits made after the signal was
   applied
4. Frontend syncs the cleared state to `WidgetStateManager` with `fromUi: false`

**Backend Integration Tests**:

1. Widget returns callback's result dataframe
2. `st.session_state[key]` reflects empty edit state after callback success
3. `st.session_state[key]` preserves edits after `DataEditorValidationError`

**E2E Tests**:

1. Database sync pattern: callback persists and returns refreshed data
2. Validation pattern: callback raises `DataEditorValidationError`, edits preserved, error shown
3. Revert pattern: button resets session-state working dataframe to committed baseline
4. Forms enforcement: `apply_edits` inside a form raises `StreamlitAPIException`
5. **Failure-and-retry flow**: Callback raises `DataEditorValidationError` → `st.error` shown and edit state preserved →
   user fixes input (edits cell to valid value) → next interaction re-invokes callback
   successfully → edits cleared and clean state rendered (central UX claim of §2.4)
6. Fragment integration: callback inside fragment executes on fragment rerun, state cleared
7. **Post-commit edit is not lost**: For each `num_rows` mode (`"fixed"`, `"add"`, `"delete"`,
   `"dynamic"`), make an edit that successfully commits and changes the callback-returned baseline,
   then immediately make another edit and verify it is preserved/applied
8. Consecutive successful commits both clear the frontend edit overlay without duplicating
   `added_rows`
9. A successful commit that adds/deletes meaningful-index rows does not lose the next edit

---

## Backward Compatibility

### Behavioral Changes

- When `key` is **not** provided, behavior is unchanged (full data in element ID).
- When `key` **is** provided with `num_rows="fixed"`, behavior changes from "reset on any data
  change" to "reset only on editing-incompatible changes." Apps that rely on edit state being
  wiped when cell values change will observe new behavior. Keyed non-fixed editors are unchanged
  until Phase 2.

### Migration Path

Existing fixed-row editors that provide `key` automatically benefit from edit preservation. For
apps that rely on the previous "reset on data change" behavior:

1. **Remove `key`**: Without a key, the widget retains current behavior (reset on any data change)
2. **Switch to `apply_edits`**: Once Phase 2 ships, use the callback for explicit commit control
3. **Programmatic clear**: Delete `st.session_state[key]` before the editor is instantiated in that
   rerun (for example, from an earlier button callback)

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
| Breaking API changes | Phase 1 changes behavior only for keyed fixed-row editors; Phase 2 adds an optional parameter |
| No new dependencies | Yes |
| New proto fields | Phase 1: None. Phase 2: `editing_state = 14` and `editing_state_nonce = 15` |
| Metrics collected | Track keyed vs. unkeyed editors and `apply_edits` adoption |
| Any security/legal impact? | No new privileges; only explicitly raised `DataEditorValidationError` messages are rendered inline |
| Any docs changes needed? | Yes — document `key` for edit persistence, `apply_edits` for row operations |
| E2E test coverage | Required for each `num_rows` mode |
| Unit test coverage | Required for signature computation and `apply_edits` logic |
