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

"""Unit test of dg._legacy_add_rows()."""

import pandas as pd
import pyarrow as pa

from streamlit.errors import StreamlitAPIException
from streamlit.report_thread import get_report_ctx
import streamlit as st
import streamlit.elements.legacy_data_frame as data_frame
from tests import testutil


DATAFRAME = pd.DataFrame({"a": [1, 2], "b": [10, 20]})
DATAFRAME_WITH_INDEX = pd.DataFrame({"a": [1, 2], "b": [10, 20]}).set_index("a")
NEW_ROWS = pd.DataFrame({"a": [3, 4, 5], "b": [30, 40, 50]})
NEW_ROWS_WITH_INDEX = pd.DataFrame({"a": [3, 4, 5], "b": [30, 40, 50]}).set_index("a")
NEW_ROWS_WRONG_SHAPE = pd.DataFrame({"a": [3, 4], "b": [30, 40], "c": [50, 60]})


class DeltaGeneratorAddRowsTest(testutil.DeltaGeneratorTestCase):
    """Test dg._legacy_add_rows()."""

    def _get_unnamed_data_methods(self):
        """DeltaGenerator methods that do not produce named datasets."""
        return [
            lambda df: st._legacy_dataframe(df),
            lambda df: st._legacy_table(df),
            lambda df: st._legacy_vega_lite_chart(
                df, {"mark": "line", "encoding": {"x": "a", "y": "b"}}
            ),
            # TODO: _legacy_line_chart, _legacy_bar_chart, etc.
        ]

    def _get_deltas_that_melt_dataframes(self):
        return [
            lambda df: st._legacy_line_chart(df),
            lambda df: st._legacy_bar_chart(df),
            lambda df: st._legacy_area_chart(df),
        ]

    def _get_named_data_methods(self):
        """DeltaGenerator methods that produce named datasets."""
        # These should always name the desired data "mydata1"
        return [
            lambda df: st._legacy_vega_lite_chart(
                {
                    "mark": "line",
                    "datasets": {"mydata1": df},
                    "data": {"name": "mydata1"},
                    "encoding": {"x": "a", "y": "b"},
                }
            ),
            # TODO: deck_gl_chart
        ]

    def test_deltas_that_melt_dataframes(self):
        deltas = self._get_deltas_that_melt_dataframes()

        for delta in deltas:
            el = delta(DATAFRAME)
            el._legacy_add_rows(NEW_ROWS)
            # It is important that we test after this second call to _legacy_add_rows
            # to cover the logic to compute the index.
            # See:
            # https://github.com/streamlit/streamlit/issues/748
            el._legacy_add_rows(NEW_ROWS)

            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)

            self.assertEqual(num_rows, 16)
            self.assertEqual(
                [0, 1, 0, 1, 2, 3, 4, 2, 3, 4, 5, 6, 7, 5, 6, 7],
                df_proto.data.cols[0].int64s.data,
            )

    def test_simple_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            el._legacy_add_rows(NEW_ROWS)

            # Make sure there are 5 rows in it now.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 5)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_with_index_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME_WITH_INDEX)

            # Make sure it has 2 rows in it.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            el._legacy_add_rows(NEW_ROWS_WITH_INDEX)

            # Make sure there are 2 rows in it now.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 5)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_with_index_no_data_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(None)
            data_frame._get_data_frame(self.get_delta_from_queue())

            # This is what we're testing:
            el._legacy_add_rows(DATAFRAME_WITH_INDEX)

            # Make sure there are 2 rows in it now.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_no_index_no_data_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(None)
            data_frame._get_data_frame(self.get_delta_from_queue())

            # This is what we're testing:
            el._legacy_add_rows(DATAFRAME)

            # Make sure there are 2 rows in it now.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_simple_legacy_add_rows_with_clear_queue(self):
        """Test plain old _legacy_add_rows after clearing the queue."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            self.report_queue.clear()
            el._legacy_add_rows(NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 3)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_named_legacy_add_rows(self):
        """Test _legacy_add_rows with a named dataset."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            el._legacy_add_rows(mydata1=NEW_ROWS)

            # Make sure there are 5 rows in it now.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 5)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_named_legacy_add_rows_with_clear_queue(self):
        """Test _legacy_add_rows with a named dataset, and clearing the queue."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = data_frame._get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 2)

            # This is what we're testing:
            self.report_queue.clear()
            el._legacy_add_rows(mydata1=NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 3)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_legacy_add_rows_works_when_new_name(self):
        """Test _legacy_add_rows with new named datasets."""

        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)
            self.report_queue.clear()

            # This is what we're testing:
            el._legacy_add_rows(new_name=NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(num_rows, 3)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_legacy_add_rows_fails_when_wrong_shape(self):
        """Test that _legacy_add_rows raises error when input has wrong shape."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            with self.assertRaises(ValueError):
                # This is what we're testing:
                el._legacy_add_rows(NEW_ROWS_WRONG_SHAPE)

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()

    def test_legacy_add_rows_with_pyarrow_table_data(self):
        """Test that an error is raised when called with `pyarrow.Table` data."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            with self.assertRaises(StreamlitAPIException):
                # Create a new data-carrying element (e.g. st._legacy_dataframe)
                el = method(DATAFRAME)
                # This is what we're testing:
                el._legacy_add_rows(pa.Table.from_pandas(NEW_ROWS))

            # Clear the queue so the next loop is like a brand new test.
            get_report_ctx().reset()
            self.report_queue.clear()
