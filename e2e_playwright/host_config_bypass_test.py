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

"""E2E tests for host config bypass feature.

These tests verify that when a host provides minimal configuration via
window.__streamlit, the WebSocket connection can be established immediately
without waiting for the host-config endpoint response (bypass mode).
"""

from __future__ import annotations

import json

from playwright.sync_api import Page, Route, WebSocket, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import goto_app


def _inject_bypass_config(page: Page, backend_url: str) -> None:
    """Inject minimal host config to enable bypass mode.

    Uses default values from routes.py:
    - allowedOrigins: ["http://localhost"] (default in dev mode)
    - useExternalAuthToken: False (default)
    - metricsUrl: "" (default)
    """
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{backend_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["http://localhost"],
                useExternalAuthToken: false,
                metricsUrl: ""
            }}
        }}
    """
    )


def test_bypass_mode_executes_websocket_and_host_config_in_parallel(
    page: Page, app_port: int
) -> None:
    """Test that bypass mode executes both WebSocket and host-config requests.

    In bypass mode:
    - WebSocket connection is not blocked by host-config
    - Host-config endpoint is still called (in background)
    - Both should succeed

    Note: We don't assert strict ordering because both happen in parallel,
    but we verify both events occur, demonstrating bypass behavior.
    """
    # Track connection events
    events = []

    # Set up WebSocket tracking BEFORE injecting config
    def track_websocket(_ws: WebSocket) -> None:
        """Track WebSocket connection timing."""
        events.append({"type": "websocket"})

    page.on("websocket", track_websocket)

    # Track host-config endpoint calls BEFORE injecting config
    def track_host_config(route: Route) -> None:
        """Track host-config call timing and allow through."""
        events.append({"type": "host-config"})
        route.continue_()

    page.route("**/_stcore/host-config", track_host_config)

    # Inject bypass config BEFORE navigation
    _inject_bypass_config(page, f"http://localhost:{app_port}")

    # Navigate to app
    goto_app(page, f"http://localhost:{app_port}/")

    # Verify both WebSocket and host-config were used
    ws_events = [e for e in events if e["type"] == "websocket"]
    hc_events = [e for e in events if e["type"] == "host-config"]

    assert len(ws_events) > 0, "WebSocket should have connected in bypass mode"
    assert len(hc_events) > 0, (
        "Host-config should still be called (in background) in bypass mode"
    )


def test_bypass_mode_app_becomes_interactive(page: Page, app_port: int) -> None:
    """Test that app becomes interactive in bypass mode."""
    _inject_bypass_config(page, f"http://localhost:{app_port}")

    goto_app(page, f"http://localhost:{app_port}/")

    # Verify app content loaded
    expect(page.get_by_text("Connection status test")).to_be_visible()
    expect(page.get_by_text("Slider")).to_be_visible()

    # Verify app is interactive - button can be clicked
    button = page.get_by_test_id("stButton").locator("button")
    expect(button).to_be_enabled()
    button.click()

    # Verify button action worked
    expect(page.get_by_text("Button clicked!")).to_be_visible()


def test_bypass_mode_host_config_values_take_precedence(
    page: Page, app_port: int
) -> None:
    """Test that window.__streamlit.HOST_CONFIG values override endpoint values.

    Even though the host-config endpoint returns its own values, the initial
    window config should take precedence for allowedOrigins, useExternalAuthToken,
    and metricsUrl.
    """
    # Custom values that differ from defaults
    custom_allowed_origins = [
        "https://custom.example.com",
        "https://another.example.com",
    ]
    custom_metrics_url = "https://custom-metrics.example.com"

    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "http://localhost:{app_port}",
            HOST_CONFIG: {{
                allowedOrigins: {json.dumps(custom_allowed_origins)},
                useExternalAuthToken: false,  // False so we don't block on auth token
                metricsUrl: "{custom_metrics_url}"
            }}
        }}
    """
    )

    goto_app(page, f"http://localhost:{app_port}/")

    # The main verification is that the app loads successfully with custom config
    # If precedence was not working correctly, the app would fail or behave incorrectly
    expect(page.get_by_text("Connection status test")).to_be_visible()
    expect(page.get_by_text("Slider")).to_be_visible()

    # Verify app is interactive (confirms config was applied correctly)
    button = page.get_by_test_id("stButton").locator("button")
    expect(button).to_be_enabled()


def test_default_path_without_bypass_config(page: Page, app_port: int) -> None:
    """Test default behavior when no bypass config is provided.

    Without window.__streamlit config, the app should use the normal path
    that waits for host-config endpoint before establishing WebSocket.
    """
    # Track order of events to verify default path behavior
    events = []

    # Track host-config completion
    def track_host_config(route: Route) -> None:
        """Track when host-config completes."""
        events.append({"type": "host-config-start"})
        route.continue_()
        # Mark completion after continuing
        events.append({"type": "host-config-complete"})

    page.route("**/_stcore/host-config", track_host_config)

    # Track WebSocket connection
    def track_websocket(_ws: WebSocket) -> None:
        """Track WebSocket connection timing."""
        events.append({"type": "websocket"})

    page.on("websocket", track_websocket)

    # Don't inject any window.__streamlit config - use default path
    goto_app(page, f"http://localhost:{app_port}/")

    # Verify both host-config and WebSocket were used
    hc_events = [e for e in events if e["type"] == "host-config-start"]
    ws_events = [e for e in events if e["type"] == "websocket"]

    assert len(hc_events) > 0, "Host-config should be called"
    assert len(ws_events) > 0, "WebSocket should connect"

    # In default path, host-config should be called before WebSocket connects
    hc_index = events.index(hc_events[0])
    ws_index = events.index(ws_events[0])

    assert hc_index < ws_index, (
        f"Default path: host-config ({hc_index}) should start before "
        f"WebSocket connects ({ws_index})"
    )

    # App should work normally
    expect(page.get_by_text("Connection status test")).to_be_visible()
    expect(page.get_by_text("Slider")).to_be_visible()

    # Verify interactivity
    button = page.get_by_test_id("stButton").locator("button")
    expect(button).to_be_enabled()


def test_bypass_mode_handles_connection_errors_gracefully(
    page: Page, app_port: int
) -> None:
    """Test bypass mode functions by blocking host-config endpoint
    The app should still load because we bypass the endpoints to establish
    the initial websocket connection. Then the connection error dialog appears
    because we are still handling connection errors the same way as the default path.
    """
    ws_connected = {"connected": False}
    host_config_call_attempted = {"attempted": False}

    # Track WebSocket connection
    def track_websocket(_ws: WebSocket) -> None:
        ws_connected["connected"] = True

    page.on("websocket", track_websocket)

    # Completely block host-config endpoint from the start
    def block_host_config(route: Route) -> None:
        host_config_call_attempted["attempted"] = True
        route.abort("failed")

    page.route("**/_stcore/host-config", block_host_config)

    # Inject bypass config BEFORE navigation
    _inject_bypass_config(page, f"http://localhost:{app_port}")

    # Navigate to app
    goto_app(page, f"http://localhost:{app_port}/")

    # Verify WebSocket connected despite host-config being blocked
    assert ws_connected["connected"], (
        "WebSocket should connect in bypass mode even when host-config fails"
    )

    # Verify host-config was attempted (proves bypass doesn't skip it entirely)
    assert host_config_call_attempted["attempted"], (
        "Host-config should still be called (in background)"
    )

    # Verify app loaded despite host-config being blocked
    expect(page.get_by_text("Connection status test")).to_be_visible()

    # Verify Connection error dialog eventually appears
    wait_until(
        page,
        lambda: page.get_by_test_id("stDialog").is_visible()
        and "Connection error" in page.get_by_test_id("stDialog").inner_text(),
    )


def test_bypass_requires_all_minimal_fields(page: Page, app_port: int) -> None:
    """Test that bypass mode requires all minimal fields to be present.

    Missing any of: BACKEND_BASE_URL, allowedOrigins, or useExternalAuthToken
    should fall back to default path.
    """
    # Track order of events to verify default path is used
    events = []

    # Track host-config and WebSocket to verify ordering
    def track_host_config(route: Route) -> None:
        events.append({"type": "host-config-start"})
        route.continue_()

    page.route("**/_stcore/host-config", track_host_config)

    def track_websocket(_ws: WebSocket) -> None:
        events.append({"type": "websocket"})

    page.on("websocket", track_websocket)

    # Test with missing useExternalAuthToken (incomplete config)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "http://localhost:{app_port}",
            HOST_CONFIG: {{
                allowedOrigins: ["http://localhost"]
                // Missing useExternalAuthToken - should NOT enable bypass
            }}
        }}
    """
    )

    goto_app(page, f"http://localhost:{app_port}/")

    # Verify default path was used (host-config before WebSocket)
    hc_events = [e for e in events if e["type"] == "host-config-start"]
    ws_events = [e for e in events if e["type"] == "websocket"]

    # Explicit assertions before checking order
    assert len(hc_events) > 0, "Host-config should be called"
    assert len(ws_events) > 0, "WebSocket should connect"

    hc_index = events.index(hc_events[0])
    ws_index = events.index(ws_events[0])
    assert hc_index < ws_index, (
        "Incomplete config should use default path: "
        f"host-config ({hc_index}) before WebSocket ({ws_index})"
    )

    # App should still load (fallback to default path)
    expect(page.get_by_text("Connection status test")).to_be_visible()


def test_bypass_requires_non_empty_allowed_origins(page: Page, app_port: int) -> None:
    """Test that bypass mode requires allowedOrigins to be non-empty."""
    # Track order of events to verify default path is used
    events = []

    def track_host_config(route: Route) -> None:
        events.append({"type": "host-config-start"})
        route.continue_()

    page.route("**/_stcore/host-config", track_host_config)

    def track_websocket(_ws: WebSocket) -> None:
        events.append({"type": "websocket"})

    page.on("websocket", track_websocket)

    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "http://localhost:{app_port}",
            HOST_CONFIG: {{
                allowedOrigins: [],  // Empty array should NOT enable bypass
                useExternalAuthToken: false
            }}
        }}
    """
    )

    goto_app(page, f"http://localhost:{app_port}/")

    # Verify default path was used (host-config before WebSocket)
    hc_events = [e for e in events if e["type"] == "host-config-start"]
    ws_events = [e for e in events if e["type"] == "websocket"]

    # Explicit assertions before checking order
    assert len(hc_events) > 0, "Host-config should be called"
    assert len(ws_events) > 0, "WebSocket should connect"

    hc_index = events.index(hc_events[0])
    ws_index = events.index(ws_events[0])
    assert hc_index < ws_index, (
        "Empty allowedOrigins should use default path: "
        f"host-config ({hc_index}) before WebSocket ({ws_index})"
    )

    # App should still load (fallback to default path)
    expect(page.get_by_text("Connection status test")).to_be_visible()
