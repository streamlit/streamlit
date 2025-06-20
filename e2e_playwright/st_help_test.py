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


from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class, get_element_by_key


def _get_keyed_help_element(app: Page, key: str) -> Locator:
    """Get a help element in a keyed container."""
    element = get_element_by_key(app, key).get_by_test_id("stHelp").first
    expect(element).to_be_visible()
    element.scroll_into_view_if_needed()
    return element


def test_help_display(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.header renders correctly with dividers."""
    help_elements = app.get_by_test_id("stHelp")
    expect(help_elements).to_have_count(6)
    assert_snapshot(
        _get_keyed_help_element(app, "help_no_docs"),
        name="st_help-class_no_docs",
    )
    assert_snapshot(
        _get_keyed_help_element(app, "help_globals"),
        name="st_help-globals",
    )
    assert_snapshot(
        _get_keyed_help_element(app, "help_long_docs"),
        name="st_help-long_docs",
    )
    assert_snapshot(
        _get_keyed_help_element(app, "help_mixed_docs"),
        name="st_help-mixed_docs",
    )


def test_help_width_variations(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that help() renders correctly with different width settings."""
    help_elements = app.get_by_test_id("stHelp")
    expect(help_elements).to_have_count(6)

    assert_snapshot(
        help_elements.nth(4),
        name="st_help-fixed_width",
    )

    assert_snapshot(
        help_elements.nth(5),
        name="st_help-stretch_width_explicit",
    )


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stHelp")
