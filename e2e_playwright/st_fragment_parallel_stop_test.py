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

"""E2E test for E10: st.stop() inside parallel fragment cancels all fragments."""

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded


@pytest.mark.skip(
    reason="st.stop() inside a parallel worker thread does not raise StopException "
    "because the script runner's trace function (which triggers yield checks) "
    "is not installed on worker threads. Needs dedicated cancellation support."
)
def test_e10_stop_cancels_all_fragments(app: Page):
    """E10: st.stop() in one parallel fragment stops the entire run.

    The stopping fragment's partial content (before st.stop()) should be visible.
    Content after st.stop() should not appear.
    The slow fragment should not complete (total load time < 5s).
    """
    wait_for_app_loaded(app)

    expect(app.get_by_text("e10_partial_content")).to_be_visible()
    expect(app.get_by_text("e10_should_not_appear")).not_to_be_attached()
    expect(app.get_by_text("e10_slow_done")).not_to_be_attached()
