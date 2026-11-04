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
- Multiple metric cards in a grid layout
- ``@st.fragment(parallel=True)`` so cards load concurrently on full reruns and
  rerun in isolation on widget interactions
- ``st.skeleton`` placeholders while each card's data loads
- ``@st.cache_data(ttl=...)`` loaders that keep data fresh and bounded
- ``st.echarts_chart`` line and stacked bar charts that animate when a filter
  changes, morph between chart types, and zoom with a ``dataZoom`` slider
- Popover filters for each metric card
- Chart/table view toggle
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- Percentage normalization toggle
- Multiple breakdown dimensions

This template uses synthetic data. Replace ``generate_*_data()`` with your
actual data source (e.g., Snowflake queries, cloud APIs, etc.).
"""

import hashlib
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Compute Dashboard",
    page_icon=":material/bolt:",
    layout="wide",
)


# =============================================================================
# Constants
# =============================================================================

TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
ACCOUNT_TYPES = ["Paying", "Trial", "Internal"]
INSTANCE_TYPES = ["Standard", "High Memory", "High CPU", "GPU"]
REGIONS = ["us-west-2", "us-east-1", "eu-west-1", "ap-northeast-1"]
CHART_HEIGHT = 350


# =============================================================================
# Synthetic Data Generation
# =============================================================================


def generate_time_series(
    categories: list[str],
    category_name: str,
    start_date: date,
    end_date: date,
    base_values: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Generate synthetic time series data by category."""
    seed = int(hashlib.sha256(category_name.encode()).hexdigest(), 16) % 2**32
    rng = np.random.default_rng(seed)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    records = []

    for category in categories:
        base = (
            base_values.get(category, 1000) if base_values else rng.integers(500, 5000)
        )
        growth = rng.uniform(0.001, 0.005)

        for i, dt in enumerate(dates):
            trend = base * (1 + growth) ** i
            if dt.dayofweek >= 5:
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


@st.cache_data(ttl="1h", show_spinner=False)
def load_account_type_data() -> pd.DataFrame:
    """Load credits by account type."""
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=730)  # 2 years
    return generate_time_series(
        ACCOUNT_TYPES,
        "account_type",
        start_date,
        end_date,
        base_values={"Paying": 8000, "Trial": 2000, "Internal": 1000},
    )


@st.cache_data(ttl="1h", show_spinner=False)
def load_instance_type_data() -> pd.DataFrame:
    """Load credits by instance type."""
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=730)
    return generate_time_series(
        INSTANCE_TYPES,
        "instance_type",
        start_date,
        end_date,
        base_values={
            "Standard": 5000,
            "High Memory": 3000,
            "High CPU": 2000,
            "GPU": 1500,
        },
    )


@st.cache_data(ttl="1h", show_spinner=False)
def load_region_data() -> pd.DataFrame:
    """Load credits by region."""
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=730)
    return generate_time_series(
        REGIONS,
        "region",
        start_date,
        end_date,
        base_values={
            "us-west-2": 4000,
            "us-east-1": 3500,
            "eu-west-1": 2500,
            "ap-northeast-1": 1500,
        },
    )


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
# Metric Card Component
# =============================================================================


@st.fragment(parallel=True)
def dimension_metric(
    *,
    title: str,
    loader: Callable[[], pd.DataFrame],
    dim_col: str,
    options: list[str],
    options_label: str,
    default_selection: list[str],
    default_chart: str = "Line",
    key_prefix: str,
) -> None:
    """Metric card broken down by a single dimension, with independent state.

    The card is a parallel fragment: on a full app rerun each card loads its
    own data concurrently in a thread pool, and clicking a popover filter only
    reruns this card, not the whole page. Data is loaded inside ``st.skeleton``
    so the controls stay stable while the chart fills in.

    Parameters
    ----------
    title : str
        Card header text.
    loader : Callable[[], pd.DataFrame]
        Cached loader returning a frame with ``ds``, ``daily_credits``,
        ``credits_7d_ma``, and ``dim_col``. Called inside the fragment so the
        load runs concurrently with the other cards.
    dim_col : str
        Column name to split series on (e.g. ``"account_type"``).
    options : list[str]
        All possible values of ``dim_col``.
    options_label : str
        Label shown above the dimension selector pills.
    default_selection : list[str]
        Subset of ``options`` pre-selected when the card first renders.
    default_chart : str
        ``"Line"`` or ``"Bar"``.
    key_prefix : str
        Unique prefix used for every widget key inside the card.
    """
    chart_default = (
        ":material/bar_chart: Bar"
        if default_chart == "Bar"
        else ":material/show_chart: Line"
    )

    with st.container(border=True):
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
                selected = st.pills(
                    options_label,
                    options=options,
                    default=default_selection,
                    selection_mode="multi",
                    key=f"{key_prefix}_select",
                )
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["7-day MA"],
                    selection_mode="multi",
                    key=f"{key_prefix}_lines",
                )
                chart_type = st.segmented_control(
                    "Chart type",
                    options=[":material/show_chart: Line", ":material/bar_chart: Bar"],
                    default=chart_default,
                    key=f"{key_prefix}_chart",
                )
                show_percent = st.toggle(
                    "Show %",
                    value=False,
                    key=f"{key_prefix}_pct",
                    disabled="Line" in (chart_type or ""),
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key=f"{key_prefix}_time",
                )

        # Load this card's data and render inside a skeleton placeholder so each
        # card fills in as soon as its own (cached) data is ready.
        with st.skeleton(height=CHART_HEIGHT):
            data = loader()

            selected = selected or default_selection
            line_options = line_options or ["7-day MA"]
            filtered = data[data[dim_col].isin(selected)]
            filtered = filter_by_time_range(filtered, "ds", time_range or "All")

            y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"
            series = "7-day average" if "7-day MA" in line_options else "daily"

            if "table" in (view_mode or ""):
                st.dataframe(
                    filtered,
                    height=CHART_HEIGHT,
                    hide_index=True,
                    alt=f"{title} data",
                )
            else:
                categories = [category for category in options if category in selected]
                wide = pivot_by_dimension(filtered, "ds", y_col, dim_col, categories)
                shares = False
                if "Bar" in (chart_type or ""):
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

render_page_header("# :material/bolt: Compute Dashboard")

# Row 1: Two metrics
col1, col2 = st.columns(2)

with col1:
    dimension_metric(
        title="Credits by account type",
        loader=load_account_type_data,
        dim_col="account_type",
        options=ACCOUNT_TYPES,
        options_label="Account types",
        default_selection=["Paying"],
        default_chart="Line",
        key_prefix="acct",
    )

with col2:
    dimension_metric(
        title="Credits by instance type",
        loader=load_instance_type_data,
        dim_col="instance_type",
        options=INSTANCE_TYPES,
        options_label="Instance types",
        default_selection=INSTANCE_TYPES,
        default_chart="Line",
        key_prefix="inst",
    )

# Row 2: One metric (full width for region breakdown)
dimension_metric(
    title="Credits by region",
    loader=load_region_data,
    dim_col="region",
    options=REGIONS,
    options_label="Regions",
    default_selection=REGIONS,
    default_chart="Bar",
    key_prefix="region",
)
