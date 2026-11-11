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

"""Compute/resource dashboard template.

Demonstrates:
- Bordered metric cards in two columns above a full-width card
- ``@st.fragment(parallel=True)`` so cards load concurrently on full reruns and
  rerun in isolation on widget interactions
- ``st.skeleton`` slots that keep each chart's size while its data loads
- One ``@st.cache_data(ttl=...)`` loader, cached per dimension, that keeps data
  fresh and bounded
- ``st.echarts_chart`` line and stacked bar charts that animate when a filter
  changes, morph between chart types, and zoom with a ``dataZoom`` slider
- Popover filters for each metric card
- Chart/table view toggle
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- Percentage normalization toggle
- Multiple breakdown dimensions
- A reset button whose callback restores every card's controls

This template uses synthetic data. Replace ``load_credits()`` with your
actual data source (e.g., Snowflake queries, cloud APIs, etc.).
"""

import hashlib
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Compute usage",
    page_icon=":material/bolt:",
    layout="wide",
)


# =============================================================================
# Constants
# =============================================================================

TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
CHART_HEIGHT = 350
VIEWS = {"chart": ":material/show_chart:", "table": ":material/table:"}
CHARTS = {"line": ":material/show_chart: Line", "bar": ":material/bar_chart: Bar"}

# Each card's breakdown: its pills label, each category's base daily credits,
# and the categories and chart type it shows by default.
DIMENSIONS: dict[str, dict[str, Any]] = {
    "account_type": {
        "label": "Account types",
        "base_values": {"Paying": 8000, "Trial": 2000, "Internal": 1000},
        "default_selection": ["Paying"],
        "default_chart": "line",
    },
    "instance_type": {
        "label": "Instance types",
        "base_values": {
            "Standard": 5000,
            "High Memory": 3000,
            "High CPU": 2000,
            "GPU": 1500,
        },
        "default_selection": ["Standard", "High Memory", "High CPU", "GPU"],
        "default_chart": "line",
    },
    "region": {
        "label": "Regions",
        "base_values": {
            "us-west-2": 4000,
            "us-east-1": 3500,
            "eu-west-1": 2500,
            "ap-northeast-1": 1500,
        },
        "default_selection": ["us-west-2", "us-east-1", "eu-west-1", "ap-northeast-1"],
        "default_chart": "bar",
    },
}


# =============================================================================
# Synthetic Data Generation
# =============================================================================


def generate_time_series(
    category_name: str,
    start_date: date,
    end_date: date,
    base_values: dict[str, float],
) -> pd.DataFrame:
    """Generate synthetic time series data by category."""
    seed = int(hashlib.sha256(category_name.encode()).hexdigest(), 16) % 2**32
    rng = np.random.default_rng(seed)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    records = []

    for category, base in base_values.items():
        growth = rng.uniform(0.001, 0.005)

        for i, dt in enumerate(dates):
            trend = base * (1 + growth) ** i
            if dt.day_of_week >= 5:
                trend *= 0.4

            daily = max(0, trend * rng.uniform(0.8, 1.2))

            records.append(
                {
                    "ds": dt,
                    category_name: category,
                    "daily_credits": daily,
                }
            )

    df = pd.DataFrame(records)

    # Add 7-day moving average
    df["credits_7d_ma"] = df.groupby(category_name)["daily_credits"].transform(
        lambda x: x.rolling(7, min_periods=1).mean()
    )

    return df


@st.cache_data(ttl="1h", show_spinner="Loading credit usage...")
def load_credits(dimension: str) -> pd.DataFrame:
    """Load daily credits by one of the ``DIMENSIONS``.

    Each dimension is cached on its own, so the cards load concurrently as
    parallel fragments.
    """
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=730)  # 2 years
    base_values = DIMENSIONS[dimension]["base_values"]
    return generate_time_series(dimension, start_date, end_date, base_values)


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


def pivot_by_dimension(
    df: pd.DataFrame, x_col: str, y_col: str, dim_col: str, categories: list[str]
) -> pd.DataFrame:
    """Pivot long data to one column per category, in ``categories`` order.

    Each column becomes one ECharts series that reads it through ``encode``.
    """
    wide = df.pivot_table(index=x_col, columns=dim_col, values=y_col)
    wide = wide.reindex(columns=categories).rename_axis(columns=None)
    return wide.reset_index()


def describe_credits(
    source: pd.DataFrame, x_col: str, title: str, series: str, *, shares: bool
) -> str:
    """Summarize a chart's ``dataset.source`` frame for its ``alt`` text.

    Shares always stack to 100%, so they report the leader's latest share.
    """
    values = source.drop(columns=x_col)
    if values.empty:
        return f"{title} ({series}): no data"
    latest = values.iloc[-1]
    span = (
        f"{title} ({series}) from {source[x_col].iloc[0]:%Y-%m-%d} to "
        f"{source[x_col].iloc[-1]:%Y-%m-%d}"
    )
    if shares:
        return f"{span}: {latest.idxmax()} largest at {latest.max():.0f}%"
    totals = values.sum(axis=1)
    if totals.iloc[0]:
        trend = f"total {totals.iloc[-1] / totals.iloc[0] - 1:+.1%}"
    else:
        trend = f"latest total {totals.iloc[-1]:,.0f}"
    return f"{span}: {trend}, {latest.idxmax()} highest"


def _credits_option(
    wide: pd.DataFrame, series: list[dict[str, Any]], *, show_percent: bool = False
) -> dict[str, Any]:
    """Build an ECharts option for credit series that share a time x-axis.

    The dataframe goes in ``dataset.source``, so Streamlit sends it as Arrow.
    ``universalTransition`` on each series morphs the chart when the card
    switches between line and bar.
    """
    y_axis: dict[str, Any] = {"type": "value"}
    if show_percent:
        # ECharts label templates can't multiply values, so create_bar_chart
        # scales shares to 0-100 before they reach the chart.
        y_axis |= {"max": 100, "axisLabel": {"formatter": "{value}%"}}
    return {
        "dataset": {"source": wide},
        "legend": {},
        "tooltip": {
            "trigger": "axis",
            # Number formats use the same strings as ``st.metric``.
            "valueFormatter": "%.1f%%" if show_percent else "%,.0f",
        },
        "xAxis": {"type": "time"},
        "yAxis": y_axis,
        "dataZoom": [{"type": "inside"}, {"type": "slider"}],
        "series": [{**s, "universalTransition": True} for s in series],
    }


def create_line_chart(
    wide: pd.DataFrame, x_col: str, categories: list[str]
) -> dict[str, Any]:
    """Create a line chart with one line per category."""
    series = [
        {
            "type": "line",
            "name": category,
            "encode": {"x": x_col, "y": category},
            "showSymbol": False,
        }
        for category in categories
    ]
    return _credits_option(wide, series)


def create_bar_chart(
    wide: pd.DataFrame, x_col: str, categories: list[str], show_percent: bool = False
) -> dict[str, Any]:
    """Create a stacked bar chart, optionally as each category's daily share."""
    if show_percent:
        wide = wide.copy()
        values = wide[categories]
        wide[categories] = values.div(values.sum(axis=1), axis=0) * 100

    series = [
        {
            "type": "bar",
            "name": category,
            "stack": "credits",
            "encode": {"x": x_col, "y": category},
        }
        for category in categories
    ]
    return _credits_option(wide, series, show_percent=show_percent)


# =============================================================================
# Page Header Component
# =============================================================================


def reset_cards() -> None:
    """Restore every card's controls to their defaults."""
    # Assigning a widget's key in a callback also updates it in the browser.
    for dimension, config in DIMENSIONS.items():
        st.session_state[f"{dimension}_view"] = "chart"
        st.session_state[f"{dimension}_select"] = config["default_selection"]
        st.session_state[f"{dimension}_lines"] = ["7-day MA"]
        st.session_state[f"{dimension}_chart"] = config["default_chart"]
        st.session_state[f"{dimension}_pct"] = False
        st.session_state[f"{dimension}_time"] = "All"


def render_page_header(title: str, icon: str) -> None:
    """Render page header with title and reset button."""
    with st.container(
        horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
    ):
        st.title(title, icon=icon, anchor=False)
        st.button(
            "Reset",
            icon=":material/restart_alt:",
            type="tertiary",
            on_click=reset_cards,
        )


# =============================================================================
# Metric Card Component
# =============================================================================


@st.fragment(parallel=True)
def dimension_metric(title: str, dimension: str) -> None:
    """Metric card that breaks credits down by one of the ``DIMENSIONS``.

    The card is a parallel fragment: on a full app rerun each card loads its
    own data concurrently in a thread pool, and clicking a popover filter only
    reruns this card, not the whole page. Its controls must be in the fragment,
    so the card draws its own ``st.skeleton`` below them to hold the chart's size.
    Its widget keys start with ``dimension``, so ``reset_cards`` can reset them.
    """
    config = DIMENSIONS[dimension]
    options = list(config["base_values"])

    with st.container(border=True):
        with st.container(
            horizontal=True,
            horizontal_alignment="distribute",
            vertical_alignment="center",
        ):
            st.markdown(f"**{title}**")

            view_mode = st.segmented_control(
                "View",
                options=VIEWS.keys(),
                format_func=lambda view: VIEWS[view],
                default="chart",
                required=True,
                key=f"{dimension}_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", icon=":material/tune:", type="tertiary"):
                selected = st.pills(
                    config["label"],
                    options=options,
                    default=config["default_selection"],
                    selection_mode="multi",
                    key=f"{dimension}_select",
                )
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["7-day MA"],
                    selection_mode="multi",
                    key=f"{dimension}_lines",
                )
                chart_type = st.segmented_control(
                    "Chart type",
                    options=CHARTS.keys(),
                    format_func=lambda chart: CHARTS[chart],
                    default=config["default_chart"],
                    required=True,
                    key=f"{dimension}_chart",
                )
                show_percent = st.toggle(
                    "Show %",
                    value=False,
                    key=f"{dimension}_pct",
                    disabled=chart_type == "line",
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    required=True,
                    key=f"{dimension}_time",
                )

        # The chart replaces the skeleton. On a cache miss, the skeleton covers the
        # previous chart after half a second and shows the loader's spinner text.
        with st.skeleton(height=CHART_HEIGHT):
            data = load_credits(dimension)

            # Cleared pills fall back to the card's defaults, so the chart has a series.
            selected = selected or config["default_selection"]
            line_options = line_options or ["7-day MA"]
            filtered = data[data[dimension].isin(selected)]
            filtered = filter_by_time_range(filtered, "ds", time_range)

            y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"
            series = "7-day average" if "7-day MA" in line_options else "daily"

            if view_mode == "table":
                st.dataframe(
                    filtered,
                    height=CHART_HEIGHT,
                    hide_index=True,
                    alt=f"{title} data",
                )
            else:
                categories = [category for category in options if category in selected]
                wide = pivot_by_dimension(filtered, "ds", y_col, dimension, categories)
                shares = False
                if chart_type == "bar":
                    shares = show_percent
                    option = create_bar_chart(wide, "ds", categories, shares)
                    if shares:
                        series = f"{series} share"
                else:
                    option = create_line_chart(wide, "ds", categories)
                source = option["dataset"]["source"]
                st.echarts_chart(
                    option,
                    height=CHART_HEIGHT,
                    alt=describe_credits(source, "ds", title, series, shares=shares),
                )


# =============================================================================
# Page Layout
# =============================================================================

render_page_header("Compute usage", ":material/bolt:")

# Row 1: Two metrics
col1, col2 = st.columns(2)

with col1:
    dimension_metric("Credits by account type", "account_type")

with col2:
    dimension_metric("Credits by instance type", "instance_type")

# Row 2: One metric (full width for region breakdown)
dimension_metric("Credits by region", "region")
