# Implementation Plan: `@st.session_state` Decorator

## Summary

This document provides a detailed implementation plan for adding the `@st.session_state` class decorator to Streamlit.

## Files to Modify

### 1. `lib/streamlit/runtime/state/session_state_proxy.py`

Add the `__call__` method to `SessionStateProxy` and supporting code.

```python
# Add imports at top
import inspect
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

# Add constants
_SESSION_STATE_CLASS_REGISTRY_KEY: Final = "$$_st_session_state_class_registry"

# Add helper functions (private, prefixed with _)
def _extract_fields_from_class(cls: type) -> dict[str, Any]: ...
def _extract_methods_from_class(cls: type) -> dict[str, Callable[..., Any]]: ...
def _check_and_register_keys(fields: dict[str, Any], class_name: str) -> None: ...
def _initialize_state_fields(fields: dict[str, Any]) -> None: ...

# Add helper classes
class _StateAccessor: ...
class _SessionStateClassMeta(type): ...

# Add to SessionStateProxy class
class SessionStateProxy(MutableMapping[Key, Any]):
    # ... existing methods ...

    @gather_metrics("session_state.__call__")
    def __call__(self, cls: type[T]) -> type[T]:
        """Decorator to create a session state class.

        # ... docstring with examples ...
        """
        return _create_state_class_proxy(cls)
```

### 2. `lib/streamlit/runtime/state/__init__.py`

Export new types for type checking (if needed):

```python
# No changes needed for basic implementation
# Could export _SessionStateClassMeta if users need to type-check decorated classes
```

### 3. `lib/streamlit/__init__.py`

No changes needed - `session_state` is already a `SessionStateProxy` instance, so adding `__call__` makes it automatically usable as `@st.session_state`.

### 4. Tests: `lib/tests/streamlit/runtime/state/session_state_proxy_test.py`

Add comprehensive tests:

```python
class SessionStateDecoratorTests(unittest.TestCase):
    """Tests for @st.session_state decorator."""

    def test_decorator_extracts_fields(self): ...
    def test_decorator_extracts_methods(self): ...
    def test_field_initialization(self): ...
    def test_field_access_via_class(self): ...
    def test_field_set_via_class(self): ...
    def test_method_binding_works(self): ...
    def test_key_collision_raises_error(self): ...
    def test_same_class_can_reregister(self): ...
    def test_instantiation_raises_error(self): ...
    def test_field_accessible_via_session_state_dict(self): ...
    def test_mutable_defaults_are_copied(self): ...
    def test_field_without_default_raises_error(self): ...
```

## Implementation Details

### Phase 1: Core Decorator (MVP)

1. Add `__call__` to `SessionStateProxy`
2. Implement field extraction from type annotations
3. Implement field initialization in session state
4. Implement key collision detection
5. Implement class-level attribute access via metaclass
6. Add basic tests

### Phase 2: Method Support

1. Implement `_StateAccessor` for method binding
2. Implement method extraction and binding
3. Add tests for methods

### Phase 3: Edge Cases & Polish

1. Handle mutable defaults (copy on initialization)
2. Handle nested/complex types
3. Add documentation
4. Add type stubs for IDE support

## Code Changes

### Full Implementation for `session_state_proxy.py`

```python
# === Add after line 27 (after imports) ===

_SESSION_STATE_CLASS_REGISTRY_KEY: Final = "$$_st_session_state_class_registry"

T = TypeVar("T")


def _extract_fields_from_class(cls: type) -> dict[str, Any]:
    """Extract field names and default values from a class definition."""
    from streamlit.errors import StreamlitAPIException

    fields: dict[str, Any] = {}
    annotations = getattr(cls, "__annotations__", {})

    for name in annotations:
        if name.startswith("_"):
            continue

        if hasattr(cls, name):
            default = getattr(cls, name)
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
    """Extract methods from a class definition."""
    import inspect

    methods: dict[str, Callable[..., Any]] = {}
    for name, value in inspect.getmembers(cls, predicate=inspect.isfunction):
        if name.startswith("_"):
            continue
        methods[name] = value
    return methods


def _check_and_register_keys(
    fields: dict[str, Any], class_name: str
) -> None:
    """Check for key collisions and register field keys."""
    from streamlit.errors import StreamlitAPIException

    state = get_session_state()

    if _SESSION_STATE_CLASS_REGISTRY_KEY not in state:
        state[_SESSION_STATE_CLASS_REGISTRY_KEY] = {}

    registry = state[_SESSION_STATE_CLASS_REGISTRY_KEY]

    for field_name in fields:
        if field_name in registry:
            existing_class = registry[field_name]
            if existing_class != class_name:
                raise StreamlitAPIException(
                    f"Key collision in @st.session_state: Field '{field_name}' "
                    f"is already registered by class '{existing_class}'. "
                    f"Cannot register it again for class '{class_name}'."
                )
        registry[field_name] = class_name


def _initialize_state_fields(fields: dict[str, Any]) -> None:
    """Initialize fields in session state with their default values."""
    import copy

    state = get_session_state()

    for name, default in fields.items():
        if name not in state:
            if isinstance(default, (list, dict, set)):
                state[name] = copy.deepcopy(default)
            else:
                state[name] = default


class _StateAccessor:
    """Helper class that proxies attribute access to session state."""

    __slots__ = ("_fields",)

    def __init__(self, fields: dict[str, Any]) -> None:
        object.__setattr__(self, "_fields", fields)

    def __getattr__(self, name: str) -> Any:
        fields = object.__getattribute__(self, "_fields")
        if name in fields:
            return get_session_state()[name]
        raise AttributeError(f"State class has no field '{name}'")

    def __setattr__(self, name: str, value: Any) -> None:
        fields = object.__getattribute__(self, "_fields")
        if name in fields:
            get_session_state()[name] = value
        else:
            raise AttributeError(f"Cannot set '{name}': not a field")


def _create_bound_method(
    method: Callable[..., Any], fields: dict[str, Any]
) -> Callable[..., Any]:
    """Create a bound method that uses StateAccessor as self."""
    accessor = _StateAccessor(fields)

    def bound_method(*args: Any, **kwargs: Any) -> Any:
        return method(accessor, *args, **kwargs)

    bound_method.__name__ = method.__name__
    bound_method.__doc__ = method.__doc__
    return bound_method


class _SessionStateClassMeta(type):
    """Metaclass for class-level attribute access to session state."""

    _st_fields: dict[str, Any]
    _st_methods: dict[str, Callable[..., Any]]
    _st_class_name: str

    def __getattr__(cls, name: str) -> Any:
        if name.startswith("_"):
            raise AttributeError(f"'{cls._st_class_name}' has no attribute '{name}'")

        if name in cls._st_fields:
            return get_session_state()[name]

        if name in cls._st_methods:
            return cls._st_methods[name]

        raise AttributeError(f"'{cls._st_class_name}' has no attribute '{name}'")

    def __setattr__(cls, name: str, value: Any) -> None:
        if name.startswith("_"):
            super().__setattr__(name, value)
            return

        if hasattr(cls, "_st_fields") and name in cls._st_fields:
            get_session_state()[name] = value
            return

        super().__setattr__(name, value)

    def __repr__(cls) -> str:
        return f"<@st.session_state class '{cls._st_class_name}'>"


# === Add method to SessionStateProxy class ===

class SessionStateProxy(MutableMapping[Key, Any]):
    # ... existing methods ...

    @gather_metrics("session_state.__call__")
    def __call__(self, cls: type[T]) -> type[T]:
        """Decorator to create a session state class.

        Transforms a class definition into a proxy that stores all fields
        in Streamlit's session state.

        Parameters
        ----------
        cls : type
            The class to transform into a session state class.

        Returns
        -------
        type
            A proxy class that stores state in session_state.

        Example
        -------
        >>> @st.session_state
        ... class MyState:
        ...     counter: int = 0
        ...
        ...     def increment(self):
        ...         self.counter += 1
        >>>
        >>> MyState.counter  # 0
        >>> MyState.increment()
        >>> MyState.counter  # 1
        """
        from streamlit.errors import StreamlitAPIException

        class_name = cls.__name__
        fields = _extract_fields_from_class(cls)
        methods = _extract_methods_from_class(cls)

        _check_and_register_keys(fields, class_name)
        _initialize_state_fields(fields)

        bound_methods = {
            name: _create_bound_method(method, fields)
            for name, method in methods.items()
        }

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

        def __new__(cls_: type, *args: Any, **kwargs: Any) -> Any:
            raise StreamlitAPIException(
                f"@st.session_state class '{class_name}' should not be instantiated."
            )

        proxy_class.__new__ = __new__  # type: ignore[method-assign]

        return proxy_class  # type: ignore[return-value]
```

## Test Cases

```python
# lib/tests/streamlit/runtime/state/session_state_proxy_test.py

class SessionStateDecoratorTests(unittest.TestCase):
    """Tests for the @st.session_state decorator."""

    def setUp(self):
        """Create fresh session state for each test."""
        self.mock_state: dict[str, Any] = {}

        # Patch get_session_state to return our mock
        patcher = patch(
            "streamlit.runtime.state.session_state_proxy.get_session_state",
            return_value=self._create_mock_state(),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def _create_mock_state(self):
        """Create a mock that behaves like SafeSessionState."""
        # ... mock implementation ...

    def test_basic_field_access(self):
        """Test that fields can be accessed via the class."""
        @st.session_state
        class MyState:
            counter: int = 0

        assert MyState.counter == 0
        MyState.counter = 5
        assert MyState.counter == 5

    def test_field_stored_in_session_state(self):
        """Test that fields are stored in session_state dict."""
        @st.session_state
        class MyState:
            value: str = "test"

        assert self.mock_state["value"] == "test"

    def test_method_modifies_state(self):
        """Test that methods can modify state fields."""
        @st.session_state
        class Counter:
            count: int = 0

            def increment(self):
                self.count += 1

        Counter.increment()
        assert Counter.count == 1

    def test_key_collision_raises_error(self):
        """Test that duplicate field names raise an error."""
        @st.session_state
        class StateA:
            shared_key: int = 0

        with pytest.raises(StreamlitAPIException, match="Key collision"):
            @st.session_state
            class StateB:
                shared_key: int = 0  # Should fail

    def test_same_class_can_reregister(self):
        """Test that script reruns don't cause collision errors."""
        @st.session_state
        class MyState:
            value: int = 0

        # Simulate rerun - redefine same class
        @st.session_state
        class MyState:  # noqa: F811
            value: int = 0

        # Should not raise

    def test_instantiation_raises_error(self):
        """Test that trying to instantiate raises an error."""
        @st.session_state
        class MyState:
            value: int = 0

        with pytest.raises(StreamlitAPIException, match="should not be instantiated"):
            MyState()

    def test_field_without_default_raises_error(self):
        """Test that fields must have defaults."""
        with pytest.raises(StreamlitAPIException, match="must have a default"):
            @st.session_state
            class MyState:
                value: int  # No default!

    def test_mutable_defaults_are_copied(self):
        """Test that mutable defaults don't share state."""
        @st.session_state
        class State1:
            items: list = []

        State1.items.append(1)

        # Create another class with same default
        # The list should be independent
        # ... test implementation ...
```

## Future Enhancements

### 1. Namespace Prefix Option

```python
@st.session_state(prefix="counter_")
class CounterState:
    value: int = 0  # Stored as "counter_value"
```

### 2. Frozen State Classes

```python
@st.session_state(frozen=True)
class Config:
    api_key: str = "..."  # Cannot be modified after init
```

### 3. Typed Session State Access

```python
# Type-safe access via session_state
counter: int = st.session_state.get_typed("counter", int)
```

### 4. State Validation

```python
@st.session_state
class ValidatedState:
    count: int = 0

    @st.session_state.validator("count")
    def validate_count(self, value: int) -> int:
        if value < 0:
            raise ValueError("Count cannot be negative")
        return value
```

## Timeline Estimate

- **Phase 1 (MVP)**: 2-3 days
- **Phase 2 (Methods)**: 1 day
- **Phase 3 (Polish)**: 2-3 days
- **Documentation**: 1 day
- **Total**: ~1 week
