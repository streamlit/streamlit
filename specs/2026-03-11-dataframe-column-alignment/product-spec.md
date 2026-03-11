---
author: lukasmasuch
created: 2026-03-11
---

# Text alignment for `st.dataframe` and `st.data_editor` columns

## Summary

Add an `alignment` parameter to `st.column_config.Column` (and all typed column configs) that
controls horizontal text alignment (left, center, right) of cell content. The frontend already
supports this via Glide Data Grid's `contentAlign` property, but it's not exposed in the Python
API.

## Problem

Users need explicit control over text alignment in dataframe cells for:

- Centering categorical labels for visual consistency
- Right-aligning numbers without using `NumberColumn` (e.g., formatted strings)
- Left-aligning content that defaults to center (e.g., checkboxes)
- Matching table styling requirements for dashboards and reports

**User requests:**

- [#12106](https://github.com/streamlit/streamlit/issues/12106) - Support text/content align in
  st.dataframe (primary request)
- [#6706](https://github.com/streamlit/streamlit/issues/6706) - Display styled Pandas DataFrame
  text-align without converting to HTML (related, 10+ upvotes)

**Current state:**

- Frontend: Glide Data Grid's `contentAlign` property is already wired to columns via the
  `contentAlignment` field in `frontend/lib/src/components/widgets/DataFrame/columns/utils.ts`
- Backend: The `alignment` field exists in `ColumnConfig` TypedDict but is **not exposed** in any
  of the `st.column_config.*` functions

This is primarily an API exposure task - the plumbing already exists.

## Proposal

### API

Add `alignment` parameter to `st.column_config.Column` and propagate to all typed column configs:

```python
st.column_config.Column(
    label=...,
    *,
    width=...,
    help=...,
    disabled=...,
    required=...,
    pinned=...,
    alignment=...,  # NEW
)
```

### Parameter

| Parameter   | Type                                      | Default | Description                                                          |
| ----------- | ----------------------------------------- | ------- | -------------------------------------------------------------------- |
| `alignment` | `"left" \| "center" \| "right" \| None`   | `None`  | Horizontal alignment of cell content. If `None`, uses column default |

### Default alignment by column type

When `alignment=None` (default), each column type uses sensible defaults:

| Column Type    | Default Alignment | Supports Custom Alignment |
| -------------- | ----------------- | ------------------------- |
| `TextColumn`   | left              | Yes |
| `NumberColumn` | right             | Yes |
| `CheckboxColumn` | center          | Yes |
| `DateColumn`, `TimeColumn`, `DatetimeColumn` | left | Yes |
| `LinkColumn`   | center (icon-only) / left (with text) | Yes |
| `ImageColumn`, `AudioColumn`, `VideoColumn` | center | Yes |
| `JsonColumn`   | left              | Yes |
| `SelectboxColumn` | left           | No (uses external renderer) |
| `ListColumn`, `MultiselectColumn` | left | No (uses custom tag renderer) |
| `ProgressColumn` | left            | No (renders progress bar) |
| `LineChartColumn`, `BarChartColumn`, `AreaChartColumn` | left | No (renders chart) |

The column types that don't support custom alignment use third-party or custom renderers that don't
honor the `contentAlign` property from Glide Data Grid.

### Examples

**Center-align a category column:**

```python
import streamlit as st
import pandas as pd

df = pd.DataFrame({
    "Status": ["Active", "Pending", "Closed"],
    "Count": [42, 17, 8]
})

st.dataframe(
    df,
    column_config={
        "Status": st.column_config.Column(alignment="center")
    }
)
```

**Right-align formatted currency strings:**

```python
import streamlit as st
import pandas as pd

df = pd.DataFrame({
    "Product": ["Widget A", "Widget B"],
    "Price": ["$1,234.56", "$789.00"]  # Pre-formatted strings
})

st.dataframe(
    df,
    column_config={
        "Price": st.column_config.TextColumn(alignment="right")
    }
)
```

**Left-align numbers (override default):**

```python
import streamlit as st
import pandas as pd

df = pd.DataFrame({"ID": [1001, 1002, 1003]})

st.dataframe(
    df,
    column_config={
        "ID": st.column_config.NumberColumn(
            label="Order ID",
            alignment="left"  # Override default right-alignment
        )
    }
)
```

### Implementation Notes

**Backend changes:**

1. Add `alignment` parameter to `Column()` function in `lib/streamlit/elements/lib/column_types.py`
2. Add `alignment` parameter to all typed column functions (`TextColumn`, `NumberColumn`, etc.)
3. Include `alignment` in the returned `ColumnConfig` dict when not `None`

**Frontend changes:**

Minimal - the `contentAlignment` field is already parsed and passed to Glide Grid cells. Just
ensure all column types respect `props.contentAlignment` when provided, falling back to their
type-specific defaults.

**Serialization:**

The `alignment` value maps directly to `contentAlignment` in the column config JSON sent to the
frontend. No protobuf changes needed - column config is already JSON-serialized.

## Out of Scope (Future Work)

- **Pandas Styler `text-align` support** (#6706): Automatically parsing `text-align` from pandas
  Styler would be convenient but requires significant work in the Arrow/styling pipeline. Users
  can achieve the same result via `column_config`.

- **Header alignment**: #6958 requests header cell styling. This spec focuses on data cell
  alignment only; header alignment could be a separate enhancement.

- **Vertical alignment**: Glide Grid supports `contentAlign` for horizontal only. Vertical
  alignment would require custom cell rendering.

## Checklist

| Item                         | Status                                              |
| ---------------------------- | --------------------------------------------------- |
| Works on SiS, Cloud, etc?    | Yes - pure frontend rendering                       |
| No breaking API changes      | Yes - additive parameter with `None` default        |
| No new dependencies          | Yes - uses existing Glide Grid capability           |
| Metrics collected            | Yes - via existing `@gather_metrics` decorators     |
| Any security/legal impact?   | No                                                  |
| Any docs changes needed?     | Yes - document `alignment` in column_config API ref |
