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

"""E2E tests for parallel fragment behavior: API restrictions, fragment rerun, run_every.

Covers E7, E8, E9, E11, E12.
"""

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def test_e7_dialog_prohibited_during_parallel_execution(app: Page):
    """E7: @st.dialog raises StreamlitAPIException from a parallel fragment."""
    wait_for_app_loaded(app)

    dialog_error = app.get_by_test_id("stException").filter(has_text="@st.dialog")
    expect(dialog_error).to_be_visible()

    expect(app.get_by_text("e7_dialog_content")).not_to_be_attached()


def test_e8_switch_page_prohibited_during_parallel_execution(app: Page):
    """E8: st.switch_page raises StreamlitAPIException from a parallel fragment."""
    wait_for_app_loaded(app)

    exceptions = app.get_by_test_id("stException").filter(
        has_text="cannot be called from a parallel fragment"
    )
    # Both E7 (dialog) and E8 (switch_page) should render errors
    expect(exceptions).to_have_count(2, timeout=5000)


def test_e9_dialog_works_from_sequential_fragment_rerun(app: Page):
    """E9: A @st.dialog triggered by button click in a parallel fragment works
    because the rerun is sequential.
    """
    wait_for_app_loaded(app)

    expect(app.get_by_text("e9_fragment_loaded")).to_be_visible()

    click_button(app, "e9_open_dialog")
    wait_for_app_run(app)

    dialog = app.get_by_test_id("stDialog")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_text("e9_dialog_opened")).to_be_visible()


@pytest.mark.skip(
    reason="Fragment-scoped rerun inside parallel worker not fully working on "
    "prototype — cursor state is not reset between iterations of the rerun "
    "loop in _run_parallel_fragment."
)
def test_e11_fragment_scoped_rerun(app: Page):
    """E11: st.rerun(scope='fragment') reruns only the calling fragment.

    Fragment A reruns itself once (gated by counter). Fragment B runs once.
    After load: A ran 2 times, B ran 1 time.
    """
    wait_for_app_loaded(app)

    expect(app.get_by_text("e11_a_rerun_done")).to_be_visible()
    expect(app.get_by_text("e11_a_runs: 2")).to_be_visible()
    expect(app.get_by_text("e11_b_runs: 1")).to_be_visible()


def test_e12_run_every_with_parallel(app: Page):
    """E12: A parallel fragment with run_every renders initially, then reruns periodically.

    Initial content renders. After waiting >2s, the timestamp should update
    (periodic rerun fired).
    """
    wait_for_app_loaded(app)

    ts_el = app.get_by_text("e12_ts:")
    expect(ts_el).to_be_visible()
    initial_text = ts_el.text_content()

    app.wait_for_timeout(3000)
    wait_for_app_run(app)

    updated_text = app.get_by_text("e12_ts:").text_content()
    assert initial_text != updated_text, (
        f"Timestamp should have changed after run_every interval. "
        f"initial={initial_text}, after={updated_text}"
    )
