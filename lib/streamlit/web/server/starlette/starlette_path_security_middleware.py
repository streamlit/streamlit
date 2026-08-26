# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

r"""Path security middleware for blocking unsafe path patterns.

This middleware implements the "Swiss Cheese" defense model - it provides
an additional layer of protection that catches dangerous path patterns even
if individual route handlers forget to validate paths. This is especially
important for preventing SSRF attacks via Windows UNC paths.

Defense Layers
--------------
Layer 1 (this middleware): Catch-all for any route, including future routes
Layer 2 (route handlers): Defense-in-depth via build_safe_abspath() and
                          explicit is_unsafe_path_pattern() checks

Each layer has potential "holes" (ways it could fail):
- Middleware: Could be accidentally removed, misconfigured, or bypassed
- Route handlers: Developer could forget to add checks to new routes

By keeping both layers, an attack only succeeds if BOTH fail simultaneously.

Fast-Path Optimization
----------------------
For performance, certain known-safe routes skip the is_unsafe_path_pattern()
validation. This is a **performance optimization only**, not a security boundary.

IMPORTANT: The check order in __call__ is security-critical:
1. Double-slash UNC check (//server, \\\\server) runs FIRST on all requests
2. Fast-path bypass runs SECOND, only after UNC check passes
3. Full is_unsafe_path_pattern() validation runs on remaining requests

Never reorder these checks - the UNC check must always run before the fast-path.

Why upload_file/ is safe to skip:
The /_stcore/upload_file/{session_id}/{file_id} route uses session_id and file_id
as opaque dictionary keys in MemoryUploadedFileManager, never as filesystem paths.
Even a malicious session_id like "../../../etc/passwd" is just a failed dict lookup,
not a path traversal - the values are never passed to open() or os.path functions.

See Also
--------
streamlit.path_security : Core path validation functions used by this middleware
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.responses import Response

from streamlit.path_security import is_unsafe_path_pattern
from streamlit.url_util import make_url_path
from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_UPLOAD_FILE,
    ROUTE_HEALTH,
    ROUTE_HOST_CONFIG,
    ROUTE_METRICS,
    ROUTE_SCRIPT_HEALTH,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

# The upload_file route uses path params as opaque lookup keys (session_id/file_id),
# not filesystem paths, so it's safe to skip the pattern check.
# Add trailing slash to match only the upload prefix, not other routes.
_SAFE_ROUTE_UPLOAD_PREFIX = f"{BASE_ROUTE_UPLOAD_FILE}/"


def _build_safe_paths(base_url_path: str) -> tuple[frozenset[str], str]:
    """Build safe exact paths and prefix based on the base URL path.

    Parameters
    ----------
    base_url_path
        The configured server.baseUrlPath (e.g., "/myapp" or "").

    Returns
    -------
    tuple[frozenset[str], str]
        A tuple of (safe_exact_paths, safe_path_prefix) with the base URL prepended.
    """

    # Build full paths with base URL prefix
    safe_exact_paths = frozenset(
        {
            make_url_path(base_url_path, ROUTE_HEALTH),
            make_url_path(base_url_path, ROUTE_SCRIPT_HEALTH),
            make_url_path(base_url_path, ROUTE_METRICS),
            make_url_path(base_url_path, ROUTE_HOST_CONFIG),
        }
    )

    safe_path_prefix = make_url_path(base_url_path, _SAFE_ROUTE_UPLOAD_PREFIX)

    return safe_exact_paths, safe_path_prefix


class PathSecurityMiddleware:
    """ASGI middleware that blocks requests with unsafe path patterns.

    Implements Swiss Cheese defense - catches dangerous patterns even if
    route handlers forget to validate paths. This prevents SSRF attacks
    via Windows UNC paths and other path traversal vulnerabilities.

    Parameters
    ----------
    app
        The ASGI application to wrap.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

        # Build safe paths with the configured base URL path.
        # This is computed at middleware init time (when the app is created),
        # so config changes after app creation won't affect the safe paths.
        from streamlit import config

        base_url_path = config.get_option("server.baseUrlPath") or ""
        self._safe_exact_paths, self._safe_path_prefix = _build_safe_paths(
            base_url_path
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process incoming requests and block unsafe paths.

        Only validates HTTP requests; WebSocket and lifespan scopes are
        passed through without validation since they don't serve file content.
        """
        # Only validate HTTP requests (skip WebSocket, lifespan)
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        # SECURITY: Check for double-slash patterns BEFORE stripping slashes.
        # UNC paths like "//server/share" would be normalized to "server/share"
        # by lstrip("/"), making them look safe. We must reject these early.
        if path.startswith(("//", "\\\\")):
            response = Response(content="Bad Request", status_code=400)
            await response(scope, receive, send)
            return

        # Fast-path: Skip validation for known-safe routes that don't serve
        # user-controlled file paths (health checks, metrics, upload endpoints).
        # Use exact match for fixed endpoints to avoid over-matching future routes.
        if path in self._safe_exact_paths or path.startswith(self._safe_path_prefix):
            await self.app(scope, receive, send)
            return

        # Strip leading slash to get the relative path for validation
        relative_path = path.lstrip("/")

        # Check if the path contains unsafe patterns
        if relative_path and is_unsafe_path_pattern(relative_path):
            response = Response(content="Bad Request", status_code=400)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
