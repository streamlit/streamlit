# Copyright 2019 Streamlit Inc. All rights reserved.
"""DeltaGenerator Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import pandas as pd

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
import streamlit.elements.data_frame_proto as data_frame_proto


DATAFRAME = pd.DataFrame({'a': [1, 2], 'b': [10, 20]})
NEW_ROWS = pd.DataFrame({'a': [3, 4, 5], 'b': [30, 40, 50]})
NEW_ROWS_WRONG_SHAPE = pd.DataFrame({'a': [3, 4], 'b': [30, 40], 'c': [50, 60]})


class DeltaGeneratorAddRowsTest(unittest.TestCase):
    """Test dg.add_rows."""

    def setUp(self):
        self._report_queue = ReportQueue()

        def enqueue(msg):
            self._report_queue.enqueue(msg)
            return True

        self._dg = DeltaGenerator(enqueue)

    def _get_unnamed_data_methods(self):
        """DeltaGenerator methods that do not produce named datasets."""
        return [
            lambda df: self._dg.dataframe(df),
            lambda df: self._dg.table(df),
            lambda df: self._dg.vega_lite_chart(df, {
                'mark': 'line',
                'encoding': {'x': 'a', 'y': 'b'},
            }),

            # TODO: line_chart, bar_chart, etc.
        ]

    def _get_named_data_methods(self):
        """DeltaGenerator methods that produce named datasets."""
        # These should always name the desired data "mydata1"
        return [
            lambda df: self._dg.vega_lite_chart({
                'mark': 'line',
                'datasets': {'mydata1': df},
                'data': {'name': 'mydata1'},
                'encoding': {'x': 'a', 'y': 'b'},
            }),

            # TODO: deck_gl_chart
        ]

    def test_simple_add_rows(self):
        """Test plain old add_rows."""
        all_methods = (
            self._get_unnamed_data_methods() + self._get_named_data_methods())

        for method in all_methods:
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            el.add_rows(NEW_ROWS)

            # Make sure there are 5 rows in it now.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 5)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()

    def test_simple_add_rows_with_clear_queue(self):
        """Test plain old add_rows after clearing the queue."""
        all_methods = (
            self._get_unnamed_data_methods() + self._get_named_data_methods())

        for method in all_methods:
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            self._report_queue.clear()
            el.add_rows(NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self._report_queue._queue[-1].delta.add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 3)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()

    def test_named_add_rows(self):
        """Test add_rows with a named dataset."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            el.add_rows(mydata1=NEW_ROWS)

            # Make sure there are 5 rows in it now.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 5)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()

    def test_named_add_rows_with_clear_queue(self):
        """Test add_rows with a named dataset, and clearing the queue."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame_proto._get_data_frame(
                self._report_queue._queue[-1].delta)
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            self._report_queue.clear()
            el.add_rows(mydata1=NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self._report_queue._queue[-1].delta.add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 3)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()

    def test_add_rows_fails_when_wrong_name(self):
        """Test add_rows with wrongfully named datasets."""
        all_methods = (
            self._get_unnamed_data_methods() + self._get_named_data_methods())

        for method in all_methods:
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            with self.assertRaises(ValueError):
                # This is what we're testing:
                el.add_rows(wrong_name=NEW_ROWS)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()

    def test_add_rows_fails_when_wrong_shape(self):
        """Test that add_rows raises error when input has wrong shape."""
        all_methods = (
            self._get_unnamed_data_methods() + self._get_named_data_methods())

        for method in all_methods:
            # Create a new data-carrying element (e.g. st.dataframe)
            el = method(DATAFRAME)

            with self.assertRaises(ValueError):
                # This is what we're testing:
                el.add_rows(NEW_ROWS_WRONG_SHAPE)

            # Clear the queue so the next loop is like a brand new test.
            self._dg._reset()
            self._report_queue.clear()
