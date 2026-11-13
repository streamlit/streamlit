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

"""Review queue: planners approve, adjust, hold, or reject what an AI agent proposes.

An "app that acts": the decision happens in the same app as the data. A
replenishment agent proposes purchase orders. Planners edit quantities, decide
in an editable table or a review drawer, and every decision is checked against
guardrails and written back to the database with an audit log.

Notes on this template:
- ``st.data_editor`` is the queue: editable quantity, decision, and note
  columns next to read-only badge, progress, and flag columns. A
  ``ButtonColumn`` opens a review drawer (``@st.dialog(position="right")``).
- Table edits are drafts in Session State, keyed by proposal ID, so they
  survive filters and searches. Nothing is written until the planner submits.
- Every decision is validated on the server (whole cases, order caps, notes
  for rejections and large changes) before ``store.record`` writes it back
  through ``st.connection``. A disabled button is only a hint.
- The drawer shows the agent's reasoning as an ``st.status(type="step")``
  timeline, a stock projection, and a decision form.
- The view and category filters are bound to the URL; the search is live.

All data is synthetic. See ``store.py`` to connect your database and agent.
"""

from __future__ import annotations

from collections import Counter
from datetime import date

import numpy as np
import pandas as pd
import review
import store

import streamlit as st

st.set_page_config(
    page_title="Review queue",
    page_icon=":material/inbox:",
    layout="wide",
)

VIEWS = {"Awaiting review": "pending", "On hold": "held", "Decided": None}
ACTION_COLORS: dict[str, review.BadgeColor] = {
    "Approved": "green",
    "Approved with changes": "blue",
    "Held": "gray",
    "Rejected": "orange",
}
REVIEW = ":material/side_navigation: Review"
EDITABLE_COLUMNS = {"order_qty", "decision", "note"}

store.ensure_ready()
queue = store.load_proposals()


def sync_drafts(ids: list[str], key: str) -> None:
    """Copy the table's edits into the drafts, keyed by proposal ID."""
    for position, changes in st.session_state[key]["edited_rows"].items():
        review.drafts().setdefault(ids[int(position)], {}).update(changes)


def open_review(ids: list[str]) -> None:
    # Map the clicked row with the table as it was shown, not as it reloads.
    st.session_state.reviewing = ids[st.session_state.review_click.row]


def accept_low_risk(ids: list[str]) -> None:
    for proposal_id in ids:
        review.drafts()[proposal_id] = {"decision": "Approve"}
    review.reset_editor()


def clear_drafts() -> None:
    review.drafts().clear()
    review.reset_editor()


def submit() -> None:
    # Check the drafts again at click time: a disabled button is only a hint.
    checked = review.checked_drafts(store.load_proposals())
    valid = [decision for decision, problem in checked if problem is None]
    written, skipped = store.record(valid, review.reviewer())
    for decision in valid:
        review.drafts().pop(decision.proposal_id, None)
    review.reset_editor()
    message = f"Submitted {written} decision{'' if written == 1 else 's'}"
    if skipped:
        message += f" · {skipped} already decided"
    st.toast(message, icon=":material/send:")


# Header
with st.container(horizontal=True, vertical_alignment="center"):
    with st.container(gap=None):
        st.title("Review queue", icon=":material/inbox:", anchor=False)
        st.caption(
            f"Purchase orders proposed by the replenishment agent · {len(queue)} "
            f"proposals across {queue['location'].nunique()} distribution centers"
        )
    reset = st.menu_button(
        ":material/more_vert:",
        [":material/restart_alt: Reset sample data"],
        type="tertiary",
        help="More options",
        key="app_menu",
    )
if reset:
    store.reset()
    clear_drafts()
    st.rerun()

# KPI row
pending = queue[queue["status"] == "pending"]
held = queue[queue["status"] == "held"]
decisions = store.load_decisions()
today = decisions[decisions["decided_at"].dt.date == date.today()]
approved = today[today["action"].str.startswith("Approved")]
critical = int((pending["priority"] == "Critical").sum())
with st.container(horizontal=True):
    st.metric(
        "Awaiting review",
        len(pending),
        f"{critical} critical" if critical else "None critical",
        delta_color="red" if critical else "gray",
        delta_arrow="off",
        icon=":material/inbox:",
        border=True,
    )
    st.metric(
        "Value awaiting review",
        store.money(pending["value"].sum()),
        f"{int(pending['low_risk'].sum())} low risk",
        delta_color="gray",
        delta_arrow="off",
        icon=":material/payments:",
        help="Low-risk proposals are under the category's auto-approve limit and "
        "have no flags, so they can be accepted in one click.",
        border=True,
    )
    st.metric(
        "On hold",
        len(held),
        f"{store.money(held['value'].sum())} in orders",
        delta_color="gray",
        delta_arrow="off",
        icon=":material/pause_circle:",
        border=True,
    )
    st.metric(
        "Approved today",
        store.money(approved["value"].sum()),
        f"{len(approved)} order{'' if len(approved) == 1 else 's'}",
        delta_color="gray",
        delta_arrow="off",
        icon=":material/local_shipping:",
        border=True,
    )

# Toolbar. Every filter starts the table fresh; its edits are already drafts.
with st.container(horizontal=True, vertical_alignment="center", gap="medium"):
    view = st.segmented_control(
        "View",
        list(VIEWS),
        default="Awaiting review",
        required=True,
        key="view",
        bind="query-params",
        on_change=review.reset_editor,
        label_visibility="collapsed",
    )
    categories = st.pills(
        "Category",
        store.CATEGORIES,
        selection_mode="multi",
        key="category",
        disabled=VIEWS[view] is None,  # The audit log isn't filtered
        bind="query-params",
        on_change=review.reset_editor,
        label_visibility="collapsed",
    )
    search = st.text_input(
        "Search",
        placeholder="Search products, SKUs, suppliers, or POs",
        type="search",
        live=True,
        icon=":material/search:",
        key="search",
        disabled=VIEWS[view] is None,
        on_change=review.reset_editor,
        label_visibility="collapsed",
        width=320,
    )

if VIEWS[view] is None:
    # Decided proposals are read-only: show the audit log instead.
    with st.container(horizontal=True, vertical_alignment="center"):
        st.caption("Every decision, newest first")
        st.download_button(
            "Export",
            decisions.to_csv(index=False),
            file_name="review_queue_audit_log.csv",
            mime="text/csv",
            icon=":material/download:",
            on_click="ignore",
            type="tertiary",
            disabled=decisions.empty,
        )
    st.dataframe(
        decisions.assign(action=decisions["action"].map(lambda action: [action])),
        column_order=[
            "decided_at",
            "proposal_id",
            "product",
            "location",
            "reviewer",
            "action",
            "agent_qty",
            "final_qty",
            "value",
            "note",
        ],
        column_config={
            "decided_at": st.column_config.DatetimeColumn(
                "Decided", format="MMM D, h:mm a", pinned=True
            ),
            "proposal_id": "PO",
            "product": "Product",
            "location": "DC",
            "reviewer": "Reviewer",
            "action": st.column_config.MultiselectColumn(
                "Decision",
                options=list(ACTION_COLORS),
                color=list(ACTION_COLORS.values()),
            ),
            "agent_qty": st.column_config.NumberColumn("Agent qty", format="localized"),
            "final_qty": st.column_config.NumberColumn("Final qty", format="localized"),
            "value": st.column_config.NumberColumn("Value", format="dollar"),
            "note": st.column_config.TextColumn("Note", width="large"),
        },
        hide_index=True,
        placeholder="—",
        alt="Audit log of planner decisions on agent proposals",
    )
    st.stop()

rows = queue[queue["status"] == VIEWS[view]]
if categories:
    rows = rows[rows["category"].isin(categories)]
if search and not rows.empty:  # On zero rows, agg doesn't return a Series
    haystack = (
        rows.index + " " + rows[["product", "sku", "supplier"]].agg(" ".join, axis=1)
    )
    rows = rows[haystack.str.contains(search, case=False, regex=False)]
rank = {priority: position for position, priority in enumerate(store.PRIORITIES)}
rows = rows.assign(rank=rows["priority"].map(rank)).sort_values(["rank", "days_left"])
if rows.empty:
    st.info(
        "Nothing here. Try another view, or clear the filters.", icon=":material/inbox:"
    )
    st.stop()

ids = list(rows.index)
order_qty = [review.draft_quantity(store.row(rows, pid)) for pid in ids]
table = pd.DataFrame(
    {
        "review": REVIEW,
        "product": rows["product"],
        "location": rows["location"],
        "priority": rows["priority"].map(lambda priority: [priority]),
        "days_left": rows["days_left"],
        "agent_qty": rows["proposed_qty"],
        "order_qty": order_qty,
        "value": np.array(order_qty) * rows["unit_cost"],
        "decision": [review.drafts().get(pid, {}).get("decision") for pid in ids],
        "note": [review.drafts().get(pid, {}).get("note") or "" for pid in ids],
        "confidence": rows["confidence"] * 100,
        "flags": rows["flags"],
    },
    index=rows.index,
)
editor_key = f"queue_{st.session_state.get('editor_version', 0)}"
st.data_editor(
    table,
    key=editor_key,
    on_change=sync_drafts,
    args=(ids, editor_key),
    column_config={
        "_index": st.column_config.TextColumn("PO", width="small", disabled=True),
        "review": st.column_config.ButtonColumn(
            "",
            type="tertiary",
            pinned=True,
            on_click=open_review,
            args=(ids,),
            key="review_click",
            help="See the agent's reasoning and decide in a drawer",
        ),
        "product": st.column_config.TextColumn("Product", pinned=True),
        "location": st.column_config.TextColumn("DC", width="small"),
        "priority": st.column_config.MultiselectColumn(
            "Priority",
            options=store.PRIORITIES,
            color=[review.PRIORITY_COLORS[priority] for priority in store.PRIORITIES],
            width="small",
        ),
        "days_left": st.column_config.NumberColumn(
            "Stock left", format="%d days", width="small"
        ),
        "agent_qty": st.column_config.NumberColumn("Agent qty", format="localized"),
        "order_qty": st.column_config.NumberColumn(
            "Order qty",
            format="localized",
            min_value=0,
            step=1,
            help="Edit to change the order. Use whole cases.",
        ),
        "value": st.column_config.NumberColumn("Value", format="dollar"),
        "decision": st.column_config.SelectboxColumn(
            "Decision",
            options=list(review.DECISIONS),
            help="Submit below to write it back",
        ),
        "note": st.column_config.TextColumn("Note", max_chars=300, width="medium"),
        "confidence": st.column_config.ProgressColumn(
            "Confidence", min_value=0, max_value=100, format="%d%%", width="small"
        ),
        "flags": st.column_config.MultiselectColumn(
            "Flags",
            options=store.FLAGS,
            color=[review.FLAG_COLORS[flag] for flag in store.FLAGS],
        ),
    },
    disabled=[column for column in table.columns if column not in EDITABLE_COLUMNS],
    placeholder="Select",
    alt="Purchase orders proposed by the agent, with editable quantity, decision, "
    "and note",
)

# Decision bar: what will be written, and anything that blocks it
checked = review.checked_drafts(queue)
ready = [decision for decision, problem in checked if problem is None]
problems = [
    f"**{d.proposal_id}** {store.row(queue, d.proposal_id)['product']}: {problem}"
    for d, problem in checked
    if problem
]
low_risk = [pid for pid in rows.index[rows["low_risk"]] if pid not in review.drafts()]

with st.container(border=True):
    with st.container(horizontal=True, vertical_alignment="center"):
        if ready:
            counts = Counter(decision.action for decision in ready)
            summary = ", ".join(
                f"{counts[action]} to {action}"
                for action in review.DECISIONS.values()
                if counts[action]
            )
            st.markdown(
                f":primary[:material/edit_note:] **{len(ready)} ready** · {summary}"
            )
        elif not problems:
            st.markdown(
                ":gray[:material/edit_note:] Set a row's **Decision**, or open "
                "**Review** for the agent's reasoning."
            )
        with st.container(
            horizontal=True, horizontal_alignment="right", width="content"
        ):
            review_next = st.button(
                "Review next",
                icon=":material/play_arrow:",
                type="tertiary",
                help="Open the most urgent proposal in this view",
                key="review_next",
            )
            st.button(
                f"Accept {len(low_risk)} low-risk" if low_risk else "Accept low-risk",
                icon=":material/auto_awesome:",
                type="tertiary",
                on_click=accept_low_risk,
                args=(low_risk,),
                disabled=not low_risk,
                help="Approve the agent's quantity for every low-risk proposal shown",
                key="accept_low_risk",
            )
            st.button(
                "Clear",
                icon=":material/close:",
                type="tertiary",
                on_click=clear_drafts,
                disabled=not review.drafts(),
                key="clear_drafts",
            )
            st.button(
                f"Submit {len(ready)}" if ready else "Submit",
                icon=":material/send:",
                type="primary",
                on_click=submit,
                disabled=not ready,
                key="submit",
            )
    for problem in problems:
        st.markdown(f":red[:material/error:] {problem}")

reviewing = st.session_state.pop("reviewing", None)
if reviewing is not None:
    review.review_drawer(reviewing)
elif review_next:
    review.review_drawer(ids[0])
