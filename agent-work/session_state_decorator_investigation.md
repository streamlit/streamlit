# Investigation: `@st.session_state` Decorator for Dataclass-like State Classes

## Overview

This document investigates implementing `@st.session_state` as a class decorator that allows defining dataclass-like classes where properties are automatically stored in Streamlit's session state.

## Proposed API

```python
@st.session_state
class SessionState:
    counter: int = 0
    foo: str = "OMG!"

    def increment(self):
        self.counter += 1

    def reset(self):
        self.counter = 0

# Access via class (returns values from session state)
st.metric("Counter", SessionState.counter)

# Methods work via callbacks
st.button("Increment", on_click=lambda: SessionState.increment())
st.button("Reset", on_click=lambda: SessionState.reset())

# Direct assignment modifies session state
SessionState.foo += " YES"
st.write(SessionState.foo)

# Also accessible via dict-based session state
st.write(st.session_state["foo"])
```

## Requirements

1. **Class Decorator**: `@st.session_state` decorates a class
2. **Property Storage**: Properties are stored in session state with the property name as key
3. **Method Support**: Methods defined on the class work and can modify state
4. **Multiple Classes**: Multiple decorated classes can exist in the same script
5. **Key Collision Detection**: Exception raised if two classes define the same property name
6. **Dual Access**: Properties accessible both via class (`SessionState.counter`) and dict (`st.session_state["counter"]`)

## Current Architecture

### Session State Components

1. **`SessionState`** (`lib/streamlit/runtime/state/session_state.py`):
   - Core dataclass storing state values
   - Manages `_old_state`, `_new_session_state`, `_new_widget_state`

2. **`SafeSessionState`** (`lib/streamlit/runtime/state/safe_session_state.py`):
   - Thread-safe wrapper around `SessionState`
   - Used by script runners

3. **`SessionStateProxy`** (`lib/streamlit/runtime/state/session_state_proxy.py`):
   - Stateless singleton exposed as `st.session_state`
   - Proxies all operations to the current session's state
   - Implements `MutableMapping[Key, Any]`

4. **Exposure** (`lib/streamlit/__init__.py`):
   ```python
   session_state = _SessionStateProxy()
   ```

## Implementation Approach

### Option 1: Add `__call__` to `SessionStateProxy`

The simplest approach is to add a `__call__` method to `SessionStateProxy` that acts as a class decorator.

**Pros**:
- Minimal changes to existing architecture
- Follows Thiago's prototype closely
- Natural API: `@st.session_state`

**Cons**:
- Mixes responsibility (proxy + decorator factory)

### Option 2: Separate Decorator Factory

Create a separate `session_state_class` function and alias it.

**Pros**:
- Clean separation of concerns
- Could offer `@st.session_state_class` as explicit name

**Cons**:
- More code to maintain
- Need to decide on naming

### Recommendation: Option 1

The decorator is conceptually related to session state, so having it on the same object makes sense. The `@st.session_state` syntax is intuitive.

## Implementation Details

### 1. State Class Proxy

When `@st.session_state` decorates a class, it returns a proxy class that:

```python
class _StateClassProxy:
    """Proxy class returned by @st.session_state decorator."""

    _fields: dict[str, Any]  # Field names -> default values
    _methods: dict[str, Callable]  # Method names -> bound methods
    _registered_keys: ClassVar[set[str]]  # Track all registered keys globally
```

### 2. Field Detection

Extract fields from the class definition:
- Class attributes with type annotations (e.g., `counter: int = 0`)
- Class attributes without annotations but with values (e.g., `counter = 0`)

```python
import dataclasses
import inspect

def _extract_fields(cls: type) -> dict[str, Any]:
    """Extract field names and default values from a class."""
    fields = {}

    # Get type annotations (Python 3.10+ style)
    annotations = getattr(cls, '__annotations__', {})

    for name, type_hint in annotations.items():
        # Skip private attributes and methods
        if name.startswith('_'):
            continue
        # Get default value if exists
        default = getattr(cls, name, dataclasses.MISSING)
        if default is dataclasses.MISSING:
            raise StreamlitAPIException(
                f"Field '{name}' in @st.session_state class must have a default value"
            )
        fields[name] = default

    return fields
```

### 3. Key Collision Detection

Track registered keys across all decorated classes per session:

```python
# Store in session state itself to be session-scoped
_SESSION_STATE_CLASS_KEYS = "$$_session_state_class_registered_keys"

def _check_key_collision(field_name: str, class_name: str) -> None:
    """Raise exception if field name is already registered."""
    from streamlit.runtime.state.session_state_proxy import get_session_state

    state = get_session_state()
    if _SESSION_STATE_CLASS_KEYS not in state:
        state[_SESSION_STATE_CLASS_KEYS] = {}

    registered = state[_SESSION_STATE_CLASS_KEYS]
    if field_name in registered:
        raise StreamlitAPIException(
            f"Key collision: '{field_name}' is already registered by "
            f"@st.session_state class '{registered[field_name]}'. "
            f"Cannot register it again for class '{class_name}'."
        )
    registered[field_name] = class_name
```

### 4. Proxy Class Implementation

```python
def _create_state_class_proxy(cls: type[T]) -> type[T]:
    """Create a proxy class that stores state in session_state."""

    fields = _extract_fields(cls)
    methods = _extract_methods(cls)
    class_name = cls.__name__

    class StateClassProxy:
        """Proxy for @st.session_state decorated class."""

        def __init__(self):
            raise StreamlitAPIException(
                f"@st.session_state class '{class_name}' should not be instantiated. "
                "Access fields directly via the class, e.g., {class_name}.counter"
            )

        @classmethod
        def _initialize_fields(cls) -> None:
            """Initialize fields in session state with defaults."""
            from streamlit.runtime.state.session_state_proxy import get_session_state
            state = get_session_state()

            for name, default in fields.items():
                _check_key_collision(name, class_name)
                if name not in state:
                    state[name] = default

        def __class_getattr__(cls, name: str) -> Any:
            """Get field value from session state."""
            if name in fields:
                from streamlit.runtime.state.session_state_proxy import get_session_state
                return get_session_state()[name]
            if name in methods:
                return methods[name]
            raise AttributeError(f"'{class_name}' has no attribute '{name}'")

        def __class_setattr__(cls, name: str, value: Any) -> None:
            """Set field value in session state."""
            if name in fields:
                from streamlit.runtime.state.session_state_proxy import get_session_state
                get_session_state()[name] = value
            else:
                raise AttributeError(
                    f"Cannot set attribute '{name}' on @st.session_state class. "
                    "Only defined fields can be set."
                )

    # Use metaclass for class-level attribute access
    # ... implementation details ...

    return StateClassProxy
```

### 5. Metaclass for Class-Level Attribute Access

To enable `SessionState.counter` syntax (accessing attributes on the class itself, not instances), we need a metaclass:

```python
class _StateClassMeta(type):
    """Metaclass that proxies attribute access to session state."""

    _fields: dict[str, Any]
    _methods: dict[str, Callable]
    _class_name: str

    def __getattr__(cls, name: str) -> Any:
        if name.startswith('_'):
            return super().__getattribute__(name)

        if name in cls._fields:
            from streamlit.runtime.state.session_state_proxy import get_session_state
            return get_session_state()[name]

        if name in cls._methods:
            # Return a bound method that operates on session state
            return cls._methods[name]

        raise AttributeError(f"'{cls._class_name}' has no attribute '{name}'")

    def __setattr__(cls, name: str, value: Any) -> None:
        if name.startswith('_'):
            super().__setattr__(name, value)
            return

        if name in cls._fields:
            from streamlit.runtime.state.session_state_proxy import get_session_state
            get_session_state()[name] = value
        else:
            raise AttributeError(
                f"Cannot set attribute '{name}' on @st.session_state class. "
                "Only defined fields can be set."
            )
```

### 6. Method Binding

Methods need special handling to access the session state:

```python
class _StateAccessor:
    """Helper class that proxies attribute access to session state for methods."""

    def __init__(self, fields: dict[str, Any]):
        object.__setattr__(self, '_fields', fields)

    def __getattr__(self, name: str) -> Any:
        if name in self._fields:
            from streamlit.runtime.state.session_state_proxy import get_session_state
            return get_session_state()[name]
        raise AttributeError(f"No field '{name}'")

    def __setattr__(self, name: str, value: Any) -> None:
        if name in self._fields:
            from streamlit.runtime.state.session_state_proxy import get_session_state
            get_session_state()[name] = value
        else:
            object.__setattr__(self, name, value)


def _bind_method(method: Callable, fields: dict[str, Any]) -> Callable:
    """Bind a method to use StateAccessor as self."""
    accessor = _StateAccessor(fields)
    return lambda *args, **kwargs: method(accessor, *args, **kwargs)
```

## Complete Prototype

See `prototype.py` for a working implementation.

## Integration with SessionStateProxy

### Changes to `session_state_proxy.py`

```python
class SessionStateProxy(MutableMapping[Key, Any]):
    # ... existing code ...

    @gather_metrics("session_state.__call__")
    def __call__(self, cls: type[T]) -> type[T]:
        """Decorator to create a session state class.

        Example
        -------
        >>> @st.session_state
        ... class MyState:
        ...     counter: int = 0
        ...     name: str = "default"
        ...
        ...     def increment(self):
        ...         self.counter += 1
        >>>
        >>> MyState.counter  # Access from session state
        0
        >>> MyState.increment()  # Modify session state
        >>> MyState.counter
        1
        """
        return _create_state_class_proxy(cls)
```

## Edge Cases & Considerations

### 1. Script Reruns

On each script rerun, the decorator is called again. We need to ensure:
- Fields are only initialized once (on first run)
- Key collision detection works across reruns

### 2. Multiple Sessions

Each session has its own session state, so:
- Each session gets independent state values
- Key collision detection is per-session

### 3. Type Safety

The proxy class should preserve type hints for IDE support:
- Use `typing.cast` or return `cls` from `__call__` for type checker
- Consider using `ParamSpec` and `TypeVar` for proper typing

### 4. Default Value Handling

- Mutable defaults (lists, dicts) should be handled carefully
- Consider using `field(default_factory=...)` pattern like dataclasses

### 5. Widget Integration

Users might want to bind state class fields to widgets:
```python
st.number_input("Counter", key="counter")  # Works if field name matches
```

## Alternative Designs Considered

### A. Instance-Based Approach

```python
@st.session_state
class SessionState:
    counter: int = 0

state = SessionState()  # Creates instance
state.counter += 1
```

**Rejected because**: Creates confusion about whether state is shared, and the instance-less class access (`SessionState.counter`) is more intuitive for global state.

### B. Namespace Prefix

```python
@st.session_state(prefix="my_")
class SessionState:
    counter: int = 0  # Stored as "my_counter"
```

**Possible future enhancement** to avoid key collisions, but adds complexity.

### C. Frozen Classes

```python
@st.session_state(frozen=True)
class Config:
    theme: str = "dark"  # Cannot be modified after first run
```

**Possible future enhancement** for configuration that shouldn't change.

## Testing Strategy

1. **Unit Tests**:
   - Field extraction from various class definitions
   - Key collision detection
   - Proxy attribute access (get/set)
   - Method binding and execution

2. **Integration Tests**:
   - Multiple decorated classes
   - Interaction with widgets
   - Script reruns maintaining state

3. **E2E Tests**:
   - Full app with state class
   - Button callbacks modifying state
   - State persistence across reruns

## Next Steps

1. Implement prototype in `session_state_proxy.py`
2. Add unit tests
3. Add type stubs for IDE support
4. Add documentation
5. Consider TypedDict-style alternative for simpler use cases
