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

"""E2E tests for st.echarts_chart."""

from __future__ import annotations

import pytest
from playwright.sync_api import Dialog, Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    click_button,
    get_element_by_key,
)

# Total number of st.echarts_chart elements rendered by st_echarts_chart.py
# (including the ones inside the collapsed expander and the form).
_EXPECTED_CHART_COUNT = 15


def _get_chart(page: Page, key: str) -> Locator:
    """Return the ECharts canvas/SVG container for the chart in the given container.

    Display-only charts have no element id (and thus no ``st-key-`` class of
    their own), so they are wrapped in ``st.container(key="c_<name>")`` in the
    app script; ``key`` is that container key.
    """
    return get_element_by_key(page, key).get_by_test_id("stEChartsChart")


def test_echarts_charts_render_without_errors(app: Page):
    """All charts render, none show an error box, and canvas/SVG renderers work."""
    charts = app.get_by_test_id("stEChartsChart")
    expect(charts).to_have_count(_EXPECTED_CHART_COUNT)

    # Must NOT happen: no chart renders an error box.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    # The default canvas renderer produces a <canvas> inside the container...
    basic_bar = _get_chart(app, "c_basic_bar")
    expect(basic_bar.locator("canvas")).to_be_visible()
    # ...and no <svg> (the toolbar's icon SVGs live outside this container).
    expect(basic_bar.locator("svg")).to_have_count(0)

    # The SVG renderer produces a real DOM <svg> and no <canvas>.
    svg_chart = _get_chart(app, "c_svg_renderer")
    expect(svg_chart.locator("svg")).to_be_visible()
    expect(svg_chart.locator("canvas")).to_have_count(0)


def test_hover_toolbar_is_not_clipped_by_container_overflow(app: Page):
    """The chart's element container must not clip the floating hover toolbar.

    Regression test: a pixel `height` gives the element container
    ``overflow: auto``, which clipped the toolbar (it's positioned above the
    chart at a negative top). The chart uses ``overflow: visible`` like other
    charts so the toolbar (and tooltips) can extend beyond the plot.
    """
    chart_container = get_element_by_key(app, "c_line_multi")
    chart = chart_container.get_by_test_id("stEChartsChart")
    expect(chart.locator("canvas")).to_be_visible()

    # The element container wrapping the chart must not clip overflow.
    overflow_y = chart.evaluate(
        "(el) => { const c = el.closest('[data-testid=\"stElementContainer\"]');"
        " return c ? getComputedStyle(c).overflowY : null; }"
    )
    assert overflow_y == "visible", (
        f"element container clips the toolbar (overflow-y={overflow_y})"
    )

    # The toolbar is revealed on hover.
    chart.hover()
    expect(
        chart_container.get_by_role("button", name="Download as PNG")
    ).to_be_visible()


def test_check_top_level_class(app: Page):
    """The top level class is correctly set."""
    check_top_level_class(app, "stEChartsChart")


def test_custom_css_class_via_key(app: Page):
    """A chart can be targeted via the st-key-<key> class from its key."""
    expect(get_element_by_key(app, "selection_chart")).to_be_visible()


def test_unrelated_rerun_does_not_reset_display_chart(app: Page):
    """An unrelated rerun keeps a display-only chart mounted and error-free."""
    basic_bar = _get_chart(app, "c_basic_bar")
    expect(basic_bar.locator("canvas")).to_be_visible()

    click_button(app, "rerun helper")

    # The chart is still there (not duplicated, not removed) and did not error.
    expect(app.get_by_test_id("stEChartsChart")).to_have_count(_EXPECTED_CHART_COUNT)
    expect(basic_bar.locator("canvas")).to_be_visible()
    # Must NOT happen: an unrelated rerun does not surface a render error.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


def _select_theme(app: Page, label: str) -> None:
    """Open the main menu, click a theme radio, and close the menu."""
    app.get_by_test_id("stMainMenu").click()
    expect(app.get_by_test_id("stMainMenuPopover")).to_be_visible()
    app.get_by_test_id(f"stMainMenuItem-theme-{label}").click()
    app.keyboard.press("Escape")
    expect(app.get_by_test_id("stMainMenuPopover")).not_to_be_visible()


def test_chart_survives_runtime_theme_switch(app: Page):
    """Switching theme at runtime re-themes the chart instead of blanking it.

    Regression test: the chart instance is disposed and recreated on a theme
    change; a stale render pass previously left the fresh instance blank (canvas
    removed and never redrawn).
    """
    basic_bar = _get_chart(app, "c_basic_bar")
    expect(basic_bar.locator("canvas")).to_be_visible()

    _select_theme(app, "Dark")

    # The chart is re-created and re-rendered (canvas present), not blanked out.
    expect(basic_bar.locator("canvas")).to_be_visible()
    # Must NOT happen: the theme switch does not surface a render error.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    _select_theme(app, "Light")

    expect(basic_bar.locator("canvas")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


def test_expander_chart_renders_on_expand(app: Page):
    """A display-only chart inside a collapsed expander renders once expanded."""
    expander_chart = _get_chart(app, "c_expander_chart")
    # While collapsed, the chart canvas is present in the DOM but not visible.
    expect(expander_chart.locator("canvas")).not_to_be_visible()

    app.get_by_test_id("stExpander").get_by_text("Chart in expander").click()

    # After expanding, the chart renders its canvas without an error.
    expect(expander_chart.locator("canvas")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


@pytest.mark.only_browser("chromium")
def test_point_selection_updates_output(app: Page):
    """Clicking a data point on a selection chart updates the selection output."""
    # Initially nothing is selected.
    expect(app.get_by_text("echarts selection points: 0")).to_be_visible()

    chart = _get_chart(app, "selection_chart")
    expect(chart.locator("canvas")).to_be_visible()

    # The chart is a single chart-filling bar, so a center click lands on it.
    chart.click()
    wait_for_app_run(app)

    expect(app.get_by_text("echarts selection points: 1")).to_be_visible()
    expect(app.get_by_text("echarts selection indices: [0]")).to_be_visible()
    # Must NOT happen: selecting a point does not error.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


def test_tooltip_xss_payload_is_not_executed(app: Page):
    """An HTML/script payload in tooltip content renders safely (no execution)."""
    dialogs: list[str] = []

    def _record_dialog(dialog: Dialog) -> None:
        dialogs.append(dialog.message)
        dialog.dismiss()

    app.on("dialog", _record_dialog)

    chart = _get_chart(app, "c_xss_chart")
    expect(chart.locator("canvas")).to_be_visible()

    # Must NOT happen at any point: the payload must never create an executing
    # <img onerror=...> element in the DOM.
    expect(app.locator("img[onerror]")).to_have_count(0)

    # Hover the (chart-filling) bar to trigger the tooltip render path.
    chart.hover()
    app.wait_for_timeout(500)

    expect(app.locator("img[onerror]")).to_have_count(0)
    assert dialogs == [], f"Unexpected dialog(s) fired from XSS payload: {dialogs}"


def test_download_as_png(app: Page):
    """The download toolbar action triggers a PNG download."""
    chart_container = get_element_by_key(app, "c_custom_colors")
    expect(
        chart_container.get_by_test_id("stEChartsChart").locator("canvas")
    ).to_be_visible()

    download_button = chart_container.get_by_role("button", name="Download as PNG")

    # The hover-revealed toolbar floats above the chart and overlaps the
    # neighboring chart, so a positional click is unreliable. Dispatching the
    # click directly on the button fires its handler regardless of overlap.
    with app.expect_download() as download_info:
        download_button.dispatch_event("click")

    download = download_info.value
    assert download.suggested_filename.endswith(".png")


def test_fullscreen_expands_and_collapses_chart(app: Page):
    """The fullscreen toolbar action expands the chart and can be collapsed."""
    chart_container = get_element_by_key(app, "c_custom_colors")
    chart = chart_container.get_by_test_id("stEChartsChart")
    expect(chart.locator("canvas")).to_be_visible()

    box_before = chart.bounding_box()
    assert box_before is not None

    # See test_download_as_png for why we dispatch the click directly.
    chart_container.get_by_role("button", name="Fullscreen", exact=True).dispatch_event(
        "click"
    )

    close_button = app.get_by_role("button", name="Close fullscreen")
    expect(close_button).to_be_visible()

    # The chart should grow substantially when entering fullscreen.
    def _is_expanded() -> bool:
        box = chart.bounding_box()
        return box is not None and box["height"] > box_before["height"] + 100

    wait_until(app, _is_expanded)

    # Must NOT happen: entering fullscreen does not error.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    close_button.dispatch_event("click")
    expect(close_button).not_to_be_visible()


@pytest.mark.only_browser("chromium")
def test_themed_snapshots(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Representative charts look correct in both light and dark themes."""
    # Make sure all charts finished rendering before snapshotting.
    expect(themed_app.get_by_test_id("stEChartsChart")).to_have_count(
        _EXPECTED_CHART_COUNT
    )
    expect(themed_app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    snapshots = {
        "c_basic_bar": "st_echarts_chart-basic_bar",
        "c_line_multi": "st_echarts_chart-line_multi",
        "c_gauge": "st_echarts_chart-gauge",
        "c_custom_colors": "st_echarts_chart-custom_colors",
        # Radar exercises non-cartesian theming (split areas, spokes, names),
        # which must stay subtle/legible in both light and dark mode.
        "c_radar": "st_echarts_chart-radar",
    }
    for key, name in snapshots.items():
        chart = _get_chart(themed_app, key)
        expect(chart.locator("canvas")).to_be_visible()
        assert_snapshot(chart, name=name)
