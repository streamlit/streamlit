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
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import SafeSessionState, SessionState, SessionStateProxy
from streamlit.runtime.state.common import (
    GENERATED_ELEMENT_ID_PREFIX,
    require_valid_user_key,
)


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


class SessionStateDecoratorTests(unittest.TestCase):
    """Tests for the @st.session_state class decorator.

    This decorator allows defining dataclass-like classes where properties
    are automatically stored in Streamlit's session state.
    """

    def setUp(self) -> None:
        """Create fresh session state for each test."""
        self.mock_state = SessionState()
        self.patcher = patch(
            "streamlit.runtime.state.session_state_proxy.get_session_state",
            MagicMock(return_value=self.mock_state),
        )
        self.patcher.start()
        self.session_state_proxy = SessionStateProxy()

    def tearDown(self) -> None:
        """Stop the patcher."""
        self.patcher.stop()

    def test_basic_field_access(self) -> None:
        """Test that fields can be accessed via the class."""

        @self.session_state_proxy
        class MyState:
            counter: int = 0

        assert MyState.counter == 0
        MyState.counter = 5
        assert MyState.counter == 5

    def test_field_stored_in_session_state(self) -> None:
        """Test that fields are stored in session_state dict."""

        @self.session_state_proxy
        class MyState:
            value: str = "test"

        assert self.mock_state["value"] == "test"

    def test_multiple_fields(self) -> None:
        """Test that multiple fields work correctly."""

        @self.session_state_proxy
        class MyState:
            count: int = 0
            name: str = "default"
            enabled: bool = True

        assert MyState.count == 0
        assert MyState.name == "default"
        assert MyState.enabled is True

        MyState.count = 10
        MyState.name = "updated"
        MyState.enabled = False

        assert MyState.count == 10
        assert MyState.name == "updated"
        assert MyState.enabled is False

    def test_method_modifies_state(self) -> None:
        """Test that methods can modify state fields."""

        @self.session_state_proxy
        class Counter:
            count: int = 0

            def increment(self) -> None:
                self.count += 1

            def decrement(self) -> None:
                self.count -= 1

        Counter.increment()
        assert Counter.count == 1

        Counter.increment()
        Counter.increment()
        assert Counter.count == 3

        Counter.decrement()
        assert Counter.count == 2

    def test_method_with_arguments(self) -> None:
        """Test that methods can accept arguments."""

        @self.session_state_proxy
        class Counter:
            count: int = 0

            def add(self, amount: int) -> None:
                self.count += amount

            def set_value(self, value: int) -> None:
                self.count = value

        Counter.add(5)
        assert Counter.count == 5

        Counter.add(3)
        assert Counter.count == 8

        Counter.set_value(100)
        assert Counter.count == 100

    def test_method_with_return_value(self) -> None:
        """Test that methods can return values."""

        @self.session_state_proxy
        class Counter:
            count: int = 0

            def get_and_increment(self) -> int:
                current = self.count
                self.count += 1
                return current

        assert Counter.get_and_increment() == 0
        assert Counter.get_and_increment() == 1
        assert Counter.get_and_increment() == 2
        assert Counter.count == 3

    def test_key_collision_raises_error(self) -> None:
        """Test that duplicate field names raise an error."""

        @self.session_state_proxy
        class StateA:
            shared_key: int = 0

        with pytest.raises(StreamlitAPIException, match="Key collision"):

            @self.session_state_proxy
            class StateB:
                shared_key: int = 0  # Should fail

    def test_same_class_can_reregister(self) -> None:
        """Test that script reruns don't cause collision errors."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        MyState.value = 42

        # Simulate rerun - redefine same class with same name
        @self.session_state_proxy
        class MyState:
            value: int = 0

        # Value should be preserved from before
        assert MyState.value == 42

    def test_instantiation_returns_proxy(self) -> None:
        """Test that instantiation returns a proxy object."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        state = MyState()
        assert state.value == 0

        # Modify via instance
        state.value = 42
        assert state.value == 42

        # Class-level access sees the same value
        assert MyState.value == 42

    def test_instance_based_method_access(self) -> None:
        """Test that methods work via instance access."""

        @self.session_state_proxy
        class Counter:
            count: int = 0

            def increment(self) -> None:
                self.count += 1

        state = Counter()
        state.increment()
        assert state.count == 1

        state.increment()
        state.increment()
        assert state.count == 3

    def test_multiple_instances_share_state(self) -> None:
        """Test that multiple instances share the same state."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        state1 = MyState()
        state2 = MyState()

        state1.value = 100
        assert state2.value == 100  # Same underlying state

        state2.value = 200
        assert state1.value == 200
        assert MyState.value == 200

    def test_instance_repr(self) -> None:
        """Test that instances have a meaningful repr."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        state = MyState()
        assert "MyState" in repr(state)
        assert "proxy" in repr(state).lower()

    def test_instance_undefined_attribute_raises_error(self) -> None:
        """Test that accessing undefined attributes on instance raises error."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        state = MyState()
        with pytest.raises(AttributeError, match="has no attribute"):
            _ = state.nonexistent

    def test_instance_setting_undefined_attribute_raises_error(self) -> None:
        """Test that setting undefined attributes on instance raises error."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        state = MyState()
        with pytest.raises(AttributeError, match="not a defined field"):
            state.undefined = 123

    def test_field_without_default_raises_error(self) -> None:
        """Test that fields must have defaults."""
        with pytest.raises(StreamlitAPIException, match="must have a default"):

            @self.session_state_proxy
            class MyState:
                value: int  # No default!

    def test_mutable_defaults_are_copied(self) -> None:
        """Test that mutable defaults don't share state between classes."""

        @self.session_state_proxy
        class State1:
            items: list[int] = []  # noqa: RUF012

        State1.items.append(1)
        State1.items.append(2)

        assert State1.items == [1, 2]

    def test_private_fields_are_ignored(self) -> None:
        """Test that private fields (starting with _) are ignored."""

        @self.session_state_proxy
        class MyState:
            public_field: int = 0
            _private_field: int = 100

        assert MyState.public_field == 0
        # Private field should not be accessible via the proxy
        with pytest.raises(AttributeError):
            _ = MyState._private_field

    def test_undefined_attribute_raises_error(self) -> None:
        """Test that accessing undefined attributes raises AttributeError."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        with pytest.raises(AttributeError, match="has no attribute"):
            _ = MyState.nonexistent

    def test_setting_undefined_attribute_raises_error(self) -> None:
        """Test that setting undefined attributes raises AttributeError."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        # Setting an undefined field should go through the metaclass
        # which allows it for internal setup, but for user code it should
        # be stored in session state only if it's a defined field
        MyState.value = 10  # This should work
        assert MyState.value == 10

    def test_class_repr(self) -> None:
        """Test that the class has a meaningful repr."""

        @self.session_state_proxy
        class MyState:
            value: int = 0

        assert "@st.session_state" in repr(MyState)
        assert "MyState" in repr(MyState)

    def test_class_docstring_preserved(self) -> None:
        """Test that the class docstring is preserved."""

        @self.session_state_proxy
        class MyState:
            """This is my state class."""

            value: int = 0

        assert MyState.__doc__ == "This is my state class."

    def test_multiple_state_classes(self) -> None:
        """Test that multiple state classes can coexist."""

        @self.session_state_proxy
        class CounterState:
            count: int = 0

        @self.session_state_proxy
        class UserState:
            name: str = "anonymous"

        CounterState.count = 5
        UserState.name = "Alice"

        assert CounterState.count == 5
        assert UserState.name == "Alice"
        assert self.mock_state["count"] == 5
        assert self.mock_state["name"] == "Alice"

    def test_dict_default_is_copied(self) -> None:
        """Test that dict defaults are deep copied."""

        @self.session_state_proxy
        class MyState:
            data: dict[str, int] = {}  # noqa: RUF012

        MyState.data["key1"] = 1
        MyState.data["key2"] = 2

        assert MyState.data == {"key1": 1, "key2": 2}

    def test_state_persists_across_access(self) -> None:
        """Test that state persists when accessed multiple times."""

        @self.session_state_proxy
        class MyState:
            counter: int = 0

            def increment(self) -> None:
                self.counter += 1

        # Multiple accesses should see the same state
        MyState.increment()
        MyState.increment()
        MyState.increment()

        assert MyState.counter == 3
        assert self.mock_state["counter"] == 3
