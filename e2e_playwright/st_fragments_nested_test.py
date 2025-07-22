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

from __future__ import annotations

from typing import Final

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import click_button

COUNTER_TEXT_START: Final = "Counter has value"
DEFAULT_NUMBER_MARKDOWN_ELEMENTS: Final = 4


def _get_uuids(
    app: Page, markdown_count: int = DEFAULT_NUMBER_MARKDOWN_ELEMENTS
) -> tuple[str, str, str, str]:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(markdown_count)

    outside_fragment_text = (
        app.get_by_test_id("stMarkdown")
        .filter(has_text="outside all fragments:")
        .text_content()
        or ""
    )
    outer_fragment_text = (
        app.get_by_test_id("stMarkdown")
        .filter(has_text="outer fragment:")
        .text_content()
        or ""
    )
    inner_fragment_text = (
        app.get_by_test_id("stMarkdown")
        .filter(has_text="inner fragment:")
        .text_content()
        or ""
    )
    inner_fragment2_text = (
        app.get_by_test_id("stMarkdown")
        .filter(has_text="inner fragment2:")
        .text_content()
        or ""
    )

    return (
        outside_fragment_text,
        outer_fragment_text,
        inner_fragment_text,
        inner_fragment2_text,
    )


def _rerun_outer_fragment(app: Page):
    click_button(app, "rerun outer fragment")


def _rerun_inner_fragment(app: Page):
    click_button(app, "rerun inner fragment1")


def _rerun_inner_fragment2(app: Page):
    click_button(app, "rerun inner fragment2")


def _get_inner_fragment_counter_text(app: Page) -> Locator:
    return app.get_by_test_id("stMarkdown").filter(has_text=COUNTER_TEXT_START)


def test_full_app_rerun(app: Page):
    (
        outside_fragment_text,
        outer_fragment_text,
        inner_fragment_text,
        inner_fragment2_text,
    ) = _get_uuids(app)

    click_button(app, "rerun whole app")

    # The full app reran, so all of the UUIDs in the app should have changed.
    expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(
        outside_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").nth(1)).not_to_have_text(
        outer_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").nth(2)).not_to_have_text(
        inner_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(inner_fragment2_text)


def test_outer_fragment_rerun(app: Page):
    (
        outside_fragment_text,
        outer_fragment_text,
        inner_fragment_text,
        inner_fragment2_text,
    ) = _get_uuids(app)

    _rerun_outer_fragment(app)

    # We reran the outer fragment, so the UUID outside of the fragments should stay
    # constant, but the nested fragments' UUIDs should have changed.
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(outside_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(1)).not_to_have_text(
        outer_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").nth(2)).not_to_have_text(
        inner_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(inner_fragment2_text)


def test_inner_fragment_rerun(app: Page):
    (
        outside_fragment_text,
        outer_fragment_text,
        inner_fragment_text,
        inner_fragment2_text,
    ) = _get_uuids(app)

    _rerun_inner_fragment(app)

    # We reran the inner fragment directly nested in the outer fragment. This UUID and
    # UUID of the inner fragment's nested fragment (inner_fragment2) should've changed.
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(outside_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(outer_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(2)).not_to_have_text(
        inner_fragment_text
    )
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(inner_fragment2_text)


def test_inner_fragment2_rerun(app: Page):
    (
        outside_fragment_text,
        outer_fragment_text,
        inner_fragment_text,
        inner_fragment2_text,
    ) = _get_uuids(app)

    _rerun_inner_fragment2(app)

    # We reran the inner-most nested fragment. Only that corresponding UUID should have
    # changed.
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(outside_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(1)).to_have_text(outer_fragment_text)
    expect(app.get_by_test_id("stMarkdown").nth(2)).to_have_text(inner_fragment_text)
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(inner_fragment2_text)


def test_outer_fragment_rerun_clears_stale_widgets_in_inner_fragment(app: Page):
    expect(_get_inner_fragment_counter_text(app)).to_have_count(0)

    max_bound: Final = 2
    for i in range(max_bound):
        _rerun_outer_fragment(app)
        # the inner text is rendered now
        counter_text = _get_inner_fragment_counter_text(app)
        expect(counter_text).to_have_count(1)
        expect(counter_text).to_have_text(f"{COUNTER_TEXT_START} {i + 1}")

    # rerunning inner fragment should not change the inner fragment text
    number_markdown_elements: Final = DEFAULT_NUMBER_MARKDOWN_ELEMENTS + 1
    _, _, previous_inner_fragment_text, _ = _get_uuids(app, number_markdown_elements)
    for _ in range(10):
        _rerun_inner_fragment(app)
        # ensure that the inner fragment indeed runs
        _, _, inner_fragment_text, _ = _get_uuids(app, number_markdown_elements)
        assert previous_inner_fragment_text != inner_fragment_text
        # the inner text stays the same
        counter_text = _get_inner_fragment_counter_text(app)
        expect(counter_text).to_have_count(1)
        expect(counter_text).to_have_text(f"{COUNTER_TEXT_START} {max_bound}")
        previous_inner_fragment_text = inner_fragment_text

    # rerunning outer fragment should increase the counter above the max_bound value
    # and clear the inner fragment text
    _rerun_outer_fragment(app)
    expect(_get_inner_fragment_counter_text(app)).to_have_count(0)
