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

"""Deterministic BI dashboard app used by the focused performance suite."""

from __future__ import annotations

import json
import time
from itertools import pairwise
from typing import Any, Literal

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

_Renderer = Literal["vega", "echarts"]
_NORMAL_ROWS = 10_002
_ALLOWED_ROWS = {1_002, _NORMAL_ROWS, 100_002}
_REGIONS = ("AMER", "APJ", "EMEA")
_SEGMENTS = ("Enterprise", "Commercial", "SMB", "Startup")
_PRODUCTS = ("Apps", "Compute", "Data", "ML", "Sharing", "Storage")
_CHART_HEIGHT = 220

alt.data_transformers.disable_max_rows()


@st.cache_data(max_entries=3)
def _generate_rows(row_count: int) -> pd.DataFrame:
    """Create deterministic local usage rows with realistic BI dimensions."""
    index = np.arange(row_count, dtype=np.int64)
    timestamps = pd.Timestamp("2025-10-01") + pd.to_timedelta(
        index % (365 * 24), unit="h"
    )
    region_index = index % len(_REGIONS)
    segment_index = (index // len(_REGIONS)) % len(_SEGMENTS)
    product_index = (index // (len(_REGIONS) * len(_SEGMENTS))) % len(_PRODUCTS)
    seasonal = np.sin(index / 41.0) + np.cos(index / 113.0)
    return pd.DataFrame(
        {
            "ts": timestamps,
            "region": np.take(_REGIONS, region_index),
            "segment": np.take(_SEGMENTS, segment_index),
            "product": np.take(_PRODUCTS, product_index),
            "credits": np.round(
                14.0 + region_index * 2.5 + product_index * 1.2 + seasonal * 2.1,
                4,
            ),
            "jobs": 2 + ((index * 17 + segment_index * 5) % 31),
            "latency_ms": np.round(
                70.0 + product_index * 8.0 + segment_index * 4.0 + seasonal * 6.0,
                1,
            ),
        }
    )


def _query_value(name: str, default: str) -> str:
    value = st.query_params.get(name, default)
    return value if isinstance(value, str) else value[0]


def _filter_rows(
    rows: pd.DataFrame,
    *,
    regions: list[str] | None = None,
    start: pd.Timestamp | None = None,
    end: pd.Timestamp | None = None,
) -> pd.DataFrame:
    filtered = rows
    if regions:
        filtered = filtered[filtered["region"].isin(regions)]
    if start is not None:
        filtered = filtered[filtered["ts"] >= start]
    if end is not None:
        filtered = filtered[filtered["ts"] <= end]
    return filtered


def _apply_named_range(rows: pd.DataFrame, range_name: str) -> pd.DataFrame:
    if range_name == "All":
        return rows
    days = {"1M": 30, "3M": 90, "6M": 180}[range_name]
    return rows[rows["ts"] >= rows["ts"].max() - pd.Timedelta(days=days)]


def _daily_series(
    rows: pd.DataFrame, value: str, *, dimension: str = "region"
) -> pd.DataFrame:
    return (
        rows.assign(day=rows["ts"].dt.floor("D"))
        .groupby(["day", dimension], observed=True)[[value]]
        .sum()
        .reset_index()
        .rename(columns={"day": "ts"})
    )


def _category_series(rows: pd.DataFrame, category: str, value: str) -> pd.DataFrame:
    return (
        rows.groupby(category, observed=True)[[value]]
        .sum()
        .reset_index()
        .sort_values(category)
    )


def _render_line(
    data: pd.DataFrame,
    *,
    x: str,
    y: str,
    series: str,
    renderer: _Renderer,
    key: str,
    alt_text: str,
) -> None:
    if renderer == "vega":
        chart = (
            alt.Chart(data)
            .mark_line()
            .encode(
                x=alt.X(f"{x}:T"),
                y=alt.Y(f"{y}:Q"),
                color=alt.Color(f"{series}:N"),
                tooltip=alt.value(None),
            )
            .properties(height=_CHART_HEIGHT)
        )
        st.altair_chart(chart, key=key, width="stretch", alt=alt_text)
        return

    timestamps = [pd.Timestamp(value) for value in sorted(data[x].unique())]
    categories = [timestamp.isoformat() for timestamp in timestamps]
    chart_series = []
    for series_name, group in data.groupby(series, observed=True):
        values_by_timestamp = dict(zip(group[x], group[y], strict=True))
        chart_series.append(
            {
                "name": str(series_name),
                "type": "line",
                "showSymbol": False,
                "connectNulls": True,
                "data": [
                    (
                        float(values_by_timestamp[timestamp])
                        if timestamp in values_by_timestamp
                        else None
                    )
                    for timestamp in timestamps
                ],
            }
        )
    st.echarts_chart(
        {
            "animation": False,
            "legend": {"type": "scroll"},
            "tooltip": {"trigger": "axis"},
            "xAxis": {"type": "category", "data": categories},
            "yAxis": {"type": "value"},
            "series": chart_series,
        },
        key=key,
        height=_CHART_HEIGHT,
        alt=alt_text,
    )


def _render_bar(
    data: pd.DataFrame,
    *,
    category: str,
    value: str,
    renderer: _Renderer,
    key: str,
    alt_text: str,
) -> None:
    if renderer == "vega":
        chart = (
            alt.Chart(data)
            .mark_bar()
            .encode(
                x=alt.X(f"{category}:N", sort=None),
                y=alt.Y(f"{value}:Q"),
                tooltip=alt.value(None),
            )
            .properties(height=_CHART_HEIGHT)
        )
        st.altair_chart(chart, key=key, width="stretch", alt=alt_text)
        return

    st.echarts_chart(
        {
            "animation": False,
            "xAxis": {"type": "category", "data": data[category].astype(str).tolist()},
            "yAxis": {"type": "value"},
            "series": [{"type": "bar", "data": data[value].astype(float).tolist()}],
        },
        key=key,
        height=_CHART_HEIGHT,
        alt=alt_text,
    )


def _render_histogram(rows: pd.DataFrame, *, renderer: _Renderer, key: str) -> None:
    counts, edges = np.histogram(rows["latency_ms"], bins=20)
    histogram = pd.DataFrame(
        {
            "latency": [f"{left:.0f}-{right:.0f}" for left, right in pairwise(edges)],
            "events": counts,
        }
    )
    _render_bar(
        histogram,
        category="latency",
        value="events",
        renderer=renderer,
        key=key,
        alt_text="Event count by latency bucket",
    )


def _render_kpis(rows: pd.DataFrame) -> None:
    with st.container(horizontal=True, key="bi_kpis"):
        st.metric("Credits", f"{rows['credits'].sum():,.0f}", border=True)
        st.metric("Jobs", f"{rows['jobs'].sum():,.0f}", border=True)
        st.metric("Average latency", f"{rows['latency_ms'].mean():.1f} ms", border=True)
        st.metric("Events", f"{len(rows):,}", border=True)


def _render_tile(title: str, key: str) -> Any:
    container = st.container(border=True, key=key)
    container.subheader(title)
    return container


def _render_executive_dashboard(
    rows: pd.DataFrame, renderer: _Renderer
) -> tuple[pd.DataFrame, dict[str, Any]]:
    st.header("Executive overview")
    _render_kpis(rows)

    left, right = st.columns(2)
    with left:
        tile = _render_tile("Credits over time", "tile_credits_time")
        with tile:
            range_name = st.segmented_control(
                "Range",
                ["All", "1M", "3M", "6M"],
                default="All",
                key="executive_range",
            )
            selected_regions = st.pills(
                "Series",
                list(_REGIONS),
                default=list(_REGIONS),
                selection_mode="multi",
                key="executive_series",
            )
            chart_tab, preview_tab = st.tabs(
                ["Chart", "Data preview"],
                key="executive_preview_tabs",
                on_change="rerun",
            )
            visible_rows = _apply_named_range(rows, range_name or "All")
            visible_rows = _filter_rows(
                visible_rows,
                regions=list(selected_regions) if selected_regions else [],
            )
            if chart_tab.open:
                with chart_tab:
                    _render_line(
                        _daily_series(visible_rows, "credits"),
                        x="ts",
                        y="credits",
                        series="region",
                        renderer=renderer,
                        key="executive_credits_time_chart",
                        alt_text="Daily credits by region",
                    )
            if preview_tab.open:
                with preview_tab:
                    st.dataframe(
                        visible_rows,
                        key="executive_preview",
                        hide_index=True,
                        alt="Filtered usage-event preview",
                    )

        tile = _render_tile("Credits by region", "tile_credits_region")
        with tile:
            _render_bar(
                _category_series(rows, "region", "credits"),
                category="region",
                value="credits",
                renderer=renderer,
                key="executive_credits_region_chart",
                alt_text="Credits by region",
            )

        tile = _render_tile("Jobs by segment", "tile_jobs_segment")
        with tile:
            _render_bar(
                _category_series(rows, "segment", "jobs"),
                category="segment",
                value="jobs",
                renderer=renderer,
                key="executive_jobs_segment_chart",
                alt_text="Jobs by segment",
            )

        tile = _render_tile("Latency distribution", "tile_latency_histogram")
        with tile:
            _render_histogram(
                rows, renderer=renderer, key="executive_latency_histogram_chart"
            )

    with right:
        tile = _render_tile("Jobs over time", "tile_jobs_time")
        with tile:
            _render_line(
                _daily_series(rows, "jobs", dimension="segment"),
                x="ts",
                y="jobs",
                series="segment",
                renderer=renderer,
                key="executive_jobs_time_chart",
                alt_text="Daily jobs by segment",
            )

        tile = _render_tile("Credits by product", "tile_credits_product")
        with tile:
            _render_bar(
                _category_series(rows, "product", "credits"),
                category="product",
                value="credits",
                renderer=renderer,
                key="executive_credits_product_chart",
                alt_text="Credits by product",
            )

        tile = _render_tile("Latency over time", "tile_latency_time")
        with tile:
            latency_rows = (
                rows.groupby(["ts", "region"], observed=True)[["latency_ms"]]
                .mean()
                .reset_index()
            )
            _render_line(
                latency_rows,
                x="ts",
                y="latency_ms",
                series="region",
                renderer=renderer,
                key="executive_latency_time_chart",
                alt_text="Event latency over time by region",
            )

    state = {
        "range": range_name or "All",
        "series": list(selected_regions) if selected_regions else [],
        "preview_open": bool(preview_tab.open),
    }
    return visible_rows, state


def _selection_values(selection: Any, name: str) -> Any:
    try:
        return selection["selection"][name]
    except (KeyError, TypeError):
        return {}


def _selection_region(selection: Any) -> list[str]:
    value = _selection_values(selection, "region_pick")
    if isinstance(value, list):
        return [str(item["region"]) for item in value if "region" in item]
    return []


def _selection_window(
    selection: Any,
) -> tuple[pd.Timestamp | None, pd.Timestamp | None]:
    value = _selection_values(selection, "time_brush")
    if not isinstance(value, dict) or "ts" not in value:
        return None, None
    bounds = value["ts"]
    if not isinstance(bounds, list) or len(bounds) != 2:
        return None, None
    parsed_bounds = [
        pd.Timestamp(bound, unit="ms")
        if isinstance(bound, (int, float))
        else pd.Timestamp(bound)
        for bound in bounds
    ]
    return parsed_bounds[0], parsed_bounds[1]


def _clear_linked_filters() -> None:
    st.session_state.linked_generation = (
        int(st.session_state.get("linked_generation", 0)) + 1
    )


def _render_linked_dashboard(
    rows: pd.DataFrame, *, micro_gesture: str | None = None
) -> tuple[pd.DataFrame, dict[str, Any]]:
    generation = int(st.session_state.get("linked_generation", 0))
    if micro_gesture is None:
        st.header("Linked analysis")
        st.button(
            "Clear filters",
            key="linked_clear_filters",
            on_click=_clear_linked_filters,
        )
    else:
        st.header(f"Vega {micro_gesture} diagnostic")

    region_data = _category_series(rows, "region", "credits")
    region_pick = alt.selection_point(
        name="region_pick", fields=["region"], toggle=False
    )
    region_chart = (
        alt.Chart(region_data)
        .mark_bar()
        .encode(
            x=alt.X("region:N", sort=list(_REGIONS)),
            y=alt.Y("credits:Q"),
            fillOpacity=alt.condition(region_pick, alt.value(1), alt.value(0.35)),
            tooltip=alt.value(None),
        )
        .add_params(region_pick)
        .properties(height=280 if micro_gesture else _CHART_HEIGHT)
    )
    region_selection: Any = {"selection": {}}
    if micro_gesture != "brush":
        with st.container(border=micro_gesture is None, key="linked_region_tile"):
            if micro_gesture is None:
                st.subheader("Credits by region")
            region_selection = st.altair_chart(
                region_chart,
                on_select="rerun",
                selection_mode="region_pick",
                key=f"linked_region_{generation}",
                width="content",
                alt="Selectable credits by region",
            )

    selected_regions = _selection_region(region_selection)
    region_filtered = _filter_rows(rows, regions=selected_regions)
    brush_source = _daily_series(region_filtered, "jobs")
    time_brush = alt.selection_interval(name="time_brush", encodings=["x"])
    brush_chart = (
        alt.Chart(brush_source)
        .mark_line()
        .encode(
            x=alt.X("ts:T"),
            y=alt.Y("jobs:Q"),
            color=alt.Color("region:N"),
            tooltip=alt.value(None),
        )
        .add_params(time_brush)
        .properties(height=280 if micro_gesture else _CHART_HEIGHT)
    )
    brush_selection: Any = {"selection": {}}
    if micro_gesture != "point":
        with st.container(border=micro_gesture is None, key="linked_brush_tile"):
            if micro_gesture is None:
                st.subheader("Jobs over time")
            brush_selection = st.altair_chart(
                brush_chart,
                on_select="rerun",
                selection_mode="time_brush",
                key=f"linked_brush_{generation}",
                width="content",
                alt="Brush-selectable daily jobs",
            )

    start, end = _selection_window(brush_selection)
    filtered = _filter_rows(
        rows,
        regions=selected_regions,
        start=start,
        end=end,
    )
    if micro_gesture is None:
        _render_kpis(filtered)
        left, right = st.columns(2)
        with left:
            with _render_tile("Credits by product", "linked_product_tile"):
                _render_bar(
                    _category_series(filtered, "product", "credits"),
                    category="product",
                    value="credits",
                    renderer="vega",
                    key="linked_product_chart",
                    alt_text="Filtered credits by product",
                )
            with _render_tile("Latency distribution", "linked_latency_tile"):
                _render_histogram(
                    filtered,
                    renderer="vega",
                    key="linked_latency_chart",
                )
        with right:
            with _render_tile("Jobs by segment", "linked_segment_tile"):
                _render_bar(
                    _category_series(filtered, "segment", "jobs"),
                    category="segment",
                    value="jobs",
                    renderer="vega",
                    key="linked_segment_chart",
                    alt_text="Filtered jobs by segment",
                )
            with _render_tile("Credits over time", "linked_credits_time_tile"):
                _render_line(
                    _daily_series(filtered, "credits"),
                    x="ts",
                    y="credits",
                    series="region",
                    renderer="vega",
                    key="linked_credits_time_chart",
                    alt_text="Filtered daily credits by region",
                )

    state = {
        "regions": selected_regions,
        "start": start.isoformat() if start is not None else None,
        "end": end.isoformat() if end is not None else None,
        "preview_open": False,
    }
    return filtered, state


def _render_completion(
    *,
    scenario: str,
    renderer: _Renderer,
    source_rows: int,
    result: pd.DataFrame,
    state: dict[str, Any],
    run_count: int,
    started_at: float,
) -> None:
    checksum = round(float(result["credits"].sum()) * 10_000)
    completion = {
        "scenario": scenario,
        "renderer": renderer,
        "source_rows": source_rows,
        "result_rows": len(result),
        "checksum": checksum,
        "filter_state": state,
        "run_count": run_count,
        "server_duration_ms": round((time.perf_counter() - started_at) * 1000, 3),
    }
    with st.container(key="bi_completion"):
        st.code(json.dumps(completion, sort_keys=True), language="json")


_started_at = time.perf_counter()
st.session_state.bi_run_count = int(st.session_state.get("bi_run_count", 0)) + 1
_run_count = int(st.session_state.bi_run_count)
_scenario = _query_value("scenario", "ready")
_renderer_value = _query_value("renderer", "vega")
_renderer: _Renderer = "echarts" if _renderer_value == "echarts" else "vega"
_row_count = int(_query_value("rows", str(_NORMAL_ROWS)))
if _row_count not in _ALLOWED_ROWS:
    raise ValueError(f"Unsupported row count: {_row_count}")

st.set_page_config(page_title="BI performance dashboard", layout="wide")
if _scenario == "ready":
    st.caption("BI performance benchmark ready")
    _result = _generate_rows(1_002)
    _state: dict[str, Any] = {"preview_open": False}
elif _scenario == "executive":
    _source = _generate_rows(_row_count)
    _result, _state = _render_executive_dashboard(_source, _renderer)
elif _scenario == "linked":
    _source = _generate_rows(_row_count)
    _result, _state = _render_linked_dashboard(_source)
elif _scenario == "micro_point":
    _source = _generate_rows(_row_count)
    _result, _state = _render_linked_dashboard(_source, micro_gesture="point")
elif _scenario == "micro_brush":
    _source = _generate_rows(_row_count)
    _result, _state = _render_linked_dashboard(_source, micro_gesture="brush")
else:
    raise ValueError(f"Unsupported scenario: {_scenario}")

_render_completion(
    scenario=_scenario,
    renderer=_renderer,
    source_rows=_row_count if _scenario != "ready" else 1_002,
    result=_result,
    state=_state,
    run_count=_run_count,
    started_at=_started_at,
)
