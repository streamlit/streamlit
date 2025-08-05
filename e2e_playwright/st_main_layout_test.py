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

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    ImageCompareFunction,
    start_app_server,
    wait_for_app_loaded,
    wait_for_app_run,
)

if TYPE_CHECKING:
    from collections.abc import Generator


@pytest.fixture
def sidebar_mode(request: pytest.FixtureRequest) -> str:
    """Fixture to provide sidebar_mode parameter to app fixture."""
    return getattr(request, "param", "auto")


# Disable the module-scoped app_server fixture for this test module
@pytest.fixture(scope="module", autouse=True)
def app_server():
    """Override to disable the default module-scoped app_server fixture."""
    return


# Custom app fixture that starts a fresh server for each test with the correct sidebar mode
@pytest.fixture
def app(
    page: Page,
    app_port: int,
    request: pytest.FixtureRequest,
    sidebar_mode: str,
) -> Generator[Page, None, None]:
    """Start fresh server with correct sidebar mode for each test."""
    from e2e_playwright.shared.performance import start_capture_traces

    # Start the Streamlit server with the custom environment variable
    streamlit_proc = start_app_server(
        app_port,
        request.module,
        extra_env={"STREAMLIT_SIDEBAR_TEST_MODE": sidebar_mode},
    )

    try:
        # Open the app page
        response = page.goto(f"http://localhost:{app_port}/")
        if response is None or response.status != 200:
            raise RuntimeError("Unable to load page")

        # Clear localStorage to ensure clean state for tests
        page.evaluate("() => window.localStorage.clear()")

        start_capture_traces(page)
        wait_for_app_loaded(page)
        yield page
    finally:
        # Clean up the server
        streamlit_stdout = streamlit_proc.terminate()
        print(streamlit_stdout, flush=True)


def setup_viewport_and_verify_title(
    app: Page, width: int, height: int, sidebar_mode: str
) -> None:
    """Common setup for viewport, waiting, and title verification."""
    app.set_viewport_size({"width": width, "height": height})

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Reload the page to allow viewport size change to take effect.
    app.reload()
    wait_for_app_run(app)


def verify_sidebar_state(app: Page, expected_expanded: bool) -> None:
    """Verify sidebar exists and has expected expanded state."""
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", str(expected_expanded).lower())


def verify_sidebar_content_visibility(app: Page, should_be_visible: bool) -> None:
    """Verify sidebar content visibility."""
    sidebar_content = app.get_by_test_id("stSidebarContent")
    if should_be_visible:
        expect(sidebar_content).to_be_visible()
    else:
        # For collapsed state, we don't check visibility as it might vary
        pass


def verify_expand_button_visible(app: Page) -> None:
    """Verify expand button is visible."""
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()


# Consolidated test for basic sidebar states across different modes and viewports
@pytest.mark.parametrize(
    ("sidebar_mode", "viewport", "expected_expanded", "test_name"),
    [
        ("auto", {"width": 375, "height": 667}, False, "auto_mobile_collapsed"),
        ("auto", {"width": 1280, "height": 800}, True, "auto_desktop_expanded"),
        ("collapsed", {"width": 375, "height": 667}, False, "collapsed_mobile"),
        ("collapsed", {"width": 1280, "height": 800}, False, "collapsed_desktop"),
        ("expanded", {"width": 375, "height": 667}, True, "expanded_mobile"),
        ("expanded", {"width": 1280, "height": 800}, True, "expanded_desktop"),
    ],
    indirect=["sidebar_mode"],
)
def test_sidebar_basic_states(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    sidebar_mode: str,
    viewport: dict[str, int],
    expected_expanded: bool,
    test_name: str,
):
    """Test sidebar basic states across different modes and viewport sizes."""
    setup_viewport_and_verify_title(
        app, viewport["width"], viewport["height"], sidebar_mode
    )

    # Verify sidebar state
    verify_sidebar_state(app, expected_expanded)

    # Verify content visibility for expanded states
    if expected_expanded:
        verify_sidebar_content_visibility(app, True)
    # Note: For collapsed states, we don't always verify expand button visibility
    # as behavior may vary between auto/collapsed modes

    # Take snapshot
    assert_snapshot(app, name=f"st_main_layout-{test_name}")


# Test interaction functionality for auto mode
@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_sidebar_auto_mobile_expand_interaction(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar expand interaction on mobile with auto mode."""
    setup_viewport_and_verify_title(app, 375, 667, sidebar_mode)

    # Verify initial collapsed state
    verify_sidebar_state(app, False)
    verify_expand_button_visible(app)

    # Expand the sidebar
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expand_button.click()

    # Verify expanded state
    verify_sidebar_state(app, True)
    verify_sidebar_content_visibility(app, True)

    # Take snapshot of expanded state
    assert_snapshot(app, name="st_main_layout-auto_mobile_expanded")


@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_sidebar_auto_desktop_collapse_interaction(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar collapse interaction on desktop with auto mode."""
    setup_viewport_and_verify_title(app, 1280, 800, sidebar_mode)

    # Verify initial expanded state
    verify_sidebar_state(app, True)
    verify_sidebar_content_visibility(app, True)

    # Hover over sidebar to make collapse button visible
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_header.hover()

    # Collapse the sidebar
    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    collapse_button.click()

    # Verify collapsed state
    verify_sidebar_state(app, False)
    verify_expand_button_visible(app)

    # Take snapshot of collapsed desktop state
    assert_snapshot(app, name="st_main_layout-auto_desktop_collapsed")


# Tests for deploy button positioning
@pytest.mark.parametrize(
    ("sidebar_mode", "viewport", "expected_expanded", "test_name"),
    [
        (
            "auto",
            {"width": 375, "height": 667},
            False,
            "deploy_button_mobile_collapsed",
        ),
        (
            "auto",
            {"width": 1280, "height": 800},
            True,
            "deploy_button_desktop_expanded",
        ),
    ],
    indirect=["sidebar_mode"],
)
def test_deploy_button_positioning(
    app: Page,
    assert_snapshot: ImageCompareFunction,
    sidebar_mode: str,
    viewport: dict[str, int],
    expected_expanded: bool,
    test_name: str,
):
    """Test deploy button positioning with different sidebar states."""
    setup_viewport_and_verify_title(
        app, viewport["width"], viewport["height"], sidebar_mode
    )

    # Verify sidebar state
    verify_sidebar_state(app, expected_expanded)

    # Verify header is visible
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(header, name=f"st_main_layout-{test_name}")


@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_deploy_button_desktop_manually_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test deploy button positioning on desktop after manually collapsing sidebar."""
    setup_viewport_and_verify_title(app, 1280, 800, sidebar_mode)

    # Manually collapse the sidebar
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_header.hover()

    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    collapse_button.click()

    # Verify sidebar is collapsed
    verify_sidebar_state(app, False)

    # Verify header adjusts correctly
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(
        header, name="st_main_layout-deploy_button_desktop_manually_collapsed"
    )


# Test responsive behavior during viewport size changes
@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_viewport_resize_responsive_behavior(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar behavior when resizing viewport with auto mode."""
    # Start with desktop - sidebar should be expanded
    setup_viewport_and_verify_title(app, 1280, 800, sidebar_mode)
    verify_sidebar_state(app, True)

    # Resize to mobile - sidebar should auto-collapse
    app.set_viewport_size({"width": 375, "height": 667})

    # Verify sidebar collapsed on mobile
    verify_sidebar_state(app, False)
    verify_expand_button_visible(app)

    # Take final snapshot
    assert_snapshot(app, name="st_main_layout-responsive_mobile_final")


# Comprehensive responsiveness test
@pytest.mark.parametrize(
    ("sidebar_mode", "viewport_config"),
    [
        ("auto", {"name": "mobile", "width": 375, "height": 667}),
        ("auto", {"name": "tablet", "width": 768, "height": 1024}),
        ("auto", {"name": "desktop", "width": 1280, "height": 800}),
        ("auto", {"name": "wide", "width": 1920, "height": 1080}),
    ],
    indirect=["sidebar_mode"],
)
def test_layout_responsiveness_auto_mode(
    app: Page,
    viewport_config: dict[str, Any],
    assert_snapshot: ImageCompareFunction,
    sidebar_mode: str,
):
    """Test layout responsiveness with auto sidebar mode across different viewport sizes."""
    setup_viewport_and_verify_title(
        app, viewport_config["width"], viewport_config["height"], sidebar_mode
    )

    # Verify basic layout elements are present
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    main_content = app.get_by_test_id("stMain")
    expect(main_content).to_be_visible()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    expect(app.get_by_text("Info box 1")).to_be_visible()
    expect(app.get_by_text("Info box 2")).to_be_visible()

    # Take full app screenshot for this viewport
    assert_snapshot(
        app, name=f"st_main_layout-auto_{viewport_config['name']}_responsive"
    )
