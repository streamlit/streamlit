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

"""Static file handling for the Starlette server.

This is for serving the core Streamlit static assets (HTML/JS/CSS)
not related to the app static file serving feature.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, Final

from streamlit import file_util
from streamlit.path_security import is_unsafe_path_pattern
from streamlit.url_util import make_url_path
from streamlit.web.server.routes import (
    NO_CACHE_PATTERN,
    STATIC_ASSET_CACHE_MAX_AGE_SECONDS,
)

if TYPE_CHECKING:
    from collections.abc import MutableMapping

    from starlette.routing import BaseRoute
    from starlette.staticfiles import StaticFiles
    from starlette.types import Receive, Scope, Send

# Reserved paths that should return 404 instead of index.html fallback.
_RESERVED_STATIC_PATH_SUFFIXES: Final = ("_stcore/health", "_stcore/host-config")


def create_streamlit_static_handler(
    directory: str, base_url: str | None
) -> StaticFiles:
    """Create a static file handler used for serving Streamlit's static assets.

    This also handles:
    - SPA fallback (serving index.html on 404s for client-side routing)
    - Long-term caching of hashed assets
    - No-cache for HTML/manifest files
    - Trailing slash redirect (301)
    - Double-slash protection (400 for protocol-relative URL security)
    """
    from starlette.exceptions import HTTPException
    from starlette.responses import FileResponse, RedirectResponse, Response
    from starlette.staticfiles import StaticFiles

    class _StreamlitStaticFiles(StaticFiles):
        def __init__(self, directory: str, base_url: str | None) -> None:
            super().__init__(directory=directory, html=True)
            self._base_url = (base_url or "").strip("/")
            self._index_path = os.path.join(directory, "index.html")

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            """Handle incoming requests with security checks and redirects."""
            if scope["type"] != "http":
                await super().__call__(scope, receive, send)
                return

            path = scope.get("path", "")

            # Security check: Block paths starting with double slash (protocol-relative
            # URL protection). A path like //example.com could be misinterpreted as a
            # protocol-relative URL if redirected, which is a security risk.
            if path.startswith("//"):
                response = Response(content="Bad Request", status_code=400)
                await response(scope, receive, send)
                return

            # Security check: Block UNC paths, absolute paths, drive-qualified paths,
            # and path traversal patterns BEFORE any filesystem operations.
            # See is_unsafe_path_pattern() docstring for details.
            # Strip the leading slash since paths come in as "/filename" but we check
            # the relative portion.
            relative_path = path.lstrip("/")
            if relative_path and is_unsafe_path_pattern(relative_path):
                response = Response(content="Bad Request", status_code=400)
                await response(scope, receive, send)
                return

            # Handle trailing slash redirect: Returns 301 for paths with trailing
            # slashes (except root "/" or mount root).
            # We replicate this for consistent URL handling and to avoid duplicate
            # content issues. When mounted (e.g., at "/app"), scope["path"] is the
            # full path "/app/" and scope["root_path"] is "/app", so we must not
            # redirect the mount root to avoid infinite redirect loops.
            root_path = scope.get("root_path", "")
            if len(path) > 1 and path.endswith("/"):
                redirect_path = path.rstrip("/")
                # Don't redirect if we're at the mount root (path without slash equals root_path)
                if redirect_path == root_path:
                    await super().__call__(scope, receive, send)
                    return
                # Build redirect URL without trailing slash
                query_string = scope.get("query_string", b"")
                if query_string:
                    redirect_path += "?" + query_string.decode("latin-1")
                response = RedirectResponse(
                    url=redirect_path,
                    status_code=301,
                    headers={"Cache-Control": "no-cache"},
                )
                await response(scope, receive, send)
                return

            await super().__call__(scope, receive, send)

        async def get_response(
            self, path: str, scope: MutableMapping[str, Any]
        ) -> Response:
            served_path = path
            try:
                response = await super().get_response(path, scope)
            except HTTPException as exc:
                if exc.status_code != 404 or self._is_reserved(scope["path"]):
                    raise
                # Serve index.html for 404s (existing behavior):
                response = FileResponse(self._index_path)
                served_path = "index.html"

            self._apply_cache_headers(response, served_path)
            return response

        def _is_reserved(self, request_path: str) -> bool:
            """Check if the request path is reserved and should not fallback."""
            # Match Tornado's behavior: simple endswith check on the URL path.
            # TODO: Consider making this path-segment-aware in the future to avoid
            # false positives like "/my_stcore/health" matching "_stcore/health".
            url_path = request_path.split("?", 1)[0]
            return any(url_path.endswith(x) for x in _RESERVED_STATIC_PATH_SUFFIXES)

        def _apply_cache_headers(self, response: Response, served_path: str) -> None:
            """Apply cache headers matching Tornado's behavior."""
            if response.status_code in {301, 302, 303, 304, 307, 308}:
                return

            normalized = served_path.replace("\\", "/").lstrip("./")
            # Tornado marks HTML/manifest assets as no-cache but lets hashed bundles
            # live in cache. Keep that contract to avoid churning snapshots or CDNs.
            cache_value = (
                "no-cache"
                if not normalized or NO_CACHE_PATTERN.search(normalized)
                else f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
            )
            response.headers["Cache-Control"] = cache_value

    return _StreamlitStaticFiles(directory=directory, base_url=base_url)


def create_streamlit_static_assets_routes(base_url: str | None) -> list[BaseRoute]:
    """Create the static assets mount for serving Streamlit's core assets."""
    from starlette.routing import Mount

    static_assets = create_streamlit_static_handler(
        directory=file_util.get_static_dir(), base_url=base_url
    )
    # Strip trailing slash from the path because Starlette's Mount with a trailing
    # slash (e.g., "/myapp/") won't match requests without it (e.g., "/myapp").
    # Mount without trailing slash handles both cases by redirecting "/myapp" to
    # "/myapp/". Use "/" as fallback for root path.
    mount_path = make_url_path(base_url or "", "").rstrip("/") or "/"
    return [
        Mount(
            mount_path,
            app=static_assets,
            name="static-assets",
        )
    ]
