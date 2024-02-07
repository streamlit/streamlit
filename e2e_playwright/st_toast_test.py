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


def test_default_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(2)

    expect(toasts.nth(1)).to_be_visible()
    expect(toasts.nth(1)).to_have_text("This is a default toast message")


def test_collapsed_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test collapsed long toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(2)

    expect(toasts.nth(0)).to_be_visible()
    expect(toasts.nth(0)).to_have_text(
        "Random toast message that is a really really really really really really really long message, going way"
    )


def test_expanded_toast_rendering(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test expanded long toasts are correctly rendered."""
    themed_app.keyboard.press("r")
    toasts = themed_app.get_by_test_id("stToast")
    expect(toasts).to_have_count(2)

    themed_app.get_by_test_id("toastViewButton").click()

    expect(toasts.nth(0)).to_be_visible()
    expect(toasts.nth(0)).to_have_text(
        "Random toast message that is a really really really really really really really long message, going way past the 3 line limit"
    )


def test_toast_overlay_with_chat(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that toasts overlay with st.chat_input."""
    themed_app.keyboard.press("r")
    container = themed_app.get_by_test_id("stBottomBlockContainer")
    toasts = themed_app.get_by_test_id("stToast")

    expect(toasts.nth(0)).to_be_visible()
    assert_snapshot(container, name="toast-with-chat")
