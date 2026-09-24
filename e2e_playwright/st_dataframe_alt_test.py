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

from e2e_playwright.shared.app_utils import get_element_by_key


def test_dataframe_and_data_editor_accessible_names(app: Page):
    """Verify authored and omitted alt map to the grid host accessible name."""
    # Name lives on stDataFrameResizable (grid host under the toolbar), not the
    # outer stDataFrame wrapper that also hosts toolbar actions.
    labeled_df = get_element_by_key(app, "df_labeled").get_by_test_id(
        "stDataFrameResizable"
    )
    unlabeled_df = get_element_by_key(app, "df_unlabeled").get_by_test_id(
        "stDataFrameResizable"
    )
    labeled_editor = get_element_by_key(app, "editor_labeled").get_by_test_id(
        "stDataFrameResizable"
    )
    unlabeled_editor = get_element_by_key(app, "editor_unlabeled").get_by_test_id(
        "stDataFrameResizable"
    )

    expect(labeled_df).to_have_accessible_name("Top 20 customers by revenue")
    expect(labeled_df).to_have_attribute("role", "region")
    expect(app.get_by_role("region", name="Top 20 customers by revenue")).to_have_count(
        1
    )

    expect(unlabeled_df).to_have_accessible_name("")
    expect(unlabeled_df).not_to_have_attribute("role", "region")

    expect(labeled_editor).to_have_accessible_name("Editable customer list")
    expect(labeled_editor).to_have_attribute("role", "region")
    expect(app.get_by_role("region", name="Editable customer list")).to_have_count(1)

    expect(unlabeled_editor).to_have_accessible_name("")
    expect(unlabeled_editor).not_to_have_attribute("role", "region")
