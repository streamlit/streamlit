# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until


def get_first_graph_svg(app: Page):
    return app.get_by_test_id("stGraphVizChart").nth(0).locator("svg")


def click_fullscreen(app: Page):
    app.get_by_test_id("StyledFullScreenButton").nth(0).click()
    # Wait for the animation to finish
    app.wait_for_timeout(1000)


def test_initial_setup(app: Page):
    """Initial setup: ensure charts are loaded."""
    expect(
        app.get_by_test_id("stGraphVizChart").locator("svg > g > title")
    ).to_have_count(6)


def test_shows_left_and_right_graph(app: Page):
    """Test if it shows left and right graph."""

    expect(app.locator(".stGraphVizChart > svg > g > title").nth(3)).to_have_text(
        "Left"
    )
    expect(app.locator(".stGraphVizChart > svg > g > title").nth(4)).to_have_text(
        "Right"
    )


def test_first_graph_dimensions(app: Page):
    """Test the dimensions of the first graph."""

    first_graph_svg = get_first_graph_svg(app)
    expect(first_graph_svg).to_have_attribute("width", "79pt")
    expect(first_graph_svg).to_have_attribute("height", "116pt")


def test_first_graph_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test if the first graph shows in fullscreen."""

    # Hover over the parent div
    app.get_by_test_id("stGraphVizChart").nth(0).hover()

    # Enter fullscreen
    click_fullscreen(app)

    first_graph_svg = get_first_graph_svg(app)
    # The width and height unset on the element on fullscreen
    expect(first_graph_svg).not_to_have_attribute("width", "79pt")
    expect(first_graph_svg).not_to_have_attribute("height", "116pt")

    def check_dimensions():
        svg_dimensions = first_graph_svg.bounding_box()
        return svg_dimensions["width"] == 1256 and svg_dimensions["height"] == 662

    wait_until(app, check_dimensions)

    assert_snapshot(first_graph_svg, name="st_graphviz-fullscreen")


def test_first_graph_after_exit_fullscreen(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test if the first graph has correct size after exiting fullscreen."""

    # Hover over the parent div
    app.get_by_test_id("stGraphVizChart").nth(0).hover()

    # Enter and exit fullscreen
    click_fullscreen(app)
    click_fullscreen(app)

    first_graph_svg = get_first_graph_svg(app)
    expect(first_graph_svg).to_have_attribute("width", "79pt")
    expect(first_graph_svg).to_have_attribute("height", "116pt")
    assert_snapshot(first_graph_svg, name="st_graphviz-after_exit_fullscreen")


def test_renders_with_specified_engines(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test if it renders with specified engines."""

    engines = ["dot", "neato", "twopi", "circo", "fdp", "osage", "patchwork"]

    radios = app.query_selector_all('label[data-baseweb="radio"]')

    for idx, engine in enumerate(engines):
        radios[idx].click(force=True)
        wait_for_app_run(app)
        expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text(engine)

        assert_snapshot(
            app.get_by_test_id("stGraphVizChart").nth(2).locator("svg"),
            name=f"st_graphviz_chart_engine-{engine}",
        )


def test_dot_string(app: Page, assert_snapshot: ImageCompareFunction):
    """Test if it renders charts when input is a string (dot language)."""

    title = app.locator(".stGraphVizChart > svg > g > title").nth(5)
    expect(title).to_have_text("Dot")

    assert_snapshot(
        app.get_by_test_id("stGraphVizChart").nth(5).locator("svg"),
        name="st_graphviz-chart_dot_string",
    )
