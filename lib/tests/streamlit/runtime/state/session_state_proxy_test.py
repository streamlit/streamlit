# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import unittest
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import (
    SafeSessionState,
    SessionState,
    SessionStateProxy,
)
from streamlit.runtime.state import (
    session_state_proxy as session_state_proxy_module,
)
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    require_valid_user_key,
)
from streamlit.runtime.state.session_state_proxy import get_session_state

if TYPE_CHECKING:
    from collections.abc import Iterator


def _create_mock_session_state(
    initial_state_values: dict[str, Any],
) -> SafeSessionState:
    """Return a new SafeSessionState instance populated with the
    given state values.
    """
    session_state = SessionState()
    for key, value in initial_state_values.items():
        session_state[key] = value
    return SafeSessionState(session_state, lambda: None)


@patch(
    "streamlit.runtime.state.session_state_proxy.get_session_state",
    MagicMock(return_value=_create_mock_session_state({"foo": "bar"})),
)
class SessionStateProxyTests(unittest.TestCase):
    reserved_key = f"{GENERATED_ELEMENT_ID_PREFIX}-some_key"

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

    @patch(
        "streamlit.runtime.state.session_state_proxy.get_session_state",
        MagicMock(return_value=SessionState(_new_session_state={"foo": "bar"})),
    )
    def test_getattr_missing_key_raises_attribute_error(self):
        """``getattr`` for a missing key raises ``AttributeError`` (not ``KeyError``)."""
        with pytest.raises(AttributeError, match="has no attribute"):
            _ = self.session_state_proxy.missing_attr


@patch(
    "streamlit.runtime.state.session_state_proxy.get_session_state",
    MagicMock(return_value=_create_mock_session_state({"foo": "bar"})),
)
def test_session_state_proxy_str_returns_filtered_state_string() -> None:
    """``str(session_state_proxy)`` returns the string repr of the filtered state."""
    assert str(SessionStateProxy()) == str({"foo": "bar"})


@pytest.fixture
def _reset_mock_session_state() -> Iterator[None]:
    """Reset module-level mock session state singletons before and after the test."""
    session_state_proxy_module._mock_session_state = None
    session_state_proxy_module._state_use_warning_already_displayed = False
    yield
    session_state_proxy_module._mock_session_state = None
    session_state_proxy_module._state_use_warning_already_displayed = False


@pytest.mark.usefixtures("_reset_mock_session_state")
@patch(
    "streamlit.runtime.scriptrunner_utils.script_run_context.get_script_run_ctx",
    MagicMock(return_value=None),
)
@patch("streamlit.runtime.exists", MagicMock(return_value=False))
def test_get_session_state_falls_back_to_mock_when_no_ctx() -> None:
    """When ``get_script_run_ctx`` returns ``None``, ``get_session_state`` returns a
    lazily-initialized mock ``SafeSessionState`` and warns once.
    """
    with patch("streamlit.runtime.state.session_state_proxy._LOGGER") as mock_logger:
        first = get_session_state()
        # Repeated invocations should reuse the same mock instance and not
        # re-emit the warning.
        second = get_session_state()

    assert isinstance(first, SafeSessionState)
    assert first is second
    mock_logger.warning.assert_called_once()


@pytest.mark.usefixtures("_reset_mock_session_state")
@patch(
    "streamlit.runtime.scriptrunner_utils.script_run_context.get_script_run_ctx",
    MagicMock(return_value=None),
)
@patch("streamlit.runtime.exists", MagicMock(return_value=True))
def test_get_session_state_skips_warning_when_runtime_exists() -> None:
    """When a runtime exists but ``ctx`` is ``None``, no warning is emitted."""
    with patch("streamlit.runtime.state.session_state_proxy._LOGGER") as mock_logger:
        result = get_session_state()

    assert isinstance(result, SafeSessionState)
    mock_logger.warning.assert_not_called()
