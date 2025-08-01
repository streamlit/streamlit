# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)


def test_vega_lite_chart_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test fullscreen open/close for the vega_lite_chart in the first container."""
    wait_for_app_run(app)
    expect(app.get_by_test_id("stVegaLiteChart")).to_have_count(1)

    widget_element = app.get_by_test_id("stVegaLiteChart").first
    widget_toolbar = widget_element.locator("..").get_by_test_id("stElementToolbar")
    fullscreen_wrapper = app.get_by_test_id("stFullScreenFrame").first

    fullscreen_toolbar_button = widget_toolbar.get_by_test_id(
        "stElementToolbarButton"
    ).last

    widget_element.hover()
    expect(widget_toolbar).to_have_css("opacity", "1")

    assert_snapshot(
        widget_element,
        name="st_layouts_container_directions_fullscreen_elements-vega_lite_chart-normal",
    )

    fullscreen_toolbar_button.click()

    expect(
        widget_toolbar.get_by_role("button", name="Close fullscreen")
    ).to_be_visible()

    assert_snapshot(
        app,
        name="st_layouts_container_directions_fullscreen_elements-vega_lite_chart-fullscreen_expanded",
    )

    fullscreen_toolbar_button.click()

    expect(widget_toolbar.get_by_role("button", name="Fullscreen")).to_be_visible()

    assert_snapshot(
        fullscreen_wrapper,
        name="st_layouts_container_directions_fullscreen_elements-vega_lite_chart-fullscreen_collapsed",
    )


def test_dataframe_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test fullscreen open/close for the dataframe in the second container."""
    wait_for_app_run(app)
    expect(app.get_by_test_id("stDataFrame")).to_have_count(1)
    assert_fullscreen_toolbar_button_interactions(
        app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDataFrame",
        filename_prefix="st_layouts_container_directions_fullscreen_elements-dataframe",
        nth=0,
        fullscreen_wrapper_nth=1,
    )
