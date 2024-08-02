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

from __future__ import annotations

import unittest
from collections import namedtuple
from unittest.mock import patch

import numpy as np
import pandas as pd
import plotly.graph_objs as go
import pytest
from parameterized import parameterized

from streamlit import type_util
from streamlit.errors import StreamlitAPIException


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
        Boy = namedtuple("Boy", ("name", "age"))  # noqa: PYI024
        John = Boy("John", "29")

        res = type_util.is_namedtuple(John)
        self.assertTrue(res)

    def test_is_pydantic_model(self):
        from pydantic import BaseModel

        class BarModel(BaseModel):
            foo: int
            bar: str

        self.assertTrue(type_util.is_pydantic_model(BarModel(foo=1, bar="test")))
        self.assertFalse(type_util.is_pydantic_model(BarModel))

    def test_to_bytes(self):
        bytes_obj = b"some bytes"
        self.assertTrue(type_util.is_bytes_like(bytes_obj))
        self.assertIsInstance(type_util.to_bytes(bytes_obj), bytes)

        bytearray_obj = bytearray("a bytearray string", "utf-8")
        self.assertTrue(type_util.is_bytes_like(bytearray_obj))
        self.assertIsInstance(type_util.to_bytes(bytearray_obj), bytes)

        string_obj = "a normal string"
        self.assertFalse(type_util.is_bytes_like(string_obj))
        with self.assertRaises(RuntimeError):
            type_util.to_bytes(string_obj)  # type: ignore

    @parameterized.expand(
        [
            ([1, 2, 3],),
            (["foo", "bar", "baz"],),
            (np.array([1, 2, 3, 4]),),
            (pd.Series([1, 2, 3]),),
        ]
    )
    def test_check_python_comparable(self, sequence):
        """Test that `check_python_comparable` not raises exception
        when elements of sequence returns bool when compared."""

        # Just check that it should not raise any exception
        type_util.check_python_comparable(sequence)

    @parameterized.expand(
        [
            (np.array([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]), "ndarray"),
            ([pd.Series([1, 2, 3]), pd.Series([4, 5, 6])], "Series"),
        ]
    )
    def test_check_python_comparable_exception(self, sequence, type_str):
        """Test that `check_python_comparable` raises an exception if ndarray."""
        with pytest.raises(StreamlitAPIException) as exception_message:
            type_util.check_python_comparable(sequence)
        self.assertEqual(
            (
                "Invalid option type provided. Options must be comparable, returning a "
                f"boolean when used with *==*. \n\nGot **{type_str}**, which cannot be "
                "compared. Refactor your code to use elements of comparable types as "
                "options, e.g. use indices instead."
            ),
            str(exception_message.value),
        )

    def test_has_callable_attr(self):
        class TestClass:
            def __init__(self) -> None:
                self.also_not_callable = "I am not callable"

            def callable_attr(self):
                pass

            @property
            def not_callable_attr(self):
                return "I am a property"

        assert type_util.has_callable_attr(TestClass, "callable_attr") is True
        assert type_util.has_callable_attr(TestClass, "not_callable_attr") is False
        assert type_util.has_callable_attr(TestClass, "also_not_callable") is False
        assert type_util.has_callable_attr(TestClass, "not_a_real_attr") is False
