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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import expect_markdown


def test_components_v1_was_imported_successfully(app: Page):
    expect(app.locator("iframe")).to_be_attached()
    iframe = app.frame_locator("iframe")
    div = iframe.locator("div")
    expect(div).to_have_text("This import and usage worked!")

    expect_markdown(app, "<bound method IframeMixin._iframe of DeltaGenerator()>")
    expect_markdown(app, re.compile("<function declare_component at .*>"))
