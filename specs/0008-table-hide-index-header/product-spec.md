---
author: lukasmasuch
created: 2025-12-02
status: Approved
---

# Allow hiding index and header columns in `st.table`

## Summary

Add `hide_index: bool | None = None` and `hide_header: bool | None = None` parameters to `st.table`,
enabling users to control the visibility of the index column and column headers with smart auto-hide defaults.

## Problem

`st.table` and `st.dataframe` have historically been undifferentiated. We've been working to
clarify their roles:

- **`st.dataframe`**: Large datasets with interactive exploration (sorting, filtering, selection)
- **`st.table`**: Small, text-based customizable tables for displaying a few metrics or key-value pairs

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
    hide_index: bool | None = None,   # NEW
    hide_header: bool | None = None,  # NEW
)
```

### Parameters

| Parameter     | Type           | Default | Description                                                                        |
| ------------- | -------------- | ------- | ---------------------------------------------------------------------------------- |
| `hide_index`  | `bool \| None` | `None`  | Whether to hide the index column. If `None`, auto-hide default RangeIndex.         |
| `hide_header` | `bool \| None` | `None`  | Whether to hide the column headers row. If `None`, auto-hide based on data format. |

### Behavior

**`hide_index`:**

- `None` (default): Hide RangeIndex (0, 1, 2...), show custom indices
- `True`: Always hide
- `False`: Always show

**`hide_header`:**

- `None` (default): Auto-hide based on input data format (using `determine_data_format`). Hide headers for formats without user-defined column names:
  - `KEY_VALUE_DICT` (e.g., `{"a": 1, "b": 2}`)
  - `LIST_OF_ROWS` (e.g., `[["a", 1], ["b", 2]]`)
  - `LIST_OF_VALUES` (e.g., `[1, 2, 3]`)
  - `NUMPY_LIST` / `NUMPY_MATRIX`
  - `SET_OF_VALUES` / `TUPLE_OF_VALUES`
  - `PANDAS_ARRAY` / `PYARROW_ARRAY`
- `True`: Always hide all header rows, including all levels of MultiIndex headers
- `False`: Always show

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

**Auto-hide headers based on data format:**

```python
# KEY_VALUE_DICT format - headers auto-hidden
st.table({
    "Price": "$145.00",
    "Customer": "Bobby Jones",
    "Address": "129 Market St, NYC",
    "Store": "Trader Joe's"
})

# LIST_OF_ROWS format - headers auto-hidden
st.table([["Alice", 25], ["Bob", 30]])

# LIST_OF_VALUES format - header auto-hidden
st.table([1, 2, 3, 4, 5])

# PANDAS_DATAFRAME format - headers shown (has user-defined column names)
st.table(pd.DataFrame({"Name": ["Alice", "Bob"], "Age": [25, 30]}))
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

| Item                       | ✅ or comment |
| -------------------------- | ------------- |
| Works on SiS, Cloud, etc?  | ✅            |
| No breaking API changes    | ✅            |
| No new dependencies        | ✅            |
| Metrics collected          | ✅            |
| Any security/legal impact? | ✅            |
| Any docs changes needed?   | ✅            |
| Any other risks?           | ✅            |
