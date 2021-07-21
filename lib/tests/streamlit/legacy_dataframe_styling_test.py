# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Legacy DataFrame Styler unit tests"""

import numpy as np
import pandas as pd
from parameterized import parameterized

import streamlit as st
from streamlit.proto.DataFrame_pb2 import CellStyle
from streamlit.proto.DataFrame_pb2 import CSSStyle
from tests import testutil


class LegacyDataFrameStylingTest(testutil.DeltaGeneratorTestCase):
    """Tests marshalling of pandas.Styler dataframe styling data
    with both st._legacy_dataframe and st._legacy_table.
    """

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_unstyled_has_no_style(self, element, proto):
        """A DataFrame with an unmodified Styler should result in a protobuf
        with no styling data
        """

        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        getattr(st, element)(df.style)
        proto_df = getattr(self._get_element(), proto)

        rows, cols = df.shape
        for row in range(rows):
            for col in range(cols):
                style = get_cell_style(proto_df, col, row)
                self.assertEqual(style.display_value, "")
                self.assertEqual(style.has_display_value, False)
                self.assertEqual(len(style.css), 0)

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_format(self, element, proto):
        """Tests DataFrame.style.format()"""
        values = [0.1, 0.2, 0.3352, np.nan]
        display_values = ["10.00%", "20.00%", "33.52%", "nan%"]

        df = pd.DataFrame({"A": values})

        get_delta = getattr(st, element)
        get_delta(df.style.format("{:.2%}"))

        proto_df = getattr(self._get_element(), proto)
        self._assert_column_display_values(proto_df, 0, display_values)

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_css_styling(self, element, proto):
        """Tests DataFrame.style css styling"""

        values = [-1, 1]
        css_values = [
            {css_s("color", "red")},
            {css_s("color", "black"), css_s("background-color", "yellow")},
        ]

        df = pd.DataFrame({"A": values})

        get_delta = getattr(st, element)
        get_delta(
            df.style.highlight_max(color="yellow").applymap(
                lambda val: "color: red" if val < 0 else "color: black"
            )
        )

        proto_df = getattr(self._get_element(), proto)
        self._assert_column_css_styles(proto_df, 0, css_values)

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_add_styled_rows(self, element, proto):
        """Add rows should preserve existing styles and append new styles"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            {css_s("color", "red")},
            {css_s("color", "red")},
            {css_s("color", "black")},
            {css_s("color", "black")},
        ]

        get_delta = getattr(st, element)
        x = get_delta(df1.style.applymap(lambda val: "color: red"))

        x._legacy_add_rows(df2.style.applymap(lambda val: "color: black"))

        proto_df = getattr(self._get_element(), proto)
        self._assert_column_css_styles(proto_df, 0, css_values)

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_add_styled_rows_to_unstyled_rows(self, element, proto):
        """Adding styled rows to unstyled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            set(),
            set(),
            {css_s("color", "black")},
            {css_s("color", "black")},
        ]

        x = getattr(st, element)(df1)
        x._legacy_add_rows(df2.style.applymap(lambda val: "color: black"))

        proto_df = getattr(self._get_element(), proto)
        self._assert_column_css_styles(proto_df, 0, css_values)

    @parameterized.expand(
        [("_legacy_dataframe", "data_frame"), ("_legacy_table", "table")]
    )
    def test_add_unstyled_rows_to_styled_rows(self, element, proto):
        """Adding unstyled rows to styled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            {css_s("color", "black")},
            {css_s("color", "black")},
            set(),
            set(),
        ]

        get_delta = getattr(st, element)
        x = get_delta(df1.style.applymap(lambda val: "color: black"))

        x._legacy_add_rows(df2)

        proto_df = getattr(self._get_element(), proto)
        self._assert_column_css_styles(proto_df, 0, css_values)

    def _get_element(self):
        """Returns the most recent element in the DeltaGenerator queue"""
        return self.get_delta_from_queue().new_element

    def _assert_column_display_values(self, proto_df, col, display_values):
        """Asserts that cells in a column have the given display_values"""
        for row in range(len(display_values)):
            style = get_cell_style(proto_df, col, row)
            self.assertEqual(style.has_display_value, display_values[row] is not None)
            self.assertEqual(style.display_value, display_values[row])

    def _assert_column_css_styles(self, proto_df, col, expected_styles):
        """Asserts that cells in a column have the given expected_styles
        expected_styles : List[Set[serialized_proto_str]]
        """
        for row in range(len(expected_styles)):
            proto_cell_style = get_cell_style(proto_df, col, row)
            # throw the `repeated CSSStyle styles` into a set of serialized strings
            cell_styles = set((proto_to_str(css) for css in proto_cell_style.css))
            self.assertEqual(expected_styles[row], cell_styles)


def get_cell_style(proto_df, col, row):
    """Returns the CellStyle for the given cell, or an empty CellStyle
    if no style for the given cell exists
    """
    if col >= len(proto_df.style.cols):
        return CellStyle()

    col_style = proto_df.style.cols[col]
    if row >= len(col_style.styles):
        return CellStyle()

    return col_style.styles[row]


def make_cssstyle_proto(property, value):
    """Creates a CSSStyle with the given values"""
    css_style = CSSStyle()
    css_style.property = property
    css_style.value = value
    return css_style


def proto_to_str(proto):
    """Serializes a protobuf to a string (used here for hashing purposes)"""
    return proto.SerializePartialToString()


def css_s(property, value):
    """Creates a stringified CSSString proto with the given values"""
    return proto_to_str(make_cssstyle_proto(property, value))
