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

"""Unit tests for starlette_invalid_auth_cookie_middleware module.

These tests cover the regression introduced in Streamlit 1.57.0 (GitHub #15407):
when upgrading from the Tornado backend (≤1.56) to the Starlette backend (≥1.57),
browsers that were previously logged-in continue to send auth cookies signed by
Tornado's scheme.  The new Starlette server cannot verify those cookies; without
the middleware, the app is stuck on the loading screen until the cookies expire.
"""

from __future__ import annotations

from http.cookies import SimpleCookie
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette.starlette_app_utils import create_signed_value
from streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware import (
    InvalidAuthCookieMiddleware,
    _cookie_names_to_clear,
)
from streamlit.web.server.starlette.starlette_server_config import (
    TOKENS_COOKIE_NAME,
    USER_COOKIE_NAME,
)

if TYPE_CHECKING:
    pass

_COOKIE_SECRET = "test-cookie-secret"
_TORNADO_LIKE_VALUE = "2|fake|tornado|signed|cookie|value"  # Unverifiable by Starlette


def _make_app() -> Starlette:
    """Build a minimal Starlette app with InvalidAuthCookieMiddleware for testing."""

    async def root(_request):  # type: ignore[no-untyped-def]
        return PlainTextResponse("ok")

    app = Starlette(routes=[Route("/", root, methods=["GET"])])
    app.add_middleware(InvalidAuthCookieMiddleware)
    return app


def _valid_cookie(name: str, value: str = '{"is_logged_in": true}') -> str:
    """Return a properly signed cookie value (Starlette / itsdangerous scheme)."""
    signed: bytes = create_signed_value(_COOKIE_SECRET, name, value)
    return signed.decode("utf-8")


# ---------------------------------------------------------------------------
# _cookie_names_to_clear unit tests
# ---------------------------------------------------------------------------


class TestCookieNamesToClear:
    """Tests for the _cookie_names_to_clear helper."""

    def test_no_auth_cookies_present(self) -> None:
        """Returns an empty list when no auth cookies are in the request."""
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear({})
        assert result == []

    def test_valid_user_cookie_not_cleared(self) -> None:
        """A properly signed user cookie must NOT be scheduled for deletion."""
        cookie_value = _valid_cookie(USER_COOKIE_NAME)
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear({USER_COOKIE_NAME: cookie_value})
        assert USER_COOKIE_NAME not in result

    def test_invalid_user_cookie_scheduled_for_deletion(self) -> None:
        """An unverifiable user cookie (e.g. Tornado-signed) is scheduled for deletion."""
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear({USER_COOKIE_NAME: _TORNADO_LIKE_VALUE})
        assert USER_COOKIE_NAME in result

    def test_invalid_tokens_cookie_scheduled_for_deletion(self) -> None:
        """An unverifiable tokens cookie is scheduled for deletion."""
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear({TOKENS_COOKIE_NAME: _TORNADO_LIKE_VALUE})
        assert TOKENS_COOKIE_NAME in result

    def test_both_invalid_cookies_scheduled(self) -> None:
        """Both user and tokens cookies, when invalid, are both scheduled."""
        cookies = {
            USER_COOKIE_NAME: _TORNADO_LIKE_VALUE,
            TOKENS_COOKIE_NAME: _TORNADO_LIKE_VALUE,
        }
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear(cookies)
        assert USER_COOKIE_NAME in result
        assert TOKENS_COOKIE_NAME in result

    def test_chunk_cookies_included_when_base_is_invalid(self) -> None:
        """Chunk cookies are also cleared when their base cookie is invalid."""
        cookies = {
            USER_COOKIE_NAME: _TORNADO_LIKE_VALUE,
            f"{USER_COOKIE_NAME}_1": "chunk1",
            f"{USER_COOKIE_NAME}_2": "chunk2",
        }
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            result = _cookie_names_to_clear(cookies)
        assert USER_COOKIE_NAME in result
        assert f"{USER_COOKIE_NAME}_1" in result
        assert f"{USER_COOKIE_NAME}_2" in result

    def test_no_secret_returns_empty(self) -> None:
        """When no cookie secret is configured, no cookies are cleared."""
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value="",
        ):
            result = _cookie_names_to_clear({USER_COOKIE_NAME: _TORNADO_LIKE_VALUE})
        assert result == []


# ---------------------------------------------------------------------------
# Integration tests via Starlette TestClient
# ---------------------------------------------------------------------------


class TestInvalidAuthCookieMiddleware:
    """Integration tests for InvalidAuthCookieMiddleware."""

    def test_response_200_without_any_cookies(self) -> None:
        """Requests without auth cookies are served normally."""
        client = TestClient(_make_app())
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            response = client.get("/")
        assert response.status_code == 200
        # No Set-Cookie header should be added
        set_cookie_headers = [
            v
            for k, v in response.headers.items()
            if k.lower() == "set-cookie" and "streamlit_user" in v
        ]
        assert set_cookie_headers == []

    def test_valid_cookies_not_cleared(self) -> None:
        """Valid (Starlette-signed) auth cookies are not cleared."""
        client = TestClient(_make_app())
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            response = client.get(
                "/",
                cookies={USER_COOKIE_NAME: _valid_cookie(USER_COOKIE_NAME)},
            )
        assert response.status_code == 200
        # Middleware should not add a delete directive for valid cookies
        all_set_cookie: list[str] = response.headers.get_list("set-cookie")
        for header in all_set_cookie:
            # A delete directive has Max-Age=0; valid cookies must not be deleted
            assert not ("Max-Age=0" in header and USER_COOKIE_NAME in header)

    def test_invalid_user_cookie_cleared_in_response(self) -> None:
        """An unverifiable user cookie triggers a Set-Cookie delete directive."""
        client = TestClient(_make_app())
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            response = client.get(
                "/",
                cookies={USER_COOKIE_NAME: _TORNADO_LIKE_VALUE},
            )
        assert response.status_code == 200

        # Find all Set-Cookie headers
        set_cookie_raw = response.headers.get("set-cookie", "")
        # TestClient may merge; iterate over raw headers
        all_set_cookie: list[str] = response.headers.get_list("set-cookie")

        # At least one header should delete _streamlit_user with Max-Age=0
        delete_headers = [h for h in all_set_cookie if USER_COOKIE_NAME in h and "Max-Age=0" in h]
        assert delete_headers, (
            f"Expected a Set-Cookie delete directive for {USER_COOKIE_NAME!r} "
            f"but got: {all_set_cookie}"
        )

    def test_invalid_tokens_cookie_cleared_in_response(self) -> None:
        """An unverifiable tokens cookie triggers a Set-Cookie delete directive."""
        client = TestClient(_make_app())
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            response = client.get(
                "/",
                cookies={TOKENS_COOKIE_NAME: _TORNADO_LIKE_VALUE},
            )
        assert response.status_code == 200

        all_set_cookie: list[str] = response.headers.get_list("set-cookie")

        delete_headers = [h for h in all_set_cookie if TOKENS_COOKIE_NAME in h and "Max-Age=0" in h]
        assert delete_headers, (
            f"Expected a Set-Cookie delete directive for {TOKENS_COOKIE_NAME!r} "
            f"but got: {all_set_cookie}"
        )

    def test_websocket_scope_not_affected(self) -> None:
        """Middleware does not interfere with WebSocket connections."""
        from starlette.routing import WebSocketRoute

        async def ws_endpoint(websocket):  # type: ignore[no-untyped-def]
            await websocket.accept()
            await websocket.send_text("hello")
            await websocket.close()

        app = Starlette(routes=[Route("/", lambda r: PlainTextResponse("ok")), WebSocketRoute("/ws", ws_endpoint)])
        app.add_middleware(InvalidAuthCookieMiddleware)

        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            with TestClient(app) as client:
                with client.websocket_connect("/ws") as ws:
                    data = ws.receive_text()
            assert data == "hello"

    def test_regression_15407_tornado_cookies_cleared_on_first_request(
        self,
    ) -> None:
        """Regression test for GitHub #15407.

        Browsers upgrading from Tornado (<=1.56) to Starlette (>=1.57) retain
        auth cookies signed by Tornado's scheme.  On the very first request after
        the upgrade, the middleware must clear those cookies so the login flow can
        restart cleanly — instead of leaving the app stuck on the loading screen.
        """
        # Simulate a Tornado-signed cookie value (unverifiable by itsdangerous)
        tornado_signed = "2|deadbeef|badc0ffee|1700000000"  # fake Tornado format

        client = TestClient(_make_app())
        with patch(
            "streamlit.web.server.starlette.starlette_invalid_auth_cookie_middleware.get_cookie_secret",
            return_value=_COOKIE_SECRET,
        ):
            response = client.get(
                "/",
                cookies={
                    USER_COOKIE_NAME: tornado_signed,
                    TOKENS_COOKIE_NAME: tornado_signed,
                },
            )

        assert response.status_code == 200

        all_set_cookie: list[str] = response.headers.get_list("set-cookie")

        user_deleted = any(
            USER_COOKIE_NAME in h and "Max-Age=0" in h for h in all_set_cookie
        )
        tokens_deleted = any(
            TOKENS_COOKIE_NAME in h and "Max-Age=0" in h for h in all_set_cookie
        )

        assert user_deleted, (
            "Expected middleware to clear the stale Tornado-signed user cookie. "
            f"Set-Cookie headers seen: {all_set_cookie}"
        )
        assert tokens_deleted, (
            "Expected middleware to clear the stale Tornado-signed tokens cookie. "
            f"Set-Cookie headers seen: {all_set_cookie}"
        )
