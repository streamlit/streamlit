---
author: lukasmasuch
created: 2026-08-03
---

# Live update mode for `st.text_input`

## Summary

Add a parameter to `st.text_input` that triggers reruns while the user is typing, enabling
real-time feedback use cases like live search, instant validation, and character-by-character
filtering.

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

#### Option 1: `debounce` (bool or integer in milliseconds) - PREFERRED

```python
st.text_input("Search", debounce=True)  # Rerun with sensible default (300ms)
st.text_input("Search", debounce=300)  # Rerun after 300ms of inactivity
st.text_input("Name")  # Default: rerun on blur/enter only
```

**Pros:**
- Familiar to web developers (standard term in JavaScript/frontend)
- Simple `debounce=True` for most use cases, custom ms when needed
- Mirrors `streamlit-keyup` API for easy migration
- Allows fine-grained control over debounce timing when needed

**Cons:**
- Term "debounce" may be unfamiliar to data scientists. This is a deliberate trade-off against
  API Principle 8 (semantic names over geeky names), accepted here for migration parity with
  `streamlit-keyup`, which already popularized `debounce` among the exact users we are targeting.
- Requires understanding milliseconds
- The `int | bool` type overloads a single parameter as both an on/off switch (`True`/`False`) and
  a numeric delay, which is in tension with API Principle 16 (prefer enums over booleans). Accepted
  because it mirrors the existing `st.json(expanded=...)` and `st.navigation(expanded=...)` APIs,
  which already use the `bool | int` "flag or number" shape — so the pattern is consistent with the
  current API surface rather than novel.

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
st.text_input("Search", on_change=handle_submit)  # Called on blur/enter
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
    debounce: int | bool = False,  # New parameter
    ...,
) -> str | None:
```

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `debounce` | `int \| bool` | `False` | Debounce delay for live updates. When `True`, uses a sensible default (300ms). When an integer, specifies the delay in milliseconds. When `False` (default), reruns occur only on blur or Enter. |

### Behavior

| `debounce` value | Behavior |
| ---------------- | -------- |
| `False` (default) | Rerun on blur or Enter (current behavior) |
| `True` | Rerun after 300ms of typing inactivity (sensible default) |
| `0` | Rerun on every keystroke (no debounce). **Warning:** Use sparingly - can cause excessive reruns with expensive app logic. |
| `> 0` | Rerun after N milliseconds of typing inactivity |
| `< 0` | Raises `StreamlitAPIException` - negative values are invalid |

**Rerun frequency (relation to API Principle 34):** Live updates intentionally relax Principle 34
("one rerun per interaction") — a single typing session can trigger multiple reruns. This exception
is acceptable because it is the explicit purpose of the feature and the rerun rate is *bounded* by
the debounce delay: reruns fire at most once per period of typing inactivity (e.g., `debounce=300`
triggers at most roughly once per 300ms pause, not once per keystroke). `debounce=0` is the only
value that removes this bound (one rerun per keystroke) and therefore carries the performance
warning above. The default (`False`) fully preserves one-rerun-per-interaction behavior, so existing
apps are unaffected.

### Implementation Notes

**Backend:**
- Because Python's `bool` is a subclass of `int` (`False == 0` and `True == 1`), the backend must
  branch on `isinstance(debounce, bool)` *before* treating `debounce` as an integer — the same
  pattern already used by `st.json(expanded=...)` and `st.navigation(expanded=...)`. Resolve the
  `bool` case first (`True` → 300ms default, `False` → blur/Enter-only), then treat the remaining
  values as integers (`0` → every keystroke, `> 0` → N ms, `< 0` → `StreamlitAPIException`). A naive
  numeric or truthiness check (e.g. `if debounce:` or `if debounce > 0:`) would incorrectly treat
  `True` as `1ms` and `False` as `0` (every keystroke) — the two most common values.

**Frontend:**
- When `debounce` is set, use a timer that resets on each keystroke
- After the debounce period with no input, call `commitWidgetValue()` to trigger rerun

**Recommended usage:**
- `debounce=True` is the simplest option for most live search/validation use cases
- `debounce=300` (or similar) when you need specific timing control
- `debounce=0` should be used sparingly - triggers a rerun on every keystroke which can
  overload the server for apps with expensive computations (ML inference, large data loads)

### Examples

**Example 1: Live search with default debounce**

```python
import streamlit as st

st.title("Product Search")

# debounce=True uses a sensible default (300ms)
query = st.text_input("Search products", debounce=True)

if query:
    products = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]
    matches = [p for p in products if query.lower() in p.lower()]
    st.write(f"Found {len(matches)} results:")
    for match in matches:
        st.write(f"- {match}")
else:
    st.write("Start typing to search...")
```

**Example 2: Instant validation with custom debounce**

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
   fires after each debounced rerun. **Important:** Unlike the current blur-only behavior where
   `on_change` fires at most once per complete interaction, with `debounce` the callback may fire
   multiple times during a single typing session. Users should be aware of this frequency increase
   when adding `debounce` to widgets that already have `on_change` callbacks performing write
   operations (e.g., saving to database, calling APIs).

2. **Interaction with `on_change="ignore"`**: If the proposed `on_change="ignore"` mode (from
   `specs/2026-04-14-on-change-modes/`) is combined with `debounce`, `on_change="ignore"` takes
   precedence and prevents any reruns — including the debounce timer firing *and* the blur-triggered
   rerun described in edge case 7. The widget value is still updated in frontend state and will be
   available on the next rerun triggered by another widget.

3. **Interaction with `st.form`**: Inside a form, `debounce` has no effect — form widgets only
   commit their value on form submission, never while typing. This is a deterministic, documented
   no-op (no warning is logged), consistent with how `st.form` already overrides the
   rerun-on-interaction behavior of every widget it contains.

4. **Interaction with `max_chars`**: Both features work independently. `max_chars` is enforced
   on the frontend — the native `maxlength` attribute prevents typing past the limit, and the
   input's change handler also drops any value longer than `max_chars` before the widget is
   marked dirty. The debounce runs off that same change handler, so it only ever fires with
   within-limit values and needs no extra client-side validation to gate it.

5. **Password inputs**: `debounce` works with `type="password"` - no special handling needed.

6. **Very fast typing**: The debounce timer resets on each keystroke, so only the final value
   (after the user pauses) triggers a rerun.

7. **Blur while debounce is pending**: If the user stops typing and blurs the field before the
   debounce timer fires, the debounce should fire immediately on blur. This ensures a rerun always
   occurs when the user leaves the field, providing consistent behavior with the non-debounced case.
   The one exception is `on_change="ignore"` (see edge case 2), which suppresses this blur-triggered
   rerun as well — the value is only synced to frontend state.

8. **IME / composition input**: For input methods that build a character over multiple keystrokes
   (e.g., CJK languages, or accented characters via dead keys), the debounce timer must not fire on
   intermediate composition states. The frontend should suspend the timer during composition and
   only (re)start it on the `compositionend` event, so live updates never flush partial/garbled
   values mid-composition. Only completed characters trigger a rerun.

## Out of Scope (Future Work)

- **`st.text_area` support**: Extend the `debounce` parameter to `st.text_area` with identical
  behavior. Note: Enter key inserts a newline in text_area (unlike text_input where it submits),
  so debounce would be the primary rerun trigger while typing.
- **Throttle mode**: Rate-limiting (e.g., "at most once per 500ms while typing") as opposed to
  debounce (waiting for pause). Could add `throttle` parameter if needed.
- **Cancel/abort pattern**: Mechanism to cancel in-flight computations when new input arrives.
  Users can implement this with `st.session_state` flags.

## Checklist

| Item                         | ✅ or comment |
| ---------------------------- | ------------- |
| Works on SiS, Cloud, etc?    | ✅ frontend-only debounce logic |
| No breaking API changes      | ✅ new optional parameter with False default |
| No new dependencies          | ✅ |
| Metrics collected            | ✅ existing text_input metrics apply |
| Any security/legal impact?   | ✅ None |
| Any docs changes needed?     | ✅ update text_input docstring |
