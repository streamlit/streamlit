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


from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_link_button_display(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that st.link_button renders correctly."""
    link_elements = themed_app.get_by_test_id("stLinkButton")
    expect(link_elements).to_have_count(6)

    for i, element in enumerate(link_elements.all()):
        assert_snapshot(element, name=f"link-button-{i}")
        element.hover()
        assert_snapshot(element, name=f"link-button-hover-{i}")
        element.focus()
        assert_snapshot(element, name=f"link-button-focus-{i}")
