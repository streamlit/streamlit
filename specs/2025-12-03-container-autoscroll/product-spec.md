---
author: lukasmasuch
created: 2025-12-03
---

# Allow configuring auto-scrolling for `st.container`

## Summary

Add an `autoscroll: bool | None = None` parameter to `st.container` that enables automatic
scrolling to the bottom when new content is added. This provides a consistent way for users
to create streaming-style UIs (like chat interfaces or log viewers) using scrollable containers.
When `None` (default), auto-scroll is automatically enabled for containers with fixed height
that contain `st.chat_message` elements, preserving current behavior.

## Problem

When using `st.container` with a fixed height for streaming content (e.g., logs, real-time
updates, chat-like interfaces), the scrollbar moves up as new content is added, hiding the
latest content from the user. Users expect the container to automatically scroll to show
the newest content, similar to how `st.chat_message` containers work.

**User request:**

- [#8836](https://github.com/streamlit/streamlit/issues/8836) - Add "bottom" scroll behavior
  to container

**Use cases:**

- **Streaming AI output**: Using `st.write_stream()` inside a container with fixed height
- **Log viewers**: Displaying real-time logs where new entries should always be visible
- **Chat interfaces**: Custom chat UIs using `st.container` instead of `st.chat_message`
- **Real-time data feeds**: Showing live updates from sensors, events, or notifications

**Current behavior:**

Streamlit already implements scroll-to-bottom behavior internally for chat messages
(`useScrollToBottom` hook in `frontend/lib/src/hooks/useScrollToBottom.ts`). However, this
behavior is not exposed to users for general containers. Currently, it's only activated
automatically when:

1. The container has a fixed height, AND
2. The container contains `st.chat_message` elements

This proposal exposes this existing functionality as a user-configurable parameter.

## Proposal

### API

```python
st.container(
    ...,
    autoscroll: bool | None = None,  # NEW
)
```

### Parameter

| Parameter    | Type           | Default | Description                                                                                                                                                                                                                                      |
| ------------ | -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `autoscroll` | `bool \| None` | `None`  | Whether to automatically scroll to the bottom when new content is added. Only applicable when the container has a fixed height. If `None`, auto-scroll is enabled when the container has a fixed height and contains `st.chat_message` elements. |

### Behavior

**`autoscroll=None` (default):**

- Auto-scroll is automatically enabled when:
  1. The container has a fixed height, AND
  2. The container contains `st.chat_message` elements
- This preserves the current default behavior for chat interfaces
- Otherwise, standard scrolling behavior applies

> **Design note:** We considered using `"auto"` as the default (similar to `width`/`height` on
> some elements) but chose `None` for consistency with parameters like `hide_index` in
> `st.dataframe`, where the default selects one of the existing boolean options based on
> context rather than representing a distinct behavior mode.

**`autoscroll=False`:**

- Standard scrolling behavior (auto-scroll explicitly disabled)
- Scroll position is preserved when new content is added
- User must manually scroll to see new content
- Useful when you have chat messages but don't want auto-scrolling

**`autoscroll=True`:**

- Container automatically scrolls to the bottom when new content is added
- If the user scrolls up, auto-scrolling pauses ("sticky" behavior)
- Auto-scrolling resumes when the user scrolls back to the bottom
- Uses smooth animated scrolling for a polished experience
- Works for any content, not just chat messages

**Key behaviors (leveraging existing `useScrollToBottom` hook):**

- **Stickiness**: Scroll position "sticks" to the bottom unless the user scrolls up
- **Respects user intent**: If the user scrolls up to read previous content, auto-scroll
  pauses until they scroll back to the bottom
- **Smooth animations**: Scrolling is animated for a better visual experience
- **Browser compatibility**: Handles browser quirks (Chrome synthetic scroll events,
  Firefox timing issues) gracefully

### Validation

```python
# Valid:
st.container(height=300, autoscroll=True)   # Auto-scroll always enabled
st.container(height=300, autoscroll=False)  # Auto-scroll always disabled
st.container(height=300)                    # Auto-scroll if contains chat messages (default)
st.container(height=300, autoscroll=None)   # Auto-scroll if contains chat messages (explicit default)

# Valid but no effect (no scrolling possible):
st.container(autoscroll=True)               # No fixed height, autoscroll has no effect
st.container(height="content", autoscroll=True)  # No scrolling
```

Note: When `autoscroll=True` is set but the container doesn't have a fixed height
(no scrolling possible), the parameter is silently ignored. We don't raise a warning
since this is a harmless edge case and allows for more flexible code patterns.

### Examples

**Streaming AI output:**

```python
import streamlit as st

# Create a scrollable container that auto-scrolls to bottom
with st.container(height=300, autoscroll=True):
    st.write_stream(my_generator())
```

**Log viewer:**

```python
import streamlit as st
import time

# Real-time log viewer
log_container = st.container(height=400, autoscroll=True)

for i in range(100):
    log_container.write(f"[{time.strftime('%H:%M:%S')}] Log entry {i}")
    time.sleep(0.1)
```

**Custom chat interface:**

```python
import streamlit as st

# Display chat history with auto-scroll (auto-enabled due to chat_message)
with st.container(height=500, border=True):
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.write(message["content"])
```

**Disable auto-scroll for chat history review:**

```python
import streamlit as st

# Display chat history without auto-scroll for easier review
with st.container(height=500, autoscroll=False, border=True):
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.write(message["content"])
```

### Edge Cases

- **Empty container**: Auto-scroll has no visible effect, but is ready when content is added
- **Content smaller than container**: No scrolling occurs; auto-scroll activates when
  content exceeds container height
- **Rapid content additions**: Hook debounces scroll events to prevent jank
- **Nested containers**: Each container manages its own scroll state independently
- **Fragment reruns**: Scroll state is preserved across fragment reruns
- **Container resizing**: Scroll position is recalculated when container dimensions change

## Future Considerations

The following ideas are out of scope for the initial implementation but worth exploring in
follow-up work:

**Scroll-to-bottom button indicator** ([#13249](https://github.com/streamlit/streamlit/issues/13249)):
Show a small "scroll to bottom" button when `autoscroll=True` and the user has scrolled away
from the bottom, similar to ChatGPT's UI. This would provide a visual cue and quick way to
resume auto-scrolling. This enhancement should also be applied to the existing main area
scroll-to-bottom behavior when `st.chat_input` is used.

**Support for `height="stretch"` containers**: Enable autoscroll for containers that fill
their parent's available space (e.g., `st.container(height="stretch", autoscroll=True)`).
This is technically feasible for single-container scenarios by signaling to the parent
scrollable area (main/sidebar) to enable autoscroll. However, multiple stretch containers
with autoscroll in the same parent creates conflicting scroll intents and poor UX. A
`max_height` parameter could also help address this use case. Requires further investigation
into the interaction model and potential warnings/restrictions.

## Checklist

| Item                       | ✅ or comment                                    |
| -------------------------- | ------------------------------------------------ |
| Works on SiS, Cloud, etc?  | ✅                                               |
| No breaking API changes    | ✅                                               |
| No new dependencies        | ✅ Leverages existing `useScrollToBottom` hook   |
| Metrics collected          | ✅                                               |
| Any security/legal impact? | ✅                                               |
| Any docs changes needed?   | ✅ Document `autoscroll` parameter with examples |
