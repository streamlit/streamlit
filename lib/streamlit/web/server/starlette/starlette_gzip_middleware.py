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

from typing import TYPE_CHECKING, Final

import starlette
from starlette.middleware.gzip import GZipMiddleware

from streamlit.type_util import is_version_less_than
from streamlit.web.server.starlette.starlette_routes import (
    BASE_ROUTE_MEDIA,
    BASE_ROUTE_STATIC,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

# Starlette 1.5.0 gained two GZipMiddleware features that let it handle media
# and range responses on its own:
#   - It excludes already-compressed media content types by default (audio/*,
#     video/*, common raster images, archives, WOFF fonts; Starlette PR #3421).
#   - It skips compressing partial 206 responses (Starlette PR #3420).
# On those versions we route media and range requests through the stock
# middleware and let it decide by content type / status code, instead of
# bypassing the /media/ path and every Range request ourselves. Older versions
# (down to our >=0.46 floor) only exclude text/event-stream and always compress
# 206 responses, so for them we keep the path- and Range-based bypass.
_STARLETTE_HANDLES_MEDIA_AND_RANGE: Final = not is_version_less_than(
    starlette.__version__, "1.5.0"
)


def _strip_segment_prefix(path: str, prefix: str) -> str:
    """Strip ``prefix`` from ``path``, but only at a path-segment boundary.

    The prefix must match a whole leading segment, so prefix ``"/app"`` strips
    ``"/app/x"`` to ``"/x"`` but leaves ``"/application/x"`` untouched. An exact
    match collapses to ``"/"`` (the root document). Mirrors Starlette's
    ``get_route_path``.
    """
    if path == prefix:
        return "/"
    if path.startswith(f"{prefix}/"):
        return path[len(prefix) :]
    return path


def _strip_base_url(path: str, base_url: str) -> str:
    """Strip a configured ``base_url`` prefix from a request path.

    ``server.baseUrlPath`` can be configured with surrounding slashes (e.g.
    ``"/my-app/"``), so the prefix is normalized before stripping.
    """
    normalized_base = base_url.strip("/")
    if not normalized_base:
        return path
    return _strip_segment_prefix(path, f"/{normalized_base}")


def _should_bypass_gzip(path: str, base_url: str = "") -> bool:
    """Return whether a request path should always skip HTTP gzip compression.

    Bypasses the frontend static-asset route (``/static/...``) and the root
    document, on every Starlette version. See the inline comment in the body for
    why these best-compressing assets are deliberately served uncompressed.

    The media route (``/media/...``) is handled separately (see
    ``_is_media_path``), because on modern Starlette we prefer content-type
    exclusion over a path bypass.

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
    path = _strip_base_url(path, base_url)
    # Static bundles are highly compressible text, so this bypass looks
    # counterintuitive, but compressing them at the Python origin is a poor
    # tradeoff in practice:
    #   - Starlette's GZipMiddleware re-compresses the body on every request and
    #     never caches the output, and uvicorn has no sendfile/pathsend zero-copy
    #     path, so we burn CPU on every hit instead of serving the bytes straight
    #     from the OS page cache.
    #   - Bundles are content-hashed and served "immutable, max-age=1yr", so each
    #     client fetches an asset once: the win is a per-first-load bandwidth
    #     saving, while the CPU cost recurs and spikes during post-deploy
    #     thundering herds, competing with the event loop and script runs.
    #   - Production usually sits behind a reverse proxy / CDN that compresses and
    #     caches these responses, making origin compression redundant.
    # Local load testing confirmed this: the bypass materially improved initial
    # load time and peak RSS under concurrency (a session-only bypass regressed).
    # No content-type exclusion covers this, since the assets are text we
    # deliberately choose not to compress.
    if not path or path == "/":
        return True
    return path.startswith(f"/{BASE_ROUTE_STATIC}/")


def _is_media_path(path: str, base_url: str = "") -> bool:
    """Return whether a request path targets the media route (``/media/...``).

    The media route serves audio, video, images, and downloads. On Starlette
    versions before 1.5.0 this path is bypassed entirely, because those versions
    cannot exclude already-compressed media by content type and would corrupt
    range-based playback by compressing partial (206) responses. On newer
    versions the stock middleware applies instead: it excludes already-compressed
    types by content type and skips 206 responses natively, so only the
    compressible payloads on this path (e.g. text or octet-stream downloads) are
    still gzipped.
    """
    path = _strip_base_url(path, base_url)
    return path.startswith(f"/{BASE_ROUTE_MEDIA}/")


def _is_range_request(scope: Scope) -> bool:
    """Return whether the request carries a ``Range`` header.

    On Starlette versions before 1.5.0, ranged responses (HTTP 206) must not be
    gzip-compressed: the ``Content-Range`` and ``Content-Length`` headers
    describe the uncompressed byte range, so compressing the body would corrupt
    range-based playback and downloads (e.g. seeking in audio/video). Newer
    versions skip 206 responses natively, so this bypass is only used as a
    fallback for older Starlette.
    """
    return any(name == b"range" for name, _ in scope.get("headers", ()))


def _route_path(scope: Scope) -> str:
    """Return the request path relative to the ASGI ``root_path``.

    Streamlit can be served under a base URL via an ASGI mount or a reverse
    proxy that sets ``root_path`` (this works even without ``server.baseUrlPath``
    being configured). In that case ``scope["path"]`` still includes the mount
    prefix, so we strip it the same way Starlette's router does before matching
    bypass routes. Otherwise the static bypass (and, on older Starlette, the
    media bypass) would not match and those responses would be compressed.
    """
    path: str = scope.get("path", "")
    root_path = scope.get("root_path", "")
    if not root_path:
        return path
    return _strip_segment_prefix(path, root_path)


class SelectiveGZipMiddleware:
    """GZip middleware: always skip static/root; media/range only on old Starlette.

    The actual compression is delegated to Starlette's built-in
    ``GZipMiddleware``, so we inherit its behavior and future improvements
    (streaming handling, header rewriting, content-type exclusion, 206 handling,
    worker-thread offloading, etc.) instead of subclassing its internals. This
    wrapper only decides, per request, whether to route it through the gzip
    layer or serve it uncompressed.

    Static assets (``/static/...``) and the root document are always served
    uncompressed for load-time and peak-RSS reasons (see ``_should_bypass_gzip``,
    and ``_route_path`` for base-URL/mount handling).

    Media (``/media/...``) and ``Range`` requests are only bypassed on older
    Starlette; on >= 1.5.0 the stock middleware excludes already-compressed media
    by content type and skips partial 206 responses natively, so they are routed
    through it instead (see ``_STARLETTE_HANDLES_MEDIA_AND_RANGE``,
    ``_is_media_path``, and ``_is_range_request`` for the rationale).
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
        # Stock, unmodified Starlette middleware does all the real work. Its
        # default exclude_content_types already covers already-compressed media
        # on Starlette >= 1.5.0, so we do not override it.
        self._gzip_app = GZipMiddleware(
            app, minimum_size=minimum_size, compresslevel=compresslevel
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            route_path = _route_path(scope)
            if _should_bypass_gzip(route_path, self._base_url):
                # Serve static assets and the root document without compression.
                await self.app(scope, receive, send)
                return
            if not _STARLETTE_HANDLES_MEDIA_AND_RANGE and (
                _is_media_path(route_path, self._base_url) or _is_range_request(scope)
            ):
                # Legacy Starlette fallback: serve media and partial (range)
                # responses without compression. Compressing a range response
                # would corrupt it, since the Content-Range/Content-Length
                # describe the uncompressed bytes.
                await self.app(scope, receive, send)
                return

        await self._gzip_app(scope, receive, send)
