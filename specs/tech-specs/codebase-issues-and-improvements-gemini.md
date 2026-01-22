# Codebase Issues and Improvements Plan

This document outlines the top 15 security vulnerabilities, bugs, and performance improvements identified in the Streamlit codebase. These findings focus on "under-the-hood" changes that do not require user-facing API modifications.

## 1. Blocking Event Loop in Origin Check (DoS Risk)

**Location:** `lib/streamlit/net_util.py`, `lib/streamlit/web/server/server_util.py`
**Description:**
The `is_url_from_allowed_origins` function, used by `BrowserWebSocketHandler.check_origin`, calls `net_util.get_external_ip`. If the cached IP (`_external_ip`) is not set, it makes a *blocking* HTTP request to `http://checkip.amazonaws.com` (and HTTPS fallback) using `requests.get` with a 5-second timeout.
**Impact:**
Since `check_origin` is called synchronously during the WebSocket handshake, a failure to connect to the external IP service (e.g., DNS issues, firewall, or service downtime) will block the entire Tornado event loop for up to 5 seconds per connection attempt. An attacker can exploit this to perform a Denial of Service (DoS) attack by initiating multiple connections with origins that trigger this check (i.e., not localhost).
**Proposed Fix:**

- Make `get_external_ip` asynchronous using Tornado's `AsyncHTTPClient`.
- Or, run the blocking check in a separate thread using `run_in_executor` and cache the result/promise.
- Ensure `check_origin` (which returns bool) handles the async nature or relies on a background task to pre-fetch the IP.

## 2. Unbounded Memory Usage in File Uploads (DoS Risk)

**Location:** `lib/streamlit/runtime/memory_uploaded_file_manager.py`, `lib/streamlit/web/server/upload_file_request_handler.py`
**Description:**
The `MemoryUploadedFileManager` stores all uploaded files in an in-memory dictionary (`self.file_storage`). While `UploadFileRequestHandler` may respect `server.maxUploadSize` for individual requests (via Tornado's `max_buffer_size`), there is **no limit on the total size** of files stored in memory across a session or the entire server.
**Impact:**
An attacker can upload multiple files (each just below the single-file limit) within a single session or across multiple sessions until the server runs out of memory (OOM) and crashes. This is a trivial DoS vector.
**Proposed Fix:**

- Implement a global and per-session memory limit for uploaded files.
- Enforce these limits in `MemoryUploadedFileManager.add_file`.
- Evict old files (LRU) or reject new uploads when limits are reached.

## 3. Unsafe Custom Component v2 Execution (Security Risk)

**Location:** `frontend/lib/src/components/widgets/BidiComponent/hooks/useHandleHtmlAndCssContent.ts`
**Description:**
The Custom Component v2 implementation injects HTML and JS provided by the component author directly into the DOM using `createContextualFragment` or `innerHTML`. The code explicitly states: *"Streamlit does not sanitize or validate this content"*.
**Impact:**
This allows for arbitrary JavaScript execution (XSS) in the context of the Streamlit app. While this might be "by design" for powerful components, it poses a significant risk if users install components from untrusted sources, as there is no sandboxing (unlike iframes used in v1 components).
**Proposed Fix:**

- Strictly document this risk.
- Consider enforcing iframe sandboxing by default for CCv2 or providing a "safe mode" that uses `DOMPurify` to strip scripts.
- At minimum, add a clear warning in the frontend console or UI when an unsandboxed component is loaded.

## 4. Blocking File I/O in Static File Serving (Performance)

**Location:** `lib/streamlit/web/server/component_request_handler.py`, `lib/streamlit/elements/html.py`
**Description:**
`ComponentRequestHandler.get` reads requested files using `with open(abspath, "rb") as file: contents = file.read()`. Similarly, `st.html` reads local files synchronously.
**Impact:**
These file operations block the main Tornado event loop. If the disk is slow or the file is large (e.g., a large image or video asset in a component), the entire server becomes unresponsive to other users during the read operation.
**Proposed Fix:**

- Use `aiofiles` for asynchronous file I/O.
- Or offload file reading to a thread pool using `loop.run_in_executor`.

## 5. Blocking File I/O in Cache Storage (Performance)

**Location:** `lib/streamlit/runtime/caching/storage/local_disk_cache_storage.py`
**Description:**
The `LocalDiskCacheStorage` uses synchronous `open` calls (via `streamlit_read` and `streamlit_write`) to read and write pickled cache objects to disk.
**Impact:**
Large cached objects (e.g., DataFrames) will block the server execution during read/write operations, causing latency spikes for all connected users.
**Proposed Fix:**

- Use asynchronous file operations for cache persistence.
- Implement a non-blocking cache backend.

## 6. Pickle Deserialization in Cache (Security/Defense in Depth)

**Location:** `lib/streamlit/runtime/caching/cache_data_api.py`
**Description:**
The caching mechanism relies on `pickle` to serialize and deserialize data. `pickle.loads` is unsafe when used on untrusted data.
**Impact:**
If an attacker gains write access to the server's filesystem (e.g., via a separate path traversal vulnerability or misconfigured permissions), they can poison the cache files. When the application tries to read the cache, the malicious pickle will execute arbitrary code (RCE).
**Proposed Fix:**

- Sign cache files with a secret key to verify integrity before unpickling.
- Or switch to a safer serialization format (e.g., Arrow/Parquet for dataframes, JSON for simple types) where possible.

## 7. Outbound Traffic / SSRF-lite (Privacy/Security)

**Location:** `lib/streamlit/net_util.py`
**Description:**
The `get_external_ip` function automatically makes outbound requests to `checkip.amazonaws.com`.
**Impact:**
This behavior might violate strict security policies in enterprise environments that forbid unauthorized outbound traffic. It also leaks the server's existence and IP to AWS.
**Proposed Fix:**

- Make this behavior opt-in or configurable via `server.headless` or a specific `server.enableExternalIPCheck` flag.
- Respect `NO_PROXY` environment variables.

## 8. Hardcoded External Service Dependencies (Maintainability)

**Location:** `lib/streamlit/net_util.py`
**Description:**
The URL `http://checkip.amazonaws.com` is hardcoded in the library.
**Impact:**
If this service goes down or changes, Streamlit's ability to determine its external IP fails (blocking the loop as noted in #1). Users cannot configure an alternative (e.g., an internal IP check service).
**Proposed Fix:**

- Move the URL to the configuration (`server.externalIPUrl`).

## 9. Missing Session Resource Limits (DoS Risk)

**Location:** `lib/streamlit/runtime/memory_uploaded_file_manager.py`
**Description:**
There is no limit on the *number* of files a single session can upload.
**Impact:**
A malicious user can upload thousands of small files, exhausting file descriptors (if stored on disk/temp) or causing overhead in the file manager structures, even if total size is managed.
**Proposed Fix:**

- Introduce `server.maxFilesPerSession` configuration option.

## 10. Potential XSFR/CORS Configuration Complexity (Security)

**Location:** `lib/streamlit/config.py`, `lib/streamlit/web/server/server.py`
**Description:**
The interaction between `server.enableXsrfProtection` and `server.enableCORS` involves implicit overrides (e.g., enabling CORS forces XSRF protection logic to behave differently or be disabled in some contexts).
**Impact:**
This complexity increases the risk of misconfiguration, potentially leaving the app vulnerable to Cross-Site Request Forgery (CSRF) or unauthorized Cross-Origin Resource Sharing.
**Proposed Fix:**

- Simplify the logic and provide clear warnings if an insecure combination is chosen.
- Ensure XSRF tokens are always checked for state-changing requests (PUT, POST, DELETE), regardless of CORS settings, unless explicitly disabled.

## 11. Synchronous Script Loading (Performance)

**Location:** `lib/streamlit/runtime/scriptrunner/script_cache.py`
**Description:**
`ScriptCache` uses `open_python_file` (synchronous open) to read the user's script.
**Impact:**
For large scripts or slow filesystems (e.g., network mounts), this blocks the server reload cycle.
**Proposed Fix:**

- Use async I/O to read the script file before compiling.

## 12. Inefficient Protobuf Serialization (Performance)

**Location:** `lib/streamlit/web/server/browser_websocket_handler.py`
**Description:**
Streamlit uses the Python implementation of Protocol Buffers, which can be slow for large messages (e.g., large tables/charts).
**Impact:**
High CPU usage and latency when sending large datasets to the frontend.
**Proposed Fix:**

- Ensure the C++ implementation of Protobuf (`google-protobuf` wheel) is used if available.
- Explore Zero-Copy serialization methods (e.g., using Apache Arrow IPC) to send dataframes directly without Protobuf wrapping overhead for the data payload.

## 13. Redundant Computations in HTML Sanitization (Performance)

**Location:** `frontend/lib/src/components/elements/Html/SanitizedHtml.tsx`
**Description:**
`sanitizeHtmlString` is memoized, but `dompurify` sanitization can be CPU intensive. If the `body` prop changes frequently (e.g., in an animation), this runs on the main thread.
**Impact:**
Jank in the frontend UI.
**Proposed Fix:**

- Offload sanitization to a Web Worker if possible, or optimize update frequency.

## 14. Regex Performance (Performance/DoS)

**Location:** `lib/streamlit/runtime/connection_factory.py`
**Description:**
`_MODULE_EXTRACTION_REGEX` relies on parsing exception messages (`No module named '...'`).
**Impact:**
Exception message formats can change between Python versions, making this fragile. Regex matching on arbitrary error strings can be slow.
**Proposed Fix:**

- Use structural error handling (inspecting `ImportError.name`) instead of regex parsing.

## 15. Lack of Architecture for Async File Operations (Architecture)

**Location:** Entire codebase
**Description:**
The codebase heavily relies on synchronous file APIs (`open`, `os.path`, `shutil`) mixed within `async` Tornado handlers.
**Impact:**
This is a systemic architectural weakness that prevents Streamlit from scaling efficiently under high I/O load.
**Proposed Fix:**

- Introduce a codebase-wide `FileSystem` abstraction that defaults to async implementations (using thread pools or `aiofiles`) to standardize non-blocking I/O.
