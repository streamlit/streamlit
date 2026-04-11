---
author: lukasmasuch
created: 2025-12-01
---

# `on_click` parameter for `st.link_button`

## Summary

Add `on_click: Literal["rerun", "ignore"] | WidgetCallback = "ignore"` to `st.link_button`, enabling
server-side callbacks when the user clicks the link. This mirrors the `on_click` behavior
already available in `st.download_button`.

## Problem

`st.link_button` opens a URL in a new tab but provides no way to execute server-side logic
when clicked. Users often need to track or respond to link clicks—for example, marking a
result as "read" when a user opens it via a hyperlink.

**Requests:**

- [#7453](https://github.com/streamlit/streamlit/issues/7453) - Add `on_click` parameter to
  `st.link_button`

**Use cases:**

- Tracking which links a user has clicked (e.g., marking items as read/viewed)
- Logging analytics events when users navigate to external resources
- Updating session state before the user leaves to an external page

## Proposal

### API

```python
st.link_button(
    ...,
    key: str | int | None = None,  # NEW
    on_click: Literal["rerun", "ignore"] | WidgetCallback = "ignore",  # NEW
    args: WidgetArgs | None = None,  # NEW
    kwargs: WidgetKwargs | None = None,  # NEW
)
```

### Parameters

| Parameter  | Type                                       | Default    | Description                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`      | `str \| int \| None`                       | `None`     | An optional string or integer to uniquely identify the widget. If omitted, a key will be generated automatically.                                                                                                                                                            |
| `on_click` | `"ignore"`, `"rerun"`, or `WidgetCallback` | `"ignore"` | How the button should respond to clicks. `"ignore"` (default): No rerun, link opens in new tab only. `"rerun"`: Clicking triggers a rerun in addition to opening the link. `WidgetCallback`: Clicking triggers a rerun and executes the callback before the rest of the app. |
| `args`     | `list \| tuple \| None`                    | `None`     | Arguments to pass to the callback.                                                                                                                                                                                                                                           |
| `kwargs`   | `dict \| None`                             | `None`     | Keyword arguments to pass to the callback.                                                                                                                                                                                                                                   |

### Behavior

**`on_click="ignore"` (default):**

- Current behavior—clicking opens the URL in a new tab
- No app rerun occurs

**`on_click="rerun"`:**

- Clicking opens the URL in a new tab AND triggers a rerun
- No callback is executed

**`on_click=callable`:**

- Clicking opens the URL in a new tab AND triggers a rerun
- The callback executes before the rest of the app runs
- `args` and `kwargs` are passed to the callback

### Example

```python
import streamlit as st

if "read_links" not in st.session_state:
    st.session_state.read_links = set()

def mark_as_read(link_id):
    st.session_state.read_links.add(link_id)

results = [
    {"id": 1, "title": "Result 1", "url": "https://example.com/1"},
    {"id": 2, "title": "Result 2", "url": "https://example.com/2"},
]

for result in results:
    is_read = result["id"] in st.session_state.read_links
    icon = "✓" if is_read else None
    st.link_button(
        result["title"],
        result["url"],
        icon=icon,
        on_click=mark_as_read,
        args=(result["id"],),
    )
```

### Implementation Notes

- Follows the same pattern as `st.download_button`'s `on_click` parameter
- Default is `"ignore"` (unlike `st.download_button`'s `"rerun"`).
- Requires registering `st.link_button` as a widget with state management when
  `on_click != "ignore"`

## Future Considerations

- **Interaction with [#7464](https://github.com/streamlit/streamlit/issues/7464) (opening link in same tab):**
  If we implement the ability to open links in the same tab, the `on_click` behavior would need
  reconsideration. Triggering a rerun before navigating away could feel awkward since the user
  would leave the app immediately. We may want to either skip the rerun entirely or execute the
  callback synchronously before navigation. This can be addressed when implementing #7464.

## Checklist

| Item                       | ✅ or comment          |
| -------------------------- | ---------------------- |
| Works on SiS, Cloud, etc?  | ✅                     |
| No breaking API changes    | ✅                     |
| No new dependencies        | ✅                     |
| Metrics collected          | ✅                     |
| Any security/legal impact? | ✅                     |
| Any docs changes needed?   | ✅ Document new params |
