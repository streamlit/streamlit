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

import pytest
from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_run,
    wait_until,
)
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    get_element_by_key,
    select_selectbox_option,
)
from e2e_playwright.shared.pydeck_utils import wait_for_chart_canvas
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)

PIXEL_THRESHOLD = 0.1


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    # The pydeck chart takes a while to load so check that
    # it gets attached with an increased timeout.
    pydeck_charts = app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts.first).to_be_attached(timeout=15000)

    check_top_level_class(app, "stDeckGlJsonChart")


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_st_pydeck_clicking_on_fullscreen_toolbar_button(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that clicking on fullscreen toolbar button expands the map into fullscreen."""

    # wait for mapbox to load
    wait_for_app_run(themed_app, 15000)

    assert_fullscreen_toolbar_button_interactions(
        themed_app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDeckGlJsonChart",
        filename_prefix="st_pydeck_chart",
        # The pydeck tests are a lot flakier than need be so increase the pixel threshold
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_empty_chart(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "empty_chart_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-empty",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_basic_chart(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "basic_chart_subtest")

    wait_for_chart_canvas(pydeck_charts.nth(0))
    # Wrapper has no layout size; assert the button, not the testid.
    expect(pydeck_charts.get_by_role("button", name="Zoom In")).to_be_visible()

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-san_francisco_overridden_light_theme",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_invalid_prop(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "invalid_prop_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(1),
        name="st_pydeck_chart-invalid_prop",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_map_styles(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "map_styles_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(1),
        name="st_pydeck_chart-style",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_light_style(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "light_style_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-light",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_dark_style(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "dark_style_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-dark",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_mapbox(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "mapbox_subtest")

    # The pydeck tests are a lot flakier than need be so increase the pixel threshold
    assert_snapshot(
        pydeck_charts.nth(0).locator("canvas").nth(0),
        name="st_pydeck_chart-mapbox_provider",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_layer_extensions(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """st.pydeck_chart renders layers that declare deck.gl @@type extensions."""
    pydeck_charts = select_subtest(app, "layer_extensions_subtest")

    wait_for_chart_canvas(pydeck_charts.nth(0))
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-layer_extensions",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_width_parameter(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Tests that width parameter works correctly."""
    pydeck_charts = select_subtest(app, "width_parameter_subtest")

    expect(pydeck_charts).to_have_count(2, timeout=15000)

    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-width_stretch",
        pixel_threshold=PIXEL_THRESHOLD,
    )
    assert_snapshot(
        pydeck_charts.nth(1),
        name="st_pydeck_chart-width_200_height_250",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_height_parameter(app: Page, assert_snapshot: ImageCompareFunction) -> None:
    """Tests that height parameter works correctly."""
    pydeck_charts = select_subtest(app, "height_parameter_subtest")

    expect(pydeck_charts).to_have_count(4, timeout=15000)

    # Test different height values with snapshots
    wait_for_chart_canvas(pydeck_charts.nth(0))
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-height_default",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    wait_for_chart_canvas(pydeck_charts.nth(1))
    assert_snapshot(
        pydeck_charts.nth(1),
        name="st_pydeck_chart-height_stretch_outside_container",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    # For height="stretch", snapshot the entire container to verify stretching

    stretch_container = get_element_by_key(app, "test_height_stretch")
    wait_for_chart_canvas(pydeck_charts.nth(2))
    assert_snapshot(
        stretch_container,
        name="st_pydeck_chart-height_stretch",
        pixel_threshold=PIXEL_THRESHOLD,
    )

    wait_for_chart_canvas(pydeck_charts.nth(3))
    assert_snapshot(
        pydeck_charts.nth(3),
        name="st_pydeck_chart-height_50px",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_orbit_point_cloud(
    themed_app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    pydeck_charts = select_subtest(themed_app, "orbit_point_cloud_subtest")

    wait_for_chart_canvas(pydeck_charts.nth(0))
    expect(pydeck_charts.get_by_test_id("stDeckGlJsonChartZoomButton")).to_have_count(0)
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-orbit_point_cloud",
        pixel_threshold=PIXEL_THRESHOLD,
    )


# Pydeck snapshots behavior is inconsistent for non-Chromium browsers in CI.
@pytest.mark.only_browser("chromium")
def test_globe_view(themed_app: Page, assert_snapshot: ImageCompareFunction) -> None:
    pydeck_charts = select_subtest(themed_app, "globe_view_subtest")

    wait_for_chart_canvas(pydeck_charts.nth(0))
    expect(pydeck_charts.get_by_test_id("stDeckGlJsonChartZoomButton")).to_have_count(0)
    assert_snapshot(
        pydeck_charts.nth(0),
        name="st_pydeck_chart-globe_view",
        pixel_threshold=PIXEL_THRESHOLD,
    )


def select_subtest(app: Page, name: str) -> Locator:
    # Select the text in the UI:
    select_selectbox_option(app, "Test to run", name)

    # The pydeck chart takes a while to load so check that
    # at least one gets attached with an increased timeout.
    pydeck_charts = app.get_by_test_id("stDeckGlJsonChart")
    expect(pydeck_charts.first).to_be_attached(timeout=15000)

    # The map assets can take more time to load, add an extra timeout
    # to prevent flakiness.
    app.wait_for_timeout(10000)

    return pydeck_charts


def test_pydeck_chart_alt_sets_accessible_name(app: Page) -> None:
    """`alt` becomes the pydeck chart container's accessible name."""
    select_subtest(app, "alt_chart_subtest")

    labeled = get_element_by_key(app, "pydeck_with_alt").get_by_test_id(
        "stDeckGlJsonChart"
    )
    expect(labeled).to_have_attribute("role", "figure")
    expect(labeled).to_have_accessible_name(
        "Scatter map of sample points near San Francisco"
    )
    # role=figure (not img) keeps the Streamlit toolbar operable. Playwright
    # treats opacity:0 as visible, so assert the toolbar is actually revealed.
    # Mapbox zoom controls are chromium-only in CI, so assert Fullscreen only.
    labeled.hover()
    expect(labeled.get_by_test_id("stElementToolbar")).to_have_css("opacity", "1")
    expect(
        labeled.get_by_role(
            "button",
            name="Fullscreen: Scatter map of sample points near San Francisco",
            exact=True,
        )
    ).to_be_visible()

    unlabeled = get_element_by_key(app, "pydeck_without_alt").get_by_test_id(
        "stDeckGlJsonChart"
    )
    expect(unlabeled).not_to_have_attribute("role")
    expect(unlabeled).not_to_have_attribute("aria-label")
    expect(unlabeled).to_have_accessible_name("")


# Firefox CI never inserts `.deck-tooltip` on hover. Chromium and WebKit do.
@pytest.mark.skip_browser("firefox")
def test_pydeck_tooltip_stays_near_cursor(app: Page) -> None:
    """The tooltip origin stays within 16px of the cursor."""
    chart = select_subtest(app, "tooltip_position_subtest")
    wait_for_chart_canvas(chart)

    # The canvas is the pick surface. With map_provider=None, deck does not
    # mount #view-default-view; it only creates that node for a basemap.
    canvas = chart.locator("canvas")
    expect(canvas).to_be_visible()
    canvas.scroll_into_view_if_needed()

    tooltip = chart.locator(".deck-tooltip")
    expect(tooltip).to_be_hidden()

    # Hit-testing is flaky in CI, which is why other pydeck clicks use
    # force=True. The corner probe below checks that the widget root does
    # not sit on top of the canvas.
    canvas.hover(force=True)

    expect(tooltip).to_be_visible()
    expect(tooltip).to_have_text("Test point")

    def tooltip_is_at_cursor() -> None:
        canvas_box = canvas.bounding_box()
        tooltip_box = tooltip.bounding_box()
        assert canvas_box is not None
        assert tooltip_box is not None
        # Playwright hovers the center of the canvas.
        cursor_x = canvas_box["x"] + canvas_box["width"] / 2
        cursor_y = canvas_box["y"] + canvas_box["height"] / 2
        dx = tooltip_box["x"] - cursor_x
        dy = tooltip_box["y"] - cursor_y
        assert abs(dx) < 16, f"tooltip offset dx={dx} dy={dy}"
        assert abs(dy) < 16, f"tooltip offset dx={dx} dy={dy}"

    wait_until(app, tooltip_is_at_cursor)

    # The widget root must not receive the hit. Probe 20px in from the
    # canvas's bottom-left, away from the centered point and the app header.
    corner_probe = canvas.evaluate(
        """(element) => {
            const rect = element.getBoundingClientRect()
            const target = document.elementFromPoint(rect.left + 20, rect.bottom - 20)
            const chart = element.closest('[data-testid="stDeckGlJsonChart"]')
            return {
                isWidgetsRoot: Boolean(target?.closest(".deck-widgets-root")),
                insideChart: Boolean(target && chart?.contains(target)),
            }
        }"""
    )
    assert corner_probe["insideChart"], corner_probe
    assert corner_probe["isWidgetsRoot"] is False, corner_probe
