
# Streamlit charts & data

Present data clearly.

## Native charts first

Prefer Streamlit's native charts for simple cases.

```python
st.line_chart(df, x="date", y="revenue")
st.bar_chart(df, x="category", y="count")
st.scatter_chart(df, x="age", y="salary")
st.area_chart(df, x="date", y="value")
```

Native charts support additional parameters: `color` for series grouping, `stack` for bar/area stacking, `size` for scatter point sizing, `horizontal` for horizontal bars. See the [chart API reference](https://docs.streamlit.io/develop/api-reference/charts) for full options.

## Human-readable labels

Use clear labels—not column names or abbreviations. Skip `x_label`/`y_label` if the column names are already readable.

```python
# BAD: cryptic column names without labels
st.line_chart(df, x="dt", y="rev")

# GOOD: readable columns, no labels needed
st.line_chart(df, x="date", y="revenue")

# GOOD: cryptic columns, add labels
st.line_chart(df, x="dt", y="rev", x_label="Date", y_label="Revenue")
```

## Altair for complex charts

Use Altair when you need more control. Altair is bundled with Streamlit (no extra install), while Plotly requires an additional package. Pick one and stay consistent throughout your app.

```python
import altair as alt

chart = alt.Chart(df).mark_line().encode(
    x=alt.X("date:T", title="Date"),
    y=alt.Y("revenue:Q", title="Revenue ($)"),
    color="region:N"
)
st.altair_chart(chart)
```

**When to use Altair:**
- Custom axis formatting
- Multiple series with legends
- Interactive tooltips
- Layered visualizations

## Deprecated: `use_container_width`

**Do not use `use_container_width`.** It is deprecated — Streamlit elements now stretch to fill their container by default. Use the `width` parameter instead: `width="stretch"` (equivalent to `use_container_width=True`) or `width="content"` (equivalent to `use_container_width=False`). Remove `use_container_width` when you see it, and never add it to new code.

```python
# BAD: deprecated parameter
st.dataframe(df, use_container_width=True)
st.altair_chart(chart, use_container_width=True)

# GOOD: just omit it — stretch is the default
st.dataframe(df)
st.altair_chart(chart)

# GOOD: explicitly set width when you need content-sized (non-stretching)
st.dataframe(df, width="content")
```

## Dataframe column configuration

Use `column_config` where it adds value—formatting currencies, showing progress bars, displaying links or images. Don't add config just for labels or tooltips that don't meaningfully improve readability. Works with both `st.dataframe` and `st.data_editor`.

```python
st.dataframe(
    df,
    column_config={
        "revenue": st.column_config.NumberColumn(
            "Revenue",
            format="$%.2f"
        ),
        "completion": st.column_config.ProgressColumn(
            "Progress",
            min_value=0,
            max_value=100
        ),
        "url": st.column_config.LinkColumn("Website"),
        "logo": st.column_config.ImageColumn("Logo"),
        "created_at": st.column_config.DatetimeColumn(
            "Created",
            format="MMM DD, YYYY"
        ),
        "internal_id": None,  # Hide non-essential columns
    },
    hide_index=True,
)
```

**Note on hiding columns:** Setting a column to `None` hides it from the UI, but the data is still sent to the frontend. For truly sensitive data, pre-filter the DataFrame before displaying.

**Dataframe best practices:**
- **Hide useless index:** `hide_index=True`
- **Or make index meaningful:** `df = df.set_index("customer_name")` before displaying
- **Hide internal/technical columns:** Set column to `None` in config (but pre-filter for sensitive data)
- **Use visual column types where they help:** sparklines for trends, progress bars for completion, images for logos

**Column types:**
- `AreaChartColumn` → Area sparklines
- `AudioColumn` → Audio playback
- `BarChartColumn` → Bar sparklines
- `CheckboxColumn` → Boolean as checkbox
- `DateColumn` → Date only (no time)
- `DatetimeColumn` → Dates with formatting
- `ImageColumn` → Images
- `JSONColumn` → Display JSON objects
- `LineChartColumn` → Sparkline charts
- `LinkColumn` → Clickable links
- `ListColumn` → Display lists/arrays
- `MultiselectColumn` → Multi-value selection
- `NumberColumn` → Numbers with formatting
- `ProgressColumn` → Progress bars
- `SelectboxColumn` → Editable dropdown
- `TextColumn` → Text with formatting
- `TimeColumn` → Time only (no date)
- `VideoColumn` → Video playback

## Choosing the right data widget

| Widget | Use When |
|---|---|
| `st.dataframe` | Large datasets, interactive exploration, sorting, filtering, row selection |
| `st.data_editor` | Users need to modify data (edit cells, add/delete rows) |
| `st.table` | Small static datasets, Markdown-formatting and extended Pandas Styler support |

Use `st.dataframe` with `on_select` for row selection — do **not** use `st.data_editor` with a checkbox column for selection-only use cases.

## Pandas Styler: formatting vs coloring

Use `column_config` for **all value formatting** (numbers, dates, percentages). Only use Pandas Styler for **coloring** (background gradients, highlights).

```python
# BAD: Styler for formatting — AI tends to overuse this
styled = df.style.format({"revenue": "${:.2f}", "growth": "{:.1%}"})
st.dataframe(styled)

# GOOD: column_config for formatting
st.dataframe(df, column_config={
    "revenue": st.column_config.NumberColumn(format="$%.2f"),
    "growth": st.column_config.NumberColumn(format="percent"),
    "created": st.column_config.DatetimeColumn(format="MMM DD, YYYY"),
})

# GOOD: Styler for colors only + column_config for formatting
styled = df.style.background_gradient(subset=["revenue"], cmap="Greens")
st.dataframe(styled, column_config={
    "revenue": st.column_config.NumberColumn(format="$%.2f"),
})
```

**Percentage formatting:** Use `NumberColumn(format="percent")` for 0-1 values, or `format="%.2f%%"` for already-multiplied values.

## Editing data with st.data_editor

```python
edited_df = st.data_editor(
    df,
    key="my_editor",
    num_rows="dynamic",          # allow adding/deleting rows
    disabled=["id", "created"],  # lock specific columns
)
```

Access edit details via `st.session_state["my_editor"]["edited_rows"]`.

**Double-input anti-pattern** — assigning the result back to the same session state used as input causes every other edit to disappear:

```python
# BAD: creates feedback loop — edits disappear on every other interaction
st.session_state.df = st.data_editor(st.session_state.df)
st.session_state.df["total"] = st.session_state.df["qty"] * st.session_state.df["price"]

# GOOD: use key parameter, compute from the returned value
edited = st.data_editor(df, key="editor")
edited["total"] = edited["qty"] * edited["price"]
st.dataframe(edited)
```

## Row, column and cell selections

Use `st.dataframe` (not `st.data_editor`) for selection:

```python
event = st.dataframe(df, on_select="rerun", selection_mode="multi-row")
selected_indices = event.selection.rows
selected_data = df.iloc[selected_indices]
```

Selection modes: `"single-row"`, `"multi-row"`, `"single-column"`, `"multi-column"`, `"single-cell"`, `"multi-cell"`.

## Empty DataFrames

When creating an empty DataFrame for `st.data_editor`, set explicit dtypes to avoid type inference issues:

```python
df = pd.DataFrame({
    "label": pd.Series(dtype="string"),
    "amount": pd.Series(dtype="float"),
})
st.data_editor(df)
```

## Pinned columns

Keep important columns visible while scrolling horizontally:

```python
st.dataframe(
    df,
    column_config={
        "Title": st.column_config.TextColumn(pinned=True),  # Always visible
        "Rating": st.column_config.ProgressColumn(min_value=0, max_value=10),
    },
    hide_index=True,
)
```

## Sparklines in metrics

Add `chart_data` and `chart_type` to metrics for visual context.

```python
values = [700, 720, 715, 740, 762, 755, 780]

st.metric(
    label="Developers",
    value="762k",
    delta="-7.42% (MoM)",
    delta_color="inverse",
    chart_data=values,
    chart_type="line"  # or "bar"
)
```

**Note:** Sparklines only show y-values and ignore x-axis spacing. Use them for evenly-spaced data (like daily or weekly snapshots). For irregularly-spaced time series, use a proper chart instead.

See `dashboards.md` for composing metrics into dashboard layouts.

## References

- [st.dataframe](https://docs.streamlit.io/develop/api-reference/data/st.dataframe)
- [st.column_config](https://docs.streamlit.io/develop/api-reference/data/st.column_config)
- [st.metric](https://docs.streamlit.io/develop/api-reference/data/st.metric)
- [st.line_chart](https://docs.streamlit.io/develop/api-reference/charts/st.line_chart)
- [st.bar_chart](https://docs.streamlit.io/develop/api-reference/charts/st.bar_chart)
- [st.altair_chart](https://docs.streamlit.io/develop/api-reference/charts/st.altair_chart)
