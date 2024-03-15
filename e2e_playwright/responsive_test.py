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

from e2e_playwright.conftest import ImageCompareFunction


def test_fullscreen_button_edge_case(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that window doesn't oveflow with window"""
    app.set_viewport_size({"width": 780, "height": 400})
    image = app.get_by_test_id("stFullScreenFrame")
    expect(image).to_have_count(1)
    image.hover()
    expect(app.get_by_test_id("StyledFullScreenButton")).to_have_css("opacity", "1")

    assert_snapshot(app, name="page_fullscreen_button_edge_case")
