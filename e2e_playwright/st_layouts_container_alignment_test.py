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
from e2e_playwright.shared.app_utils import (
    click_toggle,
    get_element_by_key,
    get_text_area,
)

# Match theme.sizes.defaultChartHeight (21.875rem) and defaultChartWidth (25rem).
DEFAULT_CHART_HEIGHT_PX = 350
DEFAULT_CHART_WIDTH_PX = 400
# Matches DEFAULT_PLOTLY_HEIGHT in PlotlyChart.tsx.
DEFAULT_PLOTLY_HEIGHT_PX = 450

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


def _expect_heights_match(
    app: Page, tallest: Locator, stretched: list[Locator]
) -> None:
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

    # A stretch-height text area fills the row and keeps its pixel width.
    stretch_text_area = get_text_area(app, "Stretch text area")
    _expect_heights_match(
        app,
        get_element_by_key(app, "stretch-height-input-tallest"),
        [stretch_text_area],
    )
    expect(stretch_text_area).to_have_css("width", "200px")

    # Content-height siblings keep their own height.
    def _content_card_is_shorter() -> bool:
        content_height = _height(content_card)
        tallest_height = _height(tallest)
        return (
            content_height is not None
            and tallest_height is not None
            and content_height < tallest_height
        )

    wait_until(app, _content_card_is_shorter)


def test_stretch_chart_default_height_in_horizontal_container(app: Page):
    """Stretch charts fall back to their default height and shrink back with the row."""
    fallback_chart = get_element_by_key(
        app, "container-horizontal-stretch-chart-fallback"
    ).get_by_test_id("stVegaLiteChart")
    # A short sibling doesn't squash the chart to the button height.
    expect(fallback_chart).to_have_css("height", f"{DEFAULT_CHART_HEIGHT_PX}px")

    # A content-width chart keeps its default width instead of collapsing.
    content_width_chart = get_element_by_key(
        app, "container-horizontal-content-width-chart"
    ).get_by_test_id("stVegaLiteChart")
    expect(content_width_chart).to_have_css("width", f"{DEFAULT_CHART_WIDTH_PX}px")
    expect(content_width_chart).to_have_css("height", f"{DEFAULT_CHART_HEIGHT_PX}px")

    # Plotly falls back to its default figure height.
    plotly_chart = get_element_by_key(
        app, "container-horizontal-stretch-plotly-fallback"
    ).get_by_test_id("stPlotlyChart")
    expect(plotly_chart).to_have_css("height", f"{DEFAULT_PLOTLY_HEIGHT_PX}px")

    shrink_row = get_element_by_key(app, "container-horizontal-stretch-chart-shrink")
    shrink_card = get_element_by_key(app, "stretch-chart-shrink-card")
    shrink_chart = shrink_row.get_by_test_id("stVegaLiteChart")
    _expect_heights_match(app, shrink_card, [shrink_chart])

    click_toggle(app, "Tall card")
    # The chart returns to its default height instead of keeping the height
    # of the tall card it rendered at.
    expect(shrink_chart).to_have_css("height", f"{DEFAULT_CHART_HEIGHT_PX}px")


def _wraps_content(locator: Locator) -> bool:
    """Whether the element's content fits without overflowing it."""
    # Allow 1px because scrollHeight and clientHeight round fractional heights
    # differently.
    return bool(locator.evaluate("el => el.scrollHeight - el.clientHeight <= 1"))


def test_stretch_charts_fit_containers_with_definite_height(app: Page):
    """Stretch charts shrink to fit their siblings in definite-height containers."""
    for key in ("fixed-card-title-and-chart", "fixed-row-stretch-kpi-cards"):
        container = get_element_by_key(app, key)
        charts = container.get_by_test_id("stVegaLiteChart")
        expect(charts.first).to_be_visible()

        def _charts_fit(
            container: Locator = container, charts: Locator = charts
        ) -> bool:
            heights = [_height(chart) for chart in charts.all()]
            return _wraps_content(container) and all(
                height is not None and 0 < height < DEFAULT_CHART_HEIGHT_PX
                for height in heights
            )

        # The container must not scroll because of the chart's default height.
        wait_until(app, _charts_fit)


def test_stretch_blocks_grow_in_fixed_height_parents(app: Page):
    """Stretch containers and forms grow past a fixed-height parent; tabs scroll."""
    form_parent = get_element_by_key(app, "fixed-parent-stretch-form")
    for block, parent in (
        (form_parent.get_by_test_id("stForm"), form_parent),
        (
            get_element_by_key(app, "stretch-card-overflow"),
            get_element_by_key(app, "fixed-row-stretch-card"),
        ),
    ):
        expect(block).to_be_visible()

        def _grows_past_parent(
            block: Locator = block, parent: Locator = parent
        ) -> bool:
            block_height = _height(block)
            parent_height = _height(parent)
            return (
                _wraps_content(block)
                and block_height is not None
                and parent_height is not None
                and block_height > parent_height
            )

        wait_until(app, _grows_past_parent)

    # Stretch tabs stay capped at the parent and scroll inside the panel.
    tab_panel = get_element_by_key(app, "fixed-parent-stretch-tabs").get_by_role(
        "tabpanel"
    )
    expect(tab_panel).to_be_visible()
    wait_until(
        app,
        lambda: bool(tab_panel.evaluate("el => el.scrollHeight > el.clientHeight")),
    )


def test_graphviz_and_text_area_keep_usable_size_in_rows(app: Page):
    """Graphviz and text areas keep a usable size in stretched horizontal rows."""
    graphviz = get_element_by_key(
        app, "container-horizontal-stretch-graphviz"
    ).get_by_test_id("stGraphVizChart")

    def _graphviz_has_natural_width() -> bool:
        box = graphviz.bounding_box()
        return box is not None and box["width"] > 100

    wait_until(app, _graphviz_has_natural_width)

    # The field stays as tall as its textarea instead of stretching into an
    # empty box with the resize handle in the middle.
    text_area_root = get_text_area(app, "Distribute text area").get_by_test_id(
        "stTextAreaRootElement"
    )
    textarea = text_area_root.locator("textarea")

    def _root_hugs_textarea() -> bool:
        root_height = _height(text_area_root)
        textarea_height = _height(textarea)
        return (
            root_height is not None
            and textarea_height is not None
            and root_height - textarea_height <= 2
        )

    wait_until(app, _root_hugs_textarea)


def test_checkbox_alignment_in_horizontal_container(app: Page):
    """Bottom-aligned rows use the same 8px checkbox and toggle margin as columns."""
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
