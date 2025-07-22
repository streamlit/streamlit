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

import os

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_custom_text_color():
    """Configure theme.textColor and theme.primaryColor."""
    # We need to do this in a package scope fixture to ensure that its applied
    # before the app server is started.
    os.environ["STREAMLIT_THEME_TEXT_COLOR"] = "#BB1010"
    os.environ["STREAMLIT_THEME_PRIMARY_COLOR"] = "#0E0E0E"
    yield
    del os.environ["STREAMLIT_THEME_TEXT_COLOR"]
    del os.environ["STREAMLIT_THEME_PRIMARY_COLOR"]


@pytest.mark.usefixtures("configure_custom_text_color")
def test_custom_text_color(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that custom text color is applied correctly to SidebarNav."""
    app.get_by_text("Logo Page").click()
    wait_for_app_loaded(app)

    assert_snapshot(app.get_by_test_id("stSidebar"), name="sidebar-nav-custom-theme")
