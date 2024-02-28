# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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


def test_alerts_rendering(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test that alerts render correctly using snapshot testing."""
    alert_elements = themed_app.get_by_test_id("stAlert")
    expect(alert_elements).to_have_count(16)

    # The first 4 alerts are super basic, no need to screenshot test those
    expect(alert_elements.nth(0)).to_have_text("This is an error")
    expect(alert_elements.nth(1)).to_have_text("This is a warning")
    expect(alert_elements.nth(2)).to_have_text("This is an info message")
    expect(alert_elements.nth(3)).to_have_text("This is a success message")

    assert_snapshot(alert_elements.nth(4), name="st_alert-error_icon")
    assert_snapshot(alert_elements.nth(5), name="st_alert-warning_icon")
    assert_snapshot(alert_elements.nth(6), name="st_alert-info_icon")
    assert_snapshot(alert_elements.nth(7), name="st_alert-success_icon")

    assert_snapshot(alert_elements.nth(8), name="st_alert-error_line_wrapping_1")
    assert_snapshot(alert_elements.nth(9), name="st_alert-error_line_wrapping_2")

    assert_snapshot(alert_elements.nth(10), name="st_alert-error_markdown")
    assert_snapshot(alert_elements.nth(11), name="st_alert-warning_markdown")
    assert_snapshot(alert_elements.nth(12), name="st_alert-info_markdown")
    assert_snapshot(alert_elements.nth(13), name="st_alert-success_markdown")

    assert_snapshot(alert_elements.nth(14), name="st_alert-error_long_code")
    assert_snapshot(alert_elements.nth(15), name="st_alert-success_long_code")
