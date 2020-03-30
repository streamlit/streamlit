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

"""st.altair_chart unit test."""
from datetime import date
from functools import reduce

import altair as alt
import json
import pandas as pd

from streamlit.elements import altair
from tests import testutil
import streamlit as st


def _deep_get(dictionary, *keys):
    return reduce(
        lambda d, key: d.get(key, None) if isinstance(d, dict) else None,
        keys,
        dictionary,
    )


class AltairTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall altair_chart proto."""

    def test_altair_chart(self):
        """Test that it can be called with no args."""
        df1 = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T

        c1 = alt.Chart(df1).mark_bar().encode(x="a", y="b")

        st.altair_chart(c1)

        c = self.get_delta_from_queue().new_element.vega_lite_chart
        self.assertEqual(c.HasField("data"), False)
        self.assertEqual(len(c.datasets), 1)

        spec_dict = json.loads(c.spec)
        self.assertEqual(
            spec_dict["encoding"],
            {
                "y": {"field": "b", "type": "quantitative"},
                "x": {"field": "a", "type": "nominal"},
            },
        )
        self.assertEqual(spec_dict["data"], {"name": c.datasets[0].name})
        self.assertEqual(spec_dict["mark"], "bar")
        self.assertTrue("config" in spec_dict)
        self.assertTrue("encoding" in spec_dict)

    def test_date_column_utc_scale(self):
        """Test that columns with date values have UTC time scale"""
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart = altair.generate_chart("line", df)
        st.altair_chart(chart)
        c = self.get_delta_from_queue().new_element.vega_lite_chart
        spec_dict = json.loads(c.spec)

        # The x axis should have scale="utc", because it uses date values.
        x_scale = _deep_get(spec_dict, "encoding", "x", "scale", "type")
        self.assertEqual(x_scale, "utc")

        # The y axis should _not_ have scale="utc", because it doesn't
        # use date values.
        y_scale = _deep_get(spec_dict, "encoding", "y", "scale", "type")
        self.assertNotEqual(y_scale, "utc")
