---
author: lukasmasuch
created: 2026-03-15
---

# Local Storage API - Tech Spec

## Architecture

```
Backend (Python)              Frontend (Browser)
────────────────────────────     ────────────────────────────
st.local_storage["x"] = y    ───▶    localStorage.setItem("x", y)
(queue in ScriptRunContext)        (via ForwardMsg.set_local_storage)

st.local_storage["x"]        ◀───    BackMsg with localStorage snapshot
(read from session cache)          (on session connect)
```

**Key difference from cookies:** localStorage values are not sent with HTTP requests, so
we need a separate mechanism to sync them to the backend.

## Implementation

### 1. Proto Changes

`proto/streamlit/proto/ForwardMsg.proto`:

```protobuf
message SetLocalStorage {
  repeated LocalStorageItem items = 1;
  bool clear_all = 2;  // Clear all items for this app
}

message LocalStorageItem {
  string key = 1;
  string value = 2;     // JSON-serialized
  bool delete = 3;
}

message ForwardMsg {
  // ... existing fields ...
  SetLocalStorage set_local_storage = XX;
}
```

`proto/streamlit/proto/BackMsg.proto`:

```protobuf
message LocalStorageSnapshot {
  repeated LocalStorageItem items = 1;
}

message BackMsg {
  // ... existing fields ...
  LocalStorageSnapshot local_storage_snapshot = XX;
}
```

### 2. Frontend: localStorage Sync

**On session connect**, frontend reads localStorage and sends snapshot to backend:

```typescript
const APP_PREFIX = `st_ls_${getAppId()}_`;

function sendLocalStorageSnapshot(): void {
  const items: LocalStorageItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (fullKey?.startsWith(APP_PREFIX)) {
      const key = fullKey.slice(APP_PREFIX.length);
      items.push({ key, value: localStorage.getItem(fullKey) || "" });
    }
  }
  sendBackMsg({ localStorageSnapshot: { items } });
}
```

**On ForwardMsg.set_local_storage**, apply changes:

```typescript
function handleSetLocalStorage(msg: SetLocalStorage): void {
  if (msg.clearAll) {
    // Clear all keys with app prefix
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(APP_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }

  for (const item of msg.items) {
    const fullKey = APP_PREFIX + item.key;
    if (item.delete) {
      localStorage.removeItem(fullKey);
    } else {
      try {
        localStorage.setItem(fullKey, item.value);
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          console.error(`localStorage quota exceeded for key: ${item.key}`);
        }
        throw e;
      }
    }
  }
}
```

### 3. Backend: `StreamlitLocalStorageProxy`

`lib/streamlit/runtime/local_storage.py` (new file):

```python
import json
import time
from collections.abc import Iterator, MutableMapping
from datetime import timedelta
from typing import Any

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx


class StreamlitLocalStorageProxy(MutableMapping[str, Any]):
    """Dict-like interface for browser localStorage with auto JSON serialization."""

    def __getitem__(self, key: str) -> Any:
        ctx = get_script_run_ctx()
        if ctx is None:
            raise StreamlitAPIException(
                "st.local_storage can only be used within a Streamlit app"
            )
        # Read from cached snapshot (sent via BackMsg on connect)
        raw = ctx.local_storage_cache.get(key)
        if raw is None:
            raise KeyError(key)
        return json.loads(raw)

    def __setitem__(self, key: str, value: Any) -> None:
        self.set(key, value)

    def set(
        self,
        key: str,
        value: Any,
        *,
        expires_in: timedelta | None = None,
    ) -> None:
        """Set a value with optional expiration.

        If expires_in is provided, the value is stored with metadata. On read,
        expired values return None and are queued for deletion.
        """
        self._validate_key(key)
        ctx = get_script_run_ctx()
        if ctx is None:
            raise StreamlitAPIException(
                "st.local_storage can only be used within a Streamlit app"
            )

        # If expiration requested, wrap value with metadata
        if expires_in is not None:
            expires_at = time.time() + expires_in.total_seconds()
            wrapped = {"__st_expires_at": expires_at, "value": value}
            serialized = json.dumps(wrapped, ensure_ascii=False)
        else:
            serialized = json.dumps(value, ensure_ascii=False)

        self._validate_size(key, serialized)

        ctx.pending_local_storage.append(
            PendingLocalStorageItem(key, serialized, delete=False)
        )
        # Optimistic cache update for immediate read-after-write within same session
        ctx.local_storage_cache[key] = serialized

    def __delitem__(self, key: str) -> None:
        self.delete(key)

    def __iter__(self) -> Iterator[str]:
        ctx = get_script_run_ctx()
        if ctx is None:
            return iter([])
        return iter(ctx.local_storage_cache)

    def __len__(self) -> int:
        ctx = get_script_run_ctx()
        if ctx is None:
            return 0
        return len(ctx.local_storage_cache)

    def delete(self, key: str) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            raise StreamlitAPIException(
                "st.local_storage can only be used within a Streamlit app"
            )
        ctx.pending_local_storage.append(
            PendingLocalStorageItem(key, "", delete=True)
        )
        # Optimistic cache update
        ctx.local_storage_cache.pop(key, None)

    def clear(self) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            raise StreamlitAPIException(
                "st.local_storage can only be used within a Streamlit app"
            )
        ctx.pending_local_storage_clear = True
        # Optimistic cache update
        ctx.local_storage_cache.clear()

    def _validate_key(self, key: str) -> None:
        if not key or not isinstance(key, str):
            raise StreamlitAPIException("localStorage key must be a non-empty string")

    def _validate_size(self, key: str, value: str) -> None:
        if len(value.encode("utf-8")) > 1_000_000:  # 1MB soft limit
            raise StreamlitAPIException(
                f"localStorage value for '{key}' exceeds 1MB. "
                "Consider splitting into smaller chunks."
            )
```

### 4. ScriptRunContext Changes

Add to `ScriptRunContext`:

```python
@dataclass
class ScriptRunContext:
    # ... existing fields ...
    local_storage_cache: dict[str, str] = field(default_factory=dict)
    pending_local_storage: list[PendingLocalStorageItem] = field(default_factory=list)
    pending_local_storage_clear: bool = False
```

### 5. Session Initialization

On BackMsg with `local_storage_snapshot`, populate `local_storage_cache`:

```python
def handle_local_storage_snapshot(self, snapshot: LocalStorageSnapshot) -> None:
    self._local_storage_cache = {
        item.key: item.value for item in snapshot.items
    }
```

## Namespacing Strategy

To prevent cross-app collisions on shared domains (e.g., Community Cloud), keys are
namespaced:

```
st_ls_{app_id}_{user_key}
```

Where `app_id` is derived from the app's URL path (e.g., a hash of the path).

Example:
- App URL: `https://share.streamlit.io/user/myapp/app.py`
- User key: `scores`
- Stored key: `st_ls_a1b2c3d4_scores` (where `a1b2c3d4` is hash of path)

## Testing

- **Unit tests:** `StreamlitLocalStorageProxy` operations, JSON serialization, validation
- **E2E tests:**
  - Set value → reload → read value (roundtrip)
  - Clear all → verify empty
  - Cross-app isolation (two apps don't see each other's data)

## Open Questions

1. **Iframe restrictions:** Some hosting (SiS, embedded apps) may have localStorage
   restrictions. Need to test and document graceful degradation.

2. **Sync timing:** Should we wait for localStorage snapshot before first script run,
   or return `None` for keys until snapshot arrives?

3. **Cache invalidation:** If user clears localStorage in dev tools, how do we detect
   and update `local_storage_cache`?
