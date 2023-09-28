# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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


def test_bokeh_chart(themed_app: Page):
    """Test that st.bokeh_chart renders correctly."""
    bokeh_chart_elements = themed_app.locator("[data-testid=stBokehChart]")
    expect(bokeh_chart_elements).to_have_count(4)

    expect(bokeh_chart_elements.nth(0).locator("canvas").nth(0)).to_be_visible()
    expect(bokeh_chart_elements.nth(1).locator("canvas").nth(0)).to_be_visible()
    expect(bokeh_chart_elements.nth(2).locator("canvas").nth(0)).to_be_visible()

    # show a bokeh slider
    expect(bokeh_chart_elements.nth(3).locator("canvas").nth(0)).to_be_visible()
