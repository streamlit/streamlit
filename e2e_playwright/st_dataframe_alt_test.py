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


def test_dataframe_and_data_editor_accessible_names(app: Page):
    """Verify authored and omitted alt map to the grid host accessible name."""
    # Name lives on stDataFrameResizable (grid host under the toolbar), not the
    # outer stDataFrame wrapper that also hosts toolbar actions.
    grids = app.get_by_test_id("stDataFrameResizable")
    expect(grids).to_have_count(4)

    expect(grids.nth(0)).to_have_accessible_name("Top 20 customers by revenue")
    expect(grids.nth(0)).to_have_attribute("role", "region")

    expect(grids.nth(1)).to_have_accessible_name("")
    expect(grids.nth(1)).not_to_have_attribute("role", "region")

    expect(grids.nth(2)).to_have_accessible_name("Editable customer list")
    expect(grids.nth(2)).to_have_attribute("role", "region")

    expect(grids.nth(3)).to_have_accessible_name("")
    expect(grids.nth(3)).not_to_have_attribute("role", "region")
