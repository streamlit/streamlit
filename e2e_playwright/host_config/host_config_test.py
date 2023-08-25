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

import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


@pytest.fixture(scope="package", autouse=True)
def apply_restrictive_host_config():
    """Apply a restrictive host config for all tests in this package."""
    # We need to do this in a package scope fixture to ensure that its applied
    # before the app server is started.
    os.environ["STREAMLIT_SERVER_DISABLE_UNSAFE_HTML_EXECUTION"] = "True"
    os.environ["STREAMLIT_SERVER_DISABLE_UNSAFE_IFRAMES"] = "True"
    os.environ[
        "STREAMLIT_SERVER_DISABLE_ELEMENTS"
    ] = "bokehChart,cameraInput,downloadButton,fileUploader"
    os.environ["STREAMLIT_SERVER_DISABLE_SET_QUERY_PARAMS"] = "True"
    os.environ["STREAMLIT_SERVER_DISABLE_SET_PAGE_METADATA"] = "True"
    os.environ["STREAMLIT_SERVER_DISABLE_USER_THEME"] = "True"
    # Configure a custom theme to test that it is not applied:
    os.environ["STREAMLIT_THEME_BACKGROUND_COLOR"] = "red"


def test_host_config_disable_elements(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that host config options to disable features show error messages."""
    alert_containers = app.get_by_role("alert")
    expect(alert_containers).to_have_count(8)

    assert_snapshot(alert_containers.nth(0), name="disabled_unsafe_html")
    assert_snapshot(alert_containers.nth(1), name="disabled_components_iframe")
    assert_snapshot(alert_containers.nth(2), name="disabled_components_html")
    assert_snapshot(alert_containers.nth(3), name="disabled_camera_input")
    assert_snapshot(alert_containers.nth(4), name="disabled_download_button")
    assert_snapshot(alert_containers.nth(5), name="disabled_file_uploader")
    assert_snapshot(alert_containers.nth(6), name="disabled_bokeh_chart")
    assert_snapshot(alert_containers.nth(7), name="disabled_custom_components")


def test_host_config_disables_setting_page_metadata(app: Page):
    """Test that setting the page metadata (title and favicon) is disabled."""
    # "Streamlit" is the default name. The name from the app script (Limited App)
    # should not be used.
    expect(app).to_have_title("Streamlit")
    # The favicon should also use the default value ("./favicon.png"):
    expect(app.locator("link[rel='shortcut icon']")).to_have_attribute(
        "href", "./favicon.png"
    )


def test_host_config_disables_setting_query_params(app: Page):
    """Test that setting the query params from user script is disabled."""
    query_params = app.evaluate("document.location.search")
    assert query_params == "", "Query params should be empty."


def test_host_config_disables_user_theme(app: Page):
    """Test that a configured user theme is not applied."""
    # Test that the app background color is the default white and not red:
    expect(app.locator(".stApp")).to_have_css("background-color", "rgb(255, 255, 255)")


def test_allowed_elements_still_visible(app: Page):
    """Test that other allowed elements are still visible."""
    expect(app.get_by_test_id("stMarkdownContainer").first).to_be_visible()
    expect(app.get_by_test_id("stArrowVegaLiteChart").first).to_be_visible()
    expect(app.get_by_test_id("stDataFrameResizable").first).to_be_visible()
