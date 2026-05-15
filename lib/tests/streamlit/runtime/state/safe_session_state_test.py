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

"""SafeSessionState unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from streamlit.runtime.state import SafeSessionState, SessionState


def _new_safe_state(initial: dict[str, object] | None = None) -> SafeSessionState:
    """Return a ``SafeSessionState`` wrapping a fresh ``SessionState``.

    Parameters
    ----------
    initial : dict[str, object] | None
        Initial state values to populate the underlying ``SessionState`` with.
    """
    state = SessionState()
    for key, value in (initial or {}).items():
        state[key] = value
    return SafeSessionState(state, lambda: None)


def test_delitem_removes_key_and_invokes_yield_callback() -> None:
    """``del state[key]`` removes the key and invokes the yield callback."""
    yield_cb = MagicMock()
    safe_state = SafeSessionState(SessionState(), yield_cb)
    safe_state["foo"] = "bar"
    yield_cb.reset_mock()

    del safe_state["foo"]

    assert "foo" not in safe_state._state
    yield_cb.assert_called_once_with()


def test_delitem_missing_key_raises_keyerror() -> None:
    """Deleting a missing key raises ``KeyError``."""
    safe_state = _new_safe_state()

    with pytest.raises(KeyError):
        del safe_state["missing"]


def test_getattr_returns_value_for_existing_key() -> None:
    """``state.foo`` returns the value associated with ``foo``."""
    safe_state = _new_safe_state({"foo": "bar"})

    assert safe_state.foo == "bar"


def test_getattr_raises_attribute_error_for_missing_key() -> None:
    """Accessing a missing attribute raises ``AttributeError`` (not ``KeyError``)."""
    safe_state = _new_safe_state()

    with pytest.raises(AttributeError, match="missing not found in session_state"):
        _ = safe_state.missing


def test_delattr_removes_existing_attribute() -> None:
    """``del state.foo`` removes the underlying key."""
    safe_state = _new_safe_state({"foo": "bar"})

    del safe_state.foo

    assert "foo" not in safe_state._state


def test_delattr_missing_attribute_raises_attribute_error() -> None:
    """``del state.missing`` raises ``AttributeError`` (not ``KeyError``)."""
    safe_state = _new_safe_state()

    with pytest.raises(AttributeError, match="missing not found in session_state"):
        del safe_state.missing


def test_yield_callback_invoked_on_every_user_facing_access() -> None:
    """The yield callback fires once per user-facing access (``__setitem__``,
    ``__getitem__`` and ``__delitem__``) so that the runner has a chance to
    interrupt the script.
    """
    yield_cb = MagicMock()
    safe_state = SafeSessionState(SessionState(), yield_cb)

    safe_state["foo"] = 1
    _ = safe_state["foo"]
    del safe_state["foo"]

    assert yield_cb.call_count == 3
