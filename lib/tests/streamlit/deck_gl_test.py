# Copyright 2018-2020 Streamlit Inc.
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

"""deck_gl unit test."""

from google.protobuf import json_format
import pandas as pd
import json

from tests import testutil
import streamlit as st

df1 = pd.DataFrame({"lat": [1, 2, 3, 4], "lon": [10, 20, 30, 40]})


class DeckGLTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall deck_gl_chart protos."""

    def test_basic(self):
        """Test that deck_gl_chart can be called with lat/lon."""

        st.deck_gl_chart(layers=[{"data": df1, "type": "ScatterplotLayer"}])

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.deck_gl_chart.HasField("data"), False)
        self.assertEqual(json.loads(el.deck_gl_chart.spec), {})

        data = el.deck_gl_chart.layers[0].data
        self.assertEqual(
            json.loads(json_format.MessageToJson(data.data.cols[0].int64s)),
            {"data": ["1", "2", "3", "4"]},
        )
        self.assertEqual(
            json.loads(json_format.MessageToJson(data.data.cols[1].int64s)),
            {"data": ["10", "20", "30", "40"]},
        )

        self.assertEqual(
            json.loads(
                json_format.MessageToJson(data.columns.plain_index.data.strings)
            ),
            {"data": ["lat", "lon"]},
        )

        # Default layer
        self.assertEqual(
            json.loads(el.deck_gl_chart.layers[0].spec), {"type": "ScatterplotLayer"}
        )

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.deck_gl_chart()

        c = self.get_delta_from_queue().new_element.deck_gl_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertEqual(json.loads(c.spec), {})

    def test_use_container_width_true(self):
        """Test that it can be called with no args."""
        st.deck_gl_chart(use_container_width=True)

        c = self.get_delta_from_queue().new_element.deck_gl_chart
        self.assertEqual(c.use_container_width, True)
