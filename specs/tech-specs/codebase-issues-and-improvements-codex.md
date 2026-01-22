# Codebase Issues and Improvements

Below are the top 15 under-the-hood security, correctness, and performance opportunities identified in the current Streamlit repo. Each item includes concrete evidence and a low-effort remediation direction.

## 1. MemoryUploadedFileManager keeps unbounded per-session blobs in RAM

- **Risk**: Every upload is held in `self.file_storage` without size/entry limits. A client can exhaust server RAM by uploading many large files or by never calling `remove_session_files`.
- **Evidence**:

```33:99:lib/streamlit/runtime/memory_uploaded_file_manager.py
class MemoryUploadedFileManager(UploadedFileManager):
    """Holds files uploaded by users of the running Streamlit app.
    This class can be used safely from multiple threads simultaneously.
    """

    def __init__(self, upload_endpoint: str) -> None:
        self.file_storage: dict[str, dict[str, UploadedFileRec]] = defaultdict(dict)
        ...

    def add_file(
        self,
        session_id: str,
        file: UploadedFileRec,
    ) -> None:
        ...
        self.file_storage[session_id][file.file_id] = file
```

- **Improvement**: Enforce `server.maxUploadSize` per session, cap total bytes per session, and evict/stream to disk for large files. Consider replacing the plain dict with an LRU capped by memory and respecting concurrent access via locks.

## 2. UploadFileRequestHandler parses entire multipart payloads before validating sessions or limits

- **Risk**: `parse_body_arguments` loads the whole request body (potentially hundreds of MBs) into memory before even checking whether the `session_id` is valid. Attackers can force Tornado to deserialize massive payloads repeatedly for invalid sessions, leading to CPU/RAM spikes.
- **Evidence**:

```90:142:lib/streamlit/web/server/upload_file_request_handler.py
        tornado.httputil.parse_body_arguments(
            content_type=self.request.headers["Content-Type"],
            body=self.request.body,
            arguments=args,
            files=files,
        )

        try:
            if not self._is_active_session(session_id):
                self.send_error(400, reason="Invalid session_id")
                return
        except Exception as ex:
            self.send_error(400, reason=str(ex))
            return
```

- **Improvement**: Reject invalid or inactive sessions before ingesting the body, stream uploads to disk instead of buffering, and enforce per-request file-count/size limits using Tornado’s streaming API.

## 3. Upload delete endpoint lacks session validation or XSRF protections

- **Risk**: `DELETE /_stcore/upload_file/<session>/<file>` blindly removes any file in memory without checking that the session is still active or owned by the caller. Anyone who learns a session UUID can delete uploads for that user.
- **Evidence**:

```144:158:lib/streamlit/web/server/upload_file_request_handler.py
    def delete(self, **kwargs: Any) -> None:
        ...
        session_id = self.path_kwargs["session_id"]
        file_id = self.path_kwargs["file_id"]

        self._file_mgr.remove_file(session_id=session_id, file_id=file_id)
        self.set_status(204)
```

- **Improvement**: Reuse `_is_active_session`, enforce XSRF tokens when `server.enableXsrfProtection` is true, and ensure only the owning WebSocket can request deletion.

## 4. MemoryMediaFileStorage has no eviction and is accessed without synchronization

- **Risk**: `_files_by_id` grows indefinitely and is mutated from multiple threads without locking. Tornado’s `MediaFileHandler` reads the dict concurrently, risking races (`KeyError`, stale reads) and unlimited memory growth for `st.image`/`st.download_button` payloads.
- **Evidence**:

```92:182:lib/streamlit/runtime/memory_media_file_storage.py
class MemoryMediaFileStorage(MediaFileStorage, CacheStatsProvider):
    def __init__(self, media_endpoint: str) -> None:
        self._files_by_id: dict[str, MemoryFile] = {}
        ...

    def load_and_get_id(...):
        ...
        if file_id not in self._files_by_id:
            self._files_by_id[file_id] = media_file

    def get_file(self, filename: str) -> MemoryFile:
        file_id = os.path.splitext(filename)[0]
        return self._files_by_id[file_id]
```

```121:148:lib/streamlit/web/server/media_file_handler.py
    @classmethod
    def get_content(
        cls, abspath: str, start: int | None = None, end: int | None = None
    ) -> Any:
        ...
        media_file = cls._storage.get_file(abspath)
        ...
        return media_file.content[start:end]
```

- **Improvement**: Add a lock (or wrap storage with thread-safe primitives) and introduce configurable TTL/size limits so orphaned files are evicted without waiting for manual cleanup.

## 5. Download endpoint permits cross-origin reads of user data

- **Risk**: `MediaFileHandler.set_default_headers` returns `Access-Control-Allow-Origin: *` whenever CORS is globally relaxed, letting any origin fetch `st.download_button` outputs or uploaded media.
- **Evidence**:

```46:80:lib/streamlit/web/server/media_file_handler.py
    def set_default_headers(self) -> None:
        if allow_all_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        elif is_allowed_origin(origin := self.request.headers.get("Origin")):
            self.set_header("Access-Control-Allow-Origin", cast("str", origin))
```

- **Improvement**: Always scope the header to the requesting origin and only allow credentials for trusted origins, even when `server.enableCORS` is false.

## 6. HostCommunicationManager posts sensitive guest events to any parent origin

- **Risk**: `sendMessageToHost` uses `postMessage(..., "*")`, so embedding pages from any domain receive app metadata, widget payloads, and metrics—even if `allowedOrigins` never approved that host.
- **Evidence**:

```163:170:frontend/lib/src/hostComm/HostCommunicationManager.tsx
  public sendMessageToHost = (message: IGuestToHostMessage): void => {
    window.parent.postMessage(
      {
        stCommVersion: HOST_COMM_VERSION,
        ...message,
      } as VersionedMessage<IGuestToHostMessage>,
      "*"
    )
  }
```

- **Improvement**: Track the selected host origin from the `allowedOrigins` handshake and use it as `targetOrigin`, rejecting unknown parents.

## 7. MetricsManager persists remote metrics URLs without integrity or expiry

- **Risk**: The fallback fetches `https://data.streamlit.io/metrics.json`, trusts `data.url`, and stores it permanently in localStorage. A single MITM or compromised response can redirect telemetry forever.
- **Evidence**:

```151:179:frontend/app/src/MetricsManager.ts
  private async requestDefaultMetricsConfig(): Promise<any> {
    const isLocalStoreAvailable = localStorageAvailable()
    if (isLocalStoreAvailable) {
      const cachedConfig = window.localStorage.getItem("stMetricsConfig")
      if (cachedConfig) {
        this.metricsUrl = cachedConfig
        return
      }
    }
    ...
        const data = await response.json()
        this.metricsUrl = data.url ?? undefined
        if (isLocalStoreAvailable && this.metricsUrl) {
          window.localStorage.setItem("stMetricsConfig", this.metricsUrl)
        }
```

- **Improvement**: Ship a signed config, validate against an allowlist, and add TTL/ETag checks so stale or tampered URLs are discarded.

## 8. Telemetry includes full URL, referrer, UA, and machine IDs by default

- **Risk**: When `browser.gatherUsageStats` is true, every event includes the user’s full URL (with query params), referrer, locale, user-agent, and both machine IDs—risking leakage of secrets in query strings or host-specific data.
- **Evidence**:

```287:295:frontend/app/src/MetricsManager.ts
  private getContextData(): Partial<IMetricsEvent> {
    return {
      contextPageUrl: window.location.href,
      contextPageTitle: document.title,
      contextPagePath: window.location.pathname,
      contextPageReferrer: document.referrer,
      contextPageSearch: window.location.search,
      contextLocale: window.navigator.language,
      contextUserAgent: window.navigator.userAgent,
    }
  }
```

- **Improvement**: Strip query strings by default, hash referrers, and gate machine IDs/context via a separate opt-in flag.

## 9. Client-side cookies lack Secure/SameSite attributes

- **Risk**: `setCookie` writes raw `document.cookie = "<name>=<value>;path=/"`, so the `ajs_anonymous_id` cookie used for metrics is readable by any script and sent with every cross-site request, making it vulnerable to CSRF and theft.
- **Evidence**:

```377:386:frontend/lib/src/util/utils.ts
export function setCookie(
  name: string,
  value?: string,
  expiration?: Date
): void {
  const expirationDate = value ? expiration : new Date()
  const expirationStr: string = expirationDate
    ? `expires=${expirationDate.toUTCString()};`
    : ""
  document.cookie = `${name}=${value};${expirationStr}path=/`
}
```

- **Improvement**: Append `Secure;SameSite=Lax` (or `Strict` for auth cookies) and URL-encode values to stop injection.

## 10. Disabling CORS also disables WebSocket origin validation

- **Risk**: `BrowserWebSocketHandler.check_origin` delegates to `is_url_from_allowed_origins`, which returns `True` for all origins when `server.enableCORS` is false. Any website can open a WebSocket to the backend whenever CORS is disabled, leading to full session hijack.
- **Evidence**:

```80:83:lib/streamlit/web/server/browser_websocket_handler.py
    def check_origin(self, origin: str) -> bool:
        """Set up CORS."""
        return super().check_origin(origin) or is_url_from_allowed_origins(origin)
```

```64:76:lib/streamlit/web/server/server_util.py
def is_url_from_allowed_origins(url: str) -> bool:
    ...
    if not config.get_option("server.enableCORS"):
        # Allow everything when CORS is disabled.
        return True
```

- **Improvement**: Always verify WebSocket origins against an allowlist, independent of CORS, and require XSRF tokens for the upgrade.

## 11. No Content-Security-Policy headers are emitted

- **Risk**: None of the Tornado handlers set CSP, so any injected script/style will run. This makes the default deployment susceptible to XSS and component injection.
- **Evidence**:

```130:139:lib/streamlit/web/server/routes.py
class _SpecialRequestHandler(tornado.web.RequestHandler):
    def set_default_headers(self) -> None:
        self.set_header("Cache-Control", "no-cache")
        if allow_all_cross_origin_requests():
            self.set_header("Access-Control-Allow-Origin", "*")
        elif is_allowed_origin(origin := self.request.headers.get("Origin")):
            self.set_header("Access-Control-Allow-Origin", cast("str", origin))
```

- **Improvement**: Add a centralized CSP (e.g., `default-src 'self'; img-src data: https: ...`) configurable via `server.contentSecurityPolicy`.

## 12. HTTPS responses never set Strict-Transport-Security

- **Risk**: Even when TLS is enabled, there’s no HSTS header, so browsers can downgrade to HTTP after a single MITM trigger.
- **Evidence**: Same `_SpecialRequestHandler.set_default_headers` snippet above shows the only default headers are Cache-Control and CORS—no HSTS anywhere in the server stack.
- **Improvement**: When `server.sslCertFile` is set, emit `Strict-Transport-Security: max-age=...; includeSubDomains`.

## 13. No clickjacking protection (X-Frame-Options / frame-ancestors)

- **Risk**: The server never sets `X-Frame-Options` or CSP `frame-ancestors`, so apps can be iframed by malicious sites that overlay UI controls.
- **Evidence**: `_SpecialRequestHandler.set_default_headers` (see Issue 11) lists all default headers—none constrain framing.
- **Improvement**: Add `X-Frame-Options: SAMEORIGIN` (or a CSP `frame-ancestors` list matching HostConfig) with an override when embedding is intentionally allowed.

## 14. HostConfigHandler ships a broad default postMessage allowlist without tenant scoping

- **Risk**: Every self-hosted app advertises that it will trust postMessages from any `https://*.streamlit.app`, `*.streamlit.run`, etc. Attackers controlling a subdomain under those wildcards (or able to register one) can impersonate the host and send privileged commands (`STOP_SCRIPT`, `SET_METADATA`).
- **Evidence**:

```214:264:lib/streamlit/web/server/routes.py
_DEFAULT_ALLOWED_MESSAGE_ORIGINS = [
    "https://*.streamlitapp.com",
    ...
    "https://*.streamlit.app",
]

class HostConfigHandler(_SpecialRequestHandler):
    def initialize(self) -> None:
        self._allowed_origins = _DEFAULT_ALLOWED_MESSAGE_ORIGINS.copy()
        ...
    async def get(self) -> None:
        self.write({"allowedOrigins": self._allowed_origins, ...})
```

- **Improvement**: Scope the allowlist to the actual host (or require an explicit `host_config` override) so OSS deployments don’t trust Streamlit Cloud domains by default.

## 15. MetricsManager pendingEvents queue is unbounded

- **Risk**: Before initialization or if `sessionInfo` never becomes ready, every `enqueue` pushes onto `pendingEvents` with no cap. A busy app can accumulate thousands of serialized events, causing memory bloat and eventual UI pause when flushed.
- **Evidence**:

```115:132:frontend/app/src/MetricsManager.ts
  public enqueue(
    evName: EventName,
    evData: Partial<IMetricsEvent> = {}
  ): void {
    if (!this.initialized || !this.sessionInfo.isSet) {
      this.pendingEvents.push([evName, evData])
      return
    }
    ...
    if (this.pendingEvents.length) {
      this.sendPendingEvents()
    }
```

- **Improvement**: Limit the queue (e.g., 100 events), drop oldest entries with a warning, and flush on timers so instrumentation can’t wedge the page.
