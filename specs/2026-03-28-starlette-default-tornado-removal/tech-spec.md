---
author: lukasmasuch
created: 2026-03-28
---

# Make Starlette the Default Server and Remove Tornado

## Summary

This spec proposes making Starlette/Uvicorn the default and only server implementation for
Streamlit, removing the legacy Tornado-based server. This simplifies the codebase by
eliminating dual implementations, reduces maintenance burden, and enables a cleaner path
toward ASGI-based features like `st.App`.

## Problem

Streamlit currently maintains two parallel server implementations:

1. **Tornado** (default): The original server implementation using Tornado + the Tornado
   event loop. Enabled by default.
2. **Starlette** (experimental): A newer ASGI-based implementation using Starlette +
   Uvicorn. Enabled via `server.useStarlette=true`.

This dual implementation creates several problems:

- **Maintenance burden**: Every server-related feature must be implemented twice (routes,
  WebSocket handlers, middleware, auth flows).
- **Code complexity**: ~2,500 lines of duplicate handler code across both implementations.
- **Testing overhead**: Both implementations need separate test coverage.
- **Feature parity risk**: Features may work differently or have subtle bugs between
  implementations.
- **Blocking future work**: Modern ASGI ecosystem features (mounting on FastAPI, native
  ASGI middleware) are only available with Starlette.

The Starlette implementation has been tested in production and is feature-complete with
the Tornado implementation. The `st.App` feature already exclusively uses Starlette.

**Related issues:**

- #14440: Starlette/ASGI feedback from user testing
- st.App development requires Starlette

## Proposal

### Phase 1: Make Starlette the Default

1. **Change default value** of `server.useStarlette` from `False` to `True` in `config.py`
2. **Update CLI** to use Starlette by default
3. **Add deprecation warning** when Tornado is explicitly enabled
4. **Update documentation** to reflect Starlette as the default

### Phase 2: Remove Tornado Implementation

After a deprecation period (1-2 minor releases), remove all Tornado-specific code:

#### Files to Remove

**Tornado server handlers (`lib/streamlit/web/server/`):**

| File | Description | Lines |
|------|-------------|-------|
| `browser_websocket_handler.py` | Tornado WebSocket handler | ~340 |
| `routes.py` | Tornado route handlers (StaticFileHandler, HealthHandler, etc.) | ~260 |
| `authlib_tornado_integration.py` | Tornado OAuth integration | varies |
| `oauth_authlib_routes.py` | Tornado OAuth route handlers | varies |
| `upload_file_request_handler.py` | Tornado file upload handler | varies |
| `media_file_handler.py` | Tornado media file handler | varies |
| `app_static_file_handler.py` | Tornado static file handler | varies |
| `component_request_handler.py` | Tornado component handler | varies |
| `bidi_component_request_handler.py` | Tornado bidirectional component handler | varies |

**Test files (`lib/tests/streamlit/web/server/`):**

| File | Description |
|------|-------------|
| `browser_websocket_handler_test.py` | WebSocket handler tests |
| `routes_test.py` | Route handler tests |
| `authlib_tornado_integration_test.py` | OAuth integration tests |
| `oauth_authlib_routes_test.py` | OAuth route tests |
| `upload_file_request_handler_test.py` | Upload handler tests |
| `media_file_handler_test.py` | Media handler tests |
| `app_static_file_handler_test.py` | Static file tests |
| `component_request_handler_test.py` | Component handler tests |
| `bidi_component_request_handler_test.py` | Bidi component tests |
| `server_test_case.py` | Tornado-specific test utilities |

#### Files to Modify

**`lib/streamlit/web/server/server.py`:**

- Remove `_create_app()` method (Tornado application factory)
- Remove `start_listening()`, `start_listening_tcp_socket()`, `start_listening_unix_socket()`
- Remove `get_tornado_settings()`, `_get_websocket_ping_interval_and_timeout()`
- Remove `_set_tornado_log_levels()`
- Remove `_use_starlette` flag and conditional logic
- Simplify to only use `UvicornServer` for starting

**`lib/streamlit/web/bootstrap.py`:**

- Remove `_fix_tornado_crash()` (Windows asyncio compatibility for Tornado)
- Remove conditional uvloop installation logic
- Simplify `run()` to always use Starlette path

**`lib/streamlit/config.py`:**

- Remove `server.useStarlette` option
- Update `_server_mode` to remove "tornado" value
- Update metrics/telemetry to reflect single server

**`lib/streamlit/web/server/server_util.py`:**

- Remove `is_tornado_version_less_than()` utility
- Remove `make_url_path_regex()` (Tornado-specific regex builder)
- Keep shared utilities (cookie secret, XSRF, origins)

**`lib/pyproject.toml`:**

- Move Starlette dependencies from `[project.optional-dependencies.starlette]` to
  `[project.dependencies]`
- Remove Tornado from `[project.dependencies]`

**`e2e_playwright/conftest.py`:**

- Update server configuration to use Starlette only
- Remove any Tornado-specific test configuration

**`proto/streamlit/proto/PageProfile.proto`:**

- Update `ServerMode` enum to remove `TORNADO` value

#### Shared Code to Retain

Some modules contain shared logic that should be kept and potentially renamed:

- `server_util.py` - Cookie secrets, XSRF helpers, origin validation (shared)
- `stats_request_handler.py` - Stats formatting logic (extract shared parts to util)
- `component_file_utils.py` - Path validation utilities (shared)
- `websocket_headers.py` - WebSocket header utilities (shared)
- `oidc_mixin.py` - OIDC logic (shared, used by Starlette auth routes)

### Phase 3: Cleanup and Optimization

1. **Rename/reorganize** Starlette modules to remove "starlette_" prefix since it's now
   the only implementation
2. **Consolidate** server configuration into a single module
3. **Update error messages** and documentation
4. **Remove** any remaining Tornado-related conditionals

## Implementation Details

### Config Changes

```python
# BEFORE (config.py)
_create_option(
    "server.useStarlette",
    description="""
        Enable the experimental Starlette-based server implementation...
    """,
    default_val=False,
    type_=bool,
)

# AFTER (Phase 1 - deprecation)
_create_option(
    "server.useStarlette",
    description="""
        DEPRECATED: Starlette is now the default server. This option will be
        removed in a future release. Set to false to use the legacy Tornado
        server (deprecated).
    """,
    default_val=True,
    type_=bool,
    deprecated=True,  # Add deprecation marker
)

# AFTER (Phase 2 - removal)
# Option removed entirely
```

### Server Mode Simplification

```python
# BEFORE (config.py)
_server_mode: Literal[
    "tornado", "starlette-managed", "starlette-app", "asgi-server", "asgi-mounted"
] | None = None

# AFTER
_server_mode: Literal[
    "starlette-cli",  # streamlit run (CLI managed)
    "starlette-app",  # st.App via streamlit run
    "asgi-server",    # st.App via external ASGI server
    "asgi-mounted",   # st.App mounted on another framework
] | None = None
```

### Dependency Changes

```toml
# BEFORE (pyproject.toml)
dependencies = [
    # ...
    "tornado>=6.0.3,<7,!=6.5.0",
    # ...
]

[project.optional-dependencies]
starlette = [
    "starlette>=0.40.0",
    "uvicorn>=0.30.0",
    "anyio>=4.0.0",
    "python-multipart>=0.0.10",
    "websockets>=12.0.0",
]

# AFTER
dependencies = [
    # ...
    "starlette>=0.40.0",
    "uvicorn>=0.30.0",
    "anyio>=4.0.0",
    "python-multipart>=0.0.10",
    "websockets>=12.0.0",
    # ...
]

# Tornado removed entirely
```

## Migration Guide

### For Users

1. **Default behavior changes**: If you relied on Tornado-specific behavior, explicitly
   set `server.useStarlette=false` during the deprecation period to continue using Tornado.
2. **Auth cookies**: Users with existing auth sessions may need to re-authenticate after
   switching servers (cookie signing format differs between Tornado and Starlette).
3. **Unix sockets**: Currently not supported with Starlette. Users relying on Unix sockets
   (`server.address=unix://...`) must switch to TCP or wait for Unix socket support to be
   added to the Starlette implementation.

### For Developers

1. **Server extensions**: Any custom Tornado handlers must be rewritten as Starlette
   routes.
2. **Testing**: Tornado-based test utilities (`ServerTestCase`) must migrate to
   async/ASGI testing patterns (e.g., using `httpx.AsyncClient` with `ASGITransport`).

## Alternatives Considered

### Keep Both Implementations Indefinitely

**Rejected** because:

- Perpetual maintenance burden (every feature implemented twice)
- Feature parity drift risk (subtle behavior differences)
- Blocks modern ASGI ecosystem features
- Confusing for users and contributors

### Rewrite Tornado to Use ASGI

**Rejected** because:

- Tornado's ASGI support is limited and not widely used
- Would still require maintaining Tornado-specific code
- Uvicorn is more actively maintained and widely used in the Python ecosystem
- Starlette/Uvicorn is the de facto standard for ASGI applications

### Immediate Removal Without Deprecation

**Rejected** because:

- Breaking change for users relying on Tornado-specific behavior
- No migration path for Unix socket users
- Risk of undiscovered edge cases

### Gradual Feature Migration (Proposed)

**Selected** - This is the proposed approach:

1. Make Starlette the default first
2. Allow users to fall back to Tornado during deprecation
3. Remove Tornado after deprecation period

This allows users to report issues before Tornado is fully removed.

## Testing Strategy

1. **Phase 1**:
   - Run full E2E test suite with `server.useStarlette=true` (already passing)
   - Add specific tests for deprecation warnings when Tornado is explicitly enabled
   - Verify all existing functionality works with Starlette default

2. **Phase 2**:
   - Ensure all existing Tornado tests have Starlette equivalents
   - Migrate test utilities from `ServerTestCase` to async patterns
   - Remove Tornado-specific tests after migration

3. **Continuous**:
   - Monitor Community Cloud and SiS deployments for regressions
   - Track user-reported issues during deprecation period

## Rollout Plan

| Version | Starlette | Tornado | Notes |
|---------|-----------|---------|-------|
| N (current) | Experimental (`useStarlette=true`) | Default | Current state |
| N+1 | Default | Deprecated (warning when used) | Phase 1 |
| N+2 or N+3 | Only implementation | Removed | Phase 2 |

Recommended timing: ~2 minor releases between Phase 1 and Phase 2 to allow adequate
user feedback and migration time.

## Out of Scope

- **Unix socket support for Starlette**: Can be added later if there's user demand
- **HTTP/2 support**: Not currently supported by either implementation
- **Custom ASGI middleware API for users**: Future work for st.App
- **WebSocket protocol changes**: Both implementations use the same protobuf protocol
