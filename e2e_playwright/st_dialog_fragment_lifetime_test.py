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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import expect_no_exception


def test_dialog_remains_responsive_after_parent_fragment_rerun(app: Page):
    """A dialog outlives the fragment-only rerun of the fragment that opened it."""
    app.get_by_role("button", name="Open dialog").click()

    dialog = app.get_by_role("dialog")
    expect(dialog).to_be_visible()

    increment_button = dialog.get_by_role("button", name="Increment")
    increment_button.click()
    expect(dialog.get_by_text("Clicks: 1", exact=True)).to_be_visible()

    parent_runs = app.get_by_text(re.compile(r"^Parent runs: \d+$"))
    parent_runs_text = parent_runs.text_content()
    assert parent_runs_text is not None
    current_parent_runs = int(parent_runs_text.rsplit(" ", maxsplit=1)[-1])

    expect(
        app.get_by_text(f"Parent runs: {current_parent_runs + 1}", exact=True)
    ).to_be_visible(timeout=5_000)
    expect(dialog).to_be_visible()

    increment_button.click()
    expect(dialog.get_by_text("Clicks: 2", exact=True)).to_be_visible()
    expect_no_exception(app)

    dialog.get_by_role("button", name="Close dialog").click()
    wait_for_app_run(app)
    expect(dialog).not_to_be_attached()
