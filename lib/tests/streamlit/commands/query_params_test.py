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

    def test_get_query_params_after_set_query_params(self):
        """Test valid st.set_query_params sends protobuf message."""
        p_set = dict(x=["a"])
        st.experimental_set_query_params(**p_set)
        p_get = st.experimental_get_query_params()
        self.assertEqual(p_get, p_set)

    def test_set_query_params_empty_str(self):
        empty_str_params = dict(x=[""])
        st.experimental_set_query_params(**empty_str_params)
        params_get = st.experimental_get_query_params()
        self.assertEqual(params_get, empty_str_params)


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        self.q_params = {"foo": "bar", "a": "a"}
        self.query_params = QueryParams(self.q_params)

    def test_contains_valid(self):
        assert "foo" in self.query_params

    def test_contains_invalid(self):
        assert "baz" not in self.query_params

    def test_clear(self):
        self.query_params.clear()
        assert len(self.query_params) == 0
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "")

    def test_del_valid(self):
        del self.query_params["foo"]
        assert "foo" not in self.query_params
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "a=a")

    def test_del_invalid(self):
        del self.query_params["nonexistent"]

        # no forward message should be sent
        with pytest.raises(IndexError):
            self.get_message_from_queue(0)
