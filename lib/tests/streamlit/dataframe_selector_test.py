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

"""dataframe_selector unit test."""

import unittest
from unittest.mock import patch

import altair as alt
import pandas as pd

import streamlit
from streamlit.delta_generator import DeltaGenerator
from tests.streamlit.snowpark_mocks import DataFrame as MockSnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as MockSnowparkTable
from tests.testutil import patch_config_options

DATAFRAME = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
ALTAIR_CHART = alt.Chart(DATAFRAME).mark_bar().encode(x="a", y="b")


class DataFrameSelectorTest(unittest.TestCase):
    def test_arrow_is_default(self):
        """The 'arrow' config option is the default."""
        self.assertEqual("arrow", streamlit.get_option("global.dataFrameSerialization"))

    @patch.object(DeltaGenerator, "_legacy_dataframe")
    @patch.object(DeltaGenerator, "_arrow_dataframe")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_dataframe(self, arrow_dataframe, legacy_dataframe):
        streamlit.dataframe(DATAFRAME, 100, 200)
        legacy_dataframe.assert_called_once_with(DATAFRAME, 100, 200)
        arrow_dataframe.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_dataframe")
    @patch.object(DeltaGenerator, "_arrow_dataframe")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_dataframe(self, arrow_dataframe, legacy_dataframe):
        streamlit.dataframe(DATAFRAME, 100, 200)
        legacy_dataframe.assert_not_called()
        arrow_dataframe.assert_called_once_with(
            DATAFRAME, 100, 200, use_container_width=False
        )

    @patch.object(DeltaGenerator, "_legacy_dataframe")
    @patch.object(DeltaGenerator, "_arrow_dataframe")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_dataframe_with_snowpark_dataframe(
        self, arrow_dataframe, legacy_dataframe
    ):
        snowpark_df = MockSnowparkDataFrame()
        streamlit.dataframe(snowpark_df, 100, 200)
        legacy_dataframe.assert_not_called()
        arrow_dataframe.assert_called_once_with(
            snowpark_df, 100, 200, use_container_width=False
        )

    @patch.object(DeltaGenerator, "_legacy_dataframe")
    @patch.object(DeltaGenerator, "_arrow_dataframe")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_dataframe_with_snowpark_table(
        self, arrow_dataframe, legacy_dataframe
    ):
        snowpark_table = MockSnowparkTable()
        streamlit.dataframe(snowpark_table, 100, 200)
        legacy_dataframe.assert_not_called()
        arrow_dataframe.assert_called_once_with(
            snowpark_table, 100, 200, use_container_width=False
        )

    @patch.object(DeltaGenerator, "_legacy_table")
    @patch.object(DeltaGenerator, "_arrow_table")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_table(self, arrow_table, legacy_table):
        streamlit.table(DATAFRAME)
        legacy_table.assert_called_once_with(DATAFRAME)
        arrow_table.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_table")
    @patch.object(DeltaGenerator, "_arrow_table")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_table(self, arrow_table, legacy_table):
        streamlit.table(DATAFRAME)
        legacy_table.assert_not_called()
        arrow_table.assert_called_once_with(DATAFRAME)

    @patch.object(DeltaGenerator, "_legacy_line_chart")
    @patch.object(DeltaGenerator, "_arrow_line_chart")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_line_chart(self, arrow_line_chart, legacy_line_chart):
        streamlit.line_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_line_chart.assert_called_once_with(
            DATAFRAME, width=100, height=200, use_container_width=True
        )
        arrow_line_chart.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_line_chart")
    @patch.object(DeltaGenerator, "_arrow_line_chart")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_line_chart(self, arrow_line_chart, legacy_line_chart):
        streamlit.line_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_line_chart.assert_not_called()
        arrow_line_chart.assert_called_once_with(
            DATAFRAME, x=None, y=None, width=100, height=200, use_container_width=True
        )

    @patch.object(DeltaGenerator, "_legacy_area_chart")
    @patch.object(DeltaGenerator, "_arrow_area_chart")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_area_chart(self, arrow_area_chart, legacy_area_chart):
        streamlit.area_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_area_chart.assert_called_once_with(
            DATAFRAME, width=100, height=200, use_container_width=True
        )
        arrow_area_chart.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_area_chart")
    @patch.object(DeltaGenerator, "_arrow_area_chart")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_area_chart(self, arrow_area_chart, legacy_area_chart):
        streamlit.area_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_area_chart.assert_not_called()
        arrow_area_chart.assert_called_once_with(
            DATAFRAME, x=None, y=None, width=100, height=200, use_container_width=True
        )

    @patch.object(DeltaGenerator, "_legacy_bar_chart")
    @patch.object(DeltaGenerator, "_arrow_bar_chart")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_bar_chart(self, arrow_bar_chart, legacy_bar_chart):
        streamlit.bar_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_bar_chart.assert_called_once_with(
            DATAFRAME, width=100, height=200, use_container_width=True
        )
        arrow_bar_chart.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_bar_chart")
    @patch.object(DeltaGenerator, "_arrow_bar_chart")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_bar_chart(self, arrow_bar_chart, legacy_bar_chart):
        streamlit.bar_chart(DATAFRAME, width=100, height=200, use_container_width=True)
        legacy_bar_chart.assert_not_called()
        arrow_bar_chart.assert_called_once_with(
            DATAFRAME, x=None, y=None, width=100, height=200, use_container_width=True
        )

    @patch.object(DeltaGenerator, "_legacy_altair_chart")
    @patch.object(DeltaGenerator, "_arrow_altair_chart")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_altair_chart(self, arrow_altair_chart, legacy_altair_chart):
        streamlit.altair_chart(ALTAIR_CHART, True)
        legacy_altair_chart.assert_called_once_with(ALTAIR_CHART, True)
        arrow_altair_chart.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_altair_chart")
    @patch.object(DeltaGenerator, "_arrow_altair_chart")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_altair_chart(self, arrow_altair_chart, legacy_altair_chart):
        streamlit.altair_chart(ALTAIR_CHART, True)
        legacy_altair_chart.assert_not_called()
        arrow_altair_chart.assert_called_once_with(ALTAIR_CHART, True)

    @patch.object(DeltaGenerator, "_legacy_vega_lite_chart")
    @patch.object(DeltaGenerator, "_arrow_vega_lite_chart")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_vega_lite_chart(
        self, arrow_vega_lite_chart, legacy_vega_lite_chart
    ):
        streamlit.vega_lite_chart(
            DATAFRAME,
            None,
            True,
            x="foo",
            boink_boop=100,
            baz={"boz": "booz"},
        )
        legacy_vega_lite_chart.assert_called_once_with(
            DATAFRAME,
            None,
            True,
            x="foo",
            boink_boop=100,
            baz={"boz": "booz"},
        )
        arrow_vega_lite_chart.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_vega_lite_chart")
    @patch.object(DeltaGenerator, "_arrow_vega_lite_chart")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_vega_lite_chart(self, arrow_vega_lite_chart, legacy_vega_lite_chart):
        streamlit.vega_lite_chart(
            DATAFRAME,
            None,
            True,
            x="foo",
            boink_boop=100,
            baz={"boz": "booz"},
        )
        legacy_vega_lite_chart.assert_not_called()
        arrow_vega_lite_chart.assert_called_once_with(
            DATAFRAME, None, True, x="foo", boink_boop=100, baz={"boz": "booz"}
        )

    @patch.object(DeltaGenerator, "_legacy_add_rows")
    @patch.object(DeltaGenerator, "_arrow_add_rows")
    @patch_config_options({"global.dataFrameSerialization": "legacy"})
    def test_legacy_add_rows(self, arrow_add_rows, legacy_add_rows):
        elt = streamlit.dataframe(DATAFRAME)
        elt.add_rows(DATAFRAME, foo=DATAFRAME)
        legacy_add_rows.assert_called_once_with(DATAFRAME, foo=DATAFRAME)
        arrow_add_rows.assert_not_called()

    @patch.object(DeltaGenerator, "_legacy_add_rows")
    @patch.object(DeltaGenerator, "_arrow_add_rows")
    @patch_config_options({"global.dataFrameSerialization": "arrow"})
    def test_arrow_add_rows(self, arrow_add_rows, legacy_add_rows):
        elt = streamlit.dataframe(DATAFRAME)
        elt.add_rows(DATAFRAME, foo=DATAFRAME)
        legacy_add_rows.assert_not_called()
        arrow_add_rows.assert_called_once_with(DATAFRAME, foo=DATAFRAME)
