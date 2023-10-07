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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_initial_setup(app: Page):
    """Initial setup: ensure charts are loaded."""

    wait_for_app_run(app)
    title_count = len(app.locator(".stGraphVizChart > svg > g > title").all())
    assert title_count == 6


def test_shows_left_and_right_graph(app: Page):
    """Test if it shows left and right graph."""

    left_text = app.locator(".stGraphVizChart > svg > g > title").nth(3).text_content()
    right_text = app.locator(".stGraphVizChart > svg > g > title").nth(4).text_content()
    assert "Left" in left_text and "Right" in right_text


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
            app.locator(".stGraphVizChart > svg").nth(2),
            name=f"st_graphviz_chart_engine-{engine}",
        )


def test_dot_string(app: Page, assert_snapshot: ImageCompareFunction):
    """Test if it renders charts when input is a string (dot language)."""

    title = app.locator(".stGraphVizChart > svg > g > title").nth(5)
    expect(title).to_have_text("Dot")

    assert_snapshot(
        app.locator(".stGraphVizChart > svg").nth(5),
        name="st_graphviz_chart_dot_string",
    )
