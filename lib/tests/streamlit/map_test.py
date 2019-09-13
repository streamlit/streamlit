# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""Unit tests for st.map()."""

import pandas as pd
import numpy as np
import json

from tests import testutil
import streamlit as st

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class StMapTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall deck_gl_chart protos via st.map."""

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.deck_gl_chart()

        c = self.get_delta_from_queue().new_element.deck_gl_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertEqual(json.loads(c.spec), {})

    def test_basic(self):
        """Test that deck_gl_chart can be called with lat/lon."""
        st.map(df1)

        c = self.get_delta_from_queue().new_element.deck_gl_chart

        self.assertEqual(c.HasField("data"), False)
        self.assertEqual(len(c.layers), 1)

        deck_gl_spec = json.loads(c.spec)

        assert "viewport" in deck_gl_spec

        self.assertEqual(deck_gl_spec["viewport"]["latitude"], 2.5)
        self.assertEqual(deck_gl_spec["viewport"]["longitude"], 25)
        self.assertEqual(deck_gl_spec["viewport"]["zoom"], 4)
        self.assertEqual(deck_gl_spec["viewport"]["pitch"], 0)

        layer = c.layers[0]
        spec = json.loads(layer.spec)
        isScatterplotLayer = spec["type"] == "ScatterplotLayer"
        assert isScatterplotLayer

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
