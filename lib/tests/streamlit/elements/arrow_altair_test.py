# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import json
from unittest import mock

import altair as alt
import pandas as pd
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import bytes_to_data_frame
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class ArrowAltairTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow_altair_chart proto."""

    def test_altair_chart(self):
        """Test that it can be called with args."""
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")
        EXPECTED_DATAFRAME = pd.DataFrame(
            {
                "a": ["A", "B", "C", "D"],
                "b": [28, 55, 43, 91],
            }
        )

        st.altair_chart(chart)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        self.assertEqual(proto.HasField("data"), False)
        self.assertEqual(len(proto.datasets), 1)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data), EXPECTED_DATAFRAME
        )

        spec_dict = json.loads(proto.spec)
        self.assertEqual(
            spec_dict["encoding"],
            {
                "y": {"field": "b", "type": "quantitative"},
                "x": {"field": "a", "type": "nominal"},
            },
        )
        self.assertEqual(spec_dict["data"], {"name": proto.datasets[0].name})
        self.assertIn(spec_dict["mark"], ["bar", {"type": "bar"}])
        self.assertTrue("encoding" in spec_dict)

    def test_altair_chart_uses_convert_anything_to_df(self):
        """Test that st.altair_chart uses convert_anything_to_df to convert input data."""
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")

        with mock.patch(
            "streamlit.type_util.convert_anything_to_df"
        ) as convert_anything_to_df:
            convert_anything_to_df.return_value = df

            st.altair_chart(chart)
            convert_anything_to_df.assert_called_once()

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")

        st.altair_chart(chart, theme=theme_value)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.arrow_vega_lite_chart.theme, proto_value)

    def test_bad_theme(self):
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")

        with self.assertRaises(StreamlitAPIException) as exc:
            st.altair_chart(chart, theme="bad_theme")

        self.assertEqual(
            f'You set theme="bad_theme" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.',
            str(exc.exception),
        )

    def test_empty_altair_chart_throws_error(self):
        with self.assertRaises(TypeError):
            st.altair_chart(use_container_width=True)
