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
    click_form_button,
    get_element_by_key,
)

# Total number of st.echarts_chart elements rendered by st_echarts_chart.py
# (including the ones inside the collapsed expander and the form).
_EXPECTED_CHART_COUNT = 18
_XSS_PAYLOAD = "<img src=x onerror=alert(1)>"
_XSS_LINES_PAYLOAD = "<img src=x onerror=alert(2)>"


def _get_chart(page: Page, key: str) -> Locator:
    """Return the ECharts container inside the element identified by ``key``.

    ``key`` may belong to a wrapping ``st.container`` or to the chart itself.
    """
    return get_element_by_key(page, key).get_by_test_id("stEChartsChart")


def test_echarts_charts_render_without_errors(app: Page):
    """Charts render without errors, and shared display checks pass on one load.

    Aggregates read-only checks that share the same untouched page: renderer
    output, top-level class, ``st-key-*`` targeting, toolbar overflow, and the
    stretch-height content floor.
    """
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

    check_top_level_class(app, "stEChartsChart")
    expect(get_element_by_key(app, "basic_bar")).to_be_visible()
    # A key works for selection widgets too, not just display-only charts.
    expect(get_element_by_key(app, "selection_chart")).to_be_visible()

    # The chart's element container must not clip the floating hover toolbar.
    # A pixel `height` gives the element container ``overflow: auto``, which
    # clipped the toolbar (it's positioned above the chart at a negative top).
    chart_container = get_element_by_key(app, "c_line_multi")
    chart = chart_container.get_by_test_id("stEChartsChart")
    expect(chart.locator("canvas")).to_be_visible()

    overflow_y = chart.evaluate(
        "(el) => { const c = el.closest('[data-testid=\"stElementContainer\"]');"
        " return c ? getComputedStyle(c).overflowY : null; }"
    )
    assert overflow_y == "visible", (
        f"element container clips the toolbar (overflow-y={overflow_y})"
    )

    chart.hover()
    expect(
        chart_container.get_by_role("button", name="Download as PNG")
    ).to_be_visible()

    stretch_chart = _get_chart(app, "c_stretch_height")
    expect(stretch_chart.locator("canvas")).to_be_visible()

    def _has_content_height() -> bool:
        box = stretch_chart.bounding_box()
        return box is not None and box["height"] >= 300

    wait_until(app, _has_content_height)
    box = stretch_chart.bounding_box()
    assert box is not None
    # Must NOT collapse to a blank zero-height chart.
    assert box["height"] >= 300


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

    Regression test: the chart is re-themed in place via ``setTheme``. A theme
    switch briefly reports 0x0 dimensions; the chart must stay mounted and
    redraw rather than going blank.
    """
    basic_bar = _get_chart(app, "c_basic_bar")
    expect(basic_bar.locator("canvas")).to_be_visible()

    _select_theme(app, "Dark")

    # The chart stays mounted and is re-themed in place (canvas present).
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
def test_point_selection_persists_and_toggles(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """A point selection is kept (state + visual) across reruns and toggles off.

    Point selection uses ECharts' native ``selectedMode``, so the clicked point
    keeps a visible selected state that is re-applied after a rerun. Clicking the
    same point again deselects it.
    """
    # Initially nothing is selected.
    expect(app.get_by_text("echarts selection groups: 0")).to_be_visible()

    chart = _get_chart(app, "selection_chart")
    expect(chart.locator("canvas")).to_be_visible()

    # The chart is a single chart-filling bar, so a center click lands on it.
    chart.click()
    wait_for_app_run(app)

    expect(app.get_by_text("echarts selection groups: 1")).to_be_visible()
    expect(app.get_by_text("echarts selection indices: [0]")).to_be_visible()
    # Must NOT happen: selecting a point does not error.
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    # The selected point keeps a visible highlight (native select state).
    assert_snapshot(chart, name="st_echarts_chart-point_selected")

    # An unrelated rerun must keep the selection (state and visual) intact.
    click_button(app, "rerun helper")
    wait_for_app_run(app)
    expect(app.get_by_text("echarts selection groups: 1")).to_be_visible()
    expect(app.get_by_text("echarts selection indices: [0]")).to_be_visible()

    # Clicking the same point again toggles it off (multi-select behavior).
    chart.click()
    wait_for_app_run(app)
    expect(app.get_by_text("echarts selection groups: 0")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


@pytest.mark.only_browser("chromium")
def test_brush_selection_persists_and_clears(app: Page):
    """A rect brush is reported, kept across rerun, and cleared from the toolbox."""
    expect(app.get_by_text("echarts brush areas: 0")).to_be_visible()

    chart = _get_chart(app, "brush_chart")
    expect(chart.locator("canvas")).to_be_visible()
    chart.scroll_into_view_if_needed()

    chart.get_by_title("Box Select").click()
    box = chart.bounding_box()
    assert box is not None
    app.mouse.move(box["x"] + box["width"] * 0.15, box["y"] + box["height"] * 0.25)
    app.mouse.down()
    app.mouse.move(box["x"] + box["width"] * 0.85, box["y"] + box["height"] * 0.85)
    app.mouse.up()
    wait_for_app_run(app)

    expect(app.get_by_text("echarts brush areas: 1")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    click_button(app, "rerun helper")
    expect(app.get_by_text("echarts brush areas: 1")).to_be_visible()

    chart.get_by_title("Clear Selections").click()
    wait_for_app_run(app)
    expect(app.get_by_text("echarts brush areas: 0")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)


@pytest.mark.only_browser("chromium")
def test_form_selection_is_deferred_until_submit_and_clears(
    app: Page,
):
    """In-form selection does not rerun until submit, then clear_on_submit resets it."""
    expect(app.get_by_text("echarts form groups: 0")).to_be_visible()

    chart = _get_chart(app, "form_selection_chart")
    expect(chart.locator("canvas")).to_be_visible()
    chart.scroll_into_view_if_needed()
    chart.click()

    # Must NOT happen: selecting inside the form does not rerun the app.
    expect(app.get_by_text("echarts form groups: 0")).to_be_visible()

    # Selection writes are debounced; submitting too early would send empty state.
    app.wait_for_timeout(210)
    click_form_button(app, "Submit selection")
    expect(app.get_by_text("echarts form groups: 1")).to_be_visible()
    expect(app.get_by_test_id("stEChartsChartError")).to_have_count(0)

    # ``fromUser: false`` form-clear commits empty, so the next rerun reports it.
    click_button(app, "rerun helper")
    expect(app.get_by_text("echarts form groups: 0")).to_be_visible()


def test_tooltip_and_label_xss_payloads_are_escaped(app: Page):
    """HTML/script payloads render as literal tooltip and label text."""
    dialogs: list[str] = []

    def _record_dialog(dialog: Dialog) -> None:
        dialogs.append(dialog.message)
        dialog.dismiss()

    app.on("dialog", _record_dialog)

    chart = _get_chart(app, "c_xss_chart")
    expect(chart.locator("svg")).to_be_visible()

    # The SVG-rendered label contains the literal payload as text. If the markup
    # were interpreted instead, the text node would not contain the tag source.
    label = chart.locator("svg text").filter(has_text=_XSS_PAYLOAD)
    expect(label).to_be_visible()

    # Must NOT happen at any point: the payload must never create an executing
    # <img onerror=...> element in the DOM.
    expect(app.locator("img[onerror]")).to_have_count(0)

    # Hover the (chart-filling) bar to trigger the tooltip render path.
    chart.hover()

    # ECharts' HTML tooltip must expose the payload as literal text, not as an
    # image element. This is a positive rendering assertion in addition to the
    # non-execution checks below.
    tooltip = chart.locator(".echarts-xss-tooltip")
    expect(tooltip).to_be_visible()
    expect(tooltip).to_contain_text(_XSS_PAYLOAD)
    expect(tooltip.locator("img")).to_have_count(0)

    # The advisory that floors ECharts 6.1.0 lives on ``series.type="lines"``.
    # A dedicated chart means this hover cannot pass by hitting only a bar.
    lines_chart = _get_chart(app, "c_xss_lines_chart")
    expect(lines_chart.locator("svg")).to_be_visible()
    lines_chart.hover()
    lines_tooltip = lines_chart.locator(".echarts-xss-lines-tooltip")
    expect(lines_tooltip).to_be_visible()
    expect(lines_tooltip).to_contain_text(_XSS_LINES_PAYLOAD)
    expect(lines_tooltip.locator("img")).to_have_count(0)

    expect(app.locator("img[onerror]")).to_have_count(0)
    assert dialogs == [], f"Unexpected dialog(s) fired from XSS payload: {dialogs}"


def test_toolbar_actions(app: Page):
    """Download and fullscreen toolbar actions work on a single page load."""
    png_container = get_element_by_key(app, "c_custom_colors")
    png_chart = png_container.get_by_test_id("stEChartsChart")
    expect(png_chart.locator("canvas")).to_be_visible()

    # The hover-revealed toolbar floats above the chart and overlaps the
    # neighboring chart, so a positional click is unreliable. Dispatching the
    # click directly on the button fires its handler regardless of overlap.
    with app.expect_download() as png_download_info:
        png_container.get_by_role("button", name="Download as PNG").dispatch_event(
            "click"
        )

    assert png_download_info.value.suggested_filename.endswith(".png")

    svg_container = get_element_by_key(app, "c_svg_renderer")
    expect(
        svg_container.get_by_test_id("stEChartsChart").locator("svg")
    ).to_be_visible()

    with app.expect_download() as svg_download_info:
        svg_container.get_by_role("button", name="Download as SVG").dispatch_event(
            "click"
        )

    assert svg_download_info.value.suggested_filename.endswith(".svg")

    box_before = png_chart.bounding_box()
    assert box_before is not None

    png_container.get_by_role("button", name="Fullscreen", exact=True).dispatch_event(
        "click"
    )

    close_button = app.get_by_role("button", name="Close fullscreen")
    expect(close_button).to_be_visible()

    def _is_expanded() -> bool:
        box = png_chart.bounding_box()
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
