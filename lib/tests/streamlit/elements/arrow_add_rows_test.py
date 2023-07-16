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
from tests.delta_generator_test_case import DeltaGeneratorTestCase

DATAFRAME = pd.DataFrame({"a": [10], "b": [20], "c": [30]})
NEW_ROWS = pd.DataFrame({"a": [11, 12, 13], "b": [21, 22, 23], "c": [31, 32, 33]})


class DeltaGeneratorAddRowsTest(DeltaGeneratorTestCase):
    """Test dg._arrow_add_rows."""

    def test_charts_with_defaults(self):
        deltas = [
            lambda df: st._arrow_line_chart(df),
            lambda df: st._arrow_bar_chart(df),
            lambda df: st._arrow_area_chart(df),
            lambda df: st._arrow_scatter_chart(df),
        ]

        expected = pd.DataFrame(
            {
                "a": [11, 12, 13],
                "b": [21, 22, 23],
                "c": [31, 32, 33],
                "index-4FLV4aXfCWIrl1KyIeJp": [1, 2, 3],
            }
        )

        for delta in deltas:
            element = delta(DATAFRAME)
            element._arrow_add_rows(NEW_ROWS)

            proto = bytes_to_data_frame(
                self.get_delta_from_queue().arrow_add_rows.data.data
            )

            pd.testing.assert_frame_equal(proto, expected)

    def test_charts_with_args(self):
        deltas = [
            lambda df: st._arrow_line_chart(
                df, x="b", y=["a", "c"], color=["red", "orange"]
            ),
            lambda df: st._arrow_bar_chart(
                df, x="b", y=["a", "c"], color=["red", "orange"]
            ),
            lambda df: st._arrow_area_chart(
                df, x="b", y=["a", "c"], color=["red", "orange"]
            ),
            lambda df: st._arrow_scatter_chart(
                df, x="b", y=["a", "c"], color=["red", "orange"], size="b"
            ),
        ]

        expected = pd.DataFrame(
            {
                "a": [11, 12, 13],
                "b": [21, 22, 23],
                "c": [31, 32, 33],
            }
        )
        expected.index = pd.RangeIndex(start=1, stop=4, step=1)

        for delta in deltas:
            element = delta(DATAFRAME)
            element._arrow_add_rows(NEW_ROWS)

            proto = bytes_to_data_frame(
                self.get_delta_from_queue().arrow_add_rows.data.data
            )

            pd.testing.assert_frame_equal(proto, expected)

    def test_charts_with_fewer_args_than_cols(self):
        deltas = [
            lambda df: st._arrow_line_chart(df, x="b", y="a"),
            lambda df: st._arrow_bar_chart(df, x="b", y="a"),
            lambda df: st._arrow_area_chart(df, x="b", y="a"),
            lambda df: st._arrow_scatter_chart(df, x="b", y="a", size="b"),
        ]

        expected = pd.DataFrame(
            {
                "a": [11, 12, 13],
                "b": [21, 22, 23],
            }
        )
        expected.index = pd.RangeIndex(start=1, stop=4, step=1)

        for delta in deltas:
            element = delta(DATAFRAME)
            element._arrow_add_rows(NEW_ROWS)

            proto = bytes_to_data_frame(
                self.get_delta_from_queue().arrow_add_rows.data.data
            )

            pd.testing.assert_frame_equal(proto, expected)

    def test_charts_with_mixed_long_wide_args(self):
        # Here "c" is used in both the a long-format property (i.e. size) and a wide-format
        # property (y). This means it needs to appear twice in the final dataframe.
        deltas = [
            lambda df: st._arrow_scatter_chart(df, x="b", y=["a", "c"], size="c"),
        ]

        expected = pd.DataFrame(
            {
                "a": [11, 12, 13],
                "b": [21, 22, 23],
                "c": [31, 32, 33],
            }
        )
        expected.index = pd.RangeIndex(start=1, stop=4, step=1)

        for delta in deltas:
            element = delta(DATAFRAME)
            element._arrow_add_rows(NEW_ROWS)

            proto = bytes_to_data_frame(
                self.get_delta_from_queue().arrow_add_rows.data.data
            )

            pd.testing.assert_frame_equal(proto, expected)
