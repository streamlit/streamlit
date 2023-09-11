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
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit import pyspark_mocks
from tests.streamlit.snowpark_mocks import DataFrame as MockedSnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as MockedSnowparkTable
from tests.testutil import create_snowpark_session, patch_config_options

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

    def test_main_kwargs(self):
        """Test that latitude, longitude, color and size propagate correctly."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
                "xlat": [-38.8762997, -38.8742997, -38.9025842],
                "xlon": [77.0037, 77.0057, 77.0556545],
            }
        )

        st.map(df, latitude="xlat", longitude="xlon", color="color", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)

        self.assertEqual(c.get("layers")[0].get("getPosition"), "@@=[xlon, xlat]")
        self.assertEqual(c.get("layers")[0].get("getFillColor"), "@@=color")
        self.assertEqual(c.get("layers")[0].get("getRadius"), "@@=size")

        # Also test that the radius property is set up correctly.
        self.assertEqual(c.get("layers")[0].get("radiusMinPixels"), 3)

    def test_common_color_formats(self):
        """Test that users can pass colors in different formats."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "tuple3_int_color": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
                "tuple4_int_int_color": [
                    [255, 0, 0, 51],
                    [0, 255, 0, 51],
                    [0, 0, 255, 51],
                ],
                "tuple4_int_float_color": [
                    [255, 0, 0, 0.2],
                    [0, 255, 0, 0.2],
                    [0, 0, 255, 0.2],
                ],
                "tuple3_float_color": [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ],
                "tuple4_float_float_color": [
                    [1.0, 0.0, 0.0, 0.2],
                    [0.0, 1.0, 0.0, 0.2],
                    [0.0, 0.0, 1.0, 0.2],
                ],
                "hex3_color": ["#f00", "#0f0", "#00f"],
                "hex4_color": ["#f008", "#0f08", "#00f8"],
                "hex6_color": ["#ff0000", "#00ff00", "#0000ff"],
                "hex8_color": ["#ff000088", "#00ff0088", "#0000ff88"],
                "named_color": ["red", "green", "blue"],
            }
        )

        color_columns = sorted(set(df.columns))
        color_columns.remove("lat")
        color_columns.remove("lon")

        expected_values = {
            "tuple3": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
            "tuple4": [[255, 0, 0, 51], [0, 255, 0, 51], [0, 0, 255, 51]],
            "hex3": [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]],
            "hex6": [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]],
            # 88 in hex = 136
            "hex4": [[255, 0, 0, 136], [0, 255, 0, 136], [0, 0, 255, 136]],
            "hex8": [[255, 0, 0, 136], [0, 255, 0, 136], [0, 0, 255, 136]],
            "named": None,
        }

        def get_expected_color_values(col_name):
            for prefix, expected_color_values in expected_values.items():
                if col_name.startswith(prefix):
                    return expected_color_values

        for color_column in color_columns:
            expected_color_values = get_expected_color_values(color_column)

            if expected_color_values is None:
                with self.assertRaises(StreamlitAPIException):
                    st.map(df, color=color_column)

            else:
                st.map(df, color=color_column)
                c = json.loads(
                    self.get_delta_from_queue().new_element.deck_gl_json_chart.json
                )

                rows = c.get("layers")[0].get("data")

                for i, row in enumerate(rows):
                    self.assertEqual(row[color_column], expected_color_values[i])

    def test_unused_columns_get_dropped(self):
        """Test that unused columns don't get transmitted."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "int_color": [[255, 0, 0, 128], [0, 255, 0, 128], [0, 0, 255, 128]],
                "size": [100, 50, 30],
                "xlat": [-38.8762997, -38.8742997, -38.9025842],
                "xlon": [77.0037, 77.0057, 77.0556545],
            }
        )

        st.map(df)
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 2)

        st.map(df, latitude="xlat", longitude="xlon")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 2)

        st.map(df, latitude="xlat", longitude="xlon", color="int_color")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 3)

        st.map(df, latitude="xlat", longitude="xlon", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 3)

        st.map(df, latitude="xlat", longitude="xlon", color="int_color", size="size")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 4)

    def test_original_df_is_untouched(self):
        """Test that when we modify the outgoing DF we don't mutate the input DF."""
        df = pd.DataFrame(
            {
                "lat": [38.8762997, 38.8742997, 38.9025842],
                "lon": [-77.0037, -77.0057, -77.0556545],
                "foo": [0, 1, 2],
            }
        )

        st.map(df)
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(len(c.get("layers")[0].get("data")[0]), 2)
        self.assertEqual(len(df.columns), 3)

    # This test was turned off while we investigate issues with the feature.
    def turnedoff_test_map_style_raises_error(self):
        """Test that map_style raises error when no Mapbox token is present."""
        with self.assertRaises(StreamlitAPIException):
            st.map(df1, map_style="MY_MAP_STYLE")

    # This test was turned off while we investigate issues with the feature.
    @patch_config_options({"mapbox.token": "MY_TOKEN"})
    def turnedoff_test_map_style(self):
        """Test that map_style works when a Mapbox token is present."""
        st.map(df1, map_style="MY_MAP_STYLE")
        c = json.loads(self.get_delta_from_queue().new_element.deck_gl_json_chart.json)
        self.assertEqual(c.get("mapStyle"), "MY_MAP_STYLE")

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

        self.assertIn("not allowed to contain null values", str(ctx.exception))

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

    def test_id_changes_when_data_changes(self):
        st.map()

        orig_id = self.get_delta_from_queue().new_element.deck_gl_json_chart.id
        np.random.seed(0)

        df = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})
        st.map(df)
        new_id = self.get_delta_from_queue().new_element.deck_gl_json_chart.id
        self.assertNotEquals(orig_id, new_id)
