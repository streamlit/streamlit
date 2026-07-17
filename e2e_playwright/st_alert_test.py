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

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import check_top_level_class


def test_alerts_rendering_themed(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that alerts render correctly with theme-dependent styling."""
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(36)

    # The first 4 alerts are super basic, no need to screenshot test those
    expect(alert_elements.nth(0)).to_have_text("This is an error")
    expect(alert_elements.nth(1)).to_have_text("This is a warning")
    expect(alert_elements.nth(2)).to_have_text("This is an info message")
    expect(alert_elements.nth(3)).to_have_text("This is a success message")

    # Alert icons (colors differ by theme)
    assert_snapshot(alert_elements.nth(4), name="st_alert-error_icon")
    assert_snapshot(alert_elements.nth(5), name="st_alert-warning_icon")
    assert_snapshot(alert_elements.nth(6), name="st_alert-info_icon")
    assert_snapshot(alert_elements.nth(7), name="st_alert-success_icon")

    # Markdown alerts (markdown colors differ by theme)
    assert_snapshot(alert_elements.nth(10), name="st_alert-error_markdown")
    assert_snapshot(alert_elements.nth(11), name="st_alert-warning_markdown")
    assert_snapshot(alert_elements.nth(12), name="st_alert-info_markdown")
    assert_snapshot(alert_elements.nth(13), name="st_alert-success_markdown")

    # Custom icons (icon rendering may differ by theme)
    assert_snapshot(alert_elements.nth(16), name="st_alert-error_non_emoji_icon")
    assert_snapshot(alert_elements.nth(17), name="st_alert-warning_non_emoji_icon")
    assert_snapshot(alert_elements.nth(18), name="st_alert-info_non_emoji_icon")
    assert_snapshot(alert_elements.nth(19), name="st_alert-success_non_emoji_icon")

    # Alert with heading (heading colors differ by theme)
    assert_snapshot(alert_elements.nth(20), name="st_alert-error_with_heading")

    # Icon extraction from body (icon rendering differs by theme)
    # Verify emoji is extracted from body and body text is updated
    emoji_alert = alert_elements.nth(32)
    assert_snapshot(emoji_alert, name="st_alert-warning_emoji_from_body")
    expect(emoji_alert.locator('[data-testid="stMarkdownContainer"]')).to_have_text(
        "This warning has an emoji icon extracted from body"
    )

    # Verify material icon is extracted from body and body text is updated
    material_icon_alert = alert_elements.nth(33)
    assert_snapshot(material_icon_alert, name="st_alert-info_material_icon_from_body")
    expect(
        material_icon_alert.locator('[data-testid="stMarkdownContainer"]')
    ).to_have_text("This info has a material icon extracted from body")


def test_alerts_rendering_layout(app: Page, assert_snapshot: ImageCompareFunction):
    """Test that alerts layout variations render correctly (theme-independent)."""
    alert_elements = app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(36)

    # Line wrapping (layout behavior)
    assert_snapshot(alert_elements.nth(8), name="st_alert-error_line_wrapping_1")
    assert_snapshot(alert_elements.nth(9), name="st_alert-error_line_wrapping_2")

    # Long code blocks (layout/overflow behavior)
    assert_snapshot(alert_elements.nth(14), name="st_alert-error_long_code")
    assert_snapshot(alert_elements.nth(15), name="st_alert-success_long_code")

    # Width="stretch" alerts (layout property)
    assert_snapshot(alert_elements.nth(22), name="st_alert-error_width_stretch")
    assert_snapshot(alert_elements.nth(23), name="st_alert-warning_width_stretch")
    assert_snapshot(alert_elements.nth(24), name="st_alert-info_width_stretch")
    assert_snapshot(alert_elements.nth(25), name="st_alert-success_width_stretch")

    # Width=200 alerts (layout property)
    assert_snapshot(alert_elements.nth(26), name="st_alert-error_width_200")
    assert_snapshot(alert_elements.nth(27), name="st_alert-warning_width_200")
    assert_snapshot(alert_elements.nth(28), name="st_alert-info_width_200")
    assert_snapshot(alert_elements.nth(29), name="st_alert-success_width_200")

    # Width with icon (layout property)
    assert_snapshot(alert_elements.nth(30), name="st_alert-error_width_stretch_icon")
    assert_snapshot(alert_elements.nth(31), name="st_alert-info_width_200_icon")


def test_check_top_level_class(app: Page):
    """Check that the top level class is correctly set."""
    check_top_level_class(app, "stAlert")


def test_material_symbol_from_latest_font_version_rendering(
    app: Page, assert_snapshot: ImageCompareFunction
):
    """Test that icon from latest version material symbols font renders correctly."""
    alert_elements = app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(36)

    assert_snapshot(
        alert_elements.nth(21),
        name="st_alert-latest_material_symbol",
        # Make sure we always detect changes in the icon.
        image_threshold=0.001,
        pixel_threshold=0.025,
    )


def test_alert_title_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that alerts with title parameter render correctly."""
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(36)

    # Locate title alerts by their stable title text instead of fixture order.
    success_with_title = alert_elements.filter(
        has=themed_app.get_by_test_id("stAlertTitle").get_by_text("Success")
    )
    expect(success_with_title).to_have_count(1)
    expect(success_with_title.get_by_test_id("stAlertTitle")).to_contain_text("Success")
    assert_snapshot(success_with_title, name="st_alert-success_with_title")

    # Alert with title and icon
    info_with_title_and_icon = alert_elements.filter(
        has=themed_app.get_by_test_id("stAlertTitle").get_by_text("Notice", exact=True)
    )
    expect(info_with_title_and_icon).to_have_count(1)
    expect(info_with_title_and_icon.get_by_test_id("stAlertTitle")).to_have_text(
        "Notice"
    )
    expect(
        info_with_title_and_icon.get_by_test_id("stAlertDynamicIcon")
    ).to_be_visible()
    assert_snapshot(info_with_title_and_icon, name="st_alert-info_with_title_and_icon")


def test_alert_without_title_has_no_title_element(app: Page):
    """Test that alerts without title do not render a title element."""
    alert_elements = app.get_by_test_id("stAlert")

    # First alert has no title
    first_alert = alert_elements.nth(0)
    expect(first_alert.get_by_test_id("stAlertTitle")).not_to_be_attached()
