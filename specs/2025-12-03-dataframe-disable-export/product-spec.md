---
author: lukasmasuch
created: 2025-12-03
---

# Disable Data Export for `st.dataframe`

## Summary

Add a `client.disableDataExport` config option that controls whether data export functionality
(CSV download and clipboard copy) is disabled in `st.dataframe`.

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

### Config Option

```toml
# .streamlit/config.toml
[client]
disableDataExport = true  # default: false
```

Or via command line:

```bash
streamlit run app.py --client.disableDataExport=true
```

Or programmatically:

```python
import streamlit as st

st.set_option("client.disableDataExport", True)
```

**Config Option:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `client.disableDataExport` | `bool` | `false` | Whether to disable data export (CSV download and copying to clipboard) in `st.dataframe` |

### Behavior

When `client.disableDataExport = true`:

- **Download button**: Hidden from the toolbar
- **Copy to clipboard**: Completely disabled — pressing Ctrl/Cmd+C while a dataframe is
  focused will not copy any cell data to the clipboard (applies to both single and multi-cell
  selections)
- **Other features**: Unaffected (search, fullscreen, sorting, selections all work normally)

This applies to all `st.dataframe` instances in the app.

### Examples

#### Disable Export App-Wide

```toml
# .streamlit/config.toml
[client]
disableDataExport = true
```

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({"Name": ["Alice", "Bob"], "Salary": [100000, 120000]})

# Export is disabled for all dataframes
st.dataframe(df)
```

#### Enterprise Deployment

Organizations can enforce this setting across all deployed apps via command-line flags
or environment variables, preventing accidental data leakage:

```bash
streamlit run app.py --client.disableDataExport=true
```

## Out of Scope (Future Work)

### Per-Dataframe Parameter

A per-dataframe `disable_export` parameter could be added later if users need granular control
(similar to how `st.file_uploader` has both `server.maxUploadSize` config and a per-widget
`max_upload_size` parameter):

```python
# Future: override config for specific dataframes
st.dataframe(df, disable_export=False)  # re-enable for this dataframe
```

This would allow the config option to set the default while still permitting exceptions.
Adding this later based on user feedback avoids premature API expansion.

### Adding to `st.data_editor`

This config option is intentionally scoped to `st.dataframe` only.

**Reasoning:**

- `st.data_editor` relies on copy/paste for core editing workflows (e.g., pasting data into
  cells, copying rows for duplication)
- Could be extended later if there's strong user demand

## Alternatives Considered

### Per-Dataframe Parameter Only

Adding `disable_export: bool = False` directly to `st.dataframe`.

**Rejected because:**

- `st.dataframe` already has many parameters; adding more for niche use cases adds clutter
- Most use cases want to disable export for all dataframes in an app, not selectively
- Easy to forget setting the parameter on one dataframe, creating inconsistent behavior
- Cannot be enforced at the deployment/organization level

### Positive Naming (`enableDataExport`)

Using `client.enableDataExport = false` instead of `client.disableDataExport = true`.

**Rejected because:**

- This is a niche feature where users are specifically looking to disable export
- Users searching for this functionality will search for "disable", not "enable"
- More intuitive: `disableDataExport = true` clearly states the intent

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | ✅ |
| No breaking API changes      | ✅ |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ |
| Any security/legal impact?   | ✅ Not a security feature; documented as convenience only |
| Any docs changes needed?     | ✅ Clarify this doesn't prevent determined data extraction |
