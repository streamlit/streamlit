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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    click_form_button,
    expect_markdown,
)


def test_fragment_widget_persists_across_full_app_rerun(app: Page):
    """A widget inside a fragment retains its value after a full app rerun."""
    slider = app.get_by_test_id("stSlider").get_by_role("slider")
    slider.press("ArrowRight")
    wait_for_app_run(app)

    expect_markdown(app, "slider value: 51")

    old_app_uuid = (
        app.get_by_test_id("stMarkdown").filter(has_text="app uuid:").text_content()
    )
    assert old_app_uuid is not None

    click_button(app, "Trigger full rerun")

    # Confirm a full rerun occurred.
    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="app uuid:")
    ).not_to_have_text(old_app_uuid)

    expect_markdown(app, "slider value: 51")
    expect(app.get_by_test_id("stSliderThumbValue").first).not_to_have_text("50")


def test_form_inside_fragment_submits_correctly(app: Page):
    """An st.form inside a fragment batches widget values and only applies
    them on submit.
    """
    expect_markdown(app, "not submitted")

    name_input = app.get_by_test_id("stTextInput").locator("input")
    name_input.fill("Alice")
    name_input.press("Enter")

    expect_markdown(app, "not submitted")

    click_form_button(app, "Submit form")

    expect_markdown(app, "submitted: Alice")

    expect(
        app.get_by_test_id("stMarkdown").filter(has_text="submitted:")
    ).to_have_count(1)
