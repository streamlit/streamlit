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
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api._generated import Locator


def get_vega_graphics_document(chart: Locator) -> Locator:
    """Return the Vega "graphics-document" element(s) for a chart.

    Vega-embed sets ``role="graphics-document"`` on the chart container
    (``stVegaLiteChart``) itself once the chart has rendered. This resolves that
    element whether ``chart`` is the container itself or an ancestor of it, and
    matches every chart when ``chart`` resolves to multiple containers.

    Parameters
    ----------
    chart : Locator
        A locator resolving to one or more chart containers, or an ancestor of
        them (e.g. the element returned by ``get_element_by_key``).

    Returns
    -------
    Locator
        The matching ``graphics-document`` element(s).
    """
    return chart.locator("xpath=descendant-or-self::*[@role='graphics-document']")


def assert_vega_chart_height(
    vega_chart: Locator,
    expected_height: int,
    description: str | None = None,
    tolerance: int = 0,
):
    bbox = get_vega_graphics_document(vega_chart).bounding_box()

    chart_info = f" ({description})" if description else ""
    assert bbox is not None, f"Vega chart{chart_info} has no bounding box"

    actual_height = round(bbox["height"])
    height_diff = abs(actual_height - expected_height)
    assert height_diff <= tolerance, (
        f"Vega chart{chart_info} height mismatch: "
        f"expected {expected_height}px, got {actual_height}px "
        f"(diff: {actual_height - expected_height}px, tolerance: {tolerance}px)"
    )


def assert_vega_chart_width(
    vega_chart: Locator,
    expected_width: int,
    description: str | None = None,
    tolerance: int = 0,
):
    bbox = get_vega_graphics_document(vega_chart).bounding_box()

    chart_info = f" ({description})" if description else ""
    assert bbox is not None, f"Vega chart{chart_info} has no bounding box"

    actual_width = round(bbox["width"])
    width_diff = abs(actual_width - expected_width)
    assert width_diff <= tolerance, (
        f"Vega chart{chart_info} width mismatch: "
        f"expected {expected_width}px, got {actual_width}px "
        f"(diff: {actual_width - expected_width}px, tolerance: {tolerance}px)"
    )
