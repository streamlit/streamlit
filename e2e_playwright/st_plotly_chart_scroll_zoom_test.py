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

from __future__ import annotations

from typing import Any, cast

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import click_button, get_element_by_key

WHEEL_TICKS = 12
WHEEL_DELTA_Y = -80
DOMAIN_TOLERANCE = 0.005
PLOT_BOX_TOLERANCE_PX = 2
# Match frontend RANGE_EPSILON: relative to the zoom window span.
RANGE_EPSILON = 1e-6


def _plotly_div(chart: Locator) -> Locator:
    return chart.locator(".js-plotly-plot")


def _layout_metrics(chart: Locator) -> dict[str, Any]:
    return cast(
        "dict[str, Any]",
        _plotly_div(chart).evaluate(
            """el => ({
            xDomain: el._fullLayout.xaxis.domain.slice(),
            yDomain: el._fullLayout.yaxis.domain.slice(),
            plotW: el._fullLayout._size.w,
            plotH: el._fullLayout._size.h,
            xRange: el._fullLayout.xaxis.range.slice(),
        })"""
        ),
    )


def _range_span(range_values: list[float]) -> float:
    return abs(range_values[1] - range_values[0])


def _ranges_close(left: list[float], right: list[float]) -> bool:
    if len(left) != len(right):
        return False
    span = max(_range_span(left), _range_span(right), 1e-12)
    return all(
        abs(left_value - right_value) <= RANGE_EPSILON * span
        for left_value, right_value in zip(left, right, strict=True)
    )


def _dispatch_wheel_on_drag_layer(chart: Locator) -> None:
    chart.locator(".nsewdrag").evaluate(
        """(el, { ticks, deltaY }) => {
            for (let i = 0; i < ticks; i++) {
                el.dispatchEvent(new WheelEvent("wheel", {
                    deltaY,
                    bubbles: true,
                    cancelable: true,
                }))
            }
        }""",
        {"ticks": WHEEL_TICKS, "deltaY": WHEEL_DELTA_Y},
    )


def _scroll_zoom(chart: Locator) -> None:
    """Zoom via Plotly's cartesian drag layer so the interaction is deterministic.

    Playwright `mouse.wheel` at the plot center does not always reach Plotly.
    """
    chart.scroll_into_view_if_needed()
    expect(chart).to_be_visible()
    plot = _plotly_div(chart)
    expect(plot).to_be_visible()
    _dispatch_wheel_on_drag_layer(chart)


def _zoom_until_range_shrinks(
    app: Page, chart: Locator
) -> tuple[dict[str, Any], dict[str, Any]]:
    wait_until(app, lambda: _layout_metrics(chart)["plotW"] > 0)
    before = _layout_metrics(chart)
    _scroll_zoom(chart)

    def _zoomed() -> bool:
        after = _layout_metrics(chart)
        return _range_span(after["xRange"]) < _range_span(before["xRange"])

    wait_until(app, _zoomed)
    return before, _layout_metrics(chart)


def _assert_domain_stable(before: dict[str, Any], after: dict[str, Any]) -> None:
    assert abs(after["xDomain"][0] - before["xDomain"][0]) <= DOMAIN_TOLERANCE
    assert abs(after["xDomain"][1] - before["xDomain"][1]) <= DOMAIN_TOLERANCE
    assert abs(after["yDomain"][0] - before["yDomain"][0]) <= DOMAIN_TOLERANCE
    assert abs(after["yDomain"][1] - before["yDomain"][1]) <= DOMAIN_TOLERANCE


def _assert_plot_box_stable(before: dict[str, Any], after: dict[str, Any]) -> None:
    assert abs(after["plotW"] - before["plotW"]) <= PLOT_BOX_TOLERANCE_PX
    assert abs(after["plotH"] - before["plotH"]) <= PLOT_BOX_TOLERANCE_PX


@pytest.mark.only_browser("chromium")
def test_scroll_zoom_keeps_plot_box_stable_and_survives_rerun(app: Page):
    """Scroll-zoom must change range without jitter, and survive a no-op rerun.

    Covers the #8076 reporter case (imshow + Streamlit theme), the already-stable
    theme=None path, scatter automargin, and the #15035 stale-zoom regression.
    """
    imshow_streamlit = get_element_by_key(app, "imshow_streamlit")
    imshow_none = get_element_by_key(app, "imshow_none")
    scatter = get_element_by_key(app, "scatter_streamlit")

    imshow_before, imshow_after = _zoom_until_range_shrinks(app, imshow_streamlit)
    assert _range_span(imshow_after["xRange"]) < _range_span(imshow_before["xRange"])
    _assert_domain_stable(imshow_before, imshow_after)
    _assert_plot_box_stable(imshow_before, imshow_after)

    none_before, none_after = _zoom_until_range_shrinks(app, imshow_none)
    assert _range_span(none_after["xRange"]) < _range_span(none_before["xRange"])
    _assert_domain_stable(none_before, none_after)
    _assert_plot_box_stable(none_before, none_after)

    scatter_before, scatter_after = _zoom_until_range_shrinks(app, scatter)
    assert _range_span(scatter_after["xRange"]) < _range_span(scatter_before["xRange"])
    _assert_plot_box_stable(scatter_before, scatter_after)

    click_button(app, "Rerun without changing figures")
    expect(app.get_by_text("reran")).to_be_visible()

    def _zoom_restored() -> bool:
        after_rerun = _layout_metrics(imshow_streamlit)
        return _ranges_close(after_rerun["xRange"], imshow_after["xRange"])

    wait_until(app, _zoom_restored)
    assert not _ranges_close(
        _layout_metrics(imshow_streamlit)["xRange"], imshow_before["xRange"]
    )
