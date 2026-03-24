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

Use `@st.session_state` as a class decorator to define dataclass-like state classes.

```python
@st.session_state
class AppState:
    counter: int = 0
    username: str = "Anonymous"
    items: list[str] = []

    def increment(self):
        self.counter += 1
```

### Behavior

| Feature                      | Behavior                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Type-annotated fields        | Fields with annotations become session state variables                   |
| Default values               | Required for all fields; used on first access                            |
| Mutable defaults             | Lists/dicts are deep-copied per session (like dataclasses `field()`)     |
| In-place mutations           | `self.items` returns the actual stored reference; mutations persist      |
| Methods                      | Can read/modify state via `self`; work as callbacks                      |
| Multiple classes             | Allowed; each class has its own namespace                                |
| Key prefixing                | Keys are prefixed with class name: `Counter.count` → `"Counter.count"`   |
| Widget key binding           | Widgets can bind to class fields via `key="ClassName.field"`             |
| Script rerun safe            | State persists; class can be redefined safely                            |
| Session state compatibility  | Fields accessible via `st.session_state["ClassName.field_name"]`         |

### Examples

**Basic counter with methods:**

```python
import streamlit as st

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

**Two access patterns (both equivalent):**

```python
@st.session_state
class AppState:
    counter: int = 0

    def increment(self):
        self.counter += 1

# Pattern 1: Class-level access (quick scripts)
st.metric("Count", AppState.counter)
st.button("+1", on_click=AppState.increment)

# Pattern 2: Instance-based access (recommended)
state = AppState()
st.metric("Count", state.counter)
st.button("+1", on_click=state.increment)
```

**Multiple state classes for organization:**

```python
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

### Session State Compatibility

Keys are automatically prefixed with the class name to avoid collisions:

```python
@st.session_state
class Counter:
    count: int = 0

@st.session_state
class Analytics:
    count: int = 0  # No collision—different namespace

# Access via class (recommended)
Counter.count        # → 0
Analytics.count      # → 0

# Access via st.session_state (if needed)
st.session_state["Counter.count"]     # → 0
st.session_state["Analytics.count"]   # → 0
```

### Error Handling

```python
# Fields must have defaults
@st.session_state
class Invalid:
    value: int  # StreamlitAPIException: Field 'value' must have a default value
```

---

## Design Decisions

### Key Naming: Prefixed vs. Flat

Keys are prefixed with the class name (e.g., `Counter.count` instead of `count`).

**Why prefixed keys:**

- ✅ **Fewer collisions**: Different classes can have fields with the same name
- ✅ **Predictable**: Key names are deterministic based on class + field name
- ✅ **Organized**: `st.session_state` stays organized when viewing all keys
- ✅ **Debuggable**: Easy to identify which class owns each key

**Same class name = same state:**

If two modules define a class with the same name and field, they share state:

```python
# module_a.py
@st.session_state
class Counter:
    count: int = 0

# module_b.py
@st.session_state
class Counter:
    count: int = 0  # Same key "Counter.count" — shared state
```

This is intentional: it enables sharing state across modules when desired, and keeps key
names simple. To avoid unintended sharing, use distinct class names (e.g., `PageACounter`,
`PageBCounter`).

---

## Alternatives Considered

### `st.session_state.init()` Method

**Approach:** Add a simple convenience method for bulk initialization.

```python
def init(
    defaults: dict[str, Any],
    *,
    mode: Literal["skip", "update"] = "skip",
) -> None: ...
```

**Usage:**

```python
st.session_state.init({
    "counter": 0,
    "username": "Anonymous",
    "items": [],
})

st.session_state.counter += 1
```

**Pros:**

- ✅ Minimal API surface (one new method)
- ✅ Easy to understand and adopt
- ✅ Directly addresses issue #10089

**Cons:**

- ❌ No type hints / IDE autocomplete for state variables
- ❌ No method encapsulation
- ❌ Doesn't address issue #9455

**Why not selected:** While simpler, this approach doesn't solve the type safety problem
that many users are asking for. However, it could be shipped as a complementary feature
for users who just want reduced boilerplate.

### TypedDict Declaration

**Approach:** Allow declaring session state shape using TypedDict for type safety.

```python
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

# IDE now knows the types
st.session_state["counter"] += 1
```

**Pros:**

- ✅ Standard Python typing (TypedDict is well-known)
- ✅ Full IDE autocomplete and type checking
- ✅ No runtime magic—TypedDict is just for static analysis

**Cons:**

- ❌ TypedDict requires dict-style access (`state["counter"]`) for full type safety
- ❌ Doesn't support methods on state
- ❌ Two places to define things (TypedDict + defaults dict)

**Why not selected:** TypedDict provides type safety but doesn't support methods, and
the dict-style access is less ergonomic than attribute access. The class decorator
approach provides both type safety and method support with a more Pythonic API.

---

## Out of Scope (Future Work)

- **Configurable key prefix**: Add a `prefix: bool | str = True` parameter to control key
  naming. `True` (default) uses the class name, `False` disables prefixing (flat keys),
  and a string uses a custom prefix. Example:
  ```python
  @st.session_state(prefix=False)  # Flat keys: "count" instead of "Counter.count"
  class Counter:
      count: int = 0

  @st.session_state(prefix="app")  # Custom prefix: "app.count"
  class Counter:
      count: int = 0
  ```
- **Nested state classes**: Composing state classes within each other
- **Validation**: Runtime type validation of assigned values
- **Serialization**: Automatic JSON/pickle serialization hooks
- **Pydantic/attrs integration**: Using existing dataclass libraries

---

## Checklist

| Item                       | ✅ or comment                                                  |
| -------------------------- | -------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅ Uses existing session_state mechanism                       |
| No breaking API changes    | ✅ Additive only                                               |
| No new dependencies        | ✅                                                             |
| Metrics collected          | ✅ Track decorator usage                                       |
| Any security/legal impact? | ✅ No—uses existing session_state                              |
| Any docs changes needed?   | ✅ Document new API, add cookbook examples                     |
