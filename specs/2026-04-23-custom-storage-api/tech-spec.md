---
author: lukasmasuch
created: 2026-04-23
---

# Custom Storage API for `st.App`

## Summary

Expose `st.App` constructor parameters for custom storage backends: `media_file_storage`,
`uploaded_file_manager`, and `cache_storage_manager`. This enables centralized storage
using Redis, S3, or other external systems for better scalability in multi-instance
deployments.

> [!NOTE]
> `session_storage` is **not extensible** for cross-instance persistence (see Feasibility
> Analysis below). This spec focuses on the three storage types that can be extended.

## Problem

Streamlit's architecture limits scalability in multi-instance deployments (Kubernetes,
ECS, serverless). Users have requested numerous features that require pluggable storage:

**Centralized Cache Storage:**

- [#5849](https://github.com/streamlit/streamlit/issues/5849) — "Bring your own Redis
  cache" (195+ upvotes) — Users need shared cache across pods to avoid cache misses when
  requests route to different instances.

**Pluggable File Upload Storage:**

- [#10827](https://github.com/streamlit/streamlit/issues/10827) — Upload files directly
  to S3 (for large files that don't fit in memory)
- [#10828](https://github.com/streamlit/streamlit/issues/10828) — Upload files to disk
  (for persistence across server reboots)

**Current workarounds are unsatisfactory:**

1. **Sticky sessions:** Requires load balancer configuration, doesn't survive pod
   restarts, prevents elastic scaling.
2. **Fork Streamlit:** Mentioned in #5849 comments as "possible but unreasonable effort."
3. **External caching at app level:** Requires rewriting all `@st.cache_data` calls.

## Feasibility Analysis

### ✅ Cache Storage — Fully Extensible

The `CacheStorageManager` and `CacheStorage` protocols are designed for extensibility:

- Stores/retrieves **bytes** (already serialized by Streamlit's pickle layer)
- Clean protocol with `get()`, `set()`, `delete()`, `clear()` methods
- No coupling to in-memory state or live connections

**Verdict:** Ready for custom backends (Redis, Memcached, PostgreSQL, etc.)

### ⚠️ Uploaded File Manager — Requires Protocol Changes

The current `UploadedFileManager` protocol is **incomplete** for custom backends:

| Method | In Protocol? | Description |
|--------|-------------|-------------|
| `get_files()` | ✅ Yes | Retrieve files by ID |
| `remove_session_files()` | ✅ Yes | Cleanup on session end |
| `get_upload_urls()` | ✅ Yes (optional) | Return upload URLs |
| `add_file()` | ❌ **No** | Store uploaded file |
| `remove_file()` | ❌ **No** | Delete single file |
| `stats_families` | ✅ Yes* | StatsProvider property |
| `get_stats()` | ✅ Yes* | StatsProvider method |

*The protocol extends `StatsProvider` (`uploaded_file_manager.py:92`), which requires
`stats_families` property and `get_stats()` method. Custom implementations must satisfy
these requirements (can return empty stats if not tracking metrics).

The HTTP upload route (`starlette_routes.py:702`) calls `upload_mgr.add_file()` directly,
which only exists on `MemoryUploadedFileManager`, not the protocol.

**Can `get_upload_urls()` with pre-signed S3 URLs work?**

The frontend's `buildFileUploadURL()` already supports external URLs — if the URL doesn't
start with `/_stcore/upload_file`, it passes through unchanged. However, there's a
compatibility issue:

- **Streamlit's upload format:** Wraps file in `FormData` and sends as `PUT`
- **S3 pre-signed PUT URLs:** Expect raw file body, not FormData

So while URL routing works, the payload format is incompatible with S3 pre-signed URLs.

**Two approaches:**

1. **Add `add_file()` to protocol (this spec):** Uploads flow through Streamlit, which
   then stores to external storage. Works with current frontend, but adds latency
   (browser → Streamlit → S3).

2. **True direct upload (future work):** Frontend detects external URLs and sends raw
   body instead of FormData. More efficient for large files, but requires frontend
   changes and CORS configuration.

**Verdict:** Recommend Option 1 for initial release (simpler, no frontend changes).
Option 2 can be added later for performance-critical use cases.

### ⚠️ Media File Storage — Requires Route Wiring Changes

The `MediaFileStorage` protocol includes:

- `load_and_get_id()` — Store media and return ID
- `get_url()` — Generate URL for serving
- `delete_file()` — Optional cleanup

**However**, the current Starlette `/media` route wiring is **not** protocol-based end-to-end:
`create_media_routes()` in `starlette_app.py` casts `runtime.media_file_mgr._storage` to
`MemoryMediaFileStorage` and calls `get_file(file_id)`, which is **not** part of the
`MediaFileStorage` protocol.

**Required implementation choice:**

1. **Protocol-only route setup (recommended):** Update media route creation to use
   `get_url()` for serving (redirect to the URL) instead of direct in-process retrieval.
2. **Extend the protocol:** Add `get_file()` to `MediaFileStorage` so non-memory backends
   can participate in the current serving flow.

**Verdict:** Requires route wiring changes before custom backends work end-to-end.

### ❌ Session Storage — NOT Extensible

`SessionStorage` stores `SessionInfo` objects containing:

```python
@dataclass
class SessionInfo:
    client: SessionClient | None  # Live WebSocket connection — NOT serializable
    session: AppSession           # Complex object with threads, callbacks — NOT serializable
```

This is designed for **in-process tracking of active connections**, not cross-instance
persistence. The objects cannot be pickled or serialized to external storage.

**Verdict:** Cannot be extended for Redis/external storage. Would require fundamental
redesign of session architecture (separating serializable state from live connections).
This is out of scope for this spec.

## Proposal

### API Extension

Add three optional parameters to `st.App`:

```python
st.App(
    script_path: str | Path,
    *,
    # Existing parameters...
    lifespan: Callable[[App], AsyncContextManager[dict[str, Any] | None]] | None = None,
    routes: Sequence[BaseRoute] | None = None,
    middleware: Sequence[Middleware] | None = None,
    exception_handlers: Mapping[Any, ExceptionHandler] | None = None,
    debug: bool = False,
    # NEW: Custom storage backends
    media_file_storage: MediaFileStorage | None = None,
    uploaded_file_manager: UploadedFileManager | None = None,
    cache_storage_manager: CacheStorageManager | None = None,
) -> App
```

When `None` (default), use existing in-memory implementations. When provided, use the
user's implementation.

### Protocol Changes Required

#### UploadedFileManager Protocol Extension

Add `add_file()` and `remove_file()` to the protocol to enable custom backends:

```python
# Current protocol (incomplete)
class UploadedFileManager(Protocol):
    def get_files(self, session_id: str, file_ids: Sequence[str]) -> list[UploadedFileRec]: ...
    def remove_session_files(self, session_id: str) -> None: ...
    def get_upload_urls(self, session_id: str, file_names: Sequence[str]) -> list[UploadFileUrlInfo]: ...

# Proposed addition
class UploadedFileManager(Protocol):
    # ... existing methods ...

    def add_file(self, session_id: str, file: UploadedFileRec) -> None:
        """Store an uploaded file. Called by the HTTP upload route."""
        ...

    def remove_file(self, session_id: str, file_id: str) -> None:
        """Remove a single file. Called by the HTTP delete route."""
        ...

    @property
    def stats_families(self) -> Sequence[str]:
        """Return stat family names (from StatsProvider)."""
        ...

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return stats for the requested families (from StatsProvider)."""
        ...
```

**Note:** The `StatsProvider` requirements expose internal concerns to custom
implementations. A future implementation may decouple stats from the protocol (e.g.,
via a wrapper or adapter), but for now custom implementations must satisfy these
methods (can return empty sequences if not tracking metrics).

This makes the HTTP route (`starlette_routes.py`) work with any implementation,
**provided** the route wiring is also updated to depend on the protocol instead of
`MemoryUploadedFileManager` (see Implementation Changes below).

### Existing Protocols (No Changes Needed)

| Storage Type | Protocol Location | Key Methods |
|-------------|-------------------|-------------|
| Media Files | `runtime/media_file_storage.py:42-143` | `load_and_get_id()`, `get_url()`, `delete_file()` |
| Cache | `runtime/caching/storage/cache_storage_protocol.py:114-237` | `CacheStorage.get/set/delete/clear()`, `CacheStorageManager.create()` |

### Implementation Changes

**`st.App.__init__`** — Store user-provided storage backends:

```python
def __init__(
    self,
    script_path: str | Path,
    *,
    # ... existing params ...
    media_file_storage: MediaFileStorage | None = None,
    uploaded_file_manager: UploadedFileManager | None = None,
    cache_storage_manager: CacheStorageManager | None = None,
) -> None:
    # ... existing init ...
    self._media_file_storage = media_file_storage
    self._uploaded_file_manager = uploaded_file_manager
    self._cache_storage_manager = cache_storage_manager
```

**`st.App._create_runtime`** — Use user-provided backends or defaults:

```python
def _create_runtime(self) -> Runtime:
    # Use user-provided or default implementations
    media_file_storage = self._media_file_storage or MemoryMediaFileStorage(...)
    uploaded_file_mgr = self._uploaded_file_manager or MemoryUploadedFileManager(...)
    cache_storage_mgr = self._cache_storage_manager or create_default_cache_storage_manager()

    return Runtime(
        RuntimeConfig(
            script_path=str(script_path),
            media_file_storage=media_file_storage,
            uploaded_file_manager=uploaded_file_mgr,
            cache_storage_manager=cache_storage_mgr,
            # ... existing params ...
        ),
    )
```

**Starlette server route wiring** — Consume runtime storage via protocols, not memory-only
implementations:

- Update `create_upload_routes()` and `create_media_routes()` to accept `UploadedFileManager`
  / `MediaFileStorage` (or narrower route-specific protocols), rather than concrete in-memory
  classes such as `MemoryUploadedFileManager` and `MemoryMediaFileStorage`.
- Remove route-layer hard-casts from `runtime.uploaded_file_mgr` / `runtime.media_file_mgr`
  to memory implementations and eliminate the corresponding `# type: ignore` usage.
- For media serving: Either redirect to `get_url()` or add `get_file()` to the protocol
  (see Feasibility Analysis above).
- Ensure helper functions such as `create_upload_routes(...)` and any local route wiring
  variables are annotated against protocol types so custom backends work end-to-end once
  injected through `st.App`.

This route-layer update is required in addition to changing `st.App._create_runtime`;
otherwise, custom backends can be constructed in `RuntimeConfig` but still fail at the
web server boundary where the routes are currently wired for in-memory implementations.

### Public Exports

Export the protocols from a new `streamlit.storage` submodule:

```python
from streamlit.storage import (
    # Cache storage
    CacheStorage,
    CacheStorageManager,
    CacheStorageContext,
    CacheStorageKeyNotFoundError,  # Required for get() contract
    CacheStorageError,              # Base exception class
    InvalidCacheStorageContextError,
    # Media storage
    MediaFileStorage,
    MediaFileStorageError,
    MediaFileKind,
    # Upload storage
    UploadedFileManager,
    UploadedFileRec,
    UploadFileUrlInfo,
    DeletedFile,
)
```

### Usage Examples

#### Redis Cache Backend (Addresses #5849)

```python
import redis
import streamlit as st
from streamlit.storage import (
    CacheStorage, CacheStorageManager, CacheStorageContext,
    CacheStorageKeyNotFoundError,
)

class RedisCacheStorage(CacheStorage):
    def __init__(self, client: redis.Redis, prefix: str, ttl: int | None):
        self._client = client
        self._prefix = prefix
        self._ttl = ttl

    def get(self, key: str) -> bytes:
        """Get cached value. Raises CacheStorageKeyNotFoundError on miss."""
        value = self._client.get(f"{self._prefix}:{key}")
        if value is None:
            raise CacheStorageKeyNotFoundError(key)
        return value

    def set(self, key: str, value: bytes) -> None:
        self._client.set(f"{self._prefix}:{key}", value, ex=self._ttl)

    def delete(self, key: str) -> None:
        self._client.delete(f"{self._prefix}:{key}")

    def clear(self) -> None:
        for key in self._client.scan_iter(f"{self._prefix}:*"):
            self._client.delete(key)

class RedisCacheStorageManager(CacheStorageManager):
    def __init__(self, redis_url: str):
        self._client = redis.from_url(redis_url)

    def create(self, context: CacheStorageContext) -> CacheStorage:
        return RedisCacheStorage(
            self._client,
            prefix=context.function_key,
            ttl=context.ttl_seconds,
        )

    def check_context(self, context: CacheStorageContext) -> None:
        if context.persist == "disk":
            raise ValueError("Redis backend doesn't support 'disk' persist mode")

app = st.App(
    "main.py",
    cache_storage_manager=RedisCacheStorageManager("redis://localhost:6379"),
)
```

#### S3 File Upload Backend (Addresses #10827)

```python
import uuid
from collections.abc import Mapping, Sequence
import boto3
import streamlit as st
from streamlit.runtime.stats import Stat
from streamlit.storage import (
    UploadedFileManager, UploadedFileRec, UploadFileUrlInfo, DeletedFile
)

class S3UploadedFileManager(UploadedFileManager):
    """Upload files to S3 instead of memory.

    Note: Files are still fully buffered in memory when read via get_files().
    This backend avoids persisting uploads in the Streamlit server's heap
    across requests, but large files will still consume memory when accessed
    by the user script via st.file_uploader.
    """

    def __init__(self, bucket: str, prefix: str = "uploads"):
        self._s3 = boto3.client("s3")
        self._bucket = bucket
        self._prefix = prefix

    # --- StatsProvider interface (required by protocol) ---

    @property
    def stats_families(self) -> Sequence[str]:
        """No custom stats for this backend."""
        return []

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return empty stats."""
        return {}

    # --- UploadedFileManager interface ---

    def add_file(self, session_id: str, file: UploadedFileRec) -> None:
        """Store file in S3 (called by HTTP upload route)."""
        key = f"{self._prefix}/{session_id}/{file.file_id}"
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=file.data,
            Metadata={"filename": file.name, "content-type": file.type},
        )

    def remove_file(self, session_id: str, file_id: str) -> None:
        """Delete file from S3."""
        key = f"{self._prefix}/{session_id}/{file_id}"
        self._s3.delete_object(Bucket=self._bucket, Key=key)

    def get_files(
        self, session_id: str, file_ids: Sequence[str]
    ) -> list[UploadedFileRec]:
        files = []
        for file_id in file_ids:
            key = f"{self._prefix}/{session_id}/{file_id}"
            try:
                response = self._s3.get_object(Bucket=self._bucket, Key=key)
                metadata = response["Metadata"]
                files.append(UploadedFileRec(
                    file_id=file_id,
                    name=metadata.get("filename", file_id),
                    type=metadata.get("content-type", "application/octet-stream"),
                    data=response["Body"].read(),
                ))
            except self._s3.exceptions.NoSuchKey:
                pass  # File deleted, skip
        return files

    def remove_session_files(self, session_id: str) -> None:
        """Cleanup all files for a session."""
        prefix = f"{self._prefix}/{session_id}/"
        response = self._s3.list_objects_v2(Bucket=self._bucket, Prefix=prefix)
        for obj in response.get("Contents", []):
            self._s3.delete_object(Bucket=self._bucket, Key=obj["Key"])

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> list[UploadFileUrlInfo]:
        """Generate URLs for the Streamlit upload route (not direct S3)."""
        result = []
        for _ in file_names:
            file_id = str(uuid.uuid4())
            # Return Streamlit's upload endpoint URLs
            result.append(UploadFileUrlInfo(
                file_id=file_id,
                upload_url=f"/_stcore/upload_file/{session_id}/{file_id}",
                delete_url=f"/_stcore/upload_file/{session_id}/{file_id}",
            ))
        return result

app = st.App(
    "main.py",
    uploaded_file_manager=S3UploadedFileManager("my-streamlit-bucket"),
)
```

#### Disk-Based File Upload (Addresses #10828)

```python
import re
import uuid
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
import streamlit as st
from streamlit.runtime.stats import Stat
from streamlit.storage import (
    UploadedFileManager, UploadedFileRec, UploadFileUrlInfo
)

class DiskUploadedFileManager(UploadedFileManager):
    """Upload files to local disk instead of memory."""

    def __init__(self, base_path: str = "/tmp/streamlit-uploads"):
        self._base = Path(base_path)
        self._base.mkdir(parents=True, exist_ok=True)

    def _sanitize_id(self, id_str: str) -> str:
        """Sanitize session_id/file_id to prevent path traversal attacks."""
        # Only allow alphanumeric, hyphens, underscores
        sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', id_str)
        # Prevent empty strings
        return sanitized or "unknown"

    def _session_dir(self, session_id: str) -> Path:
        safe_session_id = self._sanitize_id(session_id)
        path = self._base / safe_session_id
        path.mkdir(exist_ok=True)
        return path

    # --- StatsProvider interface (required by protocol) ---

    @property
    def stats_families(self) -> Sequence[str]:
        """No custom stats for this backend."""
        return []

    def get_stats(
        self, family_names: Sequence[str] | None = None
    ) -> Mapping[str, Sequence[Stat]]:
        """Return empty stats."""
        return {}

    # --- UploadedFileManager interface ---

    def add_file(self, session_id: str, file: UploadedFileRec) -> None:
        session_dir = self._session_dir(session_id)
        safe_file_id = self._sanitize_id(file.file_id)
        # Write file data
        (session_dir / safe_file_id).write_bytes(file.data)
        # Write metadata
        (session_dir / f"{safe_file_id}.meta").write_text(
            json.dumps({"name": file.name, "type": file.type})
        )

    def remove_file(self, session_id: str, file_id: str) -> None:
        session_dir = self._session_dir(session_id)
        safe_file_id = self._sanitize_id(file_id)
        (session_dir / safe_file_id).unlink(missing_ok=True)
        (session_dir / f"{safe_file_id}.meta").unlink(missing_ok=True)

    def get_files(
        self, session_id: str, file_ids: Sequence[str]
    ) -> list[UploadedFileRec]:
        session_dir = self._session_dir(session_id)
        files = []
        for file_id in file_ids:
            safe_file_id = self._sanitize_id(file_id)
            file_path = session_dir / safe_file_id
            meta_path = session_dir / f"{safe_file_id}.meta"
            if file_path.exists() and meta_path.exists():
                meta = json.loads(meta_path.read_text())
                files.append(UploadedFileRec(
                    file_id=file_id,
                    name=meta["name"],
                    type=meta["type"],
                    data=file_path.read_bytes(),
                ))
        return files

    def remove_session_files(self, session_id: str) -> None:
        import shutil
        safe_session_id = self._sanitize_id(session_id)
        session_dir = self._base / safe_session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)

    def get_upload_urls(
        self, session_id: str, file_names: Sequence[str]
    ) -> list[UploadFileUrlInfo]:
        result = []
        for _ in file_names:
            file_id = str(uuid.uuid4())
            result.append(UploadFileUrlInfo(
                file_id=file_id,
                upload_url=f"/_stcore/upload_file/{session_id}/{file_id}",
                delete_url=f"/_stcore/upload_file/{session_id}/{file_id}",
            ))
        return result

app = st.App(
    "main.py",
    uploaded_file_manager=DiskUploadedFileManager("/data/uploads"),
)
```

### Thread Safety Requirements

All custom storage implementations must be thread-safe. Document this requirement clearly
in the protocol docstrings and user documentation. The existing in-memory implementations
serve as reference implementations.

### Migration Path

1. **Phase 1 (this spec):** Expose storage parameters on `st.App`. Advanced users can
   implement custom backends. This is opt-in and doesn't affect existing apps.

2. **Phase 2 (future):** Ship official `streamlit-redis` and `streamlit-s3` packages with
   production-ready implementations, tested and maintained by Streamlit.

3. **Phase 3 (future):** Consider adding storage configuration to `config.toml` for
   declarative configuration without code changes.

### Documentation

Add new documentation section: "Advanced Deployment > Custom Storage Backends"

- Protocol reference for each storage type
- Example implementations (Redis, S3, PostgreSQL)
- Thread safety requirements
- Testing custom backends with AppTest

### Testing

- Unit tests for `st.App` with custom storage parameters
- Integration tests with mock storage implementations
- AppTest compatibility with custom storage (ensure `MemoryCacheStorageManager` still
  works in test mode)

## Alternatives Considered

### A. Config-Based Storage Selection

Use `config.toml` to select from built-in backends:

```toml
[cache]
backend = "redis"
redis_url = "redis://localhost:6379"
```

**Rejected because:**

- Limits flexibility (can't pass custom logic)
- Requires Streamlit to ship and maintain all backends
- Config parsing happens early, before user code can configure credentials

### B. Factory Function Pattern

```python
st.configure_storage(
    cache=lambda: RedisCacheStorageManager(...),
    uploads=lambda: S3UploadedFileManager(...),
)
```

**Rejected because:**

- Global state is harder to reason about
- Doesn't align with `st.App` as the configuration point
- Harder to test (no isolation between tests)

### C. Environment Variable Injection

```bash
STREAMLIT_CACHE_BACKEND=redis://localhost:6379 streamlit run app.py
```

**Rejected because:**

- Only works for backends Streamlit ships
- Can't pass complex configuration
- Doesn't support custom implementations

### D. Separate from `st.App`

Keep storage configuration separate from `st.App`, perhaps via `RuntimeConfig` directly.

**Rejected because:**

- `st.App` is already the configuration point for advanced deployment
- Exposing `RuntimeConfig` to users adds unnecessary complexity
- Users already understand `st.App` from the existing spec

## Out of Scope (Future Work)

- **Session storage extensibility:** `SessionStorage` stores live Python objects (WebSocket
  connections, threads) that cannot be serialized. Cross-instance session persistence
  would require separating serializable state from live connections — a fundamental
  architectural change. This addresses the "session state shared across pods" part of #5849
  but is a separate, larger effort.
- **Direct browser-to-S3 upload:** The frontend currently wraps uploads in `FormData`,
  which is incompatible with S3 pre-signed PUT URLs (which expect raw body). True direct
  upload would require frontend changes to detect external URLs and adjust the payload
  format, plus CORS configuration on the S3 bucket. This would improve performance for
  large files but is deferred to a future iteration.
- **Official Redis/S3 packages:** Ship later based on community adoption.
- **Config.toml storage selection:** Simpler UX for common backends, but requires
  shipping official implementations first.
- **Automatic serialization:** Users must handle serialization in their implementations.
- **Async storage protocols:** Current protocols are synchronous. The Starlette upload
  routes are async, so a synchronous `add_file()` that performs a network call (e.g., S3
  PUT) will block the event loop. The implementation should use `asyncio.to_thread()` when
  invoking synchronous custom storage from async routes, or document this as a known
  limitation. Adding async protocol variants is deferred to a future iteration.
