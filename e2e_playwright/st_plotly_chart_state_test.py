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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_until
from e2e_playwright.shared.app_utils import (
    click_button,
    click_checkbox,
    get_element_by_key,
)


def test_identical_passive_unkeyed_charts_render(app: Page):
    charts = app.get_by_test_id("stPlotlyChart")

    # Three unkeyed passive charts plus the keyed restore chart.
    expect(charts).to_have_count(4)
    for index in range(4):
        expect(charts.nth(index)).to_be_visible()


def test_passive_unkeyed_chart_updates_without_remounting(app: Page):
    chart = app.get_by_test_id("stPlotlyChart").nth(2)
    chart.evaluate("element => { element.dataset.instanceMarker = 'stable' }")

    click_button(app, "Update chart")

    expect(chart).to_have_attribute("data-instance-marker", "stable")
    plot = chart.locator(".js-plotly-plot")
    expect(plot).to_be_visible()
    wait_until(app, lambda: plot.evaluate("element => element.data[0].y") == [2, 3, 4])


def test_keyed_chart_restores_frontend_state_after_remount(app: Page):
    chart = get_element_by_key(app, "restore_chart")
    plot = chart.locator(".js-plotly-plot")
    expect(plot).to_be_visible()

    # Hide the second trace by clicking its legend entry. This is a real user
    # interaction that changes the chart's frontend state. Plotly overlays a
    # transparent toggle rect on top of the legend text, so target it directly.
    chart.locator(".traces").filter(has_text="Trace B").locator(".legendtoggle").click()
    wait_until(
        app, lambda: plot.evaluate("element => element.data[1].visible") == "legendonly"
    )

    # Mark the current DOM instance so we can confirm the chart actually
    # remounts (and does not merely keep a live, never-unmounted instance).
    chart.evaluate("element => { element.dataset.instanceMarker = 'before' }")

    # Move the chart to the other container to force a genuine unmount/remount.
    click_checkbox(app, "Move keyed chart")

    remounted_chart = get_element_by_key(app, "restore_chart")
    expect(remounted_chart).not_to_have_attribute("data-instance-marker", "before")
    remounted_plot = remounted_chart.locator(".js-plotly-plot")
    expect(remounted_plot).to_be_visible()

    # The recovered frontend state keeps the second trace hidden, while the
    # first trace must stay visible (only the intended state was restored).
    wait_until(
        app,
        lambda: (
            remounted_plot.evaluate("element => element.data[1].visible")
            == "legendonly"
        ),
    )
    assert remounted_plot.evaluate("element => element.data[0].visible") != "legendonly"
