# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_gracefully_handles_no_data(app: Page, assert_snapshot: ImageCompareFunction):
    charts = app.get_by_test_id("stArrowVegaLiteChart")
    expect(charts).to_have_count(4)

    for i in range(4):
        assert_snapshot(
            app.get_by_test_id("stArrowVegaLiteChart").nth(i),
            name=f"st_vega_lite_chart_empty-{i}",
        )

    # pyplot graph assertion
    assert app.get_by_test_id("stImage").locator("img").get_attribute("src") is not None


def test_handles_no_data_with_exception(app: Page):
    exception_messages = app.get_by_test_id("stException")
    expect(exception_messages).to_have_count(5)

    for i in range(4):
        expect(exception_messages.nth(i)).to_have_text(
            re.compile("ValueError: Vega-Lite charts require a non-empty spec dict.")
        )

    assert (
        "TypeError: ArrowAltairMixin.altair_chart() missing 1 required positional argument: 'altair_chart'"
        in exception_messages.nth(4).text_content()
    )
