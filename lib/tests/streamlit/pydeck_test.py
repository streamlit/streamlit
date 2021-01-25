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

import json

from google.protobuf import json_format
import pandas as pd
import pydeck as pdk

from tests import testutil
import streamlit as st
import streamlit.elements.deck_gl_json_chart as deck_gl_json_chart

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class PyDeckTest(testutil.DeltaGeneratorTestCase):
    def test_basic(self):
        """Test that pydeck object orks."""

        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=df1),
                ]
            )
        )

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.json)

        self.assertEqual(actual["layers"][0]["@@type"], "ScatterplotLayer")
        self.assertEqual(
            actual["layers"][0]["data"],
            [
                {"lat": 1, "lon": 10},
                {"lat": 2, "lon": 20},
                {"lat": 3, "lon": 30},
                {"lat": 4, "lon": 40},
            ],
        )

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.pydeck_chart()

        el = self.get_delta_from_queue().new_element
        actual = json.loads(el.deck_gl_json_chart.json)

        self.assertEqual(actual, deck_gl_json_chart.EMPTY_MAP)
