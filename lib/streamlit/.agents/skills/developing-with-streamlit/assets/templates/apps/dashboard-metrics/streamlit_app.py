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

"""Metrics dashboard template.

Demonstrates:
- KPI row of bordered ``st.metric`` values with deltas and sparklines
- Time series with ``st.echarts_chart`` (line, area, bar, point charts) that
  animate when a filter changes and zoom with a ``dataZoom`` slider
- Metric cards with chart/table toggle and popover filters
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- Line options (Daily, 7-day MA)
- ``@st.cache_data(ttl=...)`` per-metric loaders to keep data fresh and bounded
- ``@st.fragment(parallel=True)`` cards that load concurrently on full reruns
  and rerun in isolation on widget interactions
- ``st.skeleton`` placeholders so each card fills in as soon as its data is ready

This template uses synthetic data. Replace the ``generate_*_data()`` functions
with your own data sources (e.g., Snowflake queries, APIs, etc.).
"""

import hashlib
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Metrics Dashboard",
    page_icon=":material/monitoring:",
    layout="wide",
)


# =============================================================================
# Constants
# =============================================================================

TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
CHART_HEIGHT = 350  # Leaves room for each chart's legend and zoom slider
KPI_HEIGHT = 215  # Approximate height of a bordered st.metric with a sparkline
# Tooltip number format, using the same format strings as ``st.metric``.
VALUE_FORMAT = "%,.0f"

# Per-metric generation settings. Replace with the metrics you actually track.
METRIC_CONFIG: dict[str, dict[str, float]] = {
    "users": {"base_value": 5000, "growth_rate": 0.002},
    "sessions": {"base_value": 15000, "growth_rate": 0.003},
    "revenue": {"base_value": 50000, "growth_rate": 0.001},
    "conversions": {"base_value": 500, "growth_rate": 0.0015},
}


# =============================================================================
# Synthetic Data Generation (Replace with your data source)
# =============================================================================


def generate_metric_data(
    metric_name: str,
    start_date: date,
    end_date: date,
    base_value: float = 1000,
    growth_rate: float = 0.001,
    noise_factor: float = 0.1,
) -> pd.DataFrame:
    """Generate synthetic time series data for a metric.

    Replace this function with your actual data source, e.g.:
    - Snowflake query
    - API call
    - Database query
    """
    seed = int(hashlib.sha256(metric_name.encode()).hexdigest(), 16) % 2**32
    rng = np.random.default_rng(seed)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    n_days = len(dates)

    # Base trend with growth
    trend = base_value * (1 + growth_rate) ** np.arange(n_days)

    # Add weekly seasonality (lower on weekends)
    day_of_week = dates.dayofweek
    seasonality = np.where(day_of_week >= 5, 0.7, 1.0)
    trend *= seasonality

    # Add noise
    noise = rng.normal(1, noise_factor, n_days)
    values = trend * noise

    # Calculate rolling averages
    df = pd.DataFrame(
        {
            "ds": dates,
            "daily_value": values,
        }
    )
    df["value_7d_ma"] = df["daily_value"].rolling(7, min_periods=1).mean()

    return df


@st.cache_data(ttl="1h", show_spinner=False)
def load_metric(metric_name: str) -> pd.DataFrame:
    """Load a single metric's time series (cached per metric).

    Each metric is cached on its own so the metric cards can load
    concurrently as parallel fragments. Replace the body with your data
    source (Snowflake query, API call, etc.). The ``ttl`` keeps the cache
    fresh; add ``max_entries`` if the set of metric names can grow large so
    the cache stays bounded.
    """
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=730)  # 2 years of data
    config = METRIC_CONFIG[metric_name]
    return generate_metric_data(metric_name, start_date, end_date, **config)


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

    filtered: pd.DataFrame = df[df[x_col] >= min_date]
    return filtered


def describe_trend(
    title: str, source: pd.DataFrame, x_col: str, y_col: str, series: str
) -> str:
    """Summarize one plotted series for the chart's ``alt`` text.

    ``source`` is the chart's ``dataset.source``, so the summary uses the drawn
    values, such as the weekly means of the bar chart.
    """
    values = source[y_col]
    change = values.iloc[-1] / values.iloc[0] - 1
    return (
        f"{title}, {series} from {source[x_col].iloc[0]:%Y-%m-%d} to "
        f"{source[x_col].iloc[-1]:%Y-%m-%d}: {change:+.1%}"
    )


def _time_series_option(
    source: pd.DataFrame,
    series: list[dict[str, Any]],
    y_from_zero: bool = False,
) -> dict[str, Any]:
    """Build an ECharts option for series that share a time x-axis.

    The dataframe goes in ``dataset.source``, so Streamlit sends it as Arrow,
    and each series picks its columns with ``encode``.
    """
    return {
        "dataset": {"source": source},
        "legend": {},
        "tooltip": {"trigger": "axis", "valueFormatter": VALUE_FORMAT},
        "xAxis": {"type": "time"},
        # Without ``scale``, the axis always starts at zero.
        "yAxis": {"type": "value", "scale": not y_from_zero},
        "dataZoom": [{"type": "inside"}, {"type": "slider"}],
        "series": series,
    }


def _line_series(x_col: str, y_col: str, label: str) -> dict[str, Any]:
    """A line series without point markers, dashed for the "7-day MA" label."""
    return {
        "type": "line",
        "name": label,
        "encode": {"x": x_col, "y": y_col},
        "showSymbol": False,
        "lineStyle": {"type": "dashed"} if label == "7-day MA" else {},
    }


def render_line_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a multi-line chart."""
    series = [
        _line_series(x_col, y_col, label)
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


def render_area_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build an area chart.

    The areas overlap instead of stacking because the daily value and its
    7-day MA measure the same quantity.
    """
    series = [
        {**_line_series(x_col, y_col, label), "areaStyle": {"opacity": 0.3}}
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


def render_bar_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a grouped bar chart (weekly averages for readability)."""
    df = df.copy()
    # Each bar sits at the start of its week.
    df[x_col] = pd.to_datetime(df[x_col]).dt.to_period("W").dt.start_time
    weekly = df.groupby(x_col, as_index=False)[y_cols].mean()

    series = [
        {"type": "bar", "name": label, "encode": {"x": x_col, "y": y_col}}
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    # Bars start at zero so their lengths stay comparable.
    return _time_series_option(weekly, series, y_from_zero=True)


def render_point_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a scatter chart of daily values with a dashed 7-day MA trend line."""
    series = [
        _line_series(x_col, y_col, label)
        if label == "7-day MA"
        else {
            "type": "scatter",
            "name": label,
            "encode": {"x": x_col, "y": y_col},
            "symbolSize": 4,
            "itemStyle": {"opacity": 0.5},
        }
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


# =============================================================================
# KPI Card Component
# =============================================================================


@st.fragment(parallel=True)
def kpi_card(label: str, metric_name: str) -> None:
    """Display a bordered KPI card: the latest 7-day average and its 4-week change.

    Like the metric cards, each KPI is a parallel fragment that loads its own
    (cached) data inside ``st.skeleton``.
    """
    with st.skeleton(height=KPI_HEIGHT):
        # The last 4 weeks (29 daily points) of the 7-day average: the value is
        # the latest point, the delta compares it to the first one.
        trend = load_metric(metric_name)["value_7d_ma"].tail(29)
        change = round(trend.iloc[-1] / trend.iloc[0] - 1, 3)
        st.metric(
            label,
            f"{trend.iloc[-1]:,.0f}",
            # String deltas like "+0.0%" still get an arrow; pass 0 when flat.
            f"{change:+.1%}" if change else 0,
            delta_description="vs. 4 weeks ago",
            help="7-day average",
            chart_data=trend,
            border=True,
        )


# =============================================================================
# Metric Card Component
# =============================================================================


@st.fragment(parallel=True)
def metric_card(
    title: str,
    metric_name: str,
    chart_type: str = "line",
) -> None:
    """Display a metric card with chart/table toggle and popover filters.

    The card is a parallel fragment: on a full app rerun every card loads its
    own data concurrently, and on widget interactions (view toggle, filters)
    only this card reruns. The card's data is loaded inside ``st.skeleton`` so
    the title and controls stay stable while the chart fills in.

    Parameters
    ----------
    title : str
        Card title.
    metric_name : str
        Key into ``METRIC_CONFIG`` used to load this card's data and namespace
        this card's widget state.
    chart_type : str
        One of ``"line"``, ``"area"``, ``"bar"``, ``"point"``.
    """
    chart_renderers = {
        "line": render_line_chart,
        "area": render_area_chart,
        "bar": render_bar_chart,
        "point": render_point_chart,
    }
    render_chart = chart_renderers.get(chart_type, render_line_chart)

    with st.container(border=True):
        # Header row with title, view toggle, and filters. Keep it outside the
        # skeleton so the controls stay put while the chart loads.
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
                key=f"{metric_name}_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", type="tertiary"):
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["Daily", "7-day MA"],
                    selection_mode="multi",
                    key=f"{metric_name}_lines",
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key=f"{metric_name}_time",
                )

        # Load this card's data and render inside a skeleton placeholder. The
        # skeleton shows while the (cached) loader runs, then clears once the
        # chart or table is rendered.
        with st.skeleton(height=CHART_HEIGHT):
            df = load_metric(metric_name)

            # Apply filters
            line_options = line_options or ["7-day MA"]
            filtered_df = filter_by_time_range(df, "ds", time_range or "All")

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
                    height=CHART_HEIGHT,
                    hide_index=True,
                    alt=f"{title} data",
                )
            elif y_cols:
                option = render_chart(filtered_df, "ds", y_cols, labels)
                # Describe the last series drawn: the smoother 7-day MA when shown.
                y_col = y_cols[-1]
                series = "7-day average" if y_col == "value_7d_ma" else "daily values"
                if chart_type == "bar":
                    series = f"weekly means of the {series}"
                st.echarts_chart(
                    option,
                    height=CHART_HEIGHT,
                    alt=describe_trend(
                        title, option["dataset"]["source"], "ds", y_col, series
                    ),
                )
            else:
                st.info("Select at least one line option.")


# =============================================================================
# Page Header Component
# =============================================================================


def render_page_header(title: str) -> None:
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

# Page header
render_page_header("# :material/monitoring: Metrics Dashboard")

# Each KPI and card loads its own data; as parallel fragments they load
# concurrently on the first run instead of blocking on each other.

# KPI row: horizontal containers wrap on narrow screens.
with st.container(horizontal=True):
    kpi_card("Active users", "users")
    kpi_card("Sessions", "sessions")
    kpi_card("Revenue", "revenue")
    kpi_card("Conversions", "conversions")

# Row 1: Users and Sessions
row1 = st.columns(2)

with row1[0]:
    metric_card("Active users", "users", chart_type="line")

with row1[1]:
    metric_card("Sessions", "sessions", chart_type="area")

# Row 2: Revenue and Conversions
row2 = st.columns(2)

with row2[0]:
    metric_card("Revenue", "revenue", chart_type="bar")

with row2[1]:
    metric_card("Conversions", "conversions", chart_type="point")
