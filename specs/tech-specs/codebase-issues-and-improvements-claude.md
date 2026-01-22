# Streamlit Codebase: Security Vulnerabilities, Bugs, and Performance Improvements

A deep-dive analysis of the Streamlit codebase identifying critical issues that can be addressed via relatively simple, under-the-hood changes without modifying user-facing APIs.

---

## 1. MemoryUploadedFileManager Missing Thread Synchronization

**Type:** Bug / Race Condition
**Severity:** Medium
**File:** `lib/streamlit/runtime/memory_uploaded_file_manager.py`

### Issue
The `MemoryUploadedFileManager` class claims to be "safe from multiple threads simultaneously" (line 35-36), but does not use any locking mechanism when accessing or modifying `self.file_storage`. The code only makes a shallow copy during `get_stats()` but not during other operations like `add_file()`, `remove_file()`, and `get_files()`.

```python
# Line 77-93: No lock when modifying shared dict
def add_file(self, session_id: str, file: UploadedFileRec) -> None:
    self.file_storage[session_id][file.file_id] = file

# Line 95-98: No lock when deleting
def remove_file(self, session_id: str, file_id: str) -> None:
    session_storage = self.file_storage[session_id]
    session_storage.pop(file_id, None)
```

### Impact
Concurrent access from multiple sessions could lead to data corruption, lost files, or inconsistent state when uploading/accessing files simultaneously.

### Fix
Add a `threading.Lock()` and acquire it during all read/write operations, similar to how `MediaFileManager` does it.

---

## 2. Cache Value Locks Memory Leak in Cache System

**Type:** Performance / Memory Leak
**Severity:** Medium
**File:** `lib/streamlit/runtime/caching/cache_utils.py`

### Issue
The `Cache` class creates a new lock for each unique `value_key` (lines 76-108), but these locks are never cleaned up even after the cached values are cleared or expire. The `clear()` method only removes locks from `_value_locks` when explicitly clearing specific keys, but TTL-based expiration doesn't trigger lock cleanup.

```python
def compute_value_lock(self, value_key: str) -> threading.Lock:
    """Return the lock that should be held while computing a new cached value."""
    with self._value_locks_lock:
        return self._value_locks[value_key]  # Creates new lock via defaultdict
```

### Impact
Long-running Streamlit apps with many unique cache keys will accumulate locks indefinitely, leading to memory growth over time.

### Fix
Add lock cleanup in the `write_result` method or implement periodic cleanup of unused locks.

---

## 3. Random Cookie Secret Generation on Every Server Instance

**Type:** Security
**Severity:** High
**File:** `lib/streamlit/config.py` (lines 733-742)

### Issue
The `server.cookieSecret` defaults to a randomly generated value using `secrets.token_hex()` that is memoized per-process. In multi-replica deployments, each replica generates a different secret.

```python
@_create_option("server.cookieSecret", type_=str, sensitive=True)
@util.memoize
def _server_cookie_secret() -> str:
    """..."""
    return secrets.token_hex()
```

### Impact
Session cookies signed by one replica will be invalid on another replica, breaking session continuity. Users may experience unexpected logouts or session issues when load-balanced across replicas. While documented, this is a common deployment pitfall.

### Fix
Log a warning when the cookie secret is auto-generated in production mode, or require explicit configuration in non-development environments.

---

## 4. Missing Session Validation in File Delete Endpoint

**Type:** Security
**Severity:** High
**File:** `lib/streamlit/web/server/upload_file_request_handler.py` (lines 144-158)

### Issue
The `delete()` method for removing uploaded files does NOT validate that the `session_id` is an active session, unlike the `put()` method which does check via `self._is_active_session(session_id)`:

```python
def delete(self, **kwargs: Any) -> None:
    # ...
    session_id = self.path_kwargs["session_id"]
    file_id = self.path_kwargs["file_id"]

    # No session validation here! Compare to put() which has:
    # if not self._is_active_session(session_id): self.send_error(400, ...)

    self._file_mgr.remove_file(session_id=session_id, file_id=file_id)
```

### Impact
An attacker could potentially delete files belonging to other sessions by guessing or enumerating session IDs and file IDs, even if those sessions have expired.

### Fix
Add the same `_is_active_session` validation check to the `delete()` method.

---

## 5. Secrets Logged in Plain Text to Files

**Type:** Security
**Severity:** Medium
**File:** `lib/streamlit/runtime/secrets.py` (lines 495-503)

### Issue
The `__repr__` method of the `Secrets` class returns the actual contents of secrets when the runtime is initialized:

```python
def __repr__(self) -> str:
    if not runtime.exists():
        return f"{self.__class__.__name__}"
    return repr(self._parse())  # Exposes all secrets!
```

### Impact
If `st.secrets` is accidentally printed, logged, or included in error messages/stack traces, all secrets could be exposed in logs, monitoring systems, or error reporting tools.

### Fix
Return a redacted representation that only shows key names without values, e.g., `Secrets(keys=['api_key', 'database', ...])`.

---

## 6. Unsafe MD5 Hashing for Forward Message Cache Keys

**Type:** Performance / Security
**Severity:** Low
**File:** `lib/streamlit/runtime/forward_msg_cache.py` (line 51)

### Issue
While the code correctly marks MD5 as `usedforsecurity=False`, it serializes entire protobuf messages to compute hashes:

```python
serialized_msg = msg.SerializeToString(deterministic=True)
msg.hash = util.calc_md5(serialized_msg)
```

For very large messages (e.g., big dataframes), this serialization and hashing can be expensive. The TODO comment on lines 46-48 acknowledges this but hasn't been addressed:

```python
# TODO(lukasmasuch): Evaluate more optimized hashing for larger messages:
# - Add the type element type and number of bytes to the hash.
# - Only hash the first N bytes of the message.
```

### Impact
Large dataframe operations cause unnecessary CPU overhead due to full message hashing.

### Fix
Implement the suggested optimization: hash only the first N bytes plus message size for large messages.

---

## 7. Potential Path Traversal in secrets.py Directory Parsing

**Type:** Security
**Severity:** Medium
**File:** `lib/streamlit/runtime/secrets.py` (lines 277-321)

### Issue
The `_parse_directory()` method reads secrets from directory structures (for Kubernetes-style secrets), but only checks that subfolders are directories - it doesn't validate that symlinks don't escape the intended directory:

```python
def _parse_directory(self, path: str) -> tuple[Mapping[str, Any], bool]:
    for dirname in os.listdir(path):
        sub_folder_path = os.path.join(path, dirname)
        if not os.path.isdir(sub_folder_path):
            # Only checks if it's a directory, not symlink targets
            raise StreamlitSecretNotFoundError(...)

        for filename in os.listdir(sub_folder_path):
            file_path = os.path.join(sub_folder_path, filename)
            with open(file_path) as f:  # Could follow symlinks outside!
                sub_secrets[filename] = f.read().strip()
```

### Impact
A malicious symlink in the secrets directory could allow reading arbitrary files on the filesystem.

### Fix
Use `os.path.realpath()` and validate that resolved paths stay within the expected secrets directory, similar to what `component_path_utils.py` does with `ensure_within_root()`.

---

## 8. Unbounded DataFrame/Array Sampling in Hashing

**Type:** Performance
**Severity:** Medium
**File:** `lib/streamlit/runtime/caching/hashing.py` (lines 54-59, 425-533)

### Issue
The hashing code samples large DataFrames and NumPy arrays to avoid hashing everything, but uses fixed sample sizes regardless of actual data characteristics:

```python
_PANDAS_ROWS_LARGE: Final = 50_000
_PANDAS_SAMPLE_SIZE: Final = 10_000
_NP_SIZE_LARGE: Final = 500_000
_NP_SAMPLE_SIZE: Final = 100_000
```

The sampling uses `random_state=0` which is deterministic, meaning:
1. Two different DataFrames with identical sampled rows will have the same hash (hash collision)
2. Small variations in large DataFrames may not be detected

### Impact
Cache collisions for large datasets with similar sampled rows, leading to incorrect cached results being returned.

### Fix
Include the hash of the first and last N rows in addition to random sampling, and include column names/dtypes more prominently in the hash.

---

## 9. AppStaticFileHandler Allows All CORS Origins

**Type:** Security
**Severity:** Low
**File:** `lib/streamlit/web/server/app_static_file_handler.py` (lines 85-88)

### Issue
The `AppStaticFileHandler` unconditionally sets `Access-Control-Allow-Origin: *` for all requests:

```python
def set_default_headers(self) -> None:
    # CORS protection is disabled because we need access to this endpoint
    # from the inner iframe.
    self.set_header("Access-Control-Allow-Origin", "*")
```

### Impact
Any website can embed and access static files served by Streamlit apps, which could leak sensitive static content if users mistakenly place confidential files in the `static/` directory.

### Fix
If possible, restrict CORS to known Streamlit origins rather than wildcard, or add documentation warnings about this behavior.

---

## 10. Session State Pickle Serialization Check is Too Late

**Type:** Bug / UX
**Severity:** Medium
**File:** `lib/streamlit/runtime/state/session_state.py` (lines 944-970)

### Issue
The `_check_serializable()` method only catches serialization errors when `runner.enforceSerializableSessionState` is enabled, and it checks serializability by trying to pickle each value. However:

1. This check happens at script completion, not when values are set
2. The error message mentions pickle but doesn't help users identify which value caused the issue until iteration

```python
def _check_serializable(self) -> None:
    for k in self:
        try:
            pickle.dumps(self[k])
        except Exception as e:
            err_msg = (
                f"Cannot serialize the value (of type `{type(self[k])}`) of '{k}' in "
                "st.session_state..."
            )
            raise UnserializableSessionStateError(err_msg) from e
```

### Impact
Users only discover serialization issues at script completion rather than at assignment time, making debugging harder.

### Fix
Consider adding an optional early check mode that validates serializability immediately when values are assigned to session state.

---

## 11. defaultdict in File Storage Creates Orphaned Entries

**Type:** Bug / Memory Leak
**Severity:** Low
**File:** `lib/streamlit/runtime/memory_uploaded_file_manager.py` (line 39)

### Issue
Using `defaultdict(dict)` for `file_storage` means accessing any session_id, even for reading, will create an empty dict entry:

```python
self.file_storage: dict[str, dict[str, UploadedFileRec]] = defaultdict(dict)

# This creates an empty entry if session doesn't exist:
def get_files(self, session_id: str, file_ids: Sequence[str]) -> list[UploadedFileRec]:
    session_storage = self.file_storage[session_id]  # Creates entry!
```

### Impact
Querying files for non-existent or expired sessions creates orphaned empty dicts that are never cleaned up, leading to slow memory growth.

### Fix
Use `self.file_storage.get(session_id, {})` instead of direct access, or convert to regular dict.

---

## 12. Config File Parsing Silently Swallows Exceptions

**Type:** Bug
**Severity:** Medium
**File:** `lib/streamlit/config.py` (lines 2446-2457)

### Issue
When parsing config TOML files, exceptions are caught and only logged, allowing the app to continue with potentially incomplete configuration:

```python
def _update_config_with_toml(raw_toml: str, where_defined: str) -> None:
    try:
        import toml
        parsed_config_file = toml.loads(raw_toml)
    except Exception:
        # Catching any parsing exception to prevent this from breaking our
        # config change watcher logic.
        _LOGGER.exception(
            "Error parsing config toml. This is most likely due to a syntax error..."
        )
        return  # Silently continues with old/default config
```

### Impact
Users may not realize their config changes aren't being applied due to syntax errors, leading to confusion when settings don't take effect.

### Fix
In non-development mode, raise the exception or show a prominent warning in the app UI rather than just logging.

---

## 13. WebSocket Protocol Token Handling is Fragile

**Type:** Security / Bug
**Severity:** Medium
**File:** `lib/streamlit/web/server/browser_websocket_handler.py` (lines 157-181)

### Issue
The WebSocket handler extracts session tokens from the `Sec-WebSocket-Protocol` header using position-based indexing (third position), but error handling is overly broad:

```python
def open(self, *args: Any, **kwargs: Any) -> Awaitable[None] | None:
    try:
        ws_protocols = [p.strip() for p in self.request.headers["Sec-Websocket-Protocol"].split(",")]
        # ...
        if len(ws_protocols) >= 3:
            existing_session_id = ws_protocols[2]  # Position-based
    except KeyError:
        # Just let existing_session_id=None if we run into any error
        pass
```

### Impact
1. Malformed protocol headers could cause unexpected behavior
2. The comment mentions "third value" but doesn't validate the format of the session ID
3. Any exception is silently swallowed with a broad `except KeyError`

### Fix
Add validation for session ID format (e.g., UUID validation) and use more specific exception handling.

---

## 14. MediaFileManager Missing Lock During Orphaned File Cleanup

**Type:** Bug / Race Condition
**Severity:** Medium
**File:** `lib/streamlit/runtime/media_file_manager.py` (lines 137-156)

### Issue
The `remove_orphaned_files()` method acquires a lock but the iteration pattern could miss files or process stale data:

```python
def remove_orphaned_files(self) -> None:
    with self._lock:
        for file_id in self._get_inactive_file_ids():  # Returns set during iteration
            file = self._file_metadata[file_id]  # Could KeyError if modified
            if file.kind == MediaFileKind.MEDIA:
                self._delete_file(file_id)
            elif file.kind == MediaFileKind.DOWNLOADABLE:
                if file.is_marked_for_delete:
                    self._delete_file(file_id)
                else:
                    file.mark_for_delete()
```

The `_get_inactive_file_ids()` method returns a set computed from `self._file_metadata.keys()`, but if another thread adds files during iteration (before lock is acquired), those could be incorrectly marked.

### Impact
Race conditions during cleanup could incorrectly delete active files or miss orphaned files.

### Fix
Create a snapshot of the metadata at the start of cleanup and process that snapshot.

---

## 15. Hashing Falls Back to Pickle for Unhashable Types

**Type:** Security / Performance
**Severity:** Medium
**File:** `lib/streamlit/runtime/caching/hashing.py` (lines 642-651)

### Issue
When an object can't be hashed using the built-in handlers, the code falls back to using `__reduce__` which is the same mechanism pickle uses for serialization:

```python
else:
    # As a last resort, hash the output of the object's __reduce__ method
    try:
        reduce_data = obj.__reduce__()
    except Exception as ex:
        raise UnhashableTypeError() from ex

    for item in reduce_data:
        self.update(h, item)
    return h.digest()
```

### Impact
1. This can execute arbitrary code if `__reduce__` has side effects
2. Complex objects with expensive `__reduce__` implementations will slow down hashing
3. The hash depends on internal implementation details that could change between Python versions

### Fix
Consider logging a warning when falling back to `__reduce__` hashing, and provide guidance for users to implement custom hash functions for their types.

---

## Summary

| # | Issue | Type | Severity | Quick Fix |
|---|-------|------|----------|-----------|
| 1 | Missing thread locks in UploadedFileManager | Race Condition | Medium | Add threading.Lock |
| 2 | Cache lock memory leak | Memory Leak | Medium | Cleanup locks after use |
| 3 | Random cookie secret per instance | Security | High | Log warning in prod |
| 4 | No session validation on file delete | Security | High | Add validation check |
| 5 | Secrets exposed in repr | Security | Medium | Redact repr output |
| 6 | Expensive full-message hashing | Performance | Low | Implement partial hash |
| 7 | Path traversal in secrets directory | Security | Medium | Validate resolved paths |
| 8 | DataFrame sampling hash collisions | Correctness | Medium | Improve hash algorithm |
| 9 | Static files allow all CORS | Security | Low | Restrict origins |
| 10 | Late pickle serialization check | UX | Medium | Early validation mode |
| 11 | defaultdict orphaned entries | Memory Leak | Low | Use .get() |
| 12 | Silent config parse failures | UX | Medium | Raise in prod |
| 13 | Fragile WebSocket token parsing | Security | Medium | Validate format |
| 14 | Race condition in file cleanup | Race Condition | Medium | Snapshot before cleanup |
| 15 | Fallback to __reduce__ for hashing | Security | Medium | Log warning |

All of these issues can be addressed with focused, surgical changes that don't affect the public API surface.
