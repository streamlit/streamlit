---
author: lukasmasuch
created: 2026-04-23
---

# Live update mode for `st.text_input` and `st.text_area`

## Summary

Add a parameter to `st.text_input` and `st.text_area` that triggers reruns while the user is
typing, enabling real-time feedback use cases like live search, instant validation, and
character-by-character filtering.

## Problem

**GitHub Issue:** [#4553](https://github.com/streamlit/streamlit/issues/4553)

Users want to create apps with immediate responsiveness to text input, similar to Google's search
field or IDE autocompletion. Currently, `st.text_input` only triggers reruns when the user presses
Enter or leaves the field (blur). This limitation prevents several common use cases:

### Use Cases

1. **Live search / autocomplete**: Filter results as the user types, showing matching options
   instantly without requiring Enter or Tab.

   ```python
   # Desired behavior: Filter updates with each keystroke
   query = st.text_input("Search products")
   filtered = [p for p in products if query.lower() in p.lower()]
   st.write(filtered)
   ```

2. **Real-time validation**: Show validation feedback immediately (e.g., "Username taken",
   "Password too weak") without waiting for form submission.

3. **Live formatting preview**: Show formatted output (Markdown, LaTeX, code highlighting) as the
   user types.

### Current Workarounds

| Workaround                 | Limitation                                           |
| -------------------------- | ---------------------------------------------------- |
| `streamlit-keyup` component | Third-party dependency, limited styling, no password type |
| Custom component           | Significant development overhead, maintenance burden |
| Press Enter to search      | Poor UX, not intuitive for search interfaces         |

### Prior Art

The `streamlit-keyup` custom component ([blackary/streamlit-keyup](https://github.com/blackary/streamlit-keyup))
demonstrates strong demand for this feature with 200+ stars. Its API:

```python
from st_keyup import st_keyup

# Updates on every keystroke
value = st_keyup("Search")

# With 500ms debounce
value = st_keyup("Search", debounce=500)
```

## Proposal

### Parameter Name Options

We considered several parameter names for this feature:

#### Option 1: `debounce` (integer in milliseconds) - PREFERRED

```python
st.text_input("Search", debounce=300)  # Rerun after 300ms of inactivity
st.text_input("Name")                  # Default: rerun on blur/enter only
```

**Pros:**
- Familiar to web developers (standard term in JavaScript/frontend)
- Single parameter controls both enabling the feature AND the timing
- Mirrors `streamlit-keyup` API for easy migration
- Allows fine-grained control over debounce timing

**Cons:**
- Term "debounce" may be unfamiliar to data scientists
- Requires understanding milliseconds

#### Option 2: Boolean flag (`keyup`, `live_update`, or `update_on`)

```python
# Using keyup=True
st.text_input("Search", keyup=True)

# Using live_update=True
st.text_input("Search", live_update=True)

# Using update_on="input"
st.text_input("Search", update_on="input")
```

These would use a sensible default debounce (e.g., 200-300ms) without exposing configuration.

**Pros:**
- `keyup` mirrors the `streamlit-keyup` component name, familiar to existing users
- `live_update` is self-documenting, clear intent
- `update_on` follows existing `on_change`, `on_click` naming patterns
- Simpler API - no need to understand milliseconds

**Cons:**
- No control over debounce timing (may not suit all use cases)
- `keyup` is a technical DOM event name, less semantic
- `update_on="input"` vs `"change"` distinction may be confusing (HTML semantics)

#### Option 3: `on_input` callback (separate from `on_change`)

```python
st.text_input("Search", on_input=handle_typing)  # Called per keystroke
st.text_input("Search", on_change=handle_submit) # Called on blur/enter
```

**Pros:**
- Consistent with callback pattern
- Can have both behaviors simultaneously

**Cons:**
- Callbacks are less common in Streamlit (most users rely on return values)
- Doesn't address the debounce requirement
- Adds API complexity

### Recommended API: `debounce` parameter

```python
def text_input(
    self,
    label: str,
    value: str | SupportsStr | None = "",
    ...,
    *,
    debounce: int | None = None,  # New parameter (milliseconds)
    ...,
) -> str | None:
```

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `debounce` | `int \| None` | `None` | Debounce delay in milliseconds. When set, the widget triggers a rerun after the user stops typing for the specified duration. When `None` (default), reruns occur only on blur or Enter. |

### Behavior

| `debounce` value | Behavior |
| ---------------- | -------- |
| `None` (default) | Rerun on blur or Enter (current behavior) |
| `0` | Rerun on every keystroke (no debounce) |
| `> 0` | Rerun after N milliseconds of typing inactivity |

### Implementation Notes

**Frontend:**
- When `debounce` is set, use a timer that resets on each keystroke
- After the debounce period with no input, call `commitWidgetValue()` to trigger rerun
- Visual indicator (subtle spinner or border change) could show pending update

**Recommended defaults:**
- `debounce=300` is a good starting point for most live search use cases
- `debounce=0` should be used sparingly (high rerun frequency)

### Examples

**Example 1: Live search with debounce**

```python
import streamlit as st

st.title("Product Search")

query = st.text_input("Search products", debounce=300)

if query:
    products = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]
    matches = [p for p in products if query.lower() in p.lower()]
    st.write(f"Found {len(matches)} results:")
    for match in matches:
        st.write(f"- {match}")
else:
    st.write("Start typing to search...")
```

**Example 2: Live Markdown preview**

```python
import streamlit as st

col1, col2 = st.columns(2)

with col1:
    md_input = st.text_area("Markdown input", debounce=200, height=300)

with col2:
    st.markdown("### Preview")
    st.markdown(md_input or "*Start typing...*")
```

**Example 3: Instant validation**

```python
import streamlit as st
import re

email = st.text_input("Email address", debounce=500)

if email:
    if re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        st.success("Valid email format")
    else:
        st.error("Please enter a valid email address")
```

### Edge Cases

1. **Interaction with `on_change`**: When both `debounce` and `on_change` are set, the callback
   fires after each debounced rerun (same as current `on_change` behavior after blur).

2. **Interaction with `st.form`**: Inside forms, `debounce` is ignored since form widgets don't
   trigger reruns until submission. A warning could be logged.

3. **Interaction with `max_chars`**: Both features work together. The debounce timer only triggers
   when the input is valid (within max_chars).

4. **Password inputs**: `debounce` works with `type="password"` - no special handling needed.

5. **Very fast typing**: The debounce timer resets on each keystroke, so only the final value
   (after the user pauses) triggers a rerun.

## Out of Scope (Future Work)

- **Throttle mode**: Rate-limiting (e.g., "at most once per 500ms while typing") as opposed to
  debounce (waiting for pause). Could add `throttle` parameter if needed.
- **Cancel/abort pattern**: Mechanism to cancel in-flight computations when new input arrives.
  Users can implement this with `st.session_state` flags.
- **Visual feedback**: Spinner or indicator showing "updating..." during debounce period.
  Could be added as `show_pending=True` parameter.

## Checklist

| Item                         | Status |
| ---------------------------- | ------ |
| Works on SiS, Cloud, etc?    | ✅ Yes - frontend-only debounce logic |
| No breaking API changes      | ✅ Yes - new optional parameter with None default |
| No new dependencies          | ✅ Yes |
| Metrics collected            | ✅ Yes - existing text_input metrics apply |
| Any security/legal impact?   | ✅ No |
| Any docs changes needed?     | ✅ Yes - update text_input and text_area docstrings |
