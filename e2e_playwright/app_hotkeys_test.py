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


def test_shows_clear_cache_dialog_when_c_is_pressed(app: Page):
    app.keyboard.type("c")
    expect(app.get_by_role("dialog")).to_be_visible()
    expect(app.get_by_role("dialog")).to_have_text(
        """
Clear cachesAre you sure you want to clear the app's function caches?This will remove all cached entries from functions using @st.cache, @st.cache_data, and @st.cache_resource.CancelClear caches
    """
    )


modifier_keys = ["Control", "Meta"]


def test_does_not_show_clear_cache_when_modifier_c_is_pressed(app: Page):
    for key in modifier_keys:
        app.keyboard.press(f"{key}+c")
    expect(app.get_by_test_id("stClearCacheDialog")).not_to_be_visible()


def test_does_not_clear_cache_dialog_when_c_is_pressed_inside_text_input(app: Page):
    app.get_by_test_id("stTextInput").type("c")
    expect(app.get_by_test_id("stClearCacheDialog")).not_to_be_visible()


def test_reruns_when_r_is_pressed(app: Page):
    app.keyboard.type("r")
    expect(app.get_by_test_id("stStatusWidget")).to_be_visible()


def test_does_not_clear_cache_dialog_when_r_is_pressed_inside_text_input(
    app: Page,
):
    app.get_by_test_id("stTextInput").press("r")
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_visible()
