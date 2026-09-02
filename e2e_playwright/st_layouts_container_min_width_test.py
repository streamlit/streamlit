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

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.react18_utils import wait_for_react_stability

REDUCED_VIEWPORT_WIDTH = 390

CONTAINER_KEYS = [
    "layout-horizontal-markdown",
    "layout-horizontal-buttons",
    "layout-horizontal-inputs",
    "layout-horizontal-checkboxes",
    "layout-horizontal-text-area-info",
    "layout-horizontal-dataframes",
    "layout-horizontal-nested-containers",
    "layout-horizontal-columns",
    "layout-horizontal-button-groups",
    "layout-horizontal-line-charts",
]


@pytest.mark.parametrize("container_key", CONTAINER_KEYS)
def test_container_regular_viewport(
    app: Page, assert_snapshot: ImageCompareFunction, container_key: str
):
    """Test container layouts at regular screen width."""
    container_element = get_element_by_key(app, container_key)
    assert_snapshot(
        container_element,
        name=f"st_layouts_container_min_width-{container_key.replace('layout-horizontal-', '')}_regular",
    )


@pytest.mark.parametrize("container_key", CONTAINER_KEYS)
def test_container_reduced_viewport(
    app: Page, assert_snapshot: ImageCompareFunction, container_key: str
):
    """Test container layouts at the reduced mobile viewport."""
    app.set_viewport_size({"width": REDUCED_VIEWPORT_WIDTH, "height": 844})
    app.wait_for_function(f"() => window.innerWidth <= {REDUCED_VIEWPORT_WIDTH}")
    # The new width reaches React through a ResizeObserver throttled to 100ms.
    # The throttle fires on the leading edge, so when the resize produces more
    # than one notification the first (intermediate) width is rendered and the
    # real one only arrives with the trailing call 100ms later. Canvas-backed
    # elements repaint from that second render, and because their boxes are
    # already at the final size throughout, Playwright's screenshot stability
    # check cannot see the stale pixels. Without waiting for the re-render, the
    # dataframe and chart containers intermittently snapshot columns and axes
    # still sized for the wide viewport.
    wait_for_react_stability(app)
    container_element = get_element_by_key(app, container_key)
    assert_snapshot(
        container_element,
        name=f"st_layouts_container_min_width-{container_key.replace('layout-horizontal-', '')}_reduced",
    )
