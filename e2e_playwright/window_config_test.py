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

"""E2E tests for window.__streamlit configuration security.

These tests verify that:
1. Configuration set via window.__streamlit before load is captured correctly
2. Modifications to window.__streamlit after load do NOT affect the app (security)
"""

from playwright.sync_api import Page, Request, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    wait_for_app_loaded,
    wait_until,
)


def test_window_config_captured_at_preload(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that window.__streamlit configuration works when set before load.

    This verifies the normal use case where embedding environments set
    configuration before the Streamlit bundle loads. Tests multiple config
    property types: themes, URLs, client IDs, and boolean flags.
    """
    # Inject comprehensive configuration BEFORE the page loads
    # This includes theme, URL, client ID, and boolean flag configs
    app.add_init_script("""
        window.__streamlit = {
            LIGHT_THEME: {
                base: "light",
                primaryColor: "#1f2578",
                backgroundColor: "#c8ccf7",
                secondaryBackgroundColor: "#ebecf5",
                textColor: "#1A1A1A",
            },
            MAIN_PAGE_BASE_URL: "https://host.example.com/my-app",
            CUSTOM_COMPONENT_CLIENT_ID: "preload-test-client-id",
            ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION: false
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Verify theme config was captured (visual verification)
    assert_snapshot(app, name="window_config_preload_applied")

    # Verify URL config was captured
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.MAIN_PAGE_BASE_URL")
        == "https://host.example.com/my-app",
    )

    # Verify client ID config was captured
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.CUSTOM_COMPONENT_CLIENT_ID")
        == "preload-test-client-id",
    )

    # Verify boolean flag config was captured
    wait_until(
        app,
        lambda: app.evaluate(
            "() => window.__streamlit?.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION"
        )
        is False,
    )

    # Verify app is functional with all configs applied
    button = app.get_by_role("button", name="Click me")
    expect(button).to_be_visible()
    button.click()


def test_window_theme_config_immutable_after_load(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that theme changes after load are ignored.

    This test specifically verifies that theme configuration cannot be
    changed after the initial load, which would be a security/consistency issue.
    """
    # Set initial green theme configuration before load
    app.add_init_script("""
        window.__streamlit = {
            LIGHT_THEME: {
                base: "light",
                primaryColor: "#042604",
                backgroundColor: "#F0FFF0",
                textColor: "#006400",
            }
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Verify window.__streamlit exists and has our value
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.LIGHT_THEME?.primaryColor")
        == "#042604",
    )

    # Take snapshot of the initial green theme
    assert_snapshot(app, name="window_config_initial_green_theme")

    # Try to modify window.__streamlit AFTER the app has loaded
    # This should NOT affect the app's appearance since config is frozen at load
    app.evaluate("""
        () => {
            window.__streamlit = {
                LIGHT_THEME: {
                    base: "light",
                    primaryColor: "#FF0000",
                    backgroundColor: "#FFF0F0",
                    textColor: "#8B0000",
                }
            };
        }
    """)

    # Verify window.__streamlit was actually changed
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.LIGHT_THEME?.primaryColor")
        == "#FF0000",
    )

    # Take another snapshot immediately - should still show green theme, NOT red
    # This proves the modification had no effect (no re-render occurred)
    assert_snapshot(app, name="window_config_still_green_after_modification")

    # App should still be fully functional
    button = app.get_by_role("button", name="Click me")
    expect(button).to_be_visible()
    button.click()
    text_input = app.get_by_test_id("stTextInput").locator("input")
    expect(text_input).to_be_visible()
    text_input.fill("security test passed")
    expect(text_input).to_have_value("security test passed")


def test_window_config_backend_base_url_immutable(app: Page):
    """Test that BACKEND_BASE_URL is immutable after load.

    This test verifies that BACKEND_BASE_URL is protected by the frozen config
    mechanism.
    """
    # Try to modify BACKEND_BASE_URL config after load
    app.evaluate("""
        () => {
            window.__streamlit = {
                BACKEND_BASE_URL: "https://malicious.example.com",
            };
        }
    """)

    # Verify window.__streamlit was modified
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.BACKEND_BASE_URL")
        == "https://malicious.example.com",
    )

    # App should still be functional with original frozen config
    # The internal frozen config still has the original values
    # If backend base url is modified, the app would break (not connecting
    # to the backend server)
    button = app.get_by_role("button", name="Click me")
    expect(button).to_be_visible()
    button.click()


def test_window_config_main_page_url(app: Page):
    """Test that frozen MAIN_PAGE_BASE_URL pathname is used in navigation.

    MAIN_PAGE_BASE_URL is used to extract the pathname for constructing page
    paths. This test verifies the frozen pathname is used, not a modified one.
    """
    # Set MAIN_PAGE_BASE_URL with a custom pathname before load
    # Only the /my-app PATHNAME is used, not the full URL
    app.add_init_script("""
        window.__streamlit = {
            MAIN_PAGE_BASE_URL: "https://example.com/my-app"
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Verify config was captured
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.MAIN_PAGE_BASE_URL")
        == "https://example.com/my-app",
    )

    # Now modify window.__streamlit AFTER load to a DIFFERENT pathname
    app.evaluate("""
        () => {
            window.__streamlit = {
                MAIN_PAGE_BASE_URL: "https://example.com/hacked-path"
            };
        }
    """)

    # Verify window.__streamlit was modified
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.MAIN_PAGE_BASE_URL")
        == "https://example.com/hacked-path",
    )

    # Navigate to Page 2 - this triggers maybeUpdatePageUrl() which retrieves the
    # pathname from parseUriIntoBaseParts(StreamlitConfig.MAIN_PAGE_BASE_URL).pathname
    page2_link = app.get_by_role("link", name="Page 2")
    expect(page2_link).to_be_visible()
    page2_link.click()

    # Wait for navigation
    wait_for_app_loaded(app)

    # CRITICAL ASSERTION: The pathname should be /my-app/page2 (using frozen config)
    # If the modified config was used, pathname would be /hacked-path/page2
    wait_until(
        app, lambda: app.evaluate("() => window.location.pathname") == "/my-app/page2"
    )


def test_window_config_direct_property_modification(app: Page):
    """Test that direct property assignment to window.__streamlit is ignored.

    This test verifies that direct property assignment to window.__streamlit
    (not replacing the entire object) has no effect on the app because it reads
    from the frozen capturedConfig, not from window.__streamlit.
    """
    # Set MAIN_PAGE_BASE_URL with a custom pathname before load
    # Only the /my-app PATHNAME is used, not the full URL
    app.add_init_script("""
        window.__streamlit = {
            MAIN_PAGE_BASE_URL: "https://example.com/my-app"
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Verify config was captured
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.MAIN_PAGE_BASE_URL")
        == "https://example.com/my-app",
    )

    # Modify window.__streamlit AFTER load via direct property assignment
    # This tests: window.__streamlit.PROPERTY = "value" (not replacing the whole object)
    app.evaluate("""
        () => {
            window.__streamlit.MAIN_PAGE_BASE_URL = "https://example.com/hacked-path";
        }
    """)

    # Verify window.__streamlit property was directly modified
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.MAIN_PAGE_BASE_URL")
        == "https://example.com/hacked-path",
    )

    # Navigate to Page 2 - this triggers maybeUpdatePageUrl() which should use
    # StreamlitConfig.MAIN_PAGE_BASE_URL (the frozen config), NOT window.__streamlit
    page2_link = app.get_by_role("link", name="Page 2")
    expect(page2_link).to_be_visible()
    page2_link.click()

    # Wait for navigation
    wait_for_app_loaded(app)

    # CRITICAL ASSERTION: The pathname should be /my-app/page2 (using frozen config)
    # If the modified config was used, pathname would be /hacked-path/page2
    wait_until(
        app, lambda: app.evaluate("() => window.location.pathname") == "/my-app/page2"
    )


def test_window_config_download_url(app: Page):
    """Test that frozen DOWNLOAD_ASSETS_BASE_URL is used in download URL construction.

    This test verifies that the frozen config value is used by checking the actual
    download URL that gets constructed. The download button creates a URL using
    StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL - we verify it uses the FROZEN value,
    not the modified window.__streamlit value.

    NOTE: We don't test download success/failure since these are not real base urls,
    just the URL construction.
    """
    # Set DOWNLOAD_ASSETS_BASE_URL before load
    app.add_init_script("""
        window.__streamlit = {
            DOWNLOAD_ASSETS_BASE_URL: "https://cdn.example.com"
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Verify config was captured
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL")
        == "https://cdn.example.com",
    )

    # Now modify window.__streamlit AFTER load to a DIFFERENT URL
    app.evaluate("""
        () => {
            window.__streamlit = {
                DOWNLOAD_ASSETS_BASE_URL: "https://malicious.example.com"
            };
        }
    """)

    # Verify window.__streamlit was modified
    wait_until(
        app,
        lambda: app.evaluate("() => window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL")
        == "https://malicious.example.com",
    )

    # Set up request interception to capture any URL requests
    # This will catch the media/download URL that gets accessed
    captured_urls = []

    def capture_request(request: Request) -> None:
        url = request.url
        # Capture any requests to media endpoints or download URLs
        if (
            "/media/" in url
            or "cdn.example.com" in url
            or "malicious.example.com" in url
        ):
            captured_urls.append(url)

    app.on("request", capture_request)

    # Click the download button AFTER the config was modified
    download_button = app.get_by_role("button", name="Download Test File")
    expect(download_button).to_be_visible()
    download_button.click()

    # Wait until we've captured the download URL request
    wait_until(app, lambda: len(captured_urls) > 0)

    download_url = captured_urls[0]

    # CRITICAL ASSERTION: The URL should use the FROZEN config (cdn.example.com)
    # NOT the modified config (malicious.example.com)
    if "cdn.example.com" not in download_url:
        raise AssertionError(
            f"Download URL uses WRONG config! "
            f"Expected URL to contain 'cdn.example.com' (frozen config), "
            f"but got: {download_url}."
        )

    if "malicious.example.com" in download_url:
        raise AssertionError(
            f"Download URL is using the MODIFIED config! "
            f"URL contains 'malicious.example.com': {download_url}. "
            f"This proves the app is using window.__streamlit instead of frozen config!"
        )
