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
from playwright.sync_api import FloatRect, Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import click_button, get_element_by_key
from e2e_playwright.shared.dataframe_utils import (
    start_dragging_dataframe_resize_handle,
)


def test_data_frame_with_different_sizes(app: Page):
    """Test that st.dataframe should show different sizes as expected."""

    expected = [
        {"width": "704px", "height": "400px"},
        {"width": "250px", "height": "150px"},
        {"width": "250px", "height": "400px"},
        {"width": "704px", "height": "150px"},
        {"width": "704px", "height": "5000px"},
        {"width": "704px", "height": "400px"},
        {"width": "500px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "200px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "229px", "height": "400px"},
        {"width": "704px", "height": "400px"},
        {"width": "200px", "height": "100px"},
        {"width": "704px", "height": "177px"},
        {"width": "288px", "height": "177px"},
        {"width": "400px", "height": "300px"},
        {
            "width": "672px",
            "height": "368px",
        },
        {"width": "704px", "height": "177px"},
        {"width": "672px", "height": "177px"},
        {"width": "704px", "height": "563px"},
        {"width": "704px", "height": "10048px"},  # 300 rows content height (capped)
        {"width": "704px", "height": "300px"},
    ]

    dataframe_elements = app.get_by_test_id("stDataFrame")
    expect(dataframe_elements).to_have_count(23)

    for i, element in enumerate(dataframe_elements.all()):
        expected_width = expected[i]["width"]
        expected_height = expected[i]["height"]

        # Content width dataframes (indices 11 and 15) can vary between browsers/environments
        # Index 11 (small_df, 3 cols): Chromium/Linux CI: 226px, Firefox/WebKit: 229px
        # Index 15 (short_dataframe, 4 cols): Linux CI: 284px, macOS: 288px
        if i == 11:
            actual_width_str = element.evaluate("el => getComputedStyle(el).width")
            actual_width_px = int(actual_width_str.replace("px", ""))

            assert actual_width_px in {226, 229}, (
                f"Content width dataframe {i} has unexpected width {actual_width_px}px, expected 226px or 229px"
            )
        elif i == 15:
            actual_width_str = element.evaluate("el => getComputedStyle(el).width")
            actual_width_px = int(actual_width_str.replace("px", ""))

            assert actual_width_px in {284, 288}, (
                f"Content width dataframe {i} has unexpected width {actual_width_px}px, expected 284px or 288px"
            )
        else:
            expect(element).to_have_css("width", expected_width)

        expect(element).to_have_css("height", expected_height)

    # Must NOT happen: the element container of the default-height dataframe
    # (index 0) or the content-height dataframe (index 20) adds a gap below
    # the grid.
    element_containers = app.get_by_test_id("stElementContainer").filter(
        has=app.get_by_test_id("stDataFrame")
    )
    expect(element_containers.nth(0)).to_have_css("height", "400px")
    expect(element_containers.nth(20)).to_have_css("height", "563px")


def test_data_frame_resizing(app: Page):
    """Test that st.dataframe should resize as expected."""

    dataframe_element = app.get_by_test_id("stDataFrame").nth(13)
    expect(dataframe_element).to_have_css("width", "200px")
    expect(dataframe_element).to_have_css("height", "100px")

    click_button(app, "Resize dataframe")
    expect(dataframe_element).to_have_css("width", "400px")
    expect(dataframe_element).to_have_css("height", "200px")


@pytest.mark.skip_browser("firefox")
def test_data_frame_rendering(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.dataframe should render as expected with width and height."""
    stretch_dataframe = app.get_by_test_id("stDataFrame").nth(14)
    assert_snapshot(stretch_dataframe, name="st_dataframe-stretch-width")

    content_dataframe_element = app.get_by_test_id("stDataFrame").nth(15)
    assert_snapshot(content_dataframe_element, name="st_dataframe-content-width")

    fixed_dimensions_dataframe_element = app.get_by_test_id("stDataFrame").nth(16)
    assert_snapshot(
        fixed_dimensions_dataframe_element, name="st_dataframe-fixed-dimensions"
    )

    stretch_height_container = get_element_by_key(app, "test_height_stretch")
    assert_snapshot(stretch_height_container, name="st_dataframe-stretch-height")

    content_height_dataframe_element = app.get_by_test_id("stDataFrame").nth(20)
    assert_snapshot(
        content_height_dataframe_element, name="st_dataframe-content-height"
    )


def _box(locator: Locator) -> FloatRect:
    box = locator.bounding_box()
    assert box is not None
    return box


def test_fixed_height_dataframe_resize_moves_content_below(app: Page):
    """Dragging a pixel-height dataframe resizes its container with the grid.

    The content below moves with the grid instead of being painted over when
    dragged taller, and moves up instead of leaving a gap when dragged shorter.
    """
    block = get_element_by_key(app, "fixed_height_resizable_dataframe")
    dataframe = block.get_by_test_id("stDataFrame")
    container = block.get_by_test_id("stElementContainer").filter(
        has=app.get_by_test_id("stDataFrame")
    )
    resizable = dataframe.get_by_test_id("stDataFrameResizable")
    text_below = block.get_by_text("Text below the fixed-height dataframe", exact=True)
    expect(container).to_have_css("height", "300px")
    expect(resizable).to_have_css("height", "300px")

    text_box = _box(text_below)
    container_box = _box(container)
    initial_gap = text_box["y"] - (container_box["y"] + container_box["height"])

    def _container_follows_grid(min_grid_height: float, max_grid_height: float) -> bool:
        grid_box = _box(resizable)
        container_box = _box(container)
        grid_bottom = grid_box["y"] + grid_box["height"]
        # Allow 1px because the boxes round fractional sizes differently.
        return (
            min_grid_height < grid_box["height"] < max_grid_height
            and abs(container_box["height"] - grid_box["height"]) <= 1
            and abs(_box(text_below)["y"] - grid_bottom - initial_gap) <= 1
        )

    # Check mid-drag and after release that the container grows with the grid
    # instead of staying at 300px while the grid paints over the text below.
    start_dragging_dataframe_resize_handle(app, dataframe, 150)
    wait_until(app, lambda: _container_follows_grid(400, 10_000))
    app.mouse.up()
    wait_until(app, lambda: _container_follows_grid(400, 10_000))

    # Dragging shorter than the configured height doesn't leave a gap.
    start_dragging_dataframe_resize_handle(app, dataframe, -250)
    app.mouse.up()
    wait_until(app, lambda: _container_follows_grid(0, 280))
