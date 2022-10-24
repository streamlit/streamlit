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

"""Legacy DataFrame Styler unit tests"""

from typing import Any, List, Optional, Set

import numpy as np
import pandas as pd
from parameterized import parameterized

import streamlit as st
from streamlit.proto.DataFrame_pb2 import CellStyle, CSSStyle, DataFrame, Table
from streamlit.proto.Element_pb2 import Element
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def _get_df_proto(element: Element) -> DataFrame:
    return element.data_frame


def _get_table_proto(element: Element) -> Table:
    return element.table


class LegacyDataFrameStylingTest(DeltaGeneratorTestCase):
    """Tests marshalling of pandas.Styler dataframe styling data
    with both st._legacy_dataframe and st._legacy_table.
    """

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_unstyled_has_no_style(self, st_element, get_proto):
        """A pure DataFrame with no Styler should result in a protobuf
        with no styling data.
        """

        values = [1, 2, 3, 4, 5]
        display_values = [None] * 5
        df = pd.DataFrame({"A": values})

        st_element(df)
        proto_df = get_proto(self._get_element())
        self._assert_column_display_values(proto_df, 0, display_values)

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_default_style_has_style_data(self, st_element, get_proto):
        """A DataFrame with a default Styler will have styling data."""

        values = [1, 2, 3, 4, 5]
        display_values = ["1", "2", "3", "4", "5"]
        df = pd.DataFrame({"A": values})

        st_element(df.style)
        proto_df = get_proto(self._get_element())
        self._assert_column_display_values(proto_df, 0, display_values)

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_format_percent(self, st_element, get_proto):
        """Tests DataFrame.style.format()"""
        values = [0.1, 0.2, 0.3352, np.nan]
        display_values = ["10.00%", "20.00%", "33.52%", "nan%"]

        df = pd.DataFrame({"A": values})

        st_element(df.style.format("{:.2%}"))

        proto_df = get_proto(self._get_element())
        self._assert_column_display_values(proto_df, 0, display_values)

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_format_float_precision(self, st_element, get_proto):
        """Tests DataFrame.style.format() with floats.
        By default, the frontend will format any unstyled DataFrame float
        with 4 digits after the decimal. If we have any floating point styling
        in a DataFrame, our display_values should be filled in even for
        cells whose display_value == value.
        """
        values = [3.14, 3.1]
        display_values = ["3.14", "3.10"]

        df = pd.DataFrame({"test": values})

        st_element(df.style.format({"test": "{:.2f}"}))

        proto_df = get_proto(self._get_element())
        self._assert_column_display_values(proto_df, 0, display_values)

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_css_styling(self, st_element, get_proto):
        """Tests DataFrame.style css styling"""

        values = [-1, 1]
        css_values = [
            {css_s("color", "red")},
            {css_s("color", "black"), css_s("background-color", "yellow")},
        ]

        df = pd.DataFrame({"A": values})

        st_element(
            df.style.highlight_max(color="yellow").applymap(
                lambda val: "color: red" if val < 0 else "color: black"
            )
        )

        proto_df = get_proto(self._get_element())
        self._assert_column_css_styles(proto_df, 0, css_values)

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_add_styled_rows(self, st_element, get_proto):
        """Add rows messages should include styling data if supplied."""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        # Styled DataFrame
        x = st_element(df1.style.applymap(lambda val: "color: red"))
        proto_df = get_proto(self.get_delta_from_queue().new_element)
        self._assert_column_css_styles(
            proto_df, 0, [{css_s("color", "red")}, {css_s("color", "red")}]
        )

        # Unstyled add_rows
        x._legacy_add_rows(df2.style.applymap(lambda val: "color: black"))
        proto_df = self.get_delta_from_queue().add_rows.data
        self._assert_column_css_styles(
            proto_df, 0, [{css_s("color", "black")}, {css_s("color", "black")}]
        )

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_add_styled_rows_to_unstyled_rows(self, st_element, get_proto):
        """Adding styled rows to unstyled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        # Unstyled DataFrame
        x = st_element(df1)
        proto_df = get_proto(self.get_delta_from_queue().new_element)
        self._assert_column_css_styles(proto_df, 0, [set(), set()])

        # Styled add_rows
        x._legacy_add_rows(df2.style.applymap(lambda val: "color: black"))
        proto_df = self.get_delta_from_queue().add_rows.data
        self._assert_column_css_styles(
            proto_df, 0, [{css_s("color", "black")}, {css_s("color", "black")}]
        )

    @parameterized.expand(
        [(st._legacy_dataframe, _get_df_proto), (st._legacy_table, _get_table_proto)]
    )
    def test_add_unstyled_rows_to_styled_rows(self, st_element, get_proto):
        """Adding unstyled rows to styled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        # Styled DataFrame
        x = st_element(df1.style.applymap(lambda val: "color: black"))
        proto_df = get_proto(self.get_delta_from_queue().new_element)
        self._assert_column_css_styles(
            proto_df, 0, [{css_s("color", "black")}, {css_s("color", "black")}]
        )

        # Unstyled add_rows
        x._legacy_add_rows(df2)
        proto_df = get_proto(self._get_element())
        self._assert_column_css_styles(proto_df, 0, [set(), set()])

    def _get_element(self) -> Element:
        """Returns the most recent element in the DeltaGenerator queue"""
        return self.get_delta_from_queue().new_element

    def _assert_column_display_values(
        self,
        proto_df: DataFrame,
        col: int,
        expected_display_values: List[Optional[str]],
    ) -> None:
        """Asserts that cells in a column have the given display_values"""
        for row in range(len(expected_display_values)):
            style = get_cell_style(proto_df, col, row)
            if expected_display_values[row] is not None:
                self.assertEqual(expected_display_values[row], style.display_value)
                self.assertTrue(style.has_display_value)
            else:
                self.assertFalse(style.has_display_value)

    def _assert_column_css_styles(
        self, proto_df: DataFrame, col: int, expected_styles: List[Set[str]]
    ) -> None:
        """Asserts that cells in a column have the given expected_styles
        expected_styles : List[Set[serialized_proto_str]]
        """
        for row in range(len(expected_styles)):
            proto_cell_style = get_cell_style(proto_df, col, row)
            # throw the `repeated CSSStyle styles` into a set of serialized strings
            cell_styles = set((proto_to_str(css) for css in proto_cell_style.css))
            self.assertEqual(expected_styles[row], cell_styles)


def get_cell_style(proto_df: DataFrame, col: int, row: int) -> CellStyle:
    """Returns the CellStyle for the given cell, or an empty CellStyle
    if no style for the given cell exists
    """
    if col >= len(proto_df.style.cols):
        return CellStyle()

    col_style = proto_df.style.cols[col]
    if row >= len(col_style.styles):
        return CellStyle()

    return col_style.styles[row]


def make_cssstyle_proto(property: str, value: str) -> CSSStyle:
    """Creates a CSSStyle with the given values"""
    css_style = CSSStyle()
    css_style.property = property
    css_style.value = value
    return css_style


def proto_to_str(proto: Any) -> str:
    """Serializes a protobuf to a string (used here for hashing purposes)"""
    return proto.SerializePartialToString()


def css_s(property: str, value: str) -> str:
    """Creates a stringified CSSString proto with the given values"""
    return proto_to_str(make_cssstyle_proto(property, value))
