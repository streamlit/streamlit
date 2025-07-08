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

from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.toolbar_utils import (
    assert_fullscreen_toolbar_button_interactions,
)


def test_vega_lite_chart_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test fullscreen open/close for the vega_lite_chart in the first container."""
    # The first vega_lite_chart on the page
    assert_fullscreen_toolbar_button_interactions(
        app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stVegaLiteChart",
        filename_prefix="st_layouts_container_directions_fullscreen_elements-vega_lite_chart",
        nth=0,
    )


def test_dataframe_fullscreen(app: Page, assert_snapshot: ImageCompareFunction):
    """Test fullscreen open/close for the dataframe in the second container."""
    # The first dataframe on the page (in the second container)
    assert_fullscreen_toolbar_button_interactions(
        app,
        assert_snapshot=assert_snapshot,
        widget_test_id="stDataFrame",
        filename_prefix="st_layouts_container_directions_fullscreen_elements-dataframe",
        nth=0,
    )
