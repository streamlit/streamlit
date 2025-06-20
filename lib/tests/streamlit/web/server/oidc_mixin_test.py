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

"""Unit tests for oidc_mixin.py."""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import pytest
from authlib.integrations.base_client import OAuthError

from streamlit.web.server.oidc_mixin import TornadoOAuth2App


class TornadoOAuth2AppTest(unittest.TestCase):
    @patch(
        "streamlit.web.server.oidc_mixin.OAuth2Mixin.load_server_metadata",
        MagicMock(
            return_value={
                "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            }
        ),
    )
    def test_load_server_metadata_empty(self):
        """Test load_server_metadata with empty dict."""
        app = TornadoOAuth2App(MagicMock())
        result = app.load_server_metadata()
        assert result == {
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth"
        }
        assert app.client_kwargs == {}

    @patch(
        "streamlit.web.server.oidc_mixin.OAuth2Mixin.load_server_metadata",
        MagicMock(
            return_value={
                "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
                "code_challenge_methods_supported": ["plain", "S256"],
            }
        ),
    )
    def test_load_server_metadata_s256_plain(self):
        """Test load_server_metadata with S256 and plain code challenge methods."""
        app = TornadoOAuth2App(MagicMock())
        result = app.load_server_metadata()
        assert result == {
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "code_challenge_methods_supported": ["plain", "S256"],
        }
        assert app.client_kwargs == {"code_challenge_method": "S256"}

    def test_authorize_redirect(self):
        """Test authorize_redirect."""
        app = TornadoOAuth2App(MagicMock())
        app.create_authorization_url = MagicMock(
            return_value={"url": "https://example.com", "state": "some_state"}
        )
        request_handler = MagicMock()

        app.authorize_redirect(request_handler)
        request_handler.redirect.assert_called_once_with(
            "https://example.com", status=302
        )

        app.framework.set_state_data.assert_called_once_with(
            None, "some_state", {"redirect_uri": None, "url": "https://example.com"}
        )

    def test_authorize_redirect_error_no_state(self):
        """Test authorize_redirect without state raises error."""
        app = TornadoOAuth2App(MagicMock())
        app.create_authorization_url = MagicMock(
            return_value={"url": "https://example.com"}
        )
        request_handler = MagicMock()
        with pytest.raises(RuntimeError) as e:
            app.authorize_redirect(request_handler)

        assert e.match("Missing state value")

    def test_authorize_access_token_error(self):
        """Test authorize_access_token with error."""
        app = TornadoOAuth2App(MagicMock())
        with pytest.raises(OAuthError) as e:
            app.authorize_access_token(
                MagicMock(
                    get_argument=lambda x, *args: "some_error" if x == "error" else None
                )
            )
        assert e.match("some_error")

    @patch(
        "streamlit.web.server.oidc_mixin.TornadoOAuth2App.client_cls.request",
        MagicMock(
            return_value=MagicMock(
                json=MagicMock(
                    return_value={
                        "access_token": "payload",
                        "id_token": "id_token_payload",
                    }
                ),
                status_code=200,
            )
        ),
    )
    def test_authorize_access_token_success(self):
        """Test authorize_access_token with success."""
        app = TornadoOAuth2App(
            MagicMock(
                get_state_data=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "nonce": "some_nonce",
                    }
                )
            )
        )

        app.parse_id_token = MagicMock(
            return_value={"email": "authed_user@example.com"}
        )

        def get_argument_mock(name: str, *args):
            if name == "code":
                return "some_code"
            if name == "state":
                return "some_state"
            return None

        token = app.authorize_access_token(MagicMock(get_argument=get_argument_mock))

        app.parse_id_token.assert_called_once_with(
            {
                "access_token": "payload",
                "id_token": "id_token_payload",
            },
            nonce="some_nonce",
            claims_options=None,
        )

        assert token == {
            "access_token": "payload",
            "id_token": "id_token_payload",
            "userinfo": {
                "email": "authed_user@example.com",
            },
        }
