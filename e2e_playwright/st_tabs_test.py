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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_for_app_run
from e2e_playwright.shared.app_utils import (
    check_top_level_class,
    expect_markdown,
    get_element_by_key,
    get_expander,
)


def test_tabs_render_correctly(themed_app: Page, assert_snapshot: ImageCompareFunction):
    st_tabs = themed_app.get_by_test_id("stTabs")
    expect(st_tabs).to_have_count(
        11
    )  # 7 original + 3 dynamic tests + 1 nested inner tabs

    assert_snapshot(st_tabs.nth(0), name="st_tabs-sidebar")
    assert_snapshot(st_tabs.nth(1), name="st_tabs-text_input")
    assert_snapshot(st_tabs.nth(2), name="st_tabs-many")
    assert_snapshot(st_tabs.nth(3), name="st_tabs-markdown_labels")
    assert_snapshot(st_tabs.nth(5), name="st_tabs-fixed_width")


def test_displays_correctly_in_sidebar(app: Page):
    expect(app.get_by_test_id("stSidebar").get_by_test_id("stTab")).to_have_count(2)
    expect(app.get_by_text("I am in the sidebar")).to_have_count(1)
    expect(app.get_by_text("I am in the sidebarI'm also in the sidebar")).to_have_count(
        1
    )


def test_contains_all_tabs_when_overflowing(app: Page):
    expect(get_expander(app, "Expander").get_by_test_id("stTab")).to_have_count(25)


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stTabs")


def test_tabs_with_html(app: Page):
    tabs = app.get_by_test_id("stTabs").nth(4)

    expect(app.get_by_text("This is HTML tab 1")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 2").click()
    expect(app.get_by_text("This is HTML tab 2")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 3").click()
    expect(app.get_by_text("This is HTML tab 3")).to_be_visible()
    tabs.get_by_role("tab", name="HTML Tab 1").click()
    expect(app.get_by_text("This is HTML tab 1")).to_be_visible()


def test_tabs_with_code_layouts(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that tabs with code blocks and different height configurations render correctly."""
    tabs_with_code = app.get_by_test_id("stTabs").nth(6)

    # Test Tab 1 with container and stretched code
    tabs_with_code.scroll_into_view_if_needed()
    assert_snapshot(tabs_with_code, name="st_tabs-code_stretch_height_in_container")

    # Switch to Tab 2 and test fixed height and stretched code
    tabs_with_code.get_by_role("tab", name="Tab 2").click()
    assert_snapshot(tabs_with_code, name="st_tabs-fixed_height_stretch_height")


def test_dynamic_tabs_lazy_execution(app: Page):
    """Test that dynamic tabs only execute active tab content."""
    # Initially Dynamic A is active, only A should have executed
    expect(app.get_by_text("Execution counts - A: 1, B: 0")).to_be_visible()

    # Switch to Dynamic B
    tabs_lazy = app.get_by_test_id("stTabs").nth(7)
    tabs_lazy.get_by_role("tab", name="Dynamic B").click()
    wait_for_app_run(app)

    # Only B should execute now, A count stays at 1
    expect(app.get_by_text("Execution counts - A: 1, B: 1")).to_be_visible()
    expect(app.get_by_text("Tab B executed 1 times")).to_be_visible()


def test_dynamic_tabs_programmatic_control(app: Page):
    """Test programmatic control of dynamic tabs via session state."""
    # Go to Tab 2 via button
    app.get_by_test_id("stButton").filter(has_text="Go to Tab 2").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Tab 2 should be active
    tabs_prog = app.get_by_test_id("stTabs").nth(8)
    expect(tabs_prog.get_by_text("Programmatic Tab 2 content")).to_be_visible()

    # Go to Tab 1 via button
    app.get_by_test_id("stButton").filter(has_text="Go to Tab 1").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Tab 1 should be active
    expect(tabs_prog.get_by_text("Programmatic Tab 1 content")).to_be_visible()


def test_dynamic_tabs_nested(app: Page):
    """Test nested dynamic tabs with lazy execution."""
    expect_markdown(
        app, "Nested execution - Outer A: 1, Outer B: 0, Inner 1: 1, Inner 2: 0"
    )

    nested_container = get_element_by_key(app, "nested_tabs_container")
    tabs_outer = nested_container.get_by_test_id("stTabs").first
    tabs_inner = nested_container.get_by_test_id("stTabs").nth(1)

    expect(nested_container.get_by_text("Outer A executed 1 times")).to_be_visible()
    expect(nested_container.get_by_text("Inner 1 executed 1 times")).to_be_visible()

    # Switch to Inner 2
    tabs_inner.get_by_role("tab", name="Inner 2").click()
    wait_for_app_run(app)

    expect_markdown(
        app, "Nested execution - Outer A: 2, Outer B: 0, Inner 1: 1, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Inner 2 executed 1 times")).to_be_visible()

    tabs_outer.get_by_role("tab", name="Outer B").click()
    wait_for_app_run(app)

    expect_markdown(
        app, "Nested execution - Outer A: 2, Outer B: 1, Inner 1: 1, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Outer B executed 1 times")).to_be_visible()

    tabs_outer.get_by_role("tab", name="Outer A").click()
    wait_for_app_run(app)

    # Widget state for the nested tabs is lost when the outer tab is switched because widget state
    # is not preserved when the widget is not executed in the code on a rerun.
    expect_markdown(
        app, "Nested execution - Outer A: 3, Outer B: 1, Inner 1: 2, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Inner 1 executed 2 times")).to_be_visible()


def test_dynamic_tabs_nested_programmatic_control(app: Page):
    """Test programmatic control of nested tabs via buttons."""
    expect_markdown(
        app, "Nested execution - Outer A: 1, Outer B: 0, Inner 1: 1, Inner 2: 0"
    )

    nested_container = get_element_by_key(app, "nested_tabs_container")
    expect(nested_container.get_by_text("Outer A executed 1 times")).to_be_visible()
    expect(nested_container.get_by_text("Inner 1 executed 1 times")).to_be_visible()

    app.get_by_test_id("stButton").filter(has_text="Go Inner 2").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect_markdown(
        app, "Nested execution - Outer A: 2, Outer B: 0, Inner 1: 1, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Inner 2 executed 1 times")).to_be_visible()

    app.get_by_test_id("stButton").filter(has_text="Go Outer B").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    expect_markdown(
        app, "Nested execution - Outer A: 2, Outer B: 1, Inner 1: 1, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Outer B executed 1 times")).to_be_visible()

    app.get_by_test_id("stButton").filter(has_text="Go Outer A").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Widget state for the nested tabs is lost when the outer tab is switched because widget state
    # is not preserved when the widget is not executed in the code on a rerun.
    expect_markdown(
        app, "Nested execution - Outer A: 3, Outer B: 1, Inner 1: 2, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Inner 1 executed 2 times")).to_be_visible()


def test_dynamic_tabs_nested_state_preloading(app: Page):
    """Test that inner tab state can be set while on different outer tab (state preloading)."""
    nested_container = get_element_by_key(app, "nested_tabs_container")
    expect_markdown(
        app, "Nested execution - Outer A: 1, Outer B: 0, Inner 1: 1, Inner 2: 0"
    )

    tabs_outer = nested_container.get_by_test_id("stTabs").first
    tabs_outer.get_by_role("tab", name="Outer B").click()
    wait_for_app_run(app)

    expect_markdown(
        app, "Nested execution - Outer A: 1, Outer B: 1, Inner 1: 1, Inner 2: 0"
    )
    expect(nested_container.get_by_text("Outer B executed 1 times")).to_be_visible()

    # While on Outer B, programmatically set Inner 2 to be active
    # The inner tabs widget is not rendered right now, but state is set
    app.get_by_test_id("stButton").filter(has_text="Go Inner 2").locator(
        "button"
    ).click()
    wait_for_app_run(app)

    # Still on Outer B, inner tabs not executed yet (not rendered)
    expect_markdown(
        app, "Nested execution - Outer A: 1, Outer B: 2, Inner 1: 1, Inner 2: 0"
    )

    # Now switch back to Outer A - Inner 2 should be selected (state was preloaded)
    tabs_outer.get_by_role("tab", name="Outer A").click()
    wait_for_app_run(app)

    # Inner 2 code executes for the first time (state was waiting to be applied)
    expect_markdown(
        app, "Nested execution - Outer A: 2, Outer B: 2, Inner 1: 1, Inner 2: 1"
    )
    expect(nested_container.get_by_text("Inner 2 executed 1 times")).to_be_visible()
