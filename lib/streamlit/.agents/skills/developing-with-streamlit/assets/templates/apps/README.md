# Streamlit Dashboard App Templates

This directory contains ready-to-use dashboard templates for Streamlit. Each template demonstrates best practices for building data-driven dashboards with modern UI patterns.

## Available Templates

### Public Demo Templates

These templates are based on official Streamlit demo apps and work out of the box:

| Template | Description | Key Features |
|----------|-------------|--------------|
| **dashboard-seattle-weather** | Weather data exploration dashboard | `st.metric`, `st.pills`, `st.altair_chart`, year comparison |
| **dashboard-stock-peers** | Stock peer analysis and comparison | `st.multiselect`, normalized charts, peer average calculation |
| **dashboard-stock-peers-snowflake** | Same as above but using Snowflake | `st.connection("snowflake")`, synthetic stock data in SQL |

### Analytics Dashboard Templates

These templates demonstrate common dashboard patterns with synthetic data. Replace the data generation functions with your actual data sources:

| Template | Description | Key Features |
|----------|-------------|--------------|
| **dashboard-metrics** | Core metrics dashboard with KPIs | Chart/table toggle, `st.popover` filters, TIME_RANGES (1M/6M/1Y/QTD/YTD/All) |
| **dashboard-metrics-snowflake** | Same as above but using Snowflake | `st.connection("snowflake")`, SQL-based data generation |
| **dashboard-feature-usage** | API endpoint usage analytics | Segmented control, starter kits, normalization toggle, rolling averages |
| **dashboard-companies** | Company leaderboard with drill-down | Interactive dataframe, sparkline columns, growth scores |
| **dashboard-compute** | Resource consumption monitoring | `@st.fragment`, `st.popover` filters, TIME_RANGES, line/bar toggle |
| **dashboard-compute-snowflake** | Same as above but using Snowflake | `st.connection("snowflake")`, SQL-based data generation |

## Quick Start

### Run a Template Locally

```bash
# Navigate to a template directory
cd assets/templates/apps/dashboard-metrics

# Install dependencies with uv
uv pip install -e .

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

## Canonical Patterns

When creating new templates or adapting existing ones, follow these patterns for consistency.

### Page Configuration

Always set page config as the first Streamlit call, with `layout="wide"` and a Material icon:

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

    return df[df[x_col] >= min_date]
```

### Popover Filters

Compact filter controls using `st.popover`:

```python
with st.popover("Filters", type="tertiary"):
    line_options = st.pills("Lines", ["Daily", "7-day MA"], selection_mode="multi")
    time_range = st.segmented_control("Time range", TIME_RANGES, default="All")
```

### Page Header with Reset Button

```python
def render_page_header(title: str):
    """Render page header with title and reset button."""
    with st.container(
        horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
    ):
        st.markdown(title)
        if st.button(":material/restart_alt: Reset", type="tertiary"):
            st.session_state.clear()
            st.rerun()
```

### Independent Widget Updates with @st.fragment

```python
@st.fragment
def metric_card():
    with st.container(border=True):
        # This widget updates independently without full page rerun
        ...
```

### Snowflake Column Normalization

Snowflake returns uppercase column names. Always normalize after queries:

```python
df = conn.query(query)
df.columns = df.columns.str.lower()
```

### Snowflake Connection Error Handling

```python
try:
    get_snowflake_connection()
except Exception as e:
    st.error(f"Failed to connect to Snowflake: {e}")
    st.info(
        "Make sure you have configured your Snowflake connection in "
        "`.streamlit/secrets.toml` or via environment variables."
    )
    st.stop()
```

### Data Loading with Caching

```python
@st.cache_data(ttl=3600)
def load_metric_data() -> pd.DataFrame:
    """Load metric data. Replace with your actual data source."""
    # Replace this with:
    # - Snowflake query via st.connection("snowflake")
    # - API call
    # - Database query
    return generate_synthetic_data()
```

## Dependencies

All templates require Python >=3.11 and use:
- `snowflake-connector-python>=3.3.0` (required — `streamlit[snowflake]` silently skips this on Python 3.12+)
- `streamlit[snowflake]>=1.54.0`
- `altair>=5.5.0`
- `pandas>=2.2.3`
- `numpy>=1.26.0`
