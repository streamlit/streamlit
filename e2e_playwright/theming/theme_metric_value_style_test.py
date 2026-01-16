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

"""E2E tests for metricValueFontSize and metricValueFontWeight theme options."""

import os

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import expect_no_skeletons, get_metric


@pytest.fixture(scope="module")
@pytest.mark.early
def configure_metric_value_style():
    """Configure custom metric value font size (using rem) and weight."""
    os.environ["STREAMLIT_THEME_METRIC_VALUE_FONT_SIZE"] = "3rem"
    os.environ["STREAMLIT_THEME_METRIC_VALUE_FONT_WEIGHT"] = "300"
    yield
    del os.environ["STREAMLIT_THEME_METRIC_VALUE_FONT_SIZE"]
    del os.environ["STREAMLIT_THEME_METRIC_VALUE_FONT_WEIGHT"]


@pytest.mark.usefixtures("configure_metric_value_style")
def test_metric_value_font_size_with_rem(app: Page):
    """Test that metricValueFontSize accepts rem values and applies them correctly."""
    expect_no_skeletons(app, timeout=25000)

    metric = get_metric(app, "Revenue")
    metric_value = metric.get_by_test_id("stMetricValue")

    # Verify rem value is converted and applied correctly (3rem = 48px with 16px base)
    expect(metric_value).to_have_css("font-size", "48px")

    # Verify custom font weight is applied (300)
    expect(metric_value).to_have_css("font-weight", "300")

    # Verify it's NOT the default size (2.25rem = 36px)
    expect(metric_value).not_to_have_css("font-size", "36px")


@pytest.mark.usefixtures("configure_metric_value_style")
def test_metric_value_style_snapshot(app: Page, assert_snapshot: ImageCompareFunction):
    """Visual snapshot test for custom metric value styling."""
    expect_no_skeletons(app, timeout=25000)
    # Wait for fonts to load to reduce flakiness
    app.wait_for_timeout(5000)

    metric = get_metric(app, "Revenue")
    assert_snapshot(metric, name="metric_value_custom_style")
