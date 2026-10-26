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

"""Focused interaction benchmarks for deterministic BI dashboards."""

from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING, Any, Literal
from urllib.parse import urlencode, urlsplit, urlunsplit

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_loaded
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.bi_performance import (
    BenchmarkDefinition,
    InteractionMeasurement,
    measure_interaction,
)
from e2e_playwright.shared.performance import CAPTURE_TRACES_SCRIPT
from e2e_playwright.shared.vega_utils import get_vega_graphics_document

if TYPE_CHECKING:
    from collections.abc import Callable

pytestmark = [pytest.mark.performance, pytest.mark.bi_performance]

_Renderer = Literal["vega", "echarts"]
_NORMAL_ROWS = 10_002
_ROW_COUNTS = [
    pytest.param(_NORMAL_ROWS, id="normal"),
    pytest.param(
        100_002,
        marks=pytest.mark.bi_performance_extended,
        id="large",
    ),
]
_WEBSOCKET_SEND_COUNTER_SCRIPT = """
window.__biWebSocketSendCount = 0;
const nativeWebSocketSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(...args) {
    window.__biWebSocketSendCount += 1;
    return nativeWebSocketSend.apply(this, args);
};
"""


@pytest.fixture(autouse=True)
def _capture_traces_after_navigation(app: Page) -> None:
    app.context.add_init_script(CAPTURE_TRACES_SCRIPT)
    app.context.add_init_script(_WEBSOCKET_SEND_COUNTER_SCRIPT)


def _completion_locator(app: Page) -> Locator:
    return get_element_by_key(app, "bi_completion")


def _read_completion(app: Page) -> dict[str, Any]:
    text = _completion_locator(app).inner_text()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise AssertionError(f"Completion JSON was not found in {text!r}")
    return json.loads(text[start : end + 1])


def _websocket_send_count(app: Page) -> int:
    return int(app.evaluate("window.__biWebSocketSendCount"))


def _wait_for_completion(
    app: Page,
    predicate: Callable[[dict[str, Any]], bool],
    *,
    timeout_ms: int = 30_000,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_ms / 1000
    last_completion: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        try:
            last_completion = _read_completion(app)
        except (json.JSONDecodeError, AssertionError):
            app.wait_for_timeout(20)
            continue
        if predicate(last_completion):
            return last_completion
        app.wait_for_timeout(20)
    raise AssertionError(f"Timed out waiting for completion: {last_completion}")


def _chart_visual_signature(chart: Locator) -> str:
    return str(
        chart.evaluate(
            """element => {
                const canvas = element.querySelector("canvas");
                if (canvas) {
                    return canvas.toDataURL();
                }
                return [...element.querySelectorAll("svg.marks")]
                    .map(svg => svg.outerHTML)
                    .join("");
            }"""
        )
    )


def _wait_for_chart_change(
    app: Page,
    chart: Locator,
    previous_signature: str,
    *,
    timeout_ms: int = 5_000,
) -> None:
    deadline = time.monotonic() + timeout_ms / 1000
    while time.monotonic() < deadline:
        if _chart_visual_signature(chart) != previous_signature:
            return
        app.wait_for_timeout(20)
    raise AssertionError("Chart output did not change after the interaction")


def _wait_for_completion_and_chart_change(
    app: Page,
    predicate: Callable[[dict[str, Any]], bool],
    *,
    chart: Locator,
    previous_signature: str,
) -> dict[str, Any]:
    completion = _wait_for_completion(app, predicate)
    _wait_for_chart_change(app, chart, previous_signature)
    return completion


def _wait_for_linked_kpi(app: Page, completion: dict[str, Any]) -> None:
    expected_credits = f"{completion['checksum'] / 10_000:,.0f}"
    expect(
        get_element_by_key(app, "bi_kpis").get_by_text(expected_credits, exact=True)
    ).to_be_visible()


def _wait_for_completion_and_linked_kpi(
    app: Page,
    predicate: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    completion = _wait_for_completion(app, predicate)
    _wait_for_linked_kpi(app, completion)
    return completion


def _wait_for_completion_and_linked_output(
    app: Page,
    predicate: Callable[[dict[str, Any]], bool],
    *,
    chart: Locator,
    previous_signature: str,
) -> dict[str, Any]:
    completion = _wait_for_completion_and_linked_kpi(app, predicate)
    _wait_for_chart_change(app, chart, previous_signature)
    return completion


def _wait_for_rendered_charts(
    app: Page, *, renderer: _Renderer, expected_count: int
) -> None:
    test_id = "stVegaLiteChart" if renderer == "vega" else "stEChartsChart"
    charts = app.get_by_test_id(test_id)
    expect(charts).to_have_count(expected_count)
    if renderer == "vega":
        expect(get_vega_graphics_document(charts)).to_have_count(expected_count)
    else:
        expect(charts.locator("canvas")).to_have_count(expected_count)


def _scenario_url(
    app: Page,
    *,
    scenario: str,
    renderer: _Renderer,
    rows: int,
) -> str:
    parts = urlsplit(app.url)
    query = urlencode(
        {
            "scenario": scenario,
            "renderer": renderer,
            "rows": rows,
        }
    )
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))


def _open_scenario(
    app: Page,
    *,
    scenario: str,
    renderer: _Renderer = "vega",
    rows: int = _NORMAL_ROWS,
) -> dict[str, Any]:
    response = app.goto(
        _scenario_url(app, scenario=scenario, renderer=renderer, rows=rows)
    )
    assert response is not None
    assert response.ok
    wait_for_app_loaded(app)
    return _wait_for_completion(
        app,
        lambda completion: (
            completion["scenario"] == scenario
            and completion["renderer"] == renderer
            and completion["source_rows"] == rows
        ),
    )


def _definition(
    *,
    benchmark_id: str,
    renderer: _Renderer,
    design: str,
    interaction: str,
    rows: int,
) -> BenchmarkDefinition:
    return BenchmarkDefinition(
        benchmark_id=benchmark_id,
        primary_metric="interaction_to_completion_ms",
        design=design,
        renderer=renderer,
        interaction=interaction,
        rows=rows,
        tier="extended" if rows > _NORMAL_ROWS else "short",
    )


def _click_timestamp(locator: Locator) -> float:
    started_at = time.perf_counter()
    locator.click()
    return started_at


def _button(key: str, label: str, app: Page) -> Locator:
    return get_element_by_key(app, key).get_by_role("button", name=label, exact=True)


def _vega_chart(app: Page, key_prefix: str) -> Locator:
    keyed_chart = app.locator(f'[class*="st-key-{key_prefix}"]').first
    return get_vega_graphics_document(keyed_chart)


def _select_point(
    app: Page,
    *,
    position: tuple[float, float],
    key_prefix: str = "linked_region_",
) -> float:
    chart = _vega_chart(app, key_prefix)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    box = chart.bounding_box()
    assert box is not None
    started_at = time.perf_counter()
    chart.click(
        position={
            "x": box["width"] * position[0],
            "y": box["height"] * position[1],
        }
    )
    return started_at


def _find_point_position(app: Page) -> tuple[float, float]:
    for position in ((0.65, 0.4), (0.8, 0.4), (0.94, 0.4)):
        before = _read_completion(app)
        linked_chart = get_element_by_key(app, "linked_product_tile")
        previous_signature = (
            _chart_visual_signature(linked_chart) if linked_chart.count() > 0 else None
        )
        _select_point(app, position=position)
        try:
            completion = _wait_for_completion(
                app,
                lambda completion, before=before: (
                    completion["run_count"] > before["run_count"]
                    and completion["filter_state"]["regions"] != []
                ),
                timeout_ms=1_500,
            )
        except AssertionError:
            continue
        if previous_signature is not None:
            _wait_for_linked_kpi(app, completion)
            _wait_for_chart_change(app, linked_chart, previous_signature)
        return position
    raise AssertionError("No deterministic point-selection position selected a bar")


def _select_brush(
    app: Page,
    *,
    key_prefix: str = "linked_brush_",
    slow: bool,
    release_state: dict[str, Any] | None = None,
    release_chart: Locator | None = None,
) -> float:
    chart = _vega_chart(app, key_prefix)
    expect(chart).to_be_visible()
    chart.scroll_into_view_if_needed()
    box = chart.bounding_box()
    assert box is not None
    start_x = box["x"] + box["width"] * 0.25
    end_x = box["x"] + box["width"] * 0.65
    y = box["y"] + box["height"] * 0.5
    app.mouse.move(start_x, y)
    app.mouse.down()
    steps = 5 if slow else 2
    gesture_updates: bool | None = None
    for step in range(1, steps + 1):
        fraction = step / steps
        wait_for_intermediate = slow and step < steps
        before_move = _read_completion(app) if wait_for_intermediate else None
        before_send_count = (
            _websocket_send_count(app) if wait_for_intermediate else None
        )
        before_signature = (
            _chart_visual_signature(release_chart)
            if wait_for_intermediate and release_chart is not None
            else None
        )
        app.mouse.move(start_x + (end_x - start_x) * fraction, y)
        if wait_for_intermediate:
            assert before_move is not None
            assert before_send_count is not None
            app.wait_for_timeout(500)
            if gesture_updates is None:
                gesture_updates = _websocket_send_count(app) > before_send_count
            if gesture_updates:
                completion = _wait_for_completion(
                    app,
                    lambda value, before_move=before_move: (
                        value["run_count"] > before_move["run_count"]
                        and value["filter_state"]["start"] is not None
                    ),
                )
                if release_chart is not None:
                    assert before_signature is not None
                    _wait_for_linked_kpi(app, completion)
                    _wait_for_chart_change(app, release_chart, before_signature)
    if release_state is not None:
        release_state["run_count"] = _read_completion(app)["run_count"]
        if release_chart is not None:
            release_state["chart_signature"] = _chart_visual_signature(release_chart)
    started_at = time.perf_counter()
    app.mouse.up()
    return started_at


def _reset_linked_filters(app: Page) -> dict[str, Any]:
    before = _read_completion(app)
    chart = get_element_by_key(app, "linked_product_tile")
    previous_signature = _chart_visual_signature(chart)
    _button("linked_clear_filters", "Clear filters", app).click()
    return _wait_for_completion_and_linked_output(
        app,
        lambda completion: (
            completion["run_count"] > before["run_count"]
            and completion["filter_state"]["regions"] == []
            and completion["filter_state"]["start"] is None
        ),
        chart=chart,
        previous_signature=previous_signature,
    )


def _warm_chart_widget(
    app: Page,
    *,
    chart: Locator,
    target: Locator,
    target_predicate: Callable[[dict[str, Any]], bool],
    reset: Locator,
    reset_predicate: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    before = _read_completion(app)
    before_signature = _chart_visual_signature(chart)
    target.click()
    _wait_for_completion(
        app,
        lambda completion: (
            completion["run_count"] > before["run_count"]
            and target_predicate(completion)
        ),
    )
    _wait_for_chart_change(app, chart, before_signature)

    warmed = _read_completion(app)
    warmed_signature = _chart_visual_signature(chart)
    reset.click()
    completion = _wait_for_completion(
        app,
        lambda value: (
            value["run_count"] > warmed["run_count"] and reset_predicate(value)
        ),
    )
    _wait_for_chart_change(app, chart, warmed_signature)
    return completion


def _warm_widget(
    app: Page,
    *,
    target: Locator,
    target_predicate: Callable[[dict[str, Any]], bool],
    reset: Locator,
    reset_predicate: Callable[[dict[str, Any]], bool],
) -> dict[str, Any]:
    before = _read_completion(app)
    target.click()
    _wait_for_completion(
        app,
        lambda completion: (
            completion["run_count"] > before["run_count"]
            and target_predicate(completion)
        ),
    )
    warmed = _read_completion(app)
    reset.click()
    return _wait_for_completion(
        app,
        lambda completion: (
            completion["run_count"] > warmed["run_count"]
            and reset_predicate(completion)
        ),
    )


@pytest.mark.bi_performance_validation
def test_renderer_output_parity(app: Page):
    """Vega and ECharts use the same source rows and aggregation semantics."""
    vega = _open_scenario(app, scenario="executive", renderer="vega")
    echarts = _open_scenario(app, scenario="executive", renderer="echarts")

    assert echarts["source_rows"] == vega["source_rows"]
    assert echarts["result_rows"] == vega["result_rows"]
    assert echarts["checksum"] == vega["checksum"]
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


@pytest.mark.parametrize("rows", _ROW_COUNTS)
@pytest.mark.parametrize("renderer", ["vega", "echarts"])
def test_initial_load(app: Page, renderer: _Renderer, rows: int):
    """Measure a warm-browser, new-session dashboard load."""
    url = _scenario_url(
        app,
        scenario="executive",
        renderer=renderer,
        rows=rows,
    )
    app.goto(url)
    wait_for_app_loaded(app)
    _wait_for_completion(app, lambda completion: completion["source_rows"] == rows)
    app.goto("about:blank")
    before = {
        "run_count": 0,
    }

    def action() -> float:
        started_at = time.perf_counter()
        app.goto(url)
        return started_at

    def wait_for_initial_output() -> dict[str, Any]:
        completion = _wait_for_completion(
            app,
            lambda value: (
                value["scenario"] == "executive" and value["source_rows"] == rows
            ),
        )
        _wait_for_rendered_charts(app, renderer=renderer, expected_count=7)
        return completion

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.executive.{renderer}.rows{rows}.initial_load.v1",
            renderer=renderer,
            design="executive",
            interaction="initial_load",
            rows=rows,
        ),
        before_completion=before,
        action=action,
        wait_for_completion=wait_for_initial_output,
    )

    assert measurement.interaction_to_completion_ms > 0
    assert _read_completion(app)["result_rows"] == rows


@pytest.mark.parametrize("rows", _ROW_COUNTS)
@pytest.mark.parametrize("renderer", ["vega", "echarts"])
def test_range_change(app: Page, renderer: _Renderer, rows: int):
    """Measure changing the tile-local chart range."""
    _open_scenario(app, scenario="executive", renderer=renderer, rows=rows)
    range_control = get_element_by_key(app, "executive_range")
    one_month = range_control.locator("button").filter(has_text="1M")
    all_time = range_control.locator("button").filter(has_text="All")
    chart = get_element_by_key(app, "tile_credits_time")
    before = _warm_chart_widget(
        app,
        chart=chart,
        target=one_month,
        target_predicate=lambda completion: completion["filter_state"]["range"] == "1M",
        reset=all_time,
        reset_predicate=lambda completion: completion["filter_state"]["range"] == "All",
    )
    previous_signature = _chart_visual_signature(chart)

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.executive.{renderer}.rows{rows}.range_change.v1",
            renderer=renderer,
            design="executive",
            interaction="range_change",
            rows=rows,
        ),
        before_completion=before,
        action=lambda: _click_timestamp(one_month),
        wait_for_completion=lambda: _wait_for_completion_and_chart_change(
            app,
            lambda completion: (
                completion["run_count"] > before["run_count"]
                and completion["filter_state"]["range"] == "1M"
            ),
            chart=chart,
            previous_signature=previous_signature,
        ),
    )

    completion = _read_completion(app)
    assert completion["result_rows"] < rows
    assert measurement.rerun_count == 1


@pytest.mark.parametrize("renderer", ["vega", "echarts"])
def test_series_toggle(app: Page, renderer: _Renderer):
    """Measure changing a tile-local series selection."""
    _open_scenario(app, scenario="executive", renderer=renderer)
    series_control = get_element_by_key(app, "executive_series")
    apj = series_control.get_by_role("button", name="APJ", exact=True)
    chart = get_element_by_key(app, "tile_credits_time")
    before = _warm_chart_widget(
        app,
        chart=chart,
        target=apj,
        target_predicate=lambda completion: (
            "APJ" not in completion["filter_state"]["series"]
        ),
        reset=apj,
        reset_predicate=lambda completion: (
            "APJ" in completion["filter_state"]["series"]
        ),
    )
    previous_signature = _chart_visual_signature(chart)

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.executive.{renderer}.rows{_NORMAL_ROWS}.series_toggle.v1",
            renderer=renderer,
            design="executive",
            interaction="series_toggle",
            rows=_NORMAL_ROWS,
        ),
        before_completion=before,
        action=lambda: _click_timestamp(apj),
        wait_for_completion=lambda: _wait_for_completion_and_chart_change(
            app,
            lambda completion: (
                completion["run_count"] > before["run_count"]
                and "APJ" not in completion["filter_state"]["series"]
            ),
            chart=chart,
            previous_signature=previous_signature,
        ),
    )

    assert measurement.rerun_count == 1
    assert _read_completion(app)["result_rows"] < _NORMAL_ROWS


@pytest.mark.parametrize("rows", _ROW_COUNTS)
@pytest.mark.parametrize("renderer", ["vega", "echarts"])
def test_data_preview_open(app: Page, renderer: _Renderer, rows: int):
    """Measure lazy rendering of the dynamically opened data-preview tab."""
    _open_scenario(app, scenario="executive", renderer=renderer, rows=rows)
    tabs = get_element_by_key(app, "executive_preview_tabs")
    chart_tab = tabs.get_by_role("tab", name="Chart", exact=True)
    preview_tab = tabs.get_by_role("tab", name="Data preview", exact=True)
    before = _warm_widget(
        app,
        target=preview_tab,
        target_predicate=lambda completion: completion["filter_state"]["preview_open"],
        reset=chart_tab,
        reset_predicate=lambda completion: (
            not completion["filter_state"]["preview_open"]
        ),
    )

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.executive.{renderer}.rows{rows}.data_preview_open.v1",
            renderer=renderer,
            design="executive",
            interaction="data_preview_open",
            rows=rows,
        ),
        before_completion=before,
        action=lambda: _click_timestamp(preview_tab),
        wait_for_completion=lambda: _wait_for_completion(
            app,
            lambda completion: (
                completion["run_count"] > before["run_count"]
                and completion["filter_state"]["preview_open"]
                and app.get_by_role(
                    "region", name="Filtered usage-event preview"
                ).is_visible()
            ),
        ),
    )

    expect(
        app.get_by_role("region", name="Filtered usage-event preview")
    ).to_be_visible()
    assert measurement.rerun_count == 1


def _measure_point_selection(
    app: Page, *, scenario: Literal["linked", "micro_point"]
) -> InteractionMeasurement:
    _open_scenario(app, scenario=scenario)
    point_position = _find_point_position(app)
    if scenario == "linked":
        before = _reset_linked_filters(app)
        chart = get_element_by_key(app, "linked_product_tile")
    else:
        before = _open_scenario(app, scenario=scenario)
        chart = _vega_chart(app, "linked_region_")
    previous_signature = _chart_visual_signature(chart)

    def wait_for_point_output() -> dict[str, Any]:
        def predicate(completion: dict[str, Any]) -> bool:
            return (
                completion["run_count"] > before["run_count"]
                and completion["filter_state"]["regions"] != []
            )

        if scenario == "linked":
            return _wait_for_completion_and_linked_output(
                app,
                predicate,
                chart=chart,
                previous_signature=previous_signature,
            )
        return _wait_for_completion_and_chart_change(
            app,
            predicate,
            chart=chart,
            previous_signature=previous_signature,
        )

    return measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=(f"bi.{scenario}.vega.rows{_NORMAL_ROWS}.point_selection.v1"),
            renderer="vega",
            design=scenario,
            interaction="point_selection",
            rows=_NORMAL_ROWS,
        ),
        before_completion=before,
        action=lambda: _select_point(app, position=point_position),
        wait_for_completion=wait_for_point_output,
    )


def test_linked_point_selection(app: Page):
    """Measure point-selection cross-filtering of a complete dashboard."""
    measurement = _measure_point_selection(app, scenario="linked")

    completion = _read_completion(app)
    assert completion["result_rows"] < _NORMAL_ROWS
    assert measurement.rerun_count >= 1


def test_micro_point_selection(app: Page):
    """Keep a single-chart point measurement as a selection diagnostic."""
    measurement = _measure_point_selection(app, scenario="micro_point")

    assert _read_completion(app)["filter_state"]["regions"] != []
    assert measurement.rerun_count >= 1


def _measure_brush_selection(
    app: Page,
    *,
    scenario: Literal["linked", "micro_brush"],
    slow: bool,
) -> InteractionMeasurement:
    _open_scenario(app, scenario=scenario)
    before_warmup = _read_completion(app)
    linked_chart = (
        get_element_by_key(app, "linked_product_tile") if scenario == "linked" else None
    )
    warmup_signature = (
        _chart_visual_signature(linked_chart) if linked_chart is not None else None
    )
    _select_brush(app, slow=False)
    warmed = _wait_for_completion(
        app,
        lambda completion: (
            completion["run_count"] > before_warmup["run_count"]
            and completion["filter_state"]["start"] is not None
        ),
    )
    if linked_chart is not None:
        assert warmup_signature is not None
        _wait_for_linked_kpi(app, warmed)
        _wait_for_chart_change(app, linked_chart, warmup_signature)
    if scenario == "linked":
        before = _reset_linked_filters(app)
        chart = get_element_by_key(app, "linked_product_tile")
    else:
        before = _open_scenario(app, scenario=scenario)
        chart = _vega_chart(app, "linked_brush_")
    previous_signature = _chart_visual_signature(chart)
    release_state: dict[str, Any] = {}

    def wait_for_brush_output() -> dict[str, Any]:
        def predicate(completion: dict[str, Any]) -> bool:
            return (
                completion["run_count"] > release_state["run_count"]
                and completion["filter_state"]["start"] is not None
            )

        if scenario == "linked":
            return _wait_for_completion_and_linked_output(
                app,
                predicate,
                chart=chart,
                previous_signature=release_state["chart_signature"],
            )
        return _wait_for_completion_and_chart_change(
            app,
            predicate,
            chart=chart,
            previous_signature=previous_signature,
        )

    return measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=(
                f"bi.{scenario}.vega.rows{_NORMAL_ROWS}."
                f"{'slow_' if slow else ''}interval_brush.v1"
            ),
            renderer="vega",
            design=scenario,
            interaction="slow_interval_brush" if slow else "interval_brush",
            rows=_NORMAL_ROWS,
        ),
        before_completion=before,
        action=lambda: _select_brush(
            app,
            slow=slow,
            release_state=release_state,
            release_chart=chart if scenario == "linked" else None,
        ),
        wait_for_completion=wait_for_brush_output,
    )


def test_linked_interval_brush(app: Page):
    """Measure brush-release cross-filtering of a complete dashboard."""
    measurement = _measure_brush_selection(app, scenario="linked", slow=False)

    completion = _read_completion(app)
    assert completion["result_rows"] < _NORMAL_ROWS
    assert measurement.rerun_count >= 1


def test_linked_slow_interval_brush(app: Page):
    """Expose intermediate reruns from a brush with pauses over the debounce."""
    measurement = _measure_brush_selection(app, scenario="linked", slow=True)

    assert _read_completion(app)["filter_state"]["start"] is not None
    assert measurement.websocket_messages_sent >= 1
    assert measurement.rerun_count >= 1


def test_micro_interval_brush(app: Page):
    """Keep a single-chart interval measurement as a selection diagnostic."""
    measurement = _measure_brush_selection(app, scenario="micro_brush", slow=False)

    assert _read_completion(app)["filter_state"]["start"] is not None
    assert measurement.rerun_count >= 1


def test_clear_filters(app: Page):
    """Measure clearing both linked selections and restoring output parity."""
    initial = _open_scenario(app, scenario="linked")
    _find_point_position(app)
    point = _read_completion(app)
    chart = get_element_by_key(app, "linked_product_tile")
    point_signature = _chart_visual_signature(chart)
    _select_brush(app, slow=False)
    before = _wait_for_completion_and_linked_output(
        app,
        lambda completion: (
            completion["run_count"] > point["run_count"]
            and completion["filter_state"]["start"] is not None
        ),
        chart=chart,
        previous_signature=point_signature,
    )
    previous_signature = _chart_visual_signature(chart)

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.linked.vega.rows{_NORMAL_ROWS}.clear_filters.v1",
            renderer="vega",
            design="linked",
            interaction="clear_filters",
            rows=_NORMAL_ROWS,
        ),
        before_completion=before,
        action=lambda: _click_timestamp(
            _button("linked_clear_filters", "Clear filters", app)
        ),
        wait_for_completion=lambda: _wait_for_completion_and_linked_output(
            app,
            lambda completion: (
                completion["run_count"] > before["run_count"]
                and completion["filter_state"]["regions"] == []
                and completion["filter_state"]["start"] is None
            ),
            chart=chart,
            previous_signature=previous_signature,
        ),
    )

    completion = _read_completion(app)
    assert completion["result_rows"] == initial["result_rows"]
    assert completion["checksum"] == initial["checksum"]
    assert measurement.rerun_count == 1


def _canvas_signature(canvas: Locator) -> str:
    return str(canvas.evaluate("(element) => element.toDataURL()"))


def _click_echarts_legend(
    app: Page, chart: Locator, *, position: tuple[float, float]
) -> float:
    chart.scroll_into_view_if_needed()
    box = chart.bounding_box()
    assert box is not None
    started_at = time.perf_counter()
    app.mouse.click(
        box["x"] + box["width"] * position[0],
        box["y"] + box["height"] * position[1],
    )
    return started_at


def _find_echarts_legend_position(
    app: Page, chart: Locator, canvas: Locator
) -> tuple[float, float]:
    for position in (
        (0.4, 0.88),
        (0.5, 0.88),
        (0.6, 0.88),
    ):
        before = _canvas_signature(canvas)
        _click_echarts_legend(app, chart, position=position)
        app.wait_for_timeout(100)
        if _canvas_signature(canvas) == before:
            continue
        _click_echarts_legend(app, chart, position=position)
        app.wait_for_timeout(100)
        return position
    raise AssertionError("No deterministic ECharts legend position changed the canvas")


def test_echarts_legend_toggle_without_rerun(app: Page):
    """Measure a browser-only ECharts legend toggle as a no-rerun control."""
    before = _open_scenario(app, scenario="executive", renderer="echarts")
    chart = get_element_by_key(app, "executive_credits_time_chart").get_by_test_id(
        "stEChartsChart"
    )
    canvas = chart.locator("canvas")
    expect(canvas).to_be_visible()
    legend_position = _find_echarts_legend_position(app, chart, canvas)
    reset_signature = _canvas_signature(canvas)

    measurement = measure_interaction(
        app,
        benchmark=_definition(
            benchmark_id=f"bi.executive.echarts.rows{_NORMAL_ROWS}.legend_toggle.v1",
            renderer="echarts",
            design="executive",
            interaction="legend_toggle",
            rows=_NORMAL_ROWS,
        ),
        before_completion=before,
        action=lambda: _click_echarts_legend(app, chart, position=legend_position),
        wait_for_completion=lambda: _wait_for_canvas_change(
            app, canvas, reset_signature
        ),
    )

    assert measurement.rerun_count == 0
    assert _read_completion(app)["run_count"] == before["run_count"]


def _wait_for_canvas_change(
    app: Page, canvas: Locator, previous_signature: str
) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        if _canvas_signature(canvas) != previous_signature:
            return _read_completion(app)
        app.wait_for_timeout(20)
    raise AssertionError("ECharts canvas did not change after legend toggle")
