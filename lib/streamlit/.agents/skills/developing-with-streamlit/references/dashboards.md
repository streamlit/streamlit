
# Streamlit dashboards

Compose metrics, charts, and data into clean dashboard layouts.

## Cards with borders

Use `border=True` to create visual cards. Supported on `st.container`, `st.metric`, `st.columns`, and `st.form`:

```python
# Container card
with st.container(border=True):
    st.subheader("Sales Overview")
    st.line_chart(sales_data)

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
    st.line_chart(data)

# With bold label
with st.container(border=True):
    st.markdown("**Top Products**")
    st.dataframe(top_products)
```

## KPI rows

Use horizontal containers for responsive metric rows:

```python
with st.container(horizontal=True):
    st.metric("Revenue", "$1.2M", "-7%", border=True)
    st.metric("Users", "762k", "+12%", border=True)
    st.metric("Orders", "1.4k", "+5%", border=True)
```

Horizontal containers wrap on smaller screens. Prefer them over `st.columns` for metric rows.

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
    chart_type="line",  # or "bar"
)
```

Sparklines show y-values only—use for evenly-spaced data like daily/weekly snapshots.

## Dashboard layout

Combine cards into a dashboard:

```python
# KPI row
with st.container(horizontal=True):
    st.metric("Revenue", "$1.2M", "-7%", border=True, chart_data=rev_trend, chart_type="line")
    st.metric("Users", "762k", "+12%", border=True, chart_data=user_trend, chart_type="line")
    st.metric("Orders", "1.4k", "+5%", border=True, chart_data=order_trend, chart_type="bar")

# Charts row
col1, col2 = st.columns(2)
with col1:
    with st.container(border=True):
        st.subheader("Revenue by Region")
        st.bar_chart(region_data, x="region", y="revenue")

with col2:
    with st.container(border=True):
        st.subheader("Monthly Trend")
        st.line_chart(monthly_data, x="month", y="value")

# Data table
with st.container(border=True):
    st.subheader("Recent Orders")
    st.dataframe(orders_df, hide_index=True)
```

## Sidebar filters

Put filters in the sidebar to maximize dashboard space:

```python
with st.sidebar:
    date_range = st.date_input("Date range", value=(start, end))
    region = st.multiselect("Region", regions, default=regions)

# Main area is all dashboard content
```

## Dashboard templates

Ready-to-use dashboard templates are available in `assets/templates/apps/`:

| Template | Features |
|----------|----------|
| `dashboard-metrics` | Metric cards with chart/table toggle, time-series charts, date filtering, focus mode |
| `dashboard-companies` | Company comparison with sparkline columns, filterable data tables |
| `dashboard-compute` | `@st.fragment` for independent updates, popover filters |
| `dashboard-feature-usage` | Feature adoption tracking, trend analysis |
| `dashboard-seattle-weather` | Weather data visualization |
| `dashboard-stock-peers` | Stock peer comparison |

Each template uses synthetic data that can be replaced with real queries. See `assets/templates/apps/README.md` for setup instructions.

## References

- `layouts.md` — Columns, containers, tabs, dialogs
- `data-display.md` — Charts, dataframes, column configuration
- `performance.md` — Caching and fragments for heavy dashboards
- [st.container](https://docs.streamlit.io/develop/api-reference/layout/st.container)
- [st.metric](https://docs.streamlit.io/develop/api-reference/data/st.metric)
- [st.columns](https://docs.streamlit.io/develop/api-reference/layout/st.columns)
