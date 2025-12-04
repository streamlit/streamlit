---
author: "@lukasmasuch"
created: 2025-12-03
status: Draft
---

# Client-side and server-side input validation for `st.text_input`

## Summary

Add a `validate` parameter to `st.text_input` that supports client-side regex validation (string)
and server-side callable validation (function). When validation fails, the input is marked with an
error state and an error message is displayed, preventing the value from being submitted.

## Problem

Currently, validating user input in `st.text_input` requires triggering a full app  or fragment rerun. This creates a poor user experience:

1. **Slow feedback**: Users must wait for a round-trip to the server before seeing validation errors
2. **Complex implementation**: Developers must manually track and display validation errors
3. **Unnecessary reruns**: Invalid inputs still trigger reruns even when they should be rejected

**Requests:**

- [#8790](https://github.com/streamlit/streamlit/issues/8790) - Support client-side validation via
  regex pattern for `st.text_input` (28+ upvotes)
- [#1850](https://github.com/streamlit/streamlit/issues/1850) - Minimum characters for text_input
  (19+ upvotes)
- [#6704](https://github.com/streamlit/streamlit/issues/6704) - Support more specialized types for
  `st.text_input` (email, url, phone) (40+ upvotes)

**Use cases:**

- Email validation before form submission
- Phone number format validation
- Required minimum character length
- Custom patterns (e.g., `st.text_input("Widget", validate="^st\.[a-z_]+$")`)
- Complex server-side validation (e.g., checking if username is available)

**Consistency gap:**

`st.column_config.TextColumn` already supports client-side regex validation via its `validate`
parameter. This proposal brings the same capability to `st.text_input` while extending it with
server-side callable validation.

## Proposal

### API

```python
st.text_input(
    ...
    validate: str | Callable[[str], bool | str] | None = None,  # NEW
)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `validate` | `str \| Callable[[str], bool \| str] \| None` | `None` | Validation rule for input. If string, treated as JS-flavored regex for client-side validation. If callable, executed server-side when value is submitted. If `None`, no validation is performed. |

### Behavior

#### Client-side validation (regex string)

When `validate` is a string, it's treated as a JavaScript-flavored regular expression (same as with `st.column_config.TextColumn`):

```python
# Only accept valid email-like patterns
st.text_input("Email", validate=r"^[\w.+-]+@[\w-]+\.[\w.-]+$")

# Only accept Streamlit widget names
st.text_input("Widget", validate=r"^st\.[a-z_]+$")

# Minimum 5 characters
st.text_input("Username", validate=r"^.{5,}$")
```

**Behavior:**

1. Regex is compiled on the frontend with `us` flags (unicode, dotAll)
2. Validation runs on every keystroke (debounced) and on blur/submit
3. If input doesn't match the pattern:
   - Input turns red (error state) showing an error icon and a tooltip with the error message
   - Submit/Enter is blocked; value is not sent to backend
   - Similar to the error state update planned for number input:
  ![alt text](number-input-validation.png "Number input validation error")
4. If input matches the pattern:
   - Normal styling is restored
   - Value can be submitted

**Error messages:**

TBD; see open questions. Do we need a way to specify the error message?

```python
st.text_input(
    "Email",
    validate=r"^[\w.+-]+@[\w-]+\.[\w.-]+$",
)
```

#### Server-side validation (callable)

When `validate` is a callable, it's executed on the backend when the user submits the value
(pressing Enter or on blur). This uses a deferred execution pattern similar to
`st.download_button` with callable data.

```python
def check_username(value: str) -> bool | str:
    if len(value) < 3:
        return "Username must be at least 3 characters."
    if db.username_exists(value):
        return "Username already taken."
    return True

st.text_input("Username", validate=check_username)
```

**Callable signature:**

```python
def validator(value: str) -> bool | str:
    """
    Parameters
    ----------
    value : str
        The current input value to validate.

    Returns
    -------
    bool | str
        - True: Value is valid, allow submission
        - False: Value is invalid, show default error message
        - str: Value is invalid, show the returned string as error message
    """
```

**Behavior:**

1. User types in the input field (no validation yet)
2. User submits (Enter key or blur):
   - Frontend sends a validation request to backend (no full rerun triggered)
   - Backend executes the callable with the current value
   - Backend returns validation result to frontend
3. Based on result:
   - `True`: Value is accepted, `on_change` callback is invoked, rerun is triggered
   - `False` or error string: Input shows error state, no rerun, user can correct input
4. While validation is in progress:
   - Input shows a loading indicator (spinner icon)
   - Submit is disabled to prevent duplicate requests

**Deferred execution pattern:**

Server-side validation leverages the existing deferred execution infrastructure (used by
`st.download_button` with callable data). The callable is registered with a unique ID on the
backend, and the frontend can request its execution without triggering a full script rerun.

```
User submits → Frontend sends validation request → Backend executes callable
                                                         ↓
                                              Returns True/False/error string
                                                         ↓
Frontend receives result → Shows error OR triggers rerun with validated value
```

### Validation timing

| Event | Regex (client-side) | Callable (server-side) |
|-------|---------------------|------------------------|
| Keystroke | Validate (debounced) | No validation |
| Blur (click away) | Validate | Validate |
| Enter key | Validate | Validate |
| Form submit | Validate | Validate |

### Combining with `on_change`

When using `validate` with `on_change`:

- **Regex validation**: `on_change` is only called when validation passes
- **Callable validation**: `on_change` is called after successful server-side validation

```python
def on_email_change():
    st.session_state.email_verified = True

st.text_input(
    "Email",
    validate=r"^[\w.+-]+@[\w-]+\.[\w.-]+$",
    on_change=on_email_change,
)
```

### Examples

**Basic email validation:**

```python
import streamlit as st

email = st.text_input(
    "Email address",
    validate=r"^[\w.+-]+@[\w-]+\.[\w.-]+$",
    placeholder="you@example.com"
)

if email:
    st.success(f"Email: {email}")
```

**Minimum character requirement:**

```python
import streamlit as st

# Require at least 8 characters for password
password = st.text_input(
    "Password",
    type="password",
    validate=r"^.{8,}$",
)
```

**Server-side username availability check:**

```python
import streamlit as st

def check_username(value: str) -> bool | str:
    if len(value) < 3:
        return "Username must be at least 3 characters."
    if value.lower() in ["admin", "root", "system"]:
        return "This username is reserved."
    # Simulate database check
    if value == "taken":
        return "Username already taken. Try another one."
    return True

username = st.text_input(
    "Choose a username",
    validate=check_username,
    placeholder="Enter a unique username"
)

if username:
    st.success(f"Username '{username}' is available!")
```

**Phone number with format hint:**

```python
import streamlit as st

phone = st.text_input(
    "Phone number",
    validate=r"^\+?[\d\s-]{10,}$",
    placeholder="+1 234 567 8900"
)
```

**Complex password validation (server-side):**

```python
import streamlit as st
import re

def validate_password(value: str) -> bool | str:
    if len(value) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", value):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", value):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", value):
        return "Password must contain at least one number."
    return True

password = st.text_input(
    "Create password",
    type="password",
    validate=validate_password
)
```

### Edge cases

- **Empty input**: Empty values are always accepted and bypass validation. To require non-empty
  input, use the `required` parameter in forms or combine with a regex like `^.+$`.
- **Invalid regex**: If the regex pattern is invalid, a warning is logged and validation is skipped.
  The input behaves as if no validation was specified.
- **Callable exception**: If the callable raises an exception, the error message is displayed to the
  user and the value is rejected. Exception is logged on the backend.
- **Slow callable**: Loading state is shown while waiting for server response. A 10-second timeout
  is enforced, after which validation fails with a timeout error.
- **Concurrent validation**: If user modifies input while server-side validation is in progress,
  the pending validation is cancelled and a new one is triggered on the next submit.
- **Password type**: Validation works the same for `type="password"` inputs.
- **Forms**: Validation runs before form submission. Invalid inputs block form submit.

### Future extensions

This validation pattern can be extended to other input widgets:

- `st.text_area`: Same API as `st.text_input`
- `st.number_input`: Callable validation for custom numeric constraints
- `st.date_input`: Callable validation for date range/availability checks
- `st.selectbox`: Callable validation for conditional options
- `st.chat_input`: Regex validation for chat message format

## Checklist

- [x] Will this work on all deployment platforms (e.g. [Streamlit Community Cloud](https://streamlit.io/cloud), [Streamlit in Snowflake](https://www.snowflake.com/en/product/features/streamlit-in-snowflake/), [Hugging Face Spaces](https://huggingface.co/spaces))?
- [x] No breaking API changes?
- [x] No new dependencies?
- [x] Metrics collected?
- [x] Any security or legal implications?
- [x] Anything to keep in mind for docs?
- [x] Any other risks?
