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

import unittest
from collections import namedtuple
from unittest.mock import patch

import pandas as pd
import plotly.graph_objs as go
from pandas.api.types import infer_dtype

from streamlit import type_util
from streamlit.type_util import (
    data_frame_to_bytes,
    fix_unsupported_column_types,
    is_bytes_like,
    to_bytes,
)


class TypeUtilTest(unittest.TestCase):
    def test_list_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        data = [trace0, trace1]

        res = type_util.is_plotly_chart(data)
        self.assertTrue(res)

    def test_data_dict_is_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1]}

        res = type_util.is_plotly_chart(d)
        self.assertTrue(res)

    def test_dirty_data_dict_is_not_plotly_chart(self):
        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])
        d = {"data": [trace0, trace1], "foo": "bar"}  # Illegal property!

        res = type_util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_layout_dict_is_not_plotly_chart(self):
        d = {
            # Missing a component with a graph object!
            "layout": {"width": 1000}
        }

        res = type_util.is_plotly_chart(d)
        self.assertFalse(res)

    def test_fig_is_plotly_chart(self):
        trace1 = go.Scatter(x=[1, 2, 3, 4], y=[16, 5, 11, 9])

        # Plotly 3.7 needs to read the config file at /home/.plotly when
        # creating an image. So let's mock that part of the Figure creation:
        with patch("plotly.offline.offline._get_jconfig") as mock:
            mock.return_value = {}
            fig = go.Figure(data=[trace1])

        res = type_util.is_plotly_chart(fig)
        self.assertTrue(res)

    def test_is_namedtuple(self):
        Boy = namedtuple("Boy", ("name", "age"))
        John = Boy("John", "29")

        res = type_util.is_namedtuple(John)
        self.assertTrue(res)

    def test_to_bytes(self):
        bytes_obj = b"some bytes"
        self.assertTrue(is_bytes_like(bytes_obj))
        self.assertIsInstance(to_bytes(bytes_obj), bytes)

        bytearray_obj = bytearray("a bytearray string", "utf-8")
        self.assertTrue(is_bytes_like(bytearray_obj))
        self.assertIsInstance(to_bytes(bytearray_obj), bytes)

        string_obj = "a normal string"
        self.assertFalse(is_bytes_like(string_obj))
        with self.assertRaises(RuntimeError):
            to_bytes(string_obj)

    def test_data_frame_with_dtype_values_to_bytes(self):
        df1 = pd.DataFrame(["foo", "bar"])
        df2 = pd.DataFrame(df1.dtypes)

        try:
            data_frame_to_bytes(df2)
        except Exception as ex:
            self.fail(f"Converting dtype dataframes to Arrow should not fail: {ex}")

    def test_fix_unsupported_column_types(self):
        df = pd.DataFrame(
            {
                "mixed-integer": [1, "foo", 3],
                "mixed": [1.0, "foo", 3],
                "complex": [1 + 2j, 3 + 4j, 5 + 6 * 1j],
                "integer": [1, 2, 3],
                "float": [1.0, 2.1, 3.2],
                "string": ["foo", "bar", None],
            }
        )

        fixed_df = fix_unsupported_column_types(df)

        self.assertEqual(infer_dtype(fixed_df["mixed-integer"]), "string")
        self.assertEqual(infer_dtype(fixed_df["mixed"]), "string")
        self.assertEqual(infer_dtype(fixed_df["complex"]), "string")
        self.assertEqual(infer_dtype(fixed_df["integer"]), "integer")
        self.assertEqual(infer_dtype(fixed_df["float"]), "floating")
        self.assertEqual(infer_dtype(fixed_df["string"]), "string")
        self.assertEqual(
            str(fixed_df.dtypes),
            """mixed-integer     object
mixed             object
complex           object
integer            int64
float            float64
string            object
dtype: object""",
        )
