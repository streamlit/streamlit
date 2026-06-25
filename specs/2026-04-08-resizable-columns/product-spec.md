---
author: lukasmasuch
created: 2026-04-08
---

# Resizable columns via drag-and-drop

## Summary

Add a `resizable: bool = False` parameter to `st.columns` that allows users to resize columns
by dragging the border between them. When enabled, a visual border indicator appears on hover
between adjacent columns, and users can drag to adjust column widths interactively. Resizing
is purely client-side and does not trigger a script rerun.

## Problem

Column widths in `st.columns` are currently static—once defined via the `spec` parameter, they
cannot be adjusted without modifying code and rerunning the app. This creates friction for:

**Use cases:**

- **Dashboard customization**: Users want to adjust column widths to better fit their content
  or screen size without developer intervention
- **Data exploration**: When comparing data across columns, users may need to temporarily
  expand one column to see more detail
- **Responsive layouts**: Allowing users to fine-tune layouts for their specific display
  configuration
- **Presentation mode**: Adjusting column proportions during demos or presentations without
  code changes

**Current workarounds:**

- Provide multiple layout presets via `st.selectbox` (requires code changes, causes rerun)
- Use CSS hacks with custom components (complex, fragile)
- Accept fixed layouts (suboptimal UX)

## Proposal

### API

```python
st.columns(
    spec,
    *,
    gap="small",
    vertical_alignment="top",
    border=False,
    width="stretch",
    resizable=False,  # NEW
)
```

### Parameter

| Parameter   | Type   | Default | Description                                                                                                                                                                                                                                                   |
| ----------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resizable` | `bool` | `False` | Whether the columns are resizable by dragging. If `False` (default), column widths are fixed based on the `spec` parameter. If `True`, users can resize columns by dragging the border between them on wide viewports where columns are displayed side-by-side. |

### Behavior

**`resizable=False` (default):**

- Standard fixed-width columns based on `spec`
- No visual resize handles or hover indicators
- Current behavior preserved

**`resizable=True`:**

- Columns can be resized by dragging the border between adjacent columns
- **Hover indicator**: A vertical border line appears when hovering over the resize area
  between columns, signaling that resizing is possible
- **Drag interaction**: Click and drag the border to resize adjacent column pairs
- **Double-click to reset**: Double-clicking the resize handle resets the adjacent columns
  to their original `spec` proportions
- **Minimum width**: Each column has a minimum width (64px) to prevent columns from
  collapsing entirely
- **Keyboard support**: When focused, use Arrow Left/Right keys to resize in 10px increments
- **Cursor feedback**: The cursor changes to `col-resize` when hovering over the resize handle
- **Smooth transitions**: The border indicator fades in/out smoothly (150ms transition)

**Width preservation:**

- Resizing adjusts only the two adjacent columns involved in the drag
- Total row width is preserved—when one column grows, its neighbor shrinks
- Other columns in the row remain unchanged

**Narrow viewport behavior:**

- On narrow viewports (below the `theme.breakpoints.columns` threshold, typically 576px),
  columns stack vertically
- Resize handles are hidden when columns are stacked (resizing not applicable)
- If the viewport widens again, resize handles reappear

**State persistence:**

- Resized widths persist within a session (maintained in React state)
- Widths reset to original `spec` proportions on:
  - Page refresh
  - Script rerun that changes the column configuration (different `spec` or column count)
  - Window resize that causes columns to stack and unstack

### Examples

**Basic resizable columns:**

```python
import streamlit as st

col1, col2, col3 = st.columns(3, resizable=True)

with col1:
    st.header("Column 1")
    st.write("Drag the border to resize →")

with col2:
    st.header("Column 2")
    st.write("Content here")

with col3:
    st.header("Column 3")
    st.write("More content")
```

**Resizable columns with custom proportions:**

```python
import streamlit as st

# Start with 70/30 split, user can adjust
left, right = st.columns([0.7, 0.3], resizable=True)

with left:
    st.subheader("Main content")
    st.dataframe(df)

with right:
    st.subheader("Sidebar")
    st.write("Filters and controls")
```

**Resizable columns with borders:**

```python
import streamlit as st

# Borders help visualize column boundaries
cols = st.columns(4, resizable=True, border=True)

for i, col in enumerate(cols):
    with col:
        st.metric(f"Metric {i+1}", f"{(i+1) * 100}")
```

### Edge Cases

- **Single column**: `resizable=True` has no effect (nothing to resize between)
- **Two columns**: One resize handle between them
- **Many columns**: Resize handles between each adjacent pair; dragging one does not affect
  non-adjacent columns
- **Nested columns**: Each `st.columns` call manages its own resize state independently
  (note: nesting columns is discouraged per Streamlit design guidelines)
- **Zero gap (`gap=None`)**: Resize handle still appears, positioned at the column boundary
- **Very narrow columns**: Minimum width of 64px prevents complete collapse
- **Rapid dragging**: Throttled updates prevent performance issues
- **Touch devices**: Drag interactions work via touch; hover indicator shows on touch start

### Validation

```python
# Valid:
st.columns(3, resizable=True)                    # Equal-width resizable columns
st.columns([1, 2, 1], resizable=True)            # Custom proportions, resizable
st.columns(3, resizable=True, border=True)       # With borders
st.columns(3, resizable=True, gap="large")       # With custom gap
st.columns(3, resizable=False)                   # Explicit non-resizable (default)

# Valid but no resize effect:
st.columns(1, resizable=True)                    # Single column, nothing to resize
```

## Out of Scope (Future Work)

- **Persist widths across sessions**: Store user's preferred widths in local storage or
  session state
- **Snap to grid**: Snap widths to predefined percentages (25%, 33%, 50%, etc.)
- **Resize constraints**: `min_width`/`max_width` parameters per column
- **Resize callbacks**: `on_resize` callback when widths change
- **Save/restore layouts**: Named layout presets that users can switch between

## Checklist

| Item                       | ✅ or comment                                                          |
| -------------------------- | ---------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Pure client-side, no server dependencies                            |
| No breaking API changes    | ✅ New optional parameter with `False` default                         |
| No new dependencies        | ✅ Uses existing DOM APIs and React state                              |
| Metrics collected          | ✅ Usage tracked via `gather_metrics("columns")` decorator             |
| Any security/legal impact? | ✅ No security implications                                            |
| Any docs changes needed?   | ✅ Document `resizable` parameter with examples in `st.columns` docs   |
