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
- ``st.echarts_chart`` time series with normalization and a zoom slider
- Metric cards with numeric values formatted by ``format=`` and 28-day deltas
- Rolling average options
- ``@st.cache_data(ttl=..., refresh_mode="background")`` loader that keeps
  data fresh without blocking on a refresh
- Layout-first loading: the main script draws each card's frame, title, and
  ``st.skeleton``, and calls the card's ``@st.fragment(parallel=True)`` inside
  it, so both cards load concurrently at their final size
- Conditional rendering: the collapsed "Raw data" expander only computes and
  sends its dataframe to the browser when it is open (``on_change="rerun"``),
  and as a fragment, opening it reruns only that section

This template uses synthetic data. Replace ``generate_api_data()`` with your
actual data source (e.g., Snowflake queries, APIs, etc.).
"""

import time
from datetime import date, timedelta

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

# Simulates warehouse latency on the first (uncached) load so the skeletons
# are visible. Set to 0 when you connect a real data source.
SIMULATED_LATENCY_S = 0.8

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
# Card heights, shared with the skeletons that hold their slots while loading.
METRIC_HEIGHT = 136
CHART_HEIGHT = 450


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


@st.cache_data(
    ttl="1h", refresh_mode="background", show_spinner="Loading API usage data..."
)
def load_api_data() -> pd.DataFrame:
    """Load all API usage data (cached). Replace with your data source."""
    time.sleep(SIMULATED_LATENCY_S)
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


def load_filtered(
    endpoints: list[str], rolling_label: str, normalize: bool
) -> pd.DataFrame:
    """Load the usage data and apply the page's filters.

    Only the load is cached; the filters are cheap, so every card applies them
    to the cached data itself.
    """
    df = load_api_data()
    df = df[df["endpoint"].isin(endpoints)]
    df = apply_rolling_average(df, ROLLING_OPTIONS[rolling_label])
    return normalize_data(df) if normalize else df


# =============================================================================
# Cards (parallel fragments, so they load concurrently on a full rerun)
# =============================================================================


@st.fragment(parallel=True)
def latest_numbers(endpoints: list[str], rolling_label: str, normalize: bool) -> None:
    """Each endpoint's latest value and its change over 28 days.

    The page calls this inside ``st.skeleton``, and the metric row replaces it.
    """
    data = load_filtered(endpoints, rolling_label, normalize)
    with st.container(horizontal=True):
        for endpoint in endpoints:
            latest, delta = calculate_delta(data, endpoint)
            st.metric(
                endpoint,
                latest,
                delta,
                format="percent" if normalize else "%,.0f",
                border=True,
                height=METRIC_HEIGHT,
            )


@st.fragment(parallel=True)
def time_series(endpoints: list[str], rolling_label: str, normalize: bool) -> None:
    """One line per endpoint. The page calls this inside ``st.skeleton``."""
    data = load_filtered(endpoints, rolling_label, normalize)
    # Pivot to one column per endpoint, in the metric cards' order, so each
    # line series can read its own dataset column.
    wide = data.pivot_table(
        index="date", columns="endpoint", values="request_count", aggfunc="sum"
    )[endpoints]
    if normalize:
        # Plot percentage points so the axis labels can show a "%" suffix.
        wide *= 100
    option = {
        "dataset": {"source": wide.reset_index()},
        "legend": {"type": "scroll"},
        "tooltip": {
            "trigger": "axis",
            "valueFormatter": "%.1f%%" if normalize else "%,.0f",
        },
        "xAxis": {"type": "time"},
        "yAxis": {
            "type": "value",
            "axisLabel": {"formatter": "{value}%"} if normalize else {},
        },
        "dataZoom": [{"type": "inside"}, {"type": "slider"}],
        "series": [
            {
                "type": "line",
                "name": endpoint,
                "encode": {"x": "date", "y": endpoint},
                "showSymbol": False,
            }
            for endpoint in wide.columns
        ],
    }
    st.echarts_chart(
        option,
        height=CHART_HEIGHT,
        alt=(
            f"{rolling_label} share of requests by endpoint over time"
            if normalize
            else f"{rolling_label} request count by endpoint over time"
        ),
    )


@st.fragment
def raw_data(endpoints: list[str], rolling_label: str, normalize: bool) -> None:
    """A collapsed "Raw data" section that only builds its table when open.

    ``on_change="rerun"`` makes ``.open`` available. In a fragment, opening or
    closing the section reruns only this section, not the cards above it.
    """
    section = st.expander(
        "Raw data", expanded=False, icon=":material/table:", on_change="rerun"
    )
    if section.open:
        with section:
            st.dataframe(
                load_filtered(endpoints, rolling_label, normalize),
                hide_index=True,
                column_config={
                    "request_count": st.column_config.NumberColumn(
                        "Requests", format="percent" if normalize else None
                    )
                },
                alt="Filtered endpoint request data",
            )


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

# Layout first: the main script draws each card's frame, title, and skeleton,
# so the page has its final layout before any data loads. Each card's
# fragment replaces its skeleton when its data arrives.
with chart_col:
    with st.container(border=True):
        # The comparison is named once here: a delta_description on each
        # metric makes four cards too wide for one row in this column.
        st.markdown("**Latest numbers** :gray[vs. 28 days ago]")
        with st.skeleton(height=METRIC_HEIGHT):
            latest_numbers(selected_endpoints, rolling_label, normalize)

    with st.container(border=True):
        st.markdown("**Time series**")
        with st.skeleton(height=CHART_HEIGHT):
            time_series(selected_endpoints, rolling_label, normalize)

raw_data(selected_endpoints, rolling_label, normalize)
