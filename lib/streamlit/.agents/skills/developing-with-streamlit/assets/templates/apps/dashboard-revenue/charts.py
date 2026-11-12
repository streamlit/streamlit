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

"""Apache ECharts option builders for the revenue dashboard.

Every option leaves series colors to Streamlit's ECharts theme, which reads
``chartCategoricalColors`` from ``.streamlit/config.toml``. Series keep a fixed
order, so a filter that removes a plan hides its data instead of repainting the
other plans. Charts read a dataframe from ``dataset.source``, which Streamlit
sends as Arrow and shows under **Show data** in the chart toolbar.
"""

from __future__ import annotations

from typing import Any

import data
import pandas as pd

_LEGEND = {"top": 0, "left": 0, "icon": "roundRect", "itemWidth": 10, "itemHeight": 10}
_GRID = {"left": 4, "right": 12, "top": 36, "bottom": 4}
# Gray for annotation lines and areas. Their labels set no color, so ECharts
# draws dark text in the light theme and light text in the dark theme.
_MARKER_GRAY = "#8E90A2"


def _month_labels(index: pd.Index) -> pd.Index:
    return pd.DatetimeIndex(index).strftime("%b %y")


def money(value: float) -> str:
    """Format a dollar amount compactly, for example ``$4.82M`` or ``$812K``."""
    sign = "-" if value < 0 else ""
    value = abs(value)
    if value >= 1_000_000:
        return f"{sign}${value / 1_000_000:.2f}M"
    if value >= 10_000:
        return f"{sign}${value / 1_000:.0f}K"
    if value >= 1_000:
        return f"{sign}${value / 1_000:.1f}K"
    return f"{sign}${value:,.0f}"


def _markers(
    milestones: list[tuple[pd.Timestamp, str]], forecast: tuple[str, str] | None
) -> dict[str, Any]:
    """An empty series that draws milestone lines and a shaded forecast range.

    It has an explicit color, so it doesn't take a palette slot from the data
    series, and no data, so the dataset stays the chart's real data.
    """
    series: dict[str, Any] = {
        "name": "Markers",
        "type": "line",
        "data": [],
        "silent": True,
        "itemStyle": {"color": _MARKER_GRAY},
        "tooltip": {"show": False},
    }
    if milestones:
        labels = _month_labels(pd.DatetimeIndex([month for month, _ in milestones]))
        series["markLine"] = {
            "silent": True,
            "symbol": ["none", "none"],
            "lineStyle": {"color": _MARKER_GRAY, "type": "dashed", "opacity": 0.8},
            "label": {"position": "insideEndTop", "fontSize": 11, "formatter": "{b}"},
            "data": [
                {"name": text, "xAxis": label}
                for label, (_, text) in zip(labels, milestones, strict=True)
            ],
        }
    if forecast:
        series["markArea"] = {
            "silent": True,
            "itemStyle": {"color": "rgba(142, 144, 162, 0.14)"},
            # Above the area: a label inside a translucent area gets light text,
            # even in the light theme.
            "label": {"position": "top", "fontSize": 11},
            "data": [
                [{"name": "Forecast", "xAxis": forecast[0]}, {"xAxis": forecast[1]}]
            ],
        }
    return series


def mrr_growth(
    monthly: pd.DataFrame,
    active_plans: tuple[str, ...],
    *,
    share: bool,
    forecast: pd.DataFrame | None,
    milestones: list[tuple[pd.Timestamp, str]],
) -> dict[str, Any]:
    """Stacked area of MRR (in $K, or % share) per plan over time.

    ``forecast`` appends projected months under a shaded range, and
    ``milestones`` draws a labeled line at each milestone's month.
    """
    combined = monthly if forecast is None else pd.concat([monthly, forecast])
    values = combined[list(active_plans)]
    if share:
        values = values.div(values.sum(axis=1).replace(0, 1), axis=0) * 100
    else:
        values /= 1_000
    # A plan removed by the filter keeps its column (and color slot) but has no
    # values, so it draws nothing.
    source = values.reindex(columns=data.PLANS).round(1).reset_index(drop=True)
    labels = _month_labels(combined.index)
    source.insert(0, "month", labels)
    series: list[dict[str, Any]] = [
        {
            "name": plan,
            "type": "line",
            "stack": "mrr",
            "smooth": 0.35,
            "showSymbol": False,
            "lineStyle": {"width": 2},
            "areaStyle": {"opacity": 0.22},
            "emphasis": {"focus": "series"},
            "encode": {"x": "month", "y": plan},
        }
        for plan in data.PLANS
    ]
    forecast_range = (
        (labels[len(monthly)], labels[-1]) if forecast is not None else None
    )
    series.append(_markers(milestones, forecast_range))
    return {
        "dataset": {"source": source},
        "tooltip": {
            "trigger": "axis",
            "valueFormatter": "%.1f%%" if share else "$%,.1fK",
        },
        # The markers series stays out of the legend.
        "legend": {**_LEGEND, "data": data.PLANS},
        "grid": _GRID,
        "xAxis": {
            "type": "category",
            "boundaryGap": False,
            "axisTick": {"show": False},
        },
        "yAxis": {
            "type": "value",
            "max": 100 if share else None,
            "axisLabel": {"formatter": "{value}%" if share else "${value}K"},
            "splitLine": {"lineStyle": {"opacity": 0.6}},
        },
        "series": series,
    }


def mrr_bridge(movements: dict[str, float]) -> dict[str, Any]:
    """Waterfall from starting to ending MRR, in $K."""
    steps = [
        ("Start", movements["start"], "total"),
        ("New", movements["new"], "increase"),
        ("Expand", movements["expansion"], "increase"),
        ("Contract", -movements["contraction"], "decrease"),
        ("Churn", -movements["churn"], "decrease"),
        ("End", movements["end"], "total"),
    ]
    rows = []
    level = 0.0
    # ``base`` is where each bar starts, and ``level`` the running MRR after it.
    for name, amount, kind in steps:
        if kind == "total":
            base, level = 0.0, amount
        elif kind == "increase":
            base, level = level, level + amount
        else:
            base, level = level + amount, level + amount
        height = round(abs(amount) / 1_000, 1)
        rows.append(
            {
                "step": name,
                "Base": round(base / 1_000, 1),
                # Each step fills only the column of its own kind.
                "MRR": height if kind == "total" else None,
                "Gain": height if kind == "increase" else None,
                "Loss": height if kind == "decrease" else None,
                # Precomputed because labels can't apply a number format.
                "change": money(amount),
            }
        )
    bar = {"type": "bar", "stack": "bridge", "barWidth": "56%"}
    return {
        "dataset": {"source": pd.DataFrame(rows)},
        "tooltip": {"trigger": "item"},
        "legend": {**_LEGEND, "data": ["MRR", "Gain", "Loss"]},
        "grid": {**_GRID, "top": 44},
        "xAxis": {
            "type": "category",
            "axisTick": {"show": False},
            "axisLabel": {"interval": 0},
        },
        "yAxis": {"type": "value", "axisLabel": {"formatter": "${value}K"}},
        "series": [
            {
                # Transparent spacer that lifts the floating bars. A series with
                # an explicit color doesn't take a palette slot.
                **bar,
                "name": "Base",
                "itemStyle": {"color": "transparent"},
                "emphasis": {"disabled": True},
                "tooltip": {"show": False},
                "silent": True,
                "encode": {"x": "step", "y": "Base"},
            },
            *(
                {
                    **bar,
                    "name": name,
                    "label": {
                        "show": True,
                        "position": "top",
                        "formatter": "{@change}",
                    },
                    "tooltip": {"formatter": "{b}: {@change}"},
                    "encode": {"x": "step", "y": name},
                }
                for name in ("MRR", "Gain", "Loss")
            ),
        ],
    }


def industry_mix(mrr_by_industry: pd.Series) -> dict[str, Any]:
    """Selectable donut of MRR by industry, with the total in the center."""
    source = (mrr_by_industry / 1_000).round(1).rename("mrr").rename_axis("industry")
    return {
        "dataset": {"source": source.reset_index()},
        "tooltip": {"trigger": "item", "formatter": "{b}: ${@mrr}K ({d}%)"},
        "legend": {"bottom": 0, "icon": "circle", "itemWidth": 8, "itemHeight": 8},
        "title": {
            "text": money(mrr_by_industry.sum()),
            "subtext": "MRR",
            "left": "center",
            "top": "34%",
            "textStyle": {"fontSize": 22, "fontWeight": 600},
        },
        "series": [
            {
                "name": "Industry",
                "type": "pie",
                "radius": ["58%", "80%"],
                "center": ["50%", "42%"],
                "padAngle": 2,
                "itemStyle": {"borderRadius": 6},
                "label": {"show": False},
                "selectedMode": "single",
                "selectedOffset": 8,
                "encode": {"itemName": "industry", "value": "mrr"},
            }
        ],
    }


def account_mrr(history: pd.Series) -> dict[str, Any]:
    """Single-series MRR history for the account drawer."""
    active = history[history > 0]
    if active.empty:
        active = history.tail(12)
    source = active.round().rename("mrr").reset_index(drop=True).to_frame()
    source.insert(0, "month", _month_labels(active.index))
    return {
        "dataset": {"source": source},
        "tooltip": {"trigger": "axis", "valueFormatter": "$%,d"},
        "grid": {"left": 4, "right": 8, "top": 12, "bottom": 4},
        "xAxis": {
            "type": "category",
            "boundaryGap": False,
            "axisTick": {"show": False},
        },
        "yAxis": {
            "type": "value",
            "axisLabel": {"formatter": "${value}"},
            "scale": True,
        },
        "series": [
            {
                "name": "MRR",
                "type": "line",
                "smooth": 0.3,
                # A single month draws no line, so show its point.
                "showSymbol": len(source) == 1,
                "lineStyle": {"width": 2.5},
                "areaStyle": {"opacity": 0.16},
                "encode": {"x": "month", "y": "mrr"},
            }
        ],
    }
