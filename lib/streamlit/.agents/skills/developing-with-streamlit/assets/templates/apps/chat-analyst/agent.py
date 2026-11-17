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

"""The template's agent: scripted analyses that compute real answers from synthetic data.

No model is called. ``run`` matches a request to a scripted analysis and does
its work as it goes: it yields ``Running`` when a tool call starts, the finished
``Step`` when it ends, and the ``Reply`` last, with the answer and an optional
chart. To use a real model, map your model's or agent framework's events to
these: tool-call starts to ``Running``, tool results to ``Step``, and the final
message to ``Reply``. Each ``Step`` must follow its own ``Running``, so if your
framework only reports finished tool calls, yield a ``Running`` right before
each ``Step``. To stream tokens, pass the model's stream to
``st.write_stream`` instead of ``stream``.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

import streamlit as st

if TYPE_CHECKING:
    from collections.abc import Iterator

REGIONS = ["West", "Central", "East"]

WHY_REVENUE_FELL = ":material/trending_down: Why revenue fell"
COMPARE_REGIONS = ":material/leaderboard: Compare regions"
# Short labels for the pills, and the prompt each one sends
SUGGESTIONS = {
    WHY_REVENUE_FELL: "Why did revenue fall last week?",
    COMPARE_REGIONS: "Which region grew the most in the last six weeks?",
}


@dataclass(frozen=True)
class Running:
    """A tool call that started. Its finished ``Step`` follows."""

    label: str  # Such as "Querying weekly revenue"


@dataclass(frozen=True)
class Step:
    """A finished tool call, shown as a step in the timeline."""

    label: str  # Such as "Queried weekly revenue"
    detail: str  # Markdown, such as the query the agent ran


@dataclass
class Reply:
    """The agent's final message: the answer, an optional chart, and follow-ups."""

    title: str  # A short title for the conversation
    answer: str  # Markdown, streamed into the message
    chart: dict[str, Any] | None = None  # An ECharts option, redrawn from history
    chart_alt: str = ""
    followups: dict[str, str] = field(default_factory=dict)  # Label to prompt


Event = Running | Step | Reply


def money(value: float) -> str:
    sign = "-" if value < 0 else ""
    value = abs(value)
    if value >= 1e6:
        return f"{sign}${value / 1e6:.2f}M"
    if value < 1e3:
        return f"{sign}${value:,.0f}"
    return f"{sign}${value / 1e3:,.0f}k"


def signed_money(value: float) -> str:
    return money(value) if value < 0 else f"+{money(value)}"


@st.cache_data
def weekly_revenue() -> pd.DataFrame:
    """Twelve weeks of net revenue, one column per region. Replace with your query."""
    rng = np.random.default_rng(7)
    weeks = pd.date_range(end="2026-11-09", periods=12, freq="W-MON")
    levels = {"West": 410_000, "Central": 320_000, "East": 365_000}
    growth = {"West": 0.05, "Central": 0.12, "East": 0.08}
    frame = pd.DataFrame({"week": weeks})
    for region in REGIONS:
        trend = np.linspace(0, growth[region], len(weeks))
        noise = rng.normal(0, 0.012, len(weeks))
        frame[region] = (levels[region] * (1 + trend + noise)).round()
    frame.loc[frame.index[-1], "West"] *= 0.86  # A stockout in the last week
    return frame


def trend_chart(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        "dataset": {"source": frame},
        "legend": {},
        "tooltip": {"trigger": "axis", "valueFormatter": "dollar"},
        "xAxis": {"type": "time"},
        "yAxis": {
            "type": "value",
            "scale": True,
            "axisLabel": {"formatter": "compact"},
        },
        "series": [
            {
                "type": "line",
                "name": region,
                "encode": {"x": "week", "y": region},
                "showSymbol": False,
            }
            for region in REGIONS
        ],
    }


def revenue_analysis() -> Iterator[Event]:
    yield Running("Querying weekly revenue")
    frame = weekly_revenue()
    time.sleep(1.2)  # Stands in for the query's latency
    yield Step(
        "Queried weekly revenue",
        "```sql\nselect week, region, sum(net_revenue)\nfrom sales\n"
        "group by week, region\n```",
    )
    yield Running("Comparing last week with the week before")
    last, previous = frame[REGIONS].iloc[-1], frame[REGIONS].iloc[-2]
    change = last - previous
    time.sleep(0.8)
    yield Step(
        "Compared last week with the week before",
        " · ".join(f"{r} {signed_money(change[r])}" for r in REGIONS),
    )
    worst = str(change.idxmin())
    others = ", ".join(
        f"{region} {signed_money(change[region])}"
        for region in REGIONS
        if region != worst
    )
    total = change.sum()
    answer = (
        f"**Revenue fell {money(-total)} last week** "
        f"({total / previous.sum():+.1%}), to {money(last.sum())}. "
        f"Almost all of it is in the **{worst}**, down {money(-change[worst])} "
        f"({change[worst] / previous[worst]:+.1%}). The other regions held "
        f"steady: {others}.\n\n"
        f"A one-week drop in a single region usually points to supply, not "
        f"demand. Check the {worst}'s stock levels before changing prices."
    )
    yield Reply(
        title="Why revenue fell",
        answer=answer,
        chart=trend_chart(frame),
        chart_alt=f"Weekly revenue by region for 12 weeks: the {worst} drops in "
        "the last week while the others hold steady",
        followups={COMPARE_REGIONS: SUGGESTIONS[COMPARE_REGIONS]},
    )


def regions_analysis() -> Iterator[Event]:
    yield Running("Querying weekly revenue")
    frame = weekly_revenue()
    time.sleep(1.0)  # Stands in for the query's latency
    yield Step("Queried weekly revenue", "Twelve weeks for each of the three regions")
    yield Running("Comparing the last six weeks with the six before")
    recent, earlier = frame[REGIONS].iloc[-6:].sum(), frame[REGIONS].iloc[-12:-6].sum()
    growth = (recent / earlier - 1).sort_values(ascending=False)
    time.sleep(0.6)
    yield Step(
        "Compared the last six weeks with the six before",
        " · ".join(f"{r} {growth[r]:+.1%}" for r in REGIONS),
    )
    best = str(growth.index[0])
    answer = (
        f"**{best} grew the most**: {growth[best]:+.1%} in the last six weeks "
        "against the six before. "
        + ", ".join(f"{region} {growth[region]:+.1%}" for region in growth.index[1:])
        + "."
    )
    chart = {
        "tooltip": {"trigger": "axis", "valueFormatter": "percent"},
        "xAxis": {"type": "category", "data": list(growth.index)},
        "yAxis": {"type": "value", "axisLabel": {"formatter": "percent"}},
        "series": [{"type": "bar", "name": "Growth", "data": growth.round(4).tolist()}],
    }
    yield Reply(
        title="Region growth",
        answer=answer,
        chart=chart,
        chart_alt=f"Revenue growth by region over the last six weeks: {best} grew most",
        followups={WHY_REVENUE_FELL: SUGGESTIONS[WHY_REVENUE_FELL]},
    )


def help_reply(prompt: str) -> Iterator[Event]:
    yield Reply(
        title=prompt[:48],
        answer=(
            "I can't answer that one yet. This template's agent knows a few scripted "
            "questions about weekly revenue by region. Try one of these, or connect "
            "a model in `agent.run`."
        ),
        followups=SUGGESTIONS,
    )


def run(prompt: str) -> Iterator[Event]:
    """Yield a ``Running`` and a ``Step`` per tool call, then the ``Reply``.

    Region questions are matched first, so "revenue by region" compares regions.
    """
    lowered = prompt.lower()
    if re.search(r"region|grew|growth", lowered):
        return regions_analysis()
    if re.search(r"revenue|sales", lowered):
        return revenue_analysis()
    return help_reply(prompt)


def stream(text: str) -> Iterator[str]:
    """The answer a word at a time, the way a model streams it."""
    for token in re.findall(r"\s*\S+", text):
        time.sleep(0.03)
        yield token
