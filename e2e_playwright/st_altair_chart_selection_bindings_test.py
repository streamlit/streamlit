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

"""Altair bind widgets must not duplicate when on_select is enabled (#8765)."""

from typing import Literal

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.conftest import ImageCompareFunction
from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.vega_utils import get_vega_graphics_document


def _expect_vega_chart_ready(chart: Locator) -> None:
    expect(chart).to_be_visible()
    expect(get_vega_graphics_document(chart)).to_be_visible()


def _assert_single_region_bind(
    chart: Locator, *, role: Literal["radio", "combobox"], count: int
) -> None:
    """Region bind must appear once, not once per injected encoding."""
    expect(chart.get_by_text("Region:")).to_have_count(1)
    expect(chart.get_by_role(role)).to_have_count(count)


def test_binding_radio_not_duplicated_with_on_select(
    app: Page, assert_snapshot: ImageCompareFunction
):
    ignore_chart = get_element_by_key(app, "bind_radio_ignore")
    rerun_chart = get_element_by_key(app, "bind_radio_rerun")

    _expect_vega_chart_ready(ignore_chart)
    _expect_vega_chart_ready(rerun_chart)
    _assert_single_region_bind(ignore_chart, role="radio", count=3)
    _assert_single_region_bind(rerun_chart, role="radio", count=3)

    rerun_chart.get_by_role("radio", name="Europe").click()

    _assert_single_region_bind(rerun_chart, role="radio", count=3)
    expect(get_vega_graphics_document(rerun_chart)).to_be_visible()

    assert_snapshot(
        rerun_chart, name="st_altair_chart_selection_bindings-radio_on_select_rerun"
    )


def test_binding_select_not_duplicated_with_on_select(app: Page):
    select_chart = get_element_by_key(app, "bind_select_rerun")

    _expect_vega_chart_ready(select_chart)
    _assert_single_region_bind(select_chart, role="combobox", count=1)

    select_chart.get_by_role("combobox").select_option("Europe")

    _assert_single_region_bind(select_chart, role="combobox", count=1)
    expect(get_vega_graphics_document(select_chart)).to_be_visible()
