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

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.query_params import QueryParams
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class QueryParamsMethodTests(DeltaGeneratorTestCase):
    query_params_dict_with_embed_key = {
        "foo": "bar",
        "two": ["x", "y"],
        "embed": "true",
        "embed_options": "disable_scrolling",
    }

    def setUp(self):
        super().setUp()
        self.query_params = QueryParams()
        self.query_params._query_params = {"foo": "bar", "two": ["x", "y"]}

    def test__iter__doesnt_include_embed_keys(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        for key in self.query_params.__iter__():
            if key == "embed" or key == "embed_options":
                raise KeyError("Cannot iterate through embed or embed_options key")

    def test__getitem__raises_KeyError_for_nonexistent_key_for_embed(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        with pytest.raises(KeyError):
            self.query_params["embed"]

    def test__getitem__raises_KeyError_for_nonexistent_key_for_embed_options(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        with pytest.raises(KeyError):
            self.query_params["embed_options"]

    def test__getitem__raises_KeyError_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            self.query_params["nonexistent"]

    def test__getitem__returns_last_element_of_list(self):
        assert self.query_params["two"] == "y"

    def test__getitem__retrieves_existing_key(self):
        assert self.query_params["foo"] == "bar"

    def test__setitem__converts_int_value_to_string(self):
        self.query_params["baz"] = 1
        assert self.query_params["baz"] == "1"
        message = self.get_message_from_queue(0)
        assert "baz=1" in message.page_info_changed.query_string

    def test__setitem__converts_float_value_to_string(self):
        self.query_params["corge"] = 1.23
        assert self.query_params["corge"] == "1.23"
        message = self.get_message_from_queue(0)
        assert "corge=1.23" in message.page_info_changed.query_string

    def test__setitem__adds_new_str_query_param(self):
        assert "test" not in self.query_params
        self.query_params["test"] = "test"
        assert self.query_params.get("test") == "test"
        message = self.get_message_from_queue(0)
        assert "test=test" in message.page_info_changed.query_string

    def test__setitem__adds_empty_string_value(self):
        assert "test" not in self.query_params
        self.query_params["test"] = ""
        assert self.query_params["test"] == ""
        message = self.get_message_from_queue(0)
        assert "foo=bar&two=x&two=y&test=" == message.page_info_changed.query_string

    def test__setitem__adds_list_value(self):
        self.query_params["test"] = ["test", "test2"]
        assert self.query_params["test"] == "test2"
        message = self.get_message_from_queue(0)
        assert "test=test&test=test2" in message.page_info_changed.query_string

    def test__setitem__adds_tuple_value(self):
        self.query_params["test"] = (1, 2, 3)
        assert self.query_params["test"] == "3"
        message = self.get_message_from_queue(0)
        assert "test=1&test=2&test=3" in message.page_info_changed.query_string

    def test__setitem__adds_set_value(self):
        self.query_params["test"] = set({1, 2, 3})
        assert self.query_params["test"] == "3"
        message = self.get_message_from_queue(0)
        assert "test=1&test=2&test=3" in message.page_info_changed.query_string

    def test__setitem__sets_old_query_param_key(self):
        self.query_params["foo"] = "test"
        assert self.query_params.get("foo") == "test"
        message = self.get_message_from_queue(0)
        assert "foo=test" in message.page_info_changed.query_string

    def test__setitem__raises_StreamlitException_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["foo"] = {"test": "test"}

    def test__setitem__raises_exception_for_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed"] = True

    def test__setitem__raises_exception_for_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed_options"] = "show_toolbar"

    def test__setitem__raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params["embed"] = "true"

    def test_update_adds_values(self):
        self.query_params.update({"foo": "bar"})
        assert self.query_params.get("foo") == "bar"
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string

    def test_update_raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"foo": "bar", "embed": "true"})

    def test_update_raises_error_with_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"foo": "bar", "embed_options": "show_toolbar"})

    def test_update_raises_exception_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.update({"a_dict": {"test": "test"}})

    def test_update_changes_values_in_single_message(self):
        self.query_params.set_with_no_forward_msg("foo", "test")
        self.query_params.update({"foo": "bar", "baz": "test"})
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("baz") == "test"
        assert len(self.forward_msg_queue) == 1
        message = self.get_message_from_queue(0)
        assert "foo=bar" in message.page_info_changed.query_string
        assert "baz=test" in message.page_info_changed.query_string

    def test__delitem__removes_existing_key(self):
        del self.query_params["foo"]
        assert "foo" not in self.query_params
        message = self.get_message_from_queue(0)
        assert "two=x&two=y" in message.page_info_changed.query_string
        assert "foo" not in message.page_info_changed.query_string

    def test__delitem__raises_error_for_nonexistent_key(self):
        with pytest.raises(KeyError):
            del self.query_params["nonexistent"]

    def test__delitem__throws_KeyErrorException_for_embed_key(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        with pytest.raises(KeyError):
            del self.query_params["embed"]
        assert "embed" in self.query_params._query_params

    def test__delitem__throws_KeyErrorException_for_embed_options_key(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        with pytest.raises(KeyError):
            del self.query_params["embed_options"]
        assert "embed_options" in self.query_params._query_params

    def test_get_all_returns_empty_list_for_nonexistent_key(self):
        assert self.query_params.get_all("nonexistent") == []

    def test_get_all_retrieves_single_element_list(self):
        assert self.query_params.get_all("foo") == ["bar"]

    def test_get_all_retrieves_multiple_values_as_list(self):
        assert self.query_params.get_all("two") == ["x", "y"]

    def test_get_all_handles_mixed_type_values(self):
        self.query_params["test"] = ["", "a", 1, 1.23]
        assert self.query_params.get_all("test") == ["", "a", "1", "1.23"]

    def test_get_all_returns_empty_array_for_embed_key(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        assert self.query_params.get_all("embed") == []

    def test_get_all_returns_empty_array_for_embed_options_key(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        assert self.query_params.get_all("embed_options") == []

    def test__len__doesnt_include_embed_and_embed_options_key(self):
        self.query_params._query_params = self.query_params_dict_with_embed_key
        assert len(self.query_params) == 2

    def test_clear_removes_all_query_params(self):
        self.query_params.clear()
        assert len(self.query_params) == 0
        message = self.get_message_from_queue(0)
        assert "" == message.page_info_changed.query_string

    def test_clear_doesnt_remove_embed_query_params(self):
        self.query_params._query_params = {
            "foo": "bar",
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        result_dict = {
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        self.query_params.clear()
        assert self.query_params._query_params == result_dict

    def test_to_dict(self):
        self.query_params["baz"] = ""
        result_dict = {"foo": "bar", "two": "y", "baz": ""}
        assert self.query_params.to_dict() == result_dict

    def test_to_dict_doesnt_include_embed_params(self):
        self.query_params._query_params = {
            "foo": "bar",
            "embed": "true",
            "embed_options": ["show_colored_line", "disable_scrolling"],
        }
        result_dict = {"foo": "bar"}
        assert self.query_params.to_dict() == result_dict

    def test_from_dict(self):
        result_dict = {"hello": "world"}
        self.query_params.from_dict(result_dict)
        assert self.query_params.to_dict() == result_dict

    def test_from_dict_iterable(self):
        self.query_params.from_dict((("key1", 5), ("key2", 6)))
        assert self.query_params._query_params == {"key1": "5", "key2": "6"}

    def test_from_dict_mixed_values(self):
        result_dict = {"hello": ["world", "janice", "amy"], "snow": "flake"}
        self.query_params.from_dict(result_dict)

        # self.query_params.to_dict() has behavior consistent with fetching values using
        # self.query_params["some_key"]. That is, if the value is an array, the last
        # element of the array is returned rather than the array in its entirety.
        assert self.query_params.to_dict() == {"hello": "amy", "snow": "flake"}

        result_as_list = {"hello": ["world", "janice", "amy"], "snow": ["flake"]}
        qp_as_list = {key: self.query_params.get_all(key) for key in self.query_params}
        assert result_as_list == qp_as_list

    def test_from_dict_preserves_embed_keys(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.from_dict({"a": "b", "c": "d"})
        assert self.query_params._query_params == {
            "a": "b",
            "c": "d",
            "embed_options": ["disable_scrolling", "show_colored_line"],
        }

    def test_from_dict_preserves_last_value_on_error(self):
        old_value = self.query_params._query_params
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"a": "b", "embed": False})
        assert self.query_params._query_params == old_value

    def test_from_dict_changes_values_in_single_message(self):
        self.query_params.set_with_no_forward_msg("hello", "world")
        self.query_params.from_dict({"foo": "bar", "baz": "test"})
        assert self.query_params.get("foo") == "bar"
        assert self.query_params.get("baz") == "test"
        assert len(self.forward_msg_queue) == 1
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "foo=bar&baz=test"

    def test_from_dict_raises_error_with_embed_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"foo": "bar", "embed": "true"})

    def test_from_dict_raises_error_with_embed_options_key(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"foo": "bar", "embed_options": "show_toolbar"})

    def test_from_dict_raises_exception_with_dictionary_value(self):
        with pytest.raises(StreamlitAPIException):
            self.query_params.from_dict({"a_dict": {"test": "test"}})

    def test_from_dict_inverse(self):
        self.query_params.from_dict({"a": "b", "c": "d"})
        assert self.query_params._query_params == {"a": "b", "c": "d"}
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "a=b&c=d"
        from_dict_inverse = {
            key: self.query_params.get_all(key) for key in self.query_params
        }
        self.query_params.from_dict(from_dict_inverse)
        assert self.query_params._query_params == {"a": ["b"], "c": ["d"]}
        message = self.get_message_from_queue(0)
        assert message.page_info_changed.query_string == "a=b&c=d"

    def test_set_with_no_forward_msg_sends_no_msg_and_sets_query_params(self):
        self.query_params.set_with_no_forward_msg("test", "test")
        assert self.query_params["test"] == "test"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_embed(self):
        self.query_params.set_with_no_forward_msg("embed", "true")
        assert self.query_params._query_params["embed"] == "true"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_embed_options(self):
        self.query_params.set_with_no_forward_msg("embed_options", "disable_scrolling")
        assert self.query_params._query_params["embed_options"] == "disable_scrolling"
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_set_with_no_forward_msg_accepts_multiple_embed_options(self):
        self.query_params.set_with_no_forward_msg(
            "embed_options", ["disable_scrolling", "show_colored_line"]
        )
        assert self.query_params._query_params["embed_options"] == [
            "disable_scrolling",
            "show_colored_line",
        ]
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_clear_with_no_forward_msg_sends_no_msg_and_clears_query_params(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.clear_with_no_forward_msg()
        assert len(self.query_params) == 0
        assert len(self.query_params._query_params) == 0
        with pytest.raises(IndexError):
            # no forward message should be sent
            self.get_message_from_queue(0)

    def test_clear_with_no_forward_msg_preserve_embed_keys(self):
        self.query_params._query_params.update(
            {"embed_options": ["disable_scrolling", "show_colored_line"]}
        )
        self.query_params.clear_with_no_forward_msg(preserve_embed=True)
        assert len(self.query_params) == 0
        assert len(self.query_params._query_params) == 1
        assert self.query_params._query_params["embed_options"] == (
            ["disable_scrolling", "show_colored_line"]
        )
