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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class

LINK_BUTTON_ELEMENTS = 12


def test_link_button_display(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.link_button renders correctly."""
    link_elements = themed_app.get_by_test_id("stLinkButton")
    expect(link_elements).to_have_count(LINK_BUTTON_ELEMENTS)

    assert_snapshot(link_elements.nth(0), name="st_link_button-default")
    assert_snapshot(link_elements.nth(1), name="st_link_button-disabled")
    assert_snapshot(link_elements.nth(2), name="st_link_button-primary")
    assert_snapshot(link_elements.nth(3), name="st_link_button-primary_disabled")
    assert_snapshot(link_elements.nth(4), name="st_link_button-container_width")
    assert_snapshot(link_elements.nth(5), name="st_link_button-primary_container_width")
    assert_snapshot(link_elements.nth(6), name="st_link_button-emoji_icon")
    assert_snapshot(link_elements.nth(7), name="st_link_button-material_icon")
    assert_snapshot(link_elements.nth(8), name="st_link_button-tertiary")
    assert_snapshot(link_elements.nth(9), name="st_link_button-tertiary_disabled")
    assert_snapshot(
        link_elements.nth(10), name="st_link_button-tertiary_container_width"
    )
    assert_snapshot(link_elements.nth(11), name="st_link_button-help")


def test_link_button_hover(themed_app: Page, assert_snapshot: ImageCompareFunction):
    link_elements = themed_app.get_by_test_id("stLinkButton")
    expect(link_elements).to_have_count(LINK_BUTTON_ELEMENTS)

    default_link_button = themed_app.get_by_test_id("stLinkButton").nth(0)
    themed_app.get_by_text("Default Link").hover()
    assert_snapshot(default_link_button, name="st_link_button-default_hover")

    primary_link_button = themed_app.get_by_test_id("stLinkButton").nth(2)
    themed_app.get_by_text("Primary Link").hover()
    assert_snapshot(primary_link_button, name="st_link_button-primary_hover")

    tertiary_link_button = themed_app.get_by_test_id("stLinkButton").nth(8)
    themed_app.get_by_text("Tertiary link button").hover()
    assert_snapshot(tertiary_link_button, name="st_link_button-tertiary_hover")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stLinkButton")
