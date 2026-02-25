---
author: lukasmasuch
created: 2026-02-25
---

# Declarative Session State Definition

## Summary

Provide a declarative way to define session state variables with type hints, default
values, and optional methods. This addresses the common boilerplate pattern of
initializing session state at the top of every app while enabling better IDE support
and type safety.

## Problem

Managing session state in Streamlit apps requires repetitive boilerplate code:

```python
# Current pattern - verbose and error-prone
if "counter" not in st.session_state:
    st.session_state.counter = 0
if "username" not in st.session_state:
    st.session_state.username = "Anonymous"
if "items" not in st.session_state:
    st.session_state.items = []  # Mutable default - easy to forget

def increment():
    st.session_state.counter += 1
```

**Pain points:**

1. **Boilerplate**: Every session state variable needs an `if` check
2. **No type hints**: `st.session_state` is untyped, so IDEs can't provide autocomplete
3. **Scattered initialization**: State variables are often initialized throughout the code
4. **Mutable defaults**: Easy to accidentally share mutable objects across sessions
5. **No organization**: Large apps have dozens of state variables with no grouping

**User requests:**

- [#10089](https://github.com/streamlit/streamlit/issues/10089) — Session State
  convenience function for initialization (requests `st.session_state.from_dict()`)
- [#9455](https://github.com/streamlit/streamlit/issues/9455) — Type-hint values in
  session_state (requests TypedDict support for IDE autocomplete)

**Current workarounds:**

```python
# Workaround 1: Dict-based initialization (still no type hints)
defaults = {"counter": 0, "username": "Anonymous", "items": []}
for key, value in defaults.items():
    if key not in st.session_state:
        st.session_state[key] = value

# Workaround 2: Custom wrapper class (verbose, non-standard)
class AppState:
    @property
    def counter(self) -> int:
        return st.session_state.get("counter", 0)
    @counter.setter
    def counter(self, value: int):
        st.session_state.counter = value
```

---

## Proposal

We present three options, ranging from minimal API changes to a full class decorator
approach. Each addresses different levels of the problem.

---

### Option 1: `st.session_state.init()` Method

**Approach:** Add a simple convenience method for bulk initialization.

```python
st.session_state.init(
    defaults: dict[str, Any],
    *,
    mode: Literal["skip", "update"] = "skip",
) -> None
```

**Usage:**

```python
import streamlit as st

st.session_state.init({
    "counter": 0,
    "username": "Anonymous",
    "items": [],
})

# Use as normal
st.session_state.counter += 1
```

**Parameters:**

| Parameter  | Type                           | Default  | Description                                           |
| ---------- | ------------------------------ | -------- | ----------------------------------------------------- |
| `defaults` | `dict[str, Any]`               | required | Key-value pairs to initialize                         |
| `mode`     | `Literal["skip", "update"]`    | `"skip"` | `"skip"`: only set if key doesn't exist. `"update"`: always set (merge). |

**Behavior:**

- Mutable defaults (lists, dicts) are deep-copied automatically
- With `mode="skip"` (default), existing values are preserved
- With `mode="update"`, values are overwritten (useful for resetting state)

**Pros:**

- Minimal API surface (one new method)
- Easy to understand and adopt
- Directly addresses issue #10089
- No metaclass magic or decorator complexity

**Cons:**

- No type hints / IDE autocomplete for state variables
- No method encapsulation
- Doesn't address issue #9455

---

### Option 2: TypedDict Declaration

**Approach:** Allow declaring session state shape using TypedDict for type safety.

```python
st.session_state.declare(
    schema: type[TypedDict],
    *,
    defaults: dict[str, Any] | None = None,
) -> None
```

**Usage:**

```python
import streamlit as st
from typing import TypedDict

class AppState(TypedDict, total=False):
    counter: int
    username: str
    items: list[str]

st.session_state.declare(AppState, defaults={
    "counter": 0,
    "username": "Anonymous",
    "items": [],
})

# IDE now knows the types!
st.session_state["counter"] += 1  # IDE knows this is int
```

**Alternative syntax using `st.SessionState` type alias:**

```python
import streamlit as st

class AppState(st.SessionState, total=False):
    counter: int
    username: str
    items: list[str]

# Automatically declares when class is defined
state = AppState()  # Returns typed proxy to st.session_state

state["counter"] += 1  # Full type hints
state.counter += 1     # Also works with attribute access
```

**Pros:**

- Standard Python typing (TypedDict is well-known)
- Full IDE autocomplete and type checking
- No runtime magic - TypedDict is just for static analysis
- Explicitly opt-in per app

**Cons:**

- TypedDict requires dict-style access (`state["counter"]`) for full type safety
- Doesn't support methods on state
- More verbose than Option 1 for simple cases
- Two places to define things (TypedDict + defaults)

---

### Option 3: Class Decorator ✅ PREFERRED

**Approach:** Use `st.session_state` as a class decorator to define dataclass-like
state classes. Based on [prototype PR #13592](https://github.com/streamlit/streamlit/pull/13592).

```python
@st.session_state
class AppState:
    counter: int = 0
    username: str = "Anonymous"
    items: list[str] = []

    def increment(self):
        self.counter += 1
```

**Two access patterns:**

```python
# Pattern 1: Class-level access (quick scripts)
st.metric("Count", AppState.counter)
st.button("Increment", on_click=AppState.increment)
AppState.counter = 100

# Pattern 2: Instance-based access (recommended)
state = AppState()
st.metric("Count", state.counter)
st.button("Increment", on_click=state.increment)
state.counter = 100
```

Both patterns access the same underlying `st.session_state` - they're interchangeable.

**API:**

```python
@st.session_state
def session_state(cls: type[T]) -> type[T]:
    """Decorator that transforms a class into a session state proxy.

    Fields with type annotations and default values become session state
    variables. Methods can read and modify state via `self`.

    Parameters
    ----------
    cls : type
        A class with type-annotated fields and optional methods.

    Returns
    -------
    type
        A proxy class that stores all field values in st.session_state.

    Examples
    --------
    >>> @st.session_state
    ... class Counter:
    ...     count: int = 0
    ...     def increment(self):
    ...         self.count += 1
    >>>
    >>> Counter.count  # Read from session state
    0
    >>> Counter.increment()  # Modifies session state
    >>> Counter.count
    1
    """
```

**Features:**

| Feature                      | Behavior                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Type-annotated fields        | Fields with annotations become session state variables                   |
| Default values               | Required for all fields; used on first access                            |
| Mutable defaults             | Lists/dicts are deep-copied per session (like dataclasses `field()`)     |
| Methods                      | Can read/modify state via `self`; work as callbacks                      |
| Multiple classes             | Allowed; keys are stored flat in session state                           |
| Key collision detection      | Error if two classes define the same field name                          |
| Script rerun safe            | State persists; class can be redefined safely                            |
| Session state compatibility  | Fields accessible via `st.session_state["field_name"]`                   |

**Examples:**

```python
import streamlit as st

# Basic counter with method
@st.session_state
class Counter:
    count: int = 0
    step: int = 1

    def increment(self):
        self.count += self.step

    def reset(self):
        self.count = 0

# Usage
state = Counter()
st.metric("Count", state.count)
col1, col2 = st.columns(2)
col1.button("Increment", on_click=state.increment)
col2.button("Reset", on_click=state.reset)
```

```python
# Multiple state classes for organization
@st.session_state
class UserState:
    username: str = "Anonymous"
    theme: Literal["light", "dark"] = "light"

@st.session_state
class CartState:
    items: list[str] = []
    total: float = 0.0

    def add_item(self, item: str, price: float):
        self.items.append(item)
        self.total += price

    def clear(self):
        self.items = []
        self.total = 0.0
```

**Error handling:**

```python
# Fields must have defaults
@st.session_state
class Invalid:
    value: int  # StreamlitAPIException: Field 'value' must have a default value

# Key collisions are detected
@st.session_state
class StateA:
    shared_key: int = 0

@st.session_state
class StateB:
    shared_key: int = 0  # StreamlitAPIException: Key 'shared_key' already registered
```

**Pros:**

- Cleanest, most Pythonic syntax
- Full IDE autocomplete and type checking
- Encapsulates related state and methods
- Familiar dataclass-like pattern
- Methods work directly as `on_click` callbacks

**Cons:**

- More complex implementation (metaclass + descriptors)
- Flat key storage means potential for collisions across classes
- Class-level access pattern may be unfamiliar to some users
- Decorator on `st.session_state` is unconventional

---

## Comparison

| Aspect                  | Option 1: `init()`   | Option 2: TypedDict      | Option 3: Decorator      |
| ----------------------- | -------------------- | ------------------------ | ------------------------ |
| Boilerplate reduction   | High                 | Medium                   | Highest                  |
| Type hints / IDE        | No                   | Yes                      | Yes                      |
| Method support          | No                   | No                       | Yes                      |
| Learning curve          | Minimal              | Low (familiar pattern)   | Medium                   |
| Implementation effort   | Low                  | Medium                   | High                     |
| Addresses #10089        | Yes                  | Yes                      | Yes                      |
| Addresses #9455         | No                   | Yes                      | Yes                      |

---

## Recommendation

**Option 3 (Class Decorator)** is preferred because:

1. It provides the most complete solution to both user requests
2. The dataclass-like pattern is familiar to Python developers
3. Method support enables cleaner callback patterns
4. It's the most Pythonic approach for organizing related state

However, **Option 1 (`init()`)** could be shipped first as a quick win, with Option 3
following as a more comprehensive solution. The two are not mutually exclusive.

---

## Out of Scope (Future Work)

- **Nested state classes**: Composing state classes within each other
- **Validation**: Runtime type validation of assigned values
- **Serialization**: Automatic JSON/pickle serialization hooks
- **Namespace prefixes**: Automatic key prefixing to avoid collisions (e.g., `UserState.username` → `"UserState.username"`)
- **Pydantic/attrs integration**: Using existing dataclass libraries

---

## Checklist

| Item                       | ✅ or comment                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Uses existing session_state mechanism                       |
| No breaking API changes    | ✅ All options are additive                                    |
| No new dependencies        | ✅                                                             |
| Metrics collected          | ✅ Track decorator usage                                       |
| Any security/legal impact? | ✅ No - uses existing session_state                            |
| Any docs changes needed?   | ✅ Document new API, add cookbook examples                     |

---

## References

- **Prototype PR:** [#13592](https://github.com/streamlit/streamlit/pull/13592)
- **GitHub Issues:**
  - [#10089](https://github.com/streamlit/streamlit/issues/10089) — Session State convenience function (upvotes: 5+)
  - [#9455](https://github.com/streamlit/streamlit/issues/9455) — Type-hint session_state values
