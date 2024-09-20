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
from playwright.sync_api import Page, expect

from e2e_playwright.shared.dataframe_utils import click_on_cell


def test_data_editor_datetime_input_min_max_respects_timezone(app: Page):
    """Test that st.data_editor datetime input respects min/max values and timezone."""
    dataframe = app.get_by_test_id("stDataFrame")

    click_on_cell(dataframe, 1, 1, "medium", True, True)

    date_picker_cell = app.get_by_test_id("date-picker-cell")

    expect(date_picker_cell).to_have_attribute("min", "2024-01-01T00:00:00.000")
    expect(date_picker_cell).to_have_attribute("max", "2024-01-02T00:00:00.000")
