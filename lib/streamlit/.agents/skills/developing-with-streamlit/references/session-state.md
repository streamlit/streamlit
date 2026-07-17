
# Using Streamlit session state

Streamlit reruns scripts top-to-bottom on every interaction. Without session state, variables reset each time. Use `st.session_state` to persist values across reruns.

## Basic usage

Session state is a dictionary-like object supporting attribute and bracket notation:

```python
# Initialize with setdefault (preferred)
st.session_state.setdefault("count", 0)

# Alternative: check before setting
if "count" not in st.session_state:
    st.session_state.count = 0

# Read
current = st.session_state.count

# Update
st.session_state.count += 1
st.session_state["count"] = 5  # Bracket notation also works

# Delete
del st.session_state.count
```

**Accessing uninitialized keys raises `KeyError`.** Use `st.session_state.get("key", default)` for safe access.

## Widget-state association

Every widget with a `key` parameter automatically syncs to session state:

```python
name = st.text_input("Name", key="user_name")
# st.session_state.user_name contains the same value as `name`
```

## Persisting widget values (`persist_state`)

By default, a keyed widget's value is lost when the widget stops being rendered (for example, when it's conditionally hidden or the user switches pages). Set the keyword-only `persist_state` parameter to keep the value:

- `None` (default): the value is dropped when the widget isn't rendered.
- `"page"`: the value is preserved while the user stays on the page where the widget is defined (e.g., while it's conditionally hidden); it's discarded on a page switch.
- `"session"`: the value is preserved for the whole session, including across page switches, so it returns when the user navigates back.

```python
st.text_input("Name", key="name", persist_state="session")
```

`persist_state` requires a `key` and is available on every widget that supports `bind="query-params"`. When both are set, `bind` takes precedence, so the value lives in the URL and persists across page switches regardless of the `persist_state` scope.

## Callbacks

Callbacks execute **before** the script reruns, allowing immediate state changes. Use `on_change` or `on_click` with optional `args` and `kwargs`:

```python
def increment(amount):
    st.session_state.count += amount

st.button("Add 5", on_click=increment, args=(5,))
```

Access a widget's value in its own callback via `st.session_state.key`, not the return variable.

## Initialization patterns

Initialize all state at the top of your app for clarity:

```python
st.session_state.setdefault("user", None)
st.session_state.setdefault("page", "home")
st.session_state.setdefault("filters", {})
```

## Multipage state

By default, widgets are NOT stateful across pages—their values reset when navigating between pages. To keep a widget's value across page switches, set `persist_state="session"` (see [Persisting widget values](#persisting-widget-values-persist_state) above).

### Sharing state

Use session state variables (not widget keys) to share data:

```python
# Page 1: Store value
st.session_state.selected_user = st.selectbox("User", users)

# Page 2: Read stored value
if "selected_user" in st.session_state:
    st.write(f"Selected: {st.session_state.selected_user}")
```

### Shared widgets pattern

Put common widgets in the entrypoint file (before `nav.run()`):

```python
# app.py (entrypoint)
with st.sidebar:
    st.session_state.theme = st.selectbox("Theme", ["Light", "Dark"])

nav = st.navigation(pages)
nav.run()
```

## Common mistakes

### Module-level mutable state

```python
# BAD: In imported modules, this is shared across ALL users
# utils.py
cache = {}  # Persists across reruns AND users!

# GOOD: Use session state for per-user data
st.session_state.setdefault("cache", {})
```

### Modifying state after widget creation

Cannot assign to a widget's state after the widget has rendered:

```python
st.slider("Value", key="my_slider")
st.session_state.my_slider = 50  # Raises StreamlitAPIException!
```

### Mixing `value` parameter and session state

Don't set both—it causes warnings:

```python
# BAD: Conflicting sources
st.session_state.setdefault("name", "Alice")
st.text_input("Name", value="Bob", key="name")  # Warning!

# GOOD: Use one or the other
st.session_state.setdefault("name", "Alice")
st.text_input("Name", key="name")
```

## Session characteristics

- **Per-user, per-tab**: Each browser tab has its own session
- **Temporary**: Lost when tab closes or server restarts
- **Not suitable for persistence**: Use databases for permanent storage

## References

- [st.session_state API](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.session_state)
- [Session State concepts](https://docs.streamlit.io/develop/concepts/architecture/session-state)
- [Widget behavior](https://docs.streamlit.io/develop/concepts/architecture/widget-behavior)
