# Copyright 2018-2022 Streamlit Inc.
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

"""AutoSessionState unit tests."""

import unittest
from unittest.mock import patch, MagicMock

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.state.auto_session_state import AutoSessionState
from streamlit.state.session_state import (
    GENERATED_WIDGET_KEY_PREFIX,
    SessionState,
    validate_key,
)


@patch(
    "streamlit.state.auto_session_state.get_session_state",
    return_value=MagicMock(filtered_state={"foo": "bar"}),
)
class AutoSessionStateTests(unittest.TestCase):
    reserved_key = f"{GENERATED_WIDGET_KEY_PREFIX}-some_key"

    def setUp(self):
        self.auto_session_state = AutoSessionState()

    def test_iter(self, _):
        state_iter = iter(self.auto_session_state)
        assert next(state_iter) == "foo"
        with pytest.raises(StopIteration):
            next(state_iter)

    def test_len(self, _):
        assert len(self.auto_session_state) == 1

    def test_validate_key(self, _):
        with pytest.raises(StreamlitAPIException) as e:
            validate_key(self.reserved_key)
        assert "are reserved" in str(e.value)

    def test_to_dict(self, _):
        assert self.auto_session_state.to_dict() == {"foo": "bar"}

    # NOTE: We only test the error cases of {get, set, del}{item, attr} below
    # since the others are tested in another test class.
    def test_getitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            self.auto_session_state[self.reserved_key]

    def test_setitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            self.auto_session_state[self.reserved_key] = "foo"

    def test_delitem_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            del self.auto_session_state[self.reserved_key]

    def test_getattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            getattr(self.auto_session_state, self.reserved_key)

    def test_setattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            setattr(self.auto_session_state, self.reserved_key, "foo")

    def test_delattr_reserved_key(self, _):
        with pytest.raises(StreamlitAPIException):
            delattr(self.auto_session_state, self.reserved_key)


class AutoSessionStateAttributeTests(unittest.TestCase):
    """Tests of AutoSessionState attribute methods.

    Separate from the others to change patching. Test methods are individually
    patched to avoid issues with mutability.
    """

    def setUp(self):
        self.auto_session_state = AutoSessionState()

    @patch(
        "streamlit.state.auto_session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_delattr(self, _):
        del self.auto_session_state.foo
        assert "foo" not in self.auto_session_state

    @patch(
        "streamlit.state.auto_session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_getattr(self, _):
        assert self.auto_session_state.foo == "bar"

    @patch(
        "streamlit.state.auto_session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_getattr_error(self, _):
        with pytest.raises(AttributeError):
            del self.auto_session_state.nonexistent

    @patch(
        "streamlit.state.auto_session_state.get_session_state",
        return_value=SessionState(new_session_state={"foo": "bar"}),
    )
    def test_setattr(self, _):
        self.auto_session_state.corge = "grault2"
        assert self.auto_session_state.corge == "grault2"
