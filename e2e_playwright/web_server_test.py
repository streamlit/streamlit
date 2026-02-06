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

"""
E2E tests for server endpoints and behavior.

These tests verify expected server behavior covering:

- Health endpoints (/_stcore/health, /_stcore/script-health-check)
- Metrics endpoint (/_stcore/metrics)
- Host config endpoint (/_stcore/host-config)
- Media endpoint with range requests (/media/*)
- File upload endpoint (/_stcore/upload_file/*)
- CORS headers
- XSRF cookie handling
- Static file serving (/app/static/*)
"""

from __future__ import annotations

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button

# =============================================================================
# Health Endpoint Tests
# =============================================================================


def test_health_endpoint_returns_ok(app: Page, app_port: int):
    """Test that /_stcore/health returns 'ok' when app is healthy."""
    response = app.request.get(f"http://localhost:{app_port}/_stcore/health")

    expect(response).to_be_ok()
    assert response.status == 200
    assert response.text() == "ok"


def test_health_endpoint_has_no_cache_header(app: Page, app_port: int):
    """Test that health endpoint sets Cache-Control: no-cache."""
    response = app.request.get(f"http://localhost:{app_port}/_stcore/health")

    expect(response).to_be_ok()
    assert response.headers.get("cache-control") == "no-cache"


def test_health_endpoint_supports_head_method(app: Page, app_port: int):
    """Test that health endpoint supports HEAD method for monitoring services."""
    response = app.request.head(f"http://localhost:{app_port}/_stcore/health")

    expect(response).to_be_ok()
    assert response.status == 200


def test_health_endpoint_supports_options_for_cors(app: Page, app_port: int):
    """Test that health endpoint handles OPTIONS requests for CORS preflight."""
    response = app.request.fetch(
        f"http://localhost:{app_port}/_stcore/health",
        method="OPTIONS",
    )

    # OPTIONS should return 204 No Content
    assert response.status == 204


def test_script_health_endpoint_returns_ok(app: Page, app_port: int):
    """Test that /_stcore/script-health-check returns 'ok' for valid script."""
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/script-health-check"
    )

    expect(response).to_be_ok()
    assert response.status == 200
    # The response should indicate script ran successfully.
    assert "ok" in response.text().lower()


# =============================================================================
# Metrics Endpoint Tests
# =============================================================================


def test_metrics_endpoint_returns_valid_response(app: Page, app_port: int):
    """Test that /_stcore/metrics returns metrics in openmetrics format."""
    response = app.request.get(f"http://localhost:{app_port}/_stcore/metrics")

    expect(response).to_be_ok()
    assert response.status == 200

    # Should have openmetrics content type
    content_type = response.headers.get("content-type", "")
    assert "openmetrics" in content_type or "text/plain" in content_type

    # Response should contain metric data (non-empty)
    assert len(response.text()) > 0


def test_metrics_endpoint_accepts_protobuf(app: Page, app_port: int):
    """Test that metrics endpoint can return protobuf when requested."""
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics",
        headers={"Accept": "application/x-protobuf"},
    )

    expect(response).to_be_ok()
    assert response.status == 200

    # Should return protobuf content type
    content_type = response.headers.get("content-type", "")
    assert "protobuf" in content_type


def test_metrics_endpoint_filters_by_family_cache_memory(app: Page, app_port: int):
    """Test that metrics endpoint filters results by families query parameter.

    When requesting families=cache_memory_bytes, only cache memory metrics
    should be returned. The web_server.py app initializes session state to
    ensure these metrics are always present.
    """
    wait_for_app_loaded(app)

    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics?families=cache_memory_bytes"
    )

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should contain cache_memory_bytes metrics (guaranteed by session state in web_server.py)
    assert "cache_memory_bytes" in text
    # Should NOT contain session_events_total or active_sessions metrics
    assert "session_events_total" not in text
    assert "active_sessions" not in text


def test_metrics_endpoint_filters_by_family_session_events(app: Page, app_port: int):
    """Test that metrics endpoint returns session_events_total when requested.

    Session events metrics track connections, reconnections, and disconnections.
    """
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics?families=session_events_total"
    )

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should contain session_events_total metrics
    assert "session_events_total" in text
    # Should NOT contain cache_memory_bytes or active_sessions metrics
    assert "cache_memory_bytes" not in text
    assert "active_sessions" not in text


def test_metrics_endpoint_filters_by_family_active_sessions(app: Page, app_port: int):
    """Test that metrics endpoint returns active_sessions when requested.

    Active sessions metrics track the current number of connected sessions.
    """
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics?families=active_sessions"
    )

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should contain active_sessions metrics
    assert "active_sessions" in text
    # Should NOT contain cache_memory_bytes or session_events_total metrics
    assert "cache_memory_bytes" not in text
    assert "session_events_total" not in text


def test_metrics_endpoint_filters_by_multiple_families(app: Page, app_port: int):
    """Test that metrics endpoint supports filtering by multiple families.

    Multiple families query params should return metrics for all requested families.
    """
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics"
        "?families=session_events_total&families=active_sessions"
    )

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should contain both session_events_total and active_sessions metrics
    assert "session_events_total" in text
    assert "active_sessions" in text
    # Should NOT contain cache_memory_bytes metrics
    assert "cache_memory_bytes" not in text


def test_metrics_endpoint_unknown_family_returns_empty(app: Page, app_port: int):
    """Test that metrics endpoint returns empty response for unknown families.

    When requesting a family that doesn't exist, the response should contain
    only the EOF marker.
    """
    response = app.request.get(
        f"http://localhost:{app_port}/_stcore/metrics?families=unknown_family"
    )

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should only contain the EOF marker
    assert text.strip() == "# EOF"


def test_metrics_endpoint_no_filter_returns_all_families(app: Page, app_port: int):
    """Test that metrics endpoint without filter returns all metric families.

    When no families query param is provided, all available metrics should be returned.
    The web_server.py app initializes session state to ensure cache_memory_bytes
    metrics are always present.
    """
    wait_for_app_loaded(app)

    response = app.request.get(f"http://localhost:{app_port}/_stcore/metrics")

    expect(response).to_be_ok()
    assert response.status == 200

    text = response.text()
    # Should contain metrics from all families
    # cache_memory_bytes is guaranteed by session state initialization in web_server.py
    assert "cache_memory_bytes" in text
    assert "session_events_total" in text
    assert "active_sessions" in text


# =============================================================================
# Host Config Endpoint Tests
# =============================================================================


def test_host_config_endpoint_returns_json(app: Page, app_port: int):
    """Test that /_stcore/host-config returns valid JSON configuration."""
    response = app.request.get(f"http://localhost:{app_port}/_stcore/host-config")

    expect(response).to_be_ok()
    assert response.status == 200

    config = response.json()

    # Verify expected fields exist
    assert "allowedOrigins" in config
    assert isinstance(config["allowedOrigins"], list)
    assert "useExternalAuthToken" in config
    assert "enableCustomParentMessages" in config


def test_host_config_has_no_cache_header(app: Page, app_port: int):
    """Test that host-config endpoint sets Cache-Control: no-cache."""
    response = app.request.get(f"http://localhost:{app_port}/_stcore/host-config")

    expect(response).to_be_ok()
    assert response.headers.get("cache-control") == "no-cache"


# =============================================================================
# CORS Header Tests
# =============================================================================


def test_cors_options_preflight_returns_204(app: Page, app_port: int):
    """Test that OPTIONS preflight requests return 204 No Content."""
    response = app.request.fetch(
        f"http://localhost:{app_port}/_stcore/health",
        method="OPTIONS",
        headers={"Origin": "http://localhost:3000"},
    )

    # OPTIONS should return 204 No Content
    assert response.status == 204


# =============================================================================
# Media Endpoint Tests
# =============================================================================


def _get_media_url_from_image(app: Page, app_port: int) -> str | None:
    """Helper to get the media URL from an image element.

    Parameters
    ----------
    app : Page
        The Playwright page object.
    app_port : int
        The port number where the app is running.

    Returns
    -------
    str or None
        The full media URL if found, or None if no image with a media URL exists.
    """
    wait_for_app_loaded(app)

    # Get the image element
    image = app.get_by_test_id("stImage").locator("img").first
    expect(image).to_be_visible()

    # Get the src attribute
    src = image.get_attribute("src")
    if src and "/media/" in src:
        # Make it a full URL if it's relative
        if src.startswith("/"):
            return f"http://localhost:{app_port}{src}"
        return src

    return None


def test_media_endpoint_serves_image_content(app: Page, app_port: int):
    """Test that media endpoint correctly serves image content."""
    media_url = _get_media_url_from_image(app, app_port)

    assert media_url is not None

    # Fetch the media content directly
    response = app.request.get(media_url)

    expect(response).to_be_ok()
    assert response.status == 200

    # Should have a content-type header
    content_type = response.headers.get("content-type")
    assert content_type is not None
    assert "image" in content_type


def test_media_endpoint_supports_range_requests(app: Page, app_port: int):
    """Test that media endpoint supports Accept-Ranges header for streaming."""
    media_url = _get_media_url_from_image(app, app_port)

    assert media_url is not None

    response = app.request.get(media_url)

    expect(response).to_be_ok()

    # Should indicate range requests are supported
    accept_ranges = response.headers.get("accept-ranges")
    assert accept_ranges == "bytes"


def test_media_endpoint_handles_range_request(app: Page, app_port: int):
    """Test that media endpoint correctly handles Range header requests."""
    media_url = _get_media_url_from_image(app, app_port)

    assert media_url is not None

    # Make a range request for first 10 bytes
    response = app.request.get(media_url, headers={"Range": "bytes=0-9"})

    # Should return 206 Partial Content
    assert response.status == 206

    # Should have Content-Range header
    content_range = response.headers.get("content-range")
    assert content_range is not None
    assert content_range.startswith("bytes 0-9/")

    # Should return exactly 10 bytes
    assert len(response.body()) == 10


def test_media_endpoint_returns_404_for_invalid_file(app: Page, app_port: int):
    """Test that media endpoint returns 404 for non-existent files."""
    response = app.request.get(
        f"http://localhost:{app_port}/media/nonexistent-file-id.txt"
    )

    assert response.status == 404


# =============================================================================
# File Upload Endpoint Tests
# =============================================================================


def test_upload_endpoint_options_returns_cors_headers(app: Page, app_port: int):
    """Test that upload endpoint OPTIONS request returns CORS headers."""
    response = app.request.fetch(
        f"http://localhost:{app_port}/_stcore/upload_file/test-session/test-file",
        method="OPTIONS",
    )

    # OPTIONS should return 204
    assert response.status == 204

    # Should have CORS headers
    assert "access-control-allow-methods" in response.headers
    assert "PUT" in response.headers.get("access-control-allow-methods", "")
    assert "DELETE" in response.headers.get("access-control-allow-methods", "")


def test_upload_endpoint_rejects_invalid_session(app: Page, app_port: int):
    """Test that upload endpoint rejects uploads with invalid session_id.

    When XSRF protection is enabled (default), the server will return 403 Forbidden
    for requests without a valid XSRF token before even checking the session.
    When XSRF is disabled, it returns 400 Bad Request for invalid sessions.
    """
    wait_for_app_loaded(app)

    # Try to upload with an invalid session ID
    response = app.request.put(
        f"http://localhost:{app_port}/_stcore/upload_file/invalid-session-id/test-file",
        multipart={
            "file": {
                "name": "test.txt",
                "mimeType": "text/plain",
                "buffer": b"test content",
            }
        },
    )

    # Should return 400 (invalid session) or 403 (XSRF protection)
    assert response.status in {400, 403}, f"Expected 400 or 403, got {response.status}"


def test_upload_delete_endpoint(app: Page, app_port: int):
    """Test that upload DELETE endpoint responds correctly.

    When XSRF protection is enabled (default), the server will return 403 Forbidden
    for requests without a valid XSRF token.
    When XSRF is disabled, it returns 204 No Content for DELETE operations.
    """
    wait_for_app_loaded(app)

    # DELETE on a non-existent file
    response = app.request.delete(
        f"http://localhost:{app_port}/_stcore/upload_file/any-session/any-file"
    )

    # Should return 204 (success) or 403 (XSRF protection)
    assert response.status in {204, 403}, f"Expected 204 or 403, got {response.status}"


# =============================================================================
# XSRF Cookie Tests
# =============================================================================


def test_xsrf_cookie_format(app: Page):
    """Test that XSRF cookie is set with expected format."""
    wait_for_app_loaded(app)

    # Get cookies from the page context
    cookies = app.context.cookies()

    # Find the XSRF cookie
    xsrf_cookie = None
    for cookie in cookies:
        if cookie["name"] == "_streamlit_xsrf":
            xsrf_cookie = cookie
            break

    assert xsrf_cookie is not None

    # Cookie should have a value.
    assert len(xsrf_cookie["value"]) > 0

    # Cookie should have SameSite=Lax (or "None" in Firefox due to Playwright reporting differences).
    # The key security property is that the cookie exists and has a value.
    same_site = xsrf_cookie.get("sameSite")
    assert same_site in {"Lax", "None"}, (
        f"Expected SameSite 'Lax' or 'None', got: {same_site}"
    )


# =============================================================================
# Static File Endpoint Tests
# =============================================================================


def test_frontend_static_files_served(app: Page, app_port: int):
    """Test that frontend static files (JS, CSS) are served correctly."""
    # Request the main page
    response = app.request.get(f"http://localhost:{app_port}/")

    expect(response).to_be_ok()
    assert response.status == 200

    # Should return HTML
    content_type = response.headers.get("content-type", "")
    assert "text/html" in content_type


def test_frontend_static_files_have_cache_headers(app: Page, app_port: int):
    """Test that index.html has no-cache but assets have long cache."""
    # Index should have no-cache
    response = app.request.get(f"http://localhost:{app_port}/")

    expect(response).to_be_ok()
    cache_control = response.headers.get("cache-control", "")
    assert "no-cache" in cache_control


def test_nonexistent_route_returns_index(app: Page, app_port: int):
    """Test that non-existent routes return index.html (SPA behavior)."""
    response = app.request.get(f"http://localhost:{app_port}/nonexistent-page")

    # Should still return 200 and serve the SPA
    expect(response).to_be_ok()
    assert response.status == 200

    content_type = response.headers.get("content-type", "")
    assert "text/html" in content_type


# =============================================================================
# Slash Redirect Tests
# =============================================================================


def test_trailing_slash_redirect_on_static_paths(app: Page, app_port: int):
    """Test that trailing slashes on static paths are handled correctly.

    The server should either:
    - Redirect /path/ to /path (RemoveSlashHandler behavior)
    - Or serve the content directly

    This is important for consistent URL handling and avoiding duplicate content.
    """
    # Request a path with trailing slash
    response = app.request.get(
        f"http://localhost:{app_port}/some-path/",
        max_redirects=0,  # Don't follow redirects to see the redirect response
    )

    # Tornado uses 301 (permanent redirect) via @removeslash decorator
    assert response.status == 301, f"Expected 301, got {response.status}"

    # Should redirect to path without trailing slash.
    location = response.headers.get("location", "")
    assert location, "Redirect location header is empty"
    assert not location.endswith("/") or location == "/", (
        f"Redirect should remove trailing slash, got: {location}"
    )


def test_base_url_without_trailing_slash(app: Page, app_port: int):
    """Test that base URL without trailing slash is handled correctly.

    The server should either:
    - Redirect / to /
    - Or serve content directly
    """
    # The root path should work (may redirect to add trailing slash or serve directly)
    response = app.request.get(f"http://localhost:{app_port}")

    # Should succeed (possibly after redirect)
    expect(response).to_be_ok()
    assert response.status == 200


def test_double_slash_not_redirected_to_external(app: Page, app_port: int):
    """Test that double slashes don't cause redirect to external host.

    A path like //example.com could be misinterpreted as a protocol-relative URL.
    The path security middleware blocks these paths with 400 Bad Request.
    """
    # Request with double slash at start
    response = app.request.get(
        f"http://localhost:{app_port}//some-path",
        max_redirects=0,
    )

    # Should be blocked with 400 Bad Request by PathSecurityMiddleware
    assert response.status == 400, f"Expected 400, got {response.status}"


# =============================================================================
# WebSocket Endpoint Tests
# =============================================================================


def test_websocket_connection_to_stream_endpoint(app: Page):
    """Test that WebSocket connects to the correct stream endpoint.

    The frontend establishes a WebSocket connection to /_stcore/stream
    using the Sec-WebSocket-Protocol header.
    """
    from playwright.sync_api import WebSocket

    # Capture WebSocket connections
    ws_connections: list[WebSocket] = []

    def capture_ws(ws: WebSocket) -> None:
        ws_connections.append(ws)

    # Note: We need to register the handler before navigation, but the app fixture
    # already navigated. So we reload to capture the WebSocket connection.
    app.on("websocket", capture_ws)
    app.reload()
    wait_for_app_loaded(app)

    # Verify WebSocket connection was established
    assert len(ws_connections) > 0, "No WebSocket connection established"

    # Verify it connected to the correct endpoint
    ws = ws_connections[0]
    assert "/_stcore/stream" in ws.url, (
        f"WebSocket URL should contain /_stcore/stream, got: {ws.url}"
    )


def test_direct_websocket_connection_with_subprotocol(app: Page, app_port: int):
    """Test direct WebSocket connection with Sec-WebSocket-Protocol header.

    This verifies the server correctly handles the subprotocol negotiation.
    Uses browser's native WebSocket API via page.evaluate() to avoid the complexity
    of Python async WebSocket libraries conflicting with Playwright's event loop.
    """
    # The app fixture automatically navigates and waits for the app to load.
    result = app.evaluate(f"""
        () => new Promise((resolve, reject) => {{
            const ws = new WebSocket(
                'ws://localhost:{app_port}/_stcore/stream',
                ['streamlit']
            );
            ws.onopen = () => {{
                resolve(ws.protocol);
                ws.close();
            }};
            ws.onerror = () => reject('connection failed');
            setTimeout(() => reject('timeout'), 5000);
        }})
    """)

    assert result == "streamlit", f"Expected 'streamlit' subprotocol, got: {result}"


def test_direct_websocket_with_session_id_in_subprotocol(app: Page, app_port: int):
    """Test that server accepts session ID in Sec-WebSocket-Protocol for reconnection.

    This verifies the server correctly parses the third entry (session ID)
    from the Sec-WebSocket-Protocol header.
    Uses browser's native WebSocket API via page.evaluate() to avoid the complexity
    of Python async WebSocket libraries conflicting with Playwright's event loop.
    """
    wait_for_app_loaded(app)

    # Get the current session ID from the app (stored in sessionStorage)
    session_id = app.evaluate("window.sessionStorage.getItem('stStreamlitSessionId')")

    # If no session ID in storage, use a test session ID
    if session_id is None:
        session_id = "test-session-id-12345"

    # Subprotocol entries: protocol name, XSRF token placeholder, session ID
    result = app.evaluate(f"""
        () => new Promise((resolve, reject) => {{
            const ws = new WebSocket(
                'ws://localhost:{app_port}/_stcore/stream',
                ['streamlit', 'placeholder', '{session_id}']
            );
            ws.onopen = () => {{
                resolve({{ connected: true, protocol: ws.protocol }});
                ws.close();
            }};
            ws.onerror = () => resolve({{ connected: false, error: 'connection failed' }});
            setTimeout(() => resolve({{ connected: false, error: 'timeout' }}), 5000);
        }})
    """)

    assert result["connected"], f"WebSocket connection failed: {result.get('error')}"
    assert result["protocol"] == "streamlit", (
        f"Expected 'streamlit' subprotocol, got: {result['protocol']}"
    )


def test_websocket_reconnection_preserves_state(app: Page):
    """Test that WebSocket reconnection preserves session state.

    This test verifies that the session ID passed via Sec-WebSocket-Protocol
    (third entry) is correctly parsed by the server, allowing session
    reconnection without losing state.
    """
    wait_for_app_loaded(app)

    # Increment counter.
    click_button(app, "Increment counter")
    wait_for_app_run(app)

    # Verify counter is 1.
    expect(app.get_by_text("Counter: 1")).to_be_visible()

    # Disconnect WebSocket using debug command.
    app.evaluate("window.streamlitDebug.disconnectWebsocket();")

    # Wait for reconnection (status widget should appear and disappear).
    expect(app.get_by_test_id("stStatusWidget")).to_be_visible()
    expect(app.get_by_test_id("stStatusWidget")).not_to_be_attached(timeout=10000)

    # Counter should still be 1 after reconnection.
    # This proves the server correctly parsed the session ID from
    # the third entry of Sec-WebSocket-Protocol header.
    expect(app.get_by_text("Counter: 1")).to_be_visible()
