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

Display-only ECharts charts currently do not have a stable element id (the id is
only computed when selections are active), so they do not emit a ``st-key-<key>``
CSS class. To keep test locators stable, charts that are targeted individually
below are wrapped in ``st.container(key=...)`` (the recommended fallback for
elements that are hard to target). Widget charts (``on_select="rerun"``) get a
real id and are targeted via their own ``key``.
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

    def __init__(self, options: dict[str, Any]) -> None:
        self._options = options

    def dump_options(self) -> str:
        return json.dumps(self._options)


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

# 2) A chart with theme=None (uses ECharts' built-in default theme; the options
#    are left untouched).
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

# 11) A selection chart (a widget). A single, chart-filling bar makes a
#     point-click land reliably on the series item.
selection_event = st.echarts_chart(
    {
        "xAxis": {"type": "category", "data": ["Selected"]},
        "yAxis": {"type": "value", "max": 100},
        "series": [{"type": "bar", "data": [100], "barWidth": "90%"}],
        "animation": False,
    },
    key="selection_chart",
    on_select="rerun",
    selection_mode=["points", "box", "lasso"],
    height=_HEIGHT,
)
st.write(f"echarts selection points: {len(selection_event['selection']['points'])}")
st.write(f"echarts selection indices: {selection_event['selection']['point_indices']}")

# 12) A tooltip XSS payload: the data item name is an HTML/script payload. Under
#     theme="streamlit" it must render as escaped text and never execute.
_XSS_PAYLOAD = "<img src=x onerror=alert(1)>"
with st.container(key="c_xss_chart"):
    st.echarts_chart(
        {
            "tooltip": {"trigger": "item"},
            "xAxis": {"type": "category", "data": ["payload"]},
            "yAxis": {"type": "value", "max": 100},
            "series": [
                {
                    "type": "bar",
                    "barWidth": "90%",
                    "data": [{"value": 100, "name": _XSS_PAYLOAD}],
                }
            ],
            "animation": False,
        },
        theme="streamlit",
        key="xss_chart",
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
            "series": [{"type": "bar", "data": [100], "barWidth": "90%"}],
            "animation": False,
        },
        key="form_selection_chart",
        on_select="rerun",
        selection_mode=["points"],
        height=_HEIGHT,
    )
    st.form_submit_button("Submit selection")
st.write(f"echarts form points: {len(form_event['selection']['points'])}")
