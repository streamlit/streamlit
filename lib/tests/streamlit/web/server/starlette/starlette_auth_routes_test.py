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

from __future__ import annotations

from http.cookies import SimpleCookie
from typing import TYPE_CHECKING, Any

from starlette.applications import Starlette
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import PlainTextResponse, RedirectResponse
from starlette.testclient import TestClient

from streamlit.web.server.starlette import starlette_app_utils, starlette_auth_routes
from streamlit.web.server.starlette.starlette_auth_routes import (
    _get_cookie_path,
    create_auth_routes,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    import pytest


def _build_app() -> Starlette:
    app = Starlette(routes=create_auth_routes(""))

    @app.route("/", methods=["GET"])  # type: ignore[arg-type]
    async def root(_: Any) -> PlainTextResponse:
        return PlainTextResponse("ok")

    app.add_middleware(SessionMiddleware, secret_key="test-secret")
    return app


def test_redirect_without_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that login redirects to root when no provider is specified."""
    monkeypatch.setenv("STREAMLIT_OAUTH_PROVIDER", "")
    with TestClient(_build_app()) as client:
        response = client.get("/auth/login")
        assert response.status_code == 200
        assert response.text == "ok"


def test_logout_clears_cookie() -> None:
    """Test that logout clears the auth cookie and redirects to root."""
    with TestClient(_build_app()) as client:
        client.cookies.set("_streamlit_user", "value")
        response = client.get("/auth/logout", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers.get("set-cookie")
        follow_up = client.get(response.headers["location"])  # follow redirect manually
        assert follow_up.status_code == 200


def test_callback_handles_error_query(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that OAuth callback handles error query parameters gracefully."""
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: "default",
    )

    app = Starlette(routes=create_auth_routes(""))
    with TestClient(app) as client:
        response = client.get(
            "/oauth2callback?state=abc&error=access_denied&error_description=nope",
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")


def test_callback_missing_provider_redirects(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that OAuth callback redirects when provider cannot be determined."""
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: None,
    )

    app = Starlette(routes=create_auth_routes(""))
    with TestClient(app) as client:
        response = client.get("/oauth2callback?state=abc", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")


@patch_config_options({"server.cookieSecret": "test-secret"})
def test_auth_callback_sets_signed_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that successful OAuth callback sets a signed auth cookie."""

    async def _dummy_authorize_access_token(self, request: Any) -> dict[str, Any]:
        return {"userinfo": {"email": "user@example.com"}}

    class _DummyClient:
        async def authorize_access_token(self, request: Any) -> dict[str, Any]:
            return await _dummy_authorize_access_token(self, request)

    monkeypatch.setattr(
        starlette_auth_routes,
        "_create_oauth_client",
        lambda provider: (_DummyClient(), "/redirect"),
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: "default",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )

    app = Starlette(routes=create_auth_routes(""))
    with TestClient(app) as client:
        response = client.get("/oauth2callback?state=abc", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")

        cookies = SimpleCookie()
        cookies.load(response.headers["set-cookie"])
        signed_value = cookies["_streamlit_user"].value
        decoded = starlette_app_utils.decode_signed_value(
            "test-secret", "_streamlit_user", signed_value
        )
        assert decoded is not None
        payload = decoded.decode("utf-8")
        assert "user@example.com" in payload
        assert '"is_logged_in": true' in payload.lower()


def test_login_initializes_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that login endpoint initializes a session for OAuth flow."""
    captured_session: dict[str, Any] | None = None

    class _DummyClient:
        async def authorize_redirect(
            self, request: Any, redirect_uri: str
        ) -> RedirectResponse:
            nonlocal captured_session
            captured_session = dict(request.session)
            return RedirectResponse(redirect_uri)

    monkeypatch.setattr(
        starlette_auth_routes,
        "_parse_provider_token",
        lambda token: "default",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_create_oauth_client",
        lambda provider: (_DummyClient(), "/redirect"),
    )

    with TestClient(_build_app()) as client:
        response = client.get("/auth/login?provider=dummy", follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "/redirect"

    assert captured_session is not None


def test_callback_missing_origin_redirects(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test redirect when origin cannot be determined from secrets."""
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: None,  # Simulate missing redirect_uri
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: "default",
    )

    app = Starlette(routes=create_auth_routes(""))
    with TestClient(app) as client:
        response = client.get("/oauth2callback?state=abc", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")


class TestCookiePath:
    """Tests for _get_cookie_path function."""

    @patch_config_options({"server.baseUrlPath": ""})
    def test_returns_root_when_no_base_path(self) -> None:
        """Test that root path is returned when no base URL is configured."""
        assert _get_cookie_path() == "/"

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_returns_base_path_with_leading_slash(self) -> None:
        """Test that base path is returned with leading slash."""
        assert _get_cookie_path() == "/myapp"

    @patch_config_options({"server.baseUrlPath": "/myapp"})
    def test_handles_leading_slash_in_config(self) -> None:
        """Test that leading slash in config is handled correctly."""
        assert _get_cookie_path() == "/myapp"

    @patch_config_options({"server.baseUrlPath": "myapp/"})
    def test_removes_trailing_slash(self) -> None:
        """Test that trailing slash is removed from path."""
        assert _get_cookie_path() == "/myapp"

    @patch_config_options({"server.baseUrlPath": "/myapp/"})
    def test_handles_both_leading_and_trailing_slashes(self) -> None:
        """Test that both leading and trailing slashes are handled."""
        assert _get_cookie_path() == "/myapp"


class TestAuthCookieFlags:
    """Tests for auth cookie flags (httponly, samesite, path)."""

    @patch_config_options(
        {"server.cookieSecret": "test-secret", "server.baseUrlPath": ""}
    )
    def test_auth_cookie_has_correct_flags(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that auth cookie is set with correct security flags."""

        async def _dummy_authorize_access_token(self, request: Any) -> dict[str, Any]:
            return {"userinfo": {"email": "user@example.com"}}

        class _DummyClient:
            async def authorize_access_token(self, request: Any) -> dict[str, Any]:
                return await _dummy_authorize_access_token(self, request)

        monkeypatch.setattr(
            starlette_auth_routes,
            "_create_oauth_client",
            lambda provider: (_DummyClient(), "/redirect"),
        )
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_provider_by_state",
            lambda state: "default",
        )
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_origin_from_secrets",
            lambda: "http://testserver",
        )

        app = Starlette(routes=create_auth_routes(""))
        with TestClient(app) as client:
            response = client.get("/oauth2callback?state=abc", follow_redirects=False)
            assert response.status_code == 302

            cookies = SimpleCookie()
            cookies.load(response.headers["set-cookie"])
            cookie = cookies["_streamlit_user"]

            # Check httponly flag
            assert cookie["httponly"] is True

            # Check samesite flag
            assert cookie["samesite"].lower() == "lax"

            # Check path flag (should be "/" when no baseUrlPath)
            assert cookie["path"] == "/"

    @patch_config_options(
        {"server.cookieSecret": "test-secret", "server.baseUrlPath": "myapp"}
    )
    def test_auth_cookie_path_matches_base_url(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that auth cookie path matches the configured baseUrlPath."""

        async def _dummy_authorize_access_token(self, request: Any) -> dict[str, Any]:
            return {"userinfo": {"email": "user@example.com"}}

        class _DummyClient:
            async def authorize_access_token(self, request: Any) -> dict[str, Any]:
                return await _dummy_authorize_access_token(self, request)

        monkeypatch.setattr(
            starlette_auth_routes,
            "_create_oauth_client",
            lambda provider: (_DummyClient(), "/redirect"),
        )
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_provider_by_state",
            lambda state: "default",
        )
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_origin_from_secrets",
            lambda: "http://testserver",
        )

        app = Starlette(routes=create_auth_routes("/myapp"))
        with TestClient(app) as client:
            response = client.get(
                "/myapp/oauth2callback?state=abc", follow_redirects=False
            )
            assert response.status_code == 302

            cookies = SimpleCookie()
            cookies.load(response.headers["set-cookie"])
            cookie = cookies["_streamlit_user"]

            # Check path matches baseUrlPath
            assert cookie["path"] == "/myapp"

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_logout_clears_cookie_with_correct_path(self) -> None:
        """Test that logout clears the cookie with the same path it was set with."""
        app = Starlette(routes=create_auth_routes("/myapp"))

        @app.route("/myapp/", methods=["GET"])  # type: ignore[arg-type]
        async def root(_: Any) -> PlainTextResponse:
            return PlainTextResponse("ok")

        with TestClient(app) as client:
            client.cookies.set("_streamlit_user", "value", path="/myapp")
            response = client.get("/myapp/auth/logout", follow_redirects=False)
            assert response.status_code == 302

            # The Set-Cookie header should include the path
            set_cookie_header = response.headers.get("set-cookie", "")
            assert "Path=/myapp" in set_cookie_header
