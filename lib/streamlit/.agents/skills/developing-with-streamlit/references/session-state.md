
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

**Accessing uninitialized keys raises an error:** `KeyError` for `st.session_state["key"]` and `AttributeError` for `st.session_state.key`. Use `st.session_state.get("key", default)` for safe access.

## Widget-state association

Every widget with a `key` parameter automatically syncs to session state:

```python
name = st.text_input("Name", key="user_name")
# st.session_state.user_name contains the same value as `name`
```

By default, a keyed widget's value is dropped when the widget stops being rendered. Use [`persist_state`](#persisting-widget-values-persist_state) to keep it without exposing it in the URL; `bind="query-params"` also preserves the value.

## Syncing a widget to the URL (shareable links)

To make a widget's value shareable through the page URL, pass `bind="query-params"` together with `key=`. Streamlit writes the value to the URL query string when it changes and restores it from the URL on load and on browser back/forward — **don't hand-roll `st.query_params`** for this. The `key=` becomes the query-parameter name.

```python
# GOOD: one widget, automatic URL sync. Picking "Newest" -> ?sort=Newest;
# loading ?sort=Price reopens with "Price" selected.
sort = st.selectbox(
    "Sort order",
    ["Relevance", "Newest", "Price"],
    key="sort",  # REQUIRED with bind=; becomes the URL param name (?sort=...)
    bind="query-params",  # exact string, with a hyphen
)
st.write(f"Sorting by: {sort}")
```

```python
# BAD: hand-rolled plumbing. More code, an extra rerun to guard, it conflicts
# with bind= (a bound param can't be set/deleted via st.query_params), and it
# crashes on an unexpected URL value — .index(default) raises ValueError if a
# user opens ?sort=Foo. With bind="query-params", an unknown URL value just
# falls back to the default instead of raising.
default = st.query_params.get("sort", "Relevance")
sort = st.selectbox(
    "Sort order",
    ["Relevance", "Newest", "Price"],
    index=["Relevance", "Newest", "Price"].index(default),
)
st.query_params["sort"] = sort  # don't do this when bind= handles sync
```

Notes:
- `bind="query-params"` requires `key=`. The only valid value is the exact string `"query-params"` (hyphen, not `"query_params"`); anything else is invalid. Not supported with `st.text_input(type="password")`.
- Browser back/forward restores the bound value from the URL (or the widget default if the param is missing). That restore does not fire `on_change`. A missing param on history navigation also overrides a value assigned in `st.session_state` before the widget call; initial load leaves that assignment in place.
- When the value equals the default, the param is dropped from the URL to keep it clean.
- A `disabled=True` widget ignores its param: it keeps its default or previous value, and the param is removed or rewritten to that value. To preset a locked widget from a link, read `st.query_params` yourself and pass the value in.
- A bound param can't be set or deleted through `st.query_params` — change it programmatically by assigning to `st.session_state[key]` *before* the widget renders, or from an `on_change` callback. Assigning after the widget has already rendered on the same run raises `StreamlitWidgetAlreadyInstantiatedError` (see [Modifying state after widget creation](#modifying-state-after-widget-creation)). Do not mix `bind=` with manual `st.query_params` reads/writes.
- Still render the value (e.g. `st.write(f"Sorting by: {sort}")`) if the app needs to show the current selection.
- Works on input widgets generally. It's **not** supported on trigger/button widgets (`st.button`, `st.download_button`, `st.form_submit_button`, `st.menu_button`), file and media inputs (`st.file_uploader`, `st.camera_input`, `st.audio_input`), `st.chat_input`, or `st.data_editor`, nor on selections from `st.dataframe`/charts — assume any other input widget supports it. (Listing the exceptions rather than every supported widget keeps this from going stale as new widgets ship.)
- Multi-page apps: query params belong to the app URL, not an individual page, so a bound value persists in the URL across `st.navigation` page switches and is shared app-wide. If two pages bind widgets to the same `key=`, they share that value — use distinct keys per page when you don't want it to carry over.
- To keep a value across reruns or page switches *without* exposing it in the URL, use `persist_state` instead (see [Persisting widget values](#persisting-widget-values-persist_state)); when both are set, `bind` takes precedence.

## Widget input constraints

The server checks every value a client sends, including a bound URL parameter, against the widget as the app rendered it, and drops a value that breaks a constraint before any callback runs. The widget keeps its previous value. This holds for a modified client too, so app code doesn't need to re-check these:

- `options` (`st.selectbox`, `st.radio`, `st.multiselect`, `st.pills`, `st.select_slider`, …), unless `accept_new_options=True` lets the user type any non-empty text, and `max_selections`
- `min_value`/`max_value`, `max_chars`, and the shape of a date, time, color, or range
- `required`: a client can't empty a required widget
- `disabled`: a disabled widget accepts nothing
- Rendering: a widget the latest run didn't render, such as a button behind `if is_admin:`, after `st.stop()`, or in a closed dialog, accepts no click or change

Still not enforced on the server, so check these yourself when they matter:

- `validate` on `st.text_input`, including the email or URL check `type` implies. It runs only in the browser.
- `step`: any value within the bounds is accepted.
- `st.data_editor` edits and column constraints, and dataframe or chart selections.
- Custom component values: a component declares no constraints, so any value it can send is accepted.
- Uploads to `st.file_uploader`, `st.camera_input`, `st.audio_input`, and `st.chat_input`: a file's contents, the MIME type the client reports, and a widget's own `max_upload_size`. The server checks only the file name's extension against `type`, and the size against `server.maxUploadSize`.
- An untouched required widget: it returns its empty default (`None`, `""`, or `[]`) until the user fills it. Only the browser blocks a form submit while a required field is empty, and a required `st.pills` or `st.segmented_control` without a default can return to empty inside a form.
- Authorization, file contents, and business rules, such as whether *this* user may pick an option:

```python
role = st.selectbox("Role", ["viewer", "editor"], key="role")

# The options are enforced. Whether this user may grant "editor" is not.
if role == "editor" and not user_is_admin():
    st.error("Only admins can grant editor access.")
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

`persist_state` requires a `key` and is available on every widget that supports `bind="query-params"` except `st.tabs` and `st.expander`. When both are set, `bind` takes precedence, so the value lives in the URL and persists across page switches regardless of the `persist_state` scope.

## Callbacks

Callbacks execute **before** the script reruns, allowing immediate state changes. Use `on_change` or `on_click` with optional `args` and `kwargs`:

```python
def increment(amount):
    st.session_state.count += amount


st.button("Add 5", on_click=increment, args=(5,))
```

Streamlit stores `args` and `kwargs` when the widget command runs, not when the user interacts. Callbacks run before this run's widget commands, so a widget return value passed through `args=` or `kwargs=` is the previous run's value. To read any widget in a callback, including the widget that triggered it, give it a `key` and read `st.session_state` inside the callback.

```python
# BAD: `text` is the previous run's value, so a just-typed edit can be lost
text = st.text_area("Notes")
st.button("Save", on_click=save, args=(text,))
```

```python
# GOOD: st.session_state.notes already holds the latest input when the callback runs
def save():
    save_notes(st.session_state.notes)


st.text_area("Notes", key="notes")
st.button("Save", on_click=save)
```

Calling `st.rerun()` or `st.switch_page()` inside a callback ends that callback immediately (statements after the call don't run). Streamlit still runs the interaction's other callbacks before performing the rerun or navigation.

`on_change` can also be `"ignore"` or `"rerun"` instead of a callback on some widgets. `"ignore"` updates the widget without a rerun; see [Skip reruns on individual widgets](performance.md#skip-reruns-on-individual-widgets-advanced).

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

You cannot assign to a widget's session state key after that widget has been instantiated on the current run. This raises `StreamlitWidgetAlreadyInstantiatedError`.

```python
st.slider("Value", key="my_slider")
st.session_state["my_slider"] = 50  # Raises StreamlitWidgetAlreadyInstantiatedError
```

Assign the value **before** creating the widget:

```python
st.session_state.setdefault("my_slider", 50)
st.slider("Value", key="my_slider")
```

Or from an `on_change` / `on_click` callback (callbacks run before widgets are instantiated):

```python
def reset_slider():
    st.session_state["my_slider"] = 50


st.button("Reset", on_click=reset_slider)
st.slider("Value", key="my_slider")
```

For widgets whose keys are read-only (see [Read-only widget keys](#read-only-widget-keys)), store values in a different session state key.

### Read-only widget keys

Some widgets are read-only in session state (buttons and button-like triggers, file and media inputs, `st.data_editor`, `st.form` keys, and chart or `ButtonColumn` selections). Creating one after assigning to its key raises `StreamlitValueAssignmentNotAllowedError`. Keep that key read-only and store values you need to set in a **different** session state key:

```python
def mark_done():
    st.session_state["done"] = True


st.button("Done", key="done_btn", on_click=mark_done)
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
