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
)
from streamlit.web.server.server_util import AUTH_COOKIE_NAME, TOKENS_COOKIE_NAME


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

    def _create_signed_cookies(
        self, user_info: dict, tokens: dict
    ) -> tornado.httputil.HTTPHeaders:
        """Helper to create signed cookies for testing."""
        import tornado.httputil
        from tornado.web import create_signed_value

        from streamlit.web.server.server_util import (
            AUTH_COOKIE_NAME,
            TOKENS_COOKIE_NAME,
        )

        user_cookie = create_signed_value(
            "test_cookie_secret", AUTH_COOKIE_NAME, json.dumps(user_info)
        ).decode("utf-8")

        tokens_cookie = create_signed_value(
            "test_cookie_secret", TOKENS_COOKIE_NAME, json.dumps(tokens)
        ).decode("utf-8")

        headers = tornado.httputil.HTTPHeaders()
        headers.add(
            "Cookie",
            f"{AUTH_COOKIE_NAME}={user_cookie}; {TOKENS_COOKIE_NAME}={tokens_cookie}",
        )

        return headers

    @patch("streamlit.web.server.oauth_authlib_routes.requests.post")
    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                client_secret="test_client_secret",
                load_server_metadata=MagicMock(
                    return_value={"token_endpoint": "https://provider.com/token"}
                ),
            ),
            "",
        ),
    )
    @patch.object(AuthRefreshHandler, "set_auth_cookie")
    def test_refresh_success(
        self, mock_set_auth_cookie, mock_create_oauth_client, mock_requests_post
    ):
        """Test successful token refresh."""
        # Mock successful token refresh response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "expires_in": 3600,
        }
        mock_requests_post.return_value = mock_response

        # Create test cookies
        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {
            "access_token": "old_access_token",
            "refresh_token": "old_refresh_token",
        }

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        # Verify response
        assert response.code == 302
        assert response.headers["Location"] == "/"

        # Verify token refresh was called correctly
        mock_requests_post.assert_called_once()
        call_args = mock_requests_post.call_args
        assert call_args[0][0] == "https://provider.com/token"
        assert call_args[1]["data"]["grant_type"] == "refresh_token"
        assert call_args[1]["data"]["refresh_token"] == "old_refresh_token"
        assert call_args[1]["data"]["client_id"] == "test_client_id"
        assert call_args[1]["data"]["client_secret"] == "test_client_secret"

        # Verify auth cookie was set with updated tokens
        mock_set_auth_cookie.assert_called_once()
        updated_user_info, updated_tokens = mock_set_auth_cookie.call_args[0]
        assert updated_user_info == user_info
        assert updated_tokens["access_token"] == "new_access_token"
        assert updated_tokens["refresh_token"] == "new_refresh_token"

    def test_refresh_missing_cookies(self):
        """Test refresh handler with missing authentication cookies."""
        response = self.fetch("/auth/refresh", follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"

    def test_refresh_missing_refresh_token(self):
        """Test refresh handler with missing refresh token."""
        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {"access_token": "test_token"}  # Missing refresh_token

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch("streamlit.web.server.oauth_authlib_routes.requests.post")
    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                client_secret="test_client_secret",
                load_server_metadata=MagicMock(
                    return_value={"token_endpoint": "https://provider.com/token"}
                ),
            ),
            "",
        ),
    )
    def test_refresh_token_endpoint_error(
        self, mock_create_oauth_client, mock_requests_post
    ):
        """Test refresh handler when token endpoint returns error."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_requests_post.return_value = mock_response

        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {"access_token": "test_token", "refresh_token": "test_refresh"}

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

    def test_refresh_invalid_json_cookies(self):
        """Test refresh handler with invalid JSON in cookies."""
        from tornado.web import create_signed_value

        headers = tornado.httputil.HTTPHeaders()
        invalid_user_cookie = create_signed_value(
            "test_cookie_secret", AUTH_COOKIE_NAME, "invalid json"
        ).decode("utf-8")
        invalid_tokens_cookie = create_signed_value(
            "test_cookie_secret", TOKENS_COOKIE_NAME, "invalid json"
        ).decode("utf-8")

        headers.add(
            "Cookie",
            f"{AUTH_COOKIE_NAME}={invalid_user_cookie}; {TOKENS_COOKIE_NAME}={invalid_tokens_cookie}",
        )

        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"

    def test_refresh_missing_provider(self):
        """Test refresh handler with missing provider in user info."""
        user_info = {
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
            # Missing provider field
        }
        tokens = {"access_token": "test_token", "refresh_token": "test_refresh"}

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                load_server_metadata=MagicMock(return_value={})  # No token_endpoint
            ),
            "",
        ),
    )
    def test_refresh_no_token_endpoint(self, mock_create_oauth_client):
        """Test refresh handler when provider has no token endpoint."""
        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {"access_token": "test_token", "refresh_token": "test_refresh"}

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch("streamlit.web.server.oauth_authlib_routes.requests.post")
    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                client_secret="test_client_secret",
                load_server_metadata=MagicMock(
                    return_value={"token_endpoint": "https://provider.com/token"}
                ),
            ),
            "",
        ),
    )
    def test_refresh_network_exception(
        self, mock_create_oauth_client, mock_requests_post
    ):
        """Test refresh handler when network request raises exception."""
        mock_requests_post.side_effect = Exception("Network error")

        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {"access_token": "test_token", "refresh_token": "test_refresh"}

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        assert response.code == 302
        assert response.headers["Location"] == "/"

    @patch("streamlit.web.server.oauth_authlib_routes.requests.post")
    @patch("streamlit.web.server.oauth_authlib_routes.requests.get")
    @patch(
        "streamlit.web.server.oauth_authlib_routes.create_oauth_client",
        return_value=(
            MagicMock(
                client_id="test_client_id",
                client_secret="test_client_secret",
                load_server_metadata=MagicMock(
                    return_value={"token_endpoint": "https://provider.com/token"}
                ),
                server_metadata={"jwks_uri": "https://provider.com/jwks"},
            ),
            "",
        ),
    )
    @patch("streamlit.web.server.oauth_authlib_routes.jose.jwt.decode")
    @patch.object(AuthRefreshHandler, "set_auth_cookie")
    def test_refresh_id_token_decode_failure(
        self,
        mock_set_auth_cookie,
        mock_jwt_decode,
        mock_create_oauth_client,
        mock_requests_get,
        mock_requests_post,
    ):
        """Test refresh handler when ID token decoding fails."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token",
            "id_token": "new_id_token",
        }
        mock_requests_post.return_value = mock_response

        mock_jwks_response = MagicMock()
        mock_jwks_response.json.return_value = {"keys": []}
        mock_requests_get.return_value = mock_jwks_response

        mock_jwt_decode.side_effect = Exception("Invalid token")

        user_info = {
            "provider": "google",
            "email": "test@example.com",
            "origin": "http://localhost:8501",
            "is_logged_in": True,
        }
        tokens = {"access_token": "old_token", "refresh_token": "old_refresh"}

        headers = self._create_signed_cookies(user_info, tokens)
        response = self.fetch("/auth/refresh", headers=headers, follow_redirects=False)

        # Should still succeed even if ID token decoding fails
        assert response.code == 302
        assert response.headers["Location"] == "/"

        # Verify auth cookie was set with tokens but unchanged user info
        mock_set_auth_cookie.assert_called_once()
        updated_user_info, updated_tokens = mock_set_auth_cookie.call_args[0]
        assert (
            updated_user_info == user_info
        )  # Should be unchanged due to decode failure
        assert updated_tokens["access_token"] == "new_access_token"
        assert updated_tokens["refresh_token"] == "new_refresh_token"
        assert updated_tokens["id_token"] == "new_id_token"
