# Investigation: Pre-setting Dataframe Selections via Session State

## Overview

This document investigates what would be needed to allow users to programmatically set and change dataframe selections via `st.session_state`, similar to how other widgets like `text_input` support this pattern:

```python
# Desired behavior (not currently supported)
st.session_state["my_df"] = {"selection": {"rows": [0, 2, 5], "columns": [], "cells": []}}
```

**Related Issues:**
- [#10128](https://github.com/streamlit/streamlit/issues/10128) - Pre-set selections for st.dataframe
- [#9253](https://github.com/streamlit/streamlit/issues/9253) - Setting selection state via Session State
- [#9505](https://github.com/streamlit/streamlit/issues/9505) - Maintaining selections during dataframe updates

## Current Behavior

Currently, dataframe selections are **read-only**. The docstring in `lib/streamlit/elements/arrow.py:99-100` explicitly states:

> "Selection states cannot be programmatically changed or set through Session State."

When a user tries to set a dataframe selection via session state, they receive an error:

```
StreamlitValueAssignmentNotAllowedError: Values for the widget with `key` 'my_df' cannot be set using `st.session_state`.
```

## How Other Widgets Support Programmatic Value Setting

Widgets like `text_input`, `slider`, `checkbox`, etc. support the `st.session_state["key"] = value` pattern. Here's how they work:

### Backend Flow (Python)

1. **Policy Check** (`lib/streamlit/elements/lib/policies.py:59-96`):
   - Widgets call `check_widget_policies()` with `writes_allowed=True` (default)
   - This calls `check_session_state_rules()` which checks if the user set a value via session state
   - For dataframe selections, `writes_allowed=False` is passed, causing an error if the user tried to set a value

2. **Widget Registration** (`lib/streamlit/runtime/state/session_state.py:900-932`):
   - `register_widget()` checks if the user set a new value via `st.session_state`
   - If `is_new_state_value(user_key)` returns `True`, it sets `widget_value_changed = True`
   - Returns `RegisterWidgetResult(widget_value, widget_value_changed)`

3. **Proto Update** (e.g., `lib/streamlit/elements/widgets/text_widgets.py:403-406`):
   - If `widget_state.value_changed` is `True`, the widget proto is updated:
     ```python
     if widget_state.value_changed:
         text_input_proto.value = widget_state.value
         text_input_proto.set_value = True
     ```

### Frontend Flow (TypeScript)

1. **Proto Field** - Each widget that supports programmatic setting has a `set_value` boolean field in its protobuf definition (e.g., `proto/streamlit/proto/TextInput.proto:41`)

2. **Hook Usage** - Widgets use `useBasicWidgetState` hook (`frontend/lib/src/hooks/useBasicWidgetState.ts:172-219`) which:
   - Watches for `element.setValue` to be `true`
   - When true, reads the new value from the proto and updates the UI state
   - Clears the `setValue` flag after processing

## Changes Required for Dataframe Selections

### 1. Backend Changes

#### 1.1 Remove Write Restriction

**File:** `lib/streamlit/elements/arrow.py:662-668`

Change `writes_allowed=False` to `writes_allowed=True`:

```python
# Current code
check_widget_policies(
    self.dg,
    key,
    on_change=cast("WidgetCallback", on_select) if is_callback else None,
    default_value=None,
    writes_allowed=False,  # <-- Change to True
    enable_check_callback_rules=is_callback,
)
```

#### 1.2 Add Value Validation

**File:** `lib/streamlit/elements/arrow.py`

Add a new function to validate selection state values:

```python
def _validate_selection_state(
    value: DataframeState | None,
    num_rows: int,
    column_names: list[str],
    selection_mode: set[SelectionMode],
) -> DataframeState:
    """Validate and normalize a programmatically set selection state."""
    if value is None:
        return {"selection": {"rows": [], "columns": [], "cells": []}}

    # Validate structure
    if "selection" not in value:
        raise StreamlitAPIException(
            "Selection state must contain a 'selection' key"
        )

    selection = value["selection"]

    # Validate rows
    if "rows" in selection:
        for row_idx in selection["rows"]:
            if not isinstance(row_idx, int) or row_idx < 0 or row_idx >= num_rows:
                raise StreamlitAPIException(
                    f"Invalid row index {row_idx}. Must be between 0 and {num_rows - 1}"
                )
        # Check single vs multi-row mode
        if len(selection["rows"]) > 1 and "multi-row" not in selection_mode:
            raise StreamlitAPIException(
                "Multiple rows selected but selection_mode is 'single-row'"
            )

    # Validate columns
    if "columns" in selection:
        for col_name in selection["columns"]:
            if col_name not in column_names:
                raise StreamlitAPIException(
                    f"Invalid column name '{col_name}'"
                )
        # Check single vs multi-column mode
        if len(selection["columns"]) > 1 and "multi-column" not in selection_mode:
            raise StreamlitAPIException(
                "Multiple columns selected but selection_mode is 'single-column'"
            )

    # Validate cells
    if "cells" in selection:
        for row_idx, col_name in selection["cells"]:
            if not isinstance(row_idx, int) or row_idx < 0 or row_idx >= num_rows:
                raise StreamlitAPIException(f"Invalid row index {row_idx} in cell")
            if col_name not in column_names:
                raise StreamlitAPIException(f"Invalid column name '{col_name}' in cell")

    return value
```

#### 1.3 Update Serde to Handle Validation

The `DataframeSelectionSerde` class may need to be updated to accept validation parameters and validate values during deserialization.

#### 1.4 Handle Widget State Changes

**File:** `lib/streamlit/elements/arrow.py:792-802`

Add logic to handle programmatic value changes:

```python
serde = DataframeSelectionSerde()
widget_state = register_widget(
    proto.id,
    on_change_handler=on_select if callable(on_select) else None,
    deserializer=serde.deserialize,
    serializer=serde.serialize,
    ctx=ctx,
    value_type="string_value",
)

# NEW: Handle programmatic value setting
if widget_state.value_changed:
    # Validate the new selection state
    validated_value = _validate_selection_state(
        widget_state.value,
        num_rows=len(data_df),
        column_names=list(data_df.columns),
        selection_mode=selection_mode_set,
    )
    proto.selection_state = json.dumps(validated_value)  # Only set when changed

self.dg._enqueue("arrow_data_frame", proto, layout_config=layout_config)
return widget_state.value
```

### 2. Protobuf Changes

**File:** `proto/streamlit/proto/Arrow.proto`

Add a new optional field to support programmatic selection setting:

```protobuf
message Arrow {
  // ... existing fields ...

  // Selection state (JSON serialized), set when selection is changed programmatically via session state.
  // When present, the frontend should apply this selection. When absent/None, the frontend
  // manages its own selection state (no programmatic override).
  optional string selection_state = 16;
}
```

**Why no `set_value` flag?** Unlike other widgets that always send a value field, we use an optional `selection_state` that's only populated when `widget_state.value_changed` is `True`. The presence/absence of this field is the signal:
- **Field set**: Apply this programmatic selection
- **Field absent**: No programmatic change, frontend manages its own state

### 3. Frontend Changes

#### 3.1 Update useWidgetState Hook

**File:** `frontend/lib/src/components/widgets/DataFrame/hooks/useWidgetState.ts`

Add handling for the `selection_state` field:

```typescript
export interface UseWidgetStateParams {
  element: ArrowProto
  widgetMgr: WidgetStateManager | undefined
  fragmentId?: string
  originalNumRows: number
  originalColumns: BaseColumn[]
}

// In useWidgetState function, add:
useEffect(() => {
  // Only apply if selection_state is set (programmatic change)
  if (!element.selectionState || !widgetMgr) return

  // Parse the selection state from proto
  const selectionState = JSON.parse(element.selectionState)

  // Apply the selection to the widget manager
  widgetMgr.setStringValue(
    { id: element.id, formId: element.formId },
    element.selectionState,
    { fromUi: false },
    fragmentId
  )

  // Trigger a re-render with the new selection
  // This might require additional state management
}, [element.selectionState, element.id, element.formId, widgetMgr, fragmentId])
```

#### 3.2 Update loadInitialSelectionState

The `loadInitialSelectionState` function already supports loading selection state from the widget manager. It may need to be enhanced to handle the programmatic selection case, particularly for:

- Multi-cell selections (currently only single-cell is fully reconstructed)
- Validation that selection indices are within bounds after data changes

#### 3.3 Update DataFrame Component

**File:** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`

The main DataFrame component needs to respond to programmatically set selections:

```typescript
// In the DataFrame component, add an effect to handle selection_state:
useEffect(() => {
  if (element.selectionState) {
    // Load and apply the programmatic selection
    const newSelection = loadInitialSelectionState({
      columns: sortedColumns,
      isRowSelectionActivated,
      isColumnSelectionActivated,
      isCellSelectionActivated,
      isMultiCellSelectionActivated,
    })

    if (newSelection) {
      setGridSelection(newSelection)
    }
  }
}, [element.selectionState, /* other deps */])
```

### 4. Documentation Updates

#### 4.1 Update DataframeSelectionState Docstring

**File:** `lib/streamlit/elements/arrow.py:94-156`

Update the docstring to reflect that selections can now be set programmatically:

```python
class DataframeSelectionState(TypedDict, total=False):
    """
    The schema for the dataframe selection state.

    The selection state is stored in a dictionary-like object that supports both
    key and attribute notation. Selection states can be programmatically set
    through Session State using the widget's key.

    Example
    -------
    >>> import streamlit as st
    >>> import pandas as pd
    >>>
    >>> df = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
    >>>
    >>> # Pre-select rows 0 and 2
    >>> if "my_df" not in st.session_state:
    ...     st.session_state["my_df"] = {
    ...         "selection": {"rows": [0, 2], "columns": [], "cells": []}
    ...     }
    >>>
    >>> event = st.dataframe(
    ...     df,
    ...     key="my_df",
    ...     on_select="rerun",
    ...     selection_mode="multi-row",
    ... )
    ...
    """
```

## Complexity Assessment

### Estimated Effort

| Component | Effort | Notes |
|-----------|--------|-------|
| Backend policy change | Low | Simple flag change |
| Backend validation | Medium | Need to validate row/column bounds and selection mode |
| Protobuf changes | Low | Add 1 optional field |
| Frontend useWidgetState | Medium | New effect to handle selectionState |
| Frontend DataFrame | Medium | Apply programmatic selection to grid |
| Tests | Medium-High | Need Python and frontend tests |
| Documentation | Low | Update docstrings |

### Key Challenges

1. **Data-Selection Mismatch**: When the dataframe data changes (e.g., rows are added/removed), previously set selections may become invalid. Need to decide behavior:
   - Option A: Silently drop invalid indices
   - Option B: Raise an error
   - Option C: Clear all selections if any are invalid

2. **Sorting Interaction**: When the user sorts a dataframe, row selections are currently reset. Need to decide if programmatically set selections should behave the same way.

3. **Multi-Cell Selection**: The current `loadInitialSelectionState` only fully handles single-cell selections. Multi-cell selection restoration needs to be implemented for rectangular ranges.

4. **Timing**: The selection needs to be applied at the right point in the component lifecycle to avoid visual flicker or race conditions with user interactions.

## Alternative Approaches

### Option A: `default_selection` Parameter

Instead of using session state, add a `default_selection` parameter to `st.dataframe`:

```python
st.dataframe(
    df,
    on_select="rerun",
    selection_mode="multi-row",
    default_selection={"rows": [0, 2], "columns": [], "cells": []},
)
```

**Pros:**
- Simpler implementation (no session state integration)
- Clear API intent

**Cons:**
- Different pattern from other widgets
- Less flexible for dynamic updates

### Option B: Hybrid Approach

Support both session state and a `default_selection` parameter, where session state takes precedence if set.

## Recommendations

1. **Start with validation**: Before enabling writes, implement thorough validation to catch invalid selections early with clear error messages.

2. **Handle data changes gracefully**: When data changes and selections become invalid, silently filter out invalid indices rather than erroring. This matches user expectations for dynamic data.

3. **Document sorting behavior**: Clearly document that sorting resets selections, regardless of whether they were set programmatically.

4. **Consider a `default_selection` parameter**: This could be implemented as a simpler first step, with full session state support following later.

5. **Add comprehensive tests**: Include tests for:
   - Setting selections before widget renders
   - Changing selections after widget renders
   - Invalid selection indices
   - Selection mode validation (single vs multi)
   - Interaction with sorting and filtering
   - Form behavior (clear_on_submit)

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `lib/streamlit/elements/arrow.py` | Python | Remove write restriction, add validation, handle value_changed |
| `proto/streamlit/proto/Arrow.proto` | Protobuf | Add optional `selection_state` field |
| `frontend/lib/src/components/widgets/DataFrame/hooks/useWidgetState.ts` | TypeScript | Handle `selectionState` field |
| `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx` | TypeScript | Apply programmatic selection |
| `lib/tests/streamlit/elements/arrow_test.py` | Python | Add tests for programmatic selection |
| `frontend/lib/src/components/widgets/DataFrame/DataFrame.test.tsx` | TypeScript | Add tests for selectionState handling |
