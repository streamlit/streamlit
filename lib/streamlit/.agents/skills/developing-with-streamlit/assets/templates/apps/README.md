# Streamlit Dashboard App Templates

This directory contains ready-to-use dashboard templates for Streamlit. Each template demonstrates best practices for building data-driven dashboards with modern UI patterns.

## Available Templates

### Public Demo Templates

These templates are based on official Streamlit demo apps and work out of the box:

| Template | Description | Key Features |
|----------|-------------|--------------|
| **dashboard-seattle-weather** | Weather data exploration dashboard | `st.grid` of bordered `st.metric`s built from a spec loop (`format`, `delta_description`, `icon`), year `st.pills` bound to the URL, `st.altair_chart` year comparison with matching chart heights |
| **dashboard-stock-peers** | Stock peer analysis and comparison | `st.multiselect` and required horizon `st.pills` bound to the URL, normalized `st.echarts_chart` lines with a zoom slider, percent-formatted best and worst metrics, peer average calculation |

### Analytics Dashboard Templates

These templates demonstrate common dashboard patterns with synthetic data. Replace the data generation functions with your actual data sources:

| Template | Description | Key Features |
|----------|-------------|--------------|
| **dashboard-revenue** | Revenue BI dashboard with certified metrics | Filter toolbar bound to the URL (`bind="query-params"`), certified KPI metrics and card titles, ⋮ `st.menu_button` card menus with a "What's measured" drawer and a forecast toggle, section SQL popover, ECharts milestone annotations and forecast range, donut-to-table drill-down with a `ButtonColumn` account drawer, layout-first loading with parallel fragments, `bi-dashboard` theme |
| **dashboard-metrics** | Core metrics dashboard with KPIs | `st.metric` KPI row with sparklines and skeletons drawn by the main script, `@st.fragment(parallel=True)` cards with `st.skeleton`, `st.echarts_chart` line/area/bar/point charts with `dataZoom`, chart/table toggle, `st.popover` filters, TIME_RANGES (1M/6M/1Y/QTD/YTD/All) |
| **dashboard-feature-usage** | API endpoint usage analytics | Category `st.segmented_control` bound to the URL, starter kits, bordered cards, `st.metric` with `format=`, normalization toggle, rolling averages, conditional "Raw data" expander (`on_change="rerun"`) |
| **dashboard-companies** | Company leaderboard with drill-down | Filter toolbar bound to the URL, leaderboard with sparkline and colored badge columns, `ButtonColumn` that opens a company drawer (`@st.dialog(position="right")`), custom cache spinner |
| **dashboard-compute** | Resource consumption monitoring | `@st.fragment(parallel=True)` cards with `st.skeleton`, one loader cached per breakdown, `st.popover` filters with required segmented controls, reset callback, TIME_RANGES, `st.echarts_chart` line/stacked bar toggle |
| **dashboard-background-report** | Responsive page with a slow background report | Slow query in `@st.fragment(parallel=True)`, URL-bound region filter in the main script that stays responsive, `@st.cache_data(refresh_mode="background")`, layout-first loading with `st.skeleton` drawn by the main script, the report's `show_spinner` text on its skeleton, formatted report columns |

## Quick Start

### Run a Template Locally

```bash
# Navigate to a template directory
cd assets/templates/apps/dashboard-metrics

# Sync dependencies from pyproject.toml
uv sync

# Run the app
uv run streamlit run streamlit_app.py
```

## Template Structure

Each template follows this structure:

```
dashboard-{name}/
├── streamlit_app.py    # Main application code
└── pyproject.toml      # Dependencies and metadata
```

`dashboard-metrics` also ships `.streamlit/config.toml` (a copy of `dense-dashboard`). `dashboard-revenue` ships a copy of `bi-dashboard` and splits its code into `streamlit_app.py` (the page), `components.py` (card headers, menus, and drawers), `charts.py`, and `data.py`.

## Canonical Patterns

When creating new templates or adapting existing ones, follow these patterns for consistency.

### Page Configuration

Set page config near the top of the script, with `layout="wide"` and a Material icon:

```python
st.set_page_config(
    page_title="My Dashboard",
    page_icon=":material/monitoring:",
    layout="wide",
)
```

### Constants

Use these standard constant names:

```python
TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
CHART_HEIGHT = 300  # Standard chart height in pixels
```

### Time Range Filtering

All dashboard templates that support time filtering use the same `filter_by_time_range` function:

```python
def filter_by_time_range(df: pd.DataFrame, x_col: str, time_range: str) -> pd.DataFrame:
    """Filter dataframe by time range."""
    if time_range == "All" or df.empty:
        return df

    df = df.copy()
    df[x_col] = pd.to_datetime(df[x_col])
    max_date = df[x_col].max()

    if time_range == "1M":
        min_date = max_date - timedelta(days=30)
    elif time_range == "6M":
        min_date = max_date - timedelta(days=180)
    elif time_range == "1Y":
        min_date = max_date - timedelta(days=365)
    elif time_range == "QTD":
        quarter_month = ((max_date.month - 1) // 3) * 3 + 1
        min_date = pd.Timestamp(date(max_date.year, quarter_month, 1))
    elif time_range == "YTD":
        min_date = pd.Timestamp(date(max_date.year, 1, 1))
    else:
        return df

    filtered: pd.DataFrame = df[df[x_col] >= min_date]
    return filtered
```

### Popover Filters

Compact filter controls using `st.popover`:

```python
with st.popover("Filters", icon=":material/tune:", type="tertiary"):
    line_options = st.pills("Lines", ["Daily", "7-day MA"], selection_mode="multi")
    time_range = st.segmented_control(
        "Time range", TIME_RANGES, default="All", required=True, key="time_range"
    )
```

`required=True` keeps a single-select control from returning `None`, so no fallback is needed.

### Page Header with Reset Button

```python
def reset_filters() -> None:
    # Assigning keys in a callback resets keyed and URL-bound widgets.
    st.session_state.time_range = "All"


with st.container(horizontal=True, vertical_alignment="center"):
    st.title("My dashboard", icon=":material/monitoring:", anchor=False)
    st.button(
        "Reset", icon=":material/restart_alt:", type="tertiary", on_click=reset_filters
    )
```

### Independent and parallel card updates with @st.fragment

Wrap each card in `@st.fragment` so widget interactions rerun only that card,
not the whole page. If a dashboard has multiple cards with independent,
compute-intensive data loads, add `parallel=True` so those cards run
concurrently on a full app rerun. Load the page layout first: draw each card's
frame and title in the main script, and call its fragment inside
`with st.skeleton(height=...)`. Every card then has its final size from the
first paint, and the fragment's first element replaces its skeleton:

```python
@st.fragment(parallel=True)
def metric_body(metric_name: str):
    data = load_metric(metric_name)  # Cached; runs on a worker alongside other cards
    st.line_chart(data, height=300, alt=f"{metric_name} over time")


with st.container(border=True):
    st.markdown("**Revenue**")  # Drawn by the main script
    with st.skeleton(height=300):  # Holds the chart's slot until it arrives
        metric_body("revenue")
```

The skeleton around the call covers only full-app runs. If the fragment's own
reruns, such as a `run_every` refresh or a widget interaction inside it, can be
slow, add a second `with st.skeleton()` inside the fragment around the slow part.
It needs no height when it's the fragment body's first element. A card with its
own controls must draw them inside the fragment, so it draws its frame, header,
and controls there, and gives the inner skeleton the chart's height, as the
`dashboard-metrics` and `dashboard-compute` chart cards do. On a cached rerun the
chart updates in place without a skeleton; on a cache miss, the skeleton covers
the old chart at its size after half a second.

Keep `st.dialog` / `st.switch_page` out of parallel fragments — gate those
behind a widget interaction instead, where the fragment reruns sequentially.
A parallel fragment cannot write to `st.sidebar`, `st.bottom`, or other
containers created outside it, even from inside the fragment function.

### Data Loading with Caching

Cache the expensive load. Use a `ttl` to keep data fresh and `max_entries` when
the workload gives a practical entry-count bound. For `st.cache_data`, use
`max_size` only when the user provides a byte budget or deployment memory
constraints and the intended allocation across caches determine a per-cache
budget. It limits serialized bytes for one decorated function, not total process
memory. Don't guess it from source dataset size, representative or example
values, or arbitrary constants; ask the user when the memory budget is unknown.
Combine limits when they address different risks. Use a custom spinner message
for loaders that run directly in the page. Inside `with st.skeleton()`, the
skeleton already provides feedback: it hides the default spinner and shows custom
spinner text on the skeleton:

```python
@st.cache_data(ttl="1h", show_spinner="Loading metric data...")
def load_metric_data() -> pd.DataFrame:
    """Load metric data. Replace with your actual data source."""
    # Replace this with:
    # - API call
    # - Database query
    # - Data warehouse query via st.connection
    return generate_synthetic_data()
```

Guidelines: real-time data → `ttl="1m"`; metrics/reports → `ttl="5m"`–`"15m"`;
reference data → `ttl="1h"` or more; static data → no TTL.

## Dependencies

All templates require Python >=3.11 and use:
- `streamlit`
- `pandas>=2.2.3`
- `altair>=5.5.0` (templates that chart with `st.altair_chart`)
- `numpy>=1.26.0` (most templates)
