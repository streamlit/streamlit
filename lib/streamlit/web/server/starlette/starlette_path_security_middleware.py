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

"""Path security middleware for blocking unsafe path patterns.

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

See Also
--------
streamlit.path_security : Core path validation functions used by this middleware
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.responses import Response

from streamlit.path_security import is_unsafe_path_pattern

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send


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

        # Strip leading slash to get the relative path for validation
        relative_path = path.lstrip("/")

        # Check if the path contains unsafe patterns
        if relative_path and is_unsafe_path_pattern(relative_path):
            response = Response(content="Bad Request", status_code=400)
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
