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

"""Company analytics dashboard template.

Demonstrates:
- A toolbar of filters (ranking, time window, and account type pills) bound
  to the URL with ``bind="query-params"``, so every view is shareable
- Interactive dataframe with sparkline and colored badge columns
- Growth score calculation
- A ``ButtonColumn`` that opens a company drawer
  (``@st.dialog(position="right")``) with badges, metrics, and charts
- ``@st.cache_data(ttl=...)`` loader with a custom spinner message

This template uses synthetic data. Replace ``generate_company_data()`` with
your actual data source (e.g., Snowflake queries, CRM APIs, etc.).
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Company analytics",
    page_icon=":material/business:",
    layout="wide",
)


# =============================================================================
# Synthetic Data Generation (Replace with your data source)
# =============================================================================

COMPANY_NAMES = [
    "Acme Corp",
    "TechFlow Inc",
    "DataDriven Co",
    "CloudFirst Ltd",
    "InnovateTech",
    "ScaleUp Systems",
    "PrimeData Inc",
    "FutureStack",
    "ByteWise Corp",
    "StreamLine Co",
    "Quantum Labs",
    "NexGen Solutions",
    "AlphaMetrics",
    "BetaAnalytics",
    "GammaInsights",
    "DeltaData",
    "OmegaTech",
    "SigmaSoft",
    "ThetaCloud",
    "ZetaDigital",
]

ACCOUNT_TYPES = ["Enterprise", "Growth", "Startup", "Trial", "Internal"]
REGIONS = ["North America", "EMEA", "APAC", "LATAM"]
SEGMENTS = ["Technology", "Finance", "Healthcare", "Retail", "Manufacturing"]

# Ranking labels by the sort key that ``aggregate_companies`` accepts. A bound
# widget stores its labels in the URL, so they stay plain text.
RANKINGS = {
    "total_credits": "Top spenders",
    "growth_asc": "Top shrinkers",
    "growth_desc": "Top gainers",
}
TIME_WINDOWS = {"All time": None, "Last 28 days": 28, "Last 7 days": 7}
VIEW_ACTION = ":material/visibility: View"


def generate_company_data(days: int = 90) -> pd.DataFrame:
    """Generate synthetic company usage data.

    Replace this function with your actual data source. Caching happens in
    ``load_company_data`` so the data is fetched once and reused across reruns.
    """
    rng = np.random.default_rng(42)

    end_date = date.today() - timedelta(days=1)
    start_date = end_date - timedelta(days=days)
    dates = pd.date_range(start=start_date, end=end_date, freq="D")

    records = []

    for company in COMPANY_NAMES:
        # Assign static attributes
        account_type = rng.choice(ACCOUNT_TYPES, p=[0.3, 0.25, 0.2, 0.15, 0.1])
        region = rng.choice(REGIONS)
        segment = rng.choice(SEGMENTS)

        # Generate usage pattern
        base_usage = rng.integers(100, 10000)
        growth = rng.uniform(-0.005, 0.01)  # Some companies shrink

        for i, dt in enumerate(dates):
            # Base trend
            trend = base_usage * (1 + growth) ** i

            # Weekly seasonality
            if dt.day_of_week >= 5:
                trend *= 0.3

            # Random noise
            daily_credits = max(0, trend * rng.uniform(0.7, 1.3))

            records.append(
                {
                    "company_name": company,
                    "date": dt,
                    "daily_credits": daily_credits,
                    "account_type": account_type,
                    "region": region,
                    "segment": segment,
                }
            )

    return pd.DataFrame(records)


@st.cache_data(ttl="1h", show_spinner="Loading company data...")
def load_company_data() -> pd.DataFrame:
    """Load all company data (cached). Replace with your data source."""
    return generate_company_data(days=90)


def _calc_growth(trend: list[float]) -> float:
    """Return second-half vs first-half delta (rough trend indicator)."""
    if not trend or len(trend) < 2:
        return 0
    mid = len(trend) // 2
    first_half = sum(trend[:mid]) if mid > 0 else 0
    second_half = sum(trend[mid:])
    return second_half - first_half


def aggregate_companies(
    df: pd.DataFrame,
    days: int | None = None,
    account_types: list[str] | None = None,
    sort_by: str = "total_credits",
) -> pd.DataFrame:
    """Filter and aggregate company data."""
    result = df

    # Filter by time window
    if days:
        cutoff = pd.Timestamp.now() - pd.Timedelta(days=days)
        result = result[result["date"] >= cutoff]

    # Filter by account type
    if account_types:
        result = result[result["account_type"].isin(account_types)]

    if result.empty:
        return pd.DataFrame()

    # Aggregate to company level
    agg = (
        result.groupby("company_name")
        .agg(
            total_credits=("daily_credits", "sum"),
            active_days=("date", "nunique"),
            account_type=("account_type", "first"),
            region=("region", "first"),
            segment=("segment", "first"),
        )
        .reset_index()
    )

    # Calculate daily average
    agg["daily_avg"] = agg["total_credits"] / agg["active_days"]

    # Build sparkline data (list of daily values).
    # `include_groups=False` silences a pandas 2.2+ FutureWarning about
    # groupby keys being included in the applied function's input frame.
    sparklines = (
        result.groupby("company_name")  # ty: ignore[no-matching-overload]
        .apply(
            lambda x: x.sort_values("date")["daily_credits"].tolist(),
            include_groups=False,  # type: ignore[call-overload]
        )
        .reset_index()
    )
    sparklines.columns = ["company_name", "usage_trend"]
    agg = agg.merge(sparklines, on="company_name")

    agg["growth_score"] = agg["usage_trend"].apply(_calc_growth)

    # Sort
    if sort_by == "growth_asc":
        agg = agg.sort_values("growth_score", ascending=True)
    elif sort_by == "growth_desc":
        agg = agg.sort_values("growth_score", ascending=False)
    else:
        agg = agg.sort_values("total_credits", ascending=False)

    return agg


@st.dialog(
    "Company details", position="right", width="medium", icon=":material/business:"
)
def company_drawer(company: pd.Series) -> None:
    """Show a company's attributes, its totals for the selected window, and its
    daily usage over the full period.
    """
    all_data = load_company_data()
    is_company = all_data["company_name"] == company["company_name"]
    usage = all_data[is_company].sort_values("date")

    st.subheader(company["company_name"], anchor=False)
    with st.container(horizontal=True, gap="small"):
        st.badge(
            company["account_type"], icon=":material/workspace_premium:", color="blue"
        )
        st.badge(company["region"], icon=":material/public:", color="violet")
        st.badge(company["segment"], icon=":material/factory:", color="orange")

    credits_col, days_col, growth_col = st.columns(3)
    credits_col.metric(
        "Total credits",
        company["total_credits"],
        format="%,.0f",
        border=True,
        height="stretch",
    )
    days_col.metric(
        "Active days", company["active_days"], border=True, height="stretch"
    )
    growth_col.metric(
        "Growth score",
        company["growth_score"],
        format="%+,.0f",
        border=True,
        height="stretch",
    )

    with st.container(border=True):
        st.markdown("**Daily usage**")
        st.line_chart(
            usage,
            x="date",
            y="daily_credits",
            height=250,
            alt="Daily credit usage over time",
        )
    with st.container(border=True):
        st.markdown("**Cumulative usage**")
        st.area_chart(
            usage.assign(cumulative=usage["daily_credits"].cumsum()),
            x="date",
            y="cumulative",
            height=250,
            alt="Cumulative credit usage over time",
        )


# =============================================================================
# Page Layout
# =============================================================================

st.title("Company analytics", icon=":material/business:")
st.caption("Track company adoption: usage, growth trends, and account details.")

with st.container(horizontal=True, vertical_alignment="center", gap="medium"):
    sort_by = st.segmented_control(
        "Ranking",
        options=list(RANKINGS),
        format_func=lambda key: RANKINGS[key],
        default="total_credits",
        required=True,
        key="ranking",
        bind="query-params",
        label_visibility="collapsed",
    )
    time_window = st.segmented_control(
        "Time window",
        options=list(TIME_WINDOWS),
        default="Last 28 days",
        required=True,
        key="window",
        bind="query-params",
        label_visibility="collapsed",
    )
    account_types = st.pills(
        "Account types",
        options=ACCOUNT_TYPES,
        default=["Enterprise", "Growth", "Startup"],
        selection_mode="multi",
        key="types",
        bind="query-params",
        label_visibility="collapsed",
    )

with st.container(border=True):
    st.markdown(f"**Companies — {time_window.lower()}**")

    leaderboard = aggregate_companies(
        load_company_data(),
        days=TIME_WINDOWS[time_window],
        account_types=account_types,
        sort_by=sort_by,
    )

    if leaderboard.empty:
        st.warning("No company data found for the selected filters.")
        st.stop()

    # Lists render as colored chips in a MultiselectColumn.
    table = leaderboard.assign(view=VIEW_ACTION)
    for col in ["account_type", "region", "segment"]:
        table[col] = table[col].map(lambda value: [value])

    st.dataframe(
        table,
        column_config={
            "view": st.column_config.ButtonColumn(
                "", type="tertiary", key="company_click", help="Open company details"
            ),
            "company_name": st.column_config.TextColumn("Company", width="medium"),
            "account_type": st.column_config.MultiselectColumn(
                "Type",
                options=ACCOUNT_TYPES,
                color="auto",
                width="small",
            ),
            "total_credits": st.column_config.NumberColumn("Credits", format="%,.0f"),
            "growth_score": st.column_config.NumberColumn(
                "Growth",
                format="%+.0f",
                help="Credit change: second half vs first half of period",
            ),
            "usage_trend": st.column_config.LineChartColumn("Trend", width="medium"),
            "daily_avg": st.column_config.NumberColumn("Daily avg", format="%,.0f"),
            "region": st.column_config.MultiselectColumn(
                "Region",
                options=REGIONS,
                color="auto",
            ),
            "segment": st.column_config.MultiselectColumn(
                "Segment",
                options=SEGMENTS,
                color="auto",
            ),
        },
        column_order=[
            "view",
            "company_name",
            "account_type",
            "total_credits",
            "growth_score",
            "usage_trend",
            "daily_avg",
            "region",
            "segment",
        ],
        hide_index=True,
        alt="Company usage leaderboard",
    )

# A button click lasts one rerun, so the drawer doesn't reopen on later reruns.
click = st.session_state.get("company_click")
if click is not None:
    company_drawer(leaderboard.iloc[click.row])
