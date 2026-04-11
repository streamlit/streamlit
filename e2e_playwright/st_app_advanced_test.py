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

"""E2E tests for st.App with advanced configurations.

Tests verify that custom routes, middleware, lifespan hooks, and exception
handlers work correctly when using st.App.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from playwright.sync_api import expect

from e2e_playwright.conftest import build_app_url
from e2e_playwright.shared.app_utils import get_button, get_text_input

if TYPE_CHECKING:
    from playwright.sync_api import Page


def test_streamlit_ui_and_widget_interaction(app: Page) -> None:
    """Test that Streamlit UI renders and widgets work with advanced App config."""
    # Verify initial UI renders correctly
    expect(app.get_by_text("Advanced st.App Test")).to_be_visible()
    expect(
        app.get_by_text("This app tests custom routes, middleware, and lifespan hooks.")
    ).to_be_visible()
    expect(app.get_by_text("Counter: 0", exact=True)).to_be_visible()

    # Negative assertion: no exception should be displayed
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # Test button interaction
    button = get_button(app, "Increment")
    expect(button).to_be_visible()
    button.click()
    expect(app.get_by_text("Counter: 1", exact=True)).to_be_visible()

    # Test text input interaction
    text_input_container = get_text_input(app, "Enter text")
    text_input_field = text_input_container.locator("input").first
    text_input_field.fill("Hello World")
    text_input_field.press("Enter")
    expect(app.get_by_text("You entered: Hello World")).to_be_visible()


def test_custom_routes_middleware_and_lifespan(app: Page, app_base_url: str) -> None:
    """Test custom routes, middleware headers, lifespan hooks, and exception handlers."""
    # Test custom API route
    data_response = app.request.get(build_app_url(app_base_url, path="/api/data"))
    assert data_response.status == 200
    data = data_response.json()
    assert data["items"] == ["apple", "banana", "cherry"]
    assert data["count"] == 3
    assert data["source"] == "custom_route"

    # Test custom middleware adds headers
    health_response = app.request.get(
        build_app_url(app_base_url, path="/_stcore/health")
    )
    assert health_response.status == 200
    assert health_response.headers.get("x-custom-middleware") == "active"

    # Test lifespan startup hook ran
    lifespan_response = app.request.get(
        build_app_url(app_base_url, path="/api/lifespan")
    )
    assert lifespan_response.status == 200
    events = lifespan_response.json().get("events", [])
    assert "startup" in events
    assert "shutdown" not in events  # App is still running

    # Test custom exception handler
    error_response = app.request.get(build_app_url(app_base_url, path="/api/error"))
    assert error_response.status == 422
    error_data = error_response.json()
    assert error_data["error"] == "Something went wrong"
    assert error_data["code"] == 422
    assert error_data["handled_by"] == "custom_handler"


def test_websocket_works_with_middleware(app: Page) -> None:
    """Test that WebSocket communication works with custom middleware."""
    button = get_button(app, "Increment")

    # Multiple clicks verify WebSocket stream isn't broken by middleware
    for i in range(3):
        button.click()
        expect(app.get_by_text(f"Counter: {i + 1}", exact=True)).to_be_visible()

    expect(app.get_by_text("Counter: 3", exact=True)).to_be_visible()
