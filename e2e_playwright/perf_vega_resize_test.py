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

"""Performance test for Vega chart resize operations."""

import pytest
from playwright.sync_api import Page

from e2e_playwright.conftest import wait_for_app_run


@pytest.mark.performance
def test_vega_resize_performance(app: Page):
    """Measure Vega-Lite chart resize performance.

    The `app` fixture already opens the app and starts trace capture.
    The @pytest.mark.performance marker enables the autouse fixture that
    wraps the test in measure_performance() for CDP metrics.
    """
    # Wait for initial render
    app.wait_for_selector('[data-testid="stVegaLiteChart"]', timeout=10000)
    wait_for_app_run(app)
    app.wait_for_timeout(500)  # Allow charts to fully render

    # Get initial viewport
    viewport = app.viewport_size
    if viewport is None:
        viewport = {"width": 1280, "height": 720}

    # Perform resize operations - simulating window resize
    for width in range(viewport["width"], viewport["width"] - 300, -20):
        app.set_viewport_size({"width": width, "height": viewport["height"]})
        app.wait_for_timeout(16)  # ~60fps frame timing

    # Reset viewport
    app.set_viewport_size(viewport)
    wait_for_app_run(app)

    # Results are automatically saved to .benchmarks/playwright/
