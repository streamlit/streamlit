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

import os
from typing import TYPE_CHECKING, Any

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run

if TYPE_CHECKING:
    from collections.abc import Generator


# Disable the module-scoped app_server fixture for this test module
@pytest.fixture(scope="module", autouse=True)
def app_server():
    """Override to disable the default module-scoped app_server fixture."""
    return


@pytest.fixture
def sidebar_mode(request: pytest.FixtureRequest) -> Generator[str, None, None]:
    mode = request.param
    os.environ["STREAMLIT_SIDEBAR_TEST_MODE"] = mode
    yield mode
    if "STREAMLIT_SIDEBAR_TEST_MODE" in os.environ:
        del os.environ["STREAMLIT_SIDEBAR_TEST_MODE"]


# Override the app fixture to use a fresh server for each test
@pytest.fixture
def app(
    page: Page, app_port: int, request: pytest.FixtureRequest, sidebar_mode: str
) -> Generator[Page, None, None]:
    """Override app fixture to start fresh server with correct sidebar mode for each test."""
    from playwright.sync_api import Response

    from e2e_playwright.conftest import (
        AsyncSubprocess,
        resolve_test_to_script,
        wait_for_app_loaded,
        wait_for_app_server_to_start,
    )
    from e2e_playwright.shared.performance import start_capture_traces

    # Start the Streamlit server with the sidebar mode already set
    # Ensure we inherit the full current environment and override with our specific env var
    full_env = os.environ.copy()
    full_env["STREAMLIT_SIDEBAR_TEST_MODE"] = sidebar_mode

    streamlit_proc = AsyncSubprocess(
        [
            "streamlit",
            "run",
            resolve_test_to_script(request.module),
            "--server.headless",
            "true",
            "--global.developmentMode",
            "false",
            "--global.e2eTest",
            "true",
            "--server.port",
            str(app_port),
            "--browser.gatherUsageStats",
            "false",
            "--server.fileWatcherType",
            "none",
            "--server.enableStaticServing",
            "true",
        ],
        cwd=".",
        env=full_env,  # Pass the full environment with our override
    )
    streamlit_proc.start()
    if not wait_for_app_server_to_start(app_port):
        streamlit_stdout = streamlit_proc.terminate()
        print(streamlit_stdout, flush=True)
        raise RuntimeError("Unable to start Streamlit app")

    try:
        # Open the app page
        marker = request.node.get_closest_marker("app_hash")
        hash_fragment = ""
        if marker:
            hash_fragment = f"#{marker.args[0]}"

        response: Response | None = None
        try:
            response = page.goto(f"http://localhost:{app_port}/{hash_fragment}")
        except Exception as e:
            print(e, flush=True)

        if response is None:
            raise RuntimeError("Unable to load page")
        if response.status != 200:
            print(
                f"Unsuccessful in loading page. Status: {response.status}", flush=True
            )
            if response.status == 404:
                print(
                    "404 error: try building the frontend with make frontend-fast",
                    flush=True,
                )
            raise RuntimeError("Unable to load page")
        print("Successfully loaded page", flush=True)

        start_capture_traces(page)
        wait_for_app_loaded(page)
        yield page
    finally:
        # Clean up the server
        streamlit_stdout = streamlit_proc.terminate()
        print(streamlit_stdout, flush=True)


# Tests for different sidebar initial states using pytest markers


# Tests for initial_sidebar_state="auto" (default behavior)
@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_sidebar_auto_mobile_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='auto' on mobile - should be collapsed and can be expanded."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists and is collapsed on mobile
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button exists and works
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot of collapsed state
    assert_snapshot(app, name="st_main_layout-auto_mobile_collapsed")

    # Test expand functionality
    # Expand the sidebar
    expand_button.click()

    # Verify sidebar is now expanded
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot of expanded state
    assert_snapshot(app, name="st_main_layout-auto_mobile_expanded")


@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_sidebar_auto_desktop_expanded(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='auto' on desktop - should be expanded and can be collapsed."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists and is expanded on desktop
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot of expanded desktop state
    assert_snapshot(app, name="st_main_layout-auto_desktop_expanded")

    # Test collapse functionality
    # Hover over sidebar to make collapse button visible
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_header.hover()

    # Collapse the sidebar
    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    collapse_button.click()

    # Verify sidebar is collapsed
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button is now visible
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot of collapsed desktop state
    assert_snapshot(app, name="st_main_layout-auto_desktop_collapsed")


# Tests for initial_sidebar_state="collapsed"
@pytest.mark.parametrize("sidebar_mode", ["collapsed"], indirect=True)
def test_sidebar_collapsed_mobile(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='collapsed' on mobile."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists but is collapsed
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button exists
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-collapsed_mobile")


@pytest.mark.parametrize("sidebar_mode", ["collapsed"], indirect=True)
def test_sidebar_collapsed_desktop(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='collapsed' on desktop."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists but is collapsed (unlike auto mode)
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-collapsed_desktop")


# Tests for initial_sidebar_state="expanded"
@pytest.mark.parametrize("sidebar_mode", ["expanded"], indirect=True)
def test_sidebar_expanded_mobile(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='expanded' on mobile."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists and is expanded (unlike auto mode)
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-expanded_mobile")


@pytest.mark.parametrize("sidebar_mode", ["expanded"], indirect=True)
def test_sidebar_expanded_desktop(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test sidebar with initial_sidebar_state='expanded' on desktop."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar exists and is expanded
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-expanded_desktop")


# Tests for deploy button positioning with different sidebar states
@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_deploy_button_mobile_sidebar_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test deploy button positioning on mobile with collapsed sidebar."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify header is visible and positioned correctly
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(header, name="st_main_layout-deploy_button_mobile_collapsed")


@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_deploy_button_desktop_sidebar_expanded(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test deploy button positioning on desktop with expanded sidebar."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify sidebar is expanded
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify header is visible
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(header, name="st_main_layout-deploy_button_desktop_expanded")


@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
def test_deploy_button_desktop_sidebar_manually_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction, sidebar_mode: str
):
    """Test deploy button positioning on desktop after manually collapsing sidebar."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Manually collapse the sidebar
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_header.hover()

    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    collapse_button.click()

    # Verify sidebar is collapsed
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "false")

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
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Resize to mobile - sidebar should auto-collapse
    app.set_viewport_size({"width": 375, "height": 667})

    # Verify sidebar collapsed on mobile
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button is available
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take final snapshot
    assert_snapshot(app, name="st_main_layout-responsive_mobile_final")


# Parametrized test for comprehensive layout testing
@pytest.mark.parametrize("sidebar_mode", ["auto"], indirect=True)
@pytest.mark.parametrize(
    "viewport_config",
    [
        {"name": "mobile", "width": 375, "height": 667},
        {"name": "tablet", "width": 768, "height": 1024},
        {"name": "desktop", "width": 1280, "height": 800},
        {"name": "wide", "width": 1920, "height": 1080},
    ],
    indirect=False,
)
def test_layout_responsiveness_auto_mode(
    app: Page,
    viewport_config: dict[str, Any],
    assert_snapshot: ImageCompareFunction,
    sidebar_mode: str,
):
    """Test layout responsiveness with auto sidebar mode across different viewport sizes."""
    app.set_viewport_size(
        {"width": viewport_config["width"], "height": viewport_config["height"]}
    )
    wait_for_app_run(app)

    # Verify the fixture was applied correctly by checking the page title
    expected_title = f"Sidebar Test - {sidebar_mode.title()}"
    expect(app).to_have_title(expected_title)

    # Verify basic layout elements are present
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    main_content = app.get_by_test_id("stMain")
    expect(main_content).to_be_visible()

    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    # Take full app screenshot for this viewport
    assert_snapshot(
        app, name=f"st_main_layout-auto_{viewport_config['name']}_responsive"
    )
