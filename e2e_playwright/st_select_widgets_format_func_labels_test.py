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

from e2e_playwright.conftest import rerun_app, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    click_button,
    expect_prefixed_markdown,
    get_multiselect,
    get_selectbox,
    select_selectbox_option,
)


def test_selection_survives_format_func_label_changes(app: Page):
    """Selections survive reruns after their formatted labels change.

    Regression test for https://github.com/streamlit/streamlit/issues/17175: the
    frontend resends the labels it was last given, so the backend must push the
    new labels or a later rerun resets the selection.
    """
    select_selectbox_option(app, "selectbox with changing labels", "E (0)")
    expect_prefixed_markdown(app, "selectbox value:", "E")

    multiselect = get_multiselect(app, "multiselect with changing labels")
    multiselect.locator("input").click()
    for option in ["F (0)", "D (0)"]:
        app.get_by_role("option", name=option, exact=True).click()
        expect(multiselect.locator(f'span[title="{option}"]')).to_be_visible()
    app.keyboard.press("Escape")
    wait_for_app_run(app)
    expect_prefixed_markdown(app, "multiselect value:", "['F', 'D']")

    click_button(app, "Bump label count")
    selectbox_input = get_selectbox(app, "selectbox with changing labels").locator(
        "input"
    )
    expect(selectbox_input).to_have_value("E (1)")
    expect(multiselect.locator('span[title="F (1)"]')).to_be_visible()
    expect(multiselect.locator('span[title="D (1)"]')).to_be_visible()

    # A later rerun used to reset both widgets.
    rerun_app(app)
    expect_prefixed_markdown(app, "selectbox value:", "E")
    expect_prefixed_markdown(app, "multiselect value:", "['F', 'D']")
    expect(selectbox_input).to_have_value("E (1)")
    expect(multiselect.locator('span[title="F (0)"]')).to_have_count(0)
