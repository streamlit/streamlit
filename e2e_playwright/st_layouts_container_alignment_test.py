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

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction, wait_until
from e2e_playwright.shared.app_utils import get_element_by_key

CONTAINER_KEYS = [
    "container-horizontal-align-left",
    "container-horizontal-align-center",
    "container-horizontal-align-right",
    "container-horizontal-align-distribute",
    "container-horizontal-vertical-align-top",
    "container-horizontal-vertical-align-center",
    "container-horizontal-vertical-align-bottom",
    "container-vertical-vertical-align-top",
    "container-vertical-vertical-align-center",
    "container-vertical-vertical-align-bottom",
    "container-vertical-vertical-align-distribute",
    "container-vertical-horizontal-align-left",
    "container-vertical-horizontal-align-center",
    "container-vertical-horizontal-align-right",
    "container-horizontal-centered-elements",
]


def _height(locator: Locator) -> int | None:
    box = locator.bounding_box()
    return round(box["height"]) if box else None


def test_layouts_container_alignment(app: Page, assert_snapshot: ImageCompareFunction):
    """Snapshot test for each top-level container in st_layouts_container_alignment.py."""
    for key in CONTAINER_KEYS:
        locator = get_element_by_key(app, key)
        assert_snapshot(locator, name=f"st_layouts_container_alignment-{key}")


def _expect_heights_match(app: Page, tallest: Locator, stretched: list[Locator]):
    def _heights_match() -> bool:
        tallest_height = _height(tallest)
        return bool(tallest_height) and all(
            _height(locator) == tallest_height for locator in stretched
        )

    wait_until(app, _heights_match)


def test_stretch_height_in_horizontal_container(app: Page):
    """Stretch-height children grow to the tallest element in their row."""
    row = get_element_by_key(app, "container-horizontal-stretch-height")
    tallest = get_element_by_key(app, "stretch-height-tallest")
    stretch_metric = row.get_by_test_id("stMetric")
    content_card = get_element_by_key(app, "stretch-height-content-card")
    expect(stretch_metric).to_be_visible()
    _expect_heights_match(
        app, tallest, [get_element_by_key(app, "stretch-height-card"), stretch_metric]
    )

    # The chart and the dataframe size themselves from their container.
    data_row = get_element_by_key(app, "container-horizontal-stretch-height-data")
    chart_and_dataframe = data_row.get_by_test_id("stFullScreenFrame")
    expect(chart_and_dataframe).to_have_count(2)
    _expect_heights_match(
        app,
        get_element_by_key(app, "stretch-height-data-tallest"),
        chart_and_dataframe.all(),
    )

    # Content-height siblings keep their own height.
    content_height = _height(content_card)
    tallest_height = _height(tallest)
    assert content_height is not None
    assert tallest_height is not None
    assert content_height < tallest_height


def test_checkbox_alignment_in_horizontal_container(app: Page):
    """Bottom-aligned rows lift checkboxes and toggles to the input field center."""
    bottom_row = get_element_by_key(app, "container-horizontal-bottom-checkboxes")
    bottom_checkboxes = bottom_row.get_by_test_id("stCheckbox")
    expect(bottom_checkboxes).to_have_count(2)
    for index in range(2):
        expect(bottom_checkboxes.nth(index)).to_have_css("margin-bottom", "8px")

    # The default top alignment must not pick up the margin.
    top_checkbox = get_element_by_key(
        app, "container-horizontal-top-checkboxes"
    ).get_by_test_id("stCheckbox")
    expect(top_checkbox).to_have_css("margin-bottom", "0px")
    expect(top_checkbox).to_have_css("margin-top", "0px")
