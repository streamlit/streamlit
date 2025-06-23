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

import os
from typing import Any

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run, wait_until


# Configuration fixtures for different sidebar initial states
@pytest.fixture(scope="module")
@pytest.mark.early
def configure_sidebar_collapsed():
    """Configure initial_sidebar_state='collapsed'."""
    os.environ["STREAMLIT_SIDEBAR_TEST_MODE"] = "collapsed"
    yield
    if "STREAMLIT_SIDEBAR_TEST_MODE" in os.environ:
        del os.environ["STREAMLIT_SIDEBAR_TEST_MODE"]


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_sidebar_expanded():
    """Configure initial_sidebar_state='expanded'."""
    os.environ["STREAMLIT_SIDEBAR_TEST_MODE"] = "expanded"
    yield
    if "STREAMLIT_SIDEBAR_TEST_MODE" in os.environ:
        del os.environ["STREAMLIT_SIDEBAR_TEST_MODE"]


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_sidebar_auto():
    """Configure initial_sidebar_state='auto' (default behavior)."""
    os.environ["STREAMLIT_SIDEBAR_TEST_MODE"] = "auto"
    yield
    if "STREAMLIT_SIDEBAR_TEST_MODE" in os.environ:
        del os.environ["STREAMLIT_SIDEBAR_TEST_MODE"]


# Tests for initial_sidebar_state="auto" (default behavior)
@pytest.mark.usefixtures("configure_sidebar_auto")
def test_sidebar_auto_mobile_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sidebar with initial_sidebar_state='auto' on mobile - should be collapsed."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify sidebar exists and is collapsed on mobile
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button exists and works
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot of collapsed state
    assert_snapshot(app, name="st_main_layout-auto_mobile_collapsed")


@pytest.mark.usefixtures("configure_sidebar_auto")
def test_sidebar_auto_mobile_can_expand(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sidebar with initial_sidebar_state='auto' can be expanded on mobile."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Expand the sidebar
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expand_button.click()

    # Verify sidebar is now expanded
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot of expanded state
    assert_snapshot(app, name="st_main_layout-auto_mobile_expanded")


@pytest.mark.usefixtures("configure_sidebar_auto")
def test_sidebar_auto_desktop_expanded(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sidebar with initial_sidebar_state='auto' on desktop - should be expanded."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify sidebar exists and is expanded on desktop
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot of expanded desktop state
    assert_snapshot(app, name="st_main_layout-auto_desktop_expanded")


@pytest.mark.usefixtures("configure_sidebar_auto")
def test_sidebar_auto_desktop_can_collapse(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sidebar with initial_sidebar_state='auto' can be collapsed on desktop."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Hover over sidebar to make collapse button visible
    sidebar_header = app.get_by_test_id("stSidebarHeader")
    sidebar_header.hover()

    # Collapse the sidebar
    collapse_button = app.get_by_test_id("stSidebarCollapseButton").locator("button")
    collapse_button.click()

    # Verify sidebar is collapsed
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button is now visible
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot of collapsed desktop state
    assert_snapshot(app, name="st_main_layout-auto_desktop_collapsed")


# Tests for initial_sidebar_state="collapsed"
@pytest.mark.usefixtures("configure_sidebar_collapsed")
def test_sidebar_collapsed_mobile(app: Page, assert_snapshot: ImageCompareFunction):
    """Test sidebar with initial_sidebar_state='collapsed' on mobile."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify sidebar exists but is collapsed
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()
    expect(sidebar).to_have_attribute("aria-expanded", "false")

    # Verify expand button exists
    expand_button = app.get_by_test_id("stExpandSidebarButton")
    expect(expand_button).to_be_visible()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-collapsed_mobile")


@pytest.mark.usefixtures("configure_sidebar_collapsed")
def test_sidebar_collapsed_desktop(app: Page, assert_snapshot: ImageCompareFunction):
    """Test sidebar with initial_sidebar_state='collapsed' on desktop."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify sidebar exists but is collapsed (unlike auto mode)
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    # Wait for expand button to be visible
    wait_until(
        app,
        lambda: app.get_by_test_id("stExpandSidebarButton").is_visible(),
        timeout=10000,
    )

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-collapsed_desktop")


# Tests for initial_sidebar_state="expanded"
@pytest.mark.usefixtures("configure_sidebar_expanded")
def test_sidebar_expanded_mobile(app: Page, assert_snapshot: ImageCompareFunction):
    """Test sidebar with initial_sidebar_state='expanded' on mobile."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify sidebar exists and is expanded (unlike auto mode)
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_be_attached()

    # Verify sidebar content is visible
    sidebar_content = app.get_by_test_id("stSidebarContent")
    expect(sidebar_content).to_be_visible()

    # Take snapshot
    assert_snapshot(app, name="st_main_layout-expanded_mobile")


@pytest.mark.usefixtures("configure_sidebar_expanded")
def test_sidebar_expanded_desktop(app: Page, assert_snapshot: ImageCompareFunction):
    """Test sidebar with initial_sidebar_state='expanded' on desktop."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

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
@pytest.mark.usefixtures("configure_sidebar_auto")
def test_deploy_button_mobile_sidebar_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test deploy button positioning on mobile with collapsed sidebar."""
    app.set_viewport_size({"width": 375, "height": 667})
    wait_for_app_run(app)

    # Verify header is visible and positioned correctly
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(header, name="st_main_layout-deploy_button_mobile_collapsed")


@pytest.mark.usefixtures("configure_sidebar_auto")
def test_deploy_button_desktop_sidebar_expanded(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test deploy button positioning on desktop with expanded sidebar."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

    # Verify sidebar is expanded
    sidebar = app.get_by_test_id("stSidebar")
    expect(sidebar).to_have_attribute("aria-expanded", "true")

    # Verify header is visible
    header = app.get_by_test_id("stHeader")
    expect(header).to_be_visible()

    # Take screenshot focusing on header area
    assert_snapshot(header, name="st_main_layout-deploy_button_desktop_expanded")


@pytest.mark.usefixtures("configure_sidebar_auto")
def test_deploy_button_desktop_sidebar_manually_collapsed(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test deploy button positioning on desktop after manually collapsing sidebar."""
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

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
@pytest.mark.usefixtures("configure_sidebar_auto")
def test_viewport_resize_responsive_behavior(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test sidebar behavior when resizing viewport with auto mode."""
    # Start with desktop - sidebar should be expanded
    app.set_viewport_size({"width": 1280, "height": 800})
    wait_for_app_run(app)

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
@pytest.mark.usefixtures("configure_sidebar_auto")
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
    app: Page, viewport_config: dict[str, Any], assert_snapshot: ImageCompareFunction
):
    """Test layout responsiveness with auto sidebar mode across different viewport sizes."""
    app.set_viewport_size(
        {"width": viewport_config["width"], "height": viewport_config["height"]}
    )
    wait_for_app_run(app)

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
