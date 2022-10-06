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

"""Unit test of dg._arrow_add_rows()."""

import pandas as pd

import streamlit as st
from streamlit.type_util import bytes_to_data_frame
from tests import testutil

DATAFRAME = pd.DataFrame({"a": [1], "b": [10]})
NEW_ROWS = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
MELTED_DATAFRAME = pd.DataFrame(
    {
        "index": [1, 2, 3, 1, 2, 3],
        "variable": ["a", "a", "a", "b", "b", "b"],
        "value": [1, 2, 3, 4, 5, 6],
    }
)


class DeltaGeneratorAddRowsTest(testutil.DeltaGeneratorTestCase):
    """Test dg._arrow_add_rows."""

    def _get_deltas_that_melt_dataframes(self):
        return [
            lambda df: st._arrow_line_chart(df),
            lambda df: st._arrow_bar_chart(df),
            lambda df: st._arrow_area_chart(df),
        ]

    def test_deltas_that_melt_dataframes(self):
        deltas = self._get_deltas_that_melt_dataframes()

        for delta in deltas:
            element = delta(DATAFRAME)
            element._arrow_add_rows(NEW_ROWS)

            proto = bytes_to_data_frame(
                self.get_delta_from_queue().arrow_add_rows.data.data
            )

            pd.testing.assert_frame_equal(proto, MELTED_DATAFRAME)
