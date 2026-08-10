
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

## Resetting a widget by deleting its key

Delete a keyed widget's entry to return the widget to its default in Python and in the browser. A few widgets cannot correct the browser yet; see the end of this section:

```python
def reset() -> None:
    del st.session_state["user_name"]


st.text_input("Name", value="", key="user_name")
st.button("Reset", on_click=reset)
```

`st.session_state.pop("user_name")` and `st.session_state.clear()` behave the same way for the widget key, because both delete it. `clear()` also removes every other key in session state, including the keys your app owns.

For a widget with `bind="query-params"`, the delete also removes the widget's query parameter from the URL. Other query parameters stay.

Delete the key in a callback to reset the widget in the same run. That is the recommended pattern.

If you delete the key in the script body after the widget rendered, the reset waits for the next rerun:

- For the rest of the delete run, the widget on screen keeps the old value, and the widget's return value is the old value. Inside a fragment run, the key itself already reads as missing, because the widget outside the fragment does not register again.
- On the next rerun the widget falls back to its default, unless the user changed the widget first. A change the user makes after the delete is newer than the delete, so it wins and `on_change` fires as usual.
- A script that deletes the key on every run therefore keeps a user's value for one run only, and returns to the default on the run after that.

A few widgets have no way to correct the browser, so a delete resets the Python value but leaves the browser showing the old value, and the old value returns on the next rerun: `st.file_uploader`, `st.camera_input`, `st.audio_input`, `st.data_editor`, custom components, and the selection state of `st.plotly_chart`, `st.altair_chart`, `st.vega_lite_chart`, and `st.pydeck_chart`.

## Widget input constraints are mostly client-side

Most widget input constraints—`options` allow-lists (`st.selectbox`, `st.multiselect`, `st.radio`), `min_value`/`max_value` (`st.slider`, `st.number_input`), `max_chars` (`st.text_input`), `disabled`, and `st.data_editor` column `validate`/`num_rows`—are primarily enforced in the browser for UX. Treat them as guardrails for normal users, **not** as a security boundary: a widget's return value (and its `st.session_state` entry) reflects what the client sent, and a modified or malicious client can submit values outside those constraints.

For any security-relevant or sensitive decision—authorization/role checks, database writes, file paths, spending or quota limits, or anything that must not exceed a declared bound—re-validate the value in your own script before acting on it:

```python
ALLOWED_ROLES = ["viewer", "editor"]
role = st.selectbox("Role", ALLOWED_ROLES, key="role")

# Don't rely on the widget's options as a security check.
if role not in ALLOWED_ROLES:
    st.error("Invalid role.")
    st.stop()
grant_access(role)
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
