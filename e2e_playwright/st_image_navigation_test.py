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
from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import get_image


def test_image_internal_link_navigates_to_page(app: Page) -> None:
    """Clicking an image with an internal link navigates to the correct page."""
    linked_image = get_image(app, "Click to go to Details")
    link_wrapper = linked_image.get_by_test_id("stImageLink")

    expect(link_wrapper).to_be_visible()
    # Internal links must NOT open in a new tab
    expect(link_wrapper).not_to_have_attribute("target", "_blank")

    link_wrapper.click()

    expect(app).to_have_url(re.compile(r"/page_details$"))
    expect(app.get_by_text("Details Page")).to_be_visible()
    expect(app.get_by_text("Success! Internal navigation via st.image worked.")).to_be_visible()
