"""Unit test of dg._arrow_add_rows()."""

import pandas as pd
from tests import testutil

import streamlit as st
from streamlit.type_util import bytes_to_data_frame

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
