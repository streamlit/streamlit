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

import pytest

import streamlit as st
from streamlit.commands.query_params import QueryParams
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class QueryParamsAPITest(DeltaGeneratorTestCase):
    """Test Query params commands APIs."""

    def test_set_query_params_sends_protobuf_message(self):
        """Test valid st.set_query_params sends protobuf message."""
        st.experimental_set_query_params(x="a")
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "x=a")

    def test_set_query_params_exceptions(self):
        """Test invalid st.set_query_params raises exceptions."""
        with self.assertRaises(StreamlitAPIException):
            st.experimental_set_query_params(embed="True")
        with self.assertRaises(StreamlitAPIException):
            st.experimental_set_query_params(embed_options="show_colored_line")

    def test_get_query_params_after_set_query_params_single_element(self):
        """Test valid st.set_query_params sends protobuf message."""

        p_set = {"x": ["a"]}
        st.experimental_set_query_params(**p_set)
        p_get = st.experimental_get_query_params()
        self.assertEqual(p_get, {"x": "a"})

    def test_get_query_params_after_set_query_params_list(self):
        """Test valid st.set_query_params sends protobuf message."""

        p_set = {"x": ["a", "b"]}
        st.experimental_set_query_params(**p_set)
        p_get = st.experimental_get_query_params()
        self.assertEqual(p_get, p_set)

    def test_set_query_params_empty_str(self):
        empty_str_params = {"x": ["a"]}
        st.experimental_set_query_params(**empty_str_params)
        params_get = st.experimental_get_query_params()
        self.assertEqual(params_get, {"x": "a"})


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        # internally, query_params sets the value to lists because of the parse.parse_qs method
        self.q_params = {"foo": "bar", "baz": 1, "corge": 1.23, "two": ["x", "y"]}
        self.query_params = QueryParams(self.q_params)

    def test_getitem_nonexistent(self):
        with pytest.raises(KeyError):
            self.query_params["nonexistent"]

    def test_getitem_list(self):
        assert self.query_params["two"] == "y"

    def test_getitem_single_element_int(self):
        assert self.query_params["baz"] == "1"

    def test_getitem_single_element_float(self):
        assert self.query_params["corge"] == "1.23"

    def test__getitem__value(self):
        assert self.query_params["foo"] == "bar"

    def test_get(self):
        assert self.query_params.get("baz") == "1"

    def test__getattribute__(self):
        assert self.query_params.baz == "1"

    def test__setitem__query_params(self):
        assert "test" not in self.query_params
        self.query_params["test"] = "test"
        assert self.query_params.get("test") == "test"
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "test=test")

    def test__setitem_empty_string(self):
        assert "test" not in self.query_params
        self.query_params["test"] = ""
        assert self.query_params["test"] == ""
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "test=")

    def test_getall_nonexistent(self):
        assert self.query_params.get_all("nonexistent") == []

    def test_getall_single_element(self):
        assert self.query_params.get_all("foo") == ["bar"]

    def test_getall_list(self):
        assert self.query_params.get_all("two") == ["x", "y"]
