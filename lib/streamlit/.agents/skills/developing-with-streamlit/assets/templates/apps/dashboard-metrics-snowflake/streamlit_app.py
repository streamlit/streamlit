# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Metrics Dashboard Template (Snowflake Edition)

A comprehensive metrics dashboard demonstrating:
- Snowflake connection via st.connection("snowflake")
- Parameterized queries for safe data loading
- Time series visualization with Altair (line, area, bar, point charts)
- Metric cards with chart/table toggle and popover filters
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- Line options (Daily, 7-day MA)

This template creates synthetic data in Snowflake. You can:
1. Replace the synthetic data generation with your actual tables
2. Modify the queries to match your schema (using parameterized queries)
"""

from datetime import date, timedelta

import altair as alt
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Metrics Dashboard (Snowflake)",
    page_icon=":material/monitoring:",
    layout="wide",
)


# =============================================================================
# Constants
# =============================================================================

TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
CHART_HEIGHT = 300

# Metric configurations (used for synthetic data generation)
METRIC_CONFIGS = {
    "users": {"base_value": 5000, "growth_rate": 0.002},
    "sessions": {"base_value": 15000, "growth_rate": 0.003},
    "revenue": {"base_value": 50000, "growth_rate": 0.001},
    "conversions": {"base_value": 500, "growth_rate": 0.0015},
}


# =============================================================================
# Snowflake Connection and Data Loading
# =============================================================================


def get_snowflake_connection():
    """Get Snowflake connection via st.connection.

    Displays an error and stops the app if the connection fails.
    """
    try:
        return st.connection("snowflake")
    except Exception as e:
        st.error(f"Failed to connect to Snowflake: {e}")
        st.info(
            "Make sure you have configured your Snowflake connection in "
            "`.streamlit/secrets.toml` or via environment variables."
        )
        st.stop()


# SQL query template for synthetic data generation.
# Uses positional parameters (?) for Snowflake connector compatibility.
SYNTHETIC_DATA_QUERY = """
WITH date_series AS (
    SELECT
        DATEADD(day, -seq4(), CURRENT_DATE() - 1) AS ds
    FROM TABLE(GENERATOR(ROWCOUNT => 730))
),
base_data AS (
    SELECT
        ds,
        ? * POWER(1 + ?, DATEDIFF(day, '2023-01-01', ds)) AS base_trend,
        CASE WHEN DAYOFWEEK(ds) IN (0, 6) THEN 0.7 ELSE 1.0 END AS seasonality,
        1 + (RANDOM() / 10000000000000000000.0 - 0.5) * 0.2 AS noise
    FROM date_series
    WHERE ds >= '2023-01-01'
)
SELECT
    ds,
    ROUND(base_trend * seasonality * noise, 2) AS daily_value,
    ROUND(AVG(base_trend * seasonality * noise) OVER (
        ORDER BY ds ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2) AS value_7d_ma
FROM base_data
ORDER BY ds
"""


@st.cache_data(ttl=3600, show_spinner="Loading metrics from Snowflake...")
def load_metric_from_snowflake(metric_name: str) -> pd.DataFrame:
    """Load metric data from Snowflake using parameterized queries.

    In production, replace the synthetic query with your actual table query:

        PRODUCTION_QUERY = '''
        SELECT ds, daily_value, value_7d_ma
        FROM your_schema.your_metrics_table
        WHERE metric_name = ?
        ORDER BY ds
        '''

        df = conn.query(PRODUCTION_QUERY, params=[metric_name])
    """
    conn = get_snowflake_connection()
    config = METRIC_CONFIGS[metric_name]

    # Use parameterized query with positional parameters (list)
    df = conn.query(
        SYNTHETIC_DATA_QUERY,
        params=[config["base_value"], config["growth_rate"]],
    )
    df.columns = df.columns.str.lower()  # Normalize column names
    return df


@st.cache_data(ttl=3600)
def load_all_metrics() -> dict[str, pd.DataFrame]:
    """Load all metrics from Snowflake."""
    return {
        "users": load_metric_from_snowflake("users"),
        "sessions": load_metric_from_snowflake("sessions"),
        "revenue": load_metric_from_snowflake("revenue"),
        "conversions": load_metric_from_snowflake("conversions"),
    }


# =============================================================================
# Chart Utilities
# =============================================================================


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


def render_line_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: list[str],
    labels: list[str],
    height: int = CHART_HEIGHT,
) -> alt.Chart:
    """Render a multi-line chart."""
    # Melt for Altair
    melted = df.melt(
        id_vars=[x_col],
        value_vars=y_cols,
        var_name="series",
        value_name="value",
    )

    # Map to labels
    label_map = dict(zip(y_cols, labels))
    melted["series"] = melted["series"].map(label_map)

    chart = (
        alt.Chart(melted)
        .mark_line()
        .encode(
            x=alt.X(f"{x_col}:T", title=None),
            y=alt.Y("value:Q", title=None, scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", title=None, legend=alt.Legend(orient="bottom")),
            strokeDash=alt.condition(
                alt.datum.series == "7-day MA",
                alt.value([5, 5]),
                alt.value([0]),
            ),
            tooltip=[
                alt.Tooltip(f"{x_col}:T", title="Date", format="%Y-%m-%d"),
                alt.Tooltip("series:N", title="Series"),
                alt.Tooltip("value:Q", title="Value", format=",.0f"),
            ],
        )
        .properties(height=height)
    )

    return chart


def render_area_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: list[str],
    labels: list[str],
    height: int = CHART_HEIGHT,
) -> alt.Chart:
    """Render a stacked area chart."""
    melted = df.melt(
        id_vars=[x_col],
        value_vars=y_cols,
        var_name="series",
        value_name="value",
    )
    label_map = dict(zip(y_cols, labels))
    melted["series"] = melted["series"].map(label_map)

    chart = (
        alt.Chart(melted)
        .mark_area(opacity=0.6, line=True)
        .encode(
            x=alt.X(f"{x_col}:T", title=None),
            y=alt.Y("value:Q", title=None, scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", title=None, legend=alt.Legend(orient="bottom")),
            tooltip=[
                alt.Tooltip(f"{x_col}:T", title="Date", format="%Y-%m-%d"),
                alt.Tooltip("series:N", title="Series"),
                alt.Tooltip("value:Q", title="Value", format=",.0f"),
            ],
        )
        .properties(height=height)
    )
    return chart


def render_bar_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: list[str],
    labels: list[str],
    height: int = CHART_HEIGHT,
) -> alt.Chart:
    """Render a bar chart (weekly aggregation for readability)."""
    df = df.copy()
    df[x_col] = pd.to_datetime(df[x_col])
    df["week"] = df[x_col].dt.to_period("W").dt.start_time

    # Aggregate by week
    agg_df = df.groupby("week")[y_cols].mean().reset_index()

    melted = agg_df.melt(
        id_vars=["week"],
        value_vars=y_cols,
        var_name="series",
        value_name="value",
    )
    label_map = dict(zip(y_cols, labels))
    melted["series"] = melted["series"].map(label_map)

    chart = (
        alt.Chart(melted)
        .mark_bar(opacity=0.8)
        .encode(
            x=alt.X("week:T", title=None),
            y=alt.Y("value:Q", title=None, scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", title=None, legend=alt.Legend(orient="bottom")),
            xOffset="series:N",
            tooltip=[
                alt.Tooltip("week:T", title="Week", format="%Y-%m-%d"),
                alt.Tooltip("series:N", title="Series"),
                alt.Tooltip("value:Q", title="Value", format=",.0f"),
            ],
        )
        .properties(height=height)
    )
    return chart


def render_point_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: list[str],
    labels: list[str],
    height: int = CHART_HEIGHT,
) -> alt.Chart:
    """Render a scatter/point chart with trend line."""
    melted = df.melt(
        id_vars=[x_col],
        value_vars=y_cols,
        var_name="series",
        value_name="value",
    )
    label_map = dict(zip(y_cols, labels))
    melted["series"] = melted["series"].map(label_map)

    points = (
        alt.Chart(melted)
        .mark_point(opacity=0.5, size=20)
        .encode(
            x=alt.X(f"{x_col}:T", title=None),
            y=alt.Y("value:Q", title=None, scale=alt.Scale(zero=False)),
            color=alt.Color("series:N", title=None, legend=alt.Legend(orient="bottom")),
            tooltip=[
                alt.Tooltip(f"{x_col}:T", title="Date", format="%Y-%m-%d"),
                alt.Tooltip("series:N", title="Series"),
                alt.Tooltip("value:Q", title="Value", format=",.0f"),
            ],
        )
    )

    # Add trend line for 7-day MA only
    trend = (
        alt.Chart(melted[melted["series"] == "7-day MA"])
        .mark_line(strokeDash=[5, 5], strokeWidth=2)
        .encode(
            x=alt.X(f"{x_col}:T"),
            y=alt.Y("value:Q"),
            color=alt.Color("series:N"),
        )
    )

    return (points + trend).properties(height=height)


# =============================================================================
# Metric Card Component
# =============================================================================


def metric_card(
    title: str,
    df: pd.DataFrame,
    key_prefix: str,
    chart_type: str = "line",
):
    """Display a metric card with chart/table toggle and popover filters.

    Args:
        title: Card title
        df: DataFrame with ds, daily_value, value_7d_ma columns
        key_prefix: Unique prefix for widget keys
        chart_type: One of "line", "area", "bar", "point"
    """
    chart_renderers = {
        "line": render_line_chart,
        "area": render_area_chart,
        "bar": render_bar_chart,
        "point": render_point_chart,
    }
    render_chart = chart_renderers.get(chart_type, render_line_chart)

    with st.container(border=True):
        # Header row with title, view toggle, and filters
        with st.container(
            horizontal=True,
            horizontal_alignment="distribute",
            vertical_alignment="center",
        ):
            st.markdown(f"**{title}**")

            view_mode = st.segmented_control(
                "View",
                options=[":material/show_chart:", ":material/table:"],
                default=":material/show_chart:",
                key=f"{key_prefix}_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", type="tertiary"):
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["Daily", "7-day MA"],
                    selection_mode="multi",
                    key=f"{key_prefix}_lines",
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key=f"{key_prefix}_time",
                )

        # Apply filters
        line_options = line_options or ["7-day MA"]
        filtered_df = filter_by_time_range(df, "ds", time_range)

        # Determine which columns to show
        y_cols = []
        labels = []
        if "Daily" in line_options:
            y_cols.append("daily_value")
            labels.append("Daily")
        if "7-day MA" in line_options:
            y_cols.append("value_7d_ma")
            labels.append("7-day MA")

        # Render view
        if "table" in (view_mode or ""):
            st.dataframe(
                filtered_df,
                use_container_width=True,
                height=CHART_HEIGHT,
                hide_index=True,
            )
        elif y_cols:
            st.altair_chart(
                render_chart(filtered_df, "ds", y_cols, labels),
                use_container_width=True,
            )
        else:
            st.info("Select at least one line option.")


# =============================================================================
# Page Header Component
# =============================================================================


def render_page_header(title: str):
    """Render page header with title and reset button."""
    with st.container(
        horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
    ):
        st.markdown(title)
        if st.button(":material/restart_alt: Reset", type="tertiary"):
            st.session_state.clear()
            st.rerun()


# =============================================================================
# Page Layout
# =============================================================================

# Load data from Snowflake
metrics_data = load_all_metrics()

# Page header
render_page_header("# :material/monitoring: Metrics Dashboard")
st.caption(":material/cloud: Powered by Snowflake")

# Row 1: Users and Sessions
row1 = st.columns(2)

with row1[0]:
    metric_card("Active Users", metrics_data["users"], "users", chart_type="line")

with row1[1]:
    metric_card("Sessions", metrics_data["sessions"], "sessions", chart_type="area")

# Row 2: Revenue and Conversions
row2 = st.columns(2)

with row2[0]:
    metric_card("Revenue", metrics_data["revenue"], "revenue", chart_type="bar")

with row2[1]:
    metric_card(
        "Conversions", metrics_data["conversions"], "conversions", chart_type="point"
    )
