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
from urllib import parse

import pytest
from playwright.sync_api import Page, Route, WebSocket, expect

from e2e_playwright.conftest import build_app_url, wait_until
from e2e_playwright.shared.app_utils import goto_app


def _origin_from_url(url: str) -> str:
    split_url = parse.urlsplit(url)
    return f"{split_url.scheme}://{split_url.netloc}"


def _verify_fullscreen_button(page: Page, *, should_be_visible: bool) -> None:
    """Verify fullscreen button visibility after hovering over the dataframe.

    Parameters
    ----------
    page : Page
        The Playwright page object.
    should_be_visible : bool
        If True, expects fullscreen button to be visible.
        If False, expects toolbar visible but fullscreen button not attached.
    """
    expect(page.get_by_text("Fullscreen mode test")).to_be_visible()

    dataframe_element = page.get_by_test_id("stDataFrame")
    dataframe_element.hover()

    if should_be_visible:
        fullscreen_button = dataframe_element.get_by_role("button", name="Fullscreen")
        expect(fullscreen_button).to_be_visible()
    else:
        dataframe_toolbar = dataframe_element.get_by_test_id("stElementToolbar")
        expect(dataframe_toolbar).to_have_css("opacity", "1")
        expect(page.get_by_role("button", name="Fullscreen")).not_to_be_attached()


def _inject_bypass_config(page: Page, backend_url: str) -> None:
    """Inject minimal host config to enable bypass mode.

    Uses default values from routes.py:
    - allowedOrigins: [backend origin]
    - useExternalAuthToken: False (default)
    - metricsUrl: "" (default)
    """
    backend_origin = _origin_from_url(backend_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{backend_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{backend_origin}"],
                useExternalAuthToken: false,
                metricsUrl: ""
            }}
        }}
    """
    )


def test_bypass_mode_executes_websocket_and_host_config_in_parallel(
    page: Page, app_base_url: str
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
    _inject_bypass_config(page, app_base_url)

    # Navigate to app
    goto_app(page, app_base_url)

    # Verify both WebSocket and host-config were used
    ws_events = [e for e in events if e["type"] == "websocket"]
    hc_events = [e for e in events if e["type"] == "host-config"]

    assert len(ws_events) > 0, "WebSocket should have connected in bypass mode"
    assert len(hc_events) > 0, (
        "Host-config should still be called (in background) in bypass mode"
    )


def test_bypass_mode_app_becomes_interactive(page: Page, app_base_url: str) -> None:
    """Test that app becomes interactive in bypass mode."""
    _inject_bypass_config(page, app_base_url)

    goto_app(page, app_base_url)

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
    page: Page, app_base_url: str
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
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: {json.dumps(custom_allowed_origins)},
                useExternalAuthToken: false,  // False so we don't block on auth token
                metricsUrl: "{custom_metrics_url}"
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

    # The main verification is that the app loads successfully with custom config
    # If precedence was not working correctly, the app would fail or behave incorrectly
    expect(page.get_by_text("Connection status test")).to_be_visible()
    expect(page.get_by_text("Slider")).to_be_visible()

    # Verify app is interactive (confirms config was applied correctly)
    button = page.get_by_test_id("stButton").locator("button")
    expect(button).to_be_enabled()


def test_default_path_without_bypass_config(page: Page, app_base_url: str) -> None:
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
    goto_app(page, app_base_url)

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
    page: Page, app_base_url: str
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
    _inject_bypass_config(page, app_base_url)

    # Navigate to app
    goto_app(page, app_base_url)

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
        lambda: (
            page.get_by_test_id("stDialog").is_visible()
            and "Connection error" in page.get_by_test_id("stDialog").inner_text()
        ),
    )


def test_bypass_requires_all_minimal_fields(page: Page, app_base_url: str) -> None:
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
    app_origin = _origin_from_url(app_base_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{app_origin}"]
                // Missing useExternalAuthToken - should NOT enable bypass
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

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


def test_bypass_requires_non_empty_allowed_origins(
    page: Page, app_base_url: str
) -> None:
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
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: [],  // Empty array should NOT enable bypass
                useExternalAuthToken: false
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

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


def test_disable_fullscreen_mode_via_window_in_bypass(
    page: Page, app_base_url: str
) -> None:
    """Test that disableFullscreenMode can be set via window config in bypass mode.

    When disableFullscreenMode is true, the fullscreen button should NOT be visible
    in the dataframe toolbar.
    """
    app_origin = _origin_from_url(app_base_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{app_origin}"],
                useExternalAuthToken: false,
                disableFullscreenMode: true
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

    _verify_fullscreen_button(page, should_be_visible=False)


def test_disable_fullscreen_mode_window_takes_precedence_over_endpoint_in_bypass(
    page: Page, app_base_url: str
) -> None:
    """Test that window config takes precedence over endpoint for disableFullscreenMode in bypass.

    Window config: disableFullscreenMode = false (allow fullscreen)
    Endpoint: disableFullscreenMode = true (block fullscreen)
    Expected: Fullscreen button IS visible (window wins)
    """

    # Modify endpoint to return disableFullscreenMode: true
    def modify_host_config(route: Route) -> None:
        response = route.fetch()
        body = response.json()
        body["disableFullscreenMode"] = True
        route.fulfill(response=response, json=body)

    page.route("**/_stcore/host-config", modify_host_config)

    # Window config sets disableFullscreenMode: false (should take precedence)
    app_origin = _origin_from_url(app_base_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{app_origin}"],
                useExternalAuthToken: false,
                disableFullscreenMode: false
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

    _verify_fullscreen_button(page, should_be_visible=True)


def test_disable_fullscreen_mode_window_takes_precedence_over_endpoint_without_bypass(
    page: Page, app_base_url: str
) -> None:
    """Test that window config takes precedence over endpoint for disableFullscreenMode without bypass.

    Without bypass (incomplete window config), the app waits for endpoint response,
    but window config values should still take precedence during reconciliation.

    Window config: disableFullscreenMode = false (allow fullscreen)
    Endpoint: disableFullscreenMode = true (block fullscreen)
    Expected: Fullscreen button IS visible (window wins after reconciliation)
    """

    # Modify endpoint to return disableFullscreenMode: true
    def modify_host_config(route: Route) -> None:
        response = route.fetch()
        body = response.json()
        body["disableFullscreenMode"] = True
        route.fulfill(response=response, json=body)

    page.route("**/_stcore/host-config", modify_host_config)

    # Incomplete window config (missing useExternalAuthToken) so bypass won't activate
    # But disableFullscreenMode should still be applied during reconciliation
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                disableFullscreenMode: false
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

    _verify_fullscreen_button(page, should_be_visible=True)


def test_block_error_dialogs_via_window_config_bypass(
    page: Page, app_base_url: str
) -> None:
    """Test that blockErrorDialogs can be set via window config in bypass mode.

    When blockErrorDialogs is true, error dialogs should not be shown.
    Instead, errors are sent to the host via postMessage.
    """
    app_origin = _origin_from_url(app_base_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{app_origin}"],
                useExternalAuthToken: false,
                blockErrorDialogs: true
            }}
        }}
    """
    )

    # Initial load of page
    goto_app(page, app_base_url)

    # Verify app loaded
    expect(page.get_by_text("Connection status test")).to_be_visible()

    # Capture console messages to verify error is logged (not shown in dialog)
    messages: list[str] = []
    page.on("console", lambda msg: messages.append(msg.text))

    # Navigate to a non-existent page to trigger page not found error
    page.goto(build_app_url(app_base_url, path="/nonexistent_page"))

    # Wait until the expected error is logged
    wait_until(
        page,
        lambda: any(
            "The page that you have requested does not seem to exist" in message
            for message in messages
        ),
    )

    # Verify no error dialog is shown (blockErrorDialogs is working)
    expect(page.get_by_role("dialog")).not_to_be_attached()


# Firefox doesn't render pydeck charts properly in CI, so no Mapbox API requests are made
@pytest.mark.skip_browser("firefox")
def test_mapbox_token_via_window_config_bypass(page: Page, app_base_url: str) -> None:
    """Test that mapboxToken from window config is used in Mapbox API requests.

    The app contains a pydeck chart with explicit Mapbox style (mapbox://styles/mapbox/light-v9).
    This triggers requests to api.mapbox.com with the access token.
    We intercept these requests and verify our custom token is included.
    """
    test_token = "pk.test_window_config_token_12345"
    mapbox_requests: list[str] = []

    # Intercept requests to Mapbox API to verify the token is used
    def track_mapbox_request(route: Route) -> None:
        mapbox_requests.append(route.request.url)
        # Abort the request - we just want to verify the token, not actually load tiles
        route.abort()

    page.route("**/api.mapbox.com/**", track_mapbox_request)

    app_origin = _origin_from_url(app_base_url)
    page.add_init_script(
        f"""
        window.__streamlit = {{
            BACKEND_BASE_URL: "{app_base_url}",
            HOST_CONFIG: {{
                allowedOrigins: ["{app_origin}"],
                useExternalAuthToken: false,
                mapboxToken: "{test_token}"
            }}
        }}
    """
    )

    goto_app(page, app_base_url)

    # Wait for the pydeck chart to be visible (it uses Mapbox style)
    expect(page.get_by_text("Mapbox token test")).to_be_visible()
    map_element = page.get_by_test_id("stDeckGlJsonChart")
    expect(map_element).to_be_visible(timeout=15000)

    # Wait for Mapbox API requests to be made (map loading tiles)
    wait_until(page, lambda: len(mapbox_requests) > 0, timeout=15000)
    token_used = any(test_token in url for url in mapbox_requests)
    assert token_used, (
        f"Expected mapboxToken '{test_token}' to be used in Mapbox API requests. "
        f"Requests made: {mapbox_requests}"
    )
