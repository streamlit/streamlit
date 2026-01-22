# Combined Performance Opportunities (Top 20)

Validated set of small/medium-scope backend and frontend optimizations with the best ROI. Each item references current code for evidence and suggests next actions.

---

## 1. Double serialization in `SessionState.as_widget_states`

*Evidence*:

```249:256:lib/streamlit/runtime/state/session_state.py
states = [# Combined Performance Opportunities (Top 20)

Validated set of small/medium-scope backend and frontend optimizations with the best ROI. Each item references current code for evidence and suggests next actions.

---

## 1. Double serialization in `SessionState.as_widget_states`
*Evidence*:

```249:256:lib/streamlit/runtime/state/session_state.py
states = [
    self.get_serialized(widget_id)
    for widget_id in self.states
    if self.get_serialized(widget_id)
]
```

`get_serialized` runs twice per widget every sync.
*Fix*: Capture the serialized value (walrus operator) to halve proto work.

---

## 2. Blocking external-IP lookup inside WebSocket origin checks

*Evidence*:

```34:63:lib/streamlit/net_util.py
response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)
...
```

`BrowserWebSocketHandler.check_origin` may call this during every handshake, blocking Tornado for up to 5 s.
*Fix*: Fetch/cache IP during startup on a background thread, let `check_origin` use cached value instantly.

---

## 3. Component assets served with synchronous `open().read()`

*Evidence*:

```55:67:lib/streamlit/web/server/component_request_handler.py
with open(abspath, "rb") as file:
    contents = file.read()
self.write(contents)
```

Every asset request blocks the event loop.
*Fix*: Use `IOLoop.run_in_executor` or `aiofiles` to stream files without blocking.

---

## 4. Script cache holds global lock while reading from disk

*Evidence*:

```61:69:lib/streamlit/runtime/scriptrunner/script_cache.py
with self._lock:
    bytecode = self._cache.get(script_path, None)
    ...
    with open_python_file(script_path) as f:
        filebody = f.read()
```

Large scripts or slow mounts stall all reruns.
*Fix*: Release lock before reading, reacquire only to update cache.

---

## 5. Forward message hashing serializes entire payload twice

*Evidence*:

```42:66:lib/streamlit/runtime/forward_msg_cache.py
serialized_msg = msg.SerializeToString(deterministic=True)
msg.hash = util.calc_md5(serialized_msg)
```

Large DataFrames pay ~2× serialization cost.
*Fix*: Hash metadata + (size, prefix) only, or use a faster streaming hash (xxHash).

---

## 6. Disk cache read/write is synchronous

*Evidence*:

```146:175:lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py
with streamlit_read(path, binary=True) as file:
    value = file.read()
...
with streamlit_write(path, binary=True) as output:
    output.write(value)
```

Persisted cache hits block the runtime thread.
*Fix*: Offload to a thread pool or adopt `aiofiles`.

---

## 7. `SessionState` serializability check pickles every value each run

*Evidence*:

```944:960:lib/streamlit/runtime/state/session_state.py
for k in self:
    pickle.dumps(self[k])
```

Large states incur O(N) pickle costs per rerun.
*Fix*: Track modified keys (dirty flag) and only re‑pickle those.

---

## 8. Widget state size stats call `asizeof` every request

*Evidence*:

```937:942:lib/streamlit/runtime/state/session_state.py
from streamlit.vendor.pympler.asizeof import asizeof
stat = CacheStat(... asizeof(self))
```

`asizeof` walks the entire object graph.
*Fix*: Maintain approximate byte counters incrementally or gate behind a debug flag.

---

## 9. `UploadFileRequestHandler` buffers entire body before validation

*Evidence*:

```107:118:lib/streamlit/web/server/upload_file_request_handler.py
tornado.httputil.parse_body_arguments(... body=self.request.body ...)
if not self._is_active_session(session_id):
    self.send_error(400, reason="Invalid session_id")
```

Invalid uploads still pay the full parsing cost.
*Fix*: Validate path params first and stream uploads via Tornado’s chunked handlers.

---

## 10. Metrics config fetch blocks initialization for up to 5 s

*Evidence*:

```151:177:frontend/app/src/MetricsManager.ts
const response = await fetch(DEFAULT_METRICS_CONFIG, {
  signal: AbortSignal.timeout(5000),
})
```

Cold clients stall while waiting for telemetry config.
*Fix*: Kick off fetch asynchronously and continue with metrics disabled until it resolves.

---

## 11. DOMPurify runs on main thread for every HTML change

*Evidence*:

```17:37:frontend/lib/src/components/elements/Html/SanitizedHtml.tsx
const sanitizedHtml = useMemo(() => sanitizeHtmlString(body), [body])
```

Large/rapid HTML updates (chatbots, markdown) cause UI jank.
*Fix*: Move sanitization to a Web Worker or cache sanitized output by hash.

---

## 12. DataFrame hashing samples 10 k rows regardless of size

*Evidence*:

```425:455:lib/streamlit/runtime/caching/hashing.py
if len(df_obj) >= _PANDAS_ROWS_LARGE:
    df_obj = df_obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
values_hash_bytes = self.to_bytes(hash_pandas_object(df_obj))
```

Multi‑million-row frames still hash 10 k rows twice.
*Fix*: Scale sample size logarithmically, include schema hash first, and short‑circuit when TTL is small.

---

## 13. DataFrame → Arrow conversion always goes through Pandas

*Evidence*:

```904:909:lib/streamlit/dataframe_util.py
# TODO(lukasmasuch): Add direct conversion to Arrow for supported formats here
df = convert_anything_to_pandas_df(data, ...)
return convert_pandas_df_to_arrow_bytes(df)
```

Polars/Arrow-native data pays an unnecessary conversion.
*Fix*: Implement fast paths for Arrow, Polars, numpy dicts, etc.

---

## 14. `inspect.getfullargspec` called on every telemetry event

*Evidence*:

```293:314:lib/streamlit/runtime/metrics_util.py
arg_keywords = inspect.getfullargspec(_command_func).args
```

Reflection happens per call even though function signatures rarely change.
*Fix*: Memoize arg specs per function object.

---

## 15. `inspect.getsource` executed for every cached function key

*Evidence*:

```508:516:lib/streamlit/runtime/caching/cache_utils.py
source_code = inspect.getsource(func)
```

The same function’s source is reread each time the cache key is built.
*Fix*: Cache keys by `id(func.__code__)` so source is fetched once.

---

## 16. MD5 everywhere despite faster non-cryptographic hashes

*Evidence*:

```68:79:lib/streamlit/util.py
h = hashlib.new("md5", usedforsecurity=False)
```

Used for file watchers, forward message cache, etc.
*Fix*: Switch to `xxhash` (or similar) for non-security-critical hashes.

---

## 17. Polling file watcher recalculates MD5 even when mtime unchanged

*Evidence*:

```115:119:lib/streamlit/watcher/polling_path_watcher.py
md5 = util.calc_md5_with_blocking_retries(...)
```

MD5 runs every 0.2 s even if `os.path.getmtime` hasn’t changed.
*Fix*: Skip MD5 calculation when mtime matches last run; only hash after a change is detected.

---

## 18. Media file storage keeps all blobs in memory forever

*Evidence*:

```101:128:lib/streamlit/runtime/memory_media_file_storage.py
self._files_by_id: dict[str, MemoryFile] = {}
...
self._files_by_id[file_id] = media_file
```

Large downloads accumulate with no eviction.
*Fix*: Use `cachetools.LRUCache` or add TTL/size caps, spilling older entries.

---

## 19. Image resizing blocks the main thread

*Evidence*:

```177:208:lib/streamlit/elements/lib/image_utils.py
pil_image = Image.open(io.BytesIO(image_data))
...
pil_image = pil_image.resize(...)
```

Pillow operations are CPU-heavy and run inline.
*Fix*: Offload to a thread pool and prefer `pillow-simd` builds for SIMD acceleration.

---

## 20. Metrics telemetry stores anonymous ID in both cookie and localStorage

*Evidence*:

```304:341:frontend/app/src/MetricsManager.ts
if (anonymousIdCookie) {
  ...
  window.localStorage.setItem(anonymousIdKey, anonymousIdCookie)
}
```

Every metrics event triggers extra storage reads/writes.
*Fix*: Only sync when the value changes and allow opt-out of the localStorage mirror.

---

### Next Steps

1. Address the “Critical” I/O blockers first (items 2–4, 6).
2. Batch hashing/serialization optimizations (items 5, 12–16) for cache-heavy workloads.
3. Parallelize remaining frontend render wins (items 11, 20) to improve perceived latency.
    self.get_serialized(widget_id)
    for widget_id in self.states
    if self.get_serialized(widget_id)
]

```# Combined Performance Opportunities (Top 20)

Validated set of small/medium-scope backend and frontend optimizations with the best ROI. Each item references current code for evidence and suggests next actions.

---

## 1. Double serialization in `SessionState.as_widget_states`
*Evidence*:

```249:256:lib/streamlit/runtime/state/session_state.py
states = [
    self.get_serialized(widget_id)
    for widget_id in self.states
    if self.get_serialized(widget_id)
]
```

`get_serialized` runs twice per widget every sync.
*Fix*: Capture the serialized value (walrus operator) to halve proto work.

---

## 2. Blocking external-IP lookup inside WebSocket origin checks

*Evidence*:

```34:63:lib/streamlit/net_util.py
response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)
...
```

`BrowserWebSocketHandler.check_origin` may call this during every handshake, blocking Tornado for up to 5 s.
*Fix*: Fetch/cache IP during startup on a background thread, let `check_origin` use cached value instantly.

---

## 3. Component assets served with synchronous `open().read()`

*Evidence*:

```55:67:lib/streamlit/web/server/component_request_handler.py
with open(abspath, "rb") as file:
    contents = file.read()
self.write(contents)
```

Every asset request blocks the event loop.
*Fix*: Use `IOLoop.run_in_executor` or `aiofiles` to stream files without blocking.

---

## 4. Script cache holds global lock while reading from disk

*Evidence*:

```61:69:lib/streamlit/runtime/scriptrunner/script_cache.py
with self._lock:
    bytecode = self._cache.get(script_path, None)
    ...
    with open_python_file(script_path) as f:
        filebody = f.read()
```

Large scripts or slow mounts stall all reruns.
*Fix*: Release lock before reading, reacquire only to update cache.

---

## 5. Forward message hashing serializes entire payload twice

*Evidence*:

```42:66:lib/streamlit/runtime/forward_msg_cache.py
serialized_msg = msg.SerializeToString(deterministic=True)
msg.hash = util.calc_md5(serialized_msg)
```

Large DataFrames pay ~2× serialization cost.
*Fix*: Hash metadata + (size, prefix) only, or use a faster streaming hash (xxHash).

---

## 6. Disk cache read/write is synchronous

*Evidence*:

```146:175:lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py
with streamlit_read(path, binary=True) as file:
    value = file.read()
...
with streamlit_write(path, binary=True) as output:
    output.write(value)
```

Persisted cache hits block the runtime thread.
*Fix*: Offload to a thread pool or adopt `aiofiles`.

---

## 7. `SessionState` serializability check pickles every value each run

*Evidence*:

```944:960:lib/streamlit/runtime/state/session_state.py
for k in self:
    pickle.dumps(self[k])
```

Large states incur O(N) pickle costs per rerun.
*Fix*: Track modified keys (dirty flag) and only re‑pickle those.

---

## 8. Widget state size stats call `asizeof` every request

*Evidence*:

```937:942:lib/streamlit/runtime/state/session_state.py
from streamlit.vendor.pympler.asizeof import asizeof
stat = CacheStat(... asizeof(self))
```

`asizeof` walks the entire object graph.
*Fix*: Maintain approximate byte counters incrementally or gate behind a debug flag.

---

## 9. `UploadFileRequestHandler` buffers entire body before validation

*Evidence*:

```107:118:lib/streamlit/web/server/upload_file_request_handler.py
tornado.httputil.parse_body_arguments(... body=self.request.body ...)
if not self._is_active_session(session_id):
    self.send_error(400, reason="Invalid session_id")
```

Invalid uploads still pay the full parsing cost.
*Fix*: Validate path params first and stream uploads via Tornado’s chunked handlers.

---

## 10. Metrics config fetch blocks initialization for up to 5 s

*Evidence*:

```151:177:frontend/app/src/MetricsManager.ts
const response = await fetch(DEFAULT_METRICS_CONFIG, {
  signal: AbortSignal.timeout(5000),
})
```

Cold clients stall while waiting for telemetry config.
*Fix*: Kick off fetch asynchronously and continue with metrics disabled until it resolves.

---

## 11. DOMPurify runs on main thread for every HTML change

*Evidence*:

```17:37:frontend/lib/src/components/elements/Html/SanitizedHtml.tsx
const sanitizedHtml = useMemo(() => sanitizeHtmlString(body), [body])
```

Large/rapid HTML updates (chatbots, markdown) cause UI jank.
*Fix*: Move sanitization to a Web Worker or cache sanitized output by hash.

---

## 12. DataFrame hashing samples 10 k rows regardless of size

*Evidence*:

```425:455:lib/streamlit/runtime/caching/hashing.py
if len(df_obj) >= _PANDAS_ROWS_LARGE:
    df_obj = df_obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
values_hash_bytes = self.to_bytes(hash_pandas_object(df_obj))
```

Multi‑million-row frames still hash 10 k rows twice.
*Fix*: Scale sample size logarithmically, include schema hash first, and short‑circuit when TTL is small.

---

## 13. DataFrame → Arrow conversion always goes through Pandas

*Evidence*:

```904:909:lib/streamlit/dataframe_util.py
# TODO(lukasmasuch): Add direct conversion to Arrow for supported formats here
df = convert_anything_to_pandas_df(data, ...)
return convert_pandas_df_to_arrow_bytes(df)
```

Polars/Arrow-native data pays an unnecessary conversion.
*Fix*: Implement fast paths for Arrow, Polars, numpy dicts, etc.

---

## 14. `inspect.getfullargspec` called on every telemetry event

*Evidence*:

```293:314:lib/streamlit/runtime/metrics_util.py
arg_keywords = inspect.getfullargspec(_command_func).args
```

Reflection happens per call even though function signatures rarely change.
*Fix*: Memoize arg specs per function object.

---

## 15. `inspect.getsource` executed for every cached function key

*Evidence*:

```508:516:lib/streamlit/runtime/caching/cache_utils.py
source_code = inspect.getsource(func)
```

The same function’s source is reread each time the cache key is built.
*Fix*: Cache keys by `id(func.__code__)` so source is fetched once.

---

## 16. MD5 everywhere despite faster non-cryptographic hashes

*Evidence*:

```68:79:lib/streamlit/util.py
h = hashlib.new("md5", usedforsecurity=False)
```

Used for file watchers, forward message cache, etc.
*Fix*: Switch to `xxhash` (or similar) for non-security-critical hashes.

---

## 17. Polling file watcher recalculates MD5 even when mtime unchanged

*Evidence*:

```115:119:lib/streamlit/watcher/polling_path_watcher.py
md5 = util.calc_md5_with_blocking_retries(...)
```

MD5 runs every 0.2 s even if `os.path.getmtime` hasn’t changed.
*Fix*: Skip MD5 calculation when mtime matches last run; only hash after a change is detected.

---

## 18. Media file storage keeps all blobs in memory forever

*Evidence*:

```101:128:lib/streamlit/runtime/memory_media_file_storage.py
self._files_by_id: dict[str, MemoryFile] = {}
...
self._files_by_id[file_id] = media_file
```

Large downloads accumulate with no eviction.
*Fix*: Use `cachetools.LRUCache` or add TTL/size caps, spilling older entries.

---

## 19. Image resizing blocks the main thread

*Evidence*:

```177:208:lib/streamlit/elements/lib/image_utils.py
pil_image = Image.open(io.BytesIO(image_data))
...
pil_image = pil_image.resize(...)
```

Pillow operations are CPU-heavy and run inline.
*Fix*: Offload to a thread pool and prefer `pillow-simd` builds for SIMD acceleration.

---

## 20. Metrics telemetry stores anonymous ID in both cookie and localStorage

*Evidence*:

```304:341:frontend/app/src/MetricsManager.ts
if (anonymousIdCookie) {
  ...
  window.localStorage.setItem(anonymousIdKey, anonymousIdCookie)
}
```

Every metrics event triggers extra storage reads/writes.
*Fix*: Only sync when the value changes and allow opt-out of the localStorage mirror.

---

### Next Steps

1. Address the “Critical” I/O blockers first (items 2–4, 6).
2. Batch hashing/serialization optimizations (items 5, 12–16) for cache-heavy workloads.
3. Parallelize remaining frontend render wins (items 11, 20) to improve perceived latency.

`get_serialized` runs twice per widget every sync.
*Fix*: Capture the serialized value (walrus operator) to halve proto work.

---
