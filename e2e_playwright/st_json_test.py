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
from e2e_playwright.shared.app_utils import check_top_level_class


def test_st_json_displays_correctly(app: Page, assert_snapshot: ImageCompareFunction):
    """Test st.json renders the data correctly."""
    json_elements = app.get_by_test_id("stJson")
    expect(json_elements).to_have_count(7)

    assert_snapshot(json_elements.nth(0), name="st_json-simple_dict")
    assert_snapshot(json_elements.nth(1), name="st_json-collapsed")
    assert_snapshot(json_elements.nth(2), name="st_json-with_white_spaces")
    # The complex dict is screenshot tested in the themed test below
    assert_snapshot(json_elements.nth(4), name="st_json-simple_list")
    assert_snapshot(json_elements.nth(5), name="st_json-empty_dict")
    assert_snapshot(json_elements.nth(6), name="st_json-expanded_2")


def test_st_json_displays_correctly_when_themed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test st.json uses renders the data correctly with different themes."""
    json_elements = themed_app.get_by_test_id("stJson")
    assert_snapshot(json_elements.nth(3), name="st_json-complex_dict")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stJson")
