# Starlette optimization plan

## Goal

Improve the performance of the Starlette-based Streamlit server, with special focus on the regressions seen in load testing versus Tornado:

- slower initial page load
- higher peak RSS
- higher average RSS
- higher thread counts
- occasional worse tail latency

This document combines:

- inspection of the Starlette migration code in `lib/streamlit/web/server/starlette`
- inspection of the runtime send loop in `lib/streamlit/runtime/runtime.py`
- inspection of the load-test harness in `e2e_playwright/load_testing`
- official Starlette, Uvicorn, and websockets documentation
- a small local validation run on the current branch

## Executive summary

The current evidence suggests that the biggest regressions are on the cold HTTP startup path, not the rerun path.

The most important findings are:

1. The load harness measures end-to-end browser startup, not just backend runtime. It includes HTML, JS/CSS asset fetches, websocket connection setup, and frontend render time.
2. Starlette adds meaningful overhead on that startup path through:
   - ASGI/middleware routing
   - AnyIO threadpool usage for file serving
   - the current Uvicorn HTTP parser choice
3. The current Starlette websocket bridge also adds overhead:
   - one `asyncio.Queue` per client
   - one background sender task per client
4. A low-effort local experiment had a large effect:
   - after installing `httptools`, `uvicorn` switched from the pure-Python HTTP path to `HttpToolsProtocol`
   - on a local `simple_app` run with 10 concurrent sessions, mean initial load time dropped from `3402 ms` to `1504 ms` (`-55.8%`)
   - p95 initial load dropped from `3660 ms` to `1601 ms` (`-56.3%`)
   - mean rerun time improved from `425 ms` to `363 ms` (`-14.5%`)

The strongest immediate conclusion is that Starlette should not be evaluated or shipped in environments that are missing the intended performance extras.

## What I validated

### 1. The load test emphasizes cold startup

The harness in `e2e_playwright/load_testing/worker.py` measures:

- `page.goto(server_url)` plus `wait_for_app_run(page)` for initial load
- interaction plus `wait_for_app_run(page)` for reruns

This means the reported initial-load regression includes:

- backend HTTP request handling
- static asset serving
- websocket establishment
- frontend bundle download and execution
- browser-side contention from many Playwright Chromium workers

### 2. Starlette static serving uses AnyIO threadpool and async file I/O

Official Starlette docs confirm:

- Starlette uses a thread pool for several internal operations
- the default AnyIO limiter is `40` tokens
- `FileResponse` and `StaticFiles` use threadpool work and file I/O internally

Local validation:

- the installed AnyIO default thread limiter is `40`
- this lines up well with the observed thread counts in Starlette runs
- `starlette.staticfiles.StaticFiles` and `starlette.responses.FileResponse` both use `anyio.to_thread.run_sync(...)`

This is likely a major contributor to:

- higher thread count
- higher RSS during cold page load
- additional per-asset overhead under many simultaneous cold browsers

### 3. The current Starlette websocket path adds per-session async machinery

`lib/streamlit/web/server/starlette/starlette_websocket.py` currently creates:

- one bounded `asyncio.Queue` per session
- one background sender task per session

That is a clean implementation, but it adds:

- per-session memory
- more runnable tasks on the event loop
- more scheduling overhead while flushing many messages

### 4. The runtime loop may amplify scheduler overhead

`lib/streamlit/runtime/runtime.py` still:

- yields with `await asyncio.sleep(0)` after each sent message
- sleeps `0.01s` between flush passes

That behavior predates this branch, but it likely interacts worse with the Starlette websocket bridge because there are now more tasks and more hops per outbound message.

### 5. Local `httptools` experiment

Before the experiment:

- `uvloop` was installed
- `httptools` was not installed
- `uvicorn` therefore could not use its faster HTTP parser

After installing `httptools`, `uvicorn` selected:

- `uvicorn.protocols.http.httptools_impl.HttpToolsProtocol`
- `uvicorn.protocols.websockets.websockets_impl.WebSocketProtocol`

Local benchmark on this branch:

Scenario: `simple_app`

Concurrency: `10`

Results before `httptools`:

- mean initial load: `3401.9 ms`
- p95 initial load: `3660.0 ms`
- mean rerun: `424.9 ms`
- peak RSS: `107.2 MB`
- max threads: `47`

Results after `httptools`:

- mean initial load: `1503.9 ms`
- p95 initial load: `1601.1 ms`
- mean rerun: `363.1 ms`
- peak RSS: `116.7 MB`
- max threads: `51`

Interpretation:

- `httptools` is a very high-confidence fix for cold HTTP startup throughput
- the memory and thread changes in this small run were neutral-to-slightly-worse, so it looks like a latency/throughput win first, not a memory win

### 6. Baseline local re-run limitation

I attempted to rerun the exact baseline commit (`26a7b56174ea378ca7c74e513d74fc536af186f2`) locally, but the server failed to start in the local Python 3.13 environment during the load-test setup. Because of that, I used:

- the CI numbers you provided for Tornado vs Starlette
- the local Starlette-only validation run

So the local benchmark in this document is best treated as a targeted Starlette optimization validation, not a full local Tornado-vs-Starlette reproduction.

## Top 15 tips

### 1. Ensure `httptools` is installed anywhere Starlette is benchmarked or shipped

Priority: `P0`

Expected impact: `High`

Confidence: `Validated locally`

Why:

- Uvicorn documents `httptools` as the faster HTTP implementation
- local measurement showed a large startup win immediately after installing it

Recommended action:

- add `httptools` to the environments used for Starlette load testing
- strongly consider making it part of the default install path for Starlette mode on Linux/macOS

Files:

- `lib/pyproject.toml`
- `pyproject.toml`
- `lib/streamlit/web/server/starlette/starlette_server.py`

### 2. Log the actual Uvicorn HTTP/WS/loop backends at startup

Priority: `P0`

Expected impact: `Low` by itself, `High` for correctness and debugging

Confidence: `High`

Why:

- without explicit logging, it is easy to benchmark the wrong stack accidentally
- the current branch was running `uvloop` but not `httptools`, which materially changed conclusions

Recommended action:

- after `uvicorn.Config.load()`, log the selected HTTP protocol, WS protocol, and loop backend
- warn when running Starlette without performance extras in supported environments

Files:

- `lib/streamlit/web/server/starlette/starlette_server.py`

### 3. Prefer `httptools` explicitly when available, instead of relying on `auto`

Priority: `P0`

Expected impact: `High`

Confidence: `High`

Why:

- `auto` is convenient but opaque
- a missing optional dependency silently downgrades performance

Recommended action:

- if `httptools` is importable, set `http="httptools"`
- otherwise keep `auto` or `h11` with a warning

Files:

- `lib/streamlit/web/server/starlette/starlette_server.py`

### 4. Reduce middleware work on the static-asset path

Priority: `P0`

Expected impact: `High` for initial load, `Medium` for RSS

Confidence: `High`

Why:

- the current cold-load regression is much larger than the rerun regression
- static assets likely traverse `PathSecurityMiddleware`, `SessionMiddleware`, and gzip middleware before they reach the mounted handler

Recommended action:

- verify exactly which middleware layers wrap the mounted static app
- if possible, serve core frontend assets from a lighter ASGI sub-app or bypass session middleware for those paths
- keep security checks, but avoid work that is not needed for hashed frontend bundles

Files:

- `lib/streamlit/web/server/starlette/starlette_app.py`
- `lib/streamlit/web/server/starlette/starlette_static_routes.py`

### 5. Consider serving core frontend assets outside Python in production

Priority: `P0`

Expected impact: `High` in real deployments, `Low` for single-process local dev

Confidence: `High`

Why:

- Uvicorn docs recommend running behind Nginx and/or a CDN
- static bundles are ideal for proxy/CDN caching
- this can remove a large amount of asset-serving work from the application process

Recommended action:

- for production deployments, terminate static asset traffic in Nginx or CDN
- keep Python responsible for dynamic routes and websocket traffic

Note:

- this will not improve the current CI benchmark unless the benchmark environment is changed

### 6. Rework the Starlette websocket send bridge to reduce per-session overhead

Priority: `P1`

Expected impact: `Medium` to `High`

Confidence: `High`

Why:

- each session currently allocates a queue and a sender task
- that design is simple but may be expensive at high concurrency

Recommended action:

- benchmark alternatives to the per-session sender task
- consider:
  - direct event-loop scheduling without a persistent sender task
  - a smaller number of shared sender workers
  - batching multiple `ForwardMsg` payloads before waking the sender

Files:

- `lib/streamlit/web/server/starlette/starlette_websocket.py`

### 7. Revisit the runtime flush loop and remove avoidable scheduler churn

Priority: `P1`

Expected impact: `Medium`

Confidence: `High`

Why:

- `await asyncio.sleep(0)` after every message can become expensive with many sessions
- the `0.01s` delay between flush passes may also increase tail latency or waste cycles depending on load shape

Recommended action:

- benchmark batching sends per session before yielding
- experiment with:
  - yielding after N messages instead of every message
  - a shorter or adaptive inter-pass sleep
  - event-driven wakeups instead of periodic tiny sleeps

Files:

- `lib/streamlit/runtime/runtime.py`

### 8. Add instrumentation for websocket queue depth and sender lag

Priority: `P1`

Expected impact: `Low` by itself, `High` for optimization guidance

Confidence: `High`

Why:

- without queue-depth or lag metrics, it is hard to know whether the websocket bridge is actually the bottleneck in real runs

Recommended action:

- add optional debug metrics for:
  - per-session queue depth
  - average queue drain latency
  - dropped/disconnected clients due to full send queue
  - active sender task counts

Files:

- `lib/streamlit/web/server/starlette/starlette_websocket.py`
- `lib/streamlit/runtime/runtime.py`

### 9. Make the AnyIO thread limiter configurable and benchmark a small matrix

Priority: `P1`

Expected impact: `Medium`

Confidence: `Medium`

Why:

- Starlette defaults to a `40`-token threadpool
- that likely explains a lot of the higher thread counts and some of the RSS increase
- smaller limits may reduce memory footprint, while larger limits may help startup throughput

Recommended action:

- make the threadpool token count configurable for benchmarking
- try a matrix such as `16`, `24`, `40`, `64`
- evaluate both:
  - initial-load latency
  - peak RSS and max thread count

Important:

- do not assume "more threads = faster"
- the goal is to find the best latency/memory tradeoff for Streamlit's asset and upload behavior

### 10. Keep websocket compression disabled by default, and tune carefully if enabled

Priority: `P1`

Expected impact: `Medium`

Confidence: `High`

Why:

- websocket per-message-deflate can save bandwidth, but official websockets docs note additional memory and CPU cost
- the docs also show that compression settings materially change per-connection memory usage
- for high-connection servers, unnecessary compression can add noticeable memory overhead

Recommended action:

- keep `server.enableWebsocketCompression = false` unless there is a measured bandwidth need
- if enabling compression later, benchmark smaller window/memory settings instead of defaults

Files:

- `lib/streamlit/config.py`
- `lib/streamlit/web/server/starlette/starlette_server.py`

### 11. Benchmark alternative websocket implementations in Uvicorn

Priority: `P2`

Expected impact: `Low` to `Medium`

Confidence: `Medium`

Why:

- Uvicorn supports multiple websocket protocol backends
- different implementations can have different CPU, memory, and backpressure behavior

Recommended action:

- compare:
  - `websockets`
  - `websockets-sansio`
  - `wsproto`
- use the scenarios that stress message volume and concurrency:
  - `many_messages_app`
  - `widget_heavy_app`
  - `fragment_app`

Files:

- `lib/streamlit/web/server/starlette/starlette_server.py`

### 12. Reduce Python-level static file work where possible

Priority: `P2`

Expected impact: `Medium`

Confidence: `Medium`

Why:

- Starlette's `StaticFiles` and `FileResponse` do multiple Python-level operations per file request:
  - path lookup
  - stat
  - conditional header logic
  - file open/read

Recommended action:

- benchmark whether precomputed metadata, precompressed bundles, or alternate serving paths help
- check whether the ASGI server can use more efficient file-send mechanisms on the target platform

Files:

- `lib/streamlit/web/server/starlette/starlette_static_routes.py`
- `lib/streamlit/web/server/starlette/starlette_routes.py`

### 13. Separate cold-start benchmarks from rerun benchmarks in CI

Priority: `P2`

Expected impact: `High` for decision quality

Confidence: `High`

Why:

- the current load suite mixes:
  - asset-fetch costs
  - websocket setup
  - frontend execution
  - backend runtime behavior
- this makes it harder to know which optimization moved the needle

Recommended action:

- add a warm-cache mode or rerun-only mode
- report separate summaries for:
  - initial load
  - websocket connect
  - rerun
  - server-side RSS/thread usage

Files:

- `e2e_playwright/load_testing/worker.py`
- `e2e_playwright/load_testing/test_load.py`

### 14. Add targeted profiling hooks for cold-start hotspots

Priority: `P2`

Expected impact: `Low` by itself, `High` for future wins

Confidence: `High`

Why:

- once the obvious wins are applied, profiling will be needed to find the next tier of issues

Recommended action:

- add optional profiling around:
  - static asset requests
  - websocket accept/connect_session
  - `serialize_forward_msg`
  - browser queue flush time

Good candidates:

- wall-clock timing around route handlers
- queue-depth sampling
- per-request counters for static files

### 15. Use multi-process deployment for real production concurrency

Priority: `P2`

Expected impact: `High` in production, `Not applicable` to current single-process CI benchmark

Confidence: `High`

Why:

- the load test currently runs one server process
- in production, multiple worker processes can spread:
  - asset traffic
  - websocket accept load
  - Python heap pressure

Recommended action:

- for production guidance, document a supported multi-process Starlette deployment story
- pair it with a reverse proxy for websocket forwarding and static assets

Important:

- this is a deployment optimization, not a code-path optimization
- it should not be used to explain away single-process regressions in the benchmark

## Recommended rollout order

### Phase 1: Immediate, low-risk

1. Ensure `httptools` is installed in Starlette benchmark and runtime environments.
2. Log the selected Uvicorn backends at startup.
3. If `httptools` is present, prefer it explicitly over `auto`.
4. Validate whether middleware is wrapping the static assets path unnecessarily.

### Phase 2: Highest-value code work

5. Reduce middleware overhead on static routes.
6. Rework the websocket send bridge.
7. Revisit runtime flush batching and yielding.
8. Add queue-depth and send-lag metrics.

### Phase 3: Tune and harden

9. Benchmark AnyIO thread limiter settings.
10. Benchmark websocket backend variants.
11. Keep websocket compression conservative and measured.
12. Add profiling hooks and split CI metrics by startup vs rerun.

### Phase 4: Deployment guidance

13. Recommend proxy/CDN static serving in production.
14. Recommend multi-process Uvicorn deployment for production.
15. Add a documented performance checklist for Starlette deployments.

## Suggested benchmark matrix

If we want to turn this plan into an implementation campaign, this is the order I would benchmark changes in:

1. Current branch, current environment
2. Current branch + `httptools`
3. Current branch + static path bypass / lighter middleware
4. Current branch + websocket bridge optimization
5. Current branch + runtime flush batching
6. Current branch + tuned AnyIO thread limit

Scenarios to prioritize:

- `simple_app`: best signal for fixed startup overhead
- `fragment_app`: good signal for rerun and websocket path
- `many_messages_app`: best signal for message-heavy websocket behavior
- `dataframe_app`: best signal for large payload serialization

## References

- Starlette threadpool docs: <https://starlette.dev/threadpool/>
- Starlette static files docs: <https://starlette.dev/staticfiles/>
- Uvicorn settings docs: <https://uvicorn.dev/settings/>
- Uvicorn deployment docs: <https://uvicorn.dev/deployment/>
- websockets compression docs: <https://websockets.readthedocs.io/en/12.0/topics/compression.html>
