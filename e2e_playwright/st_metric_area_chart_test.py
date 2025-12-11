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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_metric


def test_area_chart_metric_renders(app: Page):
    """Test that the area chart metric renders correctly."""
    metric = get_metric(app, "Total Gzip Size")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("Total Gzip Size")
    expect(metric.get_by_test_id("stMetricValue")).to_contain_text("8.4")
    expect(metric.get_by_test_id("stMetricChart")).to_be_visible()


def test_line_area_bar_chart_comparison(app: Page):
    """Test that line, area, and bar charts are displayed side by side."""
    line_metric = get_metric(app, "Line Chart")
    area_metric = get_metric(app, "Area Chart")
    bar_metric = get_metric(app, "Bar Chart")

    expect(line_metric.get_by_test_id("stMetricChart")).to_be_visible()
    expect(area_metric.get_by_test_id("stMetricChart")).to_be_visible()
    expect(bar_metric.get_by_test_id("stMetricChart")).to_be_visible()


def test_zero_crossing_data_chart(app: Page):
    """Test that the zero-crossing data chart renders correctly."""
    metric = get_metric(app, "Zero-Crossing Data")
    expect(metric.get_by_test_id("stMetricLabel")).to_have_text("Zero-Crossing Data")
    expect(metric.get_by_test_id("stMetricValue")).to_have_text("100")
    expect(metric.get_by_test_id("stMetricDelta")).to_contain_text("150")
    expect(metric.get_by_test_id("stMetricChart")).to_be_visible()


def test_area_chart_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual snapshot of area chart metric."""
    metric = get_metric(themed_app, "Total Gzip Size")
    assert_snapshot(metric, name="st_metric_area_chart-default")


def test_zero_crossing_chart_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test visual snapshot of zero-crossing data chart."""
    metric = get_metric(themed_app, "Zero-Crossing Data")
    assert_snapshot(metric, name="st_metric_area_chart-zero_crossing")
