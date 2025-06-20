# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
from e2e_playwright.shared.app_utils import get_button, get_markdown


def test_fragment_queue(app: Page):
    # Sanity check:
    expect(app.get_by_test_id("stMarkdown")).to_have_count(3)
    get_markdown(app, "fragment 1 done!")
    get_markdown(app, "fragment 2 done!")
    get_markdown(app, "fragment 3 done!")

    # Quickly click all 3 buttons on the page without waiting for the app to finish
    # between each click.
    for b in [
        get_button(app, "rerun fragment 1"),
        get_button(app, "rerun fragment 2"),
        get_button(app, "rerun fragment 3"),
    ]:
        b.click()
    wait_for_app_run(app)

    # Verify that the second button click wasn't dropped by checking that
    # "ran fragment 2" was indeed printed.
    expect(app.get_by_test_id("stMarkdown")).to_have_count(4)
    get_markdown(app, "fragment 1 done!")
    get_markdown(app, "ran fragment 2")
    get_markdown(app, "fragment 2 done!")
    get_markdown(app, "fragment 3 done!")
