
# Streamlit layout

How you structure your app affects usability more than you think.

## Sidebar: navigation + global filters only

The sidebar should only contain navigation and app-level filters. Main content goes in the main area.

```python
# GOOD
with st.sidebar:
    date_range = st.date_input("Date range")
    region = st.selectbox("Region", ["All", "US", "EU", "APAC"])
    st.caption("App v1.2.3")
```

```python
# BAD: Too much content in sidebar
with st.sidebar:
    st.title("Dashboard")
    st.dataframe(df)  # Don't put main content here
    st.bar_chart(data)
```

**What goes in sidebar:**
- Global filters (date range, user selection, region)
- App info (version, feedback link)

**What stays out:**
- Main content, charts, tables, results

## Columns: max 4, set alignment

Don't use too many columns—they get cramped.

```python
# GOOD
col1, col2 = st.columns(2)

# OK with alignment
cols = st.columns(4, vertical_alignment="center")

# BAD: Too many, cramped
col1, col2, col3, col4, col5, col6 = st.columns(6)
```

## Grid: responsive CSS Grid layouts

Use `st.grid` for layouts that need to automatically wrap and resize based on available space.

```python
# Auto-sizing grid with minimum column width
with st.grid():
    st.metric("Revenue", "$1.2M")
    st.metric("Users", "762k")
    st.metric("Orders", "1.4k")
    st.metric("Conversion", "3.2%")
```

**Grid vs columns:**
- `st.columns` — Fixed number of columns, no wrapping
- `st.grid` — Responsive wrapping, cells auto-size to fit

**Common grid patterns:**

```python
# Fixed columns with responsive wrapping
with st.grid(columns=3, border=True, cell_height="equal"):
    for item in items:
        st.markdown(f"**{item.name}**")
        st.caption(item.description)

# Auto-sizing cards with custom gap
with st.grid(min_column_width=250, gap="medium", border=True):
    for metric in metrics:
        st.metric(metric.label, metric.value, metric.delta)

# Spanning cells for featured content
grid = st.grid(columns=4, min_column_width=150, border=True)
with grid.span(columns=2):
    st.markdown("**Featured** - spans 2 columns")
with grid.container():
    st.markdown("Cell 2")
with grid.container():
    st.markdown("Cell 3")
```

**Key parameters:**
- `columns` — `"auto"` (default) or fixed number
- `min_column_width` — Minimum cell width in pixels (enables responsive wrapping)
- `gap` — Size between cells: `"small"` (default), `"medium"`, `"large"`, etc.
- `border` — Show borders around cells
- `cell_height` — `"content"` (default), `"equal"` (match tallest in row), or fixed pixels
- `vertical_alignment` — `"top"` (default), `"center"`, `"bottom"`

## Horizontal containers for button groups

Use `st.container(horizontal=True)` instead of columns for button groups:

```python
with st.container(horizontal=True):
    st.button("Cancel")
    st.button("Save")
    st.button("Submit")
```

## Aligning elements

Use `horizontal_alignment` on containers to position elements:

```python
# Center elements
with st.container(horizontal_alignment="center"):
    st.image("logo.png", width=200)
    st.title("Welcome")

# Right-align elements
with st.container(horizontal_alignment="right"):
    st.button("Settings", icon=":material/settings:")

# Distribute evenly (great for button groups)
with st.container(horizontal=True, horizontal_alignment="distribute"):
    st.button("Cancel")
    st.button("Save")
    st.button("Submit")
```

Options: `"left"` (default), `"center"`, `"right"`, `"distribute"`

## Bordered containers

Use `border=True` on containers for visual grouping. See `dashboards.md` for dashboard-specific patterns like KPI cards.

```python
with st.container(border=True):
    st.subheader("Section title")
    st.write("Grouped content here")
```

## Dialogs for focused interactions

Use `@st.dialog` for UI that doesn't need to be always visible:

```python
@st.dialog("Confirm deletion")
def confirm_delete(item_name):
    st.write(f"Are you sure you want to delete **{item_name}**?")
    if st.button("Delete", type="primary"):
        delete_item(item_name)
        st.rerun()

if st.button("Delete item"):
    confirm_delete("My Document")
```

**When to use dialogs:**
- Confirmation prompts
- Settings panels
- Forms that don't need to be always visible

## Spacing

Control spacing between elements with `gap` on containers:

```python
# Remove spacing for tight list-like UIs
with st.container(gap=None, border=True):
    for item in items:
        st.checkbox(item.text)

# Explicit gap sizes
with st.container(gap="small"):
    ...
```

Add vertical space with `st.space`:

```python
st.space("small")   # Small gap
st.space("medium")  # Medium gap
st.space("large")   # Large gap
st.space(50)        # Custom pixels
```

## Width and height

Control element sizing:

```python
# Stretch to fill available space (equal height columns)
cols = st.columns(2)
with cols[0].container(border=True, height="stretch"):
    st.line_chart(data)
with cols[1].container(border=True, height="stretch"):
    st.dataframe(df)

# Shrink to content size
st.container(width="content")

# Fixed pixel sizes
st.container(height=300)
```

## References

- [st.container](https://docs.streamlit.io/develop/api-reference/layout/st.container)
- [st.columns](https://docs.streamlit.io/develop/api-reference/layout/st.columns)
- [st.grid](https://docs.streamlit.io/develop/api-reference/layout/st.grid)
- [st.sidebar](https://docs.streamlit.io/develop/api-reference/layout/st.sidebar)
- [st.dialog](https://docs.streamlit.io/develop/api-reference/execution-flow/st.dialog)
