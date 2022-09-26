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

import json

import numpy as np
import pandas as pd
from tests import testutil

import streamlit as st
from streamlit.elements.map import _DEFAULT_MAP, _DEFAULT_ZOOM_LEVEL

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class StMapTest(testutil.DeltaGeneratorTestCase):
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

    def test_missing_column(self):
        """Test st.map with wrong column label."""
        df = pd.DataFrame({"notlat": [1, 2, 3], "lon": [11, 12, 13]})
        with self.assertRaises(Exception) as ctx:
            st.map(df)

        self.assertTrue("Map data must contain a column named" in str(ctx.exception))

    def test_nan_exception(self):
        """Test st.map with NaN in data."""
        df = pd.DataFrame({"lat": [1, 2, np.nan], "lon": [11, 12, 13]})
        with self.assertRaises(Exception) as ctx:
            st.map(df)

        self.assertTrue("data must be numeric." in str(ctx.exception))
