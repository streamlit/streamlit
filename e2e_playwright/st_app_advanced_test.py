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

Tests verify that custom routes, middleware, lifespan hooks, exception
handlers, and programmatic secrets work correctly when using st.App.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from playwright.sync_api import expect

from e2e_playwright.conftest import (
    build_app_url,
    wait_for_app_loaded,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import get_button, get_checkbox, get_text_input

if TYPE_CHECKING:
    from playwright.sync_api import Page


def test_advanced_app_scenario(app: Page, app_base_url: str) -> None:
    """Test Streamlit UI, widgets, custom routes, middleware, lifespan, WebSocket, and secrets.

    This aggregated scenario test verifies:
    - Streamlit UI renders with advanced App config
    - Widget interactions work correctly
    - Custom routes and middleware function properly
    - Lifespan hooks and exception handlers work
    - WebSocket communication functions with custom middleware
    - Programmatic secrets are accessible via st.secrets
    """
    # === Part 1: Streamlit UI and widget interaction ===
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

    # === Part 2: Custom routes, middleware, lifespan, and exception handlers ===
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

    # === Part 3: WebSocket communication with middleware ===
    # Multiple clicks verify WebSocket stream isn't broken by middleware
    for i in range(2, 5):  # Counter is at 1, increment to 4
        button.click()
        expect(app.get_by_text(f"Counter: {i}", exact=True)).to_be_visible()

    expect(app.get_by_text("Counter: 4", exact=True)).to_be_visible()

    # === Part 4: Programmatic secrets ===
    # Verify programmatic secrets are available via st.secrets
    expect(app.get_by_text("API Key: test-api-key-12345")).to_be_visible()
    expect(app.get_by_text("Database Host: localhost")).to_be_visible()
    expect(app.get_by_text("Database Port: 5432")).to_be_visible()

    # Verify top-level secrets are promoted to os.environ
    expect(app.get_by_text("API Key from environ: test-api-key-12345")).to_be_visible()

    # Verify nested secrets via attribute access
    expect(app.get_by_text("Auth Client ID: my-client-id")).to_be_visible()


def test_on_script_error_handler(app: Page) -> None:
    """Test on_script_error handler for uncaught exceptions in user script.

    This test verifies:
    - Default exception display when handler returns None
    - Suppressed display when handler returns True (with custom error UI)
    - Handler receives different exception types correctly
    - Handler is invoked for exceptions in widget callbacks
    """
    expect(app.get_by_text("Advanced st.App Test")).to_be_visible()
    expect(app.get_by_text("Script Error Handler Test")).to_be_visible()
    expect(app.get_by_text("Suppress display: False")).to_be_visible()

    # No exception should be displayed initially
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # === Test default display path (handler returns None) ===
    # Tests 1-3 exercise the default path (handler returns None, so exception displays).
    # Each test requires a reload because once an exception is raised, subsequent
    # script body elements don't render.

    # Test 1: ValueError from button click
    raise_button = get_button(app, "Raise exception")
    raise_button.click()
    wait_for_app_run(app)

    # The default exception display should be shown (positive assertion first)
    expect(app.get_by_test_id("stException")).to_be_visible()
    expect(app.get_by_text("ValueError: Test error from user script")).to_be_visible()
    # Custom error UI should NOT be shown (handler returned None)
    expect(app.get_by_text("Custom error UI:")).to_have_count(0)

    # Reload to reset state - after an exception, subsequent elements don't render
    app.reload()
    wait_for_app_loaded(app)

    # Test 2: RuntimeError (different exception type)
    runtime_button = get_button(app, "Raise RuntimeError")
    runtime_button.click()
    wait_for_app_run(app)

    # The default exception display should be shown with RuntimeError
    expect(app.get_by_test_id("stException")).to_be_visible()
    expect(
        app.get_by_text("RuntimeError: Runtime error from user script")
    ).to_be_visible()
    # Custom error UI should NOT be shown
    expect(app.get_by_text("Custom error UI:")).to_have_count(0)

    # Reload to reset state - after an exception, subsequent elements don't render
    app.reload()
    wait_for_app_loaded(app)

    # Test 3: Exception from widget callback (on_click)
    callback_button = get_button(app, "Raise in callback")
    callback_button.click()
    wait_for_app_run(app)

    # The default exception display should be shown (positive assertion first)
    expect(app.get_by_test_id("stException")).to_be_visible()
    expect(app.get_by_text("ValueError: Error from on_click callback")).to_be_visible()
    # Custom error UI should NOT be shown (handler returned None)
    expect(app.get_by_text("Custom error UI:")).to_have_count(0)

    # Reload to reset state for suppress mode test
    app.reload()
    wait_for_app_loaded(app)

    # === Test suppressed display (handler returns True) ===
    suppress_checkbox = get_checkbox(app, "Suppress error display")
    suppress_checkbox.click()
    wait_for_app_run(app)
    expect(app.get_by_text("Suppress display: True")).to_be_visible()

    raise_button = get_button(app, "Raise exception")
    raise_button.click()
    wait_for_app_run(app)

    # The custom error UI should be shown (positive assertion first)
    expect(
        app.get_by_text("Custom error UI: Test error from user script")
    ).to_be_visible()
    # The default exception display should NOT be shown
    expect(app.get_by_test_id("stException")).to_have_count(0)

    # Reload to reset state for callback exception with suppression test
    app.reload()
    wait_for_app_loaded(app)

    # Test 5: Widget callback exception with suppression enabled
    # This verifies the handler works correctly for callback exceptions too
    suppress_checkbox = get_checkbox(app, "Suppress error display")
    suppress_checkbox.click()
    wait_for_app_run(app)
    expect(app.get_by_text("Suppress display: True")).to_be_visible()

    callback_button = get_button(app, "Raise in callback")
    callback_button.click()
    wait_for_app_run(app)

    # The custom error UI should be shown (positive assertion first)
    expect(
        app.get_by_text("Custom error UI: Error from on_click callback")
    ).to_be_visible()
    # The default exception display should NOT be shown
    expect(app.get_by_test_id("stException")).to_have_count(0)
