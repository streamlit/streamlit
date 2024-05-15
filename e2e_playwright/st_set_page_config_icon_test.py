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


import re

from playwright.sync_api import Page, expect


def test_st_set_page_config_sets_page_icon(app: Page):
    favicon_element = app.locator("link[rel='shortcut icon']")
    expect(favicon_element).to_have_count(1)
    expect(favicon_element).to_have_attribute(
        "href",
        re.compile(r"d1e92a291d26c1e0cb9b316a93c929b3be15899677ef3bc6e3bf3573\.png"),
    )
