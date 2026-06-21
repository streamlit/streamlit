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


def test_grid_renders(app: Page):
    """Test that all grids render correctly."""
    grids = app.get_by_test_id("stGrid")
    expect(grids).to_have_count(5)


def test_auto_sizing_grid(app: Page):
    """Test that the auto-sizing grid contains metrics."""
    first_grid = app.get_by_test_id("stGrid").first
    # Check that metrics are inside the grid
    metrics = first_grid.get_by_test_id("stMetric")
    expect(metrics).to_have_count(4)


def test_grid_with_border(app: Page):
    """Test that the bordered grid has visible borders."""
    # Second grid has borders
    bordered_grid = app.get_by_test_id("stGrid").nth(1)
    # Verify grid contains content
    expect(bordered_grid).to_be_visible()


def test_grid_with_span(app: Page):
    """Test that grid with spanning cells renders correctly."""
    # Third grid has spanning
    span_grid = app.get_by_test_id("stGrid").nth(2)
    expect(span_grid).to_be_visible()
    # Check that span text is visible
    expect(span_grid.get_by_text("Spans 2 columns")).to_be_visible()


def test_grid_visual_snapshot(themed_app: Page, assert_snapshot: ImageCompareFunction):
    """Test grid visual appearance with snapshot."""
    # Take snapshot of the first grid (auto-sizing)
    first_grid = themed_app.get_by_test_id("stGrid").first
    assert_snapshot(first_grid, name="st_grid-auto_sizing")


def test_grid_with_border_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test bordered grid visual appearance."""
    bordered_grid = themed_app.get_by_test_id("stGrid").nth(1)
    assert_snapshot(bordered_grid, name="st_grid-bordered")


def test_grid_with_span_snapshot(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    """Test grid with span visual appearance."""
    span_grid = themed_app.get_by_test_id("stGrid").nth(2)
    assert_snapshot(span_grid, name="st_grid-span")
