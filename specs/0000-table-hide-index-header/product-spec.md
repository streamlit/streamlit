---
author: "@lukasmasuch"
created: 2025-11-28
status: Draft
---

# Allow hiding index and header columns in `st.table`

## Summary

Add `hide_index: bool | None = None` and `hide_header: bool = False` parameters to `st.table`,
enabling users to control the visibility of the index column and column headers.

## Problem

`st.table` and `st.dataframe` have historically been undifferentiated. We've been working to
clarify their roles:

- **`st.dataframe`**: Large datasets with interactive exploration (sorting, filtering, selection)
- **`st.table`**: Small, text-based tables for displaying a few metrics or key-value pairs

To make `st.table` better for its intended use case, users need more control over visual
clutter. Currently, `st.table` always shows the index column (even meaningless 0, 1, 2...
indices) and column headers, which is problematic for:

1. Compact metric displays where numeric indices add no value
2. Key-value pair tables where headers are unnecessary
3. Displaying single rows where column context is already clear

**Requests:**

- [#8235](https://github.com/streamlit/streamlit/issues/8235) - `hide_header` (32+ upvotes)
- [#9251](https://github.com/streamlit/streamlit/issues/9251) - `hide_index` for `st.table` (14+ upvotes)
- [#13185](https://github.com/streamlit/streamlit/issues/13185) - Add a description list element for viewing key-value data

**Consistency gap:**

`st.dataframe` and `st.data_editor` already support `hide_index`, but `st.table` does not.

## Proposal

### API

```python
st.table(
    ...,
    hide_index: bool | None = None,  # NEW
    hide_header: bool = False,       # NEW
)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hide_index` | `bool \| None` | `None` | Whether to hide the index column. If `None`, auto-hide default RangeIndex. |
| `hide_header` | `bool` | `False` | Whether to hide the column headers row. |

### Behavior

**`hide_index`:**

- `None` (default): Hide RangeIndex (0, 1, 2...), show custom indices
- `True`: Always hide
- `False`: Always show

**`hide_header`:**

- `False` (default): Show column headers
- `True`: Hide all header rows

### Examples

**Auto-hide default index:**

```python
import pandas as pd
import streamlit as st

# RangeIndex is auto-hidden
df = pd.DataFrame({"A": [1, 2], "B": [3, 4]})
st.table(df)  # Index hidden

# Custom index is shown
df_custom = df.set_index(pd.Index(["row1", "row2"]))
st.table(df_custom)  # Index shown
```

**Key-value display (no headers):**

```python
# Clean key-value table for metrics
metrics = pd.DataFrame({
    "Metric": ["Price", "Customer", "Address", "Store"],
    "Value": ["$145.00", "Bobby Jones", "129 Market St, NYC", "Trader Joe's"]
})
st.table(metrics, hide_header=True)
```

**Minimal table:**

```python
st.table(df, hide_index=True, hide_header=True)
```

### Edge Cases

- **Empty DataFrame**: Shows "empty" message (headers hidden if `hide_header=True`)
- **MultiIndex**: All index columns or header rows are hidden when respective flag is set
- **Pandas Styler**: `hide_index`/`hide_header` parameters take precedence

## Checklist

- [x] Will this work on all deployment platforms?
- [x] No breaking API changes?
- [x] No new dependencies?
- [x] Metrics collected?
- [x] Any security or legal implications?
- [x] Anything to keep in mind for docs?
- [x] Any other risks?
