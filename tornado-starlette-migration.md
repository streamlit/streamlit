# Tornado → Starlette Migration

## 1. Overview

The Streamlit server currently relies on Tornado for HTTP routing, WebSocket transport, static asset delivery, file uploads, and authentication callbacks. Migrating this layer to Starlette/ASGI aims to modernize the server stack, unlock better async interoperability, and align with ecosystem tooling (uvicorn, lifespan events, middleware). This document captures the migration scope, feasibility, risks, and an execution plan. See the Starlette documentation for available primitives (routing, middleware, websockets, static files, background tasks) that we will leverage during this migration.[^starlette-docs]

## 2. Current Tornado Responsibilities

- **Entry point & lifecycle**: `lib/streamlit/web/server/server.py` constructs Tornado `Application` with handlers, configures SSL & port fallback, and coordinates start/stop with `Runtime`.
- **WebSocket handling**: `browser_websocket_handler.py` validates cookies/XSRF, handles session reconnect via `Sec-WebSocket-Protocol`, serializes protobuf messages, and triggers `Runtime.connect_session`/`disconnect_session`.
- **Static & media serving**:
  - `routes.StaticFileHandler` ensures cache headers, SPA fallback, `server.baseUrlPath` awareness, and reserved path bypass.
  - `app_static_file_handler.py` serves app-specific static directories with size/extension guardrails.
  - `media_file_handler.py` streams files from `MemoryMediaFileStorage` with `Content-Disposition` logic.
  - `component_request_handler.py` maps component bundles with symlink-safe path resolution.
- **Uploads**: `upload_file_request_handler.py` processes multipart uploads (PUT/DELETE), enforces session validity, and applies strict CORS headers based on XSRF config.
- **Metrics & health**: `routes.HealthHandler`, `StatsRequestHandler` expose healthz and OpenMetrics endpoints, injecting XSRF cookies and deprecation headers.
- **Authentication**: `oauth_authlib_routes.py` (login, logout, callback) uses Tornado ReqHandlers + `Authlib` integration (`authlib_tornado_integration.py`). Cookies set via Tornado helpers with Safari-specific flags.
- **Utilities**: `server_util.py` and `routes.py` provide CORS decisions, regex path builders, host-config data, port retry logic, websocket ping interval selection, etc. Multiple handlers depend on synchronous filesystem checks and explicit logging.

## 3. Mapping to Starlette Capabilities

- **Routing & middleware**: Starlette routers and mount points (with optional prefixes) can mirror Tornado’s regex-based routing, while custom middleware can encapsulate base-path stripping, CORS enforcement, and deprecation headers.[^starlette-routing]
- **Static files & downloads**: `starlette.staticfiles.StaticFiles` (with `html=True` for SPA fallback) handles packaged assets when not in dev mode. Custom endpoints using `StreamingResponse` can replace memory-backed media downloads while enforcing size/extension and `nosniff` headers. Dev-mode now mirrors Tornado by skipping the static mount, as validated via `test_static_files_skipped_in_dev_mode`.
- **WebSockets**: Starlette’s `WebSocket` class exposes headers, query params, and `accept(subprotocol=...)`, allowing us to parse multi-value `Sec-WebSocket-Protocol` entries and to send/receive binary payloads. Compression configuration will move to the ASGI server (uvicorn supports permessage-deflate via `--ws permessage-deflate`). A parity checklist now covers reconnect handshakes, debug control messages, subprotocol ordering, and ping interval/timeouts so we know exactly what to assert in tests.
  - Current status: reconnect handshakes, existing-session reuse, and cookie-parsed user info are covered by integration tests (`test_websocket_accepts_existing_session`, `test_websocket_auth_cookie_yields_user_info`).
- **Uploads**: Starlette supports multipart parsing via `request.form()` when `python-multipart` is installed. For chunked uploads we can stream via `request.stream()` or rely on background tasks for file persistence.
- **Metrics & health**: Use plain `Response`/`StreamingResponse` to emit text or protobuf bytes. Cookies (for XSRF) can be set through `Response.set_cookie` while matching Tornado’s security constraints.
- **CORS/XSRF matrix**: We maintain a per-endpoint table mirroring Tornado’s combinations (uploads, metrics, media, components, websocket handshake) so headers and credentials flags are exercised in tests and code reviews.
- **Host config**: Host-config parity (including the addition of `http://localhost` in dev mode) is covered by Starlette integration tests.
- **Authentication**: `authlib.integrations.starlette_client` replaces Tornado integration, with Starlette routes handling redirects and cookie writing. We must recreate Safari-compatible cookies (no `secure` flag) and payload size checks. Plan includes coverage for multi-provider secrets, error query params (`error`, `error_description`), and cookie decoding validation to ensure callback behavior matches Tornado in every branch.
  - Current status: Starlette tests now exercise login fallback, logout, callback success, error query handling, and missing provider scenarios with signed cookie verification.
- **Lifecycle management**: Starlette lifespan events (`on_startup`, `on_shutdown`) start/stop the `Runtime`. uvicorn provides CLI flags or programmatic configuration for SSL files, unix sockets, websocket ping interval/timeout, and compression; we must surface these via Streamlit config.[^starlette-lifespan] Port/protocol fallback (including retry loops when a port is occupied) and unix-socket handling need explicit design notes before beta to avoid regressions.
  - Current status: uvicorn start-up mirrors Tornado port retries and supports unix sockets (see `test_unix_socket_starlette`); remaining follow-up is documenting unix-socket deployment guidance for users.
- **Threading considerations**: Starlette offloads blocking calls to an anyio-managed thread pool. For heavy filesystem usage (`AppStaticFileHandler` checks), we may need explicit `anyio.to_thread.run_sync` wrappers to avoid blocking the event loop.

## 4. Lessons from PR #8430 Prototype

- Prototype introduced an ASGI server (`asgi_server.py`) and WebSocket handler but left core functionality stubbed (media handler, auth, static fallback). Many TODO comments indicated incomplete parity and missing tests.
- Commented-out Tornado methods (compression, logging) suggest compression & error handling were unresolved. We must ensure the Starlette migration retains compression toggles and robust logging.
- Integration with `Runtime` event loop was feasible; runtime continued to run under asyncio with ASGI server driving requests. However, bridging the Node dev server, static files, and CORS policies was unfinished.
- Conclusion: while foundational ASGI glue exists, full migration requires revisiting or rewriting large portions rather than resurrecting the draft wholesale.

## 5. Risk Assessment

### High Risk

- **WebSocket session model**: Reimplementing `BrowserWebSocketHandler` must preserve session reconnect semantics, XSRF/cookie validation, binary protobuf traffic, websocket ping/pong configuration, and debug control messages. Failure breaks reconnection, auth, and e2e tests.
- **Runtime orchestration**: Tornado currently manages SSL, unix sockets, dynamic port retries, and websocket ping intervals. Ensuring uvicorn-based startup/shutdown and lifespan hooks integrate with `Runtime` (without loop ownership conflicts) is non-trivial.
- **Authentication flow**: Authlib integration and cookie handling must be rebuilt; misalignment can lead to auth regressions, especially on Safari (secure cookie nuances) and secrets-driven configuration.

### Medium Risk

- **Static/media endpoints**: Migrating file-serving logic risks deviating on caching headers, MIME sniffing prevention, and download handling.
- **CORS/XSRF adherence**: Must replicate nuanced decisions across endpoints (allow-all flag, trusted headers, development mode behavior). Starlette’s canned `CORSMiddleware` may not suffice; we likely need custom middleware to mirror Tornado.
- **Dev server parity**: `global.developmentMode` currently swaps to Node dev server; need equivalent solution (proxying or middleware) in Starlette environment.
- **Feature dependencies**: Starlette requires `python-multipart` for form uploads and optional dependencies (`itsdangerous`) for session support. Repo packaging must include these.

### Low Risk

- **Metrics/health endpoints**: Straightforward but must preserve header-based deprecation notices and cookie priming.
- **Component registry wiring**: Mostly filesystem operations; easier to port.

## 6. Detailed Implementation Plan

1. **Foundational Abstractions (Prep Work)**
   - Introduce interfaces around HTTP/WebSocket handlers (e.g., `BrowserConnection`, `StaticAssetResponder`) to decouple Tornado-specific logic from runtime. Allow dual implementations during transition.
   - Add comprehensive tests (unit + integration) covering WebSocket reconnect (including multi-value subprotocol handshake), uploads, auth callbacks, static/metrics endpoints, websocket ping interval settings, and deprecation headers.

2. **Starlette Skeleton**
   - Build `starlette_server.py` that constructs a Starlette `Starlette` app mirroring Tornado routes under feature flag. Implement lifespan events (`@app.on_event("startup")`, `@app.on_event("shutdown")`) to start/stop `Runtime`.
   - Replicate `Server.start_listening` logic: pre-bind port/Unix socket, configure uvicorn programmatically with Streamlit config (SSL cert/key, `ws_ping_interval`, `ws_ping_timeout`, `ws_permessage_deflate`). Ensure `Runtime` event loop is reused or coordinate via asyncio run loop policy.

3. **WebSocket Adapter**
   - Implement `StarletteBrowserWebSocket` replicating Tornado handler: header parsing, cookie validation, session reconnect (leveraging `WebSocket.headers` and `websocket.accept(subprotocol=...)`), compression flag respect (pass through to uvicorn), and error handling via close codes.
   - Provide glue for `Runtime.connect_session`, `Runtime.disconnect_session`, and message enqueue/dequeue semantics using `websocket.send_bytes`/`receive_bytes`. Validate debug control messages, multi-value subprotocol negotiation, ping/pong timing, and permessage-deflate toggles with targeted unit/integration tests.

4. **HTTP Endpoints**
   - Port health, metrics, host-config, media, uploads, component, and static routes individually. Each endpoint should set identical headers (CORS, cache, content-type, deprecation). For SPA fallback, use `StaticFiles(html=True)` or custom 404 handler.
   - Confirmed dev-mode static skipping and host-config localhost gating through dedicated tests for the Starlette integration suite.
   - Recreate `UploadFileRequestHandler` semantics using Starlette `PUT`/`DELETE`, validating sessions via runtime API. Ensure multipart parsing works by declaring `python-multipart` dependency.
   - Implement middleware or utilities mirroring `allow_all_cross_origin_requests` and `is_allowed_origin`, with per-endpoint overrides where required (media, uploads, stats, components). Document and test the full CORS/XSRF matrix (allowed origins, credential flags, required headers) so regression detection is straightforward.

5. **Authentication**
   - Replace Tornado Authlib integration with Starlette equivalent: configure `Authlib` Starlette client, implement login/logout/callback routes, ensure cookies and redirects align with existing secrets config and `AuthCache` usage.
   - Write regression tests for auth flow, cookie size limits, error handling, origin validation, multi-provider selection, and Safari-compatible cookie semantics.

6. **Dev Mode & Static Proxy**
   - Dev-mode asset proxying remains handled by the Vite tooling; Starlette simply skips mounting static files when the flag is enabled, which matches current behavior and requires no additional proxy implementation.

7. **Feature Flag Rollout**
   - Introduce config flag (e.g., `server.useStarlette`) to toggle between Tornado and Starlette implementations. Allow early adopters to opt in while keeping Tornado as fallback.
   - Telemetry already records config option usage; no extra instrumentation is required beyond monitoring `server.useStarlette` adoption.

8. **Stabilization & Cleanup**
   - After parity validation, deprecate Tornado code paths, migrate tests to default Starlette stack, and remove feature flag.
   - Update documentation, deployment scripts, packaging (add Starlette/uvicorn/python-multipart dependencies), and remove Tornado references once stable.

## 7. Outstanding Questions / Follow-ups

- Confirm uvicorn’s ability to reuse the existing asyncio event loop so that `Runtime` continues operating without separate loop management.
- Decide whether to support alternative ASGI servers (Hypercorn) or standardize on uvicorn.
- Determine strategy for websocket compression flag toggles (`server.enableWebsocketCompression`) across ASGI stack.
- Validate performance impact of thread offloading for filesystem-heavy handlers and adjust with anyio thread pool tweaks if needed.
- Document port retry / unix socket behavior with uvicorn (including failure modes) and ensure the rollout plan includes tests for those scenarios.

## 8. Milestones & Implementation Steps

1. **Preparation & Abstractions (Weeks 0-2)**
   - Finalize adapter interfaces for HTTP handlers and WebSocket clients.
   - Land shared test helpers covering CORS, XSRF, reconnects, uploads, and metrics.
   - Add feature flag plumbing to config/CLI and introduce new dependencies (Starlette, uvicorn, python-multipart) behind optional installs.

2. **Starlette Prototype (Weeks 2-4)**
   - Implement minimal `starlette_server.py` with health & metrics endpoints, plus basic WebSocket echo wired to Runtime.
   - Run unit/integration tests to validate Runtime startup/shutdown via lifespan events.
   - Document open gaps (auth, uploads, static) before expanding scope.

3. **Feature Parity Build-Out (Weeks 4-8)**
   - Incrementally port each Tornado handler category (static, media, uploads, components, auth) with regression tests.
   - Implement WebSocket reconnect logic, session token validation, and compression flag handling.
   - Add development-mode proxy to Node dev server and confirm baseUrlPath support.

4. **Staged Rollout (Weeks 8-10)**
   - Enable opt-in via `server.useStarlette`, ship to internal/external beta, collect telemetry and bug reports.
   - Add CI coverage that exercises both Tornado and Starlette modes.

5. **Stabilization & Removal (Weeks 10-12+)**
   - Address beta feedback, expand docs, and update deployment scripts.
   - Switch default to Starlette once parity confirmed; deprecate Tornado, remove feature flag, and clean up code paths.

[^starlette-docs]: [Starlette Documentation](https://www.starlette.dev/)
[^starlette-routing]: Starlette routing and middleware primitives allow us to attach endpoints and create custom middleware while supporting path prefixes and mounts.[^starlette-docs]
[^starlette-lifespan]: Starlette provides startup/shutdown events and lifespan protocol hooks for coordinating background tasks and long-lived services like the Streamlit runtime.[^starlette-docs]
