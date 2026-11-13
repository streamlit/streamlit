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

"""Drafts and the review drawer for the review queue.

Drafts are a planner's unsubmitted decisions, kept in Session State by
proposal ID. The drawer shows one proposal with the agent's reasoning and a
decision form that writes back right away.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

import pandas as pd
import store

import streamlit as st

BadgeColor = Literal["red", "orange", "yellow", "blue", "green", "violet", "gray"]
DECISIONS = {"Approve": "approve", "Hold": "hold", "Reject": "reject"}
PROJECTION_DAYS = 57  # Today plus eight weeks
PRIORITY_COLORS: dict[str, BadgeColor] = {
    "Critical": "red",
    "High": "orange",
    "Normal": "gray",
}
FLAG_COLORS: dict[str, BadgeColor] = {
    "Over cap": "red",
    "Low confidence": "orange",
    "New supplier": "violet",
    "Demand spike": "yellow",
}


def reviewer() -> str:
    """The signed-in planner, or a guest name when the app has no sign-in."""
    name = st.user.get("name")
    return str(name) if name else "Guest planner"


def drafts() -> dict[str, dict[str, Any]]:
    """Unsubmitted edits by proposal ID, with the queue table's column names."""
    by_id: dict[str, dict[str, Any]] = st.session_state.setdefault("drafts", {})
    return by_id


def draft_quantity(proposal: pd.Series) -> int:
    """The drafted order quantity, or the agent's when there's no draft."""
    quantity = drafts().get(str(proposal.name), {}).get("order_qty")
    return int(proposal["proposed_qty"] if quantity is None else quantity)


def draft_decision(proposal: pd.Series) -> store.Decision | None:
    """The drafted decision, or ``None`` when the planner hasn't picked one."""
    draft = drafts().get(str(proposal.name), {})
    if not draft.get("decision"):
        return None
    return store.Decision(
        proposal_id=str(proposal.name),
        action=DECISIONS[draft["decision"]],
        quantity=draft_quantity(proposal),
        note=draft.get("note") or "",
    )


def checked_drafts(proposals: pd.DataFrame) -> list[tuple[store.Decision, str | None]]:
    """Each drafted decision with why it can't be written, or ``None`` when it can.

    Drafts on proposals that are no longer open, for example ones another
    planner decided, are dropped.
    """
    checked = []
    for proposal_id in list(drafts()):
        proposal = store.row(proposals, proposal_id)
        if proposal["status"] not in store.OPEN:
            drafts().pop(proposal_id)
            continue
        decision = draft_decision(proposal)
        if decision is not None:
            checked.append((decision, store.validate(decision, proposal)))
    return checked


def reset_editor() -> None:
    # Give the queue table a new key so it drops its row-position edits; the
    # drafts keep them by proposal ID.
    st.session_state.editor_version = st.session_state.get("editor_version", 0) + 1


def stock_chart(proposal: pd.Series, quantity: int) -> dict[str, Any]:
    """Projected stock for eight weeks, with and without the order."""
    daily = proposal["weekly_forecast"] / 7
    arrival = int(proposal["lead_time_days"])

    def project(order: int) -> list[int]:
        stock, levels = float(proposal["on_hand"]), []
        for day in range(PROJECTION_DAYS):
            stock += order if day == arrival else 0
            levels.append(round(stock))
            stock = max(stock - daily, 0)
        return levels

    days = pd.date_range(date.today(), periods=PROJECTION_DAYS)
    data = pd.DataFrame(
        {"day": days, "With order": project(quantity), "Without order": project(0)}
    )
    return {
        "dataset": {"source": data},
        "legend": {},
        "tooltip": {"trigger": "axis", "valueFormatter": "%,d units"},
        "xAxis": {"type": "time"},
        "yAxis": {"type": "value"},
        "series": [
            {
                "type": "line",
                "name": "With order",
                "encode": {"x": "day", "y": "With order"},
                "showSymbol": False,
                "areaStyle": {"opacity": 0.12},
                "markLine": {
                    "symbol": "none",
                    "label": {"formatter": "Arrives", "position": "end"},
                    "data": [{"xAxis": days[arrival].isoformat()}],
                },
            },
            {
                "type": "line",
                "name": "Without order",
                "encode": {"x": "day", "y": "Without order"},
                "showSymbol": False,
                "lineStyle": {"type": "dashed"},
            },
        ],
    }


def reasoning(proposal: pd.Series) -> list[tuple[str, str]]:
    """The agent's steps, as (title, Markdown) pairs."""
    spike = " That's above the usual level." if proposal["demand_spike"] else ""
    cases = proposal["proposed_qty"] // proposal["case_pack"]
    flags = proposal["flags"]
    forecast = (
        f"Expects **{proposal['weekly_forecast']:,} units a week** at the "
        f"{proposal['location']} DC.{spike}"
    )
    stock = (
        f"**{proposal['on_hand']:,} on hand** last about "
        f"**{proposal['days_left']:.0f} days**. {proposal['supplier']} delivers "
        f"in {proposal['lead_time_days']} days."
    )
    order = (
        f"Covers the lead time plus four weeks: **{proposal['proposed_qty']:,} "
        f"units**, {cases} cases of {proposal['case_pack']}, for "
        f"**{store.money(proposal['value'])}**."
    )
    return [
        ("Forecast demand", forecast),
        ("Checked stock", stock),
        ("Sized the order", order),
        (
            ":orange[Flagged for review]" if flags else "Checked guardrails",
            ", ".join(flags) + "." if flags else "Within every guardrail.",
        ),
    ]


@st.dialog("Review proposal", position="right", width=680, icon=":material/inventory:")
def review_drawer(proposal_id: str) -> None:
    proposal = store.row(store.load_proposals(), proposal_id)
    policy = store.POLICIES[proposal["category"]]
    st.subheader(proposal["product"], anchor=False)
    with st.container(horizontal=True, gap="small"):
        st.badge(proposal["priority"], color=PRIORITY_COLORS[proposal["priority"]])
        st.badge(proposal_id, icon=":material/receipt_long:", color="gray")
        st.badge(
            f"{proposal['location']} DC", icon=":material/warehouse:", color="gray"
        )
        for flag in proposal["flags"]:
            st.badge(flag, color=FLAG_COLORS[flag])
    st.caption(
        f"{proposal['supplier']} · confidence {proposal['confidence']:.0%} · "
        f"{proposal['category']} order cap {store.money(policy.order_cap)}"
    )

    quantity = draft_quantity(proposal)
    st.echarts_chart(
        stock_chart(proposal, quantity),
        height=220,
        alt=f"Projected stock of {proposal['product']} with and without the order",
    )
    for title, detail in reasoning(proposal):
        with st.status(title, type="step", state="complete", expanded=True):
            st.markdown(detail)

    draft = draft_decision(proposal)
    with st.form(f"decide_{proposal_id}", border=False):
        final_qty = st.number_input(
            "Order quantity",
            min_value=0,
            value=quantity,
            step=int(proposal["case_pack"]),
            help=f"Whole cases of {proposal['case_pack']}.",
            key=f"qty_{proposal_id}",
        )
        note = st.text_area(
            "Note",
            value=draft.note if draft else "",
            placeholder="Required to reject, or to change the quantity by more "
            f"than {policy.max_change_pct:.0f}%",
            max_chars=300,
            height=80,
            key=f"note_{proposal_id}",
        )
        with st.container(horizontal=True, horizontal_alignment="right"):
            reject = st.form_submit_button(
                "Reject", icon=":material/block:", key=f"reject_{proposal_id}"
            )
            hold = st.form_submit_button(
                "Hold",
                icon=":material/pause_circle:",
                type="tertiary",
                key=f"hold_{proposal_id}",
            )
            approve = st.form_submit_button(
                "Approve",
                icon=":material/check:",
                type="primary",
                key=f"approve_{proposal_id}",
            )
    if approve:
        action = "approve"
    elif reject:
        action = "reject"
    elif hold:
        action = "hold"
    else:
        return
    decision = store.Decision(
        proposal_id=proposal_id, action=action, quantity=int(final_qty), note=note
    )
    problem = store.validate(decision, proposal)
    if problem:
        st.error(problem, icon=":material/error:")
        return
    written, _ = store.record([decision], reviewer())
    drafts().pop(proposal_id, None)
    reset_editor()
    if written:
        st.toast(f"Decided **{proposal_id}**", icon=":material/check_circle:")
    else:
        st.toast("Someone else already decided this proposal", icon=":material/sync:")
    st.rerun()
