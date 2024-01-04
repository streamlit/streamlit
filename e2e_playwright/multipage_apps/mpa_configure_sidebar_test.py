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

import os

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_show_sidebar_nav():
    """Configure client.showSidebarNavigation=False."""
    # We need to do this in a package scope fixture to ensure that its applied
    # before the app server is started.
    os.environ["STREAMLIT_CLIENT_SHOW_SIDEBAR_NAVIGATION"] = "False"
    yield
    del os.environ["STREAMLIT_CLIENT_SHOW_SIDEBAR_NAVIGATION"]


def test_hides_sidebar_nav(app: Page, configure_show_sidebar_nav):
    """Test that client.showSidebarNavigation=False hides the sidebar."""
    expect(app.get_by_test_id("stSidebar")).not_to_be_attached()
