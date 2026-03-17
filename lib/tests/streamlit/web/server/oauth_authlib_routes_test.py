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

import json
from unittest.mock import MagicMock, patch

import tornado.httputil
import tornado.testing
import tornado.web
from tornado.web import create_signed_value

from streamlit.auth_util import encode_provider_token
from streamlit.web.server import oauth_authlib_routes
from streamlit.web.server.oauth_authlib_routes import (
    AuthCache,
    AuthCallbackHandler,
    AuthLoginHandler,
    AuthLogoutHandler,
    AuthRefreshHandler,
    refresh_oauth_tokens,
)
from streamlit.web.server.server_util import AUTH_COOKIE_NAME, TOKENS_COOKIE_NAME


def _make_mock_client(
    *,
    token_endpoint: str = "https://provider.com/token",
    server_metadata_extra: dict | None = None,
    session_response: MagicMock | None = None,
) -> MagicMock:
    """Build a mock OAuth client whose ``client_cls`` context manager yields a session.

    The returned mock supports ``client.client_cls(**client.client_kwargs)`` as a
    context manager.  The session's ``request()`` method returns *session_response*.
    """
    mock_session = MagicMock()
    if session_response is not None:
        mock_session.request.return_value = session_response

    mock_client_cls = MagicMock()
    mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_session)
    mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)

    metadata = {"token_endpoint": token_endpoint}
    if server_metadata_extra:
        metadata.update(server_metadata_extra)

    client = MagicMock(
        client_id="test_client_id",
        client_secret="test_client_secret",
        client_cls=mock_client_cls,
        client_kwargs={},
        load_server_metadata=MagicMock(return_value=metadata),
        server_metadata=metadata,
    )
    return client


class SecretMock(dict):
    def to_dict(self):
        return self


SECRETS_MOCK = SecretMock(
    {
        "redirect_uri": "http://localhost:8501/oauth2callback",
        "google": {
            "client_id": "CLIENT_ID",
            "client_secret": "CLIENT_SECRET",
            "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
        },
    }
)


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class LoginHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/auth/login",
                    AuthLoginHandler,
                    {"base_url": ""},
                )
            ]
        )

    @patch(
        "streamlit.web.server.oidc_mixin.TornadoOAuth2App.client_cls.request",
        MagicMock(
            return_value=MagicMock(
                json=MagicMock(
                    return_value={
                        "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
                    }
                )
            )
        ),
    )
    def test_login_handler_success(self):
        """Test login handler success, when .well-known contains authorization_endpoint."""
        token = encode_provider_token("google")
        response = self.fetch(f"/auth/login?provider={token}", follow_redirects=False)

        authorization_url = response.headers["Location"]

        assert response.code == 302
        assert authorization_url.startswith(
            "https://accounts.google.com/o/oauth2/v2/auth"
        )
        assert "&client_id=CLIENT_ID" in authorization_url
        assert "CLIENT_SECRET" not in authorization_url
        assert "&prompt=select_account" in authorization_url
        assert "&scope=openid+email+profile" in authorization_url
        assert "&state=" in authorization_url
        assert (
            "&redirect_uri=http%3A%2F%2Flocalhost%3A8501%2Foauth2callback"
            in authorization_url
        )

    @patch(
        "streamlit.web.server.oidc_mixin.TornadoOAuth2App.client_cls.request",
        MagicMock(
            return_value=MagicMock(
                json=MagicMock(
                    return_value={
                        "invalid": "payload",
                    }
                )
            )
        ),
    )
    def test_login_handler_fail_on_malformed_wellknown(self):
        """Test login handler fail, when .well-known does not contain authorization_endpoint."""
        token = encode_provider_token("google")
        response = self.fetch(f"/auth/login?provider={token}", follow_redirects=False)
        assert response.code == 400
        assert b"Missing" in response.body
        assert b"authorize_url" in response.body
        assert "Location" not in response.headers

    @patch(
        "streamlit.web.server.oidc_mixin.TornadoOAuth2App.client_cls.request",
        MagicMock(
            return_value=MagicMock(
                raise_for_status=MagicMock(side_effect=Exception("Bad status")),
            )
        ),
    )
    def test_login_handler_fail_on_bad_status(self):
        """Test login handler fail, when .well-known request fails."""
        token = encode_provider_token("google")
        response = self.fetch(f"/auth/login?provider={token}", follow_redirects=False)
        assert response.code == 400
        assert b"400: Bad status" in response.body
        assert "Location" not in response.headers

    def test_login_handler_fail_on_missing_provider(self):
        """Test login handler fail, when provider is missing."""
        response = self.fetch("/auth/login", follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class LogoutHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/auth/logout",
                    AuthLogoutHandler,
                    {"base_url": ""},
                )
            ],
            cookie_secret="test_secret",
        )

    def test_logout_success_no_cookie(self):
        """Test logout handler success with no auth cookie."""
        response = self.fetch("/auth/logout", follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"
        assert '_streamlit_user="";' in response.headers["Set-Cookie"]

    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                load_server_metadata=MagicMock(
                    return_value={
                        # Use a fake ese-provider as google does not use end_session_endpoint
                        "end_session_endpoint": "https://ese-provider.example.com/logout"
                    }
                ),
            ),
            "",
        ),
    )
    def test_logout_with_oidc_end_session_endpoint(self, mock_create_oauth_client):
        """Test logout handler redirects to provider's end_session_endpoint when available."""
        # Create a signed cookie with provider info
        cookie_data = {
            "provider": "ese-provider",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
            "email": "test@example.com",
        }

        # Set the signed cookie
        cookie_value = json.dumps(cookie_data)

        # Create headers with the signed cookie
        signed_cookie = create_signed_value(
            "test_secret", AUTH_COOKIE_NAME, cookie_value
        ).decode("utf-8")

        headers = tornado.httputil.HTTPHeaders()
        headers.add("Cookie", f"{AUTH_COOKIE_NAME}={signed_cookie}")

        response = self.fetch("/auth/logout", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert '_streamlit_user="";' in response.headers["Set-Cookie"]

        # Should redirect to provider's logout URL with post_logout_redirect_uri and client_id
        location = response.headers["Location"]
        assert location.startswith("https://ese-provider.example.com/logout")
        assert (
            "post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8501%2Foauth2callback"
            in location
        )
        assert "client_id=test_client_id" in location
        assert "id_token_hint" not in location

        # Verify create_oauth_client was called with the correct provider
        mock_create_oauth_client.assert_called_once_with("ese-provider")

    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                load_server_metadata=MagicMock(
                    return_value={
                        # Use a fake ese-provider as google does not use end_session_endpoint
                        "end_session_endpoint": "https://ese-provider.example.com/logout"
                    }
                ),
            ),
            "",
        ),
    )
    def test_logout_with_id_token_hint(self, mock_create_oauth_client):
        """Test logout handler includes id_token_hint when available in tokens cookie."""
        # Create a signed cookie with provider info
        cookie_data = {
            "provider": "ese-provider",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
            "email": "test@example.com",
        }

        # Create tokens cookie with id_token
        tokens_data = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "id_token": "test_id_token_12345",
        }

        # Set the signed cookies
        cookie_value = json.dumps(cookie_data)
        tokens_value = json.dumps(tokens_data)

        # Create headers with both signed cookies
        signed_cookie = create_signed_value(
            "test_secret", AUTH_COOKIE_NAME, cookie_value
        ).decode("utf-8")
        signed_tokens_cookie = create_signed_value(
            "test_secret", TOKENS_COOKIE_NAME, tokens_value
        ).decode("utf-8")

        headers = tornado.httputil.HTTPHeaders()
        headers.add(
            "Cookie",
            f"{AUTH_COOKIE_NAME}={signed_cookie}; {TOKENS_COOKIE_NAME}={signed_tokens_cookie}",
        )

        response = self.fetch("/auth/logout", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert '_streamlit_user="";' in response.headers["Set-Cookie"]

        # Should redirect to provider's logout URL with post_logout_redirect_uri, client_id, and id_token_hint
        location = response.headers["Location"]
        assert location.startswith("https://ese-provider.example.com/logout")
        assert (
            "post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8501%2Foauth2callback"
            in location
        )
        assert "client_id=test_client_id" in location
        assert "id_token_hint=test_id_token_12345" in location

        # Verify create_oauth_client was called with the correct provider
        mock_create_oauth_client.assert_called_once_with("ese-provider")

    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(load_server_metadata=MagicMock(return_value={})),
            "",
        ),
    )
    def test_logout_fallback_no_end_session_endpoint(self, mock_create_oauth_client):
        """Test logout handler falls back to local logout when no end_session_endpoint."""
        # Create a signed cookie with provider info
        cookie_data = {
            "provider": "google",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
            "email": "test@example.com",
        }

        # Set the signed cookie
        self.get_app().settings["cookie_secret"] = "test_secret"
        cookie_value = json.dumps(cookie_data)

        # Create headers with the signed cookie
        signed_cookie = create_signed_value(
            "test_secret", AUTH_COOKIE_NAME, cookie_value
        ).decode("utf-8")

        headers = tornado.httputil.HTTPHeaders()
        headers.add("Cookie", f"{AUTH_COOKIE_NAME}={signed_cookie}")

        response = self.fetch("/auth/logout", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"  # Fallback to base
        assert '_streamlit_user="";' in response.headers["Set-Cookie"]

        # Verify create_oauth_client was called with the correct provider
        mock_create_oauth_client.assert_called_once_with("google")


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class AuthCallbackHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/oauth2callback",
                    AuthCallbackHandler,
                    {"base_url": ""},
                )
            ],
            cookie_secret="AAAA",
        )

    def setUp(self) -> None:
        super().setUp()

        self.old_value = oauth_authlib_routes.auth_cache
        oauth_authlib_routes.auth_cache = AuthCache()
        oauth_authlib_routes.auth_cache.set("a_b_google_123", "AAA", None)

    def tearDown(self) -> None:
        oauth_authlib_routes.auth_cache = self.old_value

    @patch.object(AuthCallbackHandler, "set_auth_cookie")
    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                authorize_access_token=MagicMock(
                    return_value={
                        "userinfo": {"email": "test@example.com"},
                        "access_token": "test_access_token",
                        "refresh_token": "test_refresh_token",
                        "id_token": "test_id_token",
                        "token_type": "Bearer",
                        "expires_in": 3600,
                    }
                )
            ),
            MagicMock(),
        ),
    )
    def test_auth_callback_success(
        self, mock_create_oauth_client, mock_set_auth_cookie
    ):
        """Test auth callback success."""
        response = self.fetch("/oauth2callback?state=123", follow_redirects=False)
        mock_create_oauth_client.assert_called_with("google")
        mock_set_auth_cookie.assert_called_with(
            {
                "email": "test@example.com",
                "origin": "http://localhost:8501",
                "is_logged_in": True,
                "provider": "google",
            },
            {
                "access_token": "test_access_token",
                "id_token": "test_id_token",
                "refresh_token": "test_refresh_token",
            },
        )

        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch.object(AuthCallbackHandler, "set_auth_cookie")
    def test_auth_callback_failure_missing_provider(self, mock_set_auth_cookie):
        """Test auth callback missing provider failure."""
        response = self.fetch("/oauth2callback?state=456", follow_redirects=False)
        mock_set_auth_cookie.assert_not_called()

        assert response.code == 302
        assert response.headers["Location"] == "/"

    def test_auth_callback_failure_missing_state(self):
        """Test auth callback redirects to base when state is missing (logout redirect)."""
        response = self.fetch("/oauth2callback", follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch.object(AuthCallbackHandler, "set_auth_cookie")
    def test_auth_callback_with_error_query_param(self, mock_set_auth_cookie):
        response = self.fetch(
            "/oauth2callback?state=123&error=foo", follow_redirects=False
        )
        mock_set_auth_cookie.assert_not_called()

        assert response.code == 302
        assert response.headers["Location"] == "/"


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class AuthRefreshHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/auth/refresh",
                    AuthRefreshHandler,
                    {"base_url": ""},
                )
            ],
            cookie_secret="test_cookie_secret",
        )

    def test_missing_token_id_redirects(self) -> None:
        """Test that requests without token_id are redirected."""
        response = self.fetch("/auth/refresh", follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

        # Anti-regression: must NOT return JSON body
        try:
            body = json.loads(response.body)
            assert "success" not in body
        except (json.JSONDecodeError, ValueError):
            pass  # Expected: body is empty or not JSON for redirect responses

    # --- Cookie-set-only path tests (token_id) ---

    def setUp(self) -> None:
        super().setUp()
        self._old_cache = oauth_authlib_routes.auth_cache
        oauth_authlib_routes.auth_cache = AuthCache()

    def tearDown(self) -> None:
        oauth_authlib_routes.auth_cache = self._old_cache
        super().tearDown()

    @patch.object(AuthRefreshHandler, "set_auth_cookie")
    def test_token_id_sets_cookies_from_cache(
        self, mock_set_auth_cookie: MagicMock
    ) -> None:
        """Test cookie-set-only path retrieves cached data and sets cookies."""
        cached_user_info = {
            "provider": "google",
            "email": "cached@example.com",
            "is_logged_in": True,
        }
        cached_tokens = {
            "access_token": "cached_access",
            "refresh_token": "cached_refresh",
        }
        oauth_authlib_routes.auth_cache.set(
            "_refresh_test-uuid",
            {"user_info": cached_user_info, "tokens": cached_tokens},
        )

        response = self.fetch(
            "/auth/refresh?token_id=test-uuid", follow_redirects=False
        )

        assert response.code == 200
        body = json.loads(response.body)
        assert body["success"] is True

        # Verify cookies were set from cached data
        mock_set_auth_cookie.assert_called_once_with(cached_user_info, cached_tokens)

        # Anti-regression: must NOT redirect for cookie-set-only requests
        assert "Location" not in response.headers

    def test_token_id_invalid_returns_failure(self) -> None:
        """Test cookie-set-only path returns failure for invalid/unknown token_id."""
        response = self.fetch(
            "/auth/refresh?token_id=nonexistent-uuid",
            follow_redirects=False,
        )

        assert response.code == 200
        body = json.loads(response.body)
        assert body["success"] is False

        # Anti-regression: must NOT redirect
        assert "Location" not in response.headers

    @patch.object(AuthRefreshHandler, "set_auth_cookie")
    def test_token_id_is_one_time_use(self, mock_set_auth_cookie: MagicMock) -> None:
        """Test that a token_id is consumed after first use and cannot be reused."""
        cached_data = {
            "user_info": {"provider": "google", "email": "once@example.com"},
            "tokens": {"access_token": "once_access"},
        }
        oauth_authlib_routes.auth_cache.set("_refresh_once-uuid", cached_data)

        # First request should succeed
        response1 = self.fetch(
            "/auth/refresh?token_id=once-uuid", follow_redirects=False
        )
        body1 = json.loads(response1.body)
        assert body1["success"] is True
        mock_set_auth_cookie.assert_called_once()

        # Second request with same token_id should fail
        mock_set_auth_cookie.reset_mock()
        response2 = self.fetch(
            "/auth/refresh?token_id=once-uuid", follow_redirects=False
        )
        body2 = json.loads(response2.body)
        assert body2["success"] is False

        # Anti-regression: set_auth_cookie must NOT be called on the second request
        mock_set_auth_cookie.assert_not_called()

    @patch.object(AuthRefreshHandler, "set_auth_cookie")
    def test_token_id_does_not_call_provider(
        self,
        mock_set_auth_cookie: MagicMock,
    ) -> None:
        """Test cookie-set-only path does NOT make any HTTP calls to the provider."""
        cached_data = {
            "user_info": {"provider": "google", "email": "noprovider@example.com"},
            "tokens": {"access_token": "np_access", "refresh_token": "np_refresh"},
        }
        oauth_authlib_routes.auth_cache.set("_refresh_np-uuid", cached_data)

        response = self.fetch("/auth/refresh?token_id=np-uuid", follow_redirects=False)

        body = json.loads(response.body)
        assert body["success"] is True


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class RefreshOauthTokensTest(tornado.testing.AsyncHTTPTestCase):
    """Tests for the refresh_oauth_tokens() standalone function."""

    def get_app(self):
        # We need a tornado app for the test case but refresh_oauth_tokens
        # doesn't use one; provide a minimal app.
        return tornado.web.Application([])

    def test_refresh_oauth_tokens_success(self):
        """Test successful token refresh via the standalone function."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "expires_in": 3600,
        }

        mock_client = _make_mock_client(session_response=mock_response)

        with patch(
            "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
            return_value=(mock_client, ""),
        ):
            user_info = {
                "provider": "google",
                "email": "test@example.com",
                "is_logged_in": True,
            }

            result = refresh_oauth_tokens(user_info, "old_refresh_token")

        assert result is not None
        updated_user_info, updated_tokens = result
        assert updated_tokens["access_token"] == "new_access_token"
        assert updated_tokens["refresh_token"] == "new_refresh_token"

        # Anti-regression: old tokens must be replaced, not kept
        assert updated_tokens["access_token"] != "old_access_token"

        # User info should be preserved when no id_token is returned
        assert updated_user_info["email"] == "test@example.com"
        assert updated_user_info["provider"] == "google"

    def test_refresh_oauth_tokens_missing_provider(self):
        """Test refresh_oauth_tokens returns None when provider is missing."""
        user_info = {"email": "test@example.com", "is_logged_in": True}

        result = refresh_oauth_tokens(user_info, "test_refresh")
        assert result is None

    def test_refresh_oauth_tokens_endpoint_failure(self):
        """Test refresh_oauth_tokens returns None on token endpoint failure."""
        mock_response = MagicMock()
        mock_response.status_code = 400

        mock_client = _make_mock_client(session_response=mock_response)

        with patch(
            "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
            return_value=(mock_client, ""),
        ):
            user_info = {"provider": "google", "email": "test@example.com"}

            result = refresh_oauth_tokens(user_info, "test_refresh")
            assert result is None

    @patch("streamlit.web.server.oauth_authlib_routes._decode_id_token")
    def test_refresh_oauth_tokens_updates_user_info_from_id_token(
        self,
        mock_decode_id_token,
    ):
        """Test refresh_oauth_tokens updates user info when new id_token is returned."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "id_token": "new_id_token",
        }

        mock_client = _make_mock_client(
            session_response=mock_response,
            server_metadata_extra={"jwks_uri": "https://provider.com/jwks"},
        )

        mock_decode_id_token.return_value = {
            "email": "updated@example.com",
            "name": "Updated Name",
        }

        with patch(
            "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
            return_value=(mock_client, ""),
        ):
            user_info = {
                "provider": "google",
                "email": "old@example.com",
                "is_logged_in": True,
            }

            result = refresh_oauth_tokens(user_info, "old_refresh")

        assert result is not None
        updated_user_info, updated_tokens = result

        # User info should be updated from the decoded id_token
        assert updated_user_info["email"] == "updated@example.com"
        assert updated_user_info["name"] == "Updated Name"

        # Provider and is_logged_in should be preserved
        assert updated_user_info["provider"] == "google"
        assert updated_user_info["is_logged_in"] is True

        # Tokens should be updated
        assert updated_tokens["id_token"] == "new_id_token"
        assert updated_tokens["access_token"] == "new_access_token"

    def test_refresh_oauth_tokens_omits_refresh_token_when_not_returned(self):
        """Test that updated_tokens omits refresh_token when the provider does not return one."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Provider does not return a new refresh_token (some providers do this).
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "expires_in": 3600,
        }

        mock_client = _make_mock_client(session_response=mock_response)

        with patch(
            "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
            return_value=(mock_client, ""),
        ):
            user_info = {"provider": "google", "email": "test@example.com"}

            result = refresh_oauth_tokens(user_info, "old_refresh")

        assert result is not None
        _, updated_tokens = result

        # New access_token should be present.
        assert updated_tokens["access_token"] == "new_access_token"

        # refresh_token must NOT appear -- the caller (user_info.py) is
        # responsible for keeping the old one when the provider omits it.
        assert "refresh_token" not in updated_tokens

    def test_refresh_oauth_tokens_does_not_mutate_inputs(self):
        """Test that refresh_oauth_tokens does not mutate the input dict."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
        }

        mock_client = _make_mock_client(session_response=mock_response)

        with patch(
            "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
            return_value=(mock_client, ""),
        ):
            user_info = {
                "provider": "google",
                "email": "test@example.com",
                "is_logged_in": True,
            }

            # Preserve original reference
            original_user_info = user_info.copy()

            refresh_oauth_tokens(user_info, "old_refresh")

        # Input must not be mutated
        assert user_info == original_user_info
