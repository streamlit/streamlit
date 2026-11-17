---
author: lukasmasuch
created: 2025-12-03
---

# Disable Built-in Data Export

## Summary

`client.disableDataExport` turns off built-in export controls across the app: dataframe CSV
and clipboard copy, chart and diagram image downloads, and copy actions on code, JSON, and
errors. It does not disable `st.download_button`.

## Problem

### User Requests

- [#8402](https://github.com/streamlit/streamlit/issues/8402) — Possibility to disable the
  "Download as CSV" button
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
| `client.disableDataExport` | `bool` | `false` | Whether to disable built-in data export (CSV download, clipboard copy, chart/diagram image downloads, and other copy actions such as code blocks, `st.json`, and error text) |

### Behavior

When `client.disableDataExport = true`:

- **CSV download**: Hidden from the toolbar in `st.dataframe`, `st.data_editor`, and chart
  table views
- **Copy to clipboard** (`st.dataframe`): Completely disabled — pressing Ctrl/Cmd+C while a
  dataframe is focused will not copy any cell data to the clipboard (applies to both single
  and multi-cell selections)
- **Copy to clipboard** (`st.data_editor`): Disabled the same way as `st.dataframe`,
  because editor copy exports the same cell data. Pasting into cells stays enabled
  because it is part of editing, not export. Cut is also disabled so cells are not
  cleared with an empty clipboard (the editor has no undo).
- **Chart table view**: CSV export disabled in Vega chart table views (e.g., `st.altair_chart`,
  `st.vega_lite_chart`)
- **Chart and diagram image downloads**: Hidden (Vega-Lite/Altair PNG, ECharts PNG/SVG,
  Plotly `toImage`, Mermaid PNG)
- **Other copy actions**: Hidden for code blocks (`st.code` and Markdown code blocks), Mermaid
  diagram source, Vega-Lite spec, `st.json` (copy icons and path copy), dataframe column names,
  dataframe JSON cells, and the exception link row (Copy, Ask Google, and Ask ChatGPT).
- **Other features**: Unaffected (search, fullscreen, sorting, selections all work normally)

This applies to Streamlit's built-in export and copy controls. It does not cover:

- `st.download_button`, which is author-placed. Gating it from config would change
  the widget's return value and `on_click`, which conflicts with $38 Config vs Code
  in `specs/AGENTS.md`. Authors already control it with `disabled=`
- `st.audio_input`'s "Download as WAV" action, which saves the viewer's own recording
  rather than app data
- Chart controls that the app configures itself (for example ECharts
  `toolbox.feature.saveAsImage` or `dataView`, or a custom Plotly `modeBarButtons` list)

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

## Alternatives Considered

### Per-Dataframe Parameter Only

Adding `disable_export: bool = False` directly to `st.dataframe`.

**Rejected because:**

- `st.dataframe` already has many parameters; adding more for niche use cases adds clutter
- Most use cases want to disable export for all dataframes in an app, not selectively
- Easy to forget setting the parameter on one dataframe, creating inconsistent behavior
- Cannot be enforced at the deployment/organization level

## Checklist

| Item                         | ✅ or comment |
|------------------------------|---------------|
| Works on SiS, Cloud, etc?    | ✅ |
| No breaking API changes      | ✅ |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ |
| Any security/legal impact?   | ✅ Not a security feature; documented as convenience only |
| Any docs changes needed?     | ✅ Clarify this doesn't prevent determined data extraction |
