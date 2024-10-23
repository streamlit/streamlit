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

from e2e_playwright.conftest import ImageCompareFunction


def test_compilation_error_dialog(
    page: Page, app_port: int, assert_snapshot: ImageCompareFunction
):
    # Do the navigation manually because our app fixture waits for the app to run, but
    # with the compilation error the app never runs
    page.goto(f"http://localhost:{app_port}/")
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible(timeout=10000)
    # make sure that the close-x button is not focused
    dialog.blur(timeout=0)
    assert_snapshot(dialog, name="compilation_error-dialog")
