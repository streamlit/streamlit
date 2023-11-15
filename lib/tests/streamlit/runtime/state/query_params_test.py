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

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.query_params import QueryParams
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    def setUp(self):
        super().setUp()
        self._query_params = QueryParams()
        # avoid using ._query_params as that will use __setattr__
        self._query_params.__dict__["_query_params"] = {"foo": "bar", "two": ["x", "y"]}

    def test__getitem__raises_KeyError_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            self._query_params["nonexistent"]

    def test__getattr__raises_AttributeError_for_nonexistent_key(self):
        with pytest.raises(AttributeError):
            self._query_params.nonexistent

    def test__getitem__returns_last_element_of_list(self):
        assert self._query_params["two"] == "y"

    def test__getitem__converts_int_value_to_string(self):
        self._query_params["baz"] = 1
        assert self._query_params["baz"] == "1"

    def test__getitem__converts_float_value_to_string(self):
        self._query_params["corge"] = 1.23
        assert self._query_params["corge"] == "1.23"

    def test__getitem__retrieves_existing_key(self):
        assert self._query_params["foo"] == "bar"

    def test_get_method_retrieves_existing_key(self):
        assert self._query_params.get("foo") == "bar"

    def test_get_method_returns_default_for_nonexistent_key(self):
        return_val = self._query_params.get("dog", default="bark")
        assert return_val == "bark"

    def test__getitem__retrieves_existing_key(self):
        assert self._query_params.foo == "bar"

    def test__setitem__adds_new_query_param(self):
        assert "test" not in self._query_params
        self._query_params["test"] = "test"
        assert self._query_params.get("test") == "test"
        message = self.get_message_from_queue(0)
        assert "test=test" in message.page_info_changed.query_string

    def test__setitem__handles_empty_string_value(self):
        assert "test" not in self._query_params
        self._query_params["test"] = ""
        assert self._query_params["test"] == ""
        message = self.get_message_from_queue(0)
        assert "test=" in message.page_info_changed.query_string

    def test__setattr__adds_new_query_param(self):
        self._query_params.test = "test"
        assert self._query_params.get("test") == "test"

    def test__setattr__sets_old_query_param_key(self):
        self._query_params.foo = "test"
        assert self._query_params.get("foo") == "test"

    def test__setattr__adds_list_value(self):
        self._query_params.test = ["test", "test2"]
        assert self._query_params["test"] == "test2"
        message = self.get_message_from_queue(0)
        assert "test=test&test=test2" in message.page_info_changed.query_string

    def test_get_all_returns_empty_list_for_nonexistent_key(self):
        assert self._query_params.get_all("nonexistent") == []

    def test_get_all_retrieves_single_element_list(self):
        assert self._query_params.get_all("foo") == ["bar"]

    def test_get_all_retrieves_multiple_values_as_list(self):
        assert self._query_params.get_all("two") == ["x", "y"]

    def test_get_all_handles_mixed_type_values(self):
        self._query_params["test"] = ["", "a", 1, 1.23]
        assert self._query_params.get_all("test") == ["", "a", "1", "1.23"]

    def test__contains__returns_true_for_present_key(self):
        assert "foo" in self._query_params

    def test__contains__returns_false_for_absent_key(self):
        assert "baz" not in self._query_params

    def test_clear_removes_all_query_params(self):
        self._query_params.clear()
        assert len(self._query_params) == 0
        message = self.get_message_from_queue(0)
        assert "" in message.page_info_changed.query_string

    def test__delitem__removes_existing_key(self):
        del self._query_params["foo"]
        assert "foo" not in self._query_params
        message = self.get_message_from_queue(0)
        assert "two=x&two=y" in message.page_info_changed.query_string
        assert "foo" not in message.page_info_changed.query_string

    def test__delattr__removes_existing_key(self):
        del self._query_params.foo
        assert "foo" not in self._query_params
        message = self.get_message_from_queue(0)
        assert "two=x&two=y" in message.page_info_changed.query_string
        assert "foo" not in message.page_info_changed.query_string

    def test_del_raises_error_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            del self._query_params["nonexistent"]

    def test_set_with_no_forward_msg_embed(self):
        self._query_params.set_with_no_forward_msg("embed", True)
        self._query_params.set_with_no_forward_msg("embed_options", "show_toolbar")
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)
        assert "embed" not in self._query_params
        assert "embed_options" not in self._query_params

    def test_set_with_no_forward_msg(self):
        self._query_params.set_with_no_forward_msg("test", "test")
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)
        assert self._query_params.test == "test"

    def test__setitem__raises_exception_for_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self._query_params["embed"] = True

    def test__setitem__raises_exception_for_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self._query_params["embed_options"] = "show_toolbar"
