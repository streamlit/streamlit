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
Compute/Resource Dashboard Template (Snowflake Edition)

A resource consumption dashboard demonstrating:
- Snowflake connection via st.connection("snowflake")
- Parameterized queries for safe data loading
- Multiple metric cards in a grid layout
- @st.fragment for independent widget updates
- Popover filters for each metric card
- Chart/table view toggle
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)

This template uses synthetic data generated in Snowflake. Replace the
synthetic queries with your actual table queries in production.
"""

import re
from datetime import date, timedelta

import altair as alt
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Compute Dashboard (Snowflake)",
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

# Base values for synthetic data generation
BASE_VALUES = {
    "account_type": {"Paying": 8000, "Trial": 2000, "Internal": 1000},
    "instance_type": {"Standard": 5000, "High Memory": 3000, "High CPU": 2000, "GPU": 1500},
    "region": {"us-west-2": 4000, "us-east-1": 3500, "eu-west-1": 2500, "ap-northeast-1": 1500},
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


# =============================================================================
# IMPORTANT: Use parameterized queries in production
# =============================================================================
#
# This demo uses synthetic data generated via SQL. In production, always use
# parameterized queries to prevent SQL injection:
#
#     # GOOD: Parameterized query (safe)
#     conn = st.connection("snowflake")
#     df = conn.query(
#         "SELECT * FROM metrics WHERE category = :category AND ds >= :start_date",
#         params={"category": selected_category, "start_date": start_date}
#     )
#
#     # BAD: f-string interpolation (SQL injection risk)
#     df = conn.query(f"SELECT * FROM metrics WHERE category = '{user_input}'")
#
# The synthetic data generation below uses f-strings only because the values
# are hardcoded constants, not user input. Never use f-strings with user input.

def _validate_sql_identifier(name: str) -> str:
    """Validate that a string is a safe SQL identifier (letters, digits, underscores).

    Raises ValueError if the name contains unexpected characters. This prevents
    SQL injection if the function is ever modified to accept dynamic input.
    """
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


def build_synthetic_query(category_col: str, categories: list[str], base_values: dict[str, int]) -> str:
    """Build SQL query for synthetic data.

    WARNING: This function uses f-strings for demo purposes only.
    The categories are hardcoded constants defined in this file, not user input.
    In production, always use parameterized queries with conn.query(..., params={}).
    """
    # Validate the column name used as a SQL identifier (appears unquoted in SQL)
    _validate_sql_identifier(category_col)

    # Category values appear as string literals in SQL VALUES clause.
    # Escape single quotes to prevent SQL injection.
    safe_categories = [cat.replace("'", "''") for cat in categories]

    # Build VALUES clause for categories with their base values
    values_rows = ", ".join(
        f"('{cat}', {base_values.get(orig, 1000)})"
        for cat, orig in zip(safe_categories, categories)
    )

    return f"""
    WITH categories AS (
        SELECT column1 AS category, column2 AS base_val
        FROM VALUES {values_rows}
    ),
    date_series AS (
        SELECT DATEADD(day, -seq4(), CURRENT_DATE() - 1) AS ds
        FROM TABLE(GENERATOR(ROWCOUNT => 730))
    ),
    base_data AS (
        SELECT
            ds,
            category,
            base_val * POWER(1.002, DATEDIFF(day, DATEADD(year, -2, CURRENT_DATE()), ds)) AS base_trend,
            CASE WHEN DAYOFWEEK(ds) IN (0, 6) THEN 0.4 ELSE 1.0 END AS seasonality,
            1 + (RANDOM() / 10000000000000000000.0 - 0.5) * 0.4 AS noise
        FROM date_series
        CROSS JOIN categories
        WHERE ds >= DATEADD(year, -2, CURRENT_DATE())
    )
    SELECT
        ds,
        category AS {category_col},
        GREATEST(0, ROUND(base_trend * seasonality * noise, 2)) AS daily_credits,
        ROUND(AVG(GREATEST(0, base_trend * seasonality * noise)) OVER (
            PARTITION BY category
            ORDER BY ds ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ), 2) AS credits_7d_ma
    FROM base_data
    ORDER BY ds, {category_col}
    """


@st.cache_data(ttl=3600, show_spinner="Loading account type data...")
def load_account_type_data() -> pd.DataFrame:
    """Load credits by account type from Snowflake."""
    conn = get_snowflake_connection()
    query = build_synthetic_query("account_type", ACCOUNT_TYPES, BASE_VALUES["account_type"])
    df = conn.query(query)
    df.columns = df.columns.str.lower()
    return df


@st.cache_data(ttl=3600, show_spinner="Loading instance type data...")
def load_instance_type_data() -> pd.DataFrame:
    """Load credits by instance type from Snowflake."""
    conn = get_snowflake_connection()
    query = build_synthetic_query("instance_type", INSTANCE_TYPES, BASE_VALUES["instance_type"])
    df = conn.query(query)
    df.columns = df.columns.str.lower()
    return df


@st.cache_data(ttl=3600, show_spinner="Loading region data...")
def load_region_data() -> pd.DataFrame:
    """Load credits by region from Snowflake."""
    conn = get_snowflake_connection()
    query = build_synthetic_query("region", REGIONS, BASE_VALUES["region"])
    df = conn.query(query)
    df.columns = df.columns.str.lower()
    return df


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
                alt.Tooltip(f"{color_col}:N", title=color_col.replace("_", " ").title()),
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
        with st.container(horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"):
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
                    "Show %", value=False, key="acct_pct",
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

        y_col = "credits_7d_ma" if "7-day MA" in line_options else "daily_credits"

        if "table" in (view_mode or ""):
            st.dataframe(filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True)
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(filtered, "ds", y_col, "account_type", CHART_HEIGHT, show_percent),
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
        with st.container(horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"):
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
                    "Show %", value=False, key="inst_pct",
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
            st.dataframe(filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True)
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(filtered, "ds", y_col, "instance_type", CHART_HEIGHT, show_percent),
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
        with st.container(horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"):
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
                    "Show %", value=False, key="region_pct",
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
            st.dataframe(filtered, use_container_width=True, height=CHART_HEIGHT, hide_index=True)
        elif "Bar" in (chart_type or ""):
            st.altair_chart(
                create_bar_chart(filtered, "ds", y_col, "region", CHART_HEIGHT, show_percent),
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

# Check Snowflake connection
get_snowflake_connection()

render_page_header("# :material/bolt: Compute Dashboard")
st.caption(":material/cloud: Powered by Snowflake")

# Row 1: Two metrics
col1, col2 = st.columns(2)

with col1:
    account_type_metric()

with col2:
    instance_type_metric()

# Row 2: One metric (full width for region breakdown)
region_metric()
