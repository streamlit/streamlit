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

"""Demand simulator: a what-if forecast that recomputes on every lever change.

An "app that computes": the value is the computation, and it runs in Python
next to the data. Planners pull levers (price, a promo, marketing, supply), and
every change reruns a Monte Carlo simulation of the next 26 weeks. The
interface and the computation are the same code.

Notes on this template:
- The levers are sidebar widgets bound to the URL with ``bind="query-params"``,
  so every scenario is a shareable link. A reset callback restores the plan.
- ``model.py`` holds the simulation. ``model.Levers`` is a frozen dataclass, so
  it keys ``st.cache_data``: a repeated scenario is instant. The simulation uses
  common random numbers, so scenarios differ by their levers alone, not by
  sampling noise.
- Layout-first loading: the main script draws each card's frame and title, and
  ``st.skeleton`` holds its slot while ``@st.fragment(parallel=True)`` cards
  compute concurrently.
- ``st.metric`` cards compare the scenario with the plan, an ECharts fan chart
  shows the 50% and 80% ranges, and a tornado chart shows what moves profit.
- Scenarios are saved from an ``@st.dialog`` form into Session State, and a
  ``ButtonColumn`` loads one back into the levers.
- The ``warm-editorial`` light/dark theme in ``.streamlit/config.toml`` sets
  the fonts and the chart palette; the charts take their colors from it.

All data is synthetic. Replace ``model.load_history`` with your own query and
fit the ``model.Product`` parameters from your data.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Any, Literal

import model
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Demand simulator",
    page_icon=":material/model_training:",
    layout="wide",
)

KPI_HEIGHT = 178
CHART_HEIGHT = 340
LOAD = ":material/upload: Load"
DELETE = ":material/delete: Delete"


def money(value: float) -> str:
    sign = "-" if value < 0 else ""
    value = abs(value)
    if value >= 1e6:
        return f"{sign}${value / 1e6:.2f}M"
    return f"{sign}${value / 1e3:.0f}k"


def pct_change(new: float, old: float) -> float:
    return (new - old) / abs(old) * 100 if old else 0.0


def fan_chart(
    history: pd.DataFrame, forecast: model.Forecast, *, promo: bool
) -> dict[str, Any]:
    """Recent actuals, then the median forecast with its 50% and 80% ranges.

    Each range is a translucent area stacked on a hidden line at its lower
    quantile. The range series share the median's name, so they share its color.
    """
    weekly = forecast.weekly
    # Send only the columns the chart draws: the dataset reaches the browser.
    bands = weekly[["week", "P10", "P25", "P50", "P75", "P90", "Supply"]]
    data = pd.concat(
        [
            history,
            bands.assign(
                outer=weekly["P90"] - weekly["P10"],
                inner=weekly["P75"] - weekly["P25"],
            ),
        ],
        ignore_index=True,
    )
    # Start the median at the last actual week, so the two lines join.
    data.loc[len(history) - 1, "P50"] = history["Actual"].iloc[-1]

    line = {"type": "line", "showSymbol": False, "smooth": 0.25}
    band = {
        **line,
        "name": "Forecast",
        "stackStrategy": "all",
        "silent": True,
        "tooltip": {"show": False},
        "lineStyle": {"width": 0},
    }
    median: dict[str, Any] = {
        **line,
        "name": "Forecast",
        "encode": {
            "x": "week",
            "y": "P50",
            "tooltip": ["P90", "P75", "P50", "P25", "P10"],
        },
        "lineStyle": {"width": 2.5},
    }
    if promo:
        start = weekly["week"].iloc[model.PROMO_WEEKS[0]]
        end = weekly["week"].iloc[model.PROMO_WEEKS[1]] + pd.Timedelta(days=6)
        median["markArea"] = {
            "silent": True,
            # The area takes the median's color, so keep it faint.
            "itemStyle": {"opacity": 0.1},
            "label": {"formatter": "Promo", "position": "top"},
            "data": [[{"xAxis": start.isoformat()}, {"xAxis": end.isoformat()}]],
        }
    return {
        "dataset": {"source": data},
        "legend": {"data": ["Actual", "Forecast", "Supply"]},
        "tooltip": {"trigger": "axis", "valueFormatter": "%,d units"},
        "xAxis": {"type": "time"},
        "yAxis": {"type": "value"},
        "series": [
            {**line, "name": "Actual", "encode": {"x": "week", "y": "Actual"}},
            {**band, "stack": "outer", "encode": {"x": "week", "y": "P10"}},
            {
                **band,
                "stack": "outer",
                "encode": {"x": "week", "y": "outer"},
                "areaStyle": {"opacity": 0.14},
            },
            {**band, "stack": "inner", "encode": {"x": "week", "y": "P25"}},
            {
                **band,
                "stack": "inner",
                "encode": {"x": "week", "y": "inner"},
                "areaStyle": {"opacity": 0.18},
            },
            median,
            {
                **line,
                "name": "Supply",
                "encode": {"x": "week", "y": "Supply"},
                "smooth": False,
                "lineStyle": {"type": "dotted"},
            },
        ],
    }


def tornado_chart(swings: pd.DataFrame) -> dict[str, Any]:
    """Profit change per lever, with the biggest swing on top."""
    # Each lever gets a bar per direction from zero: both moves can cut profit.
    rows = swings.assign(swing=swings[["down", "up"]].abs().max(axis=1))
    rows = rows.sort_values("swing")

    def bars(direction: str) -> list[dict[str, Any] | None]:
        # A lever already at its limit can't move further, so it gets no bar.
        return [
            {
                "value": round(row[direction]),
                "label": {
                    "formatter": row[f"{direction}_label"],
                    "position": "right" if row[direction] > 0 else "left",
                },
            }
            if round(row[direction])
            else None
            for row in rows.to_dict("records")
        ]

    # A symmetric axis with room on both sides keeps the bar labels inside.
    limit = float(rows[["down", "up"]].abs().to_numpy().max() or 1) * 1.6
    return {
        "legend": {},
        "tooltip": {"trigger": "axis", "valueFormatter": "dollar"},
        "xAxis": {"type": "value", "min": -limit, "max": limit, "show": False},
        "yAxis": {"type": "category", "data": rows["lever"].tolist()},
        "series": [
            {
                "type": "bar",
                "name": name,
                "barGap": "10%",
                "barCategoryGap": "30%",
                "data": bars(direction),
                "label": {"show": True},
            }
            for name, direction in (("Lever down", "down"), ("Lever up", "up"))
        ],
    }


def current_levers() -> model.Levers:
    state = st.session_state
    return model.Levers(
        product=state.product,
        price_change=int(state.price),
        promo=int(state.promo),
        marketing=float(state.marketing),
        supply=int(state.supply),
    )


def apply_levers(levers: model.Levers) -> None:
    # Assigning keys in a callback updates keyed and URL-bound widgets.
    st.session_state.product = levers.product
    st.session_state.price = levers.price_change
    st.session_state.promo = levers.promo
    st.session_state.marketing = levers.marketing
    st.session_state.supply = levers.supply


def reset_levers() -> None:
    apply_levers(model.plan_for(st.session_state.product))


def saved_scenarios(product: str) -> list[tuple[str, model.Levers]]:
    """Scenarios saved in this session for ``product``, starting with two examples."""
    scenarios: dict[str, list[tuple[str, model.Levers]]]
    scenarios = st.session_state.setdefault("scenarios", {})
    if product not in scenarios:
        plan = model.plan_for(product)
        push = replace(plan, promo=20, marketing=plan.marketing + 10, supply=115)
        scenarios[product] = [("Plan", plan), ("Holiday push", push)]
    return scenarios[product]


def handle_scenario_action() -> None:
    click = st.session_state.scenario_action
    scenarios = saved_scenarios(st.session_state.product)
    name, levers = scenarios[click.row]
    if click.label == LOAD:
        apply_levers(levers)
        st.toast(f"Loaded **{name}** into the levers", icon=":material/upload:")
    else:
        del scenarios[click.row]
        st.toast(f"Deleted **{name}**", icon=":material/delete:")


@st.dialog("Save scenario", icon=":material/bookmark_add:")
def save_dialog(levers: model.Levers) -> None:
    st.caption(levers.describe())
    # A form submits on Enter or on the button, with the name already applied.
    with st.form("save_form", border=False):
        name = st.text_input(
            "Name", placeholder="Black Friday push", max_chars=40, key="scenario_name"
        ).strip()
        submitted = st.form_submit_button(
            "Save", type="primary", icon=":material/check:", key="save_confirm"
        )
    if submitted and name:
        saved_scenarios(levers.product).append((name, levers))
        st.toast(f"Saved **{name}**", icon=":material/bookmark_added:")
        st.rerun()
    elif submitted:
        st.error("Enter a name for the scenario.", icon=":material/error:")


def card_header(title: str, caption: str) -> None:
    with st.container(gap=None):
        st.markdown(f"**{title}**")
        st.caption(caption)


# (Label, Summary field, icon, sparkline type) of each KPI card.
KPIS: list[tuple[str, str, str, Literal["bar", "area"]]] = [
    ("Units sold", "units", ":material/shopping_bag:", "area"),
    ("Revenue", "revenue", ":material/payments:", "area"),
    ("Profit", "profit", ":material/savings:", "area"),
    ("Stockout risk", "stockout_risk", ":material/inventory_2:", "bar"),
]


@st.fragment(parallel=True)
def kpi_row(levers: model.Levers) -> None:
    forecast = model.simulate(levers)
    plan = model.simulate(model.plan_for(levers.product)).summary
    with st.container(horizontal=True):
        for label, field, icon, chart_type in KPIS:
            now, then = getattr(forecast.summary, field), getattr(plan, field)
            if field == "stockout_risk":
                value = f"{now:.0%}"
                change = (now - then) * 100
                delta = f"{change:+.0f} pts"
            else:
                value = f"{now:,.0f}" if field == "units" else money(now)
                change = pct_change(now, then)
                delta = f"{change:+.1f}%"
            on_plan = abs(change) < 0.05
            delta_color: Literal["normal", "inverse", "gray"] = "normal"
            if on_plan:
                delta_color = "gray"
            elif field == "stockout_risk":
                # More stockout risk is bad, so its delta colors are inverted.
                delta_color = "inverse"
            st.metric(
                label,
                value,
                "On plan" if on_plan else delta,
                delta_color=delta_color,
                delta_arrow="off" if on_plan else "auto",
                delta_description=None if on_plan else "vs. plan",
                icon=icon,
                chart_data=forecast.weekly[field],
                chart_type=chart_type,
                border=True,
                height=KPI_HEIGHT,
            )


@st.fragment(parallel=True)
def fan_card(levers: model.Levers) -> None:
    st.echarts_chart(
        fan_chart(
            model.load_history(levers.product),
            model.simulate(levers),
            promo=levers.promo > 0,
        ),
        height=CHART_HEIGHT,
        alt=f"Weekly demand forecast for {levers.product.lower()} with 50% and 80% "
        "ranges, recent actuals, and supply",
    )


@st.fragment(parallel=True)
def tornado_card(levers: model.Levers) -> None:
    st.echarts_chart(
        tornado_chart(model.sensitivity(levers)),
        height=CHART_HEIGHT,
        alt="Change in median season profit when each lever moves down or up",
    )


with st.container(horizontal=True, vertical_alignment="center"):
    with st.container(gap=None):
        st.title("Demand simulator", icon=":material/model_training:", anchor=False)
        summary = st.empty()
    save = st.button("Save scenario", icon=":material/bookmark_add:", key="save")
    st.button(
        "Reset levers",
        icon=":material/restart_alt:",
        type="tertiary",
        key="reset",
        on_click=reset_levers,
        help="Back to the plan: list price, no promo, planned marketing and supply",
    )

product = st.segmented_control(
    "Product line",
    list(model.PRODUCTS),
    default="Jackets",
    required=True,
    key="product",
    bind="query-params",
    on_change=reset_levers,
    label_visibility="collapsed",
)
item = model.PRODUCTS[product]
promo_weeks = " and ".join(
    f"{week:%b} {week.day}" for week in model.forecast_weeks()[list(model.PROMO_WEEKS)]
)

with st.sidebar:
    st.markdown("**Scenario levers**")
    st.slider(
        "Price vs. list",
        *model.PRICE_RANGE,
        value=0,
        format="%+d%%",
        key="price",
        bind="query-params",
        help=f"List price is ${item.price:,.0f}.",
    )
    st.slider(
        "Black Friday promo",
        *model.PROMO_RANGE,
        value=0,
        step=5,
        format="%d%% off",
        key="promo",
        bind="query-params",
        help=f"Discount in the weeks of {promo_weeks}.",
    )
    st.slider(
        "Marketing per week",
        *model.MARKETING_RANGE,
        value=item.marketing,
        step=2.5,
        format="$%.1fk",
        key="marketing",
        bind="query-params",
        help=f"The plan spends ${item.marketing:g}k per week.",
    )
    st.slider(
        "Weekly supply",
        *model.SUPPLY_RANGE,
        value=100,
        step=5,
        format="%d%% of plan",
        key="supply",
        bind="query-params",
        help=f"The plan supplies {item.supply:,} units per week.",
    )
    st.caption("The levers live in the URL, so you can share this scenario.")

levers = current_levers()
start = model.AS_OF
summary.caption(
    f"{levers.describe()} · {model.HORIZON} weeks from "
    f"{start:%b} {start.day}, {start.year}"
)
if save:
    save_dialog(levers)

with st.skeleton(height=KPI_HEIGHT):
    kpi_row(levers)

fan_col, tornado_col = st.columns([3, 2])
with fan_col.container(border=True, height="stretch"):
    card_header(
        "Weekly demand",
        f"Median and 50% / 80% ranges of {model.SIMULATIONS:,} simulated seasons",
    )
    with st.skeleton(height=CHART_HEIGHT):
        fan_card(levers)
with tornado_col.container(border=True, height="stretch"):
    card_header(
        "What moves profit",
        "Median season profit change when each lever moves one step",
    )
    with st.skeleton(height=CHART_HEIGHT):
        tornado_card(levers)

plan_profit = model.simulate(model.plan_for(product)).summary.profit
rows = []
for name, saved in saved_scenarios(product):
    forecast = model.simulate(saved)
    outcome = forecast.summary
    rows.append(
        {
            "actions": [LOAD, DELETE],
            "name": name,
            "levers": saved.describe(),
            "revenue": round(outcome.revenue),
            "profit": round(outcome.profit),
            "vs_plan": pct_change(outcome.profit, plan_profit),
            "stockout_risk": outcome.stockout_risk * 100,
            "weekly_units": forecast.weekly["units"].round().tolist(),
        }
    )
with st.container(border=True):
    card_header(
        "Saved scenarios",
        f"Median outcomes of {model.SIMULATIONS:,} simulated seasons each. "
        "Load one to edit its levers.",
    )
    if not rows:
        st.caption("Set the levers and select **Save scenario** to compare them here.")
    else:
        st.dataframe(
            pd.DataFrame(rows),
            column_config={
                "actions": st.column_config.ButtonColumn(
                    "",
                    type="tertiary",
                    pinned=True,
                    key="scenario_action",
                    on_click=handle_scenario_action,
                ),
                "name": st.column_config.TextColumn("Scenario", pinned=True),
                "levers": st.column_config.TextColumn("Levers", width="large"),
                "revenue": st.column_config.NumberColumn("Revenue", format="dollar"),
                "profit": st.column_config.NumberColumn("Profit", format="dollar"),
                "vs_plan": st.column_config.NumberColumn(
                    "Profit vs. plan", format="%+.1f%%"
                ),
                "stockout_risk": st.column_config.ProgressColumn(
                    "Stockout risk", min_value=0, max_value=100, format="%.0f%%"
                ),
                "weekly_units": st.column_config.LineChartColumn(
                    "Weekly units", y_min=0
                ),
            },
            hide_index=True,
            alt="Saved scenarios with their median revenue, profit, and risk",
        )
