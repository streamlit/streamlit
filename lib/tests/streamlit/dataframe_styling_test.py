# Copyright 2019 Streamlit Inc. All rights reserved.
"""DataFrame unit tests"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import pandas as pd
import numpy as np

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from streamlit import protobuf


class DataFrameStylingTest(unittest.TestCase):
    """Tests marshalling of pandas.Styler dataframe styling data."""

    def setUp(self):
        self._dg = DeltaGenerator(ReportQueue())

    def test_unstyled_has_no_style(self):
        """A DataFrame with an unmodified Styler should result in a protobuf
        with no styling data
        """

        df = pd.DataFrame({'A': [1, 2, 3, 4, 5]})
        self._dg.dataframe(df.style)
        proto_df = self._get_element().data_frame

        rows, cols = df.shape
        for row in range(rows):
            for col in range(cols):
                style = get_cell_style(proto_df, col, row)
                self.assertEqual(style.display_value, '')
                self.assertEqual(style.has_display_value, False)
                self.assertEqual(len(style.css), 0)

    def test_format(self):
        """Tests DataFrame.style.format()"""
        values = [0.1, 0.2, 0.3352, np.nan]
        display_values = ['10.00%', '20.00%', '33.52%', 'nan%']

        df = pd.DataFrame({'A': values})
        self._dg.dataframe(df.style.format('{:.2%}'))

        proto_df = self._get_element().data_frame
        self._assert_column_display_values(proto_df, 0, display_values)

    def test_css_styling(self):
        """Tests DataFrame.style css styling"""

        values = [-1, 1]
        css_values = [
            {css_s('color', 'red')},
            {css_s('color', 'black'), css_s('background-color', 'yellow')}
        ]

        df = pd.DataFrame({'A': values})
        self._dg.dataframe(df.style
                           .highlight_max(color='yellow')
                           .applymap(lambda val: 'color: red' if val < 0 else 'color: black'))

        proto_df = self._get_element().data_frame
        self._assert_column_css_styles(proto_df, 0, css_values)

    def test_add_styled_rows(self):
        """Add rows should preserve existing styles and append new styles"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            {css_s('color', 'red')},
            {css_s('color', 'red')},
            {css_s('color', 'black')},
            {css_s('color', 'black')},
        ]

        x = self._dg.dataframe(df1.style.applymap(lambda val: 'color: red'))
        x.add_rows(df2.style.applymap(lambda val: 'color: black'))

        proto_df = self._get_element().data_frame
        self._assert_column_css_styles(proto_df, 0, css_values)

    def test_add_styled_rows_to_unstyled_rows(self):
        """Adding styled rows to unstyled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            set(),
            set(),
            {css_s('color', 'black')},
            {css_s('color', 'black')},
        ]

        x = self._dg.dataframe(df1)
        x.add_rows(df2.style.applymap(lambda val: 'color: black'))

        proto_df = self._get_element().data_frame
        self._assert_column_css_styles(proto_df, 0, css_values)

    def test_add_unstyled_rows_to_styled_rows(self):
        """Adding unstyled rows to styled rows should work"""
        df1 = pd.DataFrame([5, 6])
        df2 = pd.DataFrame([7, 8])

        css_values = [
            {css_s('color', 'black')},
            {css_s('color', 'black')},
            set(),
            set(),
        ]

        x = self._dg.dataframe(df1.style.applymap(lambda val: 'color: black'))
        x.add_rows(df2)

        proto_df = self._get_element().data_frame
        self._assert_column_css_styles(proto_df, 0, css_values)

    def _get_element(self):
        """Returns the most recent element in the DeltaGenerator queue"""
        return self._dg._queue.get_deltas()[-1].new_element

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
        return protobuf.CellStyle()

    col_style = proto_df.style.cols[col]
    if row >= len(col_style.styles):
        return protobuf.CellStyle()

    return col_style.styles[row]


def make_cssstyle_proto(property, value):
    """Creates a protobuf.CSSStyle with the given values"""
    css_style = protobuf.CSSStyle()
    css_style.property = property
    css_style.value = value
    return css_style


def proto_to_str(proto):
    """Serializes a protobuf to a string (used here for hashing purposes)"""
    return proto.SerializePartialToString()


def css_s(property, value):
    """Creates a stringified CSSString proto with the given values"""
    return proto_to_str(make_cssstyle_proto(property, value))
