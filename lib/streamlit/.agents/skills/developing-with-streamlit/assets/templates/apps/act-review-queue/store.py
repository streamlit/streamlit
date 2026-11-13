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

"""Data access for the review queue: proposals, guardrails, and writeback.

The queue lives in a local SQLite file through ``st.connection``. To use your
own data, replace ``connection()`` with your warehouse connection (for example
``st.connection("snowflake")``) and have your agent write its proposals to the
``proposals`` table. Before connecting real data:

- Remove ``reset``, ``seed_proposals``, ``ensure_ready``, and the Reset menu
  item. Reset replaces the ``proposals`` table and drops the audit log.
  Create the ``decisions`` table once with ``_DECISIONS_SCHEMA``.
- Gate decisions on ``st.user.is_logged_in`` (see the skill's
  ``references/authentication.md``), so the audit log names real reviewers.

Reads are cached and cleared after every write, so every session sees each
decision. The sample database is ``review_queue.db`` in the working directory;
keep it out of version control.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import TYPE_CHECKING, Any, cast

import numpy as np
import pandas as pd
from sqlalchemy import inspect, text

import streamlit as st

if TYPE_CHECKING:
    from sqlalchemy import CursorResult

    from streamlit.connections import SQLConnection

DATABASE_URL = "sqlite:///review_queue.db"
CATEGORIES = ["Outerwear", "Footwear", "Camping", "Accessories"]
PRIORITIES = ["Critical", "High", "Normal"]
FLAGS = ["Over cap", "Low confidence", "New supplier", "Demand spike"]
OPEN = ("pending", "held")  # Also listed in the SQL in ``record``
# Decision action -> proposal status written back.
STATUSES = {"approve": "approved", "hold": "held", "reject": "rejected"}


@dataclass(frozen=True)
class Policy:
    """The guardrails every decision in a category is checked against."""

    auto_approve: float  # Unflagged proposals under this value are low risk
    order_cap: float  # No order above this value can be approved
    max_change_pct: float  # Changing the agent's quantity by more needs a note
    min_confidence: float  # Proposals below this confidence are flagged


POLICIES = {
    "Outerwear": Policy(15_000, 30_000, 25, 0.85),
    "Footwear": Policy(12_000, 30_000, 25, 0.85),
    "Camping": Policy(8_000, 20_000, 30, 0.8),
    "Accessories": Policy(5_000, 12_000, 40, 0.8),
}

# (SKU, product, category, unit cost, case pack, typical weekly units per DC)
_ITEMS = [
    ("OW-1042", "Summit insulated jacket", "Outerwear", 96, 12, 80),
    ("OW-1108", "Ridge rain shell", "Outerwear", 58, 12, 60),
    ("OW-1330", "Trailhead fleece", "Outerwear", 31, 24, 90),
    ("FW-2051", "Talus hiking boot", "Footwear", 71, 6, 45),
    ("FW-2120", "Basecamp winter boot", "Footwear", 84, 6, 50),
    ("CP-3017", "Ultralight 2P tent", "Camping", 138, 2, 14),
    ("CP-3140", "Ember sleeping bag", "Camping", 64, 4, 30),
    ("AC-5021", "Merino beanie", "Accessories", 9, 48, 200),
    ("AC-5230", "Headlamp 400 lm", "Accessories", 14, 24, 90),
]
# (Supplier, lead time in days, new supplier)
_SUPPLIERS = [
    ("Northline Textiles", 18, False),
    ("Granite Peak Supply", 21, False),
    ("Bluewater Trading", 12, True),
]
_LOCATIONS = ["Reno", "Columbus", "Allentown"]
_DECISIONS_SCHEMA = """
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, proposal_id TEXT, decided_at TEXT,
    reviewer TEXT, action TEXT, product TEXT, location TEXT, agent_qty INTEGER,
    final_qty INTEGER, value REAL, note TEXT
)
"""


def money(value: float) -> str:
    """Dollars, in thousands ($12k) from $10,000 and millions ($1.20M) from $1M."""
    if abs(value) >= 1e6:
        return f"${value / 1e6:.2f}M"
    if abs(value) >= 1e4:
        return f"${value / 1e3:.0f}k"
    return f"${value:,.0f}"


def connection() -> SQLConnection:
    return st.connection("review_queue", type="sql", url=DATABASE_URL)


def seed_proposals() -> pd.DataFrame:
    """Synthetic purchase orders, as a replenishment agent proposes each morning."""
    rng = np.random.default_rng(7)
    rows: list[dict[str, object]] = []
    for sku, product, category, unit_cost, case_pack, weekly in _ITEMS:
        for location in _LOCATIONS:
            if rng.random() < 0.2:  # Not every item runs short everywhere
                continue
            supplier, lead_time, new_supplier = _SUPPLIERS[
                rng.choice(3, p=[0.5, 0.35, 0.15])
            ]
            forecast = round(weekly * rng.uniform(0.7, 1.4))
            on_hand = int(forecast * rng.uniform(1, 5))
            days_left = on_hand / (forecast / 7)
            if days_left < lead_time:
                priority = "Critical"
            elif days_left < lead_time + 7:
                priority = "High"
            else:
                priority = "Normal"
            # Cover the lead time plus four weeks, in whole cases.
            need = max(forecast * (lead_time / 7 + 4) - on_hand, case_pack)
            rows.append(
                {
                    "id": f"PO-{1001 + len(rows)}",
                    "sku": sku,
                    "product": product,
                    "category": category,
                    "location": location,
                    "supplier": supplier,
                    "new_supplier": new_supplier,
                    "on_hand": on_hand,
                    "weekly_forecast": forecast,
                    "lead_time_days": lead_time,
                    "case_pack": case_pack,
                    "unit_cost": unit_cost,
                    "proposed_qty": int(np.ceil(need / case_pack) * case_pack),
                    "confidence": round(rng.uniform(0.8, 0.98), 2),
                    "demand_spike": bool(rng.random() < 0.1),
                    "priority": priority,
                    "status": "pending",
                }
            )
    return pd.DataFrame(rows)


def reset() -> None:
    """Replace the queue with a fresh agent run and an empty audit log."""
    conn = connection()
    seed_proposals().to_sql("proposals", conn.engine, if_exists="replace", index=False)
    with conn.session as session:
        session.execute(text("DROP TABLE IF EXISTS decisions"))
        session.execute(text(_DECISIONS_SCHEMA))
        session.commit()
    load_proposals.clear()
    load_decisions.clear()


@st.cache_resource(show_spinner=False)
def ensure_ready() -> bool:
    """Seed the database on first use. Runs once per server process."""
    if not inspect(connection().engine).has_table("proposals"):
        reset()
    return True


@st.cache_data(ttl="5m", show_spinner=False)
def load_proposals() -> pd.DataFrame:
    """Every proposal with its value, days of stock, risk flags, and low-risk mark."""
    with connection().engine.connect() as db:
        frame = pd.read_sql(text("SELECT * FROM proposals"), db).set_index("id")
    policy = pd.DataFrame(
        [asdict(POLICIES[category]) for category in frame["category"]],
        index=frame.index,
    )
    frame["value"] = frame["proposed_qty"] * frame["unit_cost"]
    frame["days_left"] = (frame["on_hand"] / (frame["weekly_forecast"] / 7)).round()
    checks = pd.DataFrame(
        {
            "Over cap": frame["value"] > policy["order_cap"],
            "Low confidence": frame["confidence"] < policy["min_confidence"],
            "New supplier": frame["new_supplier"].astype(bool),
            "Demand spike": frame["demand_spike"].astype(bool),
        }
    )
    frame["flags"] = [
        [flag for flag in FLAGS if checked[flag]] for _, checked in checks.iterrows()
    ]
    frame["low_risk"] = (frame["value"] <= policy["auto_approve"]) & ~checks.any(axis=1)
    return frame


def row(proposals: pd.DataFrame, proposal_id: str) -> pd.Series:
    """The proposal with ``proposal_id``. IDs are unique, so it's a single row."""
    return cast("pd.Series", proposals.loc[proposal_id])


@st.cache_data(ttl="5m", show_spinner=False)
def load_decisions() -> pd.DataFrame:
    """The audit log, newest first."""
    with connection().engine.connect() as db:
        frame = pd.read_sql(text("SELECT * FROM decisions ORDER BY id DESC"), db)
    frame["decided_at"] = pd.to_datetime(frame["decided_at"])
    return frame


@dataclass(frozen=True)
class Decision:
    """A planner's decision on one proposal."""

    proposal_id: str
    action: str  # A key of STATUSES
    quantity: int
    note: str = ""


def validate(decision: Decision, proposal: pd.Series) -> str | None:
    """Why ``decision`` can't be written, or ``None`` when it can."""
    policy = POLICIES[proposal["category"]]
    note = decision.note.strip()
    if decision.action == "reject":
        return None if note else "Add a note to reject"
    if decision.action == "hold":
        return None
    if decision.quantity <= 0:
        return "Order at least one case, or reject the proposal"
    if decision.quantity % proposal["case_pack"]:
        return f"Order whole cases of {proposal['case_pack']}"
    value = decision.quantity * proposal["unit_cost"]
    if value > policy.order_cap:
        return (
            f"{money(value)} is over the {proposal['category'].lower()} order cap "
            f"of {money(policy.order_cap)}"
        )
    change = abs(decision.quantity / proposal["proposed_qty"] - 1) * 100
    if change > policy.max_change_pct and not note:
        return f"Add a note for a change over {policy.max_change_pct:.0f}%"
    return None


def record(decisions: list[Decision], reviewer: str) -> tuple[int, int]:
    """Write decisions back and log them. Returns (written, already decided).

    Only open proposals are updated, so a repeated submit or a second planner
    can't decide the same proposal twice.
    """
    proposals = load_proposals()
    now = datetime.now().isoformat(timespec="seconds")
    written = 0
    with connection().session as session:
        for decision in decisions:
            result = session.execute(
                text(
                    "UPDATE proposals SET status = :status "
                    "WHERE id = :id AND status IN ('pending', 'held')"
                ),
                {"status": STATUSES[decision.action], "id": decision.proposal_id},
            )
            if not cast("CursorResult[Any]", result).rowcount:
                continue
            proposal = row(proposals, decision.proposal_id)
            quantity = 0 if decision.action == "reject" else decision.quantity
            action = STATUSES[decision.action].title()
            if decision.action == "approve" and quantity != proposal["proposed_qty"]:
                action = "Approved with changes"
            session.execute(
                text(
                    "INSERT INTO decisions (proposal_id, decided_at, reviewer, action, "
                    "product, location, agent_qty, final_qty, value, note) VALUES "
                    "(:proposal_id, :decided_at, :reviewer, :action, :product, "
                    ":location, :agent_qty, :final_qty, :value, :note)"
                ),
                {
                    "proposal_id": decision.proposal_id,
                    "decided_at": now,
                    "reviewer": reviewer,
                    "action": action,
                    "product": proposal["product"],
                    "location": proposal["location"],
                    # SQLite drivers don't accept NumPy scalars.
                    "agent_qty": int(proposal["proposed_qty"]),
                    "final_qty": quantity,
                    "value": float(quantity * proposal["unit_cost"]),
                    "note": decision.note.strip() or None,
                },
            )
            written += 1
        session.commit()
    load_proposals.clear()
    load_decisions.clear()
    return written, len(decisions) - written
