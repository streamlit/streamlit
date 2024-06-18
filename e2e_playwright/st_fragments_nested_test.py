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

from e2e_playwright.shared.app_utils import click_button


def get_uuids(app: Page):
    expect(app.get_by_test_id("stMarkdown")).to_have_count(3)

    outside_fragment_text = app.get_by_test_id("stMarkdown").first.text_content()
    inner_fragment_text = app.get_by_test_id("stMarkdown").nth(1).text_content()
    outer_fragment_text = app.get_by_test_id("stMarkdown").last.text_content()

    return outside_fragment_text, inner_fragment_text, outer_fragment_text


def test_full_app_rerun(app: Page):
    outside_fragment_text, inner_fragment_text, outer_fragment_text = get_uuids(app)

    click_button(app, "rerun whole app")

    # The full app reran, so all of the UUIDs in the app should have changed.
    expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(
        outside_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").nth(1)).not_to_have_text(
        inner_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(outer_fragment_text)


def test_outer_fragment_rerun(app: Page):
    outside_fragment_text, inner_fragment_text, outer_fragment_text = get_uuids(app)

    click_button(app, "rerun outer fragment")

    # We reran the outer fragment, so the UUID outside of the fragments should stay
    # constant, but the other two should have changed.
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(outside_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(1)).not_to_have_text(
        inner_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(outer_fragment_text)


def test_inner_fragment_rerun(app: Page):
    outside_fragment_text, inner_fragment_text, outer_fragment_text = get_uuids(app)

    click_button(app, "rerun inner fragment")

    # We reran the inner fragment. Only that corresponding UUID should have changed.
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(outside_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(inner_fragment_text)
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(outer_fragment_text)
