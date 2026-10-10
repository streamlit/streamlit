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

from e2e_playwright.shared.app_utils import click_checkbox, get_element_by_key


def test_fragment_runs_at_interval(app: Page):
    fragment_text = app.get_by_test_id("stMarkdown").first.text_content()

    assert fragment_text is not None

    # Verify that the fragment text updates a few times.
    for _ in range(3):
        expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(fragment_text)
        fragment_text = app.get_by_test_id("stMarkdown").first.text_content()
        assert fragment_text is not None


def test_nested_fragment_run_every_can_hide_without_crash(app: Page):
    """Hiding a nested ``run_every`` fragment must not white-screen (issue #15084)."""
    expect(app.get_by_test_id("stException")).to_have_count(0)

    standalone_fragment = get_element_by_key(app, "standalone_auto_fragment")
    nested_fragment = get_element_by_key(app, "nested_auto_fragment")

    standalone_text = standalone_fragment.get_by_test_id(
        "stMarkdown"
    ).first.text_content()
    assert standalone_text is not None

    nested_text = nested_fragment.get_by_test_id("stMarkdown").first.text_content()
    assert nested_text is not None

    # Prove the nested auto fragment mounted and ticked before hiding it.
    expect(nested_fragment.get_by_test_id("stMarkdown").first).not_to_have_text(
        nested_text
    )
    nested_text = nested_fragment.get_by_test_id("stMarkdown").first.text_content()
    assert nested_text is not None

    click_checkbox(app, "Show nested auto fragment")
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # After hiding, let the app run through several run_every cycles (observed via
    # the standalone auto fragment still ticking) before asserting the nested
    # fragment is gone. This drains any in-flight nested run_every tick that can
    # briefly re-render ``.st-key-nested_auto_fragment`` right after the uncheck,
    # so we assert the settled state instead of racing the transient. A genuine
    # #15084 regression keeps the nested container attached and still fails the
    # not_to_be_attached check below (as well as the stException checks).
    for _ in range(3):
        expect(standalone_fragment.get_by_test_id("stMarkdown").first).not_to_have_text(
            standalone_text
        )
        standalone_text = standalone_fragment.get_by_test_id(
            "stMarkdown"
        ).first.text_content()
        assert standalone_text is not None
        expect(app.get_by_test_id("stException")).to_have_count(0)

    expect(nested_fragment).not_to_be_attached()
    expect(app.get_by_test_id("stException")).to_have_count(0)

    click_checkbox(app, "Show nested auto fragment")
    expect(get_element_by_key(app, "nested_auto_fragment")).to_be_visible()
    expect(app.get_by_test_id("stException")).to_have_count(0)
