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
    expect_no_exception,
    get_button,
    get_markdown,
)


def test_fragment_queue_preserves_coalesced_triggers(app: Page) -> None:
    # Wait for every fragment's initial run to finish.
    expect(app.get_by_test_id("stMarkdown")).to_have_count(4)
    get_markdown(app, "fragment 1 done!")
    get_markdown(app, "fragment 2 done!")
    get_markdown(app, "fragment 3 done!")
    get_markdown(app, "fragment 4 done!")

    get_button(app, "rerun fragment 1").click()
    # Ensure the remaining interactions queue behind the slow fragment.
    get_markdown(app, "fragment 1 running...")
    component_button = app.get_by_role("button", name="fire component trigger")
    component_button.click()
    # The component marks the button in the macrotask after WidgetStateManager's
    # trigger flush, proving the next click sends a separate rerun request.
    expect(component_button).to_have_attribute("data-trigger-sent", "true")
    get_button(app, "rerun fragment 2").click()
    get_button(app, "rerun fragment 3").click()
    wait_for_app_run(app)

    # Both the regular button and Custom Components v2 triggers must survive.
    expect(app.get_by_test_id("stMarkdown")).to_have_count(6)
    get_markdown(app, "fragment 1 done!")
    get_markdown(app, "ran fragment 2")
    get_markdown(app, "fragment 2 done!")
    get_markdown(app, "fragment 3 done!")
    get_markdown(app, "ran fragment 4 component")
    get_markdown(app, "fragment 4 done!")
    expect_no_exception(app)
