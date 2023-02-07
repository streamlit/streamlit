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

"""SessionStateProxy unit tests."""

import unittest
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import SafeSessionState, SessionState, SessionStateProxy
from streamlit.runtime.state.util import (
    GENERATED_WIDGET_ID_PREFIX,
    require_valid_user_key,
)


def _create_mock_session_state(
    initial_state_values: Dict[str, Any]
) -> SafeSessionState:
    """Return a new SafeSessionState instance populated with the
    given state values.
    """
    session_state = SessionState()
    for key, value in initial_state_values.items():
        session_state[key] = value
    return SafeSessionState(session_state)


@patch(
    "streamlit.runtime.state.session_state_proxy.get_session_state",
    MagicMock(return_value=_create_mock_session_state({"foo": "bar"})),
)
class SessionStateProxyTests(unittest.TestCase):
    reserved_key = f"{GENERATED_WIDGET_ID_PREFIX}-some_key"

    def setUp(self):
        self.session_state_proxy = SessionStateProxy()

    def test_iter(self):
        state_iter = iter(self.session_state_proxy)
        assert next(state_iter) == "foo"
        with pytest.raises(StopIteration):
            next(state_iter)

    def test_len(self):
        assert len(self.session_state_proxy) == 1

    def test_validate_key(self):
        with pytest.raises(StreamlitAPIException) as e:
            require_valid_user_key(self.reserved_key)
        assert "are reserved" in str(e.value)

    def test_to_dict(self):
        assert self.session_state_proxy.to_dict() == {"foo": "bar"}

    # NOTE: We only test the error cases of {get, set, del}{item, attr} below
    # since the others are tested in another test class.
    def test_getitem_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            _ = self.session_state_proxy[self.reserved_key]

    def test_setitem_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            self.session_state_proxy[self.reserved_key] = "foo"

    def test_delitem_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            del self.session_state_proxy[self.reserved_key]

    def test_getattr_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            getattr(self.session_state_proxy, self.reserved_key)

    def test_setattr_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            setattr(self.session_state_proxy, self.reserved_key, "foo")

    def test_delattr_reserved_key(self):
        with pytest.raises(StreamlitAPIException):
            delattr(self.session_state_proxy, self.reserved_key)


class SessionStateProxyAttributeTests(unittest.TestCase):
    """Tests of SessionStateProxy attribute methods.

    Separate from the others to change patching. Test methods are individually
    patched to avoid issues with mutability.
    """

    def setUp(self):
        self.session_state_proxy = SessionStateProxy()

    @patch(
        "streamlit.runtime.state.session_state_proxy.get_session_state",
        MagicMock(return_value=SessionState(_new_session_state={"foo": "bar"})),
    )
    def test_delattr(self):
        del self.session_state_proxy.foo
        assert "foo" not in self.session_state_proxy

    @patch(
        "streamlit.runtime.state.session_state_proxy.get_session_state",
        MagicMock(return_value=SessionState(_new_session_state={"foo": "bar"})),
    )
    def test_getattr(self):
        assert self.session_state_proxy.foo == "bar"

    @patch(
        "streamlit.runtime.state.session_state_proxy.get_session_state",
        MagicMock(return_value=SessionState(_new_session_state={"foo": "bar"})),
    )
    def test_getattr_error(self):
        with pytest.raises(AttributeError):
            del self.session_state_proxy.nonexistent

    @patch(
        "streamlit.runtime.state.session_state_proxy.get_session_state",
        MagicMock(return_value=SessionState(_new_session_state={"foo": "bar"})),
    )
    def test_setattr(self):
        self.session_state_proxy.corge = "grault2"
        assert self.session_state_proxy.corge == "grault2"
