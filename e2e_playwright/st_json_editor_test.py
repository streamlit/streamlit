# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""E2E tests for st.json_editor."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key


def test_json_editor_renders(app: Page):
    """Test that json editors render correctly."""
    # Get all json editors on the page
    json_editors = app.get_by_test_id("stJsonEditor")

    # We should have 7 json editors (dict, list, string, disabled, height, empty, callback)
    expect(json_editors).to_have_count(7)

    # All should be visible
    for i in range(7):
        expect(json_editors.nth(i)).to_be_visible()


def test_json_editor_dict_returns_dict(app: Page):
    """Test that dict input returns dict type."""
    # Find the result type text for dict editor
    expect(app.get_by_text("Dict result type: dict")).to_be_visible()


def test_json_editor_list_returns_list(app: Page):
    """Test that list input returns list type."""
    expect(app.get_by_text("List result type: list")).to_be_visible()


def test_json_editor_string_returns_string(app: Page):
    """Test that string input returns string type."""
    expect(app.get_by_text("String result type: str")).to_be_visible()


def test_json_editor_empty_returns_empty_dict(app: Page):
    """Test that empty dict input works."""
    expect(app.get_by_text("Empty result: {}")).to_be_visible()


def test_json_editor_with_height(app: Page):
    """Test that height parameter is applied correctly."""
    # Get the json editor with height using key-based locator
    height_editor = get_element_by_key(app, "height_editor").get_by_test_id(
        "stJsonEditor"
    )

    # Check that it has the height style
    expect(height_editor).to_have_css("height", "200px")


def test_json_editor_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Test visual snapshot of json editor."""
    # Take a snapshot of the dict json editor using key-based locator
    dict_editor = get_element_by_key(app, "dict_editor").get_by_test_id("stJsonEditor")
    assert_snapshot(dict_editor, name="st_json_editor-dict")


def test_json_editor_disabled_snapshot(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual snapshot of disabled json editor."""
    # Get disabled editor using key-based locator
    disabled_editor = get_element_by_key(app, "disabled_editor").get_by_test_id(
        "stJsonEditor"
    )
    assert_snapshot(disabled_editor, name="st_json_editor-disabled")
