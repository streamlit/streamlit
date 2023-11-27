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
from typing import Dict, List, Union
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.state.query_params import QueryParams
from streamlit.runtime.state.query_params_proxy import QueryParamsProxy
from streamlit.runtime.state.safe_session_state import SafeSessionState
from streamlit.runtime.state.session_state import SessionState


def _create_mock_session_state(
    initial_query_params_values: Dict[str, Union[List[str], str]]
) -> SafeSessionState:
    """Return a new SafeSessionState instance populated with the
    given query param values.
    """
    session_state = SessionState()
    query_params = QueryParams()
    for key, value in initial_query_params_values.items():
        query_params[key] = value
    session_state.query_params = query_params
    return SafeSessionState(session_state, lambda: None)


@patch(
    "streamlit.runtime.state.query_params_proxy.get_session_state",
    MagicMock(
        return_value=_create_mock_session_state(
            initial_query_params_values={"test": "value"}
        )
    ),
)
class TestQueryParamsProxy(unittest.TestCase):
    def setUp(self):
        self.query_params_proxy = QueryParamsProxy()

    def test__getitem__returns_correct_value(self):
        assert self.query_params_proxy["test"] == "value"

    def test__setitem__sets_entry(self):
        self.query_params_proxy["new_value"] = "value"
        assert self.query_params_proxy["new_value"] == "value"

    def test__delitem__deletes_entry(self):
        del self.query_params_proxy["test"]
        assert "test" not in self.query_params_proxy

        # reset query params proxy to avoid issues with mutability
        self.query_params_proxy["test"] = "value"

    def test__len__returns_correct_len(self):
        assert len(self.query_params_proxy) == 1

    def test__iter__returns_correct_iter(self):
        keys = list(iter(self.query_params_proxy))
        assert keys == ["test"]

    def test_clear_removes_all_entries(self):
        self.query_params_proxy.clear()
        assert len(self.query_params_proxy) == 0

    def test_get_all_returns_correct_list(self):
        self.query_params_proxy["test"] = ["value1", "value2"]
        assert self.query_params_proxy.get_all("test") == ["value1", "value2"]

    def test__getattr__returns_correct_value(self):
        self.query_params_proxy.test = "value"
        assert self.query_params_proxy.test == "value"

    def test__setattr__(self):
        self.query_params_proxy.test = "value"
        assert self.query_params_proxy["test"] == "value"

    def test__delattr__deletes_entry(self):
        del self.query_params_proxy.test
        assert "test" not in self.query_params_proxy

        # reset query params proxy to avoid issues with mutability
        self.query_params_proxy["test"] = "value"

    def test__getattr__raises_Attribute_exception(self):
        with pytest.raises(AttributeError):
            self.query_params_proxy.nonexistent

    def test__delattr__raises_Attribute_exception(self):
        with pytest.raises(AttributeError):
            del self.query_params_proxy.nonexistent
