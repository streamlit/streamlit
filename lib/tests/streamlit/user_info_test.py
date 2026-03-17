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

import base64
import json
import threading
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException, StreamlitAuthError
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
)
from streamlit.runtime.state import SafeSessionState, SessionState
from streamlit.user_info import TokensProxy
from tests.delta_generator_test_case import DeltaGeneratorTestCase

SECRETS_MOCK = {
    "redirect_uri": "http://localhost:8501/oauth2callback",
    "cookie_secret": "test_cookie_secret",
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


class UserInfoProxyTest(DeltaGeneratorTestCase):
    """Test UserInfoProxy."""

    def test_user_email_attr(self):
        """Test that `st.user.email` returns user info from ScriptRunContext"""
        assert st.user.email == "test@example.com"

    def test_user_email_key(self):
        assert st.user["email"] == "test@example.com"

    def test_user_non_existing_attr(self):
        """Test that an error is raised when called non existed attr."""
        with pytest.raises(AttributeError):
            st.write(st.user.attribute)

    def test_user_non_existing_key(self):
        """Test that an error is raised when called non existed key."""
        with pytest.raises(KeyError):
            st.write(st.user["key"])

    def test_user_cannot_be_modified_existing_key(self):
        """
        Test that an error is raised when try to assign new value to existing key.
        """
        with pytest.raises(StreamlitAPIException) as e:
            st.user["email"] = "NEW_VALUE"

        assert str(e.value) == "st.user cannot be modified"

    def test_user_cannot_be_modified_new_key(self):
        """
        Test that an error is raised when try to assign new value to new key.
        """
        with pytest.raises(StreamlitAPIException) as e:
            st.user["foo"] = "bar"

        assert str(e.value) == "st.user cannot be modified"

    def test_user_cannot_be_modified_existing_attr(self):
        """
        Test that an error is raised when try to assign new value to existing attr.
        """
        with pytest.raises(StreamlitAPIException) as e:
            st.user.email = "bar"

        assert str(e.value) == "st.user cannot be modified"

    def test_user_cannot_be_modified_new_attr(self):
        """
        Test that an error is raised when try to assign new value to new attr.
        """
        with pytest.raises(StreamlitAPIException) as e:
            st.user.foo = "bar"

        assert str(e.value) == "st.user cannot be modified"

    def test_user_len(self):
        assert len(st.user) == 1

    def test_st_user_reads_from_context_(self):
        """Test that st.user reads information from current ScriptRunContext
        And after ScriptRunContext changed, it returns new email
        """
        orig_report_ctx = get_script_run_ctx()

        forward_msg_queue = ForwardMsgQueue()

        try:
            add_script_run_ctx(
                threading.current_thread(),
                ScriptRunContext(
                    session_id="test session id",
                    _enqueue=forward_msg_queue.enqueue,
                    query_string="",
                    session_state=SafeSessionState(SessionState(), lambda: None),
                    uploaded_file_mgr=None,
                    main_script_path="",
                    user_info={"email": "something@else.com"},
                    fragment_storage=MemoryFragmentStorage(),
                    pages_manager=PagesManager(""),
                ),
            )

            assert st.user.email == "something@else.com"
        except Exception as e:
            raise e
        finally:
            add_script_run_ctx(threading.current_thread(), orig_report_ctx)

    @patch("streamlit.user_info.show_deprecation_warning")
    @patch("streamlit.user_info.has_shown_experimental_user_warning", False)
    def test_deprecate_st_experimental_user(self, mock_show_warning: MagicMock):
        """Test that we show deprecation warning only once."""
        st.write(st.experimental_user)

        expected_warning = (
            "Please replace `st.experimental_user` with `st.user`.\n\n"
            "`st.experimental_user` will be removed after 2025-11-06."
        )

        # We only show the warning a single time for a given object.
        mock_show_warning.assert_called_once_with(expected_warning)
        mock_show_warning.reset_mock()

        st.write(st.experimental_user)
        mock_show_warning.assert_not_called()


@patch(
    "streamlit.auth_util.secrets_singleton",
    MagicMock(
        load_if_toml_exists=MagicMock(return_value=True),
        get=MagicMock(return_value=SECRETS_MOCK),
    ),
)
class UserInfoAuthTest(DeltaGeneratorTestCase):
    """Test UserInfoProxy Auth functionality."""

    @parameterized.expand(["google", "microsoft", "auth0"])
    def test_user_login(self, provider):
        """Test that st.login sends correct proto message."""
        st.login(provider)

        c = self.get_message_from_queue().auth_redirect

        assert c.url.startswith("/auth/login?provider=")

        jwt_token = c.url.split("=")[1]
        raw_payload = jwt_token.split(".")[1]
        parsed_payload = json.loads(base64.b64decode(raw_payload + "==="))

        assert parsed_payload["provider"] == provider

    def test_user_login_with_invalid_provider(self):
        """Test that st.login raise exception for invalid provider."""
        with pytest.raises(StreamlitAuthError) as ex:
            st.login("invalid-provider")

        assert str(ex.value) == (
            "Authentication credentials in `.streamlit/secrets.toml` are missing for the "
            'authentication provider "invalid-provider". Please check your configuration.'
        )

    def test_user_login_with_provider_with_underscore(self):
        """Test that st.login raise exception for provider containing underscore."""
        with pytest.raises(StreamlitAuthError) as ex:
            st.login("invalid_provider")

        assert str(ex.value) == (
            """Auth provider name "invalid_provider" contains an underscore. """
            """Please use a provider name without underscores."""
        )

    def test_user_login_redirect_uri_missing(self):
        """Tests that an error is raised if the redirect uri is missing"""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(return_value={"google": {}}),
            ),
        ):
            with pytest.raises(StreamlitAuthError) as ex:
                st.login("google")

            assert (
                str(ex.value)
                == """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "redirect_uri" key. Please check your configuration."""
            )

    def test_user_login_cookie_secret_missing(self):
        """Tests that an error is raised if the cookie secret is missing in secrets.toml"""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "google": {},
                    }
                ),
            ),
        ):
            with pytest.raises(StreamlitAuthError) as ex:
                st.login("google")

            assert (
                str(ex.value)
                == """Authentication credentials in `.streamlit/secrets.toml` are missing the
            "cookie_secret" key. Please check your configuration."""
            )

    def test_user_login_required_fields_missing(self):
        """Tests that an error is raised if the required fields are missing"""
        with patch(
            "streamlit.auth_util.secrets_singleton",
            MagicMock(
                load_if_toml_exists=MagicMock(return_value=True),
                get=MagicMock(
                    return_value={
                        "redirect_uri": "http://localhost:8501/oauth2callback",
                        "cookie_secret": "test_cookie_secret",
                        "google": {},
                    }
                ),
            ),
        ):
            with pytest.raises(StreamlitAuthError) as ex:
                st.login("google")

            assert str(ex.value) == (
                "Authentication credentials in `.streamlit/secrets.toml` for the "
                'authentication provider "google" are missing the following keys: '
                "['client_id', 'client_secret', 'server_metadata_url']. Please check your "
                "configuration."
            )

    def test_user_logout(self):
        """Test that st.logout sends correct proto message."""
        st.logout()

        c = self.get_message_from_queue().auth_redirect

        assert c.url.startswith("/auth/logout")


class TestTokensProxy:
    """Test TokensProxy class functionality."""

    def test_tokens_proxy_access(self):
        """Test token access via key and attribute notation."""
        proxy = TokensProxy({"id": "token1", "access": "token2"})

        assert proxy["id"] == "token1"
        assert proxy.id == "token1"
        assert proxy["access"] == "token2"
        assert proxy.access == "token2"

    def test_tokens_proxy_empty(self):
        """Test TokensProxy with no tokens."""
        proxy = TokensProxy({})

        assert len(proxy) == 0
        with pytest.raises(KeyError):
            assert proxy["id"]
        with pytest.raises(AttributeError):
            assert proxy.id

    def test_tokens_proxy_readonly(self):
        """Test that tokens cannot be modified."""
        proxy = TokensProxy({"id": "test"})

        with pytest.raises(StreamlitAPIException):
            proxy.id = "modified"
        with pytest.raises(StreamlitAPIException):
            proxy["id"] = "modified"

    def test_tokens_proxy_to_dict(self):
        """Test that tokens can be converted to a dictionary."""
        proxy = TokensProxy({"id": "test", "access": "test"})
        assert proxy.to_dict() == {"id": "test", "access": "test"}
        proxy.to_dict()["id"] = "modified"
        assert proxy.to_dict() == {"id": "test", "access": "test"}


class UserInfoTokensTest(DeltaGeneratorTestCase):
    """Test st.user.tokens functionality."""

    @contextmanager
    def _with_user_context(self, user_info):
        """Helper to set up user context for testing.

        Uses ``self.forward_msg_queue`` so that messages enqueued during the
        test are retrievable via ``self.get_message_from_queue()``.
        """
        orig_report_ctx = get_script_run_ctx()

        try:
            add_script_run_ctx(
                threading.current_thread(),
                ScriptRunContext(
                    session_id="test session id",
                    _enqueue=self.forward_msg_queue.enqueue,
                    query_string="",
                    session_state=SafeSessionState(SessionState(), lambda: None),
                    uploaded_file_mgr=None,
                    main_script_path="",
                    user_info=user_info,
                    fragment_storage=MemoryFragmentStorage(),
                    pages_manager=PagesManager(""),
                ),
            )
            yield
        finally:
            add_script_run_ctx(threading.current_thread(), orig_report_ctx)

    def test_user_tokens_property_access(self):
        """Test that st.user.tokens returns a TokensProxy."""
        user_info = {
            "email": "test@example.com",
            "tokens": {"id": "token1", "access": "token2"},
        }

        with self._with_user_context(user_info):
            tokens = st.user.tokens
            assert isinstance(tokens, TokensProxy)
            assert tokens.id == "token1"
            assert tokens.access == "token2"

    def test_user_tokens_key_access(self):
        """Test that st.user['tokens'] returns a TokensProxy."""
        user_info = {
            "email": "test@example.com",
            "tokens": {"id": "token1", "access": "token2"},
        }

        with self._with_user_context(user_info):
            tokens = st.user["tokens"]
            assert isinstance(tokens, TokensProxy)
            assert tokens.id == "token1"
            assert tokens.access == "token2"

    def test_user_tokens_empty(self):
        """Test st.user.tokens when no tokens are present."""
        user_info = {"email": "test@example.com"}

        with self._with_user_context(user_info):
            tokens = st.user.tokens
            assert isinstance(tokens, TokensProxy)
            assert len(tokens) == 0

    def test_user_tokens_consistency(self):
        """Test that st.user.tokens and st.user['tokens'] return the same type."""
        user_info = {"email": "test@example.com", "tokens": {"id": "test_token"}}

        with self._with_user_context(user_info):
            tokens_prop = st.user.tokens
            tokens_key = st.user["tokens"]

            assert isinstance(tokens_prop, TokensProxy)
            assert isinstance(tokens_key, TokensProxy)
            assert tokens_prop.id == tokens_key.id

    def test_refresh_token_not_exposed(self):
        """Test that internal _refresh_token is not exposed through st.user."""
        user_info = {
            "email": "test@example.com",
            "_refresh_token": "secret",
            "tokens": {"id": "visible"},
        }

        with self._with_user_context(user_info):
            # _refresh_token must not appear in iteration, to_dict, or key access.
            assert "_refresh_token" not in dict(st.user)
            assert "_refresh_token" not in st.user.to_dict()
            with pytest.raises(KeyError):
                st.user["_refresh_token"]

    @patch(
        "streamlit.user_info.get_expose_tokens_config", return_value=["id", "access"]
    )
    @patch(
        "streamlit.web.server.oauth_authlib_routes.refresh_oauth_tokens",
    )
    def test_user_refresh_method(self, mock_refresh, mock_expose_tokens):
        """Test that st.user.refresh() updates user_info in-place and sends cookie update."""
        user_info = {
            "email": "old@example.com",
            "provider": "google",
            "_refresh_token": "old_refresh",
            "tokens": {"id": "old_id", "access": "old_access"},
        }

        mock_refresh.return_value = (
            {"email": "new@example.com", "provider": "google"},
            {
                "id_token": "new_id",
                "access_token": "new_access",
                "refresh_token": "new_refresh",
            },
        )

        with self._with_user_context(user_info):
            st.user.refresh()

            # Verify user_info was updated in-place.
            assert user_info["email"] == "new@example.com"
            assert user_info["_refresh_token"] == "new_refresh"
            assert user_info["tokens"] == {"id": "new_id", "access": "new_access"}

            # Verify a ForwardMsg is sent for cookie update.
            c = self.get_message_from_queue().auth_redirect
            assert c.url.startswith("/auth/refresh")
            assert c.is_background_refresh is True

    @patch(
        "streamlit.web.server.oauth_authlib_routes.refresh_oauth_tokens",
        return_value=None,
    )
    def test_user_refresh_no_result_does_not_update(self, mock_refresh):
        """Test that a failed refresh does not modify user_info."""
        user_info = {
            "email": "test@example.com",
            "provider": "google",
            "_refresh_token": "tok",
            "tokens": {"id": "old_id"},
        }

        with self._with_user_context(user_info):
            st.user.refresh()

            # user_info must remain unchanged.
            assert user_info["email"] == "test@example.com"
            assert user_info["tokens"] == {"id": "old_id"}

    def test_user_refresh_no_refresh_token_is_noop(self):
        """Test that refresh() is a no-op when no refresh token is stored."""
        user_info = {
            "email": "test@example.com",
            "provider": "google",
            "tokens": {"id": "old_id"},
        }

        with self._with_user_context(user_info):
            st.user.refresh()

            # Anti-regression: no ForwardMsg should be enqueued.
            assert user_info["email"] == "test@example.com"

    @patch(
        "streamlit.user_info.get_expose_tokens_config", return_value=["id", "access"]
    )
    @patch(
        "streamlit.web.server.oauth_authlib_routes.refresh_oauth_tokens",
    )
    def test_user_refresh_auth_cache_contains_cookie_metadata(
        self, mock_refresh, mock_expose_tokens
    ):
        """Test that refresh() stores origin, and provider in auth_cache.

        Without these fields the ``_parse_user_cookie()`` origin validation
        fails on the next page reload and the user appears logged-out
        (is_logged_in=False).
        """
        user_info = {
            "email": "old@example.com",
            "provider": "google",
            "_refresh_token": "old_refresh",
            "tokens": {"id": "old_id", "access": "old_access"},
        }

        mock_refresh.return_value = (
            {"email": "new@example.com", "provider": "google"},
            {
                "id_token": "new_id",
                "access_token": "new_access",
                "refresh_token": "new_refresh",
            },
        )

        with self._with_user_context(user_info):
            with patch(
                "streamlit.user_info.get_origin_from_redirect_uri",
                return_value="http://localhost:8501",
            ):
                st.user.refresh()

            # Retrieve what was stored in the auth_cache.
            from streamlit.web.server.oauth_authlib_routes import auth_cache

            # The ForwardMsg URL contains the token_id as a query parameter.
            fwd = self.get_message_from_queue().auth_redirect
            import re

            match = re.search(r"token_id=([^&]+)", fwd.url)
            assert match is not None, "token_id not found in auth_redirect URL"
            token_id = match.group(1)

            cached = auth_cache.get(f"_refresh_{token_id}")
            assert cached is not None, "auth_cache entry missing for refresh"

            cookie_user_info = cached["user_info"]

            # These fields are required for _parse_user_cookie() to succeed.
            assert cookie_user_info["provider"] == "google"
            assert cookie_user_info["origin"] == "http://localhost:8501"

            # Internal keys must NOT be persisted in the cookie.
            assert "_refresh_token" not in cookie_user_info
            assert "tokens" not in cookie_user_info

            # Clean up the cache entry.
            auth_cache.delete(f"_refresh_{token_id}")
