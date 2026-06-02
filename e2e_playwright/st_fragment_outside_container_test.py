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

"""Tests for fragments writing widgets to outside containers.

These tests verify that fragments can write widgets to containers that were
created outside the fragment's scope, without causing widget duplication.
"""

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button


def test_widget_in_outside_container_no_duplication(app: Page):
    """Verify widget in outside container doesn't duplicate on fragment rerun."""
    # Initial state: should have exactly one "Outside Button"
    outside_btn = app.get_by_role("button", name="Outside Button")
    expect(outside_btn).to_have_count(1)

    # Get initial UUIDs
    fragment_uuid_text = app.get_by_text("Basic fragment UUID:").text_content()
    app_uuid_text = app.get_by_text("App UUID:").text_content()
    assert fragment_uuid_text is not None
    assert app_uuid_text is not None

    # Click the button to trigger fragment rerun
    outside_btn.click()
    wait_for_app_run(app)

    # Should still have exactly one button (not duplicated)
    expect(app.get_by_role("button", name="Outside Button")).to_have_count(1)

    # Fragment UUID should have changed, app UUID should remain the same
    expect(app.get_by_text("Basic fragment UUID:")).not_to_have_text(fragment_uuid_text)
    expect(app.get_by_text("App UUID:")).to_have_text(app_uuid_text)

    # Click again to verify no accumulation
    app.get_by_role("button", name="Outside Button").click()
    wait_for_app_run(app)

    # Still exactly one button
    expect(app.get_by_role("button", name="Outside Button")).to_have_count(1)


def test_counter_widget_in_outside_container(app: Page):
    """Verify counter widget works correctly in an outside container."""
    # Initial count should be 0
    expect(app.get_by_text("Counter value: 0", exact=True)).to_be_visible()

    # Click increment button
    click_button(app, "Increment Counter")

    # Count should be 1, and only one counter display
    expect(app.get_by_text("Counter value: 1", exact=True)).to_be_visible()
    expect(app.get_by_text("Counter value: 0", exact=True)).not_to_be_visible()
    expect(app.get_by_role("button", name="Increment Counter")).to_have_count(1)

    # Click again
    click_button(app, "Increment Counter")

    # Count should be 2
    expect(app.get_by_text("Counter value: 2", exact=True)).to_be_visible()
    expect(app.get_by_role("button", name="Increment Counter")).to_have_count(1)


def test_multiple_widgets_in_outside_container(app: Page):
    """Verify multiple widgets in an outside container don't duplicate."""
    # Initial state: should have exactly one of each widget
    expect(app.get_by_label("Name")).to_have_count(1)
    expect(app.get_by_label("Color")).to_have_count(1)

    # Get initial UUID
    multi_uuid_text = app.get_by_text("Multi-element fragment UUID:").text_content()
    assert multi_uuid_text is not None

    # Interact with text input to trigger fragment rerun
    text_input = app.get_by_label("Name")
    text_input.fill("Test Name")
    text_input.press("Enter")
    wait_for_app_run(app)

    # Should still have exactly one of each widget
    expect(app.get_by_label("Name")).to_have_count(1)
    expect(app.get_by_label("Color")).to_have_count(1)

    # UUID should have changed
    expect(app.get_by_text("Multi-element fragment UUID:")).not_to_have_text(
        multi_uuid_text
    )


def test_nested_container_widget(app: Page):
    """Verify widgets in nested outside containers work correctly."""
    # Initial state: should have exactly one nested button
    nested_btn = app.get_by_role("button", name="Nested Button")
    expect(nested_btn).to_have_count(1)

    # Get initial UUID
    nested_uuid_text = app.get_by_text("Nested fragment UUID:").text_content()
    assert nested_uuid_text is not None

    # Click to trigger fragment rerun
    nested_btn.click()
    wait_for_app_run(app)

    # Should still have exactly one button
    expect(app.get_by_role("button", name="Nested Button")).to_have_count(1)

    # UUID should have changed
    expect(app.get_by_text("Nested fragment UUID:")).not_to_have_text(nested_uuid_text)


def test_full_rerun_clears_fragment_elements(app: Page):
    """Verify full rerun properly handles fragment elements in outside containers."""
    # Get initial UUIDs
    fragment_uuid_text = app.get_by_text("Basic fragment UUID:").text_content()
    app_uuid_text = app.get_by_text("App UUID:").text_content()
    assert fragment_uuid_text is not None
    assert app_uuid_text is not None

    # Trigger full rerun
    click_button(app, "Full Rerun")

    # Both UUIDs should change
    expect(app.get_by_text("Basic fragment UUID:")).not_to_have_text(fragment_uuid_text)
    expect(app.get_by_text("App UUID:")).not_to_have_text(app_uuid_text)

    # No element duplication
    expect(app.get_by_role("button", name="Outside Button")).to_have_count(1)
    expect(app.get_by_role("button", name="Increment Counter")).to_have_count(1)
    expect(app.get_by_role("button", name="Nested Button")).to_have_count(1)
