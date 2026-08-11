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

"""Custom GZip middleware for Streamlit HTTP responses."""

from __future__ import annotations

from typing import TYPE_CHECKING

from starlette.middleware.gzip import GZipMiddleware

from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_MEDIA,
    BASE_ROUTE_STATIC,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send


def _should_bypass_gzip(path: str, base_url: str = "") -> bool:
    """Return whether a request path should skip HTTP gzip compression.

    Compression is bypassed for two kinds of paths:

    - The frontend static-asset route (``/static/...``) and the root document.
      Local load testing showed that bypassing gzip here materially improves
      initial load time and peak RSS.
    - The media route (``/media/...``), which serves audio, video, images, and
      downloads. Compressing already-compressed binary media wastes CPU and,
      for audio/video, breaks range-request playback in some browsers.

    Parameters
    ----------
    path
        The request path from the ASGI scope. May include the ``base_url``
        prefix when ``server.baseUrlPath`` is configured.
    base_url
        The configured base URL path, if any. It is stripped from ``path``
        before matching so the checks work regardless of whether a base URL is
        configured.
    """
    normalized_base = base_url.strip("/")
    if normalized_base:
        prefix = f"/{normalized_base}"
        if path == prefix:
            return True
        if path.startswith(f"{prefix}/"):
            path = path[len(prefix) :]

    if not path or path == "/":
        return True

    return path.startswith((f"/{BASE_ROUTE_STATIC}/", f"/{BASE_ROUTE_MEDIA}/"))


def _is_range_request(scope: Scope) -> bool:
    """Return whether the request carries a ``Range`` header.

    Ranged responses (HTTP 206) must not be gzip-compressed: the
    ``Content-Range`` and ``Content-Length`` headers describe the uncompressed
    byte range, so compressing the body would corrupt range-based playback and
    downloads (e.g. seeking in audio/video).
    """
    return any(name == b"range" for name, _ in scope.get("headers", ()))


def _route_path(scope: Scope) -> str:
    """Return the request path relative to the ASGI ``root_path``.

    Streamlit can be served under a base URL via an ASGI mount or a reverse
    proxy that sets ``root_path`` (this works even without ``server.baseUrlPath``
    being configured). In that case ``scope["path"]`` still includes the mount
    prefix, so we strip it the same way Starlette's router does before matching
    bypass routes. Otherwise the ``/static/`` and ``/media/`` bypass would not
    match and those responses would be compressed.
    """
    path: str = scope.get("path", "")
    root_path = scope.get("root_path", "")
    if not root_path or not path.startswith(root_path):
        return path
    # Only strip at a path-segment boundary, so e.g. root_path "/app" does not
    # match "/application" (mirrors Starlette's get_route_path).
    if path == root_path:
        return "/"
    if path[len(root_path)] == "/":
        return path[len(root_path) :]
    return path


class SelectiveGZipMiddleware:
    """GZip middleware that skips compression for static and media paths.

    The actual compression is delegated to Starlette's built-in
    ``GZipMiddleware``, so we inherit its behavior and future improvements
    (streaming handling, header rewriting, ``text/event-stream`` exclusion,
    worker-thread offloading, etc.) instead of subclassing its internals. This
    wrapper only decides, per request, whether to route it through the gzip
    layer or serve it uncompressed (see ``_should_bypass_gzip``, ``_route_path``
    for base-URL/mount handling, and the range-request handling in ``__call__``).

    The bypass is path-based rather than content-type-based, so audio/video
    served from routes other than ``/media/`` (e.g. custom-component assets or
    ``/app/static/``) may now be compressed on full 200 responses. This is an
    intentional trade-off: the universal ``Range``-request bypass still applies,
    and browsers issue range requests for seeking, so media playback and seeking
    stay safe while the built-in ``st.audio``/``st.video``/``st.image`` path
    (served from ``/media/``) remains fully bypassed.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        minimum_size: int = 500,
        compresslevel: int = 9,
        base_url: str = "",
    ) -> None:
        self.app = app
        self._base_url = base_url
        # Stock, unmodified Starlette middleware does all the real work.
        self._gzip_app = GZipMiddleware(
            app, minimum_size=minimum_size, compresslevel=compresslevel
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and (
            _should_bypass_gzip(_route_path(scope), self._base_url)
            or _is_range_request(scope)
        ):
            # Serve static assets, media, and partial (range) responses without
            # compression. Compressing a range response would corrupt it, since
            # the Content-Range/Content-Length describe the uncompressed bytes.
            await self.app(scope, receive, send)
            return

        await self._gzip_app(scope, receive, send)
