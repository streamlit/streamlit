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

import unittest
from typing import Any
from unittest.mock import MagicMock, patch

from streamlit.auth_util import AuthCache, get_expose_tokens_config, get_signing_secret

CONFIG_MOCK: dict[str, Any] = {}

SECRETS_MOCK = {
    "redirect_uri": "http://localhost:8501/oauth2callback",
    "cookie_secret": "your_cookie_secret_here",
    "google": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",
    },
    "microsoft": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
    },
    "auth0": {
        "client_id": "CLIENT_ID",
        "client_secret": "CLIENT_SECRET",
        "server_metadata_url": "https://YOUR_DOMAIN/.well-known/openid-configuration",
    },
}


class AuthUtilTest(unittest.TestCase):
    """Test auth utils."""

    def test_auth_cache(self):
        """Test AuthCache basic functionality."""
        cache = AuthCache()
        cache.set("key1", "value1", 3600)
        assert cache.get("key1") == "value1"
        cache.delete("key1")
        assert cache.get("key1") is None

    @patch(
        "streamlit.auth_util.secrets_singleton",
        MagicMock(
            load_if_toml_exists=MagicMock(return_value=True),
            get=MagicMock(return_value=SECRETS_MOCK),
        ),
    )
    @patch(
        "streamlit.auth_util.config",
        MagicMock(
            get_option=MagicMock(return_value="CONFIG_COOKIE_SECRET"),
        ),
    )
    def test_get_signing_secret(self):
        """Get the cookie signing secret from the configuration or secrets.toml."""
        x = get_signing_secret()
        assert x == "your_cookie_secret_here"


class ExposeTokensConfigTest(unittest.TestCase):
    """Test expose_tokens configuration parsing."""

    def test_expose_tokens_string_config(self):
        """Test expose_tokens as a string."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": "id",
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == ["id"]

    def test_expose_tokens_list_config(self):
        """Test expose_tokens as a list."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": ["id", "access"],
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == ["id", "access"]

    def test_expose_tokens_no_config(self):
        """Test when expose_tokens is not configured."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == []

    def test_expose_tokens_invalid_type(self):
        """Test expose_tokens with invalid type."""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "expose_tokens": 123,  # Invalid type
                    }
                ),
            ),
        ):
            result = get_expose_tokens_config()
            assert result == []
