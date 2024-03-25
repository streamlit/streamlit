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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run


def test_progress_renders_properly(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    progress_bars = themed_app.get_by_test_id("stProgress")
    expect(progress_bars.get_by_role("progressbar").nth(0)).to_have_attribute(
        "aria-valuenow", "50"
    )
    for i in range(len(progress_bars.all())):
        assert_snapshot(
            themed_app.get_by_test_id("stProgress").nth(i), name=f"st_progress-{i}"
        )
