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

"""E2E tests for window.__streamlit configuration security.

These tests verify that:
1. Configuration set via window.__streamlit before load is captured correctly
2. Modifications to window.__streamlit after load do NOT affect the app (security)
"""

from typing import Any

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_loaded


def test_window_config_captured_at_preload(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that window.__streamlit configuration works when set before load.

    This verifies the normal use case where embedding environments set
    configuration before the Streamlit bundle loads.
    """
    # Inject custom configuration BEFORE the page loads
    app.add_init_script("""
        window.__streamlit = {
            LIGHT_THEME: {
                base: "light",
                primaryColor: "#1f2578",
                backgroundColor: "#c8ccf7",
                secondaryBackgroundColor: "#ebecf5",
                textColor: "#1A1A1A",
            }
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Take snapshot to verify custom theme is applied
    assert_snapshot(app, name="window_config_preload_applied")


def test_window_config_immutable_after_load(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that window.__streamlit modifications after load are ignored.

    This is a critical security test. The configuration is frozen at load time,
    so any attempt to modify it afterwards (e.g., by malicious scripts) should
    have no effect on the app.
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
    original_window_value = app.evaluate("""
        () => window.__streamlit?.LIGHT_THEME?.primaryColor
    """)
    assert original_window_value == "#042604", "Initial config should be set"

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
    modified_window_value = app.evaluate("""
        () => window.__streamlit?.LIGHT_THEME?.primaryColor
    """)
    assert modified_window_value == "#FF0000", (
        "window.__streamlit should be modifiable (but it doesn't affect the app)"
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


def test_window_config_theme_not_updated_after_load(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that theme changes after load are ignored.

    This test specifically verifies that theme configuration cannot be
    changed after the initial load, which would be a security/consistency issue.
    """
    # Set initial blue theme
    app.add_init_script("""
        window.__streamlit = {
            LIGHT_THEME: {
                base: "light",
                primaryColor: "#0068C9",
                backgroundColor: "#FFFFFF",
                secondaryBackgroundColor: "#F0F2F6",
                textColor: "#262730",
            }
        }
    """)

    # Reload to apply the injected script
    app.reload()
    wait_for_app_loaded(app)

    # Take snapshot of initial theme
    assert_snapshot(app, name="window_config_blue_theme_initial")

    # Try to change the theme to red after load
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

    # Take another snapshot immediately - should still be blue, proving theme wasn't updated
    # (no re-render should occur, so no need to wait)
    assert_snapshot(app, name="window_config_blue_theme_unchanged")


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
    modified_url = app.evaluate("""
        () => window.__streamlit?.BACKEND_BASE_URL
    """)

    assert modified_url == "https://malicious.example.com"

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
    captured_url = app.evaluate("""
        () => window.__streamlit?.MAIN_PAGE_BASE_URL
    """)
    assert captured_url == "https://example.com/my-app"

    # Now modify window.__streamlit AFTER load to a DIFFERENT pathname
    app.evaluate("""
        () => {
            window.__streamlit = {
                MAIN_PAGE_BASE_URL: "https://example.com/hacked-path"
            };
        }
    """)

    # Verify window.__streamlit was modified
    modified_url = app.evaluate("""
        () => window.__streamlit?.MAIN_PAGE_BASE_URL
    """)
    assert modified_url == "https://example.com/hacked-path"

    # Navigate to Page 2 - this triggers maybeUpdatePageUrl() which retrieves the
    # pathname from parseUriIntoBaseParts(StreamlitConfig.MAIN_PAGE_BASE_URL).pathname
    page2_link = app.get_by_role("link", name="Page 2")
    expect(page2_link).to_be_visible()
    page2_link.click()

    # Wait for navigation
    wait_for_app_loaded(app)

    # Get the new pathname after navigation
    page2_pathname = app.evaluate("() => window.location.pathname")

    # CRITICAL ASSERTION: The pathname should use the FROZEN base (/my-app)
    # NOT the modified base (/hacked-path)
    # If the frozen config is used correctly, pathname should be /my-app/page2
    # If the modified config was used, pathname would be /hacked-path/page2

    # The pathname should contain the frozen base path
    assert "/my-app" in page2_pathname or page2_pathname == "/page2", (
        f"Pathname should use frozen base '/my-app', got: {page2_pathname}"
    )

    # The pathname should NOT contain the hacked path
    assert "/hacked-path" not in page2_pathname, (
        f"Pathname is using the MODIFIED config! "
        f"Found '/hacked-path' in: {page2_pathname}. "
        f"This proves the app used window.__streamlit instead of frozen config!"
    )

    # Verify we navigated to page2
    assert (
        "page2" in page2_pathname.lower()
        or app.get_by_text("This is page 2").is_visible()
    ), f"Should be on page2. Pathname: {page2_pathname}"


def test_window_config_download_url(app: Page):
    """Test that frozen DOWNLOAD_ASSETS_BASE_URL is used in download URL construction.

    This test verifies that the frozen config value is used by checking the actual
    download URL that gets constructed. The download button creates a URL using
    StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL - we verify it uses the FROZEN value,
    not the modified window.__streamlit value.
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
    captured_url = app.evaluate("""
        () => window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL
    """)
    assert captured_url == "https://cdn.example.com"

    # Now modify window.__streamlit AFTER load to a DIFFERENT URL
    app.evaluate("""
        () => {
            window.__streamlit = {
                DOWNLOAD_ASSETS_BASE_URL: "https://malicious.example.com"
            };
        }
    """)

    # Verify window.__streamlit was modified
    modified_url = app.evaluate("""
        () => window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL
    """)
    assert modified_url == "https://malicious.example.com"

    # Set up request interception to capture any URL requests
    # This will catch the media/download URL that gets accessed
    captured_urls = []

    def capture_request(request: Any) -> None:
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

    # Wait for the request to be made (using app.wait_for_load_state instead of timeout)
    app.wait_for_load_state("networkidle")

    # Verify we captured a URL
    assert len(captured_urls) > 0, (
        "Should have captured a download/media URL. "
        "Check if the download button actually makes a request."
    )

    download_url = captured_urls[0]

    # CRITICAL ASSERTION: The URL should use the FROZEN config (cdn.example.com)
    # NOT the modified config (malicious.example.com)
    assert "cdn.example.com" in download_url, (
        f"Download URL uses WRONG config! "
        f"Expected URL to contain 'cdn.example.com' (frozen config), "
        f"but got: {download_url}."
    )

    assert "malicious.example.com" not in download_url, (
        f"Download URL is using the MODIFIED config! "
        f"URL contains 'malicious.example.com': {download_url}. "
        f"This proves the app is using window.__streamlit instead of frozen config!"
    )
