# High-ROI Performance Opportunities (Top 15)

Small-to-medium engineering changes that would deliver outsized runtime/perceived performance wins without touching Streamlit’s public APIs.

---

## 1. Remove blocking external-IP lookup in origin checks
**Bottleneck:** The first call to `net_util.get_external_ip()` happens synchronously inside `is_url_from_allowed_origins`, which is invoked during every WebSocket handshake. Until `_external_ip` is cached, the handler makes a blocking `requests.get` with a 5 s timeout.

```34:63:lib/streamlit/net_util.py
response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)
if response is None:
    response = _make_blocking_http_get(_AWS_CHECK_IP_HTTPS, timeout=5)
```

**Impact:** A transient DNS/network issue pauses the entire Tornado event loop for up to 5 s per connection, making DoS trivial.
**Fix:** Fetch the external IP once in a background task (or make it opt‑in) and have `check_origin` use the cached result immediately.

---

## 2. Stream component assets instead of blocking the event loop
**Bottleneck:** `ComponentRequestHandler` reads component files with synchronous `open().read()` inside the Tornado handler.

```55:67:lib/streamlit/web/server/component_request_handler.py
with open(abspath, "rb") as file:
    contents = file.read()
self.write(contents)
```

**Impact:** Serving large JS/CSS assets stalls every client until the read completes.
**Fix:** Use Tornado’s `StaticFileHandler`, `aiofiles`, or `IOLoop.run_in_executor` to stream files.

---

## 3. Make disk cache I/O asynchronous
**Bottleneck:** `LocalDiskCacheStorage` reads and writes cache entries synchronously on the main thread.

```146:175:lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py
with streamlit_read(path, binary=True) as file:
    value = file.read()
...
with streamlit_write(path, binary=True) as output:
    output.write(value)
```

**Impact:** A large cached DataFrame blocks all sessions during load/save.
**Fix:** Offload disk operations to a thread pool or async file API.

---

## 4. Avoid hashing entire ForwardMsg payloads
**Bottleneck:** Every outbound `ForwardMsg` is serialized in full just to compute an MD5 hash for caching.

```42:66:lib/streamlit/runtime/forward_msg_cache.py
serialized_msg = msg.SerializeToString(deterministic=True)
msg.hash = util.calc_md5(serialized_msg)
```

**Impact:** Hashing multi‑MB table diffs burns CPU twice (serialize + hash) before the message is even sent.
**Fix:** Cache hashes per delta type and hash only metadata + a prefix/size field for large payloads.

---

## 5. Cache `inspect.getfullargspec` in `gather_metrics`
**Bottleneck:** Metric collection calls `inspect.getfullargspec` on every decorated Streamlit command invocation.

```289:314:lib/streamlit/runtime/metrics_util.py
arg_keywords = inspect.getfullargspec(_command_func).args
```

**Impact:** `inspect` is expensive and these commands run on every widget call; repeated introspection wastes milliseconds per widget per rerun.
**Fix:** Cache arg specs per function object (e.g., `functools.lru_cache`) inside `_get_command_telemetry`.

---

## 6. Stop buffering entire uploads before validation
**Bottleneck:** `UploadFileRequestHandler.put` parses the full multipart body before checking whether the `session_id` is even valid.

```107:118:lib/streamlit/web/server/upload_file_request_handler.py
tornado.httputil.parse_body_arguments(... body=self.request.body ...)
if not self._is_active_session(session_id):
    self.send_error(400, reason="Invalid session_id")
```

**Impact:** Each invalid upload still pays the cost of allocating and parsing potentially hundreds of MB.
**Fix:** Validate routing params first and switch to Tornado’s streaming upload interface.

---

## 7. Skip expensive SHA‑224 hashes when deduplication isn’t needed
**Bottleneck:** For every `st.image`/`st.audio`, `_calculate_file_id` hashes the entire byte payload with SHA‑224.

```45:64:lib/streamlit/runtime/memory_media_file_storage.py
filehash = hashlib.new("sha224", usedforsecurity=False)
filehash.update(data)
filehash.update(bytes(mimetype.encode()))
```

**Impact:** Hashing multi‑MB media doubles CPU time per element.
**Fix:** Allow callers to opt out of deduplication (skip hashing) or hash a short fingerprint (e.g., length + Murmur3).

---

## 8. Reduce full-table scans in `MediaFileManager.remove_orphaned_files`
**Bottleneck:** After every script run, `remove_orphaned_files` walks every stored file to compute inactive IDs.

```121:154:lib/streamlit/runtime/media_file_manager.py
file_ids = set(self._file_metadata.keys())
for session_file_ids_by_coord in self._files_by_session_and_coord.values():
    file_ids.difference_update(session_file_ids_by_coord.values())
```

**Impact:** Apps that stream many frames spend significant time diffing large dictionaries.
**Fix:** Track reference counts per file_id so eviction is O(1) per removal instead of O(N) per sweep.

---

## 9. Avoid O(total uploads) work when reporting upload stats
**Bottleneck:** `MemoryUploadedFileManager.get_stats` shallow-copies the entire storage dict and iterates over every stored file, computing `len(file.data)` for each.

```121:138:lib/streamlit/runtime/memory_uploaded_file_manager.py
file_storage_copy = self.file_storage.copy()
for session_storage in file_storage_copy.values():
    all_files.extend(session_storage.values())
CacheStat(... byte_length=len(file.data))
```

**Impact:** A single `/debug/stats` request pauses the server when many large uploads exist.
**Fix:** Maintain cumulative byte counters during `add_file` / `remove_file` instead of recomputing on demand.

---

## 10. Session state stats run `pympler.asizeof` on every request
**Bottleneck:** `SessionState.get_stats` imports `asizeof` and measures the entire state object tree.

```937:942:lib/streamlit/runtime/state/session_state.py
from streamlit.vendor.pympler.asizeof import asizeof
stat = CacheStat("st_session_state", "", asizeof(self))
```

**Impact:** Measuring large states is extremely slow and blocks the stats endpoint.
**Fix:** Track approximate sizes incrementally (e.g., sum of value lengths) or gate the expensive scan behind a debug flag.

---

## 11. DOMPurify sanitization runs on the main thread for every HTML update
**Bottleneck:** `SanitizedHtml` sanitizes via DOMPurify in `useMemo` on every body change; fast‑updating components (chatbots, custom widgets) repeatedly sanitize long strings.

```17:37:frontend/lib/src/components/elements/Html/SanitizedHtml.tsx
const sanitizedHtml = useMemo(() => sanitizeHtmlString(body), [body])
return dompurify.sanitize(html, SANITIZE_HTML_BASE_OPTIONS)
```

**Impact:** Large/rapid HTML updates cause noticeable UI jank.
**Fix:** Move sanitization into a Web Worker or cache per-element digests so identical HTML isn’t re-sanitized.

---

## 12. DataFrame hashing still processes 10 k rows per call
**Bottleneck:** Even when a DataFrame has millions of rows, hashing samples 10 k rows (`_PANDAS_SAMPLE_SIZE`) and runs `hash_pandas_object` twice.

```425:455:lib/streamlit/runtime/caching/hashing.py
if len(df_obj) >= _PANDAS_ROWS_LARGE:
    df_obj = df_obj.sample(n=_PANDAS_SAMPLE_SIZE, random_state=0)
values_hash_bytes = self.to_bytes(hash_pandas_object(df_obj))
```

**Impact:** Hashing dominates CPU for large data even when the cache key is unlikely to be reused.
**Fix:** Adapt the sample size dynamically (log-scale) or hash metadata + a short chunk for huge frames.

---

## 13. Default metrics config fetch blocks for up to 5 s per client
**Bottleneck:** When `metricsUrl` isn’t provided, `MetricsManager.initialize` awaits a fetch with `AbortSignal.timeout(5000)`.

```151:177:frontend/app/src/MetricsManager.ts
const response = await fetch(DEFAULT_METRICS_CONFIG, {
  signal: AbortSignal.timeout(5000),
})
```

**Impact:** Cold clients spend up to 5 s waiting before any metrics can flush, delaying page responsiveness.
**Fix:** Kick off the fetch in the background and fall back immediately; refresh cached config asynchronously.

---

## 14. Serializable session-state enforcement pickles every value on every run
**Bottleneck:** When `runner.enforceSerializableSessionState` is on (Cloud default), `_check_serializable` pickles each state entry every rerun.

```944:960:lib/streamlit/runtime/state/session_state.py
for k in self:
    pickle.dumps(self[k])
```

**Impact:** Apps with many large objects pay an O(N) pickle cost per rerun.
**Fix:** Cache the “already verified” flag per key and only re-verify when the value identity changes.

---

## 15. Uploaded file data always lives in RAM
**Bottleneck:** `MemoryUploadedFileManager.add_file` stores raw bytes directly in `self.file_storage`, duplicating uploads even when they exceed available memory.

```77:94:lib/streamlit/runtime/memory_uploaded_file_manager.py
def add_file(...):
    self.file_storage[session_id][file.file_id] = file
```

**Impact:** High-volume uploads trigger GC churn and swap, slowing everyone.
**Fix:** Spill large blobs to temporary files/mmap and keep only descriptors in memory.

---
