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
from typing import Tuple, Dict, Any
from unittest.mock import MagicMock, Mock, PropertyMock

from streamlit.runtime.state import SessionState, SafeSessionState


def _create_state_spy(
    initial_state_values: Dict[str, Any], disconnect: bool
) -> Tuple[SafeSessionState, Mock]:
    """Create a SafeSessionState, and return a Mock that
    spies on its underlying SessionState instance.
    """
    # SessionState is a "slotted" class, which makes it non-mockable.
    # The workaround is to create a subclass that is not slotted:
    # https://www.attrs.org/en/21.4.0.post1/glossary.html#term-slotted-classes
    class MockableSessionState(SessionState):
        pass

    # Create a SessionState instance and populate its values.
    session_state = MockableSessionState()
    for key, value in initial_state_values.items():
        session_state[key] = value

    # Create a "spy" mock that just wraps our session_state while letting
    # us observe calls. MagicMock does not implement dunder methods,
    # so we manually add them.
    # (See https://github.com/python/cpython/issues/69783)
    session_state_spy = MagicMock(spec=SessionState, wraps=session_state)
    session_state_spy.__getitem__ = Mock(wraps=session_state.__getitem__)
    session_state_spy.__setitem__ = Mock(wraps=session_state.__setitem__)
    session_state_spy.__delitem__ = Mock(wraps=session_state.__delitem__)
    session_state_spy.__iter__ = Mock(wraps=session_state.__iter__)
    session_state_spy.__len__ = Mock(wraps=session_state.__len__)

    safe_state = SafeSessionState(session_state_spy)
    if disconnect:
        safe_state.disconnect()

    return safe_state, session_state_spy


class SafeSessionStateTests(unittest.TestCase):
    def test_register_widget(self):
        """`register_widget` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)

                widget_metadata = MagicMock()
                safe_state.register_widget(widget_metadata, "mock_user_key")

                if disconnected:
                    mock_state.register_widget.assert_not_called()
                else:
                    mock_state.register_widget.assert_called_once_with(
                        widget_metadata, "mock_user_key"
                    )

    def test_on_script_will_rerun(self):
        """`on_script_will_rerun` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)

                latest_widget_states = MagicMock()
                safe_state.on_script_will_rerun(latest_widget_states)

                if disconnected:
                    mock_state.on_script_will_rerun.assert_not_called()
                else:
                    mock_state.on_script_will_rerun.assert_called_once_with(
                        latest_widget_states
                    )

    def test_on_script_finished(self):
        """`on_script_finished` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)

                widget_ids_this_run = {"foo", "bar"}
                safe_state.on_script_finished(widget_ids_this_run)

                if disconnected:
                    mock_state.on_script_finished.assert_not_called()
                else:
                    mock_state.on_script_finished.assert_called_once_with(
                        widget_ids_this_run
                    )

    def test_get_widget_states(self):
        """`get_widget_states` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)
                mock_state.get_widget_states = MagicMock(return_value=[1, 2, 3])

                result = safe_state.get_widget_states()

                if disconnected:
                    mock_state.get_widget_states.assert_not_called()
                    self.assertEqual([], result)
                else:
                    mock_state.get_widget_states.assert_called_once_with()
                    self.assertEqual([1, 2, 3], result)

    def test_is_new_state_value(self):
        """`is_new_state_value` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)
                mock_state.is_new_state_value = MagicMock(return_value=True)

                result = safe_state.is_new_state_value("mock_user_key")

                if disconnected:
                    mock_state.is_new_state_value.assert_not_called()
                    self.assertEqual(False, result)
                else:
                    mock_state.is_new_state_value.assert_called_once_with(
                        "mock_user_key"
                    )
                    self.assertEqual(True, result)

    def test_filtered_state(self):
        """`filtered_state` calls thru to SessionState, unless disconnected."""
        for disconnected in (False, True):
            with self.subTest(f"disconnected={disconnected}"):
                safe_state, mock_state = _create_state_spy({}, disconnected)

                filtered_state_mock = PropertyMock(return_value={"foo": 10, "bar": 20})
                type(mock_state).filtered_state = filtered_state_mock

                result = safe_state.filtered_state
                if disconnected:
                    filtered_state_mock.assert_not_called()
                    self.assertEqual({}, result)
                else:
                    filtered_state_mock.assert_called_once()
                    self.assertEqual({"foo": 10, "bar": 20}, result)

    def test_get_item(self):
        """`__getitem__` calls through to SessionState.
        If disconnected, it always raises a KeyError.
        """
        # Not disconnected: return values from the wrapped SessionState
        safe_state, _ = _create_state_spy({"foo": "bar"}, disconnect=False)
        self.assertEqual("bar", safe_state["foo"])
        self.assertRaises(KeyError, lambda: safe_state["baz"])

        # Disconnected: raise a KeyError for all keys
        safe_state, _ = _create_state_spy({"foo": "bar"}, disconnect=True)
        self.assertRaises(KeyError, lambda: safe_state["foo"])

    def test_set_item(self):
        """`__setitem__` calls through to SessionState.
        If disconnected, it's a no-op.
        """
        # Not disconnected: update wrapped State
        safe_state, mock_state = _create_state_spy({}, disconnect=False)
        safe_state["baz"] = 123
        self.assertEqual(123, safe_state["baz"])
        self.assertEqual(123, mock_state["baz"])

        # Disconnected: no-op
        safe_state, mock_state = _create_state_spy({}, disconnect=True)
        safe_state["baz"] = 123
        self.assertRaises(KeyError, lambda: safe_state["baz"])
        self.assertRaises(KeyError, lambda: mock_state["baz"])

    def test_del_item(self):
        """`__delitem__` calls through to SessionState.__getitem__.
        If disconnected, it always raises a KeyError.
        """
        # Not disconnected: update wrapped State
        safe_state, mock_state = _create_state_spy({"foo": "bar"}, disconnect=False)
        del safe_state["foo"]
        self.assertRaises(KeyError, lambda: safe_state["foo"])
        self.assertRaises(KeyError, lambda: mock_state["foo"])

        with self.assertRaises(KeyError):
            # (Weird Python rule: `del` is not an expression, so it can't be
            # in the body of a lambda.)
            del safe_state["not_a_key"]

        # Disconnected: raise a KeyError for all keys
        safe_state, _ = _create_state_spy({"foo": "bar"}, disconnect=True)
        with self.assertRaises(KeyError):
            del safe_state["foo"]
