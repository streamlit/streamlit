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

"""API usage dashboard template.

Demonstrates:
- Segmented control for category selection, bound to the URL
  with ``bind="query-params"``
- Multiselect for endpoint filtering
- Starter kits / presets for quick selection
- Bordered container cards with bold labels
- Time series visualization with normalization
- Metric cards with numeric values formatted by ``format=`` and 28-day deltas
- Rolling average options
- ``@st.cache_data(ttl=...)`` loader to keep data fresh and bounded
- Conditional rendering: the collapsed "Raw data" expander only computes and
  sends its dataframe to the browser when it is open (``on_change="rerun"``)

This template uses synthetic data. Replace ``generate_api_data()`` with your
actual data source (e.g., Snowflake queries, APIs, etc.).
"""

from datetime import date, timedelta

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="API usage",
    page_icon=":material/api:",
    layout="wide",
)


# =============================================================================
# Synthetic Data Generation (Replace with your data source)
# =============================================================================

# API categories and their endpoints
API_CATEGORIES = {
    "Users": [
        "/users",
        "/users/{id}",
        "/users/me",
        "/users/search",
        "/users/bulk",
        "/users/export",
    ],
    "Orders": [
        "/orders",
        "/orders/{id}",
        "/orders/create",
        "/orders/cancel",
        "/orders/refund",
        "/orders/status",
    ],
    "Products": [
        "/products",
        "/products/{id}",
        "/products/search",
        "/products/categories",
        "/products/inventory",
    ],
    "Analytics": [
        "/analytics/events",
        "/analytics/metrics",
        "/analytics/reports",
        "/analytics/dashboards",
    ],
}

# Starter kits - predefined endpoint selections
STARTER_KITS = {
    "Core CRUD": ["/users", "/users/{id}", "/orders", "/orders/{id}"],
    "Search": ["/users/search", "/products/search", "/products/categories"],
    "Analytics": ["/analytics/events", "/analytics/metrics", "/analytics/reports"],
    "High volume": ["/users", "/products", "/orders", "/analytics/events"],
}

ROLLING_OPTIONS = {"Raw": 1, "7-day average": 7, "28-day average": 28}


def generate_api_data(
    endpoints: list[str],
    start_date: date,
    end_date: date,
) -> pd.DataFrame:
    """Generate synthetic API usage data.

    Replace this function with your actual data source.
    """
    rng = np.random.default_rng(42)

    dates = pd.date_range(start=start_date, end=end_date, freq="D")
    records = []

    for endpoint in endpoints:
        # Each endpoint has different base traffic and growth
        base = rng.integers(1000, 50000)
        growth = rng.uniform(0.0005, 0.003)

        for i, dt in enumerate(dates):
            # Base trend with growth
            trend = base * (1 + growth) ** i

            # Weekly seasonality (lower on weekends)
            if dt.day_of_week >= 5:
                trend *= 0.4

            # Random noise
            value = trend * rng.uniform(0.85, 1.15)

            records.append(
                {
                    "date": dt,
                    "endpoint": endpoint,
                    "request_count": int(value),
                }
            )

    return pd.DataFrame(records)


@st.cache_data(ttl="1h", show_spinner="Loading API usage data...")
def load_api_data() -> pd.DataFrame:
    """Load all API usage data (cached). Replace with your data source."""
    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=365)

    all_endpoints = [e for endpoints in API_CATEGORIES.values() for e in endpoints]
    return generate_api_data(all_endpoints, start_date, end_date)


def apply_rolling_average(df: pd.DataFrame, window: int) -> pd.DataFrame:
    """Apply rolling average to request data."""
    if window == 1:
        return df

    return df.assign(
        request_count=df.groupby("endpoint")["request_count"].transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )
    )


def normalize_data(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize request counts to percentages (share of total per day)."""
    daily_totals = df.groupby("date")["request_count"].transform("sum")
    return df.assign(request_count=df["request_count"] / daily_totals)


def calculate_delta(df: pd.DataFrame, endpoint: str) -> tuple[float, float | None]:
    """Calculate 28-day delta for an endpoint."""
    endpoint_data = df[df["endpoint"] == endpoint].sort_values("date")

    if len(endpoint_data) < 2:
        return endpoint_data["request_count"].iloc[-1], None

    latest = endpoint_data["request_count"].iloc[-1]

    if len(endpoint_data) > 28:
        previous = endpoint_data["request_count"].iloc[-29]
    else:
        previous = endpoint_data["request_count"].iloc[0]

    delta = latest - previous
    return latest, delta


# =============================================================================
# Page Layout
# =============================================================================

st.title("API usage", icon=":material/api:")
st.caption("Select an API category to explore endpoint usage over time.")

category = st.segmented_control(
    "Category",
    options=list(API_CATEGORIES),
    default="Users",
    required=True,
    key="category",
    bind="query-params",
    label_visibility="collapsed",
)

st.subheader(f"{category} endpoints")

# Layout: filters on left, chart on right
filter_col, chart_col = st.columns([1, 2])

with filter_col:
    with st.container(border=True):
        st.markdown("**Metric**")
        rolling_label = st.segmented_control(
            "Time aggregation",
            list(ROLLING_OPTIONS),
            default="7-day average",
            required=True,
            label_visibility="collapsed",
        )
        normalize = st.toggle(
            "Normalize",
            value=False,
            help="Normalize to show percentage share of total requests",
        )

    with st.container(border=True):
        st.markdown("**Starter kits**")
        starter_kit = st.pills(
            "Quick select",
            options=list(STARTER_KITS),
            label_visibility="collapsed",
        )

    available_endpoints = API_CATEGORIES[category]
    if starter_kit:
        default_endpoints = [
            e for e in STARTER_KITS[starter_kit] if e in available_endpoints
        ]
    else:
        default_endpoints = available_endpoints[:4]  # First 4 endpoints

    # The multiselect has no key, so a new default from a starter kit resets
    # its selection.
    with st.container(border=True):
        st.markdown("**Endpoints**")
        selected_endpoints = st.multiselect(
            "Select endpoints",
            options=available_endpoints,
            default=default_endpoints,
            label_visibility="collapsed",
        )

if not selected_endpoints:
    with chart_col:
        st.info(
            "Select at least one endpoint to view usage data.", icon=":material/info:"
        )
    st.stop()

# Load the data after the header and filters, so they paint first.
raw_data = load_api_data()
filtered_data = raw_data[raw_data["endpoint"].isin(selected_endpoints)]
filtered_data = apply_rolling_average(filtered_data, ROLLING_OPTIONS[rolling_label])

if normalize:
    filtered_data = normalize_data(filtered_data)

with chart_col:
    with st.container(border=True):
        # The comparison is named once here: a delta_description on each
        # metric makes four cards too wide for one row in this column.
        st.markdown("**Latest numbers** :gray[vs. 28 days ago]")
        with st.container(horizontal=True):
            for endpoint in selected_endpoints:
                latest, delta = calculate_delta(filtered_data, endpoint)
                st.metric(
                    endpoint,
                    latest,
                    delta,
                    format="percent" if normalize else "%,.0f",
                    border=True,
                )

    with st.container(border=True):
        st.markdown("**Time series**")
        y_format = ".1%" if normalize else ",.0f"
        y_title = "Share of requests" if normalize else "Request count"

        chart = (
            alt.Chart(filtered_data)
            .mark_line()
            .encode(
                x=alt.X("date:T", title="Date"),
                y=alt.Y(
                    "request_count:Q", title=y_title, axis=alt.Axis(format=y_format)
                ),
                color=alt.Color(
                    "endpoint:N", title="Endpoint", legend=alt.Legend(orient="bottom")
                ),
                tooltip=[
                    alt.Tooltip("date:T", title="Date", format="%Y-%m-%d"),
                    alt.Tooltip("endpoint:N", title="Endpoint"),
                    alt.Tooltip("request_count:Q", title="Requests", format=y_format),
                ],
            )
            .interactive()
        )

        st.altair_chart(
            chart,
            height=450,
            alt=(
                f"{rolling_label} share of requests by endpoint over time"
                if normalize
                else f"{rolling_label} request count by endpoint over time"
            ),
        )

# Raw data section. The expander is collapsed by default, so guard the
# dataframe behind `.open` (enabled by `on_change="rerun"`) to avoid building
# and sending it to the browser until the user actually opens the section.
raw_data_section = st.expander(
    "Raw data", expanded=False, icon=":material/table:", on_change="rerun"
)
if raw_data_section.open:
    with raw_data_section:
        st.dataframe(
            filtered_data,
            hide_index=True,
            column_config={
                "request_count": st.column_config.NumberColumn(
                    "Requests", format="percent" if normalize else None
                )
            },
            alt="Filtered endpoint request data",
        )
