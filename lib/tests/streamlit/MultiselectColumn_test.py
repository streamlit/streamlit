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

from unittest.mock import MagicMock, patch

import pandas as pd

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class DataEditorMultiselectTest(DeltaGeneratorTestCase):
    """Tests for DataEditor MultiselectColumn bug."""

    def test_multiselect_column_with_list_values(self):
        """Ensure DataEditor renders correctly with list-of-list column."""
        data_df = pd.DataFrame(
            {
                "category": [
                    ["a", "b"],
                    ["b", "c"],
                    ["a"],
                ],
            }
        )

        st.data_editor(
            data_df,
            hide_index=True,
            num_rows="dynamic",
            key="data_editor_key",
            column_config={
                "category": st.column_config.MultiselectColumn(
                    "Categories",
                    options=["a", "b", "c"],
                ),
            },
        )

        last_delta = self.get_delta_from_queue()
        assert last_delta is not None
        assert last_delta.new_element.WhichOneof("type") == "arrow_data_frame"
