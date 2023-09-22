# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction


def get_first_graph_svg(app: Page):
    return app.locator(".stGraphVizChart > svg").nth(0)


def test_initial_setup(app: Page):
    """Initial setup: ensure charts are loaded."""

    title_count = len(app.locator(".stGraphVizChart > svg > g > title").all())
    assert title_count == 5


def test_shows_left_and_right_graph(app: Page):
    """Test if it shows left and right graph."""

    left_text = app.locator(".stGraphVizChart > svg > g > title").nth(3).text_content()
    right_text = app.locator(".stGraphVizChart > svg > g > title").nth(4).text_content()
    assert "Left" in left_text and "Right" in right_text


def test_first_graph_dimensions(app: Page):
    """Test the dimensions of the first graph."""

    first_graph_svg = get_first_graph_svg(app)
    assert first_graph_svg.get_attribute("width") == "79pt"
    assert first_graph_svg.get_attribute("height") == "116pt"


def test_first_graph_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test if the first graph shows in fullscreen."""

    # Hover over the parent div
    app.locator(".stGraphVizChart").nth(0).hover()

    # Enter fullscreen
    app.locator('[data-testid="StyledFullScreenButton"]').nth(0).click()

    first_graph_svg = get_first_graph_svg(app)
    assert first_graph_svg.get_attribute("width") == "100%"
    assert first_graph_svg.get_attribute("height") == "100%"
    assert_snapshot(first_graph_svg, name="graphviz_fullscreen")


def test_first_graph_after_exit_fullscreen(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test if the first graph has correct size after exiting fullscreen."""

    # Hover over the parent div
    app.locator(".stGraphVizChart").nth(0).hover()

    # Enter and exit fullscreen
    app.locator("[data-testid='StyledFullScreenButton']").nth(0).click()
    # Wait for the animation to finish
    app.wait_for_timeout(1000)
    app.locator("[data-testid='StyledFullScreenButton']").nth(0).click()

    first_graph_svg = get_first_graph_svg(app)
    assert first_graph_svg.get_attribute("width") == "79pt"
    assert first_graph_svg.get_attribute("height") == "116pt"
    assert_snapshot(first_graph_svg, name="graphviz_after_exit_fullscreen")
