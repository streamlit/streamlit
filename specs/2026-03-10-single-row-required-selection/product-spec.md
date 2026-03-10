---
author: lukasmasuch
created: 2026-03-10
---

# Required single-row selection for `st.dataframe`

## Summary

Add a `single-row-required` selection mode to `st.dataframe` that enforces exactly one row
to always be selected, similar to `st.radio` behavior. When no `selection_default` is
provided or set in session state, the first row is automatically selected. Unlike
`single-row`, the selection cannot be cleared—only changed to a different row.

## Problem

When using `st.dataframe` with `selection_mode="single-row"` for navigation or control
purposes (e.g., selecting a row to display details in another chart), the current behavior
has two pain points:

1. **No default selection**: The dataframe starts with no rows selected, requiring users to
   click before seeing any content. This is problematic when "no selection" has no
   meaningful state (like `st.radio`).

2. **Selection can be cleared**: Users can deselect by clicking the selected row again,
   which leaves the app in an "empty" state that developers must handle with fallback logic.

**User request:**

- [#9253](https://github.com/streamlit/streamlit/issues/9253) — Allow `st.dataframe`
  single-row selection to force a selection (per radio button behavior) (20+ upvotes)

**Quote from issue:**

> In my example, which can't be too uncommon, I want the user to be able to select from the
> dataframe to trigger which chart is displayed — these are distinct measures so an 'all'
> option (which could take place of no rows selected) makes no sense.

**Use cases:**

- **Master-detail views**: Selecting a row from a table to display details, charts, or
  related data where "nothing selected" has no meaningful representation
- **Navigation/filtering**: Using the dataframe as a navigation control where something
  must always be selected
- **Form-like interfaces**: Dataframes as fancy radio groups with rich data display

**Current workaround:**

Developers currently use `selection_default` to pre-select a row, but users can still
deselect it. This forces developers to add defensive code:

```python
event = st.dataframe(
    df,
    selection_mode="single-row",
    selection_default={"selection": {"rows": [0]}},
    on_select="rerun",
)

# Defensive fallback every time selection is checked
selected_row = event.selection.rows[0] if event.selection.rows else 0
```

## Proposal

### API

Add `"single-row-required"` to the `selection_mode` parameter:

```python
st.dataframe(
    data,
    selection_mode="single-row-required",  # NEW VALUE
    on_select="rerun",
)
```

### Selection Mode Values

| Mode                        | Allows Multiple | Can Clear | Default Selection | Row Marker Style |
| --------------------------- | --------------- | --------- | ----------------- | ---------------- |
| `"single-row"`              | No              | Yes       | None              | Square checkbox  |
| `"multi-row"`               | Yes             | Yes       | None              | Square checkbox  |
| **`"single-row-required"`** | No              | **No**    | **First row**     | **Circle**       |

### Behavior

**Default selection:**

- When `selection_mode="single-row-required"` and no `selection_default` is provided (and
  no prior selection in session state), the first row (index 0) is automatically selected
- This automatic selection happens on both backend (Python return value) and frontend (UI)
- If `selection_default` is provided, that row is selected instead

**Preventing deselection:**

- Clicking the currently selected row does nothing (selection remains)
- Clicking a different row changes the selection to that row
- The "Clear selection" toolbar action is hidden when `single-row-required` is active
- Keyboard shortcuts that would clear selections (e.g., Escape) are disabled for row
  selection in this mode
- Keyboard navigation (arrow keys) changes selection; pressing Enter/Space on selected row
  does nothing

**Visual styling:**

- Row markers use `checkboxStyle: "circle"` instead of `"square"` to visually indicate
  radio-like behavior (one selection required, similar to radio buttons vs checkboxes)
- This provides an immediate visual cue that the selection mode differs from standard
  single/multi-row selection

**Interaction with other features:**

- **Sorting**: When the user sorts the dataframe, the selection follows the data (existing
  behavior for `single-row`). The previously selected row remains selected at its new
  visual position
- **Empty tables**: `single-row-required` is silently ignored for empty tables (no error),
  since there's nothing to select. The return value has an empty `rows` list
- **Session state**: Programmatic changes via `st.session_state[key]` work normally. If
  the user sets an empty selection, the first row is auto-selected on the next rerun
- **Combining with other modes**: `single-row-required` is mutually exclusive with
  `single-row` and `multi-row` (same validation as existing modes). It can be combined
  with column and cell selection modes

### Validation

```python
# Valid:
st.dataframe(df, selection_mode="single-row-required", on_select="rerun")
st.dataframe(df, selection_mode=["single-row-required", "multi-column"], on_select="rerun")

# Invalid (raises StreamlitAPIException):
st.dataframe(df, selection_mode=["single-row-required", "single-row"], on_select="rerun")
st.dataframe(df, selection_mode=["single-row-required", "multi-row"], on_select="rerun")
st.dataframe(df, selection_mode="single-row-required", on_select="ignore")  # Must enable selection
```

### Examples

**Basic usage:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "Category": ["Sales", "Marketing", "Engineering"],
    "Budget": [100000, 75000, 150000],
})

# Always has exactly one row selected (defaults to first row)
event = st.dataframe(
    df,
    selection_mode="single-row-required",
    on_select="rerun",
)

# No need to check if selection is empty
selected_idx = event.selection.rows[0]
st.write(f"Selected: {df.iloc[selected_idx]['Category']}")
```

**With custom default:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "Region": ["North", "South", "East", "West"],
    "Revenue": [1.2, 0.8, 1.5, 0.9],
})

# Start with "East" selected (index 2)
event = st.dataframe(
    df,
    selection_mode="single-row-required",
    selection_default={"selection": {"rows": [2]}},
    on_select="rerun",
)
```

**Master-detail pattern:**

```python
import pandas as pd
import streamlit as st

products = pd.DataFrame({
    "Product": ["Widget A", "Widget B", "Gadget X"],
    "Price": [29.99, 49.99, 99.99],
    "Stock": [150, 42, 8],
})

col1, col2 = st.columns([1, 2])

with col1:
    event = st.dataframe(
        products,
        selection_mode="single-row-required",
        on_select="rerun",
        use_container_width=True,
    )

with col2:
    idx = event.selection.rows[0]
    product = products.iloc[idx]
    st.metric("Product", product["Product"])
    st.metric("Price", f"${product['Price']:.2f}")
    st.metric("In Stock", product["Stock"])
```

### Implementation Notes

**Backend (Python):**

1. Add `"single-row-required"` to `SelectionMode` type alias and `_SELECTION_MODES` set
2. Add validation in `_normalize_selection_mode` to make it mutually exclusive with
   `single-row` and `multi-row`
3. Add `SINGLE_ROW_REQUIRED = 6` to `Dataframe.proto` `SelectionMode` enum
4. In `DataframeSelectionSerde.deserialize`: when mode is `single-row-required` and
   selection is empty, return `{"selection": {"rows": [0], "columns": [], "cells": []}}`
5. Add `_SELECTION_MODE_TO_PROTO` mapping for the new mode

**Frontend (TypeScript):**

1. Add `SINGLE_ROW_REQUIRED` handling in `useSelectionHandler.ts`:
   - Add `isRequiredRowSelectionActivated` derived state
   - In `processSelectionChange`: if required mode is active and `newSelection.rows` is
     empty, restore the previous selection (ignore the clear attempt)
2. In `DataFrame.tsx`:
   - Pass `rowSelect="single"` for required mode (same as `single-row`)
   - Use `checkboxStyle: "circle"` in `rowMarkers` config for visual radio-like appearance
   - Hide "Clear selection" toolbar action when required mode is active
   - Disable Escape key handling for row selection clearing
3. In initial selection loading (`loadInitialSelectionState`): if required mode and no
   stored selection, return selection with first row

**Glide-data-grid:**

Glide-data-grid does not have built-in "required selection" support. The implementation
uses `rowSelect="single"` and `rowSelectionMode="auto"` (same as `single-row`), with the
prevention of clearing handled in `onGridSelectionChange`:

```typescript
onGridSelectionChange={(newSelection: GridSelection) => {
  // For single-row-required: prevent clearing selection
  if (isRequiredRowSelectionActivated && newSelection.rows.length === 0) {
    // Keep previous selection, don't process the clear
    return
  }
  processSelectionChange(newSelection)
}}
```

Row markers use `checkboxStyle: "circle"` to visually differentiate from standard row
selection modes:

```typescript
rowMarkers: {
  kind: "checkbox-visible",
  checkboxStyle: "circle",  // Radio-like appearance
  // ... theme settings
}
```

### Edge Cases

- **Empty dataframe**: Required selection is silently ignored (returns empty `rows` list)
- **Single row dataframe**: The only row is always selected; clicking it does nothing
- **Programmatic empty selection**: If user sets `st.session_state[key] = {"selection": {"rows": []}}`,
  the first row is auto-selected on next rerun
- **Sorting clears and re-applies**: Current behavior clears row selection on sort for
  `single-row`. For `single-row-required`, after sort, the same data row should remain
  selected (tracked by original index)

## Alternatives Considered

**Option 1: Boolean parameter `required_selection=True`**

```python
st.dataframe(df, selection_mode="single-row", required_selection=True, on_select="rerun")
```

- Pros: Could apply to all selection modes
- Cons: Another parameter; unclear what "required" means for multi-row (minimum 1?)

**Option 2: Extend `selection_default` to also prevent clearing**

```python
st.dataframe(df, selection_mode="single-row", selection_default=..., prevent_clear=True)
```

- Cons: `selection_default` is about initial state, not runtime behavior; mixing concerns

**Option 3: New `selection_mode` value (PREFERRED)**

- Pros: Clear, explicit, follows the enum pattern of existing modes
- Cons: Slightly more modes to document
- Rationale: Selection mode already distinguishes `single-row` vs `multi-row`; adding
  `single-row-required` fits naturally

## Out of Scope (Future Work)

- **`multi-row-required`**: Requiring at least one row in multi-select mode could be
  useful but adds complexity. Revisit if users request it.
- **`single-column-required` / `single-cell-required`**: Same pattern could apply to
  columns and cells. Not requested yet; add if there's demand.
- **Visual indication of "required"**: Could add additional visual cues beyond the circle
  checkbox (e.g., label or tooltip). Current circle style may be sufficient.

## Checklist

| Item                       | Status                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | Yes — no platform-specific behavior                                       |
| No breaking API changes    | Yes — additive new enum value                                             |
| No new dependencies        | Yes                                                                       |
| Metrics collected          | Yes — tracked via existing `selection_mode` metric with new value         |
| Any security/legal impact? | No                                                                        |
| Any docs changes needed?   | Yes — document new selection mode in `st.dataframe` API reference         |
