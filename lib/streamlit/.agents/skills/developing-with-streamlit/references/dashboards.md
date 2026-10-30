
# Streamlit dashboards

Compose metrics, charts, and data into clean dashboard layouts.

## Cards with borders

Use `border=True` to create visual cards. Supported on `st.container`, `st.metric`, `st.columns`, and `st.form`:

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

## KPI rows

Use horizontal containers for responsive metric rows:

```python
with st.container(horizontal=True):
    st.metric("Revenue", "$1.2M", "-7%", border=True)
    st.metric("Users", "762k", "+12%", border=True)
    st.metric("Orders", "1.4k", "+5%", border=True)
```

Horizontal containers wrap on smaller screens. Prefer them over `st.columns` for metric rows where every metric has the same parts (every metric has a `delta`, or none does; the same for `chart_data`). Otherwise, use `st.columns` with `height="stretch"` on each metric so the cards share a height and width (see "Aligning elements side by side" in `layouts.md`).

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
    st.metric(
        "Revenue", "$1.2M", "-7%", border=True, chart_data=rev_trend, chart_type="line"
    )
    st.metric(
        "Users", "762k", "+12%", border=True, chart_data=user_trend, chart_type="line"
    )
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

Use one chart engine for the whole page (see `charts.md`):

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

## Smooth loading with parallel fragments + skeletons

When a dashboard has multiple cards with compute-intensive data loads (queries or API calls), combine `@st.fragment(parallel=True)` with `st.skeleton`. The fragments load concurrently on a full app rerun, and each card shows a skeleton until its data is ready—so the dashboard fills in card-by-card instead of blocking on the slowest query.

```python
@st.cache_data(ttl="15m")
def load_revenue(): ...  # Slow query / API call


@st.cache_data(ttl="15m")
def load_orders(): ...  # Another slow query / API call


@st.fragment(parallel=True)
def revenue_card():
    with st.container(border=True):
        st.subheader("Revenue by Region")
        with st.skeleton(height=260):
            data = load_revenue()
            st.bar_chart(data, x="region", y="revenue", alt="Revenue by region")


@st.fragment(parallel=True)
def orders_card():
    with st.container(border=True):
        st.subheader("Recent Orders")
        with st.skeleton(height=260):
            data = load_orders()
            st.dataframe(data, hide_index=True, alt="Recent orders")


col1, col2 = st.columns(2)
with col1:
    revenue_card()
with col2:
    orders_card()
```

The `st.skeleton` context manager shows the placeholder while its block runs (after a short delay) and clears it once the content is rendered—anything written inside stays visible. Keep the card title outside the `with` block so it stays stable while the body loads.

Cache the loaders (`@st.cache_data`) so cards render instantly on later reruns. Cards don't each need their own data source: if several cards call the same cached function with the same arguments, the cache's per-key lock runs it once and they share that one result. When you *can* split the work into independent queries, prefer that—parallel fragments overlap independent loads so the dashboard finishes in about the time of the slowest one. See `performance.md` for more on parallel fragments and caching.

Put a control that must stay responsive during a slow load in the main script, not inside a card. When one card is much slower than the rest, a control *inside* a fragment stays queued behind the in-progress run until that slow card finishes, whereas a main-script widget reruns the whole script, preempts the run, and refreshes every card together. When cards load in a similar time this doesn't matter and per-card controls are fine.

## Sidebar filters

Put filters in the sidebar to maximize dashboard space:

```python
with st.sidebar:
    date_range = st.date_input("Date range", value=(start, end))
    region = st.multiselect("Region", regions, default=regions)

# Main area is all dashboard content
```

## Theme and polish

When the user wants a branded or dense KPI look, pair the dashboard with a theme — do not inject CSS for colors or `.block-container` padding.

- Copy `assets/templates/themes/configs/dense-dashboard.toml` into the app’s `.streamlit/config.toml` (compact `paddingTop`/`paddingBottom` + light/dark toggle), or point `theme.base` at a shared brand file
- Set chart and dataframe brand colors in config (`chartCategoricalColors`, `dataframe*`), not as one-off per-chart hardcodes
- Start with the cheat sheet and Content padding in `theme.md`

`dashboard-metrics` ships a sample `.streamlit/config.toml` based on `dense-dashboard`.

## Dashboard templates

Ready-to-use dashboard templates are available in `assets/templates/apps/`:

| Template | Features |
|----------|----------|
| `dashboard-metrics` | Bordered `st.metric` KPI row with sparklines, `@st.fragment(parallel=True)` cards with `st.skeleton`, chart/table toggle, ECharts time series with zoom sliders, date filtering |
| `dashboard-companies` | Company comparison with sparkline columns, filterable data tables, custom cache spinner |
| `dashboard-compute` | `@st.fragment(parallel=True)` with `st.skeleton` for concurrent, independent updates, popover filters, ECharts charts that animate between line and bar |
| `dashboard-feature-usage` | API endpoint usage analytics, trend analysis, conditional "Raw data" expander (Altair) |
| `dashboard-seattle-weather` | Exploratory weather data visualization (Altair) |
| `dashboard-stock-peers` | Stock peer comparison with ECharts time series |
| `dashboard-background-report` | Slow query in a `@st.fragment(parallel=True)` with a main-script filter, so the page stays responsive while the report loads |

Each template uses synthetic data that can be replaced with real queries. See `assets/templates/apps/README.md` for setup instructions.

## References

- `theme.md` — Config theming, dense padding, chart palettes (cheat sheet first)
- `layouts.md` — Columns, containers, tabs, dialogs
- `charts.md` — Choosing chart commands, consistent charts, chart selections
- `data-display.md` — Dataframes, column configuration, metric sparklines
- `performance.md` — Caching and fragments for heavy dashboards
- [st.container](https://docs.streamlit.io/develop/api-reference/layout/st.container)
- [st.metric](https://docs.streamlit.io/develop/api-reference/data/st.metric)
- [st.columns](https://docs.streamlit.io/develop/api-reference/layout/st.columns)
