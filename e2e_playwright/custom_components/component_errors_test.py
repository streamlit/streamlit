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

from playwright.sync_api import Page, Route, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import goto_app

# The timeout value from ComponentInstance.tsx
COMPONENT_READY_WARNING_TIME_MS = 60000  # 60 seconds


def handle_component_source_failure(route: Route):
    """Handle custom component source request by returning a 404 status."""
    route.fulfill(status=404, headers={"Content-Type": "text/plain"}, body="Not Found")


def handle_component_timeout_failure(route: Route):
    """Handle custom component request by aborting the request (trigger catch in fetch)."""
    route.abort("failed")


def test_component_source_failure(page: Page, app_port: int):
    """Test that a component source failure is handled correctly."""
    # Ensure custom component source requests return a 404 status
    page.route(
        f"http://localhost:{app_port}/component/**", handle_component_source_failure
    )

    # Capture console messages
    messages = []
    page.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    goto_app(page, f"http://localhost:{app_port}")

    # Expect the iframe to be attached
    expect(page.get_by_test_id("stCustomComponentV1")).to_be_attached()

    # Wait until the expected error is logged, which indicates CLIENT_ERROR was sent
    wait_until(
        page,
        lambda: any(
            "Client Error: Custom Component streamlit_ace.streamlit_ace source error"
            in message
            for message in messages
        ),
    )


def test_component_timeout_failure(page: Page, app_port: int):
    """Test that a component timeout failure is handled correctly."""
    # Ensure custom component requests times out
    page.route(
        f"http://localhost:{app_port}/component/**", handle_component_timeout_failure
    )

    # Capture console messages
    messages = []
    page.on("console", lambda msg: messages.append(msg.text))

    # Navigate to the app
    goto_app(page, f"http://localhost:{app_port}")

    # Expect the iframe to be attached
    expect(page.get_by_test_id("stCustomComponentV1")).to_be_attached()

    # Fetch error should be logged
    wait_until(
        page,
        lambda: any(
            "Client Error: Custom Component streamlit_ace.streamlit_ace fetch error"
            in message
            for message in messages
        ),
    )

    # Wait for the component to timeout
    page.wait_for_timeout(COMPONENT_READY_WARNING_TIME_MS)

    wait_until(
        page,
        lambda: any(
            "Client Error: Custom Component streamlit_ace.streamlit_ace timeout error"
            in message
            for message in messages
        ),
    )

    # Wait for the warning to appear and verify
    expect(page.get_by_test_id("stAlert")).to_be_visible()
