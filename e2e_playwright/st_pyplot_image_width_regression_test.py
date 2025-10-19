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

"""Tests for pyplot/image width regression in v1.50.0.

Related issues:
- #12678: Plots shown tiny in fragments
- #12763: Images shown tiny with expanders

This test ensures plots/images render at proper width across different width modes
(default/stretch and content) and contexts (fragments, expanders, containers).
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.parametrize(
    ("width_mode", "context", "test_index"),
    [
        ("default", "fragment", 0),
        ("content", "fragment", 1),
        ("default", "expander", 2),
        ("content", "expander", 3),
        ("default", "container", 4),
        ("content", "container", 5),
    ],
)
def test_pyplot_width_in_context(
    app: Page, width_mode: str, context: str, test_index: int
):
    """Test pyplot width calculation across width modes and contexts.

    Regression test for #12678 and #12763 where plots rendered at minimum width
    in fragments, expanders, and containers when no explicit width was set.

    This test verifies that both width modes work correctly:
    - default: No width parameter (uses stretch/legacy behavior)
    - content: Explicit width="content" parameter

    In all contexts: fragments, expanders, containers.

    The bug manifested as plots rendering at minimum width (~16px) on initial load
    due to incorrect width calculation when the parent container had width: auto.
    The fix ensures parent containers use width: 100% for default/stretch mode.

    Args:
        width_mode: The width configuration mode ('default' or 'content')
        context: The rendering context ('fragment', 'expander', or 'container')
        test_index: The index of this test case (0-5)
    """
    pyplot_elements = app.get_by_test_id("stImage")

    # Get the pyplot element for this test
    pyplot_element = pyplot_elements.nth(test_index)

    # Wait for element to be visible
    expect(pyplot_element).to_be_visible()

    # Get the bounding box to check actual rendered width
    bbox = pyplot_element.bounding_box()
    assert bbox is not None, (
        f"pyplot element (test {test_index}) should have dimensions"
    )

    # Verify width is reasonable (not at minimum width)
    # Using 200px as threshold - well above minimum (16px) but below typical
    # container width. The actual width will depend on container size and
    # width mode, but should never be tiny.
    assert bbox["width"] > 200, (
        f"pyplot with width='{width_mode}' in {context} is too small: {bbox['width']}px. "
        f"Expected > 200px. This suggests the width regression bug."
    )


def test_all_pyplot_elements_present(app: Page):
    """Test that all 6 pyplot elements are present and visible."""
    pyplot_elements = app.get_by_test_id("stImage")

    # Should have 6 pyplot elements total (2 width modes x 3 contexts)
    expect(pyplot_elements).to_have_count(6)

    # All should be visible
    for i in range(6):
        expect(pyplot_elements.nth(i)).to_be_visible()
