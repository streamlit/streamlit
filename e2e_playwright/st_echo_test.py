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


def test_echo_msg(app: Page):
    """Test that st.echo shows that the correct message."""
    echo_msg = app.locator(".element-container pre").nth(0)

    expect(echo_msg).to_have_text('st.write("This code is awesome!")')


def test_echo_msg_code_location(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.echo shows the correct location above and below"""
    screen = app.get_by_test_id("stVerticalBlockBorderWrapper")

    assert_snapshot(screen, name="st_echo-code_location_above_and_below")
