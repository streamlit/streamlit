---
author: lukasmasuch
created: 2026-03-13
---

# Cookie Read/Write API - Tech Spec

## Architecture

```
Backend (Python)              Frontend (Browser)
────────────────────────────     ────────────────────────────
st.cookies["x"] = "y"    ───▶    document.cookie = "x=y"
(queue in ScriptRunContext)     (via ForwardMsg.set_cookies)

st.cookies["x"]          ◀───    Cookie header on page load
(read from ClientContext)       (via HTTP request)
```

## Implementation

### 1. Proto Changes

`proto/streamlit/proto/ForwardMsg.proto`:

```protobuf
message SetCookies {
  repeated Cookie cookies = 1;
}

message Cookie {
  string name = 1;
  string value = 2;
  bool delete = 3;
  int32 max_age = 4;
  string path = 5;
  string domain = 6;
  bool secure = 7;
  bool httponly = 8;
  string samesite = 9;
  int64 expires = 10;  // Unix timestamp
}

message ForwardMsg {
  // ... existing fields ...
  SetCookies set_cookies = XX;
}
```

### 2. Backend: `StreamlitCookiesProxy`

`lib/streamlit/runtime/cookies.py` (new file):

```python
class StreamlitCookiesProxy(MutableMapping[str, str]):
    """Dict-like interface for reading/writing cookies."""

    def __getitem__(self, key: str) -> str:
        # Read from client context (same as st.context.cookies)
        ctx = get_script_run_ctx()
        return ctx.client_context.cookies[key]

    def __setitem__(self, key: str, value: str) -> None:
        self.set(key, value)

    def set(self, name: str, value: str, *, max_age=None, ...) -> None:
        self._validate(name, value)
        ctx = get_script_run_ctx()
        ctx.pending_cookies.append(PendingCookie(name, value, options))

    def delete(self, name: str) -> None:
        ctx = get_script_run_ctx()
        ctx.pending_cookies.append(PendingCookie(name, None, CookieOptions(max_age=0)))
```

### 3. ScriptRunContext Changes

Add `pending_cookies: list[PendingCookie]` to `ScriptRunContext`. Flush to ForwardMsg
after script completes.

### 4. Frontend Handler

`frontend/lib/src/ForwardMessageHandler.ts`:

```typescript
function handleSetCookies(setCookies: SetCookies): void {
  for (const cookie of setCookies.cookies) {
    if (cookie.delete) {
      document.cookie = `${cookie.name}=; path=${cookie.path}; max-age=0`;
    } else {
      let str = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
      if (cookie.maxAge > 0) str += `; max-age=${cookie.maxAge}`;
      if (cookie.secure) str += `; secure`;
      str += `; samesite=${cookie.samesite}`;
      document.cookie = str;
    }
  }
}
```

**Note on `httponly`:** JavaScript cannot set HTTP-only cookies. If user specifies
`httponly=True`, log a warning. True HTTP-only cookies require ASGI middleware approach.

### 5. Export

`lib/streamlit/__init__.py`:

```python
from streamlit.runtime.cookies import StreamlitCookiesProxy
cookies: StreamlitCookiesProxy = StreamlitCookiesProxy()
```

## Testing

- **Unit tests:** `StreamlitCookiesProxy` operations, validation, context integration
- **E2E tests:** Cookie roundtrip (set → reload → read), delete, options verification

## Open Questions

1. **SiS compatibility:** May have cookie domain/path restrictions
2. **Cookie prefix:** Should we prefix app cookies (e.g., `st_app_*`) to avoid conflicts
   with internal cookies (`streamlit_user`, `streamlit_tokens`)?
3. **Starlette migration:** Design should work with both Tornado and Starlette backends
