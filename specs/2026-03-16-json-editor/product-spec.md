---
author: lukasmasuch
created: 2026-03-16
---

# JSON Editor Widget

## Summary

Add a new `st.json_editor` widget that allows users to interactively view and edit JSON
data. Unlike the existing `st.json` (display-only), this widget returns the edited JSON
value and supports the standard widget callback pattern.

## Problem

The current `st.json` command only supports viewing JSON data. Users need a way to edit
JSON structures directly in their Streamlit apps for use cases like configuration editors,
data manipulation tools, and debugging interfaces.

**Requests:**

- [#10819](https://github.com/streamlit/streamlit/issues/10819) — Add a JSON editor widget

**Use cases:**

- Configuration editors where users modify JSON settings
- Data inspection and manipulation tools
- API payload builders and testers
- Schema editors and validators
- Debugging interfaces for JSON data

**Current workarounds:**

- Using `st.text_area` with manual JSON parsing (no syntax highlighting, no validation)
- Third-party components like `streamlit-ace` (inconsistent theming, extra dependency)
- Building custom UIs with multiple widgets (verbose, poor UX for nested structures)

## Proposal

### API Design

**Option 1: New `st.json_editor` widget** ✅ PREFERRED

```python
st.json_editor(
    value: dict | list | str,
    *,
    key: Key | None = None,
    height: int | None = None,
    on_change: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    disabled: bool = False,
) -> dict | list | str
```

- Pros: Clean separation between display (`st.json`) and edit (`st.json_editor`)
- Pros: Follows widget naming pattern (`st.text_input` vs `st.text`)
- Pros: No confusion about when return value is meaningful
- Cons: New command to learn

**Option 2: Add parameter to `st.json`**

```python
st.json(body, *, expanded=True, editable=False, key=None, on_change=None, ...)
```

- Pros: Single command for JSON display/edit
- Cons: Muddies the display element vs widget distinction
- Cons: Return type changes based on `editable` parameter (confusing)
- Cons: `st.json` currently returns `DeltaGenerator`, not a value

### Parameters

| Parameter   | Type                       | Default  | Description                                                    |
| ----------- | -------------------------- | -------- | -------------------------------------------------------------- |
| `value`     | `dict \| list \| str`      | required | Initial JSON value (see Supported Input Types below).          |
| `key`       | `str \| int \| None`       | `None`   | Unique key for the widget.                                     |
| `height`    | `int \| None`              | `None`   | Height in pixels. If `None`, auto-sizes based on content.      |
| `on_change` | `Callable \| None`         | `None`   | Callback function executed when the JSON value changes.        |
| `args`      | `list \| tuple \| None`    | `None`   | Arguments to pass to the callback.                             |
| `kwargs`    | `dict \| None`             | `None`   | Keyword arguments to pass to the callback.                     |
| `disabled`  | `bool`                     | `False`  | Whether editing is disabled (read-only mode).                  |

### Return Value

Returns `dict | list | str` based on the input type:

| Input Type             | Return Type | Notes                                           |
| ---------------------- | ----------- | ----------------------------------------------- |
| `dict` (or dict-like)  | `dict`      | Pydantic models, named tuples, etc. → `dict`    |
| `list` (or list-like)  | `list`      | Sequences, tuples, sets → `list`                |
| `str` (JSON string)    | `str`       | Returns the edited JSON as a string             |

This follows `st.json`'s input flexibility while keeping return types predictable.

```python
# Dict input → dict return
config = st.json_editor({"host": "localhost", "port": 8080})
assert isinstance(config, dict)

# List input → list return
items = st.json_editor(["item1", "item2", "item3"])
assert isinstance(items, list)

# String input → string return
json_str = st.json_editor('{"key": "value"}')
assert isinstance(json_str, str)
```

### Behavior

**Editing capabilities:**

- Add, edit, and delete keys in objects
- Add, edit, and delete items in arrays
- Edit primitive values (strings, numbers, booleans, null)
- Collapse/expand nested objects and arrays
- Copy values to clipboard

**Validation:**

- Invalid JSON edits are rejected with inline error feedback
- Type coercion follows JSON spec (strings must be quoted, etc.)

**Theming:**

- Automatically adapts to light/dark Streamlit theme (consistent with `st.json`)
- Uses monospace font from theme

**Keyboard support:**

- Standard text editing shortcuts (Ctrl+C, Ctrl+V, etc.)
- Tab for navigation between editable fields

### Examples

**Basic usage:**

```python
import streamlit as st

config = st.json_editor({
    "database": {
        "host": "localhost",
        "port": 5432,
        "name": "mydb"
    },
    "debug": True
})

if st.button("Save"):
    save_config(config)
```

**With callback:**

```python
import streamlit as st

def on_config_change():
    st.toast("Configuration updated!")

config = st.json_editor(
    {"api_key": "", "timeout": 30},
    on_change=on_config_change,
    key="config_editor"
)
```

**Read-only mode:**

```python
import streamlit as st

# Display JSON with editor UI but prevent modifications
st.json_editor(data, disabled=True)
```

**API payload builder:**

```python
import streamlit as st
import requests

st.subheader("Request Builder")

payload = st.json_editor({
    "query": "SELECT * FROM users",
    "limit": 100
})

if st.button("Send Request"):
    response = requests.post(API_URL, json=payload)
    st.json(response.json())
```

### Edge Cases

- **Empty value**: `st.json_editor({})` and `st.json_editor([])` are valid
- **Invalid JSON string**: Raises `StreamlitAPIException` if string input is not valid JSON
- **Non-serializable input**: Dict/list values must be JSON-serializable; raises error otherwise
- **Large JSON**: Scrollable container; consider performance for very large structures
- **Concurrent edits**: Last edit wins (standard Streamlit widget behavior)

## Out of Scope (Future Work)

- **JSON Schema validation**: Could add `schema` parameter for validation against JSON
  Schema. Low initial demand; can add based on user feedback.
- **Diff view**: Show changes between original and edited value. Useful but adds
  complexity.
- **Custom editors for specific types**: Date pickers for ISO date strings, color pickers
  for hex colors. Can be added later via `type_config` parameter.
- **Import/export buttons**: Built-in file upload/download for JSON. Users can compose
  with `st.file_uploader` and `st.download_button`.

## Implementation Notes

The existing `st.json` uses
[@microlink/react-json-view](https://github.com/microlinkhq/react-json-view) which already
supports editing via its `onEdit`, `onAdd`, and `onDelete` callbacks. The new widget can
reuse this library, requiring only backend changes and minimal frontend adjustments to
enable editing mode and wire up the callbacks.

## Checklist

| Item                       | ✅ or comment                    |
| -------------------------- | -------------------------------- |
| Works on SiS, Cloud, etc?  | ✅                               |
| No breaking API changes    | ✅                               |
| No new dependencies        | ✅ Reuses @microlink/react-json-view |
| Metrics collected          | ✅                               |
| Any security/legal impact? | ✅ No — client-side editing only |
| Any docs changes needed?   | ✅ Document new widget           |

## References

- **GitHub Issue:** [#10819](https://github.com/streamlit/streamlit/issues/10819) — Add a
  JSON editor widget
- **Related:** [#8859](https://github.com/streamlit/streamlit/issues/8859) — Code editor
  component (similar editing need for code)
- **Current implementation:** `st.json` in `lib/streamlit/elements/json.py`
