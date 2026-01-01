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

"""Unit tests for authlib_tornado_integration.py."""

from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock

from streamlit.auth_util import AuthCache
from streamlit.runtime.secrets import AttrDict
from streamlit.web.server.authlib_tornado_integration import TornadoIntegration


class TornadoIntegrationStateDataTest(unittest.TestCase):
    """Tests for get_state_data and clear_state_data methods.

    These methods are overridden to use cache directly without requiring
    session persistence, since Tornado doesn't have persistent sessions.
    This is critical for compatibility with authlib 1.6.6+.
    """

    def test_get_state_data_from_cache_with_empty_session(self) -> None:
        """Verify get_state_data retrieves from cache even with empty session."""
        cache = AuthCache()
        integration = TornadoIntegration("google", cache=cache)

        # Manually set cache data (simulating what set_state_data does)
        state = "test_state_123"
        cache.set(
            f"_state_google_{state}",
            json.dumps({"data": {"redirect_uri": "http://example.com"}}),
            3600,
        )

        # Fresh empty session (like Tornado creates for each request)
        session: dict[str, object] = {}
        result = integration.get_state_data(session, state)

        assert result == {"redirect_uri": "http://example.com"}

    def test_get_state_data_returns_none_for_missing_state(self) -> None:
        """Verify get_state_data returns None when state doesn't exist in cache.

        This covers scenarios like:
        - OAuth state expired and was cleaned up
        - User navigates back/forward in browser with a stale callback URL
        - Replayed OAuth callback requests
        """
        cache = AuthCache()
        integration = TornadoIntegration("google", cache=cache)

        session: dict[str, object] = {}
        result = integration.get_state_data(session, "nonexistent_state")

        assert result is None

    def test_clear_state_data_removes_from_cache(self) -> None:
        """Verify clear_state_data removes data from cache."""
        cache = AuthCache()
        integration = TornadoIntegration("google", cache=cache)

        state = "test_state_456"
        cache.set(
            f"_state_google_{state}",
            json.dumps({"data": {"redirect_uri": "http://example.com"}}),
            3600,
        )

        # Verify data exists
        assert cache.get(f"_state_google_{state}") is not None

        # Clear with fresh session
        session: dict[str, object] = {}
        integration.clear_state_data(session, state)

        # Verify data is removed
        assert cache.get(f"_state_google_{state}") is None

    def test_full_state_flow_with_fresh_sessions(self) -> None:
        """Test the full OAuth state flow using fresh sessions for each step.

        This simulates the real Tornado behavior where each HTTP request
        gets a fresh session dict, ensuring compatibility with authlib 1.6.6+.
        """
        cache = AuthCache()
        integration = TornadoIntegration("google", cache=cache)

        state = "oauth_state_789"
        state_data = {"redirect_uri": "http://localhost:8501/callback", "nonce": "abc"}

        # Step 1: Login - set state data (uses parent class implementation)
        login_session: dict[str, object] = {}
        integration.set_state_data(login_session, state, state_data)

        # Verify cache has data
        assert cache.get(f"_state_google_{state}") is not None

        # Step 2: Callback - get state data with FRESH session
        callback_session: dict[str, object] = {}  # Completely new session
        retrieved_data = integration.get_state_data(callback_session, state)

        assert retrieved_data == state_data

        # Step 3: Cleanup - clear state data with FRESH session
        cleanup_session: dict[str, object] = {}  # Another new session
        integration.clear_state_data(cleanup_session, state)

        # Verify data is gone
        assert integration.get_state_data({}, state) is None


class TornadoIntegrationTest(unittest.TestCase):
    def test_load_basic_config(self):
        basic_config_mock = MagicMock(
            config={
                "google": {
                    "client_id": "GOOGLE_CLIENT_ID",
                    "client_secret": "GOOGLE_CLIENT_SECRET",
                    "something": "else",
                },
                "okta": {
                    "client_id": "OKTA_CLIENT_ID",
                    "client_secret": "OKTA_CLIENT_SECRET",
                },
            }
        )

        prepared_google_config = TornadoIntegration.load_config(
            basic_config_mock, "google", ["client_id", "client_secret"]
        )
        prepared_okta_config = TornadoIntegration.load_config(
            basic_config_mock, "okta", ["client_id", "client_secret"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
        }
        assert prepared_okta_config == {
            "client_id": "OKTA_CLIENT_ID",
            "client_secret": "OKTA_CLIENT_SECRET",
        }

    def test_load_config_with_client_kwargs(self):
        config_mock = MagicMock(
            config={
                "google": {
                    "client_id": "GOOGLE_CLIENT_ID",
                    "client_secret": "GOOGLE_CLIENT_SECRET",
                    "something": "else",
                    "client_kwargs": AttrDict(
                        {"prompt": "consent", "scope": "openid email profile"}
                    ),
                },
            }
        )

        prepared_google_config = TornadoIntegration.load_config(
            config_mock, "google", ["client_id", "client_secret", "client_kwargs"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
            "client_kwargs": {"prompt": "consent", "scope": "openid email profile"},
        }

    def test_load_config_with_attr_dict(self):
        config_mock = MagicMock(
            config=AttrDict(
                {
                    "google": AttrDict(
                        {
                            "client_id": "GOOGLE_CLIENT_ID",
                            "client_secret": "GOOGLE_CLIENT_SECRET",
                            "something": "else",
                            "client_kwargs": AttrDict(
                                {"prompt": "consent", "scope": "openid email profile"}
                            ),
                        }
                    ),
                }
            )
        )

        prepared_google_config = TornadoIntegration.load_config(
            config_mock, "google", ["client_id", "client_secret", "client_kwargs"]
        )

        assert prepared_google_config == {
            "client_id": "GOOGLE_CLIENT_ID",
            "client_secret": "GOOGLE_CLIENT_SECRET",
            "client_kwargs": {"prompt": "consent", "scope": "openid email profile"},
        }
