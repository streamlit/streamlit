# Streamlit charts

Choose a chart command, keep charts consistent, and use the chart APIs well.

## Contents

- [Choose a chart command](#choose-a-chart-command)
- [Keep charts consistent](#keep-charts-consistent)
- [Accessible names (alt)](#accessible-names-alt)
- [Simple charts](#simple-charts)
- [Altair for complex charts](#altair-for-complex-charts)
- [Apache ECharts](#apache-echarts)
- [Chart selections](#chart-selections)
- [Large datasets](#large-datasets)
- [Plotly and Matplotlib](#plotly-and-matplotlib)
- [Maps and diagrams](#maps-and-diagrams)
- [References](#references)

## Choose a chart command

Prefer Vega-based charts and `st.echarts_chart`. Both follow the app theme, including light/dark switching, and are interactive and Arrow-backed for dataframes.

| Need | Use |
| --- | --- |
| A quick line, bar, area, or scatter chart from a dataframe | `st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart` |
| More control: titles, custom tooltips, layers, dual axes, log scales, faceting, aggregation, binning, regression | `st.altair_chart` (Altair ships with Streamlit) |
| An existing Vega-Lite JSON spec | `st.vega_lite_chart` |
| Network graphs, trees, sankey, chord, sunburst, treemap, gauges, radar, funnel, calendar heatmaps, candlesticks | `st.echarts_chart` |
| A built-in zoom slider (`dataZoom`), in-chart toolbox, or color-range filter (`visualMap`) | `st.echarts_chart` |
| Values that should animate when a widget changes the data | `st.echarts_chart` |
| An existing ECharts option, JSON string, or `pyecharts` chart | `st.echarts_chart` |
| 3D surfaces, meshes, or volumes, or an existing Plotly figure | `st.plotly_chart` (see [Plotly and Matplotlib](#plotly-and-matplotlib)) |
| An existing Matplotlib or seaborn figure | `st.pyplot` (static image; not for new charts) |
| Points on a map / layered or 3D geospatial data | `st.map` / `st.pydeck_chart` |
| Flowcharts, sequence diagrams, ER models | `st.mermaid_chart` |
| A tiny trend inside a metric or table cell | `st.metric(chart_data=...)` or `LineChartColumn` / `BarChartColumn` / `AreaChartColumn` (see [data-display.md](data-display.md)) |

Start with a simple chart and move to `st.altair_chart` when it runs out of options. Move to `st.echarts_chart` for chart types Vega-Lite doesn't have, not for line, bar, or scatter charts that Altair already draws.

## Keep charts consistent

Use one charting library across a page, and ideally across the app. Libraries differ in tooltips, legends, toolbars, zoom behavior, and selection gestures, so a page that mixes them looks and behaves inconsistently.

- Default to Vega-based charts. The simple charts and `st.altair_chart` share one look, so mixing those two is fine.
- When a page needs ECharts-only chart types (for example, a sankey next to a gauge), consider drawing that page's other charts with `st.echarts_chart` too.
- A single ECharts-only chart on an otherwise Vega-based page is fine. Don't rewrite the page for it.
- Keep the default `theme="streamlit"` so every chart uses the app's fonts and chart colors. Set the palette with `theme.chartCategoricalColors` and `theme.chartSequentialColors` in `config.toml` (see [theme.md](theme.md)), not per chart.

## Accessible names (`alt`)

Pass keyword-only `alt=` on every chart, map, and diagram. Write a short, plain-text name that states the chart's takeaway or the map's subject, not the chart type or a data dump. Markdown syntax is announced literally.

```python
st.bar_chart(
    df, x="category", y="revenue", alt="Revenue by product line, highest for Enterprise"
)
```

- **`st.echarts_chart`:** `alt` replaces the description ECharts generates from the data, so a vague name is worse than none.
- A whitespace-only `alt` is ignored (same as not passing it) and logged. Empty `alt=""` is decorative only on `st.image` / `st.pyplot` (see [media-display.md](media-display.md)).

## Simple charts

```python
st.line_chart(df, x="date", y="revenue", alt="Monthly revenue trend")
st.bar_chart(df, x="category", y="count", alt="Order count by category")
st.scatter_chart(df, x="age", y="salary", alt="Salary versus age")
st.area_chart(df, x="date", y="value", alt="Value over time")
```

Use `color` for series grouping, `stack` for bar and area stacking, `horizontal` and `sort` for bars, and `size` for scatter points.

Use clear labels, not column names or abbreviations. Skip `x_label`/`y_label` when the column names are already readable.

```python
# BAD: cryptic column names without labels
st.line_chart(df, x="dt", y="rev")

# GOOD: cryptic columns, add labels
st.line_chart(
    df, x="dt", y="rev", x_label="Date", y_label="Revenue", alt="Monthly revenue trend"
)
```

Move to `st.altair_chart` for a chart title, custom tooltips, layered or dual-axis charts, log scales, faceting, transforms, selections, or a `color` column combined with several `y` columns. The simple charts have none of these.

## Altair for complex charts

```python
import altair as alt

chart = (
    alt.Chart(df)
    .mark_line()
    .encode(
        x=alt.X("date:T", title="Date"),
        y=alt.Y("revenue:Q", title="Revenue ($)"),
        color="region:N",
        tooltip=["date:T", "region:N", alt.Tooltip("revenue:Q", format="$,.0f")],
    )
    .properties(title="Revenue by region")
)
st.altair_chart(chart, alt="Revenue by region over time")
```

Altair has no 5,000-row limit in Streamlit. Streamlit sends the data separately as Arrow, so don't add `alt.data_transformers.disable_max_rows()`. Calling `chart.to_dict()` or `chart.to_json()` yourself still applies Altair's own limit.

## Apache ECharts

Pass an ECharts option as a dict, a JSON string, or a `pyecharts` chart. Put dataframes in `dataset.source`, where Streamlit sends them as Arrow and keeps their column order:

```python
df = pd.DataFrame(
    {
        "product": ["Matcha", "Milk Tea", "Cocoa"],
        "2025": [43.3, 83.1, 86.4],
        "2026": [85.8, 73.4, 65.2],
    }
)
st.echarts_chart(
    {
        "legend": {},
        "tooltip": {"trigger": "axis", "valueFormatter": "dollar"},
        "dataset": {"source": df},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [{"type": "bar"}, {"type": "bar"}],
    },
    alt="Sales by product for 2025 and 2026, Matcha up most",
)
```

The dataframe index is not sent, so call `df.reset_index()` to plot it.

- **JSON-compatible options only.** JavaScript callbacks (`formatter` functions, `JsCode`), `custom` series, GeoJSON map registration, and ECharts GL / 3D charts raise an error. For those, see [third-party-components.md](third-party-components.md).
- **Format without JavaScript.** Set `tooltip.valueFormatter` (or `series[i].tooltip.valueFormatter`) to an `st.metric` number format such as `"dollar"`, `"compact"`, or `"%,d visits"`. String templates (`"{b}: {c}"`) work in labels and tooltips, and tooltip templates also expand `{@dimension}` and `{@[index]}`.
- **Dataframes belong in `dataset.source`.** A dataframe in `series.data` or `xAxis.data` raises an error. Datetimes become ISO strings (UTC if timezone-aware), durations become milliseconds, and missing values become `null`.
- **Text in the option is plain text.** Markdown doesn't render in `title.text` or labels. Put formatted copy in `st.markdown` next to the chart.
- **Updates animate.** When a rerun changes the data, values move from the old to the new state, and `universalTransition` on a series morphs between chart types. Give an `on_select` chart a `key`; without one, each data change remounts it and replays the entry animation.

## Chart selections

`st.altair_chart`, `st.vega_lite_chart`, `st.echarts_chart`, `st.plotly_chart`, and `st.pydeck_chart` return selection state with `on_select="rerun"` or a callback. Each enables selection differently:

| Command | Enable selection with | Read |
| --- | --- | --- |
| `st.altair_chart` / `st.vega_lite_chart` | A named selection param in the chart (`alt.selection_point("name")`, `alt.selection_interval("name")`) | `event.selection.<name>` |
| `st.echarts_chart` | `selectedMode` on a series for points, or a `brush` component / `toolbox.feature.brush` for regions | `event.selection.selected`, `event.selection.areas` |
| `st.plotly_chart` | `selection_mode` (`"points"`, `"box"`, `"lasso"`) | `event.selection.points` |
| `st.pydeck_chart` | `selection_mode` and `pickable=True` layers with an `id` | `event.selection.objects` |

```python
brush = alt.selection_interval(name="brush", encodings=["x"])
chart = alt.Chart(df).mark_bar().encode(x="month:T", y="sales:Q").add_params(brush)
event = st.altair_chart(chart, on_select="rerun", key="sales_chart")
date_range = event.selection.brush  # {"month": [start, end]} once the user brushes
```

```python
event = st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed"]},
        "yAxis": {"type": "value"},
        "series": [
            {"type": "bar", "selectedMode": "multiple", "data": [120, 200, 150]}
        ],
    },
    on_select="rerun",
    key="weekday_chart",
)
rows = [i for group in event.selection.selected for i in group["data_indices"]]
```

- **ECharts needs the selection keys in the spec.** `on_select` alone renders a chart that never returns a selection, and Streamlit logs a warning. There is no `selection_mode` parameter.
- ECharts `data_indices` are series-local and address `dataset.source` rows (without transforms) or `series.data`. Graph and sankey series report nodes and edges as separate groups (`data_type` `"node"` / `"edge"`), which makes ECharts the choice for click-through on network and flow charts.
- Target an axis on an ECharts brush (`"brush": {"xAxisIndex": "all"}`) so its regions appear in `areas`.
- Set `key` on Altair, Vega-Lite, ECharts, and pydeck charts to keep a selection when the data changes. Without a key, any change to the chart resets it. Plotly selections reset whenever the figure changes, even with a key.
- Import `VegaLiteState`, `EChartsState`, `PlotlyState`, and `PydeckState` from `streamlit.typing` to annotate the returned event.

## Large datasets

- Pre-aggregate in pandas, Polars, or SQL before charting. All rows reach the browser, and Vega-Lite transforms such as `aggregate` and `bin` run there.
- For ECharts, pass dataframes through `dataset.source`, not Python lists in `series.data`. Only `dataset.source` is sent as Arrow. For dense series, ECharts' `sampling: "lttb"` and `large: True` options help.
- Cache the data loading with `st.cache_data`, and isolate charts that refresh on a timer in `@st.fragment(run_every=...)` (see [performance.md](performance.md)).

## Plotly and Matplotlib

Don't reach for Plotly or Matplotlib for new 2D charts. Vega-based charts and ECharts cover them and match the app better.

- **`st.plotly_chart`** fits when you need what neither Vega-Lite nor ECharts draws: 3D charts (`scatter3d`, `surface`, `mesh3d`, `volume`), scientific traces (violin, ternary, carpet, Smith charts), a tile basemap under a chart, or a Plotly figure the user already has. It needs the `plotly` package. Browsers allow only a handful of WebGL contexts per page, so keep WebGL-heavy Plotly charts to a few per page.
- **`st.pyplot`** displays a Matplotlib figure as a static image: no zoom, hover, or selection. It doesn't follow the app theme, so a default figure is a white box on a dark theme. It also renders on the server on every rerun. Use it only for a figure you already have, or for libraries that only produce Matplotlib output (seaborn, statsmodels, scikit-learn displays). Pass the `Figure`, not an `Axes`: pandas `.plot()` returns an `Axes`, so pass `ax.get_figure()`.

## Maps and diagrams

- **`st.map`** draws points on a basemap that follows the app theme, with no token needed. Move to **`st.pydeck_chart`** for polygons, arcs, hexagons, heatmaps, 3D, tooltips, multiple layers, or selections.
- **`st.mermaid_chart`** draws flowcharts, sequence diagrams, ER models, and other Mermaid diagrams, themed for light and dark. A ```` ```mermaid ```` fence in `st.markdown` works too (see [markdown.md](markdown.md)).
- **`st.graphviz_chart`** is for diagrams that need Graphviz layout engines or clusters. It doesn't theme colors, so set node, edge, and font colors explicitly for dark themes. Prefer `st.mermaid_chart` otherwise.

## References

- [Chart elements](https://docs.streamlit.io/develop/api-reference/charts)
- [st.altair_chart](https://docs.streamlit.io/develop/api-reference/charts/st.altair_chart)
- [st.echarts_chart](https://docs.streamlit.io/develop/api-reference/charts/st.echarts_chart)
- [st.line_chart](https://docs.streamlit.io/develop/api-reference/charts/st.line_chart)
- [st.bar_chart](https://docs.streamlit.io/develop/api-reference/charts/st.bar_chart)
- [st.plotly_chart](https://docs.streamlit.io/develop/api-reference/charts/st.plotly_chart)
- [st.pyplot](https://docs.streamlit.io/develop/api-reference/charts/st.pyplot)
