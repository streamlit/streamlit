---
author: lukasmasuch
created: 2025-12-03
---

# Disable Data Export for `st.dataframe`

## Summary

Add a `disable_export: bool = False` parameter to `st.dataframe` that disables data export
functionality, including CSV download and clipboard copy operations.

## Problem

### User Requests

- [#8402](https://github.com/streamlit/streamlit/issues/8402) — Possibility to disable the
  "Download as CSV" button (27+ upvotes)
- [#11358](https://github.com/streamlit/streamlit/issues/11358) — Disable copying data from a
  dataframe

### Pain Points

Some users need to display sensitive data in dataframes while preventing easy bulk export.
Currently, `st.dataframe` provides:

- A toolbar button to download data as CSV
- Keyboard shortcut (Ctrl/Cmd+C) to copy selected cells to clipboard

For internal dashboards or applications displaying confidential information, users want to
restrict these export capabilities to make it less convenient to extract large amounts of data.

**Note:** This is a convenience feature, not a security control. Technically skilled users
can still extract data from the frontend.

## Proposal

### API

```python
st.dataframe(
    ...,
    disable_export: bool = False,  # NEW
)
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `disable_export` | `bool` | `False` | Whether to disable data export (CSV download and copying to clipboard) |

### Behavior

When `disable_export=True`:

- **Download button**: Hidden from the toolbar
- **Copy to clipboard**: Completely disabled — pressing Ctrl/Cmd+C while the dataframe is
  focused will not copy any cell data to the clipboard (applies to both single and multi-cell
  selections)
- **Other features**: Unaffected (search, fullscreen, sorting, selections all work normally)

### Examples

#### Basic Usage

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({"Name": ["Alice", "Bob"], "Salary": [100000, 120000]})

# Standard dataframe with export enabled
st.dataframe(df)

# Dataframe with export disabled
st.dataframe(df, disable_export=True)
```

## Alternatives Considered

### Alternative Parameter Names

| Name | Pros | Cons |
|------|------|------|
| `disable_export` (chosen) | Clear intent, matches `disabled` pattern | Negative phrasing |
| `allow_export` | Positive phrasing | Default would be `True`, inconsistent with other `allow_*` patterns |
| `exportable` | Concise, adjective form | Less explicit about what's being controlled |
| `enable_download` | Descriptive | Doesn't cover clipboard copy; narrower scope than actual behavior |

### Global Config Option

Instead of a per-dataframe parameter, this could be a global config option:
`client.disable_data_export`

**Rejected because:**

- In many applications, only some dataframes contain sensitive information
- A parameter provides granular control without impacting other parts of the app

### Adding to `st.data_editor`

This parameter is intentionally scoped to `st.dataframe` only and not planned for
`st.data_editor`.

**Reasoning:**

- `st.data_editor` relies on copy/paste for core editing workflows (e.g., pasting data into
  cells, copying rows for duplication)
- Could be added later if there's strong user demand

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | ✅ |
| No breaking API changes      | ✅ |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ |
| Any security/legal impact?   | ✅ Not a security feature; documented as convenience only |
| Any docs changes needed?     | ✅ Clarify this doesn't prevent determined data extraction |
