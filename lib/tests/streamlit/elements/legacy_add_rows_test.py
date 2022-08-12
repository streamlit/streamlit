"""Unit test of dg._legacy_add_rows()."""
from typing import Optional

import pandas as pd
import pytest
import pyarrow as pa

from streamlit.errors import StreamlitAPIException
from streamlit.proto.DataFrame_pb2 import DataFrame
from streamlit.proto.Delta_pb2 import Delta
from streamlit.runtime.scriptrunner import get_script_run_ctx
import streamlit as st
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
        """Some element types require that their dataframes are
        'melted' (https://pandas.pydata.org/docs/reference/api/pandas.melt.html)
         before being sent to the frontend. Test that the melting occurs.
        """
        deltas = self._get_deltas_that_melt_dataframes()

        for delta in deltas:
            el = delta(DATAFRAME)
            el._legacy_add_rows(NEW_ROWS)

            df_proto = _get_data_frame(self.get_delta_from_queue())

            # Test that the add_rows delta is properly melted
            rows = df_proto.data.cols[0].int64s.data
            self.assertEqual([2, 3, 4, 2, 3, 4], rows)

    def test_simple_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # This is what we're testing:
            el._legacy_add_rows(NEW_ROWS)

            # Make sure the add_rows proto looks like we expect.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            rows = df_proto.data.cols[0].int64s.data
            self.assertEqual([3, 4, 5], rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    @pytest.mark.filterwarnings("ignore::FutureWarning")
    def test_with_index_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME_WITH_INDEX)

            # Make sure it has 2 rows in it.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # This is what we're testing:
            el._legacy_add_rows(NEW_ROWS_WITH_INDEX)

            # Make sure the add_rows proto looks like we expect.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            rows = df_proto.data.cols[0].int64s.data
            self.assertEqual([30, 40, 50], rows)

            index = df_proto.index.int_64_index.data.data
            self.assertEqual([3, 4, 5], index)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    @pytest.mark.filterwarnings("ignore::FutureWarning")
    def test_with_index_no_data_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(None)
            _get_data_frame(self.get_delta_from_queue())

            # This is what we're testing:
            el._legacy_add_rows(DATAFRAME_WITH_INDEX)

            # Make sure there are 2 rows in it now.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_no_index_no_data_legacy_add_rows(self):
        """Test plain old _legacy_add_rows."""
        all_methods = self._get_unnamed_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(None)
            _get_data_frame(self.get_delta_from_queue())

            # This is what we're testing:
            el._legacy_add_rows(DATAFRAME)

            # Make sure there are 2 rows in it now.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_simple_legacy_add_rows_with_clear_queue(self):
        """Test plain old _legacy_add_rows after clearing the queue."""
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # This is what we're testing:
            self.forward_msg_queue.clear()
            el._legacy_add_rows(NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(3, num_rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_named_legacy_add_rows(self):
        """Test _legacy_add_rows with a named dataset."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # This is what we're testing:
            el._legacy_add_rows(mydata1=NEW_ROWS)

            # Make sure the add_rows proto looks like we expect
            df_proto = _get_data_frame(self.get_delta_from_queue(), name="mydata1")
            rows = df_proto.data.cols[0].int64s.data
            self.assertEqual([3, 4, 5], rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_named_legacy_add_rows_with_clear_queue(self):
        """Test _legacy_add_rows with a named dataset, and clearing the queue."""
        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # Make sure it has 2 rows in it.
            df_proto = _get_data_frame(self.get_delta_from_queue())
            num_rows = len(df_proto.data.cols[0].int64s.data)
            self.assertEqual(2, num_rows)

            # This is what we're testing:
            self.forward_msg_queue.clear()
            el._legacy_add_rows(mydata1=NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(3, num_rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_legacy_add_rows_works_when_new_name(self):
        """Test _legacy_add_rows with new named datasets."""

        for method in self._get_named_data_methods():
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)
            self.forward_msg_queue.clear()

            # This is what we're testing:
            el._legacy_add_rows(new_name=NEW_ROWS)

            # Make sure there are 3 rows in the delta that got appended.
            ar = self.get_delta_from_queue().add_rows
            num_rows = len(ar.data.data.cols[0].int64s.data)
            self.assertEqual(3, num_rows)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

    def test_legacy_add_rows_suceeds_when_wrong_shape(self):
        """_legacy_add_rows doesn't raise an error even if its input has the
        wrong shape. Instead, it's up to the frontend to catch and raise
        this error.
        """
        all_methods = self._get_unnamed_data_methods() + self._get_named_data_methods()

        for method in all_methods:
            # Create a new data-carrying element (e.g. st._legacy_dataframe)
            el = method(DATAFRAME)

            # This is what we're testing:
            el._legacy_add_rows(NEW_ROWS_WRONG_SHAPE)

            # Clear the queue so the next loop is like a brand new test.
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()

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
            get_script_run_ctx().reset()
            self.forward_msg_queue.clear()


def _get_data_frame(delta: Delta, name: Optional[str] = None) -> DataFrame:
    """Extract the dataframe protobuf from a delta protobuf."""
    delta_type = delta.WhichOneof("type")

    if delta_type == "new_element":
        element_type = delta.new_element.WhichOneof("type")

        # Some element types don't support named datasets.
        if name and element_type in ("data_frame", "table", "chart"):
            raise ValueError("Dataset names not supported for st.%s" % element_type)

        if element_type in "data_frame":
            return delta.new_element.data_frame
        elif element_type in "table":
            return delta.new_element.table
        elif element_type == "chart":
            return delta.new_element.chart.data
        elif element_type == "vega_lite_chart":
            chart_proto = delta.new_element.vega_lite_chart
            if name:
                return _get_or_create_dataset(chart_proto.datasets, name)
            elif len(chart_proto.datasets) == 1:
                # Support the case where the dataset name was randomly given by
                # the charting library (e.g. Altair) and the user has no
                # knowledge of it.
                return chart_proto.datasets[0].data
            else:
                return chart_proto.data
        # TODO: Support DeckGL. Need to figure out how to handle layer indices
        # first.

    elif delta_type == "add_rows":
        if delta.add_rows.has_name and name != delta.add_rows.name:
            raise ValueError('No dataset found with name "%s".' % name)
        return delta.add_rows.data
    else:
        raise ValueError("Cannot extract DataFrame from %s." % delta_type)


def _get_or_create_dataset(datasets_proto, name):
    for dataset in datasets_proto:
        if dataset.has_name and dataset.name == name:
            return dataset.data

    dataset = datasets_proto.add()
    dataset.name = name
    dataset.has_name = True
    return dataset.data
