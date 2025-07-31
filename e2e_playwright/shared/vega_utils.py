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

from playwright.sync_api._generated import Locator


def assert_vega_chart_height(vega_chart: Locator, expected_height: int):
    vega_graphics_doc = vega_chart.locator("[role='graphics-document']")
    bbox = vega_graphics_doc.bounding_box()

    assert bbox is not None
    assert round(bbox["height"]) == expected_height


def assert_vega_chart_width(vega_chart: Locator, expected_width: int):
    vega_graphics_doc = vega_chart.locator("[role='graphics-document']")
    bbox = vega_graphics_doc.bounding_box()

    assert bbox is not None
    assert round(bbox["width"]) == expected_width
