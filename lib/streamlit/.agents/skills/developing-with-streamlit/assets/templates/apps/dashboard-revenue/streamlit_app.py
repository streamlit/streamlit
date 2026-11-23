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

"""Revenue BI dashboard: certified KPIs, card menus, and layout-first loading.

Demonstrates:
- A page header with a filter summary and a toolbar of global filters (period,
  a popover with region and plan pills, and an annotations toggle) bound to the
  URL with ``bind="query-params"``, so every view is shareable
- Layout-first loading: the main script draws each card's frame, title, and
  ``st.skeleton``, and calls the card's ``@st.fragment(parallel=True)`` inside
  it. A card with its own controls (MRR by plan) draws them in its fragment.
  The cards load concurrently, nothing moves when data arrives, and cached
  reruns update the cards in place.
- BI card anatomy: a bold title with a certified badge, a caption, and
  right-aligned controls with a ⋮ ``st.menu_button`` that opens a
  "What's measured" drawer and toggles a forecast
- Section headers with a SQL popover and a deferred ``st.download_button``
- ``st.echarts_chart`` stacked areas with milestone annotations and a shaded
  forecast, a waterfall, and a selectable donut that filters a table
- ``st.dataframe`` with a ``ButtonColumn`` that opens an account drawer
  (``@st.dialog(position="right")``)
- The ``bi-dashboard`` dual light/dark theme in ``.streamlit/config.toml``

All data is synthetic. Replace the generator in ``data.py`` with your own query.
"""

from typing import Literal

import charts
import data
import pandas as pd
from components import (
    DEFINITIONS,
    account_columns,
    account_table,
    card_header,
    card_menu,
    open_clicked_account,
    sql_popover,
)

import streamlit as st

st.set_page_config(
    page_title="Revenue overview", page_icon=":material/insights:", layout="wide"
)

# Each skeleton has the height of the content that replaces it, so nothing
# moves when the data arrives.
KPI_HEIGHT = 186
CHART_HEIGHT = 320
# The drill-down's two cards side by side. Narrow viewports stack them, so the
# first load grows there.
DRILLDOWN_HEIGHT = 444

# KPI key -> (metric label, metric icon, sparkline chart type).
KPIS: dict[str, tuple[str, str, Literal["line", "bar", "area"]]] = {
    "arr": ("Annual recurring revenue", ":material/payments:", "area"),
    "net_new_mrr": ("Net new MRR", ":material/trending_up:", "bar"),
    "nrr": ("Net revenue retention", ":material/autorenew:", "line"),
    "gross_churn": ("Monthly gross churn", ":material/trending_down:", "bar"),
}


def reset_filters() -> None:
    # Assign the keys instead of deleting them: deleting doesn't update the
    # browser, and a bound widget would read its old value back from the URL.
    st.session_state.period = data.DEFAULT_PERIOD
    st.session_state.regions = []
    st.session_state.plans = []
    st.session_state.annotations = False


# =============================================================================
# Cards
# =============================================================================


@st.fragment(parallel=True)
def kpi_card(kpi: str, filters: data.Filters) -> None:
    """One certified KPI. The page calls it inside its ``st.skeleton``."""
    accounts, history = data.load_book()
    ids = data.filter_accounts(accounts, filters).index
    series = data.monthly_kpis(history, ids, filters.months)[kpi]
    last = series.iloc[-1]
    # monthly_kpis starts one month before the window. Level metrics (ARR, NRR)
    # compare with that month; monthly flows (net new MRR, churn) compare with
    # the window average, excluding the latest month.
    vs_start = kpi in {"arr", "nrr"}
    baseline = series.iloc[0] if vs_start else series.iloc[1:-1].mean()
    if kpi == "arr":
        value = charts.money(last)
        delta = f"{last / baseline - 1:+.1%}" if baseline else None
    elif kpi == "net_new_mrr":
        # Net new MRR can be negative, so compare amounts, not a percent change.
        value = charts.money(last)
        delta = ("+" if last >= baseline else "") + charts.money(last - baseline)
    else:
        # NRR and gross churn are undefined when their baseline MRR is zero.
        value = f"{last:.1f}%" if pd.notna(last) else "—"
        change = last - baseline
        delta = f"{change:+.1f} pts" if pd.notna(change) else None
    label, icon, chart_type = KPIS[kpi]
    st.metric(
        f"{label} :green[:material/verified:]",
        value,
        delta,
        delta_color="inverse" if kpi == "gross_churn" else "normal",
        delta_description=(
            f"vs. {filters.months} months ago" if vs_start else "vs. period average"
        ),
        chart_data=series.iloc[1:],
        chart_type=chart_type,
        icon=icon,
        border=True,
        help=DEFINITIONS[kpi].measures,
        height=KPI_HEIGHT,
    )


@st.fragment(parallel=True)
def mrr_growth_card(filters: data.Filters) -> None:
    """MRR by plan, with a $/% view and a menu that toggles a forecast.

    Its controls live in the fragment so that using them reruns only this
    card, which is why the card draws its own frame and skeleton.
    """
    with st.container(border=True, height="stretch"):
        controls = card_header(
            "MRR by plan", "Monthly recurring revenue, stacked by plan", certified=True
        )
        view = controls.segmented_control(
            "View",
            ["$", "%"],
            default="$",
            required=True,
            key="growth_view",
            label_visibility="collapsed",
        )
        card_menu(controls, "mrr_by_plan", {"mrr_forecast": "forecast"})
        with st.skeleton(height=CHART_HEIGHT):
            accounts, history = data.load_book()
            in_regions = accounts[accounts["region"].isin(filters.regions)]
            monthly = data.mrr_by_plan(history, in_regions, filters.months)
            forecast = (
                data.mrr_forecast(monthly)
                if st.session_state.get("mrr_forecast")
                else None
            )
            st.echarts_chart(
                charts.mrr_growth(
                    monthly,
                    filters.plans,
                    share=view == "%",
                    forecast=forecast,
                    milestones=data.milestones(filters),
                ),
                height=CHART_HEIGHT,
                alt="Monthly recurring revenue by plan over time",
            )


@st.fragment(parallel=True)
def mrr_bridge_chart(filters: data.Filters) -> None:
    """MRR movements as a waterfall. The page calls it inside its ``st.skeleton``."""
    accounts, history = data.load_book()
    ids = data.filter_accounts(accounts, filters).index
    movements = data.mrr_movements(history, ids, filters.months)
    st.echarts_chart(
        charts.mrr_bridge(movements),
        height=CHART_HEIGHT,
        alt=f"MRR moved from {charts.money(movements['start'])} to "
        f"{charts.money(movements['end'])}",
    )


@st.fragment(parallel=True)
def industry_drilldown(filters: data.Filters) -> None:
    """Donut of MRR by industry that filters the top-accounts table on click.

    Clicking a slice, a table button, or the ⋮ menu reruns only this fragment,
    on the script thread. ``@st.dialog`` raises in a parallel worker, so both
    drawers can open only from that rerun.
    """
    accounts, _ = data.load_book()
    active = data.filter_accounts(accounts, filters).query("mrr > 0")
    by_industry = (
        active.groupby("industry")["mrr"].sum().reindex(data.INDUSTRIES, fill_value=0)
    )

    mix_col, table_col = st.columns([2, 3])
    with mix_col.container(border=True, height="stretch"):
        controls = card_header(
            "Revenue by industry",
            "Click a slice to filter the accounts",
            certified=True,
        )
        card_menu(controls, "industry_mix")
        event = st.echarts_chart(
            charts.industry_mix(by_industry),
            on_select="rerun",
            # The industries keep their order, so the selection stays valid
            # when a filter changes the data.
            key="industry_mix",
            height=CHART_HEIGHT + 40,
            alt="Share of MRR by industry",
        )
    selected = [
        data.INDUSTRIES[index]
        for group in event.selection.selected
        for index in group["data_indices"]
    ]
    top = active[active["industry"].isin(selected)] if selected else active

    with table_col.container(border=True, height="stretch"):
        controls = card_header(
            "Top accounts",
            f"{selected[0]} customers by MRR"
            if selected
            else "Largest customers by MRR",
        )
        if selected:
            controls.badge(selected[0], icon=":material/filter_alt:", color="primary")
        table = account_table(top.nlargest(10, "mrr"))
        st.dataframe(
            table,
            column_config=account_columns(key="top_accounts_click"),
            hide_index=True,
            height=CHART_HEIGHT + 40,
            alt="Top accounts by monthly recurring revenue",
        )
        open_clicked_account(table, "top_accounts_click")


def export_csv(filters: data.Filters) -> bytes:
    # Streamlit calls this only on click, so the button renders before the data
    # loads.
    accounts, _ = data.load_book()
    return data.accounts_csv(data.filter_accounts(accounts, filters))


# =============================================================================
# Page layout
# =============================================================================

# Header. `summary` is a placeholder; the code below fills it once the toolbar
# has set the filters.
with st.container(horizontal=True, vertical_alignment="center"):
    with st.container(gap=None):
        st.title("Revenue overview", icon=":material/insights:", anchor=False)
        summary = st.empty()
    st.button(
        "Reset", icon=":material/restart_alt:", type="tertiary", on_click=reset_filters
    )

with st.container(horizontal=True, vertical_alignment="center", gap="medium"):
    st.segmented_control(
        "Period",
        list(data.PERIODS),
        default=data.DEFAULT_PERIOD,
        required=True,
        key="period",
        bind="query-params",
        label_visibility="collapsed",
    )
    with st.popover("Filters", icon=":material/tune:"):
        for name, options in (("Regions", data.REGIONS), ("Plans", data.PLANS)):
            st.pills(
                name,
                options,
                selection_mode="multi",
                key=name.lower(),
                help=f"Leave empty to include all {name.lower()}.",
                bind="query-params",
            )
    st.toggle(
        "Annotations",
        value=False,
        key="annotations",
        bind="query-params",
        help="Mark product and pricing milestones on the MRR chart.",
    )

filters = data.current_filters()
summary.caption(filters.describe())

with st.container(horizontal=True, vertical_alignment="center"):
    st.subheader("Revenue", help="Certified metrics, refreshed hourly.", anchor=False)
    with st.container(horizontal=True, horizontal_alignment="right", width="content"):
        sql_popover("revenue")
        st.download_button(
            "Export",
            lambda: export_csv(filters),
            file_name="accounts.csv",
            mime="text/csv",
            icon=":material/download:",
            on_click="ignore",
        )

# The main script draws the KPI, bridge, and drill-down skeletons, so they hold
# their size from the first paint. Each fragment's first element replaces its
# skeleton.
with st.container(horizontal=True):
    for kpi in KPIS:
        with st.skeleton(height=KPI_HEIGHT):
            kpi_card(kpi, filters)

growth_col, bridge_col = st.columns([3, 2])
with growth_col:
    mrr_growth_card(filters)
with bridge_col.container(border=True, height="stretch"):
    controls = card_header(
        "MRR bridge",
        f"How MRR moved over the last {filters.months} months",
        certified=True,
    )
    card_menu(controls, "mrr_bridge")
    with st.skeleton(height=CHART_HEIGHT):
        mrr_bridge_chart(filters)

with st.skeleton(height=DRILLDOWN_HEIGHT):
    industry_drilldown(filters)
