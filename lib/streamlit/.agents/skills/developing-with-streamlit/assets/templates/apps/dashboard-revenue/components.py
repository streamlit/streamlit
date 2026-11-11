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

"""Card headers, card menus, and drawers for the revenue dashboard."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import charts
import data

import streamlit as st

if TYPE_CHECKING:
    import pandas as pd

    from streamlit.delta_generator import DeltaGenerator

# Marks a certified metric, like a verified badge in a BI tool.
VERIFIED = ":green-badge[:material/verified:]"
VIEW_ACTION = ":material/side_navigation: View"
MEASURED = ":material/menu_book: What's measured"


@dataclass(frozen=True)
class Definition:
    title: str
    measures: str
    sql: str
    owner: str = "Revenue operations"
    refresh: str = "Hourly"


# What each certified metric and chart measures, shown in its card menu.
# Replace these with your own metric catalog: its queries, owners, refresh
# schedules, and which metrics it certifies.
DEFINITIONS = {
    "revenue": Definition(
        "Revenue KPIs",
        "Recurring revenue, retention, and churn of active subscriptions.",
        "SELECT month, SUM(mrr) * 12 AS arr\nFROM revenue.mrr_monthly\n"
        "WHERE region IN (:regions) AND plan IN (:plans)\nGROUP BY month",
    ),
    "arr": Definition(
        "Annual recurring revenue",
        "Monthly recurring revenue of all active subscriptions, times 12.",
        "SELECT month, SUM(mrr) * 12 AS arr\nFROM revenue.mrr_monthly\nGROUP BY month",
    ),
    "net_new_mrr": Definition(
        "Net new MRR",
        "New plus expansion MRR, minus contraction and churned MRR, in the month.",
        "SELECT month, SUM(mrr) - LAG(SUM(mrr)) OVER (ORDER BY month)\n"
        "FROM revenue.mrr_monthly\nGROUP BY month",
    ),
    "nrr": Definition(
        "Net revenue retention",
        "MRR today from customers active 12 months ago, divided by their MRR then.",
        "SELECT cur.month, SUM(cur.mrr) / SUM(prev.mrr) AS nrr\n"
        "FROM revenue.mrr_monthly AS cur\nJOIN revenue.mrr_monthly AS prev\n"
        "  ON prev.account_id = cur.account_id\n"
        " AND prev.month = DATEADD(month, -12, cur.month)\nGROUP BY cur.month",
    ),
    "gross_churn": Definition(
        "Monthly gross churn",
        "Churned plus contracted MRR as a share of the previous month's MRR.",
        "SELECT month, SUM(churned_mrr + contraction_mrr) / SUM(prev_mrr)\n"
        "FROM revenue.mrr_movements\nGROUP BY month",
    ),
    "mrr_by_plan": Definition(
        "MRR by plan",
        "Monthly recurring revenue split by plan. The forecast extends each plan "
        "by its average growth over the last six months.",
        "SELECT month, plan, SUM(mrr) AS mrr\nFROM revenue.mrr_monthly\n"
        "WHERE region IN (:regions) AND plan IN (:plans)\nGROUP BY month, plan",
    ),
    "mrr_bridge": Definition(
        "MRR bridge",
        "How MRR moved between the start and end of the period: new customers, "
        "expansion, contraction, and churn.",
        "SELECT movement, SUM(mrr_change) AS mrr_change\nFROM revenue.mrr_movements\n"
        "WHERE month BETWEEN :period_start AND :period_end\n"
        "  AND region IN (:regions) AND plan IN (:plans)\nGROUP BY movement",
    ),
    "industry_mix": Definition(
        "Revenue by industry",
        "Current MRR of active customers, grouped by industry.",
        "SELECT industry, SUM(mrr) AS mrr\nFROM revenue.accounts\n"
        "WHERE mrr > 0 AND region IN (:regions) AND plan IN (:plans)\n"
        "GROUP BY industry",
    ),
}


def card_header(
    title: str, caption: str | None = None, *, certified: bool = False
) -> DeltaGenerator:
    """Render a card's title row and return a right-aligned container for controls."""
    with st.container(horizontal=True, vertical_alignment="center", gap="small"):
        with st.container(gap=None):
            st.markdown(f"**{title}** {VERIFIED}" if certified else f"**{title}**")
            if caption:
                st.caption(caption)
        controls = st.container(
            horizontal=True,
            horizontal_alignment="right",
            vertical_alignment="center",
            width="content",
        )
    return controls


def card_menu(
    controls: DeltaGenerator, card: str, toggles: dict[str, str] | None = None
) -> None:
    """Add a ⋮ menu that opens the card's definition and toggles chart options.

    ``toggles`` maps Session State keys to option labels, such as
    ``{"mrr_forecast": "forecast"}``. Picking one flips its flag in the menu's
    callback, so the card already reads the new value when it redraws. Read
    the flag, not the menu's return value: the flip changes the option's label,
    so the menu returns ``None`` for it.
    """
    toggles = toggles or {}
    key = f"{card}_menu"

    def option_label(option: str) -> str:
        if option not in toggles:
            return MEASURED
        if st.session_state.get(option, False):
            return f":material/visibility_off: Hide {toggles[option]}"
        return f":material/add_chart: Show {toggles[option]}"

    def flip_toggle() -> None:
        picked = st.session_state[key]
        if picked in toggles:
            st.session_state[picked] = not st.session_state.get(picked, False)

    # A menu icon as the only label renders an icon-only trigger without a chevron.
    choice = controls.menu_button(
        ":material/more_vert:",
        [*toggles, "measured"],
        format_func=option_label,
        type="tertiary",
        key=key,
        help="More options",
        on_click=flip_toggle,
    )
    if choice == "measured":
        definition_drawer(card)


def sql_popover(card: str) -> None:
    """Add a popover that shows the query behind a section."""
    with st.popover("SQL", icon=":material/data_object:", type="tertiary"):
        st.caption(f"Query behind **{DEFINITIONS[card].title}**")
        st.code(DEFINITIONS[card].sql, language="sql", width=520)


@st.dialog("What's measured", position="right", width=520, icon=":material/menu_book:")
def definition_drawer(card: str) -> None:
    definition = DEFINITIONS[card]
    # Dialogs shrink headings to 65%, so bold text keeps the title at body size.
    st.markdown(f"**{definition.title}**")
    with st.container(horizontal=True, gap="small"):
        st.badge("Certified", icon=":material/verified:", color="green")
        st.badge(definition.owner, icon=":material/groups:", color="gray")
        st.badge(definition.refresh, icon=":material/update:", color="gray")
    st.markdown(definition.measures)
    st.code(definition.sql, language="sql")


def account_table(accounts: pd.DataFrame) -> pd.DataFrame:
    """Shape accounts for display, with a drawer button column first."""
    # A MultiselectColumn shows each one-item plan list as a colored chip.
    table = accounts.assign(view=VIEW_ACTION, plan=accounts["plan"].map(lambda p: [p]))
    return table[["view", "name", "plan", "mrr", "mrr_trend", "health", "renewal_date"]]


def account_columns(key: str) -> dict[str, Any]:
    """Column configuration for account tables; ``key`` stores the button clicks."""
    return {
        "view": st.column_config.ButtonColumn(
            "", type="tertiary", pinned=True, key=key, help="Open account details"
        ),
        "name": st.column_config.TextColumn("Account", pinned=True),
        "plan": st.column_config.MultiselectColumn(
            "Plan", options=data.PLANS, color="auto"
        ),
        "mrr": st.column_config.NumberColumn("MRR", format="$%,d"),
        "mrr_trend": st.column_config.AreaChartColumn(
            "Trend", color="auto", y_min=0, width="small"
        ),
        "health": st.column_config.ProgressColumn(
            "Health",
            min_value=0,
            max_value=100,
            format="%d",
            color="auto",
            width="small",
        ),
        "renewal_date": st.column_config.DateColumn("Renewal", format="MMM D, YYYY"),
    }


def open_clicked_account(table: pd.DataFrame, key: str) -> None:
    """Open the account drawer when a view button in ``table`` was clicked."""
    click = st.session_state.get(key)
    if click is not None:
        account_drawer(str(table.index[click.row]))


@st.dialog("Account details", position="right", width=520, icon=":material/domain:")
def account_drawer(account_id: str) -> None:
    accounts, history = data.load_book()
    account = accounts.loc[account_id].to_dict()
    st.markdown(f"**{account['name']}**")
    with st.container(horizontal=True, gap="small"):
        st.badge(account["plan"], icon=":material/workspace_premium:", color="violet")
        st.badge(account["region"], icon=":material/public:", color="gray")
        st.badge(
            account["status"],
            color="green" if account["status"] == "Healthy" else "orange",
        )
    mrr_history = history.loc[[account_id]].iloc[0]
    three_months_ago = float(mrr_history.iloc[-4])
    mrr_col, seats_col, health_col = st.columns(3)
    mrr_col.metric(
        "MRR",
        charts.money(account["mrr"]),
        f"{account['mrr'] / three_months_ago - 1:+.1%}" if three_months_ago else None,
        delta_description="vs. 3 months ago",
        border=True,
        height="stretch",
    )
    seats_col.metric("Seats", f"{account['seats']:,}", border=True, height="stretch")
    health_col.metric(
        "Health", f"{account['health']}/100", border=True, height="stretch"
    )
    with st.container(border=True):
        st.markdown("**MRR history**")
        st.echarts_chart(
            charts.account_mrr(mrr_history),
            height=200,
            alt=f"Monthly recurring revenue history of {account['name']}",
        )
    st.table(
        {
            ":material/person: Owner": account["owner"],
            ":material/factory: Industry": account["industry"],
            ":material/calendar_month: Customer since": account[
                "customer_since"
            ].strftime("%b %d, %Y"),
            ":material/event_repeat: Renewal": account["renewal_date"].strftime(
                "%b %d, %Y"
            ),
        },
        border="horizontal",
        alt=f"Key facts about {account['name']}",
    )
