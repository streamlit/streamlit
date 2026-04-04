# Starlette Performance Optimization Plan

## Executive Summary

The migration from Tornado to Starlette/Uvicorn introduces significant performance regressions across all load test scenarios with 80 concurrent users:

| Metric | Tornado (baseline) | Starlette (current) | Regression |
|--------|-------------------|---------------------|------------|
| **Memory avg (simple_app)** | 121 MB | 333 MB | **2.8x** |
| **Memory peak (simple_app)** | 130 MB | 417 MB | **3.2x** |
| **Thread count max (simple_app)** | 10 | 48 | **4.8x** |
| **Initial load p50 (simple_app)** | 12,777 ms | 15,270 ms | **+19.5%** |
| **Initial load p50 (fragment_app)** | 13,389 ms | 23,699 ms | **+77%** |
| **Initial load p50 (caching_app)** | 13,608 ms | 19,681 ms | **+44.6%** |
| **Rerun p99 (widget_heavy_app)** | 400 ms | 1,511 ms | **3.8x** |

The regressions are primarily caused by:
1. **AnyIO threadpool contention**: Starlette delegates file lookup/open/read work to AnyIO's default thread limiter (40 tokens by default). This is confirmed in the current codepath and is a strong explanation for the 48 max threads (vs 10 in Tornado) and the initial-load queuing under 80 concurrent users.
2. **Slower initial page loads** that cascade into higher concurrent session counts, higher memory, and more threads.
3. **Global middleware overhead** on every HTTP request, especially static asset requests that do not appear to need `SessionMiddleware`.
4. **Environment drift risk**: if `httptools` or `uvloop` are unavailable, Uvicorn can silently fall back to slower implementations. In this branch, `httptools` is already a required dependency, so this is primarily a correctness/benchmarking guardrail rather than the top code optimization.

## Validation update

Validation against the current repo changed the prioritization in a few important ways:

- `httptools` is already a required dependency in `lib/pyproject.toml`, so recommendations about it should be treated as **startup assertions / benchmark guardrails**, not as the main product-side optimization.
- `SessionMiddleware` is still installed globally, but the codebase appears to rely on it only for the OAuth/auth flow. That makes selective scoping promising, but narrower than the original plan implied.
- The AnyIO default thread limiter really is `40`, and the current static-file path does go through `StaticFiles.lookup_path`, `FileResponse`, `anyio.open_file`, and async file reads, so the threadpool contention hypothesis is well grounded.
- The runtime hot loop still has both the per-message `await asyncio.sleep(0)` and the `await asyncio.sleep(0.01)` inter-flush delay, so that optimization remains valid.
- `uvicorn limit_concurrency` is **not** backpressure in the queuing sense; it sheds load by serving `503 Service Unavailable` once the limit is exceeded. That makes it a safety knob, not a general latency optimization.
- Route-count savings look smaller than originally stated. The current app creates roughly 18 internal routes before the production static mount, so routing is likely secondary to file I/O and middleware costs.
- Eliminating the WebSocket sender task is much riskier than originally framed because the queue currently provides ordering isolation and backpressure.

### Follow-up local benchmark update

A second local benchmark round narrowed the conclusions further:

- Splitting the original "skip middleware for static files" experiment showed that the win came from **bypassing `GZipMiddleware` for static assets**, not from bypassing `SessionMiddleware`. A session-only static bypass regressed badly on both `simple_app` and `caching_app`, while a gzip-only static bypass improved load p50 by **44.4%** on `simple_app` and **19.4%** on `caching_app`, with peak RSS improving by roughly **16-18%** in both.
- Combining the full static bypass with a tighter AnyIO limiter produced the best local balance at **`N=28`**. That variant improved load p50 on `simple_app`, `caching_app`, and `widget_heavy_app` while keeping rerun regressions small enough to remain plausible. `N=24` over-optimized for thread reduction and hurt rerun behavior; `N=32` remained good, but `N=28` was the strongest overall compromise.
- A safer **batched sender-task** variant performed much better than the earlier direct-send experiment, but only on message-heavy workloads. It improved `many_messages_app` load p50 by **29.1%** and rerun p99 by **64.5%**, while regressing `widget_heavy_app`. That makes it a scenario-specific optimization, not a broad default.
- A follow-up **send queue matrix** (`50`, `100`, `200`, `300`, `500`, `750`, `1000`) showed that queue size is still not a primary memory lever. Most peak-RSS changes stayed within a few percent. If optimizing only for message-heavy workloads, `100` looked strongest; if choosing a single global compromise, `1000` was the least risky promising value because it helped `many_messages_app`, still improved `widget_heavy_app` rerun p99, and did not meaningfully damage `fragment_app`. This is still secondary to the gzip/static-path optimization.
- `websockets-sansio`, `wsproto`, send-queue reduction, and the direct-send/no-queue WebSocket path remain de-prioritized after measurement. `wsproto` was locally unstable, and the combined quick-wins bundle still failed `widget_heavy_app`.

## Regression Analysis

### Why Memory Is 2-3x Higher

The peak memory consistently hits ~410-420 MB across ALL Starlette scenarios, compared to ~130 MB for Tornado on simple workloads. This ~287 MB difference with 80 connections translates to ~3.6 MB additional overhead per active connection.

**Sources of per-connection overhead (measured)**:

| Component | Per-connection | 80 connections |
|-----------|---------------|----------------|
| `asyncio.Queue(maxsize=500)` | ~3.3 KB | 261 KB |
| `StarletteClientContext` (headers, cookies) | ~15 KB | 1.2 MB |
| `websockets` library connection state | ~100-200 KB | 8-16 MB |
| Sender `asyncio.Task` per connection | ~2 KB | 160 KB |
| **Subtotal (Streamlit layer)** | **~220 KB** | **~17 MB** |

But measured peak difference is ~287 MB — far more than what the direct per-connection overhead explains. The remaining ~270 MB is explained by a **cascade effect**: Starlette serves initial loads 20-77% slower, which means more sessions are active simultaneously, each consuming ~3.5 MB of baseline Streamlit runtime memory (ScriptRunner thread stack, SessionState, protobuf buffers, etc.).

### Why Initial Load Is 20-77% Slower

The initial load involves: serving static files (index.html, JS bundles, CSS) → WebSocket handshake → first script run → forward messages to client.

Steps 3-4 use the same Streamlit Runtime code, so the regression must come from steps 1-2. Key differences:

1. **AnyIO threadpool contention (biggest factor)**: Starlette's `StaticFiles` and `FileResponse` use `anyio.to_thread.run_sync()` for filesystem operations. Each static file request requires multiple threadpool interactions (lookup, open, and one or more reads). With 80 concurrent browsers requesting ~15-20 assets each, all contending on a **40-token thread limiter**, the threadpool becomes saturated. Tornado served files directly from the I/O loop with no threadpool.
2. **Middleware stack on every static file request**: Each HTTP request traverses:
   - `PathSecurityMiddleware` — string checks (~1 µs)
   - `SessionMiddleware` — cookie parsing, HMAC signing, Set-Cookie header (~50-100 µs)
   - `MediaAwareGZipMiddleware` — creates new `GZipResponder` per request (~35 µs for object creation alone, plus gzip compression)
3. **Starlette routing**: Sequential route matching through roughly 18 internal routes plus the production static mount (O(n))
4. **HTTP parser**: If `httptools` is missing in any environment, Uvicorn silently falls back to the pure-Python `h11` parser, which was locally validated to cause a **55.8% initial load regression** (3,402 ms → 1,504 ms after installing httptools)
5. **The `websockets` library handshake**: More complex than Tornado's built-in WebSocket

### Why Thread Count Is 4-5x Higher

**Primary cause: AnyIO default thread limiter (40 tokens).** Starlette delegates filesystem work to a threadpool via `anyio.to_thread.run_sync()`. This includes `StaticFiles.lookup_path`, `FileResponse`, and `anyio.open_file`, which together create multiple threadpool interactions per static file request.

With 80 concurrent users loading 15-20 static assets each, the 40-token thread limiter saturates immediately:

| Thread source | Tornado | Starlette |
|---------------|---------|-----------|
| AnyIO file-serving threadpool | 0 | **up to 40** |
| ScriptRunner threads (concurrent) | ~10 | ~8 |
| **Total observed** | **10** | **48** |

The AnyIO limiter directly explains the 48 max threads seen in the simple_app benchmark. This also creates **massive contention**: 1,200+ static file requests funneling through a 40-thread pool with 8 hops each means each request queues behind others, compounding the initial load latency.

Secondary effect: slower initial loads cause more sessions to overlap temporally, further increasing peak concurrent ScriptRunner threads.

---

## Top 22 Optimization Recommendations

### 1. Scope SessionMiddleware to Auth Routes Only

**Impact: HIGH (latency + some memory) | Effort: LOW-MEDIUM**

The current app installs `SessionMiddleware` globally, but the codebase only appears to rely on it for the auth flow (`client.authorize_redirect(request, ...)` in `starlette_auth_routes.py`). Static assets and the WebSocket endpoint do not appear to use `scope["session"]`. That makes selective scoping a credible optimization, but it should be framed as "auth routes only" rather than "auth plus upload".

**Implementation**: Create a scope-aware wrapper that bypasses `SessionMiddleware` for non-API paths:

```python
class SelectiveSessionMiddleware:
    """Only apply session middleware to routes that need it (auth)."""

    def __init__(self, app: ASGIApp, session_app: ASGIApp) -> None:
        self.app = app
        self.session_app = session_app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Only apply sessions to auth-related routes
        if path.startswith("/auth/") or path.startswith("/oauth2callback"):
            await self.session_app(scope, receive, send)
        else:
            await self.app(scope, receive, send)
```

**Expected improvement**: Probably smaller than originally assumed. Follow-up local benchmarks showed that a **session-only static bypass regressed** both `simple_app` and `caching_app`, so session scoping should no longer be treated as the leading explanation for the earlier middleware win.

**Measurement**: Compare initial load times with middleware enabled vs bypassed for static routes.

---

### 2. Benchmark Alternative WebSocket Backends (`websockets-sansio` First, `wsproto` Second)

**Impact: MEDIUM-HIGH (memory + handshake latency) | Effort: LOW**

Uvicorn is currently configured with `ws="auto"`, which selects the classic `websockets` implementation because that dependency is installed. This is a valid area to benchmark, but the safest next step is to compare the available backends in order:

1. `websockets-sansio` (already supported by the current Uvicorn version, with no new dependency)
2. `wsproto` (requires an additional dependency and more compatibility validation)

**Implementation**: Start by changing the uvicorn config for controlled benchmarks:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    return {
        ...
        "ws": "websockets-sansio",  # benchmark first
        ...
    }
```

If `websockets-sansio` is promising but still too heavy, then benchmark `wsproto` as a second step.

**Expected improvement**: Unclear without measurement in Streamlit's workload. Treat this as a benchmark item, not a guaranteed win.

**Measurement**: Run the simple_app load test and compare `memory_rss_mb_peak` and connect timing across `ws="websockets"`, `ws="websockets-sansio"`, and `ws="wsproto"`.

**Risk**: `wsproto` may have slightly different WebSocket behavior. Needs thorough e2e testing.

---

### 3. Reduce WebSocket Send Queue Size

**Impact: MEDIUM (memory) | Effort: LOW**

`WEBSOCKET_MAX_SEND_QUEUE_SIZE = 500` means each client can buffer up to 500 unsent messages. With Streamlit's protobuf messages averaging 1-50 KB, this worst-case allows 500 × 50 KB × 80 clients = **2 GB** of queued messages.

**Implementation**: Reduce to a much smaller value:

```python
# In starlette_server_config.py:
WEBSOCKET_MAX_SEND_QUEUE_SIZE: Final = 50  # was 500
```

Rationale: The queue exists only to bridge sync `write_forward_msg` to async WebSocket sends. Under normal conditions, the queue drains continuously. A queue of 50 provides ample buffering while limiting worst-case memory. A stuck client with 50 messages at 50 KB = 2.5 MB (vs 25 MB at 500).

**Expected improvement**: Reduces worst-case memory footprint by 10x, with no impact on normal operation.

**Measurement**: Monitor queue depths during load tests (add a gauge metric for `_send_queue.qsize()`). Verify no `SessionClientDisconnectedError` from `QueueFull` in logs.

---

### 4. Verify uvloop Activation in Benchmarks; Do Not Promote It Yet

**Impact: LOW by itself, HIGH for benchmark correctness | Effort: LOW**

`uvloop` is available in the current development environment and `_maybe_install_uvloop()` is already called by bootstrap when Streamlit creates its own event loop. That makes this primarily a **verification and logging** task for benchmarks. Promoting `uvloop` to a core dependency would be a packaging decision, not just a performance tweak.

**Implementation**:

1. **Verify uvloop is actually activated** by adding logging:
```python
# In bootstrap.py, after uvloop.install():
import asyncio
loop = asyncio.new_event_loop()
_LOGGER.info("Event loop type: %s", type(loop).__name__)
loop.close()
```

2. **Only consider making uvloop a core dependency after proving a real-world gap**:
```toml
# In lib/pyproject.toml dependencies:
"uvloop>=0.15.2; sys_platform != 'win32' and sys_platform != 'cygwin' and platform_python_implementation != 'PyPy'",
```

**Expected improvement**: None if it is already active, which is likely for the CLI/server path.

**Measurement**: Add the event loop type to load test output. Compare benchmarks with/without uvloop.

---

### 5. Lazy GZip Buffer Initialization

**Impact: MEDIUM (latency) | Effort: LOW**

Our profiling shows `GZipResponder` creation costs **35 µs/object** (100x more than `IdentityResponder` at 0.3 µs). A new `GZipResponder` is created for every HTTP request where the client supports gzip. With 80 users loading 15-20 static assets each, that's ~56 ms of cumulative GZip object creation overhead.

**Implementation**: Defer gzip buffer allocation until the response body is actually being compressed:

```python
class _LazyGZipResponder(GZipResponder):
    """Defers gzip.GzipFile creation until first write."""

    def __init__(self, app, minimum_size, compresslevel=9):
        # Skip parent's __init__ gzip buffer allocation
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel
        self.initial_message = {}
        self.started = False
        self.content_encoding_set = False
        self.content_type_is_excluded = False
        self._gzip_initialized = False
        # ... only create gzip_file when first body chunk arrives
```

Alternatively, cache and reuse gzip compressor objects.

**Expected improvement**: ~35 µs saved per HTTP request (noticeable at 1,000+ requests).

**Measurement**: Profile `MediaAwareGZipMiddleware.__call__` before and after.

---

### 6. Pre-compress Static Assets

**Impact: MEDIUM-HIGH (latency + CPU) | Effort: MEDIUM**

Streamlit's JS/CSS bundles are served through `StaticFiles` and compressed on-the-fly by GZipMiddleware on every request. Since these assets are immutable (content-hashed filenames), they should be pre-compressed at build time.

**Implementation**:

1. During `make frontend-fast`, generate `.gz` versions of all assets.
2. Serve pre-compressed files when `Accept-Encoding: gzip` is present:
```python
class PreCompressedStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        # Check for .gz version first
        headers = Headers(scope=scope)
        if "gzip" in headers.get("Accept-Encoding", ""):
            gz_path = path + ".gz"
            if os.path.exists(os.path.join(self.directory, gz_path)):
                response = FileResponse(gz_path)
                response.headers["Content-Encoding"] = "gzip"
                return response
        return await super().get_response(path, scope)
```

3. Skip GZipMiddleware for requests served with pre-compressed files.

**Expected improvement**: Eliminates CPU cost of compressing static assets (level 6 gzip is expensive). Could save 50-100 ms on initial page load under high concurrency.

**Measurement**: Compare CPU usage and initial load times with pre-compressed vs on-the-fly compression.

---

### 7. Eliminate Per-Message `asyncio.sleep(0)` in Runtime Loop

**Impact: MEDIUM (latency) | Effort: LOW**

In the runtime's `_loop_coroutine`, there's an `await asyncio.sleep(0)` after each message send and an `await asyncio.sleep(0.01)` between flush cycles:

```python
for msg in msg_list:
    self._send_message(active_session_info, msg)
    await asyncio.sleep(0)  # Yield after every message
await asyncio.sleep(0.01)  # 10ms between flush cycles
```

For 80 sessions, each producing 5-10 messages per script run, that's 400-800 `await asyncio.sleep(0)` calls plus 80× 10 ms sleeps = 800 ms of built-in latency per flush cycle.

**Implementation**: Batch messages per session and reduce the yield frequency:

```python
for active_session_info in self._session_mgr.list_active_sessions():
    msg_list = active_session_info.session.flush_browser_queue()
    for msg in msg_list:
        try:
            self._send_message(active_session_info, msg)
        except SessionClientDisconnectedError:
            self._session_mgr.disconnect_session(
                active_session_info.session.id
            )
            break

    # Yield once per session instead of once per message
    await asyncio.sleep(0)

# Reduce inter-flush sleep from 10ms to 1ms
await asyncio.sleep(0.001)
```

**Expected improvement**: Lower p99 rerun latency, especially for widget_heavy_app (which has many messages). The widget_heavy_app p99 rerun went from 400 ms (Tornado) to 1,511 ms (Starlette) — this optimization could help close that gap.

**Measurement**: Compare rerun_time_ms p95/p99 before and after.

---

### 8. Set Uvicorn `limit_concurrency`

**Impact: LOW-MEDIUM (load shedding / stability) | Effort: LOW**

This setting is useful as a protection knob, but it does **not** provide request queuing/backpressure. In current Uvicorn it serves `503 Service Unavailable` once the limit is exceeded. That can be useful for capacity protection, but it should not be treated as a free latency or memory optimization for the benchmark itself.

**Implementation**:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    return {
        ...
        "limit_concurrency": 200,  # Max concurrent connections
        ...
    }
```

Setting this to a reasonable value (e.g. `200`) can protect the process from overload, but it changes behavior under load and may invalidate apples-to-apples benchmark comparisons.

**Expected improvement**: Better overload behavior, not necessarily faster or lower-memory successful requests.

**Measurement**: Compare memory_rss_mb_peak with and without limit_concurrency.

---

### 9. Optimize Starlette Route Configuration

**Impact: LOW (latency) | Effort: LOW**

The current route setup does create duplicate `Route` objects for different HTTP methods on the same path, but the current route count is smaller than originally stated: roughly 18 internal routes before the production static mount. That still creates some unnecessary matching work, but it is likely a second-order effect compared with file I/O and middleware.

**Implementation**: Consolidate routes with multiple methods:

```python
# Before: 2 separate routes
Route("/_stcore/health", _health_endpoint, methods=["GET", "HEAD"]),
Route("/_stcore/health", _health_options, methods=["OPTIONS"]),

# After: 1 route with method dispatch
Route("/_stcore/health", _health_handler, methods=["GET", "HEAD", "OPTIONS"]),
```

And ensure the most frequently hit routes (static assets, WebSocket) are listed first.

**Expected improvement**: Small. Worth doing only after confirming routing shows up in profiling.

**Measurement**: Profile route matching time with timing middleware.

---

### 10. Add `timeout_keep_alive` to Uvicorn Config

**Impact: LOW | Effort: LOW**

Uvicorn already defaults to `timeout_keep_alive=5`. Making that explicit does not improve performance by itself. Lowering it for synthetic load tests could reduce connection retention, but may also increase reconnect churn and make results less representative.

**Implementation**:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    return {
        ...
        "timeout_keep_alive": 5,  # Explicitly set (matches default)
        ...
    }
```

For load testing specifically, a shorter keep-alive (e.g., 2 seconds) would release connections faster.

**Expected improvement**: Benchmark-specific at best. Not a clear product optimization.

**Measurement**: Monitor connection count and memory after session disconnect.

---

### 11. Direct WebSocket Send Path (Eliminate Sender Task)

**Impact: LOW-MEDIUM (speculative) | Effort: MEDIUM-HIGH**

Currently, `StarletteSessionClient` creates a dedicated `asyncio.Task` per connection that drains an `asyncio.Queue`. This queue-plus-task pattern adds:
- Task scheduling overhead per message
- Queue put/get overhead
- A permanently running coroutine per connection

`write_forward_msg()` is called synchronously from the runtime layer, but the current queue/task design also provides two useful guarantees:

- It isolates the runtime loop from slow socket writes.
- It provides bounded backpressure via `QueueFull`.

Because of that, this should be treated as a higher-risk redesign, not a straightforward cleanup.

**Implementation**: Use `asyncio.get_event_loop().call_soon()` to schedule the send directly on the event loop instead of routing through a queue:

```python
class StarletteSessionClient(SessionClient):
    def write_forward_msg(self, msg: ForwardMsg) -> None:
        if self._closed.is_set():
            raise SessionClientDisconnectedError
        payload = serialize_forward_msg(msg)
        loop = asyncio.get_event_loop()
        loop.call_soon_threadsafe(
            lambda: asyncio.ensure_future(self._websocket.send_bytes(payload))
        )
```

**Caveat**: A direct-send approach would need an alternative design for ordering, cancellation, and bounded buffering. Naively replacing the queue with `ensure_future()` likely just moves the buffering problem into unbounded tasks.

**Expected improvement**: Unclear. Do not attempt before adding queue-depth/sender-lag instrumentation.

**Measurement**: Compare rerun_time_ms p50/p95 and memory_rss_mb_avg.

---

### 12. Reduce `PathSecurityMiddleware` Overhead for Known-Safe Routes

**Impact: VERY LOW | Effort: LOW**

The `PathSecurityMiddleware` checks every HTTP request for dangerous path patterns. While individually cheap, it is also an intentional defense-in-depth layer. Given how little work it does relative to the static-file path, this should be treated as "only if profiling proves it matters".

**Implementation**: Skip the check for requests that match a known prefix:

```python
async def __call__(self, scope, receive, send):
    if scope["type"] != "http":
        await self.app(scope, receive, send)
        return

    path = scope.get("path", "")
    # Fast-path: known-safe prefixes
    if path.startswith(("/_stcore/", "/media/", "/static/")):
        await self.app(scope, receive, send)
        return

    # Full security check for unknown paths
    # ... existing check logic ...
```

**Expected improvement**: Marginal enough that it is probably not worth the security/maintenance tradeoff.

---

### 13. Use `StaticFiles` with Optimized Lookup

**Impact: MEDIUM (latency) | Effort: MEDIUM**

Starlette's `StaticFiles` does filesystem lookups on every request. For production builds where the file set is fixed, pre-indexing the available files can eliminate stat() calls.

**Implementation**: Pre-scan the static directory at startup and cache the results:

```python
class CachedStaticFiles(StaticFiles):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._file_cache: dict[str, os.stat_result] = {}
        self._scan_directory()

    def _scan_directory(self):
        for root, dirs, files in os.walk(self.directory):
            for f in files:
                path = os.path.join(root, f)
                rel = os.path.relpath(path, self.directory)
                self._file_cache[rel] = os.stat(path)
```

**Expected improvement**: Eliminates filesystem stat() calls during request handling. On SSDs this is ~100 µs/call, but under high I/O it can be more.

**Measurement**: Profile `StaticFiles.get_response` time before and after.

---

### 14. Tune `asyncio` Task Creation in Runtime Loop

**Impact: LOW-MEDIUM (latency) | Effort: LOW**

The runtime's `_loop_coroutine` creates and cancels `asyncio.Task` objects on every iteration for `must_stop.wait()` and `need_send_data.wait()`:

```python
done_tasks, pending_tasks = await asyncio.wait(
    (
        asyncio.create_task(async_objs.must_stop.wait()),
        asyncio.create_task(async_objs.need_send_data.wait()),
    ),
    return_when=asyncio.FIRST_COMPLETED,
)
for task in pending_tasks:
    task.cancel()
```

This creates 2 tasks per loop iteration and cancels 1. Task creation/cancellation has GC overhead.

**Implementation**: Use `asyncio.wait_for` or restructure to avoid repeated task creation:

```python
# Reuse a single Event and wait on it directly
while not async_objs.must_stop.is_set():
    try:
        await asyncio.wait_for(
            async_objs.need_send_data.wait(),
            timeout=0.01,
        )
    except asyncio.TimeoutError:
        pass
    async_objs.need_send_data.clear()
    # ... flush messages ...
```

**Expected improvement**: Reduces GC pressure and task scheduling overhead in the hot loop.

---

### 15. Profile and Optimize the `websockets` Library Handshake

**Impact: MEDIUM (initial load latency) | Effort: HIGH**

The `websockets` library performs a full HTTP/1.1 upgrade handshake with extension negotiation for each connection. With 80 concurrent WebSocket connections, the handshake phase creates a bottleneck.

**Implementation approaches**:

1. **Disable extension negotiation** (if not already) — since `ws_per_message_deflate=False`, verify that extension negotiation is truly skipped.
2. **Pre-warm the `websockets` protocol** to avoid first-connection initialization costs.
3. **Switch to `wsproto`** (see recommendation #2) which has a simpler handshake.

**Expected improvement**: Faster WebSocket connection establishment for initial page loads.

**Measurement**: Add timing around the WebSocket handshake phase and compare libraries.

---

### 16. Tune the AnyIO Default Thread Limiter

**Impact: HIGH (threads + latency), MEDIUM for memory | Effort: LOW**

**This is one of the clearest confirmed contributors to the thread-count regression.** Starlette uses AnyIO's threadpool (`anyio.to_thread.run_sync`) for filesystem work in `StaticFiles` and `FileResponse`, and the default limiter is indeed **40 tokens** in the current environment. The exact per-request hop count varies by codepath and file size, so the benchmark matrix matters more than the absolute "8 hops" estimate.

With 80 concurrent users loading ~15 assets each, all 1,200 file requests funnel through this 40-thread bottleneck, creating massive queuing and explaining both the thread count (~48 = 40 AnyIO + 8 ScriptRunner) and much of the latency regression.

**Implementation**: Set the AnyIO thread limiter at startup:

```python
import anyio

# Reduce to limit memory/thread overhead, or increase to reduce contention
anyio.to_thread.current_default_thread_limiter().total_tokens = 20
```

**Benchmark matrix**: Try `10`, `20`, `40` (default), `60` and measure:
- Initial load latency (lower limiter → less memory but more queuing)
- Peak RSS (lower limiter → fewer thread stacks → less memory)
- Max thread count (should track limiter value closely)

**Expected improvement**: A lower limiter (e.g., 20) could reduce peak thread count by ~50% and peak RSS by ~20 MB (thread stacks), at the cost of slightly more queuing on the threadpool. A higher limiter (e.g., 60) could reduce latency by allowing more concurrent file I/O, at the cost of more threads.

The ideal value depends on whether the bottleneck is threadpool contention (increase) or thread overhead (decrease). Benchmarking is essential.

**Measurement**: Compare thread_count_max, memory_rss_mb_peak, and initial_load_time_ms across the matrix.

---

### 17. Log Uvicorn HTTP/WS/Loop Backends at Startup

**Impact: LOW by itself, HIGH for correctness | Effort: LOW | Confidence: VALIDATED**

A separate investigation found that `httptools` was **not installed** in a local test environment, causing Uvicorn to silently fall back to `h11` (pure Python HTTP parser). In this branch, `httptools` is already listed as a required dependency, so this recommendation is best treated as a benchmark/prod correctness guardrail.

Without startup logging, this silent downgrade is invisible and can invalidate entire benchmark runs.

**Implementation**: After `uvicorn.Config.load()`, log the selected backends:

```python
uvicorn_config = uvicorn.Config(app, host=address, port=port, **kwargs)
if not uvicorn_config.loaded:
    uvicorn_config.load()

_LOGGER.info(
    "Uvicorn config: http=%s, ws=%s, loop=%s",
    uvicorn_config.http_protocol_class.__name__,
    uvicorn_config.ws_protocol_class.__name__,
    uvicorn_config.loop,
)

# Warn if performance-critical implementations are missing
if "h11" in uvicorn_config.http_protocol_class.__name__.lower():
    _LOGGER.warning(
        "Uvicorn is using h11 (pure Python HTTP parser). "
        "Install httptools for significantly better performance: pip install httptools"
    )
```

**Expected improvement**: Prevents silent performance regressions in benchmarks and production.

---

### 18. Prefer `httptools` Explicitly When Available

**Impact: LOW by itself, HIGH for correctness | Effort: LOW | Confidence: VALIDATED LOCALLY**

Local measurement showed that missing `httptools` causes a **55.8% regression in initial load time**. Since `httptools` is already a core dependency in `lib/pyproject.toml`, explicitly selecting it is mainly a way to fail loudly when the environment is broken.

**Implementation**: Probe for `httptools` at config time and set it explicitly:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    http_impl = "auto"
    try:
        import httptools  # noqa: F401
        http_impl = "httptools"
    except ImportError:
        _LOGGER.warning(
            "httptools not installed. Falling back to h11. "
            "Install httptools for better HTTP performance."
        )

    return {
        ...
        "http": http_impl,
        ...
    }
```

This fails loudly instead of silently degrading, and documents the dependency expectation in code rather than relying on Uvicorn's auto-detection.

**Expected improvement**: Prevents silent 55%+ latency regressions.

---

### 19. Add Instrumentation for WebSocket Queue Depth and Sender Lag

**Impact: LOW by itself, HIGH for optimization guidance | Effort: LOW**

Without queue-depth or lag metrics, it is hard to know whether the WebSocket bridge is actually the bottleneck in real runs, or whether the contention is elsewhere.

**Implementation**: Add optional debug metrics to `StarletteSessionClient`:

```python
class StarletteSessionClient(SessionClient):
    _total_enqueued: int = 0
    _total_sent: int = 0
    _max_queue_depth: int = 0

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        ...
        self._total_enqueued += 1
        self._max_queue_depth = max(self._max_queue_depth, self._send_queue.qsize())

    async def _sender(self) -> None:
        ...
        self._total_sent += 1
```

Expose these via the existing `/_stcore/metrics` endpoint for load test analysis.

**Expected improvement**: Enables data-driven decisions about queue sizing, sender architecture, and flush loop tuning.

---

### 20. Separate Cold-Start from Rerun Benchmarks in CI

**Impact: HIGH for decision quality | Effort: MEDIUM**

The current load test suite mixes asset-fetch costs, WebSocket setup, frontend execution, and backend script rerun into combined metrics. This makes it harder to know which optimization moved the needle.

**Implementation**: Add a warm-cache or rerun-only benchmark mode:

```python
# In worker.py, add an option to skip initial load measurement
# and only measure reruns after the page is loaded
def run_worker_session(server_url, worker_id, scenario, timeout_sec=120,
                       *, skip_initial_load_timing=False):
    ...
```

Report separate summaries for:
- Initial load (asset fetch + WS connect + first script run)
- Rerun only (widget interaction timing)
- Server-side metrics (RSS, threads)

**Expected improvement**: More precise attribution of optimization effects. Avoids crediting a static-file optimization for a rerun improvement, or vice versa.

---

### 21. Serve Core Frontend Assets via Reverse Proxy in Production

**Impact: HIGH in real deployments | Effort: MEDIUM (deployment config)**

Uvicorn documentation recommends running behind Nginx or a CDN. Streamlit's static JS/CSS bundles are immutable (content-hashed filenames) and ideal for proxy/CDN caching. Removing asset-serving from the Python process eliminates all AnyIO threadpool overhead, middleware traversal, and gzip compression for static files.

**Implementation**: Provide recommended Nginx config for production deployments:

```nginx
location /static/ {
    alias /path/to/streamlit/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    gzip_static on;  # Serve pre-compressed .gz files
}

location / {
    proxy_pass http://127.0.0.1:8501;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Expected improvement**: Eliminates all Python-level static file overhead. In production, this could reduce initial load time by 30-50% and significantly reduce RSS.

**Note**: This does not improve the single-process CI benchmark unless the benchmark environment is changed.

---

### 22. Consider Multi-Process Uvicorn Deployment for Production

**Impact: HIGH in production | Effort: LOW (config change)**

The load test currently runs one server process. In production, multiple worker processes can spread asset traffic, WebSocket accept load, and Python heap pressure. The recommended formula is **(2 × CPU cores) + 1** workers for I/O-bound applications.

**Implementation**: For production guidance, document Gunicorn + Uvicorn workers:

```bash
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:8501
```

Or use Uvicorn's built-in multi-worker mode:

```bash
uvicorn main:app --workers 4 --host 0.0.0.0 --port 8501
```

**Expected improvement**: Near-linear scaling of throughput with worker count for CPU-bound phases. Each worker has its own event loop and threadpool, eliminating single-process contention.

**Note**: This is a deployment optimization. It should not be used to explain away single-process regressions in the benchmark.

---

## Prioritized Implementation Order

Based on expected impact and implementation effort:

### Phase 0: Immediate — zero/minimal code changes, high confidence

| Priority | Recommendation | Impact | Effort | Confidence |
|----------|---------------|--------|--------|------------|
| **P0** | #17 — Log Uvicorn backends at startup | LOW by itself, HIGH for correctness | LOW | High |
| **P0** | #18 — Prefer `httptools` explicitly / warn loudly if missing | LOW by itself, HIGH for correctness | LOW | Validated |
| **P0** | #4 — Verify uvloop activation in benchmark runs | LOW by itself, HIGH for correctness | LOW | High |
| **P0** | #19 — Add WS queue depth / sender lag instrumentation | LOW by itself, HIGH for guidance | LOW | High |
| **P0** | #20 — Separate cold-start from rerun benchmarks | HIGH for decision quality | MEDIUM | High |

### Phase 1: High-value code work — biggest architectural wins

| Priority | Recommendation | Impact | Effort | Confidence |
|----------|---------------|--------|--------|------------|
| **P1** | #16 — Tune AnyIO thread limiter with a benchmark matrix | HIGH | LOW | Validated |
| **P1** | #1 — Scope SessionMiddleware to auth routes only | HIGH | LOW-MEDIUM | High |
| **P1** | #7 — Optimize runtime loop sleeps/batching | MEDIUM | LOW | High |
| **P1** | #6 — Pre-compress static assets | MEDIUM-HIGH | MEDIUM | High |
| **P1** | #5 — Lazy GZip buffer initialization | MEDIUM | LOW | Measured |

### Phase 2: Deeper optimizations — require more work or benchmarking

| Priority | Recommendation | Impact | Effort | Confidence |
|----------|---------------|--------|--------|------------|
| **P2** | #2 — Benchmark `websockets-sansio`, then `wsproto` if needed | MEDIUM-HIGH | LOW | Medium |
| **P2** | #3 — Reduce send queue size after instrumentation | MEDIUM | LOW | Medium |
| **P2** | #13 — Cached static file lookup | MEDIUM | MEDIUM | Medium |
| **P2** | #15 — Profile WS handshake behavior | MEDIUM | HIGH | Medium |
| **P2** | #14 — Reduce task creation in loop | LOW-MEDIUM | LOW | Medium |

### Phase 3: Tune and harden

| Priority | Recommendation | Impact | Effort | Confidence |
|----------|---------------|--------|--------|------------|
| **P3** | #9 — Consolidate duplicate routes if profiling shows routing cost | LOW | LOW | Medium |
| **P3** | #10 — Tune keep-alive only for benchmark-specific experiments | LOW | LOW | Low |
| **P3** | #8 — Use `limit_concurrency` only as overload protection | LOW-MEDIUM | LOW | Medium |
| **P3** | #11 — Revisit direct-send WebSocket design only with strong evidence | LOW-MEDIUM | MEDIUM-HIGH | Low |
| **P3** | #12 — PathSecurity fast-path (likely not worth it) | VERY LOW | LOW | Low |

### Phase 4: Deployment guidance

| Priority | Recommendation | Impact | Effort | Confidence |
|----------|---------------|--------|--------|------------|
| **P4** | #21 — Reverse proxy for static assets (production) | HIGH | MEDIUM | High |
| **P4** | #22 — Multi-process Uvicorn deployment | HIGH | LOW | High |

## Profiling Results Summary

Measured on macOS (Apple Silicon), Python 3.13.11, Starlette 1.0.0, Uvicorn 0.42.0, websockets 16.0:

| Component | Measured Overhead |
|-----------|------------------|
| **AnyIO default thread limiter** | **40 tokens** (directly explains ~48 max threads) |
| **Threadpool hops per static file** | **up to 8** (lookup, stat, open, read) |
| `GZipResponder` creation | **35 µs/object** (100x vs IdentityResponder) |
| `IdentityResponder` creation | 0.3 µs/object |
| `asyncio.Queue(maxsize=500)` creation | 3,345 bytes/queue |
| `asyncio.Queue` put_nowait+get | 702,393 ops/sec |
| Small protobuf serialization | 2.2 µs/msg |
| 50KB protobuf serialization | 13.0 µs/msg |
| `StarletteSessionClient` memory | ~15 KB/connection |
| Simulated WS buffers (2×64KB) | ~128 KB/connection |

**Local validation (from separate investigation)**:

| Change | Initial load (mean) | Improvement |
|--------|-------------------|-------------|
| Without `httptools` (h11 fallback) | 3,402 ms | baseline |
| With `httptools` installed | 1,504 ms | **-55.8%** |

## Key Insights

1. **The AnyIO threadpool is the primary driver of thread count and memory regressions.** Starlette delegates all file I/O to a 40-thread pool. With 80 concurrent users and ~8 threadpool hops per static file request, the pool saturates and creates massive queuing. Tornado had no threadpool — it served files directly from the event loop.

2. **Slower initial page loads cascade into everything else.** Higher concurrent session counts → higher peak memory → higher thread counts. Optimizations that reduce initial load time (AnyIO tuning, middleware bypass, `httptools`) will have the largest compound effect.

3. **Silent dependency downgrades are catastrophic.** Missing `httptools` causes a 55.8% latency regression with zero warning. Missing `uvloop` would cause a similar regression. Both must be explicitly verified and logged at startup.

## Measurement Approach

For each optimization, use the existing load test infrastructure:

```bash
# Run load test for specific scenario:
make run-e2e-test st_command_test.py  # or
cd e2e_playwright/load_testing && uv run pytest test_load.py -k simple_app --num-sessions=80

# Compare key metrics:
# - memory_rss_mb_peak
# - memory_rss_mb_avg
# - initial_load_time_ms.p50
# - initial_load_time_ms.p95
# - rerun_time_ms.p50
# - rerun_time_ms.p99
# - thread_count_max
```

Target: Get all metrics within 1.5x of the Tornado baseline (currently 2-3x worse).

## Suggested Benchmark Campaign Order

If turning this plan into an implementation campaign, this is the recommended order for benchmarking changes (each step cumulative):

| Step | Change | Key metric to watch |
|------|--------|-------------------|
| 1 | Current branch, verify httptools + uvloop active | Baseline |
| 2 | + Explicit `http="httptools"`, `loop="uvloop"`, startup logging | initial_load_time_ms |
| 3 | + AnyIO thread limiter tuning (try 10/20/40/60) | thread_count_max, memory_rss_mb_peak |
| 4 | + Skip middleware for static files | initial_load_time_ms |
| 5 | + Runtime flush loop batching (yield per session, shorter sleep) | rerun_time_ms p99 |
| 6 | + `ws="websockets-sansio"` | memory_rss_mb_avg |
| 7 | + Reduce send queue size (500→50) | memory_rss_mb_peak |
| 8 | + Pre-compressed static assets + lazy GZip | initial_load_time_ms, cpu_percent_avg |

**Priority scenarios** (in order of diagnostic value):

| Scenario | Best signal for |
|----------|----------------|
| `simple_app` | Fixed startup overhead, baseline contention |
| `fragment_app` | Rerun path and WebSocket bridge efficiency |
| `many_messages_app` | Message-heavy WebSocket behavior, queue/flush pressure |
| `widget_heavy_app` | Widget state + many small messages (p99 tail latency) |
| `dataframe_app` | Large payload serialization and memory |

---

## Appendix A: Uvicorn/Starlette Optimization Research (External)

This section documents findings from web research on recommended settings, dependencies, and best practices for optimizing Uvicorn/Starlette in production.

### A.1. Uvicorn Protocol Stack Configuration

The current Streamlit Uvicorn config (`_get_uvicorn_config_kwargs()`) does **not** explicitly set the `loop` or `http` parameters, relying on `"auto"` detection. While `auto` does resolve correctly in our environment:

| Parameter | Auto-detected value | Recommendation |
|-----------|-------------------|----------------|
| `loop` | `auto` → uvloop (if installed) | **Explicitly set `loop="uvloop"`** on non-Windows to fail loudly if uvloop is missing rather than silently falling back to asyncio |
| `http` | `auto` → httptools | Already optimal; httptools is a C-based parser 20-30% faster than pure-Python h11 |
| `ws` | `auto` → `websockets` | **Consider `"websockets-sansio"`** — a newer, lighter implementation (see A.3) |

**Recommendation**: Explicitly set `loop="uvloop"` and `http="httptools"` in `_get_uvicorn_config_kwargs()`:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    return {
        ...
        "loop": "uvloop" if not IS_WINDOWS else "auto",
        "http": "httptools",
        ...
    }
```

This ensures the fast path is always used and failures are visible (instead of silent fallback).

### A.2. Uvicorn Settings Not Currently Used

Several Uvicorn settings could benefit Streamlit's use case:

| Setting | Default | Recommended | Rationale |
|---------|---------|-------------|-----------|
| `server_header` | `True` | **`False`** | Removes `Server: uvicorn` header from every response — saves string allocation + header serialization per response |
| `date_header` | `True` | **`False`** | Removes `Date:` header from every response — one less header to generate and send |
| `limit_concurrency` | `None` (unlimited) | **`500`** | Prevents memory exhaustion under traffic spikes; returns 503 when exceeded |
| `limit_max_requests` | `None` | **Consider for long-running servers** | Restarts worker after N requests to prevent memory leaks; useful with `limit_max_requests_jitter` to stagger restarts |
| `timeout_keep_alive` | `5` | `5` (keep default) | Already reasonable; reducing to 2s would help load tests specifically |
| `backlog` | `2048` | `2048` (keep default) | Socket-level backlog; largely ineffective since Uvicorn accepts connections immediately |
| `ws_max_queue` | `32` | **`16`** | Websockets library's internal incoming message queue (separate from Streamlit's send queue). Reducing from 32 to 16 halves worst-case `max_size × max_queue` memory (from 32 MB to 16 MB per connection) |

### A.3. WebSocket Implementation: `websockets-sansio` Option

Uvicorn now supports **three** WebSocket implementations:

| Implementation | Library | Status | Memory per connection |
|---------------|---------|--------|----------------------|
| `websockets` | websockets (full asyncio) | Default | **64 KiB** (with compression) / **14 KiB** (without) |
| `websockets-sansio` | websockets (sans-I/O layer) | Newer, merged June 2025 | Potentially lower — uses sans-I/O protocol layer without full asyncio machinery |
| `wsproto` | wsproto | Established | Generally lighter, but **not installed** in current env |

**Key finding**: According to websockets 16.0 docs, each connection uses **64 KiB with default settings** or **14 KiB with compression disabled**. Since Streamlit already has `enableWebsocketCompression=False` (which maps to `ws_per_message_deflate=False`), we should be at the 14 KiB level per connection for the websockets layer.

**Recommendation**: Try `ws="websockets-sansio"` first (zero new dependencies, available now):

```python
"ws": "websockets-sansio",  # vs current "auto" → "websockets"
```

This uses the same `websockets` library but through a lighter sans-I/O layer that avoids some of the full asyncio connection machinery. It was introduced specifically because the websockets library deprecated the API that the full implementation used.

If `websockets-sansio` doesn't help enough, `wsproto` would require adding a new dependency but is known to be lighter.

### A.4. Compression Alternatives (Beyond GZip)

The current `MediaAwareGZipMiddleware` creates a new `GZipResponder` per request (measured at 35 µs). Alternatives exist:

| Library | Algorithms | Key advantage |
|---------|-----------|---------------|
| **starlette-compress** | zstd, Brotli, GZip | All three algorithms in one middleware; zstd is faster than gzip at similar ratios |
| **brotli-asgi** | Brotli (with gzip fallback) | Better compression ratios than gzip at similar CPU cost; 598K+ monthly downloads |
| **Built-in (Starlette 1.0)** | GZip only | Current choice; PR #2564 proposes built-in CompressMiddleware with zstd/Brotli support |

**For pre-compressed static assets**: Brotli (`br`) is universally supported by modern browsers and compresses 15-20% better than gzip. Pre-compressing `.js`/`.css` bundles with Brotli at build time would be the highest-impact compression optimization.

### A.5. Pure ASGI Middleware (Confirmed)

All three Streamlit middleware implementations are **pure ASGI middleware** (no `BaseHTTPMiddleware`):
- `PathSecurityMiddleware` — direct `__call__(scope, receive, send)`
- `SessionMiddleware` — Starlette's built-in (pure ASGI since 0.20+)
- `MediaAwareGZipMiddleware` — extends `GZipMiddleware` (pure ASGI)

This is good. `BaseHTTPMiddleware` creates 7 intermediate objects per request and buffers response bodies — a known performance anti-pattern. The current implementation avoids this.

### A.6. Starlette 1.0 Session Middleware Change

Starlette 1.0.0 introduced **tracking of session access and modification** in `SessionMiddleware`. This means the middleware now tracks whether the session was read or written to, and only sets the `Set-Cookie` header when the session was actually modified.

**Impact**: This should reduce the overhead for requests that don't use sessions (like static files). However, the middleware still runs on every request and parses cookies. The recommendation to skip SessionMiddleware for static files (Recommendation #1) remains the most impactful optimization.

### A.7. Alternative ASGI Servers

| Server | Language | Throughput (vs Uvicorn) | Notes |
|--------|----------|------------------------|-------|
| **Granian** | Rust | **~2.4x faster** | Emerging choice; handles 146K req vs Uvicorn's 62K req at 30 concurrent connections |
| **Uvicorn** | Python (C extensions) | Baseline | Most mature, best ecosystem support |
| **Hypercorn** | Python | ~similar | HTTP/2 support, but no significant perf advantage |
| **Daphne** | Python | ~slower | Django Channels; not competitive for perf |

**Granian** is the most interesting alternative — it's a Rust-based ASGI server that delivers 2x+ throughput over Uvicorn with Gunicorn. However, it's relatively new and Streamlit's deep integration with Uvicorn (manual socket binding, embedded server, lifespan management) makes migration non-trivial. This could be a longer-term option if Uvicorn optimizations aren't sufficient.

### A.8. Starlette Routing Performance

Starlette uses **sequential regex matching** for routes — O(n) per request where n = number of routes. With 24+ routes in the current configuration, every request checks up to 24 regex patterns before finding a match. The static assets `Mount` is listed last, meaning static file requests check all API routes first.

Alternative approaches:
- **Radix tree routing**: O(s) where s = route length. Werkzeug (Flask) achieved 5x speedup by switching from regex to state machine.
- **Route ordering**: Move high-frequency routes first (static assets, WebSocket) to reduce average match time.
- **Route consolidation**: Merge OPTIONS routes with their GET/POST counterparts.

### A.9. Key Dependencies Checklist

| Dependency | Status | Action | Risk if missing |
|-----------|--------|--------|----------------|
| **httptools** | Core dep ✓ | **Verify at startup** — auto-detect can silently fall back to h11 | **-55.8% initial load (validated!)** |
| **uvloop** | Optional (`[performance]`) | **Move to core deps** (non-Windows) — 2-4x event loop speedup | Significant latency regression |
| **websockets** | Core dep ✓ | Used for WebSocket support; consider `websockets-sansio` mode | N/A |
| **wsproto** | Not installed | Consider as alternative WS implementation (lighter) | N/A |
| **orjson** | Optional (`[performance]`) | Not directly relevant (Streamlit uses protobuf, not JSON, for client-server) | N/A |
| **Brotli/zstd** | Not installed | Consider for pre-compressed static assets | N/A |
| **anyio** | Core dep ✓ | Already required by Starlette; **tune the thread limiter** (default 40 is too high/low depending on use case) | N/A |

### A.10. Quick Wins Summary (Zero or Minimal Code Changes)

These can be applied immediately in `_get_uvicorn_config_kwargs()`:

```python
def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    cert_file, key_file = _validate_ssl_config()
    ws_ping_interval, ws_ping_timeout = _get_websocket_settings()
    ws_max_size = get_max_message_size_bytes()
    ws_per_message_deflate = config.get_option("server.enableWebsocketCompression")

    return {
        "ssl_certfile": cert_file,
        "ssl_keyfile": key_file,
        # Explicitly select fast implementations instead of relying on auto-detection:
        "loop": "uvloop" if not env_util.IS_WINDOWS else "auto",
        "http": "httptools",
        "ws": "websockets-sansio",  # Lighter than full "websockets" impl
        # WebSocket settings:
        "ws_ping_interval": ws_ping_interval,
        "ws_ping_timeout": ws_ping_timeout,
        "ws_max_size": ws_max_size,
        "ws_per_message_deflate": ws_per_message_deflate,
        # Reduce per-response overhead:
        "server_header": False,
        "date_header": False,
        # Logging:
        "use_colors": False,
        "access_log": False,
        # Resource limits:
        "limit_concurrency": 500,
    }
```

Expected combined impact of these quick wins: **10-30% improvement in latency and 15-25% reduction in memory**, based on research benchmarks.

---

## Appendix B: Experiment Runbook

Each experiment below is designed to isolate a single variable. Run them against the load test infrastructure with `simple_app` first (best signal-to-noise for fixed overhead), then confirm on `many_messages_app` and `widget_heavy_app` for message-path regressions.

**How to run**: Use the load test workflow via `workflow_dispatch` or locally:

```bash
cd e2e_playwright/load_testing
uv run pytest test_load.py -k simple_app --num-sessions=80 -v --tb=short --results-dir=results
```

For experiments that require code changes, create a branch per experiment. For config-only experiments, use the `extra_env` parameter in `start_load_test_server()` or set env vars before running.

**Metrics to collect for every experiment** (from `load-test-results.json`):

| Metric | Key |
|--------|-----|
| Initial load p50/p95 | `session_metrics.initial_load_time_ms.p50` / `.p95` |
| Rerun p50/p99 | `session_metrics.rerun_time_ms.p50` / `.p99` |
| Memory peak | `server_metrics.memory_rss_mb_peak` |
| Memory avg | `server_metrics.memory_rss_mb_avg` |
| Max threads | `server_metrics.thread_count_max` |
| Duration | `duration_seconds` |
| Failures | `session_metrics.sessions_failed` |

---

### Experiment 0: Baseline — Verify Current Stack

**Goal**: Confirm what backends are actually active and establish a clean baseline.

**Change**: Add a one-time print to `starlette_server.py` after `uvicorn.Config.load()`:

```python
# In UvicornServer.start(), after uvicorn_config is created:
if not uvicorn_config.loaded:
    uvicorn_config.load()
_LOGGER.info(
    "Uvicorn backends: http=%s ws=%s loop=%s",
    uvicorn_config.http_protocol_class.__name__,
    uvicorn_config.ws_protocol_class.__name__,
    uvicorn_config.loop,
)
```

Also log the AnyIO thread limiter and event loop type:

```python
import asyncio
from anyio import to_thread
_LOGGER.info(
    "Event loop: %s, AnyIO thread limiter: %d tokens",
    type(asyncio.get_event_loop()).__name__,
    to_thread.current_default_thread_limiter().total_tokens,
)
```

**Files**: `lib/streamlit/web/server/starlette/starlette_server.py`

**Expected outcome**: Confirms httptools, websockets, and uvloop are all active. Provides a clean baseline number set.

**Scenarios**: All 6.

---

### Experiment 1: Explicit `http="httptools"` + `loop="uvloop"`

**Goal**: Ensure fast paths are used and fail loudly if missing.

**Change** (in `_get_uvicorn_config_kwargs`):

```python
return {
    ...
    "http": "httptools",
    "loop": "uvloop",
    ...
}
```

**Files**: `lib/streamlit/web/server/starlette/starlette_server.py`

**Expected outcome**: Should match baseline if httptools/uvloop are already active. If the numbers improve, it means auto-detection was not selecting them.

**Scenarios**: `simple_app`, `fragment_app`.

---

### Experiment 2: Uvicorn Quick Settings (`server_header`, `date_header`, `limit_concurrency`)

**Goal**: Measure the combined effect of minor Uvicorn tuning knobs.

**Change** (in `_get_uvicorn_config_kwargs`):

```python
return {
    ...
    "server_header": False,
    "date_header": False,
    "limit_concurrency": 500,
    ...
}
```

**Files**: `lib/streamlit/web/server/starlette/starlette_server.py`

**Expected outcome**: Marginal latency improvement from fewer headers. `limit_concurrency` mostly matters under overload.

**Scenarios**: `simple_app`.

---

### Experiment 3: AnyIO Thread Limiter — Matrix Test

**Goal**: Find the optimal thread limiter value. This is the primary driver of thread count and contributes to memory and latency.

**Change**: Set the limiter early in the Starlette app lifespan (or in `bootstrap.py`):

```python
from anyio import to_thread
to_thread.current_default_thread_limiter().total_tokens = N
```

**Matrix**:

| N | Hypothesis |
|---|-----------|
| 10 | Minimal threads/memory, but static file requests queue heavily |
| 20 | Balanced — half the threads, moderate queuing |
| 40 | Current default — baseline comparison |
| 60 | More throughput for static files, higher thread count |

**Files**: `lib/streamlit/web/server/starlette/starlette_app.py` (in `_lifespan` or `create_starlette_app`)

**Expected outcome**: Lower N → lower `thread_count_max` and `memory_rss_mb_peak`, but potentially higher `initial_load_time_ms`. Higher N → the reverse. The sweet spot depends on the number of concurrent users and the I/O cost per file.

**Scenarios**: `simple_app` (most static-file sensitive), `widget_heavy_app` (most memory/thread sensitive).

---

### Experiment 4: WebSocket Implementation — `websockets-sansio`

**Goal**: Test the lighter sans-I/O WebSocket implementation.

**Change** (in `_get_uvicorn_config_kwargs`):

```python
return {
    ...
    "ws": "websockets-sansio",
    ...
}
```

**Files**: `lib/streamlit/web/server/starlette/starlette_server.py`

**Expected outcome**: Potential reduction in per-connection memory. No new dependencies needed. May affect WebSocket behavior, so watch for failures.

**Scenarios**: `simple_app`, `many_messages_app`, `fragment_app`.

---

### Experiment 5: WebSocket Implementation — `wsproto`

**Goal**: Test the lightest-weight WebSocket implementation.

**Change**: Add `wsproto` dependency, then:

```python
return {
    ...
    "ws": "wsproto",
    ...
}
```

**Files**: `lib/pyproject.toml` (add `wsproto>=1.2.0`), `lib/streamlit/web/server/starlette/starlette_server.py`

**Expected outcome**: Lower per-connection memory than `websockets`. Watch for any WebSocket protocol differences or failures.

**Scenarios**: `simple_app`, `many_messages_app`, `widget_heavy_app`.

---

### Experiment 6: Skip Middleware for Static Files

**Goal**: Bypass `SessionMiddleware` and `GZipMiddleware` for static asset requests.

**Change**: Wrap the static-files mount to bypass unnecessary middleware. In `create_streamlit_middleware` or the app creation:

```python
# Option A: Conditional middleware that checks path
class ConditionalMiddleware:
    def __init__(self, app: ASGIApp, middleware: ASGIApp, skip_prefixes: tuple[str, ...]) -> None:
        self.app = app
        self.middleware = middleware
        self.skip_prefixes = skip_prefixes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path", "").startswith(self.skip_prefixes):
            await self.app(scope, receive, send)
        else:
            await self.middleware(scope, receive, send)
```

Or more simply, move the static `Mount` to a separate Starlette sub-app without the session/gzip middleware stack.

**Files**: `lib/streamlit/web/server/starlette/starlette_app.py`, `lib/streamlit/web/server/starlette/starlette_static_routes.py`

**Expected outcome**: Measurable improvement in `initial_load_time_ms` (10-20%+). No effect on rerun metrics. Should reduce CPU from unnecessary gzip compression of already-small or cached assets.

**Follow-up local result**: Splitting this experiment showed that the practical win came from the **GZip bypass**, not the `SessionMiddleware` bypass. A gzip-only static bypass materially improved both `simple_app` and `caching_app`, while a session-only static bypass regressed both.

**Scenarios**: `simple_app`, `caching_app` (both dominated by initial load).

---

### Experiment 7: Reduce Send Queue Size (500 → 50)

**Goal**: Lower worst-case memory from the per-client send queue.

**Change** (in `starlette_server_config.py`):

```python
WEBSOCKET_MAX_SEND_QUEUE_SIZE: Final = 50  # was 500
```

**Files**: `lib/streamlit/web/server/starlette/starlette_server_config.py`

**Expected outcome**: Lower `memory_rss_mb_peak` under load. No impact on rerun latency unless clients are genuinely slow (which would show up as `SessionClientDisconnectedError` in logs).

**Scenarios**: `many_messages_app` (largest messages), `widget_heavy_app` (most messages).

---

### Experiment 8: Runtime Loop — Batch Sends and Reduce Sleep

**Goal**: Reduce message delivery latency and scheduler churn.

**Change** (in `runtime.py`, `_loop_coroutine`):

```python
# Replace per-message yield with per-session yield:
for active_session_info in self._session_mgr.list_active_sessions():
    msg_list = active_session_info.session.flush_browser_queue()
    for msg in msg_list:
        try:
            self._send_message(active_session_info, msg)
        except SessionClientDisconnectedError:
            self._session_mgr.disconnect_session(
                active_session_info.session.id
            )
            break
    # Yield once per session, not per message
    await asyncio.sleep(0)

# Reduce inter-flush sleep
await asyncio.sleep(0.001)  # was 0.01
```

**Files**: `lib/streamlit/runtime/runtime.py`

**Expected outcome**: Measurable improvement in `rerun_time_ms` p95/p99, especially for `widget_heavy_app` (p99 regressed from 400 ms to 1,511 ms). Minimal impact on initial load.

**Scenarios**: `widget_heavy_app`, `many_messages_app`, `fragment_app`.

---

### Experiment 9: GZip Middleware — Disable for Load Test

**Goal**: Isolate how much of the initial load regression comes from on-the-fly gzip compression.

**Change**: Temporarily remove `MediaAwareGZipMiddleware` from the middleware stack:

```python
def create_streamlit_middleware() -> list[Middleware]:
    middleware: list[Middleware] = []
    middleware.append(Middleware(PathSecurityMiddleware))
    middleware.append(Middleware(SessionMiddleware, ...))
    # EXPERIMENT: comment out GZip middleware
    # middleware.append(Middleware(MediaAwareGZipMiddleware, ...))
    return middleware
```

**Files**: `lib/streamlit/web/server/starlette/starlette_app.py`

**Expected outcome**: If initial load improves significantly, it confirms GZip is a major overhead and justifies investing in pre-compressed assets (Experiment 10). If no change, compression is not the bottleneck.

**Scenarios**: `simple_app`.

---

### Experiment 10: Pre-Compressed Static Assets

**Goal**: Eliminate runtime gzip cost for static files entirely.

**Change**:

1. Add a build step to `make frontend-fast` that generates `.gz` files:
   ```bash
   find frontend/app/dist -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) \
       -exec gzip -k -9 {} \;
   ```

2. Modify `_StreamlitStaticFiles` to serve `.gz` files when available:
   ```python
   async def get_response(self, path, scope):
       headers = Headers(scope=scope)
       if "gzip" in headers.get("Accept-Encoding", ""):
           gz_path = path + ".gz"
           # ... serve pre-compressed if exists ...
       return await super().get_response(path, scope)
   ```

**Files**: `Makefile`, `lib/streamlit/web/server/starlette/starlette_static_routes.py`

**Expected outcome**: Significant reduction in CPU usage and initial load time under concurrent load. Gzip compression at level 6 is CPU-expensive; pre-compression moves that cost to build time.

**Scenarios**: `simple_app`, `caching_app`.

---

### Experiment 11: Combined Quick Wins

**Goal**: Measure the cumulative effect of all low-effort changes together.

**Changes combined**:
- Explicit `http="httptools"`, `loop="uvloop"`
- `server_header=False`, `date_header=False`
- `ws="websockets-sansio"`
- AnyIO thread limiter set to 20
- Send queue size reduced to 50
- Runtime loop: yield per session, sleep 0.001

**Files**: Multiple (see individual experiments above).

**Expected outcome**: The combined effect should be significantly better than any single experiment. This gives the realistic "what can we ship quickly" number.

**Scenarios**: All 6 scenarios with 80 concurrent users.

---

### Experiment 12: Eliminate Sender Task — Direct Send

**Goal**: Remove the per-connection background sender task and queue, sending directly via event loop scheduling.

**Change** (in `starlette_websocket.py`):

```python
class StarletteSessionClient(SessionClient):
    def __init__(self, websocket: WebSocket) -> None:
        self._websocket = websocket
        self._client_context = StarletteClientContext(websocket)
        self._closed = asyncio.Event()
        self._loop = asyncio.get_event_loop()
        self._pending_sends: int = 0
        self._max_pending: int = 50

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        if self._closed.is_set():
            raise SessionClientDisconnectedError
        if self._pending_sends >= self._max_pending:
            self._closed.set()
            raise SessionClientDisconnectedError
        payload = serialize_forward_msg(msg)
        self._pending_sends += 1
        self._loop.call_soon_threadsafe(
            lambda p=payload: asyncio.ensure_future(self._send(p))
        )

    async def _send(self, payload: bytes) -> None:
        try:
            await self._websocket.send_bytes(payload)
        except Exception:
            self._closed.set()
        finally:
            self._pending_sends -= 1
```

**Files**: `lib/streamlit/web/server/starlette/starlette_websocket.py`

**Expected outcome**: Reduces per-connection overhead (no queue, no background task). May improve rerun latency. Needs careful testing for backpressure and error handling.

**Follow-up local result**: A safer alternative that kept the queue and sender task but drained multiple messages per wakeup performed much better than direct send on `many_messages_app`, while avoiding the catastrophic instability of `wsproto`. That suggests the queue may be worth keeping, with batching inside the sender as the more promising direction.

**Risk**: Higher — this changes the WebSocket send architecture. Run full E2E suite.

**Scenarios**: All 6 (with extra attention to failure counts).

---

### Experiment 13: Route Consolidation + Reordering

**Goal**: Reduce per-request routing overhead by consolidating duplicate routes and putting high-frequency routes first.

**Change** (in `starlette_app.py` and `starlette_routes.py`):
- Merge OPTIONS handlers into the main route handlers
- Move the static `Mount` before API routes in the route list (since it handles the most requests during initial load)

**Files**: `lib/streamlit/web/server/starlette/starlette_routes.py`, `lib/streamlit/web/server/starlette/starlette_app.py`

**Expected outcome**: Small improvement in per-request latency. More impactful at high concurrency where routing overhead multiplies.

**Scenarios**: `simple_app`.

---

## Experiment Priority and Order

Run experiments in this order for maximum learning per iteration:

| Order | Experiment | Type | Risk | Time |
|-------|-----------|------|------|------|
| 1 | **E0** — Baseline verification | Diagnostic | None | 15 min |
| 2 | **E1** — Explicit httptools + uvloop | Config | None | 15 min |
| 3 | **E3** — AnyIO thread limiter matrix | Config | Low | 1 hr (4 runs) |
| 4 | **E9** — Disable GZip (diagnostic) | Diagnostic | None | 15 min |
| 5 | **E4** — websockets-sansio | Config | Low | 15 min |
| 6 | **E8** — Runtime loop batching | Code | Low | 30 min |
| 7 | **E7** — Send queue 500→50 | Config | Low | 15 min |
| 8 | **E6** — Skip middleware for static | Code | Medium | 1 hr |
| 9 | **E11** — Combined quick wins | Combined | Low | 30 min |
| 10 | **E10** — Pre-compressed assets | Build+Code | Medium | 2 hr |
| 11 | **E5** — wsproto | Dependency | Medium | 30 min |
| 12 | **E12** — Direct send (no queue/task) | Code | High | 2 hr |
| 13 | **E13** — Route consolidation | Code | Low | 1 hr |

**Total estimated time**: ~8-9 hours for the full matrix.

**Minimum viable set**: Experiments 0, 1, 3, 8, 11 (~3 hours) — covers diagnostics, the two biggest knobs (AnyIO limiter and runtime loop), and the combined result.

---

## Experiment Results Template

Use this table to record results. Fill in one row per experiment per scenario:

```markdown
| Experiment | Scenario | load p50 (ms) | load p95 (ms) | rerun p50 (ms) | rerun p99 (ms) | mem peak (MB) | mem avg (MB) | threads | duration (s) | failures |
|------------|----------|---------------|---------------|----------------|----------------|---------------|--------------|---------|--------------|----------|
| Baseline   | simple   |               |               |                |                |               |              |         |              |          |
| E1         | simple   |               |               |                |                |               |              |         |              |          |
| E3-N=10    | simple   |               |               |                |                |               |              |         |              |          |
| E3-N=20    | simple   |               |               |                |                |               |              |         |              |          |
| E3-N=40    | simple   |               |               |                |                |               |              |         |              |          |
| E3-N=60    | simple   |               |               |                |                |               |              |         |              |          |
| ...        | ...      |               |               |                |                |               |              |         |              |          |
```

**Tornado reference values** (from CI):

| Scenario | load p50 | load p95 | rerun p50 | rerun p99 | mem peak | mem avg | threads |
|----------|----------|----------|-----------|-----------|----------|---------|---------|
| simple_app | 12,778 | 13,135 | 354 | 375 | 130 | 121 | 10 |
| widget_heavy | 22,952 | 23,387 | 363 | 400 | 195 | 130 | 11 |
| many_messages | 18,235 | 19,438 | 481 | 7,965 | 231 | 150 | 22 |
| caching_app | 13,608 | 13,908 | 349 | 362 | 133 | 122 | 9 |
| fragment_app | 13,389 | 24,500 | 350 | 404 | 128 | 114 | 9 |
| dataframe_app | 14,980 | 15,957 | 353 | 388 | 319 | 208 | 150 |
