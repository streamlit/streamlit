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
import pyarrow as pa

import streamlit as st
from streamlit.elements.lib.column_config_utils import determine_dataframe_schema
from streamlit.elements.widgets.data_editor import _apply_row_additions
from tests.delta_generator_test_case import DeltaGeneratorTestCase


@patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
class DataEditorMultiselectTest(DeltaGeneratorTestCase):
    """Unit tests for _apply_row_additions with list-type cells."""

    def test_apply_row_additions_with_data_editor_integration(self):
        """_apply_row_additions should correctly add rows when using a real DataEditor setup."""

        df = pd.DataFrame(
            {
                "category": [
                    ["exploration", "visualization"],
                    ["llm", "visualization"],
                    ["exploration"],
                ],
                "is_active": [True, True, True],
            }
        )

        st.data_editor(
            df,
            hide_index=True,
            num_rows="dynamic",
            key="data_editor_key",
            column_config={
                "category": st.column_config.MultiselectColumn(
                    "App Categories",
                    help="The categories of the app",
                    options=["exploration", "visualization", "llm"],
                ),
                "is_active": st.column_config.CheckboxColumn(
                    "Active",
                    help="Tick to include this app in the analysis.",
                    default=True,
                    required=True,
                ),
            },
        )

        added_rows = [{"category": ["llm"], "is_active": True}]
        arrow_table = pa.Table.from_pandas(df)
        dataframe_schema = determine_dataframe_schema(df, arrow_table.schema)

        _apply_row_additions(df, added_rows, dataframe_schema)

        expected = [
            ["exploration", "visualization"],
            ["llm", "visualization"],
            ["exploration"],
            ["llm"],
        ]
        assert df["category"].tolist() == expected
        assert df["is_active"].tolist() == [True, True, True, True]
