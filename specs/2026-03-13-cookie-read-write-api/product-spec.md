---
author: lukasmasuch
created: 2026-03-13
---

# Cookie Read/Write API

## Summary

Add a first-class API for writing browser cookies in Streamlit apps, enabling persistent
client-side storage that survives page refreshes.

## Problem

Streamlit apps cannot persist state across page refreshes without external infrastructure.
`st.session_state` is lost on refresh, and `st.context.cookies` is read-only.

**Use cases:**

1. **Session persistence** - Remember users across refreshes without full OAuth
2. **User preferences** - Store theme, locale, or UI settings
3. **Draft preservation** - Keep form inputs if user accidentally refreshes
4. **Custom auth** - Support flows that don't fit `st.login()` (API tokens, simple passwords)

**Current workarounds** (all have significant limitations):

- Third-party packages (`streamlit-cookies-manager`) - require extra reruns, timing issues
- Custom components with `document.cookie` - can't set HTTP-only cookies
- ASGI middleware (1.53+) - only works on HTTP requests, not during script execution

Issues: #861 (100+ upvotes), #5105 (localStorage), #8518 (auth-related)

## Proposal

### API Options

**Option 1: New `st.cookies` namespace** ✅ PREFERRED

```python
st.cookies["theme"] = "dark"
st.cookies.set("session", token, max_age=86400, httponly=True)
del st.cookies["draft"]
```

- Pros: Clean separation, clear that this is mutable, matches `st.session_state` pattern
- Cons: New top-level namespace

**Option 2: Extend `st.context.cookies`**

```python
st.context.cookies["theme"] = "dark"
st.context.cookies.set("session", token, max_age=86400)
```

- Pros: No new namespace, cookies stay together
- Cons: `st.context` is conceptually read-only (snapshot of request), breaking type change

**Option 3: Flat functions**

```python
st.set_cookie("theme", "dark")
st.delete_cookie("theme")
```

- Pros: Simple, explicit
- Cons: Inconsistent with `st.session_state` dict pattern, no iteration support

### Recommended API (Option 1)

```python
import streamlit as st

# Read (same as st.context.cookies)
value = st.cookies.get("my_cookie")
value = st.cookies["my_cookie"]  # KeyError if not found

# Write (available on next rerun)
st.cookies["my_cookie"] = "value"
st.cookies.set("my_cookie", "value", max_age=86400, secure=True)

# Delete
del st.cookies["my_cookie"]

# Check/iterate
if "my_cookie" in st.cookies: ...
for name, value in st.cookies.items(): ...
```

### `st.cookies.set()` Parameters

```python
def set(
    name: str,
    value: str,
    *,
    max_age: int | timedelta | None = None,  # None = session cookie
    expires: datetime | None = None,
    path: str = "/",
    domain: str | None = None,
    secure: bool = True,       # HTTPS-only by default
    httponly: bool = False,    # JS-accessible by default
    samesite: Literal["strict", "lax", "none"] = "lax",
) -> None:
```

### Behavior

**Timing:** Cookies are queued during script run and sent in the ForwardMsg. They become
readable on the **next** page load/rerun.

```python
st.cookies["draft"] = "text"  # Queued
st.rerun()                    # Sent to browser
# Next run: st.cookies["draft"] == "text"
```

**Restrictions:**

- String values only (use `json.dumps()` for complex data)
- ~4KB limit per cookie (raises `StreamlitAPIException` if exceeded)
- Names cannot contain `=`, `;`, or whitespace

**Relationship with `st.context.cookies`:** Both read the same cookies. `st.context.cookies`
remains read-only for backward compatibility. Recommend `st.cookies` for new code.

### Examples

**Remember user preference:**

```python
theme = st.cookies.get("theme", "light")
new_theme = st.radio("Theme", ["light", "dark"], index=0 if theme == "light" else 1)
if new_theme != theme:
    st.cookies.set("theme", new_theme, max_age=365*24*60*60)
    st.rerun()
```

**Simple session token:**

```python
session_id = st.cookies.get("session")
if not session_id:
    session_id = secrets.token_urlsafe(32)
    st.cookies.set("session", session_id, max_age=7*24*60*60, httponly=True)
```

### Security & Legal

- `secure=True` default prevents HTTP transmission (except localhost)
- `samesite="lax"` default prevents CSRF
- GDPR compliance is developer responsibility (same as Flask, Django, FastAPI)
- Docs will include consent banner guidance for developers who need it

### Out of Scope (Future Work)

| Feature | Rationale |
|---------|-----------|
| `st.local_storage` | Different mechanism; separate feature (#5105) |
| Cookie consent component | Not required for core API; add based on feedback |
| Auto JSON serialization | Keep API simple; manual `json.dumps()` is clear |
| `st.cookies` in `AppTest` | Follow-up work |

## Checklist

| Item                         | Status |
|------------------------------|--------|
| Works on SiS, Cloud, etc?    | Needs verification for cookie domain restrictions |
| No breaking API changes      | ✅ `st.context.cookies` unchanged |
| No new dependencies          | ✅ Uses existing Tornado/Starlette |
| Metrics collected            | Track `set`, `delete` calls |
| Any security/legal impact?   | Secure defaults; GDPR is dev responsibility |
| Any docs changes needed?     | New guide + `st.context` docs update |
