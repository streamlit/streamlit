# Streamlit charts

Choose a chart command, keep charts consistent, and use the chart APIs well.

## Contents

- [Choose a chart command](#choose-a-chart-command)
- [Keep charts consistent](#keep-charts-consistent)
- [Accessible names (alt)](#accessible-names-alt)
- [Apache ECharts](#apache-echarts)
- [Built-in charts](#built-in-charts)
- [Altair and Vega-Lite](#altair-and-vega-lite)
- [Chart selections](#chart-selections)
- [Large datasets](#large-datasets)
- [Plotly and Matplotlib](#plotly-and-matplotlib)
- [Maps and diagrams](#maps-and-diagrams)
- [References](#references)

## Choose a chart command

Default to `st.echarts_chart` for new charts. It follows the app theme, including light/dark switching, covers the widest range of chart types, animates when the data changes, supports a built-in zoom slider (`dataZoom`), and stays fast with large data. Rank chart commands in this order:

1. **`st.echarts_chart`:** the recommended choice for dashboards and most charts, simple line, bar, area, and scatter charts included.
2. **Built-in charts** (`st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart`): a one-line shortcut for a quick look at a dataframe, for example while exploring data. They render with Vega, so on a page or app that already has ECharts charts, draw simple charts with `st.echarts_chart` too.
3. **`st.altair_chart` / `st.vega_lite_chart`:** Vega-Lite features that ECharts lacks, or an existing Altair chart or Vega-Lite spec.
4. **`st.plotly_chart`:** 3D and scientific charts, or an existing Plotly figure.
5. **Others** (`st.pyplot`, third-party chart components): only for a figure the user already has or a library that only produces that output.

| Need | Use |
| --- | --- |
| Line, bar, area, scatter, pie, heatmap, or combined charts, simple ones included, and every chart on a dashboard | `st.echarts_chart` |
| Network graphs, trees, sankey, chord, sunburst, treemap, gauges, radar, funnel, calendar heatmaps, candlesticks | `st.echarts_chart` |
| Titles, custom tooltips, dual axes, log scales, annotations (`markLine`, `markArea`) | `st.echarts_chart` |
| Clicking a point, bar, network node, or sankey link to drive the app | `st.echarts_chart` (see [Chart selections](#chart-selections)) |
| A built-in zoom slider (`dataZoom`), in-chart toolbox, or color-range filter (`visualMap`) | `st.echarts_chart` |
| Values that should animate when a widget changes the data | `st.echarts_chart` |
| Line, bar, or scatter charts with more than about 100,000 points, or with tens of thousands of points whose data changes often | `st.echarts_chart` (see [Large datasets](#large-datasets)) |
| An existing ECharts option, JSON string, or `pyecharts` chart | `st.echarts_chart` |
| A quick look at a dataframe as a line, bar, area, or scatter chart, on a page without ECharts charts | `st.line_chart`, `st.bar_chart`, `st.area_chart`, `st.scatter_chart` |
| Faceting into small multiples, statistical transforms (regression, density, LOESS), or brushing one chart to filter linked charts without a rerun | `st.altair_chart` (Altair ships with Streamlit) |
| An existing Altair chart or Vega-Lite JSON spec | `st.altair_chart` / `st.vega_lite_chart` |
| 3D surfaces, meshes, or volumes; violin, ternary, or carpet plots; or an existing Plotly figure | `st.plotly_chart` (see [Plotly and Matplotlib](#plotly-and-matplotlib)) |
| An existing Matplotlib or seaborn figure | `st.pyplot` (static image; not for new charts) |
| Points on a map / layered or 3D geospatial data | `st.map` / `st.pydeck_chart` |
| Flowcharts, sequence diagrams, ER models | `st.mermaid_chart` |
| A diagram that needs Graphviz layout engines or clusters | `st.graphviz_chart` |
| A tiny trend inside a metric or table cell | `st.metric(chart_data=...)` or `LineChartColumn` / `BarChartColumn` / `AreaChartColumn` (see [data-display.md](data-display.md)) |

When a built-in chart runs out of options, move it to `st.echarts_chart`. Use `st.altair_chart` only for the Vega-Lite-only needs above.

## Keep charts consistent

Prefer one charting library per page, and ideally across the app. Libraries differ in tooltips, legends, toolbars, zoom behavior, and selection gestures, so mixing them costs some consistency. Combine them when a chart needs a type or feature the main library lacks.

- Default to `st.echarts_chart` for every chart on the page, simple ones included. When the page or app already has ECharts charts, draw simple charts with `st.echarts_chart` too. A built-in chart is fine as a quick view where no ECharts charts exist.
- A single Altair chart for a Vega-Lite-only feature, such as faceting, on an otherwise ECharts page is fine.
- The built-in charts and `st.altair_chart` are both Vega-based and share one look, so mixing those two is fine.
- In an existing app with Vega-based charts, a small change can stay in that engine. Move the page to `st.echarts_chart` when you rework its charts.
- Sparklines in `st.metric` and dataframe chart columns are fine next to either engine.
- Keep the default `theme="streamlit"` so every chart uses the app's fonts and chart colors. Set the palette with `theme.chartCategoricalColors` and `theme.chartSequentialColors` in `config.toml` (see [theme.md](theme.md)), not per chart.

## Accessible names (`alt`)

Pass keyword-only `alt=` on every chart, map, and diagram. Write a short, plain-text name that states the chart's takeaway or the map's subject, not the chart type or a data dump. Markdown syntax is announced literally.

```python
st.bar_chart(
    df, x="category", y="revenue", alt="Revenue by product line, highest for Enterprise"
)
```

- **`st.echarts_chart`:** `alt` replaces the description ECharts generates from the data, so a vague name is worse than none.
- Streamlit ignores a whitespace-only `alt` (same as omitting it) and logs a warning. Empty `alt=""` is decorative only on `st.image` / `st.pyplot` (see [media-display.md](media-display.md)).

## Apache ECharts

Streamlit ships with Apache ECharts 6.1. Prefer docs and examples for this version over older tutorials written for ECharts 4 or 5.

Pass an ECharts option as a dict, a JSON string, or a `pyecharts` chart. Build the chart from one dataframe (pandas, Polars, PyArrow, and others) in `dataset.source` rather than inline Python lists in `series.data` or `xAxis.data`. Always do this for more than about 1,000 rows. Don't call `.tolist()` or `.to_list()` on a column to fill `series.data`. Graph, sankey, chord, tree, treemap, sunburst, themeRiver, and `lines` (coordinate-pair lines, not `line`) series don't read `dataset`, so give them plain Python values in `series.data` (and `series.links`). A dataframe source has these advantages:

- **Faster for large data.** Streamlit sends the dataframe as Arrow, which is smaller and faster than inline values, and keeps its column order. Map columns with `series[i].encode` when the order isn't enough.
- **Missing values and whole columns.** Missing values become `null`, and a whole column (an array or Series) can be the source. Inline values (for example in `series.data` or `markLine`) convert NumPy numbers and booleans, datetimes (ISO strings, UTC if timezone-aware), durations (milliseconds), and `Decimal` the same way those scalars convert in `dataset.source`. Arrays, Series, and missing values (`NaN`, `pd.NaT`, `pd.NA`) raise an error.
- **Show data.** The chart's hover toolbar gets a **Show data** button that displays the dataframe as a table. With several dataframes, the button is hidden.
- **Agent API.** The agent API reports the dataframe as a table (schema, preview, and the full data). Inline values only appear inside the raw option. With several dataframes, the agent API reports the option but no table.

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

Streamlit does not send the dataframe index, so call `df.reset_index()` to plot it.

- **JSON-compatible options only.** JavaScript callbacks (`formatter` functions, `JsCode`), `custom` series, GeoJSON map registration, and ECharts GL / 3D charts raise an error. For those, see [third-party-components.md](third-party-components.md).
- **Format without JavaScript.** Set `tooltip.valueFormatter` (or `series[i].tooltip.valueFormatter`) to an `st.metric` number format such as `"dollar"`, `"compact"`, or `"%,d visits"`. String templates (`"{b}: {c}"`) work in labels and tooltips, and tooltip templates also expand `{@dimension}` and `{@[index]}`. One format applies to every value of a series, so set `encode.tooltip` to the dimensions the tooltip should show. With a dataframe source, the tooltip shows each `encode.tooltip` dimension on its own line, labeled with its column name.
- **Only `dataset.source` takes a dataframe.** A dataframe in `series.data` or `xAxis.data` raises an error.
- **Numbers on a category axis are positions.** A marker at `{"xAxis": 2023}` means category index 2023 (0-based), not the label `2023`, so a year axis drops it. Pass labels as strings, and cast numeric category columns such as years with `.astype(str)`.
- **Text in the option is plain text.** Markdown doesn't render in `title.text` or labels. Put formatted copy in `st.markdown` next to the chart.
- **Leave bar corners to the theme.** Unstacked bars without negative values get rounded outer corners that follow `theme.baseRadius`, so don't copy a fixed `itemStyle.borderRadius` from ECharts examples. For square bars, set `"borderRadius": 0`.
- **Annotate with mark components.** `markLine` draws a milestone at an x-axis value (on a category axis, the category label), and `markArea` shades a range such as forecast months. Add them to a data series: the theme draws a dashed gray line and a faint neutral band in both light and dark mode. For a colored mark, set `itemStyle.color` on the `markLine` or `markArea` (a series' own `color` or `itemStyle.color` also carries over to its marks), for example for per-series averages in a multi-series chart. Leave the mark labels' `color` unset so their text contrasts with the light and dark theme, and place a `markArea` label at `"position": "top"`, because ECharts draws light text inside a translucent area. `itemStyle.decal` hatches projected or estimated bars.
- **Updates animate.** When a rerun changes the data, values move from the old to the new state, and `universalTransition` on a series morphs between chart types. Give an `on_select` chart a `key`; without one, each data change remounts it and replays the entry animation.
- **Size horizontal bars by category count.** `height="content"` is a fixed 350 pixels, which squeezes many bars and hides labels. Use about `height=60 + 22 * df["category"].nunique()`.

ECharts has no Vega-style `color=` field, so pivot long-format data (one row per group and x value) to one wide dataframe and draw a series per column. In a selection, `series_name` is the column and `data_indices` are rows of the wide dataframe.

```python
wide = df.pivot(index="quarter", columns="app", values="sessions").reset_index()
event = st.echarts_chart(
    {
        "legend": {},
        "tooltip": {},
        "dataset": {"source": wide},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [
            {
                "type": "bar",
                "name": app,
                "encode": {"x": "quarter", "y": app},
                "selectedMode": "multiple",
            }
            for app in wide.columns[1:]
        ],
    },
    on_select="rerun",
    key="sessions_chart",
    alt="Quarterly sessions by app, web peaks in Q2",
)
for s in event.selection.selected:
    st.dataframe(wide.iloc[s["data_indices"]][["quarter", s["series_name"]]])
```

When groups don't share x values (for example, scatter points), keep the one dataset and add a dataset per group with `{"transform": {"type": "filter", "config": {"dimension": "app", "=": app}}}`, pointing each series at it with `datasetIndex` and setting `"name": app`. Map a selection back with the same filter in pandas: `df[df["app"] == s["series_name"]].iloc[s["data_indices"]]`.

For range bars on a category axis, stack a transparent bar at the low value under a visible bar as tall as the range, with `"stackStrategy": "all"` as in the fan chart below, so the data stays in `dataset.source`. Draw Gantt charts and time-axis lanes as `lines` series items on `cartesian2d` with a wide, opaque line, not a `custom` series. Put string lane names in a category `yAxis.data` (numbers are positions), and set `xAxis.min` and `xAxis.max`, because `lines` doesn't extend the axes and the chart stays empty otherwise.

```python
st.echarts_chart(
    {
        "tooltip": {"formatter": "{b}"},
        "xAxis": {"type": "time", "min": runs["start"].min(), "max": runs["end"].max()},
        "yAxis": {"type": "category", "data": sorted(runs["shard"].unique())},
        "series": [
            {
                "type": "lines",
                "coordinateSystem": "cartesian2d",
                "lineStyle": {"width": 14, "opacity": 1},
                "data": [
                    {
                        "name": r.test,
                        "coords": [[r.start, r.shard], [r.end, r.shard]],
                    }
                    for r in runs.itertuples()
                ],
            }
        ],
    },
    alt="Test runs per shard over time",
)
```

ECharts can't fill between two lines. For a fan chart (forecast ranges), stack a translucent area with the range width on a hidden line at the lower quantile, rather than masking with a background-colored area, which breaks in dark mode. Add another pair with its own `stack` for a nested range.

```python
data = forecast.assign(width=forecast["p90"] - forecast["p10"])
band = {
    "type": "line",
    "name": "Forecast",  # Median's name: shares its color and legend entry
    "stack": "band",  # One stack per range
    "stackStrategy": "all",  # Default stacks same-sign values only
    "showSymbol": False,
    "tooltip": {"show": False},  # The median's encode.tooltip lists quantiles
    "lineStyle": {"width": 0},
}
st.echarts_chart(
    {
        "dataset": {"source": data},
        "tooltip": {"trigger": "axis", "valueFormatter": "%,d"},
        "xAxis": {"type": "time"},
        "yAxis": {},
        "series": [
            {**band, "encode": {"x": "week", "y": "p10"}},
            {
                **band,
                "encode": {"x": "week", "y": "width"},
                "areaStyle": {"opacity": 0.2},
            },
            {
                "type": "line",
                "name": "Forecast",
                "showSymbol": False,
                "encode": {"x": "week", "y": "p50", "tooltip": ["p90", "p50", "p10"]},
            },
        ],
    },
    alt="Weekly forecast with an 80% range",
)
```

## Built-in charts

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
st.line_chart(df, x="dt", y="rev", alt="Monthly revenue trend")

# GOOD: cryptic columns, add labels
st.line_chart(
    df, x="dt", y="rev", x_label="Date", y_label="Revenue", alt="Monthly revenue trend"
)
```

Move to `st.echarts_chart` for a chart title, custom tooltips, dual axes, log scales, annotations, a zoom slider, or a `color` column combined with several `y` columns. The built-in charts have none of these.

## Altair and Vega-Lite

Use `st.altair_chart` for what Vega-Lite does better than ECharts: faceting into small multiples, statistical transforms (regression, density, LOESS), and brushing that filters linked charts in the browser without a rerun.

```python
import altair as alt

chart = (
    alt.Chart(df)
    .mark_line()
    .encode(
        x=alt.X("date:T", title=None),
        y=alt.Y("revenue:Q", title="Revenue ($)"),
        tooltip=["date:T", alt.Tooltip("revenue:Q", format="$,.0f")],
    )
    .properties(height=150)
    .facet("region:N", columns=3)
)
st.altair_chart(chart, alt="Revenue over time, one panel per region")
```

Altair has no 5,000-row limit in Streamlit. Streamlit sends the data separately as Arrow, so don't add `alt.data_transformers.disable_max_rows()`. Calling `chart.to_dict()` or `chart.to_json()` yourself still applies Altair's own limit.

## Chart selections

`st.echarts_chart`, `st.altair_chart`, `st.vega_lite_chart`, `st.plotly_chart`, and `st.pydeck_chart` return selection state with `on_select="rerun"` or a callback. Each enables selection differently:

| Command | Enable selection with | Read |
| --- | --- | --- |
| `st.echarts_chart` | `selectedMode` on a series for points, or a `brush` component / `toolbox.feature.brush` for regions | `event.selection.selected`, `event.selection.areas` |
| `st.altair_chart` / `st.vega_lite_chart` | A named selection param in the chart (`alt.selection_point("name")`, `alt.selection_interval("name")`) | `event.selection.<name>` |
| `st.plotly_chart` | Nothing extra; `selection_mode` narrows it to `"points"`, `"box"`, or `"lasso"` | `event.selection.points` |
| `st.pydeck_chart` | An `id` on every layer; `selection_mode="multi-object"` for several objects | `event.selection.objects` |

```python
visits = pd.DataFrame({"day": ["Mon", "Tue", "Wed"], "visits": [120, 200, 150]})
event = st.echarts_chart(
    {
        "dataset": {"source": visits},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [
            {
                "type": "bar",
                "selectedMode": "multiple",
                "encode": {"x": "day", "y": "visits"},
            }
        ],
    },
    on_select="rerun",
    key="weekday_chart",
    alt="Visits by weekday",
)
rows = [i for group in event.selection.selected for i in group["data_indices"]]
st.dataframe(visits.iloc[rows])
```

```python
brush = alt.selection_interval(name="brush", encodings=["x"])
chart = alt.Chart(df).mark_bar().encode(x="month:T", y="sales:Q").add_params(brush)
event = st.altair_chart(
    chart, on_select="rerun", key="sales_chart", alt="Monthly sales"
)
date_range = event.selection.brush  # {"month": [start, end]} once the user brushes
```

- **ECharts needs the selection keys in the spec.** `st.echarts_chart` has no `selection_mode` parameter. With `on_select` alone, the chart never returns a selection, and Streamlit logs a warning.
- ECharts `data_indices` are series-local and address `dataset.source` rows (without transforms) or `series.data`. With a dataset `filter` transform, they are positions among the filtered rows, so apply the same filter in pandas before indexing (see [Apache ECharts](#apache-echarts)). Graph and sankey series report nodes and edges as separate groups (`data_type` `"node"` / `"edge"`), which makes ECharts the choice for click-through on network and flow charts.
- Target an axis on an ECharts brush (`"brush": {"xAxisIndex": "all"}`) so its regions appear in `areas`.
- Set `key` on Altair, Vega-Lite, ECharts, and pydeck charts to keep a selection when the data changes. Without a key, any change to the chart resets it. Plotly selections reset whenever the figure changes, even with a key.
- Import `VegaLiteState`, `EChartsState`, `PlotlyState`, and `PydeckState` from `streamlit.typing` to annotate the returned event.

## Large datasets

Every row reaches the browser and is processed there. From about 10,000 points per chart, rendering takes longer than the Python side, so pick the command by size:

| Points per chart | Line | Scatter | Bar |
| --- | --- | --- | --- |
| Up to about 10,000 | Any command | Any command | Any command |
| About 10,000 to 100,000 | `st.echarts_chart` or Vega-based | `st.echarts_chart` or Vega-based | `st.echarts_chart` or Vega-based |
| About 100,000 to 1,000,000 | `st.echarts_chart`; add `"sampling": "lttb"` to the densest lines | `st.echarts_chart` | `st.echarts_chart` |
| More than 1,000,000 | Aggregate first; `st.echarts_chart` draws up to about 2,000,000 | Aggregate first | Aggregate first |

- Pre-aggregate in pandas, Polars, or SQL before charting. Vega-Lite transforms such as `aggregate` and `bin` also run in the browser, on every row.
- Size charts whose data changes often (filters, live data) by their update cost. When a rerun changes only its data, a Vega-based chart swaps the new rows into its existing view, but Vega still recomputes every row (just under a second at 100,000 rows). Streamlit rebuilds an `on_select` chart that has no `key` instead, because new data remounts it. `st.echarts_chart` updates faster, so prefer it from about 50,000 points on such charts. Reruns that leave a chart's data unchanged cost almost nothing with any command, so don't rewrite a chart because other widgets rerun the app.
- An existing Plotly Express line or scatter figure also holds up to about 1,000,000 points, because it switches to WebGL above 1,000 points. A `go.Scatter` trace stays SVG; use `go.Scattergl` for large data.
- For ECharts series that read `dataset`, pass more than about 1,000 rows as a dataframe in `dataset.source`, never as Python lists in `series.data`. Only `dataset.source` is sent as Arrow, so converting a large dataframe to lists makes the chart slower to send, drops the **Show data** table, and leaves the agent API only raw option values instead of a table.
- Cache the data loading with `st.cache_data`, and isolate charts that refresh on a timer in `@st.fragment(run_every=...)` (see [performance.md](performance.md)).
- When the data loads slowly, put the load and the chart inside `with st.skeleton(height=...)` and pass the same height to the skeleton and the chart. The slot keeps its size while the data loads, and cached reruns update the chart in place (see [dashboards.md](dashboards.md)).

Streamlit fills rendering defaults that you haven't set yourself, so don't add them by hand:

- Vega-based charts with more than 2,000 per-row marks (points, bars, or `st.line_chart`'s hover points) render to canvas, which exposes only the chart's `alt` name to screen readers. To keep an Altair chart on SVG, use `chart.properties(usermeta={"embedOptions": {"renderer": "svg"}})`.
- ECharts scatter series with more than 20,000 points and bar series with more than 2,000 bars use `"large": True`. ECharts lines with more than 2,000 points on a value or time axis hide their symbols.

## Plotly and Matplotlib

Don't reach for Plotly or Matplotlib for ordinary 2D charts. `st.echarts_chart` covers them and matches the app better.

- **`st.plotly_chart`** fits when you need what neither ECharts nor Vega-Lite draws: 3D charts (`scatter3d`, `surface`, `mesh3d`, `volume`), scientific traces (violin, ternary, carpet, Smith charts), a tile basemap under a chart, or a Plotly figure the user already has. It needs the `plotly` package. Browsers allow only a handful of WebGL contexts per page, so keep WebGL-heavy Plotly charts to a few per page.
- **`st.pyplot`** displays a Matplotlib figure as a static image: no zoom, hover, or selection. It doesn't follow the app theme, so a default figure is a white box on a dark theme. It also renders on the server on every rerun. Use it only for a figure you already have, or for libraries that only produce Matplotlib output (seaborn, statsmodels, scikit-learn displays). Pass the `Figure`, not an `Axes`: pandas `.plot()` returns an `Axes`, so pass its `.get_figure()` result.

## Maps and diagrams

- **`st.map`** draws points on a basemap that follows the app theme, with no token needed. Move to **`st.pydeck_chart`** for polygons, arcs, hexagons, heatmaps, 3D, tooltips, multiple layers, or selections.
- **`st.mermaid_chart`** draws flowcharts, sequence diagrams, ER models, and other Mermaid diagrams, themed for light and dark. A ```` ```mermaid ```` fence in `st.markdown` works too (see [markdown.md](markdown.md)).
- **`st.graphviz_chart`** is for diagrams that need Graphviz layout engines or clusters. It doesn't theme colors, so set node, edge, and font colors explicitly for dark themes. Prefer `st.mermaid_chart` otherwise.

## References

- [Chart elements](https://docs.streamlit.io/develop/api-reference/charts)
- [st.echarts_chart](https://docs.streamlit.io/develop/api-reference/charts/st.echarts_chart)
- [st.line_chart](https://docs.streamlit.io/develop/api-reference/charts/st.line_chart)
- [st.bar_chart](https://docs.streamlit.io/develop/api-reference/charts/st.bar_chart)
- [st.altair_chart](https://docs.streamlit.io/develop/api-reference/charts/st.altair_chart)
- [st.plotly_chart](https://docs.streamlit.io/develop/api-reference/charts/st.plotly_chart)
- [st.pyplot](https://docs.streamlit.io/develop/api-reference/charts/st.pyplot)
