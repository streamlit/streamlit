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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def _assert_element_not_remounted_on_rerun(page: Page) -> None:
    """The element filling a placeholder should be updated in place across
    reruns rather than being unmounted and remounted (which would reset its
    client-side React state).
    """
    text_input = page.get_by_test_id("stTextInput")
    expect(text_input).to_be_visible()

    # Tag the live DOM node. If the element is remounted on the next rerun, the
    # replacement node will not carry this marker attribute.
    text_input.evaluate("el => el.setAttribute('data-persist-marker', 'kept')")
    expect(page.locator("[data-persist-marker='kept']")).to_have_count(1)

    # Trigger a rerun. The app has a slow fill, so the placeholder is flushed
    # before the fill.
    click_button(page, "rerun")
    wait_for_app_run(page)

    # The same DOM node survived the rerun => the element was not remounted.
    expect(page.locator("[data-persist-marker='kept']")).to_have_count(1)
    # And there is still exactly one text input (no duplicate / leftover).
    expect(page.get_by_test_id("stTextInput")).to_have_count(1)


def test_st_empty_does_not_remount_element_on_rerun(app: Page):
    _assert_element_not_remounted_on_rerun(app)


def test_st_skeleton_standalone_does_not_remount_element_on_rerun(
    app: Page, app_base_url: str
):
    app.goto(build_app_url(app_base_url, query={"placeholder": "skeleton"}))
    wait_for_app_loaded(app)
    _assert_element_not_remounted_on_rerun(app)
