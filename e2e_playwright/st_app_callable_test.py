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

"""E2E test for an st.App callable entrypoint."""

from __future__ import annotations

from typing import TYPE_CHECKING

from playwright.sync_api import expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import get_button

if TYPE_CHECKING:
    from playwright.sync_api import Page


def test_callable_entrypoint_runs_on_each_full_rerun(app: Page) -> None:
    expect(app.get_by_text("Callable st.App")).to_be_visible()
    expect(app.get_by_text("Main calls: 1", exact=True)).to_be_visible()

    get_button(app, "Rerun callable").click()
    wait_for_app_run(app)

    expect(app.get_by_text("Main calls: 2", exact=True)).to_be_visible()
    expect(app.get_by_text("Main calls: 1", exact=True)).not_to_be_visible()
