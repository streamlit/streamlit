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

from unittest.mock import MagicMock, patch

import tornado.httpserver
import tornado.testing
import tornado.web
import tornado.websocket

from streamlit.auth_util import encode_provider_token
from streamlit.web.server import oauth_authlib_routes
from streamlit.web.server.oauth_authlib_routes import (
    AuthCache,
    AuthCallbackHandler,
    AuthLoginHandler,
    AuthLogoutHandler,
)


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
        assert b'400: Missing "authorize_url" value' in response.body
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


class LogoutHandlerTest(tornado.testing.AsyncHTTPTestCase):
    def get_app(self):
        return tornado.web.Application(
            [
                (
                    r"/auth/logout",
                    AuthLogoutHandler,
                    {"base_url": ""},
                )
            ]
        )

    def test_logout_success(self):
        """Test logout handler success clear cookie."""
        response = self.fetch("/auth/logout", follow_redirects=False)
        assert response.code == 302
        assert response.headers["Location"] == "/"
        assert '_streamlit_user="";' in response.headers["Set-Cookie"]


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
                    return_value={"userinfo": {"email": "test@example.com"}}
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
            }
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
        """Test auth callback failure missing state."""
        response = self.fetch("/oauth2callback", follow_redirects=False)
        assert response.code == 400

    @patch.object(AuthCallbackHandler, "set_auth_cookie")
    def test_auth_callback_with_error_query_param(self, mock_set_auth_cookie):
        response = self.fetch(
            "/oauth2callback?state=123&error=foo", follow_redirects=False
        )
        mock_set_auth_cookie.assert_not_called()

        assert response.code == 302
        assert response.headers["Location"] == "/"
