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

"""E2E test for E14: st.rerun(scope='app') inside parallel fragment."""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded


def test_e14_app_scoped_rerun_restarts_all(app: Page):
    """E14: st.rerun(scope='app') from a parallel fragment cancels all and restarts.

    On first run, fragment A calls st.rerun(scope='app'). On second run,
    both fragments render content. App run count should be >= 2.
    """
    wait_for_app_loaded(app)

    expect(app.get_by_text("e14_restarted")).to_be_visible()
    expect(app.get_by_text("e14_b_loaded_run_2")).to_be_visible()

    app_runs_el = app.get_by_text("e14_app_runs:")
    expect(app_runs_el).to_be_visible()
    text = app_runs_el.text_content()
    assert text is not None
    runs = int(text.split(": ")[1])
    assert runs >= 2, f"App should have run at least 2 times, got {runs}"
