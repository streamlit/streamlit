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

from __future__ import annotations

import asyncio
from http.cookies import SimpleCookie
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock

from starlette.applications import Starlette
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import PlainTextResponse, RedirectResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit.web.server.starlette import starlette_app_utils, starlette_auth_routes
from streamlit.web.server.starlette.starlette_auth_routes import (
    _get_cookie_path,
    _get_origin_from_secrets,
    _get_provider_by_state,
    _parse_provider_token,
    create_auth_routes,
)
from streamlit.web.server.starlette.starlette_server_config import (
    AUTH_COOKIE_MAX_AGE_SECONDS,
    TOKENS_COOKIE_NAME,
    USER_COOKIE_NAME,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    import pytest


def _build_app() -> Starlette:
    async def root(_: Any) -> PlainTextResponse:
        return PlainTextResponse("ok")

    app = Starlette(routes=[*create_auth_routes(""), Route("/", root, methods=["GET"])])
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
        lambda request, state: "default",
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
        lambda request, state: None,
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
        lambda request, state: "default",
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
        lambda request, state: "default",
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

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_set_auth_cookie_uses_full_cookie_attribute_size(self) -> None:
        """Test that auth cookie chunking accounts for all emitted attributes."""
        captured_calls: list[tuple[str, int]] = []

        def mock_set_cookie_with_chunks(
            set_single_cookie_fn: Any,
            create_signed_value_fn: Any,
            cookie_name: str,
            value: dict[str, Any],
            *,
            cookie_attr_size: int,
        ) -> None:
            captured_calls.append((cookie_name, cookie_attr_size))

        response = PlainTextResponse("ok")
        original_set_cookie_with_chunks = starlette_auth_routes.set_cookie_with_chunks
        starlette_auth_routes.set_cookie_with_chunks = mock_set_cookie_with_chunks
        try:
            asyncio.run(
                starlette_auth_routes._set_auth_cookie(
                    response,
                    {"email": "user@example.com"},
                    {"access_token": "token"},
                )
            )
        finally:
            starlette_auth_routes.set_cookie_with_chunks = (
                original_set_cookie_with_chunks
            )

        expected_attr_size = len(
            f"; Path=/myapp; HttpOnly; SameSite=lax; "
            f"Max-Age={AUTH_COOKIE_MAX_AGE_SECONDS}"
        )
        assert captured_calls == [
            (USER_COOKIE_NAME, expected_attr_size),
            (TOKENS_COOKIE_NAME, expected_attr_size),
        ]

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
            lambda request, state: "default",
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

            set_cookie_headers = response.headers.get_list("set-cookie")
            user_cookie_header = next(
                (h for h in set_cookie_headers if h.startswith("_streamlit_user=")),
                None,
            )
            assert user_cookie_header is not None, "User cookie not found"

            cookies = SimpleCookie()
            cookies.load(user_cookie_header)
            cookie = cookies["_streamlit_user"]

            # Check httponly flag
            assert cookie["httponly"] is True

            # Check samesite flag
            assert cookie["samesite"].lower() == "lax"

            # Check path flag (should be "/" when no baseUrlPath)
            assert cookie["path"] == "/"

            # Check max-age is present and equals 30 days.
            assert cookie["max-age"] == str(AUTH_COOKIE_MAX_AGE_SECONDS)

            # Same persistence check on the tokens cookie.
            tokens_cookie_header = next(
                (
                    h
                    for h in set_cookie_headers
                    if h.startswith(f"{TOKENS_COOKIE_NAME}=")
                ),
                None,
            )
            assert tokens_cookie_header is not None, "Tokens cookie not found"
            tokens_cookies = SimpleCookie()
            tokens_cookies.load(tokens_cookie_header)
            assert tokens_cookies[TOKENS_COOKIE_NAME]["max-age"] == str(
                AUTH_COOKIE_MAX_AGE_SECONDS
            )

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
            lambda request, state: "default",
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

            set_cookie_headers = response.headers.get_list("set-cookie")
            user_cookie_header = next(
                (h for h in set_cookie_headers if h.startswith("_streamlit_user=")),
                None,
            )
            assert user_cookie_header is not None, "User cookie not found"

            cookies = SimpleCookie()
            cookies.load(user_cookie_header)
            cookie = cookies["_streamlit_user"]

            # Check path matches baseUrlPath
            assert cookie["path"] == "/myapp"

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_logout_clears_cookie_with_correct_path(self) -> None:
        """Test that logout clears the cookie with the same path it was set with."""

        async def root(_: Any) -> PlainTextResponse:
            return PlainTextResponse("ok")

        app = Starlette(
            routes=[
                *create_auth_routes("/myapp"),
                Route("/myapp/", root, methods=["GET"]),
            ]
        )

        with TestClient(app) as client:
            client.cookies.set("_streamlit_user", "value", path="/myapp")
            response = client.get("/myapp/auth/logout", follow_redirects=False)
            assert response.status_code == 302

            # The Set-Cookie header should include the path
            set_cookie_header = response.headers.get("set-cookie", "")
            assert "Path=/myapp" in set_cookie_header


class TestParseProviderToken:
    """Tests for _parse_provider_token function."""

    def test_returns_none_for_none_input(self) -> None:
        """Test that None input returns None."""
        assert _parse_provider_token(None) is None

    def test_returns_none_for_invalid_token(self) -> None:
        """Test that an invalid/malformed token returns None."""
        assert _parse_provider_token("invalid-token") is None
        assert _parse_provider_token("") is None

    def test_extracts_provider_from_valid_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that provider is extracted from a valid token."""
        # Mock decode_provider_token where it's imported (in starlette_auth_routes)
        monkeypatch.setattr(
            starlette_auth_routes,
            "decode_provider_token",
            lambda token: {"provider": "google"},
        )
        assert _parse_provider_token("valid-token") == "google"


class TestGetProviderByState:
    """Tests for _get_provider_by_state function."""

    def test_returns_none_for_none_state(self) -> None:
        """Test that None state returns None (early-return path, no session access)."""
        assert _get_provider_by_state(MagicMock(), None) is None

    def test_returns_none_for_unknown_state(self) -> None:
        """Test that an unknown state code returns None."""

        mock_request = MagicMock()
        mock_request.session = {}
        assert _get_provider_by_state(mock_request, "unknown_state") is None

    def test_extracts_provider_from_session(self) -> None:
        """Test that provider is extracted from a matching session entry."""
        mock_request = MagicMock()
        # Session value structure doesn't matter; only the key format is parsed
        mock_request.session = {"_state_google_abc123": {}}

        assert _get_provider_by_state(mock_request, "abc123") == "google"

    def test_handles_malformed_session_keys(self) -> None:
        """Test that malformed session keys are skipped gracefully."""
        mock_request = MagicMock()
        mock_request.session = {
            "malformed_key": {},
            "_state_github_validstate123": {},
        }

        # Should find the valid key when querying with the state code
        assert _get_provider_by_state(mock_request, "validstate123") == "github"
        # Should return None for a state code that doesn't exist in the session
        assert _get_provider_by_state(mock_request, "nonexistentstate") is None

    def test_ignores_keys_without_state_prefix(self) -> None:
        """Test that session keys without '_state_' prefix are ignored."""
        mock_request = MagicMock()
        # These keys split into 4 parts but don't have the _state_ prefix
        mock_request.session = {
            "user_id_abcd_1234": {},  # Could be mistaken for state key
            "other_data_xyz_5678": {},  # Another potential false positive
            "_state_google_realstate123": {},  # Valid Authlib state key
        }

        # Only the valid _state_ prefixed key should be recognized
        assert _get_provider_by_state(mock_request, "realstate123") == "google"
        # The false positives should not be matched
        assert _get_provider_by_state(mock_request, "1234") is None
        assert _get_provider_by_state(mock_request, "5678") is None

    def test_handles_state_code_with_underscores(self) -> None:
        """Test that state codes containing underscores are parsed correctly."""
        mock_request = MagicMock()
        # State code contains underscores - maxsplit=3 should keep them together
        mock_request.session = {
            "_state_github_complex_state_with_underscores": {},
        }

        # The entire remainder after the 3rd underscore is the state code
        assert (
            _get_provider_by_state(mock_request, "complex_state_with_underscores")
            == "github"
        )


class TestGetOriginFromSecrets:
    """Tests for _get_origin_from_secrets function."""

    def test_returns_none_when_no_origin(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test that None is returned when get_origin_from_redirect_uri returns None."""
        # Since _get_origin_from_secrets is now just a wrapper around
        # get_origin_from_redirect_uri, we mock that function directly
        monkeypatch.setattr(
            starlette_auth_routes,
            "get_origin_from_redirect_uri",
            lambda: None,
        )
        assert _get_origin_from_secrets() is None

    def test_extracts_origin_from_redirect_uri(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that origin is correctly returned from shared function."""
        monkeypatch.setattr(
            starlette_auth_routes,
            "get_origin_from_redirect_uri",
            lambda: "https://example.com",
        )
        assert _get_origin_from_secrets() == "https://example.com"

    def test_handles_localhost_uri(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test that localhost URIs are handled correctly."""
        monkeypatch.setattr(
            starlette_auth_routes,
            "get_origin_from_redirect_uri",
            lambda: "http://localhost:8501",
        )
        assert _get_origin_from_secrets() == "http://localhost:8501"


class TestGetProviderLogoutUrl:
    """Tests for _get_provider_logout_url function."""

    def test_returns_none_when_no_user_cookie(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that None is returned when no user cookie exists."""

        from streamlit.web.server.starlette.starlette_auth_routes import (
            _get_provider_logout_url,
        )

        mock_request = MagicMock()
        mock_request.cookies = {}

        assert _get_provider_logout_url(mock_request) is None

    def test_returns_none_when_no_provider_in_cookie(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that None is returned when cookie doesn't contain provider."""

        from streamlit.web.server.starlette.starlette_auth_routes import (
            _get_provider_logout_url,
        )

        # Mock cookie without provider field
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_cookie_value_from_request",
            lambda request, name: b'{"email": "test@example.com"}',
        )

        mock_request = MagicMock()
        assert _get_provider_logout_url(mock_request) is None

    def test_returns_none_when_no_end_session_endpoint(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that None is returned when provider has no end_session_endpoint."""

        from streamlit.web.server.starlette.starlette_auth_routes import (
            _get_provider_logout_url,
        )

        # Mock cookie with provider
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_cookie_value_from_request",
            lambda request, name: b'{"provider": "testprovider"}',
        )

        # Mock OAuth client that returns metadata without end_session_endpoint
        class MockClient:
            client_id = "test-client-id"

            def load_server_metadata(self) -> dict[str, Any]:
                return {"issuer": "https://example.com"}

        monkeypatch.setattr(
            starlette_auth_routes,
            "_create_oauth_client",
            lambda provider: (MockClient(), "/redirect"),
        )

        mock_request = MagicMock()
        assert _get_provider_logout_url(mock_request) is None

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_logout_url_with_end_session_endpoint(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that logout URL is returned when provider has end_session_endpoint."""

        from streamlit.web.server.starlette.starlette_auth_routes import (
            _get_provider_logout_url,
        )

        # Mock cookies - must differentiate between USER and TOKENS cookies
        def mock_get_cookie(request: Any, name: str) -> bytes | None:
            if name == USER_COOKIE_NAME:
                return b'{"provider": "testprovider"}'
            if name == TOKENS_COOKIE_NAME:
                return b'{"id_token": "test-id-token", "access_token": "test-access"}'
            return None

        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_cookie_value_from_request",
            mock_get_cookie,
        )

        # Mock OAuth client with end_session_endpoint
        class MockClient:
            client_id = "test-client-id"

            def load_server_metadata(self) -> dict[str, Any]:
                return {
                    "issuer": "https://example.com",
                    "end_session_endpoint": "https://example.com/logout",
                }

        monkeypatch.setattr(
            starlette_auth_routes,
            "_create_oauth_client",
            lambda provider: (MockClient(), "/redirect"),
        )

        # Mock get_validated_redirect_uri (now shared in auth_util)
        monkeypatch.setattr(
            starlette_auth_routes,
            "get_validated_redirect_uri",
            lambda: "http://localhost:8501/oauth2callback",
        )

        mock_request = MagicMock()
        result = _get_provider_logout_url(mock_request)

        assert result is not None
        assert "https://example.com/logout" in result
        assert "client_id=test-client-id" in result
        assert "post_logout_redirect_uri" in result
        # Verify that the validated redirect_uri is included in the logout URL
        assert "localhost" in result
        # Verify id_token_hint is included when tokens cookie has id_token
        assert "id_token_hint=test-id-token" in result

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_returns_none_when_redirect_uri_invalid(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that None is returned when redirect_uri doesn't end with /oauth2callback."""

        from streamlit.web.server.starlette.starlette_auth_routes import (
            _get_provider_logout_url,
        )

        # Mock user cookie with provider
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_cookie_value_from_request",
            lambda request, name: b'{"provider": "testprovider"}',
        )

        # Mock OAuth client with end_session_endpoint
        class MockClient:
            client_id = "test-client-id"

            def load_server_metadata(self) -> dict[str, Any]:
                return {
                    "issuer": "https://example.com",
                    "end_session_endpoint": "https://example.com/logout",
                }

        monkeypatch.setattr(
            starlette_auth_routes,
            "_create_oauth_client",
            lambda provider: (MockClient(), "/redirect"),
        )

        # Mock get_validated_redirect_uri to return None (invalid redirect_uri)
        monkeypatch.setattr(
            starlette_auth_routes,
            "get_validated_redirect_uri",
            lambda: None,
        )

        mock_request = MagicMock()
        result = _get_provider_logout_url(mock_request)

        # Should return None when redirect_uri is invalid
        assert result is None


class TestLogoutWithProviderRedirect:
    """Tests for logout behavior with provider end_session_endpoint."""

    @patch_config_options({"server.cookieSecret": "test-secret"})
    def test_logout_redirects_to_provider_when_end_session_available(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that logout redirects to provider logout URL when available."""

        # Mock _get_provider_logout_url to return a URL
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_provider_logout_url",
            lambda request: (
                "https://provider.com/logout?post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8501%2Foauth2callback"
            ),
        )

        app = Starlette(routes=create_auth_routes(""))
        with TestClient(app) as client:
            response = client.get("/auth/logout", follow_redirects=False)
            assert response.status_code == 302
            assert "provider.com/logout" in response.headers["location"]

    def test_logout_redirects_to_base_when_no_end_session(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that logout redirects to base URL when no end_session_endpoint."""
        # Mock _get_provider_logout_url to return None
        monkeypatch.setattr(
            starlette_auth_routes,
            "_get_provider_logout_url",
            lambda request: None,
        )

        app = Starlette(routes=create_auth_routes(""))
        with TestClient(app) as client:
            response = client.get("/auth/logout", follow_redirects=False)
            assert response.status_code == 302
            assert response.headers["location"].endswith("/")
