---
author: lukasmasuch
created: 2025-12-03
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

The `validate` parameter supports two validation modes with different trade-offs:

| Mode | Syntax | Latency | Security | Use Cases |
|------|--------|---------|----------|-----------|
| **Client-side** | Regex string | Zero latency (runs in browser) | Can be bypassed | Format validation (email, phone), length constraints, pattern matching |
| **Server-side** | Callable | Network round-trip | Secure, tamper-proof | Database lookups (username availability), complex business logic, security-sensitive validation |

**Recommendation:** Use client-side regex for instant UX feedback on format constraints. Use server-side callables when validation requires backend resources or must be secure.

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
2. Validation runs on blur/submit events; error state is cleared when user types in the input field.
3. If input doesn't match the pattern:
   - Input turns red (error state) showing an error icon and a tooltip with the error message
   - Submit/Enter is blocked; value is not sent to backend
   - Similar to the error state update planned for number input:
  ![alt text](number-input-validation.png "Number input validation error")
4. If input matches the pattern:
   - Normal styling is restored
   - Value can be submitted, triggering a normal rerun and on_change callback execution if provided.

**Error messages:**

TBD; see open questions. Do we need a way to specify the error message?

```python
st.text_input(
    "Email",
    validate=r"^[\w.+-]+@[\w-]+\.[\w.-]+$",
)
```

> **Note:** We need to document that client-side validation can be bypassed by an "attacker". If the validation is security-relevant, it should be performed on the server-side.

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

> **Note:** if the validation callable returns anything other than bool or str, an exception will be raised which will be shown to the developer in the validation error message and logged to the console.

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

1. User types in the input field (no validation yet; clears existing error state)
2. User submits (Enter key or blur):
   - Frontend sends a validation request to backend (no full rerun triggered)
   - Backend executes the callable with the current value
   - Backend returns validation result to frontend
3. Based on result:
   - `True`: Value is accepted, a normal rerun is triggered and on_change executed if provided.
   - `False` or error string: Input shows error state, no rerun, user can correct input (see mockup above for error state).
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

- **None value**: If the text input is initialized with `value=None`, resetting to `None` (empty state) is allowed and bypasses validation.
- **Invalid regex**: If the regex pattern is invalid, a warning is logged and validation is skipped.
  The input behaves as if no validation was specified.
- **Callable exception**: If the callable raises an exception, the error message is displayed to the
  user and the value is rejected. Exception is logged on the backend.
- **Slow callable**: Loading state is shown while waiting for server response. A X-second timeout
  is enforced, after which validation fails with a timeout error.
- **Concurrent validation**: If user modifies input while server-side validation is in progress,
  the pending validation is cancelled and a new one is triggered on the next submit.
- **Forms**: Validation runs before form submission. Invalid inputs block form submit.

### Future extensions

This validation pattern can be extended to other input widgets:

- `st.text_area`: Same API as `st.text_input`
- `st.number_input`: Callable validation for custom numeric constraints
- `st.date_input`: Callable validation for date range/availability checks
- `st.selectbox`: Callable validation for conditional options
- `st.chat_input`: Regex validation for chat message format

## Checklist

| Item                         | ✅ or comment          |
|------------------------------|------------------------|
| Works on SiS, Cloud, etc?    | ✅                      |
| No breaking API changes      | ✅                      |
| No new dependencies          | ✅                      |
| Metrics collected            | ✅                      |
| Any security/legal impact?   | Client-side regex validation can be bypassed; document that security-sensitive validation should use server-side callables |
| Any docs changes needed?     | Yes, document the new `validate` parameter for `st.text_input` |
