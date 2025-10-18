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

This test ensures plots/images render at proper width in fragments,
containers, and expanders, not at tiny sizes like 16px.
"""

from playwright.sync_api import Page, expect


def test_pyplot_in_fragment_width(app: Page):
    """Test that pyplot in fragment renders at reasonable width (not tiny).

    Regression test for #12678 where plots rendered very small (16px)
    in fragments on initial load.
    """
    # Get all pyplot elements
    pyplot_elements = app.get_by_test_id("stImage")

    # First pyplot is in a fragment (Test 1)
    first_pyplot = pyplot_elements.first

    # Wait for element to be visible
    expect(first_pyplot).to_be_visible()

    # Get the bounding box to check actual rendered width
    bbox = first_pyplot.bounding_box()
    assert bbox is not None, "pyplot element should have dimensions"

    # Width should be reasonable, not tiny (16px as mentioned in #12763)
    # A full-width or content-width plot should be at least 200px wide
    assert bbox["width"] > 200, (
        f"pyplot in fragment is too small: {bbox['width']}px. "
        "Expected > 200px. This suggests the width regression bug from #12678."
    )


def test_pyplot_in_fragment_with_workaround(app: Page):
    """Test that width='content' workaround works in fragments."""
    pyplot_elements = app.get_by_test_id("stImage")

    # Second pyplot has width="content" workaround (Test 2)
    second_pyplot = pyplot_elements.nth(1)

    expect(second_pyplot).to_be_visible()

    bbox = second_pyplot.bounding_box()
    assert bbox is not None

    # With workaround, should definitely have proper width
    assert bbox["width"] > 200, (
        f"pyplot with width='content' is too small: {bbox['width']}px. "
        "The workaround should ensure proper width rendering."
    )


def test_pyplot_in_expander_width(app: Page):
    """Test that pyplot in expander renders at reasonable width.

    Regression test for #12763 where images displayed small in expanders.
    """
    pyplot_elements = app.get_by_test_id("stImage")

    # Third pyplot is in an expander (Test 3)
    third_pyplot = pyplot_elements.nth(2)

    expect(third_pyplot).to_be_visible()

    bbox = third_pyplot.bounding_box()
    assert bbox is not None

    assert bbox["width"] > 200, (
        f"pyplot in expander is too small: {bbox['width']}px. "
        "Expected > 200px. This suggests the width regression bug from #12763."
    )


def test_pyplot_in_expander_with_workaround(app: Page):
    """Test that width='content' workaround works in expanders."""
    pyplot_elements = app.get_by_test_id("stImage")

    # Fourth pyplot has width="content" in expander (Test 4)
    fourth_pyplot = pyplot_elements.nth(3)

    expect(fourth_pyplot).to_be_visible()

    bbox = fourth_pyplot.bounding_box()
    assert bbox is not None

    assert bbox["width"] > 200, (
        f"pyplot in expander with width='content' is too small: {bbox['width']}px"
    )


def test_pyplot_in_container_width(app: Page):
    """Test that pyplot in container renders at reasonable width.

    Related to #12678 where containers also showed width issues.
    """
    pyplot_elements = app.get_by_test_id("stImage")

    # Fifth pyplot is in a container (Test 5)
    fifth_pyplot = pyplot_elements.nth(4)

    expect(fifth_pyplot).to_be_visible()

    bbox = fifth_pyplot.bounding_box()
    assert bbox is not None

    assert bbox["width"] > 200, (
        f"pyplot in container is too small: {bbox['width']}px. Expected > 200px."
    )


def test_all_pyplot_elements_present(app: Page):
    """Test that all 5 pyplot elements are present and visible."""
    pyplot_elements = app.get_by_test_id("stImage")

    # Should have 5 pyplot elements total
    expect(pyplot_elements).to_have_count(5)

    # All should be visible
    for i in range(5):
        expect(pyplot_elements.nth(i)).to_be_visible()
