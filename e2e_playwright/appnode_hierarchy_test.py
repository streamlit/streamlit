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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import get_button, get_selectbox


def _select_mode(app: Page, mode: str) -> None:
    selectbox = get_selectbox(app, "Choose scenario").locator("input").first
    selectbox.fill(mode)
    selectbox.press("Enter")
    wait_for_app_run(app)


def test_swap_element_replaces_in_place_without_stale(app: Page) -> None:
    _select_mode(app, "swap_element")

    # Expect initial element to not be visible
    expect(app.get_by_text("initial element")).not_to_be_visible()
    expect(app.get_by_text("swapped element")).to_be_visible()


def test_insert_between_adds_only_one_element_in_between(app: Page) -> None:
    _select_mode(app, "insert_between")

    expect(app.get_by_text("between", exact=True)).not_to_be_visible()
    texts = [
        "top",
        "inserted element",
        "bottom",
    ]
    for index, text in enumerate(texts):
        expect(app.get_by_test_id("stMarkdown").nth(index)).to_have_text(text)


def test_long_compute_shows_spinner_only_during_run(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    _select_mode(app, "long_compute")

    texts = [
        "top",
        "second",
    ]
    disappearing_texts = [
        "second to last",
    ]
    stale_texts = [
        "bottom",
    ]
    for index, text in enumerate(texts + disappearing_texts + stale_texts):
        expect(app.get_by_test_id("stMarkdown").nth(index)).to_have_text(text)

    get_button(app, "run long compute").click()

    # we need to wait for the elements to be stale and the animation to complete
    # Unfortunately, we have to rely on a timeout here.
    app.wait_for_timeout(1000)

    # elements are still there
    for index, text in enumerate(texts + disappearing_texts + stale_texts):
        expect(app.get_by_test_id("stMarkdown").nth(index)).to_have_text(text)

    for text in disappearing_texts + stale_texts:
        expect(
            app.get_by_test_id("stElementContainer").filter(has_text=text)
        ).to_have_attribute("data-stale", "true")

    # snapshot the main container to show the stale elements faded
    main = app.get_by_test_id("stVerticalBlock")
    assert_snapshot(main, name="appnode_hierarchy-long_compute")

    wait_for_app_run(app)
    # check that the appropriate texts have disappeared
    expect(app.get_by_text("second to last")).not_to_be_visible()
    for index, text in enumerate(texts + stale_texts):
        expect(app.get_by_test_id("stMarkdown").nth(index)).to_have_text(text)


def test_placeholder_updates_do_not_leave_stale_elements(app: Page) -> None:
    _select_mode(app, "placeholder_updates")

    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("placeholder-top")
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text("placeholder-bottom")

    get_button(app, "update placeholder").click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").nth(0)).to_have_text("placeholder-top")
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text("placeholder-filled")
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_have_text("placeholder-bottom")


def test_simple_transient_spinner_does_not_leave_stale_elements(app: Page) -> None:
    _select_mode(app, "simple_transient_spinner")

    # Initial state
    expect(app.get_by_text("Hello world 1! (delta path 0 1)")).to_be_visible()

    get_button(app, "Rerun").click()

    # The app sleeps for 5s in the else block.
    # We check for stale elements after 0.5s.
    app.wait_for_timeout(500)

    expect(app.get_by_text("Hello world 2! (delta path 0 0)")).to_be_visible()

    # Verify no stale elements. We don't wait because the script run will eventually remove the stale elements.
    expect(app.locator("[data-stale='true']")).to_have_count(0, timeout=1)
    expect(app.get_by_text("Hello world 1! (delta path 0 1)")).not_to_be_visible()


def test_complex_transient_spinner_interrupted_does_not_leave_stale_elements(
    app: Page,
) -> None:
    _select_mode(app, "complex_transient_spinner")

    # Run without spinners first
    get_button(app, "Rerun without spinners").click()
    wait_for_app_run(app)

    # Run with spinners
    get_button(app, "Rerun with spinners").click()
    # Interrupt it (run without spinners)
    # This button might be disabled if we don't act fast or if the app blocks.
    # Assuming standard behavior where we can interrupt.
    get_button(app, "Rerun without spinners").click()

    wait_for_app_run(app)

    # Verify no unexpected stale element out of order.
    # Verify no stale elements. We don't wait because the script run will eventually remove the stale elements.
    expect(app.locator("[data-stale='true']")).to_have_count(0, timeout=1)
    expect(app.get_by_text("some text")).to_have_count(2)


def test_chat_transient_spinner_does_not_leave_stale_elements(app: Page) -> None:
    _select_mode(app, "chat_transient_spinner")

    chat_input = app.get_by_test_id("stChatInput").locator("textarea")

    # Type content and enter
    chat_input.fill("Message 1")
    chat_input.press("Enter")
    wait_for_app_run(app)

    expect(app.get_by_text("Echo: Message 1")).to_be_visible()

    # Type more content and enter
    chat_input.fill("Message 2")
    chat_input.press("Enter")

    # Wait 0.5s and verify no stale elements
    app.wait_for_timeout(500)
    # Verify no stale elements. We don't wait because the script run will eventually remove the stale elements.
    expect(app.locator("[data-stale='true']")).to_have_count(0, timeout=1)

    wait_for_app_run(app)
    expect(app.get_by_text("Echo: Message 2")).to_be_visible()
