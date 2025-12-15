# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from streamlit.url_util import make_url_path
from streamlit.web.server.routes import (
    NO_CACHE_PATTERN,
    STATIC_ASSET_CACHE_MAX_AGE_SECONDS,
)

if TYPE_CHECKING:
    from collections.abc import MutableMapping

    from starlette.types import Receive, Scope, Send

# Reserved paths that should return 404 instead of index.html fallback.
_RESERVED_STATIC_PATH_SUFFIXES: Final = ("_stcore/health", "_stcore/host-config")


def create_streamlit_static_files(directory: str, base_url: str | None) -> Any:
    """Create a static file handler used for serving the Streamlit's static assets.

    This also handles:
    - SPA fallback (serving index.html on 404s for client-side routing)
    - Long-term caching of hashed assets
    - No-cache for HTML/manifest files
    - Trailing slash redirect (301)
    - Double-slash protection (403 for protocol-relative URL security)
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
            # This matches Tornado's behavior where such paths would escape the static
            # directory and trigger a 403 Forbidden.
            if path.startswith("//"):
                response = Response(content="Forbidden", status_code=403)
                await response(scope, receive, send)
                return

            # Handle trailing slash redirect: return
            # 301 for paths with trailing slashes (except root "/" or mount root).
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
            normalized = request_path.split("?", 1)[0].strip("/")
            if self._base_url and normalized.startswith(self._base_url):
                normalized = normalized[len(self._base_url) :].strip("/")
            return any(
                normalized.endswith(suffix) for suffix in _RESERVED_STATIC_PATH_SUFFIXES
            )

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


def create_streamlit_static_files_routes(
    directory: str, base_url: str | None
) -> list[Any]:
    """Create the static files mount for serving Streamlit's core assets."""
    from starlette.routing import Mount

    static_files = create_streamlit_static_files(directory=directory, base_url=base_url)
    return [Mount(make_url_path(base_url or "", ""), app=static_files, name="static")]
