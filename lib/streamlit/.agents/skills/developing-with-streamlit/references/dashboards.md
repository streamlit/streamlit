
# Streamlit dashboards

Compose metrics, charts, and data into clean dashboard layouts.

## Cards with borders

Use `border=True` to create visual cards. Supported on `st.container`, `st.metric`, `st.columns`, `st.grid`, and `st.form`:

```python
# Container card
with st.container(border=True):
    st.subheader("Sales Overview")
    st.line_chart(sales_data, alt="Sales over time")

# Metric card
st.metric("Revenue", "$1.2M", "+12%", border=True)

# Column cards
for col in st.columns(3, border=True):
    with col:
        st.metric("Users", "1.2k")
```

## Card labels

Add context to cards with headers or bold text:

```python
# With subheader
with st.container(border=True):
    st.subheader("Monthly Trends")
    st.line_chart(data, alt="Monthly trends over time")

# With bold label
with st.container(border=True):
    st.markdown("**Top Products**")
    st.dataframe(top_products, alt="Top products")
```

## Card headers and menus

In BI dashboards, give every card the same header: a bold title, an optional caption, and controls aligned right. Mark certified metrics with a badge, and put secondary actions in a ⋮ menu instead of more buttons:

```python
def card_header(title: str, caption: str | None = None, *, certified: bool = False):
    with st.container(horizontal=True, vertical_alignment="center"):
        with st.container(gap=None):
            badge = " :green-badge[:material/verified:]" if certified else ""
            st.markdown(f"**{title}**{badge}")
            if caption:
                st.caption(caption)
        return st.container(
            horizontal=True, horizontal_alignment="right", width="content"
        )


with st.container(border=True):
    controls = card_header("MRR by plan", "Monthly recurring revenue", certified=True)
    view = controls.segmented_control(
        "View", ["$", "%"], default="$", required=True, label_visibility="collapsed"
    )
    action = controls.menu_button(
        ":material/more_vert:",
        [":material/menu_book: What's measured"],
        type="tertiary",
        help="More options",
    )
    if action:
        definition_drawer("mrr_by_plan")  # An @st.dialog(..., position="right")
```

- A label that is only `:material/more_vert:` (or `:material/more_horiz:` or `:material/menu:`) makes an icon-only trigger without a chevron.
- `st.menu_button` returns the picked option only on the rerun it triggers. To toggle a chart option from the menu, flip a Session State flag in its `on_click` callback, so the card already reads the new value when it redraws.
- Show definitions and record details in a side drawer, `@st.dialog(..., position="right")`, and the query behind a section in `st.popover("SQL", icon=":material/data_object:")` with `st.code(sql, language="sql")`. In a `@st.fragment(parallel=True)`, open the drawer only on the rerun a click triggers, as the menu above does: calling `@st.dialog` during the parallel full-app run raises.
- For a certified KPI, add `:green[:material/verified:]` to the `st.metric` label and its definition to `help`.

## KPI rows

Use horizontal containers for responsive metric rows:

```python
with st.container(horizontal=True):
    st.metric("Revenue", "$1.2M", "-7%", border=True)
    st.metric("Users", "762k", "+12%", border=True)
    st.metric("Orders", "1.4k", "+5%", border=True)
```

A horizontal container sizes each metric to its content and wraps metrics that don't fit onto the next line. Prefer it for up to about five metrics that all have the same parts (every metric has a `delta`, or none does; the same for `chart_data`). With more, the cards get narrow, and when the row wraps, the cards on the last line are much wider than the rest.

Use `st.grid` when cards need a fixed layout: equal-width columns that line up across rows. The grid drops a column whenever the columns would get narrower than `min_column_width`, and `grid.cell()` lets a card span columns. It fits metrics with different parts and card walls with several rows. Keep each metric's own `border=True` rather than the grid's cell borders, and pass `height="stretch"` so every card in a row is as tall as the tallest one:

```python
# A pixel row height also gives every row the same height.
with st.grid(4, row_height=160, gap="medium"):
    st.metric("Revenue", "$1.2M", "-7%", border=True, height="stretch")
    st.metric("Users", "762k", "+12%", border=True, height="stretch")
    st.metric("Orders", "1.4k", border=True, height="stretch")
    st.metric("Conversion", "3.2%", "+0.1%", border=True, height="stretch")
```

For a side-by-side comparison of `st.columns`, `st.grid`, and horizontal containers, see "Side by side: columns vs grid vs horizontal container" in `layouts.md`.

## Zero deltas

Streamlit treats numeric zeros and the string `"0"` as zero. It does not parse other string deltas as numbers to choose the arrow and color, so `"0%"` gets a green up-arrow. For a flat period, pass the number `0` as `delta` and put the qualifier text in `delta_description`:

```python
st.metric("Orders", "1.4k", 0, delta_description="vs. last month", border=True)
```

Streamlit shows that delta in gray with no arrow.

## Metrics with sparklines

Add trend context with `chart_data`:

```python
weekly_values = [700, 720, 715, 740, 762, 755, 780]

st.metric(
    "Active Users",
    "780k",
    "+3.2%",
    border=True,
    chart_data=weekly_values,
    chart_type="line",  # or "bar" or "area"
)
```

Sparklines show y-values only—use for evenly-spaced data like daily/weekly snapshots.

## Dashboard layout

Combine cards into a dashboard:

```python
# KPI row
with st.container(horizontal=True):
    st.metric("Revenue", "$1.2M", "-7%", border=True, chart_data=rev_trend)
    st.metric("Users", "762k", "+12%", border=True, chart_data=user_trend)
    st.metric(
        "Orders", "1.4k", "+5%", border=True, chart_data=order_trend, chart_type="bar"
    )

# Charts row
col1, col2 = st.columns(2)
with col1:
    with st.container(border=True):
        st.subheader("Revenue by Region")
        st.bar_chart(region_data, x="region", y="revenue", alt="Revenue by region")

with col2:
    with st.container(border=True):
        st.subheader("Monthly Trend")
        st.line_chart(monthly_data, x="month", y="value", alt="Monthly trend")

# Data table
with st.container(border=True):
    st.subheader("Recent Orders")
    st.dataframe(orders_df, hide_index=True, alt="Recent orders")
```

## Choosing charts for a dashboard

Prefer one chart engine per page (see [charts.md](charts.md)), and combine engines when a chart needs a type or feature the main one lacks:

- **Operational dashboards** (KPIs, monitoring, several charts driven by the same filters): prefer `st.echarts_chart` for every chart. Filter changes animate from the old values to the new ones, time series get a built-in zoom slider (`dataZoom`), gauges and funnels match the line and bar charts, and dense series stay fast with `sampling` and `large`.
- **Analytical dashboards** (aggregation, binning, faceting, brushing one chart to filter others): prefer `st.altair_chart`, with the simple charts for quick views.
- Metric sparklines (`chart_data`) work next to either engine.

```python
st.echarts_chart(
    {
        "tooltip": {"trigger": "axis", "valueFormatter": "dollar"},
        "dataset": {"source": daily_revenue},  # Columns: date, revenue
        "xAxis": {"type": "time"},
        "yAxis": {"type": "value"},
        "dataZoom": [{"type": "inside"}, {"type": "slider"}],
        "series": [{"type": "line", "showSymbol": False}],
    },
    alt="Daily revenue, rising since March",
)
```

The layout examples on this page use simple charts for brevity; the same layouts work with `st.echarts_chart`.

## Layout-first loading with parallel fragments + skeletons

When a dashboard has multiple cards with slow data loads (queries or API calls), load the layout first: the cheap parts (titles, filters, card frames) paint right away, a skeleton holds each slow card body at its final size, and the bodies fill in as their data arrives. Combine `@st.fragment(parallel=True)` with `st.skeleton`: the fragments load concurrently on a full app rerun, so the dashboard fills in card-by-card instead of blocking on the slowest query.

```python
@st.cache_data(ttl="15m")
def load_revenue(): ...  # Slow query / API call


@st.cache_data(ttl="15m")
def load_orders(): ...  # Another slow query / API call


@st.fragment(parallel=True)
def revenue_body():
    data = load_revenue()
    st.bar_chart(data, x="region", y="revenue", height=260, alt="Revenue by region")


@st.fragment(parallel=True)
def orders_body():
    data = load_orders()
    st.dataframe(data, height=260, hide_index=True, alt="Recent orders")


col1, col2 = st.columns(2)
with col1:
    with st.container(border=True):
        st.subheader("Revenue by Region")  # Drawn by the main script
        with st.skeleton(height=260):  # Holds the slot until the chart arrives
            revenue_body()
with col2:
    with st.container(border=True):
        st.subheader("Recent Orders")
        with st.skeleton(height=260):
            orders_body()
```

Draw each card's frame and title in the main script, and call its parallel fragment inside `with st.skeleton(height=...)`. The main script sends every card's title and skeleton with the layout, so each card has its final size while the queries run. The fragment's first visible element replaces the skeleton, so draw that element first. On reruns that hit the cache, each chart updates in place without a skeleton; on a cache miss, the skeleton covers the old chart at its size after half a second. A cached function's custom `show_spinner` text appears on the skeleton.

A fragment's own rerun, such as a `run_every` refresh or a widget interaction inside the fragment, runs only the fragment body. It never re-enters the block around the call, so Streamlit fades the old content as stale until the rerun finishes. If those reruns can be slow, wrap the body's content in a second `with st.skeleton()`:

```python
def load_live_orders(): ...  # Slow query that every refresh runs again


@st.fragment(parallel=True, run_every="15s")
def live_orders():
    with st.skeleton():  # Covers the fragment's own refreshes
        st.bar_chart(load_live_orders(), height=340, alt="Orders per minute")


with st.container(border=True):
    st.markdown("**Live orders**")
    with st.skeleton(height=340):  # Sizes the first load
        live_orders()
```

Each block covers the runs that enter it, and the inner skeleton doesn't end the outer one. The inner block needs no height when it's the body's first element: on a full-app run, the outer skeleton covers it, and on the fragment's own rerun, the previous content keeps its size under the skeleton.

A card with its own controls must draw them inside the fragment, so it draws its frame, title, and controls there, followed by `with st.skeleton(height=...)` around the slow part. A skeleton around the call can't hold this card's slot, because the visible controls end it at once. The card paints when its fragment runs, and the inner block also shows on the first load, so it needs the content's height, as in the `dashboard-metrics` and `dashboard-compute` chart cards.

To keep the layout stable:

- Give each skeleton the content's height: pass the same `height` to the skeleton and the chart, table, or metric, or use `height="stretch"` in a parent with a bounded height. If the element has no `height` parameter, give the skeleton the height the element renders at. An inner block that is the fragment body's first element needs none.
- Put the content inside the `with st.skeleton()` block, not after it, and draw the slow element first: any visible element, even a caption, ends the skeleton.
- Give stateful elements a `key`, so a rerun updates them in place and they keep their scroll and selection.
- Inside a skeleton, Streamlit hides a cached function's default spinner, so `show_spinner=False` isn't needed. Pass `show_spinner="..."` to label the skeleton during slow loads.

Cache the loaders (`@st.cache_data`) so cards render instantly on later reruns. Cards don't each need their own data source: if several cards call the same cached function with the same arguments, the cache's per-key lock runs it once and they share that one result. When you *can* split the work into independent queries, prefer that—parallel fragments overlap independent loads so the dashboard finishes in about the time of the slowest one. See `performance.md` for more on parallel fragments and caching.

When cards depend on each other, such as a chart selection that filters a table, they can't be independent fragments. Paint the layout first anyway: draw each card's frame, header, and a standalone `st.skeleton()` placeholder, then load the data once and fill each placeholder. On reruns, a placeholder keeps its previous content until the new content arrives, and the skeleton covers it only after half a second. The load runs outside any skeleton block, so a cached loader's spinner would show as its own element: cache it with `show_spinner=False`.

```python
with st.container(border=True):
    st.markdown("**Accounts**")
    table_slot = st.skeleton(height=400)  # Drawn before any data loads

accounts = load_accounts()
table_slot.dataframe(accounts, height=400, alt="Customer accounts")
```

Or draw both cards in one `@st.fragment(parallel=True)` inside one `st.skeleton`, as `dashboard-revenue` does for its industry donut and accounts table. A selection then reruns only that fragment.

Put a control that must stay responsive during a slow load in the main script, not inside a card's fragment. When one card is much slower than the rest, a control *inside* a fragment stays queued behind the in-progress run until that slow card finishes, whereas a main-script widget reruns the whole script, preempts the run, and refreshes every card together. When cards load in a similar time this doesn't matter and per-card controls are fine.

## Global filters

Put the page's filters in a toolbar under the title, or in the sidebar (`with st.sidebar:`) when there are many. Bind them to the URL with `bind="query-params"` so every view can be shared, and keep secondary filters in a popover:

```python
def reset_filters() -> None:
    # Assigning keys in a callback resets bound widgets and their URL parameters.
    st.session_state.period = "12M"
    st.session_state.regions = []


with st.container(horizontal=True, vertical_alignment="center"):
    st.title("Revenue overview", icon=":material/insights:", anchor=False)
    st.button(
        "Reset", icon=":material/restart_alt:", type="tertiary", on_click=reset_filters
    )

with st.container(horizontal=True, vertical_alignment="center"):
    period = st.segmented_control(
        "Period",
        ["3M", "6M", "12M"],
        default="12M",
        required=True,
        key="period",
        bind="query-params",
        label_visibility="collapsed",
    )
    with st.popover("Filters", icon=":material/tune:"):
        regions = st.pills(
            "Regions",
            REGIONS,
            selection_mode="multi",
            key="regions",
            bind="query-params",
        )
```

- Bind only filters that are safe to share: bound values appear in links and browser history. Keep sensitive values, such as account IDs or customer emails, out of the URL, and use `persist_state` to keep them across pages.
- Treat an empty multi-select filter as "all", and summarize the active filters, for example in a caption under the title, so a closed popover doesn't hide them.
- In a multipage app, draw the toolbar in the entrypoint before `page.run()`, so every page shares it.

## Theme and polish

When the user wants a branded or dense KPI look, pair the dashboard with a theme — do not inject CSS for colors or `.block-container` padding.

- Copy `assets/templates/themes/configs/dense-dashboard.toml` (compact `paddingTop`/`paddingBottom` + light/dark toggle) or `bi-dashboard.toml` (indigo, Geist fonts, compact bold metric values) into the app’s `.streamlit/config.toml`, or point `theme.base` at a shared brand file
- Set chart and dataframe brand colors in config (`chartCategoricalColors`, `dataframe*`), not as one-off per-chart hardcodes
- Start with the cheat sheet and Content padding in `theme.md`

`dashboard-metrics` ships a copy of `dense-dashboard`, and `dashboard-revenue` a copy of `bi-dashboard`.

## Dashboard templates

Ready-to-use dashboard templates are available in `assets/templates/apps/`:

| Template | Features |
|----------|----------|
| `dashboard-revenue` | Revenue BI dashboard: filter toolbar bound to the URL, certified KPIs, card headers with ⋮ menus and definition drawers, SQL popover, ECharts annotations and forecast, donut-to-table drill-down with a record drawer, parallel fragments with skeletons |
| `dashboard-metrics` | Bordered `st.metric` KPI row with sparklines and skeletons drawn by the main script, `@st.fragment(parallel=True)` cards with `st.skeleton`, chart/table toggle, ECharts time series with zoom sliders, date filtering |
| `dashboard-companies` | Company leaderboard with a filter toolbar bound to the URL, sparkline and badge columns, a `ButtonColumn` that opens a company drawer, custom cache spinner |
| `dashboard-compute` | `@st.fragment(parallel=True)` with `st.skeleton` for concurrent, independent updates, one loader cached per breakdown, popover filters, reset callback, ECharts charts that animate between line and bar |
| `dashboard-feature-usage` | API endpoint usage analytics with a category control bound to the URL, starter kits, bordered cards, conditional "Raw data" expander (Altair) |
| `dashboard-seattle-weather` | Exploratory weather data visualization: an `st.grid` of metrics from a spec loop, year pills bound to the URL (Altair) |
| `dashboard-stock-peers` | Stock peer comparison with ECharts time series and URL-bound ticker and horizon filters |
| `dashboard-background-report` | Slow query in a `@st.fragment(parallel=True)` with a URL-bound region filter in the main script, so the page stays responsive while the report loads; layout-first loading with skeletons drawn by the main script and the report's spinner text on its skeleton |

Each template uses synthetic data that can be replaced with real queries. See `assets/templates/apps/README.md` for setup instructions.

## References

- `theme.md` — Config theming, dense padding, chart palettes (cheat sheet first)
- `layouts.md` — Columns, containers, grids, tabs, dialogs
- `charts.md` — Choosing chart commands, consistent charts, chart selections
- `data-display.md` — Dataframes, column configuration, metric sparklines
- `performance.md` — Caching and fragments for heavy dashboards
- [st.container](https://docs.streamlit.io/develop/api-reference/layout/st.container)
- [st.metric](https://docs.streamlit.io/develop/api-reference/data/st.metric)
- [st.columns](https://docs.streamlit.io/develop/api-reference/layout/st.columns)
- [st.grid](https://docs.streamlit.io/develop/api-reference/layout/st.grid)
