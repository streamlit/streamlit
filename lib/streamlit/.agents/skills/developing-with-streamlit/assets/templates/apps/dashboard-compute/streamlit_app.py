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
Compute/Resource Dashboard Template

A resource consumption dashboard demonstrating:
- Multiple metric cards in a grid layout
- @st.fragment for independent widget updates
- Popover filters for each metric card
- Chart/table view toggle
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- Percentage normalization toggle
- Multiple breakdown dimensions

This template uses synthetic data. Replace generate_*_data()
with your actual data source (e.g., Snowflake queries, cloud APIs, etc.)
"""

from datetime import date, timedelta

import altair as alt
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
    np.random.seed(hash(category_name) % 2**32)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    records = []

    for category in categories:
        base = (
            base_values.get(category, 1000)
            if base_values
            else np.random.randint(500, 5000)
        )
        growth = np.random.uniform(0.001, 0.005)

        for i, dt in enumerate(dates):
            trend = base * (1 + growth) ** i
            if dt.dayofweek >= 5:
                trend *= 0.4

            daily = max(0, trend * np.random.uniform(0.8, 1.2))

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


@st.cache_data(ttl=3600)
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


@st.cache_data(ttl=3600)
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


@st.cache_data(ttl=3600)
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

    return df[df[x_col] >= min_date]


def create_line_chart(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    color_col: str,
    height: int,
    show_percent: bool = False,
) -> alt.Chart:
    """Create a line chart."""
    y_format = ".1%" if show_percent else ",.0f"

    return (
        alt.Chart(df)
        .mark_line()
        .encode(
            x=alt.X(f"{x_col}:T", title=None),
            y=alt.Y(f"{y_col}:Q", title="Credits", axis=alt.Axis(format=y_format)),
            color=alt.Color(f"{color_col}:N", legend=alt.Legend(orient="bottom")),
            tooltip=[
                alt.Tooltip(f"{x_col}:T", title="Date", format="%Y-%m-%d"),
                alt.Tooltip(
                    f"{color_col}:N", title=color_col.replace("_", " ").title()
                ),
                alt.Tooltip(f"{y_col}:Q", title="Credits", format=y_format),
            ],
        )
        .properties(height=height)
        .interactive()
    )


def create_bar_chart(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    color_col: str,
    height: int,
    show_percent: bool = False,
) -> alt.Chart:
    """Create a stacked bar chart."""
    y_format = ".1%" if show_percent else ",.0f"

    return (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X(f"{x_col}:T", title=None),
            y=alt.Y(
                f"{y_col}:Q",
                title="Credits",
                stack="normalize" if show_percent else True,
                axis=alt.Axis(format=y_format),
            ),
            color=alt.Color(f"{color_col}:N", legend=alt.Legend(orient="bottom")),
            tooltip=[
                alt.Tooltip(f"{x_col}:T", title="Date", format="%Y-%m-%d"),
                alt.Tooltip(f"{color_col}:N"),
                alt.Tooltip(f"{y_col}:Q", format=",.0f"),
            ],
        )
        .properties(height=height)
    )


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
# Metric Card Components (using @st.fragment)
# =============================================================================


@st.fragment
def account_type_metric():
    """Account type metric card with independent state."""
    data = load_account_type_data()

    with st.container(border=True):
        with st.container(
            horizontal=True,
            horizontal_alignment="distribute",
            vertical_alignment="center",
        ):
            st.markdown("**Credits by account type**")

            view_mode = st.segmented_control(
                "View",
                options=[":material/show_chart:", ":material/table:"],
                default=":material/show_chart:",
                key="acct_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", type="tertiary"):
                selected_types = st.pills(
                    "Account types",
                    options=ACCOUNT_TYPES,
                    default=["Paying"],
                    selection_mode="multi",
                    key="acct_types",
                )
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["7-day MA"],
                    selection_mode="multi",
                    key="acct_lines",
                )
                chart_type = st.segmented_control(
                    "Chart type",
                    options=[":material/show_chart: Line", ":material/bar_chart: Bar"],
                    default=":material/show_chart: Line",
                    key="acct_chart",
                )
                show_percent = st.toggle(
                    "Show %",
                    value=False,
                    key="acct_pct",
                    disabled="Line" in (chart_type or ""),
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key="acct_time",
                )

        # Filter data
        selected_types = selected_types or ["Paying"]
        line_options = line_options or ["7-day MA"]
        filtered = data[data["account_type"].isin(selected_types)]
        filtered = filter_by_time_range(filtered, "ds", time_range)

        # Determine y column
        y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"

        if "table" in (view_mode or ""):
            st.dataframe(
                filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True
            )
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(
                    filtered, "ds", y_col, "account_type", CHART_HEIGHT, show_percent
                ),
                use_container_width=True,
            )
        else:
            st.altair_chart(
                create_line_chart(filtered, "ds", y_col, "account_type", CHART_HEIGHT),
                use_container_width=True,
            )


@st.fragment
def instance_type_metric():
    """Instance type metric card with independent state."""
    data = load_instance_type_data()

    with st.container(border=True):
        with st.container(
            horizontal=True,
            horizontal_alignment="distribute",
            vertical_alignment="center",
        ):
            st.markdown("**Credits by instance type**")

            view_mode = st.segmented_control(
                "View",
                options=[":material/show_chart:", ":material/table:"],
                default=":material/show_chart:",
                key="inst_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", type="tertiary"):
                selected_types = st.pills(
                    "Instance types",
                    options=INSTANCE_TYPES,
                    default=INSTANCE_TYPES,
                    selection_mode="multi",
                    key="inst_types",
                )
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["7-day MA"],
                    selection_mode="multi",
                    key="inst_lines",
                )
                chart_type = st.segmented_control(
                    "Chart type",
                    options=[":material/show_chart: Line", ":material/bar_chart: Bar"],
                    default=":material/show_chart: Line",
                    key="inst_chart",
                )
                show_percent = st.toggle(
                    "Show %",
                    value=False,
                    key="inst_pct",
                    disabled="Line" in (chart_type or ""),
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key="inst_time",
                )

        # Filter data
        selected_types = selected_types or INSTANCE_TYPES
        line_options = line_options or ["7-day MA"]
        filtered = data[data["instance_type"].isin(selected_types)]
        filtered = filter_by_time_range(filtered, "ds", time_range)

        y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"

        if "table" in (view_mode or ""):
            st.dataframe(
                filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True
            )
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(
                    filtered, "ds", y_col, "instance_type", CHART_HEIGHT, show_percent
                ),
                use_container_width=True,
            )
        else:
            st.altair_chart(
                create_line_chart(filtered, "ds", y_col, "instance_type", CHART_HEIGHT),
                use_container_width=True,
            )


@st.fragment
def region_metric():
    """Region metric card with independent state."""
    data = load_region_data()

    with st.container(border=True):
        with st.container(
            horizontal=True,
            horizontal_alignment="distribute",
            vertical_alignment="center",
        ):
            st.markdown("**Credits by region**")

            view_mode = st.segmented_control(
                "View",
                options=[":material/show_chart:", ":material/table:"],
                default=":material/show_chart:",
                key="region_view",
                label_visibility="collapsed",
            )

            with st.popover("Filters", type="tertiary"):
                selected_regions = st.pills(
                    "Regions",
                    options=REGIONS,
                    default=REGIONS,
                    selection_mode="multi",
                    key="region_select",
                )
                line_options = st.pills(
                    "Lines",
                    options=["Daily", "7-day MA"],
                    default=["7-day MA"],
                    selection_mode="multi",
                    key="region_lines",
                )
                chart_type = st.segmented_control(
                    "Chart type",
                    options=[":material/show_chart: Line", ":material/bar_chart: Bar"],
                    default=":material/bar_chart: Bar",
                    key="region_chart",
                )
                show_percent = st.toggle(
                    "Show %",
                    value=False,
                    key="region_pct",
                    disabled="Line" in (chart_type or ""),
                )
                time_range = st.segmented_control(
                    "Time range",
                    options=TIME_RANGES,
                    default="All",
                    key="region_time",
                )

        # Filter data
        selected_regions = selected_regions or REGIONS
        line_options = line_options or ["7-day MA"]
        filtered = data[data["region"].isin(selected_regions)]
        filtered = filter_by_time_range(filtered, "ds", time_range)

        y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"

        if "table" in (view_mode or ""):
            st.dataframe(
                filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True
            )
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(
                    filtered, "ds", y_col, "region", CHART_HEIGHT, show_percent
                ),
                use_container_width=True,
            )
        else:
            st.altair_chart(
                create_line_chart(filtered, "ds", y_col, "region", CHART_HEIGHT),
                use_container_width=True,
            )


# =============================================================================
# Page Layout
# =============================================================================

render_page_header("# :material/bolt: Compute Dashboard")

# Row 1: Two metrics
col1, col2 = st.columns(2)

with col1:
    account_type_metric()

with col2:
    instance_type_metric()

# Row 2: One metric (full width for region breakdown)
region_metric()
