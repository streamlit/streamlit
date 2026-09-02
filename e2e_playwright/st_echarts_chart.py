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

"""E2E app script for st.echarts_chart.

Charts that are targeted individually below are wrapped in
``st.container(key=...)`` so a single locator reaches the chart together with
the surrounding element, and so the locators stay stable for charts rendered
without a ``key`` of their own.
"""

from __future__ import annotations

import json
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

# Seed the RNG so any generated data is deterministic across runs.
np.random.seed(0)

# ECharts plays entry animations on init, which makes canvas snapshots
# non-deterministic. Disable animations for the display charts we render.
_NO_ANIM: dict[str, Any] = {"animation": False}

# Keep charts short so snapshots aren't clipped by the app header.
_HEIGHT = 300


class _FakeEChart:
    """A minimal pyecharts-like object that exposes ``dump_options``.

    ``st.echarts_chart`` detects pyecharts charts via duck typing (a callable
    ``dump_options`` method), so this stands in for pyecharts without importing
    it (pyecharts is not installed in this environment).
    """

    def __init__(self, spec: dict[str, Any]) -> None:
        self._spec = spec

    def dump_options(self) -> str:
        return json.dumps(self._spec)


# 1) Basic bar chart with the Streamlit theme (display only).
with st.container(key="c_basic_bar"):
    st.echarts_chart(
        {
            "xAxis": {"type": "category", "data": ["A", "B", "C", "D", "E"]},
            "yAxis": {"type": "value"},
            "series": [{"type": "bar", "data": [5, 20, 36, 10, 10]}],
            **_NO_ANIM,
        },
        key="basic_bar",
        height=_HEIGHT,
    )

# An unrelated widget: clicking it reruns the app. Used to verify that a
# display-only chart is not remounted / duplicated / reset by unrelated reruns.
if st.button("rerun helper"):
    st.write("rerun helper clicked")

# 2) A chart with theme=None (uses ECharts' built-in default theme; the spec is
#    left untouched).
st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": ["A", "B", "C", "D", "E"]},
        "yAxis": {"type": "value"},
        "series": [{"type": "bar", "data": [10, 22, 28, 15, 30]}],
        **_NO_ANIM,
    },
    theme=None,
    key="none_theme",
    height=_HEIGHT,
)

# 3) Multi-series line chart with a tooltip and a legend (themed defaults).
with st.container(key="c_line_multi"):
    st.echarts_chart(
        {
            "tooltip": {"trigger": "axis"},
            "legend": {"data": ["Revenue", "Cost"]},
            "xAxis": {"type": "category", "data": ["Q1", "Q2", "Q3", "Q4"]},
            "yAxis": {"type": "value"},
            "series": [
                {"name": "Revenue", "type": "line", "data": [820, 932, 901, 934]},
                {"name": "Cost", "type": "line", "data": [500, 610, 550, 700]},
            ],
            **_NO_ANIM,
        },
        key="line_multi",
        height=_HEIGHT,
    )

# 4) A gauge chart (a chart type not available in Plotly/Vega).
with st.container(key="c_gauge"):
    st.echarts_chart(
        {
            "series": [
                {
                    "type": "gauge",
                    "progress": {"show": True},
                    "detail": {"formatter": "{value}%"},
                    "data": [{"value": 72, "name": "Utilization"}],
                }
            ],
            **_NO_ANIM,
        },
        key="gauge",
        height=_HEIGHT,
    )

# 4b) A radar chart (a non-cartesian coordinate system). Guards against the
#     radar split-area / axis-name theming regressing in dark mode.
with st.container(key="c_radar"):
    st.echarts_chart(
        {
            "legend": {"data": ["Allocated", "Actual"]},
            "radar": {
                "indicator": [
                    {"name": "Sales", "max": 6500},
                    {"name": "Admin", "max": 16000},
                    {"name": "Tech", "max": 30000},
                    {"name": "Support", "max": 38000},
                    {"name": "Dev", "max": 52000},
                    {"name": "Marketing", "max": 25000},
                ]
            },
            "series": [
                {
                    "type": "radar",
                    "data": [
                        {
                            "value": [4200, 3000, 20000, 35000, 50000, 18000],
                            "name": "Allocated",
                        },
                        {
                            "value": [5000, 14000, 28000, 26000, 42000, 21000],
                            "name": "Actual",
                        },
                    ],
                }
            ],
            **_NO_ANIM,
        },
        key="radar",
        height=_HEIGHT,
    )

# 5) A chart driven by a pandas DataFrame passed as dataset.source.
dataset_df = pd.DataFrame(
    {
        "product": ["Matcha", "Milk Tea", "Cocoa"],
        "2015": [43.3, 83.1, 86.4],
        "2016": [85.8, 73.4, 65.2],
    }
)
st.echarts_chart(
    {
        "legend": {},
        "tooltip": {},
        "dataset": {"source": dataset_df},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [{"type": "bar"}, {"type": "bar"}],
        **_NO_ANIM,
    },
    key="dataset_df",
    height=_HEIGHT,
)

# 6) A chart built from a JSON string input.
st.echarts_chart(
    json.dumps(
        {
            "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
            "yAxis": {"type": "value"},
            "series": [{"type": "line", "data": [120, 200, 150, 80, 70]}],
            **_NO_ANIM,
        }
    ),
    key="json_string",
    height=_HEIGHT,
)

# 7) A chart built from an inline pyecharts-like object (dump_options()).
st.echarts_chart(
    _FakeEChart(
        {
            "xAxis": {"type": "category", "data": ["Shirts", "Cardigans", "Chiffon"]},
            "yAxis": {"type": "value"},
            "series": [{"type": "bar", "data": [40, 30, 20]}],
            **_NO_ANIM,
        }
    ),
    key="pyecharts_like",
    height=_HEIGHT,
)

# 8) A chart rendered with the SVG renderer (produces real DOM <svg> nodes).
with st.container(key="c_svg_renderer"):
    st.echarts_chart(
        {
            "xAxis": {"type": "category", "data": ["A", "B", "C", "D"]},
            "yAxis": {"type": "value"},
            "series": [{"type": "bar", "data": [8, 16, 24, 12]}],
            **_NO_ANIM,
        },
        renderer="svg",
        key="svg_renderer",
        height=_HEIGHT,
    )

# 9) Custom colors: an explicit series color that must survive Streamlit theming.
with st.container(key="c_custom_colors"):
    st.echarts_chart(
        {
            "xAxis": {"type": "category", "data": ["A", "B", "C", "D"]},
            "yAxis": {"type": "value"},
            "series": [
                {
                    "type": "bar",
                    "data": [5, 20, 36, 10],
                    "itemStyle": {"color": "#ff00ff"},
                }
            ],
            **_NO_ANIM,
        },
        key="custom_colors",
        height=_HEIGHT,
    )

# 10) A chart with a dataZoom component (a mixed interaction component).
st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": [str(i) for i in range(20)]},
        "yAxis": {"type": "value"},
        "dataZoom": [{"type": "slider", "start": 0, "end": 50}],
        "series": [{"type": "line", "data": [(i * 7) % 23 + 5 for i in range(20)]}],
        **_NO_ANIM,
    },
    key="datazoom",
    height=_HEIGHT,
)

# 11) A selection chart (a widget). Point selection is enabled in the spec via
#     `selectedMode`, with a `select` style so the selection is visible. A
#     single, chart-filling bar makes a point-click land reliably on the item.
selection_event = st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": ["Selected"]},
        "yAxis": {"type": "value", "max": 100},
        "series": [
            {
                "type": "bar",
                "data": [100],
                "barWidth": "90%",
                "selectedMode": "multiple",
                "select": {"itemStyle": {"color": "#ff4b4b"}},
            }
        ],
        "animation": False,
    },
    key="selection_chart",
    on_select="rerun",
    height=_HEIGHT,
)
selection_groups = selection_event["selection"]["selected"]
selection_indices = selection_groups[0]["data_indices"] if selection_groups else []
st.write(f"echarts selection groups: {len(selection_groups)}")
st.write(f"echarts selection indices: {selection_indices}")

# 12) A tooltip/label XSS payload: the data item name is an HTML/script payload.
#     Under theme="streamlit" it must render as escaped text and never execute.
_XSS_PAYLOAD = "<img src=x onerror=alert(1)>"
_XSS_LINES_PAYLOAD = "<img src=x onerror=alert(2)>"
with st.container(key="c_xss_chart"):
    st.echarts_chart(
        {
            # Give the generated HTML tooltip a stable locator for the E2E test.
            "tooltip": {"trigger": "item", "className": "echarts-xss-tooltip"},
            "xAxis": {"type": "category", "data": ["payload"]},
            "yAxis": {"type": "value", "max": 100},
            "series": [
                {
                    "type": "bar",
                    "barWidth": "90%",
                    "data": [{"value": 100, "name": _XSS_PAYLOAD}],
                    # SVG text makes it possible to positively assert that the
                    # payload is rendered literally instead of interpreted as HTML.
                    "label": {"show": True, "formatter": "{b}"},
                },
            ],
            "animation": False,
        },
        theme="streamlit",
        renderer="svg",
        key="xss_chart",
        height=_HEIGHT,
    )

# 12b) The echarts@^6.1.0 advisory is in the ``series.type="lines"`` tooltip
#      path; exercise it on its own chart so hover cannot hit a bar instead.
with st.container(key="c_xss_lines_chart"):
    st.echarts_chart(
        {
            "tooltip": {
                "trigger": "item",
                "className": "echarts-xss-lines-tooltip",
            },
            "xAxis": {"type": "value", "min": 0, "max": 100, "show": False},
            "yAxis": {"type": "value", "min": 0, "max": 100, "show": False},
            "series": [
                {
                    "type": "lines",
                    "coordinateSystem": "cartesian2d",
                    "polyline": True,
                    "lineStyle": {"width": 24, "opacity": 1},
                    "data": [
                        {
                            "coords": [[0, 0], [100, 100]],
                            "name": _XSS_LINES_PAYLOAD,
                        }
                    ],
                },
            ],
            "animation": False,
        },
        theme="streamlit",
        renderer="svg",
        key="xss_lines_chart",
        height=_HEIGHT,
    )

# 13) A display-only chart inside a collapsed expander (remount scenario).
with st.expander("Chart in expander", expanded=False):
    with st.container(key="c_expander_chart"):
        st.echarts_chart(
            {
                "xAxis": {"type": "category", "data": ["A", "B", "C"]},
                "yAxis": {"type": "value"},
                "series": [{"type": "bar", "data": [12, 24, 18]}],
                **_NO_ANIM,
            },
            key="expander_chart",
            height=_HEIGHT,
        )

# 14) A selection chart inside a form (exercises the form_id / form-clear path).
with st.form("echarts_form"):
    form_event = st.echarts_chart(
        {
            "xAxis": {"type": "category", "data": ["Selected"]},
            "yAxis": {"type": "value", "max": 100},
            "series": [
                {
                    "type": "bar",
                    "data": [100],
                    "barWidth": "90%",
                    "selectedMode": "multiple",
                }
            ],
            "animation": False,
        },
        key="form_selection_chart",
        on_select="rerun",
        height=_HEIGHT,
    )
    st.form_submit_button("Submit selection")
st.write(f"echarts form groups: {len(form_event['selection']['selected'])}")
