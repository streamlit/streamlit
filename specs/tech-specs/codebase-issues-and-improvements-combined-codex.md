# Combined Codebase Issues and Improvements (Top 20)

This plan merges the issues raised by all reviewers, validates them against the current Streamlit sources, and expands the list to the most critical 20 “under the hood” fixes (security, correctness, performance) that require no public API changes. Each item cites the relevant file/lines and notes which reviewer(s) originally surfaced it.

---

## 1. MemoryUploadedFileManager lacks thread safety

*Type:* Concurrency bug · *Severity:* High · *Origin:* Analyst 1 #1 (validated)
`MemoryUploadedFileManager` claims to be thread-safe yet mutates `self.file_storage` without any locking, so concurrent uploads can corrupt state.

```33:99:lib/streamlit/runtime/memory_uploaded_file_manager.py
class MemoryUploadedFileManager(UploadedFileManager):
    ...
    def add_file(...):
        self.file_storage[session_id][file.file_id] = file

    def remove_file(...):
        session_storage = self.file_storage[session_id]
        session_storage.pop(file_id, None)
```

✅ *Fix:* Guard all reads/writes with a `threading.Lock`, mirroring `MediaFileManager`, and avoid auto-creating session buckets (see Issue 11).

---

## 2. Unbounded in‑memory upload storage enables DoS

*Type:* Resource exhaustion · *Severity:* High · *Origin:* Analyst 2 #2 (validated)
Uploads are stored in RAM indefinitely with no per-session or global quota beyond Tornado’s single-request limit. Repeated uploads just under `server.maxUploadSize` can OOM the server.

```38:94:lib/streamlit/runtime/memory_uploaded_file_manager.py
self.file_storage: dict[str, dict[str, UploadedFileRec]] = defaultdict(dict)
...
self.file_storage[session_id][file.file_id] = file
```

✅ *Fix:* Track aggregate byte counts per session/server, reject uploads after thresholds, and evict least-recent files or spill to disk.

---

## 3. Upload delete endpoint lacks session validation

*Type:* Access control · *Severity:* High · *Origin:* Analyst 1 #4 (validated)
Unlike `PUT`, the `DELETE` handler never checks `_is_active_session`, so any party who learns a `session_id`/`file_id` can delete another user’s upload.

```144:158:lib/streamlit/web/server/upload_file_request_handler.py
session_id = self.path_kwargs["session_id"]
file_id = self.path_kwargs["file_id"]
self._file_mgr.remove_file(session_id=session_id, file_id=file_id)
```

✅ *Fix:* Reuse the session validation (and XSRF checks) from `put()` before performing the delete.

---

## 4. Upload handler parses full body before validation

*Type:* DoS bug · *Severity:* High · *Origin:* Analyst 2 #2 (validated)
`parse_body_arguments` loads the entire multipart request into memory before verifying the session ID, allowing attackers to waste CPU/RAM via invalid requests.

```90:118:lib/streamlit/web/server/upload_file_request_handler.py
tornado.httputil.parse_body_arguments(... self.request.body ...)
if not self._is_active_session(session_id):
    self.send_error(400, reason="Invalid session_id")
```

✅ *Fix:* Validate `session_id` up front and stream the body instead of buffering it.

---

## 5. Cache value locks leak memory

*Type:* Memory leak · *Severity:* Medium · *Origin:* Analyst 1 #2 (validated)
`Cache.compute_value_lock` stores a lock per cache key but never removes it when entries expire naturally.

```72:119:lib/streamlit/runtime/caching/cache_utils.py
self._value_locks: dict[str, threading.Lock] = defaultdict(threading.Lock)
...
with self._value_locks_lock:
    return self._value_locks[value_key]
```

✅ *Fix:* Delete locks after `write_result` or during TTL eviction to prevent unbounded growth.

---

## 6. Auto-generated cookie secret breaks multi-replica auth

*Type:* Security misconfiguration · *Severity:* Medium · *Origin:* Analyst 1 #3 (validated)
Each process memoizes a random `server.cookieSecret`, so replicas sign cookies with different keys.

```733:742:lib/streamlit/config.py
@_create_option("server.cookieSecret", ...)
def _server_cookie_secret() -> str:
    ...
    return secrets.token_hex()
```

✅ *Fix:* Log/raise when the secret is auto-generated outside dev mode, or require explicit configuration under `server.headless`.

---

## 7. `Secrets.__repr__` dumps entire secret values

*Type:* Info leak · *Severity:* High · *Origin:* Analyst 1 #5 (validated)
Calling `repr(st.secrets)` returns the full dictionary, which easily ends up in logs.

```495:504:lib/streamlit/runtime/secrets.py
if not runtime.exists():
    return f"{self.__class__.__name__}"
return repr(self._parse())
```

✅ *Fix:* Redact values (e.g., list keys only) or raise instead of returning contents.

---

## 8. Secrets directory parser allows symlink traversal

*Type:* Security bug · *Severity:* Medium · *Origin:* Analyst 1 #7 (validated)
`_parse_directory` trusts `os.listdir` results and follows any symlink, allowing secrets to escape their directory tree.

```277:321:lib/streamlit/runtime/secrets.py
for filename in os.listdir(sub_folder_path):
    file_path = os.path.join(sub_folder_path, filename)
    with open(file_path) as f:
        sub_secrets[filename] = f.read().strip()
```

✅ *Fix:* Resolve each path with `os.path.realpath` and ensure it remains within the allowed root.

---

## 9. App static file endpoint sets `Access-Control-Allow-Origin: *`

*Type:* Security misconfiguration · *Severity:* Medium · *Origin:* Analyst 1 #9 (validated)
All static files become world-readable—dangerous if users drop secrets under `static/`.

```85:93:lib/streamlit/web/server/app_static_file_handler.py
def set_default_headers(self) -> None:
    self.set_header("Access-Control-Allow-Origin", "*")
```

✅ *Fix:* Restrict origins to the embedding app or allow configuration/opt-out.

---

## 10. Media downloads also allow any origin

*Type:* Security misconfiguration · *Severity:* Medium · *Origin:* Analyst 1 (new validation)
`MediaFileHandler` mirrors the same CORS wildcard, exposing `st.download_button` assets cross-origin.

```46:81:lib/streamlit/web/server/media_file_handler.py
if allow_all_cross_origin_requests():
    self.set_header("Access-Control-Allow-Origin", "*")
```

✅ *Fix:* Enforce per-request origin validation, even when general CORS is disabled.

---

## 11. `defaultdict` creates orphaned sessions in upload manager

*Type:* Memory leak · *Severity:* Low · *Origin:* Analyst 1 #11 (validated)
Non-existent session lookups create empty dicts that are never cleared.

```38:67:lib/streamlit/runtime/memory_uploaded_file_manager.py
self.file_storage: dict[str, dict[str, UploadedFileRec]] = defaultdict(dict)
session_storage = self.file_storage[session_id]  # auto-creates
```

✅ *Fix:* Replace with `dict` + `.get(...)` so reads don’t mutate state.

---

## 12. HostCommunicationManager posts to `targetOrigin="*"`

*Type:* Security bug · *Severity:* High · *Origin:* Analyst 1 #6 (validated)
All host messages (rerun, stop, metrics) are broadcast to any embedding parent window.

```148:170:frontend/lib/src/hostComm/HostCommunicationManager.tsx
window.parent.postMessage({...}, "*")
```

✅ *Fix:* Remember the approved host origin (`allowedOrigins`) and use it as `targetOrigin`.

---

## 13. HostConfig default allowlist is overly broad

*Type:* Security bug · *Severity:* Medium · *Origin:* Analyst 1 #14 (validated)
Self-hosted apps trust every `https://*.streamlit.app`, `*.streamlit.run`, etc., by default.

```214:264:lib/streamlit/web/server/routes.py
_DEFAULT_ALLOWED_MESSAGE_ORIGINS = ["https://*.streamlitapp.com", ...]
```

✅ *Fix:* Default to the current host only, forcing admins to opt in to broader origins when embedding.

---

## 14. Disabling CORS disables WebSocket origin checks

*Type:* Security bug · *Severity:* High · *Origin:* Analyst 1 #10 + Analyst 2 #1 (validated)
`check_origin` returns `True` whenever `server.enableCORS` is false because `is_url_from_allowed_origins` does.

```80:82:lib/streamlit/web/server/browser_websocket_handler.py
return super().check_origin(origin) or is_url_from_allowed_origins(origin)
```

```64:76:lib/streamlit/web/server/server_util.py
if not config.get_option("server.enableCORS"):
    return True
```

✅ *Fix:* Always enforce origin checks for WebSockets irrespective of CORS mode.

---

## 15. Blocking external IP lookup in origin check

*Type:* DoS risk · *Severity:* High · *Origin:* Analyst 2 #1 (validated)
`is_url_from_allowed_origins` may call `net_util.get_external_ip`, which performs a blocking `requests.get` per handshake if `_external_ip` hasn’t been cached.

```34:63:lib/streamlit/net_util.py
response = _make_blocking_http_get(_AWS_CHECK_IP, timeout=5)
```

✅ *Fix:* Resolve external IP asynchronously during startup, with opt-out and sane timeouts/retries.

---

## 16. External IP service is hardcoded and always contacted

*Type:* Security/Compliance · *Severity:* Medium · *Origin:* Analyst 2 #7/#8 (validated)
Endpoints `_AWS_CHECK_IP`/`_AWS_CHECK_IP_HTTPS` are constants, so Streamlit phones home to AWS without user control.

```23:27:lib/streamlit/net_util.py
_AWS_CHECK_IP: Final = "http://checkip.amazonaws.com"
_AWS_CHECK_IP_HTTPS: Final = "https://checkip.amazonaws.com"
```

✅ *Fix:* Make this behavior configurable (and disabled by default in restricted environments).

---

## 17. MemoryMediaFileStorage has no locking or eviction

*Type:* Concurrency + DoS · *Severity:* High · *Origin:* Analyst 1 #4/#8 (validated)
`_files_by_id` is a plain dict mutated across threads and never shrinks; repeated downloads hold RAM forever.

```92:128:lib/streamlit/runtime/memory_media_file_storage.py
self._files_by_id: dict[str, MemoryFile] = {}
...
self._files_by_id[file_id] = media_file
```

✅ *Fix:* Guard with locks and add TTL/size-based pruning similar to cache storage.

---

## 18. MetricsManager persists untrusted telemetry URLs indefinitely

*Type:* Security bug · *Severity:* Medium · *Origin:* Analyst 1 #7 + Analyst 2 #6 (validated)
A single compromised response at `DEFAULT_METRICS_CONFIG` can write an arbitrary URL to localStorage and future metrics will POST to it.

```151:177:frontend/app/src/MetricsManager.ts
const cachedConfig = window.localStorage.getItem("stMetricsConfig")
...
const data = await response.json()
this.metricsUrl = data.url ?? undefined
window.localStorage.setItem("stMetricsConfig", this.metricsUrl)
```

✅ *Fix:* Pin to an allowlist/signed config, add TTL, and ignore cached entries older than N hours.

---

## 19. Metrics telemetry includes full URL, referrer, UA, and machine IDs

*Type:* Privacy · *Severity:* Medium · *Origin:* Analyst 1 #8 (validated)
Even when only basic metrics are desired, the client transmits exact URLs and both machine IDs, risking leakage of secrets in query strings.

```287:296:frontend/app/src/MetricsManager.ts
contextPageUrl: window.location.href
contextPageReferrer: document.referrer
contextPageSearch: window.location.search
...
machineIdV3/V4
```

✅ *Fix:* Strip query strings/referrers by default and make machine IDs opt-in.

---

## 20. Cookies written without `Secure`/`SameSite` flags

*Type:* Security bug · *Severity:* Medium · *Origin:* Analyst 1 #9 (validated)
`setCookie` (used by metrics anonymous ID) writes bare cookies that are sent on all cross-site requests and accessible to any script.

```377:386:frontend/lib/src/util/utils.ts
document.cookie = `${name}=${value};${expirationStr}path=/`
```

✅ *Fix:* Append `Secure; SameSite=Lax` by default and URL-encode the value to avoid header injection.

---

### Next Steps

1. Prioritize fixes with highest combined severity (1–5, 12–15, 17–20).
2. Add regression/unit tests where feasible (e.g., concurrent uploads, cache lock cleanup).
3. Document behavioral changes (CORS defaults, telemetry trimming) in release notes.
4. Plan follow-up refactors (async file I/O, sandboxed components) for longer-term resilience.
