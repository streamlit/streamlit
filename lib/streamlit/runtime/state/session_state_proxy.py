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

from __future__ import annotations

import copy
import inspect
from collections.abc import Callable, Iterator, MutableMapping
from typing import Any, Final, TypeVar

from streamlit import logger as _logger
from streamlit import runtime
from streamlit.elements.lib.utils import Key
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.state.common import require_valid_user_key
from streamlit.runtime.state.safe_session_state import SafeSessionState
from streamlit.runtime.state.session_state import SessionState

_LOGGER: Final = _logger.get_logger(__name__)

# Key used to track which fields have been registered by which state classes
_SESSION_STATE_CLASS_REGISTRY_KEY: Final = "$$_st_session_state_class_registry"

_T = TypeVar("_T")


_state_use_warning_already_displayed: bool = False
# The mock session state is used as a fallback if the script is run without `streamlit run`
_mock_session_state: SafeSessionState | None = None


def get_session_state() -> SafeSessionState:
    """Get the SessionState object for the current session.

    Note that in streamlit scripts, this function should not be called
    directly. Instead, SessionState objects should be accessed via
    st.session_state.
    """
    global _state_use_warning_already_displayed  # noqa: PLW0603
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()

    # If there is no script run context because the script is run bare, we
    # use a global mock session state version to allow bare script execution (via python script.py)
    if ctx is None:
        if not _state_use_warning_already_displayed:
            _state_use_warning_already_displayed = True
            if not runtime.exists():
                _LOGGER.warning(
                    "Session state does not function when running a script without `streamlit run`"
                )

        global _mock_session_state  # noqa: PLW0603

        if _mock_session_state is None:
            # Lazy initialize the mock session state
            _mock_session_state = SafeSessionState(SessionState(), lambda: None)
        return _mock_session_state
    return ctx.session_state


def _extract_fields_from_class(cls: type) -> dict[str, Any]:
    """Extract field names and default values from a class definition.

    Parameters
    ----------
    cls : type
        The class to extract fields from.

    Returns
    -------
    dict[str, Any]
        Dictionary mapping field names to their default values.

    Raises
    ------
    StreamlitAPIException
        If a field has no default value.
    """
    fields: dict[str, Any] = {}
    annotations = getattr(cls, "__annotations__", {})

    for name in annotations:
        # Skip private/dunder attributes
        if name.startswith("_"):
            continue

        if hasattr(cls, name):
            default = getattr(cls, name)
            # Skip if it's a method/function (shouldn't happen with annotations)
            if callable(default) and not isinstance(default, type):
                continue
            fields[name] = default
        else:
            raise StreamlitAPIException(
                f"Field '{name}' in @st.session_state class '{cls.__name__}' "
                f"must have a default value. Example: {name}: int = 0"
            )

    return fields


def _extract_methods_from_class(cls: type) -> dict[str, Callable[..., Any]]:
    """Extract methods from a class definition.

    Parameters
    ----------
    cls : type
        The class to extract methods from.

    Returns
    -------
    dict[str, Callable[..., Any]]
        Dictionary mapping method names to the method functions.
    """
    methods: dict[str, Callable[..., Any]] = {}

    for name, value in inspect.getmembers(cls, predicate=inspect.isfunction):
        # Skip private/dunder methods
        if name.startswith("_"):
            continue
        methods[name] = value

    return methods


def _check_and_register_keys(fields: dict[str, Any], class_name: str) -> None:
    """Check for key collisions and register field keys.

    Parameters
    ----------
    fields : dict[str, Any]
        Dictionary of field names to check and register.
    class_name : str
        Name of the class registering these fields.

    Raises
    ------
    StreamlitAPIException
        If a field name is already registered by a different class.
    """
    state = get_session_state()

    # Initialize registry if not exists
    if _SESSION_STATE_CLASS_REGISTRY_KEY not in state:
        state[_SESSION_STATE_CLASS_REGISTRY_KEY] = {}

    registry = state[_SESSION_STATE_CLASS_REGISTRY_KEY]

    for field_name in fields:
        if field_name in registry:
            existing_class = registry[field_name]
            # Allow re-registration by the same class (for script reruns)
            if existing_class != class_name:
                raise StreamlitAPIException(
                    f"Key collision in @st.session_state: Field '{field_name}' "
                    f"is already registered by class '{existing_class}'. "
                    f"Cannot register it again for class '{class_name}'. "
                    f"Each field name must be unique across all @st.session_state classes."
                )
        registry[field_name] = class_name


def _initialize_state_fields(fields: dict[str, Any]) -> None:
    """Initialize fields in session state with their default values.

    Only sets values that don't already exist in session state.

    Parameters
    ----------
    fields : dict[str, Any]
        Dictionary mapping field names to default values.
    """
    state = get_session_state()

    for name, default in fields.items():
        if name not in state:
            # Handle mutable defaults by copying
            if isinstance(default, (list, dict, set)):
                state[name] = copy.deepcopy(default)
            else:
                state[name] = default


class _StateAccessor:
    """Helper class that proxies attribute access to session state.

    This class serves two purposes:
    1. As `self` when methods are called (for method binding)
    2. As instances returned when a @st.session_state class is instantiated

    When methods defined on a @st.session_state class use `self.field_name`,
    this accessor ensures they read from and write to session state.

    Parameters
    ----------
    fields : dict[str, Any]
        Dictionary of valid field names for this state class.
    methods : dict[str, Callable[..., Any]] | None
        Dictionary of bound methods (only needed for instance access).
    class_name : str | None
        Name of the state class (for repr).
    """

    __slots__ = ("_class_name", "_fields", "_methods")

    def __init__(
        self,
        fields: dict[str, Any],
        methods: dict[str, Callable[..., Any]] | None = None,
        class_name: str | None = None,
    ) -> None:
        object.__setattr__(self, "_fields", fields)
        object.__setattr__(self, "_methods", methods or {})
        object.__setattr__(self, "_class_name", class_name or "StateAccessor")

    def __getattr__(self, name: str) -> Any:
        fields = object.__getattribute__(self, "_fields")
        methods = object.__getattribute__(self, "_methods")

        if name in fields:
            return get_session_state()[name]
        if name in methods:
            return methods[name]

        class_name = object.__getattribute__(self, "_class_name")
        raise AttributeError(f"'{class_name}' has no attribute '{name}'")

    def __setattr__(self, name: str, value: Any) -> None:
        fields = object.__getattribute__(self, "_fields")
        if name in fields:
            get_session_state()[name] = value
        else:
            class_name = object.__getattribute__(self, "_class_name")
            raise AttributeError(
                f"Cannot set '{name}' on '{class_name}': "
                f"not a defined field in this state class"
            )

    def __repr__(self) -> str:
        class_name = object.__getattribute__(self, "_class_name")
        return f"<{class_name} instance (session state proxy)>"


def _create_bound_method(
    method: Callable[..., Any], fields: dict[str, Any]
) -> Callable[..., Any]:
    """Create a bound method that uses StateAccessor as self.

    Parameters
    ----------
    method : Callable[..., Any]
        The original method from the class.
    fields : dict[str, Any]
        Dictionary of valid field names.

    Returns
    -------
    Callable[..., Any]
        A callable that invokes the method with a StateAccessor.
    """
    from functools import wraps

    accessor = _StateAccessor(fields)

    @wraps(method)
    def bound_method(*args: Any, **kwargs: Any) -> Any:
        return method(accessor, *args, **kwargs)

    return bound_method


class _SessionStateClassMeta(type):
    """Metaclass that enables class-level attribute access to session state.

    This metaclass intercepts attribute access on the class itself (not instances)
    and proxies get/set operations to session state.
    """

    _st_fields: dict[str, Any]
    _st_methods: dict[str, Callable[..., Any]]
    _st_class_name: str

    def __getattr__(cls, name: str) -> Any:
        # Let dunder and private attributes go through normally
        if name.startswith("_"):
            raise AttributeError(f"'{cls._st_class_name}' has no attribute '{name}'")

        # Check if it's a field
        if name in cls._st_fields:
            return get_session_state()[name]

        # Check if it's a method
        if name in cls._st_methods:
            return cls._st_methods[name]

        raise AttributeError(f"'{cls._st_class_name}' has no attribute '{name}'")

    def __setattr__(cls, name: str, value: Any) -> None:
        # Let dunder and private attributes go through normally
        if name.startswith("_"):
            super().__setattr__(name, value)
            return

        # Check if it's a field
        if hasattr(cls, "_st_fields") and name in cls._st_fields:
            get_session_state()[name] = value
            return

        # For initial class setup, allow setting
        super().__setattr__(name, value)

    def __repr__(cls) -> str:
        return f"<@st.session_state class '{cls._st_class_name}'>"


class SessionStateProxy(MutableMapping[Key, Any]):
    """A stateless singleton that proxies `st.session_state` interactions
    to the current script thread's SessionState instance.

    The proxy API differs slightly from SessionState: it does not allow
    callers to get, set, or iterate over "keyless" widgets (that is, widgets
    that were created without a user_key, and have autogenerated keys).
    """

    def __iter__(self) -> Iterator[Any]:
        """Iterator over user state and keyed widget values."""
        # TODO: this is unsafe if fastReruns is true! Let's deprecate/remove.
        return iter(get_session_state().filtered_state)

    def __len__(self) -> int:
        """Number of user state and keyed widget values in session_state."""
        return len(get_session_state().filtered_state)

    def __str__(self) -> str:
        """String representation of user state and keyed widget values."""
        return str(get_session_state().filtered_state)

    def __getitem__(self, key: Key) -> Any:
        """Return the state or widget value with the given key.

        Raises
        ------
        StreamlitAPIException
            If the key is not a valid SessionState user key.
        """
        key = str(key)
        require_valid_user_key(key)
        return get_session_state()[key]

    @gather_metrics("session_state.set_item")
    def __setitem__(self, key: Key, value: Any) -> None:
        """Set the value of the given key.

        Raises
        ------
        StreamlitAPIException
            If the key is not a valid SessionState user key.
        """
        key = str(key)
        require_valid_user_key(key)
        get_session_state()[key] = value

    def __delitem__(self, key: Key) -> None:
        """Delete the value with the given key.

        Raises
        ------
        StreamlitAPIException
            If the key is not a valid SessionState user key.
        """
        key = str(key)
        require_valid_user_key(key)
        del get_session_state()[key]

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    @gather_metrics("session_state.set_attr")
    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value

    def __delattr__(self, key: str) -> None:
        try:
            del self[key]
        except KeyError:
            raise AttributeError(_missing_attr_error_message(key))

    def to_dict(self) -> dict[str, Any]:
        """Return a dict containing all session_state and keyed widget values."""
        return get_session_state().filtered_state

    @gather_metrics("session_state.__call__")
    def __call__(self, cls: type[_T]) -> type[_T]:
        """Decorator to create a session state class.

        Transforms a class definition into a proxy that stores all fields
        in Streamlit's session state. Fields are persisted across script reruns
        and can be accessed in two ways:

        1. **Class-level access** (direct): ``MyState.counter``
        2. **Instance-based access** (Pythonic): ``state = MyState(); state.counter``

        Both patterns access the same underlying session state. Multiple
        instantiations return equivalent proxy objects that share the same state.

        Parameters
        ----------
        cls : type
            The class to transform into a session state class.

        Returns
        -------
        type
            A proxy class that stores state in session_state.

        Raises
        ------
        StreamlitAPIException
            If a field has no default value or if there's a key collision
            with another @st.session_state class.

        Example
        -------
        Define a state class with fields and methods:

        >>> @st.session_state
        ... class MyState:
        ...     counter: int = 0
        ...     name: str = "default"
        ...
        ...     def increment(self):
        ...         self.counter += 1

        **Class-level access** (quick scripts):

        >>> MyState.counter  # Read from session state
        0
        >>> MyState.increment()  # Call method
        >>> MyState.counter
        1

        **Instance-based access** (recommended, more Pythonic):

        >>> state = MyState()  # Create proxy instance
        >>> state.counter  # Read from session state
        1
        >>> state.increment()  # Call method
        >>> state.counter
        2

        Both access the same underlying session state:

        >>> st.session_state["counter"]
        2

        Note: All instances share the same state:

        >>> state1 = MyState()
        >>> state2 = MyState()
        >>> state1.counter = 100
        >>> state2.counter  # Same value!
        100
        """
        class_name = cls.__name__

        # Extract fields and methods from the original class
        fields = _extract_fields_from_class(cls)
        methods = _extract_methods_from_class(cls)

        # Check for key collisions and register keys
        _check_and_register_keys(fields, class_name)

        # Initialize fields in session state
        _initialize_state_fields(fields)

        # Create bound methods
        bound_methods: dict[str, Callable[..., Any]] = {
            name: _create_bound_method(method, fields)
            for name, method in methods.items()
        }

        # Create the proxy class using metaclass
        proxy_class = _SessionStateClassMeta(
            class_name,
            (),
            {
                "_st_fields": fields,
                "_st_methods": bound_methods,
                "_st_class_name": class_name,
                "__doc__": cls.__doc__,
                "__module__": cls.__module__,
            },
        )

        # Allow instantiation - return a StateAccessor proxy instance
        def _create_instance(_cls: type, *_args: Any, **_kwargs: Any) -> _StateAccessor:
            return _StateAccessor(fields, bound_methods, class_name)

        proxy_class.__new__ = _create_instance  # type: ignore[assignment,method-assign]

        return proxy_class  # type: ignore[return-value]


def _missing_attr_error_message(attr_name: str) -> str:
    return (
        f'st.session_state has no attribute "{attr_name}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/develop/concepts/architecture/session-state#initialization"
    )
