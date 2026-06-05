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

"""Middleware that clears auth cookies that cannot be verified by the current server.

Background
----------
Streamlit 1.57.0 migrated the server backend from Tornado to Starlette.  The
two backends sign auth cookies (``_streamlit_user`` / ``_streamlit_user_tokens``)
with incompatible schemes:

* **Tornado** – ``set_signed_cookie`` / ``get_secure_cookie`` (HMAC-SHA256 over a
  proprietary format).
* **Starlette** – ``itsdangerous.URLSafeTimedSerializer`` (a different format and
  salt strategy).

A browser that was logged in under the Tornado backend retains valid-looking
cookies for up to 30 days after the upgrade.  Every subsequent request resends
those cookies; ``decode_signed_value`` rejects them silently (returns ``None``),
but *never instructs the browser to delete them*.  The result is that the app
appears stuck on the loading screen until the user manually clears cookies or
they expire naturally.

Fix
---
This middleware runs on every HTTP request.  Whenever it encounters an auth
cookie that is present in the request **but fails signature verification**
(i.e. ``decode_signed_value`` returns ``None``), it appends ``Set-Cookie`` delete
headers to the response so the browser discards those stale cookies immediately.

Chunked cookies (``_streamlit_user_1``, ``_streamlit_user_2``, …) are handled as
well: if the base cookie exists but is unverifiable, any related chunk cookies
are also deleted.

This middleware is intentionally limited to HTTP requests; WebSocket and
lifespan scopes are passed through without modification.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from streamlit.logger import get_logger
from streamlit.web.server.server_util import get_cookie_secret
from streamlit.web.server.starlette.starlette_app_utils import decode_signed_value
from streamlit.web.server.starlette.starlette_server_config import (
    TOKENS_COOKIE_NAME,
    USER_COOKIE_NAME,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

_LOGGER = get_logger(__name__)

# Auth cookies that should be verified and, if invalid, cleared.
_AUTH_COOKIE_NAMES: tuple[str, ...] = (USER_COOKIE_NAME, TOKENS_COOKIE_NAME)


def _cookie_names_to_clear(cookies: dict[str, str]) -> list[str]:
    """Return the names of all auth cookies that exist but fail verification.

    Includes chunk cookies (e.g. ``_streamlit_user_1``) when the base cookie
    indicates a chunked value.

    Parameters
    ----------
    cookies
        The request cookies as a plain ``{name: value}`` mapping.

    Returns
    -------
    list[str]
        Cookie names that should be deleted from the browser.
    """
    secret = get_cookie_secret()
    if not secret:
        return []

    names_to_delete: list[str] = []

    for base_name in _AUTH_COOKIE_NAMES:
        raw_value = cookies.get(base_name)
        if raw_value is None:
            # Cookie not present – nothing to do.
            continue

        # Attempt to verify the cookie with the current (Starlette) scheme.
        signed_bytes = raw_value.encode("latin-1")
        decoded = decode_signed_value(secret, base_name, signed_bytes)

        if decoded is not None:
            # Cookie is valid – leave it alone.
            continue

        # Cookie exists but cannot be verified.  Schedule it for deletion.
        _LOGGER.debug(
            "Auth cookie '%s' is present but could not be verified "
            "(possibly signed by an older Tornado backend). "
            "It will be cleared from the browser.",
            base_name,
        )
        names_to_delete.append(base_name)

        # Clean up numeric chunk cookies present in the request
        # (e.g. _streamlit_user_1, _streamlit_user_2, etc.)
        # Only match numeric suffixes to avoid accidentally deleting unrelated
        # cookies that happen to share the base name prefix (e.g. a hypothetical
        # _streamlit_user_prefs or _streamlit_user_settings).
        for key in cookies:
            if (
                key not in names_to_delete
                and key.startswith(f"{base_name}_")
                and key[len(base_name) + 1 :].isdigit()
            ):
                names_to_delete.append(key)

    return names_to_delete


def _build_delete_cookie_header(
    name: str, path: str, secure: bool = False, domain: str | None = None
) -> bytes:
    """Build a ``Set-Cookie`` header value that instructs the browser to delete *name*.

    Parameters
    ----------
    name
        The cookie name to delete.
    path
        The cookie path that was used when the cookie was originally set.
        Must match exactly, otherwise the browser will not delete the cookie.
    secure
        Whether to include the ``Secure`` flag.  This **must** match the flag
        that was present when the cookie was originally set — browsers treat
        ``Secure`` and non-``Secure`` cookies as distinct entries, so omitting
        it on an HTTPS deployment would leave the stale cookie in place.
        Pass ``True`` when ``server.sslCertFile`` is configured.
    domain
        Optional ``Domain`` attribute.  If the original Tornado cookies were
        issued with an explicit ``Domain`` (common in reverse-proxy or
        wildcard-domain deployments), the browser treats them as distinct
        entries from cookies without ``Domain``.  Omitting it here would cause
        the delete directive to silently miss those cookies.  Pass the value of
        ``server.cookieDomain`` when non-empty.

    Returns
    -------
    bytes
        The raw header value, ready to be appended to ``headers`` as
        ``(b"set-cookie", value)``.
    """
    header = f"{name}=; Path={path}; HttpOnly; SameSite=lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    if secure:
        header += "; Secure"
    if domain:
        header += f"; Domain={domain}"
    return header.encode("latin-1")


class InvalidAuthCookieMiddleware:
    """ASGI middleware that clears unverifiable auth cookies from the browser.

    This handles the regression introduced when upgrading from Streamlit ≤1.56
    (Tornado backend) to ≥1.57 (Starlette backend): browsers that were
    logged-in under the old backend retain cookies signed with Tornado's scheme,
    which the new server cannot verify.  Without this middleware those cookies
    are silently ignored on every request, leaving the app stuck on the loading
    screen until the cookies expire (up to 30 days).

    The middleware intercepts ``Set-Cookie`` delete headers onto *every* response
    for which unverifiable auth cookies are detected in the request.  Chunk
    cookies are cleaned up as well.

    Only HTTP request/response cycles are affected; WebSocket and lifespan scopes
    are forwarded unchanged.

    Parameters
    ----------
    app
        The ASGI application to wrap.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Process each ASGI event.

        For HTTP requests: inspect incoming cookies and, if any auth cookies
        are present but unverifiable, inject ``Set-Cookie`` delete directives
        into the response headers before forwarding them to the client.

        For all other scope types (``websocket``, ``lifespan``): delegate
        directly without modification.
        """
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Parse cookies from the request scope headers.
        raw_headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
        cookies: dict[str, str] = {}
        for header_name, header_value in raw_headers:
            if header_name.lower() == b"cookie":
                for part in header_value.decode("latin-1").split(";"):
                    part = part.strip()
                    if "=" in part:
                        k, _, v = part.partition("=")
                        cookies[k.strip()] = v.strip()

        names_to_delete = _cookie_names_to_clear(cookies)

        if not names_to_delete:
            # Fast-path: nothing to do; delegate immediately.
            await self.app(scope, receive, send)
            return

        # Determine the cookie path, Secure flag, and Domain from server
        # configuration so that the delete directive exactly matches the
        # attributes used when the cookie was originally set.
        from streamlit import config as st_config

        base_path: str | None = st_config.get_option("server.baseUrlPath")
        cookie_path = ("/" + base_path.strip("/")) if base_path else "/"
        secure = bool(st_config.get_option("server.sslCertFile"))
        domain: str | None = st_config.get_option("server.cookieDomain") or None

        delete_headers = [
            (b"set-cookie", _build_delete_cookie_header(name, cookie_path, secure=secure, domain=domain))
            for name in names_to_delete
        ]

        async def send_with_delete_cookies(message: dict) -> None:  # type: ignore[type-arg]
            if message["type"] == "http.response.start":
                # Append our delete-cookie headers to the response.
                existing: list[tuple[bytes, bytes]] = list(message.get("headers", []))
                message = {
                    **message,
                    "headers": existing + delete_headers,
                }
            await send(message)

        await self.app(scope, receive, send_with_delete_cookies)
