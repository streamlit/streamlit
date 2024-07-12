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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import wait_for_app_run


def _get_uuids(app: Page, expected_markdown_count: int = 2):
    """Test that fragments run and the uuids are written."""
    expect(app.get_by_test_id("stMarkdown")).to_have_count(expected_markdown_count)

    fragment_1_text = app.get_by_test_id("stMarkdown").first.text_content()
    fragment_2_text = app.get_by_test_id("stMarkdown").last.text_content()

    return fragment_1_text, fragment_2_text


def _get_fragment_checkbox(app: Page) -> Locator:
    return app.get_by_test_id("stCheckbox").nth(1).locator("span").first


def _get_app_raise_exception_checkbox(app: Page) -> Locator:
    return app.get_by_test_id("stCheckbox").nth(0).locator("span").first


def test_fragments_run_independently(app: Page):
    fragment_1_text, fragment_2_text = _get_uuids(app)

    # Click the first button and verify that only the uuid in the first fragment
    # changed.
    app.get_by_test_id("stButton").locator("button").first.click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").first).not_to_have_text(fragment_1_text)
    expect(app.get_by_test_id("stMarkdown").last).to_have_text(fragment_2_text)

    fragment_1_text, fragment_2_text = _get_uuids(app)

    # Click the second button and verify that only the uuid in the second fragment
    # changed.
    app.get_by_test_id("stButton").locator("button").last.click()
    wait_for_app_run(app)
    expect(app.get_by_test_id("stMarkdown").first).to_have_text(fragment_1_text)
    expect(app.get_by_test_id("stMarkdown").last).not_to_have_text(fragment_2_text)


def test_fragment_exception_disappears_when_rerun(app: Page):
    """Unselecting the checkbox should hide the exception message.
    If this does not work, the reason might be that the exception is
    written in the main app's delta path and a fragment rerun does not
    remove the element.
    """
    fragment_1_text, fragment_2_text = _get_uuids(app)
    wait_for_app_run(app)
    assert fragment_1_text is not None
    assert fragment_2_text is not None
    assert fragment_1_text != fragment_2_text

    # show exception
    _get_fragment_checkbox(app).click()
    expect(app.get_by_test_id("stException")).to_have_count(1)

    # ensure that the fragment texts are still visible
    fragment_1_text, fragment_2_text = _get_uuids(app)
    wait_for_app_run(app)
    assert fragment_1_text is not None
    assert fragment_2_text is not None
    assert fragment_1_text != fragment_2_text

    # hide exception
    _get_fragment_checkbox(app).click()
    expect(app.get_by_test_id("stException")).to_have_count(0)


def test_fragment_exception_during_full_app_run(app: Page):
    fragment_1_text, fragment_2_text = _get_uuids(app)
    wait_for_app_run(app)
    assert fragment_1_text is not None
    assert fragment_2_text is not None
    assert fragment_1_text != fragment_2_text

    _get_app_raise_exception_checkbox(app).click()
    wait_for_app_run(app)
    fragment_1_text, fragment_2_text = _get_uuids(app, expected_markdown_count=1)
    expect(app.get_by_test_id("stException")).to_have_count(1)
    # the second fragment did not run, so _get_uuids has returned
    # the text for the first fragment twice
    assert fragment_1_text == fragment_2_text
