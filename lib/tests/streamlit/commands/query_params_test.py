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
        self.assertEqual(p_get, p_set)

    def test_get_query_params_after_set_query_params_list(self):
        """Test valid st.set_query_params sends protobuf message."""

        p_set = {"x": ["a", "b"]}
        st.experimental_set_query_params(**p_set)
        p_get = st.experimental_get_query_params()
        self.assertEqual(p_get, p_set)

    def test_set_query_params_empty_str(self):
        empty_str_params = {"x": [""]}
        st.experimental_set_query_params(**empty_str_params)
        params_get = st.experimental_get_query_params()
        self.assertEqual(params_get, empty_str_params)


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        self.q_params = {"foo": "bar", "two": ["x", "y"]}
        self._query_params = QueryParams(self.q_params)

    def test_getitem_nonexistent(self):
        with pytest.raises(KeyError) as exception_message:
            self._query_params["nonexistent"]
            assert (
                exception_message
                == 'st.query_params has no key "nonexistent". Did you forget to initialize it? '
            )

    def test__getattr__nonexistent(self):
        with pytest.raises(AttributeError) as exception_message:
            self._query_params.nonexistent
            assert (
                exception_message
                == 'st.query_params has no key "nonexistent". Did you forget to initialize it? '
            )

    def test_getitem_list(self):
        # get the last item in the array
        assert self._query_params["two"] == "y"

    def test_getitem_single_element_int(self):
        # Internal state is always a string so we test setting it here
        self._query_params["baz"] = 1
        assert self._query_params["baz"] == "1"

    def test_getitem_single_element_float(self):
        # Internal state is always a string so we test setting it here
        self._query_params["corge"] = 1.23
        assert self._query_params["corge"] == "1.23"

    def test__getitem__value(self):
        assert self._query_params["foo"] == "bar"

    def test_get(self):
        assert self._query_params.get("foo") == "bar"

    def test_get_default(self):
        self._query_params.get("dog", default="bark")
        assert self._query_params["dog"] == "bark"
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "dog=bark")

    def test__getattr__(self):
        assert self._query_params.foo == "bar"

    def test__setitem__query_params(self):
        assert "test" not in self._query_params
        self._query_params["test"] = "test"
        assert self._query_params.get("test") == "test"
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "test=test")

    def test__setitem_empty_string(self):
        assert "test" not in self._query_params
        self._query_params["test"] = ""
        assert self._query_params["test"] == ""
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "test=")

    def test__setattr__(self):
        self._query_params.test = "test"
        assert self._query_params.get("test") == "test"

    def test__setattr__list(self):
        self._query_params.test = ["test", "test2"]
        assert self._query_params.get("test") == "test2"
        message = self.get_message_from_queue(0)
        assert (message.page_info_changed.query_string, "test=test&test=test2")

    def test_getall_nonexistent(self):
        assert self._query_params.get_all("nonexistent") == []

    def test_getall_single_element(self):
        assert self._query_params.get_all("foo") == ["bar"]

    def test_getall_list(self):
        assert self._query_params.get_all("two") == ["x", "y"]

    def test_getall_list_non_str_and_empty_str(self):
        self._query_params["test"] = ["", "a", 1, 1.23]
        assert self._query_params.get_all("test") == ["", "a", "1", "1.23"]

    def test_contains_valid(self):
        assert "foo" in self._query_params

    def test_contains_invalid(self):
        assert "baz" not in self._query_params

    def test_clear(self):
        self._query_params.clear()
        assert len(self._query_params) == 0
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "")

    def test_del_valid(self):
        del self._query_params["foo"]
        assert "foo" not in self._query_params
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "two=x&two=y")

    def test_del_invalid(self):
        del self._query_params["nonexistent"]

        # no forward message should be sent
        with pytest.raises(IndexError):
            self.get_message_from_queue(0)
