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
- Metric cards with ``st.echarts_chart`` time series (line, area, bar, point)
  that animate when a filter changes and zoom with a ``dataZoom`` slider
- A breakdown card that pivots long data to one series per category and
  morphs between lines and stacked bars, with an optional share view
- Chart/table toggle and popover filters on every card
- Time range filtering (1M, 6M, 1Y, QTD, YTD, All)
- ``@st.cache_data(ttl=..., refresh_mode="background")`` loaders, cached per
  metric, that keep data fresh without blocking on a refresh
- ``@st.fragment(parallel=True)`` cards that load concurrently on full reruns
  and rerun in isolation on widget interactions
- Layout-first loading with ``st.skeleton``: the main script draws the KPI
  skeletons, so the row has its final size before any data loads. Cached
  reruns update each card in place without a skeleton.
- A reset button whose callback restores every card's controls

The code is split into ``streamlit_app.py`` (the page), ``charts.py`` (time
filtering, alt text, and ECharts options), and ``data.py`` (synthetic data
and cached loaders). Replace the loaders in ``data.py`` with your own data
sources (e.g., Snowflake queries, APIs, etc.).
"""

from collections.abc import Callable
from typing import Any

import charts
import data

import streamlit as st

st.set_page_config(
    page_title="Metrics dashboard",
    page_icon=":material/monitoring:",
    layout="wide",
)

TIME_RANGES = ["1M", "6M", "1Y", "QTD", "YTD", "All"]
CHART_HEIGHT = 350  # Leaves room for each chart's legend and zoom slider
KPI_HEIGHT = 184  # Height of each KPI's skeleton and metric, so they match
VIEWS = {"chart": ":material/show_chart:", "table": ":material/table:"}
BREAKDOWN_CHARTS = {
    "line": ":material/show_chart: Line",
    "bar": ":material/bar_chart: Bar",
}
LINES = ["Daily", "7-day MA"]


# =============================================================================
# KPI Card Component
# =============================================================================


@st.fragment(parallel=True)
def kpi_card(label: str, metric_name: str) -> None:
    """Display a bordered KPI card: the latest 7-day average and its 4-week change.

    Like the metric cards, each KPI is a parallel fragment that loads its own
    (cached) data. The main script calls it inside ``st.skeleton``, and the
    metric replaces that skeleton.
    """
    # The last 4 weeks (29 daily points) of the 7-day average: the value is
    # the latest point, the delta compares it to the first one.
    trend = data.load_metric(metric_name)["value_7d_ma"].tail(29)
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
        height=KPI_HEIGHT,
    )


# =============================================================================
# Card Components
# =============================================================================


def card_header(
    title: str, key: str, filters: Callable[[], dict[str, Any]]
) -> tuple[str, dict[str, Any]]:
    """Draw a card's title, chart/table toggle, and filters popover.

    ``filters`` draws the popover's widgets and returns their values. Widget
    keys start with ``key``, so ``reset_cards`` can restore them.
    """
    with st.container(
        horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
    ):
        st.markdown(f"**{title}**")
        view = st.segmented_control(
            "View",
            options=VIEWS.keys(),
            format_func=lambda view: VIEWS[view],
            default="chart",
            required=True,
            key=f"{key}_view",
            label_visibility="collapsed",
        )
        with st.popover("Filters", icon=":material/tune:", type="tertiary"):
            values = filters()
            values["time_range"] = st.segmented_control(
                "Time range",
                options=TIME_RANGES,
                default="All",
                required=True,
                key=f"{key}_time",
            )
    return view, values


@st.fragment(parallel=True)
def metric_card(title: str, metric_name: str, chart_type: str = "line") -> None:
    """Display one metric as a chart or table.

    The card is a parallel fragment: on a full app rerun every card loads its
    own data concurrently, and on widget interactions (view toggle, filters)
    only this card reruns. Its controls must live inside the fragment, so the
    card draws its own frame and header, and loads its data inside
    ``st.skeleton`` so the header stays stable while the chart fills in.
    ``metric_name`` is a ``data.METRIC_CONFIG`` key; ``chart_type`` is a
    ``charts.METRIC_CHARTS`` key.
    """

    def line_filters() -> dict[str, Any]:
        lines = st.pills(
            "Lines",
            options=LINES,
            default=LINES,
            selection_mode="multi",
            key=f"{metric_name}_lines",
        )
        return {"lines": lines}

    with st.container(border=True):
        view, filters = card_header(title, metric_name, line_filters)

        # The chart or table replaces the skeleton. On any rerun, including a
        # filter change, a cache hit updates the chart in place; a cache miss
        # covers the old chart with the skeleton after half a second.
        with st.skeleton(height=CHART_HEIGHT):
            df = charts.filter_by_time_range(
                data.load_metric(metric_name), "ds", filters["time_range"]
            )
            if view == "table":
                st.dataframe(
                    df, height=CHART_HEIGHT, hide_index=True, alt=f"{title} data"
                )
                return

            # With no line picked, show the 7-day MA, so the chart always has one.
            labels = filters["lines"] or ["7-day MA"]
            columns = {"Daily": "daily_value", "7-day MA": "value_7d_ma"}
            y_cols = [columns[label] for label in labels]
            option = charts.METRIC_CHARTS[chart_type](df, "ds", y_cols, labels)
            # The alt text summarizes the last plotted series (y_cols[-1]),
            # which is the 7-day MA with the default selection.
            series = "7-day average" if labels[-1] == "7-day MA" else "daily values"
            if chart_type == "bar":
                series = f"weekly means of the {series}"
            st.echarts_chart(
                option,
                height=CHART_HEIGHT,
                alt=charts.describe_trend(
                    title, option["dataset"]["source"], "ds", y_cols[-1], series
                ),
            )


@st.fragment(parallel=True)
def breakdown_card(title: str, dimension: str) -> None:
    """Display a metric broken down by one of the ``data.BREAKDOWNS``.

    Lines and stacked bars use the same series, so switching the chart type
    morphs one into the other. "Show %" turns the stacked bars into each
    category's daily share.
    """
    config = data.BREAKDOWNS[dimension]
    all_categories = list(config["base_values"])

    def breakdown_filters() -> dict[str, Any]:
        selected = st.pills(
            config["label"],
            options=all_categories,
            default=config["default_selection"],
            selection_mode="multi",
            key=f"{dimension}_select",
        )
        chart_type = st.segmented_control(
            "Chart type",
            options=BREAKDOWN_CHARTS.keys(),
            format_func=lambda chart: BREAKDOWN_CHARTS[chart],
            default=config["default_chart"],
            required=True,
            key=f"{dimension}_chart",
        )
        show_percent = st.toggle(
            "Show %", key=f"{dimension}_pct", disabled=chart_type == "line"
        )
        return {
            "selected": selected,
            "chart_type": chart_type,
            "show_percent": show_percent,
        }

    with st.container(border=True):
        view, filters = card_header(title, dimension, breakdown_filters)

        with st.skeleton(height=CHART_HEIGHT):
            # Cleared pills fall back to the defaults, so the chart has a series.
            selected = filters["selected"] or config["default_selection"]
            df = data.load_breakdown(dimension)
            df = df[df[dimension].isin(selected)]
            df = charts.filter_by_time_range(df, "ds", filters["time_range"])
            if view == "table":
                st.dataframe(
                    df, height=CHART_HEIGHT, hide_index=True, alt=f"{title} data"
                )
                return

            categories = [c for c in all_categories if c in selected]
            wide = charts.pivot_by_dimension(
                df, "ds", "value_7d_ma", dimension, categories
            )
            shares = filters["show_percent"] and filters["chart_type"] == "bar"
            option = charts.breakdown_chart(
                wide, "ds", categories, filters["chart_type"], show_percent=shares
            )
            series = "7-day average share" if shares else "7-day average"
            st.echarts_chart(
                option,
                height=CHART_HEIGHT,
                alt=charts.describe_breakdown(
                    title, option["dataset"]["source"], "ds", series, shares=shares
                ),
            )


# =============================================================================
# Page Header Component
# =============================================================================


def reset_cards() -> None:
    """Restore every card's controls to their defaults."""
    # Assigning a widget's key in a callback also updates it in the browser.
    for key in [*data.METRIC_CONFIG, *data.BREAKDOWNS]:
        st.session_state[f"{key}_view"] = "chart"
        st.session_state[f"{key}_time"] = "All"
    for metric_name in data.METRIC_CONFIG:
        st.session_state[f"{metric_name}_lines"] = LINES
    for dimension, config in data.BREAKDOWNS.items():
        st.session_state[f"{dimension}_select"] = config["default_selection"]
        st.session_state[f"{dimension}_chart"] = config["default_chart"]
        st.session_state[f"{dimension}_pct"] = False


with st.container(
    horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
):
    st.title("Metrics dashboard", icon=":material/monitoring:", anchor=False)
    st.button(
        "Reset", icon=":material/restart_alt:", type="tertiary", on_click=reset_cards
    )


# =============================================================================
# Page Layout
# =============================================================================

# Each KPI and card loads its own data; as parallel fragments they load
# concurrently on the first run instead of blocking on each other.

# KPI row: the main script draws each KPI's skeleton, so the row has its final
# size from the first paint, and each metric replaces its skeleton when its data
# arrives. Horizontal containers wrap on narrow screens.
with st.container(horizontal=True):
    for kpi_label, kpi_metric in [
        ("Active users", "users"),
        ("Sessions", "sessions"),
        ("Revenue", "revenue"),
        ("Conversions", "conversions"),
    ]:
        with st.skeleton(height=KPI_HEIGHT):
            kpi_card(kpi_label, kpi_metric)

# Each fragment call is one grid cell. The grid drops to one column on
# narrow screens.
with st.grid(2):
    metric_card("Active users", "users", chart_type="line")
    metric_card("Sessions", "sessions", chart_type="area")
    metric_card("Revenue", "revenue", chart_type="bar")
    metric_card("Conversions", "conversions", chart_type="point")

# Full width, so the stacked bars have room for every day.
breakdown_card("Sessions by channel", "channel")
