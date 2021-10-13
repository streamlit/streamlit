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

import unittest
from collections import namedtuple
from unittest.mock import patch

import pandas as pd
import plotly.graph_objs as go

from streamlit import type_util
from streamlit.type_util import data_frame_to_bytes, is_bytes_like, to_bytes
from streamlit.errors import NumpyDtypeException


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

    def test_data_frame_to_bytes_numpy_dtype_exception(self):
        df1 = pd.DataFrame(["foo", "bar"])
        df2 = pd.DataFrame(df1.dtypes)

        with self.assertRaises(NumpyDtypeException):
            data_frame_to_bytes(df2)
