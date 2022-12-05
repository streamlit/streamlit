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

"""Unit tests for st.map()."""
import itertools
import json

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.map import _DEFAULT_MAP, _DEFAULT_ZOOM_LEVEL
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit import pyspark_mocks
from tests.streamlit.snowpark_mocks import DataFrame as MockedSnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as MockedSnowparkTable
from tests.testutil import create_snowpark_session

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class StMapTest(DeltaGeneratorTestCase):
    """Test ability to marshall deck_gl_json_chart protos via st.map."""

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.map()

        c = self.get_delta_from_queue().new_element.deck_gl_json_chart
        self.assertEqual(json.loads(c.json), _DEFAULT_MAP)

    def test_basic(self):
        """Test that it can be called with lat/lon."""
        st.map(df1)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        self.assertIsNotNone(c.get("initialViewState"))
        self.assertIsNotNone(c.get("layers"))
        self.assertIsNone(c.get("mapStyle"))
        self.assertEqual(len(c.get("layers")), 1)
        self.assertEqual(c.get("initialViewState").get("latitude"), 2.5)
        self.assertEqual(c.get("initialViewState").get("longitude"), 25)
        self.assertEqual(c.get("initialViewState").get("zoom"), 3)
        self.assertEqual(c.get("initialViewState").get("pitch"), 0)
        self.assertEqual(c.get("layers")[0].get("@@type"), "ScatterplotLayer")

    @parameterized.expand(
        itertools.product(
            {"lat", "latitude", "LAT", "LATITUDE"},
            {"lon", "longitude", "LON", "LONGITUDE"},
        )
    )
    def test_alternative_names_columns(self, lat_column_name, lon_column_name):
        """Test that it can be called with alternative names of lat/lon columns."""
        df = df1.rename(columns={"lat": lat_column_name, "lon": lon_column_name})
        st.map(df1)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")), 4)

    def test_default_map_copy(self):
        """Test that _DEFAULT_MAP is not modified as other work occurs."""
        self.assertEqual(_DEFAULT_MAP["initialViewState"]["latitude"], 0)

        st.map(df1)
        self.assertEqual(_DEFAULT_MAP["initialViewState"]["latitude"], 0)

    def test_default_zoom_level(self):
        """Test that _DEFAULT_ZOOM_LEVEL is set if zoom is not provided and distance is too small."""
        df = pd.DataFrame({"lat": [1], "lon": [1]})
        st.map(df)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(c.get("initialViewState").get("zoom"), _DEFAULT_ZOOM_LEVEL)

    def test_map_leak(self):
        """Test that maps don't stay in memory when you create a new blank one.

        This is testing for an actual (fixed) bug.
        """
        st.map(df1)
        st.map()

        c = self.get_delta_from_queue().new_element.deck_gl_json_chart
        self.assertEqual(json.loads(c.json), _DEFAULT_MAP)

    @parameterized.expand(
        [
            [
                "lat",
                "Map data must contain a latitude column named: 'LAT', 'LATITUDE', 'lat', 'latitude'. "
                "Existing columns: 'lon'",
            ],
            [
                "lon",
                "Map data must contain a longitude column named: 'LON', 'LONGITUDE', 'lon', 'longitude'. "
                "Existing columns: 'lat'",
            ],
        ]
    )
    def test_missing_column(self, column_name, exception_message):
        """Test st.map with wrong lat column label."""
        df = df1.drop(columns=[column_name])
        with self.assertRaises(Exception) as ctx:
            st.map(df)

        self.assertEqual(
            exception_message,
            str(ctx.exception),
        )

    def test_nan_exception(self):
        """Test st.map with NaN in data."""
        df = pd.DataFrame({"lat": [1, 2, np.nan], "lon": [11, 12, 13]})
        with self.assertRaises(Exception) as ctx:
            st.map(df)

        self.assertIn("data must be numeric.", str(ctx.exception))

    def test_unevaluated_snowpark_table_mock(self):
        """Test st.map with unevaluated Snowpark Table based on mock data"""
        mocked_snowpark_table = MockedSnowparkTable(is_map=True, num_of_rows=50000)
        st.map(mocked_snowpark_table)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        self.assertIsNotNone(c.get("initialViewState"))
        self.assertIsNotNone(c.get("layers"))
        self.assertIsNone(c.get("mapStyle"))
        self.assertEqual(len(c.get("layers")), 1)
        self.assertEqual(c.get("initialViewState").get("pitch"), 0)
        self.assertEqual(c.get("layers")[0].get("@@type"), "ScatterplotLayer")

        """Check if map data was cut to 10k rows"""
        self.assertEqual(len(c["layers"][0]["data"]), 10000)

    @pytest.mark.require_snowflake
    def test_unevaluated_snowpark_table_integration(self):
        """Test st.map with unevaluated Snowpark DataFrame using real Snowflake instance"""
        with create_snowpark_session() as snowpark_session:
            table = snowpark_session.sql(
                """
                SELECT V1.$1 AS "lat", V1.$2 AS "lon" FROM
                    (
                        VALUES (1, 10), (2, 20), (3, 30), (4, 40)
                    ) AS V1
                """
            ).cache_result()
            st.map(table)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        """Check if map data have 4 rows"""
        self.assertEqual(len(c["layers"][0]["data"]), 4)

    def test_unevaluated_snowpark_dataframe_mock(self):
        """Test st.map with unevaluated Snowpark DataFrame based on mock data"""
        mocked_snowpark_dataframe = MockedSnowparkDataFrame(
            is_map=True, num_of_rows=50000
        )
        st.map(mocked_snowpark_dataframe)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        self.assertIsNotNone(c.get("initialViewState"))
        self.assertIsNotNone(c.get("layers"))
        self.assertIsNone(c.get("mapStyle"))
        self.assertEqual(len(c.get("layers")), 1)
        self.assertEqual(c.get("initialViewState").get("pitch"), 0)
        self.assertEqual(c.get("layers")[0].get("@@type"), "ScatterplotLayer")

        """Check if map data was cut to 10k rows"""
        self.assertEqual(len(c["layers"][0]["data"]), 10000)

    @pytest.mark.require_snowflake
    def test_unevaluated_snowpark_dataframe_integration(self):
        """Test st.map with unevaluated Snowpark DataFrame using real Snowflake instance"""
        with create_snowpark_session() as snowpark_session:
            df = snowpark_session.sql(
                """
                SELECT V1.$1 AS "lat", V1.$2 AS "lon" FROM
                    (
                        VALUES (1, 10), (2, 20), (3, 30), (4, 40)
                    ) AS V1
                """
            )
            st.map(df)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        """Check if map data have 4 rows"""
        self.assertEqual(len(c["layers"][0]["data"]), 4)

    def test_pyspark_dataframe(self):
        """Test st.map with pyspark.sql.DataFrame"""
        pyspark_map_dataframe = (
            pyspark_mocks.create_pyspark_dataframe_with_mocked_map_data()
        )
        st.map(pyspark_map_dataframe)

        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        self.assertIsNotNone(c.get("initialViewState"))
        self.assertIsNotNone(c.get("layers"))
        self.assertIsNone(c.get("mapStyle"))
        self.assertEqual(len(c.get("layers")), 1)
        self.assertEqual(c.get("initialViewState").get("pitch"), 0)
        self.assertEqual(c.get("layers")[0].get("@@type"), "ScatterplotLayer")

        """Check if map data has 5 rows"""
        self.assertEqual(len(c["layers"][0]["data"]), 5)
