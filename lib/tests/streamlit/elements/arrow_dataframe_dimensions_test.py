"""Arrow Dataframe dimension parameters test."""

import pandas as pd

from tests import testutil
import streamlit as st


class ArrowDataFrameDimensionsTest(testutil.DeltaGeneratorTestCase):
    """Test the metadata in the serialized delta message for the different
    dimension specifier options.
    """

    def test_no_dimensions(self):
        """When no dimension parameters are passed"""
        self._do_test(lambda fn, df: fn(df), 0, 0)

    def test_with_dimensions(self):
        """When dimension parameter are passed"""
        self._do_test(lambda fn, df: fn(df, 10, 20), 10, 20)

    def test_with_height_only(self):
        """When only height parameter is passed"""
        self._do_test(lambda fn, df: fn(df, height=20), 0, 20)

    def test_with_width_only(self):
        """When only width parameter is passed"""
        self._do_test(lambda fn, df: fn(df, width=20), 20, 0)

    def _do_test(self, fn, expectedWidth, expectedHeight):
        df = pd.DataFrame({"A": [1, 2, 3, 4, 5]})

        fn(st._arrow_dataframe, df)
        arrow_data_frame = self.get_delta_from_queue().new_element.arrow_data_frame
        self.assertEqual(arrow_data_frame.width, expectedWidth)
        self.assertEqual(arrow_data_frame.height, expectedHeight)

    def _get_metadata(self):
        """Returns the metadata for the most recent element in the
        DeltaGenerator queue
        """
        return self.forward_msg_queue._queue[-1].metadata
